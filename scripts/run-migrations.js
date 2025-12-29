#!/usr/bin/env node
/**
 * EXECUTAR MIGRAÇÕES DE BANCO DE DADOS
 * Cria todas as tabelas necessárias no PostgreSQL
 *
 * Uso: npm run db:migrate
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('═'.repeat(70));
  console.log('📦 EXECUTANDO MIGRAÇÕES DE BANCO DE DADOS');
  console.log('═'.repeat(70));
  console.log('');

  // Verificar DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL não configurado!');
    console.log('');
    console.log('Configure DATABASE_URL no .env ou como variável de ambiente.');
    console.log('');
    process.exit(1);
  }

  console.log('✅ DATABASE_URL configurado');
  console.log('');

  // Conectar ao banco
  const config = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false
  };

  console.log('🔌 Conectando ao PostgreSQL...');
  const client = new pg.Client(config);

  try {
    await client.connect();
    console.log('✅ Conectado ao PostgreSQL');
    console.log('');

    // Ler arquivo de migração
    const migrationPath = path.join(__dirname, '../database/migrations/001_initial_schema.sql');
    console.log('📄 Lendo migração:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.log('❌ Arquivo de migração não encontrado:', migrationPath);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');
    console.log('✅ Migração carregada');
    console.log('');

    // Executar SQL
    console.log('🚀 Executando SQL...');
    console.log('─'.repeat(70));

    const startTime = Date.now();
    await client.query(sql);
    const duration = Date.now() - startTime;

    console.log('─'.repeat(70));
    console.log('✅ Migração executada com sucesso!');
    console.log(`   Tempo: ${duration}ms`);
    console.log('');

    // Verificar tabelas criadas
    const result = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log('📋 Tabelas criadas:');
    result.rows.forEach(row => {
      console.log(`   ✅ ${row.tablename}`);
    });
    console.log('');

    // Verificar especificamente a tabela sessions
    const sessionsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'sessions'
      ) as exists
    `);

    if (sessionsCheck.rows[0].exists) {
      console.log('🔐 Tabela sessions criada - Autenticação funcionará!');
    } else {
      console.log('⚠️  Tabela sessions não encontrada - Autenticação pode falhar');
    }
    console.log('');

    console.log('═'.repeat(70));
    console.log('✅ MIGRAÇÕES CONCLUÍDAS COM SUCESSO');
    console.log('═'.repeat(70));
    console.log('');
    console.log('Próximos passos:');
    console.log('   1. Restart do serviço: pm2 restart rom-agent');
    console.log('   2. Testar autenticação: fazer login e verificar sessão');
    console.log('   3. Validar: npm run db:check');
    console.log('');

  } catch (error) {
    console.log('');
    console.log('❌ ERRO AO EXECUTAR MIGRAÇÕES');
    console.log('');
    console.log('Erro:', error.message);
    console.log('');

    if (error.code) {
      console.log('Código do erro:', error.code);
    }

    if (error.position) {
      console.log('Posição no SQL:', error.position);
    }

    console.log('');
    console.log('Stack trace:');
    console.log(error.stack);
    console.log('');

    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Conexão fechada');
    console.log('');
  }
}

runMigrations().catch(error => {
  console.error('');
  console.error('💥 ERRO FATAL');
  console.error(error);
  console.error('');
  process.exit(1);
});
