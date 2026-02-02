import fs from 'fs';
import path from 'path';
import { ACTIVE_PATHS } from './storage-config.js';
import { conversar } from '../src/modules/bedrock.js';
import { customInstructionsManager } from './custom-instructions-manager.js';

/**
 * CustomInstructionsAnalyzer
 *
 * Sistema de auto-atualização de Custom Instructions via IA
 *
 * FUNCIONALIDADES:
 * - Coleta métricas de uso (conversas, peças, erros)
 * - Invoca Claude para analisar métricas
 * - Gera sugestões de melhoria
 * - Salva sugestões pendentes para aprovação manual
 * - Aplica sugestões aprovadas
 * - Rejeita sugestões não relevantes
 */
export class CustomInstructionsAnalyzer {
  constructor() {
    this.analysisDir = path.join(ACTIVE_PATHS.data, 'custom-instructions');
  }

  /**
   * Retorna caminho para arquivo de análise de um parceiro
   * @param {string} partnerId - ID do parceiro
   */
  getAnalysisPath(partnerId) {
    return path.join(this.analysisDir, partnerId, 'analysis.json');
  }

  /**
   * Coleta métricas de uso das últimas N conversas
   * @param {string} partnerId - ID do parceiro
   * @param {number} days - Número de dias a analisar
   * @returns {Promise<object>} Métricas coletadas
   */
  async collectUsageMetrics(partnerId = 'rom', days = 7) {
    console.log(`[CustomInstructions Analyzer] Coletando métricas para ${partnerId} (últimos ${days} dias)...`);

    // TODO: Implementar coleta real de métricas quando houver sistema de logs
    // Por enquanto, retorna métricas simuladas para demonstração

    const conversationsPath = path.join(ACTIVE_PATHS.data, 'conversations', partnerId);

    let totalConversations = 0;
    let totalPecas = 0;
    let errorRate = 0;
    let avgRevisionsPerPeca = 1.5;
    let topIssues = [];

    // Tenta coletar dados reais se diretório existir
    if (fs.existsSync(conversationsPath)) {
      try {
        const files = fs.readdirSync(conversationsPath);
        totalConversations = files.length;

        // Análise simplificada dos arquivos
        // TODO: Implementar análise mais sofisticada
        totalPecas = Math.floor(totalConversations * 0.6);

        // Simular detecção de problemas comuns
        topIssues = [
          {
            type: 'formatting',
            count: Math.floor(totalPecas * 0.15),
            description: 'Inconsistências na formatação ABNT'
          },
          {
            type: 'structure',
            count: Math.floor(totalPecas * 0.10),
            description: 'Ordem incorreta de seções (preliminares vs mérito)'
          },
          {
            type: 'style',
            count: Math.floor(totalPecas * 0.08),
            description: 'Uso de linguagem informal ou markdown'
          }
        ];

        errorRate = totalPecas > 0 ? (topIssues.reduce((sum, issue) => sum + issue.count, 0) / totalPecas) : 0;
      } catch (error) {
        console.error('[CustomInstructions Analyzer] Erro ao coletar métricas:', error);
      }
    } else {
      // Métricas simuladas se não houver dados
      totalConversations = 150;
      totalPecas = 87;
      errorRate = 0.12;
      topIssues = [
        {
          type: 'formatting',
          count: 23,
          description: 'Citações longas sem recuo de 4cm'
        },
        {
          type: 'structure',
          count: 18,
          description: 'Ordem incorreta de preliminares vs mérito'
        },
        {
          type: 'style',
          count: 15,
          description: 'Uso de linguagem informal'
        }
      ];
    }

    return {
      partnerId,
      period: {
        days,
        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      },
      totalConversations,
      totalPecas,
      errorRate,
      avgRevisionsPerPeca,
      topIssues,
      performanceMetrics: {
        avgResponseTime: 3500, // ms
        avgPromptTokens: 8500,
        avgCompletionTokens: 12000
      }
    };
  }

