#!/usr/bin/env bash
# Authoritative development-container uid/gid resolution for this project.
#
# Container-first execution means Spec Kit and the workflow write into the
# bind-mounted workspace as the container's normal non-root user. That user's
# uid/gid must stay stable for the life of the project: bind mounts record the
# real creating uid/gid, so remapping the development user on a later
# `dev.sh up` leaves the project's existing .specify/ tree unwritable.
#
# Resolution policy (documented in Docs/Workflow.md, "Workspace ownership"):
#
#   1. Explicit SDD_HOST_UID / SDD_HOST_GID  -> used verbatim; must be numeric.
#   2. Windows host (Docker Desktop)         -> canonical container identity.
#   3. Other POSIX hosts (Linux, macOS)      -> the real host uid/gid.
#
# Windows is deliberately not host-mirrored. A Windows host has no POSIX uid:
# Git Bash / MSYS / Cygwin synthesize one from the Windows account SID (for
# example 197609), and Docker Desktop does not carry Windows ACLs into the Linux
# VM backing the bind mount. Mirroring that synthetic id therefore buys nothing
# and actively breaks the ownership contract, because it remaps `vscode` away
# from the uid that owns the project's existing workflow state.
#
# Linux and macOS are host-mirrored because there the bind mount is backed by
# real host ownership, so files the container creates must belong to the host
# user or the host can no longer edit its own project.
#
# Platform detection deliberately does not infer the host from which entrypoint
# was used. A Windows user running the bash entrypoint from Git Bash is a
# supported path, and assuming "bash implies POSIX host" is exactly the defect
# this file exists to remove. `uname` is the reliable signal under MSYS/MinGW.
#
# Usage: source this file, then call `sdd_resolve_dev_user`. It exports
# SDD_HOST_UID and SDD_HOST_GID.

# The pinned devcontainer base image ships its `vscode` user at 1000:1000, and
# .devcontainer/Dockerfile fails the build if that ever stops being true.
SDD_CANONICAL_DEV_UID='1000'
SDD_CANONICAL_DEV_GID='1000'

sdd_host_is_windows() {
  local sysname osname
  sysname="$(uname -s 2>/dev/null || true)"
  case "$sysname" in
    MINGW*|MSYS*|CYGWIN*|Windows_NT*) return 0 ;;
  esac
  # `uname -o` is absent on BSD/macOS; an empty value simply falls through.
  osname="$(uname -o 2>/dev/null || true)"
  case "$osname" in
    Msys|Cygwin|MS/Windows) return 0 ;;
  esac
  return 1
}

sdd_resolve_dev_user() {
  local uid="${SDD_HOST_UID:-}"
  local gid="${SDD_HOST_GID:-}"

  if [[ -z "$uid" || -z "$gid" ]]; then
    if sdd_host_is_windows || ! command -v id >/dev/null 2>&1; then
      uid="${uid:-$SDD_CANONICAL_DEV_UID}"
      gid="${gid:-$SDD_CANONICAL_DEV_GID}"
    else
      uid="${uid:-$(id -u)}"
      gid="${gid:-$(id -g)}"
    fi
  fi

  [[ "$uid" =~ ^[0-9]+$ ]] || { echo "SDD_HOST_UID must be a numeric uid; got '$uid'." >&2; return 2; }
  [[ "$gid" =~ ^[0-9]+$ ]] || { echo "SDD_HOST_GID must be a numeric gid; got '$gid'." >&2; return 2; }

  export SDD_HOST_UID="$uid"
  export SDD_HOST_GID="$gid"
}
