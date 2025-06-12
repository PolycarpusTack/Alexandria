@echo off
cd /d C:\Projects\Alexandria
echo Starting Alexandria Platform...
echo.

REM Use the direct path to pnpm
"%APPDATA%\npm\pnpm.cmd" dev

pause