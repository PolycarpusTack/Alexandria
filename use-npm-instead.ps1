# Switch to npm instead of pnpm for Alexandria
Write-Host "Switching Alexandria to use npm instead of pnpm..." -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: package.json not found. Please run this from the Alexandria root directory." -ForegroundColor Red
    exit 1
}

# Clean up pnpm files
Write-Host "Cleaning up pnpm files..." -ForegroundColor Yellow
if (Test-Path "pnpm-lock.yaml") { 
    Write-Host "Backing up pnpm-lock.yaml..." -ForegroundColor Yellow
    Copy-Item "pnpm-lock.yaml" "pnpm-lock.yaml.backup" -Force
    Remove-Item "pnpm-lock.yaml" -Force 
}
if (Test-Path "pnpm-workspace.yaml") { 
    Write-Host "Backing up pnpm-workspace.yaml..." -ForegroundColor Yellow
    Copy-Item "pnpm-workspace.yaml" "pnpm-workspace.yaml.backup" -Force
    Remove-Item "pnpm-workspace.yaml" -Force 
}
if (Test-Path ".npmrc") { 
    Write-Host "Backing up .npmrc..." -ForegroundColor Yellow
    Copy-Item ".npmrc" ".npmrc.backup" -Force
    Remove-Item ".npmrc" -Force 
}

# Remove node_modules
if (Test-Path "node_modules") {
    Write-Host "Removing existing node_modules..." -ForegroundColor Yellow
    Remove-Item "node_modules" -Recurse -Force
}

# Install with npm
Write-Host "Installing dependencies with npm..." -ForegroundColor Yellow
npm install

# Verify installation
Write-Host ""
Write-Host "Verifying installation..." -ForegroundColor Yellow
if (Test-Path "node_modules\.bin\concurrently.cmd") {
    Write-Host "SUCCESS: Dependencies installed correctly with npm!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now run: npm run dev" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Note: Alexandria is now using npm instead of pnpm" -ForegroundColor Yellow
    Write-Host "All pnpm files have been backed up with .backup extension" -ForegroundColor Yellow
} else {
    Write-Host "ERROR: Installation failed. Check npm configuration." -ForegroundColor Red
    Write-Host "Try running: npm install --verbose" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")