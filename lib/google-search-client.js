/**
 * Google Custom Search Client
 *
 * Implementação real de busca usando Google Custom Search API.
 * Focado em buscar jurisprudência em sites oficiais de tribunais.
 */

import axios from 'axios';

export class GoogleSearchClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.GOOGLE_SEARCH_API_KEY;
    this.cx = options.cx || process.env.GOOGLE_SEARCH_CX;
    this.baseUrl = 'https://www.googleapis.com/customsearch/v1';
    this.timeout = options.timeout || 10000;

    // Sites oficiais de tribunais para busca focada
    this.tribunalSites = [
      'stf.jus.br',
      'stj.jus.br',
      'tst.jus.br',
      'tse.jus.br',
      'stm.jus.br',
      'trf1.jus.br',
      'trf2.jus.br',
      'trf3.jus.br',
      'trf4.jus.br',
      'trf5.jus.br',
      'trf6.jus.br',
      'tjsp.jus.br',
      'tjrj.jus.br',
      'tjmg.jus.br',
      'tjrs.jus.br',
      'tjgo.jus.br',
      'tjdf.jus.br',
      'tjpr.jus.br',
      'tjsc.jus.br'
    ];
  }

  /**
   * Verificar se API está configurada
   */
  isConfigured() {
    return !!(this.apiKey && this.cx);
  }

  /**
   * Buscar jurisprudência
   */
  async search(query, options = {}) {
    const { limit = 10, tribunal = null, exactSites = null } = options;

    if (!this.isConfigured()) {
      console.warn('⚠️ Google Search API não configurada (GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX)');
      return {
        success: false,
        source: 'google-search',
        error: 'API não configurada',
        results: [],
        needsSetup: true
      };
    }

    try {
      console.log(`🔍 Buscando no Google Custom Search: "${query}"`);

      // Construir query otimizada para jurisprudência
      let searchQuery = `jurisprudência ${query}`;

      // Filtrar por sites específicos
      const sites = exactSites || this.getSitesForTribunal(tribunal);
      if (sites.length > 0) {
        const siteOperator = sites.map(s => `site:${s}`).join(' OR ');
        searchQuery = `${searchQuery} (${siteOperator})`;
      }

      // Fazer requisição à API
      const response = await axios.get(this.baseUrl, {
        params: {
          key: this.apiKey,
          cx: this.cx,
          q: searchQuery,
          num: Math.min(limit, 10), // Google API max = 10 por request
          lr: 'lang_pt', // Resultados em português
          safe: 'off'
        },
        timeout: this.timeout
      });

      // Parse de resultados
      const results = this.parseSearchResults(response.data, limit);

      console.log(`✅ Encontrados ${results.length} resultados no Google Search`);

      return {
        success: true,
        source: 'google-search',
        query: searchQuery,
        results,
        total: response.data.searchInformation?.totalResults || results.length,
        searchTime: response.data.searchInformation?.searchTime || null
      };

    } catch (error) {
      console.error('❌ Erro na busca do Google Search:', error.message);

      // Verificar se é erro de quota
      if (error.response?.status === 429) {
        return {
          success: false,
          source: 'google-search',
          error: 'Quota excedida - aguarde antes de nova tentativa',
          quotaExceeded: true,
          results: []
        };
      }

      // Verificar se é erro de autenticação
      if (error.response?.status === 401 || error.response?.status === 403) {
        return {
          success: false,
          source: 'google-search',
          error: 'Credenciais inválidas - verifique API_KEY e CX',
          authError: true,
          results: []
        };
      }

      return {
        success: false,
        source: 'google-search',
        error: error.message,
        results: []
      };
    }
  }

  /**
   * Parse de resultados da API do Google
   */
  parseSearchResults(data, limit) {
    if (!data.items || !Array.isArray(data.items)) {
      return [];
    }

    return data.items.slice(0, limit).map(item => {
      // Extrair informações
      const url = item.link;
      const tribunal = this.extractTribunalFromUrl(url);
      const numero = this.extractNumeroProcesso(item.title + ' ' + item.snippet);
      const data_julgamento = this.extractDate(item.snippet);

      return {
        tribunal: tribunal || 'Web',
        tipo: 'Jurisprudência',
        numero: numero || 'N/A',
        titulo: item.title,
        ementa: item.snippet,
        url: url,
        data: data_julgamento || new Date().toISOString(),
        relator: this.extractRelator(item.snippet),
        displayLink: item.displayLink,
        cacheId: item.cacheId || null,
        relevancia: this.calculateRelevance(item),
        source: 'google-search-real',
        metadados: {
          formattedUrl: item.formattedUrl,
          htmlTitle: item.htmlTitle,
          htmlSnippet: item.htmlSnippet
        }
      };
    });
  }

  /**
   * Obter lista de sites para tribunal específico
   */
  getSitesForTribunal(tribunal) {
    if (!tribunal) {
      return this.tribunalSites;
    }

    const tribunalLower = tribunal.toLowerCase();
    const filtered = this.tribunalSites.filter(site =>
      site.includes(tribunalLower) || tribunalLower.includes(site.split('.')[0])
    );

    return filtered.length > 0 ? filtered : this.tribunalSites;
  }

  /**
   * Extrair tribunal da URL
   */
  extractTribunalFromUrl(url) {
    const urlLower = url.toLowerCase();

    const tribunais = {
      'stf.jus.br': 'STF',
      'stj.jus.br': 'STJ',
      'tst.jus.br': 'TST',
      'tse.jus.br': 'TSE',
      'stm.jus.br': 'STM',
      'trf1.jus.br': 'TRF-1',
      'trf2.jus.br': 'TRF-2',
      'trf3.jus.br': 'TRF-3',
      'trf4.jus.br': 'TRF-4',
      'trf5.jus.br': 'TRF-5',
      'trf6.jus.br': 'TRF-6',
      'tjsp.jus.br': 'TJSP',
      'tjrj.jus.br': 'TJRJ',
      'tjmg.jus.br': 'TJMG',
      'tjrs.jus.br': 'TJRS',
      'tjgo.jus.br': 'TJGO',
      'tjdf.jus.br': 'TJDF',
      'tjpr.jus.br': 'TJPR',
      'tjsc.jus.br': 'TJSC'
    };

    for (const [site, sigla] of Object.entries(tribunais)) {
      if (urlLower.includes(site)) {
        return sigla;
      }
    }

    return null;
  }

  /**
   * Extrair número de processo
   */
  extractNumeroProcesso(text) {
    // Formato: 0000000-00.0000.0.00.0000
    const match = text.match(/\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/);
    return match ? match[0] : null;
  }

  /**
   * Extrair data
   */
  extractDate(text) {
    // Formato: DD/MM/YYYY
    const match = text.match(/\d{2}\/\d{2}\/\d{4}/);
    if (match) {
      const [dia, mes, ano] = match[0].split('/');
      return new Date(`${ano}-${mes}-${dia}`).toISOString();
    }
    return null;
  }

  /**
   * Extrair relator
   */
  extractRelator(text) {
    const patterns = [
      /Relator[a]?:?\s*([^,\.\n]+)/i,
      /Rel\.?\s*([^,\.\n]+)/i,
      /Min\.?\s*([^,\.\n]+)/i,
      /Des\.?\s*([^,\.\n]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Calcular relevância baseada nos dados do Google
   */
  calculateRelevance(item) {
    // Google já retorna em ordem de relevância
    // Podemos adicionar boost baseado em:
    // - Ter cacheId (página indexada recentemente)
    // - Ter pagemap (dados estruturados)
    // - Tribunal oficial vs outros sites

    let score = 0.5; // base

    if (item.cacheId) {
      score += 0.2; // Página indexada = mais confiável
    }

    if (item.pagemap) {
      score += 0.1; // Dados estruturados
    }

    const tribunalOficial = this.tribunalSites.some(site =>
      item.displayLink?.includes(site)
    );
    if (tribunalOficial) {
      score += 0.2; // Site oficial = mais relevante
    }

    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Busca paginada (para mais de 10 resultados)
   */
  async searchPaginated(query, options = {}) {
    const { totalResults = 30, tribunal = null } = options;
    const resultsPerPage = 10;
    const pages = Math.ceil(totalResults / resultsPerPage);

    const allResults = [];

    for (let page = 0; page < pages && page < 10; page++) { // Max 10 pages (100 results)
      const startIndex = (page * resultsPerPage) + 1;

      try {
        const searchQuery = tribunal
          ? `jurisprudência ${query} site:${this.getSitesForTribunal(tribunal)[0]}`
          : `jurisprudência ${query}`;

        const response = await axios.get(this.baseUrl, {
          params: {
            key: this.apiKey,
            cx: this.cx,
            q: searchQuery,
            num: resultsPerPage,
            start: startIndex,
            lr: 'lang_pt',
            safe: 'off'
          },
          timeout: this.timeout
        });

        const results = this.parseSearchResults(response.data, resultsPerPage);
        allResults.push(...results);

        // Delay entre requests (evitar rate limit)
        if (page < pages - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.warn(`⚠️ Erro na página ${page + 1}:`, error.message);
        break; // Para se houver erro
      }
    }

    return {
      success: true,
      source: 'google-search',
      query,
      results: allResults,
      total: allResults.length,
      pages: pages
    };
  }
}

export default GoogleSearchClient;
