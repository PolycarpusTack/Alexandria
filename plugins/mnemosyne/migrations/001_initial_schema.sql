-- Mnemosyne Initial Database Schema
-- Version: 0.1.0
-- Description: Core tables for knowledge management system

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create extension for full-text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Knowledge nodes table
CREATE TABLE IF NOT EXISTS mnemosyne_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'note',
    slug VARCHAR(255) UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    tags JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    search_vector tsvector,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    parent_id UUID REFERENCES mnemosyne_nodes(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT mnemosyne_nodes_type_check CHECK (type IN ('note', 'document', 'concept', 'person', 'project', 'task', 'reference')),
    CONSTRAINT mnemosyne_nodes_status_check CHECK (status IN ('draft', 'published', 'archived', 'deleted'))
);

-- Relationships table for connecting knowledge nodes
CREATE TABLE IF NOT EXISTS mnemosyne_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES mnemosyne_nodes(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES mnemosyne_nodes(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL DEFAULT 'related',
    weight DECIMAL(3,2) DEFAULT 1.0,
    bidirectional BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT mnemosyne_relationships_type_check CHECK (type IN ('parent_child', 'reference', 'similar', 'related', 'prerequisite', 'derived_from', 'contradicts', 'supports')),
    CONSTRAINT mnemosyne_relationships_weight_check CHECK (weight >= 0.0 AND weight <= 1.0),
    CONSTRAINT mnemosyne_relationships_no_self_reference CHECK (source_id != target_id),
    UNIQUE(source_id, target_id, type)
);

-- Node versions table for tracking changes
CREATE TABLE IF NOT EXISTS mnemosyne_node_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES mnemosyne_nodes(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    changes JSONB DEFAULT '[]'::jsonb,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(node_id, version)
);

-- Templates table for code generation and documentation
CREATE TABLE IF NOT EXISTS mnemosyne_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    template_content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_public BOOLEAN DEFAULT false,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    
    UNIQUE(name, created_by)
);

-- Search index table for advanced search capabilities
CREATE TABLE IF NOT EXISTS mnemosyne_search_index (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES mnemosyne_nodes(id) ON DELETE CASCADE,
    content_hash VARCHAR(64) NOT NULL,
    indexed_content tsvector NOT NULL,
    keywords JSONB DEFAULT '[]'::jsonb,
    concepts JSONB DEFAULT '[]'::jsonb,
    last_indexed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(node_id)
);

-- User preferences for the plugin
CREATE TABLE IF NOT EXISTS mnemosyne_user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Analytics and metrics table
CREATE TABLE IF NOT EXISTS mnemosyne_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    user_id UUID,
    session_id VARCHAR(255),
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index for analytics queries
    CHECK (event_type IN ('node_created', 'node_viewed', 'node_updated', 'relationship_created', 'search_performed', 'template_applied'))
);

-- Indexes for performance optimization

-- Knowledge nodes indexes
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_type ON mnemosyne_nodes(type);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_status ON mnemosyne_nodes(status);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_created_by ON mnemosyne_nodes(created_by);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_created_at ON mnemosyne_nodes(created_at);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_updated_at ON mnemosyne_nodes(updated_at);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_parent_id ON mnemosyne_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_tags ON mnemosyne_nodes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_metadata ON mnemosyne_nodes USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_search_vector ON mnemosyne_nodes USING GIN(search_vector);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_title_trgm ON mnemosyne_nodes USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_content_trgm ON mnemosyne_nodes USING GIN(content gin_trgm_ops);

-- Relationships indexes
CREATE INDEX IF NOT EXISTS idx_mnemosyne_relationships_source_id ON mnemosyne_relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_relationships_target_id ON mnemosyne_relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_relationships_type ON mnemosyne_relationships(type);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_relationships_weight ON mnemosyne_relationships(weight);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_relationships_bidirectional ON mnemosyne_relationships(bidirectional);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mnemosyne_relationships_source_type ON mnemosyne_relationships(source_id, type);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_relationships_target_type ON mnemosyne_relationships(target_id, type);

-- Node versions indexes
CREATE INDEX IF NOT EXISTS idx_mnemosyne_node_versions_node_id ON mnemosyne_node_versions(node_id);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_node_versions_version ON mnemosyne_node_versions(node_id, version);

-- Templates indexes
CREATE INDEX IF NOT EXISTS idx_mnemosyne_templates_category ON mnemosyne_templates(category);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_templates_public ON mnemosyne_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_templates_created_by ON mnemosyne_templates(created_by);

