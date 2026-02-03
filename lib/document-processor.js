/**
 * Document Processor - Arquitetura Híbrida
 *
 * Processa documentos grandes usando 3 modos:
 * 1. DIRETO: Documentos < 150k tokens - LLM premium lê tudo de uma vez
 * 2. MULTI-PASS: Documentos > 150k tokens - LLM premium lê em chunks + LLM barata consolida
 * 3. RESUMO: Apenas LLM barata resume + LLM premium analisa resumo (econômico)
 */

import fs from 'fs';
import { invokeModel } from '../src/modules/bedrock.js';
import { documentSummarizer } from './document-summarizer.js';

// Modelos disponíveis
const MODELS = {
  haiku: {
    id: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    name: 'Claude 3.5 Haiku',
    maxTokens: 200000,
    costPer1M: { input: 1.0, output: 5.0 },
    speed: 'fast'
  },
  sonnet: {
    id: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    name: 'Claude 3.5 Sonnet',
    maxTokens: 200000,
    costPer1M: { input: 3.0, output: 15.0 },
    speed: 'medium'
  },
  opus: {
    id: 'us.anthropic.claude-opus-4-20250514-v1:0',
    name: 'Claude Opus 4',
    maxTokens: 200000,
    costPer1M: { input: 15.0, output: 75.0 },
    speed: 'slow'
  }
};

export class DocumentProcessor {
  constructor() {
    this.chunkSize = 150000; // 150k tokens (~600k caracteres)
  }

  /**
   * Estimar tokens de um texto
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Dividir documento em chunks de 150k tokens
   */
  splitIntoChunks(text) {
    const charLimit = this.chunkSize * 4; // ~600k caracteres
    const chunks = [];

    let currentPos = 0;

    while (currentPos < text.length) {
      // Tentar encontrar quebra natural (parágrafo, seção)
      let endPos = Math.min(currentPos + charLimit, text.length);

      if (endPos < text.length) {
        // Procurar última quebra de parágrafo nos últimos 10k caracteres
        const searchStart = Math.max(endPos - 10000, currentPos);
        const lastParagraph = text.lastIndexOf('\n\n', endPos);

        if (lastParagraph > searchStart) {
          endPos = lastParagraph;
        }
      }

      const chunk = text.substring(currentPos, endPos);
      chunks.push({
        index: chunks.length + 1,
        text: chunk,
        startChar: currentPos,
        endChar: endPos,
        tokens: this.estimateTokens(chunk)
      });

      currentPos = endPos;
    }

    return chunks;
  }

  /**
   * MODO 1: Leitura Direta (documentos pequenos)
   */
  async processDirectRead(text, userPrompt, model = 'sonnet', systemPrompt = '') {
    console.log(`\n🎯 [DocumentProcessor] MODO 1: LEITURA DIRETA`);
    console.log(`   Modelo: ${MODELS[model].name}`);
    console.log(`   Tamanho: ${Math.round(text.length / 1000)}k caracteres (~${this.estimateTokens(text).toLocaleString()} tokens)`);

    const startTime = Date.now();

    try {
      const messages = [{
        role: 'user',
        content: `${userPrompt}\n\n═══════════════════════════════════════════════════════════════════════\nDOCUMENTO COMPLETO:\n═══════════════════════════════════════════════════════════════════════\n\n${text}`
      }];

      const response = await invokeModel({
        modelId: MODELS[model].id,
        messages,
        system: systemPrompt,
        temperature: 0.3,
        maxTokens: 16000
      });

      const elapsedTime = Math.round((Date.now() - startTime) / 1000);
      const inputTokens = this.estimateTokens(text + userPrompt);
      const outputTokens = this.estimateTokens(response.content[0].text);
      const cost = (inputTokens / 1_000_000) * MODELS[model].costPer1M.input +
                   (outputTokens / 1_000_000) * MODELS[model].costPer1M.output;

      console.log(`   ✅ Análise concluída em ${elapsedTime}s`);
      console.log(`   💰 Custo: $${cost.toFixed(4)} (${inputTokens.toLocaleString()} input + ${outputTokens.toLocaleString()} output)`);

      return {
        success: true,
        mode: 'direct',
        model: model,
        response: response.content[0].text,
        metadata: {
          processingTime: elapsedTime,
          inputTokens,
          outputTokens,
          cost,
          chunks: 1
        }
      };

    } catch (error) {
      console.error(`   ❌ Erro na leitura direta:`, error);
      return {
        success: false,
        mode: 'direct',
        error: error.message
      };
    }
  }

