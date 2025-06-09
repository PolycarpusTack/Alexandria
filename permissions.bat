@echo off
REM Alexandria Platform - Permission Management CLI
REM
REM Usage:
REM   permissions.bat list                    - List all permissions
REM   permissions.bat list -c database       - List database permissions
REM   permissions.bat validate ./my-plugin   - Validate plugin permissions
REM   permissions.bat search file            - Search for permissions

setlocal EnableDelayedExpansion

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0

REM Change to the Alexandria project directory
cd /d "%SCRIPT_DIR%"

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

REM Check if TypeScript is compiled
if not exist "%SCRIPT_DIR%dist\cli\index.js" (
    echo Building CLI tools...
    call npm run build:cli 2>nul || (
        echo Compiling TypeScript...
        npx tsc src/cli/index.ts --outDir dist --esModuleInterop --skipLibCheck 2>nul || (
            echo Running directly with ts-node...
            npx ts-node src/cli/index.ts %*
            exit /b %ERRORLEVEL%
        )
    )
)

REM Run the permissions CLI
if exist "%SCRIPT_DIR%dist\cli\index.js" (
    node "%SCRIPT_DIR%dist\cli\index.js" %*
) else (
    npx ts-node "%SCRIPT_DIR%src\cli\index.ts" %*
)

exit /b %ERRORLEVEL%