@echo off
echo Clearing TypeScript cache and fixing build issues...
echo.

REM Clear TypeScript build info
if exist "tsconfig.tsbuildinfo" del /q tsconfig.tsbuildinfo
if exist "tsconfig.server.tsbuildinfo" del /q tsconfig.server.tsbuildinfo

REM Clear any .tsbuildinfo files
for /r . %%f in (*.tsbuildinfo) do del /q "%%f"

REM Clear dist folder
if exist "dist" (
    echo Clearing dist folder...
    rmdir /s /q dist
)

REM Fix csstype issue by reinstalling
echo.
echo Fixing csstype issue...
cd node_modules
if exist "csstype" (
    rmdir /s /q csstype
)
cd ..

echo.
echo Cache cleared. Please run 'pnpm install' to reinstall csstype, then try building again.
pause