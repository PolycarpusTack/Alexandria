@echo off
echo Starting Alexandria Development Environment...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [ERROR] node_modules folder not found!
    echo Please run: pnpm install
    exit /b 1
)

REM Try to run with the dev-start.js script
node dev-start.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [FALLBACK] Trying alternative start method...
    echo.
    
    REM Fallback: Try to run servers separately
    echo Starting servers in separate windows...
    start "Alexandria Server" cmd /k "pnpm run dev:server"
    timeout /t 3 >nul
    start "Alexandria Client" cmd /k "pnpm run dev:client"
    
    echo.
    echo Servers started in separate windows.
    echo Press any key to stop all servers...
    pause >nul
    
    REM Kill the processes
    taskkill /FI "WINDOWTITLE eq Alexandria Server" /F 2>nul
    taskkill /FI "WINDOWTITLE eq Alexandria Client" /F 2>nul
)

exit /b %ERRORLEVEL%