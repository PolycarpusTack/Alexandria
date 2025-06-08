# PowerShell script to build and install pgvector from source for PostgreSQL 17
# For Alexandria platform

$ErrorActionPreference = "Stop"

# Configuration
$pgVersion = "17"
$pgBasePath = "C:\Program Files\PostgreSQL\$pgVersion"
$pgBinPath = "$pgBasePath\bin"
$pgvectorVersion = "v0.8.0" # Latest stable version
$pgvectorRepo = "https://github.com/pgvector/pgvector.git"
$tempDir = "C:\Temp\pgvector_build"
$pgPassword = "Th1s1s4Work"
$dbName = "alexandria"

# Helper functions
function Write-Step {
    param (
        [string]$message
    )
    Write-Host "`n===> $message" -ForegroundColor Cyan
}

function Execute-SQL {
    param (
        [string]$query,
        [string]$database = "postgres"
    )
    
    Write-Host "Executing SQL: $query" -ForegroundColor Yellow
    $env:PGPASSWORD = $pgPassword
    & "$pgBinPath\psql.exe" -h localhost -p 5433 -U postgres -d $database -c "$query"
    if ($LASTEXITCODE -ne 0) {
        throw "SQL execution failed: $query"
    }
}

# Check prerequisites
Write-Step "Checking prerequisites"

# Check for PostgreSQL
if (!(Test-Path $pgBinPath)) {
    Write-Host "Error: PostgreSQL $pgVersion not found at $pgBasePath" -ForegroundColor Red
    exit 1
}

# Check for Git
try {
    $gitVersion = git --version
    Write-Host "Git found: $gitVersion" -ForegroundColor Green
}
catch {
    Write-Host "Error: Git not installed. Please install Git for Windows." -ForegroundColor Red
    exit 1
}

# Check for Visual Studio C++ Build Tools
$vsPath = "C:\Program Files (x86)\Microsoft Visual Studio"
if (!(Test-Path $vsPath)) {
    Write-Host "Warning: Visual Studio path not found. Make sure you have Visual Studio with C++ build tools installed." -ForegroundColor Yellow
}

# Check PostgreSQL server connection
Write-Step "Checking PostgreSQL service status"
try {
    $pgStatus = Execute-SQL "SELECT version();"
    Write-Host "PostgreSQL is running: $pgStatus" -ForegroundColor Green
}
catch {
    Write-Host "Error connecting to PostgreSQL: $_" -ForegroundColor Red
    exit 1
}

# Create build directory
Write-Step "Creating build directory"
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}
New-Item -Path $tempDir -ItemType Directory -Force | Out-Null
Set-Location $tempDir

# Clone pgvector repository
Write-Step "Cloning pgvector repository"
git clone --branch $pgvectorVersion $pgvectorRepo
Set-Location "$tempDir\pgvector"

# Set up environment for building
Write-Step "Setting up build environment"
$env:PGROOT = $pgBasePath
Write-Host "PGROOT set to: $env:PGROOT" -ForegroundColor Green

# Build and install pgvector
Write-Step "Building and installing pgvector"
Write-Host "Note: This may take a few minutes..." -ForegroundColor Yellow

# First attempt with nmake
try {
    # Clean any previous build artifacts
    nmake /F Makefile.win clean
    
    # Build and install
    nmake /F Makefile.win
    nmake /F Makefile.win install
    
    Write-Host "pgvector successfully built and installed!" -ForegroundColor Green
}
catch {
    Write-Host "Error during build: $_" -ForegroundColor Red
    Write-Host "This may require running the script from 'x64 Native Tools Command Prompt for VS'" -ForegroundColor Yellow
    exit 1
}

# Check if database exists, create if not
Write-Step "Checking if database '$dbName' exists"
$dbExists = Execute-SQL "SELECT COUNT(*) FROM pg_database WHERE datname = '$dbName';"
if ($dbExists.Trim() -eq "0") {
    Write-Host "Creating database '$dbName'..." -ForegroundColor Yellow
    Execute-SQL "CREATE DATABASE $dbName;"
    Write-Host "Database created successfully" -ForegroundColor Green
}
else {
    Write-Host "Database '$dbName' already exists" -ForegroundColor Green
}

# Create vector extension in database
Write-Step "Creating vector extension in $dbName database"
try {
    Execute-SQL "CREATE EXTENSION IF NOT EXISTS vector;" $dbName
    Write-Host "Vector extension created successfully" -ForegroundColor Green
    
    # Verify extension
    $extVersion = Execute-SQL "SELECT extversion FROM pg_extension WHERE extname = 'vector';" $dbName
    Write-Host "Installed pgvector version: $extVersion" -ForegroundColor Green
}
catch {
    Write-Host "Error creating vector extension: $_" -ForegroundColor Red
    exit 1
}

# Update Alexandria configuration to use PostgreSQL
Write-Step "Updating Alexandria configuration to use PostgreSQL"
try {
    $envFile = "C:\Projects\Alexandria\.env"
    $envContent = Get-Content $envFile -Raw
    
    # Update USE_POSTGRES setting
    $envContent = $envContent -replace "USE_POSTGRES=false", "USE_POSTGRES=true"
    
    # Write updated content back to .env file
    Set-Content -Path $envFile -Value $envContent
    
    Write-Host ".env file updated to use PostgreSQL" -ForegroundColor Green
}
catch {
    Write-Host "Error updating .env file: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ pgvector installation complete!" -ForegroundColor Green
Write-Host "You can now run initialize-database.ps1 to set up the Alexandria database schema."
