[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$BackupPath,
  [string]$ProjectPath = $PSScriptRoot,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$project = [System.IO.Path]::GetFullPath($ProjectPath)
$backup = [System.IO.Path]::GetFullPath($BackupPath)
$envPath = Join-Path $project '.env'
$composePath = Join-Path $project 'compose.yaml'
$setupDirectory = Join-Path $project 'data\setup'
$backupDirectory = Join-Path $project 'backups'
$stage = Join-Path $setupDirectory ".restore-$([guid]::NewGuid().ToString('N'))"
if (-not (Test-Path -LiteralPath $backup -PathType Leaf)) { throw "Backup archive not found: $backup" }
if (-not (Test-Path -LiteralPath $composePath)) { throw "compose.yaml not found in $project." }
if ((Test-Path -LiteralPath $envPath) -and -not $Force) { throw 'This project already has a .env file. Restore into a fresh release folder, or use -Force deliberately.' }
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null

function Read-EnvValues([string]$Path) {
  $values = [ordered]@{}
  foreach ($line in (Get-Content -LiteralPath $Path)) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
    $separator = $line.IndexOf('=')
    if ($separator -lt 1) { continue }
    $key = $line.Substring(0, $separator)
    $value = $line.Substring($separator + 1).Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith("'") -and $value.EndsWith("'")) -or ($value.StartsWith('"') -and $value.EndsWith('"')))) { $value = $value.Substring(1, $value.Length - 2) }
    $values[$key] = $value
  }
  return $values
}
function New-HexSecret([int]$ByteCount = 32) {
  $bytes = New-Object byte[] $ByteCount
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

New-Item -ItemType Directory -Path $stage -Force | Out-Null
try {
  & tar -xzf $backup -C $stage
  if ($LASTEXITCODE -ne 0) { throw 'The backup archive could not be extracted.' }
  $manifestPath = Join-Path $stage 'manifest.json'
  $sourceEnvPath = Join-Path $stage 'installation.env'
  $sourceComposePath = Join-Path $stage 'installation-compose.yaml'
  $dumpPath = Join-Path $stage 'portal.dump'
  foreach ($required in @($manifestPath, $sourceEnvPath, $dumpPath)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "The backup is incomplete: $required is missing." }
  }
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($manifest.format -ne 'cotf-portal-backup' -or [int]$manifest.version -ne 1) { throw 'This is not a supported COTF Portal backup.' }
  if ((Get-Item -LiteralPath $dumpPath).Length -lt 512) { throw 'The database dump is empty or invalid.' }
  $values = Read-EnvValues $sourceEnvPath
  foreach ($requiredKey in @('POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD')) {
    if (-not $values.Contains($requiredKey) -or [string]::IsNullOrWhiteSpace([string]$values[$requiredKey])) { throw "The backup environment is missing $requiredKey." }
  }
  $token = New-HexSecret
  $values['SETUP_MODE'] = 'true'
  $values['SETUP_COMPLETE'] = 'false'
  $values['SETUP_TOKEN'] = $token

  $dataSource = Join-Path $stage 'data'
  $dataTarget = Join-Path $project 'data'
  New-Item -ItemType Directory -Path $dataTarget -Force | Out-Null
  if (Test-Path -LiteralPath $dataSource) {
    foreach ($entry in (Get-ChildItem -LiteralPath $dataSource -Force)) {
      if ($entry.Name -ne 'setup') { Copy-Item -LiteralPath $entry.FullName -Destination $dataTarget -Recurse -Force }
    }
  }
  $lines = $values.GetEnumerator() | ForEach-Object {
    $safe = ([string]$_.Value).Replace("'", '').Replace("`r", '').Replace("`n", '')
    "$($_.Key)='$safe'"
  }
  [System.IO.File]::WriteAllLines($envPath, $lines, [System.Text.UTF8Encoding]::new($false))
  New-Item -ItemType Directory -Path $setupDirectory -Force | Out-Null
  if (Test-Path -LiteralPath $sourceComposePath -PathType Leaf) {
    Copy-Item -LiteralPath $sourceComposePath -Destination (Join-Path $setupDirectory 'restored-compose.yaml') -Force
  }
  $port = if ($values.Contains('PORTAL_PORT')) { [string]$values['PORTAL_PORT'] } else { '9030' }
  $state = [ordered]@{ complete = $false; restored = $true; backupCreatedAt = [string]$manifest.createdAt; token = $token; port = $port; setupUrl = "http://localhost:$port/setup" }
  [System.IO.File]::WriteAllText((Join-Path $setupDirectory 'bootstrap.json'), ($state | ConvertTo-Json), [System.Text.UTF8Encoding]::new($false))
  [System.IO.File]::WriteAllText((Join-Path $project 'SETUP_TOKEN.txt'), $token, [System.Text.UTF8Encoding]::new($false))

  & docker compose --project-directory $project -f $composePath up -d db
  if ($LASTEXITCODE -ne 0) { throw 'The fresh PostgreSQL service could not be started.' }
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & docker compose --project-directory $project -f $composePath exec -T db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 2
  }
  if (-not $ready) { throw 'PostgreSQL did not become ready for the restore.' }
  & docker compose --project-directory $project -f $composePath cp $dumpPath db:/tmp/cotf-portal-restore.dump
  if ($LASTEXITCODE -ne 0) { throw 'The database dump could not be copied into PostgreSQL.' }
  & docker compose --project-directory $project -f $composePath exec -T db sh -c 'pg_restore --clean --if-exists --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/cotf-portal-restore.dump'
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL rejected the backup. The portal was not started.' }
  & docker compose --project-directory $project -f $composePath exec -T db rm -f /tmp/cotf-portal-restore.dump | Out-Null
  [System.IO.File]::WriteAllText((Join-Path $setupDirectory 'restore-applied.json'), ($state | ConvertTo-Json), [System.Text.UTF8Encoding]::new($false))
  & docker compose --project-directory $project -f $composePath up -d --build portal
  if ($LASTEXITCODE -ne 0) { throw 'The database was restored, but the setup portal could not be started.' }
  Write-Host 'Backup restored into the fresh database. Open setup to review the imported configuration.' -ForegroundColor Green
  Write-Host "Setup page: http://localhost:$port/setup"
  Write-Host "One-time token: $token"
  Write-Warning 'Keep the original backup until member joins, galleries, settings, channels, and wave stickers are verified.'
} finally {
  $resolvedStage = [System.IO.Path]::GetFullPath($stage)
  $resolvedSetup = [System.IO.Path]::GetFullPath($setupDirectory)
  if ($resolvedStage.StartsWith($resolvedSetup, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedStage)) { Remove-Item -LiteralPath $resolvedStage -Recurse -Force }
}
