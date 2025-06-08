#!/usr/bin/env pwsh
# Alexandria Windows Final Fix - Addresses all build issues

Write-Host "🔧 Alexandria Windows Final Fix" -ForegroundColor Green
Write-Host "This will fix ALL build issues in one go..." -ForegroundColor Yellow
Write-Host ""

# Step 1: Install the required TailwindCSS PostCSS plugin
Write-Host "📦 Installing @tailwindcss/postcss..." -ForegroundColor Yellow
ppppnpm install --save-dev "@tailwindcss/postcss"

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Failed to install @tailwindcss/postcss, trying alternative..." -ForegroundColor Yellow
    
    # Alternative: downgrade to TailwindCSS v3
    npm uninstall tailwindcss
    ppppnpm install --save-dev "tailwindcss@^3.4.0"
    
    # Update PostCSS config for v3
    @"
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
"@ | Out-File -FilePath "postcss.config.js" -Encoding utf8
    
    Write-Host "✅ Switched to TailwindCSS v3 as fallback" -ForegroundColor Green
}

# Step 2: Fix lightningcss native module if needed
Write-Host ""
Write-Host "🔧 Ensuring lightningcss is properly installed..." -ForegroundColor Yellow
ppppnpm install --save-dev lightningcss

# Step 3: Clean up any conflicting packages
Write-Host ""
Write-Host "🧹 Cleaning up potential conflicts..." -ForegroundColor Yellow
npm uninstall @esbuild/linux-x64 @rollup/rollup-linux-x64-gnu --silent

# Step 4: Test the build
Write-Host ""
Write-Host "🏗️ Testing build..." -ForegroundColor Yellow
ppppnpm run build:simple

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "🎉 SUCCESS! Alexandria build is working!" -ForegroundColor Green
    Write-Host "✅ Server build: Complete" -ForegroundColor Green
    Write-Host "✅ Client build: Complete" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now run:" -ForegroundColor Cyan
    Write-Host "  ppppnpm run dev    # Start development server" -ForegroundColor Cyan
    Write-Host "  ppppnpm run build  # Production build" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "⚠️ Build still failing. Let's try the nuclear option..." -ForegroundColor Yellow
    
    # Nuclear option: complete clean install
    Write-Host "🧹 Performing complete clean install..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
    Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
    
    ppppnpm install
    ppppnpm run build:simple
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "🎉 SUCCESS after clean install!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Even the nuclear option failed. Here's what to try:" -ForegroundColor Red
        Write-Host "1. Check Node.js version (should be 16+)" -ForegroundColor Yellow
        Write-Host "2. Run as Administrator" -ForegroundColor Yellow
        Write-Host "3. Check Windows build tools are installed" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")