# Alexandria Platform - Windows Setup with pnpm Installation
# This script ensures pnpm is installed on Windows before managing dependencies

Write-Host "Alexandria Platform - Windows Setup" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if a command exists
function Test-Command {
    param($Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Step 1: Check for Node.js
Write-Host "Checking for Node.js..." -ForegroundColor Yellow
if (Test-Command "node") {
    $nodeVersion = node --version
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Cyan
    Write-Host "Download the Windows installer and run it." -ForegroundColor White
    Write-Host ""
    Write-Host "After installing Node.js, close this PowerShell window and run this script again." -ForegroundColor Yellow
    pause
    exit 1
}

# Step 2: Check for pnpm
Write-Host ""
Write-Host "Checking for pnpm..." -ForegroundColor Yellow
if (Test-Command "pnpm") {
    $pnpmVersion = pnpm --version
    Write-Host "✅ pnpm found: v$pnpmVersion" -ForegroundColor Green
} else {
    Write-Host "⚠️  pnpm not found. Installing pnpm..." -ForegroundColor Yellow
    Write-Host ""
    
    # Install pnpm using npm (which comes with Node.js)
    Write-Host "Installing pnpm globally via npm..." -ForegroundColor Cyan
    npm install -g pnpm
    
    # Verify installation
    if (Test-Command "pnpm") {
        $pnpmVersion = pnpm --version
        Write-Host "✅ pnpm installed successfully: v$pnpmVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to install pnpm" -ForegroundColor Red
        Write-Host ""
        Write-Host "Try installing manually with:" -ForegroundColor Yellow
        Write-Host "npm install -g pnpm" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "If that fails, you may need to:" -ForegroundColor Yellow
        Write-Host "1. Run PowerShell as Administrator" -ForegroundColor White
        Write-Host "2. Or use the standalone installer from: https://pnpm.io/installation" -ForegroundColor White
        pause
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Prerequisites verified!" -ForegroundColor Green
Write-Host ""
Write-Host "Now running the main installation script..." -ForegroundColor Cyan
Write-Host ""

# Run the main installation
& "$PSScriptRoot\win-install.ps1"