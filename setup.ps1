[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = $PSScriptRoot
$envPath = Join-Path $root '.env'
$tokenPath = Join-Path $root 'SETUP_TOKEN.txt'
$stateDirectory = Join-Path $root 'data\setup'
$statePath = Join-Path $stateDirectory 'bootstrap.json'
$installationPath = Join-Path $stateDirectory 'installation.json'
$backupDirectory = Join-Path $root 'backups'
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null

function New-HexSecret([int]$ByteCount = 32) {
  $bytes = New-Object byte[] $ByteCount
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

function Get-SetupValue($Setup, [string]$Name, $Default = '') {
  $property = $Setup.PSObject.Properties[$Name]
  if ($null -eq $property -or $null -eq $property.Value) { return $Default }
  return $property.Value
}

function Read-EnvValues([string]$Path) {
  $values = [ordered]@{}
  foreach ($line in (Get-Content -LiteralPath $Path)) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
    $separator = $line.IndexOf('=')
    if ($separator -lt 1) { continue }
    $key = $line.Substring(0, $separator)
    $value = $line.Substring($separator + 1).Trim()
    if ($value.Length -ge 2 -and $value.StartsWith("'") -and $value.EndsWith("'")) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$key] = $value
  }
  return $values
}

function Set-EnvValue($Values, [string]$Name, $Value) {
  $Values[$Name] = [string]$Value
}

function Set-EnvDefault($Values, [string]$Name, $Value) {
  if (-not $Values.Contains($Name)) { $Values[$Name] = [string]$Value }
}

