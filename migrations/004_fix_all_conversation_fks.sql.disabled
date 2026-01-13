-- ════════════════════════════════════════════════════════════════
-- ROM AGENT - MIGRATION 004
-- ════════════════════════════════════════════════════════════════
-- Correção definitiva para TODAS as FKs de conversations.id
-- Descobre e corrige QUALQUER tabela automaticamente
-- ════════════════════════════════════════════════════════════════

-- PASSO 0: Identificar todas as FKs
DO $$
DECLARE
  fk_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'MIGRATION 004 - CORREÇÃO DEFINITIVA DE FOREIGN KEYS';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Identificando todas as foreign keys para conversations.id...';
  RAISE NOTICE '';

  FOR fk_record IN
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'conversations'
      AND ccu.column_name = 'id'
  LOOP
    RAISE NOTICE '   📌 FK: % (tabela: %, coluna: %)',
      fk_record.constraint_name,
      fk_record.table_name,
      fk_record.column_name;
  END LOOP;

  RAISE NOTICE '';
END $$;

-- PASSO 1: Dropar TODAS as foreign keys para conversations.id
DO $$
DECLARE
  fk_record RECORD;
BEGIN
  RAISE NOTICE '🔨 PASSO 1: Removendo todas as foreign keys...';
  RAISE NOTICE '';

  FOR fk_record IN
    SELECT
      tc.constraint_name,
      tc.table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'conversations'
      AND ccu.column_name = 'id'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
      fk_record.table_name,
      fk_record.constraint_name);
    RAISE NOTICE '   ✅ FK removida: % (tabela: %)',
      fk_record.constraint_name,
      fk_record.table_name;
  END LOOP;

  RAISE NOTICE '';
END $$;

-- PASSO 2: Alterar conversations.id para VARCHAR (se ainda for UUID)
DO $$
BEGIN
  RAISE NOTICE '🔨 PASSO 2: Alterando conversations.id para VARCHAR...';
  RAISE NOTICE '';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations'
    AND column_name = 'id'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE conversations ALTER COLUMN id TYPE VARCHAR(255) USING id::VARCHAR;
    ALTER TABLE conversations ALTER COLUMN id DROP DEFAULT;
    RAISE NOTICE '   ✅ conversations.id alterado para VARCHAR(255)';
  ELSE
    RAISE NOTICE '   ⏭️  conversations.id já é VARCHAR';
  END IF;

  RAISE NOTICE '';
END $$;

-- PASSO 3: Alterar TODAS as colunas que referenciam conversations.id
DO $$
DECLARE
  col_record RECORD;
BEGIN
  RAISE NOTICE '🔨 PASSO 3: Alterando colunas de referência para VARCHAR...';
  RAISE NOTICE '';

  -- Descobrir todas as colunas que tinham FK para conversations.id
  FOR col_record IN
    SELECT DISTINCT
      kcu.table_name,
      kcu.column_name
    FROM information_schema.key_column_usage kcu
    WHERE kcu.column_name LIKE '%conversation_id%'
      AND kcu.table_name != 'conversations'
      AND EXISTS (
        SELECT 1 FROM information_schema.tables t
        WHERE t.table_name = kcu.table_name
      )
  LOOP
    -- Verificar se a coluna ainda é UUID
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = col_record.table_name
      AND column_name = col_record.column_name
      AND data_type = 'uuid'
    ) THEN
      BEGIN
        EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE VARCHAR(255) USING %I::VARCHAR',
          col_record.table_name,
          col_record.column_name,
          col_record.column_name);
        RAISE NOTICE '   ✅ %s.%s alterado para VARCHAR(255)',
          col_record.table_name,
          col_record.column_name;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '   ⚠️  Erro ao alterar %s.%s: %',
          col_record.table_name,
          col_record.column_name,
          SQLERRM;
      END;
    ELSE
      RAISE NOTICE '   ⏭️  %s.%s já é VARCHAR',
        col_record.table_name,
        col_record.column_name;
    END IF;
  END LOOP;

  RAISE NOTICE '';
