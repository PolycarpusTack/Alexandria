@echo off
echo ========================================
echo   Fresh pnpm Installation
echo ========================================
echo.

:: Clean everything first
echo Cleaning old files...
if exist node_modules rmdir /s /q node_modules
if exist pnpm-lock.yaml del pnpm-lock.yaml

:: Remove the workspace file temporarily to avoid issues
if exist pnpm-workspace.yaml (
    echo Temporarily removing workspace file...
    ren pnpm-workspace.yaml pnpm-workspace.yaml.bak
)

:: Install all dependencies
echo.
echo Installing all dependencies with pnpm...
pnpm install

:: Restore workspace file
if exist pnpm-workspace.yaml.bak (
    ren pnpm-workspace.yaml.bak pnpm-workspace.yaml
)

:: Verify concurrently is installed
echo.
echo Checking if concurrently is installed...
where concurrently 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ concurrently is available globally
) else (
    echo Checking in node_modules...
    if exist node_modules\.bin\concurrently.cmd (
        echo ✓ concurrently is installed locally
    ) else (
        echo ✗ concurrently not found, installing directly...
        npm install concurrently@8.2.2
    )
)

echo.
echo ========================================
echo   Installation Complete!
echo ========================================
echo.
echo Now try: pnpm dev
echo.
pause