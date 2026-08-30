#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Not inside a Git repository." >&2; exit 2; }
cd "$ROOT"
MODE="${1:-}"; shift || true
FEATURE=""
COMMAND=""
RESULT=""
RATIONALE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --feature) FEATURE="$2"; shift 2 ;;
    --command) COMMAND="$2"; shift 2 ;;
    --result) RESULT="$2"; shift 2 ;;
    --rationale) RATIONALE="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$FEATURE" ]] || { echo "--feature is required" >&2; exit 2; }
case "$MODE" in red|green)
  [[ -n "$COMMAND" && -n "$RESULT" ]] || { echo "$MODE requires --command and --result" >&2; exit 2; } ;;
  skip)
  [[ -n "$RATIONALE" ]] || { echo "skip requires --rationale" >&2; exit 2; } ;;
  *) echo "Usage: tdd-evidence.sh {red|green|skip} --feature <slug> ..." >&2; exit 2 ;;
esac
SAFE="$(printf '%s' "$FEATURE" | tr -cs 'A-Za-z0-9._-' '-')"
DIR=.sdd/tdd-evidence; mkdir -p "$DIR"
FILE="$DIR/$SAFE.md"
[[ -f "$FILE" ]] || printf '# TDD Evidence: %s\n\n' "$FEATURE" > "$FILE"
{
  printf '## %s — %s\n\n' "${MODE^^}" "$(date -u +'%Y-%m-%d %H:%M UTC')"
  if [[ "$MODE" == skip ]]; then
    printf '**Rationale:** %s\n\n' "$RATIONALE"
  else
    printf '**Command:** `%s`\n\n**Observed result:** %s\n\n' "$COMMAND" "$RESULT"
  fi
} >> "$FILE"
echo "Recorded $MODE evidence in $FILE"
