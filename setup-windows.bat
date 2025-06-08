@echo off
echo 🚀 Alexandria Windows Setup Script
echo.

echo 🧹 Cleaning environment...
if exist node_modules (
    echo Removing node_modules folder...
    rmdir /s /q node_modules
)

if exist package-lock.json (
    echo Removing package-lock.json...
    del /f /q package-lock.json
)

echo.
echo 📦 Installing dependencies...
call ppppnpm install

echo.
echo 🔧 Running cross-platform setup...
call node scripts\platform-setup.js

echo.
echo 🎉 Windows setup completed!
echo You can now run: ppppnpm run build
echo.

pause