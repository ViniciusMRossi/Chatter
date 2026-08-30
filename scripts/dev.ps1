param(
  [Parameter(Position=0)]
  [ValidateSet('up','down','reset-home','shell','exec','run','verify','check','status')]
  [string]$Action = 'shell',
  [Parameter(ValueFromRemainingArguments=$true)]
  [string[]]$Rest
)
$ErrorActionPreference='Stop'

# Docker Desktop bind mounts are normally mapped to the image's default dev uid/gid.
$env:SDD_HOST_UID = if ($env:SDD_HOST_UID) { $env:SDD_HOST_UID } else { '1000' }
$env:SDD_HOST_GID = if ($env:SDD_HOST_GID) { $env:SDD_HOST_GID } else { '1000' }

function Test-DevRunning {
  $containerId = docker compose ps --status running -q dev 2>$null
  return -not [string]::IsNullOrWhiteSpace(($containerId -join ''))
}

function Get-HomeVolumeName {
  $containerIds = @(docker compose ps -aq dev 2>$null | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($containerIds.Count -eq 0) {
    docker compose create --no-deps dev | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the dev container needed to locate /sdd-home.' }
    $containerIds = @(docker compose ps -aq dev 2>$null | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  }
  if ($containerIds.Count -eq 0) { throw 'Could not resolve the dev container needed to locate /sdd-home.' }
  $volumeName = docker inspect --format '{{range .Mounts}}{{if eq .Destination "/sdd-home"}}{{.Name}}{{end}}{{end}}' $containerIds[0]
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($volumeName)) { throw 'Could not resolve the named volume mounted at /sdd-home.' }
  return $volumeName.Trim()
}

function Require-DevRunning {
  if (-not (Test-DevRunning)) {
    throw 'Development container is not running. Run: ./scripts/dev.ps1 up'
  }
}

switch ($Action) {
  'up' {
    docker compose up -d --build dev
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Start-Sleep -Seconds 1
    if (-not (Test-DevRunning)) { throw 'Development container failed to stay running. Run: docker compose ps -a; docker compose logs dev' }
  }
  'down' { docker compose down }
  'reset-home' {
    $homeVolume = Get-HomeVolumeName
    docker compose down
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    docker volume rm $homeVolume | Out-Null
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "Removed persistent development HOME volume: $homeVolume"
  }
  'shell' {
    Require-DevRunning
    if ($Rest.Count -gt 0) { docker compose exec -T dev bash @Rest }
    else { docker compose exec dev bash }
  }
  'exec' {
    Require-DevRunning
    if ($Rest.Count -eq 0) { throw 'Usage: ./scripts/dev.ps1 exec <command...>' }
    docker compose exec -T dev @Rest
  }
  'run' {
    if ($Rest.Count -eq 0) { throw 'Usage: ./scripts/dev.ps1 run <command...>' }
    docker compose run --rm dev @Rest
  }
  'verify' { docker compose run --rm dev bash scripts/verify.sh }
  'check' { docker compose run --rm dev bash scripts/workflow-check.sh }
  'status' { docker compose ps }
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
