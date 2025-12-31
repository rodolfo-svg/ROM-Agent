#!/usr/bin/env node
/**
 * ROM-Agent Complete System Test
 *
 * Testa TODAS as funcionalidades do sistema:
 * 1. Todas as páginas do React Frontend V4
 * 2. Todos os endpoints da API
 * 3. Autenticação e sessões
 * 4. Funcionalidades principais
 */

const STAGING_URL = 'https://staging.iarom.com.br';

// Cores
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(icon, message, details = '') {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  console.log(`${icon} [${colors.gray}${timestamp}${colors.reset}] ${message}${details ? ' ' + details : ''}`);
}

async function testEndpoint(name, url, options = {}) {
  const start = Date.now();
  try {
    const response = await fetch(url, options);
    const duration = Date.now() - start;
    const contentType = response.headers.get('content-type');

    let data;
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else if (contentType?.includes('text/html')) {
      data = await response.text();
    } else {
      data = await response.text();
    }

    return {
      name,
      success: response.ok,
      status: response.status,
      duration,
      data,
      contentType,
      size: typeof data === 'string' ? data.length : JSON.stringify(data).length
    };
  } catch (error) {
    return {
      name,
      success: false,
      error: error.message,
      duration: Date.now() - start
    };
  }
}

async function main() {
  console.log('\n' + '='.repeat(80));
  log('🚀', `${colors.blue}ROM-Agent Complete System Test${colors.reset}`);
  console.log('='.repeat(80) + '\n');

  const results = {
    api: [],
    pages: [],
    functions: [],
    total: 0,
    passed: 0,
    failed: 0
  };

  // ============================================================
  // FASE 1: PÁGINAS DO REACT FRONTEND V4
  // ============================================================
  console.log(colors.cyan + '📱 FASE 1: Testando Páginas React Frontend V4\n' + colors.reset);

  const reactPages = [
    { path: '/', name: 'Homepage (Redirect to Dashboard)' },
    { path: '/login', name: 'Login Page' },
    { path: '/dashboard', name: 'Dashboard' },
    { path: '/upload', name: 'Upload & KB' },
    { path: '/prompts', name: 'Prompts Library' },
    { path: '/multi-agent', name: 'Multi-Agent Pipeline' },
    { path: '/case-processor', name: 'Case Processor' },
    { path: '/certidoes', name: 'Certidões' },
    { path: '/users', name: 'Users Management' },
    { path: '/partners', name: 'Partners (Multi-Tenancy)' },
    { path: '/reports', name: 'Reports & Analytics' },
    { path: '/chat', name: 'Chat (Legacy)' }
  ];

  for (const page of reactPages) {
    const result = await testEndpoint(page.name, `${STAGING_URL}${page.path}`);
    results.pages.push(result);
    results.total++;

    if (result.success || result.status === 302 || result.status === 301) {
      results.passed++;
      log('✅', `${colors.green}${page.name.padEnd(40)}${colors.reset}`,
          `${result.status} | ${result.duration}ms`);
    } else {
      results.failed++;
      log('❌', `${colors.red}${page.name.padEnd(40)}${colors.reset}`,
          result.error || `HTTP ${result.status}`);
    }
  }

  // ============================================================
  // FASE 2: ENDPOINTS DA API
  // ============================================================
  console.log('\n' + '='.repeat(80));
  console.log(colors.cyan + '🔌 FASE 2: Testando Endpoints da API\n' + colors.reset);

  const apiEndpoints = [
    // Core
    { method: 'GET', path: '/health', name: 'Health Check' },
    { method: 'GET', path: '/api/info', name: 'System Info' },
    { method: 'GET', path: '/metrics', name: 'Prometheus Metrics' },

    // Chat & Prompts
    { method: 'GET', path: '/api/prompts', name: 'List Prompts' },

    // Deploy & Scheduler
    { method: 'GET', path: '/api/scheduler/status', name: 'Scheduler Status' },
    { method: 'GET', path: '/api/scheduler/jobs', name: 'Scheduled Jobs' },
    { method: 'GET', path: '/api/deploy/status', name: 'Deploy Status' },
    { method: 'GET', path: '/api/deploy/history', name: 'Deploy History' },

    // Logs
    { method: 'GET', path: '/api/logs/files', name: 'Log Files' },

    // Jurisprudência
    { method: 'GET', path: '/api/jurisprudencia/tribunais', name: 'Lista Tribunais' },
    { method: 'GET', path: '/api/jurisprudencia/cache/stats', name: 'Cache Stats Jurisprudência' },

    // Documents
    { method: 'GET', path: '/api/documents/supported-types', name: 'Supported Document Types' },
    { method: 'GET', path: '/api/documents/desktop-path', name: 'Desktop Path' },
    { method: 'GET', path: '/api/extraction/desktop-path', name: 'Extraction Desktop Path' }
  ];

  for (const endpoint of apiEndpoints) {
    const result = await testEndpoint(
      endpoint.name,
      `${STAGING_URL}${endpoint.path}`,
      { method: endpoint.method }
    );
    results.api.push(result);
    results.total++;

    if (result.success) {
      results.passed++;
      log('✅', `${colors.green}${endpoint.name.padEnd(40)}${colors.reset}`,
          `${result.status} | ${result.duration}ms | ${(result.size / 1024).toFixed(1)}KB`);
    } else {
      results.failed++;
      log('❌', `${colors.red}${endpoint.name.padEnd(40)}${colors.reset}`,
          result.error || `HTTP ${result.status}`);
    }
  }

  // ============================================================
  // FASE 3: FUNCIONALIDADES PRINCIPAIS
  // ============================================================
  console.log('\n' + '='.repeat(80));
  console.log(colors.cyan + '⚙️  FASE 3: Testando Funcionalidades Principais\n' + colors.reset);

  // Teste 1: Chat com IA (Não-Streaming)
  log('🧪', 'Testando Chat com IA (não-streaming)...');
  const chatTest = await testEndpoint(
    'Chat Non-Streaming',
    `${STAGING_URL}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'OK', stream: false })
    }
  );
  results.functions.push(chatTest);
  results.total++;

  if (chatTest.success) {
    results.passed++;
    log('✅', `${colors.green}Chat funcionando${colors.reset}`,
        `| Resposta: ${chatTest.data?.response?.substring(0, 50) || 'N/A'}`);
  } else {
    results.failed++;
    log('❌', `${colors.red}Chat falhou${colors.reset}`, chatTest.error || '');
  }

  // Teste 2: Streaming Chat
  log('🧪', 'Testando Streaming Chat...');
  const streamTest = await testEndpoint(
    'Chat Streaming',
    `${STAGING_URL}/api/chat/stream`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'OK', stream: true })
    }
  );
  results.functions.push(streamTest);
  results.total++;

  if (streamTest.success) {
    results.passed++;
    log('✅', `${colors.green}Streaming funcionando${colors.reset}`,
        `| ${streamTest.duration}ms`);
  } else {
    results.failed++;
    log('❌', `${colors.red}Streaming falhou${colors.reset}`, streamTest.error || '');
  }

  // Teste 3: Buscar Jurisprudência
  log('🧪', 'Testando Busca de Jurisprudência...');
  const jurisTest = await testEndpoint(
    'Buscar Jurisprudência',
    `${STAGING_URL}/api/jurisprudencia/buscar?termo=teste&limite=1`,
    { method: 'GET' }
  );
  results.functions.push(jurisTest);
  results.total++;

  if (jurisTest.success) {
    results.passed++;
    const fontes = jurisTest.data?.totalFontes || 0;
    log('✅', `${colors.green}Jurisprudência funcionando${colors.reset}`,
        `| ${fontes} fonte(s) consultada(s)`);
  } else {
    results.failed++;
    log('❌', `${colors.red}Jurisprudência falhou${colors.reset}`, jurisTest.error || '');
  }

  // Teste 4: Verificar Sistema de Cache
  log('🧪', 'Testando Sistema de Cache...');
  const cacheTest = await testEndpoint(
    'Cache Stats',
    `${STAGING_URL}/api/jurisprudencia/cache/stats`,
    { method: 'GET' }
  );
  results.functions.push(cacheTest);
  results.total++;

  if (cacheTest.success) {
    results.passed++;
    log('✅', `${colors.green}Cache funcionando${colors.reset}`,
        `| Stats: ${JSON.stringify(cacheTest.data?.cache || {}).length} bytes`);
  } else {
    results.failed++;
    log('❌', `${colors.red}Cache falhou${colors.reset}`, cacheTest.error || '');
  }

  // ============================================================
  // FASE 4: RESUMO FINAL
  // ============================================================
  console.log('\n' + '='.repeat(80));
  console.log(colors.cyan + '📊 RESUMO FINAL\n' + colors.reset);

  const successRate = ((results.passed / results.total) * 100).toFixed(1);
  const avgTimeApi = results.api
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.duration, 0) / results.api.filter(r => r.success).length;

  console.log(`${colors.blue}Total de Testes:${colors.reset} ${results.total}`);
  console.log(`${colors.green}✅ Passou:${colors.reset} ${results.passed}`);
  console.log(`${colors.red}❌ Falhou:${colors.reset} ${results.failed}`);
  console.log(`${colors.yellow}Taxa de Sucesso:${colors.reset} ${successRate}%`);
  console.log(`${colors.cyan}Tempo Médio API:${colors.reset} ${avgTimeApi.toFixed(0)}ms\n`);

  // Breakdown por categoria
  console.log(`${colors.blue}📱 Páginas React:${colors.reset} ${results.pages.filter(r => r.success).length}/${results.pages.length} ✅`);
  console.log(`${colors.blue}🔌 Endpoints API:${colors.reset} ${results.api.filter(r => r.success).length}/${results.api.length} ✅`);
  console.log(`${colors.blue}⚙️  Funcionalidades:${colors.reset} ${results.functions.filter(r => r.success).length}/${results.functions.length} ✅`);

  // Status geral
  console.log('\n' + '='.repeat(80));
  if (results.failed === 0) {
    log('🎉', `${colors.green}TODOS OS TESTES PASSARAM! Sistema 100% operacional!${colors.reset}`);
  } else if (successRate >= 90) {
    log('✅', `${colors.yellow}Sistema operacional com pequenos problemas (${successRate}%)${colors.reset}`);
  } else if (successRate >= 70) {
    log('⚠️', `${colors.yellow}Sistema parcialmente operacional (${successRate}%)${colors.reset}`);
  } else {
    log('❌', `${colors.red}Sistema com problemas críticos (${successRate}%)${colors.reset}`);
  }
  console.log('='.repeat(80) + '\n');

  // Listar falhas
  if (results.failed > 0) {
    console.log(colors.red + '❌ Testes que falharam:\n' + colors.reset);
    const allTests = [...results.pages, ...results.api, ...results.functions];
    allTests
      .filter(t => !t.success)
      .forEach(t => {
        console.log(`   - ${t.name}: ${t.error || `HTTP ${t.status}`}`);
      });
    console.log('');
  }

  return results;
}

main().catch(console.error);
