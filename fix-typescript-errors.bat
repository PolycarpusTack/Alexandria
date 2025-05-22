@echo off
echo Running TypeScript error fixes...
node fix-typescript-errors.js
if %ERRORLEVEL% NEQ 0 (
    echo Failed to fix TypeScript errors.
    exit /b %ERRORLEVEL%
)
echo TypeScript error fixes completed successfully.