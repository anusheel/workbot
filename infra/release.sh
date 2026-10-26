#!/usr/bin/env bash
# Releases one tag of the images to the cluster of the current kube context.
# The schema goes first, then the new pods; if they never become ready, or the
# eval smoke suite fails against them, the previous release comes back.
# Usage: [NAMESPACE=<tenant>] infra/release.sh <tag> [helm flags]
set -euo pipefail
tag=$1
shift
ns=${NAMESPACE:-workbot}
helm upgrade --install workbot "$(dirname "$0")/chart" --namespace "$ns" \
  --set tag="$tag" --rollback-on-failure --timeout 10m "$@"
if ! helm test workbot --namespace "$ns" --logs --timeout 10m; then
  helm rollback workbot --namespace "$ns" --wait
  exit 1
fi
