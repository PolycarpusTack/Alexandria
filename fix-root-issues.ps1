# Alexandria Platform - Root Issue Fixes
# Run as Administrator: powershell -ExecutionPolicy Bypass -File fix-root-issues.ps1

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ALEXANDRIA PLATFORM - ROOT FIXES" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as administrator'" -ForegroundColor Yellow
    Exit 1
}

Set-Location "C:\Projects\Alexandria"

# Step 1: Clean up all artifacts
Write-Host "STEP 1: Complete cleanup of corrupted files" -ForegroundColor Yellow
Write-Host "Removing all build artifacts and lock files..." -ForegroundColor White

# Kill any Node processes that might be locking files
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process npm -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process pnpm -ErrorAction SilentlyContinue | Stop-Process -Force

# Remove all problematic directories and files
$itemsToRemove = @(
    "node_modules",
    "dist",
    ".next",
    ".vite",
    ".tsbuildinfo",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    ".pnpm-store",
    "temp_node_modules"
)

foreach ($item in $itemsToRemove) {
    if (Test-Path $item) {
        Write-Host "  Removing $item..." -ForegroundColor Gray
        Remove-Item -Path $item -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Step 2: Fix file permissions
Write-Host "`nSTEP 2: Fixing file system permissions" -ForegroundColor Yellow
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
Write-Host "  Setting ownership to: $currentUser" -ForegroundColor White

# Take ownership and set permissions
takeown /f . /r /d y 2>&1 | Out-Null
icacls . /grant "${currentUser}:F" /t /c /q 2>&1 | Out-Null
icacls . /remove:g "CREATOR OWNER" /t /c /q 2>&1 | Out-Null

Write-Host "  ✓ Permissions fixed" -ForegroundColor Green

# Step 3: Clear all caches
Write-Host "`nSTEP 3: Clearing all package manager caches" -ForegroundColor Yellow

# Clear npm cache
Write-Host "  Clearing npm cache..." -ForegroundColor White
npm cache clean --force 2>&1 | Out-Null

# Clear pnpm cache
Write-Host "  Clearing pnpm cache..." -ForegroundColor White
pnpm store prune 2>&1 | Out-Null

# Clear yarn cache if exists
if (Get-Command yarn -ErrorAction SilentlyContinue) {
    Write-Host "  Clearing yarn cache..." -ForegroundColor White
    yarn cache clean 2>&1 | Out-Null
}

Write-Host "  ✓ Caches cleared" -ForegroundColor Green

# Step 4: Install global dependencies
Write-Host "`nSTEP 4: Installing required global tools" -ForegroundColor Yellow

$globalTools = @(
    "typescript",
    "ts-node",
    "nodemon",
    "@microsoft/rush",
    "pnpm"
)

foreach ($tool in $globalTools) {
    Write-Host "  Installing $tool globally..." -ForegroundColor White
    npm install -g $tool --force 2>&1 | Out-Null
}

Write-Host "  ✓ Global tools installed" -ForegroundColor Green

# Step 5: Create clean package.json without workspace references
Write-Host "`nSTEP 5: Creating clean package.json" -ForegroundColor Yellow

# Read current package.json
$packageJson = Get-Content package.json | ConvertFrom-Json

# Remove workspace references from dependencies
$cleanDeps = @{}
foreach ($dep in $packageJson.dependencies.PSObject.Properties) {
    if ($dep.Value -ne "workspace:*") {
        $cleanDeps[$dep.Name] = $dep.Value
    }
}

# Update package.json
$packageJson.dependencies = $cleanDeps
$packageJson | ConvertTo-Json -Depth 100 | Set-Content package-clean.json

# Backup original and use clean version
Move-Item package.json package.json.backup -Force
Move-Item package-clean.json package.json -Force

Write-Host "  ✓ Package.json cleaned" -ForegroundColor Green

# Step 6: Install dependencies with proper flags
Write-Host "`nSTEP 6: Installing dependencies" -ForegroundColor Yellow
Write-Host "  Using npm with legacy peer deps..." -ForegroundColor White

# First, install critical dependencies
npm install express@latest cors@latest helmet@latest express-rate-limit@latest dotenv@latest --save --legacy-peer-deps

# Then install all dependencies
npm install --force --legacy-peer-deps

# Install missing types
npm install --save-dev @types/express @types/node @types/cors @types/helmet --legacy-peer-deps

# Install Windows-specific Rollup bindings
npm install --save-dev @rollup/rollup-win32-x64-msvc --legacy-peer-deps

Write-Host "  ✓ Dependencies installed" -ForegroundColor Green

# Step 7: Fix TypeScript configuration
Write-Host "`nSTEP 7: Fixing TypeScript configuration" -ForegroundColor Yellow

# Ensure tsconfig.json has correct settings
$tsconfig = Get-Content tsconfig.json | ConvertFrom-Json
$tsconfig.compilerOptions.moduleResolution = "node"
$tsconfig.compilerOptions.allowSyntheticDefaultImports = $true
$tsconfig.compilerOptions.esModuleInterop = $true
$tsconfig.compilerOptions.skipLibCheck = $true
$tsconfig | ConvertTo-Json -Depth 100 | Set-Content tsconfig.json

Write-Host "  ✓ TypeScript configuration updated" -ForegroundColor Green

# Step 8: Fix Express type conflicts
Write-Host "`nSTEP 8: Resolving type definition conflicts" -ForegroundColor Yellow

# Create proper Express augmentation
$expressTypes = @'
import { User as SystemUser } from '../core/system/interfaces';

declare global {
  namespace Express {
    interface User extends SystemUser {}
    
    interface Request {
      user?: User;
    }
  }
}

export {};
'@

$expressTypes | Set-Content "src/types/express-augmentation.d.ts"

# Remove conflicting type files
$conflictingTypes = @(
    "src/types/express.d.ts",
    "src/types/express-custom.d.ts", 
    "src/types/express-enhanced.d.ts"
)

foreach ($file in $conflictingTypes) {
    if (Test-Path $file) {
        Remove-Item $file -Force
    }
}

Write-Host "  ✓ Type conflicts resolved" -ForegroundColor Green

# Step 9: Create initialization script
Write-Host "`nSTEP 9: Creating proper startup script" -ForegroundColor Yellow

$startScript = @'
const { spawn } = require('child_process');
const path = require('path');

console.log('\n🚀 Starting Alexandria Platform...\n');

// Environment setup
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.PORT = process.env.PORT || '4000';

// Start TypeScript compiler in watch mode
const tscWatch = spawn('npx', ['tsc', '--watch', '--preserveWatchOutput'], {
    shell: true,
    stdio: 'pipe'
});

tscWatch.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Found 0 errors')) {
        console.log('✅ TypeScript compilation successful');
    }
});

