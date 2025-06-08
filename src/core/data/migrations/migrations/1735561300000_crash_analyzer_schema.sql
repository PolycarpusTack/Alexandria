-- UP
-- Analysis sessions table
CREATE TABLE IF NOT EXISTS analysis_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    type VARCHAR(100) NOT NULL DEFAULT 'crash_analysis',
    error_message TEXT,
    total_files INTEGER DEFAULT 0,
    analyzed_files INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_analysis_sessions_status ON analysis_sessions(status);
CREATE INDEX idx_analysis_sessions_type ON analysis_sessions(type);
CREATE INDEX idx_analysis_sessions_created_by ON analysis_sessions(created_by);
CREATE INDEX idx_analysis_sessions_created_at ON analysis_sessions(created_at);

-- Uploaded files table
CREATE TABLE IF NOT EXISTS uploaded_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES analysis_sessions(id) ON DELETE CASCADE,
    original_name VARCHAR(500) NOT NULL,
    stored_name VARCHAR(500) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(255),
    checksum VARCHAR(64),
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
    error_message TEXT,
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_uploaded_files_session_id ON uploaded_files(session_id);
CREATE INDEX idx_uploaded_files_status ON uploaded_files(status);
CREATE INDEX idx_uploaded_files_uploaded_by ON uploaded_files(uploaded_by);
CREATE INDEX idx_uploaded_files_checksum ON uploaded_files(checksum);

-- Analysis results table
CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES analysis_sessions(id) ON DELETE CASCADE,
    file_id UUID REFERENCES uploaded_files(id) ON DELETE CASCADE,
    analysis_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    result JSONB DEFAULT '{}',
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    processing_time_ms INTEGER,
    llm_model VARCHAR(255),
    llm_tokens_used INTEGER,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analysis_results_session_id ON analysis_results(session_id);
CREATE INDEX idx_analysis_results_file_id ON analysis_results(file_id);
CREATE INDEX idx_analysis_results_analysis_type ON analysis_results(analysis_type);
CREATE INDEX idx_analysis_results_status ON analysis_results(status);
CREATE INDEX idx_analysis_results_confidence_score ON analysis_results(confidence_score);

-- Code snippets table
CREATE TABLE IF NOT EXISTS code_snippets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES analysis_sessions(id) ON DELETE CASCADE,
    language VARCHAR(50),
    content TEXT NOT NULL,
    title VARCHAR(500),
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_code_snippets_session_id ON code_snippets(session_id);
CREATE INDEX idx_code_snippets_language ON code_snippets(language);
CREATE INDEX idx_code_snippets_created_by ON code_snippets(created_by);
CREATE INDEX idx_code_snippets_is_public ON code_snippets(is_public);
CREATE INDEX idx_code_snippets_tags ON code_snippets USING GIN(tags);

-- Root causes table (extracted from analysis for quick reference)
CREATE TABLE IF NOT EXISTS root_causes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID REFERENCES analysis_results(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    evidence JSONB DEFAULT '[]',
    suggestions JSONB DEFAULT '[]',
    priority VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_root_causes_result_id ON root_causes(result_id);
CREATE INDEX idx_root_causes_category ON root_causes(category);
CREATE INDEX idx_root_causes_confidence_score ON root_causes(confidence_score);
CREATE INDEX idx_root_causes_priority ON root_causes(priority);

-- User feedback table
CREATE TABLE IF NOT EXISTS analysis_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID REFERENCES analysis_results(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    helpful BOOLEAN,
    feedback_text TEXT,
    feedback_type VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analysis_feedback_result_id ON analysis_feedback(result_id);
CREATE INDEX idx_analysis_feedback_user_id ON analysis_feedback(user_id);
CREATE INDEX idx_analysis_feedback_rating ON analysis_feedback(rating);
CREATE INDEX idx_analysis_feedback_helpful ON analysis_feedback(helpful);

-- Analysis patterns table (for learning from feedback)
CREATE TABLE IF NOT EXISTS analysis_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_type VARCHAR(100) NOT NULL,
    pattern_signature VARCHAR(500) NOT NULL,
    occurrences INTEGER DEFAULT 1,
    success_rate DECIMAL(3,2),
    metadata JSONB DEFAULT '{}',
    first_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pattern_type, pattern_signature)
);

CREATE INDEX idx_analysis_patterns_pattern_type ON analysis_patterns(pattern_type);
CREATE INDEX idx_analysis_patterns_occurrences ON analysis_patterns(occurrences);
CREATE INDEX idx_analysis_patterns_success_rate ON analysis_patterns(success_rate);

-- Create triggers for updating timestamps
CREATE TRIGGER update_analysis_sessions_updated_at BEFORE UPDATE ON analysis_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analysis_results_updated_at BEFORE UPDATE ON analysis_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_code_snippets_updated_at BEFORE UPDATE ON code_snippets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- DOWN
DROP TRIGGER IF EXISTS update_code_snippets_updated_at ON code_snippets;
DROP TRIGGER IF EXISTS update_analysis_results_updated_at ON analysis_results;
DROP TRIGGER IF EXISTS update_analysis_sessions_updated_at ON analysis_sessions;

DROP TABLE IF EXISTS analysis_patterns CASCADE;
DROP TABLE IF EXISTS analysis_feedback CASCADE;
DROP TABLE IF EXISTS root_causes CASCADE;
DROP TABLE IF EXISTS code_snippets CASCADE;
DROP TABLE IF EXISTS analysis_results CASCADE;
DROP TABLE IF EXISTS uploaded_files CASCADE;
DROP TABLE IF EXISTS analysis_sessions CASCADE;