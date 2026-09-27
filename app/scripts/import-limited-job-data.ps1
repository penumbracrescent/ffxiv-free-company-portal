$ErrorActionPreference = "Stop"

$sources = @{
  blueMage = "https://ffxiv.consolegameswiki.com/wiki/Blue_Magic_Spellbook"
  blueMageJob = "https://ffxiv.consolegameswiki.com/wiki/Blue_Mage"
  blueMageLog = "https://ffxiv.consolegameswiki.com/wiki/Blue_Mage_Log"
  maskedCarnivale = "https://ffxiv.consolegameswiki.com/wiki/Masked_Carnivale"
  beastmaster = "https://ffxiv.consolegameswiki.com/wiki/Master%27s_Bestiary"
  beastmasterJob = "https://ffxiv.consolegameswiki.com/wiki/Beastmaster"
  crucibleGuide = "https://www.icy-veins.com/ffxiv/beastmaster-crucible-of-the-unbroken"
}
$headers = @{ "User-Agent" = "COTF-Portal-GuideBuilder/1.0" }

function ConvertFrom-GuideCell([string]$value) {
  $value = $value -replace '(?is)<br\s*/?>', ' / '
  $value = $value -replace '(?is)</p>|</li>', ' / '
  $value = [regex]::Replace($value, '<[^>]+>', ' ')
  $value = [System.Net.WebUtility]::HtmlDecode($value)
  return (($value -replace '\s+', ' ').Trim(' ', '/'))
}

function Get-FirstGuideTable([string]$url) {
  $html = (Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing).Content
  $table = [regex]::Match($html, '(?is)<table\b.*?</table>').Value
  if (-not $table) { throw "No guide table found at $url" }
  return [regex]::Matches($table, '(?is)<tr\b.*?</tr>')
}

function Get-GuideTables([string]$url) {
  $html = (Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing).Content
  return [regex]::Matches($html, '(?is)<table\b.*?</table>')
}

function Get-GuideRowCells($row) {
  return @([regex]::Matches($row.Value, '(?is)<t[hd]\b[^>]*>(.*?)</t[hd]>') | ForEach-Object {
    ConvertFrom-GuideCell $_.Groups[1].Value
  })
}

function Get-TableRows($table) {
  return [regex]::Matches($table.Value, '(?is)<tr\b.*?</tr>')
}

function ConvertFrom-WikiValue([string]$value) {
  if (-not $value) { return "" }
  $previous = ""
  while ($previous -ne $value) {
    $previous = $value
    $value = [regex]::Replace($value, '\{\{[^{}|]+\|([^{}]+)\}\}', '$1')
  }
  $value = [regex]::Replace($value, '\[\[[^\]|]+\|([^\]]+)\]\]', '$1')
  $value = [regex]::Replace($value, '\[\[([^\]]+)\]\]', '$1')
  $value = $value -replace "'''?", ''
  return (($value -replace '\s+', ' ').Trim())
}

function Get-WikiQuest([string]$title, [int]$level, [string]$giver, [string]$unlocks, [string]$rewards) {
  $page = [Uri]::EscapeDataString(($title -replace ' ', '_'))
  $url = "https://ffxiv.consolegameswiki.com/mediawiki/api.php?action=parse&page=$page&prop=wikitext&format=json"
  $response = Invoke-RestMethod -Uri $url -Headers $headers
  $text = [string]$response.parse.wikitext.'*'
  $field = {
    param([string]$name)
    $match = [regex]::Match($text, "(?m)^\|[ \t]*$([regex]::Escape($name))[ \t]*=[ \t]*(.*)$")
    if ($match.Success) { return ConvertFrom-WikiValue $match.Groups[1].Value }
    return ""
  }
  return [ordered]@{
    title = $title
    level = $level
    giver = $giver
    location = & $field 'location'
    x = & $field 'location-x'
    y = & $field 'location-y'
    requirements = & $field 'requirements'
    prerequisite = & $field 'prev-quest'
    unlocks = $unlocks
    rewards = $rewards
  }
}

$blueRows = Get-FirstGuideTable $sources.blueMage
$blueSpells = for ($index = 1; $index -lt $blueRows.Count; $index++) {
  $cells = @([regex]::Matches($blueRows[$index].Value, '(?is)<t[hd]\b[^>]*>(.*?)</t[hd]>') | ForEach-Object {
    ConvertFrom-GuideCell $_.Groups[1].Value
  })
  if ($cells.Count -lt 8) { continue }
  [ordered]@{
    number = [int]$cells[1]
    name = $cells[0]
    rank = $cells[2]
    sourceType = $cells[3]
    minimumLevel = [int]$cells[4]
    worldLevel = $cells[5]
    dutyLevel = $cells[6]
    acquisition = $cells[7]
  }
}

