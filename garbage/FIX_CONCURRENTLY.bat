@echo off
echo Fixing concurrently installation...
echo.

:: Go to the main project directory
cd /d "%~dp0"

:: Install just concurrently
echo Installing concurrently...
call npm install concurrently@8.2.2

:: Try pnpm dev again
echo.
echo Testing pnpm dev...
call pnpm dev

pause