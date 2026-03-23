/**
 * Document Processor V2 - Arquitetura Melhorada
 *
 * FLUXO:
 * 1. LLM Barata (Nova Micro) → Extrai TEXTO COMPLETO do PDF (OCR + estruturação)
 * 2. Salva texto completo no KB como documento intermediário reutilizável
 * 3. LLM Premium (Claude) → Lê texto completo salvo
 * 4. LLM Premium → Gera múltiplos ficheiros técnicos profissionais
 *
 * VANTAGENS:
 * - ✅ Reutilização: Texto extraído fica salvo, pode ser analisado múltiplas vezes
 * - ✅ Economia: Não precisa reprocessar PDF toda vez
 * - ✅ Qualidade: LLM premium trabalha com texto limpo e completo
 * - ✅ Rastreabilidade: Texto intermediário disponível para auditoria
 * - ✅ Flexibilidade: Pode gerar diferentes tipos de análise do mesmo texto
 *
 * EXEMPLO:
 * PDF (300 páginas, 1.5M tokens)
 *  ↓
 * Nova Micro extrai: $0.052
 *  ↓
 * Salva: "processo-123_TEXTO_COMPLETO.md"
 *  ↓
 * Claude Sonnet analisa (1.5M tokens): $4.50
 *  ↓
 * Gera: FICHAMENTO.md, ANALISE_JURIDICA.md, CRONOLOGIA.md, RESUMO_EXECUTIVO.md
 *
 * Total: $4.55 (vs $9.00 com abordagem 100% Claude)
 * Economia: 50% + arquivos intermediários salvos!
 */

import fs from 'fs';
import path from 'path';
import { conversar } from '../src/modules/bedrock.js';
import { documentSummarizer } from './document-summarizer.js';
import { ACTIVE_PATHS } from './storage-config.js';
import extractionProgressService from '../src/services/extraction-progress.js';
import BATCH_ANALYSIS_PROMPT from './batch-analysis-prompt.js';
import { extractionPersistenceManager } from './extraction-persistence.js';
import kbCache from './kb-cache.js';  // 🔥 FIX: Adicionar cache para que arquivos apareçam na interface

// Modelos disponíveis (maxTokens = OUTPUT limit)
const MODELS = {
  // LLM Barata (extração)
  'nova-micro': {
    id: 'us.amazon.nova-micro-v1:0',
    name: 'Amazon Nova Micro',
    maxTokens: 5000,  // REAL LIMIT: 5,120 output tokens
    costPer1M: { input: 0.035, output: 0.14 },
    purpose: 'extraction',
    speed: 'very-fast'
  },
  'nova-lite': {
    id: 'us.amazon.nova-lite-v1:0',
    name: 'Amazon Nova Lite',
    maxTokens: 5000,  // REAL LIMIT: 5,120 output tokens
    costPer1M: { input: 0.06, output: 0.24 },
    purpose: 'extraction',
    speed: 'fast'
  },

  // LLM Premium (análise)
  haiku: {
    id: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    name: 'Claude 3.5 Haiku',
    maxTokens: 8000,  // REAL LIMIT: 8,192 output tokens
    costPer1M: { input: 1.0, output: 5.0 },
    purpose: 'analysis',
    speed: 'fast'
  },
  sonnet: {
    id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',  // FIX: Sonnet 3.5 e 3.7 legacy, usando Haiku 4.5 (ATIVO)
    name: 'Claude Haiku 4.5',
    maxTokens: 16000,  // ✅ FIX: Aumentado de 8000 para 16000 para comportar JSONs grandes de fichamentos
    costPer1M: { input: 1.0, output: 5.0 },  // Mais barato que Sonnet
    purpose: 'analysis',
    speed: 'fast'  // Mais rápido
  },
  opus: {
    id: 'us.anthropic.claude-opus-4-20250514-v1:0',
    name: 'Claude Opus 4',
    maxTokens: 16000,  // REAL LIMIT: 16,384 output tokens
    costPer1M: { input: 15.0, output: 75.0 },
    purpose: 'analysis',
    speed: 'slow'
  }
};

