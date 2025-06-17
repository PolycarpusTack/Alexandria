@echo off
cls
echo ================================================================================
echo                  ALEXANDRIA PLATFORM - COMPLETE ROOT FIX
echo ================================================================================
echo.
echo This script will fix ALL root issues with the Alexandria Platform.
echo Please ensure you are running this as Administrator.
echo.
pause

echo.
echo [1/5] Running PowerShell root fixes...
echo ================================================================================
powershell -ExecutionPolicy Bypass -File fix-root-issues.ps1

if errorlevel 1 (
    echo.
    echo ERROR: PowerShell script failed. Make sure you're running as Administrator.
    pause
    exit /b 1
)

echo.
echo [2/5] Creating missing core exports...
echo ================================================================================
node create-missing-exports.js

if errorlevel 1 (
    echo.
    echo ERROR: Failed to create exports. Check that Node.js is installed.
    pause
    exit /b 1
)

echo.
echo [3/5] Fixing TypeScript imports...
echo ================================================================================
node fix-typescript-imports.js

if errorlevel 1 (
    echo.
    echo ERROR: Failed to fix imports.
    pause
    exit /b 1
)

echo.
echo [4/5] Running TypeScript compilation check...
echo ================================================================================
npx tsc --noEmit

echo.
echo [5/5] Starting development environment...
echo ================================================================================
echo.
echo All fixes applied! Starting Alexandria Platform...
echo.

:: Start the development server
node start-dev.js

pause
