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
        enabled: process.env.JUSBRASIL_ENABLED === 'true' || true,
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
      console.log('✅ Jurisprudence Search Service inicializado');
      console.log(`   - DataJud: ${this.config.datajud.enabled ? 'Habilitado' : 'Desabilitado'}`);
      console.log(`   - JusBrasil: ${this.config.jusbrasil.enabled ? 'Habilitado' : 'Desabilitado'}`);
      console.log(`   - WebSearch: ${this.config.websearch.enabled ? 'Habilitado' : 'Desabilitado'}`);
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

    try {
      // Verificar cache
      if (enableCache) {
        const cacheKey = `jurisprudence-${this.hashTese(tese)}`;
        const cached = await cacheService.checkCache('global', cacheKey, Buffer.from(tese));

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

      // Busca paralela em todas as fontes
      if (this.config.datajud.enabled && this.config.datajud.apiKey) {
        sources.push('datajud');
        searchPromises.push(this.searchDataJud(tese, { limit, tribunal, dataInicio, dataFim }));
      }

      if (this.config.jusbrasil.enabled) {
        sources.push('jusbrasil');
        searchPromises.push(this.searchJusBrasil(tese, { limit, tribunal }));
      }

      if (this.config.websearch.enabled) {
        sources.push('websearch');
        searchPromises.push(this.searchWeb(tese, { limit }));
      }

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
          consolidated.sources[sourceName] = {
            success: true,
            count: result.value.results?.length || 0,
            results: result.value.results || []
          };

          // Adicionar ao consolidado
          if (result.value.results) {
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
          consolidated.sources[sourceName] = {
            success: false,
            error: result.reason?.message || 'Erro desconhecido'
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

      // Salvar em cache
      if (enableCache) {
        const cacheKey = `jurisprudence-${this.hashTese(tese)}`;
        await cacheService.saveCache('global', cacheKey, consolidated, Buffer.from(tese), {
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
      // Construir URL de busca
      const query = encodeURIComponent(tese + (tribunal ? ` ${tribunal}` : ''));
      const url = `${this.config.jusbrasil.apiUrl}?q=${query}`;

      // Nota: JusBrasil requer scraping ou API paga
      // Esta é uma implementação placeholder
      console.warn('⚠️ JusBrasil: Implementação via scraping pendente - retornando dados mock');

      return {
        success: true,
        source: 'jusbrasil',
        results: this.generateMockJusBrasilResults(tese, limit),
        note: 'Implementação real requer integração com API ou web scraping'
      };

    } catch (error) {
      console.error('Erro ao buscar no JusBrasil:', error.message);
      return {
        success: false,
        source: 'jusbrasil',
        error: error.message,
        results: []
      };
    }
  }

  /**
   * Buscar via Web Search (Google, etc)
   */
  async searchWeb(tese, options = {}) {
    const { limit = 10 } = options;

    try {
      // Construir query otimizada para jurisprudência
      const query = `jurisprudência ${tese} site:stf.jus.br OR site:stj.jus.br OR site:trf1.jus.br`;

      // Nota: Busca web requer integração com Google Custom Search API ou similar
      console.warn('⚠️ Web Search: Implementação pendente - retornando dados mock');

      return {
        success: true,
        source: 'websearch',
        results: this.generateMockWebSearchResults(tese, limit),
        note: 'Implementação real requer Google Custom Search API ou similar'
      };

    } catch (error) {
      console.error('Erro ao buscar na web:', error.message);
      return {
        success: false,
        source: 'websearch',
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
    const crypto = require('crypto');
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
   * Formatar resultados para exibição
   */
  formatResults(results, format = 'detailed') {
    if (format === 'summary') {
      return results.allResults.map(r => ({
        tribunal: r.tribunal,
        numero: r.numero,
        ementa: r.ementa.substring(0, 200) + '...',
        relevancia: r.relevancia
      }));
    }

    return results;
  }
}

// Singleton
const jurisprudenceSearchService = new JurisprudenceSearchService();

export default jurisprudenceSearchService;
