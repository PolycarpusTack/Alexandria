@echo off
echo Starting Alexandria QA Quick Start...
node qa-quick-start.js
if %ERRORLEVEL% NEQ 0 (
    echo Failed to start QA environment.
    exit /b %ERRORLEVEL%
)