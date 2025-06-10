@echo off
echo Fixing node_modules installation issues...

REM Check if we're in the right directory
if not exist package.json (
    echo ERROR: package.json not found. Please run this from the Alexandria root directory.
    exit /b 1
)

REM Clean up conflicting lock files
echo Cleaning up lock files...
if exist package-lock.json del package-lock.json
if exist yarn.lock del yarn.lock

REM Ensure pnpm is installed globally
echo Checking pnpm installation...
where pnpm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Installing pnpm globally...
    npm install -g pnpm
)

REM Clean install with pnpm
echo Performing clean installation...
if exist node_modules (
    echo Removing existing node_modules...
    rmdir /s /q node_modules
)

echo Installing dependencies with pnpm...
call pnpm install

REM Verify installation
echo.
echo Verifying installation...
if exist node_modules\.bin\concurrently.cmd (
    echo SUCCESS: Dependencies installed correctly!
    echo.
    echo You can now run: pnpm dev
) else (
    echo ERROR: Installation may have failed. Missing executables in node_modules\.bin
    echo Try running: pnpm install --force
)

pause