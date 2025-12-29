#!/usr/bin/env node
/**
 * Test script for Streaming SSE Chat Endpoint
 *
 * Tests the new /api/chat/stream endpoint that provides
 * real-time streaming responses (v2.7.0 Performance)
 *
 * Usage: node scripts/test-streaming.js
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_MESSAGE = 'Explique em 3 linhas o que é usucapião';

console.log('='.repeat(60));
console.log('🧪 TESTE: Streaming SSE Chat Endpoint');
console.log('='.repeat(60));
console.log('');
console.log(`📍 URL: ${BASE_URL}/api/chat-stream/stream`);
console.log(`💬 Message: "${TEST_MESSAGE}"`);
console.log('');
console.log('─'.repeat(60));
console.log('📡 Enviando requisição e aguardando stream...');
console.log('─'.repeat(60));
console.log('');

const startTime = Date.now();
let firstTokenTime = null;
let chunkCount = 0;
let fullResponse = '';

fetch(`${BASE_URL}/api/chat-stream/stream`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: TEST_MESSAGE,
    modelo: 'anthropic.claude-haiku-4-5-20251001-v1:0', // Fast model for testing
    maxTokens: 500
  })
})
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Process SSE stream
    const reader = response.body;
    let buffer = '';

    reader.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim() === '' || line.startsWith(':')) {
          continue; // Skip empty lines and heartbeats
        }

        // Parse SSE event
        const eventMatch = line.match(/^event: (.+)$/m);
        const dataMatch = line.match(/^data: (.+)$/m);

        if (dataMatch) {
          try {
            const data = JSON.parse(dataMatch[1]);

            if (data.type === 'start') {
              console.log(`✅ Stream iniciado (requestId: ${data.requestId})`);
              console.log('');
            } else if (data.type === 'chunk') {
              if (!firstTokenTime) {
                firstTokenTime = Date.now();
                const ttft = firstTokenTime - startTime;
                console.log(`⚡ Primeiro token recebido em ${ttft}ms`);
                console.log('');
                console.log('📝 Resposta (streaming):');
                console.log('─'.repeat(60));
              }

              chunkCount++;
              fullResponse += data.content;
              process.stdout.write(data.content); // Stream to console

            } else if (eventMatch && eventMatch[1] === 'complete') {
              const totalTime = Date.now() - startTime;
              console.log('');
              console.log('─'.repeat(60));
              console.log('');
              console.log('✅ Stream concluído!');
              console.log('');
              console.log('📊 Métricas:');
              console.log(`   • Total Time: ${totalTime}ms`);
              console.log(`   • TTFT: ${firstTokenTime ? firstTokenTime - startTime : 'N/A'}ms`);
              console.log(`   • Total Chunks: ${chunkCount}`);
              console.log(`   • Response Length: ${fullResponse.length} chars`);
              console.log(`   • Modelo: ${data.modelo}`);
              console.log('');

              if (data.metrics) {
                console.log('📈 Métricas Detalhadas:');
                console.log(`   • Total Time: ${data.metrics.totalTime}`);
                console.log(`   • TTFT: ${data.metrics.ttft}`);
                console.log(`   • Avg Chunk Time: ${data.metrics.avgChunkTime}`);
                console.log('');
              }

              // Performance evaluation
              const ttft = firstTokenTime ? firstTokenTime - startTime : null;
              if (ttft && ttft < 1000) {
                console.log('🎉 EXCELENTE! TTFT < 1s (meta atingida)');
              } else if (ttft && ttft < 2000) {
                console.log('✅ BOM! TTFT < 2s');
              } else {
                console.log('⚠️ ATENÇÃO! TTFT > 2s (abaixo da meta)');
              }
              console.log('');
              console.log('='.repeat(60));

            } else if (eventMatch && eventMatch[1] === 'error') {
              console.log('');
              console.log('❌ Erro no stream:');
              console.log(`   ${data.error}`);
              console.log('');
              console.log('='.repeat(60));
            }
          } catch (err) {
            console.error('Erro ao parsear SSE data:', err);
          }
        }
      }
    });

    reader.on('end', () => {
      if (chunkCount === 0) {
        console.log('⚠️ Stream finalizado sem receber chunks');
      }
    });

    reader.on('error', (err) => {
      console.error('❌ Erro no stream:', err);
      process.exit(1);
    });
  })
  .catch(error => {
    console.error('');
    console.error('❌ Erro na requisição:', error.message);
    console.error('');
    console.error('💡 Dicas:');
    console.error('   • Verifique se o servidor está rodando');
    console.error('   • Verifique se AWS credentials estão configuradas');
    console.error('   • Teste: curl http://localhost:3000/health');
    console.error('');
    console.error('='.repeat(60));
    process.exit(1);
  });
