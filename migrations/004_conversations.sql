-- Migration 004: Conversas e Mensagens (Histórico de Chat)
-- Permite que usuários tenham múltiplas conversas salvas

-- Tabela de conversas
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT 'Nova Conversa',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- Índices para conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at ON conversations(deleted_at);

-- Tabela de mensagens da conversa
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para conversation_messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON conversation_messages(created_at ASC);

-- Comentários
COMMENT ON TABLE conversations IS 'Conversas do chat (histórico)';
COMMENT ON TABLE conversation_messages IS 'Mensagens dentro de cada conversa';

COMMENT ON COLUMN conversations.title IS 'Título da conversa (gerado do primeiro prompt)';
COMMENT ON COLUMN conversations.deleted_at IS 'Soft delete - conversa deletada mas preservada';
COMMENT ON COLUMN conversation_messages.role IS 'user, assistant ou system';
COMMENT ON COLUMN conversation_messages.model IS 'Modelo usado para gerar resposta (ex: claude-sonnet-4)';
