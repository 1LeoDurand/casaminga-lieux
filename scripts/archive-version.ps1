<#
.SYNOPSIS
    Archive une version du projet Casa Minga Lieux (étape 4 de la règle de versioning).

.DESCRIPTION
    Copie le dossier projet courant vers
    D:\01 Casaminga\01 Dev\archives\casa-minga-lieux-<Version>,
    en excluant node_modules et .next (régénérables) mais en conservant .git
    (historique + tags).

    Rappel : ce script ne couvre QUE la copie. Avant de le lancer, effectue
    manuellement les étapes 1 à 3 de la règle de versioning :
      1. npm run build   (doit passer)
      2. git commit       (arbre propre)
      3. git tag          (ex. v1.2-personnes)

.PARAMETER Version
    Le libellé de version, ex. "v1.2". L'archive sera nommée casa-minga-lieux-v1.2.

.PARAMETER Force
    Écrase l'archive si elle existe déjà.

.EXAMPLE
    .\scripts\archive-version.ps1 -Version v1.2
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$Version,

    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Racine projet = dossier parent du dossier du script
$projectRoot = Split-Path -Parent $PSScriptRoot
$archivesDir = Join-Path (Split-Path -Parent $projectRoot) "archives"
$destination = Join-Path $archivesDir "casa-minga-lieux-$Version"

Write-Host "Source      : $projectRoot"
Write-Host "Destination : $destination"

if (Test-Path $destination) {
    if (-not $Force) {
        Write-Error "L'archive existe déjà : $destination (utilise -Force pour écraser)."
        exit 1
    }
    Write-Host "Archive existante -> ecrasement (-Force)." -ForegroundColor Yellow
}

if (-not (Test-Path $archivesDir)) {
    New-Item -ItemType Directory -Path $archivesDir | Out-Null
}

# /E = sous-dossiers (même vides) ; /XD = exclure ces dossiers
robocopy $projectRoot $destination /E /XD node_modules .next /NFL /NDL /NJH /NP /R:1 /W:1 | Out-Null
$code = $LASTEXITCODE

# robocopy : codes 0-7 = succes, >= 8 = erreur
if ($code -ge 8) {
    Write-Error "Echec de la copie (robocopy code $code)."
    exit 1
}

Write-Host "Archive creee : $destination (robocopy code $code)" -ForegroundColor Green
Write-Host "node_modules et .next exclus ; .git conserve."
exit 0