export class DocumentProcessorV2 {
  constructor() {
    this.extractedTextCachePath = path.join(ACTIVE_PATHS.data, 'extracted-texts');
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.extractedTextCachePath)) {
      fs.mkdirSync(this.extractedTextCachePath, { recursive: true });
    }
  }

  /**
   * Tentar reparar JSON malformado (comum quando LLM response é truncada)
   */
  tryRepairJSON(jsonString) {
    try {
      // Tentar parse direto primeiro
      return JSON.parse(jsonString);
    } catch (e) {
      console.log(`   ⚠️  JSON parsing falhou, tentando reparar...`);

      try {
        // Remover texto após último } válido
        const lastBrace = jsonString.lastIndexOf('}');
        if (lastBrace > 0) {
          const truncated = jsonString.substring(0, lastBrace + 1);
          const repaired = JSON.parse(truncated);
          console.log(`   ✅ JSON reparado com sucesso (truncado em ${lastBrace})`);
          return repaired;
        }
      } catch (e2) {
        console.log(`   ❌ Tentativa de reparo falhou:`, e2.message);
      }

      throw e; // Re-throw original error
    }
  }

  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Gera ID único para cache baseado no conteúdo
   */
  generateCacheId(documentId, contentHash = null) {
    return `extracted_${documentId}_${contentHash || Date.now()}`;
  }

  /**
   * CHUNKING INTELIGENTE
   *
   * Divide documento grande em chunks menores de forma inteligente,
   * tentando respeitar quebras naturais (parágrafos, seções).
   *
   * @param {string} text - Texto completo a ser dividido
   * @param {number} maxChunkSize - Tamanho máximo de cada chunk em caracteres
   * @returns {Array} Array de chunks com metadados
   */
  smartChunk(text, maxChunkSize = 400000) {
    const chunks = [];
    let currentPosition = 0;
    let chunkNumber = 0;

    while (currentPosition < text.length) {
      let chunkEnd = Math.min(currentPosition + maxChunkSize, text.length);

      // Se não é o último chunk, tenta encontrar quebra natural
      if (chunkEnd < text.length) {
        // Procura por quebra de parágrafo duplo (ideal)
        let breakPoint = text.lastIndexOf('\n\n', chunkEnd);

        // Se não encontrou, procura quebra simples
        if (breakPoint <= currentPosition || breakPoint < chunkEnd - 5000) {
          breakPoint = text.lastIndexOf('\n', chunkEnd);
        }

        // Se não encontrou, procura ponto final
        if (breakPoint <= currentPosition || breakPoint < chunkEnd - 5000) {
          breakPoint = text.lastIndexOf('.', chunkEnd);
        }

        // Se encontrou quebra natural, usa ela
        if (breakPoint > currentPosition && breakPoint > chunkEnd - 5000) {
          chunkEnd = breakPoint + 1;
        }
      }

      const chunkText = text.substring(currentPosition, chunkEnd);

      chunks.push({
        number: chunkNumber++,
        text: chunkText,
        startPosition: currentPosition,
        endPosition: chunkEnd,
        size: chunkText.length,
        estimatedTokens: this.estimateTokens(chunkText)
      });

      currentPosition = chunkEnd;
    }

    return chunks;
  }

  /**
   * EXTRAÇÃO COM CHUNKING AUTOMÁTICO
   *
   * Processa documentos grandes dividindo em chunks menores,
   * extraindo cada um, e concatenando os resultados.
   *
   * @param {string} rawText - Texto completo do documento
   * @param {string} documentId - ID do documento
   * @param {string} documentName - Nome do documento
   * @param {string|null} jobId - ID do job para rastreamento de progresso
   * @returns {Object} Texto extraído completo + metadados
   */
  async extractWithChunking(rawText, documentId, documentName, jobId = null) {
    const MAX_CHUNK_SIZE = 400000; // 400k chars = ~100k tokens (seguro para Nova Micro)

    console.log(`\n📊 [V2 - CHUNKING] DOCUMENTO GRANDE DETECTADO`);
    console.log(`   Tamanho total: ${Math.round(rawText.length / 1000)}k caracteres`);
    console.log(`   Estratégia: Divisão em chunks de ${Math.round(MAX_CHUNK_SIZE / 1000)}k caracteres`);

    // Dividir em chunks inteligentes
    const chunks = this.smartChunk(rawText, MAX_CHUNK_SIZE);
    console.log(`   📦 Dividido em ${chunks.length} chunks`);
    console.log(`   ⏱️  Tempo estimado: ~${chunks.length * 30}s (${Math.round(chunks.length * 30 / 60)} minutos)`);

    // Track progress if jobId provided
    if (jobId) {
      await extractionProgressService.startJob(jobId, 'chunking', chunks.length);
    }

    const extractedParts = new Array(chunks.length); // Pré-alocar array para manter ordem
    const chunkMetadata = [];
    let totalCost = 0;
    let totalTime = 0;

    // 🚀 OTIMIZAÇÃO: Processar chunks em PARALELO (3 ao mesmo tempo)
    const PARALLEL_CHUNKS = 3;
    const overallStartTime = Date.now();

    console.log(`   🚀 Processando ${PARALLEL_CHUNKS} chunks em paralelo para acelerar...`);

    // Processar chunks em batches paralelos
    for (let batchStart = 0; batchStart < chunks.length; batchStart += PARALLEL_CHUNKS) {
      const batchEnd = Math.min(batchStart + PARALLEL_CHUNKS, chunks.length);
      const batch = chunks.slice(batchStart, batchEnd);

      console.log(`\n   📦 Batch ${Math.floor(batchStart/PARALLEL_CHUNKS)+1}/${Math.ceil(chunks.length/PARALLEL_CHUNKS)}: Processando chunks ${batchStart+1}-${batchEnd}...`);

      // Processar batch em paralelo
      const batchPromises = batch.map(async (chunk, batchIndex) => {
        const i = batchStart + batchIndex;
        console.log(`\n   🔄 [Chunk ${i+1}/${chunks.length}] Processando...`);
        console.log(`      Tamanho: ${Math.round(chunk.size / 1000)}k chars (${chunk.estimatedTokens.toLocaleString()} tokens)`);

        try {
          const startTime = Date.now();

          const result = await this.extractSingleChunk(
            chunk.text,
            `${documentId}_chunk${i}`,
            `${documentName} - Parte ${i+1}/${chunks.length}`
          );

          const elapsedTime = Math.round((Date.now() - startTime) / 1000);

          console.log(`      ✅ Chunk ${i+1} extraído em ${elapsedTime}s`);
          console.log(`      📊 Output: ${result.extractedText.length.toLocaleString()} chars`);
          console.log(`      💰 Custo: $${result.metadata.cost.toFixed(4)}`);

          return {
            index: i,
            text: result.extractedText,
            metadata: {
              chunkNumber: i,
              inputSize: chunk.size,
              outputSize: result.extractedText.length,
              cost: result.metadata.cost,
              time: elapsedTime,
              model: result.metadata.modelUsed
            }
          };

        } catch (error) {
          console.error(`      ❌ Erro no chunk ${i+1}:`, error.message);

          return {
            index: i,
            text: `\n\n[ERRO NA EXTRAÇÃO DO CHUNK ${i+1}: ${error.message}]\n\n`,
            metadata: {
              chunkNumber: i,
              error: error.message,
              cost: 0,
              time: 0
            }
          };
        }
      });

      // Aguardar batch completar
      const batchResults = await Promise.all(batchPromises);

      // Adicionar resultados ao array na ordem correta
      for (const result of batchResults) {
        extractedParts[result.index] = result.text;
        chunkMetadata.push(result.metadata);
        totalCost += result.metadata.cost || 0;
        totalTime += result.metadata.time || 0;

        // Update progress tracking
        if (jobId) {
          await extractionProgressService.updateChunkProgress(jobId, result.index, result.metadata);
        }
      }

      console.log(`   ✅ Batch ${Math.floor(batchStart/PARALLEL_CHUNKS)+1} concluído`);
    }

    const overallTime = Math.round((Date.now() - overallStartTime) / 1000);

    // Concatenar todas as partes (filter para remover undefined se houver)
    const fullExtractedText = extractedParts.filter(p => p).join('\n\n═══════════════════════════════════════\n[FIM DA PARTE - CONTINUAÇÃO ABAIXO]\n═══════════════════════════════════════\n\n');

    console.log(`\n   ✅ CHUNKING CONCLUÍDO`);
    console.log(`   📊 Total extraído: ${Math.round(fullExtractedText.length / 1000)}k caracteres`);
    console.log(`   💰 Custo total: $${totalCost.toFixed(4)}`);
    console.log(`   ⏱️  Tempo real: ${overallTime}s (${Math.round(overallTime / 60)} minutos)`);
    console.log(`   ⚡ Speedup: ${Math.round((totalTime / overallTime) * 10) / 10}x vs sequencial`);

    // Mark extraction phase as complete if jobId provided
    if (jobId) {
      console.log(`   ✅ Job ${jobId} extraction phase complete`);
    }

    return {
      extractedText: fullExtractedText,
      metadata: {
        method: 'chunking-parallel',
        originalSize: rawText.length,
        extractedSize: fullExtractedText.length,
        chunks: chunks.length,
        parallelBatchSize: PARALLEL_CHUNKS,
        chunkDetails: chunkMetadata,
        cost: totalCost,
        processingTime: overallTime, // Tempo real (paralelo)
        sequentialTime: totalTime, // Tempo que levaria sequencial
        speedup: Math.round((totalTime / overallTime) * 10) / 10,
        documentId,
        documentName,
        extractedAt: new Date().toISOString()
      }
    };
  }

  /**
   * EXTRAÇÃO DE CHUNK INDIVIDUAL
   *
   * Extrai um único chunk sem verificar cache (usado internamente por extractWithChunking)
   *
   * @param {string} chunkText - Texto do chunk
   * @param {string} chunkId - ID do chunk
   * @param {string} chunkName - Nome do chunk
   * @returns {Object} Texto extraído + metadados
   */
  async extractSingleChunk(chunkText, chunkId, chunkName) {
    const startTime = Date.now();

    const extractionPrompt = `
Você é um especialista em extração e estruturação de documentos jurídicos.

TAREFA:
Extraia e estruture TODO o texto do documento abaixo, corrigindo erros de OCR, organizando parágrafos, mantendo toda a informação original mas tornando-o limpo e bem formatado.

DIRETRIZES:
1. **Preserve TODA informação**: Não resuma, não omita nada
2. **Corrija erros de OCR**: "rec1amação" → "reclamação"
3. **Mantenha estrutura**: Títulos, seções, numerações
4. **Identifique elementos**: Cabeçalhos, rodapés, assinaturas
5. **Estruture por páginas**: Se houver múltiplas páginas, separe claramente

FORMATO DE SAÍDA:
═══════════════════════════════════════════════════════════════════════
DOCUMENTO EXTRAÍDO E ESTRUTURADO
═══════════════════════════════════════════════════════════════════════

[Cabeçalho do documento, se houver]

[Conteúdo da página 1 limpo e estruturado]

[Página 2]

[Conteúdo da página 2 limpo e estruturado]

...

═══════════════════════════════════════════════════════════════════════
FIM DO DOCUMENTO
═══════════════════════════════════════════════════════════════════════

DOCUMENTO BRUTO A EXTRAIR:
═══════════════════════════════════════════════════════════════════════
${chunkText}
═══════════════════════════════════════════════════════════════════════

EXTRAIA E ESTRUTURE TODO O TEXTO ACIMA:
`;

    let response;
    let modelUsed = 'nova-micro';

    // Tentar com Nova Micro primeiro
    try {
      response = await conversar(extractionPrompt, {
        modelo: MODELS['nova-micro'].id,
        systemPrompt: 'Você é um extrator de texto especializado. Preserve TODA informação, não resuma.',
        temperature: 0.1,
        maxTokens: MODELS['nova-micro'].maxTokens,
        enableTools: false,
        enableCache: false
      });

      if (response && response.sucesso === false) {
        throw new Error(`${response.erro} (StatusCode: ${response.statusCode || 'N/A'})`);
      }

    } catch (novaMicroError) {
      // Fallback para Haiku
      console.log(`         ⚠️  Nova Micro falhou, usando Haiku...`);

      response = await conversar(extractionPrompt, {
        modelo: MODELS['haiku'].id,
        systemPrompt: 'Você é um extrator de texto especializado. Preserve TODA informação, não resuma.',
        temperature: 0.1,
        maxTokens: MODELS['haiku'].maxTokens,
        enableTools: false,
        enableCache: false
      });

      if (response && response.sucesso === false) {
        throw new Error(`Both Nova Micro and Haiku failed. Last error: ${response.erro}`);
      }

      modelUsed = 'haiku';
    }

    // Validar resposta
    if (!response || !response.resposta) {
      throw new Error('Resposta do Bedrock inválida');
    }

    const elapsedTime = Math.round((Date.now() - startTime) / 1000);
    const inputTokens = this.estimateTokens(chunkText + extractionPrompt);
    const outputTokens = this.estimateTokens(response.resposta);
    const cost = (inputTokens / 1_000_000) * MODELS[modelUsed].costPer1M.input +
                 (outputTokens / 1_000_000) * MODELS[modelUsed].costPer1M.output;

    return {
      extractedText: response.resposta,
      metadata: {
        modelUsed,
        inputTokens,
        outputTokens,
        cost,
        processingTime: elapsedTime
      }
    };
  }

  /**
   * ETAPA 1: Extração de texto completo com LLM barata
   *
   * @param {string} rawText - Texto bruto do PDF (pode ter erros de OCR, má formatação)
   * @param {string} documentId - ID do documento original
   * @param {string} documentName - Nome do documento original
   * @param {string|null} jobId - ID do job para rastreamento de progresso
   * @returns {Object} Texto extraído e limpo + metadados
   */
  async extractFullText(rawText, documentId, documentName, jobId = null) {
    console.log(`\n🔍 [V2 - ETAPA 1] EXTRAÇÃO DE TEXTO COMPLETO`);
    console.log(`   Documento: ${documentName}`);
    console.log(`   Tamanho bruto: ${Math.round(rawText.length / 1000)}k caracteres`);

    // DETECÇÃO AUTOMÁTICA DE CHUNKING
    const CHUNKING_THRESHOLD = 400000; // 400k chars = limite seguro para single-pass

    if (rawText.length > CHUNKING_THRESHOLD) {
      console.log(`   ⚡ Documento grande (>${Math.round(CHUNKING_THRESHOLD / 1000)}k chars)`);
      console.log(`   🔀 Usando estratégia de CHUNKING automático...`);
      return await this.extractWithChunking(rawText, documentId, documentName, jobId);
    }

    console.log(`   ✅ Documento pequeno (<=${Math.round(CHUNKING_THRESHOLD / 1000)}k chars)`);
    console.log(`   📄 Usando extração SINGLE-PASS...`);
    console.log(`   Modelo: ${MODELS['nova-micro'].name}`);

    const startTime = Date.now();

    // Start job tracking for single-pass extraction
    if (jobId) {
      await extractionProgressService.startJob(jobId, 'single-pass', 1);
    }

    // Verifica se já existe extração em cache
    const cacheId = this.generateCacheId(documentId);
    const cachePath = path.join(this.extractedTextCachePath, `${cacheId}.json`);

    if (fs.existsSync(cachePath)) {
      console.log(`   ♻️  Cache encontrado! Lendo extração anterior...`);
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      console.log(`   ✅ Extração carregada do cache (economia de tempo e custo)`);
      return cached;
    }

    // Prompt para extração estruturada
    const extractionPrompt = `
Você é um especialista em extração e estruturação de documentos jurídicos.

TAREFA:
Extraia e estruture TODO o texto do documento abaixo, corrigindo erros de OCR, organizando parágrafos, mantendo toda a informação original mas tornando-o limpo e bem formatado.

DIRETRIZES:
1. **Preserve TODA informação**: Não resuma, não omita nada
2. **Corrija erros de OCR**: "rec1amação" → "reclamação"
3. **Mantenha estrutura**: Títulos, seções, numerações
4. **Identifique elementos**: Cabeçalhos, rodapés, assinaturas
5. **Preserve formatação legal**: Citações, dispositivos legais, valores
6. **Numere páginas**: Se possível, indique [Página X]
7. **Organize parágrafos**: Quebre em parágrafos lógicos

FORMATO DE SAÍDA:
═══════════════════════════════════════════════════════════════════════
DOCUMENTO EXTRAÍDO E ESTRUTURADO
═══════════════════════════════════════════════════════════════════════

[Cabeçalho do documento, se houver]

[Página 1]

[Conteúdo da página 1 limpo e estruturado]

[Página 2]

[Conteúdo da página 2 limpo e estruturado]

...

═══════════════════════════════════════════════════════════════════════
FIM DO DOCUMENTO
═══════════════════════════════════════════════════════════════════════

DOCUMENTO BRUTO A EXTRAIR:
═══════════════════════════════════════════════════════════════════════
${rawText}
═══════════════════════════════════════════════════════════════════════

EXTRAIA E ESTRUTURE TODO O TEXTO ACIMA:
`;

    try {
      console.log(`   🔧 Tentando extração com ${MODELS['nova-micro'].name}...`);

      let response;
      let modelUsed = 'nova-micro';

      try {
        console.log(`\n   🔍 DEBUG - Detalhes da Chamada ao Bedrock:`);
        console.log(`   📏 Tamanho do rawText original: ${Math.round(rawText.length / 1000)}k caracteres`);
        console.log(`   📏 Tamanho do prompt completo: ${Math.round(extractionPrompt.length / 1000)}k caracteres`);
        console.log(`   📝 Primeiros 500 chars do rawText:`, rawText.substring(0, 500));
        console.log(`   📝 Primeiros 500 chars do prompt:`, extractionPrompt.substring(0, 500));
        console.log(`   🎯 Modelo: ${MODELS['nova-micro'].id}`);
        console.log(`   ⚙️  maxTokens: ${MODELS['nova-micro'].maxTokens} (5k output limit)`);

        response = await conversar(extractionPrompt, {
          modelo: MODELS['nova-micro'].id,
          systemPrompt: 'Você é um extrator de texto especializado. Preserve TODA informação, não resuma.',
          temperature: 0.1,
          maxTokens: MODELS['nova-micro'].maxTokens,  // 5,000 tokens
          enableTools: false,
          enableCache: false
        });

        console.log(`\n   📦 DEBUG - Resposta Recebida do Nova Micro:`);
        console.log(`   ✅ sucesso: ${response?.sucesso}`);
        console.log(`   📊 response.erro: ${response?.erro}`);
        console.log(`   📊 response.statusCode: ${response?.statusCode}`);
        console.log(`   📊 response keys: ${response ? Object.keys(response).join(', ') : 'null'}`);
        if (response?.resposta) {
          console.log(`   📊 response.resposta length: ${response.resposta.length} chars`);
          console.log(`   📝 Primeiros 200 chars da resposta:`, response.resposta.substring(0, 200));
        }

        if (response && response.sucesso === false) {
          console.log(`   ❌ FALHA CONFIRMADA - Nova Micro retornou sucesso:false`);
        }

        // conversar() retorna objeto com sucesso:false ao invés de throw
        // Precisamos verificar e forçar throw para ativar fallback
        if (response && response.sucesso === false) {
          throw new Error(`${response.erro} (StatusCode: ${response.statusCode || 'N/A'})`);
        }

      } catch (novaMicroError) {
        console.log(`\n   ⚠️  Nova Micro FALHOU: ${novaMicroError.message}`);
        console.log(`   🔄 Tentando fallback com Claude 3.5 Haiku...\n`);

        try {
          console.log(`   🔍 DEBUG - Chamada de Fallback (Haiku):`);
          console.log(`   🎯 Modelo: ${MODELS['haiku'].id}`);
          console.log(`   ⚙️  maxTokens: ${MODELS['haiku'].maxTokens} (8k output limit)`);
          console.log(`   📏 Tamanho do prompt: ${Math.round(extractionPrompt.length / 1000)}k caracteres (mesmo prompt)`);

          // Fallback para Haiku (mais caro mas funciona)
          response = await conversar(extractionPrompt, {
            modelo: MODELS['haiku'].id,
            systemPrompt: 'Você é um extrator de texto especializado. Preserve TODA informação, não resuma.',
            temperature: 0.1,
            maxTokens: MODELS['haiku'].maxTokens,  // 8,000 tokens
            enableTools: false,
            enableCache: false
          });

          console.log(`\n   📦 DEBUG - Resposta Recebida do Haiku:`);
          console.log(`   ✅ sucesso: ${response?.sucesso}`);
          console.log(`   📊 response.erro: ${response?.erro}`);
          console.log(`   📊 response.statusCode: ${response?.statusCode}`);
          console.log(`   📊 response keys: ${response ? Object.keys(response).join(', ') : 'null'}`);
          if (response?.resposta) {
            console.log(`   📊 response.resposta length: ${response.resposta.length} chars`);
            console.log(`   📝 Primeiros 200 chars da resposta:`, response.resposta.substring(0, 200));
          }

          if (response && response.sucesso === false) {
            console.log(`   ❌ FALHA CONFIRMADA - Haiku também retornou sucesso:false`);
            throw new Error(`Both Nova Micro and Haiku failed. Last error: ${response.erro}`);
          }

          modelUsed = 'haiku';
          console.log(`   ✅ Fallback para Haiku bem-sucedido`);

        } catch (haikuError) {
          console.error(`   ❌❌ FALHA TOTAL: Ambos os modelos falharam`);
          console.error(`   Nova Micro: ${novaMicroError.message}`);
          console.error(`   Haiku: ${haikuError.message}`);
          throw haikuError;
        }
      }

      // Validar resposta
      if (!response) {
        throw new Error('Resposta do Bedrock é null ou undefined');
      }

      // Verificar se houve erro no Bedrock
      if (response.sucesso === false) {
        console.error(`   ❌ Erro do Bedrock:`, response);
        throw new Error(`Bedrock error: ${response.erro || 'Unknown error'}. StatusCode: ${response.statusCode || 'N/A'}`);
      }

      if (!response.resposta) {
        console.error(`   ❌ Resposta do Bedrock sem campo 'resposta':`, JSON.stringify(response, null, 2));
        throw new Error(`Campo 'resposta' não encontrado. Response keys: ${Object.keys(response).join(', ')}`);
      }

      const extractedText = response.resposta;
      const elapsedTime = Math.round((Date.now() - startTime) / 1000);

      const inputTokens = this.estimateTokens(rawText);
      const outputTokens = this.estimateTokens(extractedText);
      const cost = (inputTokens / 1_000_000) * MODELS[modelUsed].costPer1M.input +
                   (outputTokens / 1_000_000) * MODELS[modelUsed].costPer1M.output;

      console.log(`   ✅ Extração concluída em ${elapsedTime}s`);
      console.log(`   🤖 Modelo usado: ${MODELS[modelUsed].name}`);
      console.log(`   📊 Texto extraído: ${Math.round(extractedText.length / 1000)}k caracteres`);
      console.log(`   💰 Custo: $${cost.toFixed(4)}`);

      // Update progress for single-pass extraction
      if (jobId) {
        await extractionProgressService.updateChunkProgress(jobId, 0, {
          inputSize: rawText.length,
          outputSize: extractedText.length,
          cost,
          time: elapsedTime,
          model: modelUsed
        });
      }

      const result = {
        extractedText,
        metadata: {
          documentId,
          documentName,
          originalSize: rawText.length,
          extractedSize: extractedText.length,
          extractedAt: new Date().toISOString(),
          model: modelUsed,
          modelName: MODELS[modelUsed].name,
          usedFallback: modelUsed !== 'nova-micro',
          inputTokens,
          outputTokens,
          cost,
          processingTime: elapsedTime
        }
      };

      // Salva em cache
      fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));
      console.log(`   💾 Extração salva em cache: ${cacheId}.json`);

      return result;

    } catch (error) {
      console.error(`   ❌ Erro na extração:`, error);

      // Fail job on error
      if (jobId) {
        await extractionProgressService.failJob(jobId, error.message);
      }

      throw error;
    }
  }

  /**
   * ETAPA 2: Salvamento no KB como documento intermediário
   *
   * @param {string} extractedText - Texto completo extraído
   * @param {string} documentId - ID do documento original
   * @param {string} documentName - Nome do documento original
   * @param {boolean} saveToDocuments - Se true, salva também como TXT em documents/
   * @param {string} userId - ID do usuário (para filtro no frontend)
   */
  async saveExtractedTextToKB(extractedText, documentId, documentName, saveToDocuments = true, userId = null) {
    console.log(`\n💾 [V2 - ETAPA 2] SALVAMENTO NO KB`);
    console.log(`   🔐 userId: ${userId || 'não fornecido'}`);

    const kbPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');
    let allDocs = [];

    if (fs.existsSync(kbPath)) {
      allDocs = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
    }

    // Cria documento intermediário
    const intermediateDoc = {
      id: `kb-extracted-${documentId}-${Date.now()}`,
      name: `${documentName} - TEXTO_COMPLETO.md`,
      originalName: documentName,
      type: 'text/markdown',
      size: extractedText.length,
      uploadedAt: new Date().toISOString(),
      textLength: extractedText.length,
      extractedText: extractedText,  // 🔥 FIX: Incluir texto no objeto
      userId: userId || 'web-upload',  // 🔥 FIX CRÍTICO: Adicionar userId para filtro no frontend
      metadata: {
        isExtractedText: true,
        parentDocument: documentId,
        extractionSource: 'nova-micro',
        purpose: 'intermediate-full-text'
      }
    };

    // Salva arquivo no cache
    const textPath = path.join(this.extractedTextCachePath, `${intermediateDoc.id}.md`);
    fs.writeFileSync(textPath, extractedText, 'utf-8');
    intermediateDoc.path = textPath;

    // 🔥 FIX: TAMBÉM salvar na pasta knowledge-base/documents/ como TXT acessível
    if (saveToDocuments) {
      const timestamp = Date.now();
      const cleanDocName = documentName.replace(/\.(pdf|docx|txt|md)$/i, '');
      const kbDocsDir = path.join(ACTIVE_PATHS.data, 'knowledge-base', 'documents');

      // Garantir que diretório existe
      if (!fs.existsSync(kbDocsDir)) {
        fs.mkdirSync(kbDocsDir, { recursive: true });
      }

      // Salvar como TXT (não MD) para facilitar acesso
      const txtPath = path.join(kbDocsDir, `${timestamp}_00_TEXTO_COMPLETO.txt`);
      fs.writeFileSync(txtPath, extractedText, 'utf-8');

      // 🔥 FIX CRÍTICO: Criar documento separado no KB para 00_TEXTO_COMPLETO.txt
      const txtDoc = {
        id: `kb-txt-${timestamp}`,
        name: `${documentName}_00_TEXTO_COMPLETO.txt`,
        originalName: documentName,
        type: 'text/plain',
        size: extractedText.length,
        uploadedAt: new Date().toISOString(),
        path: txtPath,
        userId: userId || 'web-upload',
        metadata: {
          isFullText: true,
          parentDocument: documentId,
          extractionSource: 'nova-micro',
          purpose: 'complete-text-file'
        }
      };

      allDocs.push(txtDoc);
      kbCache.add(txtDoc);

      // Adicionar referência no metadata do intermediateDoc
      intermediateDoc.metadata.fullTextPath = txtPath;
      intermediateDoc.metadata.fullTextDocId = txtDoc.id;

      console.log(`   📄 Texto completo salvo em: ${path.basename(txtPath)}`);
      console.log(`   📂 Diretório: knowledge-base/documents/`);
      console.log(`   🆔 Doc ID: ${txtDoc.id}`);
    }

    // Adiciona ao KB (documento intermediário .md)
    allDocs.push(intermediateDoc);
    fs.writeFileSync(kbPath, JSON.stringify(allDocs, null, 2));

    // 🔥 FIX: Adicionar ao cache em memória para que apareça na interface
    kbCache.add(intermediateDoc);

    console.log(`   ✅ Documento intermediário salvo: ${intermediateDoc.name}`);
    console.log(`   📊 Tamanho: ${Math.round(extractedText.length / 1000)}k caracteres`);
    console.log(`   🆔 ID: ${intermediateDoc.id}`);

    return intermediateDoc;
  }

  /**
   * Salva ficheiros técnicos no KB e atualiza metadata do documento principal
   *
   * @param {Object} technicalFiles - Objeto com ficheiros {FICHAMENTO, ANALISE_JURIDICA, ...}
   * @param {string} documentId - ID do documento principal
   * @param {string} documentName - Nome do documento principal
   * @param {string} intermediateDocId - ID do documento texto completo
   */
  async saveTechnicalFilesToKB(technicalFiles, documentId, documentName, intermediateDocId, userId = null) {
    console.log(`\n💾 [V2 - SALVAMENTO FICHEIROS TÉCNICOS NO KB]`);
    console.log(`   🔐 userId: ${userId || 'não fornecido'}`);

    const kbPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');
    const kbDocsDir = path.join(ACTIVE_PATHS.data, 'knowledge-base', 'documents');

    // Garante que diretório existe
    if (!fs.existsSync(kbDocsDir)) {
      fs.mkdirSync(kbDocsDir, { recursive: true });
    }

    let allDocs = [];
    if (fs.existsSync(kbPath)) {
      allDocs = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
    }

    const timestamp = Date.now();
    const savedFiles = [];

    // Mapear nomes de ficheiros para ordem/tipo (TODOS OS 18 TIPOS)
    const fileMapping = {
      'FICHAMENTO': { order: 1, prefix: '01_FICHAMENTO', extension: '.md', type: 'FICHAMENTO' },
      'CRONOLOGIA': { order: 2, prefix: '02_CRONOLOGIA', extension: '.md', type: 'CRONOLOGIA' },
      'LINHA_DO_TEMPO': { order: 3, prefix: '03_LINHA_DO_TEMPO', extension: '.md', type: 'LINHA_DO_TEMPO' },
      'MAPA_DE_PARTES': { order: 4, prefix: '04_MAPA_DE_PARTES', extension: '.md', type: 'MAPA_DE_PARTES' },
      'RESUMO_EXECUTIVO': { order: 5, prefix: '05_RESUMO_EXECUTIVO', extension: '.txt', type: 'RESUMO_EXECUTIVO' },
      'TESES_JURIDICAS': { order: 6, prefix: '06_TESES_JURIDICAS', extension: '.md', type: 'TESES_JURIDICAS' },
      'ANALISE_DE_PROVAS': { order: 7, prefix: '07_ANALISE_DE_PROVAS', extension: '.md', type: 'ANALISE_DE_PROVAS' },
      'QUESTOES_JURIDICAS': { order: 8, prefix: '08_QUESTOES_JURIDICAS', extension: '.md', type: 'QUESTOES_JURIDICAS' },
      'PEDIDOS_E_DECISOES': { order: 9, prefix: '09_PEDIDOS_E_DECISOES', extension: '.md', type: 'PEDIDOS_E_DECISOES' },
      'RECURSOS_INTERPOSTOS': { order: 10, prefix: '10_RECURSOS_INTERPOSTOS', extension: '.md', type: 'RECURSOS_INTERPOSTOS' },
      'PRAZOS_E_INTIMACOES': { order: 11, prefix: '11_PRAZOS_E_INTIMACOES', extension: '.md', type: 'PRAZOS_E_INTIMACOES' },
      'CUSTAS_E_VALORES': { order: 12, prefix: '12_CUSTAS_E_VALORES', extension: '.md', type: 'CUSTAS_E_VALORES' },
      'JURISPRUDENCIA_CITADA': { order: 13, prefix: '13_JURISPRUDENCIA_CITADA', extension: '.md', type: 'JURISPRUDENCIA_CITADA' },
      'HISTORICO_PROCESSUAL': { order: 14, prefix: '14_HISTORICO_PROCESSUAL', extension: '.md', type: 'HISTORICO_PROCESSUAL' },
      'MANIFESTACOES_POR_PARTE': { order: 15, prefix: '15_MANIFESTACOES_POR_PARTE', extension: '.md', type: 'MANIFESTACOES_POR_PARTE' },
      'ANALISE_DE_RISCO': { order: 16, prefix: '16_ANALISE_DE_RISCO', extension: '.md', type: 'ANALISE_DE_RISCO' },
      'ESTRATEGIA_E_PROXIMOS_PASSOS': { order: 17, prefix: '17_ESTRATEGIA_E_PROXIMOS_PASSOS', extension: '.md', type: 'ESTRATEGIA_E_PROXIMOS_PASSOS' },
      'PRECEDENTES_SIMILARES': { order: 18, prefix: '18_PRECEDENTES_SIMILARES', extension: '.md', type: 'PRECEDENTES_SIMILARES' }
    };

    // Salvar cada ficheiro
    for (const [fileKey, fileContent] of Object.entries(technicalFiles)) {
      const fileInfo = fileMapping[fileKey];
      if (!fileInfo || !fileContent) continue;

      // ID único para o ficheiro
      const fileId = `${timestamp}_${documentName.replace(/\.[^/.]+$/, '')}_${fileInfo.prefix}`;
      const fileName = `${fileId}${fileInfo.extension}`;
      const filePath = path.join(kbDocsDir, fileName);

      // Salva conteúdo
      fs.writeFileSync(filePath, fileContent, 'utf-8');

      // Cria metadata do ficheiro
      const fileDoc = {
        id: fileId,
        name: `${fileInfo.prefix}${fileInfo.extension}`,
        originalName: documentName,
        type: fileKey === 'RESUMO_EXECUTIVO' ? 'text/plain' : 'text/markdown',  // ✅ TXT para resumo executivo
        size: fileContent.length,
        uploadedAt: new Date().toISOString(),
        path: filePath,
        userId: userId,  // ✅ FIX: Add userId to document metadata
        metadata: {
          isStructuredDocument: true,
          parentDocument: documentId,
          intermediateDocument: intermediateDocId,
          fileType: fileInfo.type,
          order: fileInfo.order,
          generatedBy: 'document-processor-v2',
          analysisModel: 'claude-sonnet',
          isExtensiveAnalysis: fileKey === 'RESUMO_EXECUTIVO'  // ✅ Flag para análise extensiva
        }
      };

      // Salva metadata separado
      const metadataPath = path.join(kbDocsDir, `${fileId}.metadata.json`);
      fs.writeFileSync(metadataPath, JSON.stringify(fileDoc, null, 2));

      // Adiciona ao KB
      allDocs.push(fileDoc);

      // 🔥 FIX: Adicionar ao cache em memória para que apareça na interface
      kbCache.add(fileDoc);

      savedFiles.push({
        name: fileDoc.name,
        path: filePath,
        type: fileInfo.type,
        size: fileContent.length
      });

      console.log(`   ✅ ${fileInfo.prefix}${fileInfo.extension} salvo (${Math.round(fileContent.length / 1000)}k chars)`);
      console.log(`      🔐 userId: ${fileDoc.userId || 'NÃO DEFINIDO'}, cache updated: ${kbCache.getById(fileDoc.id) ? 'SIM' : 'NÃO'}`);
    }

    // Atualiza documento principal com referências aos ficheiros estruturados
    const mainDocIndex = allDocs.findIndex(d =>
      d.id === documentId ||
      d.metadata?.parentDocument === documentId ||
      d.originalName === documentName
    );

    if (mainDocIndex !== -1) {
      if (!allDocs[mainDocIndex].metadata) {
        allDocs[mainDocIndex].metadata = {};
      }
      allDocs[mainDocIndex].metadata.structuredDocsInKB = savedFiles;
      allDocs[mainDocIndex].metadata.hasStructuredFiles = true;
      allDocs[mainDocIndex].metadata.structuredFilesCount = savedFiles.length;
      console.log(`   ✅ Metadata do documento principal atualizado`);
    }

    // Salva kb-documents.json atualizado
    fs.writeFileSync(kbPath, JSON.stringify(allDocs, null, 2));

    console.log(`\n   ═══════════════════════════════════════`);
    console.log(`   ✅ ${savedFiles.length} ficheiros salvos no KB`);
    console.log(`   📂 Diretório: knowledge-base/documents/`);
    console.log(`   ═══════════════════════════════════════`);

    return {
      success: true,
      savedFiles,
      count: savedFiles.length
    };
  }

  /**
   * ETAPA 3: Análise profunda com LLM Premium (com timeout)
   *
   * @param {string} extractedText - Texto completo já limpo
   * @param {string} analysisPrompt - Prompt de análise do usuário
   * @param {string} model - Modelo premium a usar (haiku, sonnet, opus)
   * @param {string} systemPrompt - System prompt customizado
   * @param {number} timeoutMs - Timeout em milissegundos (padrão: 120000 = 2 minutos)
   */
  async analyzeWithPremiumLLM(extractedText, analysisPrompt, model = 'sonnet', systemPrompt = '', timeoutMs = 120000) {
    console.log(`\n🧠 [V2 - ETAPA 3] ANÁLISE COM LLM PREMIUM`);
    console.log(`   Modelo: ${MODELS[model].name}`);
    console.log(`   Texto: ${Math.round(extractedText.length / 1000)}k caracteres (~${this.estimateTokens(extractedText).toLocaleString()} tokens)`);
    console.log(`   ⏱️ Timeout: ${timeoutMs / 1000}s`);

    const startTime = Date.now();

    const fullPrompt = `
${analysisPrompt}

═══════════════════════════════════════════════════════════════════════
DOCUMENTO COMPLETO (JÁ EXTRAÍDO E ESTRUTURADO):
═══════════════════════════════════════════════════════════════════════

${extractedText}

═══════════════════════════════════════════════════════════════════════
FIM DO DOCUMENTO
═══════════════════════════════════════════════════════════════════════

FORNEÇA UMA ANÁLISE COMPLETA E PROFUNDA DO DOCUMENTO ACIMA:
`;

    try {
      // 🔥 FIX: Wrap conversar call with timeout to prevent indefinite hanging
      // Progress logging every 15 seconds so user knows it's working
      let progressInterval;
      const timeoutPromise = new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          clearInterval(progressInterval);
          reject(new Error(`Timeout após ${timeoutMs / 1000}s aguardando resposta do LLM`));
        }, timeoutMs);

        // Log progress every 15 seconds
        let elapsed = 0;
        progressInterval = setInterval(() => {
          elapsed += 15;
          console.log(`   ⏳ Aguardando resposta do LLM... ${elapsed}s / ${timeoutMs / 1000}s`);
        }, 15000);
      });

      const conversarPromise = conversar(fullPrompt, {
        modelo: MODELS[model].id,
        systemPrompt: systemPrompt || 'Você é um assistente jurídico especializado em análise profunda de documentos processuais brasileiros.',
        temperature: 0.3,
        maxTokens: MODELS[model].maxTokens,  // Use model-specific output limit
        enableTools: false,
        enableCache: false
      });

      const response = await Promise.race([conversarPromise, timeoutPromise]);
      clearInterval(progressInterval);

      // Validar resposta
      if (!response) {
        throw new Error('Resposta do Bedrock é null ou undefined');
      }

      // Verificar se houve erro no Bedrock
      if (response.sucesso === false) {
        console.error(`   ❌ Erro do Bedrock:`, response);
        throw new Error(`Bedrock error: ${response.erro || 'Unknown error'}. StatusCode: ${response.statusCode || 'N/A'}`);
      }

      if (!response.resposta) {
        console.error(`   ❌ Resposta do Bedrock sem campo 'resposta':`, JSON.stringify(response, null, 2));
        throw new Error(`Campo 'resposta' não encontrado. Response keys: ${Object.keys(response).join(', ')}`);
      }

      const elapsedTime = Math.round((Date.now() - startTime) / 1000);

      const inputTokens = this.estimateTokens(extractedText + analysisPrompt);
      const outputTokens = this.estimateTokens(response.resposta);
      const cost = (inputTokens / 1_000_000) * MODELS[model].costPer1M.input +
                   (outputTokens / 1_000_000) * MODELS[model].costPer1M.output;

      console.log(`   ✅ Análise concluída em ${elapsedTime}s`);
      console.log(`   💰 Custo: $${cost.toFixed(4)}`);

      return {
        success: true,
        analysis: response.resposta,
        metadata: {
          model,
          inputTokens,
          outputTokens,
          cost,
          processingTime: elapsedTime
        }
      };

    } catch (error) {
      const elapsedTime = Math.round((Date.now() - startTime) / 1000);
      const isTimeout = error.message.includes('Timeout');

      if (isTimeout) {
        console.error(`   ⏱️ TIMEOUT após ${elapsedTime}s:`, error.message);
        console.error(`   💡 Dica: Documento muito grande ou LLM sobrecarregado. Considere dividir em partes menores.`);
      } else {
        console.error(`   ❌ Erro na análise após ${elapsedTime}s:`, error);
      }

      return {
        success: false,
        error: error.message,
        isTimeout,
        elapsedTime
      };
    }
  }

  /**
   * ETAPA 4 (BATCH): Geração de 20 ficheiros técnicos em lote
   *
   * NOVA IMPLEMENTAÇÃO OTIMIZADA:
   * - 1 única chamada à IA com prompt master
   * - IA retorna JSON com 20 análises
   * - Sistema quebra em 20 arquivos .md
   * - Custo: ~$0.05 (vs $0.71 com 20 chamadas separadas)
   * - Economia: 93%
   *
   * @param {string} extractedText - Texto completo já limpo
   * @param {string} documentId - ID do documento
   * @param {string} documentName - Nome do documento
   * @param {string} model - Modelo premium a usar (sonnet recomendado)
   * @param {Function} progressCallback - Callback de progresso
   */
  async generateTechnicalFilesBatch(extractedText, documentId, documentName, model = 'sonnet', progressCallback = null) {
    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║  📄 [V2 - ETAPA 4 BATCH] GERAÇÃO DE 20 FICHEIROS EM LOTE    ║`);
    console.log(`╚══════════════════════════════════════════════════════════════╝`);
    console.log(`   📊 Modelo solicitado: ${model}`);
    console.log(`   📊 documentId: ${documentId}`);
    console.log(`   📊 documentName: ${documentName}`);
    console.log(`   📊 extractedText length: ${extractedText ? extractedText.length : 'NULL'} chars`);
    console.log(`   📊 progressCallback: ${progressCallback ? 'SIM' : 'NÃO'}`);

    // Validações básicas
    if (!extractedText) {
      console.error(`   ❌ ERRO: extractedText é null ou undefined!`);
      return {
        success: false,
        error: 'extractedText não fornecido',
        files: {},
        metadata: { filesGenerated: 0, totalCost: 0, totalTime: 0 }
      };
    }

    if (!MODELS[model]) {
      console.error(`   ❌ ERRO: Modelo '${model}' não existe em MODELS`);
      console.error(`   📊 Modelos disponíveis: ${Object.keys(MODELS).join(', ')}`);
      return {
        success: false,
        error: `Modelo '${model}' não encontrado`,
        files: {},
        metadata: { filesGenerated: 0, totalCost: 0, totalTime: 0 }
      };
    }

    // 🔥 FIX DEFINITIVO: Prompt muito grande (9.5K tokens) + documento (5K) = 14.5K input
    // Mesmo Opus com timeout de 5min falha silenciosamente
    // SOLUÇÃO: SEMPRE usar split batch (2 chamadas menores mais confiáveis)
    let effectiveModel = model;
    let useSplitBatch = true; // 🔥 SEMPRE true para garantir sucesso
    let timeoutMs = 120000; // 2 minutos por batch

    console.log(`   📊 Estratégia: SPLIT BATCH (2 chamadas de 9 fichamentos)`);
    console.log(`   💡 Motivo: Prompt batch completo muito grande (~14.5K tokens input)`);
    console.log(`   ✅ Split batch é mais confiável e mais barato que Opus`);
    console.log(`   📊 Timeout por batch: ${timeoutMs / 1000}s`);

    // Se modelo não é sonnet, ajustar de qualquer forma para sonnet (melhor custo/benefício para split)
    if (model !== 'sonnet' && MODELS['sonnet']) {
      console.log(`   ✅ Forçando uso de Sonnet para split batch (melhor custo/benefício)`);
      effectiveModel = 'sonnet';
    }

    console.log(`   📊 Modelo efetivo: ${MODELS[effectiveModel].name}`);
    console.log(`   📊 Método: ${useSplitBatch ? '2 chamadas (split batch)' : '1 única chamada à IA (otimizado)'}`);
    console.log(`   📊 Output limit: ${MODELS[effectiveModel].maxTokens} tokens`);
    console.log(`   📊 Timeout: ${timeoutMs / 1000}s`);

    const startTime = Date.now();
    console.log(`   ⏰ Início: ${new Date(startTime).toISOString()}`);

    try {
      // Se usar split batch, chamar método alternativo
      if (useSplitBatch) {
        console.log(`   🔀 Usando split batch...`);
        return await this.generateTechnicalFilesSplitBatch(extractedText, documentId, documentName, effectiveModel, progressCallback);
      }

      // Construir prompt completo
      const fullPrompt = BATCH_ANALYSIS_PROMPT + '\n\n' + extractedText;

      console.log(`   📊 Tamanho do input: ${Math.round(fullPrompt.length / 1000)}k chars (~${this.estimateTokens(fullPrompt).toLocaleString()} tokens)`);
      console.log(`   📊 Output esperado: ~10-12k tokens (18 fichamentos × ~600 tokens cada)`);
      console.log(`   📊 Limite do modelo: ${MODELS[effectiveModel].maxTokens} tokens`);

      if (progressCallback) {
        await progressCallback('batch_analysis', 30, 'Analisando processo completo com IA...');
      }

      // 1 ÚNICA CHAMADA À IA
      console.log(`   🤖 Iniciando chamada para ${MODELS[effectiveModel].name}...`);
      console.log(`   ⏳ Isso pode levar ${Math.round(timeoutMs / 60000)} minutos, aguarde...`);

      let response;
      try {
        response = await this.analyzeWithPremiumLLM(
          fullPrompt,
          '', // Prompt já está no fullPrompt
          effectiveModel,
          'Você é um assistente jurídico especializado. Retorne APENAS o JSON solicitado, sem texto adicional antes ou depois. IMPORTANTE: Complete TODOS os 18 tipos de fichamento, não truncar.',
          timeoutMs  // 🔥 FIX: Passar timeout personalizado
        );
      } catch (llmError) {
        console.error(`   ❌ Erro ao chamar ${MODELS[effectiveModel].name}:`, llmError.message);
        console.log(`   💡 Fallback: Tentando split batch com ${effectiveModel}...`);
        return await this.generateTechnicalFilesSplitBatch(extractedText, documentId, documentName, effectiveModel, progressCallback);
      }

      console.log(`   ✅ ${MODELS[effectiveModel].name} respondeu após ${Math.round((Date.now() - startTime) / 1000)}s`);

      if (!response.success) {
        console.error(`   ❌ Análise falhou: ${response.error || 'Resposta não disponível'}`);
        console.log(`   💡 Fallback: Tentando split batch com ${effectiveModel}...`);
        return await this.generateTechnicalFilesSplitBatch(extractedText, documentId, documentName, effectiveModel, progressCallback);
      }

      const totalTokens = response.metadata.inputTokens + response.metadata.outputTokens;
      console.log(`   ✅ IA respondeu (${totalTokens.toLocaleString()} tokens, $${response.metadata.cost.toFixed(4)})`);

      // VERIFICAR TRUNCAMENTO
      const responseLength = response.analysis.length;
      const estimatedOutputTokens = this.estimateTokens(response.analysis);
      console.log(`   📊 Output recebido: ${Math.round(responseLength / 1000)}k chars (~${estimatedOutputTokens.toLocaleString()} tokens)`);

      if (estimatedOutputTokens >= MODELS[effectiveModel].maxTokens * 0.95) {
        console.log(`   ⚠️  ALERTA: Resposta próxima ao limite de tokens, pode estar truncada!`);
      }

      if (progressCallback) {
        await progressCallback('parsing_json', 60, 'Processando resposta da IA...');
      }

      // PARSEAR JSON
      console.log(`   📦 Parseando JSON da resposta...`);
      let analysisData;

      try {
        // Remover markdown code blocks se houver
        let cleanedResponse = response.analysis.trim();

        // Remover ```json e ``` se presente
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/```\s*$/, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/```\s*$/, '');
        }

        analysisData = JSON.parse(cleanedResponse);
        console.log(`   ✅ JSON parseado com sucesso`);
        console.log(`   📊 Chaves encontradas: ${Object.keys(analysisData).length}`);
      } catch (parseError) {
        console.error(`   ❌ Erro ao parsear JSON:`, parseError.message);
        console.log(`   📄 Primeiros 1000 chars da resposta:`, response.analysis.substring(0, 1000));
        console.log(`   📄 Últimos 1000 chars da resposta:`, response.analysis.substring(Math.max(0, response.analysis.length - 1000)));
        console.log(`   📊 Tamanho total da resposta: ${response.analysis.length} chars`);

        // DETECTAR TRUNCAMENTO: últimos chars não terminam com }
        const lastChars = response.analysis.trim().slice(-50);
        if (!lastChars.endsWith('}') && !lastChars.endsWith('}```')) {
          console.log(`   ⚠️  DIAGNÓSTICO: Resposta truncada! Últimos chars: "${lastChars}"`);
          console.log(`   💡 SOLUÇÃO: Reprocessando com split batch...`);
          return await this.generateTechnicalFilesSplitBatch(extractedText, documentId, documentName, effectiveModel, progressCallback);
        }

        // Fallback: tentar extrair JSON da resposta
        const jsonMatch = response.analysis.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            analysisData = JSON.parse(jsonMatch[0]);
            console.log(`   ⚠️  JSON extraído com regex - parsear bem-sucedido`);
          } catch {
            throw new Error('Resposta da IA não está em formato JSON válido');
          }
        } else {
          throw new Error('Não foi possível extrair JSON da resposta');
        }
      }

      if (progressCallback) {
        await progressCallback('creating_files', 80, 'Criando 20 arquivos estruturados...');
      }

      // QUEBRAR EM 20 ARQUIVOS
      console.log(`   📝 Criando 20 arquivos .md individuais...`);
      const files = {};

      const fileTypes = [
        'FICHAMENTO',
        'CRONOLOGIA',
        'LINHA_DO_TEMPO',
        'MAPA_DE_PARTES',
        'RESUMO_EXECUTIVO',
        'TESES_JURIDICAS',
        'ANALISE_DE_PROVAS',
        'QUESTOES_JURIDICAS',
        'PEDIDOS_E_DECISOES',
        'RECURSOS_INTERPOSTOS',
        'PRAZOS_E_INTIMACOES',
        'CUSTAS_E_VALORES',
        'JURISPRUDENCIA_CITADA',
        'HISTORICO_PROCESSUAL',
        'MANIFESTACOES_POR_PARTE',
        'ANALISE_DE_RISCO',
        'ESTRATEGIA_E_PROXIMOS_PASSOS',
        'PRECEDENTES_SIMILARES'
      ];

      let filesCreated = 0;
      let emptyFiles = 0;
      for (const fileType of fileTypes) {
        if (analysisData[fileType] && analysisData[fileType].trim().length > 50) {
          files[fileType] = analysisData[fileType];
          filesCreated++;
          console.log(`      ✅ ${fileType}.md (${Math.round(analysisData[fileType].length / 1000)}KB)`);
        } else {
          console.log(`      ⚠️  ${fileType}.md - [NÃO GERADO OU VAZIO]`);
          emptyFiles++;
          // Criar arquivo placeholder
          files[fileType] = `# ${fileType.replace(/_/g, ' ')}\n\n[INFORMAÇÕES INSUFICIENTES NO DOCUMENTO PARA GERAR ESTA ANÁLISE]\n\nA IA não conseguiu extrair informações suficientes do processo para gerar este tipo de análise.`;
        }
      }

      const totalTime = Math.round((Date.now() - startTime) / 1000);
      const totalCost = response.metadata.cost;

      console.log(`\n   ═══════════════════════════════════════`);
      console.log(`   ✅ ${filesCreated}/18 ficheiros gerados com conteúdo`);
      if (emptyFiles > 0) {
        console.log(`   ⚠️  ${emptyFiles} ficheiros vazios/incompletos`);
      }
      console.log(`   ⏱️  Tempo total: ${totalTime}s`);
      console.log(`   💰 Custo total: $${totalCost.toFixed(4)}`);
      console.log(`   💡 Economia vs método antigo: ~93%`);
      console.log(`   ═══════════════════════════════════════`);

      // Se muitos arquivos vazios, retornar erro para acionar fallback
      if (emptyFiles > 9) {
        console.log(`   ⚠️  MUITOS ARQUIVOS VAZIOS - Acionando fallback split batch...`);
        return await this.generateTechnicalFilesSplitBatch(extractedText, documentId, documentName, effectiveModel, progressCallback);
      }

      return {
        success: true,
        files,
        metadata: {
          filesGenerated: filesCreated,
          emptyFiles,
          totalCost,
          totalTime,
          method: 'batch',
          model: MODELS[effectiveModel].name
        }
      };

    } catch (error) {
      console.error(`   ❌ Erro na geração em lote:`, error);
      return {
        success: false,
        error: error.message,
        files: {},
        metadata: {
          filesGenerated: 0,
          totalCost: 0,
          totalTime: Math.round((Date.now() - startTime) / 1000)
        }
      };
    }
  }

  /**
   * ETAPA 4 SPLIT: Geração em 2 lotes (9 fichamentos cada)
   *
   * Usado quando modelo tem limite de output tokens insuficiente (ex: Sonnet 8K)
   * Divide os 18 fichamentos em 2 batches de 9 cada
   */
  async generateTechnicalFilesSplitBatch(extractedText, documentId, documentName, model = 'sonnet', progressCallback = null) {
    console.log(`\n📄 [V2 - ETAPA 4 SPLIT BATCH] GERAÇÃO EM 2 LOTES`);
    console.log(`   Modelo: ${MODELS[model].name}`);
    console.log(`   Método: 2 chamadas (9 fichamentos cada)`);

    const startTime = Date.now();
    let totalCost = 0;

    try {
      const allFiles = {};
      const fileTypes = [
        'FICHAMENTO',
        'CRONOLOGIA',
        'LINHA_DO_TEMPO',
        'MAPA_DE_PARTES',
        'RESUMO_EXECUTIVO',
        'TESES_JURIDICAS',
        'ANALISE_DE_PROVAS',
        'QUESTOES_JURIDICAS',
        'PEDIDOS_E_DECISOES',
        'RECURSOS_INTERPOSTOS',
        'PRAZOS_E_INTIMACOES',
        'CUSTAS_E_VALORES',
        'JURISPRUDENCIA_CITADA',
        'HISTORICO_PROCESSUAL',
        'MANIFESTACOES_POR_PARTE',
        'ANALISE_DE_RISCO',
        'ESTRATEGIA_E_PROXIMOS_PASSOS',
        'PRECEDENTES_SIMILARES'
      ];

      // Dividir em 2 batches
      const batch1Types = fileTypes.slice(0, 9);
      const batch2Types = fileTypes.slice(9, 18);

      // BATCH 1
      console.log(`\n   📦 LOTE 1/2: ${batch1Types.length} fichamentos`);
      if (progressCallback) {
        await progressCallback('batch_1', 30, 'Gerando lote 1/2 (9 fichamentos)...');
      }

      const prompt1 = this.createSplitBatchPrompt(batch1Types);
      const fullPrompt1 = prompt1 + '\n\n' + extractedText;

      const response1 = await this.analyzeWithPremiumLLM(
        fullPrompt1,
        '',
        model,
        `Você é um assistente jurídico especializado em análise processual. Retorne APENAS o JSON solicitado com os 9 tipos de fichamento, sem texto adicional.

REGRAS CRÍTICAS DE FORMATAÇÃO:
- PROIBIDO usar marcadores de IA: travessões longos (—), asteriscos duplos, barras (//), emojis
- PROIBIDO usar placeholders vazios: [INSERIR X], "A definir"
- OBRIGATÓRIO usar formatação jurídica tradicional: numeração romana (I, II, III), árabe (1, 2, 3), alíneas (a, b, c)
- Se informação não disponível: "[NÃO IDENTIFICADO]"`
      );

      if (!response1.success) {
        throw new Error(`Erro no lote 1: ${response1.error}`);
      }

      totalCost += response1.metadata.cost;
      console.log(`   ✅ Lote 1 concluído ($${response1.metadata.cost.toFixed(4)})`);

      // Parse batch 1
      let batch1Data;
      try {
        let cleaned1 = response1.analysis.trim();
        if (cleaned1.startsWith('```json')) {
          cleaned1 = cleaned1.replace(/^```json\s*/, '').replace(/```\s*$/, '');
        } else if (cleaned1.startsWith('```')) {
          cleaned1 = cleaned1.replace(/^```\s*/, '').replace(/```\s*$/, '');
        }
        // ✅ FIX: Usar tryRepairJSON que tenta reparar JSON truncado
        batch1Data = this.tryRepairJSON(cleaned1);
        console.log(`   ✅ Lote 1 parseado: ${Object.keys(batch1Data).length} fichamentos`);
      } catch (parseError) {
        console.error(`   ❌ Erro ao parsear lote 1:`, parseError.message);
        console.error(`   📄 Primeiros 500 chars da resposta:`, response1.analysis.substring(0, 500));
        batch1Data = {};
      }

      // BATCH 2
      console.log(`\n   📦 LOTE 2/2: ${batch2Types.length} fichamentos`);
      if (progressCallback) {
        await progressCallback('batch_2', 60, 'Gerando lote 2/2 (9 fichamentos)...');
      }

      const prompt2 = this.createSplitBatchPrompt(batch2Types);
      const fullPrompt2 = prompt2 + '\n\n' + extractedText;

      const response2 = await this.analyzeWithPremiumLLM(
        fullPrompt2,
        '',
        model,
        `Você é um assistente jurídico especializado em análise processual. Retorne APENAS o JSON solicitado com os 9 tipos de fichamento, sem texto adicional.

REGRAS CRÍTICAS DE FORMATAÇÃO:
- PROIBIDO usar marcadores de IA: travessões longos (—), asteriscos duplos, barras (//), emojis
- PROIBIDO usar placeholders vazios: [INSERIR X], "A definir"
- OBRIGATÓRIO usar formatação jurídica tradicional: numeração romana (I, II, III), árabe (1, 2, 3), alíneas (a, b, c)
- Se informação não disponível: "[NÃO IDENTIFICADO]"`
      );

      if (!response2.success) {
        throw new Error(`Erro no lote 2: ${response2.error}`);
      }

      totalCost += response2.metadata.cost;
      console.log(`   ✅ Lote 2 concluído ($${response2.metadata.cost.toFixed(4)})`);

      // Parse batch 2
      let batch2Data;
      try {
        let cleaned2 = response2.analysis.trim();
        if (cleaned2.startsWith('```json')) {
          cleaned2 = cleaned2.replace(/^```json\s*/, '').replace(/```\s*$/, '');
        } else if (cleaned2.startsWith('```')) {
          cleaned2 = cleaned2.replace(/^```\s*/, '').replace(/```\s*$/, '');
        }
        // ✅ FIX: Usar tryRepairJSON que tenta reparar JSON truncado
        batch2Data = this.tryRepairJSON(cleaned2);
        console.log(`   ✅ Lote 2 parseado: ${Object.keys(batch2Data).length} fichamentos`);
      } catch (parseError) {
        console.error(`   ❌ Erro ao parsear lote 2:`, parseError.message);
        console.error(`   📄 Primeiros 500 chars da resposta:`, response2.analysis.substring(0, 500));

        // ✅ RETRY LOGIC: Se lote 2 falhar, tentar novamente com prompt mais curto
        console.log(`   🔄 Tentando retry do lote 2 com prompt simplificado...`);
        try {
          const retryPrompt = this.createSplitBatchPrompt(batch2Types);
          const retryResponse = await this.analyzeWithPremiumLLM(
            retryPrompt + '\n\n' + extractedText.substring(0, 100000), // Limitar texto para evitar truncamento
            '',
            model,
            'Retorne APENAS JSON válido com os 9 fichamentos solicitados. NÃO adicione texto antes ou depois do JSON.'
          );

          if (retryResponse.success) {
            let retryCleaned = retryResponse.analysis.trim();
            if (retryCleaned.startsWith('```json')) {
              retryCleaned = retryCleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
            } else if (retryCleaned.startsWith('```')) {
              retryCleaned = retryCleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
            }
            batch2Data = this.tryRepairJSON(retryCleaned);
            console.log(`   ✅ Retry bem-sucedido: ${Object.keys(batch2Data).length} fichamentos`);
          } else {
            console.error(`   ❌ Retry falhou:`, retryResponse.error);
            batch2Data = {};
          }
        } catch (retryError) {
          console.error(`   ❌ Retry exception:`, retryError.message);
          batch2Data = {};
        }
      }

      if (progressCallback) {
        await progressCallback('merging', 80, 'Mesclando resultados...');
      }

      // Mesclar resultados
      let filesCreated = 0;
      for (const fileType of fileTypes) {
        if (batch1Data[fileType]) {
          allFiles[fileType] = batch1Data[fileType];
          filesCreated++;
          console.log(`      ✅ ${fileType}.md (lote 1)`);
        } else if (batch2Data[fileType]) {
          allFiles[fileType] = batch2Data[fileType];
          filesCreated++;
          console.log(`      ✅ ${fileType}.md (lote 2)`);
        } else {
          console.log(`      ⚠️  ${fileType}.md - [NÃO GERADO]`);
          allFiles[fileType] = `# ${fileType.replace(/_/g, ' ')}\n\n[INFORMAÇÕES INSUFICIENTES NO DOCUMENTO]\n\nA IA não conseguiu extrair informações suficientes para gerar este tipo de análise.`;
        }
      }

      const totalTime = Math.round((Date.now() - startTime) / 1000);

      console.log(`\n   ═══════════════════════════════════════`);
      console.log(`   ✅ ${filesCreated}/18 ficheiros gerados com sucesso`);
      console.log(`   ⏱️  Tempo total: ${totalTime}s`);
      console.log(`   💰 Custo total: $${totalCost.toFixed(4)}`);
      console.log(`   📊 Método: Split batch (2 lotes)`);
      console.log(`   ═══════════════════════════════════════`);

      return {
        success: true,
        files: allFiles,
        metadata: {
          filesGenerated: filesCreated,
          totalCost,
          totalTime,
          method: 'split-batch',
          model: MODELS[model].name,
          batches: 2
        }
      };

    } catch (error) {
      console.error(`   ❌ Erro na geração split batch:`, error);
      return {
        success: false,
        error: error.message,
        files: {},
        metadata: {
          filesGenerated: 0,
          totalCost,
          totalTime: Math.round((Date.now() - startTime) / 1000)
        }
      };
    }
  }

  /**
   * Cria prompt para split batch com tipos específicos
   */
  createSplitBatchPrompt(fileTypes) {
    const typesJson = fileTypes.map(type => `  "${type}": "# ${type.replace(/_/g, ' ')}\\n\\n..."`).join(',\n');

    return `Você é um assistente jurídico especializado em análise processual completa.

TAREFA: Analisar o processo jurídico fornecido e gerar ${fileTypes.length} TIPOS de documentos estruturados.

IMPORTANTE:
- Extraia informações APENAS do texto fornecido
- Seja preciso com datas, valores e nomes
- Use "[NÃO IDENTIFICADO]" se informação não estiver disponível
- Mantenha estrutura markdown de cada documento
- Seja objetivo mas completo

REGRAS CRÍTICAS DE FORMATAÇÃO (OBRIGATÓRIO):

PROIBIDO - NUNCA use marcadores típicos de IA:
   - Travessões longos (—), asteriscos duplos, barras (//)
   - Marcadores com hífen (-), emojis, símbolos decorativos
   - Checkmarks ou crosses visuais

PROIBIDO - NUNCA invente dados ou use placeholders:
   - Placeholders vazios: [INSERIR DATA], [NOME], [VALOR]
   - Dados fictícios ou estimados
   - Expressões: "A definir", "A preencher", "Pendente"

OBRIGATÓRIO - SEMPRE use formatação jurídica tradicional:
   - Numeração romana (I, II, III) e árabe (1, 2, 3)
   - Alíneas (a, b, c) e incisos (I, II, III)
   - Se informação não disponível: "[NÃO IDENTIFICADO]" ou omita a seção

EXEMPLO CORRETO DE FORMATAÇÃO:
   I. IDENTIFICAÇÃO
      1. Número: 0001234-56.2023.8.09.0051
      2. Autor: João Silva Santos
      3. Data de nascimento: [NÃO IDENTIFICADO]

═══════════════════════════════════════════════════════════════
ESTRUTURA DE RESPOSTA (JSON)
═══════════════════════════════════════════════════════════════

Retorne um JSON com esta estrutura exata:

{
${typesJson}
}

INSTRUÇÕES FINAIS:
1. Retorne APENAS o JSON, sem texto adicional
2. Escape quebras de linha como \\n
3. Use aspas duplas corretamente
4. Mantenha formatação markdown dentro de cada string
5. Se uma seção não tiver informações suficientes, inclua "## [Seção]\\n\\n[INFORMAÇÕES INSUFICIENTES NO DOCUMENTO]"

INÍCIO DO JSON:`;
  }

  /**
   * ETAPA 4 (INDIVIDUAL): Geração de múltiplos ficheiros técnicos (MÉTODO ANTIGO)
   *
   * NOTA: Este método faz chamadas separadas para cada tipo de análise.
   * Use generateTechnicalFilesBatch() para melhor custo-benefício.
   *
   * @param {string} extractedText - Texto completo já limpo
   * @param {string} documentId - ID do documento
   * @param {string} documentName - Nome do documento
   * @param {string} model - Modelo premium a usar
   */
  async generateTechnicalFiles(extractedText, documentId, documentName, model = 'sonnet', progressCallback = null) {
    console.log(`\n📄 [V2 - ETAPA 4] GERAÇÃO DE FICHEIROS TÉCNICOS`);
    console.log(`   Modelo: ${MODELS[model].name}`);

    const files = {};
    const costs = [];
    const startTime = Date.now();

    // Ficheiro 1: FICHAMENTO ESTRUTURADO (20-40%)
    if (progressCallback) {
      await progressCallback('fichamento', 20, 'Gerando FICHAMENTO.md...');
    }
    console.log(`\n   📋 Gerando FICHAMENTO.md...`);
    const fichamentoPrompt = `
Crie um FICHAMENTO ESTRUTURADO completo do documento processual, seguindo o formato:

# FICHAMENTO - ${documentName}

## 1. IDENTIFICAÇÃO
- Número do Processo:
- Classe:
- Órgão Julgador:
- Distribuição:
- Valor da Causa:
- Assunto:

## 2. PARTES
### Polo Ativo:
### Polo Passivo:

## 3. PEDIDOS
[Liste todos os pedidos com numeração]

## 4. CAUSA DE PEDIR
[Fatos e fundamentos]

## 5. FUNDAMENTAÇÃO JURÍDICA
[Dispositivos legais citados]

## 6. JURISPRUDÊNCIA INVOCADA
[Precedentes mencionados]

## 7. DOCUMENTOS ANEXOS
[Lista de documentos juntados]

## 8. MOVIMENTAÇÃO PROCESSUAL
[Principais eventos com datas]

## 9. DECISÕES IMPORTANTES
[Despachos, decisões interlocutórias, sentenças]

## 10. VALOR ECONÔMICO
[Valores envolvidos, custas, honorários]

Seja COMPLETO e DETALHADO.
`;

    const fichamento = await this.analyzeWithPremiumLLM(extractedText, fichamentoPrompt, model, 'Você é um assistente especializado em fichamento de processos judiciais.', 120000);  // 2 min timeout

    if (fichamento.success) {
      files.FICHAMENTO = fichamento.analysis;
      costs.push(fichamento.metadata.cost);
      console.log(`   ✅ FICHAMENTO.md gerado ($${fichamento.metadata.cost.toFixed(4)})`);
    } else {
      files.FICHAMENTO = `# FICHAMENTO - ${documentName}\n\n⚠️ **Erro ao Gerar Fichamento**\n\n${fichamento.error}\n\n**Você pode solicitar o fichamento através do chat interativo.**`;
      console.log(`   ⚠️ FICHAMENTO.md gerado com fallback (erro: ${fichamento.error})`);
    }

    // Ficheiro 2: ANÁLISE JURÍDICA TÉCNICA (40-60%)
    if (progressCallback) {
      await progressCallback('analise', 40, 'Gerando ANALISE_JURIDICA.md...');
    }
    console.log(`\n   ⚖️ Gerando ANALISE_JURIDICA.md...`);
    const analisePrompt = `
Faça uma ANÁLISE JURÍDICA TÉCNICA profunda do documento, incluindo:

# ANÁLISE JURÍDICA - ${documentName}

## 1. RESUMO EXECUTIVO
[Síntese em 3-5 parágrafos]

## 2. ANÁLISE DA CAUSA DE PEDIR
[Análise crítica dos fundamentos fáticos]

## 3. ANÁLISE DOS PEDIDOS
[Viabilidade jurídica de cada pedido]

## 4. FUNDAMENTAÇÃO LEGAL
### Dispositivos Citados:
### Adequação da Fundamentação:
### Legislação Aplicável Não Citada:

## 5. JURISPRUDÊNCIA
### Precedentes Citados:
### Análise dos Precedentes:
### Sugestões de Jurisprudência Adicional:

## 6. PONTOS FORTES
[Liste os pontos fortes da argumentação]

## 7. PONTOS FRACOS / VULNERABILIDADES
[Identifique fragilidades argumentativas]

## 8. ESTRATÉGIA PROCESSUAL
[Avalie a estratégia adotada]

## 9. RISCOS E OPORTUNIDADES
### Riscos:
### Oportunidades:

## 10. RECOMENDAÇÕES
[Sugestões estratégicas]

Seja CRÍTICO, TÉCNICO e FUNDAMENTADO.
`;

    const analise = await this.analyzeWithPremiumLLM(extractedText, analisePrompt, model, 'Você é um advogado sênior especializado em análise crítica de peças processuais.', 120000);  // 2 min timeout

    if (analise.success) {
      files.ANALISE_JURIDICA = analise.analysis;
      costs.push(analise.metadata.cost);
      console.log(`   ✅ ANALISE_JURIDICA.md gerado ($${analise.metadata.cost.toFixed(4)})`);
    } else {
      files.ANALISE_JURIDICA = `# ANÁLISE JURÍDICA - ${documentName}\n\n⚠️ **Erro ao Gerar Análise**\n\n${analise.error}\n\n**Você pode solicitar a análise através do chat interativo.**`;
      console.log(`   ⚠️ ANALISE_JURIDICA.md gerado com fallback (erro: ${analise.error})`);
    }

    // Ficheiro 3: CRONOLOGIA DETALHADA (60-75%)
    if (progressCallback) {
      await progressCallback('cronologia', 60, 'Gerando CRONOLOGIA.md...');
    }
    console.log(`\n   📅 Gerando CRONOLOGIA.md...`);
    const cronologiaPrompt = `
Crie uma LINHA DO TEMPO COMPLETA do processo, extraindo TODAS as datas e eventos:

# CRONOLOGIA - ${documentName}

| Data | Evento | Responsável | Observações |
|------|--------|-------------|-------------|
| DD/MM/AAAA | [Evento] | [Quem] | [Detalhes] |

Após a tabela, forneça:

## ANÁLISE TEMPORAL

### Prazos Cumpridos:
### Prazos Descumpridos:
### Eventos Críticos:
### Períodos de Inércia:
### Duração Total:

Seja EXAUSTIVO - extraia TODAS as datas mencionadas.
`;

    const cronologia = await this.analyzeWithPremiumLLM(extractedText, cronologiaPrompt, model, 'Você é um assistente especializado em análise temporal de processos.', 120000);  // 2 min timeout

    if (cronologia.success) {
      files.CRONOLOGIA = cronologia.analysis;
      costs.push(cronologia.metadata.cost);
      console.log(`   ✅ CRONOLOGIA.md gerado ($${cronologia.metadata.cost.toFixed(4)})`);
    } else {
      // 🔥 FIX: Provide fallback message when cronologia fails/times out
      const fallbackMessage = cronologia.isTimeout
        ? `# CRONOLOGIA - ${documentName}\n\n⚠️ **Erro de Timeout**\n\nA geração automática da cronologia excedeu o tempo limite de 2 minutos.\n\nIsso pode acontecer quando:\n- O documento é muito grande (>50 páginas)\n- O servidor está sobrecarregado\n- A conexão com o LLM está lenta\n\n**Sugestões:**\n1. Tente novamente em alguns minutos\n2. Divida o documento em partes menores\n3. Gere a cronologia manualmente através do chat\n\nTempo decorrido: ${cronologia.elapsedTime}s`
        : `# CRONOLOGIA - ${documentName}\n\n⚠️ **Erro ao Gerar Cronologia**\n\n${cronologia.error}\n\n**Você pode:**\n1. Tentar novamente\n2. Solicitar a cronologia através do chat interativo\n3. Extrair manualmente as datas do documento`;

      files.CRONOLOGIA = fallbackMessage;
      console.log(`   ⚠️ CRONOLOGIA.md gerado com fallback (erro: ${cronologia.error})`);
    }

    // Ficheiro 4: RESUMO EXECUTIVO (75-90%)
    if (progressCallback) {
      await progressCallback('resumo', 75, 'Gerando RESUMO_EXECUTIVO.md...');
    }
    console.log(`\n   📝 Gerando RESUMO_EXECUTIVO.md...`);
    const resumoPrompt = `
Crie um RESUMO EXECUTIVO sintético para leitura rápida por tomadores de decisão:

# RESUMO EXECUTIVO - ${documentName}

## ⚖️ NATUREZA
[1-2 frases sobre o tipo de ação]

## 👥 PARTES
**Autor:** [Nome]
**Réu:** [Nome]

## 💰 VALOR
R$ [valor] ([extenso])

## 📋 PEDIDOS PRINCIPAIS
1. [Pedido 1]
2. [Pedido 2]
3. [Pedido 3]

## 🎯 CAUSA DE PEDIR (Resumo)
[2-3 parágrafos sintéticos]

## ⚖️ FUNDAMENTAÇÃO JURÍDICA
- [Lei X, art. Y]
- [Lei Z, art. W]

## 📊 STATUS ATUAL
[Fase processual e última movimentação]

## ⚠️ PONTOS DE ATENÇÃO
- [Ponto crítico 1]
- [Ponto crítico 2]

## 📈 PROGNÓSTICO
[Avaliação sintética de chances de êxito]

---
**Gerado em:** [Data]
**Analista:** ROM Agent (IA)

Máximo 2 páginas. Seja SINTÉTICO e OBJETIVO.
`;

    const resumo = await this.analyzeWithPremiumLLM(extractedText, resumoPrompt, model, 'Você é um analista que cria resumos executivos para advogados sêniores.', 120000);  // 2 min timeout

    if (resumo.success) {
      files.RESUMO_EXECUTIVO = resumo.analysis;
      costs.push(resumo.metadata.cost);
      console.log(`   ✅ RESUMO_EXECUTIVO.md gerado ($${resumo.metadata.cost.toFixed(4)})`);
    } else {
      files.RESUMO_EXECUTIVO = `# RESUMO EXECUTIVO - ${documentName}\n\n⚠️ **Erro ao Gerar Resumo**\n\n${resumo.error}\n\n**Você pode solicitar o resumo através do chat interativo.**`;
      console.log(`   ⚠️ RESUMO_EXECUTIVO.md gerado com fallback (erro: ${resumo.error})`);
    }

    const totalTime = Math.round((Date.now() - startTime) / 1000);
    const totalCost = costs.reduce((sum, c) => sum + c, 0);

    console.log(`\n   ═══════════════════════════════════════`);
    console.log(`   ✅ ${Object.keys(files).length} ficheiros gerados`);
    console.log(`   ⏱️ Tempo total: ${totalTime}s`);
    console.log(`   💰 Custo total: $${totalCost.toFixed(4)}`);
    console.log(`   ═══════════════════════════════════════`);

    return {
      success: true,
      files,
      metadata: {
        filesGenerated: Object.keys(files).length,
        totalCost,
        totalTime
      }
    };
  }

  /**
   * MÉTODO PRINCIPAL: Processa documento completo (todas as 4 etapas)
   *
   * @param {string} rawText - Texto bruto do PDF
   * @param {string} documentId - ID do documento
   * @param {string} documentName - Nome do documento
   * @param {Object} options - Opções de processamento
   */
  async processComplete(rawText, documentId, documentName, options = {}) {
    // Helper para logar memória
    const logMemory = (stage) => {
      const used = process.memoryUsage();
      console.log(`   💾 [${stage}] Memória: RSS=${Math.round(used.rss/1024/1024)}MB, Heap=${Math.round(used.heapUsed/1024/1024)}MB/${Math.round(used.heapTotal/1024/1024)}MB`);
    };

    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║  📄 DOCUMENT PROCESSOR V2 - ARQUITETURA MELHORADA           ║`);
    console.log(`╚══════════════════════════════════════════════════════════════╝`);
    console.log(`\n📄 Documento: ${documentName}`);
    console.log(`📊 Tamanho: ${Math.round(rawText.length / 1000)}k caracteres (~${this.estimateTokens(rawText).toLocaleString()} tokens)`);
    logMemory('INÍCIO');

    const {
      extractionModel = 'nova-micro',
      analysisModel = 'sonnet',
      generateFiles = true,
      saveToKB = true,
      userId = null,  // ✅ FIX: Extract userId from options
      progressCallback = null
    } = options;

    const totalStartTime = Date.now();
    const costs = [];

    try {
      // ETAPA 1: Extração (0-15%)
      if (progressCallback) {
        await progressCallback('extraction', 0, 'Extraindo texto com Nova Micro...');
      }

      console.log(`\n🔍 [ETAPA 1] Iniciando extração de texto...`);
      logMemory('PRÉ-EXTRAÇÃO');

      const extraction = await this.extractFullText(rawText, documentId, documentName);
      costs.push(extraction.metadata.cost);

      logMemory('PÓS-EXTRAÇÃO');
      console.log(`   ✅ Extração completa: ${Math.round(extraction.extractedText.length/1000)}k chars`);

      // ETAPA 2: Salvamento no KB (15-20%)
      if (progressCallback) {
        await progressCallback('saving', 15, 'Salvando texto extraído no KB...');
      }

      console.log(`\n💾 [ETAPA 2] Salvando texto extraído no KB...`);
      logMemory('PRÉ-SALVAMENTO');

      let intermediateDoc = null;
      if (saveToKB) {
        intermediateDoc = await this.saveExtractedTextToKB(
          extraction.extractedText,
          documentId,
          documentName,
          true,  // saveToDocuments
          userId  // 🔥 FIX CRÍTICO: Passar userId para que arquivos apareçam no filtro
        );
        console.log(`   ✅ Texto salvo no KB: ${intermediateDoc.id} (userId: ${userId || 'web-upload'})`);
      }

      logMemory('PÓS-SALVAMENTO');

      // ETAPA 2.5: Persistência completa de extração (20-25%)
      let completeExtractionResult = null;
      if (saveToKB) {
        if (progressCallback) {
          await progressCallback('persistence', 20, 'Salvando extração completa (texto + imagens + áudio)...');
        }

        console.log(`\n💾 [ETAPA 2.5] Persistência completa de extração...`);
        logMemory('PRÉ-PERSISTÊNCIA');

        try {
          // 🌍 EXTRAÇÃO UNIVERSAL: Suporta QUALQUER tipo de arquivo
          // - Se options.filePath fornecido → usa extrator universal
          // - Se apenas options.pdfPath → mantém compatibilidade com PDF
          if (options.filePath) {
            console.log(`   🌍 Usando EXTRATOR UNIVERSAL para arquivo: ${options.filePath}`);

            completeExtractionResult = await extractionPersistenceManager.extractAnyFileUniversal(
              options.filePath,
              documentId,
              documentName,
              {
                analyzeFrames: options.analyzeFrames !== false, // Analisar frames de vídeo por padrão
                fps: options.fps || 1 // 1 frame por segundo
              }
            );
          } else if (options.pdfPath) {
            // Compatibilidade retroativa com PDF
            console.log(`   📄 Usando extrator de PDF para: ${options.pdfPath}`);

            completeExtractionResult = await extractionPersistenceManager.persistCompleteExtraction(
              documentId,
              documentName,
              extraction.extractedText,
              {
                pdfPath: options.pdfPath,
                audioFiles: options.audioFiles || [],
                cost: extraction.metadata.cost,
                processingTime: extraction.metadata.processingTime,
                method: extraction.metadata.model
              }
            );
          } else {
            // Apenas texto, sem arquivo físico
            console.log(`   📝 Salvando apenas texto extraído`);

            completeExtractionResult = await extractionPersistenceManager.persistCompleteExtraction(
              documentId,
              documentName,
              extraction.extractedText,
              {
                cost: extraction.metadata.cost,
                processingTime: extraction.metadata.processingTime,
                method: extraction.metadata.model
              }
            );
          }

          console.log(`   ✅ Persistência completa concluída`);
          console.log(`   📂 Estrutura: extractions/${documentId}/`);
          console.log(`   📊 Texto: ${Math.round(completeExtractionResult.extractionData.textSize / 1000)}KB`);
          console.log(`   🖼️  Imagens: ${completeExtractionResult.extractionData.imagesCount}`);
          console.log(`   🎤 Áudio: ${completeExtractionResult.extractionData.audioCount || 0}`);
        } catch (persistenceError) {
          console.error(`   ⚠️  Erro na persistência completa (não-crítico):`, persistenceError.message);
          // Não falhar o processo inteiro se persistência falhar
        }

        logMemory('PÓS-PERSISTÊNCIA');
      }

      // ETAPA 3-6: Geração de ficheiros técnicos (25-90%)
      let technicalFiles = null;
      let savedFilesResult = null;
      if (generateFiles) {
        console.log(`\n📝 [ETAPA 3-6] Gerando ficheiros técnicos com IA...`);
        console.log(`   📊 generateFiles: ${generateFiles}`);
        console.log(`   📊 analysisModel: ${analysisModel}`);
        console.log(`   📊 extractedText length: ${extraction.extractedText.length}`);
        logMemory('PRÉ-GERAÇÃO-FICHEIROS');

        if (progressCallback) {
          await progressCallback('fichamento', 20, 'Gerando FICHAMENTO.md...');
        }

        try {
          console.log(`   🔄 Chamando generateTechnicalFilesBatch...`);
          const batchStartTime = Date.now();

          // Usar método BATCH otimizado (20 análises em 1 chamada)
          technicalFiles = await this.generateTechnicalFilesBatch(
            extraction.extractedText,
            documentId,
            documentName,
            analysisModel,
            progressCallback
          );

          const batchElapsed = Math.round((Date.now() - batchStartTime) / 1000);
          console.log(`   ✅ generateTechnicalFilesBatch retornou após ${batchElapsed}s`);
          console.log(`   📊 technicalFiles.success: ${technicalFiles?.success}`);
          console.log(`   📊 technicalFiles.metadata.filesGenerated: ${technicalFiles?.metadata?.filesGenerated}`);
          console.log(`   📊 Object.keys(technicalFiles.files): ${technicalFiles?.files ? Object.keys(technicalFiles.files).length : 0}`);

          if (technicalFiles && technicalFiles.metadata && technicalFiles.metadata.totalCost) {
            costs.push(technicalFiles.metadata.totalCost);
            console.log(`   💰 Custo da análise batch: $${technicalFiles.metadata.totalCost.toFixed(4)}`);
          } else {
            console.log(`   ⚠️  AVISO: technicalFiles sem metadata.totalCost`);
          }

          // ETAPA 7: Salvar ficheiros técnicos no KB (90-100%)
          if (progressCallback) {
            await progressCallback('saving_files', 90, 'Salvando ficheiros estruturados no KB...');
          }

          console.log(`   🔄 Verificando condições para salvar ficheiros...`);
          console.log(`      saveToKB: ${saveToKB}`);
          console.log(`      technicalFiles.success: ${technicalFiles?.success}`);
          console.log(`      technicalFiles.files existe: ${!!technicalFiles?.files}`);

          if (saveToKB && technicalFiles.success && technicalFiles.files) {
            console.log(`   🔄 Salvando ${Object.keys(technicalFiles.files).length} ficheiros no KB...`);
            const saveStartTime = Date.now();

            savedFilesResult = await this.saveTechnicalFilesToKB(
              technicalFiles.files,
              documentId,
              documentName,
              intermediateDoc?.id || documentId,
              userId  // ✅ FIX: Pass userId to saveTechnicalFilesToKB
            );

            const saveElapsed = Math.round((Date.now() - saveStartTime) / 1000);
            console.log(`   ✅ saveTechnicalFilesToKB concluído em ${saveElapsed}s`);
            console.log(`   📊 Arquivos salvos: ${savedFilesResult?.count || 0}`);
          } else {
            console.log(`   ⚠️  PULANDO salvamento de ficheiros técnicos`);
            if (!saveToKB) console.log(`      Razão: saveToKB = false`);
            if (!technicalFiles?.success) console.log(`      Razão: technicalFiles.success = ${technicalFiles?.success}`);
            if (!technicalFiles?.files) console.log(`      Razão: technicalFiles.files não existe`);
          }

        } catch (batchError) {
          console.error(`   ❌ ERRO CRÍTICO em ETAPA 3-6:`, batchError);
          console.error(`   📊 Stack trace:`, batchError.stack);
          console.error(`   📊 Error name: ${batchError.name}`);
          console.error(`   📊 Error message: ${batchError.message}`);

          // Não falhar todo o processo, apenas logar o erro
          technicalFiles = {
            success: false,
            error: batchError.message,
            files: {},
            metadata: {
              filesGenerated: 0,
              totalCost: 0,
              totalTime: 0
            }
          };
        }
      } else {
        console.log(`   ⚠️  PULANDO ETAPA 3-6: generateFiles = ${generateFiles}`);
      }

      const totalTime = Math.round((Date.now() - totalStartTime) / 1000);
      const totalCost = costs.reduce((sum, c) => sum + c, 0);

      console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
      console.log(`║  ✅ PROCESSAMENTO COMPLETO CONCLUÍDO                         ║`);
      console.log(`╚══════════════════════════════════════════════════════════════╝`);
      console.log(`\n⏱️  Tempo total: ${totalTime}s`);
      console.log(`💰 Custo total: $${totalCost.toFixed(4)}`);
      console.log(`\n📦 Resultados:`);
      console.log(`   1. Texto completo extraído e salvo no KB`);
      if (completeExtractionResult) {
        console.log(`   2. Extração completa persistida (texto + imagens + áudio)`);
        console.log(`      📂 extractions/${documentId}/`);
      }
      if (technicalFiles) {
        console.log(`   3. ${technicalFiles.metadata.filesGenerated} ficheiros técnicos gerados`);
        console.log(`      technicalFiles.success: ${technicalFiles.success}`);
        if (!technicalFiles.success) console.log(`      technicalFiles.error: ${technicalFiles.error}`);
      } else {
        console.log(`   3. ⚠️  technicalFiles é NULL`);
      }
      if (savedFilesResult && savedFilesResult.success) {
        console.log(`   4. ${savedFilesResult.count} ficheiros salvos no KB (disponíveis para chat)`);
      } else {
        console.log(`   4. ⚠️  Nenhum ficheiro salvo no KB`);
        if (savedFilesResult) console.log(`      savedFilesResult.success: ${savedFilesResult.success}`);
      }
      console.log(`\n💡 Vantagens:`);
      console.log(`   ✅ Texto extraído reutilizável (cache)`);
      console.log(`   ✅ Extração completa persistida com imagens e áudio`);
      console.log(`   ✅ Economia vs abordagem 100% Claude: ~50%`);
      console.log(`   ✅ Ficheiros profissionais prontos para uso`);
      console.log(`   ✅ KB Loader carrega automaticamente no chat`);

      console.log(`\n🔍 DEBUG - Valores finais de retorno:`);
      console.log(`   extraction.metadata: ${extraction?.metadata ? 'OK' : 'NULL'}`);
      console.log(`   intermediateDoc: ${intermediateDoc ? intermediateDoc.id : 'NULL'}`);
      console.log(`   technicalFiles?.files: ${technicalFiles?.files ? Object.keys(technicalFiles.files).length + ' fichamentos' : 'NULL'}`);
      console.log(`   savedFilesResult?.savedFiles: ${savedFilesResult?.savedFiles ? savedFilesResult.savedFiles.length + ' arquivos' : 'NULL'}`);
      console.log(`   filesGenerated: ${technicalFiles?.metadata.filesGenerated || 0}`);
      console.log(`   filesSavedToKB: ${savedFilesResult?.count || 0}`);

      const result = {
        success: true,
        extraction: extraction.metadata,
        intermediateDoc,
        completeExtraction: completeExtractionResult || null,
        technicalFiles: technicalFiles?.files || null,
        savedFiles: savedFilesResult?.savedFiles || [],
        metadata: {
          totalTime,
          totalCost,
          extractionCost: extraction.metadata.cost,
          analysisCost: technicalFiles?.metadata.totalCost || 0,
          filesGenerated: technicalFiles?.metadata.filesGenerated || 0,
          filesSavedToKB: savedFilesResult?.count || 0,
          completeExtractionPaths: completeExtractionResult?.paths || null
        }
      };

      console.log(`✅ Retornando objeto processComplete com success=true\n`);
      return result;

    } catch (error) {
      console.error(`\n╔══════════════════════════════════════════════════════════════╗`);
      console.error(`║  ❌ ERRO NO PROCESSAMENTO V2                                 ║`);
      console.error(`╚══════════════════════════════════════════════════════════════╝`);
      console.error(`   Error name: ${error.name}`);
      console.error(`   Error message: ${error.message}`);
      console.error(`   Stack trace:`, error.stack);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Singleton
export const documentProcessorV2 = new DocumentProcessorV2();
