-- Analytics Performance Optimizations (Fixed)
-- Migration: 1735561700000_analytics_performance_optimizations.sql

-- Create materialized view for hourly aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS analysis_results_hourly_mv AS
SELECT 
  date_trunc('hour', created_at) as hour,
  analysis_type,
  status,
  COUNT(*) as analysis_count,
  AVG(confidence_score) as avg_confidence,
  AVG(processing_time_ms) as avg_processing_time,
  COUNT(DISTINCT session_id) as unique_sessions
FROM analysis_results
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY hour, analysis_type, status;

-- Create index on materialized view
CREATE INDEX idx_analysis_results_hourly_mv_hour 
  ON analysis_results_hourly_mv(hour DESC);
CREATE INDEX idx_analysis_results_hourly_mv_type 
  ON analysis_results_hourly_mv(analysis_type);
CREATE INDEX idx_analysis_results_hourly_mv_status 
  ON analysis_results_hourly_mv(status);

-- Create materialized view for daily aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS analysis_results_daily_mv AS
SELECT 
  date_trunc('day', created_at) as day,
  analysis_type,
  status,
  COUNT(*) as analysis_count,
  AVG(confidence_score) as avg_confidence,
  AVG(processing_time_ms) as avg_processing_time,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(DISTINCT file_id) as unique_files,
  -- Pre-calculate percentiles for performance
  percentile_cont(0.5) WITHIN GROUP (ORDER BY confidence_score) as median_confidence,
  percentile_cont(0.9) WITHIN GROUP (ORDER BY confidence_score) as p90_confidence
FROM analysis_results
WHERE created_at >= NOW() - INTERVAL '365 days'
GROUP BY day, analysis_type, status;

-- Create indexes for daily view
CREATE INDEX idx_analysis_results_daily_mv_day 
  ON analysis_results_daily_mv(day DESC);
CREATE INDEX idx_analysis_results_daily_mv_composite 
  ON analysis_results_daily_mv(day DESC, analysis_type, status);

-- Create table for pre-calculated model performance metrics
CREATE TABLE IF NOT EXISTS model_performance_metrics (
  id SERIAL PRIMARY KEY,
  model_name VARCHAR(255) NOT NULL,
  metric_date DATE NOT NULL,
  request_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  total_latency_ms BIGINT DEFAULT 0,
  min_latency_ms INTEGER,
  max_latency_ms INTEGER,
  p50_latency_ms INTEGER,
  p90_latency_ms INTEGER,
  p95_latency_ms INTEGER,
  p99_latency_ms INTEGER,
  total_cost DECIMAL(10, 4) DEFAULT 0,
  avg_confidence_score DECIMAL(5, 4),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(model_name, metric_date)
);

-- Create indexes for model performance
CREATE INDEX idx_model_performance_metrics_date 
  ON model_performance_metrics(metric_date DESC);
CREATE INDEX idx_model_performance_metrics_model 
  ON model_performance_metrics(model_name, metric_date DESC);

-- Create table for analytics cache metadata
CREATE TABLE IF NOT EXISTS analytics_cache (
  cache_key VARCHAR(64) PRIMARY KEY,
  cache_type VARCHAR(50) NOT NULL,
  data_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  size_bytes INTEGER
);

-- Create index for cache cleanup
CREATE INDEX idx_analytics_cache_expires 
  ON analytics_cache(expires_at);
CREATE INDEX idx_analytics_cache_type 
  ON analytics_cache(cache_type, created_at DESC);

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  -- Refresh hourly view
  REFRESH MATERIALIZED VIEW CONCURRENTLY analysis_results_hourly_mv;
  
  -- Refresh daily view
  REFRESH MATERIALIZED VIEW CONCURRENTLY analysis_results_daily_mv;
  
  -- Log refresh if system_logs table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_logs') THEN
    INSERT INTO system_logs (level, message, metadata)
    VALUES ('info', 'Analytics views refreshed', 
      jsonb_build_object('timestamp', NOW()));
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to update model performance metrics
CREATE OR REPLACE FUNCTION update_model_performance_metrics()
RETURNS void AS $$
BEGIN
  INSERT INTO model_performance_metrics (
    model_name,
    metric_date,
    request_count,
    success_count,
    failure_count,
    total_latency_ms,
    min_latency_ms,
    max_latency_ms,
    p50_latency_ms,
    p90_latency_ms,
    p95_latency_ms,
    p99_latency_ms,
    total_cost,
    avg_confidence_score
  )
  SELECT 
    COALESCE(llm_model, 'unknown') as model_name,
    DATE(created_at) as metric_date,
    COUNT(*) as request_count,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as success_count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failure_count,
    SUM(processing_time_ms) as total_latency_ms,
    MIN(processing_time_ms) as min_latency_ms,
    MAX(processing_time_ms) as max_latency_ms,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY processing_time_ms) as p50_latency_ms,
    percentile_cont(0.9) WITHIN GROUP (ORDER BY processing_time_ms) as p90_latency_ms,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY processing_time_ms) as p95_latency_ms,
    percentile_cont(0.99) WITHIN GROUP (ORDER BY processing_time_ms) as p99_latency_ms,
    SUM(COALESCE(llm_tokens_used::numeric * 0.001, 0)) as total_cost, -- Rough estimate
    AVG(confidence_score) as avg_confidence_score
  FROM analysis_results
  WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
    AND llm_model IS NOT NULL
  GROUP BY llm_model, DATE(created_at)
  ON CONFLICT (model_name, metric_date) 
  DO UPDATE SET
    request_count = EXCLUDED.request_count,
    success_count = EXCLUDED.success_count,
    failure_count = EXCLUDED.failure_count,
    total_latency_ms = EXCLUDED.total_latency_ms,
    min_latency_ms = EXCLUDED.min_latency_ms,
    max_latency_ms = EXCLUDED.max_latency_ms,
    p50_latency_ms = EXCLUDED.p50_latency_ms,
    p90_latency_ms = EXCLUDED.p90_latency_ms,
    p95_latency_ms = EXCLUDED.p95_latency_ms,
    p99_latency_ms = EXCLUDED.p99_latency_ms,
    total_cost = EXCLUDED.total_cost,
    avg_confidence_score = EXCLUDED.avg_confidence_score,
    updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;
-- Add query optimization hints
ALTER TABLE analysis_results SET (autovacuum_vacuum_scale_factor = 0.1);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_analysis_results_analytics_composite 
  ON analysis_results(created_at DESC, analysis_type, status);

CREATE INDEX IF NOT EXISTS idx_analysis_results_model_perf 
  ON analysis_results(llm_model, created_at DESC, status)
  INCLUDE (processing_time_ms, confidence_score, llm_tokens_used)
  WHERE llm_model IS NOT NULL;

-- Add comment explaining the changes
COMMENT ON MATERIALIZED VIEW analysis_results_hourly_mv IS 'Hourly aggregations of analysis results for performance dashboards';
COMMENT ON MATERIALIZED VIEW analysis_results_daily_mv IS 'Daily aggregations of analysis results for trend analysis';
COMMENT ON TABLE model_performance_metrics IS 'Pre-calculated metrics for LLM model performance tracking';
COMMENT ON TABLE analytics_cache IS 'Metadata for analytics query result caching';
