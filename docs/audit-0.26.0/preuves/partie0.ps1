# Contrôles finis, exécutés successivement, sans boucle de surveillance ni relance.
# Ce script ne modifie aucun fichier suivi de l'application.
$auditRoot = 'C:\Dev\spartiate-codex'
$runner = Join-Path $auditRoot 'docs/audit-0.26.0/preuves/executer.ps1'
function Controle([string]$nom, [string]$exe, [string[]]$arguments, [string]$dossier = $auditRoot) {
  & $runner -Nom $nom -Executable $exe -Dossier $dossier -Arguments $arguments
}
Controle 'lint' 'npm.cmd' @('run','lint','--','--ignore-pattern','docs/audit-0.26.0/**')
Controle 'npm-audit-prod' 'npm.cmd' @('audit','--omit=dev','--json')
Controle 'npm-audit-complet' 'npm.cmd' @('audit','--json')
Controle 'validate-content' 'npm.cmd' @('run','validate:content')
Controle 'reachability' 'node.exe' @('scripts/cleanup/reachability.mjs','--json','docs/audit-0.26.0/preuves/reachability.json')
Controle 'symbols' 'node.exe' @('scripts/cleanup/symbols.mjs','--json','docs/audit-0.26.0/preuves/symbols.json')
Controle 'i18n-keys' 'node.exe' @('scripts/cleanup/i18nKeys.mjs','--json','docs/audit-0.26.0/preuves/i18n-keys.json')
Controle 'gardes-docs' 'npx.cmd' @('vitest','run','--coverage.enabled=false','--maxWorkers=1','--project','node','scripts/release/identity.test.ts','scripts/release/agents.test.ts','scripts/release/docs-paths.test.ts','scripts/release/prd-split.test.ts','scripts/release/rename.test.ts')
Controle 'unitaires' 'npm.cmd' @('run','test','--','--maxWorkers=1','--coverage.reportsDirectory=docs/audit-0.26.0/preuves/.runtime/coverage','--reporter=default','--reporter=json','--outputFile.json=docs/audit-0.26.0/preuves/.runtime/unitaires.json')
Controle 'bundle' 'npm.cmd' @('run','test:bundle')

# Tauri peut générer des permissions/schémas sous src-tauri : copie exacte du tag
# pour garder même les fichiers générés hors des répertoires applicatifs originaux.
$sourceAudit = Join-Path $auditRoot 'docs/audit-0.26.0/preuves/.runtime/source'
New-Item -ItemType Directory -Force $sourceAudit | Out-Null
& git archive v0.26.0 -o (Join-Path $auditRoot 'docs/audit-0.26.0/preuves/.runtime/source.tar')
if ($LASTEXITCODE -ne 0) { throw 'Échec de la copie du tag pour les contrôles natifs' }
& tar -xf (Join-Path $auditRoot 'docs/audit-0.26.0/preuves/.runtime/source.tar') -C $sourceAudit
if ($LASTEXITCODE -ne 0) { throw 'Échec extraction du tag' }
$nativeAudit = Join-Path $sourceAudit 'src-tauri'
Controle 'cargo-fmt' 'cargo.exe' @('fmt','--check') $nativeAudit
Controle 'cargo-clippy' 'cargo.exe' @('clippy','--locked','--','-D','warnings') $nativeAudit
Controle 'cargo-desktop' 'cargo.exe' @('test','--locked','--features','test-hooks','--test','desktop') $nativeAudit
Controle 'cargo-sql' 'cargo.exe' @('test','--locked','-p','tauri-plugin-sql','--features','sqlite') $nativeAudit
$outilsAudit = Join-Path $auditRoot 'docs/audit-0.26.0/preuves/.runtime/outils'
Controle 'cargo-audit-install' 'cargo.exe' @('install','cargo-audit','--locked','--root',$outilsAudit) $nativeAudit
$auditExe = Join-Path $outilsAudit 'bin/cargo-audit.exe'
if (Test-Path -LiteralPath $auditExe) {
  Controle 'cargo-audit' $auditExe @('audit','--json') $nativeAudit
}
Write-Output 'FIN DES CONTRÔLES : examiner chaque résultat, pas seulement le dernier code de sortie.'
