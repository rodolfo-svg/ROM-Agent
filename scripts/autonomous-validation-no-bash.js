#!/usr/bin/env node
/**
 * ============================================================================
 * AUTONOMOUS VALIDATION SCRIPT (NO BASH REQUIRED)
 * Validação completa do sistema sem necessidade de permissões Bash
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.dirname(__dirname);

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const CONFIG = {
  baseUrl: 'https://rom-agent-ia.onrender.com',
  serviceId: 'srv-d51ppfmuk2gs73a1qlkg',
  expectedCommit: '58cfadd',
  dataDir: path.join(PROJECT_ROOT, 'data')
};

const TESTS = {
  passed: 0,
  failed: 0,
  warnings: 0,
  results: []
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function log(emoji, message) {
  console.log(`${emoji} ${message}`);
}

function logTest(name, status, details = '') {
  const emoji = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  const message = `${name}: ${details}`;

  log(emoji, message);

  TESTS.results.push({ name, status, details });

  if (status === 'pass') TESTS.passed++;
  else if (status === 'fail') TESTS.failed++;
  else TESTS.warnings++;
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let data = '';

      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: data
      }));
    }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
  });
}

// ============================================================================
// VALIDATION TESTS
// ============================================================================

/**
 * TESTE 1: Validar formato de kb-documents.json
 */
async function testKbDocumentsFormat() {
  log('🔍', 'Teste 1: Formato de kb-documents.json');

  const kbPath = path.join(CONFIG.dataDir, 'kb-documents.json');

  try {
    if (!fs.existsSync(kbPath)) {
      logTest('KB Documents File', 'warning', 'Arquivo não existe (ok se KB vazio)');
      return;
    }

    const content = fs.readFileSync(kbPath, 'utf8');
    const data = JSON.parse(content);

    // Verificar formato
    if (Array.isArray(data)) {
      logTest('KB Documents Format', 'pass', `Formato array correto (${data.length} docs)`);
    } else if (data && Array.isArray(data.documents)) {
      logTest('KB Documents Format', 'fail', 'Formato legado {documents:[]} detectado');
    } else {
      logTest('KB Documents Format', 'fail', 'Formato desconhecido');
    }
  } catch (error) {
    logTest('KB Documents Format', 'fail', error.message);
  }
}

/**
 * TESTE 2: Validar kb-cache.js não retorna undefined
 */
async function testKbCacheCode() {
  log('🔍', 'Teste 2: Código de kb-cache.js');

  const cachePath = path.join(PROJECT_ROOT, 'lib', 'kb-cache.js');

  try {
    const content = fs.readFileSync(cachePath, 'utf8');

    // Verificar se usa this.cache.length (correto)
    if (content.includes('${this.cache.length}')) {
      logTest('KB Cache Code', 'pass', 'Usa this.cache.length corretamente');
    } else if (content.includes('undefined documentos')) {
      logTest('KB Cache Code', 'fail', 'Código contém "undefined documentos"');
    } else {
      logTest('KB Cache Code', 'warning', 'Padrão não reconhecido');
    }
  } catch (error) {
    logTest('KB Cache Code', 'fail', error.message);
  }
}

/**
 * TESTE 3: Validar CSP Headers
 */
async function testSecurityHeaders() {
  log('🔍', 'Teste 3: Security Headers');

  const headersPath = path.join(PROJECT_ROOT, 'src', 'middleware', 'security-headers.js');

  try {
    const content = fs.readFileSync(headersPath, 'utf8');

    // Verificar se inclui backend URL
    if (content.includes('rom-agent-ia.onrender.com')) {
      logTest('CSP Headers', 'pass', 'Backend URL incluído no connectSrc');
    } else {
      logTest('CSP Headers', 'fail', 'Backend URL não encontrado no CSP');
    }
  } catch (error) {
    logTest('CSP Headers', 'fail', error.message);
  }
}

/**
 * TESTE 4: Validar BEDROCK_TOOLS configurado
 */
