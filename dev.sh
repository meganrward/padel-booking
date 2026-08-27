#!/usr/bin/env bash
# Runs backend (FastAPI on :8000) and frontend (Vite on :5173) together.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  echo "Stopping..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(cd "$REPO_ROOT/backend" && .venv/bin/uvicorn main:app --reload --port 8000) &
BACKEND_PID=$!

(cd "$REPO_ROOT/frontend" && npm run dev) &
FRONTEND_PID=$!

wait
