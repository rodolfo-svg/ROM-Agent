#!/usr/bin/env node
/**
 * Teste de Produção - Validação de Correções Críticas
 *
 * Testa 3 problemas corrigidos:
 * 1. Custom Instructions aplicadas (sem emojis/sinais IA)
 * 2. Artifacts unificados (não quebrados)
 * 3. Streaming sem travar (documentos grandes)
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 180000; // 3 minutos

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName) {
  log(`\n${'='.repeat(80)}`, 'cyan');
  log(`TEST: ${testName}`, 'cyan');
  log('='.repeat(80), 'cyan');
}

function logResult(passed, message) {
  const symbol = passed ? '✅' : '❌';
  const color = passed ? 'green' : 'red';
  log(`${symbol} ${message}`, color);
}

/**
 * Teste 1: Custom Instructions aplicadas (sem emojis)
 */
async function testCustomInstructionsApplied() {
  logTest('Teste 1: Custom Instructions Aplicadas (Proibição de Emojis)');

  const testMessage = 'Faça uma análise rápida sobre prescrição em ação de cobrança de condomínio';

  log('Enviando requisição de chat...', 'blue');

  try {
    const response = await fetch(`${BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: testMessage,
        modelo: 'anthropic.claude-sonnet-4-5-20250929-v1:0'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let fullResponse = '';
    let chunkCount = 0;

    const reader = response.body;
    reader.setEncoding('utf8');

    for await (const chunk of reader) {
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'chunk') {
              fullResponse += data.content;
              chunkCount++;
            }

            if (data.type === 'complete') {
              log(`\nRecebidos ${chunkCount} chunks, ${fullResponse.length} caracteres`, 'blue');
            }
          } catch (e) {
            // Ignorar linhas que não são JSON
          }
        }
      }
    }

    // Verificação 1: Sem emojis comuns
    const emojiPattern = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    const hasEmojis = emojiPattern.test(fullResponse);
    logResult(!hasEmojis, hasEmojis
      ? 'FALHOU: Resposta contém emojis (Custom Instructions não aplicadas)'
      : 'PASSOU: Sem emojis na resposta'
    );

    // Verificação 2: Sem sinais distintivos de IA
    const aiSignals = [
      'como assistente',
      'como IA',
      'não posso',
      'não tenho capacidade',
      'sou um modelo',
      'como modelo de linguagem'
    ];

    const foundAiSignals = aiSignals.filter(signal =>
      fullResponse.toLowerCase().includes(signal)
    );

    logResult(foundAiSignals.length === 0, foundAiSignals.length === 0
      ? 'PASSOU: Sem sinais distintivos de IA'
      : `FALHOU: Encontrados sinais de IA: ${foundAiSignals.join(', ')}`
    );

    // Verificação 3: Resposta tem conteúdo substancial
    const hasContent = fullResponse.length > 200;
    logResult(hasContent, hasContent
      ? `PASSOU: Resposta substancial (${fullResponse.length} caracteres)`
      : 'FALHOU: Resposta muito curta'
    );

    log('\nPreview da resposta:', 'yellow');
    log(fullResponse.substring(0, 300) + '...', 'reset');

    return !hasEmojis && foundAiSignals.length === 0 && hasContent;

  } catch (error) {
    log(`ERRO: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Teste 2: Artifacts unificados (não quebrados)
 */
async function testUnifiedArtifacts() {
  logTest('Teste 2: Artifacts Unificados (Não Quebrados em Múltiplos)');

  const testMessage = 'Pesquise jurisprudência do STJ sobre prescrição de condomínio e elabore uma análise estruturada de 5 páginas';

  log('Enviando requisição com ferramentas (causa múltiplos loops)...', 'blue');

  try {
    const response = await fetch(`${BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: testMessage,
        modelo: 'anthropic.claude-sonnet-4-5-20250929-v1:0'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let artifactStartCount = 0;
    let artifactCompleteCount = 0;
    let artifactChunkCount = 0;
    let toolUsed = false;

    const reader = response.body;
    reader.setEncoding('utf8');

    for await (const chunk of reader) {
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'artifact_start') {
              artifactStartCount++;
              log(`  → artifact_start detectado (#${artifactStartCount}): ${data.artifact?.title}`, 'yellow');
            }

            if (data.type === 'artifact_chunk') {
              artifactChunkCount++;
            }

            if (data.type === 'artifact_complete') {
              artifactCompleteCount++;
              log(`  → artifact_complete detectado (#${artifactCompleteCount}): ${data.artifact?.content?.length || 0} chars`, 'yellow');
            }

            if (data.type === 'chunk' && data.content.includes('🔧')) {
              toolUsed = true;
            }
          } catch (e) {
            // Ignorar linhas que não são JSON
          }
        }
      }
    }

    log(`\nResumo:`, 'blue');
    log(`  - artifact_start: ${artifactStartCount}`);
    log(`  - artifact_complete: ${artifactCompleteCount}`);
    log(`  - artifact_chunk: ${artifactChunkCount}`);
    log(`  - Ferramenta usada: ${toolUsed ? 'Sim' : 'Não'}`);

    // Verificação 1: Deve ter usado ferramenta
    logResult(toolUsed, toolUsed
      ? 'PASSOU: Ferramenta de pesquisa foi utilizada'
      : 'AVISO: Ferramenta não foi utilizada (pode não ter detectado necessidade)'
    );

    // Verificação 2: Apenas 1 artifact start/complete (unificado)
    const isUnified = artifactCompleteCount <= 1;
    logResult(isUnified, isUnified
      ? `PASSOU: Artifact unificado (${artifactCompleteCount} artifact_complete)`
      : `FALHOU: Múltiplos artifacts detectados (${artifactCompleteCount} artifact_complete) - QUEBRA!`
    );

    return isUnified;

  } catch (error) {
    log(`ERRO: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Teste 3: Streaming sem travar (documento grande)
 */
async function testStreamingLargeDocument() {
  logTest('Teste 3: Streaming Sem Travar (Documento Grande)');

  const testMessage = 'Elabore uma petição inicial de ação de cobrança de condomínio com 8 páginas, incluindo preliminares, mérito fundamentado e pedidos';

  log('Enviando requisição de documento grande (8 páginas)...', 'blue');

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(`${BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: testMessage,
        modelo: 'anthropic.claude-sonnet-4-5-20250929-v1:0'
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let chunkCount = 0;
    let lastChunkTime = Date.now();
    let maxGap = 0;
    let completed = false;
    let totalChars = 0;

    const reader = response.body;
    reader.setEncoding('utf8');

    log('Monitorando streaming...', 'blue');

    for await (const chunk of reader) {
      const now = Date.now();
      const gap = now - lastChunkTime;
      maxGap = Math.max(maxGap, gap);
      lastChunkTime = now;

      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'chunk') {
              chunkCount++;
              totalChars += data.content?.length || 0;

              if (chunkCount % 50 === 0) {
                const elapsed = Math.round((now - startTime) / 1000);
                log(`  → ${chunkCount} chunks, ${totalChars} chars, ${elapsed}s elapsed`, 'yellow');
              }
            }

            if (data.type === 'complete') {
              completed = true;
              const totalTime = Math.round((now - startTime) / 1000);
              log(`\nStreamingconcluído em ${totalTime}s`, 'green');
            }
          } catch (e) {
            // Ignorar linhas que não são JSON
          }
        }
      }
    }

    const totalTime = Date.now() - startTime;

    log(`\nResumo:`, 'blue');
    log(`  - Total de chunks: ${chunkCount}`);
    log(`  - Total de caracteres: ${totalChars}`);
    log(`  - Tempo total: ${Math.round(totalTime / 1000)}s`);
    log(`  - Maior gap entre chunks: ${maxGap}ms`);
    log(`  - Completo: ${completed ? 'Sim' : 'Não'}`);

    // Verificação 1: Streaming completou
    logResult(completed, completed
      ? 'PASSOU: Streaming completou com sucesso'
      : 'FALHOU: Streaming não completou'
    );

    // Verificação 2: Não travou (gap < 30s)
    const didNotFreeze = maxGap < 30000;
    logResult(didNotFreeze, didNotFreeze
      ? `PASSOU: Sem travamentos (max gap: ${Math.round(maxGap / 1000)}s)`
      : `FALHOU: Travamento detectado (gap de ${Math.round(maxGap / 1000)}s)`
    );

    // Verificação 3: Recebeu conteúdo substancial (>5000 chars para 8 páginas)
    const hasEnoughContent = totalChars > 5000;
    logResult(hasEnoughContent, hasEnoughContent
      ? `PASSOU: Conteúdo substancial (${totalChars} caracteres)`
      : `FALHOU: Conteúdo insuficiente para 8 páginas (${totalChars} caracteres)`
    );

    return completed && didNotFreeze && hasEnoughContent;

  } catch (error) {
    if (error.name === 'AbortError') {
      log(`FALHOU: Timeout de ${TIMEOUT / 1000}s excedido`, 'red');
    } else {
      log(`ERRO: ${error.message}`, 'red');
    }
    return false;
  }
}