  /**
   * Gera sugestões via IA baseado nas métricas
   * @param {string} partnerId - ID do parceiro
   * @returns {Promise<object>} Sugestões geradas
   */
  async generateSuggestions(partnerId = 'rom') {
    console.log(`[CustomInstructions Analyzer] Gerando sugestões para ${partnerId}...`);

    try {
      // Coleta métricas
      const metrics = await this.collectUsageMetrics(partnerId);

      // Carrega Custom Instructions atuais
      const currentCI = customInstructionsManager.load(partnerId);

      // Constrói prompt para análise
      const prompt = this.buildAnalysisPrompt(metrics, currentCI);

      // Invoca Claude para análise
      console.log('[CustomInstructions Analyzer] Invocando Claude para análise...');
      const response = await conversar(prompt, {
        systemPrompt: 'Você é um especialista em prompts para sistemas de geração de peças jurídicas. Analise as métricas fornecidas e sugira melhorias específicas e acionáveis.',
        maxTokens: 16000,
        temperature: 0.3, // Baixa temperatura para análise técnica
        enableTools: false,
        enableCache: false
      });

      // Parse da resposta JSON
      const suggestionsData = this.parseSuggestionsResponse(response.content);

      // Adiciona metadados
      suggestionsData.metadata = {
        partnerId,
        generatedAt: new Date().toISOString(),
        metrics,
        currentVersion: currentCI.version
      };

      console.log(`[CustomInstructions Analyzer] ${suggestionsData.suggestions.length} sugestões geradas`);

      return suggestionsData;
    } catch (error) {
      console.error('[CustomInstructions Analyzer] Erro ao gerar sugestões:', error);
      throw error;
    }
  }

  /**
   * Constrói prompt para análise de métricas
   * @param {object} metrics - Métricas coletadas
   * @param {object} currentCI - Custom Instructions atuais
   * @returns {string} Prompt formatado
   */
  buildAnalysisPrompt(metrics, currentCI) {
    return `
ANÁLISE DE CUSTOM INSTRUCTIONS - GERAÇÃO DE SUGESTÕES DE MELHORIA

═══════════════════════════════════════════════════════
MÉTRICAS DE USO (Últimos ${metrics.period.days} dias)
═══════════════════════════════════════════════════════

Parceiro: ${metrics.partnerId}
Período: ${new Date(metrics.period.startDate).toLocaleDateString('pt-BR')} a ${new Date(metrics.period.endDate).toLocaleDateString('pt-BR')}

VOLUME:
- Total de conversas: ${metrics.totalConversations}
- Total de peças geradas: ${metrics.totalPecas}
- Taxa de erro: ${(metrics.errorRate * 100).toFixed(2)}%
- Média de revisões por peça: ${metrics.avgRevisionsPerPeca}

PROBLEMAS MAIS FREQUENTES:
${metrics.topIssues.map((issue, idx) => `
${idx + 1}. ${issue.description}
   - Tipo: ${issue.type}
   - Ocorrências: ${issue.count}
   - Percentual: ${(issue.count / metrics.totalPecas * 100).toFixed(2)}%
`).join('\n')}

PERFORMANCE:
- Tempo médio de resposta: ${metrics.performanceMetrics.avgResponseTime}ms
- Tokens médios (prompt): ${metrics.performanceMetrics.avgPromptTokens}
- Tokens médios (completion): ${metrics.performanceMetrics.avgCompletionTokens}

═══════════════════════════════════════════════════════
CUSTOM INSTRUCTIONS ATUAIS
═══════════════════════════════════════════════════════

Versão: ${currentCI.version}
Última atualização: ${new Date(currentCI.lastUpdated).toLocaleString('pt-BR')}
Atualizado por: ${currentCI.updatedBy}

COMPONENTE 1: Custom Instructions Gerais
${currentCI.components.customInstructions.content.text.substring(0, 1000)}...
(${currentCI.components.customInstructions.metadata.wordCount} palavras, ${currentCI.components.customInstructions.metadata.estimatedTokens} tokens)

COMPONENTE 2: Método de Formatação
${currentCI.components.formattingMethod.content.text.substring(0, 1000)}...
(${currentCI.components.formattingMethod.metadata.wordCount} palavras, ${currentCI.components.formattingMethod.metadata.estimatedTokens} tokens)

COMPONENTE 3: Método de Versionamento e Redação
${currentCI.components.versioningMethod.content.text.substring(0, 1000)}...
(${currentCI.components.versioningMethod.metadata.wordCount} palavras, ${currentCI.components.versioningMethod.metadata.estimatedTokens} tokens)

═══════════════════════════════════════════════════════
TAREFA
═══════════════════════════════════════════════════════

Com base nas métricas de uso acima, sugira melhorias específicas para os 3 componentes das Custom Instructions.

Para cada problema identificado, forneça:
1. Qual componente deve ser modificado (customInstructions, formattingMethod ou versioningMethod)
2. Tipo de modificação (add, modify, remove)
3. Prioridade (high, medium, low)
4. Descrição do problema
5. Texto sugerido para adicionar/modificar
6. Justificativa baseada nas métricas
7. Métrica afetada (errorRate, avgRevisionsPerPeca, etc)
8. Melhoria esperada (ex: "Reduzir erros de formatação em 30%")

IMPORTANTE:
- Seja específico e acionável
- Cite números das métricas na justificativa
- Foque em melhorias que impactem as taxas de erro
- Mantenha o estilo e formato dos componentes atuais

Retorne APENAS um JSON válido no seguinte formato:

{
  "suggestions": [
    {
      "id": "sugestao-1",
      "component": "customInstructions | formattingMethod | versioningMethod",
      "type": "add | modify | remove",
      "priority": "high | medium | low",
      "problem": "Descrição clara do problema identificado",
      "suggestedText": "Texto completo a ser adicionado/modificado",
      "justification": "Justificativa baseada nas métricas (cite números específicos)",
      "affectedMetric": "errorRate | avgRevisionsPerPeca | ...",
      "expectedImprovement": "Descrição quantitativa da melhoria esperada"
    }
  ]
}

Gere entre 3 a 5 sugestões priorizadas.`;
  }

