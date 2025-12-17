/**
 * ROM Agent - Integração de Jurimetria ao Case Processor
 *
 * Este módulo adiciona análise jurímétrica ao processamento de casos:
 * - Análise de padrão de julgamento do magistrado prevento
 * - Cotejamento analítico com precedentes
 * - Geração de tabelas comparativas
 * - Distinguishing automático
 *
 * INTEGRAÇÃO: Adiciona Layer 4.5 entre jurisprudência e redação
 *
 * @version 1.0.0
 */

import jurimetriaService from '../jurimetria-service.js';
import jurimetriaFormatterService from '../jurimetria-formatter-service.js';
import progressEmitter from '../../utils/progress-emitter.js';

class JurimetriaIntegration {
  /**
   * LAYER 4.5: ANÁLISE JURÍMÉTRICA DO MAGISTRADO
   *
   * Executada APÓS a Layer 4 (busca de jurisprudência)
   * Analisa padrão de julgamento do magistrado específico
   */
  async layer45_jurimetricAnalysis(casoId, dadosCaso, jurisprudenciaGeral) {
    console.log('\n━━━ LAYER 4.5: Análise Jurímétrica do Magistrado ━━━');

    const {
      magistrado,      // Nome do juiz/relator/ministro
      tribunal,        // TJRJ, STJ, etc
      materia,         // Matéria principal do caso
      tipoDecisao,     // Sentença, acórdão, etc
      casoAtualResumo  // Resumo do caso atual
    } = dadosCaso;

    if (!magistrado) {
      console.log('⚠️  Magistrado não identificado - pulando jurimetria');
      return { executada: false, motivo: 'Magistrado não identificado' };
    }

    try {
      // Emitir progresso
      progressEmitter.emit(casoId, {
        type: 'layer',
        layer: '4.5',
        message: `Analisando padrão de julgamento: ${magistrado}`,
        progress: 0
      });

      // ═══════════════════════════════════════════════════════════
      // ETAPA 1: BUSCAR DECISÕES DO MAGISTRADO
      // ═══════════════════════════════════════════════════════════

      progressEmitter.emit(casoId, {
        type: 'layer_progress',
        layer: '4.5',
        message: 'Buscando decisões anteriores do magistrado...',
        progress: 20
      });

      const analise = await jurimetriaService.analisarMagistrado({
        nomeMagistrado: magistrado,
        materia,
        tribunal,
        tipoDecisao,
        limiteBuscas: 20
      });

      if (!analise.sucesso) {
        return {
          executada: false,
          motivo: analise.erro || 'Falha na análise jurímétrica'
        };
      }

      // ═══════════════════════════════════════════════════════════
      // ETAPA 2: GERAR PADRÃO DE JULGAMENTO
      // ═══════════════════════════════════════════════════════════

      progressEmitter.emit(casoId, {
        type: 'layer_progress',
        layer: '4.5',
        message: 'Identificando padrão de julgamento...',
        progress: 40
      });

      const tabelaPadrao = jurimetriaFormatterService.gerarTabelaPadraoJulgamento({
        magistrado,
        materia,
        estatisticas: analise.analiseJurimetrica.estatisticas,
        decisoesAnalisadas: analise.totalDecisoes
      });

      // ═══════════════════════════════════════════════════════════
      // ETAPA 3: IDENTIFICAR PRECEDENTES FAVORÁVEIS E DESFAVORÁVEIS
      // ═══════════════════════════════════════════════════════════

      progressEmitter.emit(casoId, {
        type: 'layer_progress',
        layer: '4.5',
        message: 'Classificando precedentes...',
        progress: 60
      });

      const { favoraveis, desfavoraveis } = this.classificarPrecedentes(
        analise.decisoesAnalisadas,
        dadosCaso.resultadoDesejado
      );

      // ═══════════════════════════════════════════════════════════
      // ETAPA 4: COTEJAMENTO ANALÍTICO
      // ═══════════════════════════════════════════════════════════

      progressEmitter.emit(casoId, {
        type: 'layer_progress',
        layer: '4.5',
        message: 'Realizando cotejamento analítico...',
        progress: 70
      });

      let cotejamento = null;
      if (favoraveis.length > 0) {
        cotejamento = await jurimetriaService.cotejarComCasoAtual({
          casoAtual: casoAtualResumo,
          decisoesReferencia: favoraveis.slice(0, 5),
          pontosControversos: dadosCaso.pontosControversos || []
        });
      }

      // ═══════════════════════════════════════════════════════════
      // ETAPA 5: GERAR TABELAS COMPARATIVAS
      // ═══════════════════════════════════════════════════════════

      progressEmitter.emit(casoId, {
        type: 'layer_progress',
        layer: '4.5',
        message: 'Gerando tabelas comparativas...',
        progress: 80
      });

      const tabelaComparativa = this.gerarTabelaComparativa(
        dadosCaso,
        favoraveis,
        desfavoraveis
      );

      // ═══════════════════════════════════════════════════════════
      // ETAPA 6: QUADROS DE AMOLDAMENTO E DISTINGUISHING
      // ═══════════════════════════════════════════════════════════

      progressEmitter.emit(casoId, {
        type: 'layer_progress',
        layer: '4.5',
        message: 'Preparando quadros de amoldamento...',
        progress: 90
      });

      const quadros = await this.gerarQuadrosJurimetricos({
        casoAtual: dadosCaso,
        precedentesFavoraveis: favoraveis,
        precedentesDesfavoraveis: desfavoraveis,
        contradicoes: analise.contradicoes
      });

      // ═══════════════════════════════════════════════════════════
      // ETAPA 7: RELATÓRIO COMPLETO
      // ═══════════════════════════════════════════════════════════

      progressEmitter.emit(casoId, {
        type: 'layer_progress',
        layer: '4.5',
        message: 'Gerando relatório jurímétrico...',
        progress: 95
      });

      const relatorioCompleto = jurimetriaFormatterService.gerarRelatorioCompleto({
        analiseJurimetrica: analise.analiseJurimetrica,
        tabelaComparativa,
        quadroAmoldamento: quadros.amoldamento,
        quadrosDistinguishing: quadros.distinguishing,
        padraoJulgamento: tabelaPadrao,
        contradicoes: jurimetriaFormatterService.gerarQuadroContradicoes(analise.contradicoes || []),
        precedentesFavoraveis: favoraveis.length,
        precedentesDesfavoraveis: desfavoraveis.length
      });

      progressEmitter.emit(casoId, {
        type: 'layer_complete',
        layer: '4.5',
        message: 'Análise jurímétrica concluída',
        progress: 100
      });

      return {
        executada: true,
        magistrado,
        totalDecisoes: analise.totalDecisoes,
        decisoesValidadas: analise.decisoesValidadas,
        precedentesFavoraveis: favoraveis.length,
        precedentesDesfavoraveis: desfavoraveis.length,
        contradicoes: analise.contradicoes?.length || 0,
        analiseJurimetrica: analise.analiseJurimetrica,
        cotejamento,
        tabelaPadrao,
        tabelaComparativa,
        quadros,
        relatorioCompleto,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ [Jurimetria] Erro:', error);
      progressEmitter.emit(casoId, {
        type: 'layer_error',
        layer: '4.5',
        message: `Erro na análise jurímétrica: ${error.message}`
      });

      return {
        executada: false,
        erro: error.message
      };
    }
  }

  /**
   * Classificar precedentes em favoráveis e desfavoráveis
   */
  classificarPrecedentes(decisoes, resultadoDesejado) {
    const favoraveis = [];
    const desfavoraveis = [];

    // Se não especificou resultado desejado, considerar todos como potencialmente favoráveis
    if (!resultadoDesejado) {
      return {
        favoraveis: decisoes.slice(0, 10),
        desfavoraveis: []
      };
    }

    for (const decisao of decisoes) {
      const resultado = jurimetriaService.extrairResultado(decisao);

      // Comparar com resultado desejado
      if (this.resultadosCompatíveis(resultado, resultadoDesejado)) {
        favoraveis.push(decisao);
      } else {
        desfavoraveis.push(decisao);
      }
    }

    return { favoraveis, desfavoraveis };
  }

  /**
   * Verificar se resultados são compatíveis
   */
  resultadosCompatíveis(resultado, desejado) {
    const compatibilidades = {
      'provido': ['provido', 'parcialmente provido', 'procedente', 'deferido'],
      'desprovido': ['desprovido', 'improcedente', 'indeferido'],
      'procedente': ['procedente', 'parcialmente procedente', 'provido', 'deferido'],
      'improcedente': ['improcedente', 'desprovido', 'indeferido']
    };

    const desejadoLower = desejado.toLowerCase();

    return compatibilidades[desejadoLower]?.some(c =>
      resultado.toLowerCase().includes(c)
    ) || false;
  }

  /**
   * Gerar tabela comparativa formatada
   */
  gerarTabelaComparativa(casoAtual, favoraveis, desfavoraveis) {
    // Preparar critérios de comparação
    const criterios = [
      {
        nome: 'Fato Principal',
        casoAtual: casoAtual.fatosPrincipais?.substring(0, 100) || 'A definir',
        extrair: (p) => (p.ementa || '').substring(0, 100) + '...'
      },
      {
        nome: 'Fundamento Legal',
        casoAtual: casoAtual.fundamentoLegal || 'A definir',
        extrair: (p) => this.extrairFundamentoLegal(p.inteiroTeor || p.ementa)
      },
      {
        nome: 'Resultado',
        casoAtual: casoAtual.resultadoDesejado || 'A definir',
        extrair: (p) => jurimetriaService.extrairResultado(p)
      }
    ];

    // Gerar tabela apenas para favoráveis (top 5)
    const precedentesTabela = favoraveis.slice(0, 5).map(p => ({
      ...p,
      similaridade: this.calcularSimilaridade(casoAtual, p)
    }));

    return jurimetriaFormatterService.gerarTabelaComparativa({
      casoAtual,
      precedentes: precedentesTabela,
      criterios
    });
  }

  /**
   * Extrair fundamento legal de texto
   */
  extrairFundamentoLegal(texto) {
    if (!texto) return 'N/A';

    const matches = texto.match(/art\.?\s*\d+/gi);
    if (matches && matches.length > 0) {
      return matches.slice(0, 2).join(', ');
    }

    return 'Não identificado';
  }

  /**
   * Calcular similaridade simples
   */
  calcularSimilaridade(casoAtual, precedente) {
    // Análise muito simples - pode ser melhorada
    const palavrasCaso = (casoAtual.fatosPrincipais || '').toLowerCase().split(/\s+/);
    const palavrasPrecedente = (precedente.ementa || '').toLowerCase().split(/\s+/);

    const intersecao = palavrasCaso.filter(p => palavrasPrecedente.includes(p));
    const similaridade = (intersecao.length / palavrasCaso.length) * 100;

    return Math.round(similaridade);
  }

  /**
   * Gerar quadros jurímétricos (amoldamento + distinguishing)
   */
  async gerarQuadrosJurimetricos(params) {
    const {
      casoAtual,
      precedentesFavoraveis,
      precedentesDesfavoraveis,
      contradicoes
    } = params;

    const quadros = {
      amoldamento: null,
      distinguishing: []
    };

    // QUADRO DE AMOLDAMENTO (leading case favorável)
    if (precedentesFavoraveis.length > 0) {
      const leadingCase = precedentesFavoraveis[0]; // Mais similar

      quadros.amoldamento = jurimetriaFormatterService.gerarQuadroAmoldamento({
        leadingCase,
        casoAtual: casoAtual.fatosPrincipais || casoAtual.resumo,
        pontosConvergencia: [
          {
            aspecto: 'Fato gerador',
            leadingCase: 'Similar ao caso atual',
            casoAtual: 'Mesma situação fática',
            amoldamento: 'Aplicação direta do precedente'
          }
          // Mais pontos seriam extraídos por IA
        ],
        pontosDivergencia: []
      });
    }

    // QUADROS DE DISTINGUISHING (precedentes desfavoráveis)
    for (const precedente of precedentesDesfavoraveis.slice(0, 3)) {
      const quadroDistinguishing = jurimetriaFormatterService.gerarQuadroDistinguishing({
        precedenteDesfavoravel: precedente,
        casoAtual: casoAtual.fatosPrincipais || casoAtual.resumo,
        diferencasRelevantes: [
          {
            aspecto: 'Contexto fático',
            precedente: 'Situação X',
            casoAtual: 'Situação Y',
            relevancia: 'Alta',
            impacto: 'Afeta ratio decidendi',
            justificativa: 'Diferenças substanciais impedem aplicação'
          }
          // Mais diferenças seriam extraídas por IA
        ]
      });

      quadros.distinguishing.push(quadroDistinguishing);
    }

    return quadros;
  }

  /**
   * Extrair informações do magistrado do caso
   */
  extrairMagistrado(dadosCaso) {
    // Tentar extrair de diferentes fontes
    if (dadosCaso.magistrado) return dadosCaso.magistrado;
    if (dadosCaso.juiz) return dadosCaso.juiz;
    if (dadosCaso.relator) return dadosCaso.relator;
    if (dadosCaso.ministro) return dadosCaso.ministro;

    // Tentar extrair de decisão embargada (para embargos de declaração)
    if (dadosCaso.decisaoEmbargada) {
      const match = dadosCaso.decisaoEmbargada.match(/relator[:\s]+([A-ZÀ-Ú\s]+)/i);
      if (match) return match[1].trim();
    }

    return null;
  }

  /**
   * Enriquecer dados do caso com informações para jurimetria
   */
  async enriquecerDadosCaso(casoId, consolidacoes) {
    // Extrair informações relevantes das consolidações

    const magistrado = this.extrairMagistradoDasConsolidacoes(consolidacoes);
    const tribunal = this.extrairTribunal(consolidacoes);
    const materia = this.extrairMateria(consolidacoes);
    const fatosPrincipais = consolidacoes.sintese?.fatosPrincipais || '';
    const fundamentoLegal = consolidacoes.sintese?.fundamentoLegal || '';

    return {
      magistrado,
      tribunal,
      materia,
      fatosPrincipais,
      fundamentoLegal,
      tipoDecisao: consolidacoes.metadados?.tipoDecisao,
      pontosControversos: consolidacoes.pontosControversos || [],
      resultadoDesejado: consolidacoes.resultadoDesejado,
      casoAtualResumo: fatosPrincipais
    };
  }

  /**
   * Extrair magistrado das consolidações
   */
  extrairMagistradoDasConsolidacoes(consolidacoes) {
    // Buscar em diferentes lugares
    if (consolidacoes.magistrado) return consolidacoes.magistrado;
    if (consolidacoes.metadados?.magistrado) return consolidacoes.metadados.magistrado;

    // Tentar extrair de texto da decisão
    const textoDecisao = consolidacoes.decisao?.texto || '';
    const patterns = [
      /relator[:\s]+([A-ZÀ-Ú\s.]+)/i,
      /juiz[:\s]+([A-ZÀ-Ú\s.]+)/i,
      /ministro[:\s]+([A-ZÀ-Ú\s.]+)/i
    ];

    for (const pattern of patterns) {
      const match = textoDecisao.match(pattern);
      if (match) {
        return match[1].trim().split('\n')[0]; // Pegar apenas primeira linha
      }
    }

    return null;
  }

  /**
   * Extrair tribunal
   */
  extrairTribunal(consolidacoes) {
    if (consolidacoes.tribunal) return consolidacoes.tribunal;
    if (consolidacoes.metadados?.tribunal) return consolidacoes.metadados.tribunal;

    // Tentar extrair de número de processo
    const numeroProcesso = consolidacoes.metadados?.numeroProcesso || '';
    const match = numeroProcesso.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})/);

    if (match) {
      const justica = match[1];
      const tribunal = match[2];

      // Mapear código para nome
      const mapa = {
        '8': `TJ${tribunal}`,  // Justiça Estadual
        '5': 'TRT',             // Justiça do Trabalho
        '4': 'TRF',             // Justiça Federal
        '3': 'TRE'              // Justiça Eleitoral
      };

      return mapa[justica] || 'Não identificado';
    }

    return 'Não identificado';
  }

  /**
   * Extrair matéria principal
   */
  extrairMateria(consolidacoes) {
    if (consolidacoes.materia) return consolidacoes.materia;
    if (consolidacoes.metadados?.materia) return consolidacoes.metadados.materia;

    // Tentar extrair de assuntos
    const assuntos = consolidacoes.metadados?.assuntos || [];
    if (assuntos.length > 0) {
      return assuntos[0];
    }

    // Fallback: usar palavras-chave do texto
    return 'Não identificada';
  }
}

// Singleton
const jurimetriaIntegration = new JurimetriaIntegration();

export default jurimetriaIntegration;
