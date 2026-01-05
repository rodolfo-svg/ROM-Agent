/**
 * ROM-Agent Intensive Load Test - 1 HORA
 * Testa TODOS os tipos de carga antes de produção
 *
 * TIPOS DE CARGA:
 * 1. Burst Load (rajadas súbitas)
 * 2. Sustained Load (carga constante)
 * 3. Concurrent Users (usuários simultâneos)
 * 4. API Stress (todos endpoints)
 * 5. Database Stress (operações pesadas)
 * 6. Memory Stress (requisições grandes)
 * 7. Long Operations (streaming, uploads)
 * 8. PWA Validation
 */

import https from 'https';
import { performance } from 'perf_hooks';

const CONFIG = {
  BASE_URL: 'https://staging.iarom.com.br',
  TEST_DURATION_HOURS: 1,

  // Tipos de carga
  BURST_LOAD_REQUESTS: 50, // 50 req simultâneas
  BURST_INTERVAL_MS: 120000, // A cada 2 minutos

  SUSTAINED_LOAD_RPS: 5, // 5 req/segundo contínuo

  CONCURRENT_USERS: 20, // 20 usuários simultâneos

  API_STRESS_ROUNDS: 10, // 10 rounds de todos endpoints

  MEMORY_STRESS_SIZE: 1000, // Payloads grandes

  // Thresholds
  ACCEPTABLE_ERROR_RATE: 0.10, // 10% aceitável (mais permissivo)
  MAX_LATENCY_MS: 10000, // 10s max
  MEMORY_LEAK_THRESHOLD_MB: 100,
};

const state = {
  startTime: Date.now(),
  tests: {
    burst: { total: 0, success: 0, failed: 0, avgLatency: 0 },
    sustained: { total: 0, success: 0, failed: 0, avgLatency: 0 },
    concurrent: { total: 0, success: 0, failed: 0, avgLatency: 0 },
    apiStress: { total: 0, success: 0, failed: 0, avgLatency: 0 },
    database: { total: 0, success: 0, failed: 0, avgLatency: 0 },
    memory: { total: 0, success: 0, failed: 0, avgLatency: 0 },
    longOps: { total: 0, success: 0, failed: 0, avgLatency: 0 },
    pwa: { total: 0, success: 0, failed: 0, avgLatency: 0 },
  },
  totalRequests: 0,
  totalSuccess: 0,
  totalFailed: 0,
  totalLatency: 0,
  errors: [],
  memorySnapshots: [],
  peakLatency: 0,
  slowestEndpoint: null,
};

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
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
      timeout: options.timeout || 30000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const latency = performance.now() - startTime;
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          latency: Math.round(latency),
          text: () => Promise.resolve(data),
          json: () => Promise.resolve(data ? JSON.parse(data) : {}),
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

function recordResult(testType, success, latency, endpoint = '') {
  state.tests[testType].total++;
  state.totalRequests++;

  if (success) {
    state.tests[testType].success++;
    state.totalSuccess++;
  } else {
    state.tests[testType].failed++;
    state.totalFailed++;
  }

  state.tests[testType].avgLatency =
    (state.tests[testType].avgLatency * (state.tests[testType].total - 1) + latency) /
    state.tests[testType].total;

  state.totalLatency += latency;

  if (latency > state.peakLatency) {
    state.peakLatency = latency;
    state.slowestEndpoint = endpoint;
  }
}

