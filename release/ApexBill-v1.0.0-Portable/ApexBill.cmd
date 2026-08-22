@echo off
title ApexBill Desktop Launcher
cd /d "%~dp0"
echo.
echo  =======================================================
echo         ApexBill - Modern Billing POS System
echo  =======================================================
echo.
echo  [1/2] Starting ApexBill Server...
start "" /B "%~dp0runtime\node.exe" --experimental-sqlite "%~dp0app\dist\index.js"
echo  [2/2] Launching Application Window...
timeout /t 2 /nobreak >nul
start "" msedge.exe --app=http://localhost:54321 || start http://localhost:54321
echo.
echo  ApexBill is running at http://localhost:54321
echo  Do not close this window while using the software.
echo.
