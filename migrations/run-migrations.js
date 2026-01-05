/**
 * Migration Runner - Executa migrations SQL no PostgreSQL
 * Uso: node migrations/run-migrations.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPostgresPool } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('🔄 Iniciando migrations...\n');

  const pool = getPostgresPool();
  if (!pool) {
    console.error('❌ PostgreSQL não disponível');
    process.exit(1);
  }

  try {
    // Criar tabela de controle de migrations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        executed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Listar arquivos de migration
    const files = fs.readdirSync(__dirname)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📁 Encontrados ${files.length} arquivos de migration\n`);

    for (const file of files) {
      const version = file.replace('.sql', '');

      // Verificar se já foi executada
      const result = await pool.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      );

      if (result.rows.length > 0) {
        console.log(`⏭️  ${file} - já executada`);
        continue;
      }

      // Executar migration
      console.log(`🔨 Executando ${file}...`);
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');

      try {
        await pool.query(sql);
        await pool.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        );
        console.log(`✅ ${file} - concluída\n`);
      } catch (error) {
        console.error(`❌ Erro em ${file}:`, error.message);
        throw error;
      }
    }

    console.log('🎉 Todas as migrations foram executadas com sucesso!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erro ao executar migrations:', error);
    process.exit(1);
  }
}

runMigrations();
