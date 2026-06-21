#!/usr/bin/env bash
#
# Deploy the Luma playground backend to Google Cloud Run.
#
# Cloud Run runs your container image (unlike Vercel functions), so the luma
# toolchain works. The open question is the bubblewrap sandbox — verify it after
# deploy (see the curl /health check at the end). If bwrap is blocked by Cloud
# Run's sandbox, the safety model falls back to: one program per instance
# (--concurrency=1) + restricted egress (see the VPC note below).
#
# Prereqs: gcloud CLI authenticated (`gcloud auth login`), a GCP project, and
# the Artifact Registry + Cloud Run APIs enabled:
#   gcloud services enable run.googleapis.com artifactregistry.googleapis.com
#
# Usage:  PROJECT=my-proj REGION=us-central1 ./deploy-cloudrun.sh
set -euo pipefail

# ── Config (override via env) ────────────────────────────────────────────────
PROJECT="${PROJECT:?set PROJECT=your-gcp-project-id}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-luma-playground}"
# Source image (the rolling GHCR image built by playground-image.yml).
GHCR_IMAGE="${GHCR_IMAGE:-ghcr.io/luma-programming-language/luma-playground:latest}"
# Cloud Run can't always pull GHCR directly, so mirror into Artifact Registry.
AR_REPO="${AR_REPO:-containers}"
AR_IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${AR_REPO}/${SERVICE}:latest"

# ── 1. Mirror GHCR -> Artifact Registry ──────────────────────────────────────
gcloud artifacts repositories describe "$AR_REPO" --location "$REGION" --project "$PROJECT" >/dev/null 2>&1 \
  || gcloud artifacts repositories create "$AR_REPO" --repository-format=docker \
       --location "$REGION" --project "$PROJECT"

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
docker pull "$GHCR_IMAGE"
docker tag "$GHCR_IMAGE" "$AR_IMAGE"
docker push "$AR_IMAGE"

# ── 2. Deploy to Cloud Run ───────────────────────────────────────────────────
# --execution-environment=gen2  : microVM (more syscalls; best chance for bwrap)
# --concurrency=1               : one user program per instance = isolation boundary
# --no-cpu-throttling           : the program gets full CPU during its run
gcloud run deploy "$SERVICE" \
  --project "$PROJECT" \
  --region "$REGION" \
  --image "$AR_IMAGE" \
  --execution-environment=gen2 \
  --port 8000 \
  --concurrency 1 \
  --cpu 2 \
  --memory 2Gi \
  --timeout 30 \
  --max-instances 5 \
  --min-instances 0 \
  --no-cpu-throttling \
  --allow-unauthenticated \
  --set-env-vars "LUMA_RUN_TIMEOUT=5,LUMA_COMPILE_TIMEOUT=20,LUMA_MAX_CONCURRENCY=1,LUMA_CORS_ORIGINS=*"

URL="$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(status.url)')"
echo
echo "Deployed: $URL"
echo "Verify the sandbox is active (want \"sandbox\":\"bwrap\"):"
echo "  curl -s $URL/health"
echo
echo "Then set this in vercel.json (both /run and /version destinations):"
echo "  $URL"

# ── Egress lockdown (IMPORTANT if /health shows \"sandbox\":\"none\") ──────────
# Without bwrap, untrusted programs have internet access. Restrict it by routing
# all egress through a VPC with a deny-all firewall, then redeploy with:
#   --vpc-egress=all-traffic --network=<vpc> --subnet=<subnet>
# (Cloud Run + Direct VPC egress; pair with a firewall rule denying egress.)
