# Alexandria Platform - Windows Dependency Manager
# Run this from Windows PowerShell to manage dependencies

Write-Host "Alexandria Platform - Windows Dependency Manager" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
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

# Main installation process
Write-Host "Step 1: Cleaning old dependencies..." -ForegroundColor Yellow
Remove-NodeModules
if (Test-Path "pnpm-lock.yaml") {
    Remove-Item "pnpm-lock.yaml" -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Step 2: Configuring pnpm for Windows..." -ForegroundColor Yellow
pnpm config set node-linker hoisted
pnpm config set enable-pre-post-scripts true

Write-Host ""
Write-Host "Step 3: Installing fresh dependencies..." -ForegroundColor Yellow
$installResult = pnpm install --force 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Initial install had issues, trying with --no-optional..." -ForegroundColor Yellow
    pnpm install --force --no-optional
}

Write-Host ""
Write-Host "Step 4: Verifying critical TypeScript types..." -ForegroundColor Yellow
$criticalTypes = @("@types/node", "@types/express", "@types/cors")
$missingTypes = @()

foreach ($type in $criticalTypes) {
    $result = pnpm list $type 2>&1
    if ($result -match "not found") {
        $missingTypes += $type
    } else {
        Write-Host "✅ $type installed" -ForegroundColor Green
    }
}

if ($missingTypes.Count -gt 0) {
    Write-Host ""
    Write-Host "Installing missing types..." -ForegroundColor Yellow
    pnpm add -D $missingTypes
}

Write-Host ""
Write-Host "✅ Dependencies installed successfully!" -ForegroundColor Green
Write-Host "You can now switch to WSL for development." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Open WSL terminal" -ForegroundColor White
Write-Host "2. cd /mnt/c/Projects/Alexandria" -ForegroundColor White
Write-Host "3. ./wsl-dev.sh" -ForegroundColor White