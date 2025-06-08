-- Performance optimization indexes for Alexandria Platform

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Documents table indexes
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_plugin_id ON documents(plugin_id);

-- Files table indexes
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_files_plugin_id ON files(plugin_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON files(uploaded_at);

-- Vectors table indexes
CREATE INDEX IF NOT EXISTS idx_vectors_document_id ON vectors(document_id);
CREATE INDEX IF NOT EXISTS idx_vectors_plugin_id ON vectors(plugin_id);
CREATE INDEX IF NOT EXISTS idx_vectors_created_at ON vectors(created_at);

-- Enable trigram extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;