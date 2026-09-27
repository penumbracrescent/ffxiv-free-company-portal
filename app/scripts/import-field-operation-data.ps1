$ErrorActionPreference = "Stop"
$headers = @{ "User-Agent" = "COTF-Portal-GuideBuilder/1.0" }
$sources = [ordered]@{
  logosActions = "https://ffxiv.consolegameswiki.com/wiki/Logos_Action"
  logograms = "https://ffxiv.consolegameswiki.com/wiki/Logograms"
  lostActions = "https://ffxiv.consolegameswiki.com/wiki/Lost_Actions"
  forgottenFragments = "https://ffxiv.consolegameswiki.com/wiki/Forgotten_Fragments"
}
function ConvertFrom-GuideCell([string]$value) {
  $value = $value -replace '(?is)<br\s*/?>', ' / '
  $value = $value -replace '(?is)</p>|</li>', ' / '
  $value = [regex]::Replace($value, '<[^>]+>', ' ')
  $value = [System.Net.WebUtility]::HtmlDecode($value)
  return (($value -replace '\s+', ' ').Trim(' ', '/'))
}
function Get-GuideTables([string]$url) {
  $html = (Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing).Content
  return [regex]::Matches($html, '(?is)<table\b.*?</table>')
}
function Get-TableRows($table) { return [regex]::Matches($table.Value, '(?is)<tr\b.*?</tr>') }
function Get-RowCells($row) {
  return @([regex]::Matches($row.Value, '(?is)<t[hd]\b[^>]*>(.*?)</t[hd]>') | ForEach-Object { ConvertFrom-GuideCell $_.Groups[1].Value })
}

$logosTables = @(Get-GuideTables $sources.logosActions)
$logosRows = @(Get-TableRows $logosTables[0])
$logosActions = for ($index = 1; $index -lt $logosRows.Count; $index++) {
  $cells = Get-RowCells $logosRows[$index]
  if ($cells.Count -lt 10) { continue }
  [ordered]@{ name=$cells[0]; index=$cells[1]; acquired=$cells[2]; level=$cells[3]; type=$cells[4]; cast=$cells[5]; recast=$cells[6]; rangeRadius=$cells[7]; uses=$cells[8]; description=$cells[9] }
}

$logogramTables = @(Get-GuideTables $sources.logograms)
$logogramRows = @(Get-TableRows $logogramTables[0])
$logograms = for ($index = 1; $index -lt $logogramRows.Count; $index++) {
  $cells = Get-RowCells $logogramRows[$index]
  if ($cells.Count -lt 3) { continue }
  [ordered]@{ name=$cells[0]; acquisition=$cells[1]; mnemes=$cells[2] }
}

$lostCategories = @("Offensive", "Defensive", "Restorative", "Beneficial", "Detrimental", "Tactical", "Item-related")
$lostTables = @(Get-GuideTables $sources.lostActions)
$lostActions = @()
for ($tableIndex = 0; $tableIndex -lt $lostCategories.Count; $tableIndex++) {
  $tableRows = @(Get-TableRows $lostTables[$tableIndex])
  for ($index = 1; $index -lt $tableRows.Count; $index++) {
    $cells = Get-RowCells $tableRows[$index]
    if ($cells.Count -lt 12) { continue }
    $lostActions += [ordered]@{ category=$lostCategories[$tableIndex]; name=$cells[0]; index=$cells[1]; acquired=$cells[2]; level=$cells[3]; type=$cells[4]; mp=$cells[5]; cast=$cells[6]; recast=$cells[7]; rangeRadius=$cells[8]; uses=$cells[9]; weight=$cells[10]; description=$cells[11] }
  }
}

$fragmentTables = @(Get-GuideTables $sources.forgottenFragments)
$forgottenFragments = @()
foreach ($tableIndex in @(0,1)) {
  $tableRows = @(Get-TableRows $fragmentTables[$tableIndex])
  for ($index = 1; $index -lt $tableRows.Count; $index++) {
    $cells = Get-RowCells $tableRows[$index]
    if ($cells.Count -lt 3) { continue }
    $forgottenFragments += [ordered]@{ rankBand=if($tableIndex -eq 0){"Ranks 1–15"}else{"Ranks 16–25"}; name=$cells[0]; acquisition=$cells[1]; actions=$cells[2] }
  }
}

if ($logosActions.Count -ne 56) { throw "Expected 56 Logos Actions, found $($logosActions.Count)" }
if ($logograms.Count -ne 9) { throw "Expected 9 Logogram families, found $($logograms.Count)" }
if ($lostActions.Count -ne 99) { throw "Expected 99 Lost Actions, found $($lostActions.Count)" }
if ($forgottenFragments.Count -ne 36) { throw "Expected 36 Forgotten Fragment sources, found $($forgottenFragments.Count)" }

$result = [ordered]@{
  verifiedPatch = "7.56"
  verifiedOn = "2026-09-19"
  sources = $sources
  logosActions = @($logosActions)
  logograms = @($logograms)
  lostActions = @($lostActions)
  forgottenFragments = @($forgottenFragments)
}
$outputPath = Join-Path $PSScriptRoot "..\lib\field-operation-data.json"
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $outputPath -Encoding utf8
Write-Host "Wrote field-operation data: $($logosActions.Count) Logos Actions, $($logograms.Count) Logograms, $($lostActions.Count) Lost Actions, and $($forgottenFragments.Count) Forgotten Fragments."
