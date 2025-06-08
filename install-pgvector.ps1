# PowerShell script to install pgvector extension for PostgreSQL 17
# For Alexandria platform

$ErrorActionPreference = "Stop"

# Configuration
$pgVersion = "17"
$pgBasePath = "C:\Program Files\PostgreSQL\$pgVersion"
$pgBinPath = "$pgBasePath\bin"
$pgSharePath = "$pgBasePath\share\extension"
$pgLibPath = "$pgBasePath\lib"
$pgPassword = "Th1s1s4Work"
$dbName = "alexandria"
$tempDir = "C:\Temp\pgvector_install"
$pgvectorVersion = "0.8.0" # Latest stable version

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

# Check if PostgreSQL is running
Write-Step "Checking PostgreSQL service status"
try {
    $pgStatus = Execute-SQL "SELECT version();"
    Write-Host "PostgreSQL is running: $pgStatus" -ForegroundColor Green
}
catch {
    Write-Host "Error connecting to PostgreSQL: $_" -ForegroundColor Red
    exit 1
}

# Create installation directory
Write-Step "Creating temporary directory"
if (!(Test-Path $tempDir)) {
    New-Item -Path $tempDir -ItemType Directory -Force | Out-Null
}
Set-Location $tempDir

# Download pre-compiled pgvector files from unofficial repo
Write-Step "Downloading pre-compiled pgvector files"
try {
    $downloadUrl = "https://github.com/andreiramani/pgvector_pgsql_windows/releases/download/v$pgvectorVersion/pgvector-v$pgvectorVersion-pg$pgVersion-win-x64.zip"
    $zipFile = "$tempDir\pgvector.zip"
    
    Write-Host "Downloading from: $downloadUrl" -ForegroundColor Yellow
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipFile
    
    Write-Host "Extracting files..." -ForegroundColor Yellow
    Expand-Archive -Path $zipFile -DestinationPath $tempDir -Force
}
catch {
    Write-Host "Error downloading or extracting pgvector: $_" -ForegroundColor Red
    exit 1
}

# Install pgvector files
Write-Step "Installing pgvector files"
try {
    # Copy .dll files to lib directory
    Get-ChildItem -Path $tempDir -Filter "*.dll" -Recurse | ForEach-Object {
        Write-Host "Copying $($_.Name) to $pgLibPath" -ForegroundColor Yellow
        Copy-Item -Path $_.FullName -Destination $pgLibPath -Force
    }
    
    # Copy extension files to share/extension directory
    Get-ChildItem -Path $tempDir -Filter "*.control" -Recurse | ForEach-Object {
        Write-Host "Copying $($_.Name) to $pgSharePath" -ForegroundColor Yellow
        Copy-Item -Path $_.FullName -Destination $pgSharePath -Force
    }
    
    Get-ChildItem -Path $tempDir -Filter "*.sql" -Recurse | ForEach-Object {
        Write-Host "Copying $($_.Name) to $pgSharePath" -ForegroundColor Yellow
        Copy-Item -Path $_.FullName -Destination $pgSharePath -Force
    }
}
catch {
    Write-Host "Error installing pgvector files: $_" -ForegroundColor Red
    exit 1
}

# Check if alexandria database exists, create if not
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

# Create vector extension in alexandria database
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
Write-Host "You can now restart the Alexandria application to use PostgreSQL with vector support." -ForegroundColor Green