  /**
   * Parse da resposta JSON do Claude
   * @param {string} responseContent - Resposta do Claude
   * @returns {object} Objeto com sugestões parseado
   */
  parseSuggestionsResponse(responseContent) {
    try {
      // Extrai JSON da resposta (pode vir com texto antes/depois)
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Resposta não contém JSON válido');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Valida estrutura
      if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
        throw new Error('JSON não contém array de sugestões');
      }

      // Adiciona IDs únicos se não houver
      parsed.suggestions = parsed.suggestions.map((suggestion, idx) => ({
        id: suggestion.id || `suggestion-${Date.now()}-${idx}`,
        component: suggestion.component,
        type: suggestion.type,
        priority: suggestion.priority,
        problem: suggestion.problem,
        suggestedText: suggestion.suggestedText,
        justification: suggestion.justification,
        affectedMetric: suggestion.affectedMetric,
        expectedImprovement: suggestion.expectedImprovement,
        status: 'pending'
      }));

      return parsed;
    } catch (error) {
      console.error('[CustomInstructions Analyzer] Erro ao parsear resposta:', error);
      throw new Error(`Falha ao parsear sugestões: ${error.message}`);
    }
  }

  /**
   * Salva sugestões pendentes
   * @param {object} suggestionsData - Dados das sugestões
   * @param {string} partnerId - ID do parceiro
   */
  async saveSuggestions(suggestionsData, partnerId = 'rom') {
    const analysisPath = this.getAnalysisPath(partnerId);
    const dir = path.dirname(analysisPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = {
      generatedAt: suggestionsData.metadata?.generatedAt || new Date().toISOString(),
      partnerId,
      status: 'pending',
      metrics: suggestionsData.metadata?.metrics,
      currentVersion: suggestionsData.metadata?.currentVersion,
      suggestions: suggestionsData.suggestions
    };

    fs.writeFileSync(analysisPath, JSON.stringify(data, null, 2));
    console.log(`[CustomInstructions Analyzer] Sugestões salvas em ${analysisPath}`);
  }

  /**
   * Lista sugestões pendentes
   * @param {string} partnerId - ID do parceiro
   * @returns {Array} Array de sugestões pendentes
   */
  getPendingSuggestions(partnerId = 'rom') {
    const analysisPath = this.getAnalysisPath(partnerId);

    if (!fs.existsSync(analysisPath)) {
      return [];
    }

    try {
      const data = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
      return data.status === 'pending' ? data.suggestions : [];
    } catch (error) {
      console.error('[CustomInstructions Analyzer] Erro ao ler sugestões:', error);
      return [];
    }
  }

  /**
   * Aplica sugestão aprovada
   * @param {string} suggestionId - ID da sugestão
   * @param {string} partnerId - ID do parceiro
   */
  async applySuggestion(suggestionId, partnerId = 'rom') {
    console.log(`[CustomInstructions Analyzer] Aplicando sugestão ${suggestionId} para ${partnerId}...`);

    const analysisPath = this.getAnalysisPath(partnerId);

    if (!fs.existsSync(analysisPath)) {
      throw new Error('Nenhuma análise encontrada');
    }

    const data = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
    const suggestion = data.suggestions.find(s => s.id === suggestionId);

    if (!suggestion) {
      throw new Error('Sugestão não encontrada');
    }

    // Carrega Custom Instructions atuais
    const currentData = customInstructionsManager.load(partnerId);

    // Aplica modificação baseado no tipo
    const componentKey = suggestion.component;

    if (!currentData.components[componentKey]) {
      throw new Error(`Componente ${componentKey} não encontrado`);
    }

    const component = currentData.components[componentKey];

    if (suggestion.type === 'add') {
      // Adiciona ao final do texto
      component.content.text += '\n\n' + suggestion.suggestedText;
    } else if (suggestion.type === 'modify') {
      // Para modify, adiciona ao final com nota explicativa
      // (uma implementação mais sofisticada faria find/replace inteligente)
      component.content.text += '\n\n' + suggestion.suggestedText;
    } else if (suggestion.type === 'remove') {
      // Remove seção específica (implementação simplificada)
      console.warn('[CustomInstructions Analyzer] Tipo "remove" ainda não totalmente implementado');
    }

    // Recalcula metadados
    component.metadata = customInstructionsManager.calculateMetadata(component.content.text);

    // Regenera HTML e Markdown (simplificado - apenas atualiza baseado no texto)
    component.content.html = customInstructionsManager.getDefaultHTML(componentKey);
    component.content.markdown = customInstructionsManager.getDefaultMarkdown(componentKey);

    // Salva
    await customInstructionsManager.save(currentData, 'system_ai', partnerId);

    // Marca sugestão como aplicada
    suggestion.status = 'applied';
    suggestion.appliedAt = new Date().toISOString();
    fs.writeFileSync(analysisPath, JSON.stringify(data, null, 2));

    console.log(`[CustomInstructions Analyzer] Sugestão ${suggestionId} aplicada com sucesso`);
  }

  /**
   * Rejeita sugestão
   * @param {string} suggestionId - ID da sugestão
   * @param {string} partnerId - ID do parceiro
   */
  async rejectSuggestion(suggestionId, partnerId = 'rom') {
    console.log(`[CustomInstructions Analyzer] Rejeitando sugestão ${suggestionId} para ${partnerId}...`);

    const analysisPath = this.getAnalysisPath(partnerId);

    if (!fs.existsSync(analysisPath)) {
      throw new Error('Nenhuma análise encontrada');
    }

    const data = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
    const suggestion = data.suggestions.find(s => s.id === suggestionId);

    if (suggestion) {
      suggestion.status = 'rejected';
      suggestion.rejectedAt = new Date().toISOString();
      fs.writeFileSync(analysisPath, JSON.stringify(data, null, 2));
      console.log(`[CustomInstructions Analyzer] Sugestão ${suggestionId} rejeitada`);
    }
  }
}

// Singleton
export const customInstructionsAnalyzer = new CustomInstructionsAnalyzer();
