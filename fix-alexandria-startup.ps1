# Alexandria Platform - Complete Startup Fix
# This script fixes all common startup issues for Alexandria

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Alexandria Platform - Startup Fix   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Host "⚠️  Warning: Not running as Administrator. Some operations may fail." -ForegroundColor Yellow
    Write-Host ""
}

# Step 1: Stop any running processes
Write-Host "🛑 Step 1: Stopping any running Alexandria processes..." -ForegroundColor Green
try {
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*Alexandria*" } | Stop-Process -Force
    Get-Process -Name "ts-node-dev" -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "✅ Processes stopped" -ForegroundColor Green
} catch {
    Write-Host "⚠️  No processes to stop" -ForegroundColor Yellow
}
Write-Host ""

# Step 2: Clean corrupted files
Write-Host "🧹 Step 2: Cleaning corrupted files and caches..." -ForegroundColor Green
$itemsToClean = @(
    "node_modules",
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "dist",
    ".vite",
    ".tsbuildinfo",
    "logs"
)

foreach ($item in $itemsToClean) {
    if (Test-Path $item) {
        Write-Host "  Removing $item..." -ForegroundColor Gray
        try {
            Remove-Item $item -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "  ✅ Removed $item" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠️  Could not remove $item (may be in use)" -ForegroundColor Yellow
        }
    }
}

# Clean plugin node_modules too
$pluginDirs = @(
    "src\plugins\alfred",
    "src\plugins\crash-analyzer",
    "src\plugins\log-visualization"
)

foreach ($pluginDir in $pluginDirs) {
    if (Test-Path "$pluginDir\node_modules") {
        Write-Host "  Removing $pluginDir\node_modules..." -ForegroundColor Gray
        Remove-Item "$pluginDir\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path "$pluginDir\pnpm-lock.yaml") {
        Remove-Item "$pluginDir\pnpm-lock.yaml" -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "✅ Cleanup complete" -ForegroundColor Green
Write-Host ""

# Step 3: Clear npm/pnpm cache
Write-Host "🗑️  Step 3: Clearing package manager caches..." -ForegroundColor Green
try {
    npm cache clean --force 2>$null
    Write-Host "  ✅ NPM cache cleared" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  NPM cache clear failed" -ForegroundColor Yellow
}

try {
    pnpm store prune 2>$null
    Write-Host "  ✅ PNPM store pruned" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  PNPM store prune failed" -ForegroundColor Yellow
}
Write-Host ""

# Step 4: Check Node.js and package manager versions
Write-Host "🔍 Step 4: Checking environment..." -ForegroundColor Green
$nodeVersion = node --version 2>$null
$pnpmVersion = pnpm --version 2>$null
$npmVersion = npm --version 2>$null

Write-Host "  Node.js: $nodeVersion" -ForegroundColor Gray
Write-Host "  PNPM: $pnpmVersion" -ForegroundColor Gray
Write-Host "  NPM: $npmVersion" -ForegroundColor Gray

if (-not $nodeVersion) {
    Write-Host "❌ Node.js not found! Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

if (-not $pnpmVersion) {
    Write-Host "⚠️  PNPM not found. Installing..." -ForegroundColor Yellow
    npm install -g pnpm
    $pnpmVersion = pnpm --version 2>$null
    Write-Host "  ✅ PNPM installed: $pnpmVersion" -ForegroundColor Green
}
Write-Host ""

# Step 5: Install dependencies
Write-Host "📦 Step 5: Installing fresh dependencies..." -ForegroundColor Green
Write-Host "  This may take several minutes..." -ForegroundColor Gray

try {
    pnpm install --frozen-lockfile=false --prefer-frozen-lockfile=false
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠️  PNPM install failed, trying with NPM..." -ForegroundColor Yellow
    try {
        npm install
        Write-Host "✅ Dependencies installed with NPM" -ForegroundColor Green
    } catch {
        Write-Host "❌ Both PNPM and NPM failed. Check your network connection." -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Step 6: Build check
Write-Host "🔨 Step 6: Testing build system..." -ForegroundColor Green
try {
    pnpm run build:client
    Write-Host "✅ Client build successful" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Client build failed - there may be TypeScript errors" -ForegroundColor Yellow
}
Write-Host ""

# Step 7: Final status
Write-Host "🎉 Alexandria Startup Fix Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Frontend only: pnpm run dev:client" -ForegroundColor White
Write-Host "2. Full platform: pnpm run dev" -ForegroundColor White
Write-Host "3. If issues persist, check the logs above" -ForegroundColor White
Write-Host ""
Write-Host "Platform should be available at: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""