@echo off
echo =====================================
echo   Alexandria pnpm Conversion
echo =====================================
echo.
echo This will convert your project from npm to pnpm.
echo A backup will be created before any changes.
echo.
pause

:: Run the comprehensive conversion script
node pnpm-full-conversion.js

echo.
echo =====================================
echo   Conversion Complete!
echo =====================================
echo.
echo Next steps:
echo 1. Review the changes in your code editor
echo 2. Test the development server: pnpm dev
echo 3. Run tests: pnpm test
echo.
echo If you encounter any issues:
echo - Check the backup in .npm-to-pnpm-backup/
echo - Run: pnpm store prune
echo - Try: pnpm install --force
echo.
pause