@echo off
title Trust ApexBill Code Signing Certificate
echo ========================================================
echo   ApexBill - Trust Code Signing Certificate
echo ========================================================
echo.
echo Installing ApexBill certificate to Trusted Root and Trusted Publishers...
echo Note: This requires Administrator privileges.
echo.
cd /d "%~dp0"
if not exist "ApexBill-CodeSigning.cer" (
    echo Error: ApexBill-CodeSigning.cer not found in current folder.
    pause
    exit /b 1
)

certutil -addstore -f "Root" "ApexBill-CodeSigning.cer"
certutil -addstore -f "TrustedPublisher" "ApexBill-CodeSigning.cer"

echo.
if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] ApexBill certificate has been installed into Trusted Root and Trusted Publishers!
    echo Windows Smart App Control and SmartScreen will now recognize ApexBill binaries.
) else (
    echo [FAILED] Installation requires Administrator privileges.
    echo Please right-click this script and select "Run as administrator".
)
echo.
pause
