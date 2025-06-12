@echo off
title Alexandria - Quick Fix

echo =======================================
echo Alexandria Platform - Quick Fix
echo =======================================
echo.

echo Using direct path to pnpm...
echo.

REM Use the direct path where npm installs global packages
set PNPM_PATH=%APPDATA%\npm\pnpm.cmd

if exist "%PNPM_PATH%" (
    echo Found pnpm!
    echo.
    echo Cleaning old files...
    if exist node_modules rmdir /s /q node_modules
    if exist pnpm-lock.yaml del /f pnpm-lock.yaml
    
    echo.
    echo Installing dependencies...
    echo.
    "%PNPM_PATH%" install --force
    
    echo.
    echo =======================================
    echo Installation complete!
    echo.
    echo Next: Run wsl-dev.sh in WSL terminal
    echo =======================================
) else (
    echo ERROR: Could not find pnpm
    echo.
    echo Try closing this window and running:
    echo   npm install -g pnpm
    echo.
    echo Then run this script again.
)

pause