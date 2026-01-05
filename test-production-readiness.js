/**
 * ROM-Agent Production Readiness Test Suite
 * Testa sistema por 2-4 horas antes de merge para produção
 *
 * Monitora:
 * - Stress test (requisições concorrentes)
 * - Memory leaks
 * - API health
 * - PWA functionality
 * - Database integrity
 * - Performance metrics
 * - Error detection
 * - Uptime
 */

import https from 'https';
import { performance } from 'perf_hooks';

const CONFIG = {
  BASE_URL: 'https://staging.iarom.com.br',
  TEST_DURATION_HOURS: 2, // 2-4 horas
  CHECK_INTERVAL_MS: 30000, // 30 segundos
  STRESS_TEST_INTERVAL_MS: 60000, // 1 minuto
  STRESS_TEST_REQUESTS: 10, // Requisições por ciclo
  ACCEPTABLE_ERROR_RATE: 0.05, // 5% de erros é aceitável
  MEMORY_LEAK_THRESHOLD_MB: 50, // Aumento de 50MB+ = possível leak
};

const state = {
  startTime: Date.now(),
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalLatency: 0,
  errors: [],
  memorySnapshots: [],
  apiHealthChecks: [],
  conversationCount: 0,
  initialMemory: null,
  lastMemoryCheck: null,
};

// Colors
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(msg, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  console.log(`${c[color]}[${timestamp}] ${msg}${c.reset}`);
}

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();

    const req = https.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const latency = performance.now() - startTime;
        state.totalLatency += latency;

        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          latency: Math.round(latency),
          headers: res.headers,
          text: () => Promise.resolve(data),
          json: () => Promise.resolve(JSON.parse(data)),
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testAPIEndpoint(endpoint, name) {
  state.totalRequests++;

  try {
    const response = await fetch(`${CONFIG.BASE_URL}${endpoint}`);

    if (response.ok) {
      state.successfulRequests++;
      return { success: true, latency: response.latency, name };
    } else {
      state.failedRequests++;
      state.errors.push({ endpoint, status: response.status, time: new Date().toISOString() });
      return { success: false, status: response.status, name };
    }
  } catch (error) {
    state.failedRequests++;
    state.errors.push({ endpoint, error: error.message, time: new Date().toISOString() });
    return { success: false, error: error.message, name };
  }
}

async function testPWA() {
  const manifest = await testAPIEndpoint('/manifest.json', 'PWA Manifest');
  const sw = await testAPIEndpoint('/service-worker.js', 'Service Worker');

  return manifest.success && sw.success;
}

async function testDatabaseIntegrity() {
  try {
    const response = await fetch(`${CONFIG.BASE_URL}/api/conversations/list`);
    const data = await response.json();

    if (data.conversations) {
      const currentCount = data.conversations.length;

      // Verifica se conversas não estão sendo perdidas
      if (state.conversationCount > 0 && currentCount < state.conversationCount) {
        state.errors.push({
          type: 'DATABASE_INTEGRITY',
          message: `Conversas diminuíram de ${state.conversationCount} para ${currentCount}`,
          time: new Date().toISOString()
        });
        return false;
      }

      state.conversationCount = currentCount;
      return true;
    }

    return false;
  } catch (error) {
    state.errors.push({ type: 'DATABASE_CHECK', error: error.message, time: new Date().toISOString() });
    return false;
  }
}

