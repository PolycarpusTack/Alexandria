-- Update sessions table for session storage

-- Add new columns if they don't exist
ALTER TABLE sessions 
  ADD COLUMN IF NOT EXISTS username VARCHAR(255),
  ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add check constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_expires_at_check'
  ) THEN
    ALTER TABLE sessions
    ADD CONSTRAINT sessions_expires_at_check CHECK (expires_at > created_at);
  END IF;
END
$$;

-- Create additional indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires_at);

-- Function to automatically clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS void AS $$
BEGIN
  DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;