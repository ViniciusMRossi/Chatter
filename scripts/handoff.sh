#!/usr/bin/env bash
# scripts/handoff.sh
#
# Harness-agnostic handoff writer. Any agent CLI (Claude Code, Codex,
# OpenCode, Cursor, Gemini CLI, ...) can shell out to this — it doesn't
# depend on any CLI-specific feature. Also safe to run manually.
#
# Usage:
#   scripts/handoff.sh [--ticket <id>] [--reason manual|ticket-complete|context-low] \
#                       [--summary "text"] [--feature-complete]
#
# Env:
#   SDD_AGENT_HARNESS   set by scripts/agent-git-env.sh; recorded in the handoff file
#                       and devlog entry so you know which CLI/agent wrote them.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
DOCS_DIR="$REPO_ROOT/Docs"
HANDOFF_FILE="$DOCS_DIR/handoff.md"
DEVLOG_FILE="$DOCS_DIR/Dev-log.md"

REASON="manual"
TICKET=""
SUMMARY=""
FEATURE_COMPLETE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ticket) TICKET="$2"; shift 2 ;;
    --reason) REASON="$2"; shift 2 ;;
    --summary) SUMMARY="$2"; shift 2 ;;
    --feature-complete) FEATURE_COMPLETE=true; shift ;;
    *) echo "Unknown arg: $1" >&2; shift ;;
  esac
done

mkdir -p "$DOCS_DIR"

BRANCH="$(git branch --show-current 2>/dev/null || echo "unknown")"
LAST_COMMITS="$(git log --oneline -5 2>/dev/null || echo "no commits yet")"
DIFF_STAT="$(git diff --stat 2>/dev/null || true)"
HARNESS="${SDD_AGENT_HARNESS:-unspecified}"
TIMESTAMP="$(date -u +"%Y-%m-%d %H:%M UTC")"

cat > "$HANDOFF_FILE" <<EOF
# Handoff

_Last updated: $TIMESTAMP by $HARNESS ($REASON)_

## Where we are
- Branch: $BRANCH
- Ticket: ${TICKET:-unspecified}

## Recent commits
\`\`\`
$LAST_COMMITS
\`\`\`

## Uncommitted changes
\`\`\`
${DIFF_STAT:-none}
\`\`\`

## Next step
${SUMMARY:-_Fill in before ending session._}

## Open questions / blockers
_(edit as needed)_

## Gotchas
_(edit as needed — things a fresh session would otherwise rediscover the hard way)_
EOF

echo "Wrote $HANDOFF_FILE"

if [ "$FEATURE_COMPLETE" = true ]; then
  {
    echo ""
    echo "## $(date -u +%Y-%m-%d) — ${TICKET:-Untitled} ($HARNESS)"
    echo "${SUMMARY:-_No summary provided._}"
  } >> "$DEVLOG_FILE"
  echo "Appended entry to $DEVLOG_FILE"
fi
