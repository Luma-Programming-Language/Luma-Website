# Playground backend image.
#
# Base = the rolling Luma compiler image published to GHCR by the Luma repo's
# build.yml on every push to main (debian-slim with luma at /usr/local + std).
# Pulling :latest makes the playground track main. Pin to :sha-<gitsha> instead
# for reproducible/controlled deploys.
#
# NOTE: build with --pull (or no base-layer cache) so :latest is actually fetched
# fresh on each rebuild, e.g.  docker build --pull -t luma-playground server/
ARG LUMA_BASE=ghcr.io/luma-programming-language/luma:latest
FROM ${LUMA_BASE}

# Python (to run the FastAPI app) + bubblewrap (for the execution sandbox).
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip bubblewrap \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN python3 -m pip install --no-cache-dir --break-system-packages -r requirements.txt
COPY main.py .

# Run the API as a non-root user (defense in depth on top of the sandbox).
RUN useradd -m runner || adduser -D runner || true
USER runner

ENV LUMA_BIN=luma \
    LUMA_COMPILE_TIMEOUT=20 \
    LUMA_RUN_TIMEOUT=5 \
    LUMA_SANDBOX=auto \
    LUMA_CORS_ORIGINS=*

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
