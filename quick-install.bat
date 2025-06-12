@echo off
echo Alexandria Platform - Quick Install (Windows)
echo ============================================
echo.

echo Cleaning old dependencies...
if exist node_modules rmdir /s /q node_modules
if exist pnpm-lock.yaml del /f pnpm-lock.yaml

echo.
echo Installing dependencies...
call pnpm install --force

echo.
echo Checking TypeScript types...
call pnpm list @types/node @types/express

echo.
echo ======================================
echo Installation complete!
echo.
echo Next steps:
echo 1. Open WSL terminal
echo 2. cd /mnt/c/Projects/Alexandria  
echo 3. ./wsl-dev.sh
echo.
pause