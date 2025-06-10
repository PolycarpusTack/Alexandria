@echo off
echo Stopping development server...

REM Kill any existing Node.js processes
taskkill /F /IM node.exe 2>nul
taskkill /F /IM ts-node.exe 2>nul

echo.
echo Clearing TypeScript cache...

REM Clear ts-node cache
if exist "%TEMP%\ts-node-*" (
    rd /s /q "%TEMP%\ts-node-*" 2>nul
)

REM Clear node_modules/.cache if it exists
if exist "node_modules\.cache" (
    rd /s /q "node_modules\.cache"
)

echo.
echo TypeScript cache cleared. 
echo.
echo Please restart your development server with: pnpm dev
echo.
pause