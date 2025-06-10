# Fix node_modules installation issues
Write-Host "Fixing node_modules installation issues..." -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: package.json not found. Please run this from the Alexandria root directory." -ForegroundColor Red
    exit 1
}

# Clean up conflicting lock files
Write-Host "Cleaning up lock files..." -ForegroundColor Yellow
if (Test-Path "package-lock.json") { Remove-Item "package-lock.json" -Force }
if (Test-Path "yarn.lock") { Remove-Item "yarn.lock" -Force }

# Ensure pnpm is installed globally
Write-Host "Checking pnpm installation..." -ForegroundColor Yellow
$pnpmPath = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmPath) {
    Write-Host "Installing pnpm globally..." -ForegroundColor Yellow
    npm install -g pnpm
}

# Clean install with pnpm
Write-Host "Performing clean installation..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "Removing existing node_modules..." -ForegroundColor Yellow
    Remove-Item "node_modules" -Recurse -Force
}

Write-Host "Installing dependencies with pnpm..." -ForegroundColor Yellow
pnpm install

# Verify installation
Write-Host ""
Write-Host "Verifying installation..." -ForegroundColor Yellow
if (Test-Path "node_modules\.bin\concurrently.cmd") {
    Write-Host "SUCCESS: Dependencies installed correctly!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now run: pnpm dev" -ForegroundColor Cyan
} else {
    Write-Host "ERROR: Installation may have failed. Missing executables in node_modules\.bin" -ForegroundColor Red
    Write-Host "Try running: pnpm install --force" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")