/**
 * Teste 4: Verificar que PROMPTS_VERSION está correto
 */
async function testPromptsVersionConfig() {
  logTest('Teste 4: Configuração PROMPTS_VERSION');

  const fs = await import('fs');
  const envPath = '/Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/.env';

  try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const versionMatch = envContent.match(/PROMPTS_VERSION=(\w+)/);

    if (versionMatch) {
      const version = versionMatch[1];
      log(`PROMPTS_VERSION atual: ${version}`, 'yellow');

      const isOptimized = version === 'optimized';
      logResult(isOptimized, isOptimized
        ? 'PASSOU: PROMPTS_VERSION=optimized (usa Custom Instructions v1.5)'
        : `AVISO: PROMPTS_VERSION=${version} (pode não usar Custom Instructions)`
      );

      return isOptimized;
    } else {
      log('PROMPTS_VERSION não encontrado no .env', 'yellow');
      return false;
    }
  } catch (error) {
    log(`ERRO ao ler .env: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Executa todos os testes
 */
async function runAllTests() {
  log('\n' + '█'.repeat(80), 'cyan');
  log('TESTE DE PRODUÇÃO - VALIDAÇÃO DE CORREÇÕES CRÍTICAS', 'cyan');
  log('█'.repeat(80) + '\n', 'cyan');

  const results = {
    configCheck: false,
    customInstructions: false,
    unifiedArtifacts: false,
    streamingLarge: false
  };

  // Teste 0: Config check
  results.configCheck = await testPromptsVersionConfig();

  // Teste 1: Custom Instructions aplicadas
  results.customInstructions = await testCustomInstructionsApplied();

  // Aguardar 2s entre testes
  log('\n⏱️  Aguardando 2s antes do próximo teste...', 'yellow');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Teste 2: Artifacts unificados
  results.unifiedArtifacts = await testUnifiedArtifacts();

  // Aguardar 2s entre testes
  log('\n⏱️  Aguardando 2s antes do próximo teste...', 'yellow');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Teste 3: Streaming documento grande
  results.streamingLarge = await testStreamingLargeDocument();

  // Resultado final
  log('\n' + '█'.repeat(80), 'cyan');
  log('RESULTADO FINAL', 'cyan');
  log('█'.repeat(80) + '\n', 'cyan');

  const allPassed = Object.values(results).every(r => r === true);

  log('Resumo dos testes:', 'blue');
  logResult(results.configCheck, 'Config: PROMPTS_VERSION=optimized');
  logResult(results.customInstructions, 'Teste 1: Custom Instructions aplicadas');
  logResult(results.unifiedArtifacts, 'Teste 2: Artifacts unificados');
  logResult(results.streamingLarge, 'Teste 3: Streaming sem travar');

  log('');
  if (allPassed) {
    log('🎉 TODOS OS TESTES PASSARAM! 🎉', 'green');
  } else {
    log('⚠️  ALGUNS TESTES FALHARAM', 'red');
  }
  log('');

  process.exit(allPassed ? 0 : 1);
}

// Executar testes
runAllTests().catch(error => {
  log(`\nERRO FATAL: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});
