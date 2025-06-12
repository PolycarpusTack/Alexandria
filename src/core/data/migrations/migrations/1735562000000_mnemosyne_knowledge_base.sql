-- MNEMOSYNE KNOWLEDGE MANAGEMENT SCHEMA
-- This migration creates the core tables for Mnemosyne's knowledge management system

-- UP
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Knowledge Nodes Table
-- Core table for storing all knowledge items (documents, concepts, notes, etc.)
CREATE TABLE IF NOT EXISTS mnemosyne_knowledge_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(600) UNIQUE NOT NULL,
    content TEXT,
    content_type VARCHAR(50) DEFAULT 'markdown',
    node_type VARCHAR(50) NOT NULL CHECK (node_type IN ('DOCUMENT', 'CONCEPT', 'PERSON', 'PROJECT', 'TASK', 'NOTE', 'REFERENCE', 'TEMPLATE')),
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'DELETED')),
    visibility VARCHAR(20) DEFAULT 'PRIVATE' CHECK (visibility IN ('PUBLIC', 'PRIVATE', 'RESTRICTED')),
    
    -- Metadata
    description TEXT,
    keywords TEXT[],
    tags TEXT[] DEFAULT '{}',
    language VARCHAR(10) DEFAULT 'en',
    
    -- Hierarchy support
    parent_id UUID REFERENCES mnemosyne_knowledge_nodes(id) ON DELETE SET NULL,
    position INTEGER DEFAULT 0,
    
    -- Template support
    template_id UUID REFERENCES mnemosyne_knowledge_nodes(id) ON DELETE SET NULL,
    
    -- Content metadata
    content_hash VARCHAR(64),
    content_size INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    
    -- User tracking
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    owned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Statistics
    view_count INTEGER DEFAULT 0,
    edit_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0 CHECK (rating >= 0.0 AND rating <= 5.0),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE,
    last_viewed_at TIMESTAMP WITH TIME ZONE,
    last_edited_at TIMESTAMP WITH TIME ZONE,
    
    -- Version control
    version INTEGER DEFAULT 1,
    
    -- Source tracking
    source_url TEXT,
    source_type VARCHAR(50),
    import_metadata JSONB DEFAULT '{}',
    
    -- Additional metadata stored as JSON
    metadata JSONB DEFAULT '{}',
    
    -- Search vector for full-text search
    search_vector tsvector
);

-- Knowledge Relationships Table
-- Stores relationships between knowledge nodes
CREATE TABLE IF NOT EXISTS mnemosyne_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES mnemosyne_knowledge_nodes(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES mnemosyne_knowledge_nodes(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN (
        'REFERENCES', 'TAGS', 'RELATED', 'CONTAINS', 'DEPENDS_ON', 
        'SIMILAR_TO', 'PART_OF', 'FOLLOWS', 'MENTIONS', 'SUPERSEDES',
        'IMPLEMENTS', 'EXTENDS', 'USES', 'CONFLICTS_WITH'
    )),
    
    -- Relationship properties
    weight DECIMAL(3,2) DEFAULT 1.0 CHECK (weight >= 0.0 AND weight <= 1.0),
    bidirectional BOOLEAN DEFAULT false,
    strength DECIMAL(3,2) DEFAULT 1.0 CHECK (strength >= 0.0 AND strength <= 1.0),
    confidence DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    
    -- Relationship metadata
    description TEXT,
    context TEXT,
    evidence TEXT,
    automatic BOOLEAN DEFAULT false, -- true if created by AI/algorithm
    verified BOOLEAN DEFAULT false,  -- true if manually verified
    
    -- User tracking
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional properties stored as JSON
    properties JSONB DEFAULT '{}',
    
    -- Prevent duplicate relationships
    UNIQUE(source_id, target_id, relationship_type)
);

-- Knowledge Node Versions Table
-- Stores version history for knowledge nodes
CREATE TABLE IF NOT EXISTS mnemosyne_node_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES mnemosyne_knowledge_nodes(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    
    -- Snapshot of node data at this version
    title VARCHAR(500) NOT NULL,
    content TEXT,
    content_type VARCHAR(50),
    status VARCHAR(20),
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    
    -- Version metadata
    change_summary TEXT,
    change_type VARCHAR(50) DEFAULT 'UPDATE' CHECK (change_type IN ('CREATE', 'UPDATE', 'DELETE', 'RESTORE')),
    
    -- User tracking
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Version-specific data
    content_diff JSONB, -- Stores diff from previous version
    
    UNIQUE(node_id, version)
);

