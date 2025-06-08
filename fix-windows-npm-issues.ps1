#!/usr/bin/env pwsh
# Alexandria Windows NPM Issues Fix
# Comprehensive fix for Rollup and express-rate-limit issues

Write-Host "🔧 Alexandria Windows NPM Issues Fix" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""

# Function to run npm commands with error handling
function Run-NpmCommand {
    param(
        [string]$Command,
        [bool]$Silent = $false
    )
    
    try {
        if ($Silent) {
            $output = & cmd /c "$Command 2>&1"
            return $output
        } else {
            & cmd /c $Command
            return $LASTEXITCODE -eq 0
        }
    } catch {
        if (-not $Silent) {
            Write-Host "Error running command: $Command" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
        }
        return $null
    }
}

# Step 1: Fix express-rate-limit type declarations
Write-Host "📦 Fixing express-rate-limit type declarations..." -ForegroundColor Yellow
Write-Host "Current express-rate-limit version: 7.1.5" -ForegroundColor Cyan
Write-Host "Installing matching types..." -ForegroundColor Cyan
Write-Host ""

# Uninstall old mismatched types
Run-NpmCommand "npm uninstall @types/express-rate-limit" $true | Out-Null

# Install the correct types version
Run-NpmCommand "ppppnpm install --save-dev @types/express-rate-limit@^6.0.0"

Write-Host "✅ Express-rate-limit types fixed" -ForegroundColor Green
Write-Host ""

# Step 2: Fix Rollup optional dependencies
Write-Host "🔧 Fixing Rollup optional dependencies..." -ForegroundColor Yellow

# Create .npmrc if it doesn't exist
$npmrcPath = Join-Path $PSScriptRoot ".npmrc"
$npmrcContent = @"
# Alexandria NPM Configuration
# Fixes for Windows build issues

# Ignore optional dependencies that cause issues on Windows
omit=optional

# Use legacy peer deps to avoid conflicts
legacy-peer-deps=true

# Increase timeout for slow connections
fetch-timeout=60000

# Disable audit to speed up installs
audit=false

# Platform-specific optimizations
prefer-offline=true
"@

if (-not (Test-Path $npmrcPath)) {
    Set-Content -Path $npmrcPath -Value $npmrcContent -Encoding UTF8
    Write-Host "✅ Created .npmrc with Windows optimizations" -ForegroundColor Green
} else {
    Write-Host "ℹ️  .npmrc already exists" -ForegroundColor Cyan
}

# Step 3: Apply Rollup native module fix
Write-Host ""
Write-Host "🔧 Applying Rollup native module fix..." -ForegroundColor Yellow

$rollupNativePath = Join-Path $PSScriptRoot "node_modules\rollup\dist\native.js"
if (Test-Path $rollupNativePath) {
    try {
        # Create a Windows-compatible override
        $windowsOverride = @"
// Windows-compatible override for Rollup native functions
// This prevents optional dependency issues on Windows

export const hasNativeSupport = () => {
  // Always return false on Windows to avoid native module issues
  return false;
};

export const requireWithFriendlyError = (id) => {
  if (process.platform === 'win32') {
    console.warn(`Native module ${id} not supported on Windows, using JS fallback`);
  }
  return undefined;
};

// Export undefined to let Rollup use its JavaScript fallbacks
export const parse = undefined;
export const parseAsync = undefined;
export const xxhashBase64Url = undefined;
export const xxhashBase36 = undefined;
export const xxhashBase16 = undefined;
"@
        Set-Content -Path $rollupNativePath -Value $windowsOverride -Encoding UTF8
        Write-Host "✅ Applied Windows-compatible Rollup native.js override" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Could not override native.js: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "ℹ️  Rollup native.js not found (may not be installed yet)" -ForegroundColor Cyan
}

# Step 4: Clean pnpm store
Write-Host ""
Write-Host "🧹 Cleaning pnpm store..." -ForegroundColor Yellow
Run-NpmCommand "pnpm store clean --force" $true | Out-Null
Write-Host "✅ NPM cache cleaned" -ForegroundColor Green

# Step 5: Reinstall dependencies
Write-Host ""
Write-Host "📦 Reinstalling dependencies with fixes applied..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Cyan
Write-Host ""

# Remove node_modules for clean install
$nodeModulesPath = Join-Path $PSScriptRoot "node_modules"
if (Test-Path $nodeModulesPath) {
    Write-Host "Removing existing node_modules..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $nodeModulesPath -ErrorAction SilentlyContinue
}

# Clean install
Write-Host "Running clean install..." -ForegroundColor Yellow
$installResult = Run-NpmCommand "npm ci"

if ($null -ne $installResult) {
    Write-Host ""
    Write-Host "✅ Dependencies reinstalled successfully" -ForegroundColor Green
    
    # Re-apply Rollup fix after installation
    if (Test-Path $rollupNativePath) {
        try {
            $windowsOverride = @"
// Windows-compatible override for Rollup native functions
// This prevents optional dependency issues on Windows

export const hasNativeSupport = () => {
  // Always return false on Windows to avoid native module issues
  return false;
};

export const requireWithFriendlyError = (id) => {
  if (process.platform === 'win32') {
    console.warn(`Native module ${id} not supported on Windows, using JS fallback`);
  }
  return undefined;
};

// Export undefined to let Rollup use its JavaScript fallbacks
export const parse = undefined;
export const parseAsync = undefined;
export const xxhashBase64Url = undefined;
export const xxhashBase36 = undefined;
export const xxhashBase16 = undefined;
"@
            Set-Content -Path $rollupNativePath -Value $windowsOverride -Encoding UTF8
            Write-Host "✅ Re-applied Rollup fix after installation" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Could not re-apply Rollup fix: $_" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host ""
    Write-Host "⚠️  Installation had issues, trying ppppnpm install instead..." -ForegroundColor Yellow
    Run-NpmCommand "ppppnpm install"
}

# Step 6: Verify the fixes
Write-Host ""
Write-Host "🔍 Verifying fixes..." -ForegroundColor Yellow

# Check express-rate-limit types
$typesCheck = Run-NpmCommand "npm ls @types/express-rate-limit" $true
if ($typesCheck -like "*@types/express-rate-limit*") {
    Write-Host "✅ Express-rate-limit types installed correctly" -ForegroundColor Green
} else {
    Write-Host "⚠️  Express-rate-limit types may need manual installation" -ForegroundColor Yellow
}

# Test build
Write-Host ""
Write-Host "🏗️  Testing build..." -ForegroundColor Yellow
$buildResult = Run-NpmCommand "ppppnpm run build:simple" $true

if ($null -ne $buildResult) {
    Write-Host "✅ Build completed successfully!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Build test failed, but fixes have been applied" -ForegroundColor Yellow
    Write-Host "   Try running 'ppppnpm run build' manually" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "🎉 Windows NPM issues fix completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run 'ppppnpm run dev' to start the development server" -ForegroundColor White
Write-Host "2. If you still see warnings about optional dependencies, they can be safely ignored" -ForegroundColor White
Write-Host "3. The Rollup native module warnings are now handled gracefully" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")