/**
 * Document Classifier
 * Classifica automaticamente documentos judiciais por tipo
 *
 * Funções:
 * - Identificar tipo de documento (petição, sentença, acórdão, etc.)
 * - Classificar por área do direito
 * - Extrair metadados relevantes
 * - Atribuir tags automáticas
 */

export class DocumentClassifier {
  constructor() {
    // Padrões de identificação de tipo de documento
    this.documentTypes = {
      'Petição Inicial': {
        patterns: [/petição\s+inicial/i, /exordial/i, /ação\s+de/i],
        keywords: ['autor', 'réu', 'pedido', 'causa de pedir', 'requer'],
        confidence: 0
      },
      'Contestação': {
        patterns: [/contestação/i, /resposta\s+do\s+réu/i, /impugnação/i],
        keywords: ['preliminarmente', 'no mérito', 'improcedência', 'negativa geral'],
        confidence: 0
      },
      'Sentença': {
        patterns: [/sentença/i, /julgo\s+(?:procedente|improcedente)/i],
        keywords: ['dispositivo', 'fundamentação', 'julgo', 'condeno', 'absolvo'],
        confidence: 0
      },
      'Acórdão': {
        patterns: [/acórdão/i, /acordam\s+os/i, /tribunal/i],
        keywords: ['acordam', 'relatório', 'voto', 'recurso', 'provimento'],
        confidence: 0
      },
      'Decisão Interlocutória': {
        patterns: [/decisão\s+interlocutória/i, /defiro/i, /indefiro/i],
        keywords: ['defiro', 'indefiro', 'determino', 'processo'],
        confidence: 0
      },
      'Despacho': {
        patterns: [/despacho/i],
        keywords: ['intime-se', 'cumpra-se', 'certifique-se', 'dê-se vista'],
        confidence: 0
      },
      'Recurso': {
        patterns: [/(?:apelação|agravo|recurso)/i],
        keywords: ['recorrente', 'recorrido', 'reforma', 'provimento'],
        confidence: 0
      },
      'Manifestação': {
        patterns: [/manifestação/i, /réplica/i, /tréplica/i],
        keywords: ['manifesta-se', 'em resposta', 'vem apresentar'],
        confidence: 0
      },
      'Certidão': {
        patterns: [/certidão/i, /certifico/i],
        keywords: ['certifico', 'certifica-se', 'nada consta'],
        confidence: 0
      },
      'Intimação': {
        patterns: [/intimação/i, /ciência/i],
        keywords: ['fica intimado', 'para conhecimento', 'ciência'],
        confidence: 0
      }
    };

    // Áreas do direito
    this.legalAreas = {
      'Direito Civil': {
        keywords: ['responsabilidade civil', 'contrato', 'obrigação', 'indenização', 'danos morais', 'posse', 'propriedade'],
        codes: ['CC', 'Código Civil']
      },
      'Direito Penal': {
        keywords: ['crime', 'pena', 'prisão', 'condenação', 'absolvição', 'réu', 'denúncia', 'prescrição penal'],
        codes: ['CP', 'Código Penal', 'CPP', 'Código de Processo Penal']
      },
      'Direito Trabalhista': {
        keywords: ['trabalhador', 'empregado', 'empregador', 'CLT', 'rescisão', 'FGTS', 'justa causa', 'verbas rescisórias'],
        codes: ['CLT', 'Consolidação das Leis do Trabalho']
      },
      'Direito Tributário': {
        keywords: ['tributo', 'imposto', 'taxa', 'contribuição', 'fiscal', 'CTN', 'ICMS', 'ISS', 'IPTU', 'IR'],
        codes: ['CTN', 'Código Tributário Nacional']
      },
      'Direito do Consumidor': {
        keywords: ['consumidor', 'fornecedor', 'produto', 'serviço', 'CDC', 'relação de consumo', 'vício'],
        codes: ['CDC', 'Código de Defesa do Consumidor']
      },
      'Direito Previdenciário': {
        keywords: ['previdência', 'INSS', 'aposentadoria', 'benefício', 'auxílio', 'pensão'],
        codes: ['Lei 8.213', 'Lei de Benefícios']
      },
      'Direito Administrativo': {
        keywords: ['administração pública', 'servidor público', 'licitação', 'contrato administrativo', 'ato administrativo'],
        codes: ['Lei 8.666', 'Lei de Licitações']
      },
      'Direito Processual': {
        keywords: ['processo', 'procedimento', 'recurso', 'sentença', 'liminar', 'tutela'],
        codes: ['CPC', 'Código de Processo Civil']
      }
    };
  }

