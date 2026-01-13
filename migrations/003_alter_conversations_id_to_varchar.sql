-- ════════════════════════════════════════════════════════════════
-- ROM AGENT - MIGRATION 003 (FIXED)
-- ════════════════════════════════════════════════════════════════
-- Alterar tipo da coluna id de UUID para VARCHAR
-- Permite IDs customizados (conv_xxx) das conversas antigas do JSON
-- FIX: Dropar foreign key antes de alterar tipos
-- ════════════════════════════════════════════════════════════════

-- PASSO 1: Dropar foreign key constraints (se existirem)
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  -- Messages FK - procurar qualquer constraint que referencie conversations(id)
  SELECT constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
  WHERE tc.table_name = 'messages'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'conversations'
    AND ccu.column_name = 'id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE messages DROP CONSTRAINT %I', fk_name);
    RAISE NOTICE '✅ Foreign key messages removida: %', fk_name;
  ELSE
    RAISE NOTICE '⏭️  Foreign key messages já removida';
  END IF;

  -- Documents FK (se a tabela existir)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
    SELECT constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'documents'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'conversations'
      AND ccu.column_name = 'id'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE documents DROP CONSTRAINT %I', fk_name);
      RAISE NOTICE '✅ Foreign key documents removida: %', fk_name;
    ELSE
      RAISE NOTICE '⏭️  Foreign key documents já removida';
    END IF;
  END IF;

  -- AI Operations FK (se a tabela existir)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_operations') THEN
    SELECT constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'ai_operations'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'conversations'
      AND ccu.column_name = 'id'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE ai_operations DROP CONSTRAINT %I', fk_name);
      RAISE NOTICE '✅ Foreign key ai_operations removida: %', fk_name;
    ELSE
      RAISE NOTICE '⏭️  Foreign key ai_operations já removida';
    END IF;
  END IF;
END $$;

-- PASSO 2: Alterar conversations.id para VARCHAR
DO $$
BEGIN
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

-- PASSO 3: Alterar messages.conversation_id para VARCHAR
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

-- PASSO 3B: Alterar documents.conversation_id para VARCHAR (se a tabela existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'documents'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'documents'
      AND column_name = 'conversation_id'
      AND data_type = 'uuid'
    ) THEN
      ALTER TABLE documents ALTER COLUMN conversation_id TYPE VARCHAR(255) USING conversation_id::VARCHAR;
      RAISE NOTICE '✅ Coluna documents.conversation_id alterada para VARCHAR(255)';
    ELSE
      RAISE NOTICE '⏭️  Coluna documents.conversation_id já é VARCHAR';
    END IF;
  END IF;
END $$;

-- PASSO 3C: Alterar ai_operations.conversation_id para VARCHAR (se a tabela existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'ai_operations'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'ai_operations'
      AND column_name = 'conversation_id'
      AND data_type = 'uuid'
    ) THEN
      ALTER TABLE ai_operations ALTER COLUMN conversation_id TYPE VARCHAR(255) USING conversation_id::VARCHAR;
      RAISE NOTICE '✅ Coluna ai_operations.conversation_id alterada para VARCHAR(255)';
    ELSE
      RAISE NOTICE '⏭️  Coluna ai_operations.conversation_id já é VARCHAR';
    END IF;
  END IF;
END $$;

-- PASSO 4: Recriar foreign key constraints
DO $$
DECLARE
  fk_exists BOOLEAN;
BEGIN
  -- Messages FK - verificar se JÁ existe alguma FK para conversations
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'messages'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'conversations'
      AND ccu.column_name = 'id'
  ) INTO fk_exists;

  IF NOT fk_exists THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_conversation_id_fkey
      FOREIGN KEY (conversation_id)
      REFERENCES conversations(id)
      ON DELETE CASCADE;
    RAISE NOTICE '✅ Foreign key messages recriada';
  ELSE
    RAISE NOTICE '⏭️  Foreign key messages já existe';
  END IF;

  -- Documents FK (se a tabela existir)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'documents'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'conversations'
        AND ccu.column_name = 'id'
    ) INTO fk_exists;

    IF NOT fk_exists THEN
      ALTER TABLE documents
        ADD CONSTRAINT documents_conversation_id_fkey
        FOREIGN KEY (conversation_id)
        REFERENCES conversations(id)
        ON DELETE CASCADE;
      RAISE NOTICE '✅ Foreign key documents recriada';
    ELSE
      RAISE NOTICE '⏭️  Foreign key documents já existe';
    END IF;
  END IF;

  -- AI Operations FK (se a tabela existir)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_operations') THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'ai_operations'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'conversations'
        AND ccu.column_name = 'id'
    ) INTO fk_exists;

    IF NOT fk_exists THEN
      ALTER TABLE ai_operations
        ADD CONSTRAINT ai_operations_conversation_id_fkey
        FOREIGN KEY (conversation_id)
        REFERENCES conversations(id)
        ON DELETE CASCADE;
      RAISE NOTICE '✅ Foreign key ai_operations recriada';
    ELSE
      RAISE NOTICE '⏭️  Foreign key ai_operations já existe';
    END IF;
  END IF;
END $$;

-- PASSO 5: Recriar índices
DROP INDEX IF EXISTS messages_conversation_id_idx;
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);

DROP INDEX IF EXISTS documents_conversation_id_idx;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'documents'
  ) THEN
    CREATE INDEX IF NOT EXISTS documents_conversation_id_idx ON documents(conversation_id);
    RAISE NOTICE '✅ Índice documents_conversation_id_idx criado';
  END IF;
END $$;

DROP INDEX IF EXISTS ai_operations_conversation_id_idx;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'ai_operations'
  ) THEN
    CREATE INDEX IF NOT EXISTS ai_operations_conversation_id_idx ON ai_operations(conversation_id);
    RAISE NOTICE '✅ Índice ai_operations_conversation_id_idx criado';
  END IF;
END $$;

-- Adicionar comentários
COMMENT ON COLUMN conversations.id IS 'ID da conversa (VARCHAR para aceitar UUIDs e IDs customizados como conv_xxx)';
COMMENT ON COLUMN messages.conversation_id IS 'Referência à conversa (VARCHAR)';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'documents'
  ) THEN
    COMMENT ON COLUMN documents.conversation_id IS 'Referência à conversa (VARCHAR)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'ai_operations'
  ) THEN
    COMMENT ON COLUMN ai_operations.conversation_id IS 'Referência à conversa (VARCHAR)';
  END IF;
END $$;

-- Resultado
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'MIGRATION 003 - CONCLUÍDA COM SUCESSO';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '✅ conversations.id agora aceita:';
  RAISE NOTICE '   - UUIDs (novas conversas)';
  RAISE NOTICE '   - IDs customizados tipo conv_xxx (conversas antigas)';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Foreign key constraint recriada corretamente';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;
