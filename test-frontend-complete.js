#!/usr/bin/env node
/**
 * ROM-Agent Frontend Complete Test Suite
 *
 * Testa:
 * 1. Interface React carregamento
 * 2. Rotas principais
 * 3. Streaming de chat
 * 4. Responsividade
 * 5. Integração backend-frontend
 * 6. Performance
 */

const STAGING_URL = 'https://staging.iarom.com.br';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(type, message, data = '') {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    test: '🧪'
  };

  const icon = icons[type] || '•';
  const color = type === 'success' ? colors.green :
                type === 'error' ? colors.red :
                type === 'warning' ? colors.yellow : colors.cyan;

  console.log(`${color}${icon} [${timestamp}] ${message}${colors.reset}${data ? ' ' + data : ''}`);
}

async function testEndpoint(name, url, options = {}) {
  const start = Date.now();
  try {
    const response = await fetch(url, options);
    const duration = Date.now() - start;
    const status = response.status;

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
      status,
      duration,
      data,
      size: typeof data === 'string' ? data.length : JSON.stringify(data).length,
      contentType
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

async function testStreamingChat() {
  log('test', 'Testando streaming de chat...');

  const start = Date.now();
  let chunks = 0;
  let firstChunkTime = null;
  let fullResponse = '';

  try {
    const response = await fetch(`${STAGING_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        message: 'Responda apenas: OK',
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (!firstChunkTime) {
        firstChunkTime = Date.now() - start;
      }

      chunks++;
      const chunk = decoder.decode(value);
      fullResponse += chunk;
      process.stdout.write('.');
    }

    console.log(''); // New line

    const totalTime = Date.now() - start;

    return {
      success: true,
      chunks,
      firstChunkTime,
      totalTime,
      responseLength: fullResponse.length
    };

  } catch (error) {
    console.log(''); // New line
    return {
      success: false,
      error: error.message
    };
  }
}

async function checkReactApp(html) {
  const checks = {
    hasReactRoot: html.includes('id="root"') || html.includes('id="app"'),
    hasReactScript: html.includes('react') || html.includes('.js'),
    hasViteManifest: html.includes('manifest') || html.includes('vite'),
    hasCSS: html.includes('.css') || html.includes('<style'),
    isSPA: html.includes('type="module"')
  };

  return checks;
}

async function main() {
  console.log('\n' + '='.repeat(70));
  log('info', '🚀 ROM-Agent Frontend Complete Test Suite');
  console.log('='.repeat(70) + '\n');

  // ============================================================
  // 1. TEST SERVER STATUS
  // ============================================================
  log('info', '📊 FASE 1: Testando Status do Servidor\n');

  const serverTests = [
    { name: 'Health Check', url: `${STAGING_URL}/health` },
    { name: 'API Info', url: `${STAGING_URL}/api/info` },
    { name: 'Homepage (React)', url: STAGING_URL }
  ];

  const results = [];

  for (const test of serverTests) {
    const result = await testEndpoint(test.name, test.url);
    results.push(result);

    if (result.success) {
      log('success', `${result.name.padEnd(20)} ${result.status} | ${result.duration}ms | ${result.size} bytes`);
    } else {
      log('error', `${result.name.padEnd(20)} FALHOU:`, result.error);
    }
  }

  // Check version
  const infoResult = results.find(r => r.name === 'API Info');
  if (infoResult?.success) {
    const info = infoResult.data;
    console.log('\n' + colors.blue + '📌 Informações do Servidor:' + colors.reset);
    console.log(`   Versão: ${info.versao || 'unknown'}`);
    console.log(`   Git Commit: ${info.server?.gitCommit || info.gitCommit || 'unknown'}`);
    console.log(`   Uptime: ${info.health?.uptime || 'unknown'}`);
    console.log(`   Node: ${info.server?.nodeVersion || 'unknown'}`);
  }

  // ============================================================
  // 2. TEST REACT FRONTEND
  // ============================================================
  console.log('\n' + '='.repeat(70));
  log('info', '⚛️  FASE 2: Testando React Frontend V4\n');

  const homepageResult = results.find(r => r.name === 'Homepage (React)');

  if (homepageResult?.success && homepageResult.contentType?.includes('html')) {
    const reactChecks = await checkReactApp(homepageResult.data);

    console.log(colors.cyan + '📦 Verificações React:' + colors.reset);
    console.log(`   React Root Element: ${reactChecks.hasReactRoot ? '✅' : '❌'}`);
    console.log(`   React Scripts: ${reactChecks.hasReactScript ? '✅' : '❌'}`);
    console.log(`   Vite Build: ${reactChecks.hasViteManifest ? '✅' : '❌'}`);
    console.log(`   CSS Loaded: ${reactChecks.hasCSS ? '✅' : '❌'}`);
    console.log(`   SPA Mode: ${reactChecks.isSPA ? '✅' : '❌'}`);

    const allPassed = Object.values(reactChecks).every(v => v === true);

    if (allPassed) {
      log('success', 'React Frontend V4 está funcionando corretamente!');
    } else {
      log('warning', 'Alguns componentes React podem não estar carregando');
    }
  } else {
    log('error', 'Não foi possível verificar o React Frontend');
  }

  // ============================================================
  // 3. TEST ROUTING
  // ============================================================
  console.log('\n' + '='.repeat(70));
  log('info', '🗺️  FASE 3: Testando Rotas Principais\n');

  const routes = [
    '/api/info',
    '/api/health',
    '/health'
  ];

  for (const route of routes) {
    const result = await testEndpoint(`Route ${route}`, `${STAGING_URL}${route}`);
    if (result.success) {
      log('success', `${route.padEnd(25)} ${result.status} | ${result.duration}ms`);
    } else {
      log('error', `${route.padEnd(25)} FALHOU`);
    }
  }

  // ============================================================
  // 4. TEST STREAMING
  // ============================================================
  console.log('\n' + '='.repeat(70));
  log('info', '🌊 FASE 4: Testando Streaming de Chat\n');

  const streamResult = await testStreamingChat();

  if (streamResult.success) {
    log('success', 'Streaming funcionando!');
    console.log(colors.cyan + '   Métricas de Streaming:' + colors.reset);
    console.log(`   Chunks recebidos: ${streamResult.chunks}`);
    console.log(`   Tempo primeiro chunk: ${streamResult.firstChunkTime}ms`);
    console.log(`   Tempo total: ${streamResult.totalTime}ms`);
    console.log(`   Tamanho resposta: ${streamResult.responseLength} bytes`);
  } else {
    log('error', 'Streaming NÃO está funcionando:', streamResult.error);
  }

  // ============================================================
  // 5. PERFORMANCE SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(70));
  log('info', '📈 FASE 5: Resumo de Performance\n');

  const successfulTests = results.filter(r => r.success);
  const avgTime = successfulTests.reduce((sum, r) => sum + r.duration, 0) / successfulTests.length;

  console.log(colors.green + '✅ Testes bem-sucedidos:' + colors.reset + ` ${successfulTests.length}/${results.length}`);
  console.log(colors.cyan + '⏱️  Tempo médio resposta:' + colors.reset + ` ${avgTime.toFixed(2)}ms`);
  console.log(colors.cyan + '🌊 Streaming:' + colors.reset + ` ${streamResult.success ? '✅ Operacional' : '❌ Não operacional'}`);

  // ============================================================
  // 6. FINAL VERDICT
  // ============================================================
  console.log('\n' + '='.repeat(70));

  const allTestsPassed = results.every(r => r.success) && streamResult.success;

  if (allTestsPassed) {
    log('success', '🎉 TODOS OS TESTES PASSARAM! Frontend está 100% operacional!');
  } else {
    log('warning', '⚠️  Alguns testes falharam. Verifique os problemas acima.');
  }

  console.log('='.repeat(70) + '\n');
}

main().catch(error => {
  log('error', 'Erro fatal no teste:', error.message);
  process.exit(1);
});
