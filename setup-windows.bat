@echo off
echo Alexandria Platform Windows Setup
echo ================================
echo.
echo This script will clean your Node.js environment and set up the Alexandria Platform.
echo.

:: Step 1: Clean the environment
echo Step 1: Cleaning environment...
if exist node_modules (
    echo Removing node_modules folder...
    rmdir /s /q node_modules
)

if exist package-lock.json (
    echo Removing package-lock.json...
    del /f /q package-lock.json
)

:: Step 2: Install dependencies
echo.
echo Step 2: Installing dependencies...
call npm install

:: Step 3: Run the Rollup fix script
echo.
echo Step 3: Running Rollup fix script...
call node fix-rollup.js

:: Step 4: Create .env file if needed
echo.
echo Step 4: Setting up environment variables...
if not exist .env (
    echo Creating .env file from .env.example...
    copy .env.example .env
) else (
    echo .env file already exists, skipping...
)

:: Step 5: Install platform-specific dependencies if needed
echo.
echo Step 5: Installing platform-specific dependencies...
call npm install @esbuild/win32-x64 @rollup/rollup-win32-x64-msvc --save-dev --no-save

:: Step 6: Run tests
echo.
echo Step 6: Testing the setup...
call npm run dev:server -- --test-setup

echo.
echo Setup complete!
echo You can now start the development server with:
echo npm run dev
echo or
echo .\start-dev.bat
echo.

pause