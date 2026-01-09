/**
 * Sistema de Aprendizado Agregado (Federated Learning)
 *
 * Objetivo: ROM global aprende com experiência de TODOS os parceiros e usuários
 *
 * Fluxo:
 * 1. Cada parceiro/usuário usa o sistema
 * 2. Feedback é coletado (edições, ratings, erros)
 * 3. Sistema agrega dados de TODOS (anonimizado)
 * 4. IA identifica padrões e propõe melhorias
 * 5. Master admin (Rodolfo) revisa e aprova
 * 6. Melhoria é aplicada aos prompts GLOBAIS
 * 7. Todos os parceiros se beneficiam 🚀
 *
 * Privacidade: Dados agregados, não individuais
 */

const fs = require('fs');
const path = require('path');

class AprendizadoAgregado {
  constructor() {
    this.feedbackGlobalPath = path.join(__dirname, '../logs/feedback_agregado.json');
    this.melhoriasSugeridasPath = path.join(__dirname, '../logs/melhorias_sugeridas.json');
    this.padroesIdentificadosPath = path.join(__dirname, '../logs/padroes_identificados.json');

    this.ensureFiles();
  }

  ensureFiles() {
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    [this.feedbackGlobalPath, this.melhoriasSugeridasPath, this.padroesIdentificadosPath].forEach(file => {
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify([], null, 2));
      }
    });
  }

  /**
   * Registra feedback de uso (agregado de todos os parceiros)
   * @param {Object} feedback - Feedback anonimizado
   */
  registrarFeedbackAgregado(feedback) {
    const feedbacks = JSON.parse(fs.readFileSync(this.feedbackGlobalPath, 'utf8'));

    feedbacks.push({
      id: `fb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      promptId: feedback.promptId,
      tipoPeca: feedback.tipoPeca,
      ramoDireito: feedback.ramoDireito,
      // Dados anonimizados (sem identificar usuário/parceiro específico)
      regiao: feedback.regiao || 'BR',
      instancia: feedback.instancia,
      sucesso: feedback.sucesso,
      tempoGeracao: feedback.tempoGeracao,
      tamanhoTexto: feedback.tamanhoTexto,
      edicoesFeitasHash: feedback.edicoesFeitasHash, // Hash das edições (não o texto)
      timestamp: new Date().toISOString()
    });

    // Manter últimos 10.000 feedbacks
    if (feedbacks.length > 10000) {
      feedbacks.splice(0, feedbacks.length - 10000);
    }

    fs.writeFileSync(this.feedbackGlobalPath, JSON.stringify(feedbacks, null, 2));

    // Análise periódica após cada 100 feedbacks
    if (feedbacks.length % 100 === 0) {
      console.log(`📊 ${feedbacks.length} feedbacks coletados. Analisando padrões...`);
      this.analisarPadroesAgregados();
    }
  }

  /**
   * Analisa padrões agregados de uso de TODOS os parceiros
   * Identifica:
   * - Prompts mais usados
   * - Taxas de sucesso
   * - Tipos de edições comuns
   * - Problemas recorrentes
   */
  analisarPadroesAgregados() {
    const feedbacks = JSON.parse(fs.readFileSync(this.feedbackGlobalPath, 'utf8'));

    if (feedbacks.length < 50) {
      console.log('⚠️ Poucos dados para análise agregada (mínimo 50 feedbacks)');
      return;
    }

    const padroes = {
      timestamp: new Date().toISOString(),
      totalFeedbacks: feedbacks.length,
      analisePorPrompt: {},
      analisePorRamo: {},
      analisePorInstancia: {},
      problemasRecorrentes: [],
      sugestoesMelhoria: []
    };

    // 1. Análise por Prompt
    feedbacks.forEach(fb => {
      if (!padroes.analisePorPrompt[fb.promptId]) {
        padroes.analisePorPrompt[fb.promptId] = {
          usos: 0,
          sucessos: 0,
          falhas: 0,
          tempoMedio: 0,
          tamanhoMedio: 0
        };
      }

      const p = padroes.analisePorPrompt[fb.promptId];
      p.usos++;
      if (fb.sucesso) p.sucessos++;
      else p.falhas++;
      p.tempoMedio = (p.tempoMedio * (p.usos - 1) + (fb.tempoGeracao || 0)) / p.usos;
      p.tamanhoMedio = (p.tamanhoMedio * (p.usos - 1) + (fb.tamanhoTexto || 0)) / p.usos;
    });

    // Calcular taxas de sucesso
    Object.keys(padroes.analisePorPrompt).forEach(promptId => {
      const p = padroes.analisePorPrompt[promptId];
      p.taxaSucesso = (p.sucessos / p.usos * 100).toFixed(2) + '%';
    });

    // 2. Análise por Ramo do Direito
    feedbacks.forEach(fb => {
      if (fb.ramoDireito) {
        if (!padroes.analisePorRamo[fb.ramoDireito]) {
          padroes.analisePorRamo[fb.ramoDireito] = { usos: 0, sucessos: 0 };
        }
        padroes.analisePorRamo[fb.ramoDireito].usos++;
        if (fb.sucesso) padroes.analisePorRamo[fb.ramoDireito].sucessos++;
      }
    });

    // 3. Análise por Instância
    feedbacks.forEach(fb => {
      if (fb.instancia) {
        if (!padroes.analisePorInstancia[fb.instancia]) {
          padroes.analisePorInstancia[fb.instancia] = { usos: 0 };
        }
        padroes.analisePorInstancia[fb.instancia].usos++;
      }
    });

    // 4. Identificar Problemas Recorrentes
    // Prompts com taxa de sucesso < 70%
    Object.entries(padroes.analisePorPrompt).forEach(([promptId, dados]) => {
      const taxaSucessoNum = parseFloat(dados.taxaSucesso);
      if (taxaSucessoNum < 70 && dados.usos >= 10) {
        padroes.problemasRecorrentes.push({
          promptId,
          problema: `Taxa de sucesso baixa (${dados.taxaSucesso})`,
          usos: dados.usos,
          prioridade: 'ALTA'
        });
      }
    });

    // 5. Gerar Sugestões de Melhoria
    // Prompts mais usados merecem atenção especial
    const promptsMaisUsados = Object.entries(padroes.analisePorPrompt)
      .sort((a, b) => b[1].usos - a[1].usos)
      .slice(0, 5)
      .map(([promptId, dados]) => ({
        promptId,
        usos: dados.usos,
        taxaSucesso: dados.taxaSucesso
      }));

    padroes.sugestoesMelhoria.push({
      tipo: 'OTIMIZACAO',
      descricao: 'Prompts mais usados devem ser otimizados prioritariamente',
      prompts: promptsMaisUsados
    });

    // Salvar padrões identificados
    const padroesHistorico = JSON.parse(fs.readFileSync(this.padroesIdentificadosPath, 'utf8'));
    padroesHistorico.push(padroes);

    // Manter últimas 50 análises
    if (padroesHistorico.length > 50) {
      padroesHistorico.splice(0, padroesHistorico.length - 50);
    }

    fs.writeFileSync(this.padroesIdentificadosPath, JSON.stringify(padroesHistorico, null, 2));

    console.log(`✅ Análise agregada concluída:`);
    console.log(`   📊 ${Object.keys(padroes.analisePorPrompt).length} prompts analisados`);
    console.log(`   ⚠️ ${padroes.problemasRecorrentes.length} problemas identificados`);
    console.log(`   💡 ${padroes.sugestoesMelhoria.length} sugestões de melhoria`);

    return padroes;
  }

  /**
   * Valida se melhoria AUMENTA excelência (não empobrece)
   * @param {string} conteudoOriginal - Conteúdo atual do prompt
   * @param {string} conteudoProposto - Conteúdo proposto
   * @returns {Object} { valida: boolean, motivo: string, score: number }
   */
  validarQualidade(conteudoOriginal, conteudoProposto) {
    const validacao = {
      valida: true,
      motivo: [],
      score: 0,
      criterios: {}
    };

    // 1. NÃO pode REDUZIR tamanho significativamente (simplificação excessiva)
    const reducaoTamanho = ((conteudoOriginal.length - conteudoProposto.length) / conteudoOriginal.length) * 100;
    validacao.criterios.tamanho = reducaoTamanho < 20; // Não pode reduzir mais de 20%
    if (reducaoTamanho >= 20) {
      validacao.valida = false;
      validacao.motivo.push(`REDUÇÃO EXCESSIVA: ${reducaoTamanho.toFixed(1)}% menor (empobrece conteúdo)`);
    } else if (reducaoTamanho < 0) {
      validacao.score += 10; // Aumentou tamanho (adicionou conteúdo)
    }

    // 2. NÃO pode REMOVER dispositivos legais (Art. XXX)
    const dispositivosOriginal = (conteudoOriginal.match(/Art\.?\s+\d+/gi) || []).length;
    const dispositivosProposto = (conteudoProposto.match(/Art\.?\s+\d+/gi) || []).length;
    validacao.criterios.dispositivos = dispositivosProposto >= dispositivosOriginal;
    if (dispositivosProposto < dispositivosOriginal) {
      validacao.valida = false;
      validacao.motivo.push(`REMOÇÃO DE DISPOSITIVOS: ${dispositivosOriginal - dispositivosProposto} artigos removidos`);
    } else if (dispositivosProposto > dispositivosOriginal) {
      validacao.score += 15; // Adicionou mais fundamentação legal
    }

    // 3. NÃO pode REMOVER jurisprudência
    const jurisOriginal = (conteudoOriginal.match(/STF|STJ|Súmula/gi) || []).length;
    const jurisProposto = (conteudoProposto.match(/STF|STJ|Súmula/gi) || []).length;
    validacao.criterios.jurisprudencia = jurisProposto >= jurisOriginal;
    if (jurisProposto < jurisOriginal) {
      validacao.valida = false;
      validacao.motivo.push(`REMOÇÃO DE JURISPRUDÊNCIA: ${jurisOriginal - jurisProposto} referências removidas`);
    } else if (jurisProposto > jurisOriginal) {
      validacao.score += 20; // Adicionou jurisprudência (MUITO BOM!)
    }

    // 4. DEVE aumentar qualidade técnica
    const palavrasTecnicas = [
      'fundamento', 'jurisprudência', 'precedente', 'tese', 'doutrina',
      'princípio', 'interpretação', 'hermenêutica', 'exegese'
    ];
    const tecnicasOriginal = palavrasTecnicas.filter(p => conteudoOriginal.toLowerCase().includes(p)).length;
    const tecnicasProposto = palavrasTecnicas.filter(p => conteudoProposto.toLowerCase().includes(p)).length;
    validacao.criterios.tecnicidade = tecnicasProposto >= tecnicasOriginal;
    if (tecnicasProposto < tecnicasOriginal) {
      validacao.score -= 10; // Perdeu tecnicidade
    } else if (tecnicasProposto > tecnicasOriginal) {
      validacao.score += 10; // Aumentou tecnicidade
    }

    // 5. DEVE ter seções/estrutura organizada
    const secoesOriginal = (conteudoOriginal.match(/^##\s+/gm) || []).length;
    const secoesProposto = (conteudoProposto.match(/^##\s+/gm) || []).length;
    validacao.criterios.estrutura = secoesProposto >= secoesOriginal;
    if (secoesProposto < secoesOriginal) {
      validacao.score -= 5; // Perdeu organização
    } else if (secoesProposto > secoesOriginal) {
      validacao.score += 5; // Melhor organização
    }

    // 6. VERIFICA mudanças legislativas (deve atualizar)
    const anosOriginal = (conteudoOriginal.match(/20\d{2}/g) || []).map(Number);
    const anosProposto = (conteudoProposto.match(/20\d{2}/g) || []).map(Number);
    const anoMaisRecenteOriginal = Math.max(...anosOriginal, 2020);
    const anoMaisRecenteProposto = Math.max(...anosProposto, 2020);
    if (anoMaisRecenteProposto > anoMaisRecenteOriginal) {
      validacao.score += 15; // Atualizou legislação (ÓTIMO!)
    }

    // DECISÃO FINAL
    if (!validacao.valida) {
      validacao.motivo.unshift('❌ MELHORIA REJEITADA AUTOMATICAMENTE');
      validacao.recomendacao = 'Melhoria empobrece conteúdo. Não deve ser aplicada.';
    } else if (validacao.score < 10) {
      validacao.valida = false;
      validacao.motivo.push('SCORE INSUFICIENTE: Melhoria não adiciona valor significativo');
      validacao.recomendacao = 'Melhoria não aumenta excelência técnica suficientemente.';
    } else {
      validacao.motivo.unshift(`✅ MELHORIA VÁLIDA (Score: ${validacao.score})`);
      validacao.recomendacao = 'Melhoria aumenta excelência técnica. Recomendada para aprovação.';
    }

    return validacao;
  }

  /**
   * Propõe melhoria baseada em dados agregados
   * @param {string} promptId - ID do prompt
   * @param {string} tipoMelhoria - Tipo de melhoria proposta
   * @param {string} justificativa - Justificativa baseada em dados
   * @param {string} conteudoProposto - Novo conteúdo sugerido
   * @param {string} conteudoOriginal - Conteúdo atual (para validação)
   * @returns {Object} ID da proposta
   */
  proporMelhoria(promptId, tipoMelhoria, justificativa, conteudoProposto, conteudoOriginal) {
    // 🔍 VALIDAÇÃO DE QUALIDADE (só aceita melhorias que AUMENTAM excelência)
    const validacao = this.validarQualidade(conteudoOriginal, conteudoProposto);

    if (!validacao.valida) {
      console.log(`❌ Melhoria rejeitada automaticamente:`);
      validacao.motivo.forEach(m => console.log(`   ${m}`));
      return {
        status: 'rejeitada_automaticamente',
        motivo: validacao.motivo,
        validacao
      };
    }

    const melhorias = JSON.parse(fs.readFileSync(this.melhoriasSugeridasPath, 'utf8'));

    const novaMelhoria = {
      id: `melhoria-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      promptId,
      tipo: tipoMelhoria, // 'correcao', 'otimizacao', 'atualizacao_legal', etc
      justificativa,
      conteudoProposto,
      status: 'pendente', // 'pendente', 'aprovada', 'rejeitada'
      qualityScore: validacao.score,
      validacao,
      criadaEm: new Date().toISOString(),
      criadaPor: 'sistema-aprendizado-agregado',
      aprovadaEm: null,
      aprovadaPor: null
    };

    melhorias.push(novaMelhoria);
    fs.writeFileSync(this.melhoriasSugeridasPath, JSON.stringify(melhorias, null, 2));

    console.log(`💡 Nova melhoria proposta: ${promptId} (${tipoMelhoria}) - Score: ${validacao.score}`);

    return { id: novaMelhoria.id, status: 'proposta_criada', validacao };
  }

  /**
   * Lista melhorias pendentes de aprovação (para master_admin)
   * @returns {Array} Lista de melhorias pendentes
   */
  listarMelhoriasPendentes() {
    const melhorias = JSON.parse(fs.readFileSync(this.melhoriasSugeridasPath, 'utf8'));
    return melhorias.filter(m => m.status === 'pendente');
  }

  /**
   * Aprova melhoria e aplica ao prompt global
   * @param {string} melhoriaId - ID da melhoria
   * @param {string} approvedBy - Quem aprovou (userId do master_admin)
   * @returns {Object} Resultado
   */
  aprovarMelhoria(melhoriaId, approvedBy) {
    const melhorias = JSON.parse(fs.readFileSync(this.melhoriasSugeridasPath, 'utf8'));
    const melhoria = melhorias.find(m => m.id === melhoriaId);

    if (!melhoria) {
      throw new Error('Melhoria não encontrada');
    }

    if (melhoria.status !== 'pendente') {
      throw new Error(`Melhoria já foi ${melhoria.status}`);
    }

    // Atualizar status
    melhoria.status = 'aprovada';
    melhoria.aprovadaEm = new Date().toISOString();
    melhoria.aprovadaPor = approvedBy;

    fs.writeFileSync(this.melhoriasSugeridasPath, JSON.stringify(melhorias, null, 2));

    console.log(`✅ Melhoria ${melhoriaId} aprovada por ${approvedBy}`);
    console.log(`   🔄 Aplicando ao prompt global: ${melhoria.promptId}`);

    return {
      success: true,
      message: 'Melhoria aprovada. Aplicar ao prompt global manualmente ou via integração.',
      melhoria
    };
  }

  /**
   * Rejeita melhoria
   * @param {string} melhoriaId - ID da melhoria
   * @param {string} rejectedBy - Quem rejeitou
   * @param {string} motivo - Motivo da rejeição
   * @returns {Object} Resultado
   */
  rejeitarMelhoria(melhoriaId, rejectedBy, motivo) {
    const melhorias = JSON.parse(fs.readFileSync(this.melhoriasSugeridasPath, 'utf8'));
    const melhoria = melhorias.find(m => m.id === melhoriaId);

    if (!melhoria) {
      throw new Error('Melhoria não encontrada');
    }

    melhoria.status = 'rejeitada';
    melhoria.rejeitadaEm = new Date().toISOString();
    melhoria.rejeitadaPor = rejectedBy;
    melhoria.motivoRejeicao = motivo;

    fs.writeFileSync(this.melhoriasSugeridasPath, JSON.stringify(melhorias, null, 2));

    console.log(`❌ Melhoria ${melhoriaId} rejeitada por ${rejectedBy}: ${motivo}`);

    return { success: true, message: 'Melhoria rejeitada' };
  }

  /**
   * Obtém estatísticas de aprendizado agregado
   * @returns {Object} Estatísticas gerais
   */
  obterEstatisticasGerais() {
    const feedbacks = JSON.parse(fs.readFileSync(this.feedbackGlobalPath, 'utf8'));
    const melhorias = JSON.parse(fs.readFileSync(this.melhoriasSugeridasPath, 'utf8'));
    const padroes = JSON.parse(fs.readFileSync(this.padroesIdentificadosPath, 'utf8'));

    return {
      totalFeedbacks: feedbacks.length,
      totalMelhoriasSugeridas: melhorias.length,
      melhoriasPendentes: melhorias.filter(m => m.status === 'pendente').length,
      melhoriasAprovadas: melhorias.filter(m => m.status === 'aprovada').length,
      melhoriasRejeitadas: melhorias.filter(m => m.status === 'rejeitada').length,
      ultimaAnalise: padroes[padroes.length - 1]?.timestamp || null,
      sistemasAprendendo: true,
      impacto: `Melhorias aprovadas beneficiam TODOS os ${this.contarParceiros()} escritórios parceiros`
    };
  }

  /**
   * Conta número de parceiros (mock - implementar baseado em partners-branding)
   */
  contarParceiros() {
    // TODO: Integrar com partners-branding para contar parceiros reais
    return 5; // Placeholder
  }

  /**
   * Gera relatório de aprendizado agregado para master_admin
   */
  gerarRelatorio() {
    const stats = this.obterEstatisticasGerais();
    const melhoriasPendentes = this.listarMelhoriasPendentes();
    const ultimaAnalise = this.obterUltimaAnalise();

    return {
      estatisticas: stats,
      melhoriasPendentes,
      ultimaAnalise,
      recomendacao: melhoriasPendentes.length > 0 ?
        `Existem ${melhoriasPendentes.length} melhorias pendentes de sua aprovação` :
        'Nenhuma melhoria pendente no momento'
    };
  }

  /**
   * Obtém última análise de padrões
   */
  obterUltimaAnalise() {
    const padroes = JSON.parse(fs.readFileSync(this.padroesIdentificadosPath, 'utf8'));
    return padroes[padroes.length - 1] || null;
  }
}

module.exports = AprendizadoAgregado;
