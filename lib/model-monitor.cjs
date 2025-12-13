/**
 * Sistema de Monitoramento de Novos Modelos AI
 *
 * Monitora:
 * - Anthropic (Claude): Novos modelos e versões
 * - AWS Bedrock: Todos os providers (Amazon Nova, Meta Llama, Mistral, Cohere, etc)
 * - Sugere automaticamente implementação
 * - Garante que ROM nunca fique obsoleto
 */

const fs = require('fs');
const path = require('path');

class ModelMonitor {
  constructor() {
    this.modelsPath = path.join(__dirname, '../data/ai_models.json');
    this.suggestionsPath = path.join(__dirname, '../data/model_suggestions.json');

    this.ensureFiles();
  }

  ensureFiles() {
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Modelos conhecidos (baseline)
    if (!fs.existsSync(this.modelsPath)) {
      const knownModels = {
        anthropic: [
          {
            id: 'claude-sonnet-4-20250514',
            name: 'Claude Sonnet 4.5',
            provider: 'Anthropic',
            releaseDate: '2025-05-14',
            capabilities: ['text', 'code', 'analysis', 'chat'],
            maxTokens: 64000,
            contextWindow: 200000,
            status: 'active',
            costPer1MTokens: { input: 3.0, output: 15.0 },
            implemented: true,
            implementedAt: '2025-12-13'
          },
          {
            id: 'claude-opus-4-20250514',
            name: 'Claude Opus 4',
            provider: 'Anthropic',
            releaseDate: '2025-05-14',
            capabilities: ['text', 'code', 'analysis', 'chat', 'advanced-reasoning'],
            maxTokens: 64000,
            contextWindow: 200000,
            status: 'active',
            costPer1MTokens: { input: 15.0, output: 75.0 },
            implemented: false,
            notes: 'Modelo mais potente - considerar para casos complexos'
          }
        ],
        aws_bedrock: [
          {
            id: 'amazon.nova-pro-v1:0',
            name: 'Amazon Nova Pro',
            provider: 'Amazon',
            releaseDate: '2024-12-01',
            capabilities: ['text', 'multimodal', 'reasoning'],
            maxTokens: 4096,
            contextWindow: 300000,
            status: 'active',
            costPer1MTokens: { input: 0.8, output: 3.2 },
            implemented: true,
            implementedAt: '2025-12-13'
          },
          {
            id: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
            name: 'Claude 3.5 Sonnet (Bedrock)',
            provider: 'Anthropic via Bedrock',
            releaseDate: '2024-10-22',
            capabilities: ['text', 'code', 'analysis'],
            maxTokens: 8192,
            contextWindow: 200000,
            status: 'active',
            costPer1MTokens: { input: 3.0, output: 15.0 },
            implemented: true,
            implementedAt: '2025-12-13'
          },
          {
            id: 'us.amazon.nova-lite-v1:0',
            name: 'Amazon Nova Lite',
            provider: 'Amazon',
            releaseDate: '2024-12-01',
            capabilities: ['text', 'fast'],
            maxTokens: 4096,
            contextWindow: 300000,
            status: 'active',
            costPer1MTokens: { input: 0.06, output: 0.24 },
            implemented: false,
            notes: 'Modelo rápido e barato - ótimo para tarefas simples'
          },
          {
            id: 'us.amazon.nova-micro-v1:0',
            name: 'Amazon Nova Micro',
            provider: 'Amazon',
            releaseDate: '2024-12-01',
            capabilities: ['text', 'ultrafast'],
            maxTokens: 4096,
            contextWindow: 128000,
            status: 'active',
            costPer1MTokens: { input: 0.035, output: 0.14 },
            implemented: false,
            notes: 'Modelo ultra-rápido - ideal para processamento em massa'
          },
          {
            id: 'us.meta.llama3-3-70b-instruct-v1:0',
            name: 'Meta Llama 3.3 70B',
            provider: 'Meta',
            releaseDate: '2024-12-01',
            capabilities: ['text', 'code', 'open-source'],
            maxTokens: 4096,
            contextWindow: 128000,
            status: 'active',
            costPer1MTokens: { input: 0.99, output: 0.99 },
            implemented: false,
            notes: 'Modelo open-source de alta performance'
          },
          {
            id: 'deepseek-ai.deepseek-r1-distill-qwen-32b',
            name: 'DeepSeek R1 32B',
            provider: 'DeepSeek',
            releaseDate: '2025-01-20',
            capabilities: ['text', 'reasoning', 'math', 'code'],
            maxTokens: 8192,
            contextWindow: 64000,
            status: 'active',
            costPer1MTokens: { input: 0.55, output: 2.19 },
            implemented: true,
            implementedAt: '2025-12-13',
            notes: 'Modelo especializado em raciocínio profundo'
          }
        ]
      };

      fs.writeFileSync(this.modelsPath, JSON.stringify(knownModels, null, 2));
    }

    // Sugestões
    if (!fs.existsSync(this.suggestionsPath)) {
      fs.writeFileSync(this.suggestionsPath, JSON.stringify([], null, 2));
    }
  }

