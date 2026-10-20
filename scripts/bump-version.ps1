<#
.SYNOPSIS
  Atualiza a versao do app em todos os arquivos do repositorio.

.EXAMPLE
  .\scripts\bump-version.ps1 -Version 1.0.11
  .\scripts\bump-version.ps1 -Version 1.1.0-beta.1
  .\scripts\bump-version.ps1 -Version 1.1.0-rc.1 -AndroidVersionCode 15
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d+\.\d+\.\d+(-(alpha|beta|rc)\.\d+)?$')]
    [string]$Version,

    [int]$AndroidVersionCode = 0
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$numericVersion = ($Version -split '-')[0]
$isPrerelease = $Version -match '-(alpha|beta|rc)\.\d+$'
$channel = if ($isPrerelease) { $Matches[1] } else { "stable" }
$semverPattern = '\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?'

function Replace-InFile {
    param(
        [string]$Path,
        [string]$Pattern,
        [string]$Replacement
    )
    $full = Join-Path $root $Path
    if (-not (Test-Path $full)) {
        throw "Arquivo nao encontrado: $Path"
    }
    $content = Get-Content -Raw -Path $full
    $updated = [regex]::Replace($content, $Pattern, $Replacement)
    if ($updated -eq $content) {
        Write-Warning "Nenhuma alteracao em $Path (padrao nao encontrado)"
        return
    }
    Set-Content -Path $full -Value $updated -NoNewline
    Write-Host "OK  $Path"
}

$gradlePath = Join-Path $root "mobile\android\app\build.gradle"
$gradle = Get-Content -Raw -Path $gradlePath
if ($AndroidVersionCode -le 0) {
    if ($gradle -match 'versionCode\s+(\d+)') {
        $AndroidVersionCode = [int]$Matches[1] + 1
    } else {
        throw "Nao foi possivel ler versionCode em mobile/android/app/build.gradle"
    }
}

Replace-InFile "app/frontend/package.json" "`"version`":\s*`"$semverPattern`"" "`"version`": `"$Version`""
Replace-InFile "app/frontend/src/lib/appVersion.ts" "\|\|\s*'$semverPattern'" "|| '$Version'"
Replace-InFile "mobile/package.json" "`"version`":\s*`"$semverPattern`"" "`"version`": `"$Version`""
Replace-InFile "app/backend/main.py" "os\.getenv\(`"APP_VERSION`", `"$semverPattern`"\)" "os.getenv(`"APP_VERSION`", `"$Version`")"
Replace-InFile "k8s/apps/controle-contas/back/base/deployment.yaml" "value: `"$semverPattern`"" "value: `"$Version`""
Replace-InFile "mobile/android/app/build.gradle" "versionName `"$semverPattern`"" "versionName `"$Version`""
Replace-InFile "mobile/android/app/build.gradle" "versionCode \d+" "versionCode $AndroidVersionCode"
Replace-InFile "mobile/ios/App/App.xcodeproj/project.pbxproj" "MARKETING_VERSION = [^;]+;" "MARKETING_VERSION = $numericVersion;"
Replace-InFile "mobile/ios/App/App.xcodeproj/project.pbxproj" "CURRENT_PROJECT_VERSION = \d+;" "CURRENT_PROJECT_VERSION = $AndroidVersionCode;"

# Arquivo estatico servido em /version (atualizado tambem no Docker build)
$versionFile = Join-Path $root "app\frontend\public\version"
Set-Content -Path $versionFile -Value $Version -NoNewline
Write-Host "OK  app/frontend/public/version"

function Update-RootPackageLock {
    param([string]$RelativePath, [string]$PackageName)
    $lockPath = Join-Path $root $RelativePath
    if (-not (Test-Path $lockPath)) { return }
    $lock = Get-Content -Raw -Path $lockPath
    # Em PowerShell, ${1}/${2} em string dupla nao sao backrefs do regex — usar evaluator.
    $lockUpdated = [regex]::Replace(
        $lock,
        '("name":\s*"' + [regex]::Escape($PackageName) + '",\s*"version":\s*")' + $semverPattern + '(")',
        { param($m) $m.Groups[1].Value + $Version + $m.Groups[2].Value }
    )
    # Tambem atualiza o bloco packages[""] (mesma versao raiz)
    $lockUpdated = [regex]::Replace(
        $lockUpdated,
        '("packages":\s*\{\s*"":\s*\{\s*"name":\s*"' + [regex]::Escape($PackageName) + '",\s*"version":\s*")' + $semverPattern + '(")',
        { param($m) $m.Groups[1].Value + $Version + $m.Groups[2].Value }
    )
    if ($lockUpdated -eq $lock) {
        Write-Warning "Nenhuma alteracao em $RelativePath (padrao nao encontrado)"
    } else {
        Set-Content -Path $lockPath -Value $lockUpdated -NoNewline
        Write-Host "OK  $RelativePath"
    }
}

Update-RootPackageLock "app/frontend/package-lock.json" "controle-contas-frontend"
Update-RootPackageLock "mobile/package-lock.json" "controle-contas-mobile"

Write-Host ""
Write-Host "Versao atualizada para $Version ($channel, Android/iOS build $AndroidVersionCode)"
if ($isPrerelease) {
    Write-Host "iOS MARKETING_VERSION ficou $numericVersion (a Apple nao aceita sufixo beta/rc)."
}
Write-Host ""
Write-Host "Proximos passos:"
Write-Host "  git add -A"
Write-Host "  git commit -m `"chore: bump version to $Version`""
Write-Host "  git tag -a v$Version -m `"Release v$Version`""
Write-Host "  git push origin main --follow-tags"
Write-Host ""
if ($isPrerelease) {
    Write-Host "O GitHub marca essa Release como pre-release ($channel)."
    Write-Host "Imagens Docker: v$Version e :$channel  (nao atualiza :latest)"
} else {
    Write-Host "O GitHub publica essa Release como stable."
    Write-Host "Imagens Docker: v$Version e :latest"
}
