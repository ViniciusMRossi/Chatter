#!/usr/bin/env bash
# Optional helper for an interactive shell that stays open inside the development container.
# For one-shot/host-driven agent commands, prefer scripts/agent-commit.sh.
HARNESS="${1:-unknown-agent}"
HUMAN_NAME="$(git config --get user.name || echo Human)"
HUMAN_EMAIL="$(git config --get user.email || echo '')"
export GIT_AUTHOR_NAME="${HUMAN_NAME} [Agent]"
export GIT_AUTHOR_EMAIL="$HUMAN_EMAIL"
export GIT_COMMITTER_NAME="${HUMAN_NAME} [Agent]"
export GIT_COMMITTER_EMAIL="$HUMAN_EMAIL"
export SDD_AGENT_HARNESS="$HARNESS"
echo "Agent git identity active for this shell: $GIT_AUTHOR_NAME ($HARNESS)"
