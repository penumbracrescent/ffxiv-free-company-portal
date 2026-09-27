[CmdletBinding()]
param(
  [string]$ProjectPath = $PSScriptRoot,
  [string]$DestinationDirectory = (Join-Path $PSScriptRoot 'backups')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$project = [System.IO.Path]::GetFullPath($ProjectPath)
$envPath = Join-Path $project '.env'
$composePath = Join-Path $project 'compose.yaml'
if (-not (Test-Path -LiteralPath $envPath)) { throw "No .env file was found in $project." }
if (-not (Test-Path -LiteralPath $composePath)) { throw "No compose.yaml file was found in $project." }

New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stage = Join-Path $DestinationDirectory ".cotf-backup-$stamp-$([guid]::NewGuid().ToString('N'))"
$archive = Join-Path $DestinationDirectory "cotf-portal-backup-$stamp.tar.gz"
New-Item -ItemType Directory -Path $stage | Out-Null

try {
  Copy-Item -LiteralPath $envPath -Destination (Join-Path $stage 'installation.env')
  Copy-Item -LiteralPath $composePath -Destination (Join-Path $stage 'installation-compose.yaml')
  & docker compose --project-directory $project -f $composePath exec -T db sh -c 'rm -f /tmp/cotf-portal.dump && pg_dump -Fc --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tmp/cotf-portal.dump'
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL could not create the logical backup.' }
  & docker compose --project-directory $project -f $composePath cp db:/tmp/cotf-portal.dump (Join-Path $stage 'portal.dump')
  if ($LASTEXITCODE -ne 0) { throw 'The PostgreSQL backup could not be copied out of the database container.' }
  & docker compose --project-directory $project -f $composePath exec -T db rm -f /tmp/cotf-portal.dump | Out-Null

  $dataSource = Join-Path $project 'data'
  if (Test-Path -LiteralPath $dataSource) {
    $dataTarget = Join-Path $stage 'data'
    New-Item -ItemType Directory -Path $dataTarget | Out-Null
    foreach ($entry in (Get-ChildItem -LiteralPath $dataSource -Force)) {
      if ($entry.Name -ne 'setup') { Copy-Item -LiteralPath $entry.FullName -Destination $dataTarget -Recurse -Force }
    }
  }

  $manifest = [ordered]@{
    format = 'cotf-portal-backup'
    version = 1
    createdAt = (Get-Date).ToUniversalTime().ToString('o')
    database = 'portal.dump'
    environment = 'installation.env'
    compose = 'installation-compose.yaml'
    data = @('*')
    excluded = @('data/setup', 'backups')
    warning = 'Contains private credentials and community data. Store securely.'
  }
  [System.IO.File]::WriteAllText((Join-Path $stage 'manifest.json'), ($manifest | ConvertTo-Json -Depth 5), [System.Text.UTF8Encoding]::new($false))
  & tar -czf $archive -C $stage .
  if ($LASTEXITCODE -ne 0) { throw 'The portable archive could not be created.' }
  if ((Get-Item -LiteralPath $archive).Length -lt 1024) { throw 'The backup archive is unexpectedly small.' }
  Write-Host "Backup created: $archive" -ForegroundColor Green
  Write-Warning 'This archive contains the database, service credentials, member data, and private tokens. Treat it like a password.'
} finally {
  $resolvedStage = [System.IO.Path]::GetFullPath($stage)
  $resolvedDestination = [System.IO.Path]::GetFullPath($DestinationDirectory)
  if ($resolvedStage.StartsWith($resolvedDestination, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedStage)) {
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force
  }
}
