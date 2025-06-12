# Alexandria Platform - Direct Start
# Uses the known pnpm location

Write-Host "Starting Alexandria Platform..." -ForegroundColor Cyan
Write-Host ""

# Change to project directory
Set-Location "C:\Projects\Alexandria"

# Use the direct path to pnpm (where npm installed it)
$pnpmPath = "$env:APPDATA\npm\pnpm.cmd"

if (Test-Path $pnpmPath) {
    Write-Host "Starting development servers..." -ForegroundColor Green
    & $pnpmPath dev
} else {
    # Try alternative location
    $altPath = "C:\Users\$env:USERNAME\AppData\Roaming\npm\pnpm.cmd"
    if (Test-Path $altPath) {
        Write-Host "Starting development servers..." -ForegroundColor Green
        & $altPath dev
    } else {
        Write-Host "Error: Cannot find pnpm!" -ForegroundColor Red
        Write-Host "But we know it exists at: C:\Users\Yannick.local\AppData\Roaming\npm\pnpm.cmd" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Try running directly:" -ForegroundColor Cyan
        Write-Host 'C:\Users\Yannick.local\AppData\Roaming\npm\pnpm.cmd dev' -ForegroundColor White
    }
}