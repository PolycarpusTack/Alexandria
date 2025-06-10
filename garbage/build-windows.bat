@echo off
echo 🚀 Alexandria Windows Build Script
echo.

echo 🔧 Setting up platform dependencies...
node scripts\platform-setup.js
if %ERRORLEVEL% neq 0 (
    echo ❌ Platform setup failed
    exit /b 1
)

echo.
echo 🏗️ Building Alexandria...
ppppnpm run build:simple
if %ERRORLEVEL% neq 0 (
    echo ❌ Build failed
    exit /b 1
)

echo.
echo 🎉 Build completed successfully!
echo ℹ️ Built files are in the dist/ directory
pause