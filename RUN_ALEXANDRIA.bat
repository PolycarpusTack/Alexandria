@echo off
cls
echo.
echo ================================================================================
echo                    ALEXANDRIA PLATFORM - DEVELOPMENT SERVER
echo ================================================================================
echo.
echo Starting minimal server (no dependencies required)...
echo.

cd /d C:\Projects\Alexandria

:: Run the minimal server
node minimal-server.js

:: If node is not available, show error
if errorlevel 1 (
    echo.
    echo ================================================================================
    echo ERROR: Node.js is not installed or not in PATH
    echo ================================================================================
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo.
    pause
)
