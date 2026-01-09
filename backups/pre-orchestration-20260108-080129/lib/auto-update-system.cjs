/**
 * Sistema Integrado de Auto-Atualização e Aprendizado
 * Centraliza todos os módulos e ativa automaticamente
 *
 * @version 1.0.0
 */

const PromptUpdater = require('./prompt-updater.cjs');
const AprendizadoAgregado = require('./aprendizado-agregado.cjs');
const PromptsVersioning = require('./prompts-versioning.cjs');
const crypto = require('crypto');

class AutoUpdateSystem {
  constructor() {
    console.log('🤖 Iniciando Sistema de Auto-Atualização...');

    this.promptUpdater = new PromptUpdater();
    this.aprendizadoAgregado = new AprendizadoAgregado();
    this.versioning = new PromptsVersioning();

    this.inicializado = false;
    this.ultimaVerificacao = null;
  }

  /**
   * Ativa o sistema completo
   */
  ativar() {
    if (this.inicializado) {
      console.log('⚠️ Sistema de Auto-Atualização já está ativo');
      return;
    }

    console.log('🚀 Ativando Sistema de Auto-Atualização...');

    // 1. Iniciar verificação periódica de prompts (24h)
    this.promptUpdater.iniciarVerificacaoPeriodica();
    console.log('✅ Verificação periódica de prompts ativada (a cada 24h)');

    // 2. Primeira verificação após 10 segundos
    setTimeout(() => {
      console.log('🔍 Executando primeira verificação de prompts...');
      this.executarVerificacao();
    }, 10000); // 10 segundos após iniciar

    this.inicializado = true;
    console.log('✅ Sistema de Auto-Atualização ATIVO E FUNCIONANDO');
    console.log('📊 Funcionalidades ativas:');
    console.log('   - Verificação automática de prompts (24h)');
    console.log('   - Coleta de feedback de usuários');
    console.log('   - Aprendizado agregado (federated learning)');
    console.log('   - Validação automática de qualidade');
    console.log('   - Versionamento de prompts');
  }

  /**
   * Executa verificação completa de prompts
   */
  async executarVerificacao() {
    try {
      const resultados = await this.promptUpdater.verificarTodosPrompts();
      this.ultimaVerificacao = new Date().toISOString();

      const problemas = resultados.filter(r => r.status === 'ATENÇÃO');

      if (problemas.length > 0) {
        console.log(`⚠️ Verificação completa: ${problemas.length} prompts precisam atenção`);
        problemas.forEach(p => {
          console.log(`   - ${p.arquivo}: ${p.analise.sugestoesAtualizacao.join(', ')}`);
        });
      } else {
        console.log(`✅ Verificação completa: Todos os ${resultados.length} prompts estão OK`);
      }

      return resultados;
    } catch (error) {
      console.error('❌ Erro na verificação de prompts:', error.message);
      return [];
    }
  }

