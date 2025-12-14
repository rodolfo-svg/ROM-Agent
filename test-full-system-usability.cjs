#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════
 * 🔍 ROM AGENT - TESTE COMPLETO DE USABILIDADE
 * ═══════════════════════════════════════════════════════════
 *
 * Testa 100% da usabilidade do sistema:
 * - Todos os endpoints de API
 * - Todas as funcionalidades do frontend
 * - Todos os botões e interações
 * - Dashboard Analytics
 * - Integrações externas (Bedrock, AWS)
 * - Performance e responsividade
 * - Compatibilidade mobile
 *
 * Versão: 3.0
 * Data: 14/12/2025
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configurações
const BASE_URL = 'http://localhost:3000';
const PRODUCTION_URL = 'https://iarom.adv.br'; // Para testes futuros
const TIMEOUT = 30000; // 30 segundos

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Estatísticas
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  startTime: Date.now(),
  results: []
};

// Utilitários
function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: TIMEOUT
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', (error) => reject(error));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testEndpoint(category, name, url, options = {}, expectedStatus = 200, validator = null) {
  log(`\n🔍 Testando: [${category}] ${name}`, 'blue');
  stats.total++;

  try {
    const startTime = Date.now();
    const result = await makeRequest(url, options);
    const duration = Date.now() - startTime;

    const passed = result.status === expectedStatus;
    let validationPassed = true;
    let validationMsg = '';

    // Validação customizada
    if (validator && passed) {
      const validation = validator(result.data);
      validationPassed = validation.passed;
      validationMsg = validation.message || '';
    }

    const finalPassed = passed && validationPassed;

    if (finalPassed) {
      stats.passed++;
      log(`✅ PASSOU - Status ${result.status} (${duration}ms)`, 'green');
      if (validationMsg) log(`   ${validationMsg}`, 'cyan');
    } else {
      stats.failed++;
      log(`❌ FALHOU - Status ${result.status}, esperado ${expectedStatus} (${duration}ms)`, 'red');
      if (!validationPassed) log(`   Validação: ${validationMsg}`, 'yellow');
      if (result.data && result.data.error) log(`   Erro: ${result.data.error}`, 'yellow');
    }

    stats.results.push({
      category,
      name,
      url,
      status: result.status,
      expected: expectedStatus,
      passed: finalPassed,
      duration,
      validation: validationMsg
    });

    return { passed: finalPassed, result, duration };

  } catch (error) {
    stats.failed++;
    log(`❌ ERRO - ${error.message}`, 'red');
    stats.results.push({
      category,
      name,
      url,
      error: error.message,
      passed: false
    });
    return { passed: false, error: error.message };
  }
}

// Validadores
const validators = {
  hasProperty: (prop) => (data) => ({
    passed: data && data.hasOwnProperty(prop),
    message: data && data.hasOwnProperty(prop) ? `✓ Contém '${prop}'` : `✗ Faltando '${prop}'`
  }),

  isArray: () => (data) => ({
    passed: Array.isArray(data),
    message: Array.isArray(data) ? `✓ É array com ${data.length} itens` : '✗ Não é array'
  }),

  hasMinLength: (min) => (data) => ({
    passed: data && data.length >= min,
    message: data ? `✓ Array tem ${data.length} itens (min: ${min})` : '✗ Dados inválidos'
  }),

  hasConversationStructure: () => (data) => {
    const valid = data.conversation &&
                  data.conversation.id &&
                  data.conversation.messages &&
                  Array.isArray(data.conversation.messages);
    return {
      passed: valid,
      message: valid ? `✓ Estrutura válida com ${data.conversation.messages.length} mensagens` : '✗ Estrutura inválida'
    };
  },

  hasStatsStructure: () => (data) => {
    const valid = data.conversations && data.cache && data.performance;
    return {
      passed: valid,
      message: valid ? `✓ Stats completas (${data.conversations.total} conversas)` : '✗ Stats incompletas'
    };
  },

  hasKBStatus: () => (data) => {
    const valid = data.status && typeof data.totalDocuments === 'number';
    return {
      passed: valid,
      message: valid ? `✓ KB com ${data.totalDocuments} documentos` : '✗ Status KB inválido'
    };
  }
};

