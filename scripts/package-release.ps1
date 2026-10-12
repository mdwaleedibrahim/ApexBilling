# scripts/package-release.ps1 — Build plug-and-play portable Windows release
$ErrorActionPreference = "Stop"

$ROOT_DIR = (Get-Item "$PSScriptRoot\..").FullName
$RELEASE_DIR = Join-Path $ROOT_DIR "release"
Write-Host "`n[ApexBill] Packaging Portable Release...`n" -ForegroundColor Cyan

# 1. Locate Node.js Runtime
$nodeExePath = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $nodeExePath -or -not (Test-Path $nodeExePath)) {
    if (Test-Path "C:\Program Files\nodejs\node.exe") {
        $nodeExePath = "C:\Program Files\nodejs\node.exe"
    } else {
        $existingNode = Get-ChildItem "$RELEASE_DIR" -Filter "node.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($existingNode) { $nodeExePath = $existingNode.FullName }
    }
}
if ($nodeExePath) {
    $nodeDir = Split-Path $nodeExePath
    $env:PATH = "$nodeDir;$env:PATH"
}

# 2. Bump version, generate changelog, then build
Set-Location $ROOT_DIR
Write-Host "Step 1: Bumping Version & Generating Changelog..." -ForegroundColor Yellow
if ($nodeExePath) {
    & "$nodeExePath" ./scripts/bump-version.js
} else {
    node ./scripts/bump-version.js
}

Write-Host "Step 2: Compiling Frontend and Backend..." -ForegroundColor Yellow
if (Get-Command npm -ErrorAction SilentlyContinue) {
    npm run build
} else {
    Set-Location (Join-Path $ROOT_DIR "src\client")
    & "$nodeExePath" (Join-Path $ROOT_DIR "src\client\node_modules\vite\bin\vite.js") build
    Set-Location (Join-Path $ROOT_DIR "src\server")
    & "$nodeExePath" (Join-Path $ROOT_DIR "src\server\node_modules\typescript\bin\tsc")
    Set-Location $ROOT_DIR
}

# Read updated version from package.json after rebuild
$PKG_JSON = Get-Content "$ROOT_DIR\package.json" -Raw | ConvertFrom-Json
$VERSION = $PKG_JSON.version
if (-not $VERSION) { $VERSION = "1.0.0" }
$APP_NAME = "ApexBill-v$VERSION-Portable"
$BUNDLE_DIR = Join-Path $RELEASE_DIR $APP_NAME

# 3. Prepare Release Directory
if (Test-Path $BUNDLE_DIR) {
    try { Remove-Item -Path $BUNDLE_DIR -Recurse -Force -ErrorAction SilentlyContinue } catch {}
}
New-Item -ItemType Directory -Path $BUNDLE_DIR -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $BUNDLE_DIR "app") -Force | Out-Null

# 4. Decoupled Node.js Runtime (Not bundled in release)
Write-Host 'Step 3: Decoupled release: Node.js runtime is not bundled (will be detected or downloaded on first run)...' -ForegroundColor Green

# 4. Copy Compiled App Files
Write-Host "Step 3: Copying Application Assets..." -ForegroundColor Yellow
Copy-Item -Path (Join-Path $ROOT_DIR "src\server\dist") -Destination (Join-Path $BUNDLE_DIR "app\dist") -Recurse -Force
Copy-Item -Path (Join-Path $ROOT_DIR "src\server\public") -Destination (Join-Path $BUNDLE_DIR "app\public") -Recurse -Force
Copy-Item -Path (Join-Path $ROOT_DIR "src\server\package.json") -Destination (Join-Path $BUNDLE_DIR "app\package.json") -Force

# Create schema.sql copy in dist/db and app/src/db for runtime path resolution
New-Item -ItemType Directory -Path (Join-Path $BUNDLE_DIR "app\dist\db") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $BUNDLE_DIR "app\src\db") -Force | Out-Null
Copy-Item -Path (Join-Path $ROOT_DIR "src\server\src\db\schema.sql") -Destination (Join-Path $BUNDLE_DIR "app\dist\db\schema.sql") -Force
Copy-Item -Path (Join-Path $ROOT_DIR "src\server\src\db\schema.sql") -Destination (Join-Path $BUNDLE_DIR "app\src\db\schema.sql") -Force

