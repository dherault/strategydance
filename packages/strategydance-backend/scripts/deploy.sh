#!/usr/bin/env bash
#
# Deploys the backend's image twice, as `bun run deploy:backend` and every push to main run it:
#
# 1. `strategydance-backend`, built on Cloud Run from the root `Dockerfile`, public: the invoker
#    check is off (`--no-invoker-iam-check`), since the organization's domain restricted sharing
#    refuses the `allUsers` member `--allow-unauthenticated` would grant, and what guards a route is
#    its own middleware. It keeps Cloud Run's defaults, timeout included
# 2. `strategydance-worker`, the very image the backend now runs, by digest, started with
#    `SERVICE=worker`, which mounts the internal routes and nothing else. Private: the invoker check
#    stays on, and only `conversation-tasks` may invoke it, a grant made by hand once (Setup 3 in
#    `documents/conversations.md`), so Cloud Run refuses any other caller before the code runs. A
#    task's request stays open for its whole run, hence the 15-minute timeout, and runs go a few at a
#    time on an instance
#
# Both run as the Compute Engine default service account, which needs the roles `CLAUDE.md` lists
# under Backend conventions. The worker deploys after the backend, so a failure between the two
# leaves the backend queueing runs to the worker's previous revision, or to none on its first
# deploy, whose tasks are refused and retried until the worker is there
set -euo pipefail

project=strategydance
region=us-central1
runtime_account=995028545701-compute@developer.gserviceaccount.com

# `--source ../..` uploads the workspace root, which the backend imports its siblings from
cd "$(dirname "$0")/.."

gcloud run deploy strategydance-backend \
  --source ../.. \
  --project "$project" \
  --region "$region" \
  --no-invoker-iam-check

# The image the revision just deployed runs, by its digest, so the worker runs the very build the
# backend does rather than whatever a tag points at by then. The deploy above waits for that
# revision to be ready, and fails otherwise
revision=$(gcloud run services describe strategydance-backend \
  --project "$project" \
  --region "$region" \
  --format 'value(status.latestReadyRevisionName)')
image=$(gcloud run revisions describe "$revision" \
  --project "$project" \
  --region "$region" \
  --format 'value(status.imageDigest)')

if [[ "$image" != *@sha256:* ]]; then
  echo "Revision $revision runs '$image', which names no digest, so the worker was not deployed" >&2
  exit 1
fi

gcloud run deploy strategydance-worker \
  --image "$image" \
  --project "$project" \
  --region "$region" \
  --service-account "$runtime_account" \
  --set-env-vars SERVICE=worker \
  --no-allow-unauthenticated \
  --invoker-iam-check \
  --timeout 900 \
  --concurrency 4