  /**
   * Registra feedback de usuário
   * @param {Object} feedback - Feedback do usuário
   */
  async registrarFeedback(feedback) {
    try {
      // 1. Processar feedback no PromptUpdater (individual)
      await this.promptUpdater.processarFeedback(feedback);

      // 2. Agregar feedback global (anonimizado)
      this.aprendizadoAgregado.registrarFeedbackAgregado({
        promptId: feedback.promptId,
        tipoPeca: feedback.tipoPeca,
        ramoDireito: feedback.ramoDireito,
        regiao: feedback.regiao || 'BR',
        instancia: feedback.instancia,
        sucesso: feedback.rating >= 3, // Rating 1-5 (>=3 é sucesso)
        tempoGeracao: feedback.tempoGeracao,
        tamanhoTexto: feedback.peçaGerada?.length || 0,
        edicoesFeitasHash: this.hashEditions(feedback.ediçõesFeitas)
      });

      console.log(`📝 Feedback registrado: ${feedback.promptId} (Rating: ${feedback.rating}/5)`);

      return { success: true, message: 'Feedback registrado com sucesso' };
    } catch (error) {
      console.error('❌ Erro ao registrar feedback:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Propõe melhoria baseada em padrões identificados
   * @param {string} promptId - ID do prompt
   * @param {string} tipoMelhoria - Tipo de melhoria
   * @param {string} justificativa - Justificativa baseada em dados
   * @param {string} conteudoProposto - Novo conteúdo sugerido
   * @param {string} conteudoOriginal - Conteúdo atual
   * @returns {Object} Resultado da proposta
   */
  async proporMelhoria(promptId, tipoMelhoria, justificativa, conteudoProposto, conteudoOriginal) {
    try {
      const resultado = this.aprendizadoAgregado.proporMelhoria(
        promptId,
        tipoMelhoria,
        justificativa,
        conteudoProposto,
        conteudoOriginal
      );

      if (resultado.status === 'proposta_criada') {
        console.log(`💡 Nova melhoria proposta: ${promptId}`);
        console.log(`   Tipo: ${tipoMelhoria}`);
        console.log(`   Score: ${resultado.validacao.score}`);
        console.log(`   Status: Aguardando aprovação do master admin`);
      } else if (resultado.status === 'rejeitada_automaticamente') {
        console.log(`❌ Melhoria rejeitada automaticamente: ${promptId}`);
        console.log(`   Motivos: ${resultado.motivo.join(', ')}`);
      }

      return resultado;
    } catch (error) {
      console.error('❌ Erro ao propor melhoria:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Lista melhorias pendentes (para master admin)
   * @returns {Array} Lista de melhorias pendentes
   */
  listarMelhoriasPendentes() {
    return this.aprendizadoAgregado.listarMelhoriasPendentes();
  }

  /**
   * Aprova melhoria (apenas master admin)
   * @param {string} melhoriaId - ID da melhoria
   * @param {string} adminId - ID do admin que está aprovando
   * @returns {Object} Resultado da aprovação
   */
  async aprovarMelhoria(melhoriaId, adminId) {
    try {
      // Validar se é master admin
      if (adminId !== 'rom-master-admin' && adminId !== 'rodolfo-rom') {
        throw new Error('Apenas master admin pode aprovar melhorias');
      }

      // Aprovar no sistema de aprendizado
      const resultado = this.aprendizadoAgregado.aprovarMelhoria(melhoriaId, adminId);

      // Se aprovada, aplicar ao prompt global
      if (resultado.success) {
        const melhoria = resultado.melhoria;

        console.log(`✅ Melhoria ${melhoriaId} aprovada por ${adminId}`);
        console.log(`   Aplicando ao prompt global: ${melhoria.promptId}`);

        // TODO: Aplicar melhoria ao arquivo do prompt
        // (Por segurança, deixar manual por enquanto)

        console.log(`⚠️ AÇÃO NECESSÁRIA: Aplicar manualmente a melhoria ao arquivo:`);
        console.log(`   config/system_prompts/${melhoria.promptId}.md`);
      }

      return resultado;
    } catch (error) {
      console.error('❌ Erro ao aprovar melhoria:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Rejeita melhoria
   * @param {string} melhoriaId - ID da melhoria
   * @param {string} adminId - ID do admin
   * @param {string} motivo - Motivo da rejeição
   * @returns {Object} Resultado
   */
  async rejeitarMelhoria(melhoriaId, adminId, motivo) {
    try {
      if (adminId !== 'rom-master-admin' && adminId !== 'rodolfo-rom') {
        throw new Error('Apenas master admin pode rejeitar melhorias');
      }

      const resultado = this.aprendizadoAgregado.rejeitarMelhoria(
        melhoriaId,
        adminId,
        motivo
      );

      console.log(`❌ Melhoria ${melhoriaId} rejeitada por ${adminId}`);
      console.log(`   Motivo: ${motivo}`);

      return resultado;
    } catch (error) {
      console.error('❌ Erro ao rejeitar melhoria:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtém estatísticas do sistema
   * @returns {Object} Estatísticas gerais
   */
  obterEstatisticas() {
    return {
      sistemaAtivo: this.inicializado,
      ultimaVerificacao: this.ultimaVerificacao,
      aprendizado: this.aprendizadoAgregado.obterEstatisticasGerais(),
      modulos: {
        promptUpdater: 'Ativo',
        aprendizadoAgregado: 'Ativo',
        versioning: 'Ativo'
      }
    };
  }

  /**
   * Gera relatório completo para master admin
   * @returns {Object} Relatório completo
   */
  gerarRelatorioAdmin() {
    const stats = this.obterEstatisticas();
    const melhoriasPendentes = this.listarMelhoriasPendentes();
    const ultimaAnalise = this.aprendizadoAgregado.obterUltimaAnalise();

    return {
      timestamp: new Date().toISOString(),
      sistemaAtivo: this.inicializado,
      ultimaVerificacao: this.ultimaVerificacao,
      estatisticas: stats,
      melhoriasPendentes: {
        total: melhoriasPendentes.length,
        lista: melhoriasPendentes
      },
      ultimaAnalise,
      recomendacao: melhoriasPendentes.length > 0
        ? `Existem ${melhoriasPendentes.length} melhorias pendentes de aprovação`
        : 'Nenhuma melhoria pendente no momento. Sistema funcionando normalmente.'
    };
  }

  /**
   * Gera hash das edições (anonimiza conteúdo)
   * @param {string} edicoes - Texto das edições
   * @returns {string|null} Hash MD5
   */
  hashEditions(edicoes) {
    if (!edicoes) return null;
    return crypto.createHash('md5').update(edicoes).digest('hex');
  }

  /**
   * Verifica se sistema está saudável
   * @returns {Object} Status de saúde
   */
  healthCheck() {
    return {
      status: this.inicializado ? 'healthy' : 'not_initialized',
      timestamp: new Date().toISOString(),
      modulos: {
        promptUpdater: this.promptUpdater ? 'OK' : 'ERROR',
        aprendizadoAgregado: this.aprendizadoAgregado ? 'OK' : 'ERROR',
        versioning: this.versioning ? 'OK' : 'ERROR'
      },
      ultimaVerificacao: this.ultimaVerificacao
    };
  }
}

// Exportar instância única (singleton)
const autoUpdateSystem = new AutoUpdateSystem();
module.exports = autoUpdateSystem;
