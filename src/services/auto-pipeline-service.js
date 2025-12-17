/**
 * ROM Agent - Auto Pipeline Service
 * Orquestração automática: decide quando usar Pipeline vs Modelo Único
 *
 * FILOSOFIA:
 * - Modelo único = 90% dos casos (mais eficiente)
 * - Pipeline multi-agent = Casos excepc

ionais complexos
 * - Decisão automática baseada em contexto
 * - Transparência total para o usuário
 *
 * @version 2.5.0
 */

import modelSelectorService from './model-selector-service.js';
import { conversar } from '../modules/bedrock.js';

class AutoPipelineService {
  constructor() {
    this.pipelineConfig = {
      // Configuração do pipeline de 4 estágios
      stages: [
        {
          id: 'extração',
          modelo: 'haiku-4.5',
          prompt: 'Extraia e organize as informações principais do(s) documento(s)',
          maxTokens: 4096
        },
        {
          id: 'análise',
          modelo: 'sonnet-4.5',
          prompt: 'Analise criticamente as informações extraídas',
          maxTokens: 200000
        },
        {
          id: 'fundamentação',
          modelo: 'deepseek-r1',
          prompt: 'Desenvolva fundamentação jurídica completa',
          maxTokens: 16384
        },
        {
          id: 'redação',
          modelo: 'opus-4.5',
          prompt: 'Redija a peça final com máxima qualidade',
          maxTokens: 32000
        }
      ]
    };
  }

  /**
   * Processar automaticamente com a melhor estratégia
   *
   * @param {object} request - Requisição do usuário
   * @returns {Promise<object>} Resposta processada
   */
  async process(request) {
    const {
      prompt,
      tipo = null,
      documentos = [],
      prioridade = 'equilibrado',
      forcePipeline = false,
      forceModel = null,
      systemPrompt = null,
      historico = []
    } = request;

    // ═══════════════════════════════════════════════════════════
    // ETAPA 1: SELEÇÃO AUTOMÁTICA DE ESTRATÉGIA
    // ═══════════════════════════════════════════════════════════

    const selecao = modelSelectorService.selectModel({
      tipo,
      prompt,
      documentos,
      prioridade,
      forcePipeline,
      forceModel
    });

    console.log(`🤖 [AutoPipeline] Estratégia selecionada:`);
    console.log(`   Modelo: ${selecao.modeloNome}`);
    console.log(`   Vocação: ${selecao.vocacao}`);
    console.log(`   Motivo: ${selecao.motivo}`);
    console.log(`   Pipeline: ${selecao.usarPipeline ? 'SIM' : 'NÃO'}`);
    console.log(`   Confiança: ${selecao.confianca}%`);

    // ═══════════════════════════════════════════════════════════
    // ETAPA 2: EXECUÇÃO
    // ═══════════════════════════════════════════════════════════

    let resultado;

    if (selecao.usarPipeline) {
      // Usar pipeline multi-agent (raro)
      resultado = await this.executePipeline({
        prompt,
        tipo,
        documentos,
        systemPrompt,
        historico
      });
    } else {
      // Usar modelo único (padrão - 90% dos casos)
      resultado = await this.executeSingleModel({
        prompt,
        modelo: selecao.modelo,
        modeloNome: selecao.modeloNome,
        systemPrompt,
        historico,
        maxTokens: selecao.metadata.tokens
      });
    }

    // Adicionar metadados da seleção
    resultado.selecao = {
      estrategia: selecao.usarPipeline ? 'pipeline' : 'modelo-unico',
      modelo: selecao.modeloNome,
      vocacao: selecao.vocacao,
      motivo: selecao.motivo,
      confianca: selecao.confianca,
      custoRelativo: selecao.metadata.custoRelativo,
      qualidade: selecao.metadata.qualidade
    };

    return resultado;
  }

  /**
   * Executar com modelo único (PADRÃO - 90% dos casos)
   */
  async executeSingleModel(config) {
    const {
      prompt,
      modelo,
      modeloNome,
      systemPrompt,
      historico,
      maxTokens
    } = config;

    console.log(`✨ [AutoPipeline] Executando com modelo único: ${modeloNome}`);

    const startTime = Date.now();

    const resposta = await conversar(prompt, {
      modelo,
      systemPrompt,
      historico,
      maxTokens,
      enableTools: true  // Tools sempre habilitadas
    });

    const endTime = Date.now();
    const duracao = endTime - startTime;

    console.log(`✅ [AutoPipeline] Concluído em ${(duracao / 1000).toFixed(1)}s`);

    return {
      sucesso: resposta.sucesso,
      resposta: resposta.resposta,
      modelo: modeloNome,
      estrategia: 'modelo-unico',
      duracao,
      uso: resposta.uso,
      toolsUsadas: resposta.toolsUsadas,
      raciocinio: resposta.raciocinio
    };
  }

