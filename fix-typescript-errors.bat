@echo off
echo Fixing TypeScript compilation errors...
echo.

REM Fix system-metrics.ts - force overwrite with correct content
echo Fixing system-metrics.ts...
powershell -Command "(Get-Content 'src\api\system-metrics.ts') -replace 'import { getDataService }', 'import { createDataService }' | Set-Content 'src\api\system-metrics.ts'"
powershell -Command "(Get-Content 'src\api\system-metrics.ts') -replace 'const dataService = getDataService\(\);', 'const logger = new Logger(); const dataService = createDataService({}, logger);' | Set-Content 'src\api\system-metrics.ts'"

REM Fix AIServiceFactory.ts
echo Fixing AIServiceFactory.ts...
powershell -Command "(Get-Content 'src\core\services\ai-service\AIServiceFactory.ts') -replace 'this\.defaultService = this\.services\.values\(\)\.next\(\)\.value;', 'this.defaultService = this.services.values().next().value || null;' | Set-Content 'src\core\services\ai-service\AIServiceFactory.ts'"

REM Clear TypeScript cache
echo.
echo Clearing TypeScript cache...
if exist "tsconfig.tsbuildinfo" del /q tsconfig.tsbuildinfo
if exist "tsconfig.server.tsbuildinfo" del /q tsconfig.server.tsbuildinfo
if exist "dist" rmdir /s /q dist

REM Remove problematic csstype
echo.
echo Removing problematic csstype module...
if exist "node_modules\csstype" rmdir /s /q "node_modules\csstype"

echo.
echo Fixes applied. Now run:
echo   1. pnpm install  (to reinstall csstype)
echo   2. pnpm run build:server
echo.
pause