# Windows Terminal Recovery Plan for Alexandria Platform
**Strategy**: Use Windows Terminal for dependency management, WSL for development

## Phase 1: Clean Current State (Windows Side)

### Step 1: Open PowerShell as Administrator
```powershell
# Press Win+X, select "Windows PowerShell (Admin)"
# Navigate to project
cd C:\Projects\Alexandria
```

### Step 2: Force Clean Node Modules
```powershell
# Remove node_modules with force (handles locked files better)
Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue

# Clean pnpm cache
pnpm store prune

# Remove pnpm lock file to ensure fresh resolution
Remove-Item "pnpm-lock.yaml" -Force -ErrorAction SilentlyContinue

# Clean any TypeScript build artifacts
Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "*\.tsbuildinfo" -Recurse -Force -ErrorAction SilentlyContinue
```

### Step 3: Clean Workspace Packages
```powershell
# Clean each workspace package
@("apps\web", "libs\shared", "libs\ui-components", "alfred-app") | ForEach-Object {
    $modulePath = Join-Path $_ "node_modules"
    $distPath = Join-Path $_ "dist"
    if (Test-Path $modulePath) {
        Remove-Item $modulePath -Recurse -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $distPath) {
        Remove-Item $distPath -Recurse -Force -ErrorAction SilentlyContinue
    }
}
```

## Phase 2: Install Dependencies (Windows Side)

### Step 4: Configure pnpm for Windows
```powershell
# Set pnpm to use proper permissions
pnpm config set enable-pre-post-scripts true
pnpm config set virtual-store-dir ".pnpm-store"
pnpm config set node-linker hoisted
```

### Step 5: Fresh Install
```powershell
# Install all dependencies from Windows side
pnpm install --force

# If that fails, try with no-optional flag
pnpm install --force --no-optional

# Verify critical TypeScript types are installed
pnpm list @types/node @types/express @types/cors
```

## Phase 3: Create Helper Scripts

### Step 6: Create Windows-WSL Bridge Scripts
Create these helper scripts to manage the dual environment:

**File: `C:\Projects\Alexandria\win-install.ps1`**
```powershell
# PowerShell script for dependency management
Write-Host "Alexandria Platform - Windows Dependency Manager" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Clean and install
Write-Host "`nCleaning old dependencies..." -ForegroundColor Yellow
Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "pnpm-lock.yaml" -Force -ErrorAction SilentlyContinue

Write-Host "Installing fresh dependencies..." -ForegroundColor Yellow
pnpm install --force

Write-Host "`nVerifying TypeScript types..." -ForegroundColor Yellow
pnpm list @types/node @types/express @types/cors

Write-Host "`nDependencies installed successfully!" -ForegroundColor Green
Write-Host "You can now switch to WSL for development." -ForegroundColor Green
```

**File: `C:\Projects\Alexandria\win-add-dep.ps1`**
```powershell
# Helper to add dependencies from Windows side
param(
    [Parameter(Mandatory=$true)]
    [string]$Package,
    [switch]$Dev,
    [string]$Workspace = ""
)

$command = "pnpm add"
if ($Dev) { $command += " -D" }
if ($Workspace) { $command += " --filter $Workspace" }
$command += " $Package"

Write-Host "Running: $command" -ForegroundColor Cyan
Invoke-Expression $command
```

## Phase 4: WSL Development Setup

### Step 7: Create WSL-side Development Scripts
In WSL, create these helper scripts:

**File: `/mnt/c/Projects/Alexandria/wsl-dev.sh`**
```bash
#!/bin/bash
# WSL Development Launcher

echo "Alexandria Platform - WSL Development Mode"
echo "========================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ Missing node_modules!"
    echo "Please run 'win-install.ps1' from Windows PowerShell first."
    exit 1
fi

# Check for TypeScript types
if [ ! -d "node_modules/@types/node" ]; then
    echo "⚠️  Missing TypeScript types!"
    echo "Run from Windows: pnpm install"
    exit 1
fi

echo "✅ Dependencies detected"
echo "Starting development servers..."

# Use the existing start script
./start-alexandria.sh
```

Make it executable:
```bash
chmod +x wsl-dev.sh
```

## Phase 5: Workflow Documentation

### Step 8: Create Developer Workflow Guide
**File: `C:\Projects\Alexandria\WINDOWS_WSL_WORKFLOW.md`**
```markdown
# Alexandria Platform - Windows/WSL Hybrid Workflow

## Daily Development Workflow

### Starting Your Day
1. **Windows Terminal (PowerShell)**
   ```powershell
   cd C:\Projects\Alexandria
   .\win-install.ps1  # Only if dependencies changed
   ```

2. **WSL Terminal**
   ```bash
   cd /mnt/c/Projects/Alexandria
   ./wsl-dev.sh
   ```

### Adding Dependencies
Always add dependencies from Windows side:
```powershell
# Add to root
.\win-add-dep.ps1 express

# Add dev dependency
.\win-add-dep.ps1 -Dev @types/lodash

# Add to specific workspace
.\win-add-dep.ps1 -Workspace @alexandria/shared lodash
```

### Common Issues & Solutions

#### "Permission Denied" in WSL
- Switch to Windows Terminal
- Run the operation there
- Return to WSL

#### "Cannot find module" TypeScript errors
1. Windows: `pnpm install --force`
2. WSL: Restart TypeScript server in VS Code

#### File Watching Issues
Add to your VS Code settings.json:
```json
{
  "remote.WSL.fileWatcher.polling": true
}
```
```

## Phase 6: Verification

### Step 9: Test the Setup
From Windows PowerShell:
```powershell
# Verify all dependencies installed
pnpm list --depth=0

# Check for missing peer dependencies
pnpm list --depth=0 | Select-String "missing"

# Build test
pnpm run build
```

From WSL:
```bash
# Test TypeScript compilation
npx tsc --noEmit

# Test server startup
npm run dev
```

## Emergency Recovery Commands

If things go wrong:
```powershell
# Windows - Nuclear option
Remove-Item -Path "node_modules", ".pnpm-store", "pnpm-lock.yaml" -Recurse -Force
pnpm cache clean
pnpm install --force --shamefully-hoist
```

## Expected Outcome
- ✅ All dependencies installed via Windows
- ✅ Development runs in WSL using Windows-installed dependencies
- ✅ No more permission errors
- ✅ TypeScript finds all type definitions
- ✅ Servers start successfully

## Important Notes
1. **ALWAYS** run `pnpm` commands from Windows Terminal
2. **NEVER** run `pnpm install` from WSL on this project
3. Use the helper scripts for consistency
4. If VS Code suggests installing dependencies, decline and do it from Windows