param([string]$Architectures = 'arm64-v8a,armeabi-v7a,x86_64', [switch]$SkipTests)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if (-not $env:JAVA_HOME) {
  $ocJdk = 'C:\Program Files\Android\Android Studio\jbr'
  if (Test-Path -LiteralPath (Join-Path $ocJdk 'bin\java.exe')) { $env:JAVA_HOME = $ocJdk }
}
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$env:EXPO_NO_TELEMETRY = '1'
$env:CI = '1'
$env:NODE_ENV = 'production'
if (-not (Test-Path -LiteralPath 'node_modules')) {
  & npm.cmd ci --include=dev --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Installazione dipendenze fallita' }
}
& npm.cmd run logo:generate
if ($LASTEXITCODE -ne 0) { throw 'Generazione logo fallita' }
& npm.cmd run licenses
if ($LASTEXITCODE -ne 0) { throw 'Generazione avvisi licenza fallita' }
& npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck fallito' }
if (-not $SkipTests) {
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw 'Test TypeScript falliti' }
}
& npx.cmd expo prebuild --platform android --no-install
if ($LASTEXITCODE -ne 0) { throw 'Prebuild fallita' }
$ocTasks = @(':app:assembleRelease')
if (-not $SkipTests) { $ocTasks += ':offline-link:testReleaseUnitTest' }
& .\android\gradlew.bat -p android @ocTasks "-PreactNativeArchitectures=$Architectures" --console=plain
if ($LASTEXITCODE -ne 0) { throw 'Build Android fallita' }
New-Item -ItemType Directory -Force 'artifacts' | Out-Null
$ocName = if ($env:OC_KEYSTORE) { 'open-codenames-release.apk' } else { 'open-codenames-preview.apk' }
Copy-Item -LiteralPath 'android\app\build\outputs\apk\release\app-release.apk' -Destination (Join-Path 'artifacts' $ocName)
Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path 'artifacts' $ocName)
Write-Output "APK autonomo: artifacts\$ocName"
