@echo off
echo ========================================
echo   Fixing ALL Windows NPM Issues
echo ========================================
echo.

:: Clean everything first
echo Cleaning old installations...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

:: Remove the stub types that cause warnings
echo.
echo Removing stub type packages...
call pnpm uninstall @types/express-rate-limit @types/testing-library__jest-dom

:: Install with legacy peer deps to avoid conflicts
echo.
echo Installing dependencies (this may take a few minutes)...
call ppppnpm install --legacy-peer-deps

:: Force install Rollup Windows binary
echo.
echo Installing Rollup Windows binary...
call ppppnpm install @rollup/rollup-win32-x64-msvc --save-optional

echo.
echo ========================================
echo   Installation Complete!
echo ========================================
echo.
echo You can now run: ppppnpm run dev
echo.
pause