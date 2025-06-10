# Alexandria Platform - Quick Frontend Start
# This script starts only the frontend for testing UI components

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    Alexandria - Frontend Quick Start   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "❌ Dependencies not installed. Run fix-alexandria-startup.ps1 first." -ForegroundColor Red
    Write-Host ""
    Write-Host "Quick fix:" -ForegroundColor Yellow
    Write-Host "  .\fix-alexandria-startup.ps1" -ForegroundColor White
    exit 1
}

# Check if Vite is available
$viteCheck = Get-Command "npx" -ErrorAction SilentlyContinue
if (-not $viteCheck) {
    Write-Host "❌ NPX not found. Please ensure Node.js is properly installed." -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Starting Alexandria Frontend..." -ForegroundColor Green
Write-Host ""
Write-Host "The frontend will be available at:" -ForegroundColor Cyan
Write-Host "  http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Note: Backend services will not be available in frontend-only mode." -ForegroundColor Yellow
Write-Host "Features like Alfred AI chat will show connection errors." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

# Start the frontend
try {
    pnpm run dev:client
} catch {
    Write-Host ""
    Write-Host "❌ Frontend start failed. Trying alternative method..." -ForegroundColor Red
    try {
        npx vite
    } catch {
        Write-Host "❌ Both methods failed. Check the error above." -ForegroundColor Red
        Write-Host ""
        Write-Host "Try running:" -ForegroundColor Yellow
        Write-Host "  .\fix-alexandria-startup.ps1" -ForegroundColor White
        exit 1
    }
}