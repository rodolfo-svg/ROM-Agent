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

    // Criar tabela de controle de migrations
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        executed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Tabela schema_migrations criada/verificada');
    console.log('');

    // Ler arquivos de migração
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📁 Encontrados ${files.length} arquivos de migration`);
    console.log('');

    let executed = 0;
    let skipped = 0;

    for (const file of files) {
      const version = file.replace('.sql', '');

      // Verificar se já foi executada
      const result = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      );

      if (result.rows.length > 0) {
        console.log(`⏭️  ${file} - já executada`);
        skipped++;
        continue;
      }

      // Executar migration
      console.log(`🔨 Executando ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      try {
        const startTime = Date.now();
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        );
        const duration = Date.now() - startTime;
        console.log(`✅ ${file} - concluída (${duration}ms)`);
        console.log('');
        executed++;
      } catch (error) {
        console.log('');
        console.log(`❌ Erro em ${file}:`);
        console.log(error.message);
        console.log('');
        throw error;
      }
    }

    console.log('📊 Resultado:');
    console.log(`   ✅ Executadas: ${executed}`);
    console.log(`   ⏭️  Puladas: ${skipped}`);
    console.log('');

    // Verificar tabelas criadas
    const result = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log('📋 Tabelas no banco:');
    result.rows.forEach(row => {
      console.log(`   ✅ ${row.tablename}`);
    });
    console.log('');

    console.log('═'.repeat(70));
    console.log('✅ MIGRAÇÕES CONCLUÍDAS COM SUCESSO');
    console.log('═'.repeat(70));
    console.log('');
    if (executed > 0) {
      console.log('Próximos passos:');
      console.log('   1. Restart do serviço: pm2 restart rom-agent (se estiver rodando)');
      console.log('   2. Testar funcionalidades: login, conversas, etc.');
      console.log('   3. Validar: npm run db:check');
      console.log('');
    }

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
