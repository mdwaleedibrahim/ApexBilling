# dev.ps1 — Build frontend & backend, then hot-swap the server (zero downtime)
# Order: Build first → kill old server → start new server (minimises checkout errors during restart)
$ErrorActionPreference = "Stop"
$ROOT_DIR = (Get-Item "$PSScriptRoot\..").FullName

# 1. Locate node.exe
$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $node -or -not (Test-Path $node)) {
    if (Test-Path "C:\Program Files\nodejs\node.exe") {
        $node = "C:\Program Files\nodejs\node.exe"
    } else {
        $existing = Get-ChildItem "$ROOT_DIR\release" -Filter "node.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($existing) { $node = $existing.FullName }
    }
}

if (-not $node) {
    Write-Error "Could not find node.exe. Run: winget install OpenJS.NodeJS.LTS"
    exit 1
}

Write-Host "`n[ApexBill] Using Node runtime: $node" -ForegroundColor Cyan

# 2. Build FIRST (old server stays alive while we build — no downtime during build)
Write-Host "`n[1/2] Building Frontend (Client)..." -ForegroundColor Yellow
Set-Location "$ROOT_DIR\src\client"
& "$node" "$ROOT_DIR\src\client\node_modules\vite\bin\vite.js" build

Write-Host "`n[2/2] Building Backend (Server)..." -ForegroundColor Yellow
Set-Location "$ROOT_DIR\src\server"
& "$node" "$ROOT_DIR\src\server\node_modules\typescript\bin\tsc"

# Ensure schema.sql is copied to dist/db
$schemaSrc = "$ROOT_DIR\src\server\src\db\schema.sql"
$schemaDestDir = "$ROOT_DIR\src\server\dist\db"
if (-not (Test-Path $schemaDestDir)) { New-Item -ItemType Directory -Path $schemaDestDir -Force | Out-Null }
Copy-Item $schemaSrc -Destination "$schemaDestDir\schema.sql" -Force

# Compile native ApexBill.exe launcher if missing or outdated
if (Test-Path "$ROOT_DIR\scripts\build-launcher.ps1") {
    & "$ROOT_DIR\scripts\build-launcher.ps1" -OutputDir "$ROOT_DIR"
}

Write-Host "`n[ApexBill] Build completed! Hot-swapping server..." -ForegroundColor Green

# 3. NOW kill old server (build is done — downtime is only a few milliseconds before new server starts)
$killedAny = $false
try {
    $connections = Get-NetTCPConnection -LocalPort 54321 -ErrorAction SilentlyContinue
    if ($connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($p in $pids) {
            if ($p -and $p -ne $PID -and $p -gt 4) {
                Write-Host "[ApexBill] Closing existing server session (PID: $p)..." -ForegroundColor Yellow
                Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
                $killedAny = $true
            }
        }
    }
} catch {
    # Fallback via netstat
    $netstatOut = netstat -ano | findstr :54321
    if ($netstatOut) {
        $lines = $netstatOut -split "`r?`n"
        foreach ($line in $lines) {
            $parts = $line.Trim() -split "\s+"
            if ($parts.Length -ge 5) {
                $pidToKill = $parts[4]
                if ($pidToKill -as [int] -and [int]$pidToKill -gt 4 -and [int]$pidToKill -ne $PID) {
                    Write-Host "[ApexBill] Closing existing server session (PID: $pidToKill)..." -ForegroundColor Yellow
                    taskkill /F /PID $pidToKill 2>$null | Out-Null
                    $killedAny = $true
                }
            }
        }
    }
}

if ($killedAny) {
    Start-Sleep -Milliseconds 400
    Write-Host "[ApexBill] Hot-swap complete — starting new server..." -ForegroundColor Green
} else {
    Write-Host "[ApexBill] No existing session found on port 54321." -ForegroundColor DarkGray
}

# 4. Start new server immediately
Set-Location "$ROOT_DIR\src\server"
& "$node" --experimental-sqlite dist/index.js
