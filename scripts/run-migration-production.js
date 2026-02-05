#!/usr/bin/env node
/**
 * Run migration in production using environment DATABASE_URL
 * Usage: node scripts/run-migration-production.js
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION_FILE = path.join(__dirname, '../db/migrations/005_create_extraction_jobs.sql');

async function runMigration() {
  console.log('🔧 ROM-Agent - Migração extraction_jobs');
  console.log('=========================================');
  console.log('');

  // Verificar DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ Erro: DATABASE_URL não está definido');
    console.error('   Configure com: export DATABASE_URL="postgresql://..."');
    process.exit(1);
  }

  console.log('✅ DATABASE_URL configurado');
  console.log('');

  // Verificar arquivo de migração
  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error(`❌ Erro: Arquivo de migração não encontrado: ${MIGRATION_FILE}`);
    process.exit(1);
  }

  console.log('✅ Arquivo de migração encontrado');
  console.log('');

  // Ler SQL
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf-8');

  // Conectar ao banco
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    console.log('🔌 Conectando ao banco...');
    await client.connect();
    console.log('✅ Conectado');
    console.log('');

    // Verificar se tabela já existe
    console.log('🔍 Verificando se tabela extraction_jobs já existe...');
    const checkResult = await client.query(`
      SELECT to_regclass('public.extraction_jobs') as exists;
    `);

    if (checkResult.rows[0].exists === 'extraction_jobs') {
      console.log('⚠️  Tabela extraction_jobs já existe!');
      console.log('');
      console.log('Deseja continuar? (Migração usará CREATE TABLE IF NOT EXISTS)');
      console.log('Pressione Ctrl+C para cancelar ou Enter para continuar...');

      // Em produção, continuar automaticamente
      if (process.env.NODE_ENV === 'production') {
        console.log('🔄 Ambiente de produção detectado - continuando automaticamente...');
      }
    }

    // Executar migração
    console.log('🚀 Executando migração...');
    await client.query(sql);
    console.log('✅ Migração executada com sucesso!');
    console.log('');

    // Verificar tabela criada
    console.log('🔍 Verificando tabela criada...');
    const descResult = await client.query(`
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'extraction_jobs'
      ORDER BY ordinal_position;
    `);

    if (descResult.rows.length === 0) {
      console.error('❌ Erro: Tabela não foi criada corretamente');
      process.exit(1);
    }

    console.log('✅ Tabela extraction_jobs criada com', descResult.rows.length, 'colunas:');
    descResult.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    });
    console.log('');

    // Verificar índices
    console.log('📊 Verificando índices...');
    const indexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'extraction_jobs'
      ORDER BY indexname;
    `);

    if (indexResult.rows.length > 0) {
      console.log(`✅ ${indexResult.rows.length} índices criados:`);
      indexResult.rows.forEach(idx => {
        console.log(`   - ${idx.indexname}`);
      });
    } else {
      console.log('⚠️  Nenhum índice encontrado');
    }
    console.log('');

    console.log('🎉 Migração concluída com sucesso!');
    console.log('');
    console.log('Próximos passos:');
    console.log('1. Teste a API: curl https://iarom.com.br/api/extraction-jobs/active');
    console.log('2. Faça upload de um documento e teste o progress tracking');
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao executar migração:');
    console.error('   ', error.message);
    console.error('');
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Executar
runMigration().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
