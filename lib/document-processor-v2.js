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
    id: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    name: 'Claude 3.5 Sonnet',
    maxTokens: 8000,  // REAL LIMIT: 8,192 output tokens
    costPer1M: { input: 3.0, output: 15.0 },
    purpose: 'analysis',
    speed: 'medium'
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

    const extractedParts = [];
    const chunkMetadata = [];
    let totalCost = 0;
    let totalTime = 0;

    // Processar cada chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`\n   🔄 [Chunk ${i+1}/${chunks.length}] Processando...`);
      console.log(`      Tamanho: ${Math.round(chunk.size / 1000)}k chars (${chunk.estimatedTokens.toLocaleString()} tokens)`);
      console.log(`      Posição: ${chunk.startPosition} - ${chunk.endPosition}`);

      try {
        const startTime = Date.now();

        // Extrair chunk (sem verificar cache, pois é parte de documento maior)
        const result = await this.extractSingleChunk(
          chunk.text,
          `${documentId}_chunk${i}`,
          `${documentName} - Parte ${i+1}/${chunks.length}`
        );

        const elapsedTime = Math.round((Date.now() - startTime) / 1000);

        console.log(`      ✅ Chunk extraído em ${elapsedTime}s`);
        console.log(`      📊 Output: ${result.extractedText.length.toLocaleString()} chars`);
        console.log(`      💰 Custo: $${result.metadata.cost.toFixed(4)}`);

        extractedParts.push(result.extractedText);
        totalCost += result.metadata.cost;
        totalTime += elapsedTime;

        chunkMetadata.push({
          chunkNumber: i,
          inputSize: chunk.size,
          outputSize: result.extractedText.length,
          cost: result.metadata.cost,
          time: elapsedTime,
          model: result.metadata.modelUsed
        });

        // Update progress tracking
        if (jobId) {
          await extractionProgressService.updateChunkProgress(jobId, i, {
            inputSize: chunk.size,
            outputSize: result.extractedText.length,
            cost: result.metadata.cost,
            time: elapsedTime,
            model: result.metadata.modelUsed
          });
        }

      } catch (error) {
        console.error(`      ❌ Erro no chunk ${i+1}:`, error.message);

        // Fail job on error
        if (jobId) {
          await extractionProgressService.failJob(jobId, `Erro no chunk ${i+1}: ${error.message}`);
        }

        // Adiciona marcador de erro no texto extraído
        extractedParts.push(`\n\n[ERRO NA EXTRAÇÃO DO CHUNK ${i+1}: ${error.message}]\n\n`);

        chunkMetadata.push({
          chunkNumber: i,
          error: error.message,
          cost: 0,
          time: 0
        });
      }
    }

    // Concatenar todas as partes
    const fullExtractedText = extractedParts.join('\n\n═══════════════════════════════════════\n[FIM DA PARTE - CONTINUAÇÃO ABAIXO]\n═══════════════════════════════════════\n\n');

    console.log(`\n   ✅ CHUNKING CONCLUÍDO`);
    console.log(`   📊 Total extraído: ${Math.round(fullExtractedText.length / 1000)}k caracteres`);
    console.log(`   💰 Custo total: $${totalCost.toFixed(4)}`);
    console.log(`   ⏱️  Tempo total: ${totalTime}s (${Math.round(totalTime / 60)} minutos)`);

    // Mark extraction phase as complete if jobId provided
    if (jobId) {
      console.log(`   ✅ Job ${jobId} extraction phase complete`);
    }

    return {
      extractedText: fullExtractedText,
      metadata: {
        method: 'chunking',
        originalSize: rawText.length,
        extractedSize: fullExtractedText.length,
        chunks: chunks.length,
        chunkDetails: chunkMetadata,
        totalCost,
        totalTime,
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
   */
  async saveExtractedTextToKB(extractedText, documentId, documentName) {
    console.log(`\n💾 [V2 - ETAPA 2] SALVAMENTO NO KB`);

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
      metadata: {
        isExtractedText: true,
        parentDocument: documentId,
        extractionSource: 'nova-micro',
        purpose: 'intermediate-full-text'
      }
    };

    // Salva arquivo
    const textPath = path.join(this.extractedTextCachePath, `${intermediateDoc.id}.md`);
    fs.writeFileSync(textPath, extractedText, 'utf-8');
    intermediateDoc.path = textPath;

    // Adiciona ao KB
    allDocs.push(intermediateDoc);
    fs.writeFileSync(kbPath, JSON.stringify(allDocs, null, 2));

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

    // Mapear nomes de ficheiros para ordem/tipo
    const fileMapping = {
      'FICHAMENTO': { order: 1, prefix: '01_FICHAMENTO', extension: '.md', type: 'FICHAMENTO' },
      'ANALISE_JURIDICA': { order: 2, prefix: '02_ANALISE_JURIDICA', extension: '.md', type: 'ANALISE_JURIDICA' },
      'CRONOLOGIA': { order: 3, prefix: '03_CRONOLOGIA', extension: '.md', type: 'CRONOLOGIA' },
      'RESUMO_EXECUTIVO': { order: 4, prefix: '04_RESUMO_EXECUTIVO', extension: '.md', type: 'RESUMO_EXECUTIVO' }
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
        type: 'text/markdown',
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
          analysisModel: 'claude-sonnet'
        }
      };

      // Salva metadata separado
      const metadataPath = path.join(kbDocsDir, `${fileId}.metadata.json`);
      fs.writeFileSync(metadataPath, JSON.stringify(fileDoc, null, 2));

      // Adiciona ao KB
      allDocs.push(fileDoc);
      savedFiles.push({
        name: fileDoc.name,
        path: filePath,
        type: fileInfo.type,
        size: fileContent.length
      });

      console.log(`   ✅ ${fileInfo.prefix}${fileInfo.extension} salvo (${Math.round(fileContent.length / 1000)}k chars)`);
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
   * ETAPA 3: Análise profunda com LLM Premium
   *
   * @param {string} extractedText - Texto completo já limpo
   * @param {string} analysisPrompt - Prompt de análise do usuário
   * @param {string} model - Modelo premium a usar (haiku, sonnet, opus)
   * @param {string} systemPrompt - System prompt customizado
   */
  async analyzeWithPremiumLLM(extractedText, analysisPrompt, model = 'sonnet', systemPrompt = '') {
    console.log(`\n🧠 [V2 - ETAPA 3] ANÁLISE COM LLM PREMIUM`);
    console.log(`   Modelo: ${MODELS[model].name}`);
    console.log(`   Texto: ${Math.round(extractedText.length / 1000)}k caracteres (~${this.estimateTokens(extractedText).toLocaleString()} tokens)`);

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
      const response = await conversar(fullPrompt, {
        modelo: MODELS[model].id,
        systemPrompt: systemPrompt || 'Você é um assistente jurídico especializado em análise profunda de documentos processuais brasileiros.',
        temperature: 0.3,
        maxTokens: MODELS[model].maxTokens,  // Use model-specific output limit
        enableTools: false,
        enableCache: false
      });

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
      console.error(`   ❌ Erro na análise:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * ETAPA 4: Geração de múltiplos ficheiros técnicos
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

    const fichamento = await this.analyzeWithPremiumLLM(extractedText, fichamentoPrompt, model, 'Você é um assistente especializado em fichamento de processos judiciais.');

    if (fichamento.success) {
      files.FICHAMENTO = fichamento.analysis;
      costs.push(fichamento.metadata.cost);
      console.log(`   ✅ FICHAMENTO.md gerado ($${fichamento.metadata.cost.toFixed(4)})`);
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

    const analise = await this.analyzeWithPremiumLLM(extractedText, analisePrompt, model, 'Você é um advogado sênior especializado em análise crítica de peças processuais.');

    if (analise.success) {
      files.ANALISE_JURIDICA = analise.analysis;
      costs.push(analise.metadata.cost);
      console.log(`   ✅ ANALISE_JURIDICA.md gerado ($${analise.metadata.cost.toFixed(4)})`);
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

    const cronologia = await this.analyzeWithPremiumLLM(extractedText, cronologiaPrompt, model, 'Você é um assistente especializado em análise temporal de processos.');

    if (cronologia.success) {
      files.CRONOLOGIA = cronologia.analysis;
      costs.push(cronologia.metadata.cost);
      console.log(`   ✅ CRONOLOGIA.md gerado ($${cronologia.metadata.cost.toFixed(4)})`);
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

    const resumo = await this.analyzeWithPremiumLLM(extractedText, resumoPrompt, model, 'Você é um analista que cria resumos executivos para advogados sêniores.');

    if (resumo.success) {
      files.RESUMO_EXECUTIVO = resumo.analysis;
      costs.push(resumo.metadata.cost);
      console.log(`   ✅ RESUMO_EXECUTIVO.md gerado ($${resumo.metadata.cost.toFixed(4)})`);
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
          documentName
        );
        console.log(`   ✅ Texto salvo no KB: ${intermediateDoc.id}`);
      }

      logMemory('PÓS-SALVAMENTO');

      // ETAPA 3-6: Geração de ficheiros técnicos (20-90%)
      let technicalFiles = null;
      let savedFilesResult = null;
      if (generateFiles) {
        console.log(`\n📝 [ETAPA 3-6] Gerando ficheiros técnicos com IA...`);
        logMemory('PRÉ-GERAÇÃO-FICHEIROS');

        if (progressCallback) {
          await progressCallback('fichamento', 20, 'Gerando FICHAMENTO.md...');
        }

        technicalFiles = await this.generateTechnicalFiles(
          extraction.extractedText,
          documentId,
          documentName,
          analysisModel,
          progressCallback
        );
        costs.push(technicalFiles.metadata.totalCost);

        // ETAPA 7: Salvar ficheiros técnicos no KB (90-100%)
        if (progressCallback) {
          await progressCallback('saving_files', 90, 'Salvando ficheiros estruturados no KB...');
        }

        if (saveToKB && technicalFiles.success && technicalFiles.files) {
          savedFilesResult = await this.saveTechnicalFilesToKB(
            technicalFiles.files,
            documentId,
            documentName,
            intermediateDoc?.id || documentId,
            userId  // ✅ FIX: Pass userId to saveTechnicalFilesToKB
          );
        }
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
      if (technicalFiles) {
        console.log(`   2. ${technicalFiles.metadata.filesGenerated} ficheiros técnicos gerados`);
      }
      if (savedFilesResult && savedFilesResult.success) {
        console.log(`   3. ${savedFilesResult.count} ficheiros salvos no KB (disponíveis para chat)`);
      }
      console.log(`\n💡 Vantagens:`);
      console.log(`   ✅ Texto extraído reutilizável (cache)`);
      console.log(`   ✅ Economia vs abordagem 100% Claude: ~50%`);
      console.log(`   ✅ Ficheiros profissionais prontos para uso`);
      console.log(`   ✅ KB Loader carrega automaticamente no chat`);

      return {
        success: true,
        extraction: extraction.metadata,
        intermediateDoc,
        technicalFiles: technicalFiles?.files || null,
        savedFiles: savedFilesResult?.savedFiles || [],
        metadata: {
          totalTime,
          totalCost,
          extractionCost: extraction.metadata.cost,
          analysisCost: technicalFiles?.metadata.totalCost || 0,
          filesGenerated: technicalFiles?.metadata.filesGenerated || 0,
          filesSavedToKB: savedFilesResult?.count || 0
        }
      };

    } catch (error) {
      console.error(`\n❌ Erro no processamento V2:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Singleton
export const documentProcessorV2 = new DocumentProcessorV2();
