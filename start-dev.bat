@echo off
echo Running Alexandria Platform startup script...
echo.

:: Fix Rollup binary issues first
node fix-rollup.js
if %ERRORLEVEL% NEQ 0 (
    echo Failed to fix Rollup binary issue.
    pause
    exit /b %ERRORLEVEL%
)

:: Start the development server
echo Starting development server...
npm run dev

pause