# Copy production node_modules
Copy-Item -Path (Join-Path $ROOT_DIR "src\server\node_modules") -Destination (Join-Path $BUNDLE_DIR "app\node_modules") -Recurse -Force

# 5. Create One-Click Windows Launchers (Native .exe, .vbs, .bat)
Write-Host "Step 4: Building Native Windows .exe Launcher and Scripts..." -ForegroundColor Yellow

$iconPath = Join-Path $ROOT_DIR "scripts\ApexBill.ico"
if (-not (Test-Path $iconPath)) {
    Write-Host "   Generating ApexBill icon..." -ForegroundColor Yellow
    & "$ROOT_DIR\scripts\generate-icon.ps1" -OutputPath $iconPath
}

# Compile native ApexBill.exe launcher into bundle
& "$ROOT_DIR\scripts\build-launcher.ps1" -OutputDir $BUNDLE_DIR

# Also copy ApexBill.ico into bundle and repo root
Copy-Item -Path $iconPath -Destination (Join-Path $BUNDLE_DIR "ApexBill.ico") -Force
Copy-Item -Path (Join-Path $BUNDLE_DIR "ApexBill.exe") -Destination (Join-Path $ROOT_DIR "ApexBill.exe") -Force

# Launch-ApexBill.vbs — Silent launcher with direct Node.js execution and Smart App Control resilience
$vbsContent = @'
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
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

