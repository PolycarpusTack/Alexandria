@echo off
echo.
echo ================================================================================
echo                    Alexandria Platform - Development Environment
echo ================================================================================
echo.

echo CURRENT STATUS:
echo --------------
echo [!] Node modules have permission issues that prevent normal startup
echo [!] TypeScript compilation errors need to be resolved
echo.

echo IMMEDIATE SOLUTION:
echo ------------------
echo Opening the Alexandria Platform UI directly in your browser...
echo.

:: Open the HTML file in the default browser
start "" "C:\Projects\Alexandria\Alexandria Platform Enhanced UI.html"

echo.
echo The UI is now open in your browser. Note that API features won't work without
echo the backend server running.
echo.
echo ================================================================================
echo TO FIX THE DEVELOPMENT ENVIRONMENT:
echo ================================================================================
echo.
echo 1. RESET NODE_MODULES (Run as Administrator):
echo    - Close all editors and terminals
echo    - Run: rmdir /s /q node_modules
echo    - Run: del package-lock.json pnpm-lock.yaml
echo    - Run: pnpm install --shamefully-hoist
echo.
echo 2. IF PNPM FAILS, TRY NPM:
echo    - Run: npm install --force --legacy-peer-deps
echo.
echo 3. INSTALL MISSING GLOBAL TOOLS:
echo    - Run: npm install -g typescript ts-node nodemon
echo.
echo 4. FOR ROLLUP/VITE ISSUES:
echo    - Run: npm install -D @rollup/rollup-win32-x64-msvc
echo.
echo 5. START IN SIMPLE MODE:
echo    - Backend: npx ts-node --transpile-only src/index.ts
echo    - Frontend: npx vite --host
echo.
echo ================================================================================
echo ALTERNATIVE: Use WSL (Windows Subsystem for Linux)
echo ================================================================================
echo If Windows continues to have issues, consider using WSL:
echo.
echo 1. Install WSL: wsl --install
echo 2. Clone the project in WSL
echo 3. Run: pnpm install
echo 4. Run: pnpm dev
echo.
echo ================================================================================
echo.
pause
