/**
 * Consolidation Service
 *
 * Serviço para consolidação inteligente de dados extraídos de múltiplos documentos
 * Realiza merge, deduplicação, ranking e construção de timeline cronológica
 *
 * Funcionalidades:
 * - Consolidação de qualificações das partes
 * - Merge de fatos com deduplicação
 * - Consolidação de provas
 * - Unificação de teses jurídicas
 * - Merge de pedidos
 * - Construção de matriz de risco
 * - Timeline cronológica
 */

import entityExtractorService from './entity-extractor-service.js';

class ConsolidationService {
  constructor() {
    this.initialized = false;

    // Pesos para scoring de relevância
    this.weights = {
      fatos: {
        mencaoEmMultiplosDocumentos: 3,
        referenciaLegislacao: 2,
        contemData: 1.5,
        contemValor: 1.5,
        tamanhoTexto: 0.5
      },
      provas: {
        documentoOriginal: 3,
        mencionadoEmPeticao: 2,
        contemData: 1.5,
        tipoProva: 1
      },
      teses: {
        fundamentacaoLegal: 3,
        jurisprudencia: 2.5,
        recorrencia: 2,
        estrutura: 1
      }
    };

    // Padrões para identificação de tipos de conteúdo
    this.patterns = {
      fato: /(?:fato|ocorreu|aconteceu|em\s+\d{1,2}\/\d{1,2}\/\d{2,4}|no\s+dia|na\s+data)/i,
      prova: /(?:documento|comprovante|anexo|fls?\.|folhas?|prova|certidão|declaração|contrato|recibo|nota\s+fiscal)/i,
      tese: /(?:fundamento|tese|argumento|direito|artigo|lei|código|jurisprudência|entendimento|precedente)/i,
      pedido: /(?:requer|requerimento|pedido|pleiteia|postula|solicita|pugna|pretende)/i,
      valor: /R\$\s*[\d.,]+/,
      data: /\d{1,2}\/\d{1,2}\/\d{2,4}/
    };
  }

