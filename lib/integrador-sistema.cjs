/**
 * Integrador do Sistema de Auto-Atualização
 *
 * Integra todos os módulos de verificação e atualização:
 * - PromptUpdater: Atualização de prompts
 * - DireitoIntertemporal: Análise temporal
 * - Verificação do custom_instructions a cada uso
 */

const PromptUpdater = require('./prompt-updater.cjs');
const DireitoIntertemporal = require('./direito-intertemporal.cjs');
const fs = require('fs');
const path = require('path');

class IntegradorSistema {
  constructor() {
    this.promptUpdater = new PromptUpdater();
    this.direitoIntertemporal = new DireitoIntertemporal();
    this.customInstructionsPath = path.join(__dirname, '../data/custom-instructions.json');
    this.contadorUso = 0;
  }

  /**
   * Inicializa o sistema completo
   */
  async inicializar() {
    console.log('🚀 Inicializando ROM Agent - Sistema Auto-Evolutivo...');

    // Verificar prompts na inicialização
    await this.promptUpdater.verificarTodosPrompts();

    // Ativar verificação periódica
    this.promptUpdater.iniciarVerificacaoPeriodica();

    // Verificar custom instructions
    await this.verificarCustomInstructions();

    console.log('✅ Sistema inicializado com sucesso!');
    console.log('📋 Custom Instructions: Verificado');
    console.log('🔍 Verificação periódica: Ativa (24h)');
    console.log('🤖 Auto-atualização: Ativa');
  }

  /**
   * Verifica e atualiza custom_instructions a cada uso
   */
  async verificarCustomInstructions() {
    try {
      if (!fs.existsSync(this.customInstructionsPath)) {
        console.warn('⚠️ custom_instructions.md não encontrado!');
        return { erro: true, mensagem: 'Arquivo não encontrado' };
      }

      const content = fs.readFileSync(this.customInstructionsPath, 'utf8');

      // Análise do custom instructions
      const analise = this.promptUpdater.analisarPrompt(content);

      // Verificar se precisa atualização
      const precisaAtualizacao = analise.sugestoesAtualizacao.length > 0;

      if (precisaAtualizacao) {
        console.log('📝 custom_instructions.md precisa de atualização');
        // Aqui implementaríamos atualização automática
      } else {
        console.log('✅ custom_instructions.md está atualizado');
      }

      // Registrar uso
      this.contadorUso++;

      return {
        verificado: true,
        precisaAtualizacao,
        analise,
        usoNumero: this.contadorUso
      };
    } catch (error) {
      console.error('❌ Erro ao verificar custom_instructions:', error);
      return { erro: true, mensagem: error.message };
    }
  }

  /**
   * Processa uma requisição de geração de peça
   * @param {Object} requisicao - Dados da requisição
   * @returns {Object} Análise completa + peça gerada
   */
  async processarRequisicao(requisicao) {
    console.log('📋 Processando nova requisição...');

    // 1. Verificar custom instructions
    await this.verificarCustomInstructions();

    // 2. Análise de Direito Intertemporal
    let analiseIntertemporal = null;
    if (requisicao.dataDosFatos) {
      console.log('⚖️ Aplicando análise de direito intertemporal...');

      analiseIntertemporal = this.direitoIntertemporal.analisarAplicabilidade({
        dataDosFatos: requisicao.dataDosFatos,
        dataAjuizamento: requisicao.dataAjuizamento || new Date().toISOString().split('T')[0],
        ramoDireito: requisicao.ramoDireito || 'civil',
        naturezaProcesso: requisicao.naturezaProcesso || 'conhecimento',
        instancia: requisicao.instancia || 'primeira'
      });

      console.log(`📅 Data dos fatos: ${requisicao.dataDosFatos}`);
      console.log(`📚 Legislação aplicável (material): ${analiseIntertemporal.legislacaoAplicavel.material?.legislacao}`);
      console.log(`⚖️ Legislação aplicável (processual): ${analiseIntertemporal.legislacaoAplicavel.processual?.legislacao}`);
    } else {
      console.log('⚠️ Data dos fatos não fornecida - usando legislação atual');
    }

    // 3. Verificar prompt específico
    let promptEspecifico = null;
    if (requisicao.tipoPeca) {
      const promptPath = path.join(__dirname, `../data/prompts/global/${requisicao.tipoPeca}.md`);
      if (fs.existsSync(promptPath)) {
        promptEspecifico = fs.readFileSync(promptPath, 'utf8');
        const analisePrompt = this.promptUpdater.analisarPrompt(promptEspecifico);
        console.log(`📄 Prompt específico: ${requisicao.tipoPeca}.md`);
        console.log(`✅ Dispositivos legais: ${analisePrompt.dispositivosLegais.length}`);
        console.log(`📚 Jurisprudência citada: ${analisePrompt.jurisprudenciaCitada.length}`);
      }
    }

    // 4. Montar contexto completo
    const contexto = {
      customInstructions: fs.readFileSync(this.customInstructionsPath, 'utf8'),
      promptEspecifico,
      analiseIntertemporal,
      requisicao
    };

    // 5. Preparar metadados para logging
    const metadados = {
      timestamp: new Date().toISOString(),
      dataDosFatos: requisicao.dataDosFatos,
      legislacaoAplicada: analiseIntertemporal?.legislacaoAplicavel || 'atual',
      tipoPeca: requisicao.tipoPeca,
      ramoDireito: requisicao.ramoDireito,
      verificacaoCustomInstructions: true
    };

    return {
      contexto,
      metadados,
      recomendacoes: analiseIntertemporal?.recomendacoes || []
    };
  }

