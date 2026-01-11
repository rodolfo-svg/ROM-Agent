-- ============================================================================
-- Migration 005: Performance Indexes
-- ROM-Agent Database Optimization
-- Created: 2026-01-11
-- ============================================================================
-- Description: Creates critical indexes for query optimization
-- Target: Reduce p95 query latency to < 50ms
-- ============================================================================

-- Safety: Use CONCURRENTLY to avoid blocking reads/writes in production
-- Note: CONCURRENTLY cannot run inside a transaction block

-- ============================================================================
-- CONVERSATION INDEXES
-- ============================================================================

-- Index composto para listagem de conversas por usuário
-- Otimiza: SELECT * FROM conversations WHERE user_id = ? AND archived_at IS NULL ORDER BY updated_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_user_updated
  ON conversations(user_id, updated_at DESC)
  WHERE archived_at IS NULL;

-- Index parcial para conversas ativas (não arquivadas)
-- Otimiza: Queries que filtram apenas conversas não arquivadas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_active
  ON conversations(user_id, archived_at)
  WHERE archived_at IS NULL;

-- ============================================================================
-- MESSAGE INDEXES
-- ============================================================================

-- Index para mensagens ordenadas por data de criação
-- Otimiza: SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at ASC);

-- Index para busca de mensagens por role (user/assistant)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_role
  ON messages(conversation_id, role);

-- ============================================================================
-- DOCUMENT INDEXES
-- ============================================================================

-- Index para documentos por caso (excluindo deletados)
-- Otimiza: SELECT * FROM documents WHERE case_id = ? AND deleted_at IS NULL
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_case_id
  ON documents(case_id)
  WHERE deleted_at IS NULL;

-- Index para documentos por tipo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_type
  ON documents(document_type)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- USER INDEXES
-- ============================================================================

-- Index para busca de usuários por email (apenas ativos)
-- Otimiza: SELECT * FROM users WHERE email = ? AND active = true
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email
  ON users(email)
  WHERE active = true;

-- Index para listagem de usuários por data de criação
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at
  ON users(created_at DESC)
  WHERE active = true;

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================
-- Update statistics for the query planner

ANALYZE conversations;
ANALYZE messages;
ANALYZE documents;
ANALYZE users;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify indexes were created:
--
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('conversations', 'messages', 'documents', 'users')
--   AND indexname LIKE 'idx_%';
--
-- Check index usage:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
-- FROM pg_stat_user_indexes
-- WHERE indexname LIKE 'idx_%';
-- ============================================================================
