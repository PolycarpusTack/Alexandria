@echo off
echo Installing missing packages...
echo.

pnpm add -D vite ts-node-dev

echo.
echo Starting Alexandria...
pnpm dev

pause