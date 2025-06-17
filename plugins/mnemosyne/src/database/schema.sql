-- Mnemosyne Knowledge Management Database Schema
-- PostgreSQL schema for the knowledge base plugin

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- Create schema
CREATE SCHEMA IF NOT EXISTS mnemosyne;

-- Enum types
CREATE TYPE mnemosyne.node_type AS ENUM ('document', 'note', 'folder');
CREATE TYPE mnemosyne.connection_type AS ENUM ('reference', 'related', 'parent-child');

-- Knowledge nodes table
CREATE TABLE mnemosyne.nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    content TEXT DEFAULT '',
    type mnemosyne.node_type NOT NULL DEFAULT 'document',
    parent_id UUID REFERENCES mnemosyne.nodes(id) ON DELETE SET NULL,
    
    -- Metadata as JSONB for flexibility
    metadata JSONB NOT NULL DEFAULT '{
        "tags": [],
        "author": null,
        "version": 1
    }'::JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Soft delete
    deleted_at TIMESTAMPTZ,
    
    -- Full text search
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'B')
    ) STORED,
    
    -- Indexes
    CONSTRAINT title_not_empty CHECK (length(trim(title)) > 0)
);

-- Indexes for performance
CREATE INDEX idx_nodes_parent_id ON mnemosyne.nodes(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_nodes_type ON mnemosyne.nodes(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_nodes_created_at ON mnemosyne.nodes(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_nodes_updated_at ON mnemosyne.nodes(updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_nodes_search_vector ON mnemosyne.nodes USING GIN(search_vector);
CREATE INDEX idx_nodes_metadata_tags ON mnemosyne.nodes USING GIN((metadata->'tags'));

-- Node connections table
CREATE TABLE mnemosyne.connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES mnemosyne.nodes(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES mnemosyne.nodes(id) ON DELETE CASCADE,
    type mnemosyne.connection_type NOT NULL DEFAULT 'related',
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure no duplicate connections
    CONSTRAINT unique_connection UNIQUE(source_id, target_id, type),
    -- Prevent self-connections
    CONSTRAINT no_self_connection CHECK (source_id != target_id)
);

CREATE INDEX idx_connections_source_id ON mnemosyne.connections(source_id);
CREATE INDEX idx_connections_target_id ON mnemosyne.connections(target_id);

-- Templates table
CREATE TABLE mnemosyne.templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    fields TEXT[] NOT NULL DEFAULT '{}',
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    icon VARCHAR(50),
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID, -- Reference to Alexandria user
    
    CONSTRAINT name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_templates_category ON mnemosyne.templates(category);
CREATE INDEX idx_templates_usage_count ON mnemosyne.templates(usage_count DESC);

-- Node history table (for version control)
CREATE TABLE mnemosyne.node_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES mnemosyne.nodes(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    metadata JSONB,
    version INTEGER NOT NULL,
    changed_by UUID, -- Reference to Alexandria user
    change_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_node_history_node_id ON mnemosyne.node_history(node_id, version DESC);

-- Activity log table
CREATE TABLE mnemosyne.activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_log_user_id ON mnemosyne.activity_log(user_id, created_at DESC);
CREATE INDEX idx_activity_log_resource ON mnemosyne.activity_log(resource_type, resource_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION mnemosyne.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_nodes_updated_at BEFORE UPDATE ON mnemosyne.nodes
    FOR EACH ROW EXECUTE FUNCTION mnemosyne.update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON mnemosyne.templates
    FOR EACH ROW EXECUTE FUNCTION mnemosyne.update_updated_at_column();

-- Function to get node with children count
CREATE OR REPLACE FUNCTION mnemosyne.get_nodes_with_stats()
RETURNS TABLE (
    id UUID,
    title VARCHAR,
    content TEXT,
    type mnemosyne.node_type,
    parent_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    children_count BIGINT,
    connection_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.title,
        n.content,
        n.type,
        n.parent_id,
        n.metadata,
        n.created_at,
        n.updated_at,
        (SELECT COUNT(*) FROM mnemosyne.nodes c WHERE c.parent_id = n.id AND c.deleted_at IS NULL) as children_count,
        (SELECT COUNT(*) FROM mnemosyne.connections conn WHERE (conn.source_id = n.id OR conn.target_id = n.id)) as connection_count
    FROM mnemosyne.nodes n
    WHERE n.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function for full-text search with ranking
CREATE OR REPLACE FUNCTION mnemosyne.search_nodes(
    search_query TEXT,
    limit_count INTEGER DEFAULT 20,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    title VARCHAR,
    content TEXT,
    type mnemosyne.node_type,
    metadata JSONB,
    relevance REAL,
    headline TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.title,
        n.content,
        n.type,
        n.metadata,
        ts_rank(n.search_vector, plainto_tsquery('english', search_query)) as relevance,
        ts_headline('english', n.content, plainto_tsquery('english', search_query), 'MaxWords=50, MinWords=25') as headline
    FROM mnemosyne.nodes n
    WHERE 
        n.deleted_at IS NULL AND
        n.search_vector @@ plainto_tsquery('english', search_query)
    ORDER BY relevance DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;