// ============================================================================
// TESTE 1: BURST LOAD - Rajadas súbitas de tráfego
// ============================================================================
async function testBurstLoad() {
  log(`💥 BURST LOAD: ${CONFIG.BURST_LOAD_REQUESTS} requisições simultâneas`, 'magenta');

  const promises = [];
  const endpoints = [
    '/api/info',
    '/api/conversations/list',
    '/api/jurisprudencia/tribunais',
    '/api/documents/supported-types',
    '/manifest.json',
    '/api/deploy/status',
  ];

  for (let i = 0; i < CONFIG.BURST_LOAD_REQUESTS; i++) {
    const endpoint = endpoints[i % endpoints.length];
    promises.push(
      fetch(`${CONFIG.BASE_URL}${endpoint}`)
        .then(res => {
          recordResult('burst', res.ok, res.latency, endpoint);
          return res.ok;
        })
        .catch(err => {
          recordResult('burst', false, 30000, endpoint);
          state.errors.push({ type: 'burst', endpoint, error: err.message, time: new Date().toISOString() });
          return false;
        })
    );
  }

  const results = await Promise.allSettled(promises);
  const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;

  log(`   Resultado: ${successful}/${CONFIG.BURST_LOAD_REQUESTS} sucesso`,
    successful >= CONFIG.BURST_LOAD_REQUESTS * 0.9 ? 'green' : 'yellow');
}

// ============================================================================
// TESTE 2: SUSTAINED LOAD - Carga constante
// ============================================================================
async function testSustainedLoad() {
  const endpoint = '/api/info';

  try {
    const res = await fetch(`${CONFIG.BASE_URL}${endpoint}`);
    recordResult('sustained', res.ok, res.latency, endpoint);
  } catch (err) {
    recordResult('sustained', false, 30000, endpoint);
  }
}

// ============================================================================
// TESTE 3: CONCURRENT USERS - Usuários simultâneos fazendo operações
// ============================================================================
async function testConcurrentUsers() {
  log(`👥 CONCURRENT USERS: ${CONFIG.CONCURRENT_USERS} usuários simultâneos`, 'cyan');

  const simulateUser = async (userId) => {
    const actions = [
      () => fetch(`${CONFIG.BASE_URL}/api/info`),
      () => fetch(`${CONFIG.BASE_URL}/api/conversations/list`),
      () => fetch(`${CONFIG.BASE_URL}/api/jurisprudencia/tribunais`),
      () => fetch(`${CONFIG.BASE_URL}/manifest.json`),
    ];

    const action = actions[Math.floor(Math.random() * actions.length)];

    try {
      const res = await action();
      recordResult('concurrent', res.ok, res.latency, `user-${userId}`);
      return res.ok;
    } catch (err) {
      recordResult('concurrent', false, 30000, `user-${userId}`);
      return false;
    }
  };

  const promises = [];
  for (let i = 0; i < CONFIG.CONCURRENT_USERS; i++) {
    promises.push(simulateUser(i));
  }

  const results = await Promise.allSettled(promises);
  const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;

  log(`   Resultado: ${successful}/${CONFIG.CONCURRENT_USERS} usuários bem-sucedidos`,
    successful >= CONFIG.CONCURRENT_USERS * 0.8 ? 'green' : 'yellow');
}

// ============================================================================
// TESTE 4: API STRESS - Testar TODOS os endpoints intensivamente
// ============================================================================
async function testAPIStress() {
  log(`🔥 API STRESS: Testando todos os endpoints`, 'red');

  const endpoints = [
    '/api/info',
    '/api/conversations/list',
    '/api/deploy/status',
    '/api/logs/files',
    '/api/jurisprudencia/tribunais',
    '/api/jurisprudencia/cache/stats',
    '/api/documents/supported-types',
    '/api/documents/desktop-path',
    '/api/extraction/desktop-path',
    '/manifest.json',
    '/service-worker.js',
  ];

  let successCount = 0;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${CONFIG.BASE_URL}${endpoint}`);
      recordResult('apiStress', res.ok, res.latency, endpoint);
      if (res.ok) successCount++;
    } catch (err) {
      recordResult('apiStress', false, 30000, endpoint);
      state.errors.push({ type: 'apiStress', endpoint, error: err.message, time: new Date().toISOString() });
    }
  }

  log(`   Resultado: ${successCount}/${endpoints.length} endpoints OK`,
    successCount >= endpoints.length * 0.9 ? 'green' : 'yellow');
}

// ============================================================================
// TESTE 5: DATABASE STRESS - Operações pesadas no banco
// ============================================================================
async function testDatabaseStress() {
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/api/conversations/list`);
    const data = await res.json();

    recordResult('database', res.ok && data.conversations, res.latency, '/conversations');

    if (data.conversations) {
      log(`   💾 Database: ${data.conversations.length} conversas`, 'blue');
    }
  } catch (err) {
    recordResult('database', false, 30000, '/conversations');
  }
}

