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
import analysisCache from '../utils/analysis-cache.js';

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

    // 💾 CACHE CHECK (Fase 3: evita reprocessar ementas idênticas)
    const ementaHash = analysisCache.generateHash(ementaCompleta);
    const cached = analysisCache.getCachedAnalysis(ementaHash);

    if (cached) {
      logger.info('[Analyzer] Cache HIT', { hash: ementaHash.substring(0, 8) });
      return {
        ...decisao,
        analise: cached,
        analyzedAt: new Date().toISOString(),
        analyzed: true,
        fromCache: true
      };
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

      // 💾 CACHE WRITE (salvar para uso futuro)
      analysisCache.setCachedAnalysis(ementaHash, analise, {
        titulo,
        tribunal,
        analyzedAt: new Date().toISOString()
      });

      return {
        ...decisao,
        analise,
        analyzedAt: new Date().toISOString(),
        analyzed: true,
        fromCache: false
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

Sua tarefa é extrair informações estruturadas de ementas de decisões judiciais, incluindo:
- Ementa integral (texto completo)
- Dados catalogográficos (tribunal, número, relator, órgão julgador, data)
- Tese/ratio decidendi (fundamento central da decisão)
- Vigência (se a decisão foi superada, reformada ou revisada posteriormente)

IMPORTANTE:
- Seja preciso e objetivo
- Extraia apenas informações presentes no texto
- Use formatação JSON válida
- Não invente informações
- Cite artigos de lei exatamente como aparecem
- Identifique se há menção a superação, reforma ou revisão da decisão`;
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
  "teseJuridica": "Tese central da decisão (ratio decidendi) em 1-2 frases",
  "resultado": "PROVIDO|NEGADO|PARCIALMENTE_PROVIDO|EXTINTO",
  "fundamentosLegais": ["Art. 5º CF", "Lei 8.078/90 art. 6º"],
  "sumulas": ["Súmula 123 STJ"],
  "precedentes": ["REsp 123456", "HC 987654"],
  "palavrasChave": ["habeas corpus", "prisão preventiva"],
  "resumoExecutivo": "Resumo em 2-3 parágrafos",
  "relevanciaParaCaso": 85,
  "vigencia": {
    "status": "VIGENTE|SUPERADO|REFORMADO|REVISADO",
    "observacao": "Informação sobre superação, reforma ou revisão (se houver menção no texto)"
  }
}

IMPORTANTE:
- Retorne APENAS o JSON, sem texto antes ou depois
- Para vigência, procure por menções como "superado por", "reformado em", "revisado pelo"
- Se não houver menção, use status "VIGENTE" e observacao null`;

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
        relevanciaParaCaso: this.normalizeRelevancia(parsed.relevanciaParaCaso),
        vigencia: this.normalizeVigencia(parsed.vigencia)
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
   * Normalizar vigência
   */
  normalizeVigencia(vigencia) {
    if (!vigencia || typeof vigencia !== 'object') {
      return { status: 'VIGENTE', observacao: null };
    }

    const status = (vigencia.status || 'VIGENTE').toUpperCase();
    const validStatus = ['VIGENTE', 'SUPERADO', 'REFORMADO', 'REVISADO'];

    return {
      status: validStatus.includes(status) ? status : 'VIGENTE',
      observacao: vigencia.observacao || null
    };
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

    // Detectar vigência no texto (fallback simples)
    let vigenciaStatus = 'VIGENTE';
    let vigenciaObs = null;

    // Regex aprimorados para detectar menções de alteração de vigência
    if (/(?:foi\s+)?superad[oa]/i.test(texto)) {
      vigenciaStatus = 'SUPERADO';
      const match = texto.match(/(?:foi\s+)?superad[oa]\s+(?:por|pelo|pela)\s+([^.,]+)/i);
      vigenciaObs = match ? match[0] : 'Decisão superada (mencionado no texto)';
    } else if (/reformad[oa]/i.test(texto)) {
      vigenciaStatus = 'REFORMADO';
      const match = texto.match(/reformad[oa]\s+(?:por|pelo|pela|em)\s+([^.,]+)/i);
      vigenciaObs = match ? match[0] : 'Decisão reformada (mencionado no texto)';
    } else if (/(?:foi\s+)?revisad[oa]/i.test(texto)) {
      vigenciaStatus = 'REVISADO';
      const match = texto.match(/(?:foi\s+)?revisad[oa]\s+(?:por|pelo|pela|em)\s+([^.,]+)/i);
      vigenciaObs = match ? match[0] : 'Decisão revisada (mencionado no texto)';
    }

    return {
      teseJuridica: null,
      resultado: 'DESCONHECIDO',
      fundamentosLegais: [...new Set(fundamentosLegais)].slice(0, 10),
      sumulas: [...new Set(sumulas)],
      precedentes: [...new Set(precedentes)].slice(0, 5),
      palavrasChave: [],
      resumoExecutivo: null,
      relevanciaParaCaso: 50,
      vigencia: {
        status: vigenciaStatus,
        observacao: vigenciaObs
      }
    };
  }
}

export default new JurisprudenceAnalyzerService();
