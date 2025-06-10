-- Mnemosyne Plugin Initial Schema
-- Knowledge Graph and Document Management Database Schema
-- PostgreSQL with advanced indexing and constraints

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create custom types
CREATE TYPE node_type AS ENUM (
  'document', 'concept', 'person', 'organization', 
  'topic', 'keyword', 'template', 'folder', 'tag', 'custom'
);

CREATE TYPE relationship_type AS ENUM (
  'links-to', 'references', 'depends-on', 'part-of', 
  'similar-to', 'contradicts', 'extends', 'implements', 
  'uses', 'custom'
);

CREATE TYPE document_status AS ENUM (
  'draft', 'published', 'archived', 'deleted', 'reviewing', 'approved'
);

CREATE TYPE content_type AS ENUM ('markdown', 'html', 'plain');

CREATE TYPE import_status AS ENUM (
  'pending', 'analyzing', 'importing', 'completed', 'failed', 'cancelled'
);

CREATE TYPE export_status AS ENUM (
  'pending', 'preparing', 'exporting', 'completed', 'failed'
);

-- Documents table - Core document storage
CREATE TABLE mnemosyne_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  content TEXT,
  content_type content_type DEFAULT 'markdown',
  status document_status DEFAULT 'draft',
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  category VARCHAR(100),
  description TEXT,
  
  -- Timestamps
  created TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  modified TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_accessed TIMESTAMPTZ,
  
  -- Authorship
  author VARCHAR(100) NOT NULL,
  contributors TEXT[] DEFAULT '{}',
  
  -- Version control
  version INTEGER DEFAULT 1 NOT NULL,
  parent_version UUID REFERENCES mnemosyne_documents(id),
  
  -- Template information
  template_id UUID,
  template_variables JSONB DEFAULT '{}',
  
  -- Import/Export tracking
  provenance JSONB DEFAULT '{}',
  
  -- Collaboration
  collaborators TEXT[] DEFAULT '{}',
  permissions JSONB DEFAULT '{}',
  
  -- Analytics
  view_count INTEGER DEFAULT 0,
  edit_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  export_count INTEGER DEFAULT 0,
  
  -- Custom metadata
  metadata JSONB DEFAULT '{}',
  
  -- Search vectors for full-text search
  search_vector tsvector,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT valid_version CHECK (version > 0),
  CONSTRAINT valid_counts CHECK (
    view_count >= 0 AND edit_count >= 0 AND 
    share_count >= 0 AND export_count >= 0
  )
);

-- Knowledge nodes table - Graph vertices
CREATE TABLE mnemosyne_knowledge_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type node_type NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT,
  
  -- Position and visualization
  position JSONB DEFAULT '{}',
  
  -- Graph properties
  weight DECIMAL(10,4) DEFAULT 1.0,
  centrality DECIMAL(10,6),
  clustering DECIMAL(10,6),
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  category VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  modified TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Reference to document if applicable
  document_id UUID REFERENCES mnemosyne_documents(id) ON DELETE CASCADE,
  
  -- Analytics
  connections_count INTEGER DEFAULT 0,
  inbound_connections INTEGER DEFAULT 0,
  outbound_connections INTEGER DEFAULT 0,
  page_rank DECIMAL(10,6) DEFAULT 0.0,
  betweenness_centrality DECIMAL(10,6) DEFAULT 0.0,
  clustering_coefficient DECIMAL(10,6) DEFAULT 0.0,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ,
  
  -- Search vector
  search_vector tsvector,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT valid_weight CHECK (weight >= 0),
  CONSTRAINT valid_centrality CHECK (centrality >= 0 AND centrality <= 1),
  CONSTRAINT valid_clustering CHECK (clustering >= 0 AND clustering <= 1),
  CONSTRAINT valid_counts CHECK (
    connections_count >= 0 AND inbound_connections >= 0 AND 
    outbound_connections >= 0 AND access_count >= 0
  )
);

