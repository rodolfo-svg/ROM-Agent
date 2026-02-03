/**
 * Document Summarizer
 * Gera resumos estruturados usando LLMs baratas (Amazon Nova Micro/Lite)
 */

import { invokeModel } from '../src/modules/bedrock.js';

export class DocumentSummarizer {
  constructor() {
    // Modelo padrão: Amazon Nova Micro (ultra-barato)
    this.defaultModel = 'us.amazon.nova-micro-v1:0';

    // Template de resumo estruturado
    this.summaryTemplate = `
Você é um assistente especializado em resumir documentos jurídicos brasileiros.

TAREFA: Analise o documento abaixo e gere um RESUMO ESTRUTURADO completo.

FORMATO OBRIGATÓRIO:

═════════════════════════════════════════════════════════════════════════
📄 RESUMO EXECUTIVO (1-2 PÁGINAS)
═════════════════════════════════════════════════════════════════════════
[Síntese completa: natureza do processo, partes, objeto, situação atual]

═════════════════════════════════════════════════════════════════════════
📑 FATOS CRONOLÓGICOS (ORDEM TEMPORAL)
═════════════════════════════════════════════════════════════════════════
- [Data]: [Evento importante]
- [Data]: [Evento importante]
...

═════════════════════════════════════════════════════════════════════════
⚖️ PEDIDOS E FUNDAMENTOS
═════════════════════════════════════════════════════════════════════════
1. [Pedido principal]
   Fundamento: [Base legal e fática]

2. [Pedido subsidiário]
   Fundamento: [Base legal e fática]
...

═════════════════════════════════════════════════════════════════════════
📊 ENTIDADES
═════════════════════════════════════════════════════════════════════════
PESSOAS FÍSICAS:
- Nome: [Nome completo]
  CPF: [XXX.XXX.XXX-XX]
  Qualificação: [Autor/Réu/Testemunha/etc]

PESSOAS JURÍDICAS:
- Razão Social: [Nome]
  CNPJ: [XX.XXX.XXX/XXXX-XX]
  Qualificação: [...]

ADVOGADOS:
- Nome: [Nome]
  OAB: [XX XXXXX]

═════════════════════════════════════════════════════════════════════════
📋 LEGISLAÇÃO CITADA
═════════════════════════════════════════════════════════════════════════
- [Lei/Artigo]: [Contexto de citação]
...

═════════════════════════════════════════════════════════════════════════
🔍 TRECHOS CRÍTICOS (CITAÇÕES LITERAIS)
═════════════════════════════════════════════════════════════════════════
[Fls. X] "Texto literal importante..."
[Fls. Y] "Outro trecho crítico..."
...

═════════════════════════════════════════════════════════════════════════
💼 CONTEXTO PROCESSUAL
═════════════════════════════════════════════════════════════════════════
Número do Processo: [...]
Tribunal/Vara: [...]
Fase Atual: [...]
Última Movimentação: [...]
Prazos em Curso: [...]

═════════════════════════════════════════════════════════════════════════

INSTRUÇÕES:
- Mantenha TODAS as informações importantes
- Cite páginas/folhas para trechos críticos
- Ordene fatos cronologicamente
- Liste TODOS os pedidos
- Extraia TODAS as entidades (CPF, CNPJ, OAB)
- Cite TODA a legislação mencionada
- Priorize COMPLETUDE sobre brevidade
- Máximo: 40.000 tokens (objetivo: 20-35k)

DOCUMENTO COMPLETO:
───────────────────────────────────────────────────────────────────────
{documentText}
───────────────────────────────────────────────────────────────────────

Gere o resumo estruturado agora:
`;
  }

