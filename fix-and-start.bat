@echo off
echo Fixing missing dependencies...
echo.

cd /d C:\Projects\Alexandria

echo Installing vite...
pnpm add -D vite

echo.
echo Installing ts-node-dev...
pnpm add -D ts-node-dev

echo.
echo Installing other essential packages...
pnpm add -D @vitejs/plugin-react ts-node typescript

echo.
echo Running full install...
pnpm install

echo.
echo Starting Alexandria...
pnpm dev

pause