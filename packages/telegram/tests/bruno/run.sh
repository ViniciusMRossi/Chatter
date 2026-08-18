#!/usr/bin/env bash
# Starts the CI-safe webhook test server (StubTelegramTransport, zero real
# Telegram credentials), runs the bruno/telegram-adapter/local-webhook
# collection against it with the CI environment, then tears the server down —
# propagating bru's exit code either way.
#
# Binaries are invoked by their installed path rather than via npx/pnpm exec:
# tsx and @usebruno/cli are devDependencies of this package, but the two
# commands below need different working directories (this package, and the
# Bruno collection root, respectively), and directory-based resolution tools
# are one more thing to get wrong across that split. Direct paths are
# unambiguous either way.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
COLLECTION_DIR="$REPO_ROOT/bruno/telegram-adapter"
PORT="${PORT:-3300}"

TSX_BIN="$PACKAGE_DIR/node_modules/.bin/tsx"
BRU_BIN="$PACKAGE_DIR/node_modules/.bin/bru"

"$TSX_BIN" "$SCRIPT_DIR/webhook-test-server.ts" &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "Waiting for the webhook test server on :$PORT..."
READY=0
for _ in $(seq 1 40); do
  if curl -sf -o /dev/null "http://localhost:$PORT/received-count"; then
    READY=1
    break
  fi
  sleep 0.25
done
if [ "$READY" -ne 1 ]; then
  echo "Webhook test server did not become ready in time." >&2
  exit 1
fi
echo "Server is ready."

cd "$COLLECTION_DIR"
"$BRU_BIN" run local-webhook --env CI
