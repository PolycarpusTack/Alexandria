# Alexandria - Fix Missing Dependencies

Write-Host "Alexandria Platform - Dependency Fix" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Check current directory
if (-not (Test-Path "package.json")) {
    Write-Host "Error: Not in Alexandria directory!" -ForegroundColor Red
    exit 1
}

Write-Host "Installing missing dependencies..." -ForegroundColor Yellow
Write-Host ""

# Install specific missing packages first
Write-Host "Installing vite..." -ForegroundColor Cyan
pnpm add -D vite

Write-Host ""
Write-Host "Installing ts-node-dev..." -ForegroundColor Cyan
pnpm add -D ts-node-dev

Write-Host ""
Write-Host "Installing other essential dev dependencies..." -ForegroundColor Cyan
pnpm add -D @vitejs/plugin-react ts-node typescript @types/node @types/express

Write-Host ""
Write-Host "Running full install to ensure all dependencies..." -ForegroundColor Yellow
pnpm install

Write-Host ""
Write-Host "✅ Dependencies fixed!" -ForegroundColor Green
Write-Host ""
Write-Host "Starting Alexandria..." -ForegroundColor Cyan
pnpm dev