# Alexandria Platform - TypeScript Error Fixer
# This script fixes common TypeScript compilation errors

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Alexandria - TypeScript Error Fix   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "🔍 Scanning for TypeScript errors..." -ForegroundColor Green

# Fix 1: CodeBlock.tsx import issue
$codeBlockFile = "src\plugins\alfred\ui\components\CodeBlock.tsx"
if (Test-Path $codeBlockFile) {
    Write-Host "🔧 Fixing CodeBlock.tsx imports..." -ForegroundColor Green
    
    $content = Get-Content $codeBlockFile -Raw
    
    # Fix the import paths
    $content = $content -replace "@alexandria/ui/components/ui/button", "../../../../client/components/ui/button"
    $content = $content -replace "@alexandria/ui/components/ui/use-toast", "../../../../client/components/ui/use-toast"
    
    Set-Content $codeBlockFile $content
    Write-Host "  ✅ Fixed CodeBlock.tsx imports" -ForegroundColor Green
}

# Fix 2: Check UI component exports
$uiIndexFile = "src\client\components\ui\index.ts"
if (Test-Path $uiIndexFile) {
    Write-Host "🔧 Checking UI component exports..." -ForegroundColor Green
    
    $content = Get-Content $uiIndexFile -Raw
    
    # Ensure all required components are exported
    $requiredExports = @(
        'export * from "./button"',
        'export * from "./card"',
        'export * from "./input"',
        'export * from "./tabs"',
        'export * from "./dialog"',
        'export * from "./dropdown-menu"',
        'export * from "./select"',
        'export * from "./progress"',
        'export * from "./scroll-area"',
        'export * from "./alert-dialog"',
        'export * from "./use-toast"',
        'export * from "./resizable"'
    )
    
    $updated = $false
    foreach ($export in $requiredExports) {
        if ($content -notlike "*$export*") {
            $content += "`n$export"
            $updated = $true
        }
    }
    
    if ($updated) {
        Set-Content $uiIndexFile $content
        Write-Host "  ✅ Updated UI component exports" -ForegroundColor Green
    } else {
        Write-Host "  ✅ UI exports are correct" -ForegroundColor Green
    }
}

# Fix 3: Check for missing Radix UI components
Write-Host "🔧 Checking for missing UI component files..." -ForegroundColor Green

$uiComponentsDir = "src\client\components\ui"
$requiredComponents = @(
    "progress.tsx",
    "scroll-area.tsx", 
    "alert-dialog.tsx",
    "resizable.tsx"
)

foreach ($component in $requiredComponents) {
    $componentPath = Join-Path $uiComponentsDir $component
    if (-not (Test-Path $componentPath)) {
        Write-Host "  ⚠️  Missing: $component" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ Found: $component" -ForegroundColor Green
    }
}

# Fix 4: Check index.ts for coreServices error
$indexFile = "src\index.ts"
if (Test-Path $indexFile) {
    Write-Host "🔧 Checking main index.ts file..." -ForegroundColor Green
    
    $content = Get-Content $indexFile -Raw
    
    # Check if coreServices is properly initialized before use
    if ($content -match "coreServices\." -and $content -notmatch "if.*coreServices") {
        Write-Host "  ⚠️  Found potential coreServices usage before initialization" -ForegroundColor Yellow
        Write-Host "  💡 Manual fix may be required in src\index.ts" -ForegroundColor Cyan
    } else {
        Write-Host "  ✅ coreServices usage looks correct" -ForegroundColor Green
    }
}

# Fix 5: TypeScript compilation test
Write-Host "🔍 Testing TypeScript compilation..." -ForegroundColor Green

try {
    $tscOutput = npx tsc --noEmit --skipLibCheck 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ TypeScript compilation successful" -ForegroundColor Green
    } else {
        Write-Host "⚠️  TypeScript errors found:" -ForegroundColor Yellow
        Write-Host $tscOutput -ForegroundColor Gray
        Write-Host ""
        Write-Host "💡 These errors need manual review and fixing." -ForegroundColor Cyan
    }
} catch {
    Write-Host "⚠️  Could not run TypeScript compiler" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 TypeScript Error Fix Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "If issues persist:" -ForegroundColor Cyan
Write-Host "1. Check the TypeScript compiler output above" -ForegroundColor White
Write-Host "2. Review src\index.ts for coreServices initialization" -ForegroundColor White
Write-Host "3. Ensure all UI components are properly exported" -ForegroundColor White
Write-Host ""