' Start Node.js backend if not already active
If Not bRunning Then
    Dim nodeExe
    nodeExe = "node.exe"
    If fso.FileExists("C:\Program Files\nodejs\node.exe") Then
        nodeExe = "C:\Program Files\nodejs\node.exe"
    ElseIf fso.FileExists(WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%\ApexBill\runtime\node.exe")) Then
        nodeExe = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%\ApexBill\runtime\node.exe")
    End If

    ' Run server silently
    WshShell.Run """" & nodeExe & """ """ & strPath & "\app\dist\index.js""", 0, False
    WScript.Sleep 1500
End If

' Open Edge in application window mode
On Error Resume Next
WshShell.Run "msedge.exe --app=http://localhost:54321 --name=ApexBill", 1, False
If Err.Number <> 0 Then
    WshShell.Run "http://localhost:54321", 1, False
End If
'@
$vbsContent | Set-Content -Path (Join-Path $BUNDLE_DIR "Launch-ApexBill.vbs") -Encoding ASCII

# ApexBill.cmd — Command Batch Launcher with Smart App Control resilience
$cmdLines = @(
  '@echo off',
  'title ApexBill Desktop',
  'cd /d "%~dp0"',
  'echo.',
  'echo  =======================================================',
  'echo         ApexBill - Modern Billing POS System',
  'echo  =======================================================',
  'echo.',
  'netstat -ano | findstr :54321 | findstr LISTENING >nul 2>&1',
  'if %ERRORLEVEL% equ 0 goto open_browser',
  '',
  'set "NODE_CMD=node.exe"',
  'where node >nul 2>&1',
  'if %ERRORLEVEL% neq 0 (',
  '    if exist "C:\Program Files\nodejs\node.exe" (',
  '        set "NODE_CMD=C:\Program Files\nodejs\node.exe"',
  '    ) else if exist "%LOCALAPPDATA%\ApexBill\runtime\node.exe" (',
  '        set "NODE_CMD=%LOCALAPPDATA%\ApexBill\runtime\node.exe"',
  '    )',
  ')',
  '',
  'echo  Starting ApexBill Server...',
  'start "" /b "%NODE_CMD%" "%~dp0app\dist\index.js"',
  'timeout /t 2 /nobreak >nul',
  '',
  ':open_browser',
  'echo  Launching ApexBill Application Window...',
  'start "" msedge.exe --app=http://localhost:54321 --name=ApexBill 2>nul',
  'if %ERRORLEVEL% neq 0 start http://localhost:54321'
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
  '1. Double-click "ApexBill.exe" to launch the desktop application.',
  '   (Alternative launchers: "Launch-ApexBill.vbs" or "ApexBill.bat")',
  '2. ApexBill will automatically start and open in a standalone desktop window.',
  '',
  'DECOUPLED LIGHTWEIGHT RUNTIME:',
  '- Node.js runtime is decoupled from this release package.',
  '- Automatically uses existing Node.js on computer if installed.',
  '- If Node.js is not installed, downloads and installs it in the background on first run.',
  '- Remembers the installation path so subsequent launches start instantly.',
  '- Invoice data, stock items, and customer records are safely stored in:',
  '  %APPDATA%\ApexBill\billing_app.db',
  '',
  'CLI FLAGS:',
  '  ApexBill.exe          Launch application (or focus existing window)',
  '  ApexBill.exe --restart Restart background server',
  '  ApexBill.exe --stop   Stop background server',
  '  ApexBill.exe --status Check if server is running',
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

# Copy Certificate & Trust-Certificate scripts into bundle prior to ZIP compression
$certExportPath = Join-Path $RELEASE_DIR "ApexBill-CodeSigning.cer"
if (Test-Path "$ROOT_DIR\scripts\sign-binary.ps1") {
    & "$ROOT_DIR\scripts\sign-binary.ps1" -FilePath (Join-Path $BUNDLE_DIR "ApexBill.exe") -ExportCertPath $certExportPath
}
if (Test-Path $certExportPath) {
    Copy-Item -Path $certExportPath -Destination (Join-Path $BUNDLE_DIR "ApexBill-CodeSigning.cer") -Force
}
$trustBatPath = Join-Path $ROOT_DIR "scripts\Trust-Certificate.bat"
if (Test-Path $trustBatPath) {
    Copy-Item -Path $trustBatPath -Destination (Join-Path $BUNDLE_DIR "Trust-Certificate.bat") -Force
    Copy-Item -Path $trustBatPath -Destination (Join-Path $RELEASE_DIR "Trust-Certificate.bat") -Force
}

# 6. Compress into Portable ZIP Archive
Write-Host "Step 5: Creating Compressed ZIP Package..." -ForegroundColor Yellow
$zipPath = Join-Path $RELEASE_DIR "$APP_NAME.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($BUNDLE_DIR, $zipPath)
$zipSizeMb = [Math]::Round(((Get-Item $zipPath).Length / 1MB), 1)
Write-Host "   Created ZIP: $zipPath ($zipSizeMb MB)" -ForegroundColor Green

# 7. Build Standalone Single-File .exe Installer
Write-Host "Step 6: Packaging Standalone Single-File .exe..." -ForegroundColor Yellow
$CSC_PATH = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $CSC_PATH)) {
    $CSC_PATH = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

$standaloneSrc = Join-Path $ROOT_DIR "scripts\launcher\ApexBillStandalone.cs"
$manifestPath = Join-Path $ROOT_DIR "scripts\launcher\app.manifest"
$standaloneExe = Join-Path $RELEASE_DIR "ApexBill-v$VERSION-Standalone.exe"
$standaloneAlias = Join-Path $RELEASE_DIR "ApexBill-Standalone.exe"

$versionTxt = Join-Path $env:TEMP "ApexBillVersion_$([Guid]::NewGuid().ToString('N')).txt"
Set-Content -Path $versionTxt -Value $VERSION -Encoding ASCII

# Dynamic Version & Assembly Info for Standalone
$assemblyVersion = "$VERSION.0"
$versionCs = Join-Path $env:TEMP "ApexBillStandaloneVersion_$([Guid]::NewGuid().ToString('N')).cs"
$versionCsContent = @"
using System.Reflection;
[assembly: AssemblyTitle("ApexBill Standalone")]
[assembly: AssemblyDescription("ApexBill - Modern Desktop Billing & POS System")]
[assembly: AssemblyCompany("ApexBill")]
[assembly: AssemblyProduct("ApexBill Standalone")]
[assembly: AssemblyCopyright("Copyright © 2026 ApexBill")]
[assembly: AssemblyVersion("$assemblyVersion")]
[assembly: AssemblyFileVersion("$assemblyVersion")]
"@
Set-Content -Path $versionCs -Value $versionCsContent -Encoding UTF8

if ((Test-Path $CSC_PATH) -and (Test-Path $standaloneSrc)) {
    $cscArgs = @(
        "/target:winexe",
        "/optimize+",
        "/platform:anycpu",
        "/resource:$zipPath,ApexBillBundle.zip",
        "/resource:$versionTxt,BundleVersion.txt",
        "/out:$standaloneExe",
        "/win32icon:$iconPath",
        "/win32manifest:$manifestPath",
        "/r:System.dll",
        "/r:System.IO.Compression.dll",
        "/r:System.IO.Compression.FileSystem.dll",
        "/r:System.Windows.Forms.dll",
        "$standaloneSrc",
        "$versionCs"
    )

    try {
        $proc = Start-Process -FilePath $CSC_PATH -ArgumentList $cscArgs -NoNewWindow -Wait -PassThru

        if ($proc.ExitCode -eq 0 -and (Test-Path $standaloneExe)) {
            # Authenticode code signing on standalone binary
            if (Test-Path "$ROOT_DIR\scripts\sign-binary.ps1") {
                Write-Host "   Applying Authenticode digital signature to Standalone .exe..." -ForegroundColor Cyan
                & "$ROOT_DIR\scripts\sign-binary.ps1" -FilePath $standaloneExe -ExportCertPath $certExportPath
            }

            Copy-Item -Path $standaloneExe -Destination $standaloneAlias -Force
            if (Test-Path "$ROOT_DIR\scripts\sign-binary.ps1") {
                & "$ROOT_DIR\scripts\sign-binary.ps1" -FilePath $standaloneAlias
            }

            $exeSizeMb = [Math]::Round(((Get-Item $standaloneExe).Length / 1MB), 1)
            Write-Host "   Created Standalone Executable: $standaloneExe ($exeSizeMb MB)" -ForegroundColor Green
        } else {
            Write-Warning "Failed to compile Standalone Single-File .exe with exit code $($proc.ExitCode)"
        }
    } finally {
        Remove-Item $versionTxt -Force -ErrorAction SilentlyContinue
        Remove-Item $versionCs -Force -ErrorAction SilentlyContinue
    }
}

# Sign root dev launcher if present
if (Test-Path (Join-Path $ROOT_DIR "ApexBill.exe")) {
    & "$ROOT_DIR\scripts\sign-binary.ps1" -FilePath (Join-Path $ROOT_DIR "ApexBill.exe")
}

# Step 7: Cryptographic Signature Verification Report
Write-Host "`nStep 7: Verifying Release Authenticode Signatures..." -ForegroundColor Yellow
$binariesToVerify = @(
    (Join-Path $BUNDLE_DIR "ApexBill.exe"),
    (Join-Path $ROOT_DIR "ApexBill.exe"),
    $standaloneExe,
    $standaloneAlias
)
foreach ($bin in $binariesToVerify) {
    if (Test-Path $bin) {
        $sig = Get-AuthenticodeSignature -FilePath $bin
        $leafName = Split-Path $bin -Leaf
        $certStatus = if ($sig.Status -eq "Valid") { "Valid" } elseif ($sig.SignerCertificate) { "Signed ($($sig.Status))" } else { "Unsigned" }
        $thumb = if ($sig.SignerCertificate) { $sig.SignerCertificate.Thumbprint.Substring(0, 10) + "..." } else { "None" }
        Write-Host "   [Authenticode] $leafName -> $certStatus | SHA256: $thumb" -ForegroundColor Green
    }
}

Write-Host "`n========================================================================" -ForegroundColor Cyan
Write-Host "  ApexBill Release Packaging Complete (v$VERSION)!" -ForegroundColor Green
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "  1. Portable Folder (with signed ApexBill.exe): $BUNDLE_DIR"
Write-Host "  2. Standalone ZIP Archive (with cert tools):  $zipPath ($zipSizeMb MB)"
if (Test-Path $standaloneExe) {
    Write-Host "  3. Signed Standalone Single-File .exe:         $standaloneExe ($exeSizeMb MB)"
}
Write-Host "========================================================================`n" -ForegroundColor Cyan

