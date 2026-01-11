-- ============================================================================
-- Migration 006: Query Optimization
-- ROM-Agent Database Optimization
-- Created: 2026-01-11
-- ============================================================================
-- Description: Advanced query optimization with materialized views and functions
-- Target: Further reduce query complexity and improve response times
-- ============================================================================

-- ============================================================================
-- MATERIALIZED VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Materialized view for conversation summaries
-- Otimiza: Dashboard queries that need conversation counts and last activity
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_conversation_stats AS
SELECT
  c.user_id,
  COUNT(*) as total_conversations,
  COUNT(*) FILTER (WHERE c.archived_at IS NULL) as active_conversations,
  COUNT(*) FILTER (WHERE c.archived_at IS NOT NULL) as archived_conversations,
  MAX(c.updated_at) as last_activity,
  COALESCE(SUM(m.message_count), 0) as total_messages
FROM conversations c
LEFT JOIN (
  SELECT conversation_id, COUNT(*) as message_count
  FROM messages
  GROUP BY conversation_id
) m ON m.conversation_id = c.id
GROUP BY c.user_id;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_conversation_stats_user
  ON mv_conversation_stats(user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to refresh conversation stats
CREATE OR REPLACE FUNCTION refresh_conversation_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_conversation_stats;
END;
$$ LANGUAGE plpgsql;

-- Function to get paginated conversations with message count
CREATE OR REPLACE FUNCTION get_user_conversations(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_include_archived BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  message_count BIGINT,
  last_message_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.created_at,
    c.updated_at,
    c.archived_at,
    COALESCE(m.cnt, 0)::BIGINT as message_count,
    m.last_msg as last_message_at
  FROM conversations c
  LEFT JOIN (
    SELECT
      conversation_id,
      COUNT(*) as cnt,
      MAX(created_at) as last_msg
    FROM messages
    GROUP BY conversation_id
  ) m ON m.conversation_id = c.id
  WHERE c.user_id = p_user_id
    AND (p_include_archived OR c.archived_at IS NULL)
  ORDER BY c.updated_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get conversation with messages
CREATE OR REPLACE FUNCTION get_conversation_with_messages(
  p_conversation_id UUID,
  p_message_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
  conversation_id UUID,
  conversation_title TEXT,
  conversation_created_at TIMESTAMP WITH TIME ZONE,
  message_id UUID,
  message_role TEXT,
  message_content TEXT,
  message_created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as conversation_id,
    c.title as conversation_title,
    c.created_at as conversation_created_at,
    msg.id as message_id,
    msg.role as message_role,
    msg.content as message_content,
    msg.created_at as message_created_at
  FROM conversations c
  LEFT JOIN LATERAL (
    SELECT m.id, m.role, m.content, m.created_at
    FROM messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at ASC
    LIMIT p_message_limit
  ) msg ON TRUE
  WHERE c.id = p_conversation_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- QUERY PLAN HINTS
-- ============================================================================

-- Set work_mem for complex queries (session level)
-- This can be set per connection for heavy operations
-- ALTER DATABASE rom_agent SET work_mem = '64MB';

-- Enable parallel query execution hints
-- ALTER DATABASE rom_agent SET max_parallel_workers_per_gather = 2;

-- ============================================================================
-- VACUUM AND MAINTENANCE
-- ============================================================================

-- Vacuum analyze all tables for optimal performance
VACUUM ANALYZE conversations;
VACUUM ANALYZE messages;
VACUUM ANALYZE documents;
VACUUM ANALYZE users;

-- ============================================================================
-- TRIGGER FOR AUTO-REFRESH (Optional - can be enabled if needed)
-- ============================================================================

-- Trigger to schedule refresh of materialized view
-- Uncomment if you want automatic refresh on conversation changes
/*
CREATE OR REPLACE FUNCTION trigger_refresh_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Queue refresh (don't block the transaction)
  PERFORM pg_notify('refresh_stats', 'conversations');
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_conversations_stats_refresh
AFTER INSERT OR UPDATE OR DELETE ON conversations
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_conversation_stats();
*/

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run to verify:
--
-- SELECT * FROM mv_conversation_stats LIMIT 5;
-- SELECT * FROM get_user_conversations('user-uuid-here', 10, 0, false);
-- ============================================================================
