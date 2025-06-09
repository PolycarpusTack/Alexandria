@echo off
echo ========================================
echo Alexandria Platform - Activate Mockup UI
echo ========================================
echo.
echo This will set the UI to match the exact mockup design.
echo.

REM Run the activation script
node activate-mockup-ui.js

echo.
echo ========================================
echo Mockup UI Activated!
echo ========================================
echo.
echo Next steps:
echo 1. Start the application: npm run dev
echo 2. Open http://localhost:3000
echo 3. The UI should now match the exact mockup
echo.
echo If the UI doesn't look right:
echo 1. Open browser console (F12)
echo 2. Run: localStorage.setItem('alexandria-layout-mode', 'mockup');
echo 3. Refresh the page
echo.
pause