$beastRows = Get-FirstGuideTable $sources.beastmaster
$familiars = for ($index = 1; $index -lt $beastRows.Count; $index++) {
  $cells = @([regex]::Matches($beastRows[$index].Value, '(?is)<t[hd]\b[^>]*>(.*?)</t[hd]>') | ForEach-Object {
    ConvertFrom-GuideCell $_.Groups[1].Value
  })
  if ($cells.Count -lt 6) { continue }
  [ordered]@{
    number = [int]$cells[0]
    name = $cells[1]
    tamedFrom = $cells[2]
    location = $cells[3]
    minimumLevel = [int]$cells[4]
    gourd = $cells[5]
  }
}

$beastTables = Get-GuideTables $sources.beastmaster
$actionRows = [regex]::Matches($beastTables[1].Value, '(?is)<tr\b.*?</tr>')
$familiarActions = for ($index = 1; $index -lt $actionRows.Count; $index += 3) {
  $identity = Get-GuideRowCells $actionRows[$index]
  $trick = Get-GuideRowCells $actionRows[$index + 1]
  $borrow = Get-GuideRowCells $actionRows[$index + 2]
  if ($identity.Count -lt 7 -or $trick.Count -lt 3 -or $borrow.Count -lt 2) { continue }
  [ordered]@{
    number = [int]$identity[0]
    name = $identity[1]
    kin = $identity[2]
    autoAttack = $identity[3]
    temperedRelease = $identity[5]
    temperedTarget = $identity[6]
    trick = $trick[1]
    trickTarget = $trick[2]
    borrow = ($borrow[1] -replace '^Borrow\s*→\s*', '')
  }
}

$blueJobTables = Get-GuideTables $sources.blueMageJob
$blueActionRows = Get-TableRows $blueJobTables[1]
$blueActions = for ($index = 1; $index -lt $blueActionRows.Count; $index++) {
  $cells = Get-GuideRowCells $blueActionRows[$index]
  if ($cells.Count -lt 10) { continue }
  [ordered]@{ name=$cells[0]; number=[int]$cells[2]; level=[int]$cells[3]; type=$cells[4]; mp=$cells[5]; cast=$cells[6]; recast=$cells[7]; rangeRadius=$cells[8]; description=$cells[9] }
}
$blueRoleRows = Get-TableRows $blueJobTables[2]
$blueRoleActions = for ($index = 1; $index -lt $blueRoleRows.Count; $index++) {
  $cells = Get-GuideRowCells $blueRoleRows[$index]
  if ($cells.Count -lt 9) { continue }
  [ordered]@{ name=$cells[0]; acquired=$cells[1]; level=$cells[2]; type=$cells[3]; mp=$cells[4]; cast=$cells[5]; recast=$cells[6]; rangeRadius=$cells[7]; description=$cells[8] }
}
$blueTraitRows = Get-TableRows $blueJobTables[3]
$blueTraits = for ($index = 1; $index -lt $blueTraitRows.Count; $index++) {
  $cells = Get-GuideRowCells $blueTraitRows[$index]
  if ($cells.Count -lt 5) { continue }
  [ordered]@{ name=$cells[0]; acquired=$cells[1]; level=$cells[3]; effect=$cells[4] }
}
$blueTotemRows = Get-TableRows $blueJobTables[4]
$blueTotems = for ($index = 1; $index -lt $blueTotemRows.Count; $index++) {
  $cells = Get-GuideRowCells $blueTotemRows[$index]
  if ($cells.Count -lt 4) { continue }
  [ordered]@{ totem=$cells[0]; spell=$cells[1]; achievement=$cells[2]; requirements=$cells[3] }
}
$blueAchievementRows = Get-TableRows $blueJobTables[5]
$blueAchievements = for ($index = 1; $index -lt $blueAchievementRows.Count; $index++) {
  $cells = Get-GuideRowCells $blueAchievementRows[$index]
  if ($cells.Count -lt 5) { continue }
  [ordered]@{ name=$cells[0]; points=$cells[1]; task=$cells[2]; reward=$cells[3]; patch=$cells[4] }
}

