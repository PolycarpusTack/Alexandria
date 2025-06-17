@echo off
echo.
echo ===================================================
echo         Alexandria Platform - Quick Start
echo ===================================================
echo.

cd /d C:\Projects\Alexandria

echo Creating simple Express server...

:: Create a minimal server file
echo const express = require('express'); > simple-dev-server.js
echo const path = require('path'); >> simple-dev-server.js
echo const fs = require('fs'); >> simple-dev-server.js
echo. >> simple-dev-server.js
echo const app = express(); >> simple-dev-server.js
echo const PORT = 4000; >> simple-dev-server.js
echo. >> simple-dev-server.js
echo app.use(express.json()); >> simple-dev-server.js
echo app.use(express.static('public')); >> simple-dev-server.js
echo. >> simple-dev-server.js
echo app.get('/api/health', (req, res) =^> { >> simple-dev-server.js
echo   res.json({ status: 'ok', message: 'Alexandria Platform Running' }); >> simple-dev-server.js
echo }); >> simple-dev-server.js
echo. >> simple-dev-server.js
echo app.get('/', (req, res) =^> { >> simple-dev-server.js
echo   const htmlFile = path.join(__dirname, 'Alexandria Platform Enhanced UI.html'); >> simple-dev-server.js
echo   if (fs.existsSync(htmlFile)) { >> simple-dev-server.js
echo     res.sendFile(htmlFile); >> simple-dev-server.js
echo   } else { >> simple-dev-server.js
echo     res.send('^<h1^>Alexandria Platform^</h1^>^<p^>Server is running!^</p^>'); >> simple-dev-server.js
echo   } >> simple-dev-server.js
echo }); >> simple-dev-server.js
echo. >> simple-dev-server.js
echo app.listen(PORT, () =^> { >> simple-dev-server.js
echo   console.log(`Server running at http://localhost:${PORT}`); >> simple-dev-server.js
echo }); >> simple-dev-server.js

echo.
echo Starting server...
echo.

:: Try to run with node
node simple-dev-server.js

:: If that fails, try with npx
if errorlevel 1 (
    echo.
    echo Direct node failed, trying with npx...
    npx node simple-dev-server.js
)

pause
