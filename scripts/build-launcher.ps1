# scripts/build-launcher.ps1 — Compile standalone ApexBill.exe launcher
param(
    [string]$OutputDir = (Get-Item "$PSScriptRoot\..").FullName
)

$ErrorActionPreference = "Stop"
$ROOT_DIR = (Get-Item "$PSScriptRoot\..").FullName
$CSC_PATH = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if (-not (Test-Path $CSC_PATH)) {
    $CSC_PATH = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}
if (-not (Test-Path $CSC_PATH)) {
    Write-Error "[ApexBill] Could not find csc.exe C# compiler."
    exit 1
}

# 1. Generate icon if missing
$iconPath = Join-Path $PSScriptRoot "ApexBill.ico"
if (-not (Test-Path $iconPath)) {
    Write-Host "[ApexBill] Generating application icon..." -ForegroundColor Yellow
    & "$PSScriptRoot\generate-icon.ps1" -OutputPath $iconPath
}

# 2. Prepare output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$outputExe = Join-Path $OutputDir "ApexBill.exe"
$sourceFile = Join-Path $PSScriptRoot "launcher\ApexBillLauncher.cs"
$manifestPath = Join-Path $PSScriptRoot "launcher\app.manifest"

# Dynamic Version & Assembly Info
$pkgJsonPath = Join-Path $ROOT_DIR "package.json"
$appVersion = "2.20.0"
if (Test-Path $pkgJsonPath) {
    try {
        $pkg = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
        if ($pkg.version) { $appVersion = $pkg.version }
    } catch {}
}
$assemblyVersion = "$appVersion.0"

$versionCs = Join-Path $env:TEMP "ApexBillLauncherVersion_$([Guid]::NewGuid().ToString('N')).cs"
$versionCsContent = @"
using System.Reflection;
[assembly: AssemblyTitle("ApexBill")]
[assembly: AssemblyDescription("ApexBill - Modern Desktop Billing & POS System")]
[assembly: AssemblyCompany("ApexBill")]
[assembly: AssemblyProduct("ApexBill")]
[assembly: AssemblyCopyright("Copyright © 2026 ApexBill")]
[assembly: AssemblyVersion("$assemblyVersion")]
[assembly: AssemblyFileVersion("$assemblyVersion")]
"@
Set-Content -Path $versionCs -Value $versionCsContent -Encoding UTF8

Write-Host "[ApexBill] Compiling native Windows launcher (v$appVersion): $outputExe" -ForegroundColor Cyan

$cscArgs = @(
    "/target:winexe",
    "/optimize+",
    "/platform:anycpu",
    "/out:$outputExe",
    "/win32icon:$iconPath",
    "/win32manifest:$manifestPath",
    "/r:System.dll",
    "/r:System.Windows.Forms.dll",
    "/r:System.Drawing.dll",
    "$sourceFile",
    "$versionCs"
)

try {
    $process = Start-Process -FilePath $CSC_PATH -ArgumentList $cscArgs -NoNewWindow -Wait -PassThru

    if ($process.ExitCode -eq 0 -and (Test-Path $outputExe)) {
        $sizeKb = [Math]::Round(((Get-Item $outputExe).Length / 1KB), 1)
        Write-Host "[SUCCESS] ApexBill.exe built successfully ($sizeKb KB)!" -ForegroundColor Green
        
        # Authenticode sign the launcher
        if (Test-Path "$PSScriptRoot\sign-binary.ps1") {
            & "$PSScriptRoot\sign-binary.ps1" -FilePath $outputExe
        }
    } else {
        Write-Error "[FAILED] csc.exe failed with exit code $($process.ExitCode)"
        exit 1
    }
} finally {
    Remove-Item $versionCs -Force -ErrorAction SilentlyContinue
}
