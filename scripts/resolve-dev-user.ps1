# Authoritative development-container uid/gid resolution for this project.
#
# This is the PowerShell half of one shared policy; scripts/resolve-dev-user.sh
# is the bash half and carries the full rationale. The two must always agree,
# because a Windows user may legitimately drive the project from either
# PowerShell or Git Bash and must get the same development identity from both.
#
# Resolution policy (documented in Docs/Workflow.md, "Workspace ownership"):
#
#   1. Explicit SDD_HOST_UID / SDD_HOST_GID  -> used verbatim; must be numeric.
#   2. Windows host (Docker Desktop)         -> canonical container identity.
#   3. Other POSIX hosts (Linux, macOS)      -> the real host uid/gid.
#
# PowerShell is the Windows entrypoint in practice, but PowerShell 7 also runs
# on Linux and macOS, so the platform is detected rather than assumed.
#
# Usage: dot-source this file, then call `Resolve-SddDevUser`. It sets
# $env:SDD_HOST_UID / $env:SDD_HOST_GID and returns them.

# The pinned devcontainer base image ships its `vscode` user at 1000:1000, and
# .devcontainer/Dockerfile fails the build if that ever stops being true.
$SddCanonicalDevUid = '1000'
$SddCanonicalDevGid = '1000'

function Test-SddHostIsWindows {
  # $IsWindows exists only in PowerShell 6+. Windows PowerShell 5.1 has no such
  # variable and ships on Windows only, so its absence means Windows.
  $flag = Get-Variable -Name 'IsWindows' -ErrorAction SilentlyContinue
  if ($null -ne $flag) { return [bool]$flag.Value }
  return $true
}

function Resolve-SddDevUser {
  $uid = $env:SDD_HOST_UID
  $gid = $env:SDD_HOST_GID

  if ([string]::IsNullOrWhiteSpace($uid) -or [string]::IsNullOrWhiteSpace($gid)) {
    if (Test-SddHostIsWindows) {
      if ([string]::IsNullOrWhiteSpace($uid)) { $uid = $SddCanonicalDevUid }
      if ([string]::IsNullOrWhiteSpace($gid)) { $gid = $SddCanonicalDevGid }
    } else {
      if ([string]::IsNullOrWhiteSpace($uid)) { $uid = (& id -u | Out-String) }
      if ([string]::IsNullOrWhiteSpace($gid)) { $gid = (& id -g | Out-String) }
    }
  }

  $uid = "$uid".Trim()
  $gid = "$gid".Trim()
  if ($uid -notmatch '^[0-9]+$') { throw "SDD_HOST_UID must be a numeric uid; got '$uid'." }
  if ($gid -notmatch '^[0-9]+$') { throw "SDD_HOST_GID must be a numeric gid; got '$gid'." }

  $env:SDD_HOST_UID = $uid
  $env:SDD_HOST_GID = $gid
  return [pscustomobject]@{ Uid = $uid; Gid = $gid }
}
