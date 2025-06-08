-- Additional indexes for performance optimization

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_roles ON users USING GIN (roles);

-- Files table indexes
CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files (mime_type);
CREATE INDEX IF NOT EXISTS idx_files_checksum ON files (checksum);

-- Documents table indexes
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents (type);
-- Full text search index for content
CREATE INDEX IF NOT EXISTS idx_documents_content_fts ON documents USING GIN (to_tsvector('english', content));

-- Vectors table indexes
CREATE INDEX IF NOT EXISTS idx_vectors_document_id_chunk ON vectors (document_id, chunk_index);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_files_user_uploaded ON files (uploaded_by, uploaded_at DESC);