  /**
   * Verificar novos modelos (simulação - em produção faria API calls)
   * @returns {Object} Resultado da verificação
   */
  async checkForNewModels() {
    console.log('🔍 Verificando novos modelos AI disponíveis...');

    const currentModels = JSON.parse(fs.readFileSync(this.modelsPath, 'utf8'));
    const suggestions = JSON.parse(fs.readFileSync(this.suggestionsPath, 'utf8'));

    // Em produção, aqui faria:
    // 1. API call para Anthropic: https://api.anthropic.com/v1/models
    // 2. AWS SDK: bedrock.listFoundationModels()
    // 3. Comparar com modelos conhecidos

    // Por enquanto, vamos criar sugestões baseadas nos modelos não implementados
    const newSuggestions = [];

    // Verificar modelos Anthropic não implementados
    currentModels.anthropic.forEach(model => {
      if (!model.implemented) {
        newSuggestions.push({
          id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          modelId: model.id,
          modelName: model.name,
          provider: model.provider,
          reason: 'Novo modelo Anthropic disponível',
          benefits: this.analyzeBenefits(model),
          recommendation: this.generateRecommendation(model),
          priority: this.calculatePriority(model),
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      }
    });

    // Verificar modelos AWS Bedrock não implementados
    currentModels.aws_bedrock.forEach(model => {
      if (!model.implemented) {
        newSuggestions.push({
          id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          modelId: model.id,
          modelName: model.name,
          provider: model.provider,
          reason: 'Modelo disponível no AWS Bedrock',
          benefits: this.analyzeBenefits(model),
          recommendation: this.generateRecommendation(model),
          priority: this.calculatePriority(model),
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      }
    });

    // Salvar novas sugestões
    const allSuggestions = [...suggestions, ...newSuggestions];
    fs.writeFileSync(this.suggestionsPath, JSON.stringify(allSuggestions, null, 2));

    console.log(`✅ Verificação concluída: ${newSuggestions.length} novas sugestões`);

    return {
      totalChecked: currentModels.anthropic.length + currentModels.aws_bedrock.length,
      newSuggestions: newSuggestions.length,
      suggestions: newSuggestions
    };
  }

  /**
   * Analisar benefícios de implementar um modelo
   * @param {Object} model
   * @returns {Array} Lista de benefícios
   */
  analyzeBenefits(model) {
    const benefits = [];

    // Custo
    const avgCost = (model.costPer1MTokens.input + model.costPer1MTokens.output) / 2;
    if (avgCost < 2.0) {
      benefits.push({
        type: 'cost',
        description: 'Custo muito baixo - ideal para alto volume',
        impact: 'high'
      });
    } else if (avgCost < 10.0) {
      benefits.push({
        type: 'cost',
        description: 'Custo moderado - boa relação custo-benefício',
        impact: 'medium'
      });
    }

    // Performance
    if (model.capabilities.includes('fast') || model.capabilities.includes('ultrafast')) {
      benefits.push({
        type: 'performance',
        description: 'Alta velocidade - resposta rápida',
        impact: 'high'
      });
    }

    // Reasoning
    if (model.capabilities.includes('reasoning') || model.capabilities.includes('advanced-reasoning')) {
      benefits.push({
        type: 'quality',
        description: 'Raciocínio avançado - ideal para análise jurídica complexa',
        impact: 'high'
      });
    }

    // Context window
    if (model.contextWindow >= 200000) {
      benefits.push({
        type: 'capacity',
        description: 'Context window grande - processa documentos extensos',
        impact: 'high'
      });
    }

    // Multimodal
    if (model.capabilities.includes('multimodal')) {
      benefits.push({
        type: 'capability',
        description: 'Suporte multimodal - analisa imagens e documentos escaneados',
        impact: 'medium'
      });
    }

    return benefits;
  }

  /**
   * Gerar recomendação de implementação
   * @param {Object} model
   * @returns {Object} Recomendação
   */
  generateRecommendation(model) {
    const benefits = this.analyzeBenefits(model);
    const priority = this.calculatePriority(model);

    const useCases = [];

    // Determinar casos de uso baseado nas capacidades
    if (model.capabilities.includes('reasoning')) {
      useCases.push('Análise jurídica complexa');
      useCases.push('Fundamentação de teses');
    }

    if (model.capabilities.includes('fast') || model.capabilities.includes('ultrafast')) {
      useCases.push('Processamento em massa de documentos');
      useCases.push('Respostas rápidas para consultas simples');
    }

    if (model.capabilities.includes('multimodal')) {
      useCases.push('Análise de documentos escaneados');
      useCases.push('Extração de informações de imagens');
    }

    if (model.costPer1MTokens.input < 1.0) {
      useCases.push('Alto volume de requisições');
      useCases.push('Otimização de custos');
    }

    return {
      priority,
      useCases,
      implementationSteps: [
        'Adicionar configuração do modelo em src/index.js',
        'Atualizar módulo bedrock.js ou criar novo adaptador',
        'Adicionar ao seletor de modelo na interface',
        'Testar com casos de uso jurídicos',
        'Documentar limitações e casos de uso ideais',
        'Implantar em produção'
      ],
      estimatedEffort: this.estimateEffort(model),
      expectedImpact: this.estimateImpact(benefits)
    };
  }

  /**
   * Calcular prioridade de implementação
   * @param {Object} model
   * @returns {string} 'critical', 'high', 'medium', 'low'
   */
  calculatePriority(model) {
    const benefits = this.analyzeBenefits(model);

    // Critical: Novo modelo Anthropic ou modelo com reasoning avançado
    if (model.provider === 'Anthropic' || model.capabilities.includes('advanced-reasoning')) {
      return 'critical';
    }

    // High: Muitos benefícios de alto impacto
    const highImpactBenefits = benefits.filter(b => b.impact === 'high').length;
    if (highImpactBenefits >= 2) {
      return 'high';
    }

    // Medium: Alguns benefícios
    if (benefits.length >= 2) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Estimar esforço de implementação
   * @param {Object} model
   * @returns {string} 'small', 'medium', 'large'
   */
  estimateEffort(model) {
    // Modelos Anthropic são fáceis (já temos estrutura)
    if (model.provider === 'Anthropic' || model.provider.includes('Anthropic')) {
      return 'small';
    }

    // Modelos AWS Bedrock são médios (já temos módulo Bedrock)
    if (model.id.includes('amazon') || model.id.includes('us.')) {
      return 'small';
    }

    // Novos providers são mais trabalhosos
    return 'medium';
  }

  /**
   * Estimar impacto da implementação
   * @param {Array} benefits
   * @returns {string} 'transformational', 'significant', 'moderate', 'minor'
   */
  estimateImpact(benefits) {
    const highImpactCount = benefits.filter(b => b.impact === 'high').length;

    if (highImpactCount >= 3) return 'transformational';
    if (highImpactCount >= 2) return 'significant';
    if (benefits.length >= 3) return 'moderate';
    return 'minor';
  }

  /**
   * Listar sugestões pendentes
   * @returns {Array} Sugestões ordenadas por prioridade
   */
  listPendingSuggestions() {
    const suggestions = JSON.parse(fs.readFileSync(this.suggestionsPath, 'utf8'));

    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

    return suggestions
      .filter(s => s.status === 'pending')
      .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
  }

  /**
   * Aprovar sugestão de modelo
   * @param {string} suggestionId
   * @param {string} approvedBy
   * @returns {Object} Resultado
   */
  approveSuggestion(suggestionId, approvedBy) {
    const suggestions = JSON.parse(fs.readFileSync(this.suggestionsPath, 'utf8'));
    const suggestion = suggestions.find(s => s.id === suggestionId);

    if (!suggestion) {
      throw new Error('Sugestão não encontrada');
    }

    suggestion.status = 'approved';
    suggestion.approvedBy = approvedBy;
    suggestion.approvedAt = new Date().toISOString();

    fs.writeFileSync(this.suggestionsPath, JSON.stringify(suggestions, null, 2));

    // Marcar modelo como implementado
    const models = JSON.parse(fs.readFileSync(this.modelsPath, 'utf8'));

    // Procurar e marcar modelo
    ['anthropic', 'aws_bedrock'].forEach(provider => {
      const model = models[provider].find(m => m.id === suggestion.modelId);
      if (model) {
        model.implemented = true;
        model.implementedAt = new Date().toISOString();
      }
    });

    fs.writeFileSync(this.modelsPath, JSON.stringify(models, null, 2));

    console.log(`✅ Modelo ${suggestion.modelName} aprovado para implementação`);

    return {
      success: true,
      message: 'Modelo aprovado. Implementar conforme passos recomendados.',
      implementationSteps: suggestion.recommendation.implementationSteps
    };
  }

  /**
   * Rejeitar sugestão
   * @param {string} suggestionId
   * @param {string} rejectedBy
   * @param {string} reason
   * @returns {Object} Resultado
   */
  rejectSuggestion(suggestionId, rejectedBy, reason) {
    const suggestions = JSON.parse(fs.readFileSync(this.suggestionsPath, 'utf8'));
    const suggestion = suggestions.find(s => s.id === suggestionId);

    if (!suggestion) {
      throw new Error('Sugestão não encontrada');
    }

    suggestion.status = 'rejected';
    suggestion.rejectedBy = rejectedBy;
    suggestion.rejectedAt = new Date().toISOString();
    suggestion.rejectionReason = reason;

    fs.writeFileSync(this.suggestionsPath, JSON.stringify(suggestions, null, 2));

    console.log(`❌ Modelo ${suggestion.modelName} rejeitado: ${reason}`);

    return {
      success: true,
      message: 'Sugestão rejeitada'
    };
  }

  /**
   * Obter estatísticas de modelos
   * @returns {Object} Estatísticas
   */
  getStatistics() {
    const models = JSON.parse(fs.readFileSync(this.modelsPath, 'utf8'));
    const suggestions = JSON.parse(fs.readFileSync(this.suggestionsPath, 'utf8'));

    const totalModels = models.anthropic.length + models.aws_bedrock.length;
    const implementedModels = [
      ...models.anthropic.filter(m => m.implemented),
      ...models.aws_bedrock.filter(m => m.implemented)
    ].length;

    const pendingSuggestions = suggestions.filter(s => s.status === 'pending').length;
    const approvedSuggestions = suggestions.filter(s => s.status === 'approved').length;
    const rejectedSuggestions = suggestions.filter(s => s.status === 'rejected').length;

    // Custos médios
    const allModels = [...models.anthropic, ...models.aws_bedrock];
    const avgInputCost = allModels.reduce((sum, m) => sum + m.costPer1MTokens.input, 0) / allModels.length;
    const avgOutputCost = allModels.reduce((sum, m) => sum + m.costPer1MTokens.output, 0) / allModels.length;

    // Modelo mais barato
    const cheapestModel = allModels.reduce((min, m) =>
      (m.costPer1MTokens.input + m.costPer1MTokens.output) < (min.costPer1MTokens.input + min.costPer1MTokens.output) ? m : min
    );

    // Modelo mais rápido
    const fastestModel = allModels.find(m =>
      m.capabilities.includes('ultrafast') || m.capabilities.includes('fast')
    );

    return {
      models: {
        total: totalModels,
        implemented: implementedModels,
        notImplemented: totalModels - implementedModels,
        implementationRate: ((implementedModels / totalModels) * 100).toFixed(1) + '%'
      },
      suggestions: {
        pending: pendingSuggestions,
        approved: approvedSuggestions,
        rejected: rejectedSuggestions,
        total: suggestions.length
      },
      costs: {
        avgInputCostPer1M: `$${avgInputCost.toFixed(2)}`,
        avgOutputCostPer1M: `$${avgOutputCost.toFixed(2)}`,
        cheapestModel: {
          name: cheapestModel.name,
          cost: `$${(cheapestModel.costPer1MTokens.input + cheapestModel.costPer1MTokens.output).toFixed(2)}/1M tokens`
        }
      },
      recommendations: {
        fastestModel: fastestModel ? fastestModel.name : 'N/A',
        highPriority: suggestions.filter(s => s.priority === 'critical' || s.priority === 'high').length
      }
    };
  }

  /**
   * Agendar verificação automática (executar a cada 24h)
   * @param {Function} callback - Função a chamar quando houver novas sugestões
   */
  scheduleAutoCheck(callback) {
    // Verificar a cada 24 horas
    const interval = 24 * 60 * 60 * 1000; // 24h em ms

    console.log('📅 Agendando verificação automática de novos modelos (a cada 24h)');

    setInterval(async () => {
      try {
        console.log('🕐 Executando verificação automática de novos modelos...');
        const result = await this.checkForNewModels();

        if (result.newSuggestions > 0 && callback) {
          callback(result);
        }
      } catch (error) {
        console.error('❌ Erro na verificação automática:', error);
      }
    }, interval);

    // Executar primeira verificação imediatamente
    this.checkForNewModels().then(result => {
      if (result.newSuggestions > 0 && callback) {
        callback(result);
      }
    });
  }
}

module.exports = ModelMonitor;