-- Knowledge relationships table - Graph edges
CREATE TABLE mnemosyne_knowledge_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES mnemosyne_knowledge_nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES mnemosyne_knowledge_nodes(id) ON DELETE CASCADE,
  type relationship_type NOT NULL,
  
  -- Relationship properties
  strength DECIMAL(10,4) DEFAULT 1.0,
  confidence DECIMAL(10,4) DEFAULT 1.0,
  bidirectional BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  description TEXT,
  evidence TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  modified TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by VARCHAR(100) NOT NULL,
  
  -- Analytics
  access_count INTEGER DEFAULT 0,
  last_traversed TIMESTAMPTZ,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT valid_strength CHECK (strength >= 0 AND strength <= 10),
  CONSTRAINT valid_confidence CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT no_self_reference CHECK (source_id != target_id),
  CONSTRAINT valid_access_count CHECK (access_count >= 0),
  
  -- Unique constraint to prevent duplicate relationships
  UNIQUE(source_id, target_id, type)
);

-- Document versions table - Version history
CREATE TABLE mnemosyne_document_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES mnemosyne_documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  changes TEXT[] DEFAULT '{}',
  author VARCHAR(100) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  comment TEXT,
  
  CONSTRAINT valid_version CHECK (version > 0),
  UNIQUE(document_id, version)
);

-- Templates table
CREATE TABLE mnemosyne_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  
  -- Template content
  content TEXT NOT NULL,
  engine VARCHAR(20) DEFAULT 'handlebars',
  
  -- Variables
  variables JSONB DEFAULT '[]',
  required_variables TEXT[] DEFAULT '{}',
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  author VARCHAR(100) NOT NULL,
  version VARCHAR(20) DEFAULT '1.0.0',
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMPTZ,
  
  -- AI generation
  generated_by VARCHAR(20),
  generation_prompt TEXT,
  
  -- Timestamps
  created TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  modified TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Template relationships
  parent_template UUID REFERENCES mnemosyne_templates(id),
  
  -- Configuration
  config JSONB DEFAULT '{}',
  
  -- Search vector
  search_vector tsvector,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT valid_usage_count CHECK (usage_count >= 0),
  CONSTRAINT valid_engine CHECK (engine IN ('handlebars', 'mustache', 'liquid'))
);

-- Import sessions table
CREATE TABLE mnemosyne_import_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source JSONB NOT NULL,
  status import_status DEFAULT 'pending',
  
  -- Progress tracking
  progress DECIMAL(5,2) DEFAULT 0.0,
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  
  -- Results
  documents_imported INTEGER DEFAULT 0,
  relationships_created INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  
  -- Configuration
  options JSONB DEFAULT '{}',
  
  -- Metadata
  started TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed TIMESTAMPTZ,
  duration INTEGER, -- in milliseconds
  
  -- Error tracking
  errors JSONB DEFAULT '[]',
  warnings JSONB DEFAULT '[]',
  
  -- Analytics
  analytics JSONB DEFAULT '{}',
  
  CONSTRAINT valid_progress CHECK (progress >= 0 AND progress <= 100),
  CONSTRAINT valid_counts CHECK (
    total_items >= 0 AND processed_items >= 0 AND 
    documents_imported >= 0 AND relationships_created >= 0 AND 
    errors_count >= 0
  )
);

-- Export sessions table
CREATE TABLE mnemosyne_export_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  format VARCHAR(50) NOT NULL,
  status export_status DEFAULT 'pending',
  
  -- Configuration
  documents JSONB NOT NULL,
  options JSONB DEFAULT '{}',
  template_id UUID REFERENCES mnemosyne_templates(id),
  
  -- Progress
  progress DECIMAL(5,2) DEFAULT 0.0,
  
  -- Results
  output_path TEXT,
  file_size BIGINT,
  
  -- Timestamps
  started TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed TIMESTAMPTZ,
  
  -- Error tracking
  errors JSONB DEFAULT '[]',
  
  CONSTRAINT valid_progress CHECK (progress >= 0 AND progress <= 100),
  CONSTRAINT valid_file_size CHECK (file_size >= 0)
);

-- View events table for analytics
CREATE TABLE mnemosyne_view_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES mnemosyne_documents(id) ON DELETE CASCADE,
  user_id VARCHAR(100) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  duration INTEGER, -- in milliseconds
  source VARCHAR(100),
  metadata JSONB DEFAULT '{}'
);

-- Search queries table for analytics
CREATE TABLE mnemosyne_search_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query TEXT NOT NULL,
  type VARCHAR(20) NOT NULL,
  filters JSONB DEFAULT '{}',
  results_count INTEGER,
  duration INTEGER, -- in milliseconds
  user_id VARCHAR(100),
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT valid_results_count CHECK (results_count >= 0),
  CONSTRAINT valid_duration CHECK (duration >= 0)
);

