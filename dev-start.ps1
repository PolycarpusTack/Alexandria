# Alexandria Development Starter for PowerShell
# This script ensures concurrently works properly on Windows

Write-Host "Starting Alexandria Development Environment..." -ForegroundColor Cyan
Write-Host ""

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "ERROR: node_modules folder not found!" -ForegroundColor Red
    Write-Host "Please run: pnpm install" -ForegroundColor Yellow
    exit 1
}

# Check if concurrently exists
$concurrentlyPaths = @(
    ".\node_modules\.bin\concurrently.cmd",
    ".\node_modules\.bin\concurrently.ps1",
    ".\node_modules\.bin\concurrently"
)

$concurrentlyFound = $false
$concurrentlyPath = ""

foreach ($path in $concurrentlyPaths) {
    if (Test-Path $path) {
        $concurrentlyFound = $true
        $concurrentlyPath = $path
        break
    }
}

if ($concurrentlyFound) {
    Write-Host "Found concurrently at: $concurrentlyPath" -ForegroundColor Green
    Write-Host "Starting servers..." -ForegroundColor Green
    Write-Host ""
    
    # Run concurrently
    & $concurrentlyPath --prefix-colors "yellow,cyan" --names "SERVER,CLIENT" --kill-others-on-fail "pnpm run dev:server" "pnpm run dev:client"
} else {
    Write-Host "Concurrently not found in node_modules!" -ForegroundColor Red
    Write-Host "Trying to use pnpm exec..." -ForegroundColor Yellow
    
    # Try with pnpm exec
    try {
        pnpm exec concurrently --prefix-colors "yellow,cyan" --names "SERVER,CLIENT" --kill-others-on-fail "pnpm run dev:server" "pnpm run dev:client"
    } catch {
        Write-Host ""
        Write-Host "Failed to run concurrently!" -ForegroundColor Red
        Write-Host "Starting servers in separate windows as fallback..." -ForegroundColor Yellow
        
        # Start servers in separate windows
        Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host 'ALEXANDRIA SERVER' -ForegroundColor Yellow; pnpm run dev:server"
        Start-Sleep -Seconds 2
        Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host 'ALEXANDRIA CLIENT' -ForegroundColor Cyan; pnpm run dev:client"
        
        Write-Host ""
        Write-Host "Servers started in separate windows." -ForegroundColor Green
        Write-Host "Close this window to continue, or press Ctrl+C" -ForegroundColor Gray
        
        # Keep the script running
        while ($true) {
            Start-Sleep -Seconds 1
        }
    }
}