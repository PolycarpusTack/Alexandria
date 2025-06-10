# Quick fix for Windows npm issues
Write-Host "Fixing Windows NPM issues..." -ForegroundColor Green

# Fix 1: Install the correct express-rate-limit types
Write-Host "`nInstalling express-rate-limit types..." -ForegroundColor Yellow
npm install --save-dev @types/express-rate-limit@6.0.0

# Fix 2: Force install the Rollup Windows binary
Write-Host "`nForcing Rollup Windows binary installation..." -ForegroundColor Yellow
npm install --force @rollup/rollup-win32-x64-msvc

# Fix 3: Clean install with proper settings
Write-Host "`nCleaning and reinstalling..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Path "node_modules" -Recurse -Force
}
if (Test-Path "package-lock.json") {
    Remove-Item -Path "package-lock.json" -Force
}

# Set npm config for Windows
npm config set fund false
npm config set audit false
npm config set update-notifier false

# Install with legacy peer deps to avoid conflicts
npm install --legacy-peer-deps

Write-Host "`nFixes applied! Try running 'npm run dev' again." -ForegroundColor Green