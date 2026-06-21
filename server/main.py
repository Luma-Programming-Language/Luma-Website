import asyncio
import collections
import os
import re
import shutil
import signal
import sys
import tempfile
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

LUMA_BIN = os.environ.get("LUMA_BIN", "luma")
# Where the Luma standard-library .lx sources live (linked on demand via -l).
STD_DIR = os.environ.get("LUMA_STD_DIR", "/usr/local/lib/luma/std")
COMPILE_TIMEOUT = float(os.environ.get("LUMA_COMPILE_TIMEOUT", "20"))
RUN_TIMEOUT = float(os.environ.get("LUMA_RUN_TIMEOUT", "5"))
MAX_CODE_BYTES = int(os.environ.get("LUMA_MAX_CODE_BYTES", str(100_000)))
MAX_OUTPUT_BYTES = int(os.environ.get("LUMA_MAX_OUTPUT_BYTES", str(64_000)))
CORS_ORIGINS = os.environ.get("LUMA_CORS_ORIGINS", "*")
# Sandbox: "auto" (use bubblewrap if present, else none), "bwrap", or "none".
# When active, every compile/run executes in a bubblewrap namespace with NO
# network, a read-only host, hidden /home & /root, and a writable /work only.
SANDBOX = os.environ.get("LUMA_SANDBOX", "auto").lower()
# Address-space cap applied to the RUN step only (the user binary tolerates it;
# the LLVM/lld compile does NOT — it reserves huge virtual ranges and crashes).
# 0 disables. Physical-memory limits should come from a container/cgroup.
RUN_MEM_BYTES = int(os.environ.get("LUMA_RUN_MEM_BYTES", str(512 * 1024 * 1024)))
# Max bytes any single file write may produce (partial anti disk-fill).
FSIZE_LIMIT = int(os.environ.get("LUMA_FSIZE_BYTES", str(16 * 1024 * 1024)))
# Max concurrent compile/run jobs across the whole server (CPU/RAM backpressure).
MAX_CONCURRENCY = int(os.environ.get("LUMA_MAX_CONCURRENCY", "4"))
# Per-client-IP rate limit: at most RATE_LIMIT requests per RATE_WINDOW seconds.
RATE_LIMIT = int(os.environ.get("LUMA_RATE_LIMIT", "30"))
RATE_WINDOW = float(os.environ.get("LUMA_RATE_WINDOW", "60"))

app = FastAPI(title="Luma Playground", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if CORS_ORIGINS == "*" else [o.strip() for o in CORS_ORIGINS.split(",")],
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

class RunRequest(BaseModel):
    code: str = Field(..., description="Luma source code to compile and run")
    stdin: str = Field("", description="Optional data piped to the program's stdin")

class RunResponse(BaseModel):
    compile_ok: bool
    compile_output: str
    stdout: str
    stderr: str
    exit_code: int | None
    timed_out: bool
    duration_ms: int

def _truncate(data: bytes) -> str:
    text = data.decode("utf-8", errors="replace")
    if len(text) > MAX_OUTPUT_BYTES:
        text = text[:MAX_OUTPUT_BYTES] + "\n... [output truncated]"
    return text


_ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[a-zA-Z]")


def _clean_compiler_text(text: str) -> str:
    """Collapse the compiler's \\r progress redraws and strip ANSI codes."""
    lines = []
    for line in text.split("\n"):
        if "\r" in line:
            line = line.split("\r")[-1]  # keep the final redraw of the line
        line = _ANSI_RE.sub("", line)
        if line.strip():
            lines.append(line)
    return "\n".join(lines)

def _make_preexec(mem_limit_bytes: int):
    """Return a preexec_fn applying rlimits to the child (POSIX only)."""
    if os.name != "posix":
        return None

    def _pre() -> None:
        try:
            import resource

            if mem_limit_bytes > 0:
                resource.setrlimit(resource.RLIMIT_AS, (mem_limit_bytes, mem_limit_bytes))
            # CPU-seconds backstop to the wall-clock timeout.
            cpu = int(COMPILE_TIMEOUT + RUN_TIMEOUT) + 1
            resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu))
            resource.setrlimit(resource.RLIMIT_CORE, (0, 0))  # no core dumps
            if FSIZE_LIMIT > 0:  # cap per-file writes
                resource.setrlimit(resource.RLIMIT_FSIZE, (FSIZE_LIMIT, FSIZE_LIMIT))
        except Exception:
            pass

    return _pre


# ── Bubblewrap sandbox ───────────────────────────────────────────────────────
def _resolve_sandbox() -> bool:
    if SANDBOX == "none":
        return False
    have = shutil.which("bwrap") is not None
    if SANDBOX == "bwrap" and not have:
        print("WARNING: LUMA_SANDBOX=bwrap but bwrap not found on PATH.", file=sys.stderr)
        return False
    if SANDBOX not in ("auto", "bwrap", "none"):
        print(f"WARNING: unknown LUMA_SANDBOX={SANDBOX!r}; treating as 'auto'.", file=sys.stderr)
    if not have:
        print("WARNING: bubblewrap not found — running WITHOUT a sandbox. "
              "Do not expose this publicly. Install bubblewrap or set LUMA_SANDBOX=none "
              "to silence this.", file=sys.stderr)
    return have


