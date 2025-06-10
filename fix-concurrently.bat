@echo off
echo Fixing concurrently installation issue...
echo.

REM Check if pnpm is available
where pnpm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] pnpm is not installed or not in PATH!
    echo Please install pnpm first: npm install -g pnpm
    exit /b 1
)

REM Install concurrently as a dev dependency
echo Installing concurrently...
pnpm add -D concurrently

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] concurrently has been installed successfully!
    echo.
    echo You can now run the development server with:
    echo   pnpm dev
    echo   - or -
    echo   npm run dev
    echo   - or -
    echo   dev-safe.bat
) else (
    echo.
    echo [ERROR] Failed to install concurrently
    echo.
    echo Alternative: You can run the servers separately:
    echo   1. Open a new terminal and run: pnpm run dev:server
    echo   2. Open another terminal and run: pnpm run dev:client
)

pause