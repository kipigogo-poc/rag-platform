#!/usr/bin/env bash
# Usage:
#   ./start.sh           — start (no rebuild)
#   ./start.sh --build   — force rebuild before start
set -e

# ── Port finder (pure bash, no external tools needed) ────────────────────────
is_port_in_use() {
  (echo >/dev/tcp/localhost/"$1") 2>/dev/null
}

find_port() {
  local port=$1
  while is_port_in_use "$port"; do
    echo "  ⚠  Port $port in use, trying $((port + 1))…" >&2
    port=$((port + 1))
  done
  echo "$port"
}

DEFAULT_BACKEND=3001
DEFAULT_FRONTEND=3000

echo "🔍  Scanning for available ports…"
BACKEND_PORT=$(find_port $DEFAULT_BACKEND)
FRONTEND_PORT=$(find_port $DEFAULT_FRONTEND)
echo "  Backend   → http://localhost:$BACKEND_PORT"
echo "  Frontend  → http://localhost:$FRONTEND_PORT"
echo ""

# If backend port shifted, NEXT_PUBLIC_API_URL (baked into the Next.js bundle)
# will be wrong — force a frontend rebuild so it picks up the new URL.
EXTRA_FLAGS=("$@")
if [ "$BACKEND_PORT" != "$DEFAULT_BACKEND" ]; then
  echo "⚠  Backend port changed — forcing frontend rebuild to update API URL…"
  EXTRA_FLAGS=(--build "${EXTRA_FLAGS[@]}")
fi

export BACKEND_PORT
export FRONTEND_PORT
export NEXT_PUBLIC_API_URL="http://localhost:$BACKEND_PORT"

exec docker compose up "${EXTRA_FLAGS[@]}"