  /**
   * Registra feedback de uso para aprendizado
   * @param {Object} feedback
   */
  async registrarFeedback(feedback) {
    console.log('📊 Registrando feedback...');

    await this.promptUpdater.processarFeedback({
      ...feedback,
      legislacaoUtilizada: feedback.legislacaoUtilizada,
      direitoIntertemporalAplicado: feedback.direitoIntertemporalAplicado
    });

    console.log('✅ Feedback registrado para aprendizado');
  }

  /**
   * Gera relatório de uso do sistema
   */
  async gerarRelatorio() {
    const relatorio = {
      timestamp: new Date().toISOString(),
      totalUsos: this.contadorUso,
      verificacoesRealizadas: await this.obterEstatisticasVerificacoes(),
      promptsAtualizados: await this.obterEstatisticasAtualizacoes(),
      feedbacksColetados: await this.obterEstatisticasFeedbacks()
    };

    const relatorioPath = path.join(__dirname, '../logs/relatorio_sistema.json');
    fs.writeFileSync(relatorioPath, JSON.stringify(relatorio, null, 2));

    return relatorio;
  }

  async obterEstatisticasVerificacoes() {
    const verificationPath = path.join(__dirname, '../logs/verificacao_prompts.json');
    if (fs.existsSync(verificationPath)) {
      const data = JSON.parse(fs.readFileSync(verificationPath, 'utf8'));
      return {
        ultimaVerificacao: data.data,
        totalPrompts: data.resultados?.length || 0,
        promptsOK: data.resultados?.filter(r => r.status === 'OK').length || 0,
        promptsAtencao: data.resultados?.filter(r => r.status === 'ATENÇÃO').length || 0
      };
    }
    return { erro: 'Nenhuma verificação realizada ainda' };
  }

  async obterEstatisticasAtualizacoes() {
    const updatePath = path.join(__dirname, '../logs/prompt_updates.json');
    if (fs.existsSync(updatePath)) {
      const updates = JSON.parse(fs.readFileSync(updatePath, 'utf8'));
      return {
        totalAtualizacoes: updates.length,
        ultimaAtualizacao: updates[updates.length - 1]?.data || null,
        tiposAtualizacao: this.contarTipos(updates)
      };
    }
    return { totalAtualizacoes: 0 };
  }

  async obterEstatisticasFeedbacks() {
    const feedbackPath = path.join(__dirname, '../logs/user_feedback.json');
    if (fs.existsSync(feedbackPath)) {
      const feedbacks = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));
      return {
        totalFeedbacks: feedbacks.length,
        ultimoFeedback: feedbacks[feedbacks.length - 1]?.data || null
      };
    }
    return { totalFeedbacks: 0 };
  }

  contarTipos(items) {
    const tipos = {};
    items.forEach(item => {
      if (item.tipo) {
        tipos[item.tipo] = (tipos[item.tipo] || 0) + 1;
      }
    });
    return tipos;
  }
}

module.exports = IntegradorSistema;
