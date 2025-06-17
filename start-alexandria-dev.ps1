# Alexandria Platform Development Startup Script for Windows
# Run this with: powershell -ExecutionPolicy Bypass -File start-alexandria-dev.ps1

Write-Host "`n🚀 Alexandria Platform - Development Environment Setup" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "⚠️  Not running as administrator. Some operations may fail." -ForegroundColor Yellow
    Write-Host "💡 For best results, run PowerShell as Administrator`n" -ForegroundColor Yellow
}

# Set working directory
$projectPath = "C:\Projects\Alexandria"
Set-Location $projectPath
Write-Host "📁 Working directory: $projectPath`n" -ForegroundColor Green

# Function to fix permissions
function Fix-NodeModulesPermissions {
    Write-Host "🔧 Attempting to fix node_modules permissions..." -ForegroundColor Yellow
    try {
        # Take ownership of node_modules
        takeown /f "node_modules" /r /d y 2>&1 | Out-Null
        # Grant full permissions
        icacls "node_modules" /grant "${env:USERNAME}:F" /t /q 2>&1 | Out-Null
        Write-Host "✅ Permissions fixed!`n" -ForegroundColor Green
    } catch {
        Write-Host "❌ Could not fix permissions automatically`n" -ForegroundColor Red
    }
}

# Check if node_modules exists and is accessible
if (Test-Path "node_modules") {
    try {
        Get-ChildItem "node_modules" -ErrorAction Stop | Out-Null
        Write-Host "✅ node_modules is accessible`n" -ForegroundColor Green
    } catch {
        Write-Host "❌ node_modules exists but is not accessible" -ForegroundColor Red
        Fix-NodeModulesPermissions
    }
} else {
    Write-Host "❌ node_modules not found!" -ForegroundColor Red
    Write-Host "📦 Installing dependencies with pnpm...`n" -ForegroundColor Yellow
    
    # Try to install dependencies
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm install --no-frozen-lockfile
    } else {
        Write-Host "❌ pnpm not found! Please install it first:" -ForegroundColor Red
        Write-Host "   npm install -g pnpm`n" -ForegroundColor Yellow
        exit 1
    }
}

# Create a simple development server
Write-Host "📝 Creating development server..." -ForegroundColor Yellow

$serverCode = @'
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

console.log('\n🚀 Alexandria Platform Server Starting...\n');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'src', 'client', 'assets')));

// API Routes
app.get('/api/health', (req, res) => {
    res.json({
        status: 'operational',
        message: 'Alexandria Platform is running',
        version: '0.1.0',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/plugins', (req, res) => {
    res.json({
        plugins: [
            {
                id: 'alfred',
                name: 'ALFRED',
                description: 'AI-powered coding assistant',
                status: 'active',
                version: '2.0.0'
            },
            {
                id: 'hadron',
                name: 'Crash Analyzer',
                description: 'AI-powered crash log analysis',
                status: 'active',
                version: '1.0.0'
            },
            {
                id: 'heimdall',
                name: 'Heimdall',
                description: 'Log visualization platform',
                status: 'inactive',
                version: '1.0.0'
            }
        ]
    });
});

app.get('/api/ai-models', (req, res) => {
    res.json({
        models: [
            { id: 'openai-gpt4', name: 'GPT-4', status: 'available' },
            { id: 'claude-3', name: 'Claude 3', status: 'available' },
            { id: 'llama2', name: 'Llama 2', status: 'available' },
            { id: 'codellama', name: 'Code Llama', status: 'available' }
        ]
    });
});

// Serve the Alexandria Platform HTML
app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, 'Alexandria Platform Enhanced UI.html');
    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Alexandria Platform</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; background: #0d0d0d; color: #e5e5e5; }
                    h1 { color: #3b82f6; }
                    .status { background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    a { color: #3b82f6; text-decoration: none; }
                    a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <h1>Alexandria Platform</h1>
                <div class="status">
                    <h2>✅ Server is running!</h2>
                    <p>API Endpoints:</p>
                    <ul>
                        <li><a href="/api/health">/api/health</a> - Health check</li>
                        <li><a href="/api/plugins">/api/plugins</a> - List plugins</li>
                        <li><a href="/api/ai-models">/api/ai-models</a> - List AI models</li>
                    </ul>
                </div>
            </body>
            </html>
        `);
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server is running at http://localhost:${PORT}`);
    console.log(`📡 API Health: http://localhost:${PORT}/api/health`);
    console.log(`🔌 Plugins: http://localhost:${PORT}/api/plugins`);
    console.log('\n💡 Press Ctrl+C to stop the server\n');
});
'@

# Save the server file
$serverCode | Out-File -FilePath "simple-server.js" -Encoding UTF8

Write-Host "✅ Development server created`n" -ForegroundColor Green

# Try to start the server
Write-Host "🚀 Starting Alexandria Platform..." -ForegroundColor Cyan

# Check if we can use the Alexandria Platform HTML
if (Test-Path "Alexandria Platform Enhanced UI.html") {
    Write-Host "✅ Found Alexandria Platform Enhanced UI" -ForegroundColor Green
    Write-Host "🌐 UI will be served from http://localhost:4000`n" -ForegroundColor Green
}

# Start the server
try {
    node simple-server.js
} catch {
    Write-Host "`n❌ Failed to start with Node.js" -ForegroundColor Red
    Write-Host "Trying alternative approaches...`n" -ForegroundColor Yellow
    
    # Try with npx
    npx nodemon simple-server.js 2>$null || node simple-server.js
}
