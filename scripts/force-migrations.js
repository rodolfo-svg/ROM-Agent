#!/usr/bin/env node
/**
 * FORÇA EXECUÇÃO DE MIGRATIONS - DIAGNÓSTICO VERBOSE
 * Tenta rodar migrations com output detalhado de erros
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('');
console.log('🔥 FORÇA EXECUÇÃO DE MIGRATIONS - MODO VERBOSE');
console.log('═'.repeat(70));
console.log('');

// 1. Verificar variáveis de ambiente
console.log('📋 STEP 1: Verificando variáveis de ambiente');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'undefined');
console.log('   DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('   DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);
console.log('');

if (!process.env.DATABASE_URL) {
  console.log('❌ DATABASE_URL não definido!');
  console.log('');
  console.log('Defina DATABASE_URL:');
  console.log('   export DATABASE_URL="postgresql://user:pass@host/db"');
  console.log('');
  process.exit(1);
}

// 2. Extrair info do DATABASE_URL
console.log('📋 STEP 2: Parsing DATABASE_URL');
try {
  const url = new URL(process.env.DATABASE_URL);
  console.log('   Protocol:', url.protocol);
  console.log('   Host:', url.hostname);
  console.log('   Port:', url.port || '5432');
  console.log('   Database:', url.pathname.slice(1));
  console.log('   Username:', url.username);
  console.log('   Password:', url.password ? '***' + url.password.slice(-4) : 'none');
  console.log('');
} catch (e) {
  console.log('   ⚠️ Erro ao parsear:', e.message);
  console.log('');
}

// 3. Tentar conectar
console.log('📋 STEP 3: Tentando conectar ao PostgreSQL');
const config = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  connectionTimeoutMillis: 10000,
};

const client = new pg.Client(config);
let connected = false;

try {
  console.log('   Connecting...');
  const startTime = Date.now();
  await client.connect();
  const latency = Date.now() - startTime;
  connected = true;
  console.log(`   ✅ Conectado em ${latency}ms`);
  console.log('');

  // 4. Testar query simples
  console.log('📋 STEP 4: Testando query básica');
  const result = await client.query('SELECT NOW(), version()');
  console.log('   ✅ SELECT NOW() funcionou');
  console.log('   PostgreSQL version:', result.rows[0].version?.split(' ').slice(0, 2).join(' '));
  console.log('');

  // 5. Verificar tabelas existentes
  console.log('📋 STEP 5: Listando tabelas existentes');
  const tables = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  if (tables.rows.length === 0) {
    console.log('   ⚠️ Nenhuma tabela encontrada no schema public');
  } else {
    console.log(`   Encontradas ${tables.rows.length} tabelas:`);
    tables.rows.forEach(row => {
      console.log(`      - ${row.tablename}`);
    });
  }
  console.log('');

  // 6. Criar tabela de controle
  console.log('📋 STEP 6: Criando tabela schema_migrations');
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        executed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('   ✅ Tabela schema_migrations criada/existe');
  } catch (e) {
    console.log('   ❌ Erro:', e.message);
    console.log('   Code:', e.code);
  }
  console.log('');

  // 7. Executar migrations
  console.log('📋 STEP 7: Executando migrations SQL');
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`   Encontrados ${files.length} arquivos SQL`);
  console.log('');

  for (const file of files) {
    const version = file.replace('.sql', '');

    // Verificar se já executada
    const check = await client.query(
      'SELECT version FROM schema_migrations WHERE version = $1',
      [version]
    );

    if (check.rows.length > 0) {
      console.log(`   ⏭️  ${file} - já executada, pulando`);
      continue;
    }

    // Executar
    console.log(`   🔨 Executando ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    try {
      const start = Date.now();
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version]
      );
      await client.query('COMMIT');
      const duration = Date.now() - start;
      console.log(`   ✅ ${file} - concluída (${duration}ms)`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.log(`   ❌ ERRO em ${file}:`);
      console.log(`      Message: ${error.message}`);
      console.log(`      Code: ${error.code}`);
      console.log(`      Detail: ${error.detail || 'n/a'}`);
      console.log(`      Hint: ${error.hint || 'n/a'}`);
      if (error.position) {
        console.log(`      Position: ${error.position}`);
        // Mostrar trecho do SQL com erro
        const lines = sql.split('\n');
        const errorLine = parseInt(error.position) / 80; // aproximado
        console.log(`      SQL context:`);
        lines.slice(Math.max(0, errorLine - 2), errorLine + 3).forEach((line, i) => {
          console.log(`         ${Math.floor(errorLine) - 2 + i + 1}: ${line}`);
        });
      }
      throw error;
    }
    console.log('');
  }

  // 8. Verificar tabelas finais
  console.log('📋 STEP 8: Verificando tabelas criadas');
  const finalTables = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  console.log(`   Total de tabelas: ${finalTables.rows.length}`);
  finalTables.rows.forEach(row => {
    console.log(`      ✅ ${row.tablename}`);
  });
  console.log('');

  // 9. Verificar migrations aplicadas
  console.log('📋 STEP 9: Migrations aplicadas');
  const applied = await client.query('SELECT * FROM schema_migrations ORDER BY executed_at');
  console.log(`   Total aplicadas: ${applied.rows.length}`);
  applied.rows.forEach(row => {
    console.log(`      ✅ ${row.version} - ${row.executed_at}`);
  });
  console.log('');

  console.log('═'.repeat(70));
  console.log('✅ MIGRATIONS CONCLUÍDAS COM SUCESSO!');
  console.log('═'.repeat(70));
  console.log('');

} catch (error) {
  console.log('');
  console.log('═'.repeat(70));
  console.log('❌ ERRO FATAL');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Error:', error.message);
  console.log('Code:', error.code);
  console.log('');
  console.log('Stack:');
  console.log(error.stack);
  console.log('');
  process.exit(1);
} finally {
  if (connected) {
    await client.end();
    console.log('🔌 Conexão fechada');
    console.log('');
  }
}
