/**
 * Sistema de Validação de Qualidade Pré-Envio
 *
 * Valida peças jurídicas ANTES de enviar para IA
 * Reduz retrabalho e uso desnecessário de tokens
 *
 * Verifica:
 * - Estrutura da peça
 * - Elementos obrigatórios
 * - Formatação legal
 * - Citações e referências
 * - Dados das partes
 * - Fundamentação jurídica
 */

const fs = require('fs');
const path = require('path');

class QualityValidator {
  constructor() {
    this.rulesPath = path.join(__dirname, '../config/validation_rules.json');
    this.logPath = path.join(__dirname, '../logs/validation_log.json');

    // Regras de validação por tipo de peça
    this.rules = this.loadRules();

    this.ensureDirectories();
  }

  ensureDirectories() {
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * Carrega regras de validação
   */
  loadRules() {
    const defaultRules = {
      // Regras para TODOS os tipos
      common: {
        minLength: 100, // Mínimo de caracteres
        requiredSections: [], // Seções obrigatórias gerais
        forbiddenWords: ['TODO', 'FIXME', 'XXX', '[PENDENTE]']
      },

      // Regras específicas por tipo
      'peticao_inicial': {
        requiredSections: [
          'Excelentíssimo',
          'FATOS',
          'DIREITO',
          'PEDIDOS',
          'Termos em que'
        ],
        requiredData: ['autor', 'réu', 'comarca'],
        minParagraphs: 5,
        mustHaveLegalCitation: true
      },

      'contestacao': {
        requiredSections: [
          'Excelentíssimo',
          'PRELIMINARMENTE',
          'MÉRITO',
          'PEDIDOS',
          'Termos em que'
        ],
        requiredData: ['autor', 'réu', 'processo'],
        minParagraphs: 5,
        mustHaveLegalCitation: true
      },

      'recurso_apelacao': {
        requiredSections: [
          'Excelentíssimo',
          'RAZÕES RECURSAIS',
          'PEDIDOS'
        ],
        requiredData: ['apelante', 'apelado', 'processo', 'sentença'],
        minParagraphs: 5,
        mustHaveLegalCitation: true,
        mustCiteSentenca: true
      },

      'habeas_corpus': {
        requiredSections: [
          'Excelentíssimo',
          'FATOS',
          'ILEGALIDADE',
          'PEDIDO LIMINAR',
          'PEDIDOS'
        ],
        requiredData: ['paciente', 'autoridade_coatora'],
        minParagraphs: 4,
        mustHaveLegalCitation: true,
        urgency: true
      },

      'agravo_instrumento': {
        requiredSections: [
          'Excelentíssimo',
          'DECISÃO RECORRIDA',
          'RAZÕES DO AGRAVO',
          'PEDIDO DE EFEITO SUSPENSIVO',
          'PEDIDOS'
        ],
        requiredData: ['agravante', 'agravado', 'processo', 'decisão'],
        minParagraphs: 4,
        mustHaveLegalCitation: true
      },

      'memoriais': {
        requiredSections: [
          'Excelentíssimo',
          'SÍNTESE',
          'PROVAS',
          'CONCLUSÃO'
        ],
        requiredData: ['parte', 'processo'],
        minParagraphs: 5,
        mustHaveLegalCitation: true
      }
    };

    if (fs.existsSync(this.rulesPath)) {
      try {
        const loaded = JSON.parse(fs.readFileSync(this.rulesPath, 'utf8'));
        return { ...defaultRules, ...loaded };
      } catch (error) {
        console.warn('Erro ao carregar regras, usando padrão:', error);
        return defaultRules;
      }
    }

    // Salvar regras padrão
    fs.writeFileSync(this.rulesPath, JSON.stringify(defaultRules, null, 2));
    return defaultRules;
  }

  /**
   * Valida peça completa antes de enviar para IA
   * @param {Object} piece - Dados da peça
   * @returns {Object} Resultado da validação
   */
  validate(piece) {
    const { type, content, metadata } = piece;

    const results = {
      valid: true,
      errors: [],
      warnings: [],
      score: 100,
      timestamp: new Date().toISOString()
    };

    // 1. Validações gerais (todos os tipos)
    this.validateCommon(content, results);

    // 2. Validações específicas do tipo
    if (this.rules[type]) {
      this.validateSpecific(type, content, metadata, results);
    } else {
      results.warnings.push(`Tipo de peça '${type}' não tem regras específicas - usando validação genérica`);
    }

    // 3. Validações de formatação
    this.validateFormatting(content, results);

    // 4. Validações de citações legais
    this.validateLegalCitations(content, results);

    // 5. Validações de dados das partes
    this.validatePartiesData(metadata, results);

    // Calcular score final
    results.score = this.calculateScore(results);
    results.valid = results.errors.length === 0;

    // Log da validação
    this.logValidation(type, results);

    return results;
  }

  /**
   * Validações comuns a todos os tipos
   */
  validateCommon(content, results) {
    const commonRules = this.rules.common;

    // Tamanho mínimo
    if (content.length < commonRules.minLength) {
      results.errors.push(`Conteúdo muito curto: ${content.length} caracteres (mínimo: ${commonRules.minLength})`);
      results.score -= 20;
    }

    // Palavras proibidas (indicam peça incompleta)
    commonRules.forbiddenWords.forEach(word => {
      if (content.includes(word)) {
        results.errors.push(`Encontrada palavra proibida: "${word}" - indica peça incompleta`);
        results.score -= 15;
      }
    });

    // Verificar se há pelo menos um parágrafo
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    if (paragraphs.length < 2) {
      results.warnings.push('Poucas quebras de parágrafo - peça pode estar mal formatada');
      results.score -= 5;
    }
  }

  /**
   * Validações específicas do tipo de peça
   */
  validateSpecific(type, content, metadata, results) {
    const rules = this.rules[type];

    // Seções obrigatórias
    if (rules.requiredSections) {
      const missingSections = [];
      rules.requiredSections.forEach(section => {
        if (!content.includes(section)) {
          missingSections.push(section);
        }
      });

      if (missingSections.length > 0) {
        results.errors.push(`Seções obrigatórias faltando: ${missingSections.join(', ')}`);
        results.score -= 10 * missingSections.length;
      }
    }

    // Dados obrigatórios
    if (rules.requiredData && metadata) {
      const missingData = [];
      rules.requiredData.forEach(data => {
        if (!metadata[data] || metadata[data].trim() === '') {
          missingData.push(data);
        }
      });

      if (missingData.length > 0) {
        results.errors.push(`Dados obrigatórios faltando nos metadados: ${missingData.join(', ')}`);
        results.score -= 10 * missingData.length;
      }
    }

    // Número mínimo de parágrafos
    if (rules.minParagraphs) {
      const paragraphs = content.split('\n\n').filter(p => p.trim().length > 50);
      if (paragraphs.length < rules.minParagraphs) {
        results.warnings.push(`Poucos parágrafos: ${paragraphs.length} (recomendado: ${rules.minParagraphs})`);
        results.score -= 5;
      }
    }

    // Deve ter citação legal
    if (rules.mustHaveLegalCitation) {
      const hasLegalCitation = /Art\.|Artigo|Lei|CF|CP|CPC|CPP|CLT|CDC/i.test(content);
      if (!hasLegalCitation) {
        results.errors.push('Peça não contém citações legais obrigatórias (Art., Lei, etc)');
        results.score -= 15;
      }
    }

    // Deve citar sentença (para recursos)
    if (rules.mustCiteSentenca) {
      const hasSentenceCitation = /sentença|decisão recorrida|r\. sentença|MM\. Juiz/i.test(content);
      if (!hasSentenceCitation) {
        results.warnings.push('Recurso deve fazer referência explícita à sentença/decisão recorrida');
        results.score -= 10;
      }
    }

    // Urgência (para HC, liminares)
    if (rules.urgency) {
      const hasUrgencyMention = /urgente|liminar|iminente|grave|irreparável/i.test(content);
      if (!hasUrgencyMention) {
        results.warnings.push('Peça urgente deve mencionar urgência/gravidade');
        results.score -= 5;
      }
    }
  }

  /**
   * Validações de formatação
   */
  validateFormatting(content, results) {
    // Verificar se tem cabeçalho formal
    if (!/Excelentíssimo|Ilustríssimo|Meritíssimo/i.test(content.substring(0, 200))) {
      results.warnings.push('Peça deve começar com tratamento formal adequado');
      results.score -= 5;
    }

    // Verificar se tem fecho adequado
    if (!/Termos em que|Nestes termos|Respeitosamente/i.test(content.slice(-500))) {
      results.warnings.push('Peça deve ter fecho formal adequado');
      results.score -= 5;
    }

    // Verificar parágrafos muito longos
    const paragraphs = content.split('\n\n');
    const longParagraphs = paragraphs.filter(p => p.length > 1000);
    if (longParagraphs.length > 2) {
      results.warnings.push(`${longParagraphs.length} parágrafos muito longos - considere dividi-los`);
      results.score -= 3;
    }

    // Verificar uso de maiúsculas excessivo
    const uppercaseWords = content.match(/[A-ZÀÁÉÍÓÚÂÊÔÃÕÇ]{10,}/g);
    if (uppercaseWords && uppercaseWords.length > 5) {
      results.warnings.push('Uso excessivo de maiúsculas - pode prejudicar legibilidade');
      results.score -= 3;
    }
  }

  /**
   * Validações de citações legais
   */
  validateLegalCitations(content, results) {
    // Verificar se citações legais estão formatadas corretamente
    const citationsPatterns = {
      artigos: /Art\.\s*\d+/gi,
      leis: /Lei\s+n?[º°]?\s*[\d.]+\/\d{4}/gi,
      codigos: /\b(CF|CC|CP|CPC|CPP|CLT|CDC|CTN|ECA|LEP)\b/gi
    };

    let totalCitations = 0;

    Object.entries(citationsPatterns).forEach(([type, pattern]) => {
      const matches = content.match(pattern);
      if (matches) {
        totalCitations += matches.length;
      }
    });

    if (totalCitations === 0) {
      results.warnings.push('Nenhuma citação legal encontrada');
      results.score -= 10;
    } else if (totalCitations < 3) {
      results.warnings.push('Poucas citações legais - considere fundamentar melhor');
      results.score -= 5;
    }

    // Verificar referências a jurisprudência
    const jurisCitations = content.match(/STF|STJ|TST|TJ[A-Z]{2}|REsp|RE|HC|AgInt|Súmula/g);
    if (!jurisCitations || jurisCitations.length === 0) {
      results.warnings.push('Sem referências a jurisprudência - considere adicionar precedentes');
      results.score -= 5;
    }
  }

  /**
   * Validações de dados das partes
   */
  validatePartiesData(metadata, results) {
    if (!metadata) {
      results.warnings.push('Metadados não fornecidos');
      return;
    }

    // Validar CPF/CNPJ se fornecidos
    if (metadata.cpf) {
      if (!this.validateCPF(metadata.cpf)) {
        results.errors.push(`CPF inválido: ${metadata.cpf}`);
        results.score -= 10;
      }
    }

    if (metadata.cnpj) {
      if (!this.validateCNPJ(metadata.cnpj)) {
        results.errors.push(`CNPJ inválido: ${metadata.cnpj}`);
        results.score -= 10;
      }
    }

    // Validar número de processo se fornecido
    if (metadata.processo) {
      if (!this.validateProcessNumber(metadata.processo)) {
        results.errors.push(`Número de processo inválido: ${metadata.processo}`);
        results.score -= 10;
      }
    }
  }

  /**
   * Valida CPF
   */
  validateCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    if (cpf.length !== 11) return false;
    // Lógica básica - em produção implementar validação completa
    return !/^(\d)\1{10}$/.test(cpf);
  }