-- Plugin state table for persistence
CREATE TABLE mnemosyne_plugin_state (
  plugin_id VARCHAR(50) NOT NULL,
  key VARCHAR(200) NOT NULL,
  value JSONB NOT NULL,
  updated TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  PRIMARY KEY (plugin_id, key)
);

-- Plugin snapshots table
CREATE TABLE mnemosyne_plugin_snapshots (
  plugin_id VARCHAR(50) NOT NULL,
  snapshot_id VARCHAR(100) NOT NULL,
  data JSONB NOT NULL,
  created TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  PRIMARY KEY (plugin_id, snapshot_id)
);

-- Indexes for performance optimization

-- Documents indexes
CREATE INDEX idx_documents_title ON mnemosyne_documents USING gin(title gin_trgm_ops);
CREATE INDEX idx_documents_tags ON mnemosyne_documents USING gin(tags);
CREATE INDEX idx_documents_status ON mnemosyne_documents(status);
CREATE INDEX idx_documents_author ON mnemosyne_documents(author);
CREATE INDEX idx_documents_created ON mnemosyne_documents(created);
CREATE INDEX idx_documents_modified ON mnemosyne_documents(modified);
CREATE INDEX idx_documents_category ON mnemosyne_documents(category);
CREATE INDEX idx_documents_search_vector ON mnemosyne_documents USING gin(search_vector);
CREATE INDEX idx_documents_template_id ON mnemosyne_documents(template_id);
CREATE INDEX idx_documents_deleted_at ON mnemosyne_documents(deleted_at) WHERE deleted_at IS NULL;

-- Knowledge nodes indexes
CREATE INDEX idx_nodes_type ON mnemosyne_knowledge_nodes(type);
CREATE INDEX idx_nodes_title ON mnemosyne_knowledge_nodes USING gin(title gin_trgm_ops);
CREATE INDEX idx_nodes_tags ON mnemosyne_knowledge_nodes USING gin(tags);
CREATE INDEX idx_nodes_created ON mnemosyne_knowledge_nodes(created);
CREATE INDEX idx_nodes_weight ON mnemosyne_knowledge_nodes(weight);
CREATE INDEX idx_nodes_centrality ON mnemosyne_knowledge_nodes(centrality);
CREATE INDEX idx_nodes_page_rank ON mnemosyne_knowledge_nodes(page_rank);
CREATE INDEX idx_nodes_document_id ON mnemosyne_knowledge_nodes(document_id);
CREATE INDEX idx_nodes_search_vector ON mnemosyne_knowledge_nodes USING gin(search_vector);
CREATE INDEX idx_nodes_position ON mnemosyne_knowledge_nodes USING gin(position);
CREATE INDEX idx_nodes_deleted_at ON mnemosyne_knowledge_nodes(deleted_at) WHERE deleted_at IS NULL;

-- Knowledge relationships indexes
CREATE INDEX idx_relationships_source ON mnemosyne_knowledge_relationships(source_id);
CREATE INDEX idx_relationships_target ON mnemosyne_knowledge_relationships(target_id);
CREATE INDEX idx_relationships_type ON mnemosyne_knowledge_relationships(type);
CREATE INDEX idx_relationships_strength ON mnemosyne_knowledge_relationships(strength);
CREATE INDEX idx_relationships_confidence ON mnemosyne_knowledge_relationships(confidence);
CREATE INDEX idx_relationships_created ON mnemosyne_knowledge_relationships(created);
CREATE INDEX idx_relationships_created_by ON mnemosyne_knowledge_relationships(created_by);
CREATE INDEX idx_relationships_bidirectional ON mnemosyne_knowledge_relationships(bidirectional);
CREATE INDEX idx_relationships_deleted_at ON mnemosyne_knowledge_relationships(deleted_at) WHERE deleted_at IS NULL;

-- Composite indexes for common queries
CREATE INDEX idx_relationships_source_target ON mnemosyne_knowledge_relationships(source_id, target_id);
CREATE INDEX idx_relationships_target_source ON mnemosyne_knowledge_relationships(target_id, source_id);
CREATE INDEX idx_relationships_type_strength ON mnemosyne_knowledge_relationships(type, strength DESC);

