@echo off
title Alexandria Platform - Windows Setup

echo =======================================
echo Alexandria Platform - Installing pnpm
echo =======================================
echo.

echo Checking for Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Download and run the Windows installer.
    echo.
    pause
    exit /b 1
)

echo Node.js found!
echo.

echo Checking for pnpm...
pnpm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo pnpm not found. Installing...
    echo.
    call npm install -g pnpm
    echo.
    
    pnpm --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install pnpm
        echo Try running as Administrator
        pause
        exit /b 1
    )
)

echo pnpm is installed!
echo.
echo Running dependency installation...
echo.

call pnpm install --force

echo.
echo =======================================
echo Setup complete!
echo.
echo Next steps:
echo 1. Open WSL terminal
echo 2. cd /mnt/c/Projects/Alexandria
echo 3. ./wsl-dev.sh
echo =======================================
pause