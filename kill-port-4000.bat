@echo off
echo Killing processes on port 4000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":4000" ^| find "LISTENING"') do (
    echo Killing process %%a
    taskkill /F /PID %%a
)
echo Done. Port 4000 should be free now.
pause