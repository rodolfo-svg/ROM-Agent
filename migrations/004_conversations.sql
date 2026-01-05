-- Migration 004: Conversas e Mensagens (Histórico de Chat)
-- Permite que usuários tenham múltiplas conversas salvas

-- Tabela de conversas
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT 'Nova Conversa',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP NULL,

  INDEX idx_conversations_user_id (user_id),
  INDEX idx_conversations_updated_at (updated_at DESC),
  INDEX idx_conversations_deleted_at (deleted_at)
);

-- Tabela de mensagens da conversa
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  INDEX idx_messages_conversation_id (conversation_id),
  INDEX idx_messages_created_at (created_at ASC)
);

-- Comentários
COMMENT ON TABLE conversations IS 'Conversas do chat (histórico)';
COMMENT ON TABLE conversation_messages IS 'Mensagens dentro de cada conversa';

COMMENT ON COLUMN conversations.title IS 'Título da conversa (gerado do primeiro prompt)';
COMMENT ON COLUMN conversations.deleted_at IS 'Soft delete - conversa deletada mas preservada';
COMMENT ON COLUMN conversation_messages.role IS 'user, assistant ou system';
COMMENT ON COLUMN conversation_messages.model IS 'Modelo usado para gerar resposta (ex: claude-sonnet-4)';
