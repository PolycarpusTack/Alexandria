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
    call node_modules\.bin\concurrently.cmd --prefix-colors "yellow,cyan" --names "SERVER,CLIENT" --kill-others-on-fail "pnpm run dev:server" "pnpm run dev:client"
) else (
    echo concurrently not found in node_modules, trying pnpm exec...
    call pnpm exec concurrently --prefix-colors "yellow,cyan" --names "SERVER,CLIENT" --kill-others-on-fail "pnpm run dev:server" "pnpm run dev:client"
    if %errorlevel% neq 0 (
        echo.
        echo Starting servers in separate windows...
        start "Alexandria Server" cmd /c "color 0E && title Alexandria Server && echo ALEXANDRIA SERVER && echo. && pnpm run dev:server && pause"
        timeout /t 3 /nobreak >nul
        start "Alexandria Client" cmd /c "color 0B && title Alexandria Client && echo ALEXANDRIA CLIENT && echo. && pnpm run dev:client && pause"
        echo.
        echo Development environment started in separate windows.
        echo.
        echo Press any key to stop all servers...
        pause >nul
        
        REM Kill the server processes
        taskkill /FI "WINDOWTITLE eq Alexandria Server*" /F 2>nul
        taskkill /FI "WINDOWTITLE eq Alexandria Client*" /F 2>nul
    )
)

pause