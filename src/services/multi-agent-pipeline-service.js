/**
 * ROM Agent - Multi-Agent Pipeline Service
 *
 * Sistema de processamento em múltiplos stages com diferentes modelos de IA
 * para análise de processos grandes (6700+ páginas)
 *
 * @version 1.0.0
 */

import { BedrockAgent } from '../modules/bedrock.js';
import fs from 'fs/promises';
import path from 'path';
import { ACTIVE_PATHS } from '../../lib/storage-config.js';

// ============================================================
// CONFIGURAÇÃO DOS STAGES
// ============================================================

const STAGES = {
  LEITURA_MASSIVA: {
    id: 'leitura_massiva',
    name: 'Leitura Massiva',
    description: 'Processamento de grandes volumes com Llama 3.3 70B',
    model: 'meta.llama3-3-70b-instruct-v1:0',
    costPerPage: 0.000157, // ~$0.15 por 1000 páginas
    chunkSize: 128000, // tokens
    icon: '📚'
  },
  ANALISE_PROFUNDA: {
    id: 'analise_profunda',
    name: 'Análise Profunda',
    description: 'Análise jurídica detalhada com Claude Sonnet 4.5',
    model: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
    costPerPage: 0.023, // ~$0.80 por 35 páginas
    icon: '🎯'
  },
  FUNDAMENTACAO: {
    id: 'fundamentacao',
    name: 'Fundamentação Legal',
    description: 'Raciocínio jurídico exposto com DeepSeek R1',
    model: 'deepseek.r1-v1:0',
    costPerPage: 0.020,
    icon: '🧠'
  },
  REDACAO: {
    id: 'redacao',
    name: 'Redação Final',
    description: 'Escrita jurídica premium com Claude Sonnet 4.5',
    model: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
    costPerPage: 0.024,
    icon: '✍️'
  },
  VALIDACAO: {
    id: 'validacao',
    name: 'Validação Premium',
    description: 'Revisão de máxima qualidade com Claude Opus 4.5',
    model: 'anthropic.claude-opus-4-5-20251101-v1:0',
    costPerPage: 0.050,
    icon: '💎',
    optional: true
  }
};

// ============================================================
// CONFIGURAÇÕES DE ORÇAMENTO
// ============================================================

const BUDGET_CONFIGS = {
  ECONOMICO: {
    id: 'economico',
    name: 'Econômico',
    description: 'Máximo custo-benefício (~$3.45)',
    stages: ['leitura_massiva', 'analise_profunda', 'fundamentacao', 'redacao'],
    estimatedCost: 3.45,
    icon: '💰'
  },
  PREMIUM: {
    id: 'premium',
    name: 'Premium',
    description: 'Máxima qualidade (~$5.95)',
    stages: ['leitura_massiva', 'analise_profunda', 'fundamentacao', 'redacao', 'validacao'],
    estimatedCost: 5.95,
    icon: '💎'
  },
  FLEXIVEL: {
    id: 'flexivel',
    name: 'Flexível',
    description: 'Usuário escolhe stages',
    stages: [], // Vazio, usuário seleciona
    estimatedCost: null,
    icon: '🎛️'
  }
};

// ============================================================
// CLASSE PRINCIPAL - MULTI-AGENT PIPELINE
// ============================================================

export class MultiAgentPipelineService {
  constructor() {
    this.pipelines = new Map(); // pipelineId -> estado
    this.outputPath = path.join(ACTIVE_PATHS.data, 'multi-agent-outputs');
  }

  /**
   * Inicializar serviço
   */
  async init() {
    try {
      await fs.mkdir(this.outputPath, { recursive: true });
      console.log('✅ Multi-Agent Pipeline Service inicializado');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar Multi-Agent Pipeline:', error);
      return false;
    }
  }

  /**
   * Criar novo pipeline
   *
   * @param {object} config - Configuração do pipeline
   * @param {string} config.documentPath - Caminho do documento
   * @param {string} config.mode - 'automatico' | 'manual' | 'hibrido'
   * @param {string} config.budget - 'economico' | 'premium' | 'flexivel'
   * @param {array} config.selectedStages - Stages selecionados (modo flexível)
   * @param {string} config.outputType - Tipo de saída (revisao_criminal, embargos, etc)
   * @returns {object} Pipeline criado
   */
  async createPipeline(config) {
    const pipelineId = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Determinar stages baseado no orçamento/modo
    let stages = [];
    if (config.budget === 'flexivel') {
      stages = config.selectedStages || [];
    } else {
      stages = BUDGET_CONFIGS[config.budget.toUpperCase()].stages;
    }

    const pipeline = {
      id: pipelineId,
      config,
      stages,
      status: 'criado',
      currentStage: null,
      results: {},
      progress: 0,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null,
      estimatedCost: this.calculateEstimatedCost(stages, config.documentPath)
    };

    this.pipelines.set(pipelineId, pipeline);

    console.log(`📊 Pipeline criado: ${pipelineId}`);
    console.log(`   Modo: ${config.mode}`);
    console.log(`   Orçamento: ${config.budget}`);
    console.log(`   Stages: ${stages.length}`);
    console.log(`   Custo estimado: $${pipeline.estimatedCost.toFixed(2)}`);

    return pipeline;
  }