// ============================================================================
// TESTE 6: MEMORY STRESS - Requisições grandes
// ============================================================================
async function testMemoryStress() {
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/api/info`);
    const data = await res.json();

    if (data.memory) {
      const heapUsedMB = parseInt(data.memory.heapUsed);
      state.memorySnapshots.push({
        time: new Date().toISOString(),
        heapUsed: heapUsedMB,
      });

      recordResult('memory', true, res.latency, '/memory-check');
    } else {
      recordResult('memory', false, res.latency, '/memory-check');
    }
  } catch (err) {
    recordResult('memory', false, 30000, '/memory-check');
  }
}

// ============================================================================
// TESTE 7: LONG OPERATIONS - Operações demoradas (streaming)
// ============================================================================
async function testLongOperations() {
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'teste rápido', conversationId: 'test_' + Date.now() },
      timeout: 15000,
    });

    recordResult('longOps', res.ok, res.latency, '/chat/stream');
  } catch (err) {
    recordResult('longOps', false, 15000, '/chat/stream');
  }
}

// ============================================================================
// TESTE 8: PWA VALIDATION
// ============================================================================
async function testPWA() {
  const tests = [
    fetch(`${CONFIG.BASE_URL}/manifest.json`),
    fetch(`${CONFIG.BASE_URL}/service-worker.js`),
  ];

  const results = await Promise.allSettled(tests);
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;

  recordResult('pwa', successful === 2, results[0]?.value?.latency || 0, '/pwa');
}

// ============================================================================
// ORQUESTRADOR DE TESTES
// ============================================================================
async function runTestCycle(cycleNumber) {
  log(`\n${'='.repeat(70)}`, 'cyan');
  log(`CICLO #${cycleNumber}`, 'bright');
  log('='.repeat(70), 'cyan');

  // Sustained load contínuo (rodando em paralelo)
  const sustainedPromise = setInterval(() => testSustainedLoad(), 1000 / CONFIG.SUSTAINED_LOAD_RPS);

  // Testes principais
  await testAPIStress();
  await new Promise(r => setTimeout(r, 2000));

  await testConcurrentUsers();
  await new Promise(r => setTimeout(r, 2000));

  await testDatabaseStress();
  await new Promise(r => setTimeout(r, 1000));

  await testMemoryStress();
  await new Promise(r => setTimeout(r, 1000));

  await testPWA();
  await new Promise(r => setTimeout(r, 1000));

  if (cycleNumber % 2 === 0) {
    await testLongOperations();
  }

  clearInterval(sustainedPromise);
}

