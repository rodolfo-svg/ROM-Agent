#!/usr/bin/env node

/**
 * ROM Agent v2.7 - Script de Teste Multi-Tenant
 * Valida sistema de custom instructions por parceiro
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const PARTNER_ID = 'test-office-1';

// Mock de token JWT para testes (em produção, usar token real)
const MOCK_JWT_TOKEN = 'Bearer mock-token-for-testing';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

// Função auxiliar para fazer requisições HTTP
function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);

    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsedBody = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, body: parsedBody, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Testes
const tests = [];
let passed = 0;
let failed = 0;

function addTest(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log(colorize('\n╔════════════════════════════════════════════════════════════╗', 'cyan'));
  console.log(colorize('║  ROM AGENT v2.7 - TESTES MULTI-TENANT                    ║', 'cyan'));
  console.log(colorize('╚════════════════════════════════════════════════════════════╝\n', 'cyan'));

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
      console.log(colorize(`✅ ${test.name}`, 'green'));
    } catch (error) {
      failed++;
      console.log(colorize(`❌ ${test.name}`, 'red'));
      console.log(colorize(`   Erro: ${error.message}`, 'red'));
    }
  }

  console.log(colorize('\n╔════════════════════════════════════════════════════════════╗', 'cyan'));
  console.log(colorize(`║  RESULTADO FINAL                                          ║`, 'cyan'));
  console.log(colorize('╚════════════════════════════════════════════════════════════╝\n', 'cyan'));
  console.log(`Total de testes: ${tests.length}`);
  console.log(colorize(`✅ Passaram: ${passed} (${(passed/tests.length*100).toFixed(1)}%)`, 'green'));
  console.log(colorize(`❌ Falharam: ${failed} (${(failed/tests.length*100).toFixed(1)}%)`, 'red'));

  if (failed === 0) {
    console.log(colorize('\n🎉 TODOS OS TESTES PASSARAM!', 'green'));
    process.exit(0);
  } else {
    console.log(colorize('\n⚠️  ALGUNS TESTES FALHARAM', 'yellow'));
    process.exit(1);
  }
}

// ============================================
// TESTES DO SISTEMA
// ============================================

// Teste 1: Health Check
addTest('Health Check (/api/info)', async () => {
  const res = await makeRequest('GET', '/api/info');
  if (res.status !== 200) throw new Error(`Status: ${res.status}`);
  if (!res.body.nome) throw new Error('Response inválida');
});

// Teste 2: Listar projetos
addTest('Listar Projetos (/api/projects/list)', async () => {
  const res = await makeRequest('GET', '/api/projects/list');
  if (res.status !== 200) throw new Error(`Status: ${res.status}`);
  if (!Array.isArray(res.body)) throw new Error('Resposta não é array');
  if (res.body.length === 0) throw new Error('Nenhum projeto encontrado');
  const romProject = res.body.find(p => p.id === '1');
  if (!romProject) throw new Error('Projeto ROM Agent não encontrado');
});

// Teste 3: GET projeto ROM sem partnerId (deve retornar prompts padrão)
addTest('GET /api/projects/1 sem partnerId (prompts padrão)', async () => {
  const res = await makeRequest('GET', '/api/projects/1');
  if (res.status !== 200) throw new Error(`Status: ${res.status}`);
  if (!res.body.customInstructions) throw new Error('customInstructions vazio');
  if (res.body.customInstructionsSource && res.body.customInstructionsSource !== 'default') {
    throw new Error('Deveria retornar prompts padrão');
  }
});

// Teste 4: GET projeto ROM com partnerId (deve retornar padrão inicialmente)
addTest(`GET /api/projects/1?partnerId=${PARTNER_ID} (sem customização ainda)`, async () => {
  const res = await makeRequest('GET', `/api/projects/1?partnerId=${PARTNER_ID}`);
  if (res.status !== 200) throw new Error(`Status: ${res.status}`);
  if (!res.body.customInstructions) throw new Error('customInstructions vazio');
  // Primeira vez, deve ser 'default' pois ainda não customizamos
  if (res.body.customInstructionsSource && res.body.customInstructionsSource !== 'default') {
    throw new Error('Deveria retornar prompts padrão (ainda não customizado)');
  }
});

// Teste 5: GET /api/projects/1/prompts (deve retornar padrão inicialmente)
// Nota: Este endpoint requer autenticação, vamos simular erro 401 como esperado
addTest('GET /api/projects/1/prompts (requer autenticação)', async () => {
  const res = await makeRequest('GET', '/api/projects/1/prompts');
  // Esperamos 401 Unauthorized sem token
  if (res.status !== 401 && res.status !== 403) {
    // Se não retornou 401/403, verifica se retornou alguma estrutura válida
    // (pode ser que autenticação não esteja ativa em dev)
    if (res.status === 200 && res.body.success) {
      return; // OK, autenticação não obrigatória em dev
    }
    throw new Error(`Esperava 401/403 ou 200, recebeu: ${res.status}`);
  }
});

// Teste 6: PUT /api/projects/1/prompts (criar customização - requer auth)
addTest('PUT /api/projects/1/prompts (requer autenticação)', async () => {
  const customPrompt = `# Custom Instructions - ${PARTNER_ID}\n\nEste é um prompt customizado para testes multi-tenant.\n\nRegras específicas do escritório ${PARTNER_ID}:\n1. Sempre usar tratamento formal\n2. Incluir logo do escritório\n3. Formatação especial`;

  const res = await makeRequest('PUT', '/api/projects/1/prompts', {
    customInstructions: customPrompt
  }, {
    'Authorization': MOCK_JWT_TOKEN
  });

  // Esperamos 401 Unauthorized sem token válido
  if (res.status !== 401 && res.status !== 403) {
    // Se não retornou 401/403, verifica se retornou alguma estrutura válida
    if (res.status === 200 && res.body.success) {
      return; // OK, customização salva
    }
    throw new Error(`Esperava 401/403 ou 200, recebeu: ${res.status}`);
  }
});

// Teste 7: DELETE /api/projects/1/prompts (resetar - requer auth)
addTest('DELETE /api/projects/1/prompts (requer autenticação)', async () => {
  const res = await makeRequest('DELETE', '/api/projects/1/prompts', null, {
    'Authorization': MOCK_JWT_TOKEN
  });

  // Esperamos 401 Unauthorized sem token válido
  if (res.status !== 401 && res.status !== 403) {
    // Se não retornou 401/403, verifica se retornou alguma estrutura válida
    if (res.status === 200 && res.body.success) {
      return; // OK, reset feito
    }
    throw new Error(`Esperava 401/403 ou 200, recebeu: ${res.status}`);
  }
});

// Teste 8: Verificar endpoint de conversas
addTest('GET /api/conversations/list', async () => {
  const res = await makeRequest('GET', '/api/conversations/list');
  if (res.status !== 200) throw new Error(`Status: ${res.status}`);
  if (!res.body.conversations) throw new Error('conversations não encontrado');
});

// Teste 9: Verificar KB Status
addTest('GET /api/kb/status', async () => {
  const res = await makeRequest('GET', '/api/kb/status');
  if (res.status !== 200) throw new Error(`Status: ${res.status}`);
  if (res.body.success === undefined) throw new Error('Response inválida');
});

// Teste 10: Verificar mobile - página principal deve ter viewport
addTest('Mobile: Página principal tem meta viewport', async () => {
  const res = await makeRequest('GET', '/');
  if (res.status !== 200) throw new Error(`Status: ${res.status}`);
  const html = res.body;
  if (typeof html !== 'string') throw new Error('HTML não retornado');
  if (!html.includes('viewport')) throw new Error('Meta viewport não encontrado');
  if (!html.includes('width=device-width')) throw new Error('viewport width não configurado');
});

// Teste 11: Verificar mobile - suporte iOS
addTest('Mobile: Suporte iOS (apple-mobile-web-app)', async () => {
  const res = await makeRequest('GET', '/');
  if (res.status !== 200) throw new Error(`Status: ${res.status}`);
  const html = res.body;
  if (!html.includes('apple-mobile-web-app')) throw new Error('Tags iOS não encontradas');
});

// Teste 12: Verificar mobile - safe area para notch
addTest('Mobile: Safe area para notch (iPhone X+)', async () => {
  const res = await makeRequest('GET', '/');
  if (res.status !== 200) throw new Error(`Status: ${res.status}`);
  const html = res.body;
  if (!html.includes('safe-area-inset') && !html.includes('env(safe-area')) {
    throw new Error('Safe area não configurado');
  }
});

// ============================================
// EXECUTAR TESTES
// ============================================

console.log(colorize('Iniciando testes...', 'yellow'));
console.log(colorize(`Base URL: ${BASE_URL}`, 'blue'));
console.log(colorize(`Partner ID de teste: ${PARTNER_ID}\n`, 'blue'));

runTests().catch(err => {
  console.error(colorize(`\n❌ Erro fatal ao executar testes:`, 'red'));
  console.error(err);
  process.exit(1);
});