  /**
   * Executar pipeline
   *
   * @param {string} pipelineId - ID do pipeline
   * @param {function} progressCallback - Callback de progresso (opcional)
   * @returns {object} Resultado final
   */
  async executePipeline(pipelineId, progressCallback = null) {
    const pipeline = this.pipelines.get(pipelineId);

    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} não encontrado`);
    }

    pipeline.status = 'executando';
    pipeline.startedAt = new Date().toISOString();

    console.log(`🚀 Iniciando execução do pipeline: ${pipelineId}`);

    try {
      // Executar cada stage
      for (let i = 0; i < pipeline.stages.length; i++) {
        const stageId = pipeline.stages[i];
        const stageConfig = STAGES[stageId.toUpperCase()];

        pipeline.currentStage = stageId;
        pipeline.progress = Math.round(((i + 1) / pipeline.stages.length) * 100);

        console.log(`\n${stageConfig.icon} Stage ${i + 1}/${pipeline.stages.length}: ${stageConfig.name}`);

        // Callback de progresso
        if (progressCallback) {
          progressCallback({
            pipelineId,
            stage: stageId,
            stageNumber: i + 1,
            totalStages: pipeline.stages.length,
            progress: pipeline.progress,
            status: 'executando'
          });
        }

        // Executar stage
        const stageResult = await this.executeStage(
          stageId,
          pipeline.config.documentPath,
          pipeline.results
        );

        pipeline.results[stageId] = stageResult;

        console.log(`✅ Stage ${stageConfig.name} concluído`);
      }

      pipeline.status = 'concluido';
      pipeline.completedAt = new Date().toISOString();
      pipeline.progress = 100;

      console.log(`\n🎉 Pipeline ${pipelineId} concluído com sucesso!`);

      // Salvar resultado final
      const outputPath = await this.saveOutput(pipeline);
      pipeline.outputPath = outputPath;

      return {
        success: true,
        pipelineId,
        outputPath,
        results: pipeline.results,
        estimatedCost: pipeline.estimatedCost,
        duration: new Date(pipeline.completedAt) - new Date(pipeline.startedAt)
      };

    } catch (error) {
      pipeline.status = 'erro';
      pipeline.error = error.message;

      console.error(`❌ Erro no pipeline ${pipelineId}:`, error);

      return {
        success: false,
        pipelineId,
        error: error.message,
        partialResults: pipeline.results
      };
    }
  }

  /**
   * Executar stage individual
   */
  async executeStage(stageId, documentPath, previousResults) {
    const stageConfig = STAGES[stageId.toUpperCase()];

    // Criar agente com modelo específico do stage
    const agent = new BedrockAgent({
      modelo: stageConfig.model,
      systemPrompt: this.buildStageSystemPrompt(stageId)
    });

    // Preparar input baseado no stage e resultados anteriores
    const input = await this.prepareStageInput(stageId, documentPath, previousResults);

    // Executar
    const result = await agent.enviar(input);

    if (!result.sucesso) {
      throw new Error(`Erro no stage ${stageId}: ${result.erro}`);
    }

    return {
      stageId,
      model: stageConfig.model,
      output: result.resposta,
      tokens: result.uso,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Preparar input para cada stage
   */
  async prepareStageInput(stageId, documentPath, previousResults) {
    const documentContent = await fs.readFile(documentPath, 'utf8');

    switch (stageId) {
      case 'leitura_massiva':
        return `Analise o seguinte processo jurídico e gere um resumo executivo completo, identificando:\n\n1. Fatos principais\n2. Partes envolvidas\n3. Pedidos\n4. Decisões importantes\n5. Fundamentos legais\n\nProcesso:\n${documentContent.substring(0, 500000)}`;

      case 'analise_profunda':
        const resumo = previousResults.leitura_massiva?.output || '';
        return `Com base no seguinte resumo de um processo jurídico, faça uma análise profunda identificando:\n\n1. Contradições ou omissões\n2. Pontos críticos que precisam fundamentação\n3. Teses jurídicas aplicáveis\n4. Precedentes relevantes\n\nResumo do Processo:\n${resumo}`;

      case 'fundamentacao':
        const analise = previousResults.analise_profunda?.output || '';
        return `Com base na seguinte análise jurídica, desenvolva fundamentação legal completa com:\n\n1. Artigos de lei aplicáveis (com explicação)\n2. Jurisprudência (com ementas)\n3. Doutrina\n4. Raciocínio jurídico passo a passo\n\nAnálise:\n${analise}`;

      case 'redacao':
        const fundamentacao = previousResults.fundamentacao?.output || '';
        return `Com base na seguinte fundamentação, redija a peça processual completa com:\n\n1. Estrutura formal adequada\n2. Linguagem jurídica técnica\n3. Fundamentação incorporada\n4. Pedidos claros\n\nFundamentação:\n${fundamentacao}`;

      case 'validacao':
        const rascunho = previousResults.redacao?.output || '';
        return `Revise a seguinte peça processual e sugira melhorias em:\n\n1. Argumentação jurídica\n2. Estrutura e clareza\n3. Fundamentação\n4. Linguagem técnica\n\nPeça:\n${rascunho}`;

      default:
        throw new Error(`Stage ${stageId} não reconhecido`);
    }
  }

  /**
   * System prompt específico para cada stage
   */
  buildStageSystemPrompt(stageId) {
    const basePrompt = `Você é um assistente jurídico especializado em Direito brasileiro.`;

    switch (stageId) {
      case 'leitura_massiva':
        return `${basePrompt}\n\nSua tarefa: Ler grandes volumes de texto processual e gerar resumos executivos completos, preservando todas as informações relevantes.`;

      case 'analise_profunda':
        return `${basePrompt}\n\nSua tarefa: Analisar processos jurídicos de forma profunda, identificando pontos críticos, contradições e oportunidades de fundamentação.`;

      case 'fundamentacao':
        return `${basePrompt}\n\nSua tarefa: Desenvolver fundamentação jurídica completa com citação de artigos de lei, jurisprudência e doutrina. Use raciocínio passo a passo.`;

      case 'redacao':
        return `${basePrompt}\n\nSua tarefa: Redigir peças processuais com linguagem jurídica técnica, estrutura formal adequada e fundamentação incorporada.`;

      case 'validacao':
        return `${basePrompt}\n\nSua tarefa: Revisar peças processuais e sugerir melhorias em argumentação, estrutura, fundamentação e linguagem técnica.`;

      default:
        return basePrompt;
    }
  }

  /**
   * Calcular custo estimado
   */
  calculateEstimatedCost(stages, documentPath) {
    // Estimativa simplificada baseada nos stages
    const costs = {
      leitura_massiva: 1.05,
      analise_profunda: 0.80,
      fundamentacao: 0.40,
      redacao: 1.20,
      validacao: 2.50
    };

    return stages.reduce((total, stageId) => {
      return total + (costs[stageId] || 0);
    }, 0);
  }

  /**
   * Salvar output final
   */
  async saveOutput(pipeline) {
    const outputFileName = `${pipeline.id}_${pipeline.config.outputType || 'output'}.txt`;
    const outputPath = path.join(this.outputPath, outputFileName);

    let content = `# RESULTADO DO MULTI-AGENT PIPELINE\n\n`;
    content += `Pipeline ID: ${pipeline.id}\n`;
    content += `Criado em: ${pipeline.createdAt}\n`;
    content += `Concluído em: ${pipeline.completedAt}\n`;
    content += `Modo: ${pipeline.config.mode}\n`;
    content += `Orçamento: ${pipeline.config.budget}\n`;
    content += `Custo estimado: $${pipeline.estimatedCost.toFixed(2)}\n\n`;
    content += `${'='.repeat(80)}\n\n`;