-- Templates indexes
CREATE INDEX idx_templates_name ON mnemosyne_templates USING gin(name gin_trgm_ops);
CREATE INDEX idx_templates_category ON mnemosyne_templates(category);
CREATE INDEX idx_templates_tags ON mnemosyne_templates USING gin(tags);
CREATE INDEX idx_templates_author ON mnemosyne_templates(author);
CREATE INDEX idx_templates_usage_count ON mnemosyne_templates(usage_count DESC);
CREATE INDEX idx_templates_created ON mnemosyne_templates(created);
CREATE INDEX idx_templates_search_vector ON mnemosyne_templates USING gin(search_vector);
CREATE INDEX idx_templates_parent_template ON mnemosyne_templates(parent_template);
CREATE INDEX idx_templates_deleted_at ON mnemosyne_templates(deleted_at) WHERE deleted_at IS NULL;

-- Import/Export sessions indexes
CREATE INDEX idx_import_sessions_status ON mnemosyne_import_sessions(status);
CREATE INDEX idx_import_sessions_started ON mnemosyne_import_sessions(started);
CREATE INDEX idx_export_sessions_status ON mnemosyne_export_sessions(status);
CREATE INDEX idx_export_sessions_started ON mnemosyne_export_sessions(started);

-- Analytics indexes
CREATE INDEX idx_view_events_document_id ON mnemosyne_view_events(document_id);
CREATE INDEX idx_view_events_user_id ON mnemosyne_view_events(user_id);
CREATE INDEX idx_view_events_timestamp ON mnemosyne_view_events(timestamp);
CREATE INDEX idx_search_queries_timestamp ON mnemosyne_search_queries(timestamp);
CREATE INDEX idx_search_queries_user_id ON mnemosyne_search_queries(user_id);

-- Version history indexes
CREATE INDEX idx_document_versions_document_id ON mnemosyne_document_versions(document_id);
CREATE INDEX idx_document_versions_version ON mnemosyne_document_versions(document_id, version);

-- Plugin state indexes
CREATE INDEX idx_plugin_state_updated ON mnemosyne_plugin_state(updated);
CREATE INDEX idx_plugin_snapshots_created ON mnemosyne_plugin_snapshots(created);

-- Functions for automatic search vector updates
CREATE OR REPLACE FUNCTION update_document_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.title, '') || ' ' || 
    COALESCE(NEW.content, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_node_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.title, '') || ' ' || 
    COALESCE(NEW.content, '') || ' ' ||
    COALESCE(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_template_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.name, '') || ' ' || 
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic search vector updates
CREATE TRIGGER trigger_document_search_vector_update
  BEFORE INSERT OR UPDATE ON mnemosyne_documents
  FOR EACH ROW EXECUTE FUNCTION update_document_search_vector();

CREATE TRIGGER trigger_node_search_vector_update
  BEFORE INSERT OR UPDATE ON mnemosyne_knowledge_nodes
  FOR EACH ROW EXECUTE FUNCTION update_node_search_vector();

CREATE TRIGGER trigger_template_search_vector_update
  BEFORE INSERT OR UPDATE ON mnemosyne_templates
  FOR EACH ROW EXECUTE FUNCTION update_template_search_vector();

-- Function to update node connection counts
CREATE OR REPLACE FUNCTION update_node_connection_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update source node
  IF TG_OP = 'INSERT' THEN
    UPDATE mnemosyne_knowledge_nodes SET 
      connections_count = connections_count + 1,
      outbound_connections = outbound_connections + 1
    WHERE id = NEW.source_id;
    
    UPDATE mnemosyne_knowledge_nodes SET 
      connections_count = connections_count + 1,
      inbound_connections = inbound_connections + 1
    WHERE id = NEW.target_id;
    
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE mnemosyne_knowledge_nodes SET 
      connections_count = GREATEST(0, connections_count - 1),
      outbound_connections = GREATEST(0, outbound_connections - 1)
    WHERE id = OLD.source_id;
    
    UPDATE mnemosyne_knowledge_nodes SET 
      connections_count = GREATEST(0, connections_count - 1),
      inbound_connections = GREATEST(0, inbound_connections - 1)
    WHERE id = OLD.target_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating connection counts
