-- Migration 005: Adicionar coluna deleted_at às tabelas de conversas
-- Correção: a tabela já existe mas sem soft delete

-- Adicionar deleted_at à tabela conversations (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversations' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE conversations ADD COLUMN deleted_at TIMESTAMP NULL;
    END IF;
END $$;

-- Criar índice para deleted_at (se não existir)
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at ON conversations(deleted_at);

-- Comentário
COMMENT ON COLUMN conversations.deleted_at IS 'Soft delete - conversa deletada mas preservada';
