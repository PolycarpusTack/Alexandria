@echo off
echo Starting Alexandria Development Server...
echo.

:: Set memory limits
set NODE_OPTIONS=--max-old-space-size=4096

:: Start both server and client concurrently
npx concurrently "ppppnpm run dev:server" "ppppnpm run dev:client"