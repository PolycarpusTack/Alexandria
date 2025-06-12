@echo off
echo Clearing Vite cache...

REM Delete Vite cache
if exist "node_modules\.vite" (
    echo Removing .vite cache directory...
    rmdir /s /q "node_modules\.vite"
)

REM Delete dist folder
if exist "dist" (
    echo Removing dist directory...
    rmdir /s /q "dist"
)

REM Clear npm cache
echo Clearing npm cache...
npm cache clean --force 2>nul

echo.
echo Vite cache cleared successfully!
echo You can now restart the development server.
pause