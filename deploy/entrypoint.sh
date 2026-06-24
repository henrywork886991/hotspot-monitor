#!/usr/bin/env bash
# Dispatch the image into one of its roles:
#   api    — always-on read-only HTTP API (uvicorn)            [default]
#   worker — run the full pipeline on a loop (collect + AI)    [scheduler]
#   once   — run the pipeline exactly once (for k8s CronJob)
set -euo pipefail
MODE="${1:-api}"

case "$MODE" in
  api)
    exec python -m uvicorn api.main:app --host 0.0.0.0 --port "${PORT:-8900}"
    ;;
  worker)
    INTERVAL="${REFRESH_INTERVAL:-7200}"
    cd /app/scripts
    while true; do
      echo "[worker] refresh start $(date -u +%FT%TZ)"
      bash refresh.sh || echo "[worker] refresh FAILED (continuing)"
      echo "[worker] sleep ${INTERVAL}s"
      sleep "$INTERVAL"
    done
    ;;
  once)
    cd /app/scripts
    exec bash refresh.sh
    ;;
  *)
    exec "$@"
    ;;
esac