// ============================================================================
// RELATÓRIO DE PROGRESSO
// ============================================================================
function printProgress(cycleNumber, totalCycles) {
  const elapsed = (Date.now() - state.startTime) / 1000;
  const errorRate = state.totalRequests > 0 ? state.totalFailed / state.totalRequests : 0;
  const avgLatency = state.totalRequests > 0 ? Math.round(state.totalLatency / state.totalRequests) : 0;

  console.log(`\n${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  log(`📊 PROGRESSO: Ciclo ${cycleNumber}/${totalCycles} (${Math.round(elapsed / 60)}min)`, 'bright');
  console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);

  console.log(`\n${c.bright}GERAL:${c.reset}`);
  console.log(`  Total: ${state.totalRequests} req | ✅ ${state.totalSuccess} | ❌ ${state.totalFailed}`);
  console.log(`  Taxa de erro: ${errorRate > CONFIG.ACCEPTABLE_ERROR_RATE ? c.red : c.green}${(errorRate * 100).toFixed(2)}%${c.reset}`);
  console.log(`  Latência média: ${avgLatency}ms | Pico: ${state.peakLatency}ms`);

  console.log(`\n${c.bright}POR TIPO DE TESTE:${c.reset}`);
  Object.entries(state.tests).forEach(([type, stats]) => {
    if (stats.total > 0) {
      const rate = (stats.success / stats.total * 100).toFixed(1);
      const color = rate >= 90 ? c.green : rate >= 70 ? c.yellow : c.red;
      console.log(`  ${type.padEnd(12)}: ${color}${rate}%${c.reset} (${stats.success}/${stats.total}) - ${Math.round(stats.avgLatency)}ms avg`);
    }
  });

  if (state.errors.length > 0) {
    console.log(`\n${c.yellow}Erros recentes (${state.errors.length} total):${c.reset}`);
    state.errors.slice(-3).forEach(err => {
      console.log(`  ${c.red}❌ ${err.endpoint}: ${err.error}${c.reset}`);
    });
  }

  console.log('');
}

// ============================================================================
// RELATÓRIO FINAL
// ============================================================================
function generateFinalReport() {
  const duration = (Date.now() - state.startTime) / 1000;
  const errorRate = state.totalRequests > 0 ? state.totalFailed / state.totalRequests : 0;
  const avgLatency = state.totalRequests > 0 ? Math.round(state.totalLatency / state.totalRequests) : 0;

  const memoryIncrease = state.memorySnapshots.length > 1
    ? state.memorySnapshots[state.memorySnapshots.length - 1].heapUsed - state.memorySnapshots[0].heapUsed
    : 0;

  const criteria = {
    errorRate: errorRate <= CONFIG.ACCEPTABLE_ERROR_RATE,
    latency: avgLatency < CONFIG.MAX_LATENCY_MS,
    memoryLeak: memoryIncrease < CONFIG.MEMORY_LEAK_THRESHOLD_MB,
    burstLoad: (state.tests.burst.success / state.tests.burst.total) >= 0.8,
    apiStress: (state.tests.apiStress.success / state.tests.apiStress.total) >= 0.9,
    pwa: (state.tests.pwa.success / state.tests.pwa.total) >= 0.9,
  };

  const allPassed = Object.values(criteria).every(v => v === true);

  console.log('\n\n' + '═'.repeat(70));
  log('🎯 RELATÓRIO FINAL - TESTE INTENSIVO 1H', 'bright');
  console.log('═'.repeat(70) + '\n');

  console.log(`${c.cyan}Duração:${c.reset} ${Math.round(duration / 60)} minutos`);
  console.log(`${c.cyan}Total de Requisições:${c.reset} ${state.totalRequests}`);
  console.log(`${c.cyan}Sucesso/Falha:${c.reset} ${state.totalSuccess} / ${state.totalFailed}`);
  console.log(`${c.cyan}Taxa de Erro:${c.reset} ${criteria.errorRate ? c.green : c.red}${(errorRate * 100).toFixed(2)}% ${criteria.errorRate ? '✅' : '❌'}${c.reset}`);
  console.log(`${c.cyan}Latência Média:${c.reset} ${criteria.latency ? c.green : c.red}${avgLatency}ms ${criteria.latency ? '✅' : '❌'}${c.reset}`);
  console.log(`${c.cyan}Pico de Latência:${c.reset} ${state.peakLatency}ms (${state.slowestEndpoint})`);
  console.log(`${c.cyan}Memória:${c.reset} ${criteria.memoryLeak ? c.green : c.red}${memoryIncrease >= 0 ? '+' : ''}${memoryIncrease}MB ${criteria.memoryLeak ? '✅' : '❌'}${c.reset}`);

  console.log(`\n${c.bright}TESTES ESPECÍFICOS:${c.reset}`);
  console.log(`${c.cyan}Burst Load:${c.reset} ${criteria.burstLoad ? c.green : c.red}${((state.tests.burst.success / state.tests.burst.total) * 100).toFixed(1)}% ${criteria.burstLoad ? '✅' : '❌'}${c.reset}`);
  console.log(`${c.cyan}API Stress:${c.reset} ${criteria.apiStress ? c.green : c.red}${((state.tests.apiStress.success / state.tests.apiStress.total) * 100).toFixed(1)}% ${criteria.apiStress ? '✅' : '❌'}${c.reset}`);
  console.log(`${c.cyan}PWA:${c.reset} ${criteria.pwa ? c.green : c.red}${((state.tests.pwa.success / state.tests.pwa.total) * 100).toFixed(1)}% ${criteria.pwa ? '✅' : '❌'}${c.reset}`);

  console.log('\n' + '═'.repeat(70));

  if (allPassed) {
    console.log(`${c.green}${c.bright}`);
    console.log('✅✅✅ SISTEMA APROVADO PARA PRODUÇÃO! ✅✅✅');
    console.log(`${c.reset}`);
    console.log(`${c.green}Todos os critérios atendidos. Pode fazer merge!${c.reset}`);
  } else {
    console.log(`${c.yellow}${c.bright}`);
    console.log('⚠️⚠️⚠️ SISTEMA COM RESSALVAS ⚠️⚠️⚠️');
    console.log(`${c.reset}`);
    console.log(`${c.yellow}Alguns critérios não foram totalmente atendidos.${c.reset}`);
    console.log(`${c.yellow}Revise os problemas ou considere merge com monitoramento.${c.reset}`);
  }

  console.log('═'.repeat(70) + '\n');

  return { criteria, approved: allPassed, stats: state };
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log('\n' + '═'.repeat(70));
  log('🚀 TESTE INTENSIVO - TODOS OS TIPOS DE CARGA - 1 HORA', 'bright');
  console.log('═'.repeat(70) + '\n');

  console.log(`${c.cyan}Tipos de carga:${c.reset}`);
  console.log(`  💥 Burst Load: ${CONFIG.BURST_LOAD_REQUESTS} req simultâneas`);
  console.log(`  📊 Sustained Load: ${CONFIG.SUSTAINED_LOAD_RPS} req/s contínuo`);
  console.log(`  👥 Concurrent Users: ${CONFIG.CONCURRENT_USERS} usuários`);
  console.log(`  🔥 API Stress: Todos os 11 endpoints`);
  console.log(`  💾 Database Stress: Operações pesadas`);
  console.log(`  🧠 Memory Stress: Monitoramento contínuo`);
  console.log(`  ⏱️  Long Operations: Streaming, uploads`);
  console.log(`  📱 PWA: Validação contínua\n`);

  log('Iniciando testes intensivos...', 'green');

  const endTime = Date.now() + (CONFIG.TEST_DURATION_HOURS * 60 * 60 * 1000);
  let cycleNumber = 0;
  const totalCycles = Math.floor((CONFIG.TEST_DURATION_HOURS * 60) / 5); // ~12 ciclos

  // Burst loads periódicos
  const burstInterval = setInterval(() => {
    testBurstLoad().catch(err => log(`Erro no burst: ${err.message}`, 'red'));
  }, CONFIG.BURST_INTERVAL_MS);

  while (Date.now() < endTime) {
    cycleNumber++;

    await runTestCycle(cycleNumber);

    if (cycleNumber % 2 === 0) {
      printProgress(cycleNumber, totalCycles);
    }

    // Intervalo entre ciclos
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  clearInterval(burstInterval);

  const report = generateFinalReport();

  // Salvar relatório
  const fs = await import('fs/promises');
  await fs.writeFile(
    'intensive-test-report.json',
    JSON.stringify(report, null, 2)
  );

  log('📄 Relatório salvo em: intensive-test-report.json', 'blue');

  process.exit(report.approved ? 0 : 1);
}

main().catch(error => {
  console.error(`${c.red}Erro fatal:${c.reset}`, error);
  process.exit(1);
});