  /**
   * Inicializar serviço
   */
  async init() {
    if (!entityExtractorService.initialized) {
      await entityExtractorService.init();
    }
    this.initialized = true;
    console.log('✅ Consolidation Service inicializado');
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // CONSOLIDAÇÃO DE QUALIFICAÇÃO
  // ═══════════════════════════════════════════════════════════

  /**
   * Consolida qualificações de todas as partes a partir dos microfichamentos
   * @param {Array} microfichamentos - Array de microfichamentos de documentos
   * @returns {Object} Qualificação consolidada
   */
  consolidateQualificacao(microfichamentos) {
    const qualificacao = {
      partes: {
        polo_ativo: [],
        polo_passivo: []
      },
      advogados: {
        autores: [],
        reus: []
      },
      juizo: {
        juiz: null,
        vara: null,
        comarca: null,
        tribunal: null
      },
      processo: {
        numero: null,
        classe: null,
        area: null,
        valorCausa: null
      },
      dataDistribuicao: null,
      confidence: 0
    };

    const allPartes = { polo_ativo: [], polo_passivo: [] };
    const allAdvogados = { autores: [], reus: [] };
    const juizes = [];
    const varas = [];
    const comarcas = [];
    const tribunais = [];
    const processos = [];
    const valoresCausa = [];
    const datas = [];

    // Coletar de todos os microfichamentos
    for (const micro of microfichamentos) {
      if (!micro || micro.error) continue;

      const campos = micro.campos || {};

      // Partes
      if (campos.qualificacao) {
        if (campos.qualificacao.autor) {
          allPartes.polo_ativo.push(this._normalizeParteQualificacao(campos.qualificacao.autor, 'autor'));
        }
        if (campos.qualificacao.reu) {
          allPartes.polo_passivo.push(this._normalizeParteQualificacao(campos.qualificacao.reu, 'reu'));
        }
        if (campos.qualificacao.autores) {
          campos.qualificacao.autores.forEach(a => {
            allPartes.polo_ativo.push(this._normalizeParteQualificacao(a, 'autor'));
          });
        }
        if (campos.qualificacao.reus) {
          campos.qualificacao.reus.forEach(r => {
            allPartes.polo_passivo.push(this._normalizeParteQualificacao(r, 'reu'));
          });
        }
      }

      // Advogados
      if (campos.advogados) {
        if (campos.advogados.autor || campos.advogados.autores) {
          const advs = campos.advogados.autor || campos.advogados.autores || [];
          (Array.isArray(advs) ? advs : [advs]).forEach(a => {
            if (a) allAdvogados.autores.push(this._normalizeAdvogado(a));
          });
        }
        if (campos.advogados.reu || campos.advogados.reus) {
          const advs = campos.advogados.reu || campos.advogados.reus || [];
          (Array.isArray(advs) ? advs : [advs]).forEach(a => {
            if (a) allAdvogados.reus.push(this._normalizeAdvogado(a));
          });
        }
      }

      // Juízo
      if (campos.juiz) juizes.push(campos.juiz);
      if (campos.vara) varas.push(campos.vara);
      if (campos.comarca) comarcas.push(campos.comarca);
      if (campos.tribunal) tribunais.push(campos.tribunal);

      // Processo
      if (campos.numeroProcesso) processos.push(campos.numeroProcesso);
      if (campos.valorCausa) valoresCausa.push(this._parseValor(campos.valorCausa));
      if (campos.dataDistribuicao) datas.push(campos.dataDistribuicao);
    }

    // Consolidar com votação por maioria
    qualificacao.partes.polo_ativo = this._deduplicatePartes(allPartes.polo_ativo);
    qualificacao.partes.polo_passivo = this._deduplicatePartes(allPartes.polo_passivo);
    qualificacao.advogados.autores = this._deduplicateAdvogados(allAdvogados.autores);
    qualificacao.advogados.reus = this._deduplicateAdvogados(allAdvogados.reus);

    qualificacao.juizo.juiz = this._getMostFrequent(juizes);
    qualificacao.juizo.vara = this._getMostFrequent(varas);
    qualificacao.juizo.comarca = this._getMostFrequent(comarcas);
    qualificacao.juizo.tribunal = this._getMostFrequent(tribunais);

    qualificacao.processo.numero = this._getMostFrequent(processos);
    qualificacao.processo.valorCausa = this._getMaxValue(valoresCausa);
    qualificacao.dataDistribuicao = this._getEarliestDate(datas);

    // Calcular confiança
    qualificacao.confidence = this._calculateQualificacaoConfidence(qualificacao);

    return qualificacao;
  }

  // ═══════════════════════════════════════════════════════════
  // CONSOLIDAÇÃO DE FATOS
  // ═══════════════════════════════════════════════════════════

  /**
   * Consolida fatos de todos os microfichamentos
   * @param {Array} microfichamentos - Array de microfichamentos
   * @returns {Array} Fatos consolidados e ordenados
   */
  consolidateFatos(microfichamentos) {
    const allFatos = [];

    // Coletar fatos de todos os documentos
    for (const micro of microfichamentos) {
      if (!micro || micro.error) continue;

      const campos = micro.campos || {};
      const fatos = campos.fatos || [];

      for (const fato of fatos) {
        if (!fato) continue;

        const normalizado = this._normalizeFato(fato, micro.fileName);
        if (normalizado) {
          allFatos.push(normalizado);
        }
      }
    }

    // Agrupar fatos similares
    const grupos = this._groupSimilarItems(allFatos, 'descricao', 0.7);

    // Consolidar cada grupo
    const consolidados = grupos.map(grupo => this._mergeFactGroup(grupo));

    // Ordenar cronologicamente
    return this._sortByDate(consolidados);
  }

  /**
   * Extrai fatos preliminares dos documentos (versão simplificada para quick analysis)
   * @param {Array} documents - Array de documentos
   * @param {number} limit - Número máximo de fatos
   * @returns {Array} Fatos preliminares
   */
  extractPreliminaryFacts(documents, limit = 10) {
    const fatos = [];

    for (const doc of documents) {
      const text = doc.text || doc.content || '';
      if (!text) continue;

      // Buscar sentenças que parecem ser fatos
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);

      for (const sentence of sentences) {
        const trimmed = sentence.trim();

        // Verificar se parece um fato
        if (this.patterns.fato.test(trimmed) || this.patterns.data.test(trimmed)) {
          const dataMatch = trimmed.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);

          fatos.push({
            descricao: trimmed.substring(0, 300),
            data: dataMatch ? this._parseDataBrasileira(dataMatch[0]) : null,
            fonte: doc.fileName,
            tipo: 'preliminar',
            score: this._scoreFato(trimmed)
          });
        }
      }
    }

    // Ordenar por score e limitar
    return fatos
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ═══════════════════════════════════════════════════════════
  // CONSOLIDAÇÃO DE PROVAS
  // ═══════════════════════════════════════════════════════════

  /**
   * Consolida provas de todos os microfichamentos
   * @param {Array} microfichamentos - Array de microfichamentos
   * @returns {Array} Provas consolidadas
   */
  consolidateProvas(microfichamentos) {
    const allProvas = [];

    for (const micro of microfichamentos) {
      if (!micro || micro.error) continue;

      const campos = micro.campos || {};
      const provas = campos.provas || campos.documentos || [];

      for (const prova of provas) {
        if (!prova) continue;

        const normalizada = this._normalizeProva(prova, micro.fileName);
        if (normalizada) {
          allProvas.push(normalizada);
        }
      }
    }

    // Agrupar provas similares
    const grupos = this._groupSimilarItems(allProvas, 'descricao', 0.8);

    // Consolidar cada grupo
    const consolidadas = grupos.map(grupo => this._mergeProofGroup(grupo));

    // Ordenar por relevância
    return consolidadas.sort((a, b) => b.score - a.score);
  }

  // ═══════════════════════════════════════════════════════════
  // CONSOLIDAÇÃO DE TESES
  // ═══════════════════════════════════════════════════════════