-- Knowledge Templates Table
-- Stores templates for creating new knowledge nodes
CREATE TABLE IF NOT EXISTS mnemosyne_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    content TEXT NOT NULL,
    
    -- Template configuration
    node_type VARCHAR(50) NOT NULL,
    default_tags TEXT[] DEFAULT '{}',
    required_fields TEXT[] DEFAULT '{}',
    optional_fields TEXT[] DEFAULT '{}',
    
    -- Template variables and schema
    variables JSONB DEFAULT '[]',     -- Array of variable definitions
    schema JSONB DEFAULT '{}',        -- JSON schema for validation
    example_data JSONB DEFAULT '{}', -- Example data for template
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- User tracking
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Template metadata
    metadata JSONB DEFAULT '{}',
    
    -- Status
    active BOOLEAN DEFAULT true,
    public BOOLEAN DEFAULT false
);

-- Knowledge Collections Table
-- Allows grouping of related knowledge nodes
CREATE TABLE IF NOT EXISTS mnemosyne_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7), -- Hex color code
    icon VARCHAR(50),
    
    -- Collection properties
    collection_type VARCHAR(50) DEFAULT 'MANUAL' CHECK (collection_type IN ('MANUAL', 'DYNAMIC', 'SMART')),
    query_criteria JSONB, -- For dynamic collections
    
    -- Access control
    visibility VARCHAR(20) DEFAULT 'PRIVATE' CHECK (visibility IN ('PUBLIC', 'PRIVATE', 'RESTRICTED')),
    
    -- User tracking
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- Knowledge Collection Members Table
-- Many-to-many relationship between collections and nodes
CREATE TABLE IF NOT EXISTS mnemosyne_collection_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection_id UUID NOT NULL REFERENCES mnemosyne_collections(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES mnemosyne_knowledge_nodes(id) ON DELETE CASCADE,
    
    -- Member properties
    position INTEGER DEFAULT 0,
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Notes about why this node is in this collection
    notes TEXT,
    
    -- Prevent duplicates
    UNIQUE(collection_id, node_id)
);

-- Knowledge Node Activities Table
-- Tracks activities/events on knowledge nodes
CREATE TABLE IF NOT EXISTS mnemosyne_node_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES mnemosyne_knowledge_nodes(id) ON DELETE CASCADE,
    
    -- Activity details
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
        'CREATED', 'UPDATED', 'VIEWED', 'SHARED', 'COMMENTED', 
        'RATED', 'TAGGED', 'LINKED', 'EXPORTED', 'IMPORTED',
        'PUBLISHED', 'ARCHIVED', 'RESTORED', 'DELETED'
    )),
    description TEXT,
    
    -- User and context
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    
    -- Activity metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_title ON mnemosyne_knowledge_nodes(title);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_slug ON mnemosyne_knowledge_nodes(slug);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_type ON mnemosyne_knowledge_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_status ON mnemosyne_knowledge_nodes(status);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_created_by ON mnemosyne_knowledge_nodes(created_by);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_created_at ON mnemosyne_knowledge_nodes(created_at);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_updated_at ON mnemosyne_knowledge_nodes(updated_at);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_parent ON mnemosyne_knowledge_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_tags ON mnemosyne_knowledge_nodes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_nodes_search ON mnemosyne_knowledge_nodes USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_mnemosyne_relationships_source ON mnemosyne_relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_relationships_target ON mnemosyne_relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_relationships_type ON mnemosyne_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_relationships_weight ON mnemosyne_relationships(weight);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_relationships_created_at ON mnemosyne_relationships(created_at);

CREATE INDEX IF NOT EXISTS idx_mnemosyne_versions_node ON mnemosyne_node_versions(node_id);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_versions_version ON mnemosyne_node_versions(node_id, version);

CREATE INDEX IF NOT EXISTS idx_mnemosyne_templates_category ON mnemosyne_templates(category);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_templates_node_type ON mnemosyne_templates(node_type);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_templates_active ON mnemosyne_templates(active);

CREATE INDEX IF NOT EXISTS idx_mnemosyne_collections_type ON mnemosyne_collections(collection_type);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_collections_visibility ON mnemosyne_collections(visibility);

CREATE INDEX IF NOT EXISTS idx_mnemosyne_activities_node ON mnemosyne_node_activities(node_id);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_activities_type ON mnemosyne_node_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_activities_user ON mnemosyne_node_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_mnemosyne_activities_created_at ON mnemosyne_node_activities(created_at);

