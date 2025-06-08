@echo off
echo ========================================
echo   Installing Alexandria Shortcuts
echo ========================================
echo.

:: Run the PowerShell script to create desktop shortcut
powershell -ExecutionPolicy Bypass -File "%~dp0create-desktop-shortcut.ps1"

echo.
echo Installation complete!
echo.
echo You now have a desktop shortcut for Alexandria Platform.
echo Double-click it to launch the development server.
echo.
pause