  /**
   * Gerar resumo estruturado de documento grande
   * @param {string} fullText - Texto completo do documento
   * @param {object} options - Opções (modelo, temperatura)
   * @returns {object} { success, summary, metadata }
   */
  async summarize(fullText, options = {}) {
    const {
      model = this.defaultModel,
      temperature = 0.1,  // Baixa temperatura para resumos factuais
      maxTokens = 40000   // Limite de saída
    } = options;

    console.log(`[Summarizer] Iniciando resumo com modelo: ${model}`);
    console.log(`[Summarizer] Documento original: ${Math.round(fullText.length / 1000)}k caracteres`);

    // Preparar prompt
    const prompt = this.summaryTemplate.replace('{documentText}', fullText);

    const startTime = Date.now();

    try {
      // Invocar modelo barato
      const response = await invokeModel({
        modelId: model,
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature,
        maxTokens,
        system: 'Você é um assistente jurídico especializado em resumos estruturados.'
      });

      const elapsedTime = Math.round((Date.now() - startTime) / 1000);

      const summary = response.content[0].text;

      // Calcular estatísticas
      const inputTokens = Math.ceil(prompt.length / 4);
      const outputTokens = Math.ceil(summary.length / 4);
      const totalTokens = inputTokens + outputTokens;

      // Calcular custo baseado no modelo
      let inputCost, outputCost;

      if (model.includes('nova-micro')) {
        inputCost = (inputTokens / 1_000_000) * 0.035;
        outputCost = (outputTokens / 1_000_000) * 0.14;
      } else if (model.includes('nova-lite')) {
        inputCost = (inputTokens / 1_000_000) * 0.06;
        outputCost = (outputTokens / 1_000_000) * 0.24;
      } else if (model.includes('llama')) {
        inputCost = (inputTokens / 1_000_000) * 0.99;
        outputCost = (outputTokens / 1_000_000) * 0.99;
      } else {
        // Fallback genérico
        inputCost = (inputTokens / 1_000_000) * 0.1;
        outputCost = (outputTokens / 1_000_000) * 0.4;
      }

      const totalCost = inputCost + outputCost;

      // Redução de tamanho
      const reductionPercent = Math.round((1 - (summary.length / fullText.length)) * 100);

      console.log(`[Summarizer] ✅ Resumo concluído em ${elapsedTime}s`);
      console.log(`[Summarizer] Original: ${Math.round(fullText.length / 1000)}k chars → Resumo: ${Math.round(summary.length / 1000)}k chars`);
      console.log(`[Summarizer] Redução: ${reductionPercent}%`);
      console.log(`[Summarizer] Tokens: ${inputTokens.toLocaleString()} input + ${outputTokens.toLocaleString()} output = ${totalTokens.toLocaleString()}`);
      console.log(`[Summarizer] Custo: $${totalCost.toFixed(4)} (input: $${inputCost.toFixed(4)} + output: $${outputCost.toFixed(4)})`);

      return {
        success: true,
        summary,
        metadata: {
          model,
          inputTokens,
          outputTokens,
          totalTokens,
          inputCost,
          outputCost,
          totalCost,
          processingTime: elapsedTime,
          originalSize: fullText.length,
          summarySize: summary.length,
          reductionPercent
        }
      };

    } catch (error) {
      console.error(`[Summarizer] ❌ Erro ao gerar resumo:`, error);
      return {
        success: false,
        error: error.message,
        metadata: {
          model,
          processingTime: Math.round((Date.now() - startTime) / 1000)
        }
      };
    }
  }

  /**
   * Resumo adaptativo: tenta modelos progressivamente mais capazes se falhar
   */
  async summarizeAdaptive(fullText) {
    const models = [
      { id: 'us.amazon.nova-micro-v1:0', name: 'Nova Micro' },
      { id: 'us.amazon.nova-lite-v1:0', name: 'Nova Lite' },
      { id: 'us.meta.llama3-3-70b-instruct-v1:0', name: 'Llama 3.3 70B' }
    ];

    for (const model of models) {
      console.log(`[Summarizer] Tentando ${model.name}...`);

      const result = await this.summarize(fullText, { model: model.id });

      if (result.success) {
        return result;
      }

      console.warn(`[Summarizer] ${model.name} falhou, tentando próximo...`);
    }

    return {
      success: false,
      error: 'Todos os modelos falharam ao gerar resumo'
    };
  }
}

export const documentSummarizer = new DocumentSummarizer();
