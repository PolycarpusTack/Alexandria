# Alexandria Platform - Alternative Installation using npm
# Use this if pnpm installation is problematic

Write-Host "Alexandria Platform - NPM Installation" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script uses npm instead of pnpm" -ForegroundColor Yellow
Write-Host ""

# Function to safely remove directories
function Remove-NodeModules {
    $targets = @(
        "node_modules",
        "apps\web\node_modules",
        "libs\shared\node_modules", 
        "libs\ui-components\node_modules",
        "alfred-app\node_modules"
    )
    
    foreach ($target in $targets) {
        if (Test-Path $target) {
            Write-Host "Removing $target..." -ForegroundColor Yellow
            Remove-Item -Path $target -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# Check if npm exists
try {
    $npmVersion = npm --version
    Write-Host "✅ npm found: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm not found!" -ForegroundColor Red
    Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Cyan
    pause
    exit 1
}

Write-Host ""
Write-Host "Step 1: Cleaning old dependencies..." -ForegroundColor Yellow
Remove-NodeModules
if (Test-Path "package-lock.json") {
    Remove-Item "package-lock.json" -Force -ErrorAction SilentlyContinue
}
if (Test-Path "pnpm-lock.yaml") {
    Remove-Item "pnpm-lock.yaml" -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Step 2: Installing dependencies with npm..." -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "Step 3: Installing workspaces..." -ForegroundColor Yellow
npm install --workspaces

Write-Host ""
Write-Host "Step 4: Verifying TypeScript types..." -ForegroundColor Yellow
$criticalTypes = @("@types/node", "@types/express", "@types/cors")
foreach ($type in $criticalTypes) {
    if (Test-Path "node_modules\$type") {
        Write-Host "✅ $type installed" -ForegroundColor Green
    } else {
        Write-Host "⚠️  $type missing, installing..." -ForegroundColor Yellow
        npm install --save-dev $type
    }
}

Write-Host ""
Write-Host "✅ Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Note: This project normally uses pnpm." -ForegroundColor Yellow
Write-Host "Consider installing pnpm for better compatibility:" -ForegroundColor Yellow
Write-Host "npm install -g pnpm" -ForegroundColor Cyan