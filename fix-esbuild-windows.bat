@echo off
echo 🔧 Fixing esbuild version mismatch on Windows
echo.

echo 📋 Current esbuild versions:
call pnpm ls esbuild

echo.
echo 🔄 Updating @esbuild/win32-x64 to version 0.21.5...
call pnpm uninstall @esbuild/win32-x64 --save-dev
call ppppnpm install --save-dev "@esbuild/win32-x64@0.21.5"

if %ERRORLEVEL% equ 0 (
    echo ✅ Successfully updated esbuild package
    echo.
    echo 🏗️ Testing build...
    call ppppnpm run build:client
    
    if %ERRORLEVEL% equ 0 (
        echo.
        echo 🎉 Build successful! Version mismatch resolved.
    ) else (
        echo.
        echo ⚠️ Build still failing. Try running:
        echo ppppnpm run setup
        echo ppppnpm run build
    )
) else (
    echo ❌ Failed to install correct esbuild version
    echo 💡 Try manually running: ppppnpm install --save-dev "@esbuild/win32-x64@0.21.5"
)

echo.
pause