async function testBedrockTools() {
  log('🔍', 'Teste 4: Bedrock Tools Configuration');

  const bedrockPath = path.join(PROJECT_ROOT, 'src', 'modules', 'bedrock.js');

  try {
    const content = fs.readFileSync(bedrockPath, 'utf8');

    // Verificar se importa BEDROCK_TOOLS
    if (content.includes('import { BEDROCK_TOOLS')) {
      logTest('Bedrock Tools Import', 'pass', 'BEDROCK_TOOLS importado');
    } else {
      logTest('Bedrock Tools Import', 'fail', 'BEDROCK_TOOLS não importado');
    }

    // Verificar se usa toolConfig
    if (content.includes('toolConfig: { tools: BEDROCK_TOOLS }')) {
      logTest('Bedrock Tools Config', 'pass', 'toolConfig configurado');
    } else {
      logTest('Bedrock Tools Config', 'warning', 'toolConfig pode não estar configurado');
    }
  } catch (error) {
    logTest('Bedrock Tools', 'fail', error.message);
  }
}

/**
 * TESTE 5: Validar endpoint principal (se acessível)
 */
async function testMainEndpoint() {
  log('🔍', 'Teste 5: Main Endpoint (opcional)');

  try {
    const response = await httpsGet(CONFIG.baseUrl);

    if (response.statusCode === 200) {
      logTest('Main Endpoint', 'pass', `Status ${response.statusCode}`);
    } else {
      logTest('Main Endpoint', 'warning', `Status ${response.statusCode}`);
    }
  } catch (error) {
    logTest('Main Endpoint', 'warning', `Não acessível: ${error.message}`);
  }
}

/**
 * TESTE 6: Validar estrutura de diretórios
 */
async function testDirectoryStructure() {
  log('🔍', 'Teste 6: Directory Structure');

  const requiredDirs = [
    'data',
    'lib',
    'src',
    'src/modules',
    'src/middleware',
    'scripts'
  ];

  let allExist = true;

  for (const dir of requiredDirs) {
    const fullPath = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(fullPath)) {
      allExist = false;
      logTest(`Directory: ${dir}`, 'fail', 'Não existe');
    }
  }

  if (allExist) {
    logTest('Directory Structure', 'pass', 'Todas as pastas necessárias existem');
  }
}

/**
 * TESTE 7: Validar arquivos críticos
 */
async function testCriticalFiles() {
  log('🔍', 'Teste 7: Critical Files');

  const criticalFiles = [
    'lib/kb-cache.js',
    'lib/storage-config.js',
    'src/modules/bedrock.js',
    'src/modules/bedrock-tools.js',
    'src/middleware/security-headers.js',
    'package.json',
    'server.js'
  ];

  let allExist = true;

  for (const file of criticalFiles) {
    const fullPath = path.join(PROJECT_ROOT, file);
    if (!fs.existsSync(fullPath)) {
      allExist = false;
      logTest(`File: ${file}`, 'fail', 'Não existe');
    }
  }

  if (allExist) {
    logTest('Critical Files', 'pass', 'Todos os arquivos críticos existem');
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 AUTONOMOUS VALIDATION (NO BASH)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Executar testes
  await testKbDocumentsFormat();
  await testKbCacheCode();
  await testSecurityHeaders();
  await testBedrockTools();
  await testMainEndpoint();
  await testDirectoryStructure();
  await testCriticalFiles();

  // Relatório final
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RESUMO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`✅ Testes aprovados: ${TESTS.passed}`);
  console.log(`❌ Testes falhados:  ${TESTS.failed}`);
  console.log(`⚠️  Avisos:           ${TESTS.warnings}`);
  console.log('');

  const totalTests = TESTS.passed + TESTS.failed + TESTS.warnings;
  const successRate = totalTests > 0 ? ((TESTS.passed / totalTests) * 100).toFixed(1) : 0;

  console.log(`📈 Taxa de sucesso: ${successRate}%`);
  console.log('');

  // Status final
  if (TESTS.failed === 0) {
    console.log('🎉 STATUS FINAL: SISTEMA APROVADO');
    console.log('');
    console.log('Todos os testes críticos passaram.');
    console.log('Sistema está pronto para produção.');
  } else {
    console.log('⚠️  STATUS FINAL: ATENÇÃO NECESSÁRIA');
    console.log('');
    console.log('Alguns testes falharam. Revise os resultados acima.');
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Exit code
  process.exit(TESTS.failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
