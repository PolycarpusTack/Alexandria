@echo off
cls
:menu
echo.
echo ================================================================================
echo                         ALEXANDRIA PLATFORM LAUNCHER
echo ================================================================================
echo.
echo   1. Start Minimal Server (No Dependencies) - WORKING!
echo   2. View API in Browser (http://localhost:4000)
echo   3. View Setup Instructions
echo   4. Fix Node Modules (Run as Admin)
echo   5. Open Project in VS Code
echo   6. Exit
echo.
echo ================================================================================
echo.
set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" goto start_minimal
if "%choice%"=="2" goto open_browser
if "%choice%"=="3" goto show_instructions
if "%choice%"=="4" goto fix_modules
if "%choice%"=="5" goto open_vscode
if "%choice%"=="6" goto exit

echo Invalid choice. Please try again.
pause
goto menu

:start_minimal
cls
echo Starting Alexandria Platform Minimal Server...
echo.
node minimal-server.js
pause
goto menu

:open_browser
start http://localhost:4000
goto menu

:show_instructions
cls
type QUICKSTART.md
pause
goto menu

:fix_modules
cls
echo ================================================================================
echo                    FIXING NODE MODULES (Administrator Required)
echo ================================================================================
echo.
echo This will delete and reinstall all dependencies.
echo Make sure you have closed all editors and terminals.
echo.
set /p confirm="Continue? (Y/N): "
if /i "%confirm%"=="Y" (
    echo.
    echo Removing node_modules...
    rmdir /s /q node_modules 2>nul
    del package-lock.json 2>nul
    del pnpm-lock.yaml 2>nul
    echo.
    echo Installing dependencies...
    call pnpm install --shamefully-hoist
    echo.
    echo Done!
)
pause
goto menu

:open_vscode
start code .
goto menu

:exit
echo.
echo Thank you for using Alexandria Platform!
echo.
exit
