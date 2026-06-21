function resolveApi() {
    const fromQuery = new URLSearchParams(location.search).get('api');
    if (fromQuery) return fromQuery;
    if (window.LUMA_PLAYGROUND_API) return window.LUMA_PLAYGROUND_API;
    const host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '') {
        return 'http://localhost:8000/run';
    }
    return '/run';
}
const PLAYGROUND_API = resolveApi();
const API_BASE = PLAYGROUND_API.replace(/\/run\/?$/, '');

const EXAMPLES = {
    'hello': `@module "main"

pub const main -> fn () int {
    output("Hello, Luma!\\n");
    return 0;
}
`,
    'fizzbuzz': `@module "main"

pub const main -> fn () int {
    loop [i: int = 1](i <= 15) : (++i) {
        if (i % 15 == 0) {
            output("FizzBuzz\\n");
        } elif (i % 3 == 0) {
            output("Fizz\\n");
        } elif (i % 5 == 0) {
            output("Buzz\\n");
        } else {
            output(i, "\\n");
        }
    }
    return 0;
}
`,
    'struct': `@module "main"

const Point -> struct {
    x: int,
    y: int,

    sum -> fn () int {
        return self.x + self.y;
    }
};

pub const main -> fn () int {
    let p: Point = Point { x: 3, y: 4 };
    output("x + y = ", p.sum(), "\\n");
    return 0;
}
`,
};

const input = document.getElementById('pgInput');
const highlight = document.getElementById('pgHighlight');
const output = document.getElementById('pgOutput');
const runBtn = document.getElementById('pgRun');
const status = document.getElementById('pgStatus');
const exampleSel = document.getElementById('pgExample');
const stdinEl = document.getElementById('pgStdin');

function render() {
    const code = input.value;
    highlight.innerHTML = Prism.highlight(code, Prism.languages.luma, 'luma');
}

function syncScroll() {
    highlight.parentElement.scrollTop = input.scrollTop;
    highlight.parentElement.scrollLeft = input.scrollLeft;
}

input.addEventListener('input', () => { render(); persist(); });
input.addEventListener('scroll', syncScroll);

input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const s = input.selectionStart;
        const eend = input.selectionEnd;
        input.value = input.value.slice(0, s) + '    ' + input.value.slice(eend);
        input.selectionStart = input.selectionEnd = s + 4;
        render();
        persist();
    }
    // Ctrl/Cmd+Enter runs.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        runCode();
    }
});

function persist() {
    localStorage.setItem('luma_playground_code', input.value);
}

function setCode(code) {
    input.value = code;
    render();
    persist();
}

function escapeHtml(s) {
    return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function setStatus(text, cls) {
    status.textContent = text;
    status.className = 'pg-status ' + (cls || '');
}

function showResult(data) {
    let html = '';

    if (!data.compile_ok) {
        html += '<span class="pg-label">Compile error</span>';
        html += '<span class="pg-stderr">' + escapeHtml(data.compile_output || '(no compiler output)') + '</span>';
        setStatus('Compilation failed', 'err');
    } else {
        if (data.compile_output && data.compile_output.trim()) {
            html += '<span class="pg-label">Compiler</span>';
            html += escapeHtml(data.compile_output);
        }
        html += '<span class="pg-label">Program output</span>';
        html += data.stdout ? escapeHtml(data.stdout) : '<span class="pg-placeholder">(no output)</span>';
        if (data.stderr && data.stderr.trim()) {
            html += '<span class="pg-label">Stderr</span>';
            html += '<span class="pg-stderr">' + escapeHtml(data.stderr) + '</span>';
        }
        const ok = data.exit_code === 0 && !data.timed_out;
        setStatus(
            data.timed_out ? 'Timed out' : 'Exited with code ' + data.exit_code,
            ok ? 'ok' : 'err'
        );
    }

    html += '<span class="pg-label">Info</span>';
    html += '<span class="pg-meta">Finished in ' + (data.duration_ms ?? '?') + ' ms</span>';
    output.innerHTML = html;
}

function showError(message) {
    setStatus('Error', 'err');
    output.innerHTML =
        '<span class="pg-label">Could not reach the Luma backend</span>' +
        '<span class="pg-stderr">' + escapeHtml(message) + '</span>' +
        '<span class="pg-label">Endpoint</span>' +
        '<span class="pg-meta">' + escapeHtml(PLAYGROUND_API) + '</span>' +
        '<span class="pg-meta">Start the backend (see server/README.md) or set the endpoint via ' +
        '<code>?api=https://your-host/run</code>.</span>';
}

async function runCode() {
    runBtn.disabled = true;
    setStatus('Running…', 'busy');
    output.innerHTML = '<span class="pg-placeholder">Compiling and running…</span>';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    try {
        const res = await fetch(PLAYGROUND_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: input.value, stdin: stdinEl ? stdinEl.value : '' }),
            signal: controller.signal,
        });
        if (res.status === 429 || res.status === 503) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.detail || (res.status === 429
                ? 'Rate limit exceeded. Please slow down.'
                : 'Server busy, try again in a moment.'));
        }
        if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText);
        const data = await res.json();
        showResult(data);
    } catch (err) {
        showError(err.name === 'AbortError' ? 'Request timed out after 60s.' : err.message);
    } finally {
        clearTimeout(timer);
        runBtn.disabled = false;
    }
}