  /**
   * MODO 2: Multi-Pass + Consolidação (documentos grandes)
   */
  async processMultiPass(text, userPrompt, model = 'sonnet', systemPrompt = '') {
    console.log(`\n🎯 [DocumentProcessor] MODO 2: MULTI-PASS + CONSOLIDAÇÃO`);
    console.log(`   Modelo: ${MODELS[model].name}`);
    console.log(`   Tamanho: ${Math.round(text.length / 1000)}k caracteres (~${this.estimateTokens(text).toLocaleString()} tokens)`);

    const startTime = Date.now();

    // Dividir em chunks
    const chunks = this.splitIntoChunks(text);
    console.log(`   📦 Dividido em ${chunks.length} chunks de ~150k tokens cada`);

    // Thread A: Processar chunks sequencialmente com LLM premium
    const chunkAnalyses = [];
    let accumulatedContext = '';

    console.log(`\n   ⚙️ Thread A: Processando ${chunks.length} chunks com ${MODELS[model].name}...`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`   📄 Chunk ${chunk.index}/${chunks.length} (${chunk.tokens.toLocaleString()} tokens)...`);

      const chunkPrompt = `
Você está analisando um documento grande em partes (CHUNK ${chunk.index} de ${chunks.length}).

${accumulatedContext ? `CONTEXTO ACUMULADO DOS CHUNKS ANTERIORES:\n${accumulatedContext}\n\n` : ''}

TAREFA:
Analise este chunk do documento e extraia:
1. Fatos relevantes (com referência a páginas/folhas se houver)
2. Argumentos jurídicos
3. Pedidos ou decisões
4. Entidades importantes (pessoas, empresas, valores)
5. Legislação citada
6. Qualquer informação crítica

CHUNK ${chunk.index}:
═══════════════════════════════════════════════════════════════════════
${chunk.text}
═══════════════════════════════════════════════════════════════════════

Forneça uma análise estruturada deste chunk:
`;

      try {
        const response = await invokeModel({
          modelId: MODELS[model].id,
          messages: [{ role: 'user', content: chunkPrompt }],
          system: systemPrompt,
          temperature: 0.3,
          maxTokens: 8000
        });

        const analysis = response.content[0].text;
        chunkAnalyses.push({
          chunkIndex: chunk.index,
          analysis: analysis,
          tokens: this.estimateTokens(analysis)
        });

        // Atualizar contexto acumulado (resumo das análises anteriores)
        accumulatedContext += `\n[CHUNK ${chunk.index}] ${analysis.substring(0, 2000)}...\n`;

        console.log(`   ✅ Chunk ${chunk.index} analisado (${this.estimateTokens(analysis).toLocaleString()} tokens)`);

      } catch (error) {
        console.error(`   ❌ Erro no chunk ${chunk.index}:`, error);
        chunkAnalyses.push({
          chunkIndex: chunk.index,
          error: error.message
        });
      }
    }

    // Thread B (PARALELO): Gerar resumo estruturado com LLM barata
    console.log(`\n   ⚙️ Thread B (PARALELO): Gerando resumo estruturado com Nova Micro...`);

    let summaryResult = null;
    const summaryPromise = documentSummarizer.summarize(text, { model: 'us.amazon.nova-micro-v1:0' });

    try {
      summaryResult = await summaryPromise;
      console.log(`   ✅ Resumo estruturado gerado (${summaryResult.metadata.outputTokens.toLocaleString()} tokens, $${summaryResult.metadata.totalCost.toFixed(4)})`);
    } catch (error) {
      console.warn(`   ⚠️ Resumo estruturado falhou:`, error);
    }

    // Consolidação final com LLM premium
    console.log(`\n   🔄 Consolidando análises com ${MODELS[model].name}...`);

    const consolidationPrompt = `
Você analisou um documento grande em ${chunks.length} partes. Agora consolide todas as análises em uma resposta final unificada.

PROMPT DO USUÁRIO:
${userPrompt}

ANÁLISES PARCIAIS DOS CHUNKS:
${chunkAnalyses.map(ca => ca.error ? `[CHUNK ${ca.chunkIndex}] ERRO: ${ca.error}` : `[CHUNK ${ca.chunkIndex}]\n${ca.analysis}`).join('\n\n')}

${summaryResult?.success ? `\nRESUMO ESTRUTURADO COMPLETO (para referência):\n${summaryResult.summary}\n` : ''}

TAREFA:
Com base nas análises parciais${summaryResult?.success ? ' e no resumo estruturado' : ''}, forneça uma resposta UNIFICADA e COMPLETA ao usuário.
Organize a informação de forma coerente, eliminando redundâncias mas mantendo todos os detalhes importantes.
`;