  /**
   * Executar pipeline multi-agent (EXCEÇÃO - 10% dos casos)
   */
  async executePipeline(config) {
    const {
      prompt,
      tipo,
      documentos,
      systemPrompt,
      historico
    } = config;

    console.log(`🔄 [AutoPipeline] Executando pipeline multi-agent (4 estágios)`);

    const startTime = Date.now();
    const resultados = [];
    let contextoAcumulado = prompt;

    // Executar cada estágio do pipeline
    for (const [index, stage] of this.pipelineConfig.stages.entries()) {
      console.log(`   Estágio ${index + 1}/4: ${stage.id} (${stage.modelo})`);

      const stageStartTime = Date.now();

      // Construir prompt do estágio
      const stagePrompt = this.buildStagePrompt(stage, contextoAcumulado, tipo);

      // Executar estágio
      const resposta = await conversar(stagePrompt, {
        modelo: stage.modelo,
        systemPrompt,
        historico: index === 0 ? historico : [],  // Histórico só no primeiro
        maxTokens: stage.maxTokens,
        enableTools: index === 0  // Tools apenas no primeiro estágio
      });

      const stageDuracao = Date.now() - stageStartTime;

      // Armazenar resultado do estágio
      resultados.push({
        estagio: stage.id,
        modelo: stage.modelo,
        resposta: resposta.resposta,
        duracao: stageDuracao,
        tokens: resposta.uso
      });

      // Acumular contexto para próximo estágio
      contextoAcumulado = resposta.resposta;

      console.log(`   ✅ ${stage.id} concluído em ${(stageDuracao / 1000).toFixed(1)}s`);
    }

    const endTime = Date.now();
    const duracaoTotal = endTime - startTime;

    console.log(`✅ [AutoPipeline] Pipeline concluído em ${(duracaoTotal / 1000).toFixed(1)}s`);

    // Resposta final é do último estágio (redação)
    const respostaFinal = resultados[resultados.length - 1].resposta;

    return {
      sucesso: true,
      resposta: respostaFinal,
      modelo: 'pipeline-multi-agent',
      estrategia: 'pipeline',
      duracao: duracaoTotal,
      estagios: resultados,
      uso: {
        tokensEntrada: resultados.reduce((sum, r) => sum + (r.tokens?.tokensEntrada || 0), 0),
        tokensSaida: resultados.reduce((sum, r) => sum + (r.tokens?.tokensSaida || 0), 0),
        tokensTotal: resultados.reduce((sum, r) => sum + (r.tokens?.tokensTotal || 0), 0)
      }
    };
  }

  /**
   * Construir prompt específico para cada estágio do pipeline
   */
  buildStagePrompt(stage, contexto, tipo) {
    let prompt = '';

    switch (stage.id) {
      case 'extração':
        prompt = `${stage.prompt}:\n\n${contexto}`;
        break;

      case 'análise':
        prompt = `${stage.prompt}. Informações extraídas:\n\n${contexto}`;
        break;

      case 'fundamentação':
        prompt = `${stage.prompt} para ${tipo || 'a peça judicial'}. Análise:\n\n${contexto}`;
        break;

      case 'redação':
        prompt = `${stage.prompt}. Fundamentação:\n\n${contexto}`;
        break;

      default:
        prompt = `${stage.prompt}:\n\n${contexto}`;
    }

    return prompt;
  }

  /**
   * Processar em modo streaming (para UI em tempo real)
   */
  async processStream(request, onChunk) {
    // TODO: Implementar streaming
    console.warn('⚠️ Streaming ainda não implementado, usando processamento normal');
    return this.process(request);
  }

  /**
   * Obter estatísticas de uso (futuro)
   */
  async getStats() {
    return {
      totalProcessado: 0,
      modeloUnicoUsado: 0,
      pipelineUsado: 0,
      tempoMedioModeloUnico: 0,
      tempoMedioPipeline: 0,
      economiaTokens: 0,
      message: 'Estatísticas serão implementadas em versão futura'
    };
  }

  /**
   * Forçar uso de modelo específico (override manual)
   */
  async processWithModel(prompt, modelo, options = {}) {
    return this.process({
      prompt,
      forceModel: modelo,
      forcePipeline: false,
      ...options
    });
  }

  /**
   * Forçar uso de pipeline (override manual)
   */
  async processWithPipeline(prompt, tipo, options = {}) {
    return this.process({
      prompt,
      tipo,
      forcePipeline: true,
      ...options
    });
  }
}

// Singleton
const autoPipelineService = new AutoPipelineService();

export default autoPipelineService;