$blueQuestRows = Get-TableRows $blueJobTables[0]
$blueQuests = for ($index = 1; $index -lt $blueQuestRows.Count; $index++) {
  $cells = Get-GuideRowCells $blueQuestRows[$index]
  if ($cells.Count -lt 6) { continue }
  Get-WikiQuest $cells[0] ([int]$cells[2]) $cells[3] $cells[4] $cells[5]
}

$beastJobTables = Get-GuideTables $sources.beastmasterJob
$beastQuests = @()
foreach ($tableIndex in @(0,1)) {
  $rows = Get-TableRows $beastJobTables[$tableIndex]
  for ($index = 1; $index -lt $rows.Count; $index++) {
    $cells = Get-GuideRowCells $rows[$index]
    if ($cells.Count -lt 6) { continue }
    $beastQuests += Get-WikiQuest $cells[0] ([int]$cells[2]) $cells[3] $cells[4] $cells[5]
  }
}
$beastActionRows = Get-TableRows $beastJobTables[2]
$beastActions = for ($index = 1; $index -lt $beastActionRows.Count; $index++) {
  $cells = Get-GuideRowCells $beastActionRows[$index]
  if ($cells.Count -lt 8) { continue }
  [ordered]@{ name=$cells[0]; acquired=$cells[1]; level=$cells[2]; type=$cells[3]; cast=$cells[4]; recast=$cells[5]; rangeRadius=$cells[6]; description=$cells[7] }
}
$beastInstinctRows = Get-TableRows $beastJobTables[3]
$beastInstinctActions = for ($index = 1; $index -lt $beastInstinctRows.Count; $index++) {
  $cells = Get-GuideRowCells $beastInstinctRows[$index]
  if ($cells.Count -lt 7) { continue }
  [ordered]@{ name=$cells[0]; requires=$cells[1]; type=$cells[2]; cast=$cells[3]; recast=$cells[4]; rangeRadius=$cells[5]; description=$cells[6] }
}
$beastDutyRows = Get-TableRows $beastJobTables[4]
$beastDutyActions = for ($index = 1; $index -lt $beastDutyRows.Count; $index++) {
  $cells = Get-GuideRowCells $beastDutyRows[$index]
  if ($cells.Count -lt 8) { continue }
  [ordered]@{ name=$cells[0]; acquired=$cells[1]; level=$cells[2]; type=$cells[3]; cast=$cells[4]; recast=$cells[5]; rangeRadius=$cells[6]; description=$cells[7] }
}
$beastTraitRows = Get-TableRows $beastJobTables[6]
$beastTraits = for ($index = 1; $index -lt $beastTraitRows.Count; $index++) {
  $cells = Get-GuideRowCells $beastTraitRows[$index]
  if ($cells.Count -lt 5) { continue }
  [ordered]@{ name=$cells[0]; acquired=$cells[1]; level=$cells[3]; effect=$cells[4] }
}
$instinctComboRows = Get-TableRows $beastJobTables[7]
$instinctCombos = for ($index = 1; $index -lt $instinctComboRows.Count; $index++) {
  $cells = Get-GuideRowCells $instinctComboRows[$index]
  if ($cells.Count -lt 4) { continue }
  [ordered]@{ name=$cells[0]; sequence=$cells[1]; grants=$cells[2]; multiplier=$cells[3] }
}
$beastAchievementRows = Get-TableRows $beastJobTables[9]
$beastAchievements = for ($index = 1; $index -lt $beastAchievementRows.Count; $index++) {
  $cells = Get-GuideRowCells $beastAchievementRows[$index]
  if ($cells.Count -lt 5) { continue }
  [ordered]@{ name=$cells[0]; points=$cells[1]; task=$cells[2]; reward=$cells[3]; patch=$cells[4] }
}

$logTables = Get-GuideTables $sources.blueMageLog
$blueLogDuties = @()
foreach ($tableIndex in @(1,2,3)) {
  $section = ""
  $rows = Get-TableRows $logTables[$tableIndex]
  for ($index = 1; $index -lt $rows.Count; $index++) {
    $cells = Get-GuideRowCells $rows[$index]
    if ($cells.Count -eq 1) { $section = $cells[0]; continue }
    if ($cells.Count -lt 3) { continue }
    $blueLogDuties += [ordered]@{ category=$section; duty=$cells[0]; level=$cells[1]; itemLevel=$cells[2]; itemLevelSync=if($cells.Count -gt 3){$cells[3]}else{"—"} }
  }
}

