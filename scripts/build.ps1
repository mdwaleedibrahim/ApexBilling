# build.ps1 — Build ApexBill frontend and backend without requiring global npm/node in PATH
$ErrorActionPreference = "Stop"
$ROOT_DIR = (Get-Item "$PSScriptRoot\..").FullName

# Locate node.exe
$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $node -or -not (Test-Path $node)) {
    if (Test-Path "C:\Program Files\nodejs\node.exe") {
        $node = "C:\Program Files\nodejs\node.exe"
    } else {
        $existing = Get-ChildItem "$ROOT_DIR\release" -Filter "node.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($existing) { $node = $existing.FullName }
    }
}

if (-not $node -or -not (Test-Path $node)) {
    Write-Error "Could not find node.exe. Please install Node.js or run: winget install OpenJS.NodeJS.LTS"
    exit 1
}

Write-Host "`n[ApexBill] Using Node runtime: $node" -ForegroundColor Cyan

# 1. Build Client (React / Vite)
Write-Host "`n[1/2] Building Frontend (Client)..." -ForegroundColor Yellow
Set-Location "$ROOT_DIR\src\client"
& "$node" "$ROOT_DIR\src\client\node_modules\vite\bin\vite.js" build

# 2. Build Server (TypeScript)
Write-Host "`n[2/2] Building Backend (Server)..." -ForegroundColor Yellow
Set-Location "$ROOT_DIR\src\server"
& "$node" "$ROOT_DIR\src\server\node_modules\typescript\bin\tsc"

Set-Location $ROOT_DIR
Write-Host "`n✅ Build completed successfully! Assets ready in src/server/dist and src/server/public.`n" -ForegroundColor Green
