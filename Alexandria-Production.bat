@echo off
title Alexandria Platform - Production Mode
echo ========================================
echo   Alexandria Platform - Production
echo ========================================
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
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

:: Build the application
if not exist "dist" (
    echo Building application for production...
    call npm run build
    if %errorlevel% neq 0 (
        echo ERROR: Failed to build application
        pause
        exit /b 1
    )
)

:: Set production environment
set NODE_ENV=production

:: Load environment variables if .env file exists
if exist ".env" (
    echo Loading environment variables...
    for /f "delims=" %%x in (.env) do (
        set "%%x"
    )
)

:: Start the production server
echo.
echo Starting production server on http://localhost:3001
echo.
echo Press Ctrl+C to stop the server
echo.

:: Open browser after a short delay
start /b cmd /c "timeout /t 5 >nul && start http://localhost:3001"

:: Run the production server
node dist/index.js

pause