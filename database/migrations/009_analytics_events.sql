-- Migration: Create Analytics Events Tables
-- Version: 009
-- Description: Tables for usability analytics and AI learning
-- Created: 2026-04-23
-- Fixed: UUID user_id, removed generated column

-- ============================================================================
-- ANALYTICS EVENTS TABLE
-- Stores all user interaction events for analysis
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,

  -- Event identification
  event_type VARCHAR(100) NOT NULL,
  event_category VARCHAR(50) NOT NULL DEFAULT 'general',

  -- User context (UUID to match users table)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),

  -- Event data
  event_data JSONB DEFAULT '{}',

  -- Performance metrics
  response_time_ms INTEGER,
  tokens_input INTEGER,
  tokens_output INTEGER,

  -- Context
  document_type VARCHAR(100),
  area_direito VARCHAR(100),
  model_used VARCHAR(100),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Date for partitioning (computed at insert, not generated)
  event_date DATE DEFAULT CURRENT_DATE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_category ON analytics_events(event_category);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_date ON analytics_events(event_date);
CREATE INDEX IF NOT EXISTS idx_analytics_events_document_type ON analytics_events(document_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_area ON analytics_events(area_direito);

-- GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_data ON analytics_events USING GIN (event_data);

-- ============================================================================
-- ANALYTICS FEEDBACK TABLE
-- Stores user feedback (thumbs up/down, ratings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_feedback (
  id SERIAL PRIMARY KEY,

  -- Reference to the event being rated
  event_id INTEGER REFERENCES analytics_events(id) ON DELETE CASCADE,

  -- User context (UUID to match users table)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),

  -- Feedback data
  feedback_type VARCHAR(50) NOT NULL, -- 'thumbs_up', 'thumbs_down', 'rating', 'comment'
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,

  -- Context
  document_type VARCHAR(100),
  generation_id VARCHAR(100),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analytics_feedback_event ON analytics_feedback(event_id);
CREATE INDEX IF NOT EXISTS idx_analytics_feedback_user ON analytics_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_feedback_type ON analytics_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_analytics_feedback_created ON analytics_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_feedback_document ON analytics_feedback(document_type);

-- ============================================================================
-- ANALYTICS DAILY AGGREGATES TABLE
-- Pre-aggregated daily metrics for fast reporting
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_daily_aggregates (
  id SERIAL PRIMARY KEY,

  -- Date dimension
  date DATE NOT NULL,

  -- Dimensions
  event_type VARCHAR(100),
  document_type VARCHAR(100),
  area_direito VARCHAR(100),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Metrics
  event_count INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  unique_sessions INTEGER DEFAULT 0,

  -- Performance metrics
  avg_response_time_ms NUMERIC(10,2),
  min_response_time_ms INTEGER,
  max_response_time_ms INTEGER,
  p50_response_time_ms INTEGER,
  p95_response_time_ms INTEGER,

  -- Token metrics
  total_tokens_input BIGINT DEFAULT 0,
  total_tokens_output BIGINT DEFAULT 0,

  -- Feedback metrics
  thumbs_up_count INTEGER DEFAULT 0,
  thumbs_down_count INTEGER DEFAULT 0,
  avg_rating NUMERIC(3,2),

  -- Error metrics
  error_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Unique constraint for upserts
  CONSTRAINT unique_daily_aggregate UNIQUE (date, event_type, document_type, area_direito, user_id)
);

-- Indexes for reporting
CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily_aggregates(date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_event ON analytics_daily_aggregates(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_document ON analytics_daily_aggregates(document_type);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_area ON analytics_daily_aggregates(area_direito);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_user ON analytics_daily_aggregates(user_id);

-- ============================================================================
-- ANALYTICS ERRORS TABLE
-- Stores error events for debugging and improvement
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_errors (
  id SERIAL PRIMARY KEY,

  -- Error identification
  error_type VARCHAR(100) NOT NULL,
  error_code VARCHAR(50),
  error_message TEXT,
  stack_trace TEXT,

  -- Context (UUID to match users table)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  request_path VARCHAR(500),
  request_method VARCHAR(10),

  -- Additional context
  document_type VARCHAR(100),
  model_used VARCHAR(100),

  -- Request data (sanitized)
  request_data JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Resolution tracking
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analytics_errors_type ON analytics_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_analytics_errors_code ON analytics_errors(error_code);
CREATE INDEX IF NOT EXISTS idx_analytics_errors_created ON analytics_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_errors_resolved ON analytics_errors(resolved);
CREATE INDEX IF NOT EXISTS idx_analytics_errors_user ON analytics_errors(user_id);

-- ============================================================================
-- ANALYTICS SESSION METRICS TABLE
-- Stores session-level metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_sessions (
  id SERIAL PRIMARY KEY,

  -- Session identification
  session_id VARCHAR(255) NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Session timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,

  -- Activity metrics
  page_views INTEGER DEFAULT 0,
  documents_generated INTEGER DEFAULT 0,
  chat_messages INTEGER DEFAULT 0,

  -- Session metadata
  user_agent TEXT,
  ip_address INET,
  referrer TEXT,

  -- Feature usage
  features_used JSONB DEFAULT '[]',

  -- Timestamps
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user ON analytics_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started ON analytics_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_last_activity ON analytics_sessions(last_activity_at DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update daily aggregates
CREATE OR REPLACE FUNCTION update_analytics_daily_aggregate()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO analytics_daily_aggregates (
    date,
    event_type,
    document_type,
    area_direito,
    user_id,
    event_count,
    avg_response_time_ms,
    min_response_time_ms,
    max_response_time_ms,
    total_tokens_input,
    total_tokens_output
  ) VALUES (
    DATE(NEW.created_at),
    NEW.event_type,
    NEW.document_type,
    NEW.area_direito,
    NEW.user_id,
    1,
    NEW.response_time_ms,
    NEW.response_time_ms,
    NEW.response_time_ms,
    COALESCE(NEW.tokens_input, 0),
    COALESCE(NEW.tokens_output, 0)
  )
  ON CONFLICT (date, event_type, document_type, area_direito, user_id)
  DO UPDATE SET
    event_count = analytics_daily_aggregates.event_count + 1,
    avg_response_time_ms = (
      (analytics_daily_aggregates.avg_response_time_ms * analytics_daily_aggregates.event_count + COALESCE(NEW.response_time_ms, 0))
      / (analytics_daily_aggregates.event_count + 1)
    ),
    min_response_time_ms = LEAST(analytics_daily_aggregates.min_response_time_ms, NEW.response_time_ms),
    max_response_time_ms = GREATEST(analytics_daily_aggregates.max_response_time_ms, NEW.response_time_ms),
    total_tokens_input = analytics_daily_aggregates.total_tokens_input + COALESCE(NEW.tokens_input, 0),
    total_tokens_output = analytics_daily_aggregates.total_tokens_output + COALESCE(NEW.tokens_output, 0),
    updated_at = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update daily aggregates
DROP TRIGGER IF EXISTS trigger_update_daily_aggregate ON analytics_events;
CREATE TRIGGER trigger_update_daily_aggregate
  AFTER INSERT ON analytics_events
  FOR EACH ROW
  EXECUTE FUNCTION update_analytics_daily_aggregate();

-- Function to update feedback counts in daily aggregates
CREATE OR REPLACE FUNCTION update_feedback_aggregate()
RETURNS TRIGGER AS $$
DECLARE
  v_event_date DATE;
  v_event_type VARCHAR(100);
  v_document_type VARCHAR(100);
  v_area_direito VARCHAR(100);
  v_user_id UUID;
BEGIN
  -- Get event details
  SELECT DATE(e.created_at), e.event_type, e.document_type, e.area_direito, e.user_id
  INTO v_event_date, v_event_type, v_document_type, v_area_direito, v_user_id
  FROM analytics_events e
  WHERE e.id = NEW.event_id;

  IF v_event_date IS NOT NULL THEN
    UPDATE analytics_daily_aggregates
    SET
      thumbs_up_count = CASE WHEN NEW.feedback_type = 'thumbs_up' THEN thumbs_up_count + 1 ELSE thumbs_up_count END,
      thumbs_down_count = CASE WHEN NEW.feedback_type = 'thumbs_down' THEN thumbs_down_count + 1 ELSE thumbs_down_count END,
      updated_at = CURRENT_TIMESTAMP
    WHERE date = v_event_date
      AND event_type = v_event_type
      AND (document_type = v_document_type OR (document_type IS NULL AND v_document_type IS NULL))
      AND (area_direito = v_area_direito OR (area_direito IS NULL AND v_area_direito IS NULL))
      AND (user_id = v_user_id OR (user_id IS NULL AND v_user_id IS NULL));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update feedback in daily aggregates
DROP TRIGGER IF EXISTS trigger_update_feedback_aggregate ON analytics_feedback;
CREATE TRIGGER trigger_update_feedback_aggregate
  AFTER INSERT ON analytics_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_aggregate();

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- View: Most generated documents
CREATE OR REPLACE VIEW v_top_documents AS
SELECT
  document_type,
  COUNT(*) as generation_count,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(response_time_ms) as avg_response_time,
  SUM(tokens_input) as total_input_tokens,
  SUM(tokens_output) as total_output_tokens
FROM analytics_events
WHERE event_type = 'document_generated'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY document_type
ORDER BY generation_count DESC;

-- View: User activity summary
CREATE OR REPLACE VIEW v_user_activity AS
SELECT
  user_id,
  DATE(created_at) as date,
  COUNT(*) as event_count,
  COUNT(DISTINCT event_type) as unique_event_types,
  SUM(CASE WHEN event_type = 'document_generated' THEN 1 ELSE 0 END) as documents_generated,
  AVG(response_time_ms) as avg_response_time
FROM analytics_events
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY user_id, DATE(created_at)
ORDER BY date DESC, event_count DESC;

-- View: Feedback summary
CREATE OR REPLACE VIEW v_feedback_summary AS
SELECT
  DATE(f.created_at) as date,
  f.document_type,
  COUNT(*) as total_feedback,
  SUM(CASE WHEN f.feedback_type = 'thumbs_up' THEN 1 ELSE 0 END) as thumbs_up,
  SUM(CASE WHEN f.feedback_type = 'thumbs_down' THEN 1 ELSE 0 END) as thumbs_down,
  ROUND(
    SUM(CASE WHEN f.feedback_type = 'thumbs_up' THEN 1.0 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100,
    2
  ) as approval_rate
FROM analytics_feedback f
WHERE f.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(f.created_at), f.document_type
ORDER BY date DESC;

-- View: Error summary
CREATE OR REPLACE VIEW v_error_summary AS
SELECT
  DATE(created_at) as date,
  error_type,
  error_code,
  COUNT(*) as error_count,
  COUNT(DISTINCT user_id) as affected_users
FROM analytics_errors
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), error_type, error_code
ORDER BY date DESC, error_count DESC;

-- ============================================================================
-- TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE analytics_events IS 'Main analytics events table for tracking user interactions';
COMMENT ON TABLE analytics_feedback IS 'User feedback on generated content (thumbs up/down, ratings)';
COMMENT ON TABLE analytics_daily_aggregates IS 'Pre-aggregated daily metrics for fast reporting';
COMMENT ON TABLE analytics_errors IS 'Error tracking for debugging and improvement';
COMMENT ON TABLE analytics_sessions IS 'Session-level metrics and activity tracking';
