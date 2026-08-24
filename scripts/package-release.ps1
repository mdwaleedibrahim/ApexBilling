# scripts/package-release.ps1 — Build plug-and-play portable Windows release
$ErrorActionPreference = "Stop"

$ROOT_DIR = (Get-Item "$PSScriptRoot\..").FullName
$RELEASE_DIR = Join-Path $ROOT_DIR "release"
Write-Host "`n[ApexBill] Packaging Portable Release...`n" -ForegroundColor Cyan

# 1. Bump version, generate changelog, then build
Set-Location $ROOT_DIR
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
Write-Host "Step 1: Bumping Version & Generating Changelog..." -ForegroundColor Yellow
node ./scripts/bump-version.js

Write-Host "Step 2: Compiling Frontend and Backend..." -ForegroundColor Yellow
npm run build

# Read updated version from package.json after rebuild
$PKG_JSON = Get-Content "$ROOT_DIR\package.json" -Raw | ConvertFrom-Json
$VERSION = $PKG_JSON.version
if (-not $VERSION) { $VERSION = "1.0.0" }
$APP_NAME = "ApexBill-v$VERSION-Portable"
$BUNDLE_DIR = Join-Path $RELEASE_DIR $APP_NAME

# 2. Prepare Release Directory
if (Test-Path $BUNDLE_DIR) {
    try { Remove-Item -Path $BUNDLE_DIR -Recurse -Force -ErrorAction SilentlyContinue } catch {}
}
New-Item -ItemType Directory -Path $BUNDLE_DIR -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $BUNDLE_DIR "runtime") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $BUNDLE_DIR "app") -Force | Out-Null

# 3. Locate Portable node.exe
Write-Host "Step 2: Bundling Standalone Node.js Runtime..." -ForegroundColor Yellow
$nodeExePath = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $nodeExePath) {
    $nodeExePath = "C:\Program Files\nodejs\node.exe"
}

if (Test-Path $nodeExePath) {
    Copy-Item -Path $nodeExePath -Destination (Join-Path $BUNDLE_DIR "runtime\node.exe") -Force
    Write-Host "   Bundled standalone runtime: $nodeExePath" -ForegroundColor Green
} else {
    Write-Error "Could not find node.exe on system!"
}

# 4. Copy Compiled App Files
Write-Host "Step 3: Copying Application Assets..." -ForegroundColor Yellow
Copy-Item -Path (Join-Path $ROOT_DIR "server\dist") -Destination (Join-Path $BUNDLE_DIR "app\dist") -Recurse -Force
Copy-Item -Path (Join-Path $ROOT_DIR "server\public") -Destination (Join-Path $BUNDLE_DIR "app\public") -Recurse -Force
Copy-Item -Path (Join-Path $ROOT_DIR "server\package.json") -Destination (Join-Path $BUNDLE_DIR "app\package.json") -Force

# Create schema.sql copy in dist/db and app/src/db for runtime path resolution
New-Item -ItemType Directory -Path (Join-Path $BUNDLE_DIR "app\dist\db") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $BUNDLE_DIR "app\src\db") -Force | Out-Null
Copy-Item -Path (Join-Path $ROOT_DIR "server\src\db\schema.sql") -Destination (Join-Path $BUNDLE_DIR "app\dist\db\schema.sql") -Force
Copy-Item -Path (Join-Path $ROOT_DIR "server\src\db\schema.sql") -Destination (Join-Path $BUNDLE_DIR "app\src\db\schema.sql") -Force

# Copy production node_modules
Copy-Item -Path (Join-Path $ROOT_DIR "server\node_modules") -Destination (Join-Path $BUNDLE_DIR "app\node_modules") -Recurse -Force

# 5. Create 1-Click Launch Script & VBScript (Silent Background Launcher)
Write-Host "Step 4: Creating One-Click Windows Launchers..." -ForegroundColor Yellow

# Launch-ApexBill.vbs — Silent launcher with duplicate-instance detection
$vbsContent = @'
Set WshShell = CreateObject("WScript.Shell")
strPath = WshShell.CurrentDirectory

' Check if ApexBill server is already listening on port 54321
Dim bRunning
bRunning = False
Set objExec = WshShell.Exec("cmd /c netstat -ano | findstr :54321")
Do While Not objExec.StdOut.AtEndOfStream
    Dim strLine
    strLine = objExec.StdOut.ReadLine()
    If InStr(strLine, "LISTENING") > 0 Then
        bRunning = True
        Exit Do
    End If
