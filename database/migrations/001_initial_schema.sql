-- ROM Agent - Schema Inicial v2.5.0
-- PostgreSQL Database Schema para persistência de dados

-- ============================================================================
-- EXTENSÕES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para busca fuzzy

-- ============================================================================
-- TABELA: users
-- Usuários do sistema
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'guest')),
  oab VARCHAR(20), -- OAB/UF do advogado
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================================================
-- TABELA: sessions
-- Sessões de usuário (express-session)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessions_expire ON sessions(expire);

-- ============================================================================
-- TABELA: conversations
-- Conversas com a IA
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500),
  mode VARCHAR(50) DEFAULT 'juridico' CHECK (mode IN ('juridico', 'geral', 'analise', 'redacao')),
  model VARCHAR(100), -- claude-3-5-sonnet-v2@20241022
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Estatísticas
  message_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost DECIMAL(10,4) DEFAULT 0
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);
CREATE INDEX idx_conversations_mode ON conversations(mode);
CREATE INDEX idx_conversations_archived ON conversations(archived_at) WHERE archived_at IS NOT NULL;

-- ============================================================================
-- TABELA: messages
-- Mensagens individuais nas conversas
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata da geração
  model VARCHAR(100),
  tokens_input INTEGER,
  tokens_output INTEGER,
  latency_ms INTEGER,
  stop_reason VARCHAR(50),

  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_role ON messages(role);

-- ============================================================================
-- TABELA: projects
-- Projetos jurídicos (cases, processos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  type VARCHAR(100), -- 'processo', 'consulta', 'parecer', etc
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),

  -- Dados do processo (se aplicável)
  processo_numero VARCHAR(50),
  cliente_nome VARCHAR(255),
  parte_contraria VARCHAR(255),
  comarca VARCHAR(255),
  vara VARCHAR(255),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_processo_numero ON projects(processo_numero) WHERE processo_numero IS NOT NULL;
CREATE INDEX idx_projects_created_at ON projects(created_at);

-- ============================================================================
-- TABELA: documents
-- Documentos gerados (peças, pareceres, contratos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  title VARCHAR(500) NOT NULL,
  type VARCHAR(100), -- 'petição inicial', 'contestação', 'parecer', etc
  content TEXT NOT NULL,
  format VARCHAR(20) DEFAULT 'markdown' CHECK (format IN ('markdown', 'html', 'docx', 'pdf')),

  -- Storage
  file_path VARCHAR(1000), -- Se armazenado em S3/filesystem
  file_size BIGINT,
  file_hash VARCHAR(64), -- SHA256 para deduplicação

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  metadata JSONB DEFAULT '{}'::jsonb,

  -- Full-text search
  search_vector TSVECTOR
);

CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_documents_conversation_id ON documents(conversation_id);
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_documents_search ON documents USING GIN(search_vector);

-- Trigger para atualizar search_vector automaticamente
CREATE OR REPLACE FUNCTION documents_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_update_documents
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION documents_search_trigger();

-- ============================================================================
-- TABELA: uploads
-- Arquivos enviados pelos usuários
-- ============================================================================
CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  original_filename VARCHAR(500) NOT NULL,
  stored_filename VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  file_size BIGINT,
  file_hash VARCHAR(64), -- SHA256

  -- Storage location
  storage_type VARCHAR(20) DEFAULT 'local' CHECK (storage_type IN ('local', 's3', 'gcs')),
  storage_path VARCHAR(1000),
  storage_url VARCHAR(1000),

  -- Processamento
  processed BOOLEAN DEFAULT FALSE,
  extracted_text TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_uploads_user_id ON uploads(user_id);
CREATE INDEX idx_uploads_project_id ON uploads(project_id);
CREATE INDEX idx_uploads_file_hash ON uploads(file_hash);
CREATE INDEX idx_uploads_created_at ON uploads(created_at);

