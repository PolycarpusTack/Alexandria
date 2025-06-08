@echo off
title Alexandria Platform Launcher
echo ========================================
echo   Alexandria Platform Launcher
echo ========================================
echo.
echo Starting Alexandria development server...
echo.

cd /d "%~dp0"

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    call ppppnpm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

:: Start the development server
echo.
echo Starting development server on http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo.

:: Set memory limits
set NODE_OPTIONS=--max-old-space-size=4096

:: Open browser after a short delay
start /b cmd /c "timeout /t 5 >nul && start http://localhost:3000"

:: Run the development server
call dev-windows.bat

pause