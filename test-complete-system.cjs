#!/usr/bin/env node

/**
 * ROM Agent - Sistema de Testes Completo
 * Testa todas as funcionalidades e APIs
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const results = [];

// Cores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;

    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function testEndpoint(name, url, options = {}, expectedStatus = 200) {
  log(`\n🔍 Testando: ${name}`, 'blue');
  log(`   URL: ${url}`);

  try {
    const startTime = Date.now();
    const result = await makeRequest(url, options);
    const duration = Date.now() - startTime;

    const passed = result.status === expectedStatus;
    const status = passed ? '✅ PASSOU' : '❌ FALHOU';
    const statusColor = passed ? 'green' : 'red';

    log(`   Status: ${result.status} (esperado: ${expectedStatus})`, statusColor);
    log(`   Tempo: ${duration}ms`);

    if (result.data && typeof result.data === 'object') {
      log(`   Resposta: ${JSON.stringify(result.data).substring(0, 100)}...`);
    }

    results.push({
      name,
      url,
      status: result.status,
      expected: expectedStatus,
      passed,
      duration,
      data: result.data
    });

    log(status, statusColor);
    return result;

  } catch (error) {
    log(`   ❌ ERRO: ${error.message}`, 'red');
    results.push({
      name,
      url,
      status: 0,
      expected: expectedStatus,
      passed: false,
      error: error.message
    });
    return null;
  }
}

async function runTests() {
  log('\n╔════════════════════════════════════════════════════╗', 'blue');
  log('║   ROM AGENT - TESTE COMPLETO DO SISTEMA          ║', 'blue');
  log('╚════════════════════════════════════════════════════╝', 'blue');

  // 1. TESTES DE SISTEMA
  log('\n\n📊 === CATEGORIA 1: SISTEMA E HEALTH CHECK ===', 'yellow');

  await testEndpoint(
    '1.1 Health Check',
    `${BASE_URL}/api/info`
  );

  await testEndpoint(
    '1.2 Estatísticas',
    `${BASE_URL}/api/stats`
  );

  // 2. TESTES DE CONVERSAÇÃO
  log('\n\n💬 === CATEGORIA 2: SISTEMA DE CONVERSAÇÃO ===', 'yellow');

  await testEndpoint(
    '2.1 Listar Conversas Organizadas',
    `${BASE_URL}/api/conversations/organized`
  );

  // Teste de chat
  const chatResult = await testEndpoint(
    '2.2 Enviar Mensagem ao Chat',
    `${BASE_URL}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Teste de sistema - responda apenas com OK' })
    }
  );

  let conversationId = null;
  if (chatResult && chatResult.data && chatResult.data.conversationId) {
    conversationId = chatResult.data.conversationId;
    log(`   💾 Conversation ID criado: ${conversationId}`, 'green');
  }

  // Testar obter conversa específica
  if (conversationId) {
    await testEndpoint(
      '2.3 Obter Conversa Específica',
      `${BASE_URL}/api/conversations/${conversationId}`
    );

    await testEndpoint(
      '2.4 Renomear Conversa',
      `${BASE_URL}/api/conversations/${conversationId}/rename`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Teste Automático - Renomeado' })
      }
    );
  }

  await testEndpoint(
    '2.5 Criar Nova Conversa',
    `${BASE_URL}/api/conversations`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nova Conversa de Teste' })
    }
  );

  // 3. TESTES DE KNOWLEDGE BASE
  log('\n\n📚 === CATEGORIA 3: KNOWLEDGE BASE ===', 'yellow');

  await testEndpoint(
    '3.1 Listar Documentos KB',
    `${BASE_URL}/api/kb/documents`
  );

  await testEndpoint(
    '3.2 Status KB',
    `${BASE_URL}/api/kb/status`
  );

  // 4. TESTES DE AUTENTICAÇÃO
  log('\n\n🔐 === CATEGORIA 4: AUTENTICAÇÃO ===', 'yellow');

  await testEndpoint(
    '4.1 Status de Autenticação',
    `${BASE_URL}/api/auth/status`
  );

  const loginResult = await testEndpoint(
    '4.2 Login',
    `${BASE_URL}/api/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'rodolfo@rom.adv.br',
        password: 'admin123'
      })
    }
  );

  // 5. TESTES DE PROJETOS
  log('\n\n📁 === CATEGORIA 5: PROJETOS ===', 'yellow');

  await testEndpoint(
    '5.1 Listar Projetos',
    `${BASE_URL}/api/projects/list`
  );

  // 6. TESTES DE FERRAMENTAS AVANÇADAS
  log('\n\n🔧 === CATEGORIA 6: FERRAMENTAS AVANÇADAS ===', 'yellow');

  await testEndpoint(
    '6.1 Busca Semântica',
    `${BASE_URL}/api/semantic-search`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'teste', limit: 5 })
    }
  );

  await testEndpoint(
    '6.2 Listar Templates',
    `${BASE_URL}/api/templates/list`
  );

  await testEndpoint(
    '6.3 Status de Backups',
    `${BASE_URL}/api/backup/status`
  );

  await testEndpoint(
    '6.4 Estatísticas de Cache',
    `${BASE_URL}/api/cache/statistics`
  );

  // 7. TESTES DE MÓDULOS ESPECÍFICOS
  log('\n\n⚖️ === CATEGORIA 7: MÓDULOS JURÍDICOS ===', 'yellow');

  await testEndpoint(
    '7.1 Pesquisa de Jurisprudência (Mock)',
    `${BASE_URL}/api/jurisprudencia/buscar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ termo: 'teste', tribunal: 'STF' })
    },
    404 // Esperado 404 pois endpoint pode não existir
  );

  // 8. TESTE DE PÁGINA INICIAL
  log('\n\n🌐 === CATEGORIA 8: FRONTEND ===', 'yellow');

  await testEndpoint(
    '8.1 Página Principal (HTML)',
    `${BASE_URL}/`,
    {},
    200
  );

  // RELATÓRIO FINAL
  log('\n\n╔════════════════════════════════════════════════════╗', 'blue');
  log('║            RELATÓRIO FINAL DOS TESTES             ║', 'blue');
  log('╚════════════════════════════════════════════════════╝', 'blue');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const successRate = ((passed / total) * 100).toFixed(1);

  log(`\n📊 Estatísticas:`, 'yellow');
  log(`   Total de testes: ${total}`);
  log(`   ✅ Passou: ${passed}`, 'green');
  log(`   ❌ Falhou: ${failed}`, 'red');
  log(`   📈 Taxa de sucesso: ${successRate}%`, successRate >= 80 ? 'green' : 'yellow');

  // Testes que falharam
  if (failed > 0) {
    log(`\n❌ Testes que falharam:`, 'red');
    results.filter(r => !r.passed).forEach(r => {
      log(`   • ${r.name}`);
      log(`     URL: ${r.url}`);
      log(`     Status: ${r.status} (esperado: ${r.expected})`);
      if (r.error) log(`     Erro: ${r.error}`);
    });
  }

  // Salvar relatório em arquivo
  const reportPath = path.join(__dirname, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { total, passed, failed, successRate: parseFloat(successRate) },
    results
  }, null, 2));

  log(`\n💾 Relatório salvo em: ${reportPath}`, 'blue');

  // Status final
  if (successRate >= 90) {
    log('\n🎉 SISTEMA FUNCIONANDO PERFEITAMENTE!', 'green');
  } else if (successRate >= 70) {
    log('\n⚠️  SISTEMA FUNCIONANDO COM ALGUNS PROBLEMAS', 'yellow');
  } else {
    log('\n❌ SISTEMA COM PROBLEMAS CRÍTICOS', 'red');
  }
}

// Executar testes
runTests().catch(error => {
  log(`\n❌ Erro fatal durante execução dos testes: ${error.message}`, 'red');
  process.exit(1);
});
