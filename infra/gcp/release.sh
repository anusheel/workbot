#!/usr/bin/env bash
# Releases one tag to Cloud Run in the current gcloud project, whose registry
# already holds the tag's two images. The migration and the eval smoke suite
# run first, as jobs with the new tools image; the services take the new images
# only if both pass, and both go back to their previous revisions if either
# fails to deploy (a revision that never becomes ready fails its deploy) or the
# app is not healthy behind the load balancer.
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
restore() {
  gcloud run services update-traffic workbot-web --region "$region" --to-revisions "$web=100"
  gcloud run services update-traffic workbot-realtime --region "$region" --to-revisions "$realtime=100"
}
trap 'restore; exit 1' ERR
gcloud run deploy workbot-web --region "$region" --image "$images/web:$tag"
gcloud run deploy workbot-realtime --region "$region" --image "$images/tools:$tag" \
  --command node --args=--import,tsx,realtime/server.ts
curl -sf "https://$DOMAIN/api/health" >/dev/null