CREATE TRIGGER trigger_update_node_connection_counts
  AFTER INSERT OR DELETE ON mnemosyne_knowledge_relationships
  FOR EACH ROW EXECUTE FUNCTION update_node_connection_counts();

-- Function to update document modified timestamp
CREATE OR REPLACE FUNCTION update_modified_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modified := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamp updates
CREATE TRIGGER trigger_document_modified_update
  BEFORE UPDATE ON mnemosyne_documents
  FOR EACH ROW EXECUTE FUNCTION update_modified_timestamp();

CREATE TRIGGER trigger_node_modified_update
  BEFORE UPDATE ON mnemosyne_knowledge_nodes
  FOR EACH ROW EXECUTE FUNCTION update_modified_timestamp();

CREATE TRIGGER trigger_relationship_modified_update
  BEFORE UPDATE ON mnemosyne_knowledge_relationships
  FOR EACH ROW EXECUTE FUNCTION update_modified_timestamp();

CREATE TRIGGER trigger_template_modified_update
  BEFORE UPDATE ON mnemosyne_templates
  FOR EACH ROW EXECUTE FUNCTION update_modified_timestamp();

-- Views for common queries

-- Active documents view (non-deleted)
CREATE VIEW mnemosyne_active_documents AS
SELECT * FROM mnemosyne_documents 
WHERE deleted_at IS NULL;

-- Active nodes view (non-deleted)
CREATE VIEW mnemosyne_active_nodes AS
SELECT * FROM mnemosyne_knowledge_nodes 
WHERE deleted_at IS NULL;

-- Active relationships view (non-deleted)
CREATE VIEW mnemosyne_active_relationships AS
SELECT * FROM mnemosyne_knowledge_relationships 
WHERE deleted_at IS NULL;

-- Active templates view (non-deleted)
CREATE VIEW mnemosyne_active_templates AS
SELECT * FROM mnemosyne_templates 
WHERE deleted_at IS NULL;

-- Document with node view
CREATE VIEW mnemosyne_documents_with_nodes AS
SELECT 
  d.*,
  n.id as node_id,
  n.weight as node_weight,
  n.centrality as node_centrality,
  n.page_rank as node_page_rank,
  n.connections_count as node_connections
FROM mnemosyne_active_documents d
LEFT JOIN mnemosyne_active_nodes n ON d.id = n.document_id;

-- Graph statistics view
CREATE VIEW mnemosyne_graph_stats AS
SELECT 
  COUNT(*) as total_nodes,
  COUNT(DISTINCT type) as node_types,
  AVG(connections_count) as avg_connections,
  MAX(connections_count) as max_connections,
  AVG(weight) as avg_weight,
  COUNT(*) FILTER (WHERE connections_count = 0) as isolated_nodes
FROM mnemosyne_active_nodes;

-- Relationship statistics view
CREATE VIEW mnemosyne_relationship_stats AS
SELECT 
  type,
  COUNT(*) as count,
  AVG(strength) as avg_strength,
  AVG(confidence) as avg_confidence,
  COUNT(*) FILTER (WHERE bidirectional = true) as bidirectional_count
FROM mnemosyne_active_relationships
GROUP BY type;

-- Performance optimization: Partial indexes for common filters
CREATE INDEX idx_documents_published ON mnemosyne_documents(created) 
WHERE status = 'published' AND deleted_at IS NULL;

CREATE INDEX idx_nodes_high_centrality ON mnemosyne_knowledge_nodes(centrality) 
WHERE centrality > 0.5 AND deleted_at IS NULL;

CREATE INDEX idx_relationships_strong ON mnemosyne_knowledge_relationships(strength) 
WHERE strength > 5.0 AND deleted_at IS NULL;

-- Comments for documentation
COMMENT ON TABLE mnemosyne_documents IS 'Core document storage with full-text search and version control';
COMMENT ON TABLE mnemosyne_knowledge_nodes IS 'Knowledge graph vertices with analytics and positioning';
COMMENT ON TABLE mnemosyne_knowledge_relationships IS 'Knowledge graph edges with strength and confidence metrics';
COMMENT ON TABLE mnemosyne_templates IS 'Template system with variables and usage tracking';
COMMENT ON TABLE mnemosyne_import_sessions IS 'Import operation tracking and analytics';
COMMENT ON TABLE mnemosyne_export_sessions IS 'Export operation tracking and results';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mnemosyne_app;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO mnemosyne_app;