function Complete-Installation {
  $setup = Get-Content -LiteralPath $installationPath -Raw | ConvertFrom-Json
  if ([string]::IsNullOrWhiteSpace((Get-SetupValue $setup 'dataCenter')) -or [string]::IsNullOrWhiteSpace((Get-SetupValue $setup 'world'))) {
    throw 'Setup is missing the data center or world. Complete setup again before sealing.'
  }
  $values = Read-EnvValues $envPath
  $importedPath = Join-Path $stateDirectory 'restored-env.json'
  if (Test-Path -LiteralPath $importedPath) {
    $imported = Get-Content -LiteralPath $importedPath -Raw | ConvertFrom-Json
    foreach ($property in $imported.PSObject.Properties) { $values[$property.Name] = [string]$property.Value }
  }

  Set-EnvValue $values 'SETUP_MODE' 'false'
  Set-EnvValue $values 'SETUP_COMPLETE' 'true'
  Set-EnvValue $values 'PORTAL_NAME' (Get-SetupValue $setup 'portalName')
  Set-EnvValue $values 'PORTAL_SUBTITLE' (Get-SetupValue $setup 'portalSubtitle')
  Set-EnvValue $values 'PORTAL_URL' (Get-SetupValue $setup 'portalUrl')
  Set-EnvValue $values 'PORTAL_LOGO_URL' (Get-SetupValue $setup 'logoUrl')
  Set-EnvValue $values 'PORTAL_BANNER_URL' (Get-SetupValue $setup 'bannerUrl')
  Set-EnvValue $values 'PORTAL_BACKGROUND_COLOR' (Get-SetupValue $setup 'backgroundColor')
  Set-EnvValue $values 'PORTAL_ACCENT_COLOR' (Get-SetupValue $setup 'accentColor')
  Set-EnvValue $values 'PORTAL_TILE_COLOR' (Get-SetupValue $setup 'tileColor' '#120423')
  Set-EnvValue $values 'PORTAL_OPERATOR_NAME' (Get-SetupValue $setup 'operatorName' (Get-SetupValue $setup 'portalName'))
  Set-EnvValue $values 'PORTAL_PRIVACY_CONTACT' (Get-SetupValue $setup 'privacyContact')
  Set-EnvValue $values 'PORTAL_OPERATOR_REGION' (Get-SetupValue $setup 'operatorRegion')
  Set-EnvValue $values 'PORTAL_FORMER_MEMBER_RETENTION_DAYS' (Get-SetupValue $setup 'formerMemberRetentionDays' 30)
  Set-EnvValue $values 'PORTAL_ACTIVITY_RETENTION_DAYS' (Get-SetupValue $setup 'activityRetentionDays' 365)
  Set-EnvValue $values 'PORTAL_BACKUP_RETENTION_DAYS' (Get-SetupValue $setup 'backupRetentionDays' 90)
  Set-EnvValue $values 'PORTAL_PRIVACY_ADDITIONAL_NOTICE' (Get-SetupValue $setup 'privacyAdditionalNotice')
  $accessMode = Get-SetupValue $setup 'accessMode' 'local'
  Set-EnvValue $values 'ACCESS_MODE' $accessMode
  Set-EnvValue $values 'COMPOSE_PROFILES' ($(if ($accessMode -eq 'cloudflare') { 'cloudflare' } else { '' }))
  Set-EnvValue $values 'TAILSCALE_HOSTNAME' (Get-SetupValue $setup 'tailscaleHostname')
  Set-EnvValue $values 'TAILSCALE_TAILNET' (Get-SetupValue $setup 'tailscaleTailnet')
  Set-EnvValue $values 'TAILSCALE_AUTHKEY' (Get-SetupValue $setup 'tailscaleAuthKey')
  Set-EnvValue $values 'CLOUDFLARE_HOSTNAME' (Get-SetupValue $setup 'cloudflareHostname')
  Set-EnvValue $values 'CLOUDFLARE_TUNNEL_TOKEN' (Get-SetupValue $setup 'cloudflareTunnelToken')
  Set-EnvValue $values 'DISCORD_COMMAND_NAME' (Get-SetupValue $setup 'commandName')
  Set-EnvValue $values 'AUTH_URL' (Get-SetupValue $setup 'portalUrl')
  Set-EnvValue $values 'AUTH_DISCORD_ID' (Get-SetupValue $setup 'applicationId')
  Set-EnvValue $values 'AUTH_DISCORD_SECRET' (Get-SetupValue $setup 'oauthSecret')
  Set-EnvValue $values 'PORTAL_ADMIN_DISCORD_IDS' (Get-SetupValue $setup 'adminDiscordId')
  Set-EnvValue $values 'PORTAL_PRIMARY_ADMIN_DISCORD_ID' (Get-SetupValue $setup 'adminDiscordId')
  Set-EnvValue $values 'FC_LODESTONE_URL' (Get-SetupValue $setup 'lodestoneUrl')
  Set-EnvValue $values 'DEFAULT_DATACENTER' (Get-SetupValue $setup 'dataCenter')
  Set-EnvValue $values 'DEFAULT_WORLD' (Get-SetupValue $setup 'world')
  Set-EnvDefault $values 'SYNC_INTERVAL_MINUTES' '60'
  Set-EnvDefault $values 'MAX_FC_PAGES' '10'
  Set-EnvDefault $values 'MAX_MOUNT_SYNC_CHARACTERS' '100'
  Set-EnvDefault $values 'MOUNT_SYNC_REQUEST_DELAY_MS' '1000'
  Set-EnvDefault $values 'MAX_PORTRAIT_SYNC_CHARACTERS' '100'
  Set-EnvDefault $values 'PORTRAIT_SYNC_REQUEST_DELAY_MS' '1000'
  Set-EnvValue $values 'DISCORD_BOT_TOKEN' (Get-SetupValue $setup 'botToken')
  Set-EnvValue $values 'DISCORD_APPLICATION_ID' (Get-SetupValue $setup 'applicationId')
  Set-EnvValue $values 'DISCORD_GUILD_ID' (Get-SetupValue $setup 'guildId')
  Set-EnvValue $values 'DISCORD_VERIFIED_ROLE_ID' (Get-SetupValue $setup 'verifiedRoleId')
  Set-EnvValue $values 'DISCORD_UNVERIFIED_ROLE_ID' (Get-SetupValue $setup 'unverifiedRoleId')
  $temporaryGuestsEnabled = Get-SetupValue $setup 'temporaryGuestsEnabled' $false
  Set-EnvValue $values 'DISCORD_TEMP_GUEST_ENABLED' ($(if ($temporaryGuestsEnabled -eq $true) { 'true' } else { 'false' }))
  Set-EnvValue $values 'DISCORD_TEMP_ACCESS_ROLE_ID' (Get-SetupValue $setup 'tempAccessRoleId')
  Set-EnvValue $values 'DISCORD_TEMP_GUEST_HOURS' (Get-SetupValue $setup 'tempGuestHours' 6)
  Set-EnvValue $values 'DISCORD_WELCOME_CHANNEL_ID' (Get-SetupValue $setup 'welcomeChannelId')
  Set-EnvValue $values 'DISCORD_FREE_COMPANY_CHAT_CHANNEL_ID' (Get-SetupValue $setup 'freeCompanyChatChannelId')
  $welcomeEngagementEnabled = Get-SetupValue $setup 'welcomeEngagementEnabled' $false
  Set-EnvValue $values 'DISCORD_WELCOME_ENGAGEMENT_ENABLED' ($(if ($welcomeEngagementEnabled -eq $true) { 'true' } else { 'false' }))
  Set-EnvValue $values 'DISCORD_OFFICER_LOG_CHANNEL_ID' (Get-SetupValue $setup 'officerLogChannelId')
  Set-EnvValue $values 'DISCORD_EVENT_CHANNEL_ID' (Get-SetupValue $setup 'eventChannelId')
  Set-EnvValue $values 'DISCORD_RAID_CHANNEL_ID' (Get-SetupValue $setup 'raidChannelId')
  Set-EnvValue $values 'DISCORD_MOUNT_FARM_CHANNEL_ID' (Get-SetupValue $setup 'mountFarmChannelId')
  Set-EnvValue $values 'DISCORD_MOUNT_WIN_CHANNEL_ID' (Get-SetupValue $setup 'mountWinChannelId')
  Set-EnvValue $values 'DISCORD_TEST_CHANNEL_ID' (Get-SetupValue $setup 'testChannelId')
  Set-EnvValue $values 'DISCORD_WELCOME_WAVE_STICKER_IDS' (Get-SetupValue $setup 'welcomeWaveStickerIds' $(if ($values.Contains('DISCORD_WELCOME_WAVE_STICKER_IDS')) { $values['DISCORD_WELCOME_WAVE_STICKER_IDS'] } else { '' }))
  Set-EnvDefault $values 'DISCORD_MOUNT_WEBHOOK_URL' ''
  Set-EnvDefault $values 'RUN_STARTUP_MEMBER_SYNC' 'false'
  Set-EnvDefault $values 'ANIME_SCHEDULE_TOKEN' ''
  Set-EnvDefault $values 'ANIME_OFFICIAL_FEED_URLS' ''
  Set-EnvValue $values 'ANIME_TIMEZONE' (Get-SetupValue $setup 'timeZone' 'America/Chicago')
  Set-EnvDefault $values 'ANIME_DAILY_SYNC_TIME' '04:15'
  Set-EnvDefault $values 'ANIME_GOOGLE_ENABLED' 'false'
  Set-EnvDefault $values 'ANIME_GOOGLE_DRY_RUN' 'true'
  Set-EnvDefault $values 'ANIME_GOOGLE_LANGUAGES' 'sub,dub'
  Set-EnvDefault $values 'ANIME_GOOGLE_SUB_CALENDAR_ID' ''
  Set-EnvDefault $values 'ANIME_GOOGLE_DUB_CALENDAR_ID' ''
  Set-EnvDefault $values 'ANIME_GOOGLE_CREDENTIALS_FILE' '/run/anime-secrets/google-service-account.json'
  Set-EnvDefault $values 'ANIME_DISCORD_ENABLED' 'false'
  Set-EnvDefault $values 'ANIME_DISCORD_LANGUAGES' 'sub,dub'
  Set-EnvDefault $values 'ANIME_DISCORD_HORIZON_DAYS' '3'
  $tailscaleConfigDirectory = Join-Path $root 'data\tailscale\config'
  New-Item -ItemType Directory -Path $tailscaleConfigDirectory -Force | Out-Null
  $tailscaleConfigPath = Join-Path $tailscaleConfigDirectory 'serve.json'
  if ($accessMode -eq 'tailscale') {
    $certificateDomain = "$(Get-SetupValue $setup 'tailscaleHostname').$(Get-SetupValue $setup 'tailscaleTailnet')"
    $serveConfig = [ordered]@{
      TCP = [ordered]@{ '443' = [ordered]@{ HTTPS = $true } }
      Web = [ordered]@{ "${certificateDomain}:443" = [ordered]@{ Handlers = [ordered]@{ '/' = [ordered]@{ Proxy = 'http://portal:3000' } } } }
      AllowFunnel = [ordered]@{ "${certificateDomain}:443" = $true }
    }
    [System.IO.File]::WriteAllText($tailscaleConfigPath, ($serveConfig | ConvertTo-Json -Depth 8), [System.Text.UTF8Encoding]::new($false))
  } else {
    Remove-Item -LiteralPath $tailscaleConfigPath -Force -ErrorAction SilentlyContinue
  }
  $values.Remove('SETUP_TOKEN')

  $temporaryEnvPath = "$envPath.tmp"
  $lines = $values.GetEnumerator() | ForEach-Object {
    $safeValue = ([string]$_.Value).Replace("'", '').Replace("`r", '').Replace("`n", '')
    "$($_.Key)='$safeValue'"
  }
  [System.IO.File]::WriteAllLines($temporaryEnvPath, $lines, [System.Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temporaryEnvPath -Destination $envPath -Force
  [System.IO.File]::WriteAllText((Join-Path $stateDirectory 'setup-sealed.json'), '{"sealed":true}', [System.Text.UTF8Encoding]::new($false))
  Remove-Item -LiteralPath $importedPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $stateDirectory 'restore-upload.tar.gz') -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $installationPath -Force
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $tokenPath -Force -ErrorAction SilentlyContinue
}

function Save-Bootstrap {
  New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $root 'data\branding') -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $root 'data\anime') -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $root 'data\tailscale\config') -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $root 'data\tailscale\state') -Force | Out-Null
  $token = New-HexSecret
  $values = [ordered]@{
    PORTAL_PORT = '9030'; PORTAL_NAME = 'Free Company Portal'
    PORTAL_SUBTITLE = 'Free Company Portal'; PORTAL_URL = 'http://localhost:9030/'
    PORTAL_LOGO_URL = '/branding/default-logo.svg'; PORTAL_BANNER_URL = '/branding/default-banner.svg'
    PORTAL_BACKGROUND_COLOR = '#05000c'; PORTAL_ACCENT_COLOR = '#9333ea'; PORTAL_TILE_COLOR = '#120423'
    PORTAL_OPERATOR_NAME = 'Free Company Portal'; PORTAL_PRIVACY_CONTACT = ''; PORTAL_OPERATOR_REGION = ''
    PORTAL_FORMER_MEMBER_RETENTION_DAYS = '30'; PORTAL_ACTIVITY_RETENTION_DAYS = '365'; PORTAL_BACKUP_RETENTION_DAYS = '90'; PORTAL_PRIVACY_ADDITIONAL_NOTICE = ''
    POSTGRES_DB = 'fc_portal'; POSTGRES_USER = 'fc_portal'; POSTGRES_PASSWORD = (New-HexSecret)
    DOCKER_NETWORK_SUBNET = '172.30.60.0/24'
    DOCKER_DNS_PRIMARY = '8.8.8.8'; DOCKER_DNS_SECONDARY = '8.8.4.4'
    AUTH_SECRET = (New-HexSecret); PRIVACY_SUPPRESSION_SECRET = (New-HexSecret); ANIME_SERVICE_API_TOKEN = (New-HexSecret)
    AUTH_URL = 'http://localhost:9030/'; AUTH_TRUST_HOST = 'true'; AUTH_PROVIDER = 'discord'
    AUTH_DISCORD_ID = ''; AUTH_DISCORD_SECRET = ''; AUTH_AUTHENTIK_ID = ''
    AUTH_AUTHENTIK_SECRET = ''; AUTH_AUTHENTIK_ISSUER = ''; PORTAL_ADMIN_DISCORD_IDS = ''; PORTAL_PRIMARY_ADMIN_DISCORD_ID = ''
    DISCORD_WELCOME_WAVE_STICKER_IDS = '816087792291282944,754108890559283200,749054660769218631,781291131828699156,819128604311027752,751606379340365864,816086581509095424,781323769960202280,819130301702995968,772972089963577354,783787404518883338,831570715471380550,831571726223540294'
    SETUP_MODE = 'true'; SETUP_COMPLETE = 'false'; SETUP_TOKEN = $token
  }
  $lines = $values.GetEnumerator() | ForEach-Object { "$($_.Key)='$($_.Value)'" }
  [System.IO.File]::WriteAllLines($envPath, $lines, [System.Text.UTF8Encoding]::new($false))
  $state = [ordered]@{ complete = $false; token = $token; port = '9030'; setupUrl = 'http://localhost:9030/setup' }
  [System.IO.File]::WriteAllText($statePath, ($state | ConvertTo-Json), [System.Text.UTF8Encoding]::new($false))
  [System.IO.File]::WriteAllText($tokenPath, $token, [System.Text.UTF8Encoding]::new($false))
  return [pscustomobject]$state
}

