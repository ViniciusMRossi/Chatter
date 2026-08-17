#!/usr/bin/env bash
# scripts/agent-git-env.sh
#
# Source (not execute) this at the start of an agent session so its commits
# are attributable without touching persistent repo/global git config:
#
#   source scripts/agent-git-env.sh "claude-code"
#
# This reads your existing `git config user.name` (e.g. "Vinny") and exports
# GIT_AUTHOR_NAME / GIT_COMMITTER_NAME as "Vinny [Agent]" for the lifetime of
# this shell/session only. Your own manual commits are unaffected as long as
# you run them from a shell that hasn't sourced this file.
#
# Pair with a commit trailer to record which specific harness made the
# commit, e.g.:
#   git commit -m "feat: add auth flow" --trailer "Generated-by: $SDD_AGENT_HARNESS"

HARNESS="${1:-unknown-agent}"

HUMAN_NAME="$(git config --get user.name || echo "Human")"
HUMAN_EMAIL="$(git config --get user.email || echo "")"

export GIT_AUTHOR_NAME="${HUMAN_NAME} [Agent]"
export GIT_AUTHOR_EMAIL="${HUMAN_EMAIL}"
export GIT_COMMITTER_NAME="${HUMAN_NAME} [Agent]"
export GIT_COMMITTER_EMAIL="${HUMAN_EMAIL}"
export SDD_AGENT_HARNESS="${HARNESS}"

echo "Git identity set to: ${GIT_AUTHOR_NAME} <${GIT_AUTHOR_EMAIL}> (harness: ${HARNESS})"
