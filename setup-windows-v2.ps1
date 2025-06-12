# Alexandria Platform - Windows Setup with Path Refresh
# This script handles the PATH refresh issue after pnpm installation

Write-Host "Alexandria Platform - Windows Setup" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Function to refresh PATH in current session
function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Function to find pnpm in common locations
function Find-Pnpm {
    $possiblePaths = @(
        "$env:APPDATA\npm\pnpm.cmd",
        "$env:APPDATA\npm\pnpm.ps1",
        "$env:ProgramFiles\nodejs\pnpm.cmd",
        "$env:ProgramFiles\nodejs\pnpm.ps1",
        "C:\Users\$env:USERNAME\AppData\Roaming\npm\pnpm.cmd"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            return $path
        }
    }
    return $null
}

# Check for Node.js
Write-Host "Checking for Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found!" -ForegroundColor Red
    Write-Host "Please install from: https://nodejs.org/" -ForegroundColor Cyan
    pause
    exit 1
}

# Check for pnpm
Write-Host ""
Write-Host "Checking for pnpm..." -ForegroundColor Yellow

# First, try direct command
$pnpmInstalled = $false
try {
    $pnpmVersion = pnpm --version 2>$null
    if ($pnpmVersion) {
        Write-Host "✅ pnpm found: v$pnpmVersion" -ForegroundColor Green
        $pnpmInstalled = $true
    }
} catch {}

# If not found, try to find it manually
if (-not $pnpmInstalled) {
    $pnpmPath = Find-Pnpm
    if ($pnpmPath) {
        Write-Host "✅ pnpm found at: $pnpmPath" -ForegroundColor Green
        Write-Host "Refreshing PATH..." -ForegroundColor Yellow
        Refresh-Path
        $pnpmInstalled = $true
    }
}

# If still not found, install it
if (-not $pnpmInstalled) {
    Write-Host "⚠️  pnpm not found. Installing..." -ForegroundColor Yellow
    
    # Install pnpm
    npm install -g pnpm
    
    # Refresh PATH
    Write-Host "Refreshing PATH..." -ForegroundColor Yellow
    Refresh-Path
    
    # Try to find pnpm again
    $pnpmPath = Find-Pnpm
    if ($pnpmPath) {
        Write-Host "✅ pnpm installed at: $pnpmPath" -ForegroundColor Green
        $pnpmInstalled = $true
    }
}

# Final check and provide options
if ($pnpmInstalled) {
    Write-Host ""
    Write-Host "✅ Setup verified! Running installation..." -ForegroundColor Green
    Write-Host ""
    
    # Try to run pnpm directly first
    try {
        pnpm install --force
    } catch {
        # If that fails, try with the found path
        $pnpmPath = Find-Pnpm
        if ($pnpmPath) {
            Write-Host "Using pnpm from: $pnpmPath" -ForegroundColor Yellow
            & $pnpmPath install --force
        }
    }
    
    Write-Host ""
    Write-Host "✅ Installation complete!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️  Could not verify pnpm installation" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please try ONE of these options:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Option 1: Close and reopen PowerShell, then run:" -ForegroundColor Yellow
    Write-Host "  cd C:\Projects\Alexandria" -ForegroundColor White
    Write-Host "  .\win-install.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 2: Use npm instead:" -ForegroundColor Yellow
    Write-Host "  .\npm-install.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 3: Install pnpm standalone from:" -ForegroundColor Yellow
    Write-Host "  https://pnpm.io/installation#using-a-standalone-script" -ForegroundColor White
}

Write-Host ""
pause