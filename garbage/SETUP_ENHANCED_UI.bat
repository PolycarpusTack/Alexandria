@echo off
echo ========================================
echo Alexandria Platform - Enhanced UI Setup
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Checking UI implementation...
node check-ui-implementation.js
echo.

echo Setting enhanced UI as default...
node set-enhanced-ui.js
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Start the application with: npm run dev
echo 2. Open http://localhost:3000 in your browser
echo 3. Login with username: demo, password: demo
echo.
echo The enhanced UI should now be active!
echo.
echo Keyboard shortcuts:
echo   Ctrl+K - Open command palette
echo   Ctrl+B - Toggle sidebar
echo   Ctrl+Shift+T - Toggle theme
echo.
pause