$carnivaleTables = Get-GuideTables $sources.maskedCarnivale
$carnivaleRows = Get-TableRows $carnivaleTables[0]
$carnivaleStages = for ($index = 1; $index -lt $carnivaleRows.Count; $index++) {
  $cells = Get-GuideRowCells $carnivaleRows[$index]
  if ($cells.Count -lt 11) { continue }
  [ordered]@{ number=[int]$cells[0]; name=$cells[1]; level=$cells[2]; standardTime=$cells[3]; idealTime=$cells[4]; act1=$cells[5]; act2=$cells[6]; act3=$cells[7]; gil=$cells[8]; seals=$cells[9]; tomestones=$cells[10] }
}

$crucibleHtml = (Invoke-WebRequest -Uri $sources.crucibleGuide -Headers $headers -UseBasicParsing).Content
$crucibleSections = [regex]::Matches($crucibleHtml, '(?is)<h3\b[^>]*>(.*?)</h3>(.*?)(?=<h3\b|$)')
$crucibleBoard = ""
$crucibleEncounters = @()
foreach ($section in $crucibleSections) {
  $heading = ConvertFrom-GuideCell $section.Groups[1].Value
  if ($heading -in @('First Board of the Unbroken','Second Board of the Unbroken','Third Board of the Unbroken',"First Master's Board","Second Master's Board")) {
    $crucibleBoard = $heading
    continue
  }
  if ($heading -notmatch '^(Enemy|Elite Enemy|Random Enemy|Boss):?\s*#?\d*:?') { continue }
  $abilities = @([regex]::Matches($section.Groups[2].Value, '(?is)<li\b[^>]*>(.*?)</li>') | ForEach-Object {
    $line = ConvertFrom-GuideCell $_.Groups[1].Value
    if ($line -match ':') { return (($line -split ':', 2)[0]).Trim() }
  } | Where-Object { $_ } | Select-Object -Unique)
  $crucibleEncounters += [ordered]@{ board=$crucibleBoard; encounter=$heading; abilities=$abilities }
}

if ($blueSpells.Count -ne 124) { throw "Expected 124 Blue Magic spells, found $($blueSpells.Count)" }
if ($familiars.Count -ne 50) { throw "Expected 50 Beastmaster familiars, found $($familiars.Count)" }
if ($familiarActions.Count -ne 50) { throw "Expected 50 familiar action sets, found $($familiarActions.Count)" }
if ($blueActions.Count -ne 124) { throw "Expected 124 Blue Mage action descriptions, found $($blueActions.Count)" }
if ($blueQuests.Count -ne 26) { throw "Expected 26 Blue Mage quests, found $($blueQuests.Count)" }
if ($beastQuests.Count -ne 13) { throw "Expected 13 Beastmaster quests, found $($beastQuests.Count)" }
if ($carnivaleStages.Count -ne 32) { throw "Expected 32 Carnivale stages, found $($carnivaleStages.Count)" }
if ($blueLogDuties.Count -lt 120) { throw "Expected at least 120 Blue Mage Log duties, found $($blueLogDuties.Count)" }
if ($crucibleEncounters.Count -ne 44) { throw "Expected 44 Crucible encounters, found $($crucibleEncounters.Count)" }

$result = [ordered]@{
  verifiedPatch = "7.56"
  verifiedOn = "2026-09-19"
  sources = $sources
  blueMageSpells = @($blueSpells)
  beastmasterFamiliars = @($familiars)
  beastmasterActions = @($familiarActions)
  blueMageActions = @($blueActions)
  blueMageRoleActions = @($blueRoleActions)
  blueMageTraits = @($blueTraits)
  blueMageTotems = @($blueTotems)
  blueMageAchievements = @($blueAchievements)
  blueMageQuests = @($blueQuests)
  blueMageLogDuties = @($blueLogDuties)
  maskedCarnivaleStages = @($carnivaleStages)
  beastmasterQuests = @($beastQuests)
  beastmasterJobActions = @($beastActions)
  beastmasterInstinctActions = @($beastInstinctActions)
  beastmasterDutyActions = @($beastDutyActions)
  beastmasterTraits = @($beastTraits)
  beastmasterInstinctCombos = @($instinctCombos)
  beastmasterAchievements = @($beastAchievements)
  crucibleEncounters = @($crucibleEncounters)
}

$outputPath = Join-Path $PSScriptRoot "..\lib\limited-job-data.json"
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $outputPath -Encoding utf8
Write-Host "Wrote complete limited-job data: $($blueSpells.Count) spells, $($familiars.Count) familiars, $($blueQuests.Count + $beastQuests.Count) quests, $($blueLogDuties.Count) log duties, and $($carnivaleStages.Count) Carnivale stages"