  /**
   * Consolida teses jurídicas de todos os microfichamentos
   * @param {Array} microfichamentos - Array de microfichamentos
   * @returns {Array} Teses consolidadas
   */
  consolidateTeses(microfichamentos) {
    const allTeses = [];

    for (const micro of microfichamentos) {
      if (!micro || micro.error) continue;

      const campos = micro.campos || {};
      const teses = campos.teses || campos.fundamentos || campos.argumentos || [];

      for (const tese of teses) {
        if (!tese) continue;

        const normalizada = this._normalizeTese(tese, micro.fileName);
        if (normalizada) {
          allTeses.push(normalizada);
        }
      }
    }

    // Agrupar teses similares
    const grupos = this._groupSimilarItems(allTeses, 'argumento', 0.6);

    // Consolidar cada grupo
    const consolidadas = grupos.map(grupo => this._mergeThesisGroup(grupo));

    // Ordenar por força do argumento
    return consolidadas.sort((a, b) => b.score - a.score);
  }

  /**
   * Identifica questões jurídicas dos documentos
   * @param {Array} documents - Array de documentos
   * @returns {Array} Questões jurídicas identificadas
   */
  identifyLegalIssues(documents) {
    const issues = [];
    const issuePatterns = [
      { pattern: /prescri[çc][ãa]o|prescricional/i, tipo: 'prescricao', categoria: 'preliminar' },
      { pattern: /decad[êe]ncia|decadencial/i, tipo: 'decadencia', categoria: 'preliminar' },
      { pattern: /compet[êe]ncia|incompet[êe]ncia/i, tipo: 'competencia', categoria: 'preliminar' },
      { pattern: /legitimidade|ilegitimidade/i, tipo: 'legitimidade', categoria: 'preliminar' },
      { pattern: /litispend[êe]ncia/i, tipo: 'litispendencia', categoria: 'preliminar' },
      { pattern: /coisa\s+julgada/i, tipo: 'coisa_julgada', categoria: 'preliminar' },
      { pattern: /nulidade/i, tipo: 'nulidade', categoria: 'merito' },
      { pattern: /indeniza[çc][ãa]o|dano\s+(moral|material|est[ée]tico)/i, tipo: 'indenizacao', categoria: 'merito' },
      { pattern: /rescis[ãa]o|resolu[çc][ãa]o\s+contratual/i, tipo: 'rescisao', categoria: 'merito' },
      { pattern: /inadimplemento|inadimpl[êe]ncia/i, tipo: 'inadimplemento', categoria: 'merito' },
      { pattern: /responsabilidade\s+civil/i, tipo: 'responsabilidade_civil', categoria: 'merito' },
      { pattern: /obriga[çc][ãa]o\s+de\s+fazer/i, tipo: 'obrigacao_fazer', categoria: 'merito' },
      { pattern: /tutela\s+(antecipada|de\s+urg[êe]ncia|provis[óo]ria)/i, tipo: 'tutela_urgencia', categoria: 'processual' },
      { pattern: /liminar/i, tipo: 'liminar', categoria: 'processual' },
      { pattern: /honor[áa]rios/i, tipo: 'honorarios', categoria: 'sucumbencia' },
      { pattern: /custas/i, tipo: 'custas', categoria: 'sucumbencia' }
    ];

    for (const doc of documents) {
      const text = doc.text || doc.content || '';
      if (!text) continue;

      for (const { pattern, tipo, categoria } of issuePatterns) {
        if (pattern.test(text)) {
          // Encontrar contexto
          const match = text.match(new RegExp(`.{0,100}${pattern.source}.{0,100}`, 'i'));
          const contexto = match ? match[0].trim() : '';

          // Verificar se já existe
          const exists = issues.find(i => i.tipo === tipo);
          if (exists) {
            exists.mencoes++;
            exists.fontes.push(doc.fileName);
          } else {
            issues.push({
              tipo,
              categoria,
              descricao: this._getIssueDescription(tipo),
              contexto,
              mencoes: 1,
              fontes: [doc.fileName]
            });
          }
        }
      }
    }

    // Ordenar por número de menções
    return issues.sort((a, b) => b.mencoes - a.mencoes);
  }

  // ═══════════════════════════════════════════════════════════
  // CONSOLIDAÇÃO DE PEDIDOS
  // ═══════════════════════════════════════════════════════════

