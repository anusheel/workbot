#!/usr/bin/env bash
# Releases one tag to Cloud Run in the current gcloud project, whose registry
# already holds the tag's two images. The migration and the eval smoke suite
# run first, as jobs with the new tools image; the services take the new images
# only if both pass, and go back to their previous revisions if the app is not
# healthy behind the load balancer.
# Usage: DOMAIN=app.workbot.example.com infra/gcp/release.sh <tag>
set -euo pipefail
tag=$1
region=${REGION:-us-central1}
images=$region-docker.pkg.dev/$(gcloud config get-value project)/workbot
for job in migrate smoke; do
  gcloud run jobs update "workbot-$job" --region "$region" --image "$images/tools:$tag"
  gcloud run jobs execute "workbot-$job" --region "$region" --wait
done
revision() { gcloud run services describe "$1" --region "$region" --format='value(status.latestReadyRevisionName)'; }
web=$(revision workbot-web)
realtime=$(revision workbot-realtime)
gcloud run deploy workbot-web --region "$region" --image "$images/web:$tag"
gcloud run deploy workbot-realtime --region "$region" --image "$images/tools:$tag" \
  --command node --args=--import,tsx,realtime/server.ts
if ! curl -sf "https://$DOMAIN/api/health" >/dev/null; then
  gcloud run services update-traffic workbot-web --region "$region" --to-revisions "$web=100"
  gcloud run services update-traffic workbot-realtime --region "$region" --to-revisions "$realtime=100"
  exit 1
fi
