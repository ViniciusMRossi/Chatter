#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Not inside a Git repository." >&2; exit 2; }
DOCS="$ROOT/Docs"; HANDOFF="$DOCS/handoff.md"; DEVLOG="$DOCS/Dev-log.md"; ARCHIVE="$ROOT/.sdd/handoff-history.md"
mkdir -p "$DOCS" "$ROOT/.sdd"

REASON=manual; FEATURE=""; TICKET=""; SUMMARY=""; NEXT_STEP=""; TESTS=""; RED=""; GREEN=""; PR_URL=""; FEATURE_COMPLETE=false; HARNESS_ARG=""
BLOCKERS=(); QUESTIONS=(); GOTCHAS=(); CHALLENGES=(); DEBT=(); FOLLOWUPS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --reason) REASON="$2"; shift 2;; --feature) FEATURE="$2"; shift 2;; --ticket) TICKET="$2"; shift 2;;
    --summary) SUMMARY="$2"; shift 2;; --next-step) NEXT_STEP="$2"; shift 2;; --tests) TESTS="$2"; shift 2;;
    --red) RED="$2"; shift 2;; --green) GREEN="$2"; shift 2;; --pr-url) PR_URL="$2"; shift 2;;
    --blocker) BLOCKERS+=("$2"); shift 2;; --question) QUESTIONS+=("$2"); shift 2;; --gotcha) GOTCHAS+=("$2"); shift 2;;
    --challenge) CHALLENGES+=("$2"); shift 2;; --debt) DEBT+=("$2"); shift 2;; --follow-up) FOLLOWUPS+=("$2"); shift 2;;
    --harness) HARNESS_ARG="$2"; shift 2;; --feature-complete) FEATURE_COMPLETE=true; shift;;
    *) echo "Unknown argument: $1" >&2; exit 2;;
  esac
done
[[ -n "$SUMMARY" ]] || { echo "--summary is required; refusing to overwrite a useful handoff with placeholders." >&2; exit 2; }
[[ -n "$NEXT_STEP" ]] || { echo "--next-step is required; refusing to overwrite a useful handoff with placeholders." >&2; exit 2; }

TIMESTAMP="$(date -u +'%Y-%m-%d %H:%M UTC')"; BRANCH="$(git branch --show-current || true)"; COMMITS="$(git log --oneline -7 2>/dev/null || true)"; STATUS="$(git status --short 2>/dev/null || true)"; STAGED="$(git diff --cached --stat || true)"; UNSTAGED="$(git diff --stat || true)"; HARNESS="${HARNESS_ARG:-${SDD_AGENT_HARNESS:-unspecified}}"
print_list(){ local -n arr=$1; if [[ ${#arr[@]} -eq 0 ]]; then echo "- None recorded."; else for x in "${arr[@]}"; do echo "- $x"; done; fi; }

if [[ -s "$HANDOFF" ]]; then
  { printf '\n---\n\n## Archived %s\n\n' "$TIMESTAMP"; cat "$HANDOFF"; } >> "$ARCHIVE"
fi
TMP="$(mktemp "$DOCS/.handoff.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
{
  echo "# Handoff"; echo; echo "_Updated: $TIMESTAMP | harness: $HARNESS | reason: ${REASON}_"; echo
  echo "## Current work"; echo "- Feature/spec: ${FEATURE:-unspecified}"; echo "- Tracking issue: ${TICKET:-unspecified}"; echo "- Branch: ${BRANCH:-detached/unknown}"; echo "- PR: ${PR_URL:-none}"; echo
  echo "## Summary"; echo "$SUMMARY"; echo; echo "## Next step"; echo "$NEXT_STEP"; echo
  echo "## Verification performed"; echo "${TESTS:-No verification result recorded.}"; echo
  echo "## TDD evidence"; echo "- RED: ${RED:-not recorded}"; echo "- GREEN: ${GREEN:-not recorded}"; echo
  echo "## Git status"; echo '```text'; echo "${STATUS:-clean}"; echo '```'; echo
  echo "### Staged diff stat"; echo '```text'; echo "${STAGED:-none}"; echo '```'; echo "### Unstaged diff stat"; echo '```text'; echo "${UNSTAGED:-none}"; echo '```'; echo
  echo "## Recent commits"; echo '```text'; echo "${COMMITS:-none}"; echo '```'; echo
  echo "## Blockers"; print_list BLOCKERS; echo; echo "## Open questions"; print_list QUESTIONS; echo; echo "## Gotchas"; print_list GOTCHAS
} > "$TMP"
mv "$TMP" "$HANDOFF"; trap - EXIT
echo "Wrote $HANDOFF (previous handoff archived in $ARCHIVE when present)"

if [[ "$FEATURE_COMPLETE" == true ]]; then
  {
    echo; echo "## $(date -u +%Y-%m-%d) - ${FEATURE:-${TICKET:-Untitled}}"; echo
    echo "**Shipped:** $SUMMARY"; echo; echo "**Verification:** ${TESTS:-Not recorded.}"; echo
    echo "**TDD RED:** ${RED:-not recorded}"; echo; echo "**TDD GREEN:** ${GREEN:-not recorded}"; echo
    echo "### Challenges"; print_list CHALLENGES; echo; echo "### Technical debt / compromises"; print_list DEBT; echo; echo "### Follow-up"; print_list FOLLOWUPS
  } >> "$DEVLOG"
  echo "Appended $DEVLOG"
fi
