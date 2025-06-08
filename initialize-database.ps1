# PowerShell script to initialize the Alexandria database schema
# This creates all necessary tables after pgvector is installed

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

function Execute-SQL {
    param (
        [string]$query,
        [string]$database = $dbName
    )
    
    Write-Host "Executing SQL: $query" -ForegroundColor Yellow
    $env:PGPASSWORD = $pgPassword
    & "$pgBinPath\psql.exe" -h localhost -p 5433 -U postgres -d $database -c "$query"
    if ($LASTEXITCODE -ne 0) {
        throw "SQL execution failed: $query"
    }
}

# Check database connection
Write-Step "Checking database connection"
try {
    Execute-SQL "SELECT 1 as connection_test;"
    Write-Host "Database connection successful" -ForegroundColor Green
}
catch {
    Write-Host "Error connecting to database: $_" -ForegroundColor Red
    exit 1
}

# Create extensions
Write-Step "Creating required extensions"
Execute-SQL "CREATE EXTENSION IF NOT EXISTS vector;"
Execute-SQL "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
Write-Host "Extensions created successfully" -ForegroundColor Green

# Create core tables
Write-Step "Creating core tables"

# Users table
Execute-SQL @"
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    roles TEXT[] NOT NULL DEFAULT '{user}',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);
"@

# Files table
Execute-SQL @"
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size BIGINT NOT NULL,
    uploaded_by TEXT NOT NULL,
    plugin_id TEXT,
    tags TEXT[],
    description TEXT,
    checksum TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);
"@

# Documents table
Execute-SQL @"
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('markdown', 'text', 'html', 'pdf', 'code')),
    plugin_id TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'B')
    ) STORED
);
"@

# Vectors table
Execute-SQL @"
CREATE TABLE IF NOT EXISTS vectors (
    id TEXT PRIMARY KEY,
    vector vector(1536), -- Default embedding size for OpenAI embeddings
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER,
    text TEXT NOT NULL,
    plugin_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
"@

# Create indexes
Write-Step "Creating indexes"
Execute-SQL "CREATE INDEX IF NOT EXISTS idx_files_plugin_id ON files(plugin_id);"
Execute-SQL "CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);"
Execute-SQL "CREATE INDEX IF NOT EXISTS idx_documents_search_vector ON documents USING GIN(search_vector);"
Execute-SQL "CREATE INDEX IF NOT EXISTS idx_documents_plugin_id ON documents(plugin_id);"
Execute-SQL "CREATE INDEX IF NOT EXISTS idx_vectors_vector ON vectors USING ivfflat (vector vector_cosine_ops);"

# Create a default admin user
Write-Step "Creating default admin user"
Execute-SQL @"
INSERT INTO users (username, email, hashed_password, first_name, last_name, roles)
VALUES 
    ('admin', 'admin@alexandria.local', '\$2b\$10\$3euPr3YY7yZ6LkbK/nvVo.1oU5u0CExSijHFu1zVPGNFx.zgkV.CS', 'Admin', 'User', '{admin}')
ON CONFLICT (username) DO NOTHING;
"@

Write-Host "Admin user created with username 'admin' and password 'admin123'" -ForegroundColor Green

# Create demo user
Execute-SQL @"
INSERT INTO users (username, email, hashed_password, first_name, last_name, roles)
VALUES 
    ('demo', 'demo@alexandria.local', '\$2b\$10\$3euPr3YY7yZ6LkbK/nvVo.1oU5u0CExSijHFu1zVPGNFx.zgkV.CS', 'Demo', 'User', '{user}')
ON CONFLICT (username) DO NOTHING;
"@

Write-Host "Demo user created with username 'demo' and password 'admin123'" -ForegroundColor Green

Write-Host "`n✅ Database initialization complete!" -ForegroundColor Green
Write-Host "Alexandria database has been configured with all required tables and indexes." -ForegroundColor Green
