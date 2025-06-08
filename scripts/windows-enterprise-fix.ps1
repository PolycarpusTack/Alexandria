#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Alexandria Windows Enterprise Build Fix
.DESCRIPTION
    Comprehensive fix for Alexandria build issues following enterprise-grade practices:
    - Comprehensive error handling
    - Validation at each step
    - Clear rollback procedures
    - Detailed logging
    - Input validation
#>

param(
    [switch]$Force,
    [switch]$Verbose,
    [string]$LogLevel = "INFO"
)

# Enterprise logging setup
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$logFile = "alexandria-fix-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

function Write-EnterpriseLog {
    param([string]$Message, [string]$Level = "INFO")
    $logEntry = "[$timestamp] [$Level] $Message"
    Write-Host $logEntry -ForegroundColor $(switch($Level) {
        "ERROR" { "Red" }
        "WARN" { "Yellow" }
        "SUCCESS" { "Green" }
        default { "White" }
    })
    $logEntry | Out-File -Append -FilePath $logFile
}

function Test-Prerequisites {
    Write-EnterpriseLog "Validating prerequisites..." "INFO"
    
    # Check Node.js version
    try {
        $nodeVersion = node --version
        Write-EnterpriseLog "Node.js version: $nodeVersion" "INFO"
        
        if (-not $nodeVersion -match "v(\d+)\.") {
            throw "Cannot determine Node.js version"
        }
        
        $majorVersion = [int]$matches[1]
        if ($majorVersion -lt 16) {
            throw "Node.js version $nodeVersion is too old. Minimum required: v16"
        }
    }
    catch {
        Write-EnterpriseLog "Node.js validation failed: $_" "ERROR"
        return $false
    }
    
    # Check npm availability
    try {
        $npmVersion = npm --version
        Write-EnterpriseLog "npm version: $npmVersion" "INFO"
    }
    catch {
        Write-EnterpriseLog "npm not available: $_" "ERROR"
        return $false
    }
    
    # Check if we're in the correct directory
    if (-not (Test-Path "package.json")) {
        Write-EnterpriseLog "package.json not found. Are you in the Alexandria project directory?" "ERROR"
        return $false
    }
    
    Write-EnterpriseLog "Prerequisites validation: PASSED" "SUCCESS"
    return $true
}

function Backup-Configuration {
    Write-EnterpriseLog "Creating configuration backup..." "INFO"
    
    $backupDir = "backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    
    $filesToBackup = @("package.json", "postcss.config.js", "vite.config.ts")
    
    foreach ($file in $filesToBackup) {
        if (Test-Path $file) {
            Copy-Item $file "$backupDir\" -Force
            Write-EnterpriseLog "Backed up: $file" "INFO"
        }
    }
    
    Write-EnterpriseLog "Backup created in: $backupDir" "SUCCESS"
    return $backupDir
}

function Install-RequiredDependencies {
    Write-EnterpriseLog "Installing required dependencies..." "INFO"
    
    try {
        # Install @tailwindcss/postcss with proper error handling
        Write-EnterpriseLog "Installing @tailwindcss/postcss..." "INFO"
        $installResult = ppppnpm install --save-dev "@tailwindcss/postcss" 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-EnterpriseLog "Failed to install @tailwindcss/postcss: $installResult" "ERROR"
            
            # Fallback: Install lightningcss directly
            Write-EnterpriseLog "Attempting fallback: installing lightningcss..." "WARN"
            ppppnpm install --save-dev lightningcss 2>&1
            
            if ($LASTEXITCODE -ne 0) {
                throw "Both primary and fallback dependency installation failed"
            }
        }
        
        Write-EnterpriseLog "Dependencies installed successfully" "SUCCESS"
        return $true
    }
    catch {
        Write-EnterpriseLog "Dependency installation failed: $_" "ERROR"
        return $false
    }
}

function Test-BuildProcess {
    Write-EnterpriseLog "Testing build process..." "INFO"
    
    try {
        # Test server build first (faster feedback)
        Write-EnterpriseLog "Testing server build..." "INFO"
        $serverResult = ppppnpm run build:server 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-EnterpriseLog "Server build failed: $serverResult" "ERROR"
            return $false
        }
        
        Write-EnterpriseLog "Server build: PASSED" "SUCCESS"
        
        # Test client build
        Write-EnterpriseLog "Testing client build..." "INFO"
        $clientResult = ppppnpm run build:client 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-EnterpriseLog "Client build failed: $clientResult" "ERROR"
            return $false
        }
        
        Write-EnterpriseLog "Client build: PASSED" "SUCCESS"
        Write-EnterpriseLog "Complete build process: PASSED" "SUCCESS"
        return $true
    }
    catch {
        Write-EnterpriseLog "Build test failed: $_" "ERROR"
        return $false
    }
}

function Restore-FromBackup {
    param([string]$BackupDir)
    
    Write-EnterpriseLog "Restoring from backup: $BackupDir" "WARN"
    
    $filesToRestore = @("package.json", "postcss.config.js", "vite.config.ts")
    
    foreach ($file in $filesToRestore) {
        $backupFile = Join-Path $BackupDir $file
        if (Test-Path $backupFile) {
            Copy-Item $backupFile $file -Force
            Write-EnterpriseLog "Restored: $file" "INFO"
        }
    }
}

# Main execution flow with comprehensive error handling
function Main {
    Write-EnterpriseLog "=== Alexandria Windows Enterprise Build Fix ===" "INFO"
    Write-EnterpriseLog "Log file: $logFile" "INFO"
    
    # Step 1: Prerequisites validation
    if (-not (Test-Prerequisites)) {
        Write-EnterpriseLog "Prerequisites validation failed. Aborting." "ERROR"
        exit 1
    }
    
    # Step 2: Create backup
    $backupDir = Backup-Configuration
    
    try {
        # Step 3: Install dependencies
        if (-not (Install-RequiredDependencies)) {
            Write-EnterpriseLog "Dependency installation failed. Restoring backup..." "ERROR"
            Restore-FromBackup $backupDir
            exit 1
        }
        
        # Step 4: Test build
        if (-not (Test-BuildProcess)) {
            Write-EnterpriseLog "Build test failed. Restoring backup..." "ERROR"
            Restore-FromBackup $backupDir
            exit 1
        }
        
        # Success
        Write-EnterpriseLog "=== ALEXANDRIA BUILD FIX COMPLETED SUCCESSFULLY ===" "SUCCESS"
        Write-EnterpriseLog "✅ All components working correctly" "SUCCESS"
        Write-EnterpriseLog "✅ Ready for development and production builds" "SUCCESS"
        Write-EnterpriseLog "Backup available at: $backupDir" "INFO"
        
    }
    catch {
        Write-EnterpriseLog "Unexpected error: $_" "ERROR"
        Write-EnterpriseLog "Restoring from backup..." "WARN"
        Restore-FromBackup $backupDir
        exit 1
    }
}

# Execute main function
Main