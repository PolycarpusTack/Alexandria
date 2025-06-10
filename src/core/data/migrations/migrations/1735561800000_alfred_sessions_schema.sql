-- Create table for Alfred chat sessions

-- Create alfred_sessions table
CREATE TABLE IF NOT EXISTS alfred_sessions (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  project_id VARCHAR(36),
  messages JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(36),
  
  -- Foreign key constraint (optional, depends on your user table)
  -- CONSTRAINT fk_alfred_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_alfred_sessions_user_id ON alfred_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_alfred_sessions_project_id ON alfred_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_alfred_sessions_created_at ON alfred_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alfred_sessions_updated_at ON alfred_sessions(updated_at DESC);

-- Full text search index for message content
CREATE INDEX IF NOT EXISTS idx_alfred_sessions_messages_gin ON alfred_sessions USING gin(messages);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_alfred_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the updated_at column
CREATE TRIGGER alfred_sessions_updated_at_trigger
  BEFORE UPDATE ON alfred_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_alfred_sessions_updated_at();

-- Create table for Alfred templates
CREATE TABLE IF NOT EXISTS alfred_templates (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  language VARCHAR(50),
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT true,
  user_id VARCHAR(36),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for templates
CREATE INDEX IF NOT EXISTS idx_alfred_templates_category ON alfred_templates(category);
CREATE INDEX IF NOT EXISTS idx_alfred_templates_language ON alfred_templates(language);
CREATE INDEX IF NOT EXISTS idx_alfred_templates_user_id ON alfred_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_alfred_templates_is_public ON alfred_templates(is_public);

-- Full text search for template content
CREATE INDEX IF NOT EXISTS idx_alfred_templates_search ON alfred_templates USING gin(
  to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || content)
);

-- Trigger for template updated_at
CREATE TRIGGER alfred_templates_updated_at_trigger
  BEFORE UPDATE ON alfred_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_alfred_sessions_updated_at();

-- Grant permissions (adjust based on your user roles)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON alfred_sessions TO alexandria_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON alfred_templates TO alexandria_app;