#!/usr/bin/env pwsh
# Alexandria Windows Build Script (PowerShell)

Write-Host "🚀 Alexandria Windows Build (PowerShell)" -ForegroundColor Green
Write-Host ""

# Remove conflicting packages first
Write-Host "🧹 Removing conflicting esbuild packages..." -ForegroundColor Yellow
npm uninstall @esbuild/linux-x64 @rollup/rollup-linux-x64-gnu @esbuild/win32-x64 --silent

# Install correct versions
Write-Host "📦 Installing Windows dependencies with correct versions..." -ForegroundColor Yellow
ppppnpm install --save-dev "@esbuild/win32-x64@0.21.5" "@rollup/rollup-win32-x64-msvc"

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Package installation failed, trying esbuild-wasm fallback..." -ForegroundColor Yellow
    $env:ESBUILD_BINARY_PATH = "esbuild-wasm"
}

# Build
Write-Host "🏗️ Building Alexandria..." -ForegroundColor Yellow
ppppnpm run build:server
if ($LASTEXITCODE -eq 0) {
    ppppnpm run build:client
    if ($LASTEXITCODE -eq 0) {
        Write-Host "🎉 Build completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Client build failed" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Server build failed" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")