Loop

If bRunning Then
    Dim answer
    answer = MsgBox("ApexBill is already running." & vbCrLf & vbCrLf & _
        "Click YES to stop the existing instance and launch fresh." & vbCrLf & _
        "Click NO to switch to the running instance instead.", _
        vbYesNo + vbQuestion + vbDefaultButton2, "ApexBill - Already Running")
    If answer = vbYes Then
        WshShell.Run "cmd /c taskkill /F /IM node.exe", 0, True
        WScript.Sleep 1000
    Else
        On Error Resume Next
        WshShell.Run "msedge.exe --app=http://localhost:54321 --name=ApexBill", 1, False
        If Err.Number <> 0 Then WshShell.Run "http://localhost:54321", 1, False
        WScript.Quit
    End If
End If

WshShell.Run """" & strPath & "\runtime\node.exe"" --experimental-sqlite """ & strPath & "\app\dist\index.js""", 0, False
WScript.Sleep 1500
On Error Resume Next
WshShell.Run "msedge.exe --app=http://localhost:54321 --name=ApexBill", 1, False
If Err.Number <> 0 Then
    WshShell.Run "http://localhost:54321", 1, False
End If
'@
$vbsContent | Set-Content -Path (Join-Path $BUNDLE_DIR "Launch-ApexBill.vbs") -Encoding ASCII

# ApexBill.cmd — Command Batch Launcher
$cmdLines = @(
  '@echo off',
  'title ApexBill Desktop Launcher',
  'cd /d "%~dp0"',
  'echo.',
  'echo  =======================================================',
  'echo         ApexBill - Modern Billing POS System',
  'echo  =======================================================',
  'echo.',
  'echo  [1/2] Starting ApexBill Server...',
  'start "" /B "%~dp0runtime\node.exe" --experimental-sqlite "%~dp0app\dist\index.js"',
  'echo  [2/2] Launching Application Window...',
  'timeout /t 2 /nobreak >nul',
  'start "" msedge.exe --app=http://localhost:54321 || start http://localhost:54321',
  'echo.',
  'echo  ApexBill is running at http://localhost:54321',
  'echo  Do not close this window while using the software.',
  'echo.'
)
$cmdLines | Set-Content -Path (Join-Path $BUNDLE_DIR "ApexBill.cmd") -Encoding UTF8

# ApexBill.bat shortcut alias
Copy-Item -Path (Join-Path $BUNDLE_DIR "ApexBill.cmd") -Destination (Join-Path $BUNDLE_DIR "ApexBill.bat") -Force

# README.txt
$readmeLines = @(
  '========================================================================',
  "             ApexBill - Standalone Portable Release v$VERSION",
  '========================================================================',
  '',
  'Welcome to ApexBill Portable!',
  '',
  'ONE-CLICK LAUNCH INSTRUCTIONS:',
  '1. Double-click "Launch-ApexBill.vbs" (or "ApexBill.bat") to launch the app.',
  '2. ApexBill will automatically start and open in a desktop application window.',
  '',
  'ZERO DEPENDENCIES REQUIRED:',
  '- Includes standalone Node.js runtime and SQLite engine.',
  '- No installation or admin permissions required.',
  '- Invoice data, stock items, and customer records are safely stored in:',
  '  %APPDATA%\ApexBill\billing_app.db',
  '',
  'Support & Repository:',
  'https://github.com/mdwaleedibrahim/ApexBilling',
  '========================================================================'
)
$readmeLines | Set-Content -Path (Join-Path $BUNDLE_DIR "README.txt") -Encoding UTF8

# Copy CHANGELOG.txt if exists
$changelogSrc = Join-Path $ROOT_DIR "CHANGELOG.txt"
if (Test-Path $changelogSrc) {
  Copy-Item -Path $changelogSrc -Destination (Join-Path $BUNDLE_DIR "CHANGELOG.txt") -Force
}

# 6. Compress into Portable ZIP Archive
Write-Host "Step 5: Creating Compressed ZIP Package..." -ForegroundColor Yellow
$zipPath = Join-Path $RELEASE_DIR "$APP_NAME.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Compress-Archive -Path $BUNDLE_DIR -DestinationPath $zipPath -Force
Write-Host "`n[SUCCESS] Portable Release Created!" -ForegroundColor Green
Write-Host "   Portable Folder: $BUNDLE_DIR" -ForegroundColor Cyan
Write-Host "   Standalone ZIP:  $zipPath`n" -ForegroundColor Cyan