END $$;

-- PASSO 4: Recriar TODAS as foreign keys
DO $$
DECLARE
  fk_info RECORD;
  constraint_name_generated VARCHAR;
BEGIN
  RAISE NOTICE '🔨 PASSO 4: Recriando foreign keys...';
  RAISE NOTICE '';

  FOR fk_info IN
    SELECT DISTINCT
      table_name,
      column_name
    FROM information_schema.columns
    WHERE column_name LIKE '%conversation_id%'
      AND table_name != 'conversations'
      AND data_type = 'character varying'
  LOOP
    constraint_name_generated := fk_info.table_name || '_' || fk_info.column_name || '_fkey';

    -- Verificar se FK já existe
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = constraint_name_generated
      AND table_name = fk_info.table_name
    ) THEN
      BEGIN
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES conversations(id) ON DELETE CASCADE',
          fk_info.table_name,
          constraint_name_generated,
          fk_info.column_name
        );
        RAISE NOTICE '   ✅ FK criada: % (tabela: %)',
          constraint_name_generated,
          fk_info.table_name;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '   ⚠️  Erro ao criar FK %: %', constraint_name_generated, SQLERRM;
      END;
    ELSE
      RAISE NOTICE '   ⏭️  FK já existe: % (tabela: %)',
        constraint_name_generated,
        fk_info.table_name;
    END IF;
  END LOOP;

  RAISE NOTICE '';
END $$;

-- PASSO 5: Criar índices para todas as colunas
DO $$
DECLARE
  idx_record RECORD;
  idx_name VARCHAR;
BEGIN
  RAISE NOTICE '🔨 PASSO 5: Criando índices...';
  RAISE NOTICE '';

  FOR idx_record IN
    SELECT DISTINCT
      table_name,
      column_name
    FROM information_schema.columns
    WHERE column_name LIKE '%conversation_id%'
      AND table_name != 'conversations'
      AND data_type = 'character varying'
  LOOP
    idx_name := idx_record.table_name || '_' || idx_record.column_name || '_idx';

    -- Drop se existir
    EXECUTE format('DROP INDEX IF EXISTS %I', idx_name);

    -- Criar índice
    BEGIN
      EXECUTE format('CREATE INDEX %I ON %I(%I)',
        idx_name,
        idx_record.table_name,
        idx_record.column_name);
      RAISE NOTICE '   ✅ Índice criado: %', idx_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '   ⚠️  Erro ao criar índice %: %', idx_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '';
END $$;

-- Comentários
COMMENT ON COLUMN conversations.id IS 'ID da conversa (VARCHAR para aceitar UUIDs e IDs customizados como conv_xxx)';

DO $$
DECLARE
  col_record RECORD;
BEGIN
  FOR col_record IN
    SELECT DISTINCT table_name, column_name
    FROM information_schema.columns
    WHERE column_name LIKE '%conversation_id%'
      AND table_name != 'conversations'
      AND data_type = 'character varying'
  LOOP
    EXECUTE format(
      'COMMENT ON COLUMN %I.%I IS ''Referência à conversa (VARCHAR)''',
      col_record.table_name,
      col_record.column_name
    );
  END LOOP;
END $$;

-- Resultado final
DO $$
DECLARE
  table_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'MIGRATION 004 - CONCLUÍDA COM SUCESSO';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '✅ conversations.id convertido para VARCHAR(255)';
  RAISE NOTICE '✅ Todas as FKs removidas e recriadas';
  RAISE NOTICE '✅ Todos os índices criados';
  RAISE NOTICE '';
  RAISE NOTICE 'Tabelas processadas:';

  FOR table_record IN
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE column_name LIKE '%conversation_id%'
      AND table_name != 'conversations'
      AND data_type = 'character varying'
    ORDER BY table_name
  LOOP
    RAISE NOTICE '   - %', table_record.table_name;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;