-- Search index
CREATE INDEX IF NOT EXISTS idx_mnemosyne_search_index_content ON mnemosyne_search_index USING GIN(indexed_content);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_search_index_keywords ON mnemosyne_search_index USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_search_index_concepts ON mnemosyne_search_index USING GIN(concepts);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_mnemosyne_analytics_event_type ON mnemosyne_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_analytics_entity ON mnemosyne_analytics(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_analytics_user_id ON mnemosyne_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_analytics_created_at ON mnemosyne_analytics(created_at);

-- Triggers and functions

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_mnemosyne_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector = to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search vector
CREATE TRIGGER trigger_update_mnemosyne_search_vector
    BEFORE INSERT OR UPDATE ON mnemosyne_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_mnemosyne_search_vector();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mnemosyne_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at timestamp
CREATE TRIGGER trigger_mnemosyne_nodes_updated_at
    BEFORE UPDATE ON mnemosyne_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_mnemosyne_updated_at();

CREATE TRIGGER trigger_mnemosyne_relationships_updated_at
    BEFORE UPDATE ON mnemosyne_relationships
    FOR EACH ROW
    EXECUTE FUNCTION update_mnemosyne_updated_at();

CREATE TRIGGER trigger_mnemosyne_templates_updated_at
    BEFORE UPDATE ON mnemosyne_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_mnemosyne_updated_at();

-- Function to create node version on update
CREATE OR REPLACE FUNCTION create_mnemosyne_node_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create version if title or content changed
    IF OLD.title != NEW.title OR COALESCE(OLD.content, '') != COALESCE(NEW.content, '') THEN
        INSERT INTO mnemosyne_node_versions (node_id, version, title, content, changes, created_by)
        VALUES (
            OLD.id,
            OLD.version,
            OLD.title,
            OLD.content,
            jsonb_build_array(
                jsonb_build_object(
                    'field', 'title',
                    'old_value', OLD.title,
                    'new_value', NEW.title
                ),
                jsonb_build_object(
                    'field', 'content',
                    'old_value', OLD.content,
                    'new_value', NEW.content
                )
            ),
            NEW.updated_by
        );
        
        -- Increment version
        NEW.version = OLD.version + 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create versions
CREATE TRIGGER trigger_create_mnemosyne_node_version
    BEFORE UPDATE ON mnemosyne_nodes
    FOR EACH ROW
    EXECUTE FUNCTION create_mnemosyne_node_version();

-- Views for common queries

-- View for node relationships with details
CREATE OR REPLACE VIEW mnemosyne_node_relationships AS
SELECT 
    r.id as relationship_id,
    r.type as relationship_type,
    r.weight,
    r.bidirectional,
    r.metadata as relationship_metadata,
    sn.id as source_id,
    sn.title as source_title,
    sn.type as source_type,
    tn.id as target_id,
    tn.title as target_title,
    tn.type as target_type,
    r.created_at as relationship_created_at
FROM mnemosyne_relationships r
JOIN mnemosyne_nodes sn ON r.source_id = sn.id
JOIN mnemosyne_nodes tn ON r.target_id = tn.id
WHERE sn.status != 'deleted' AND tn.status != 'deleted';

-- View for node statistics
CREATE OR REPLACE VIEW mnemosyne_node_stats AS
SELECT 
    n.id,
    n.title,
    n.type,
    n.created_at,
    COALESCE(outgoing.count, 0) as outgoing_relationships,
    COALESCE(incoming.count, 0) as incoming_relationships,
    COALESCE(versions.count, 0) as version_count
FROM mnemosyne_nodes n
LEFT JOIN (
    SELECT source_id, COUNT(*) as count
    FROM mnemosyne_relationships
    GROUP BY source_id
) outgoing ON n.id = outgoing.source_id
LEFT JOIN (
    SELECT target_id, COUNT(*) as count
    FROM mnemosyne_relationships
    GROUP BY target_id
) incoming ON n.id = incoming.target_id
LEFT JOIN (
    SELECT node_id, COUNT(*) as count
    FROM mnemosyne_node_versions
    GROUP BY node_id
) versions ON n.id = versions.node_id
WHERE n.status != 'deleted';

-- Insert initial data

-- Insert default template categories
INSERT INTO mnemosyne_templates (name, description, category, template_content, variables, is_public, created_by)
VALUES 
    ('Basic Note', 'Simple note template', 'general', '# {{title}}\n\n{{content}}', '[{"name": "title", "type": "string", "required": true}, {"name": "content", "type": "text", "required": false}]', true, uuid_generate_v4()),
    ('Meeting Notes', 'Template for meeting notes', 'business', '# Meeting: {{title}}\n\n**Date:** {{date}}\n**Attendees:** {{attendees}}\n\n## Agenda\n{{agenda}}\n\n## Notes\n{{notes}}\n\n## Action Items\n{{actionItems}}', '[{"name": "title", "type": "string", "required": true}, {"name": "date", "type": "date", "required": true}, {"name": "attendees", "type": "string", "required": false}, {"name": "agenda", "type": "text", "required": false}, {"name": "notes", "type": "text", "required": false}, {"name": "actionItems", "type": "text", "required": false}]', true, uuid_generate_v4()),
    ('Project Overview', 'Template for project documentation', 'project', '# Project: {{title}}\n\n**Status:** {{status}}\n**Start Date:** {{startDate}}\n**End Date:** {{endDate}}\n\n## Description\n{{description}}\n\n## Objectives\n{{objectives}}\n\n## Resources\n{{resources}}', '[{"name": "title", "type": "string", "required": true}, {"name": "status", "type": "select", "options": ["planning", "in-progress", "completed", "on-hold"], "required": true}, {"name": "startDate", "type": "date", "required": false}, {"name": "endDate", "type": "date", "required": false}, {"name": "description", "type": "text", "required": false}, {"name": "objectives", "type": "text", "required": false}, {"name": "resources", "type": "text", "required": false}]', true, uuid_generate_v4())
ON CONFLICT (name, created_by) DO NOTHING;