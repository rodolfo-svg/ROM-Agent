/**
 * ROM Agent - Analisador Sem�ntico de Jurisprudência
 *
 * DIFERENCIAL COMPETITIVO:
 * - Extrai tese jurídica central automaticamente
 * - Identifica fundamentos legais (leis, artigos, súmulas)
 * - Lista precedentes citados
 * - Classifica resultado (provido/negado/parcial)
 * - Calcula relevância para o caso do usuário
 * - Gera resumo executivo de 2-3 parágrafos
 *
 * Powered by Claude 4 Haiku (rápido + barato)
 */

import { logger } from '../utils/logger.js';

class JurisprudenceAnalyzerService {
  constructor() {
    this.bedrockModule = null;
  }

  /**
   * Lazy load do módulo Bedrock
   */
  async getBedrockModule() {
    if (!this.bedrockModule) {
      const module = await import('../modules/bedrock.js');
      this.bedrockModule = module;
    }
    return this.bedrockModule;
  }

  /**
   * Analisar batch de jurisprudências
   * @param {Array} decisoes - Decisões com ementaCompleta
   * @param {string} contextoUsuario - Contexto do caso do usuário
   * @returns {Promise<Array>} Decisões com análise semântica
   */
  async analyzeBatch(decisoes, contextoUsuario = '') {
    if (!decisoes || decisoes.length === 0) {
      return [];
    }

    logger.info(`[Analyzer] Analisando ${decisoes.length} decisões com Bedrock`);

    // Analisar em paralelo (Haiku é rápido)
    const promises = decisoes.map(decisao =>
      this.analyze(decisao, contextoUsuario).catch(error => {
        logger.error(`[Analyzer] Erro ao analisar decisão: ${error.message}`);
        return { ...decisao, analise: null, analyzeError: error.message };
      })
    );

    return await Promise.all(promises);
  }

  /**
   * Analisar uma decisão individual
   */
  async analyze(decisao, contextoUsuario = '') {
    const { ementaCompleta, titulo, tribunal } = decisao;

    if (!ementaCompleta || ementaCompleta.length < 300) {
      return { ...decisao, analise: null };
    }

    try {
      const bedrock = await this.getBedrockModule();

      // Prompt otimizado para análise jurídica
      const prompt = this.buildAnalysisPrompt(ementaCompleta, titulo, tribunal, contextoUsuario);

      const response = await bedrock.conversar(prompt, {
        modelo: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',  // Haiku 4.5: rápido + barato
        maxTokens: 1000,
        temperature: 0.3, // Mais determinístico para análise
        systemPrompt: this.getSystemPrompt()
      });

      if (!response.sucesso) {
        throw new Error(response.erro || 'Falha na análise Bedrock');
      }

      // Parse da resposta estruturada
      const analise = this.parseAnalysisResponse(response.resposta);

      return {
        ...decisao,
        analise,
        analyzedAt: new Date().toISOString(),
        analyzed: true
      };

    } catch (error) {
      logger.error(`[Analyzer] Erro: ${error.message}`);
      return {
        ...decisao,
        analise: null,
        analyzeError: error.message
      };
    }
  }

  /**
   * System prompt para análise jurídica
   */
  getSystemPrompt() {
    return `Você é um assistente jurídico especializado em análise de jurisprudência brasileira.

Sua tarefa é extrair informações estruturadas de ementas de decisões judiciais.

IMPORTANTE:
- Seja preciso e objetivo
- Extraia apenas informações presentes no texto
- Use formatação JSON válida
- Não invente informações
- Cite artigos de lei exatamente como aparecem`;
  }

