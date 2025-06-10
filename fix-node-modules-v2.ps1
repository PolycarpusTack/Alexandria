# Fix node_modules installation issues - Version 2
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

# Install pnpm globally with proper path refresh
Write-Host "Installing pnpm globally..." -ForegroundColor Yellow
npm install -g pnpm

# Refresh environment variables to pick up pnpm
Write-Host "Refreshing environment variables..." -ForegroundColor Yellow
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Verify pnpm installation
Write-Host "Verifying pnpm installation..." -ForegroundColor Yellow
try {
    $pnpmVersion = & pnpm --version 2>$null
    Write-Host "pnpm version: $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "pnpm still not found. Trying alternative installation..." -ForegroundColor Red
    
    # Alternative: Use npm instead
    Write-Host "Falling back to npm installation..." -ForegroundColor Yellow
    
    # Clean install with npm
    if (Test-Path "node_modules") {
        Write-Host "Removing existing node_modules..." -ForegroundColor Yellow
        Remove-Item "node_modules" -Recurse -Force
    }
    
    # Remove pnpm-specific files
    if (Test-Path "pnpm-lock.yaml") { Remove-Item "pnpm-lock.yaml" -Force }
    if (Test-Path ".npmrc") { 
        Write-Host "Backing up .npmrc to .npmrc.backup..." -ForegroundColor Yellow
        Copy-Item ".npmrc" ".npmrc.backup" -Force
        Remove-Item ".npmrc" -Force
    }
    
    Write-Host "Installing dependencies with npm..." -ForegroundColor Yellow
    npm install
    
    # Verify npm installation
    if (Test-Path "node_modules\.bin\concurrently.cmd") {
        Write-Host "SUCCESS: Dependencies installed correctly with npm!" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now run: npm run dev" -ForegroundColor Cyan
        Write-Host "Note: Using npm instead of pnpm due to installation issues" -ForegroundColor Yellow
    } else {
        Write-Host "ERROR: Installation failed with both pnpm and npm" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Press any key to continue..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit
}

# Clean install with pnpm
Write-Host "Performing clean installation with pnpm..." -ForegroundColor Yellow
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