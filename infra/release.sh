#!/usr/bin/env bash
# Releases one tag of the images to the cluster of the current kube context.
# The schema goes first, then the new pods; if they never become ready, or the
# eval smoke suite fails against them, the previous release comes back.
# Usage: infra/release.sh <tag> [helm flags]
set -euo pipefail
tag=$1
shift
helm upgrade --install workbot "$(dirname "$0")/chart" --namespace workbot \
  --set tag="$tag" --rollback-on-failure --timeout 10m "$@"
if ! helm test workbot --namespace workbot --logs --timeout 10m; then
  helm rollback workbot --namespace workbot --wait
  exit 1
fi
