[CmdletBinding(PositionalBinding=$false)]
param(
  [Parameter(Mandatory=$true)][string]$Nom,
  [Parameter(Mandatory=$true)][string]$Executable,
  [string]$Dossier = 'C:\Dev\spartiate-codex',
  [Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments
)
$ErrorActionPreference = 'Continue'
$racineAudit = 'C:\Dev\spartiate-codex\docs\audit-0.26.0\preuves'
$runtimeAudit = Join-Path $racineAudit '.runtime'
foreach ($sousDossier in @('temp','npm-cache','cargo-home','cargo-target','outils')) {
  New-Item -ItemType Directory -Force (Join-Path $runtimeAudit $sousDossier) | Out-Null
}
New-Item -ItemType Directory -Force (Join-Path $racineAudit 'resultats') | Out-Null
$env:TEMP = Join-Path $runtimeAudit 'temp'
$env:TMP = $env:TEMP
$env:npm_config_cache = Join-Path $runtimeAudit 'npm-cache'
$env:CARGO_HOME = Join-Path $runtimeAudit 'cargo-home'
$env:CARGO_TARGET_DIR = Join-Path $runtimeAudit 'cargo-target'
$env:CARGO_BUILD_JOBS = '1'
$env:CT_TEST_WORKERS = '1'
$fichier = Join-Path $racineAudit "resultats/$Nom.json"
$journal = Join-Path $racineAudit "resultats/$Nom.log"
$resultat = [ordered]@{ nom=$Nom; executable=$Executable; arguments=$Arguments; dossier=$Dossier; debut=[DateTime]::UtcNow.ToString('o'); fin=$null; code=$null; etat='en cours' }
$resultat | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 $fichier
if (-not (Test-Path -LiteralPath $Dossier -PathType Container)) { throw "Dossier de travail absent : $Dossier" }
Push-Location $Dossier -ErrorAction Stop
try {
  & $Executable @Arguments > $journal 2>&1
  $resultat.code = $LASTEXITCODE
  $resultat.etat = if ($LASTEXITCODE -eq 0) { 'réussi' } else { 'échec' }
} catch {
  $resultat.code = -1
  $resultat.etat = 'erreur de lancement'
  $_.Exception.Message | Add-Content -Encoding utf8 $journal
} finally {
  Pop-Location
  $resultat.fin = [DateTime]::UtcNow.ToString('o')
  if (Test-Path -LiteralPath $journal) { (Get-Content -Raw -LiteralPath $journal) | Set-Content -Encoding utf8 $journal }
  $resultat | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 $fichier
}
$resultat | ConvertTo-Json -Compress -Depth 5
exit $resultat.code
