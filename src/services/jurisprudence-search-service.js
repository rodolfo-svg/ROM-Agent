/**
 * Serviço de Busca de Jurisprudência
 *
 * Integra com múltiplas fontes:
 * - DataJud (API oficial do CNJ)
 * - JusBrasil (via web scraping ou API)
 * - Web Search (busca geral)
 *
 * Integra com Layer 4 do ROM Case Processor Service
 *
 * @version 1.0.0
 */

import https from 'https';
import http from 'http';
import crypto from 'crypto';
import cacheService from '../utils/cache/cache-service.js';

class JurisprudenceSearchService {
  constructor() {
    this.initialized = false;
    this.config = {
      datajud: {
        enabled: process.env.DATAJUD_ENABLED === 'true' || false,
        apiUrl: process.env.DATAJUD_API_URL || 'https://datajud.cnj.jus.br/api/v1',
        apiKey: process.env.DATAJUD_API_KEY || null,
        timeout: 30000 // 30 segundos
      },
      jusbrasil: {
        enabled: process.env.JUSBRASIL_ENABLED === 'true' || false, // Desabilitado: bloqueio anti-bot 100%
        apiUrl: 'https://www.jusbrasil.com.br/busca',
        timeout: 30000
      },
      websearch: {
        enabled: true,
        timeout: 30000
      }
    };
  }

