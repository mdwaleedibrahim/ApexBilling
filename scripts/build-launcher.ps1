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

Write-Host "[ApexBill] Compiling native Windows launcher: $outputExe" -ForegroundColor Cyan

$cscArgs = @(
    "/target:winexe",
    "/optimize+",
    "/platform:anycpu",
    "/out:$outputExe",
    "/win32icon:$iconPath",
    "/r:System.dll",
    "/r:System.Windows.Forms.dll",
    "/r:System.Drawing.dll",
    "$sourceFile"
)

$process = Start-Process -FilePath $CSC_PATH -ArgumentList $cscArgs -NoNewWindow -Wait -PassThru

if ($process.ExitCode -eq 0 -and (Test-Path $outputExe)) {
    $sizeKb = [Math]::Round(((Get-Item $outputExe).Length / 1KB), 1)
    Write-Host "[SUCCESS] ApexBill.exe built successfully ($sizeKb KB)!" -ForegroundColor Green
} else {
    Write-Error "[FAILED] csc.exe failed with exit code $($process.ExitCode)"
    exit 1
}