-- ============================================================================
-- TABELA: ai_operations
-- Log de operações de IA (auditoria, billing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  operation_type VARCHAR(50) NOT NULL, -- 'chat', 'generate', 'analyze', etc
  model VARCHAR(100) NOT NULL,
  provider VARCHAR(50) DEFAULT 'aws-bedrock',

  -- Tokens e custo
  tokens_input INTEGER,
  tokens_output INTEGER,
  total_tokens INTEGER,
  estimated_cost DECIMAL(10,6),

  -- Performance
  latency_ms INTEGER,
  stop_reason VARCHAR(50),

  -- Fallback tracking
  fallback_used BOOLEAN DEFAULT FALSE,
  fallback_reason VARCHAR(100),

  -- Circuit breaker
  circuit_breaker_triggered BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_ai_operations_user_id ON ai_operations(user_id);
CREATE INDEX idx_ai_operations_conversation_id ON ai_operations(conversation_id);
CREATE INDEX idx_ai_operations_created_at ON ai_operations(created_at);
CREATE INDEX idx_ai_operations_model ON ai_operations(model);
CREATE INDEX idx_ai_operations_provider ON ai_operations(provider);

-- ============================================================================
-- TABELA: audit_log
-- Log de auditoria de ações do sistema
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  action VARCHAR(100) NOT NULL, -- 'login', 'create_document', 'delete_project', etc
  resource_type VARCHAR(50), -- 'document', 'project', 'conversation'
  resource_id UUID,

  ip_address INET,
  user_agent TEXT,

  -- Mudanças (para operações de UPDATE)
  old_values JSONB,
  new_values JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Estatísticas por usuário
CREATE OR REPLACE VIEW user_stats AS
SELECT
  u.id AS user_id,
  u.email,
  u.name,
  COUNT(DISTINCT c.id) AS total_conversations,
  COUNT(DISTINCT p.id) AS total_projects,
  COUNT(DISTINCT d.id) AS total_documents,
  COALESCE(SUM(ao.total_tokens), 0) AS total_tokens_used,
  COALESCE(SUM(ao.estimated_cost), 0) AS total_cost,
  MAX(c.created_at) AS last_conversation_at,
  MAX(u.last_login_at) AS last_login_at
FROM users u
LEFT JOIN conversations c ON c.user_id = u.id
LEFT JOIN projects p ON p.user_id = u.id
LEFT JOIN documents d ON d.user_id = u.id
LEFT JOIN ai_operations ao ON ao.user_id = u.id
GROUP BY u.id, u.email, u.name;

-- Conversas recentes com estatísticas
CREATE OR REPLACE VIEW recent_conversations AS
SELECT
  c.id,
  c.user_id,
  c.title,
  c.mode,
  c.model,
  c.created_at,
  c.updated_at,
  COUNT(m.id) AS message_count,
  COALESCE(SUM(m.tokens_input), 0) + COALESCE(SUM(m.tokens_output), 0) AS total_tokens
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.archived_at IS NULL
GROUP BY c.id
ORDER BY c.updated_at DESC;

-- ============================================================================
-- FUNÇÕES AUXILIARES
-- ============================================================================

-- Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas relevantes
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DADOS INICIAIS
-- ============================================================================

-- Usuário admin padrão (senha: admin123 - TROCAR EM PRODUÇÃO!)
-- Hash bcrypt de 'admin123'
INSERT INTO users (email, password_hash, name, role)
VALUES (
  'admin@iarom.com.br',
  '$2a$10$Z3vQZ5xK8X7Z5xK8X7Z5xOZ3vQZ5xK8X7Z5xK8X7Z5xOZ3vQZ5xK8X',
  'Administrador',
  'admin'
) ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================
COMMENT ON TABLE users IS 'Usuários do sistema ROM Agent';
COMMENT ON TABLE conversations IS 'Conversas com IA - histórico de interações';
COMMENT ON TABLE messages IS 'Mensagens individuais dentro das conversas';
COMMENT ON TABLE projects IS 'Projetos jurídicos (processos, casos)';
COMMENT ON TABLE documents IS 'Documentos gerados pela IA';
COMMENT ON TABLE uploads IS 'Arquivos enviados pelos usuários';
COMMENT ON TABLE ai_operations IS 'Log de operações de IA para auditoria e billing';
COMMENT ON TABLE audit_log IS 'Log de auditoria de ações do sistema';

-- ============================================================================
-- FIM DO SCHEMA
-- ============================================================================