-- Create trigger function to update search vector
CREATE OR REPLACE FUNCTION mnemosyne_update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C') ||
        setweight(to_tsvector('english', array_to_string(NEW.tags, ' ')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
CREATE TRIGGER mnemosyne_knowledge_nodes_search_vector_update
    BEFORE INSERT OR UPDATE OF title, content, description, tags
    ON mnemosyne_knowledge_nodes
    FOR EACH ROW
    EXECUTE FUNCTION mnemosyne_update_search_vector();

-- Create trigger function to update timestamps
CREATE OR REPLACE FUNCTION mnemosyne_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update timestamps
CREATE TRIGGER mnemosyne_knowledge_nodes_update_timestamp
    BEFORE UPDATE ON mnemosyne_knowledge_nodes
    FOR EACH ROW
    EXECUTE FUNCTION mnemosyne_update_timestamp();

CREATE TRIGGER mnemosyne_relationships_update_timestamp
    BEFORE UPDATE ON mnemosyne_relationships
    FOR EACH ROW
    EXECUTE FUNCTION mnemosyne_update_timestamp();

CREATE TRIGGER mnemosyne_templates_update_timestamp
    BEFORE UPDATE ON mnemosyne_templates
    FOR EACH ROW
    EXECUTE FUNCTION mnemosyne_update_timestamp();

CREATE TRIGGER mnemosyne_collections_update_timestamp
    BEFORE UPDATE ON mnemosyne_collections
    FOR EACH ROW
    EXECUTE FUNCTION mnemosyne_update_timestamp();

-- Create function to generate unique slugs
CREATE OR REPLACE FUNCTION mnemosyne_generate_slug(title_text TEXT, node_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 1;
BEGIN
    -- Create base slug from title
    base_slug := lower(trim(regexp_replace(title_text, '[^a-zA-Z0-9\s]', '', 'g')));
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := trim(base_slug, '-');
    
    -- Ensure slug is not empty
    IF base_slug = '' THEN
        base_slug := 'untitled';
    END IF;
    
    -- Check if slug is unique
    final_slug := base_slug;
    
    WHILE EXISTS (
        SELECT 1 FROM mnemosyne_knowledge_nodes 
        WHERE slug = final_slug 
        AND (node_id IS NULL OR id != node_id)
    ) LOOP
        final_slug := base_slug || '-' || counter;
        counter := counter + 1;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Create function to get node statistics
CREATE OR REPLACE FUNCTION mnemosyne_get_node_statistics()
RETURNS TABLE (
    total_nodes BIGINT,
    nodes_by_type JSONB,
    recent_activity BIGINT,
    top_tags JSONB,
    top_authors JSONB,
    growth_stats JSONB
) AS $$
DECLARE
    one_day_ago TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP - INTERVAL '1 day';
    one_week_ago TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP - INTERVAL '1 week';
    one_month_ago TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP - INTERVAL '1 month';
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM mnemosyne_knowledge_nodes WHERE status != 'DELETED')::BIGINT as total_nodes,
        
        (SELECT jsonb_object_agg(node_type, count)
         FROM (
             SELECT node_type, COUNT(*) as count
             FROM mnemosyne_knowledge_nodes 
             WHERE status != 'DELETED'
             GROUP BY node_type
         ) t)::JSONB as nodes_by_type,
        
        (SELECT COUNT(*) FROM mnemosyne_node_activities WHERE created_at >= one_day_ago)::BIGINT as recent_activity,
        
        (SELECT jsonb_agg(jsonb_build_object('tag', tag, 'count', count) ORDER BY count DESC)
         FROM (
             SELECT unnest(tags) as tag, COUNT(*) as count
             FROM mnemosyne_knowledge_nodes 
             WHERE status != 'DELETED' AND tags IS NOT NULL
             GROUP BY unnest(tags)
             ORDER BY count DESC
             LIMIT 10
         ) t)::JSONB as top_tags,
        
        (SELECT jsonb_agg(jsonb_build_object('author', author_name, 'count', count) ORDER BY count DESC)
         FROM (
             SELECT u.username as author_name, COUNT(*) as count
             FROM mnemosyne_knowledge_nodes kn
             LEFT JOIN users u ON kn.created_by = u.id
             WHERE kn.status != 'DELETED'
             GROUP BY u.username
             ORDER BY count DESC
             LIMIT 10
         ) t)::JSONB as top_authors,
        
        (SELECT jsonb_build_object(
            'daily', (SELECT COUNT(*) FROM mnemosyne_knowledge_nodes WHERE created_at >= one_day_ago),
            'weekly', (SELECT COUNT(*) FROM mnemosyne_knowledge_nodes WHERE created_at >= one_week_ago),
            'monthly', (SELECT COUNT(*) FROM mnemosyne_knowledge_nodes WHERE created_at >= one_month_ago)
        ))::JSONB as growth_stats;
END;
$$ LANGUAGE plpgsql;

-- Insert some default templates
INSERT INTO mnemosyne_templates (name, category, description, content, node_type, variables, created_at) VALUES
('Basic Document', 'documentation', 'Simple document template with title and content', '# {{title}}

{{description}}

## Content

{{content}}

## Tags
{{#each tags}}
- {{this}}
{{/each}}

---
*Created on {{date}}*', 'DOCUMENT', 
'[{"name": "title", "type": "string", "required": true}, {"name": "description", "type": "string"}, {"name": "content", "type": "text", "required": true}, {"name": "tags", "type": "array"}, {"name": "date", "type": "date", "default": "now"}]', 
CURRENT_TIMESTAMP),

('Meeting Notes', 'meetings', 'Template for meeting notes with agenda and action items', '# {{meeting_title}} - {{date}}

**Attendees:** {{attendees}}
**Duration:** {{duration}}
**Location:** {{location}}

## Agenda
{{agenda}}

## Discussion Points
{{discussion}}

## Decisions Made
{{decisions}}

## Action Items
{{#each action_items}}
- [ ] {{this.task}} - @{{this.assignee}} (Due: {{this.due_date}})
{{/each}}

## Next Steps
{{next_steps}}', 'NOTE',
'[{"name": "meeting_title", "type": "string", "required": true}, {"name": "date", "type": "date", "default": "now"}, {"name": "attendees", "type": "string"}, {"name": "duration", "type": "string"}, {"name": "location", "type": "string"}, {"name": "agenda", "type": "text"}, {"name": "discussion", "type": "text"}, {"name": "decisions", "type": "text"}, {"name": "action_items", "type": "array"}, {"name": "next_steps", "type": "text"}]',
CURRENT_TIMESTAMP),

('API Documentation', 'technical', 'Template for documenting APIs', '# {{api_name}} API

## Overview
{{description}}

**Base URL:** {{base_url}}
**Version:** {{version}}
**Authentication:** {{auth_type}}

## Endpoints

{{#each endpoints}}
### {{method}} {{path}}
{{description}}

**Parameters:**
{{#each parameters}}
- `{{name}}` ({{type}}) {{#if required}}*required*{{/if}} - {{description}}
{{/each}}

**Response:**
```json
{{response_example}}
```
{{/each}}

## Error Codes
{{error_codes}}

## Rate Limiting
{{rate_limiting}}', 'REFERENCE',
'[{"name": "api_name", "type": "string", "required": true}, {"name": "description", "type": "text"}, {"name": "base_url", "type": "string"}, {"name": "version", "type": "string"}, {"name": "auth_type", "type": "string"}, {"name": "endpoints", "type": "array"}, {"name": "error_codes", "type": "text"}, {"name": "rate_limiting", "type": "text"}]',
CURRENT_TIMESTAMP);

-- DOWN
DROP TRIGGER IF EXISTS mnemosyne_collections_update_timestamp ON mnemosyne_collections;
DROP TRIGGER IF EXISTS mnemosyne_templates_update_timestamp ON mnemosyne_templates;
DROP TRIGGER IF EXISTS mnemosyne_relationships_update_timestamp ON mnemosyne_relationships;
DROP TRIGGER IF EXISTS mnemosyne_knowledge_nodes_update_timestamp ON mnemosyne_knowledge_nodes;
DROP TRIGGER IF EXISTS mnemosyne_knowledge_nodes_search_vector_update ON mnemosyne_knowledge_nodes;

DROP FUNCTION IF EXISTS mnemosyne_get_node_statistics();
DROP FUNCTION IF EXISTS mnemosyne_generate_slug(TEXT, UUID);
DROP FUNCTION IF EXISTS mnemosyne_update_timestamp();
DROP FUNCTION IF EXISTS mnemosyne_update_search_vector();

DROP TABLE IF EXISTS mnemosyne_node_activities;
DROP TABLE IF EXISTS mnemosyne_collection_members;
DROP TABLE IF EXISTS mnemosyne_collections;
DROP TABLE IF EXISTS mnemosyne_templates;
DROP TABLE IF EXISTS mnemosyne_node_versions;
DROP TABLE IF EXISTS mnemosyne_relationships;
DROP TABLE IF EXISTS mnemosyne_knowledge_nodes;