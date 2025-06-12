# Alexandria - Complete Dependency Fix
# This handles partial installations

Write-Host "Alexandria Platform - Complete Fix" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Ensure we're in the right directory
Set-Location "C:\Projects\Alexandria"

Write-Host "Found partial installation - fixing..." -ForegroundColor Yellow
Write-Host ""

# Step 1: Clean pnpm cache and store
Write-Host "Step 1: Cleaning pnpm cache..." -ForegroundColor Yellow
pnpm store prune

# Step 2: Remove node_modules completely
Write-Host ""
Write-Host "Step 2: Removing corrupted node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
}

# Step 3: Remove lock file to force fresh resolution
Write-Host ""
Write-Host "Step 3: Removing lock file..." -ForegroundColor Yellow
if (Test-Path "pnpm-lock.yaml") {
    Remove-Item "pnpm-lock.yaml" -Force
}

# Step 4: Fresh install with verification
Write-Host ""
Write-Host "Step 4: Fresh installation..." -ForegroundColor Yellow
pnpm install --force

# Step 5: Verify critical packages
Write-Host ""
Write-Host "Step 5: Verifying installation..." -ForegroundColor Yellow

$critical = @("vite", "ts-node-dev", "typescript", "@vitejs/plugin-react")
$missing = @()

foreach ($pkg in $critical) {
    $pkgPath = "node_modules\$pkg\package.json"
    if (Test-Path $pkgPath) {
        Write-Host "✅ $pkg installed" -ForegroundColor Green
    } else {
        Write-Host "❌ $pkg missing" -ForegroundColor Red
        $missing += $pkg
    }
}

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "Installing missing packages individually..." -ForegroundColor Yellow
    foreach ($pkg in $missing) {
        pnpm add -D $pkg
    }
}

Write-Host ""
Write-Host "✅ Fix complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Starting Alexandria..." -ForegroundColor Cyan
Write-Host ""

# Start the dev server
pnpm dev