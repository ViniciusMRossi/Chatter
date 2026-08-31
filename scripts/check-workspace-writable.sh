#!/usr/bin/env bash
# Verifies that the mutable SDD/Spec Kit workflow state in this project is
# writable by the current user.
#
# Project workflow runs container-first as the normal (non-root) development
# user. Bind mounts record the real uid/gid that created each path, so state
# created by the wrong user - for example a bootstrap container that ran as
# root - leaves a project the development user cannot write to, and Spec Kit
# commands fail partway through instead of at a clear boundary.
#
# Usage: bash scripts/check-workspace-writable.sh [project-root]
set -euo pipefail

ROOT="${1:-}"
if [[ -z "$ROOT" ]]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
cd "$ROOT"

# Trees generated and continuously mutated by Spec Kit / the workflow. These are
# checked recursively because Spec Kit writes deep inside them (constitution,
# specs, assessments, bug reports, workflow registry, agent skills).
RECURSIVE_ROOTS=(.specify .sdd)
for integration_dir in .claude .gemini; do
  [[ -d "$integration_dir" ]] && RECURSIVE_ROOTS+=("$integration_dir")
done

# Paths the workflow appends to, checked at the top level only so that ordinary
# project content underneath is never inspected or modified by this check.
SHALLOW_PATHS=(. Docs scripts)

MAX_REPORTED=15
offenders=()

record() {
  local path="$1"
  [[ -w "$path" ]] && return 0
  offenders+=("$path")
}

for path in "${SHALLOW_PATHS[@]}"; do
  [[ -e "$path" ]] || continue
  record "$path"
done

for tree in "${RECURSIVE_ROOTS[@]}"; do
  [[ -e "$tree" ]] || continue
  # Portable across GNU and BSD find: `-writable` is GNU-only, so test in bash.
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    record "$path"
  done < <(find "$tree" -print 2>/dev/null)
done

if ((${#offenders[@]} == 0)); then
  echo "ok: mutable workflow state is writable by uid $(id -u):$(id -g)"
  exit 0
fi

{
  echo "Mutable workflow state is not writable by uid $(id -u):$(id -g)."
  echo "${#offenders[@]} path(s) affected; showing up to $MAX_REPORTED:"
  for path in "${offenders[@]:0:$MAX_REPORTED}"; do
    detail="$(ls -ld "$path" 2>/dev/null || true)"
    echo "  ${detail:-$path}"
  done
  echo
  echo "Spec Kit and SDD workflow commands write into these paths, so they will"
  echo "fail partway through. Do not work around this by writing from the host."
  echo "See Docs/Workflow.md (workspace ownership) for the one-time repair."
} >&2
exit 1