  /**
   * Valida CNPJ
   */
  validateCNPJ(cnpj) {
    cnpj = cnpj.replace(/[^\d]/g, '');
    if (cnpj.length !== 14) return false;
    return !/^(\d)\1{13}$/.test(cnpj);
  }

  /**
   * Valida número de processo CNJ
   */
  validateProcessNumber(processo) {
    // Formato CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO
    const pattern = /^\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}$/;
    return pattern.test(processo);
  }

  /**
   * Calcula score final
   */
  calculateScore(results) {
    let score = results.score;

    // Penalidade por erros
    score -= results.errors.length * 5;

    // Penalidade leve por warnings
    score -= results.warnings.length * 2;

    // Garantir que score não seja negativo
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Registra validação em log
   */
  logValidation(type, results) {
    try {
      let log = [];
      if (fs.existsSync(this.logPath)) {
        log = JSON.parse(fs.readFileSync(this.logPath, 'utf8'));
      }

      log.push({
        timestamp: results.timestamp,
        type,
        valid: results.valid,
        score: results.score,
        errors: results.errors.length,
        warnings: results.warnings.length
      });

      // Manter apenas últimas 1000 validações
      if (log.length > 1000) {
        log = log.slice(-1000);
      }

      fs.writeFileSync(this.logPath, JSON.stringify(log, null, 2));
    } catch (error) {
      console.error('Erro ao salvar log de validação:', error);
    }
  }

  /**
   * Obter estatísticas de validações
   */
  getStatistics() {
    try {
      if (!fs.existsSync(this.logPath)) {
        return { total: 0, valid: 0, invalid: 0, avgScore: 0 };
      }

      const log = JSON.parse(fs.readFileSync(this.logPath, 'utf8'));

      const valid = log.filter(entry => entry.valid).length;
      const invalid = log.length - valid;
      const avgScore = log.reduce((sum, entry) => sum + entry.score, 0) / log.length;

      return {
        total: log.length,
        valid,
        invalid,
        avgScore: avgScore.toFixed(2),
        validRate: `${((valid / log.length) * 100).toFixed(1)}%`
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return { error: error.message };
    }
  }
}

/**
 * Exemplo de uso:
 *
 * const validator = new QualityValidator();
 *
 * const piece = {
 *   type: 'peticao_inicial',
 *   content: '...',
 *   metadata: {
 *     autor: 'João da Silva',
 *     réu: 'Empresa XYZ',
 *     comarca: 'São Paulo',
 *     cpf: '123.456.789-00'
 *   }
 * };
 *
 * const result = validator.validate(piece);
 *
 * if (!result.valid) {
 *   console.log('Erros:', result.errors);
 *   console.log('Avisos:', result.warnings);
 *   console.log('Score:', result.score);
 *   // NÃO enviar para IA - economizar tokens!
 * } else {
 *   // Enviar para IA para geração
 * }
 */

module.exports = QualityValidator;
