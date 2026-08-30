#!/usr/bin/env bash
set -euo pipefail
HARNESS="${1:?Usage: agent-commit.sh <harness> <git commit args...>}"; shift
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Not inside a Git repository." >&2; exit 2; }
cd "$ROOT"
HUMAN_NAME="$(git config --get user.name || true)"; HUMAN_EMAIL="$(git config --get user.email || true)"
[[ -n "$HUMAN_NAME" && -n "$HUMAN_EMAIL" ]] || { echo "Configure git user.name and user.email first." >&2; exit 2; }
trailers=(--trailer "Generated-by: ${HARNESS}")
if [[ -n "${SDD_AGENT_COAUTHOR_NAME:-}" && -n "${SDD_AGENT_COAUTHOR_EMAIL:-}" ]]; then
  trailers+=(--trailer "Co-authored-by: ${SDD_AGENT_COAUTHOR_NAME} <${SDD_AGENT_COAUTHOR_EMAIL}>")
fi
exec git \
  -c "user.name=${HUMAN_NAME} [Agent]" \
  -c "user.email=${HUMAN_EMAIL}" \
  commit "${trailers[@]}" "$@"
