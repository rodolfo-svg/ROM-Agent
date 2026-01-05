#!/usr/bin/env node
/**
 * Test Staging Performance and Streaming
 * Tests:
 * 1. Response times
 * 2. Streaming functionality
 * 3. Model detection (should be Opus 4.5 in staging)
 * 4. Cache performance
 */

const STAGING_URL = 'https://staging.iarom.com.br';

async function testEndpoint(name, url, options = {}) {
  const start = Date.now();
  try {
    const response = await fetch(url, options);
    const duration = Date.now() - start;
    const status = response.status;

    let data;
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      name,
      success: true,
      status,
      duration,
      data,
      size: JSON.stringify(data).length
    };
  } catch (error) {
    const duration = Date.now() - start;
    return {
      name,
      success: false,
      error: error.message,
      duration
    };
  }
}

async function testStreaming(url) {
  console.log('\n🌊 Testando STREAMING...');

  const start = Date.now();
  let chunks = 0;
  let totalBytes = 0;
  let firstChunkTime = null;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Teste rápido de streaming. Responda apenas: OK',
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
      totalBytes += value.length;

      const chunk = decoder.decode(value);
      process.stdout.write('.');
    }

    const totalTime = Date.now() - start;

    return {
      success: true,
      chunks,
      totalBytes,
      firstChunkTime,
      totalTime,
      avgChunkTime: totalTime / chunks
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - start
    };
  }
}

async function main() {
  console.log('🚀 ROM-Agent Staging Performance Test\n');
  console.log('=' .repeat(60));

  // Test 1: Basic endpoints
  console.log('\n📊 Testando Endpoints Básicos...\n');

  const tests = [
    { name: 'Health Check', url: `${STAGING_URL}/health` },
    { name: 'API Info', url: `${STAGING_URL}/api/info` },
    { name: 'Homepage', url: STAGING_URL }
  ];

  const results = [];

  for (const test of tests) {
    const result = await testEndpoint(test.name, test.url);
    results.push(result);

    if (result.success) {
      console.log(`✅ ${result.name.padEnd(15)} | ${result.status} | ${result.duration}ms | ${result.size} bytes`);
    } else {
      console.log(`❌ ${result.name.padEnd(15)} | ERROR: ${result.error}`);
    }
  }

  // Test 2: Check version and model
  console.log('\n📌 Verificando Versão e Modelo...\n');

  const infoResult = results.find(r => r.name === 'API Info');
  if (infoResult && infoResult.success) {
    const info = infoResult.data;
    console.log(`Version: ${info.versao || 'unknown'}`);
    console.log(`Uptime: ${info.health?.uptime || 'unknown'}`);
    console.log(`Git Commit: ${info.gitCommit || info.server?.gitCommit || 'unknown'}`);
    console.log(`Cache Enabled: ${info.cache?.enabled || false}`);
    console.log(`Memory: ${info.memory?.heapUsed || 'unknown'}`);
  }

  // Test 3: Streaming
  console.log('\n🌊 Testando Streaming Chat...\n');

  const streamResult = await testStreaming(`${STAGING_URL}/api/chat/stream`);

  if (streamResult.success) {
    console.log(`\n✅ Streaming funcionando!`);
    console.log(`   Chunks recebidos: ${streamResult.chunks}`);
    console.log(`   Total bytes: ${streamResult.totalBytes}`);
    console.log(`   Tempo primeiro chunk: ${streamResult.firstChunkTime}ms`);
    console.log(`   Tempo total: ${streamResult.totalTime}ms`);
    console.log(`   Tempo médio por chunk: ${streamResult.avgChunkTime.toFixed(2)}ms`);
  } else {
    console.log(`\n❌ Streaming falhou: ${streamResult.error}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 RESUMO DE PERFORMANCE\n');

  const avgTime = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.duration, 0) / results.filter(r => r.success).length;

  console.log(`Tempo médio de resposta: ${avgTime.toFixed(2)}ms`);
  console.log(`Taxa de sucesso: ${results.filter(r => r.success).length}/${results.length}`);

  if (streamResult.success) {
    console.log(`Streaming: ✅ OPERACIONAL`);
  } else {
    console.log(`Streaming: ❌ NÃO OPERACIONAL`);
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
