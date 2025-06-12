@echo off
echo Starting Alexandria Development Environment (Direct Mode)...
echo.
echo This will open two separate windows for the server and client.
echo.

REM Start server
echo Starting server...
start "Alexandria Server" cmd /c "color 0E && echo ALEXANDRIA SERVER && echo ===================== && echo. && cd /d %~dp0 && pnpm run dev:server"

REM Wait a bit for server to start
timeout /t 3 /nobreak >nul

REM Start client
echo Starting client...
start "Alexandria Client" cmd /c "color 0B && echo ALEXANDRIA CLIENT && echo ===================== && echo. && cd /d %~dp0 && pnpm run dev:client"

echo.
echo Both servers are now running in separate windows.
echo.
echo To stop the servers:
echo   - Close each window individually, or
echo   - Press any key here to stop both servers
echo.
pause >nul

REM Kill both processes
taskkill /FI "WINDOWTITLE eq Alexandria Server*" /F 2>nul
taskkill /FI "WINDOWTITLE eq Alexandria Client*" /F 2>nul

echo.
echo Servers stopped.
pause