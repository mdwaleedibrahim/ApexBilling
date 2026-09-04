@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
for %%I in ("%SCRIPT_DIR%\..") do set "ROOT_DIR=%%~fI"

:: Locate node.exe
set "NODE_EXE="
where node.exe >nul 2>nul
if %errorlevel% equ 0 (
    for /f "delims=" %%i in ('where node.exe') do (
        if not defined NODE_EXE set "NODE_EXE=%%i"
    )
)

if not defined NODE_EXE (
    if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
)

if not defined NODE_EXE (
    for /r "%ROOT_DIR%\release" %%f in (node.exe) do (
        if exist "%%f" (
            if not defined NODE_EXE set "NODE_EXE=%%f"
        )
    )
)

if not defined NODE_EXE (
    echo [Error] Could not find node.exe. Please install Node.js: winget install OpenJS.NodeJS.LTS
    exit /b 1
)

echo [ApexBill] Using Node runtime: !NODE_EXE!

echo [1/2] Building Client...
cd /d "%ROOT_DIR%\src\client"
"!NODE_EXE!" "%ROOT_DIR%\src\client\node_modules\vite\bin\vite.js" build
if %errorlevel% neq 0 exit /b %errorlevel%

echo [2/2] Building Server...
cd /d "%ROOT_DIR%\src\server"
"!NODE_EXE!" "%ROOT_DIR%\src\server\node_modules\typescript\bin\tsc"
if %errorlevel% neq 0 exit /b %errorlevel%

cd /d "%ROOT_DIR%"
echo [ApexBill] Build completed successfully!
