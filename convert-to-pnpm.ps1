# PowerShell script to convert project to pnpm
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Converting Alexandria to pnpm" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if pnpm is installed
$pnpmVersion = $null
try {
    $pnpmVersion = pnpm --version 2>$null
} catch {
    # pnpm not found
}

if (-not $pnpmVersion) {
    Write-Host "pnpm is not installed. Installing pnpm globally..." -ForegroundColor Yellow
    npm install -g pnpm
    Write-Host "pnpm installed successfully!" -ForegroundColor Green
    Write-Host ""
}

# Display pnpm version
Write-Host "Using pnpm version: $(pnpm --version)" -ForegroundColor Green
Write-Host ""

# Step 1: Clean existing npm artifacts
Write-Host "Step 1: Cleaning npm artifacts..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "  Removing node_modules..." -ForegroundColor Gray
    Remove-Item -Path "node_modules" -Recurse -Force
}
if (Test-Path "package-lock.json") {
    Write-Host "  Removing package-lock.json..." -ForegroundColor Gray
    Remove-Item -Path "package-lock.json" -Force
}
Write-Host "  ✓ Cleaned!" -ForegroundColor Green
Write-Host ""

# Step 2: Create pnpm configuration
Write-Host "Step 2: Creating pnpm configuration..." -ForegroundColor Yellow
@"
# pnpm configuration for Alexandria Platform
# Fixes Windows-specific issues

# Use hoisted node_modules structure (similar to npm)
node-linker=hoisted

# Automatically install peers
auto-install-peers=true

# Use strict peer dependencies
strict-peer-dependencies=false

# Dedupe packages
dedupe-peer-dependents=true

# Allow optional dependencies to fail
optional-dependencies-optional=true

# Prefer offline installations
prefer-offline=true

# Use symlinks when possible (faster on Windows)
symlink=true

# Hoist all dependencies (compatibility mode)
public-hoist-pattern=*

# Ignore specific lifecycle scripts that cause issues
ignore-scripts=false

# Set concurrent installations
network-concurrency=16

# Ignore deprecated warnings
loglevel=error
"@ | Out-File -FilePath ".npmrc" -Encoding UTF8

Write-Host "  ✓ Created .npmrc with pnpm optimizations!" -ForegroundColor Green
Write-Host ""

# Step 3: Remove problematic packages from package.json
Write-Host "Step 3: Updating package.json..." -ForegroundColor Yellow

# Read package.json
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json

# Remove stub type packages
if ($packageJson.devDependencies."@types/express-rate-limit") {
    $packageJson.devDependencies.PSObject.Properties.Remove("@types/express-rate-limit")
    Write-Host "  ✓ Removed @types/express-rate-limit" -ForegroundColor Green
}
if ($packageJson.devDependencies."@types/testing-library__jest-dom") {
    $packageJson.devDependencies.PSObject.Properties.Remove("@types/testing-library__jest-dom")
    Write-Host "  ✓ Removed @types/testing-library__jest-dom" -ForegroundColor Green
}

# Save updated package.json
$packageJson | ConvertTo-Json -Depth 100 | Set-Content "package.json" -Encoding UTF8
Write-Host "  ✓ Updated package.json!" -ForegroundColor Green
Write-Host ""

# Step 4: Install dependencies with pnpm
Write-Host "Step 4: Installing dependencies with pnpm..." -ForegroundColor Yellow
Write-Host "  This may take a few minutes..." -ForegroundColor Gray
Write-Host ""

# Run pnpm install
pnpm install

Write-Host ""
Write-Host "  ✓ Dependencies installed!" -ForegroundColor Green
Write-Host ""

# Step 5: Create pnpm scripts
Write-Host "Step 5: Creating pnpm launcher scripts..." -ForegroundColor Yellow

# Create pnpm-dev.bat
@"
@echo off
echo Starting Alexandria with pnpm...
pnpm run dev
"@ | Out-File -FilePath "pnpm-dev.bat" -Encoding ASCII

Write-Host "  ✓ Created pnpm-dev.bat" -ForegroundColor Green

# Update Alexandria.bat to use pnpm
$alexandriaBat = Get-Content "Alexandria.bat" -Raw
$alexandriaBat = $alexandriaBat -replace "npm install", "pnpm install"
$alexandriaBat = $alexandriaBat -replace "npm run dev", "pnpm run dev"
$alexandriaBat | Set-Content "Alexandria.bat" -Encoding ASCII

Write-Host "  ✓ Updated Alexandria.bat to use pnpm" -ForegroundColor Green
Write-Host ""

# Step 6: Create pnpm workspace config (for future monorepo support)
@"
packages:
  - 'src/plugins/*'
"@ | Out-File -FilePath "pnpm-workspace.yaml" -Encoding UTF8

Write-Host "  ✓ Created pnpm-workspace.yaml" -ForegroundColor Green
Write-Host ""

# Final message
Write-Host "=====================================" -ForegroundColor Green
Write-Host "  Conversion Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now use pnpm commands:" -ForegroundColor Cyan
Write-Host "  pnpm run dev      - Start development server" -ForegroundColor White
Write-Host "  pnpm run build    - Build for production" -ForegroundColor White
Write-Host "  pnpm run test     - Run tests" -ForegroundColor White
Write-Host "  pnpm add <pkg>    - Add a dependency" -ForegroundColor White
Write-Host "  pnpm install      - Install dependencies" -ForegroundColor White
Write-Host ""
Write-Host "Or use the launcher scripts:" -ForegroundColor Cyan
Write-Host "  .\pnpm-dev.bat    - Quick dev start" -ForegroundColor White
Write-Host "  .\Alexandria.bat  - Full launcher (now uses pnpm)" -ForegroundColor White
Write-Host ""