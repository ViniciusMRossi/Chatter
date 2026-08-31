#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# One authoritative uid/gid policy, shared with the bootstrap entrypoint and
# with scripts/dev.ps1. Resolving it here (rather than inline) is what keeps a
# later `dev.sh up` from remapping the development user away from the uid that
# owns this project's existing workflow state.
# shellcheck source=scripts/resolve-dev-user.sh
source "$SCRIPT_DIR/resolve-dev-user.sh"
sdd_resolve_dev_user

is_running() {
  [[ -n "$(docker compose ps --status running -q dev 2>/dev/null)" ]]
}

resolve_home_volume() {
  local ids container_id volume_name
  ids="$(docker compose ps -aq dev 2>/dev/null || true)"
  container_id="${ids%%$'\n'*}"
  if [[ -z "$container_id" ]]; then
    docker compose create --no-deps dev >/dev/null
    ids="$(docker compose ps -aq dev 2>/dev/null || true)"
    container_id="${ids%%$'\n'*}"
  fi
  [[ -n "$container_id" ]] || { echo "Could not resolve the dev container needed to locate /sdd-home." >&2; return 1; }
  volume_name="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/sdd-home"}}{{.Name}}{{end}}{{end}}' "$container_id")"
  [[ -n "$volume_name" ]] || { echo "Could not resolve the named volume mounted at /sdd-home." >&2; return 1; }
  printf '%s\n' "$volume_name"
}

# A development container that cannot write this project's existing workflow
# state is precisely the failure the uid/gid policy exists to prevent. Report it
# at the boundary instead of letting the next Spec Kit command fail partway
# through. `up` still succeeds: the documented repair runs through this
# container, so it must remain reachable.
warn_if_workspace_unwritable() {
  [[ -f scripts/check-workspace-writable.sh ]] || return 0
  local report
  if ! report="$(docker compose exec -T dev bash scripts/check-workspace-writable.sh 2>&1)"; then
    printf '%s
' "$report" >&2
    echo "Development container identity: $(docker compose exec -T dev id 2>/dev/null || echo unknown)" >&2
    echo "See Docs/Workflow.md (workspace ownership) for the one-time repair." >&2
  fi
}

require_running() {
  if ! is_running; then
    echo "Development container is not running. Run: scripts/dev.sh up" >&2
    exit 2
  fi
}

case "${1:-}" in
  up)
    docker compose up -d --build dev
    sleep 1
    is_running || { echo "Development container failed to stay running. Run: docker compose ps -a && docker compose logs dev" >&2; exit 1; }
    warn_if_workspace_unwritable
    ;;
  down)
    docker compose down
    ;;
  reset-home)
    home_volume="$(resolve_home_volume)"
    docker compose down
    docker volume rm "$home_volume" >/dev/null
    echo "Removed persistent development HOME volume: $home_volume"
    ;;
  shell)
    shift
    require_running
    if [[ $# -gt 0 ]]; then
      docker compose exec -T dev bash "$@"
    else
      docker compose exec dev bash
    fi
    ;;
  exec)
    shift
    require_running
    [[ $# -gt 0 ]] || { echo "Usage: scripts/dev.sh exec <command...>" >&2; exit 2; }
    docker compose exec -T dev "$@"
    ;;
  run)
    shift
    [[ $# -gt 0 ]] || { echo "Usage: scripts/dev.sh run <command...>" >&2; exit 2; }
    docker compose run --rm dev "$@"
    ;;
  verify)
    docker compose run --rm dev bash scripts/verify.sh
    ;;
  check)
    docker compose run --rm dev bash scripts/workflow-check.sh
    ;;
  status)
    docker compose ps
    ;;
  *)
    echo "Usage: scripts/dev.sh {up|down|reset-home|shell [bash args...]|exec <cmd...>|run <cmd...>|verify|check|status}" >&2
    exit 2
    ;;
esac
