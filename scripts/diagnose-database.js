#!/usr/bin/env node
/**
 * DIAGNÓSTICO DE BANCO DE DADOS
 * Valida conexão PostgreSQL e estrutura de tabelas
 *
 * Uso: node scripts/diagnose-database.js
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const REQUIRED_TABLES = [
  'users',
  'sessions',
  'conversations',
  'messages',
  'files'
];

async function diagnose() {
  console.log('═'.repeat(70));
  console.log('🔍 DIAGNÓSTICO DE BANCO DE DADOS');
  console.log('═'.repeat(70));
  console.log('');

  // 1. Verificar variáveis de ambiente
  console.log('1️⃣  VARIÁVEIS DE AMBIENTE');
  console.log('─'.repeat(70));
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Configurado' : '❌ NÃO CONFIGURADO');
  console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('');

  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL não configurado!');
    console.log('');
    console.log('💡 SOLUÇÃO:');
    console.log('   1. Vá para o dashboard do Render');
    console.log('   2. Selecione seu serviço web');
    console.log('   3. Vá em Environment');
    console.log('   4. Adicione DATABASE_URL com o valor do PostgreSQL');
    console.log('');
    process.exit(1);
  }

  // 2. Tentar conectar
  console.log('2️⃣  TESTE DE CONEXÃO');
  console.log('─'.repeat(70));

  let pool;
  try {
    const config = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
      connectionTimeoutMillis: 10000
    };

    console.log('Conectando ao PostgreSQL...');
    pool = new pg.Pool(config);

    const startTime = Date.now();
    const result = await pool.query('SELECT NOW(), version()');
    const latency = Date.now() - startTime;

    console.log('✅ CONEXÃO ESTABELECIDA');
    console.log(`   Latência: ${latency}ms`);
    console.log(`   Hora do servidor: ${result.rows[0].now}`);
    console.log(`   Versão: ${result.rows[0].version.split(',')[0]}`);
    console.log('');
  } catch (error) {
    console.log('❌ ERRO DE CONEXÃO');
    console.log(`   Mensagem: ${error.message}`);
    console.log(`   Código: ${error.code || 'N/A'}`);
    console.log('');
    console.log('💡 SOLUÇÕES POSSÍVEIS:');
    console.log('   • Verificar se DATABASE_URL está correto');
    console.log('   • Verificar se PostgreSQL está rodando');
    console.log('   • Verificar firewall/whitelist de IPs');
    console.log('   • Verificar SSL settings');
    console.log('');
    process.exit(1);
  }

  // 3. Verificar tabelas
  console.log('3️⃣  ESTRUTURA DO BANCO');
  console.log('─'.repeat(70));

  try {
    const result = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const existingTables = result.rows.map(r => r.tablename);
    console.log(`Total de tabelas: ${existingTables.length}`);
    console.log('');

    console.log('Tabelas requeridas:');
    for (const table of REQUIRED_TABLES) {
      const exists = existingTables.includes(table);
      console.log(`   ${exists ? '✅' : '❌'} ${table}`);
    }
    console.log('');

    const missingTables = REQUIRED_TABLES.filter(t => !existingTables.includes(t));
    if (missingTables.length > 0) {
      console.log('❌ TABELAS FALTANDO:', missingTables.join(', '));
      console.log('');
      console.log('💡 SOLUÇÃO:');
      console.log('   Execute as migrações:');
      console.log('   npm run migrate');
      console.log('   ou');
      console.log('   psql $DATABASE_URL < database/migrations/001_initial_schema.sql');
      console.log('');
    } else {
      console.log('✅ TODAS AS TABELAS EXISTEM');
      console.log('');
    }

  } catch (error) {
    console.log('❌ ERRO AO VERIFICAR TABELAS');
    console.log(`   ${error.message}`);
    console.log('');
  }

  // 4. Verificar tabela sessions especificamente
  console.log('4️⃣  TABELA SESSIONS (AUTENTICAÇÃO)');
  console.log('─'.repeat(70));

  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'sessions'
      ORDER BY ordinal_position
    `);

    if (result.rows.length === 0) {
      console.log('❌ TABELA SESSIONS NÃO EXISTE');
      console.log('');
      console.log('💡 Esta é a causa do problema de autenticação!');
      console.log('   Sem a tabela sessions, o login não persiste.');
      console.log('');
      console.log('   Execute a migração para criar:');
      console.log('   npm run migrate');
      console.log('');
    } else {
      console.log('✅ TABELA SESSIONS EXISTE');
      console.log('');
      console.log('Colunas:');
      for (const col of result.rows) {
        console.log(`   • ${col.column_name}: ${col.data_type}${col.is_nullable === 'YES' ? ' (nullable)' : ''}`);
      }
      console.log('');

      // Contar sessões ativas
      const countResult = await pool.query(`
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN expire > NOW() THEN 1 END) as active
        FROM sessions
      `);

      console.log('Sessões:');
      console.log(`   Total: ${countResult.rows[0].total}`);
      console.log(`   Ativas: ${countResult.rows[0].active}`);
      console.log('');
    }
  } catch (error) {
    console.log('❌ ERRO AO VERIFICAR SESSIONS');
    console.log(`   ${error.message}`);
    console.log('');
  }

  // 5. Resumo final
  console.log('═'.repeat(70));
  console.log('📋 RESUMO');
  console.log('═'.repeat(70));
  console.log('');

  const allGood = pool !== null;

  if (allGood) {
    console.log('✅ BANCO DE DADOS OK');
    console.log('');
    console.log('Próximos passos:');
    console.log('   1. Se faltam tabelas, executar: npm run migrate');
    console.log('   2. Restart do serviço após migração');
    console.log('   3. Testar login novamente');
  } else {
    console.log('❌ PROBLEMAS ENCONTRADOS');
    console.log('   Revise os erros acima e aplique as soluções sugeridas.');
  }

  console.log('');
  console.log('═'.repeat(70));

  await pool.end();
  process.exit(allGood ? 0 : 1);
}

diagnose().catch(error => {
  console.error('');
  console.error('💥 ERRO FATAL');
  console.error(error);
  console.error('');
  process.exit(1);
});