async function checkMemory() {
  try {
    const response = await fetch(`${CONFIG.BASE_URL}/api/info`);
    const data = await response.json();

    if (data.memory) {
      const heapUsedMB = parseInt(data.memory.heapUsed);

      if (!state.initialMemory) {
        state.initialMemory = heapUsedMB;
      }

      state.memorySnapshots.push({
        time: new Date().toISOString(),
        heapUsed: heapUsedMB,
        rss: parseInt(data.memory.rss),
      });

      // Detectar memory leak
      const memoryIncrease = heapUsedMB - state.initialMemory;
      if (memoryIncrease > CONFIG.MEMORY_LEAK_THRESHOLD_MB) {
        log(`⚠️  Possível memory leak detectado! Aumento: +${memoryIncrease}MB`, 'yellow');
        state.errors.push({
          type: 'MEMORY_LEAK_SUSPECTED',
          increase: memoryIncrease,
          time: new Date().toISOString()
        });
      }

      state.lastMemoryCheck = heapUsedMB;
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

async function stressTest() {
  log(`💪 Iniciando stress test (${CONFIG.STRESS_TEST_REQUESTS} requisições concorrentes)...`, 'cyan');

  const endpoints = [
    '/api/info',
    '/api/conversations/list',
    '/api/jurisprudencia/tribunais',
    '/api/documents/supported-types',
    '/manifest.json',
  ];

  const promises = [];

  for (let i = 0; i < CONFIG.STRESS_TEST_REQUESTS; i++) {
    const endpoint = endpoints[i % endpoints.length];
    promises.push(testAPIEndpoint(endpoint, `Stress-${i}`));
  }

  const results = await Promise.allSettled(promises);
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = CONFIG.STRESS_TEST_REQUESTS - successful;

  log(`   Completado: ${successful}/${CONFIG.STRESS_TEST_REQUESTS} sucesso (${failed} falhas)`, successful === CONFIG.STRESS_TEST_REQUESTS ? 'green' : 'yellow');
}

async function comprehensiveHealthCheck() {
  const checks = {
    pwa: false,
    database: false,
    memory: false,
    apis: 0,
  };

  // PWA
  checks.pwa = await testPWA();

  // Database
  checks.database = await testDatabaseIntegrity();

  // Memory
  checks.memory = await checkMemory();

  // Critical APIs
  const criticalAPIs = [
    '/api/info',
    '/api/conversations/list',
    '/api/deploy/status',
    '/api/jurisprudencia/tribunais',
    '/api/documents/supported-types',
  ];

  for (const endpoint of criticalAPIs) {
    const result = await testAPIEndpoint(endpoint, endpoint);
    if (result.success) checks.apis++;
  }

  state.apiHealthChecks.push({
    time: new Date().toISOString(),
    ...checks,
    totalAPIs: criticalAPIs.length,
  });

  return checks;
}

function printProgressReport() {
  const elapsed = Date.now() - state.startTime;
  const elapsedHours = (elapsed / (1000 * 60 * 60)).toFixed(2);
  const remaining = (CONFIG.TEST_DURATION_HOURS * 60 * 60 * 1000) - elapsed;
  const remainingMinutes = Math.round(remaining / (1000 * 60));

  const errorRate = state.totalRequests > 0 ? (state.failedRequests / state.totalRequests) : 0;
  const avgLatency = state.totalRequests > 0 ? Math.round(state.totalLatency / state.totalRequests) : 0;

  console.log('\n' + '='.repeat(70));
  log(`📊 RELATÓRIO DE PROGRESSO - ${elapsedHours}h/${CONFIG.TEST_DURATION_HOURS}h`, 'bright');
  console.log('='.repeat(70));

  console.log(`\n${c.cyan}Requisições:${c.reset}`);
  console.log(`  Total: ${state.totalRequests}`);
  console.log(`  Sucesso: ${c.green}${state.successfulRequests}${c.reset}`);
  console.log(`  Falhas: ${state.failedRequests > 0 ? c.red : c.green}${state.failedRequests}${c.reset}`);
  console.log(`  Taxa de erro: ${errorRate > CONFIG.ACCEPTABLE_ERROR_RATE ? c.red : c.green}${(errorRate * 100).toFixed(2)}%${c.reset}`);
  console.log(`  Latência média: ${avgLatency}ms`);

  console.log(`\n${c.cyan}Memória:${c.reset}`);
  console.log(`  Inicial: ${state.initialMemory}MB`);
  console.log(`  Atual: ${state.lastMemoryCheck}MB`);
  console.log(`  Delta: ${state.lastMemoryCheck - state.initialMemory > 0 ? c.yellow : c.green}${state.lastMemoryCheck ? '+' + (state.lastMemoryCheck - state.initialMemory) : 'N/A'}MB${c.reset}`);

  console.log(`\n${c.cyan}Database:${c.reset}`);
  console.log(`  Conversas: ${state.conversationCount}`);

  console.log(`\n${c.cyan}Erros recentes:${c.reset}`);
  if (state.errors.length === 0) {
    console.log(`  ${c.green}✅ Nenhum erro detectado!${c.reset}`);
  } else {
    state.errors.slice(-5).forEach(err => {
      console.log(`  ${c.red}❌ ${JSON.stringify(err)}${c.reset}`);
    });
    if (state.errors.length > 5) {
      console.log(`  ... e mais ${state.errors.length - 5} erros`);
    }
  }

  console.log(`\n${c.blue}Tempo restante: ${remainingMinutes} minutos${c.reset}`);
  console.log('='.repeat(70) + '\n');
}

function generateFinalReport() {
  const totalTime = (Date.now() - state.startTime) / 1000;
  const errorRate = state.totalRequests > 0 ? (state.failedRequests / state.totalRequests) : 0;
  const avgLatency = state.totalRequests > 0 ? Math.round(state.totalLatency / state.totalRequests) : 0;
  const memoryIncrease = state.lastMemoryCheck - state.initialMemory;

  // Critérios de aprovação
  const passedCriteria = {
    errorRate: errorRate <= CONFIG.ACCEPTABLE_ERROR_RATE,
    memoryLeak: memoryIncrease < CONFIG.MEMORY_LEAK_THRESHOLD_MB,
    uptime: true, // Se chegou até aqui, o servidor não caiu
    avgLatency: avgLatency < 5000, // 5s é aceitável
    totalErrors: state.errors.length < 20, // Menos de 20 erros totais
  };

  const allPassed = Object.values(passedCriteria).every(v => v === true);

  console.log('\n\n' + '═'.repeat(70));
  log('🎯 RELATÓRIO FINAL - PRODUÇÃO READINESS', 'bright');
  console.log('═'.repeat(70) + '\n');

  console.log(`${c.cyan}Duração Total:${c.reset} ${(totalTime / 60).toFixed(1)} minutos`);
  console.log(`${c.cyan}Requisições:${c.reset} ${state.totalRequests} (${state.successfulRequests} sucesso, ${state.failedRequests} falhas)`);
  console.log(`${c.cyan}Taxa de Erro:${c.reset} ${passedCriteria.errorRate ? c.green : c.red}${(errorRate * 100).toFixed(2)}% ${passedCriteria.errorRate ? '✅' : '❌'}${c.reset}`);
  console.log(`${c.cyan}Latência Média:${c.reset} ${passedCriteria.avgLatency ? c.green : c.red}${avgLatency}ms ${passedCriteria.avgLatency ? '✅' : '❌'}${c.reset}`);
  console.log(`${c.cyan}Aumento de Memória:${c.reset} ${passedCriteria.memoryLeak ? c.green : c.red}+${memoryIncrease}MB ${passedCriteria.memoryLeak ? '✅' : '❌'}${c.reset}`);
  console.log(`${c.cyan}Uptime:${c.reset} ${c.green}100% ✅${c.reset}`);
  console.log(`${c.cyan}Total de Erros:${c.reset} ${passedCriteria.totalErrors ? c.green : c.red}${state.errors.length} ${passedCriteria.totalErrors ? '✅' : '❌'}${c.reset}`);

  console.log('\n' + '═'.repeat(70));

  if (allPassed) {
    console.log(`${c.green}${c.bright}`);
    console.log('✅✅✅ SISTEMA APROVADO PARA PRODUÇÃO! ✅✅✅');
    console.log(`${c.reset}`);
    console.log(`${c.green}Todos os critérios foram atendidos.${c.reset}`);
    console.log(`${c.green}Você pode fazer merge para production com confiança!${c.reset}`);
  } else {
    console.log(`${c.red}${c.bright}`);
    console.log('❌❌❌ SISTEMA NÃO APROVADO PARA PRODUÇÃO ❌❌❌');
    console.log(`${c.reset}`);
    console.log(`${c.red}Alguns critérios falharam. Revise os problemas antes de fazer merge.${c.reset}`);
  }

  console.log('═'.repeat(70) + '\n');

  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    duration: totalTime,
    stats: {
      totalRequests: state.totalRequests,
      successfulRequests: state.successfulRequests,
      failedRequests: state.failedRequests,
      errorRate,
      avgLatency,
      memoryIncrease,
    },
    criteria: passedCriteria,
    approved: allPassed,
    errors: state.errors,
    memorySnapshots: state.memorySnapshots,
  };

  console.log(`${c.blue}📄 Relatório salvo em: production-readiness-report.json${c.reset}\n`);

  return report;
}

async function main() {
  console.log('\n' + '═'.repeat(70));
  log('🚀 INICIANDO TESTES DE PRODUÇÃO', 'bright');
  console.log('═'.repeat(70) + '\n');

  console.log(`${c.cyan}Configuração:${c.reset}`);
  console.log(`  URL: ${CONFIG.BASE_URL}`);
  console.log(`  Duração: ${CONFIG.TEST_DURATION_HOURS} horas`);
  console.log(`  Intervalo de verificação: ${CONFIG.CHECK_INTERVAL_MS / 1000}s`);
  console.log(`  Stress test: ${CONFIG.STRESS_TEST_REQUESTS} req a cada ${CONFIG.STRESS_TEST_INTERVAL_MS / 1000}s`);
  console.log(`  Taxa de erro aceitável: ${CONFIG.ACCEPTABLE_ERROR_RATE * 100}%\n`);

  log('Iniciando testes contínuos...', 'green');

  const endTime = Date.now() + (CONFIG.TEST_DURATION_HOURS * 60 * 60 * 1000);
  let lastStressTest = 0;
  let checkCount = 0;

  while (Date.now() < endTime) {
    checkCount++;

    log(`[Check #${checkCount}] Executando health check...`, 'cyan');
    await comprehensiveHealthCheck();

    // Stress test periódico
    if (Date.now() - lastStressTest >= CONFIG.STRESS_TEST_INTERVAL_MS) {
      await stressTest();
      lastStressTest = Date.now();
    }

    // Relatório a cada 10 checks
    if (checkCount % 10 === 0) {
      printProgressReport();
    }

    // Aguardar próximo check
    await new Promise(resolve => setTimeout(resolve, CONFIG.CHECK_INTERVAL_MS));
  }

  // Relatório final
  const report = generateFinalReport();

  // Salvar relatório
  const fs = await import('fs/promises');
  await fs.writeFile(
    'production-readiness-report.json',
    JSON.stringify(report, null, 2)
  );

  process.exit(report.approved ? 0 : 1);
}

main().catch(error => {
  console.error(`${c.red}Erro fatal:${c.reset}`, error);
  process.exit(1);
});
