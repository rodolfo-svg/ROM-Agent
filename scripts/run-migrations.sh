#!/bin/bash
# ══════════════════════════════════════════════════════════════
# SCRIPT DE MIGRAÇÃO AUTOMÁTICA - ROM Agent v2.6.0
# ══════════════════════════════════════════════════════════════
# Execute no Shell do Render após provisionar PostgreSQL
#
# Uso:
#   bash scripts/run-migrations.sh
#
# ══════════════════════════════════════════════════════════════

set -e

echo "════════════════════════════════════════════════════════"
echo "  ROM Agent - Database Migration v2.6.0"
echo "════════════════════════════════════════════════════════"
echo

# Verificar se DATABASE_URL está configurada
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL não configurada!"
  echo
  echo "Configure a variável de ambiente DATABASE_URL:"
  echo "  export DATABASE_URL='postgres://user:pass@host:5432/rom_agent'"
  exit 1
fi

echo "✅ DATABASE_URL configurada"
echo

# Instalar psql se não existir
if ! command -v psql &> /dev/null; then
  echo "📦 Instalando postgresql-client..."
  apt-get update -qq
  apt-get install -y -qq postgresql-client
  echo "✅ postgresql-client instalado"
  echo
fi

# Testar conexão
echo "🔍 Testando conexão com PostgreSQL..."
if psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1; then
  echo "✅ Conexão bem-sucedida"
  echo
else
  echo "❌ Falha ao conectar no PostgreSQL"
  echo "Verifique se DATABASE_URL está correta"
  exit 1
fi

# Executar migration
echo "🚀 Executando migration..."
echo

# SQL inline (não depende de arquivo)
psql "$DATABASE_URL" <<'EOSQL'
-- ════════════════════════════════════════════════════════════════
-- ROM AGENT - DATABASE SCHEMA v2.6.0
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
-- TABELA: conversations
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500),
  mode VARCHAR(50) DEFAULT 'juridico',
  model VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations(user_id);
CREATE INDEX IF NOT EXISTS conversations_created_at_idx ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS conversations_archived_at_idx ON conversations(archived_at) WHERE archived_at IS NULL;

-- ════════════════════════════════════════════════════════════════
-- TABELA: messages
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
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);

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
\echo '✅ Schema criado com sucesso!'
\echo ''
\echo 'Tabelas criadas:'
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

EOSQL

echo
echo "════════════════════════════════════════════════════════"
echo "  ✅ Migration concluída com sucesso!"
echo "════════════════════════════════════════════════════════"
echo
echo "Próximos passos:"
echo "1. Verifique os logs do servidor para confirmar conexão PostgreSQL"
echo "2. Teste a aplicação para garantir que os dados persistem"
echo "3. Configure Redis (REDIS_URL) para sessões persistentes"
echo