  /**
   * Construir prompt de análise
   */
  buildAnalysisPrompt(ementa, titulo, tribunal, contexto) {
    let prompt = `Analise a seguinte ementa de decisão judicial e extraia as informações em formato JSON.

EMENTA:
${ementa.substring(0, 5000)}

${titulo ? `TÍTULO: ${titulo}` : ''}
${tribunal ? `TRIBUNAL: ${tribunal}` : ''}
${contexto ? `\nCONTEXTO DO CASO DO USUÁRIO: ${contexto}` : ''}

Retorne APENAS um JSON válido (sem markdown) com a seguinte estrutura:

{
  "teseJuridica": "Tese central da decisão em 1-2 frases",
  "resultado": "PROVIDO|NEGADO|PARCIALMENTE_PROVIDO|EXTINTO",
  "fundamentosLegais": ["Art. 5º CF", "Lei 8.078/90 art. 6º"],
  "sumulas": ["Súmula 123 STJ"],
  "precedentes": ["REsp 123456", "HC 987654"],
  "palavrasChave": ["habeas corpus", "prisão preventiva"],
  "resumoExecutivo": "Resumo em 2-3 parágrafos",
  "relevanciaParaCaso": 85
}

IMPORTANTE: Retorne APENAS o JSON, sem texto antes ou depois.`;

    return prompt;
  }

  /**
   * Parse da resposta do Bedrock
   */
  parseAnalysisResponse(resposta) {
    try {
      // Remover possível markdown
      let jsonText = resposta.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);

      // Validar estrutura
      return {
        teseJuridica: parsed.teseJuridica || null,
        resultado: this.normalizeResultado(parsed.resultado),
        fundamentosLegais: Array.isArray(parsed.fundamentosLegais) ? parsed.fundamentosLegais : [],
        sumulas: Array.isArray(parsed.sumulas) ? parsed.sumulas : [],
        precedentes: Array.isArray(parsed.precedentes) ? parsed.precedentes : [],
        palavrasChave: Array.isArray(parsed.palavrasChave) ? parsed.palavrasChave : [],
        resumoExecutivo: parsed.resumoExecutivo || null,
        relevanciaParaCaso: this.normalizeRelevancia(parsed.relevanciaParaCaso)
      };

    } catch (error) {
      logger.warn(`[Analyzer] Erro ao parse JSON: ${error.message}`);

      // Fallback: extrair informações básicas com regex
      return this.extractBasicInfo(resposta);
    }
  }

  /**
   * Normalizar resultado
   */
  normalizeResultado(resultado) {
    if (!resultado) return 'DESCONHECIDO';

    const upper = resultado.toUpperCase();
    if (upper.includes('PROVIDO') && !upper.includes('PARCIAL')) return 'PROVIDO';
    if (upper.includes('PARCIAL')) return 'PARCIALMENTE_PROVIDO';
    if (upper.includes('NEGADO') || upper.includes('IMPROVIDO')) return 'NEGADO';
    if (upper.includes('EXTINTO')) return 'EXTINTO';

    return 'DESCONHECIDO';
  }

  /**
   * Normalizar relevância (0-100)
   */
  normalizeRelevancia(relevancia) {
    const num = parseInt(relevancia);
    if (isNaN(num)) return 50;
    return Math.max(0, Math.min(100, num));
  }

  /**
   * Extração básica com regex (fallback)
   */
  extractBasicInfo(texto) {
    const fundamentosLegais = [];
    const sumulas = [];
    const precedentes = [];

    // Artigos de lei
    const artigosRegex = /(?:art\.?|artigo)\s*(\d+[º°]?(?:-[A-Z])?)/gi;
    let match;
    while ((match = artigosRegex.exec(texto)) !== null) {
      fundamentosLegais.push(`Art. ${match[1]}`);
    }

    // Súmulas
    const sumulasRegex = /Súmula\s+(\d+)(?:\s+(STF|STJ|TST|TSE))?/gi;
    while ((match = sumulasRegex.exec(texto)) !== null) {
      sumulas.push(`Súmula ${match[1]}${match[2] ? ' ' + match[2] : ''}`);
    }

    // Precedentes
    const precedentesRegex = /(RE|REsp|HC|RHC|AgRg|AI)\s*(\d{6,})/gi;
    while ((match = precedentesRegex.exec(texto)) !== null) {
      precedentes.push(`${match[1]} ${match[2]}`);
    }

    return {
      teseJuridica: null,
      resultado: 'DESCONHECIDO',
      fundamentosLegais: [...new Set(fundamentosLegais)].slice(0, 10),
      sumulas: [...new Set(sumulas)],
      precedentes: [...new Set(precedentes)].slice(0, 5),
      palavrasChave: [],
      resumoExecutivo: null,
      relevanciaParaCaso: 50
    };
  }
}

export default new JurisprudenceAnalyzerService();