SANDBOX_ON = _resolve_sandbox()


def _bwrap(workdir: str) -> list[str]:
    """A locked-down bubblewrap prefix: no network, RO host, writable /work."""
    return [
        "bwrap",
        "--unshare-all",            # new net/pid/ipc/uts/user/cgroup namespaces
        "--die-with-parent",        # killed if the server dies
        "--new-session",            # detach controlling terminal
        "--clearenv",
        "--setenv", "PATH", "/usr/local/bin:/usr/bin:/bin",
        "--setenv", "HOME", "/work",
        "--proc", "/proc",
        "--dev", "/dev",
        "--tmpfs", "/tmp",
        "--ro-bind", "/usr", "/usr",            # toolchain + stdlib (under /usr)
        "--ro-bind-try", "/bin", "/bin",
        "--ro-bind-try", "/lib", "/lib",
        "--ro-bind-try", "/lib64", "/lib64",
        "--ro-bind-try", "/etc/ld.so.cache", "/etc/ld.so.cache",
        "--ro-bind-try", "/etc/ld.so.conf", "/etc/ld.so.conf",
        "--ro-bind-try", "/etc/ld.so.conf.d", "/etc/ld.so.conf.d",
        "--bind", workdir, "/work",             # the ONLY writable host path
        "--chdir", "/work",
    ]


def _wrap(cmd: list[str], workdir: str) -> list[str]:
    return _bwrap(workdir) + cmd if SANDBOX_ON else cmd

def _kill_group(proc) -> None:
    try:
        if os.name == "posix":
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        else:
            proc.kill()
    except (ProcessLookupError, PermissionError):
        pass

async def _exec(cmd: list[str], cwd: str, timeout: float, stdin: bytes = b"", mem_limit: int = 0):
    stdin_fh = asyncio.subprocess.DEVNULL
    if stdin:
        stdin_path = os.path.join(cwd, ".stdin")
        with open(stdin_path, "wb") as f:
            f.write(stdin)
        stdin_fh = open(stdin_path, "rb")

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=cwd,
            stdin=stdin_fh,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            preexec_fn=_make_preexec(mem_limit),
            start_new_session=(os.name == "posix"),
        )
    finally:
        if stdin_fh is not asyncio.subprocess.DEVNULL:
            stdin_fh.close()

    comm = asyncio.ensure_future(proc.communicate())
    done, _ = await asyncio.wait({comm}, timeout=timeout)

    if comm not in done:
        _kill_group(proc)
        try:
            out, err = await comm
        except Exception:
            out, err = b"", b""
        return None, out, err, True

    out, err = await comm
    return proc.returncode, out, err, False

_PLATFORM_SKIP = ("darwin", "win32", "windows")
_USE_RE = re.compile(r'@use\s+"([^"]+)"')
_MODULE_RE = re.compile(r'@module\s+"([^"]+)"')
_std_module_map: dict[str, str] | None = None


def _build_std_map() -> dict[str, str]:
    """module-name -> stdlib file path (cached)."""
    global _std_module_map
    if _std_module_map is not None:
        return _std_module_map

    mapping: dict[str, str] = {}
    try:
        for fname in os.listdir(STD_DIR):
            if not fname.endswith(".lx") or any(p in fname.lower() for p in _PLATFORM_SKIP):
                continue
            path = os.path.join(STD_DIR, fname)
            try:
                with open(path, "r", encoding="utf-8", errors="replace") as f:
                    m = _MODULE_RE.search(f.read())
            except OSError:
                continue
            if m:
                mapping.setdefault(m.group(1), path)
    except OSError:
        pass

    _std_module_map = mapping
    return mapping


def _resolve_links(code: str) -> list[str]:
    """Return stdlib files needed by `code`, following transitive @use deps."""
    mapping = _build_std_map()
    seen_modules: set[str] = set()
    paths: list[str] = []
    queue = [code]
    while queue:
        for mod in _USE_RE.findall(queue.pop()):
            if mod in seen_modules:
                continue
            seen_modules.add(mod)
            path = mapping.get(mod)
            if path and path not in paths:
                paths.append(path)
                try:
                    with open(path, "r", encoding="utf-8", errors="replace") as f:
                        queue.append(f.read())
                except OSError:
                    pass
    return paths

_rate: dict[str, "collections.deque[float]"] = {}
_active = 0