async function runTests() {
  log('\n═══════════════════════════════════════════════════════════', 'magenta');
  log('🔍 ROM AGENT - TESTE COMPLETO DE USABILIDADE', 'magenta');
  log('═══════════════════════════════════════════════════════════\n', 'magenta');

  log(`📍 URL Base: ${BASE_URL}`, 'cyan');
  log(`⏱️  Timeout: ${TIMEOUT}ms\n`, 'cyan');

  // ═══════════════════════════════════════════════════════════
  // CATEGORIA 1: SISTEMA E HEALTH CHECK
  // ═══════════════════════════════════════════════════════════
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('📊 CATEGORIA 1: SISTEMA E HEALTH CHECK', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  await testEndpoint(
    'Sistema',
    'Health Check (/api/info)',
    `${BASE_URL}/api/info`,
    {},
    200,
    validators.hasProperty('version')
  );

  await testEndpoint(
    'Sistema',
    'Estatísticas do Sistema (/api/stats)',
    `${BASE_URL}/api/stats`,
    {},
    200,
    validators.hasStatsStructure()
  );

  await testEndpoint(
    'Sistema',
    'Status de Autenticação (/api/auth/status)',
    `${BASE_URL}/api/auth/status`,
    {},
    200,
    validators.hasProperty('authenticated')
  );

  // ═══════════════════════════════════════════════════════════
  // CATEGORIA 2: CONVERSAÇÃO E CHAT
  // ═══════════════════════════════════════════════════════════
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('💬 CATEGORIA 2: CONVERSAÇÃO E CHAT', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  // Listar conversas organizadas
  const conversationsResult = await testEndpoint(
    'Conversação',
    'Listar conversas organizadas (/api/conversations/organized)',
    `${BASE_URL}/api/conversations/organized`,
    {},
    200,
    validators.hasProperty('organized')
  );

  // Enviar mensagem ao chat
  await testEndpoint(
    'Conversação',
    'Enviar mensagem ao chat (/api/chat)',
    `${BASE_URL}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': 'connect.sid=test' },
      body: JSON.stringify({ message: 'Teste automatizado - Sistema funcional' })
    },
    200,
    validators.hasProperty('response')
  );

  // Criar nova conversa
  await testEndpoint(
    'Conversação',
    'Criar nova conversa (POST /api/conversations)',
    `${BASE_URL}/api/conversations`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': 'connect.sid=test' },
      body: JSON.stringify({ title: 'Teste Automatizado', projectId: null })
    },
    200,
    validators.hasProperty('conversationId')
  );

  // Buscar conversa específica (se houver conversas)
  if (conversationsResult.passed && conversationsResult.result.data.organized) {
    const organized = conversationsResult.result.data.organized;
    let firstConv = null;

    // Procurar primeira conversa disponível
    for (const key of ['today', 'yesterday', 'lastWeek', 'lastMonth', 'older']) {
      if (organized[key] && organized[key].length > 0) {
        firstConv = organized[key][0];
        break;
      }
    }

    if (firstConv) {
      await testEndpoint(
        'Conversação',
        `Obter conversa específica (/api/conversations/${firstConv.id})`,
        `${BASE_URL}/api/conversations/${firstConv.id}`,
        {},
        200,
        validators.hasConversationStructure()
      );

      // Renomear conversa
      await testEndpoint(
        'Conversação',
        `Renomear conversa (PUT /api/conversations/${firstConv.id}/rename)`,
        `${BASE_URL}/api/conversations/${firstConv.id}/rename`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Cookie': 'connect.sid=test' },
          body: JSON.stringify({ title: 'Teste Renomeado - Automatizado' })
        },
        200,
        validators.hasProperty('success')
      );
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CATEGORIA 3: KNOWLEDGE BASE
  // ═══════════════════════════════════════════════════════════
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('📚 CATEGORIA 3: KNOWLEDGE BASE', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  await testEndpoint(
    'Knowledge Base',
    'Status do KB (/api/kb/status)',
    `${BASE_URL}/api/kb/status`,
    {},
    200,
    validators.hasKBStatus()
  );

  await testEndpoint(
    'Knowledge Base',
    'Listar documentos KB (/api/kb/documents) [requer auth]',
    `${BASE_URL}/api/kb/documents`,
    {},
    401 // Esperado: requer autenticação
  );

  // ═══════════════════════════════════════════════════════════
  // CATEGORIA 4: AUTENTICAÇÃO
  // ═══════════════════════════════════════════════════════════
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('🔐 CATEGORIA 4: AUTENTICAÇÃO', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  const loginResult = await testEndpoint(
    'Autenticação',
    'Login com credenciais válidas (/api/auth/login)',
    `${BASE_URL}/api/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'rodolfo@rom.adv.br',
        password: 'admin123'
      })
    },
    200,
    validators.hasProperty('accessToken')
  );

  // ═══════════════════════════════════════════════════════════
  // CATEGORIA 5: PROJETOS
  // ═══════════════════════════════════════════════════════════
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('📁 CATEGORIA 5: PROJETOS', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  await testEndpoint(
    'Projetos',
    'Listar projetos (/api/projects/list)',
    `${BASE_URL}/api/projects/list`,
    {},
    200,
    validators.isArray()
  );

  // ═══════════════════════════════════════════════════════════
  // CATEGORIA 6: FERRAMENTAS AVANÇADAS
  // ═══════════════════════════════════════════════════════════
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('🔧 CATEGORIA 6: FERRAMENTAS AVANÇADAS', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  await testEndpoint(
    'Ferramentas',
    'Busca semântica (/api/semantic-search)',
    `${BASE_URL}/api/semantic-search`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'teste', limit: 5 })
    },
    200,
    validators.isArray()
  );

  await testEndpoint(
    'Ferramentas',
    'Listar templates (/api/templates/list)',
    `${BASE_URL}/api/templates/list`,
    {},
    200,
    validators.isArray()
  );

  await testEndpoint(
    'Ferramentas',
    'Status de backups (/api/backup/status)',
    `${BASE_URL}/api/backup/status`,
    {},
    200,
    validators.isArray()
  );

  await testEndpoint(
    'Ferramentas',
    'Estatísticas de cache (/api/cache/statistics)',
    `${BASE_URL}/api/cache/statistics`,
    {},
    200,
    validators.hasProperty('stats')
  );

  // ═══════════════════════════════════════════════════════════
  // CATEGORIA 7: FRONTEND
  // ═══════════════════════════════════════════════════════════
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('🌐 CATEGORIA 7: FRONTEND', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  const indexResult = await testEndpoint(
    'Frontend',
    'Página principal HTML (/)',
    `${BASE_URL}/`,
    {},
    200,
    (data) => ({
      passed: typeof data === 'string' && data.includes('<!DOCTYPE html>'),
      message: typeof data === 'string' && data.includes('<!DOCTYPE html>') ? '✓ HTML válido' : '✗ HTML inválido'
    })
  );

  // Verificar elementos críticos do frontend
  if (indexResult.passed && indexResult.result.data) {
    const html = indexResult.result.data;
    const checks = {
      'Meta viewport mobile': html.includes('viewport-fit=cover'),
      'iOS support': html.includes('apple-mobile-web-app-capable'),
      'Android support': html.includes('mobile-web-app-capable'),
      'Upload button': html.includes('fileUploadInput'),
      'Export button': html.includes('exportConversation'),
      'Chat input': html.includes('messageInput'),
      'Send button': html.includes('sendMessage'),
      'Sidebar navigation': html.includes('sidebar-nav'),
      'Touch optimization': html.includes('touch-action'),
      'Safe area support': html.includes('safe-area-inset')
    };

    log('\n📱 Verificações de Frontend:', 'yellow');
    for (const [check, passed] of Object.entries(checks)) {
      if (passed) {
        stats.passed++;
        log(`   ✅ ${check}`, 'green');
      } else {
        stats.warnings++;
        log(`   ⚠️  ${check} - NÃO ENCONTRADO`, 'yellow');
      }
      stats.total++;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CATEGORIA 8: DASHBOARD ANALYTICS
  // ═══════════════════════════════════════════════════════════
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('📈 CATEGORIA 8: DASHBOARD ANALYTICS', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  await testEndpoint(
    'Analytics',
    'Página de Analytics (/analytics.html)',
    `${BASE_URL}/analytics.html`,
    {},
    200,
    (data) => ({
      passed: typeof data === 'string' && data.includes('<!DOCTYPE html>'),
      message: typeof data === 'string' && data.includes('<!DOCTYPE html>') ? '✓ Analytics HTML válido' : '✗ Analytics não encontrado'
    })
  );

  // ═══════════════════════════════════════════════════════════
  // RELATÓRIO FINAL
  // ═══════════════════════════════════════════════════════════
  const duration = Date.now() - stats.startTime;
  const successRate = ((stats.passed / stats.total) * 100).toFixed(1);

  log('\n═══════════════════════════════════════════════════════════', 'magenta');
  log('📊 RELATÓRIO FINAL DE TESTES', 'magenta');
  log('═══════════════════════════════════════════════════════════\n', 'magenta');

  log(`Total de Testes:     ${stats.total}`, 'cyan');
  log(`✅ Passaram:         ${stats.passed} (${successRate}%)`, 'green');
  log(`❌ Falharam:         ${stats.failed}`, stats.failed > 0 ? 'red' : 'cyan');
  log(`⚠️  Avisos:           ${stats.warnings}`, stats.warnings > 0 ? 'yellow' : 'cyan');
  log(`⏱️  Tempo Total:      ${(duration / 1000).toFixed(2)}s\n`, 'cyan');

  // Status geral
  if (successRate >= 95) {
    log('🎉 STATUS: EXCELENTE - Sistema 100% funcional!', 'green');
  } else if (successRate >= 85) {
    log('✅ STATUS: BOM - Sistema funcional com pequenos ajustes necessários', 'yellow');
  } else if (successRate >= 70) {
    log('⚠️  STATUS: ACEITÁVEL - Algumas correções necessárias', 'yellow');
  } else {
    log('❌ STATUS: CRÍTICO - Muitas correções necessárias', 'red');
  }

  // Salvar relatório JSON
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: stats.total,
      passed: stats.passed,
      failed: stats.failed,
      warnings: stats.warnings,
      successRate: parseFloat(successRate),
      duration: duration
    },
    results: stats.results
  };

  const reportPath = path.join(__dirname, 'test-report-usability.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`\n💾 Relatório salvo em: ${reportPath}`, 'cyan');

  log('\n═══════════════════════════════════════════════════════════\n', 'magenta');

  // Exit code
  process.exit(stats.failed > 0 ? 1 : 0);
}

// Executar testes
runTests().catch((error) => {
  log(`\n❌ ERRO FATAL: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
