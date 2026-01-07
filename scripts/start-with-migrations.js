#!/usr/bin/env node
/**
 * START WITH MIGRATIONS
 * Executa migrations antes de iniciar o servidor
 * Versão Node.js (compatível com Render)
 */

import { spawn } from 'child_process';

console.log('');
console.log('═'.repeat(70));
console.log('🗄️  INICIANDO PROCESSO DE MIGRATIONS');
console.log('═'.repeat(70));
console.log('');

// Verificar DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.log('❌ DATABASE_URL não está configurado!');
  console.log('   Verifique as variáveis de ambiente no Render Dashboard');
  console.log('   As migrations NÃO serão executadas');
  console.log('');
  console.log('⚠️  SERVIDOR CONTINUARÁ SEM BANCO DE DADOS');
  console.log('');
  startServer();
} else {
  // DATABASE_URL existe, prosseguir com migrations
  runMigrations();
}

function runMigrations() {

  console.log('✅ DATABASE_URL encontrado');

  // Extrair host do DATABASE_URL para exibição
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log(`   Host: ${url.hostname}`);
  } catch (e) {
    console.log('   (não foi possível parsear URL)');
  }
  console.log('');

  // Executar migrations
  console.log('🔨 Executando: node scripts/run-migrations.js');
  console.log('');

  const migration = spawn('node', ['scripts/run-migrations.js'], {
    stdio: 'inherit',
    env: process.env
  });

  migration.on('close', (code) => {
    console.log('');

    if (code === 0) {
      console.log('═'.repeat(70));
      console.log('✅ MIGRATIONS CONCLUÍDAS COM SUCESSO');
      console.log('═'.repeat(70));
    } else {
      console.log('═'.repeat(70));
      console.log(`❌ ERRO AO EXECUTAR MIGRATIONS (Exit code: ${code})`);
      console.log('═'.repeat(70));
      console.log('');
      console.log('Possíveis causas:');
      console.log('  1. DATABASE_URL inválido');
      console.log('  2. PostgreSQL não acessível');
      console.log('  3. Erro de sintaxe SQL');
      console.log('  4. Falta de permissões');
      console.log('');
      console.log('⚠️  SERVIDOR CONTINUARÁ (modo degradado)');
    }

    console.log('');

    // Iniciar servidor independente do resultado
    startServer();
  });

  migration.on('error', (err) => {
    console.log('');
    console.log('❌ ERRO AO EXECUTAR SCRIPT DE MIGRATIONS:');
    console.log(err.message);
    console.log('');
    console.log('⚠️  SERVIDOR CONTINUARÁ SEM MIGRATIONS');
    console.log('');

    // Iniciar servidor mesmo com erro
    startServer();
  });
}

function startServer() {
  console.log('🚀 Iniciando servidor...');
  console.log('');

  // Executar ensure-frontend-build.js
  const ensureBuild = spawn('node', ['scripts/ensure-frontend-build.js'], {
    stdio: 'inherit',
    env: process.env
  });

  ensureBuild.on('close', (code) => {
    if (code !== 0) {
      console.log('⚠️  Frontend build check falhou, mas continuando...');
    }

    // Iniciar server-cluster.js
    const server = spawn('node', ['--max-old-space-size=8192', 'src/server-cluster.js'], {
      stdio: 'inherit',
      env: process.env
    });

    server.on('error', (err) => {
      console.error('❌ ERRO AO INICIAR SERVIDOR:', err.message);
      process.exit(1);
    });

    // Propagar sinais de encerramento
    process.on('SIGTERM', () => server.kill('SIGTERM'));
    process.on('SIGINT', () => server.kill('SIGINT'));
  });

  ensureBuild.on('error', (err) => {
    console.error('❌ ERRO AO VERIFICAR BUILD:', err.message);
    console.log('Continuando mesmo assim...');

    // Tentar iniciar servidor direto
    const server = spawn('node', ['--max-old-space-size=8192', 'src/server-cluster.js'], {
      stdio: 'inherit',
      env: process.env
    });

    process.on('SIGTERM', () => server.kill('SIGTERM'));
    process.on('SIGINT', () => server.kill('SIGINT'));
  });
}
