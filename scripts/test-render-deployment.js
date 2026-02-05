#!/usr/bin/env node
/**
 * SCRIPT DE TESTE COMPLETO - DIAGNÓSTICO DE DEPLOY NO RENDER
 *
 * Testa todos os aspectos do serviço para identificar o problema
 *
 * Uso:
 *   node scripts/test-render-deployment.js
 *   node scripts/test-render-deployment.js --url https://rom-agent.onrender.com
 *   node scripts/test-render-deployment.js --local (testa localhost:3000)
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
let BASE_URL = 'https://rom-agent.onrender.com';

if (args.includes('--local')) {
  BASE_URL = 'http://localhost:3000';
} else if (args.includes('--url')) {
  const urlIndex = args.indexOf('--url');
  BASE_URL = args[urlIndex + 1];
}

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║                                                              ║');
console.log('║  🔍 DIAGNÓSTICO COMPLETO DE DEPLOY - RENDER                 ║');
console.log('║                                                              ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`🎯 Target: ${BASE_URL}`);
console.log('⏰ Iniciado em:', new Date().toLocaleString('pt-BR'));
console.log('');
console.log('═'.repeat(70));
console.log('');

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = urlObj.protocol === 'https:' ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'ROM-Agent-Test-Script/1.0',
        'Accept': 'application/json, text/html',
        ...options.headers
      },
      timeout: options.timeout || 15000
    };

    const startTime = Date.now();

    const req = lib.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const elapsedTime = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: data,
          elapsedTime
        });
      });
    });

    req.on('error', (error) => {
      const elapsedTime = Date.now() - startTime;
      reject({
        error: error.message,
        code: error.code,
        elapsedTime
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const elapsedTime = Date.now() - startTime;
      reject({
        error: 'Request timeout',
        code: 'ETIMEDOUT',
        elapsedTime
      });
    });

    req.end();
  });
}

function printResult(testName, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`${icon} ${testName.padEnd(50)} [${status}]`);
  if (details) {
    console.log(`   ${details}`);
  }
}

function printInfo(message) {
  console.log(`ℹ️  ${message}`);
}

function printWarning(message) {
  console.log(`⚠️  ${message}`);
}

function printError(message) {
  console.log(`❌ ${message}`);
}

function printSection(title) {
  console.log('');
  console.log('─'.repeat(70));
  console.log(`📋 ${title}`);
  console.log('─'.repeat(70));
  console.log('');
}

// ═══════════════════════════════════════════════════════════════════════
// TESTES
// ═══════════════════════════════════════════════════════════════════════

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

async function runTest(name, testFn) {
  results.total++;
  try {
    const result = await testFn();
    if (result.passed) {
      results.passed++;
    } else if (result.warning) {
      results.warnings++;
    } else {
      results.failed++;
    }
    results.tests.push({ name, ...result });
    printResult(name, result.passed, result.details);
    return result;
  } catch (error) {
    results.failed++;
    const result = { passed: false, error: error.message };
    results.tests.push({ name, ...result });
    printResult(name, false, `Error: ${error.message}`);
    return result;
  }
}

// ───────────────────────────────────────────────────────────────────────
// TESTE 1: CONECTIVIDADE BÁSICA
// ───────────────────────────────────────────────────────────────────────

printSection('TESTE 1: CONECTIVIDADE BÁSICA');

await runTest('1.1 DNS Resolution', async () => {
  const url = new URL(BASE_URL);
  try {
    const dns = await import('dns').then(m => m.promises);
    const addresses = await dns.resolve4(url.hostname);
    return {
      passed: addresses.length > 0,
      details: `IP: ${addresses[0]}`
    };
  } catch (error) {
    return {
      passed: false,
      details: `DNS Error: ${error.message}`
    };
  }
});

await runTest('1.2 HTTP/HTTPS Connection', async () => {
  try {
    const response = await makeRequest(BASE_URL, { timeout: 10000 });
    return {
      passed: response.statusCode !== undefined,
      details: `Status: ${response.statusCode}, Time: ${response.elapsedTime}ms`
    };
  } catch (error) {
    return {
      passed: false,
      details: error.error
    };
  }
});

await runTest('1.3 Response Headers', async () => {
  try {
    const response = await makeRequest(BASE_URL);
    const hasRenderHeader = response.headers['x-render-routing'] !== undefined;
    const renderStatus = response.headers['x-render-routing'];

    return {
      passed: renderStatus !== 'no-server',
      warning: renderStatus === 'no-server',
      details: `x-render-routing: ${renderStatus || 'not-set'}`
    };
  } catch (error) {
    return {
      passed: false,
      details: error.error
    };
  }
});

// ───────────────────────────────────────────────────────────────────────
// TESTE 2: ENDPOINTS CRÍTICOS
// ───────────────────────────────────────────────────────────────────────

printSection('TESTE 2: ENDPOINTS CRÍTICOS');

const endpoints = [
  { path: '/', name: 'Root (Frontend)' },
  { path: '/login', name: 'Login Page' },
  { path: '/api/models', name: 'API - Models List' },
  { path: '/api/health', name: 'API - Health Check' },
  { path: '/api/system-prompts', name: 'API - System Prompts' }
];

for (const endpoint of endpoints) {
  await runTest(`2.${endpoints.indexOf(endpoint) + 1} ${endpoint.name}`, async () => {
    try {
      const response = await makeRequest(`${BASE_URL}${endpoint.path}`);
      const isSuccess = response.statusCode < 400;
      const isNotFound = response.statusCode === 404;
      const isNoServer = response.headers['x-render-routing'] === 'no-server';

      return {
        passed: isSuccess && !isNoServer,
        warning: isNotFound || isNoServer,
        details: `HTTP ${response.statusCode} (${response.elapsedTime}ms)${isNoServer ? ' - NO SERVER' : ''}`
      };
    } catch (error) {
      return {
        passed: false,
        details: error.error
      };
    }
  });
}

// ───────────────────────────────────────────────────────────────────────
// TESTE 3: PERFORMANCE E TIMEOUT
// ───────────────────────────────────────────────────────────────────────

printSection('TESTE 3: PERFORMANCE E TIMEOUT');

await runTest('3.1 Response Time (< 3s)', async () => {
  try {
    const response = await makeRequest(BASE_URL, { timeout: 5000 });
    const isFast = response.elapsedTime < 3000;
    return {
      passed: isFast,
      warning: !isFast && response.elapsedTime < 10000,
      details: `${response.elapsedTime}ms ${isFast ? '(OK)' : '(SLOW)'}`
    };
  } catch (error) {
    return {
      passed: false,
      details: error.error
    };
  }
});

await runTest('3.2 Cold Start Detection', async () => {
  // Fazer 2 requisições e comparar tempos
  try {
    const req1 = await makeRequest(BASE_URL);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const req2 = await makeRequest(BASE_URL);

    const isColdStart = req1.elapsedTime > (req2.elapsedTime * 2);

    return {
      passed: true,
      warning: isColdStart,
      details: `1st: ${req1.elapsedTime}ms, 2nd: ${req2.elapsedTime}ms ${isColdStart ? '(Cold start detected)' : '(Warmed up)'}`
    };
  } catch (error) {
    return {
      passed: false,
      details: error.error
    };
  }
});

// ───────────────────────────────────────────────────────────────────────
// TESTE 4: ANÁLISE DE RESPOSTA
// ───────────────────────────────────────────────────────────────────────

printSection('TESTE 4: ANÁLISE DE RESPOSTA');

await runTest('4.1 Content Type', async () => {
  try {
    const response = await makeRequest(BASE_URL);
    const contentType = response.headers['content-type'] || 'not-set';
    const hasValidContent = contentType.includes('text/html') ||
                           contentType.includes('application/json');

    return {
      passed: hasValidContent,
      details: contentType
    };
  } catch (error) {
    return {
      passed: false,
      details: error.error
    };
  }
});

await runTest('4.2 Response Body', async () => {
  try {
    const response = await makeRequest(BASE_URL);
    const hasBody = response.body && response.body.length > 0;
    const bodySize = response.body ? response.body.length : 0;

    return {
      passed: hasBody,
      details: `${bodySize} bytes`
    };
  } catch (error) {
    return {
      passed: false,
      details: error.error
    };
  }
});

await runTest('4.3 Error Messages', async () => {
  try {
    const response = await makeRequest(BASE_URL);
    const body = response.body.toLowerCase();

    const errorIndicators = [
      'not found',
      'error',
      'crashed',
      'unavailable',
      'timeout',
      'no server'
    ];

    const foundErrors = errorIndicators.filter(indicator => body.includes(indicator));

    return {
      passed: foundErrors.length === 0,
      warning: foundErrors.length > 0,
      details: foundErrors.length > 0 ? `Found: ${foundErrors.join(', ')}` : 'No errors detected'
    };
  } catch (error) {
    return {
      passed: false,
      details: error.error
    };
  }
});

// ───────────────────────────────────────────────────────────────────────
// TESTE 5: SSL/TLS (apenas HTTPS)
// ───────────────────────────────────────────────────────────────────────

if (BASE_URL.startsWith('https://')) {
  printSection('TESTE 5: SSL/TLS');

  await runTest('5.1 Valid SSL Certificate', async () => {
    try {
      const response = await makeRequest(BASE_URL);
      // Se chegou aqui sem rejeitar certificado, é válido
      return {
        passed: true,
        details: 'Certificate valid'
      };
    } catch (error) {
      const isCertError = error.code === 'CERT_HAS_EXPIRED' ||
                         error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
      return {
        passed: !isCertError,
        details: error.error
      };
    }
  });
}

// ───────────────────────────────────────────────────────────────────────
// TESTE 6: DIAGNÓSTICO ESPECÍFICO DO RENDER
// ───────────────────────────────────────────────────────────────────────

printSection('TESTE 6: DIAGNÓSTICO RENDER');

await runTest('6.1 Render Service Status', async () => {
  try {
    const response = await makeRequest(BASE_URL);
    const renderRouting = response.headers['x-render-routing'];

    if (renderRouting === 'no-server') {
      return {
        passed: false,
        details: 'Server not responding - check Render logs for crashes'
      };
    } else if (!renderRouting) {
      return {
        passed: false,
        details: 'Not a Render deployment or custom domain'
      };
    } else {
      return {
        passed: true,
        details: `Routing: ${renderRouting}`
      };
    }
  } catch (error) {
    return {
      passed: false,
      details: error.error
    };
  }
});

await runTest('6.2 Server Headers Analysis', async () => {
  try {
    const response = await makeRequest(BASE_URL);
    const serverHeader = response.headers['server'] || 'not-set';
    const xPoweredBy = response.headers['x-powered-by'] || 'not-set';

    return {
      passed: true,
      details: `Server: ${serverHeader}, X-Powered-By: ${xPoweredBy}`
    };
  } catch (error) {
    return {
      passed: false,
      details: error.error
    };
  }
});

// ═══════════════════════════════════════════════════════════════════════
// RELATÓRIO FINAL
// ═══════════════════════════════════════════════════════════════════════

console.log('');
console.log('═'.repeat(70));
console.log('📊 RELATÓRIO FINAL');
console.log('═'.repeat(70));
console.log('');

console.log(`Total de Testes:    ${results.total}`);
console.log(`✅ Passaram:        ${results.passed}`);
console.log(`❌ Falharam:        ${results.failed}`);
console.log(`⚠️  Avisos:          ${results.warnings}`);
console.log('');

const successRate = ((results.passed / results.total) * 100).toFixed(1);
console.log(`Taxa de Sucesso:    ${successRate}%`);
console.log('');

// ───────────────────────────────────────────────────────────────────────
// DIAGNÓSTICO AUTOMÁTICO
// ───────────────────────────────────────────────────────────────────────

console.log('═'.repeat(70));
console.log('🔍 DIAGNÓSTICO AUTOMÁTICO');
console.log('═'.repeat(70));
console.log('');

// Verificar padrões de falha
const allFailed = results.failed === results.total;
const noServerDetected = results.tests.some(t =>
  t.details && t.details.includes('no-server')
);
const timeoutDetected = results.tests.some(t =>
  t.details && t.details.includes('timeout')
);
const dnsFailure = results.tests.find(t => t.name.includes('DNS'))?.passed === false;
const slowResponses = results.tests.filter(t =>
  t.details && /\d{4,}ms/.test(t.details)
).length > 2;

if (allFailed) {
  printError('CRÍTICO: Todos os testes falharam');
  console.log('');
  console.log('Possíveis causas:');
  console.log('  1. Serviço completamente offline');
  console.log('  2. URL incorreta');
  console.log('  3. Firewall bloqueando conexões');
  console.log('');
} else if (noServerDetected) {
  printError('CRÍTICO: Render retornando "no-server"');
  console.log('');
  console.log('Este erro significa que:');
  console.log('  ❌ O servidor não está respondendo health checks do Render');
  console.log('  ❌ O processo pode estar crashando no startup');
  console.log('  ❌ O servidor não está fazendo bind na porta correta');
  console.log('');
  console.log('AÇÕES NECESSÁRIAS:');
  console.log('  1. Acessar Render Dashboard → Logs (aba "Logs", não "Events")');
  console.log('  2. Procurar por:');
  console.log('     - Mensagens de erro (Error:, TypeError:)');
  console.log('     - "Exited with code 1" (crash)');
  console.log('     - Última mensagem antes de parar');
  console.log('     - "Cannot find module" (dependência faltando)');
  console.log('  3. Verificar se migrations estão travando');
  console.log('  4. Verificar memória: pode estar com OOM (Out of Memory)');
  console.log('');
} else if (dnsFailure) {
  printError('CRÍTICO: Falha na resolução DNS');
  console.log('');
  console.log('Possíveis causas:');
  console.log('  1. Domínio não existe ou não está configurado');
  console.log('  2. Problema de rede local');
  console.log('  3. DNS temporariamente indisponível');
  console.log('');
} else if (timeoutDetected) {
  printWarning('AVISO: Timeouts detectados');
  console.log('');
  console.log('Possíveis causas:');
  console.log('  1. Cold start (primeira requisição após inatividade)');
  console.log('  2. Servidor processando algo pesado no startup');
  console.log('  3. Migrations demorando muito');
  console.log('  4. Memória insuficiente (swap thrashing)');
  console.log('');
} else if (slowResponses) {
  printWarning('AVISO: Respostas lentas detectadas');
  console.log('');
  console.log('Possíveis causas:');
  console.log('  1. Cold start normal do Render Free tier');
  console.log('  2. Servidor sobrecarregado');
  console.log('  3. Database connection lenta');
  console.log('');
} else if (results.passed === results.total) {
  console.log('✅ TUDO OK! Serviço funcionando normalmente.');
  console.log('');
} else {
  printWarning('Alguns testes falharam, mas serviço está parcialmente funcional');
  console.log('');
  console.log('Revisar testes falhados acima para detalhes específicos.');
  console.log('');
}

// ───────────────────────────────────────────────────────────────────────
// PRÓXIMOS PASSOS
// ───────────────────────────────────────────────────────────────────────

if (results.failed > 0) {
  console.log('═'.repeat(70));
  console.log('📋 PRÓXIMOS PASSOS RECOMENDADOS');
  console.log('═'.repeat(70));
  console.log('');

  if (noServerDetected) {
    console.log('1. OBTER LOGS DE RUNTIME DO RENDER:');
    console.log('   → Dashboard: https://dashboard.render.com/');
    console.log('   → Clicar no serviço "rom-agent"');
    console.log('   → Aba "Logs" (não "Events")');
    console.log('   → Copiar últimas 50-100 linhas');
    console.log('');
    console.log('2. VERIFICAR COMMIT ATUAL:');
    console.log('   → Confirmar qual commit está LIVE');
    console.log('   → Verificar se últimas alterações causaram o problema');
    console.log('');
    console.log('3. ROLLBACK SE NECESSÁRIO:');
    console.log('   → Render Dashboard → Deploy de commit anterior');
    console.log('   → Commit seguro: de391f1 (antes da arquitetura)');
    console.log('');
  }

  console.log('4. TESTAR LOCALMENTE:');
  console.log('   → npm run db:migrate');
  console.log('   → npm start');
  console.log('   → node scripts/test-render-deployment.js --local');
  console.log('');
}

// ───────────────────────────────────────────────────────────────────────
// INFORMAÇÕES ADICIONAIS
// ───────────────────────────────────────────────────────────────────────

console.log('═'.repeat(70));
console.log('ℹ️  INFORMAÇÕES ADICIONAIS');
console.log('═'.repeat(70));
console.log('');
console.log('Para mais ajuda:');
console.log('  • Logs detalhados: Render Dashboard → Logs');
console.log('  • Métricas: Render Dashboard → Metrics');
console.log('  • Status: https://status.render.com/');
console.log('  • Docs: https://render.com/docs');
console.log('');
console.log('⏰ Finalizado em:', new Date().toLocaleString('pt-BR'));
console.log('');

// Exit code
process.exit(results.failed > 0 ? 1 : 0);