if (Test-Path -LiteralPath $installationPath) {
  Complete-Installation
  Write-Host 'Configuration sealed. On the Docker host, start or rebuild the complete portal with:' -ForegroundColor Green
  Write-Host '  docker compose up -d --build'
  exit 0
}

if (Test-Path -LiteralPath $envPath) {
  $current = Get-Content -LiteralPath $envPath -Raw
  if ($current -match "(?m)^SETUP_COMPLETE='?true'?$") {
    Write-Host 'Setup is complete. Start or update the portal with:' -ForegroundColor Green
    Write-Host '  docker compose up -d --build'
    exit 0
  }
  if (-not (Test-Path -LiteralPath $statePath)) { throw 'An unfinished .env exists without setup state. Move it aside before starting a new installation.' }
  $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  if (-not (Test-Path -LiteralPath $tokenPath)) { [System.IO.File]::WriteAllText($tokenPath, [string]$state.token, [System.Text.UTF8Encoding]::new($false)) }
} else {
  $state = Save-Bootstrap
  Write-Host 'Private passwords and the one-time setup code were generated.' -ForegroundColor Green
}

Write-Host ''
Write-Host 'On the Docker host, start the setup portal:' -ForegroundColor Cyan
Write-Host '  docker compose up -d --build db portal'
Write-Host ''
Write-Host 'Then open the setup page:'
Write-Host '  http://localhost:9030/setup'
Write-Host 'If Docker is on another computer, replace localhost with that computer''s address.'
Write-Host "Enter the token saved in: $tokenPath"
Write-Host ''
Write-Host 'After the browser says the configuration was saved, run this setup file once more to seal it.'
Write-Host 'On Windows, the folder may be local or a mapped network share; Docker is not required for sealing.'