  /**
   * Inicializar serviço
   */
  async init() {
    try {
      await cacheService.init();
      this.initialized = true;

      // Verificar configuração do Google Search (CRÍTICO para performance)
      const googleConfigured = !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX);

      console.log('✅ Jurisprudence Search Service inicializado');
      console.log(`   - DataJud: ${this.config.datajud.enabled ? 'Habilitado' : 'Desabilitado'}`);
      console.log(`   - JusBrasil: ${this.config.jusbrasil.enabled ? 'Habilitado' : 'Desabilitado'}`);
      console.log(`   - WebSearch: ${this.config.websearch.enabled ? 'Habilitado' : 'Desabilitado'}`);
      console.log(`   - Google Search API: ${googleConfigured ? '✅ CONFIGURADO' : '❌ NÃO CONFIGURADO (CRÍTICO!)'}`);

      if (!googleConfigured) {
        console.warn('⚠️ AVISO CRÍTICO: Google Search API não configurada!');
        console.warn('   Sem GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX, buscas podem travar por 30+ segundos.');
        console.warn('   Configure no Render.com > Environment Variables');
      }

      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar Jurisprudence Search:', error);
      return false;
    }
  }

  /**
   * Buscar jurisprudência em todas as fontes disponíveis
   *
   * @param {string} tese - Tese jurídica para buscar
   * @param {object} options - Opções de busca
   * @returns {Promise<object>} Resultados consolidados
   */
  async searchAll(tese, options = {}) {
    const {
      limit = 10,
      tribunal = null,
      dataInicio = null,
      dataFim = null,
      enableCache = true
    } = options;

    const searchStartTime = Date.now();
    console.log(`🔍 [BUSCA] Iniciando busca de jurisprudência: "${tese.substring(0, 50)}..."${tribunal ? ` (${tribunal})` : ''}`);

    try {
      // Verificar cache
      if (enableCache) {
        const cacheKey = `jurisprudence-${this.hashTese(tese)}`;
        const cached = await cacheService.checkCache('global', cacheKey, null);

        if (cached.valid) {
          console.log(`✅ Jurisprudência em cache: ${tese.substring(0, 50)}...`);
          return {
            ...cached.data,
            fromCache: true
          };
        }
      }

      const searchPromises = [];
      const sources = [];

      // ═══════════════════════════════════════════════════════════════
      // ESTRATÉGIA DE TIMEOUT ADAPTATIVA PARA PRODUÇÃO
      // ═══════════════════════════════════════════════════════════════
      // Google Search: 8s (tribunais superiores) / 15s (estaduais)
      // DataJud: 10s (API oficial mas pode ser lenta)
      // JusBrasil: 5s (frequentemente bloqueado/lento - menor prioridade)
      // ═══════════════════════════════════════════════════════════════

      // Timeout adaptativo: tribunais estaduais precisam mais tempo
      const isEstadual = tribunal && tribunal.toLowerCase().startsWith('tj');
      const GOOGLE_TIMEOUT = isEstadual ? 18000 : 12000;  // 18s para TJGO/TJSP, 12s para STF/STJ (margem +2-3s sobre cliente)
      const DATAJUD_TIMEOUT = 12000; // 12s - fonte oficial (margem de 2s)
      const JUSBRASIL_TIMEOUT = 5000; // 5s - frequentemente falha (desabilitado)

      // ✅ LÓGICA CONDICIONAL: DataJud só funciona para tribunais SUPERIORES
      const tribunaisSuperiores = ['STJ', 'STF', 'TST', 'TSE', 'STM'];
      const isTribunalSuperior = tribunal ? tribunaisSuperiores.some(t => tribunal.toUpperCase().includes(t)) : false;

      // PRIORIDADE 1A: DataJud (APENAS para tribunais superiores - STJ, STF, TST, TSE, STM)
      if (this.config.datajud.enabled && this.config.datajud.apiKey && isTribunalSuperior) {
        sources.push('datajud');
        searchPromises.push(
          this.withTimeout(
            this.searchDataJud(tese, { limit, tribunal, dataInicio, dataFim }),
            DATAJUD_TIMEOUT,
            'DataJud'
          )
        );
      }

      // PRIORIDADE 1B: Google Search (sempre - funciona para TODOS os tribunais)
      if (this.config.websearch.enabled) {
        sources.push('websearch');
        searchPromises.push(
          this.withTimeout(
            this.searchWeb(tese, { limit, tribunal }),
            GOOGLE_TIMEOUT,
            'Google Search'
          )
        );
      }

      // ❌ PRIORIDADE 3: JusBrasil - DESABILITADO (100% bloqueio anti-bot)
      // Google Custom Search já indexa JusBrasil sem bloqueios
      // if (this.config.jusbrasil.enabled) {
      //   sources.push('jusbrasil');
      //   searchPromises.push(
      //     this.withTimeout(
      //       this.searchJusBrasil(tese, { limit, tribunal }),
      //       JUSBRASIL_TIMEOUT,
      //       'JusBrasil'
      //     )
      //   );
      // }

      // Executar todas as buscas em paralelo
      const results = await Promise.allSettled(searchPromises);

      // Consolidar resultados
      const consolidated = {
        tese,
        searchedAt: new Date().toISOString(),
        sources: {},
        allResults: [],
        totalResults: 0,
        summary: {
          tribunaisEncontrados: new Set(),
          tiposDecisao: new Set(),
          relevancia: 'medium'
        }
      };

      // Processar resultados de cada fonte
      results.forEach((result, index) => {
        const sourceName = sources[index];

        if (result.status === 'fulfilled' && result.value) {
          const isSuccess = result.value.success !== false;
          const resultCount = result.value.results?.length || 0;

          console.log(`✅ [${sourceName}] ${isSuccess ? 'Sucesso' : 'Falhou'} - ${resultCount} resultado(s)`);

          consolidated.sources[sourceName] = {
            success: isSuccess,
            count: resultCount,
            results: result.value.results || [],
            ...(result.value.error && { error: result.value.error }),
            ...(result.value.suggestion && { suggestion: result.value.suggestion }),
            ...(result.value.isTimeout && { isTimeout: true }),
            ...(result.value.isBlocked && { isBlocked: true })
          };

          // Adicionar ao consolidado apenas se sucesso
          if (isSuccess && result.value.results) {
            consolidated.allResults.push(...result.value.results.map(r => ({
              ...r,
              source: sourceName
            })));

            // Estatísticas
            result.value.results.forEach(r => {
              if (r.tribunal) consolidated.summary.tribunaisEncontrados.add(r.tribunal);
              if (r.tipo) consolidated.summary.tiposDecisao.add(r.tipo);
            });
          }
        } else {
          const errorMsg = result.reason?.message || 'Erro desconhecido';
          const isTimeout = errorMsg.includes('Timeout') || errorMsg.includes('timeout');

          console.error(`❌ [${sourceName}] ${isTimeout ? 'TIMEOUT' : 'ERRO'}: ${errorMsg}`);

          consolidated.sources[sourceName] = {
            success: false,
            error: errorMsg,
            isTimeout
          };
        }
      });

      // Converter Sets para Arrays
      consolidated.summary.tribunaisEncontrados = Array.from(consolidated.summary.tribunaisEncontrados);
      consolidated.summary.tiposDecisao = Array.from(consolidated.summary.tiposDecisao);

      // Ordenar por relevância (placeholder - implementar scoring real)
      consolidated.allResults.sort((a, b) => {
        const scoreA = this.calculateRelevanceScore(a, tese);
        const scoreB = this.calculateRelevanceScore(b, tese);
        return scoreB - scoreA;
      });

      // Limitar resultados
      consolidated.allResults = consolidated.allResults.slice(0, limit);
      consolidated.totalResults = consolidated.allResults.length;

      // ✅ DIFERENCIAL: Enriquecer com ementas completas + análise semântica
      console.log(`[ENRICHMENT] Iniciando enriquecimento de ${consolidated.allResults?.length || 0} decisões...`);

      try {
        const enriched = await this.enrichWithCompleteEmentas(consolidated.allResults, tese);

        console.log(`[ENRICHMENT] Enriquecidas ${enriched.length} decisões`);
        const withEmentas = enriched.filter(r => r.ementaCompleta && r.ementaCompleta.length > 500).length;
        console.log(`[ENRICHMENT] Com ementas completas (>500 chars): ${withEmentas}`);

        consolidated.allResults = enriched;
        consolidated.enriched = true;

        // ✅ CRÍTICO: Atualizar também os resultados nas fontes individuais
        // para que bedrock-tools.js mostre as ementas completas
        enriched.forEach(enrichedResult => {
          const source = enrichedResult.source;
          if (source && consolidated.sources[source]?.results) {
            const index = consolidated.sources[source].results.findIndex(r =>
              r.url === enrichedResult.url || r.link === enrichedResult.link
            );
            if (index !== -1) {
              consolidated.sources[source].results[index] = enrichedResult;
            }
          }
        });

        console.log(`[ENRICHMENT] Sincronização com sources concluída`);
      } catch (enrichError) {
        console.error('[ENRIQUECIMENTO] ERRO CRÍTICO:', enrichError.message);
        console.error('[ENRIQUECIMENTO] Stack:', enrichError.stack);
        consolidated.enriched = false;
        consolidated.enrichError = enrichError.message;

        // ⚠️ IMPORTANTE: Adicionar warning visível ao usuário
        consolidated.enrichWarning = '⚠️ Atenção: O enriquecimento de ementas falhou. Mostrando apenas snippets.';
      }

      // Calcular tempo de busca
      const searchDuration = Date.now() - searchStartTime;
      consolidated.performance = {
        duration: searchDuration,
        sourcesUsed: sources.length,
        successfulSources: sources.filter((_, i) => results[i].status === 'fulfilled').length
      };

      // Resumo de performance
      console.log(`✅ [BUSCA CONCLUÍDA] ${consolidated.totalResults} resultado(s) em ${searchDuration}ms`);
      console.log(`   Fontes: ${sources.join(', ')}`);
      console.log(`   Sucessos: ${consolidated.performance.successfulSources}/${sources.length}`);

      // Salvar em cache
      if (enableCache) {
        const cacheKey = `jurisprudence-${this.hashTese(tese)}`;
        await cacheService.saveCache('global', cacheKey, consolidated, null, {
          searchedAt: new Date().toISOString(),
          tese: tese.substring(0, 100)
        });
      }

      return {
        ...consolidated,
        fromCache: false
      };

    } catch (error) {
      console.error('Erro ao buscar jurisprudência:', error);
      return {
        tese,
        error: error.message,
        searchedAt: new Date().toISOString(),
        sources: {},
        allResults: [],
        totalResults: 0
      };
    }
  }

  /**
   * Wrapper para adicionar timeout em promises
   * Previne travamento de fontes lentas
   */
  async withTimeout(promise, timeoutMs, sourceName) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => {
          console.warn(`⚠️ [TIMEOUT] ${sourceName} excedeu ${timeoutMs}ms`);
          reject(new Error(`Timeout: ${sourceName} não respondeu em ${timeoutMs}ms`));
        }, timeoutMs)
      )
    ]);
  }

  /**
   * Buscar no DataJud (API oficial do CNJ)
   */
  async searchDataJud(tese, options = {}) {
    if (!this.config.datajud.apiKey) {
      throw new Error('DataJud API Key não configurada');
    }

    const { limit = 10, tribunal = null, dataInicio = null, dataFim = null } = options;

    try {
      // Construir query
      const params = new URLSearchParams({
        q: tese,
        limite: limit.toString()
      });

      if (tribunal) params.append('tribunal', tribunal);
      if (dataInicio) params.append('dataInicio', dataInicio);
      if (dataFim) params.append('dataFim', dataFim);

      const url = `${this.config.datajud.apiUrl}/jurisprudencia?${params.toString()}`;

      const response = await this.makeHttpRequest(url, {
        headers: {
          'Authorization': `Bearer ${this.config.datajud.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: this.config.datajud.timeout
      });

      const data = JSON.parse(response);

      return {
        success: true,
        source: 'datajud',
        results: this.parseDataJudResults(data),
        totalFound: data.total || 0
      };

    } catch (error) {
      console.error('Erro ao buscar no DataJud:', error.message);
      return {
        success: false,
        source: 'datajud',
        error: error.message,
        results: []
      };
    }
  }

  /**
   * Buscar no JusBrasil
   */
  async searchJusBrasil(tese, options = {}) {
    const { limit = 10, tribunal = null } = options;

    try {
      // Importar dinamicamente o cliente JusBrasil
      const { JusBrasilClient } = await import('../../lib/jusbrasil-client.js');

      const client = new JusBrasilClient({
        email: process.env.JUSBRASIL_EMAIL,
        senha: process.env.JUSBRASIL_SENHA,
        headless: true
      });

      try {
        const result = await client.search(tese, { limit, tribunal });
        return result;
      } finally {
        // Sempre fechar o browser
        await client.close();
      }

    } catch (error) {
      console.error('Erro ao buscar no JusBrasil:', error.message);

      // Se credenciais não configuradas, retornar aviso amigável
      if (error.message?.includes('Credenciais')) {
        return {
          success: false,
          source: 'jusbrasil',
          error: 'JusBrasil não configurado - configure JUSBRASIL_EMAIL e JUSBRASIL_SENHA',
          needsSetup: true,
          results: []
        };
      }

      return {
        success: false,
        source: 'jusbrasil',
        error: error.message,
        results: []
      };
    }
  }

  /**
   * Buscar via Web Search (Google Custom Search API - IMPLEMENTAÇÃO REAL)
   */
  async searchWeb(tese, options = {}) {
    const { limit = 10, tribunal = null } = options;

    try {
      // Importar dinamicamente o cliente Google Search
      const { GoogleSearchClient } = await import('../../lib/google-search-client.js');

      // ⚡ Timeout adaptativo: 15s para estaduais, 10s para superiores
      const isEstadual = tribunal && tribunal.toLowerCase().startsWith('tj');
      const clientTimeout = isEstadual ? 15000 : 10000;

      const client = new GoogleSearchClient({
        apiKey: process.env.GOOGLE_SEARCH_API_KEY,
        cx: process.env.GOOGLE_SEARCH_CX,
        timeout: clientTimeout  // ✅ Passar timeout adaptativo
      });

      // Verificar se está configurado
      if (!client.isConfigured()) {
        console.warn('⚠️ Google Search API não configurada');
        return {
          success: false,
          source: 'google-search',
          error: 'Google Search não configurado - configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX',
          needsSetup: true,
          results: [],
          setupInstructions: {
            step1: 'Acesse https://console.cloud.google.com/apis/credentials',
            step2: 'Crie uma API Key e habilite Custom Search API',
            step3: 'Acesse https://programmablesearchengine.google.com/',
            step4: 'Crie um Custom Search Engine e copie o CX ID',
            step5: 'Configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX no .env'
          }
        };
      }

      const result = await client.search(tese, { limit, tribunal });
      return result;

    } catch (error) {
      console.error('Erro ao buscar na web:', error.message);
      return {
        success: false,
        source: 'google-search',
        error: error.message,
        results: []
      };
    }
  }

  /**
   * Parser de resultados do DataJud
   */
  parseDataJudResults(data) {
    if (!data.resultados || !Array.isArray(data.resultados)) {
      return [];
    }

    return data.resultados.map(item => ({
      tribunal: item.tribunal || 'Não informado',
      tipo: item.tipoDocumento || 'Acórdão',
      numero: item.numeroProcesso || item.id,
      ementa: item.ementa || item.texto || '',
      data: item.dataPublicacao || item.data,
      relator: item.relator || null,
      orgaoJulgador: item.orgaoJulgador || null,
      url: item.url || null,
      relevancia: this.calculateRelevanceFromMatch(item.score || 0)
    }));
  }

  /**
   * Gerar resultados mock do JusBrasil (placeholder)
   */
  generateMockJusBrasilResults(tese, limit) {
    const results = [];
    const tribunais = ['STJ', 'STF', 'TRF-1', 'TJSP', 'TJRJ'];

    for (let i = 0; i < Math.min(limit, 3); i++) {
      results.push({
        tribunal: tribunais[i % tribunais.length],
        tipo: 'Acórdão',
        numero: `${Math.floor(Math.random() * 1000000)}-${new Date().getFullYear()}`,
        ementa: `Resultado relacionado a: ${tese.substring(0, 100)}... [MOCK - Implementação pendente]`,
        data: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        relator: 'Min. [MOCK]',
        orgaoJulgador: `${i + 1}ª Turma`,
        url: 'https://www.jusbrasil.com.br/jurisprudencia/mock',
        relevancia: 'medium',
        note: 'Resultado mock - implementação real pendente'
      });
    }

    return results;
  }

  /**
   * Gerar resultados mock de Web Search (placeholder)
   */
  generateMockWebSearchResults(tese, limit) {
    const results = [];
    const sites = ['stf.jus.br', 'stj.jus.br', 'trf1.jus.br'];

    for (let i = 0; i < Math.min(limit, 2); i++) {
      results.push({
        tribunal: sites[i].toUpperCase().split('.')[0],
        tipo: 'Jurisprudência',
        numero: 'Web Search Result',
        ementa: `Resultado web sobre: ${tese.substring(0, 100)}... [MOCK - Implementação pendente]`,
        data: new Date().toISOString(),
        url: `https://${sites[i]}/mock`,
        relevancia: 'low',
        note: 'Resultado mock - implementação real pendente'
      });
    }

    return results;
  }

  /**
   * Calcular score de relevância
   */
  calculateRelevanceScore(result, tese) {
    let score = 0;

    // Tribunal mais relevante
    const highCourtWeight = {
      'STF': 10,
      'STJ': 9,
      'TST': 8,
      'TSE': 8,
      'STM': 7
    };

    score += highCourtWeight[result.tribunal] || 5;

    // Correspondência de texto na ementa
    const ementaLower = (result.ementa || '').toLowerCase();
    const teseLower = tese.toLowerCase();
    const teseWords = teseLower.split(/\s+/);

    const matchingWords = teseWords.filter(word =>
      word.length > 3 && ementaLower.includes(word)
    );

    score += matchingWords.length * 2;

    // Data recente (últimos 5 anos)
    if (result.data) {
      const dataResult = new Date(result.data);
      const idade = (Date.now() - dataResult.getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (idade < 5) score += (5 - idade) * 2;
    }

    return score;
  }

  /**
   * Calcular relevância baseada em score de match
   */
  calculateRelevanceFromMatch(score) {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Gerar hash da tese para cache
   */
  hashTese(tese) {
    return crypto.createHash('md5').update(tese).digest('hex');
  }

  /**
   * Fazer requisição HTTP/HTTPS
   */
  makeHttpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;
      const timeout = options.timeout || 30000;

      const reqOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      };

      const req = protocol.request(reqOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(timeout, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  /**
   * Obter estatísticas do serviço
   */
  getStats() {
    return {
      initialized: this.initialized,
      sources: {
        datajud: {
          enabled: this.config.datajud.enabled,
          configured: !!this.config.datajud.apiKey
        },
        jusbrasil: {
          enabled: this.config.jusbrasil.enabled,
          status: 'mock-implementation'
        },
        websearch: {
          enabled: this.config.websearch.enabled,
          status: 'mock-implementation'
        }
      },
      version: '1.0.0',
      notes: [
        'DataJud requer API Key configurada (DATAJUD_API_KEY)',
        'JusBrasil requer implementação de scraping ou API paga',
        'Web Search requer Google Custom Search API ou similar'
      ]
    };
  }

  /**
   * ✅ DIFERENCIAL: Enriquecer com ementas completas + análise semântica
   *
   * Pipeline:
   * 1. Scraping paralelo de URLs para obter ementas completas
   * 2. Análise semântica com Bedrock para extrair tese + fundamentos
   * 3. Cache agressivo para reutilização
   */
  async enrichWithCompleteEmentas(decisoes, contextoUsuario = '') {
    if (!decisoes || decisoes.length === 0) {
      return decisoes;
    }

    console.log(`🔬 [ENRIQUECIMENTO] Iniciando pipeline para ${decisoes.length} decisões`);
    const startTime = Date.now();

    try {
      // Lazy import dos serviços especializados
      const scraperModule = await import('./jurisprudence-scraper-service.js');
      const analyzerModule = await import('./jurisprudence-analyzer-service.js');

      const scraper = scraperModule.default;
      const analyzer = analyzerModule.default;

      // ETAPA 1: Scraping paralelo (3-5s por decisão)
      console.log('📥 [SCRAPING] Extraindo ementas completas...');
      const scraped = await scraper.enrichDecisions(decisoes);

      // ETAPA 2: Análise semântica com Bedrock (1-2s por decisão)
      console.log('🧠 [ANÁLISE] Extraindo teses e fundamentos com Bedrock...');
      const analyzed = await analyzer.analyzeBatch(scraped, contextoUsuario);

      const duration = Date.now() - startTime;
      const successCount = analyzed.filter(d => d.scraped && d.analyzed).length;

      console.log(`✅ [ENRIQUECIMENTO] Concluído em ${duration}ms`);
      console.log(`   Scraped: ${scraped.filter(d => d.scraped).length}/${decisoes.length}`);
      console.log(`   Analyzed: ${analyzed.filter(d => d.analyzed).length}/${decisoes.length}`);
      console.log(`   Taxa de sucesso: ${(successCount / decisoes.length * 100).toFixed(1)}%`);

      return analyzed;

    } catch (error) {
      console.error('[ENRIQUECIMENTO] Erro fatal:', error.message);
      // Fallback: retornar decisões originais
      return decisoes;
    }
  }

  /**
   * Formatar resultados para exibição
   */
  formatResults(results, format = 'detailed') {
    if (format === 'summary') {
      return results.allResults.map(r => ({
        tribunal: r.tribunal,
        numero: r.numero,
        ementa: r.ementaCompleta?.substring(0, 200) || r.ementa?.substring(0, 200) || '',
        relevancia: r.relevancia,
        teseJuridica: r.analise?.teseJuridica
      }));
    }

    return results;
  }
}

// Singleton
const jurisprudenceSearchService = new JurisprudenceSearchService();

export default jurisprudenceSearchService;
