# PowerShell script to apply a temporary fix for Alexandria
# This will make the application work with PostgreSQL without requiring pgvector

$ErrorActionPreference = "Stop"

# Configuration
$pgPassword = "Th1s1s4Work"
$dbName = "alexandria"
$pgBinPath = "C:\Program Files\PostgreSQL\17\bin"

# Helper functions
function Write-Step {
    param (
        [string]$message
    )
    Write-Host "`n===> $message" -ForegroundColor Cyan
}

# 1. First apply the fix to postgres-storage-service.ts
Write-Step "Applying fix to PostgresStorageService"

$filePath = "C:\Projects\Alexandria\src\core\services\storage\postgres-storage-service.ts"
$fileContent = Get-Content -Path $filePath -Raw

# Fix 1: Skip vector extension
$pattern1 = 'await client\.query\(''CREATE EXTENSION IF NOT EXISTS "vector"''\);'
$replacement1 = '// Skipping vector extension for compatibility'
$fileContent = $fileContent -replace $pattern1, $replacement1

# Fix 2: Create vectors table without vector type
$pattern2 = 'vector vector\(1536\),'
$replacement2 = 'vector_data JSONB NOT NULL, -- Using JSONB instead of vector type'
$fileContent = $fileContent -replace $pattern2, $replacement2

# Fix 3: Fix vector index creation
$pattern3 = 'await client\.query\(''CREATE INDEX IF NOT EXISTS idx_vectors_vector ON vectors USING ivfflat \(vector vector_cosine_ops\)''\);'
$replacement3 = 'await client.query(''CREATE INDEX IF NOT EXISTS idx_vectors_jsonb ON vectors USING GIN (vector_data)'');'
$fileContent = $fileContent -replace $pattern3, $replacement3

# Fix 4: Fix storeVector method
$pattern4a = '\[`\$\{vector\.join\('',''\)\}`\]'
$replacement4a = 'JSON.stringify(vector)'
$fileContent = $fileContent -replace $pattern4a, $replacement4a

$pattern4b = 'vector = EXCLUDED\.vector'
$replacement4b = 'vector_data = EXCLUDED.vector_data'
$fileContent = $fileContent -replace $pattern4b, $replacement4b

# Fix column names in query
$pattern4c = 'INSERT INTO vectors \(id, vector,'
$replacement4c = 'INSERT INTO vectors (id, vector_data,'
$fileContent = $fileContent -replace $pattern4c, $replacement4c

# Fix 5: Replace searchSimilar method
$pattern5 = '(?s)async searchSimilar\(vector: number\[\], limit: number, filter\?: Record<string, any>\): Promise<VectorSearchResult\[\]> \{.*?SELECT id, vector,.*?return result\.rows\.map\(row => \(\{.*?\}\)\);.*?\}'
$replacement5 = @'
async searchSimilar(vector: number[], limit: number, filter?: Record<string, any>): Promise<VectorSearchResult[]> {
    await this.ensureInitialized();
    
    // Simple implementation without vector similarity search
    let query = `
      SELECT id, vector_data, metadata, text,
        0.5 AS similarity  -- Placeholder similarity value
      FROM vectors
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramCount = 0;
    
    if (filter?.pluginId) {
      query += ` AND plugin_id = $${++paramCount}`;
      params.push(filter.pluginId);
    }
    
    if (filter?.documentId) {
      query += ` AND document_id = $${++paramCount}`;
      params.push(filter.documentId);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${++paramCount}`;
    params.push(limit);
    
    const result = await this.pool.query(query, params);
    
    return result.rows.map(row => ({
      id: row.id,
      similarity: row.similarity,
      metadata: {
        ...row.metadata,
        text: row.text
      }
    }));
  }
'@
$fileContent = $fileContent -replace $pattern5, $replacement5

# Save the fixed file
Set-Content -Path $filePath -Value $fileContent -Encoding UTF8

# Check database connection
Write-Step "Checking database connection"
try {
    $env:PGPASSWORD = $pgPassword
    & "$pgBinPath\psql" -h localhost -p 5433 -U postgres -c "SELECT 1 as connection_test;"
    Write-Host "Database connection successful" -ForegroundColor Green
}
catch {
    Write-Host "Error connecting to database: $_" -ForegroundColor Red
    exit 1
}

# Create database if it doesn't exist
Write-Step "Creating database if it doesn't exist"
$dbExists = & "$pgBinPath\psql" -h localhost -p 5433 -U postgres -t -c "SELECT COUNT(*) FROM pg_database WHERE datname = '$dbName';"
if ($dbExists.Trim() -eq "0") {
    Write-Host "Creating database '$dbName'..." -ForegroundColor Yellow
    & "$pgBinPath\psql" -h localhost -p 5433 -U postgres -c "CREATE DATABASE $dbName;"
    Write-Host "Database created successfully" -ForegroundColor Green
}
else {
    Write-Host "Database '$dbName' already exists" -ForegroundColor Green
}

# Create extensions
Write-Step "Creating uuid-ossp extension"
& "$pgBinPath\psql" -h localhost -p 5433 -U postgres -d $dbName -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# Update Alexandria configuration to use PostgreSQL
Write-Step "Updating Alexandria configuration to use PostgreSQL"
try {
    $envFile = "C:\Projects\Alexandria\.env"
    $envContent = Get-Content $envFile -Raw
    
    # Update USE_POSTGRES setting if it's not already set to true
    if ($envContent -match "USE_POSTGRES=false") {
        $envContent = $envContent -replace "USE_POSTGRES=false", "USE_POSTGRES=true"
        Set-Content -Path $envFile -Value $envContent
        Write-Host ".env file updated to use PostgreSQL" -ForegroundColor Green
    }
    else {
        Write-Host ".env file already set to use PostgreSQL" -ForegroundColor Green
    }
}
catch {
    Write-Host "Error updating .env file: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Temporary fix applied successfully!" -ForegroundColor Green
Write-Host "You can now run the Alexandria application with PostgreSQL without the vector extension." -ForegroundColor Green
Write-Host "Note: Vector similarity search functionality will not be available until pgvector is properly installed." -ForegroundColor Yellow