    // Adicionar resultados de cada stage
    for (const stageId of pipeline.stages) {
      const stageConfig = STAGES[stageId.toUpperCase()];
      const result = pipeline.results[stageId];

      content += `\n## ${stageConfig.icon} ${stageConfig.name}\n\n`;
      content += `${result.output}\n\n`;
      content += `${'='.repeat(80)}\n`;
    }

    await fs.writeFile(outputPath, content, 'utf8');

    return outputPath;
  }

  /**
   * Obter status do pipeline
   */
  getPipelineStatus(pipelineId) {
    const pipeline = this.pipelines.get(pipelineId);

    if (!pipeline) {
      return null;
    }

    return {
      id: pipeline.id,
      status: pipeline.status,
      currentStage: pipeline.currentStage,
      progress: pipeline.progress,
      estimatedCost: pipeline.estimatedCost,
      stages: pipeline.stages,
      error: pipeline.error
    };
  }

  /**
   * Listar todos os pipelines
   */
  listPipelines() {
    return Array.from(this.pipelines.values()).map(p => ({
      id: p.id,
      status: p.status,
      progress: p.progress,
      createdAt: p.createdAt,
      config: {
        mode: p.config.mode,
        budget: p.config.budget
      }
    }));
  }
}

// Singleton
const multiAgentPipelineService = new MultiAgentPipelineService();
export default multiAgentPipelineService;
