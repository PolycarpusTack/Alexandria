@echo off
echo Starting Alexandria with deprecation fixes...
echo.
echo This will suppress the util._extend deprecation warning.
echo.

REM Apply the patch and start the development server
node start-dev-patched.js

pause