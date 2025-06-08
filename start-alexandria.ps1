# Alexandria Platform - Complete Startup Script
# This script starts the full Alexandria platform with all services

param(
    [switch]$FrontendOnly,
    [switch]$ServerOnly,
    [switch]$Debug
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "     Alexandria Platform Startup       " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "🔍 Checking prerequisites..." -ForegroundColor Green

# Check Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "❌ Node.js not found! Please install Node.js 18+." -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Node.js: $nodeVersion" -ForegroundColor Green

# Check PNPM
$pnpmVersion = pnpm --version 2>$null
if (-not $pnpmVersion) {
    Write-Host "❌ PNPM not found! Installing..." -ForegroundColor Red
    npm install -g pnpm
    $pnpmVersion = pnpm --version 2>$null
}
Write-Host "  ✅ PNPM: $pnpmVersion" -ForegroundColor Green

# Check dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "❌ Dependencies not installed!" -ForegroundColor Red
    Write-Host "  Run: .\fix-alexandria-startup.ps1" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✅ Dependencies installed" -ForegroundColor Green

# Check for Ollama (for AI features)
$ollamaRunning = $false
try {
    $ollamaTest = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -Method GET -TimeoutSec 2 2>$null
    $ollamaRunning = $true
    Write-Host "  ✅ Ollama service detected" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  Ollama not running (AI features disabled)" -ForegroundColor Yellow
}

# Check for PostgreSQL (for data persistence)
$pgRunning = $false
try {
    # Try to connect to PostgreSQL on port 5433
    $pgTest = Test-NetConnection -ComputerName "localhost" -Port 5433 -WarningAction SilentlyContinue 2>$null
    if ($pgTest.TcpTestSucceeded) {
        $pgRunning = $true
        Write-Host "  ✅ PostgreSQL detected on port 5433" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  PostgreSQL not running on 5433 (using in-memory storage)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  PostgreSQL check failed (using in-memory storage)" -ForegroundColor Yellow
}

Write-Host ""

# Set environment variables
$env:NODE_ENV = "development"
$env:LOG_LEVEL = if ($Debug) { "debug" } else { "info" }

# Display startup information
Write-Host "🚀 Starting Alexandria Platform..." -ForegroundColor Green
Write-Host ""

if ($FrontendOnly) {
    Write-Host "Mode: Frontend Only" -ForegroundColor Cyan
    Write-Host "URL: http://localhost:3000" -ForegroundColor White
    Write-Host "Note: Backend services will not be available" -ForegroundColor Yellow
    Write-Host ""
    
    try {
        pnpm run dev:client
    } catch {
        Write-Host "❌ Frontend startup failed" -ForegroundColor Red
        exit 1
    }
}
elseif ($ServerOnly) {
    Write-Host "Mode: Server Only" -ForegroundColor Cyan
    Write-Host "API: http://localhost:4000" -ForegroundColor White
    Write-Host ""
    
    try {
        pnpm run dev:server
    } catch {
        Write-Host "❌ Server startup failed" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "Mode: Full Platform" -ForegroundColor Cyan
    Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
    Write-Host "API: http://localhost:4000" -ForegroundColor White
    Write-Host ""
    
    if (-not $ollamaRunning) {
        Write-Host "💡 To enable AI features, start Ollama:" -ForegroundColor Cyan
        Write-Host "   ollama serve" -ForegroundColor White
        Write-Host ""
    }
    
    if (-not $pgRunning) {
        Write-Host "💡 To enable data persistence, start PostgreSQL on port 5433" -ForegroundColor Cyan
        Write-Host ""
    }
    
    Write-Host "Starting both frontend and backend..." -ForegroundColor Gray
    Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Gray
    Write-Host ""
    
    try {
        pnpm run dev
    } catch {
        Write-Host ""
        Write-Host "❌ Platform startup failed" -ForegroundColor Red
        Write-Host ""
        Write-Host "Try troubleshooting steps:" -ForegroundColor Yellow
        Write-Host "1. .\fix-alexandria-startup.ps1" -ForegroundColor White
        Write-Host "2. .\fix-typescript-errors.ps1" -ForegroundColor White
        Write-Host "3. Check logs above for specific errors" -ForegroundColor White
        exit 1
    }
}

# This point is reached when the user stops the server
Write-Host ""
Write-Host "🛑 Alexandria Platform stopped" -ForegroundColor Yellow