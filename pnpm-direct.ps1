# Alexandria Platform - Direct pnpm Run
# This bypasses PATH issues by using the full pnpm path

Write-Host "Alexandria Platform - Direct Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Common location where npm installs global packages on Windows
$pnpmPath = "$env:APPDATA\npm\pnpm.cmd"

Write-Host "Looking for pnpm at: $pnpmPath" -ForegroundColor Yellow

if (Test-Path $pnpmPath) {
    Write-Host "✅ Found pnpm!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Cleaning old dependencies..." -ForegroundColor Yellow
    
    # Clean up
    if (Test-Path "node_modules") {
        Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path "pnpm-lock.yaml") {
        Remove-Item "pnpm-lock.yaml" -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    Write-Host ""
    
    # Run pnpm using full path
    & $pnpmPath install --force
    
    Write-Host ""
    Write-Host "✅ Installation complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Open WSL terminal" -ForegroundColor White
    Write-Host "2. cd /mnt/c/Projects/Alexandria" -ForegroundColor White
    Write-Host "3. ./wsl-dev.sh" -ForegroundColor White
} else {
    Write-Host "❌ pnpm not found at expected location" -ForegroundColor Red
    Write-Host ""
    Write-Host "Checking if pnpm was just installed..." -ForegroundColor Yellow
    
    # Check if npm exists and show where it installs global packages
    try {
        $npmPrefix = npm config get prefix
        Write-Host "npm global packages location: $npmPrefix" -ForegroundColor Cyan
        
        $altPnpmPath = "$npmPrefix\pnpm.cmd"
        if (Test-Path $altPnpmPath) {
            Write-Host "✅ Found pnpm at: $altPnpmPath" -ForegroundColor Green
            Write-Host "Running installation..." -ForegroundColor Yellow
            & $altPnpmPath install --force
        } else {
            Write-Host ""
            Write-Host "Could not find pnpm. Try:" -ForegroundColor Yellow
            Write-Host "1. Close this PowerShell window" -ForegroundColor White
            Write-Host "2. Open a new PowerShell window" -ForegroundColor White
            Write-Host "3. Run: pnpm --version" -ForegroundColor White
            Write-Host ""
            Write-Host "If that works, run: .\win-install.ps1" -ForegroundColor Cyan
            Write-Host "If not, run: .\npm-install.ps1" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "npm command failed" -ForegroundColor Red
    }
}

Write-Host ""
pause