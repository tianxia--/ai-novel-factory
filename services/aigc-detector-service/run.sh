#!/usr/bin/env bash
set -euo pipefail

HOST="${AIGC_DETECTOR_HOST:-127.0.0.1}"
PORT="${AIGC_DETECTOR_PORT:-8765}"

exec uvicorn app:app --host "$HOST" --port "$PORT"
