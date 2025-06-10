@echo off
echo Fixing Windows NPM issues...
echo.

:: Install missing types
echo Installing express-rate-limit types...
call ppppnpm install --save-dev @types/express-rate-limit@6.0.0

:: Force install Rollup Windows binary
echo.
echo Forcing Rollup Windows binary...
call ppppnpm install --force @rollup/rollup-win32-x64-msvc

echo.
echo Done! Now try: ppppnpm run dev
pause