  /**
   * Classificar documento por tipo
   */
  classifyType(text) {
    const textLower = text.toLowerCase();
    const results = {};

    // Calcular score para cada tipo
    for (const [type, config] of Object.entries(this.documentTypes)) {
      let score = 0;

      // Verificar padrões (peso 3)
      for (const pattern of config.patterns) {
        if (pattern.test(text)) {
          score += 3;
        }
      }

      // Verificar keywords (peso 1 cada)
      for (const keyword of config.keywords) {
        if (textLower.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }

      results[type] = score;
    }

    // Ordenar por score
    const sorted = Object.entries(results)
      .sort((a, b) => b[1] - a[1])
      .map(([type, score]) => ({
        type,
        score,
        confidence: this.calculateConfidence(score)
      }));

    return {
      primaryType: sorted[0].type,
      confidence: sorted[0].confidence,
      allScores: sorted
    };
  }

  /**
   * Classificar área do direito
   */
  classifyLegalArea(text) {
    const textLower = text.toLowerCase();
    const results = {};

    for (const [area, config] of Object.entries(this.legalAreas)) {
      let score = 0;

      // Verificar keywords (peso 2)
      for (const keyword of config.keywords) {
        const regex = new RegExp(keyword.toLowerCase(), 'g');
        const matches = textLower.match(regex);
        if (matches) {
          score += matches.length * 2;
        }
      }

      // Verificar códigos/leis (peso 5)
      for (const code of config.codes) {
        const regex = new RegExp(code, 'gi');
        const matches = text.match(regex);
        if (matches) {
          score += matches.length * 5;
        }
      }

      results[area] = score;
    }

    // Ordenar por score
    const sorted = Object.entries(results)
      .sort((a, b) => b[1] - a[1])
      .filter(([area, score]) => score > 0)
      .map(([area, score]) => ({
        area,
        score,
        confidence: this.calculateConfidence(score, 10)
      }));

    return {
      primaryArea: sorted.length > 0 ? sorted[0].area : 'Não identificado',
      confidence: sorted.length > 0 ? sorted[0].confidence : 'low',
      allScores: sorted
    };
  }

  /**
   * Extrair metadados básicos
   */
  extractMetadata(text) {
    const metadata = {
      partes: this.extractPartes(text),
      numeroProcesso: this.extractNumeroProcesso(text),
      tribunal: this.extractTribunal(text),
      vara: this.extractVara(text),
      data: this.extractDates(text),
      advogados: this.extractAdvogados(text)
    };

    return metadata;
  }

  /**
   * Extrair partes (autor, réu)
   */
  extractPartes(text) {
    const partes = {
      autores: [],
      reus: []
    };

    // Padrões comuns
    const autorPatterns = [
      /(?:autor|autora|requerente|impetrante|recorrente|exequente):\s*([^\n]+)/gi,
      /(?:de um lado|na qualidade de autor)[\s:]+([^,\n]+)/gi
    ];

    const reuPatterns = [
      /(?:réu|ré|requerido|recorrido|executado|impetrado):\s*([^\n]+)/gi,
      /(?:de outro lado|na qualidade de réu)[\s:]+([^,\n]+)/gi
    ];

    for (const pattern of autorPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        if (match[1] && match[1].trim()) {
          partes.autores.push(match[1].trim());
        }
      }
    }

    for (const pattern of reuPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        if (match[1] && match[1].trim()) {
          partes.reus.push(match[1].trim());
        }
      }
    }