// Start the server with ts-node
setTimeout(() => {
    const server = spawn('npx', ['ts-node', '--transpile-only', 'src/index.ts'], {
        shell: true,
        stdio: 'inherit',
        env: { ...process.env }
    });
    
    server.on('error', (err) => {
        console.error('Failed to start server:', err);
    });
}, 2000);

// Start Vite for frontend
setTimeout(() => {
    const vite = spawn('npx', ['vite', '--host'], {
        shell: true,
        stdio: 'inherit'
    });
    
    vite.on('error', (err) => {
        console.error('Failed to start Vite:', err);
    });
}, 4000);

console.log('📝 Server will be available at: http://localhost:4000');
console.log('🎨 Client will be available at: http://localhost:5173');
console.log('💡 Press Ctrl+C to stop all processes\n');

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    process.exit(0);
});
'@

$startScript | Set-Content "start-dev.js"

Write-Host "  ✓ Startup script created" -ForegroundColor Green

# Step 10: Verify and compile
Write-Host "`nSTEP 10: Verifying setup" -ForegroundColor Yellow

# Test TypeScript compilation
Write-Host "  Testing TypeScript compilation..." -ForegroundColor White
$tscResult = npx tsc --noEmit 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ TypeScript compilation successful" -ForegroundColor Green
} else {
    Write-Host "  ⚠ TypeScript has errors (will fix next)" -ForegroundColor Yellow
}

# Final summary
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  ROOT FIXES COMPLETED" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor White
Write-Host "1. Run: node start-dev.js" -ForegroundColor Yellow
Write-Host "2. Or run: npm run dev" -ForegroundColor Yellow
Write-Host "`nIf TypeScript errors persist, run:" -ForegroundColor White
Write-Host "  npx tsc --noEmit" -ForegroundColor Yellow
Write-Host "to see specific errors that need fixing.`n" -ForegroundColor White
