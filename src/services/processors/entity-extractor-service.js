/**
 * Entity Extractor Service
 *
 * Named Entity Recognition (NER) para entidades jurídicas brasileiras
 * Extrai partes, advogados, juízes, tribunais, processos e outros elementos
 *
 * Precisão alvo: 90%+
 */

class EntityExtractorService {
  constructor() {
    this.initialized = false;

    // Padrões regex para extração de entidades brasileiras
    this.patterns = {
      // OAB: OAB/SP 123456 ou OAB SP 123.456
      oab: /OAB[\/\s]*([A-Z]{2})[\/\s]*(\d{1,3}\.?\d{3}(?:-[A-Z])?)/gi,

      // CPF: 123.456.789-00
      cpf: /\d{3}\.\d{3}\.\d{3}-\d{2}/g,

      // CNPJ: 12.345.678/0001-90
      cnpj: /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g,

      // Número de processo CNJ: 1234567-89.2020.8.26.0100
      processo: /\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}/g,

      // Tribunais brasileiros
      tribunal: /\b(STF|STJ|TST|TSE|STM|TRF[1-5]?|TRF-[1-5]|TJ[A-Z]{2}|TRT-?\d{1,2}|TRE-[A-Z]{2}|TJDFT)\b/gi,

      // Juízes/Desembargadores/Ministros
      juiz: /(?:Juiz(?:a)?|Juíz(?:a)?|Des(?:embargador)?(?:a)?|Min(?:istro)?(?:a)?|Magistrado(?:a)?|Relator(?:a)?)[:\s]+(?:Dr\.?(?:a)?\.?\s+)?([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç]+(?:\s+(?:de\s+|da\s+|do\s+|dos\s+|das\s+)?[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç]+)*)/gi,

      // Advogados
      advogado: /(?:Advogado(?:a)?|Adv\.?|Procurador(?:a)?|Defensor(?:a)?)[:\s]+(?:Dr\.?(?:a)?\.?\s+)?([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç]+(?:\s+(?:de\s+|da\s+|do\s+|dos\s+|das\s+)?[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç]+)*)/gi,

      // Partes: Autor/Réu/Reclamante/Reclamado/Impetrante/Impetrado
      parteAutor: /(?:Autor(?:a)?|Requerente|Reclamante|Impetrante|Exequente|Apelante|Agravante|Embargante|Demandante)[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][^\n,;]+?)(?=[\n,;]|Réu|Reclamad|CPF|CNPJ|$)/gi,
      parteReu: /(?:Réu|Ré|Requerido(?:a)?|Reclamado(?:a)?|Impetrado(?:a)?|Executado(?:a)?|Apelado(?:a)?|Agravado(?:a)?|Embargado(?:a)?|Demandado(?:a)?)[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][^\n,;]+?)(?=[\n,;]|CPF|CNPJ|$)/gi,

      // Datas brasileiras
      data: /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/g,
      dataExtenso: /\b(\d{1,2})\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})\b/gi,

      // Valores monetários
      valor: /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/g,

      // Artigos de lei
      artigo: /(?:art(?:igo)?\.?|§)\s*(\d+[º°]?)(?:\s*,?\s*(?:§|parágrafo|inciso|alínea)\s*[\d\w]+)*/gi,

      // Leis/Decretos
      lei: /(?:Lei\s+(?:nº\s*)?|Decreto(?:-Lei)?\s+(?:nº\s*)?|MP\s+|Medida\s+Provisória\s+(?:nº\s*)?)(\d+(?:\.\d+)?(?:\/\d{2,4})?)/gi,

      // Varas/Comarcas
      vara: /(\d{1,3}[ªºao]?\s*Vara\s+(?:C[ií]vel|Criminal|do\s+Trabalho|Federal|da\s+Fazenda\s+P[úu]blica|de\s+Fam[íi]lia|Empresarial|de\s+Execu[çc][õo]es|[A-Za-záéíóúâêîôûãõç\s]+)?)/gi,
      comarca: /(?:Comarca\s+de\s+|Foro\s+(?:Central\s+)?(?:de\s+)?|Subseção\s+Judiciária\s+de\s+)([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç]+(?:\s+(?:de\s+|do\s+|da\s+)?[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç]+)*)/gi
    };

    // Meses para parsing de datas por extenso
    this.meses = {
      'janeiro': 1, 'fevereiro': 2, 'março': 3, 'abril': 4,
      'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8,
      'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
    };

    // Cache para evitar processamento repetido
    this.cache = new Map();
  }

  /**
   * Inicializar serviço
   */
  async init() {
    this.initialized = true;
    console.log('✅ Entity Extractor Service inicializado');
    return true;
  }

  /**
   * Extrai todas as entidades de um texto
   * @param {string} text - Texto para análise
   * @param {Object} options - Opções de extração
   * @returns {Object} Entidades extraídas categorizadas
   */
  extractEntities(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return this._emptyResult();
    }

    // Verificar cache
    const cacheKey = this._generateCacheKey(text, options);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const result = {
      partes: this.extractPartes(text),
      advogados: this.extractAdvogados(text),
      juizes: this.extractJuizes(text),
      tribunais: this.extractTribunais(text),
      processos: this.extractProcessos(text),
      documentos: this.extractDocumentos(text),
      datas: this.extractDatas(text),
      valores: this.extractValores(text),
      legislacao: this.extractLegislacao(text),
      varas: this.extractVaras(text),
      metadata: {
        textLength: text.length,
        extractedAt: new Date().toISOString(),
        confidence: this._calculateConfidence(text)
      }
    };

    // Cachear resultado
    this.cache.set(cacheKey, result);

    // Limpar cache se muito grande
    if (this.cache.size > 1000) {
      const keys = Array.from(this.cache.keys()).slice(0, 500);
      keys.forEach(k => this.cache.delete(k));
    }

    return result;
  }

  /**
   * Extrai partes processuais (autor/réu)
   */
  extractPartes(text) {
    const partes = {
      polo_ativo: [],
      polo_passivo: []
    };

    // Extrair autores
    let match;
    const autorPattern = new RegExp(this.patterns.parteAutor.source, 'gi');
    while ((match = autorPattern.exec(text)) !== null) {
      const nome = this._cleanName(match[1]);
      if (nome && nome.length >= 3 && !this._isStopWord(nome)) {
        const cpfCnpj = this._findNearbyDocument(text, match.index);
        partes.polo_ativo.push({
          nome,
          tipo: this._classifyPartyType(nome),
          documento: cpfCnpj,
          posicao: match.index
        });
      }
    }

    // Extrair réus
    const reuPattern = new RegExp(this.patterns.parteReu.source, 'gi');
    while ((match = reuPattern.exec(text)) !== null) {
      const nome = this._cleanName(match[1]);
      if (nome && nome.length >= 3 && !this._isStopWord(nome)) {
        const cpfCnpj = this._findNearbyDocument(text, match.index);
        partes.polo_passivo.push({
          nome,
          tipo: this._classifyPartyType(nome),
          documento: cpfCnpj,
          posicao: match.index
        });
      }
    }

    // Deduplica
    partes.polo_ativo = this._deduplicateEntities(partes.polo_ativo);
    partes.polo_passivo = this._deduplicateEntities(partes.polo_passivo);

    return partes;
  }

  /**
   * Extrai advogados e números OAB
   */
  extractAdvogados(text) {
    const advogados = [];

    // Buscar padrão advogado + nome
    let match;
    const advPattern = new RegExp(this.patterns.advogado.source, 'gi');
    while ((match = advPattern.exec(text)) !== null) {
      const nome = this._cleanName(match[1]);
      if (nome && nome.length >= 3) {
        const oab = this._findNearbyOAB(text, match.index);
        advogados.push({
          nome,
          oab: oab,
          posicao: match.index
        });
      }
    }

    // Buscar OABs diretamente e tentar associar nomes
    const oabPattern = new RegExp(this.patterns.oab.source, 'gi');
    while ((match = oabPattern.exec(text)) !== null) {
      const estado = match[1].toUpperCase();
      const numero = match[2].replace(/\./g, '');
      const oabFormatado = `OAB/${estado} ${numero}`;

      // Verificar se já temos esse OAB
      const jaExiste = advogados.some(a => a.oab === oabFormatado);
      if (!jaExiste) {
        const nome = this._findNearbyName(text, match.index);
        advogados.push({
          nome: nome || 'Advogado não identificado',
          oab: oabFormatado,
          posicao: match.index
        });
      }
    }

    return this._deduplicateEntities(advogados);
  }

  /**
   * Extrai juízes, desembargadores e ministros
   */
  extractJuizes(text) {
    const juizes = [];

    let match;
    const juizPattern = new RegExp(this.patterns.juiz.source, 'gi');
    while ((match = juizPattern.exec(text)) !== null) {
      const nome = this._cleanName(match[1]);
      if (nome && nome.length >= 3) {
        // Determinar cargo
        const matchLower = match[0].toLowerCase();
        let cargo = 'Juiz';
        if (matchLower.includes('ministr')) cargo = 'Ministro';
        else if (matchLower.includes('desembarg')) cargo = 'Desembargador';
        else if (matchLower.includes('relator')) cargo = 'Relator';

        juizes.push({
          nome,
          cargo,
          posicao: match.index
        });
      }
    }

    return this._deduplicateEntities(juizes);
  }

  /**
   * Extrai tribunais
   */
  extractTribunais(text) {
    const tribunais = new Set();

    let match;
    const tribPattern = new RegExp(this.patterns.tribunal.source, 'gi');
    while ((match = tribPattern.exec(text)) !== null) {
      const tribunal = match[1].toUpperCase().replace(/-/g, '');
      tribunais.add(this._normalizeTribunal(tribunal));
    }

    return Array.from(tribunais).map(t => ({
      sigla: t,
      nome: this._getTribunalNome(t)
    }));
  }

  /**
   * Extrai números de processo
   */
  extractProcessos(text) {
    const processos = new Set();

    let match;
    const procPattern = new RegExp(this.patterns.processo.source, 'gi');
    while ((match = procPattern.exec(text)) !== null) {
      processos.add(match[0]);
    }

    return Array.from(processos).map(p => ({
      numero: p,
      ...this._parseProcessoNumber(p)
    }));
  }

  /**
   * Extrai documentos (CPF/CNPJ)
   */
  extractDocumentos(text) {
    const documentos = {
      cpfs: [],
      cnpjs: []
    };

    // CPFs
    let match;
    const cpfPattern = new RegExp(this.patterns.cpf.source, 'gi');
    while ((match = cpfPattern.exec(text)) !== null) {
      if (this._validateCPF(match[0])) {
        documentos.cpfs.push(match[0]);
      }
    }

    // CNPJs
    const cnpjPattern = new RegExp(this.patterns.cnpj.source, 'gi');
    while ((match = cnpjPattern.exec(text)) !== null) {
      if (this._validateCNPJ(match[0])) {
        documentos.cnpjs.push(match[0]);
      }
    }

    // Deduplica
    documentos.cpfs = [...new Set(documentos.cpfs)];
    documentos.cnpjs = [...new Set(documentos.cnpjs)];

    return documentos;
  }

  /**
   * Extrai datas
   */
  extractDatas(text) {
    const datas = [];

    // Datas numéricas
    let match;
    const dataPattern = new RegExp(this.patterns.data.source, 'gi');
    while ((match = dataPattern.exec(text)) !== null) {
      const parsed = this._parseDate(match[1], match[2], match[3]);
      if (parsed) {
        datas.push({
          original: match[0],
          parsed: parsed,
          posicao: match.index
        });
      }
    }

    // Datas por extenso
    const dataExtensoPattern = new RegExp(this.patterns.dataExtenso.source, 'gi');
    while ((match = dataExtensoPattern.exec(text)) !== null) {
      const mes = this.meses[match[2].toLowerCase()];
      const parsed = this._parseDate(match[1], mes.toString(), match[3]);
      if (parsed) {
        datas.push({
          original: match[0],
          parsed: parsed,
          posicao: match.index
        });
      }
    }

    // Ordenar cronologicamente
    return datas.sort((a, b) => new Date(a.parsed) - new Date(b.parsed));
  }

  /**
   * Extrai valores monetários
   */
  extractValores(text) {
    const valores = [];

    let match;
    const valorPattern = new RegExp(this.patterns.valor.source, 'gi');
    while ((match = valorPattern.exec(text)) !== null) {
      const valorStr = match[1].replace(/\./g, '').replace(',', '.');
      const valorNum = parseFloat(valorStr);
      if (!isNaN(valorNum)) {
        valores.push({
          original: match[0],
          valor: valorNum,
          contexto: this._getContext(text, match.index, 50),
          posicao: match.index
        });
      }
    }

    // Ordenar por valor
    return valores.sort((a, b) => b.valor - a.valor);
  }

  /**
   * Extrai referências a legislação
   */
  extractLegislacao(text) {
    const legislacao = [];

    // Leis
    let match;
    const leiPattern = new RegExp(this.patterns.lei.source, 'gi');
    while ((match = leiPattern.exec(text)) !== null) {
      legislacao.push({
        tipo: this._classifyLegislationType(match[0]),
        numero: match[1],
        referencia: match[0].trim(),
        posicao: match.index
      });
    }

    // Artigos
    const artigoPattern = new RegExp(this.patterns.artigo.source, 'gi');
    while ((match = artigoPattern.exec(text)) !== null) {
      // Tentar encontrar a lei associada
      const leiProxima = this._findNearbyLei(text, match.index);
      legislacao.push({
        tipo: 'artigo',
        numero: match[1],
        referencia: match[0].trim(),
        leiAssociada: leiProxima,
        posicao: match.index
      });
    }

    return legislacao;
  }

  /**
   * Extrai varas e comarcas
   */
  extractVaras(text) {
    const locais = {
      varas: [],
      comarcas: []
    };

    // Varas
    let match;
    const varaPattern = new RegExp(this.patterns.vara.source, 'gi');
    while ((match = varaPattern.exec(text)) !== null) {
      locais.varas.push({
        descricao: match[1].trim(),
        posicao: match.index
      });
    }

    // Comarcas
    const comarcaPattern = new RegExp(this.patterns.comarca.source, 'gi');
    while ((match = comarcaPattern.exec(text)) !== null) {
      locais.comarcas.push({
        cidade: match[1].trim(),
        posicao: match.index
      });
    }

    // Deduplica
    locais.varas = this._deduplicateByField(locais.varas, 'descricao');
    locais.comarcas = this._deduplicateByField(locais.comarcas, 'cidade');

    return locais;
  }

  /**
   * Extrai entidades de múltiplos documentos
   * @param {Array} documents - Array de documentos
   * @returns {Object} Entidades consolidadas
   */
  extractFromDocuments(documents) {
    const allEntities = {
      partes: { polo_ativo: [], polo_passivo: [] },
      advogados: [],
      juizes: [],
      tribunais: [],
      processos: [],
      documentos: { cpfs: [], cnpjs: [] },
      datas: [],
      valores: [],
      legislacao: [],
      varas: { varas: [], comarcas: [] }
    };

    for (const doc of documents) {
      const text = doc.text || doc.content || '';
      const entities = this.extractEntities(text);

      // Merge entidades
      allEntities.partes.polo_ativo.push(...entities.partes.polo_ativo);
      allEntities.partes.polo_passivo.push(...entities.partes.polo_passivo);
      allEntities.advogados.push(...entities.advogados);
      allEntities.juizes.push(...entities.juizes);
      allEntities.tribunais.push(...entities.tribunais);
      allEntities.processos.push(...entities.processos);
      allEntities.documentos.cpfs.push(...entities.documentos.cpfs);
      allEntities.documentos.cnpjs.push(...entities.documentos.cnpjs);
      allEntities.datas.push(...entities.datas);
      allEntities.valores.push(...entities.valores);
      allEntities.legislacao.push(...entities.legislacao);
      allEntities.varas.varas.push(...entities.varas.varas);
      allEntities.varas.comarcas.push(...entities.varas.comarcas);
    }

    // Deduplica todas as entidades
    allEntities.partes.polo_ativo = this._deduplicateEntities(allEntities.partes.polo_ativo);
    allEntities.partes.polo_passivo = this._deduplicateEntities(allEntities.partes.polo_passivo);
    allEntities.advogados = this._deduplicateEntities(allEntities.advogados);
    allEntities.juizes = this._deduplicateEntities(allEntities.juizes);
    allEntities.tribunais = this._deduplicateByField(allEntities.tribunais, 'sigla');
    allEntities.processos = this._deduplicateByField(allEntities.processos, 'numero');
    allEntities.documentos.cpfs = [...new Set(allEntities.documentos.cpfs)];
    allEntities.documentos.cnpjs = [...new Set(allEntities.documentos.cnpjs)];

    return allEntities;
  }

  /**
   * Extrai as N entidades mais relevantes
   * @param {Array} documents - Array de documentos
   * @param {number} limit - Número máximo de entidades por categoria
   * @returns {Object} Entidades principais
   */
  extractKeyEntities(documents, limit = 5) {
    const all = this.extractFromDocuments(documents);

    return {
      principais: {
        partes: {
          polo_ativo: all.partes.polo_ativo.slice(0, limit),
          polo_passivo: all.partes.polo_passivo.slice(0, limit)
        },
        advogados: all.advogados.slice(0, limit),
        juizes: all.juizes.slice(0, limit),
        tribunais: all.tribunais.slice(0, limit),
        processosPrincipais: all.processos.slice(0, 3),
        valoresPrincipais: all.valores.slice(0, 3)
      },
      secundarias: {
        legislacaoRelevante: this._rankLegislacao(all.legislacao).slice(0, 10),
        datasChave: this._identifyKeyDates(all.datas).slice(0, 5),
        localizacao: {
          vara: all.varas.varas[0]?.descricao || null,
          comarca: all.varas.comarcas[0]?.cidade || null
        }
      },
      estatisticas: {
        totalPartes: all.partes.polo_ativo.length + all.partes.polo_passivo.length,
        totalAdvogados: all.advogados.length,
        totalProcessos: all.processos.length,
        totalValores: all.valores.length,
        valorTotal: all.valores.reduce((sum, v) => sum + v.valor, 0)
      }
    };
  }

  // ═══════════════════════════════════════════════════════════
  // MÉTODOS AUXILIARES
  // ═══════════════════════════════════════════════════════════

  _emptyResult() {
    return {
      partes: { polo_ativo: [], polo_passivo: [] },
      advogados: [],
      juizes: [],
      tribunais: [],
      processos: [],
      documentos: { cpfs: [], cnpjs: [] },
      datas: [],
      valores: [],
      legislacao: [],
      varas: { varas: [], comarcas: [] },
      metadata: {
        textLength: 0,
        extractedAt: new Date().toISOString(),
        confidence: 0
      }
    };
  }

  _generateCacheKey(text, options) {
    // Hash simples do texto + options
    const hash = text.slice(0, 100) + text.length + JSON.stringify(options);
    return hash;
  }

  _cleanName(name) {
    if (!name) return null;
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[,;.:]+$/, '')
      .replace(/^\s*-\s*/, '')
      .trim();
  }

  _isStopWord(text) {
    const stopWords = [
      'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
      'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
      'por', 'para', 'com', 'sem', 'sobre', 'entre',
      'que', 'qual', 'quais', 'como', 'quando', 'onde',
      'processo', 'autos', 'petição', 'inicial', 'contestação'
    ];
    return stopWords.includes(text.toLowerCase());
  }

  _classifyPartyType(nome) {
    const nomeLower = nome.toLowerCase();

    // Pessoa Jurídica
    if (nomeLower.includes('ltda') || nomeLower.includes('s.a') ||
        nomeLower.includes('s/a') || nomeLower.includes('eireli') ||
        nomeLower.includes('me ') || nomeLower.includes('epp') ||
        nomeLower.includes('inc.') || nomeLower.includes('corporation')) {
      return 'pessoa_juridica';
    }

    // Órgão público
    if (nomeLower.includes('estado') || nomeLower.includes('município') ||
        nomeLower.includes('união') || nomeLower.includes('inss') ||
        nomeLower.includes('fazenda') || nomeLower.includes('secretaria')) {
      return 'orgao_publico';
    }

    return 'pessoa_fisica';
  }

  _findNearbyDocument(text, position) {
    const window = text.slice(position, position + 200);

    const cpfMatch = window.match(this.patterns.cpf);
    if (cpfMatch) return cpfMatch[0];

    const cnpjMatch = window.match(this.patterns.cnpj);
    if (cnpjMatch) return cnpjMatch[0];

    return null;
  }

  _findNearbyOAB(text, position) {
    const window = text.slice(Math.max(0, position - 50), position + 150);
    // Use a non-global regex for single match with capture groups
    const oabPattern = /OAB[\/\s]*([A-Z]{2})[\/\s]*(\d{1,3}\.?\d{3}(?:-[A-Z])?)/i;
    const match = window.match(oabPattern);
    if (match && match[1] && match[2]) {
      const estado = match[1].toUpperCase();
      const numero = match[2].replace(/\./g, '');
      return `OAB/${estado} ${numero}`;
    }
    return null;
  }

  _findNearbyName(text, position) {
    // Procurar nome antes do OAB
    const before = text.slice(Math.max(0, position - 100), position);
    const namePattern = /([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç]+(?:\s+(?:de\s+|da\s+|do\s+|dos\s+|das\s+)?[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç]+)+)/g;

    let lastMatch = null;
    let match;
    while ((match = namePattern.exec(before)) !== null) {
      lastMatch = match[1];
    }

    return lastMatch;
  }

  _findNearbyLei(text, position) {
    const window = text.slice(Math.max(0, position - 200), position + 50);
    const match = window.match(this.patterns.lei);
    return match ? match[0].trim() : null;
  }

  _normalizeTribunal(sigla) {
    // Normalizar siglas de tribunais
    const normalizations = {
      'TRF1': 'TRF1', 'TRF2': 'TRF2', 'TRF3': 'TRF3', 'TRF4': 'TRF4', 'TRF5': 'TRF5',
      'TRF-1': 'TRF1', 'TRF-2': 'TRF2', 'TRF-3': 'TRF3', 'TRF-4': 'TRF4', 'TRF-5': 'TRF5'
    };
    return normalizations[sigla] || sigla;
  }

  _getTribunalNome(sigla) {
    const nomes = {
      'STF': 'Supremo Tribunal Federal',
      'STJ': 'Superior Tribunal de Justiça',
      'TST': 'Tribunal Superior do Trabalho',
      'TSE': 'Tribunal Superior Eleitoral',
      'STM': 'Superior Tribunal Militar',
      'TRF1': 'Tribunal Regional Federal da 1ª Região',
      'TRF2': 'Tribunal Regional Federal da 2ª Região',
      'TRF3': 'Tribunal Regional Federal da 3ª Região',
      'TRF4': 'Tribunal Regional Federal da 4ª Região',
      'TRF5': 'Tribunal Regional Federal da 5ª Região',
      'TJSP': 'Tribunal de Justiça de São Paulo',
      'TJRJ': 'Tribunal de Justiça do Rio de Janeiro',
      'TJMG': 'Tribunal de Justiça de Minas Gerais',
      'TJRS': 'Tribunal de Justiça do Rio Grande do Sul',
      'TJPR': 'Tribunal de Justiça do Paraná',
      'TJSC': 'Tribunal de Justiça de Santa Catarina',
      'TJDFT': 'Tribunal de Justiça do Distrito Federal e Territórios'
    };
    return nomes[sigla] || sigla;
  }

  _parseProcessoNumber(numero) {
    // Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
    const parts = numero.match(/(\d{7})-(\d{2})\.(\d{4})\.(\d{1})\.(\d{2})\.(\d{4})/);
    if (!parts) return {};

    const justicaMap = {
      '1': 'STF', '2': 'CNJ', '3': 'STJ', '4': 'Justiça Federal',
      '5': 'Justiça do Trabalho', '6': 'Justiça Eleitoral',
      '7': 'Justiça Militar da União', '8': 'Justiça Estadual', '9': 'Justiça Militar Estadual'
    };

    return {
      sequencial: parts[1],
      digito: parts[2],
      ano: parts[3],
      segmento: parts[4],
      segmentoNome: justicaMap[parts[4]] || 'Desconhecido',
      tribunal: parts[5],
      origem: parts[6]
    };
  }

  _validateCPF(cpf) {
    const numbers = cpf.replace(/\D/g, '');
    if (numbers.length !== 11) return false;
    if (/^(\d)\1+$/.test(numbers)) return false;

    // Validação dos dígitos verificadores
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(numbers[i]) * (10 - i);
    }
    let digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;
    if (digit !== parseInt(numbers[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(numbers[i]) * (11 - i);
    }
    digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;
    if (digit !== parseInt(numbers[10])) return false;

    return true;
  }

  _validateCNPJ(cnpj) {
    const numbers = cnpj.replace(/\D/g, '');
    if (numbers.length !== 14) return false;
    if (/^(\d)\1+$/.test(numbers)) return false;

    // Validação dos dígitos verificadores
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(numbers[i]) * weights1[i];
    }
    let digit = sum % 11;
    digit = digit < 2 ? 0 : 11 - digit;
    if (digit !== parseInt(numbers[12])) return false;

    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(numbers[i]) * weights2[i];
    }
    digit = sum % 11;
    digit = digit < 2 ? 0 : 11 - digit;
    if (digit !== parseInt(numbers[13])) return false;

    return true;
  }

  _parseDate(day, month, year) {
    let d = parseInt(day);
    let m = parseInt(month);
    let y = parseInt(year);

    // Ajustar ano de 2 dígitos
    if (y < 100) {
      y = y > 50 ? 1900 + y : 2000 + y;
    }

    // Validar data
    if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) {
      return null;
    }

    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  _getContext(text, position, chars) {
    const start = Math.max(0, position - chars);
    const end = Math.min(text.length, position + chars);
    return text.slice(start, end).replace(/\s+/g, ' ').trim();
  }

  _classifyLegislationType(ref) {
    const lower = ref.toLowerCase();
    if (lower.includes('decreto-lei')) return 'decreto-lei';
    if (lower.includes('decreto')) return 'decreto';
    if (lower.includes('medida provisória') || lower.includes('mp ')) return 'medida_provisoria';
    if (lower.includes('lei complementar')) return 'lei_complementar';
    return 'lei';
  }

  _rankLegislacao(legislacao) {
    // Contar frequência de cada referência
    const freq = {};
    legislacao.forEach(l => {
      const key = l.referencia;
      freq[key] = (freq[key] || 0) + 1;
    });

    // Ordenar por frequência
    return legislacao
      .filter((l, i, arr) => arr.findIndex(x => x.referencia === l.referencia) === i)
      .sort((a, b) => (freq[b.referencia] || 0) - (freq[a.referencia] || 0));
  }

  _identifyKeyDates(datas) {
    // Identificar datas mais importantes (mais frequentes ou mencionadas em contextos relevantes)
    const freq = {};
    datas.forEach(d => {
      const key = d.parsed;
      freq[key] = (freq[key] || 0) + 1;
    });

    return datas
      .filter((d, i, arr) => arr.findIndex(x => x.parsed === d.parsed) === i)
      .sort((a, b) => (freq[b.parsed] || 0) - (freq[a.parsed] || 0));
  }

  _deduplicateEntities(entities) {
    const seen = new Set();
    return entities.filter(e => {
      const key = e.nome?.toLowerCase() || e.numero || JSON.stringify(e);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  _deduplicateByField(entities, field) {
    const seen = new Set();
    return entities.filter(e => {
      const key = e[field]?.toLowerCase?.() || e[field];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  _calculateConfidence(text) {
    // Calcular confiança baseada na qualidade do texto
    let score = 0;

    // Texto tem tamanho razoável
    if (text.length > 100) score += 20;
    if (text.length > 500) score += 10;
    if (text.length > 2000) score += 10;

    // Contém elementos jurídicos típicos
    if (this.patterns.processo.test(text)) score += 15;
    if (this.patterns.tribunal.test(text)) score += 10;
    if (this.patterns.oab.test(text)) score += 10;
    if (this.patterns.lei.test(text)) score += 10;
    if (this.patterns.artigo.test(text)) score += 5;

    // Estrutura de documento jurídico
    if (/petição|contestação|recurso|sentença|acórdão/i.test(text)) score += 10;

    return Math.min(score, 100);
  }
}

// Singleton
const entityExtractorService = new EntityExtractorService();

export default entityExtractorService;
export { EntityExtractorService };