runBtn.addEventListener('click', runCode);

// The spinning cube is a live terminal animation (infinite loop + ANSI codes),
// so it can't render in this console — load it from its file and explain how to
// run it locally instead.
const CUBE_FILE = '../examples/spinning_cube.lx';
const CUBE_NOTE =
    '<span class="pg-label">Run this one locally</span>' +
    '<span class="pg-meta">The spinning cube is a live terminal animation ' +
    '(it loops forever and uses ANSI color/cursor codes), so it won\'t render ' +
    'in this output panel. Copy the code and run it in a real terminal:</span>' +
    '<span class="pg-label">Commands</span>' +
    'STD=/usr/local/lib/luma/std\n' +
    'luma spinning_cube.lx \\\n' +
    '  -l $STD/math.lx $STD/libc.lx $STD/memory.lx $STD/string.lx \\\n' +
    '     $STD/termfx.lx $STD/time.lx $STD/io.lx \\\n' +
    '  --no-sanitize -name cube\n' +
    './cube      # Ctrl+C to stop';

async function loadExample(name) {
    if (name === 'cube') {
        setStatus('Local example', '');
        output.innerHTML = CUBE_NOTE;
        try {
            const res = await fetch(CUBE_FILE);
            setCode(res.ok ? await res.text() : '// Could not load spinning_cube.lx');
        } catch {
            setCode('// Could not load spinning_cube.lx');
        }
        return;
    }
    setCode(EXAMPLES[name] || EXAMPLES.hello);
    output.innerHTML = '<span class="pg-placeholder">Output will appear here.</span>';
    setStatus('Ready', '');
}

document.getElementById('pgReset').addEventListener('click', () => loadExample(exampleSel.value));
exampleSel.addEventListener('change', () => loadExample(exampleSel.value));

async function loadVersion() {
    const el = document.getElementById('pgVersion');
    if (!el) return;
    try {
        const res = await fetch(API_BASE + '/version');
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok && data.version) {
            el.textContent = 'Luma ' + data.version;
            el.title = data.raw || '';
            el.hidden = false;
        }
    } catch {
    }
}
loadVersion();

const saved = localStorage.getItem('luma_playground_code');
setCode(saved && saved.trim() ? saved : EXAMPLES.hello);

function toggleTheme() {
    const html = document.documentElement;
    const btn = document.querySelector('.theme-toggle');
    const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    if (btn) btn.textContent = newTheme === 'dark' ? '◐' : '◑';
    localStorage.setItem('theme', newTheme);
}
window.toggleTheme = toggleTheme;

const themeBtn = document.querySelector('.theme-toggle');
if (themeBtn) {
    themeBtn.textContent =
        document.documentElement.getAttribute('data-theme') === 'dark' ? '◐' : '◑';
}
