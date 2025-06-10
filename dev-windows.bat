@echo off
echo Starting Alexandria Development Environment...
echo.

REM Check if pnpm is installed
where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: pnpm is not installed or not in PATH
    echo Please install pnpm first: npm install -g pnpm
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    call pnpm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Try to use concurrently from node_modules
if exist "node_modules\.bin\concurrently.cmd" (
    echo Using concurrently from node_modules...
    call node_modules\.bin\concurrently "pnpm run dev:server" "pnpm run dev:client"
) else (
    echo concurrently not found in node_modules, installing globally...
    call npm install -g concurrently
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install concurrently
        echo.
        echo Running server and client separately...
        echo Starting server in new window...
        start "Alexandria Server" cmd /k "pnpm run dev:server"
        timeout /t 3 /nobreak >nul
        echo Starting client in new window...
        start "Alexandria Client" cmd /k "pnpm run dev:client"
        echo.
        echo Development environment started in separate windows.
        echo Close this window to keep the servers running.
    ) else (
        echo Running with globally installed concurrently...
        call concurrently "pnpm run dev:server" "pnpm run dev:client"
    )
)

pause