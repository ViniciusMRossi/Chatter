#!/usr/bin/env bash
set -euo pipefail

export SDD_HOST_UID="${SDD_HOST_UID:-$(id -u)}"
export SDD_HOST_GID="${SDD_HOST_GID:-$(id -g)}"

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
