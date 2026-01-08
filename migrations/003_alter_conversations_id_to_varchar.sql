-- ════════════════════════════════════════════════════════════════
-- ROM AGENT - MIGRATION 003
-- ════════════════════════════════════════════════════════════════
-- Alterar tipo da coluna id de UUID para VARCHAR
-- Permite IDs customizados (conv_xxx) das conversas antigas do JSON
-- ════════════════════════════════════════════════════════════════

-- Verificar se a coluna já é VARCHAR
DO $$
BEGIN
  -- Se a coluna for UUID, alterar para VARCHAR
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations'
    AND column_name = 'id'
    AND data_type = 'uuid'
  ) THEN
    -- Converter UUID existentes para VARCHAR
    ALTER TABLE conversations ALTER COLUMN id TYPE VARCHAR(255) USING id::VARCHAR;

    -- Remover default uuid_generate_v4() se existir
    ALTER TABLE conversations ALTER COLUMN id DROP DEFAULT;

    RAISE NOTICE '✅ Coluna conversations.id alterada de UUID para VARCHAR(255)';
  ELSE
    RAISE NOTICE '⏭️  Coluna conversations.id já é VARCHAR';
  END IF;
END $$;

-- Alterar messages.conversation_id para VARCHAR também
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages'
    AND column_name = 'conversation_id'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE messages ALTER COLUMN conversation_id TYPE VARCHAR(255) USING conversation_id::VARCHAR;
    RAISE NOTICE '✅ Coluna messages.conversation_id alterada para VARCHAR(255)';
  ELSE
    RAISE NOTICE '⏭️  Coluna messages.conversation_id já é VARCHAR';
  END IF;
END $$;

-- Recriar índices se necessário
DROP INDEX IF EXISTS conversations_pkey CASCADE;
ALTER TABLE conversations ADD PRIMARY KEY (id);

DROP INDEX IF EXISTS messages_conversation_id_idx CASCADE;
CREATE INDEX messages_conversation_id_idx ON messages(conversation_id);

-- Adicionar comentários
COMMENT ON COLUMN conversations.id IS 'ID da conversa (VARCHAR para aceitar UUIDs e IDs customizados como conv_xxx)';
COMMENT ON COLUMN messages.conversation_id IS 'Referência à conversa (VARCHAR)';

-- Resultado
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'MIGRATION 003 - CONCLUÍDA';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '✅ conversations.id agora aceita:';
  RAISE NOTICE '   - UUIDs (novas conversas)';
  RAISE NOTICE '   - IDs customizados tipo conv_xxx (conversas antigas)';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Próximo passo:';
  RAISE NOTICE '   Executar: node scripts/migrate-conversations-to-postgres.js';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;