def _rate_ok(ip: str) -> bool:
    now = time.monotonic()
    dq = _rate.setdefault(ip, collections.deque())
    while dq and dq[0] <= now - RATE_WINDOW:
        dq.popleft()
    if len(dq) >= RATE_LIMIT:
        return False
    dq.append(now)
    return True

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "luma": shutil.which(LUMA_BIN) or LUMA_BIN,
        "std_modules": sorted(_build_std_map().keys()),
        "sandbox": "bwrap" if SANDBOX_ON else "none",
        "active_jobs": _active,
    }

_version_cache: dict | None = None

@app.get("/version")
async def version():
    global _version_cache
    if _version_cache is not None:
        return _version_cache

    if shutil.which(LUMA_BIN) is None:
        return {"version": None, "raw": "", "ok": False}

    code, out, err, timed_out = await _exec(
        [LUMA_BIN, "--version"], tempfile.gettempdir(), 10
    )
    raw = ((out or b"") + (err or b"")).decode("utf-8", errors="replace").strip()

    if timed_out or not raw:
        return {"version": None, "raw": raw, "ok": False}

    match = re.search(r"v?\d+\.\d+(?:\.\d+)?", raw)
    ver = match.group(0) if match else raw
    if not ver.lower().startswith("v"):
        ver = "v" + ver

    _version_cache = {"version": ver, "raw": raw, "ok": True}
    return _version_cache

@app.post("/run", response_model=RunResponse)
async def run(req: RunRequest, request: Request):
    global _active
    started = time.monotonic()

    # Abuse controls (checked before doing any work).
    client_ip = request.client.host if request.client else "?"
    if not _rate_ok(client_ip):
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": str(int(RATE_WINDOW))},
            content={"detail": "Rate limit exceeded. Please slow down."},
        )
    if _active >= MAX_CONCURRENCY:  # atomic: no await between check and increment
        return JSONResponse(
            status_code=503,
            headers={"Retry-After": "2"},
            content={"detail": "Server busy, try again in a moment."},
        )

    if len(req.code.encode("utf-8")) > MAX_CODE_BYTES:
        return RunResponse(
            compile_ok=False,
            compile_output=f"Source exceeds the {MAX_CODE_BYTES}-byte limit.",
            stdout="",
            stderr="",
            exit_code=None,
            timed_out=False,
            duration_ms=int((time.monotonic() - started) * 1000),
        )

    # No compiler on this host (e.g. a serverless runtime) — fail clearly
    # instead of crashing with FileNotFoundError.
    if shutil.which(LUMA_BIN) is None:
        return RunResponse(
            compile_ok=False,
            compile_output="The Luma compiler is not available in this environment. "
                           "The playground backend must run on a host with the Luma "
                           "toolchain (see server/ deployment notes).",
            stdout="",
            stderr="",
            exit_code=None,
            timed_out=False,
            duration_ms=int((time.monotonic() - started) * 1000),
        )

    _active += 1
    workdir = tempfile.mkdtemp(prefix="luma-")
    try:
        src = os.path.join(workdir, "main.lx")
        with open(src, "w", encoding="utf-8") as f:
            f.write(req.code)

        links = _resolve_links(req.code)
        compile_cmd = [LUMA_BIN, "main.lx"]
        if links:
            compile_cmd += ["-l", *links]
        compile_cmd += ["-name", "main"]
        c_code, c_out, c_err, c_timeout = await _exec(
            _wrap(compile_cmd, workdir), workdir, COMPILE_TIMEOUT
        )
        compile_output = _clean_compiler_text(_truncate((c_out or b"") + (c_err or b"")))
        binary = os.path.join(workdir, "main")

        if c_timeout:
            return RunResponse(
                compile_ok=False,
                compile_output=compile_output or "Compilation timed out.",
                stdout="",
                stderr="",
                exit_code=None,
                timed_out=True,
                duration_ms=int((time.monotonic() - started) * 1000),
            )

        if c_code != 0 or not os.path.exists(binary):
            return RunResponse(
                compile_ok=False,
                compile_output=compile_output or "Compilation failed.",
                stdout="",
                stderr="",
                exit_code=c_code,
                timed_out=False,
                duration_ms=int((time.monotonic() - started) * 1000),
            )

        os.chmod(binary, 0o755)
        run_cmd = ["/work/main"] if SANDBOX_ON else [binary]
        r_code, r_out, r_err, r_timeout = await _exec(
            _wrap(run_cmd, workdir), workdir, RUN_TIMEOUT,
            stdin=req.stdin.encode("utf-8"), mem_limit=RUN_MEM_BYTES,
        )

        return RunResponse(
            compile_ok=True,
            compile_output=compile_output,
            stdout=_truncate(r_out or b""),
            stderr=_truncate(r_err or b"") + ("\nProgram timed out." if r_timeout else ""),
            exit_code=r_code,
            timed_out=r_timeout,
            duration_ms=int((time.monotonic() - started) * 1000),
        )
    finally:
        _active -= 1
        shutil.rmtree(workdir, ignore_errors=True)
