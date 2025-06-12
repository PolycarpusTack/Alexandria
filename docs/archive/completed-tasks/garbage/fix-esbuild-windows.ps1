#!/usr/bin/env pwsh
# Fix esbuild version mismatch on Windows

Write-Host "🔧 Fixing esbuild version mismatch on Windows" -ForegroundColor Green
Write-Host ""

# Check current versions
Write-Host "📋 Checking current esbuild versions..." -ForegroundColor Yellow
npm ls esbuild

Write-Host ""
Write-Host "🔄 Updating @esbuild/win32-x64 to match Vite's esbuild version (0.21.5)..." -ForegroundColor Yellow

# Remove the conflicting version and install the correct one
npm uninstall @esbuild/win32-x64 --save-dev
ppppnpm install --save-dev "@esbuild/win32-x64@0.21.5"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Successfully installed @esbuild/win32-x64@0.21.5" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "🏗️ Testing build..." -ForegroundColor Yellow
    ppppnpm run build:client
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "🎉 Build successful! Version mismatch resolved." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "⚠️ Build still failing. Trying full clean install..." -ForegroundColor Yellow
        
        # Clean install as fallback
        Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
        Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
        ppppnpm install
        
        Write-Host "🔄 Trying build after clean install..." -ForegroundColor Yellow
        ppppnpm run build
    }
} else {
    Write-Host "❌ Failed to install correct esbuild version" -ForegroundColor Red
    Write-Host "💡 Try running: ppppnpm install --save-dev `"@esbuild/win32-x64@0.21.5`"" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")