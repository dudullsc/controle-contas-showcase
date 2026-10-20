<#
.SYNOPSIS
  Incrementa a versao do app, sincroniza o Capacitor e gera o APK Android.

.DESCRIPTION
  Usa scripts/bump-version.ps1 para alinhar versionName/versionCode em todos
  os pontos do repo, roda npx cap sync android e monta o APK (release por
  padrao). Copia o artefato para mobile/controle-contas-<versao>.apk.

.EXAMPLE
  .\scripts\build-apk.ps1
  .\scripts\build-apk.ps1 -Bump patch
  .\scripts\build-apk.ps1 -Bump minor
  .\scripts\build-apk.ps1 -Version 1.0.12
  .\scripts\build-apk.ps1 -SkipBump
  .\scripts\build-apk.ps1 -DebugBuild
#>
param(
    [ValidateSet("patch", "minor", "major")]
    [string]$Bump = "patch",

    [ValidateScript({
        $_ -eq "" -or $_ -match '^\d+\.\d+\.\d+(-(alpha|beta|rc)\.\d+)?$'
    })]
    [string]$Version = "",

    [int]$AndroidVersionCode = 0,

    [switch]$SkipBump,
    [switch]$SkipSync,
    [switch]$DebugBuild,
    [switch]$NoCopy
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $root "mobile"
$android = Join-Path $mobile "android"
$gradleApp = Join-Path $android "app\build.gradle"
$pkgJson = Join-Path $mobile "package.json"

function Get-CurrentVersion {
    $pkg = Get-Content -Raw -Path $pkgJson | ConvertFrom-Json
    return [string]$pkg.version
}

function Get-NextSemver {
    param([string]$Current, [string]$Part)
    $numeric = ($Current -split "-")[0]
    $bits = $numeric -split "\."
    if ($bits.Count -ne 3) {
        throw "Versao atual invalida: $Current"
    }
    $major = [int]$bits[0]
    $minor = [int]$bits[1]
    $patch = [int]$bits[2]
    switch ($Part) {
        "major" { return "$($major + 1).0.0" }
        "minor" { return "$major.$($minor + 1).0" }
        "patch" { return "$major.$minor.$($patch + 1)" }
    }
}

function Ensure-AndroidSdk {
    if (-not $env:ANDROID_HOME -or -not (Test-Path $env:ANDROID_HOME)) {
        $defaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
        if (Test-Path $defaultSdk) {
            $env:ANDROID_HOME = $defaultSdk
        }
    }
    if (-not $env:ANDROID_HOME -or -not (Test-Path $env:ANDROID_HOME)) {
        throw "ANDROID_HOME nao definido. Instale o Android SDK ou exporte ANDROID_HOME."
    }
    $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
    Write-Host "ANDROID_HOME=$env:ANDROID_HOME"
}

Write-Host "==> Controle de Contas - build APK"
Write-Host "    Repo: $root"

$current = Get-CurrentVersion
Write-Host "    Versao atual: $current"

if (-not $SkipBump) {
    if (-not $Version) {
        $Version = Get-NextSemver -Current $current -Part $Bump
    }
    Write-Host "==> Bump $current -> $Version ($Bump)"
    $bumpArgs = @{
        Version = $Version
    }
    if ($AndroidVersionCode -gt 0) {
        $bumpArgs.AndroidVersionCode = $AndroidVersionCode
    }
    & (Join-Path $PSScriptRoot "bump-version.ps1") @bumpArgs
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        throw "bump-version.ps1 falhou (exit $LASTEXITCODE)"
    }
}
else {
    if (-not $Version) {
        $Version = $current
    }
    Write-Host "==> SkipBump - mantendo versao $Version"
}

$gradle = Get-Content -Raw -Path $gradleApp
if ($gradle -match 'versionCode\s+(\d+)') {
    $code = $Matches[1]
}
else {
    $code = "?"
}
if ($gradle -match 'versionName\s+"([^"]+)"') {
    $name = $Matches[1]
}
else {
    $name = $Version
}
Write-Host "    Android: versionName=$name versionCode=$code"

Ensure-AndroidSdk

Push-Location $mobile
try {
    if (-not (Test-Path (Join-Path $mobile "node_modules"))) {
        Write-Host "==> npm install"
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install falhou" }
    }

    if (-not $SkipSync) {
        Write-Host "==> npx cap sync android"
        npx cap sync android
        if ($LASTEXITCODE -ne 0) { throw "cap sync falhou" }
    }

    $task = if ($DebugBuild) { "assembleDebug" } else { "assembleRelease" }
    $variant = if ($DebugBuild) { "debug" } else { "release" }
    Write-Host "==> Gradle $task"

    Push-Location $android
    try {
        if (Test-Path ".\gradlew.bat") {
            & .\gradlew.bat $task --quiet
        }
        else {
            throw "gradlew.bat nao encontrado em mobile/android"
        }
        if ($LASTEXITCODE -ne 0) { throw "Gradle $task falhou (exit $LASTEXITCODE)" }
    }
    finally {
        Pop-Location
    }

    $builtApk = Join-Path $android "app\build\outputs\apk\$variant\app-$variant.apk"
    if (-not (Test-Path $builtApk)) {
        throw "APK nao encontrado: $builtApk"
    }

    $destName = "controle-contas-$name.apk"
    $dest = Join-Path $mobile $destName

    if (-not $NoCopy) {
        Copy-Item -Path $builtApk -Destination $dest -Force
        Write-Host ""
        Write-Host "APK pronto:"
        Write-Host "  $dest"
        Write-Host "  (origem: $builtApk)"
    }
    else {
        Write-Host ""
        Write-Host "APK pronto (sem copia):"
        Write-Host "  $builtApk"
    }

    Write-Host ""
    Write-Host "Proximos passos:"
    if (-not $SkipBump) {
        Write-Host "  git add -A"
        Write-Host "  git commit -m `"chore: bump version to $name (build $code)`""
    }
    Write-Host "  Instale o APK no aparelho (desinstale debug antes se for release)."
    Write-Host "  Abra o app logado uma vez para re-registrar o token FCM."
}
finally {
    Pop-Location
}
