#!/bin/sh
set -eu

APP_DIR="${PB_APP_DIR:-/usr/src/app}"
DATA_DIR="${PB_DATA_DIR:-$APP_DIR/pb_data}"
PUBLIC_DIR="${PB_PUBLIC_DIR:-$APP_DIR/pb_public}"
HOOKS_DIR="${PB_HOOKS_DIR:-$APP_DIR/pb_hooks}"
SCHEMA_PATH="${PB_SCHEMA_PATH:-$APP_DIR/pb_schema.json}"
MARKER="$DATA_DIR/.schema_imported"
SCHEMA_VERSION_MARKER="$DATA_DIR/.schema_v3"
HTTP_ADDR="${PB_HTTP_ADDR:-0.0.0.0:8090}"
# Bootstrap always binds locally so import can reach the API before publish.
BOOTSTRAP_ADDR="127.0.0.1:8090"
PB_URL="${PB_URL:-http://127.0.0.1:8090}"
AUTO_IMPORT="${PB_AUTO_IMPORT_SCHEMA:-true}"
AUTO_SEED="${PB_AUTO_SEED:-false}"

mkdir -p "$DATA_DIR" "$PUBLIC_DIR" "$HOOKS_DIR"

PB_BIN="$APP_DIR/pocketbase"

serve_args() {
  echo serve \
    --http="$1" \
    --dir="$DATA_DIR" \
    --publicDir="$PUBLIC_DIR" \
    --hooksDir="$HOOKS_DIR"
}

wait_for_health() {
  i=0
  while [ "$i" -lt 60 ]; do
    if wget -qO- "http://127.0.0.1:8090/api/health" >/dev/null 2>&1; then
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  echo "PocketBase did not become healthy in time" >&2
  return 1
}

stop_bg() {
  if [ -n "${PB_PID:-}" ] && kill -0 "$PB_PID" 2>/dev/null; then
    kill "$PB_PID" 2>/dev/null || true
    wait "$PB_PID" 2>/dev/null || true
  fi
  PB_PID=""
}

# Create/update superuser when credentials are provided (idempotent).
if [ -n "${PB_ADMIN_EMAIL:-}" ] && [ -n "${PB_ADMIN_PASSWORD:-}" ]; then
  echo "Ensuring PocketBase superuser: ${PB_ADMIN_EMAIL}"
  "$PB_BIN" superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" || true
fi

bootstrap_schema() {
  if [ "$AUTO_IMPORT" != "true" ]; then
    echo "PB_AUTO_IMPORT_SCHEMA!=true — skipping schema import"
    return 0
  fi

  if [ ! -f "$SCHEMA_PATH" ]; then
    echo "Schema file missing at $SCHEMA_PATH — skipping import" >&2
    return 1
  fi

  if [ -z "${PB_ADMIN_EMAIL:-}" ] || [ -z "${PB_ADMIN_PASSWORD:-}" ]; then
    echo "PB_ADMIN_EMAIL/PASSWORD required to import schema" >&2
    return 1
  fi

  if [ -f "$SCHEMA_VERSION_MARKER" ] && [ "${PB_FORCE_SCHEMA_IMPORT:-false}" != "true" ]; then
    echo "Schema v3 already imported (marker present). Skipping."
    return 0
  fi

  echo "Starting PocketBase for schema bootstrap..."
  # shellcheck disable=SC2046
  "$PB_BIN" $(serve_args "$BOOTSTRAP_ADDR") &
  PB_PID=$!

  if ! wait_for_health; then
    stop_bg
    return 1
  fi

  echo "Deploying collections schema..."
  export PB_URL PB_ADMIN_EMAIL PB_ADMIN_PASSWORD
  export PB_SCHEMA_PATH="$SCHEMA_PATH"
  # Allow merge updates when upgrading from older installs
  export PB_FORCE_SCHEMA_IMPORT="${PB_FORCE_SCHEMA_IMPORT:-false}"
  if node "$APP_DIR/scripts/import-schema.js"; then
    touch "$MARKER"
    touch "$SCHEMA_VERSION_MARKER"
    echo "Schema bootstrap complete."
  else
    echo "Schema import failed" >&2
    stop_bg
    return 1
  fi

  if [ "$AUTO_SEED" = "true" ]; then
    echo "Seeding sample data (PB_AUTO_SEED=true)..."
    node "$APP_DIR/scripts/seed.js" || echo "Seed failed (non-fatal)" >&2
  fi

  stop_bg
}

if [ "${1:-serve}" = "serve" ]; then
  bootstrap_schema
  echo "Serving PocketBase on ${HTTP_ADDR} (publicDir=${PUBLIC_DIR})"
  # shellcheck disable=SC2046
  exec "$PB_BIN" $(serve_args "$HTTP_ADDR")
fi

exec "$PB_BIN" "$@"
