-- ════════════════════════════════════════════════════════════════
-- ROM AGENT - DATABASE SCHEMA UNIFICADO v2.7.0
-- ════════════════════════════════════════════════════════════════
-- MIGRATION 001: Schema inicial completo
-- Consolidação de database/migrations/001_initial_schema.sql
-- ════════════════════════════════════════════════════════════════

-- Habilitar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ════════════════════════════════════════════════════════════════
-- TABELA: users
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  oab VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

-- ════════════════════════════════════════════════════════════════
-- TABELA: sessions (express-session)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions(expire);

-- ════════════════════════════════════════════════════════════════
-- TABELA: conversations (SCHEMA UNIFICADO)
-- Combina colunas de 001_initial_schema + 004_conversations + 005_deleted_at
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL DEFAULT 'Nova Conversa',
  mode VARCHAR(50) DEFAULT 'juridico',
  model VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations(user_id);
CREATE INDEX IF NOT EXISTS conversations_created_at_idx ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_archived_at_idx ON conversations(archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS conversations_deleted_at_idx ON conversations(deleted_at);

COMMENT ON TABLE conversations IS 'Conversas do chat (histórico)';
COMMENT ON COLUMN conversations.title IS 'Título da conversa (gerado do primeiro prompt)';
COMMENT ON COLUMN conversations.mode IS 'Modo de operação (juridico, geral, etc)';
COMMENT ON COLUMN conversations.archived_at IS 'Conversa arquivada (não deletada)';
COMMENT ON COLUMN conversations.deleted_at IS 'Soft delete - conversa deletada mas preservada';

-- ════════════════════════════════════════════════════════════════
-- TABELA: messages (SCHEMA UNIFICADO)
-- Unifica 'messages' e 'conversation_messages' em uma única tabela
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model VARCHAR(100),
  tokens_input INTEGER,
  tokens_output INTEGER,
  latency_ms INTEGER,
  stop_reason VARCHAR(50),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at ASC);

COMMENT ON TABLE messages IS 'Mensagens dentro de cada conversa';
COMMENT ON COLUMN messages.role IS 'user, assistant ou system';
COMMENT ON COLUMN messages.model IS 'Modelo usado para gerar resposta (ex: claude-sonnet-4.5)';

-- ════════════════════════════════════════════════════════════════
-- TABELA: projects
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  project_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);

-- ════════════════════════════════════════════════════════════════
-- TABELA: documents
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  document_type VARCHAR(100),
  content TEXT,
  file_path VARCHAR(1000),
  file_size INTEGER,
  mime_type VARCHAR(100),
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS documents_project_id_idx ON documents(project_id);
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);
CREATE INDEX IF NOT EXISTS documents_document_type_idx ON documents(document_type);

-- ════════════════════════════════════════════════════════════════
-- TABELA: uploads
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  original_filename VARCHAR(500) NOT NULL,
  stored_filename VARCHAR(500) NOT NULL,
  file_path VARCHAR(1000) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  upload_status VARCHAR(50) DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS uploads_user_id_idx ON uploads(user_id);
CREATE INDEX IF NOT EXISTS uploads_upload_status_idx ON uploads(upload_status);

-- ════════════════════════════════════════════════════════════════
-- TABELA: ai_operations
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ai_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  operation_type VARCHAR(100) NOT NULL,
  model VARCHAR(100),
  tokens_input INTEGER,
  tokens_output INTEGER,
  latency_ms INTEGER,
  status VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ai_operations_user_id_idx ON ai_operations(user_id);
CREATE INDEX IF NOT EXISTS ai_operations_operation_type_idx ON ai_operations(operation_type);
CREATE INDEX IF NOT EXISTS ai_operations_created_at_idx ON ai_operations(created_at DESC);

-- ════════════════════════════════════════════════════════════════
-- TABELA: audit_log
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_user_id_idx ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at DESC);

-- ════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ════════════════════════════════════════════════════════════════
-- Schema criado com sucesso!
-- Tabelas criadas:
--   - users, sessions
--   - conversations, messages
--   - projects, documents, uploads
--   - ai_operations, audit_log