  /**
   * Consolida pedidos de todos os microfichamentos
   * @param {Array} microfichamentos - Array de microfichamentos
   * @returns {Array} Pedidos consolidados
   */
  consolidatePedidos(microfichamentos) {
    const allPedidos = [];

    for (const micro of microfichamentos) {
      if (!micro || micro.error) continue;

      const campos = micro.campos || {};
      const pedidos = campos.pedidos || campos.requerimentos || [];

      for (const pedido of pedidos) {
        if (!pedido) continue;

        const normalizado = this._normalizePedido(pedido, micro.fileName);
        if (normalizado) {
          allPedidos.push(normalizado);
        }
      }
    }

    // Agrupar pedidos similares
    const grupos = this._groupSimilarItems(allPedidos, 'descricao', 0.7);

    // Consolidar cada grupo
    const consolidados = grupos.map(grupo => this._mergeRequestGroup(grupo));

    // Ordenar por tipo (principal primeiro)
    return consolidados.sort((a, b) => {
      const order = { principal: 0, subsidiario: 1, acessorio: 2, alternativo: 3 };
      return (order[a.tipo] || 99) - (order[b.tipo] || 99);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // MATRIZ DE RISCO
  // ═══════════════════════════════════════════════════════════

  /**
   * Constrói matriz de risco baseada nas consolidações
   * @param {Object} consolidacoes - Objeto com todas as consolidações
   * @returns {Object} Matriz de risco
   */
  buildRiskMatrix(consolidacoes) {
    const matriz = {
      geral: { probabilidade: 'média', impacto: 'médio', score: 50 },
      procedencia: { probabilidade: 'média', impacto: 'alto', score: 50, fatores: [] },
      prazo: { probabilidade: 'baixa', impacto: 'médio', score: 30, fatores: [] },
      custos: { probabilidade: 'média', impacto: 'médio', score: 50, fatores: [] },
      reputacional: { probabilidade: 'baixa', impacto: 'baixo', score: 20, fatores: [] },
      estrategico: { probabilidade: 'média', impacto: 'alto', score: 50, fatores: [] }
    };

    const { qualificacao, fatos, provas, teses, pedidos } = consolidacoes;

    // Análise de procedência
    const riscoProcedencia = this._analyzeSuccessRisk(fatos, provas, teses);
    matriz.procedencia.score = riscoProcedencia.score;
    matriz.procedencia.probabilidade = this._scoreToProbability(riscoProcedencia.score);
    matriz.procedencia.fatores = riscoProcedencia.fatores;

    // Análise de prazo
    const riscoPrazo = this._analyzeTimeRisk(fatos, qualificacao);
    matriz.prazo.score = riscoPrazo.score;
    matriz.prazo.probabilidade = this._scoreToProbability(riscoPrazo.score);
    matriz.prazo.fatores = riscoPrazo.fatores;

    // Análise de custos
    const riscoCustos = this._analyzeCostRisk(pedidos, qualificacao);
    matriz.custos.score = riscoCustos.score;
    matriz.custos.probabilidade = this._scoreToProbability(riscoCustos.score);
    matriz.custos.impacto = riscoCustos.impacto;
    matriz.custos.fatores = riscoCustos.fatores;

    // Análise estratégica
    const riscoEstrategico = this._analyzeStrategicRisk(teses, provas);
    matriz.estrategico.score = riscoEstrategico.score;
    matriz.estrategico.probabilidade = this._scoreToProbability(riscoEstrategico.score);
    matriz.estrategico.fatores = riscoEstrategico.fatores;

    // Score geral ponderado
    matriz.geral.score = Math.round(
      (matriz.procedencia.score * 0.4) +
      (matriz.prazo.score * 0.15) +
      (matriz.custos.score * 0.25) +
      (matriz.estrategico.score * 0.2)
    );
    matriz.geral.probabilidade = this._scoreToProbability(matriz.geral.score);
    matriz.geral.impacto = this._calculateOverallImpact(matriz);

    // Recomendações
    matriz.recomendacoes = this._generateRiskRecommendations(matriz);

    return matriz;
  }

  // ═══════════════════════════════════════════════════════════
  // REFERÊNCIAS CRUZADAS
  // ═══════════════════════════════════════════════════════════

  /**
   * Constrói mapa de referências cruzadas entre documentos
   * @param {Array} documents - Array de documentos
   * @returns {Object} Mapa de referências cruzadas
   */
  buildCrossReferences(documents) {
    const references = {
      byDocument: {},
      byEntity: {},
      byDate: {},
      byProcesso: {},
      connections: []
    };

    // Processar cada documento
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const text = doc.text || doc.content || '';
      const entities = entityExtractorService.extractEntities(text);

      // Indexar por documento
      references.byDocument[doc.fileName] = {
        entidades: entities,
        referenciaOutros: [],
        referenciadoPor: []
      };

      // Verificar referências a outros documentos
      for (let j = 0; j < documents.length; j++) {
        if (i === j) continue;
        const otherDoc = documents[j];

        // Buscar menção do outro documento
        if (this._documentReferences(text, otherDoc)) {
          references.byDocument[doc.fileName].referenciaOutros.push(otherDoc.fileName);

          references.connections.push({
            de: doc.fileName,
            para: otherDoc.fileName,
            tipo: 'referencia'
          });
        }
      }

      // Indexar entidades
      for (const proc of entities.processos) {
        if (!references.byProcesso[proc.numero]) {
          references.byProcesso[proc.numero] = [];
        }
        references.byProcesso[proc.numero].push(doc.fileName);
      }

      // Indexar por datas
      for (const data of entities.datas) {
        if (!references.byDate[data.parsed]) {
          references.byDate[data.parsed] = [];
        }
        references.byDate[data.parsed].push({
          documento: doc.fileName,
          contexto: data.original
        });
      }
    }

    // Calcular documentos referenciados
    for (const [docName, info] of Object.entries(references.byDocument)) {
      for (const refDoc of info.referenciaOutros) {
        if (references.byDocument[refDoc]) {
          references.byDocument[refDoc].referenciadoPor.push(docName);
        }
      }
    }

    // Estatísticas
    references.stats = {
      totalDocuments: documents.length,
      totalConnections: references.connections.length,
      uniqueDates: Object.keys(references.byDate).length,
      uniqueProcessos: Object.keys(references.byProcesso).length
    };

    return references;
  }

  // ═══════════════════════════════════════════════════════════
  // TIMELINE CRONOLÓGICA
  // ═══════════════════════════════════════════════════════════

  /**
   * Constrói timeline cronológica do caso
   * @param {Array} documents - Array de documentos
   * @param {Object} consolidacoes - Consolidações existentes
   * @returns {Array} Eventos ordenados cronologicamente
   */
  buildTimeline(documents, consolidacoes = {}) {
    const eventos = [];

    // Eventos dos documentos
    for (const doc of documents) {
      const text = doc.text || doc.content || '';
      const entities = entityExtractorService.extractEntities(text);

      // Data do documento
      if (doc.date) {
        eventos.push({
          data: doc.date,
          tipo: 'documento',
          descricao: `Documento: ${doc.fileName}`,
          fonte: doc.fileName,
          relevancia: 'alta'
        });
      }

      // Datas mencionadas no documento
      for (const dataInfo of entities.datas.slice(0, 5)) {
        eventos.push({
          data: dataInfo.parsed,
          tipo: 'mencao',
          descricao: this._getContext(text, dataInfo.posicao, 100),
          fonte: doc.fileName,
          relevancia: 'media'
        });
      }
    }

    // Eventos dos fatos consolidados
    if (consolidacoes.fatos) {
      for (const fato of consolidacoes.fatos) {
        if (fato.data) {
          eventos.push({
            data: fato.data,
            tipo: 'fato',
            descricao: fato.descricao?.substring(0, 200),
            fonte: fato.fonte,
            relevancia: 'alta'
          });
        }
      }
    }

    // Ordenar cronologicamente
    const sorted = eventos
      .filter(e => e.data && this._isValidDate(e.data))
      .sort((a, b) => new Date(a.data) - new Date(b.data));

    // Agrupar por período
    const timeline = this._groupEventsByPeriod(sorted);

    return {
      eventos: sorted,
      agrupado: timeline,
      range: {
        inicio: sorted[0]?.data,
        fim: sorted[sorted.length - 1]?.data
      },
      totalEventos: sorted.length
    };
  }

  // ═══════════════════════════════════════════════════════════
  // MÉTODOS AUXILIARES PRIVADOS
  // ═══════════════════════════════════════════════════════════

  _normalizeParteQualificacao(parte, polo) {
    if (typeof parte === 'string') {
      return {
        nome: parte.trim(),
        tipo: 'pessoa_fisica',
        documento: null,
        polo
      };
    }
    return {
      nome: parte.nome?.trim() || '',
      tipo: parte.tipo || 'pessoa_fisica',
      documento: parte.cpf || parte.cnpj || parte.documento || null,
      endereco: parte.endereco || null,
      polo
    };
  }

  _normalizeAdvogado(adv) {
    if (typeof adv === 'string') {
      const oabMatch = adv.match(/OAB[\/\s]*([A-Z]{2})[\/\s]*(\d+)/i);
      return {
        nome: adv.replace(/OAB.*$/i, '').trim(),
        oab: oabMatch ? `OAB/${oabMatch[1]} ${oabMatch[2]}` : null
      };
    }
    return {
      nome: adv.nome?.trim() || '',
      oab: adv.oab || null,
      email: adv.email || null
    };
  }

  _normalizeFato(fato, fonte) {
    if (typeof fato === 'string') {
      const dataMatch = fato.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
      return {
        descricao: fato.trim(),
        data: dataMatch ? this._parseDataBrasileira(dataMatch[0]) : null,
        fonte,
        tipo: 'narrativo'
      };
    }
    return {
      descricao: (fato.descricao || fato.texto || fato.fato || '').trim(),
      data: fato.data ? this._parseDataBrasileira(fato.data) : null,
      fonte,
      tipo: fato.tipo || 'narrativo'
    };
  }

  _normalizeProva(prova, fonte) {
    if (typeof prova === 'string') {
      return {
        descricao: prova.trim(),
        tipo: this._classifyProofType(prova),
        fonte
      };
    }
    return {
      descricao: (prova.descricao || prova.documento || prova.prova || '').trim(),
      tipo: prova.tipo || this._classifyProofType(prova.descricao || ''),
      folhas: prova.folhas || prova.fls || null,
      fonte
    };
  }

  _normalizeTese(tese, fonte) {
    if (typeof tese === 'string') {
      return {
        argumento: tese.trim(),
        fundamentacao: [],
        jurisprudencia: [],
        fonte
      };
    }
    return {
      argumento: (tese.argumento || tese.tese || tese.fundamento || '').trim(),
      fundamentacao: tese.fundamentacao || tese.artigos || [],
      jurisprudencia: tese.jurisprudencia || tese.precedentes || [],
      fonte
    };
  }

  _normalizePedido(pedido, fonte) {
    if (typeof pedido === 'string') {
      const valorMatch = pedido.match(/R\$\s*([\d.,]+)/);
      return {
        descricao: pedido.trim(),
        tipo: this._classifyRequestType(pedido),
        valor: valorMatch ? this._parseValor(valorMatch[0]) : null,
        fonte
      };
    }
    return {
      descricao: (pedido.descricao || pedido.pedido || '').trim(),
      tipo: pedido.tipo || this._classifyRequestType(pedido.descricao || ''),
      valor: pedido.valor ? this._parseValor(pedido.valor) : null,
      fonte
    };
  }

  _parseValor(valor) {
    if (typeof valor === 'number') return valor;
    if (!valor) return null;
    const cleaned = valor.toString().replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  _parseDataBrasileira(data) {
    if (!data) return null;
    const match = data.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (!match) return data;

    let [, d, m, y] = match;
    y = parseInt(y);
    if (y < 100) y = y > 50 ? 1900 + y : 2000 + y;

    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  _classifyProofType(text) {
    const lower = text.toLowerCase();
    if (/contrato/.test(lower)) return 'documental_contrato';
    if (/nota\s*fiscal|nf/.test(lower)) return 'documental_fiscal';
    if (/certidão|certidao/.test(lower)) return 'documental_certidao';
    if (/comprovante/.test(lower)) return 'documental_comprovante';
    if (/testemunha/.test(lower)) return 'testemunhal';
    if (/perícia|pericial|laudo/.test(lower)) return 'pericial';
    if (/foto|imagem|vídeo|video/.test(lower)) return 'audiovisual';
    return 'documental';
  }

  _classifyRequestType(text) {
    const lower = text.toLowerCase();
    if (/subsidiariamente|alternativamente/.test(lower)) return 'subsidiario';
    if (/acessório|acessorio|honorário/.test(lower)) return 'acessorio';
    if (/eventual|alternativ/.test(lower)) return 'alternativo';
    return 'principal';
  }

  _deduplicatePartes(partes) {
    const seen = new Map();
    for (const parte of partes) {
      const key = parte.nome?.toLowerCase();
      if (!key) continue;
      if (!seen.has(key) || parte.documento) {
        seen.set(key, parte);
      }
    }
    return Array.from(seen.values());
  }

  _deduplicateAdvogados(advogados) {
    const seen = new Map();
    for (const adv of advogados) {
      const key = adv.oab || adv.nome?.toLowerCase();
      if (!key) continue;
      if (!seen.has(key)) {
        seen.set(key, adv);
      }
    }
    return Array.from(seen.values());
  }

  _getMostFrequent(arr) {
    if (!arr || arr.length === 0) return null;
    const freq = {};
    let maxFreq = 0;
    let result = null;
    for (const item of arr) {
      if (!item) continue;
      const key = typeof item === 'string' ? item.trim() : JSON.stringify(item);
      freq[key] = (freq[key] || 0) + 1;
      if (freq[key] > maxFreq) {
        maxFreq = freq[key];
        result = item;
      }
    }
    return result;
  }

  _getMaxValue(values) {
    const valid = values.filter(v => v !== null && !isNaN(v));
    return valid.length > 0 ? Math.max(...valid) : null;
  }

  _getEarliestDate(dates) {
    const valid = dates.filter(d => d && this._isValidDate(d));
    if (valid.length === 0) return null;
    return valid.sort((a, b) => new Date(a) - new Date(b))[0];
  }

  _isValidDate(date) {
    const d = new Date(date);
    return d instanceof Date && !isNaN(d);
  }

  _calculateQualificacaoConfidence(qual) {
    let score = 0;
    if (qual.partes.polo_ativo.length > 0) score += 20;
    if (qual.partes.polo_passivo.length > 0) score += 20;
    if (qual.advogados.autores.length > 0) score += 15;
    if (qual.juizo.vara) score += 15;
    if (qual.processo.numero) score += 20;
    if (qual.dataDistribuicao) score += 10;
    return Math.min(score, 100);
  }

  _groupSimilarItems(items, field, threshold) {
    const grupos = [];
    const used = new Set();

    for (let i = 0; i < items.length; i++) {
      if (used.has(i)) continue;

      const grupo = [items[i]];
      used.add(i);

      for (let j = i + 1; j < items.length; j++) {
        if (used.has(j)) continue;

        const similarity = this._calculateSimilarity(
          items[i][field] || '',
          items[j][field] || ''
        );

        if (similarity >= threshold) {
          grupo.push(items[j]);
          used.add(j);
        }
      }

      grupos.push(grupo);
    }

    return grupos;
  }

  _calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1;

    // Jaccard similarity com tokens
    const tokens1 = new Set(s1.split(/\s+/).filter(t => t.length > 2));
    const tokens2 = new Set(s2.split(/\s+/).filter(t => t.length > 2));

    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  _mergeFactGroup(grupo) {
    const merged = {
      descricao: grupo[0].descricao,
      data: null,
      fontes: [],
      mencoes: grupo.length,
      score: 0
    };

    for (const item of grupo) {
      if (item.data && !merged.data) merged.data = item.data;
      if (item.fonte) merged.fontes.push(item.fonte);

      // Preferir descrição mais completa
      if (item.descricao && item.descricao.length > merged.descricao.length) {
        merged.descricao = item.descricao;
      }
    }

    merged.fontes = [...new Set(merged.fontes)];
    merged.score = this._scoreFato(merged.descricao) * (1 + merged.mencoes * 0.2);

    return merged;
  }

  _mergeProofGroup(grupo) {
    const merged = {
      descricao: grupo[0].descricao,
      tipo: grupo[0].tipo,
      fontes: [],
      mencoes: grupo.length,
      score: 0
    };

    for (const item of grupo) {
      if (item.fonte) merged.fontes.push(item.fonte);
      if (item.folhas && !merged.folhas) merged.folhas = item.folhas;
    }

    merged.fontes = [...new Set(merged.fontes)];
    merged.score = merged.mencoes * 10 + (merged.tipo === 'documental' ? 20 : 10);

    return merged;
  }

  _mergeThesisGroup(grupo) {
    const merged = {
      argumento: grupo[0].argumento,
      fundamentacao: [],
      jurisprudencia: [],
      fontes: [],
      mencoes: grupo.length,
      score: 0
    };

    for (const item of grupo) {
      if (item.fonte) merged.fontes.push(item.fonte);
      if (item.fundamentacao) merged.fundamentacao.push(...item.fundamentacao);
      if (item.jurisprudencia) merged.jurisprudencia.push(...item.jurisprudencia);
    }

    merged.fontes = [...new Set(merged.fontes)];
    merged.fundamentacao = [...new Set(merged.fundamentacao)];
    merged.jurisprudencia = [...new Set(merged.jurisprudencia)];

    merged.score = (
      merged.mencoes * 10 +
      merged.fundamentacao.length * 15 +
      merged.jurisprudencia.length * 20
    );

    return merged;
  }

  _mergeRequestGroup(grupo) {
    const merged = {
      descricao: grupo[0].descricao,
      tipo: grupo[0].tipo,
      valor: null,
      fontes: [],
      mencoes: grupo.length
    };

    for (const item of grupo) {
      if (item.fonte) merged.fontes.push(item.fonte);
      if (item.valor && (!merged.valor || item.valor > merged.valor)) {
        merged.valor = item.valor;
      }
    }

    merged.fontes = [...new Set(merged.fontes)];
    return merged;
  }

  _sortByDate(items) {
    return items.sort((a, b) => {
      if (!a.data) return 1;
      if (!b.data) return -1;
      return new Date(a.data) - new Date(b.data);
    });
  }

  _scoreFato(text) {
    let score = 10;
    if (this.patterns.data.test(text)) score += 20;
    if (this.patterns.valor.test(text)) score += 15;
    if (text.length > 100) score += 10;
    if (text.length > 200) score += 5;
    return score;
  }

  _getIssueDescription(tipo) {
    const descriptions = {
      prescricao: 'Alegação de prescrição do direito de ação',
      decadencia: 'Alegação de decadência do direito',
      competencia: 'Questão de competência do juízo',
      legitimidade: 'Legitimidade ativa/passiva das partes',
      litispendencia: 'Existência de ação idêntica em curso',
      coisa_julgada: 'Alegação de coisa julgada',
      nulidade: 'Alegação de nulidade de ato jurídico',
      indenizacao: 'Pedido de indenização por danos',
      rescisao: 'Rescisão ou resolução contratual',
      inadimplemento: 'Inadimplemento de obrigação',
      responsabilidade_civil: 'Responsabilidade civil',
      obrigacao_fazer: 'Obrigação de fazer',
      tutela_urgencia: 'Tutela provisória de urgência',
      liminar: 'Pedido liminar',
      honorarios: 'Honorários advocatícios',
      custas: 'Custas processuais'
    };
    return descriptions[tipo] || tipo;
  }

  _documentReferences(text, otherDoc) {
    if (!otherDoc.fileName) return false;

    // Buscar referência ao nome do documento
    const name = otherDoc.fileName.replace(/\.(pdf|doc|docx|txt)$/i, '');
    return text.toLowerCase().includes(name.toLowerCase());
  }

  _getContext(text, position, chars) {
    const start = Math.max(0, position - chars);
    const end = Math.min(text.length, position + chars);
    return text.slice(start, end).replace(/\s+/g, ' ').trim();
  }

  _groupEventsByPeriod(eventos) {
    const grupos = {};

    for (const evento of eventos) {
      if (!evento.data) continue;

      const date = new Date(evento.data);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!grupos[yearMonth]) {
        grupos[yearMonth] = [];
      }
      grupos[yearMonth].push(evento);
    }

    return grupos;
  }

  _analyzeSuccessRisk(fatos, provas, teses) {
    let score = 50;
    const fatores = [];

    // Análise de fatos
    if (fatos && fatos.length > 0) {
      const fatosComData = fatos.filter(f => f.data).length;
      if (fatosComData > fatos.length * 0.5) {
        score -= 10;
        fatores.push('Fatos bem documentados com datas');
      }
    }

    // Análise de provas
    if (provas && provas.length > 0) {
      if (provas.length >= 5) {
        score -= 15;
        fatores.push('Bom acervo probatório');
      }
      const documentais = provas.filter(p => p.tipo?.includes('documental')).length;
      if (documentais > provas.length * 0.7) {
        score -= 10;
        fatores.push('Provas predominantemente documentais');
      }
    } else {
      score += 20;
      fatores.push('Acervo probatório limitado');
    }

    // Análise de teses
    if (teses && teses.length > 0) {
      const teseComFundamento = teses.filter(t =>
        t.fundamentacao?.length > 0 || t.jurisprudencia?.length > 0
      ).length;
      if (teseComFundamento > 0) {
        score -= 10;
        fatores.push('Teses com fundamentação legal');
      }
    }

    return { score: Math.max(0, Math.min(100, score)), fatores };
  }

  _analyzeTimeRisk(fatos, qualificacao) {
    let score = 30;
    const fatores = [];

    if (qualificacao?.dataDistribuicao) {
      const dist = new Date(qualificacao.dataDistribuicao);
      const now = new Date();
      const meses = (now - dist) / (1000 * 60 * 60 * 24 * 30);

      if (meses > 24) {
        score += 20;
        fatores.push('Processo com mais de 2 anos');
      } else if (meses > 12) {
        score += 10;
        fatores.push('Processo com mais de 1 ano');
      }
    }

    return { score: Math.max(0, Math.min(100, score)), fatores };
  }

  _analyzeCostRisk(pedidos, qualificacao) {
    let score = 50;
    let impacto = 'médio';
    const fatores = [];

    const valorCausa = qualificacao?.processo?.valorCausa || 0;
    const valorPedidos = pedidos?.reduce((sum, p) => sum + (p.valor || 0), 0) || 0;

    const valorTotal = Math.max(valorCausa, valorPedidos);

    if (valorTotal > 1000000) {
      score += 30;
      impacto = 'muito_alto';
      fatores.push(`Valor expressivo: R$ ${valorTotal.toLocaleString('pt-BR')}`);
    } else if (valorTotal > 100000) {
      score += 20;
      impacto = 'alto';
      fatores.push(`Valor relevante: R$ ${valorTotal.toLocaleString('pt-BR')}`);
    } else if (valorTotal > 10000) {
      impacto = 'médio';
      fatores.push(`Valor moderado: R$ ${valorTotal.toLocaleString('pt-BR')}`);
    } else {
      score -= 10;
      impacto = 'baixo';
    }

    return { score: Math.max(0, Math.min(100, score)), impacto, fatores };
  }

  _analyzeStrategicRisk(teses, provas) {
    let score = 50;
    const fatores = [];

    if (teses && teses.length > 0) {
      const teseForte = teses.some(t =>
        t.jurisprudencia?.length > 0 && t.fundamentacao?.length > 0
      );
      if (teseForte) {
        score -= 15;
        fatores.push('Existem teses bem fundamentadas');
      }
    }

    if (!provas || provas.length < 3) {
      score += 15;
      fatores.push('Necessidade de fortalecer provas');
    }

    return { score: Math.max(0, Math.min(100, score)), fatores };
  }

  _scoreToProbability(score) {
    if (score <= 25) return 'baixa';
    if (score <= 50) return 'média';
    if (score <= 75) return 'alta';
    return 'muito_alta';
  }

  _calculateOverallImpact(matriz) {
    const impacts = ['baixo', 'médio', 'alto', 'muito_alto'];
    const scores = [
      impacts.indexOf(matriz.procedencia.impacto || 'médio'),
      impacts.indexOf(matriz.custos.impacto || 'médio'),
      impacts.indexOf(matriz.estrategico.impacto || 'médio')
    ];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return impacts[Math.round(avg)] || 'médio';
  }

  _generateRiskRecommendations(matriz) {
    const recomendacoes = [];

    if (matriz.procedencia.score >= 60) {
      recomendacoes.push({
        prioridade: 'alta',
        area: 'procedencia',
        acao: 'Fortalecer defesa/acusação com documentação adicional'
      });
    }

    if (matriz.prazo.score >= 50) {
      recomendacoes.push({
        prioridade: 'alta',
        area: 'prazo',
        acao: 'Verificar prazos e possíveis preclusões'
      });
    }

    if (matriz.custos.score >= 70) {
      recomendacoes.push({
        prioridade: 'alta',
        area: 'custos',
        acao: 'Avaliar possibilidade de acordo ou transação'
      });
    }

    if (matriz.estrategico.score >= 60) {
      recomendacoes.push({
        prioridade: 'média',
        area: 'estrategia',
        acao: 'Revisar estratégia processual'
      });
    }

    return recomendacoes;
  }
}

// Singleton
const consolidationService = new ConsolidationService();

export default consolidationService;
export { ConsolidationService };
