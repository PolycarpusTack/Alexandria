# Alexandria Platform - Add Dependency Helper
# Usage: .\win-add-dep.ps1 <package> [-Dev] [-Workspace <workspace>]

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Package,
    
    [switch]$Dev,
    
    [string]$Workspace = ""
)

Write-Host "Alexandria - Dependency Installer" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Build the command
$command = "pnpm add"

if ($Dev) {
    $command += " -D"
    Write-Host "Mode: Development dependency" -ForegroundColor Yellow
} else {
    Write-Host "Mode: Production dependency" -ForegroundColor Yellow
}

if ($Workspace) {
    $command += " --filter $Workspace"
    Write-Host "Target: $Workspace workspace" -ForegroundColor Yellow
} else {
    Write-Host "Target: Root project" -ForegroundColor Yellow
}

$command += " $Package"

Write-Host "Package: $Package" -ForegroundColor Yellow
Write-Host ""
Write-Host "Executing: $command" -ForegroundColor Cyan
Write-Host ""

# Execute the command
Invoke-Expression $command

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Successfully added $Package" -ForegroundColor Green
    
    # If it's a type definition, verify it
    if ($Package -match "^@types/") {
        Write-Host "Verifying type installation..." -ForegroundColor Yellow
        pnpm list $Package
    }
} else {
    Write-Host ""
    Write-Host "❌ Failed to add $Package" -ForegroundColor Red
    Write-Host "Try running win-install.ps1 to clean and reinstall all dependencies" -ForegroundColor Yellow
}