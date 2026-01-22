#!/usr/bin/env node

/**
 * Test Runner para Testes de Exportação
 *
 * Executa todos os testes do sistema de exportação
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
  const line = '='.repeat(60);
  log('\n' + line, 'cyan');
  log(title, 'bright');
  log(line, 'cyan');
}

/**
 * Executa um arquivo de teste
 */
function runTest(testFile) {
  return new Promise((resolve, reject) => {
    const testPath = join(__dirname, testFile);

    log(`\n▶️  Executando: ${testFile}`, 'blue');

    const child = spawn('node', ['--test', testPath], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' }
    });

    child.on('close', (code) => {
      if (code === 0) {
        log(`✅ ${testFile} passou\n`, 'green');
        resolve({ file: testFile, passed: true });
      } else {
        log(`❌ ${testFile} falhou\n`, 'red');
        resolve({ file: testFile, passed: false });
      }
    });

    child.on('error', (error) => {
      log(`❌ Erro ao executar ${testFile}: ${error.message}`, 'red');
      reject(error);
    });
  });
}

/**
 * Executa todos os testes
 */
async function runAllTests() {
  const startTime = Date.now();

  header('🧪 TESTES DO SISTEMA DE EXPORTAÇÃO');

  const tests = [
    'unit/export-service.test.js',
    'unit/pdf-generator-service.test.js'
  ];

  const results = [];

  for (const test of tests) {
    try {
      const result = await runTest(test);
      results.push(result);
    } catch (error) {
      console.error('Erro fatal:', error);
      process.exit(1);
    }
  }

  // Resumo
  const duration = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  header('📊 RESUMO DOS TESTES');

  log(`✅ Passou:  ${passed}/${results.length}`, passed > 0 ? 'green' : 'reset');
  log(`❌ Falhou:  ${failed}/${results.length}`, failed > 0 ? 'red' : 'reset');
  log(`⏱️  Duração: ${duration}ms`, 'cyan');

  if (failed > 0) {
    log('\n❌ Alguns testes falharam', 'red');
    process.exit(1);
  } else {
    log('\n✅ Todos os testes passaram!', 'green');
    process.exit(0);
  }
}

/**
 * Executa testes de integração
 */
async function runIntegrationTests() {
  header('🔗 TESTES DE INTEGRAÇÃO');

  log('\n⚠️  ATENÇÃO: Testes de integração requerem servidor rodando', 'yellow');
  log('Execute: npm start (em outro terminal)\n', 'yellow');

  const result = await runTest('integration/export-routes.test.js');

  if (result.passed) {
    log('\n✅ Testes de integração passaram!', 'green');
    process.exit(0);
  } else {
    log('\n❌ Testes de integração falharam', 'red');
    process.exit(1);
  }
}

// Parse argumentos
const args = process.argv.slice(2);
const mode = args[0];

if (mode === 'integration') {
  runIntegrationTests();
} else if (mode === 'unit') {
  runAllTests();
} else if (mode === 'all') {
  // Executa tudo
  (async () => {
    await runAllTests();
    await runIntegrationTests();
  })();
} else {
  // Padrão: apenas unit tests
  runAllTests();
}
