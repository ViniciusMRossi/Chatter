#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Not inside a Git repository." >&2; exit 2; }
CFG="$ROOT/.sdd/commands.env"
[[ -f "$CFG" ]] || { echo "Missing $CFG" >&2; exit 2; }
# shellcheck disable=SC1090
source "$CFG"

run_cmd() {
  local label="$1" cmd="$2"
  [[ -z "$cmd" ]] && return 0
  echo "==> $label: $cmd"
  bash -lc "$cmd"
}

if [[ -n "${SDD_FULL_VERIFY_COMMAND:-}" ]]; then
  run_cmd "full verification" "$SDD_FULL_VERIFY_COMMAND"
  exit 0
fi

configured=0
for v in SDD_BUILD_COMMAND SDD_LINT_COMMAND SDD_TYPECHECK_COMMAND SDD_UNIT_TEST_COMMAND SDD_INTEGRATION_TEST_COMMAND; do
  [[ -n "${!v:-}" ]] && configured=1
done
[[ "$configured" -eq 1 ]] || {
  echo "No verification commands configured in .sdd/commands.env. Configure them before implementation." >&2
  exit 2
}

run_cmd "build" "${SDD_BUILD_COMMAND:-}"
run_cmd "lint" "${SDD_LINT_COMMAND:-}"
run_cmd "typecheck" "${SDD_TYPECHECK_COMMAND:-}"
run_cmd "unit tests" "${SDD_UNIT_TEST_COMMAND:-}"
run_cmd "integration tests" "${SDD_INTEGRATION_TEST_COMMAND:-}"