    return partes;
  }

  /**
   * Extrair número do processo
   */
  extractNumeroProcesso(text) {
    const patterns = [
      /(\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4})/,  // Formato CNJ completo
      /(\d{4}\.\d{2}\.\d{6}-\d)/,                    // Formato alternativo
      /(?:processo|autos)\s+(?:n\.?|nº|número)\s*(\d[\d.-]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extrair tribunal
   */
  extractTribunal(text) {
    const tribunalPatterns = [
      /(?:STF|Supremo Tribunal Federal)/i,
      /(?:STJ|Superior Tribunal de Justiça)/i,
      /(?:TST|Tribunal Superior do Trabalho)/i,
      /(?:TJ[A-Z]{2}|Tribunal de Justiça)/i,
      /(?:TRF-?\d|Tribunal Regional Federal)/i,
      /(?:TRT-?\d+|Tribunal Regional do Trabalho)/i
    ];

    for (const pattern of tribunalPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  /**
   * Extrair vara
   */
  extractVara(text) {
    const varaPattern = /(\d+ª?\s*Vara\s+[^\n]+)/i;
    const match = text.match(varaPattern);
    return match ? match[1].trim() : null;
  }

  /**
   * Extrair datas
   */
  extractDates(text) {
    const dates = [];
    const datePattern = /(\d{1,2}\/\d{1,2}\/\d{4})/g;
    const matches = [...text.matchAll(datePattern)];

    for (const match of matches) {
      dates.push(match[1]);
    }

    return [...new Set(dates)]; // Remove duplicatas
  }

  /**
   * Extrair advogados e OAB
   */
  extractAdvogados(text) {
    const advogados = [];
    const oabPattern = /OAB[/-]?([A-Z]{2})\s*(\d+)/gi;
    const matches = [...text.matchAll(oabPattern)];

    for (const match of matches) {
      advogados.push({
        oab: match[0],
        estado: match[1],
        numero: match[2]
      });
    }

    return advogados;
  }

  /**
   * Gerar tags automáticas
   */
  generateTags(text, classification) {
    const tags = new Set();

    // Tags baseadas no tipo
    tags.add(classification.type.primaryType);

    // Tags baseadas na área
    if (classification.area.primaryArea !== 'Não identificado') {
      tags.add(classification.area.primaryArea);
    }

    // Tags baseadas em keywords importantes
    const importantKeywords = [
      'urgente', 'liminar', 'tutela', 'recurso', 'embargos',
      'prescrição', 'decadência', 'nulidade', 'incompetência'
    ];

    const textLower = text.toLowerCase();
    for (const keyword of importantKeywords) {
      if (textLower.includes(keyword)) {
        tags.add(keyword);
      }
    }

    return Array.from(tags);
  }

  /**
   * Calcular confiança (low, medium, high)
   */
  calculateConfidence(score, threshold = 5) {
    if (score >= threshold * 2) return 'high';
    if (score >= threshold) return 'medium';
    return 'low';
  }

  /**
   * Classificação completa
   */
  async classify(text) {
    const classification = {
      type: this.classifyType(text),
      area: this.classifyLegalArea(text),
      metadata: this.extractMetadata(text),
      tags: [],
      summary: {}
    };

    // Gerar tags
    classification.tags = this.generateTags(text, classification);

    // Resumo
    classification.summary = {
      documentType: classification.type.primaryType,
      legalArea: classification.area.primaryArea,
      confidence: classification.type.confidence,
      numeroProcesso: classification.metadata.numeroProcesso,
      tribunal: classification.metadata.tribunal,
      totalTags: classification.tags.length
    };

    return classification;
  }
}

export default DocumentClassifier;