    try {
      const consolidationResponse = await invokeModel({
        modelId: MODELS[model].id,
        messages: [{ role: 'user', content: consolidationPrompt }],
        system: systemPrompt,
        temperature: 0.3,
        maxTokens: 16000
      });

      const finalResponse = consolidationResponse.content[0].text;
      const elapsedTime = Math.round((Date.now() - startTime) / 1000);

      // Calcular custos totais
      const chunkTokensInput = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
      const chunkTokensOutput = chunkAnalyses.reduce((sum, ca) => sum + (ca.tokens || 0), 0);
      const consolidationTokensInput = this.estimateTokens(consolidationPrompt);
      const consolidationTokensOutput = this.estimateTokens(finalResponse);
      const summaryTokensInput = summaryResult?.metadata?.inputTokens || 0;
      const summaryTokensOutput = summaryResult?.metadata?.outputTokens || 0;

      const totalInputTokens = chunkTokensInput + consolidationTokensInput;
      const totalOutputTokens = chunkTokensOutput + consolidationTokensOutput;

      const chunkCost = (chunkTokensInput / 1_000_000) * MODELS[model].costPer1M.input +
                        (chunkTokensOutput / 1_000_000) * MODELS[model].costPer1M.output;
      const consolidationCost = (consolidationTokensInput / 1_000_000) * MODELS[model].costPer1M.input +
                                (consolidationTokensOutput / 1_000_000) * MODELS[model].costPer1M.output;
      const summaryCost = summaryResult?.metadata?.totalCost || 0;
      const totalCost = chunkCost + consolidationCost + summaryCost;

      console.log(`\n   ✅ Consolidação concluída em ${elapsedTime}s`);
      console.log(`   💰 Custo Total: $${totalCost.toFixed(4)}`);
      console.log(`      - Chunks (${MODELS[model].name}): $${chunkCost.toFixed(4)}`);
      console.log(`      - Consolidação (${MODELS[model].name}): $${consolidationCost.toFixed(4)}`);
      console.log(`      - Resumo (Nova Micro): $${summaryCost.toFixed(4)}`);
      console.log(`   📊 Tokens: ${totalInputTokens.toLocaleString()} input + ${totalOutputTokens.toLocaleString()} output`);

      return {
        success: true,
        mode: 'multipass',
        model: model,
        response: finalResponse,
        metadata: {
          processingTime: elapsedTime,
          chunks: chunks.length,
          chunkAnalyses: chunkAnalyses.length,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          summaryTokens: summaryTokensInput + summaryTokensOutput,
          cost: totalCost,
          breakdown: {
            chunks: chunkCost,
            consolidation: consolidationCost,
            summary: summaryCost
          }
        }
      };

    } catch (error) {
      console.error(`   ❌ Erro na consolidação:`, error);
      return {
        success: false,
        mode: 'multipass',
        error: error.message,
        partialAnalyses: chunkAnalyses
      };
    }
  }

  /**
   * MODO 3: Resumo Econômico (LLM barata resume → LLM premium analisa resumo)
   */
  async processSummaryMode(text, userPrompt, model = 'sonnet', systemPrompt = '') {
    console.log(`\n🎯 [DocumentProcessor] MODO 3: RESUMO ECONÔMICO`);
    console.log(`   Modelo: ${MODELS[model].name}`);
    console.log(`   Tamanho: ${Math.round(text.length / 1000)}k caracteres (~${this.estimateTokens(text).toLocaleString()} tokens)`);

    const startTime = Date.now();

    // Gerar resumo com LLM barata
    console.log(`   📄 Gerando resumo estruturado com Nova Micro...`);

    const summaryResult = await documentSummarizer.summarizeAdaptive(text);

    if (!summaryResult.success) {
      return {
        success: false,
        mode: 'summary',
        error: 'Falha ao gerar resumo: ' + summaryResult.error
      };
    }

    console.log(`   ✅ Resumo gerado (${summaryResult.metadata.outputTokens.toLocaleString()} tokens, $${summaryResult.metadata.totalCost.toFixed(4)})`);

    // Analisar resumo com LLM premium
    console.log(`   🔍 Analisando resumo com ${MODELS[model].name}...`);

    const analysisPrompt = `
${userPrompt}

═══════════════════════════════════════════════════════════════════════
RESUMO ESTRUTURADO DO DOCUMENTO:
═══════════════════════════════════════════════════════════════════════

${summaryResult.summary}

═══════════════════════════════════════════════════════════════════════

💡 NOTA: Este é um resumo estruturado do documento original (${Math.round(text.length / 1000)}k caracteres → ${Math.round(summaryResult.summary.length / 1000)}k caracteres, redução de ${summaryResult.metadata.reductionPercent}%).

Com base neste resumo estruturado, forneça sua análise completa.
`;

    try {
      const response = await invokeModel({
        modelId: MODELS[model].id,
        messages: [{ role: 'user', content: analysisPrompt }],
        system: systemPrompt,
        temperature: 0.3,
        maxTokens: 16000
      });

      const elapsedTime = Math.round((Date.now() - startTime) / 1000);
      const analysisInputTokens = this.estimateTokens(analysisPrompt);
      const analysisOutputTokens = this.estimateTokens(response.content[0].text);
      const analysisCost = (analysisInputTokens / 1_000_000) * MODELS[model].costPer1M.input +
                           (analysisOutputTokens / 1_000_000) * MODELS[model].costPer1M.output;
      const totalCost = summaryResult.metadata.totalCost + analysisCost;

      console.log(`   ✅ Análise concluída em ${elapsedTime}s`);
      console.log(`   💰 Custo Total: $${totalCost.toFixed(4)} (resumo: $${summaryResult.metadata.totalCost.toFixed(4)} + análise: $${analysisCost.toFixed(4)})`);
      console.log(`   💵 Economia vs Multi-Pass: ~83%`);

      return {
        success: true,
        mode: 'summary',
        model: model,
        response: response.content[0].text,
        metadata: {
          processingTime: elapsedTime,
          inputTokens: summaryResult.metadata.inputTokens + analysisInputTokens,
          outputTokens: summaryResult.metadata.outputTokens + analysisOutputTokens,
          cost: totalCost,
          breakdown: {
            summary: summaryResult.metadata.totalCost,
            analysis: analysisCost
          },
          reductionPercent: summaryResult.metadata.reductionPercent
        }
      };

    } catch (error) {
      console.error(`   ❌ Erro na análise:`, error);
      return {
        success: false,
        mode: 'summary',
        error: error.message
      };
    }
  }

  /**
   * Processar documento - escolhe modo automaticamente ou usa modo especificado
   */
  async process(text, userPrompt, options = {}) {
    const {
      model = 'sonnet',           // haiku, sonnet, opus
      mode = 'auto',              // auto, direct, multipass, summary
      systemPrompt = ''
    } = options;

    const tokens = this.estimateTokens(text);

    console.log(`\n════════════════════════════════════════════════════════════════════════`);
    console.log(`📊 [DocumentProcessor] Iniciando processamento`);
    console.log(`   Documento: ${Math.round(text.length / 1000)}k caracteres (~${tokens.toLocaleString()} tokens)`);
    console.log(`   Modelo: ${MODELS[model].name}`);
    console.log(`   Modo solicitado: ${mode}`);
    console.log(`════════════════════════════════════════════════════════════════════════`);

    // Escolher modo automaticamente
    let selectedMode = mode;

    if (mode === 'auto') {
      if (tokens < 150000) {
        selectedMode = 'direct';
        console.log(`   🤖 Modo AUTO → DIRECT (documento < 150k tokens)`);
      } else {
        selectedMode = 'multipass';
        console.log(`   🤖 Modo AUTO → MULTI-PASS (documento > 150k tokens)`);
      }
    }

    // Executar modo escolhido
    switch (selectedMode) {
      case 'direct':
        return await this.processDirectRead(text, userPrompt, model, systemPrompt);

      case 'multipass':
        return await this.processMultiPass(text, userPrompt, model, systemPrompt);

      case 'summary':
        return await this.processSummaryMode(text, userPrompt, model, systemPrompt);

      default:
        return {
          success: false,
          error: `Modo inválido: ${selectedMode}`
        };
    }
  }
}

export const documentProcessor = new DocumentProcessor();
