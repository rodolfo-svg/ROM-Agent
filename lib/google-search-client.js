/**
 * Google Custom Search Client
 *
 * Implementação real de busca usando Google Custom Search API.
 *
 * CONFIGURAÇÃO DO CSE:
 * - Busca em TODA A WEB (não apenas sites listados)
 * - Dá PRIORIDADE aos sites jurídicos abaixo
 * - Inclui JusBrasil via indexação do Google (SEM bloqueio anti-bot)
 * - Não requer credenciais do JusBrasil (usa apenas Google API Key)
 */

import axios from 'axios';

export class GoogleSearchClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.GOOGLE_SEARCH_API_KEY;
    this.cx = options.cx || process.env.GOOGLE_SEARCH_CX;
    this.baseUrl = 'https://www.googleapis.com/customsearch/v1';
    this.timeout = options.timeout || 15000; // ⚡ 15s para permitir tribunais estaduais (TJGO, TJSP)

    // Sites PRIORITÁRIOS para rankeamento (Google CSE dá boost a estes sites)
    // IMPORTANTE: Google busca em TODA A WEB, mas estes sites aparecem PRIMEIRO
    this.tribunalSites = [
      // Tribunais Superiores (prioridade máxima)
      'stf.jus.br',
      'stj.jus.br',
      'tst.jus.br',
      'tse.jus.br',
      'stm.jus.br',
      // Tribunais Regionais Federais
      'trf1.jus.br',
      'trf2.jus.br',
      'trf3.jus.br',
      'trf4.jus.br',
      'trf5.jus.br',
      'trf6.jus.br',
      // Tribunais Estaduais (principais)
      'tjsp.jus.br',
      'tjrj.jus.br',
      'tjmg.jus.br',
      'tjrs.jus.br',
      'tjgo.jus.br',
      'tjdf.jus.br',
      'tjpr.jus.br',
      'tjsc.jus.br',
      // Agregadores jurídicos (incluídos via indexação do Google)
      'jusbrasil.com.br',  // ✅ SEM bloqueio anti-bot, SEM credenciais necessárias
      'conjur.com.br',     // Consultor Jurídico
      'migalhas.com.br'    // Migalhas
    ];
  }

  /**
   * Verificar se API está configurada
   */
  isConfigured() {
    return !!(this.apiKey && this.cx);
  }

  /**
   * Buscar jurisprudência com fallback inteligente
   * Se a busca com site: operators retorna 0 resultados, tenta sem filtro de sites
   */
  async search(query, options = {}) {
    const { limit = 10, tribunal = null, exactSites = null } = options;

    if (!this.isConfigured()) {
      console.warn('[GoogleSearch] API nao configurada (GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX)');
      return {
        success: false,
        source: 'google-search',
        error: 'API nao configurada - configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX no .env',
        results: [],
        needsSetup: true,
        setupInstructions: {
          step1: 'Acesse https://console.cloud.google.com/apis/credentials',
          step2: 'Crie uma API Key e habilite Custom Search API',
          step3: 'Acesse https://programmablesearchengine.google.com/',
          step4: 'Crie um Custom Search Engine focado em sites .jus.br',
          step5: 'Configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX no .env'
        }
      };
    }

    try {
      console.log(`[GoogleSearch] Iniciando busca${tribunal ? ` para ${tribunal}` : ' nacional'}: "${query.substring(0, 50)}..."`);

      // ESTRATEGIA: Tentar primeiro com sites especificos, se 0 resultados, tentar sem filtro
      let results = [];
      let searchQuery = '';
      let usedFallback = false;

      // Filtrar por sites específicos (primeira tentativa)
      const sites = exactSites || this.getSitesForTribunal(tribunal);

      // ✅ OTIMIZAÇÃO POR TRIBUNAL ESPECÍFICO (quando usuário solicita)
      if (tribunal) {
        const tribunalUpper = tribunal.toUpperCase();
        const tribunalSite = this.getTribunalSite(tribunalUpper);

        if (tribunalSite) {
          console.log(`[GoogleSearch] Priorizando tribunal específico: ${tribunalUpper} (${tribunalSite})`);

          // ✅ FIX: Query mais específica para pegar decisões judiciais reais (não compilações/editais)
          searchQuery = `(ementa OR acórdão OR decisão OR "relatório e voto") ${query} site:${tribunalSite} -edital -concurso -"código de normas"`;
          const response = await this.executeSearch(searchQuery, limit);
          results = this.parseSearchResults(response.data, limit);

          // Fallback 1: Tentar sem exclusões mas com termos de decisão
          if (results.length === 0) {
            console.log(`[GoogleSearch] ${tribunalUpper} sem resultados, tentando fallback sem exclusões`);
            usedFallback = true;
            searchQuery = `(ementa OR acórdão) ${query} site:${tribunalSite}`;
            const fallbackResponse = await this.executeSearch(searchQuery, limit);
            results = this.parseSearchResults(fallbackResponse.data, limit);
          }

          // Fallback 2: busca mais ampla se tribunal específico não retornou resultados
          if (results.length === 0) {
            console.log(`[GoogleSearch] ${tribunalUpper} sem resultados, tentando fallback site:jus.br`);
            searchQuery = `jurisprudencia ${query} site:jus.br ${tribunalUpper}`;
            const fallbackResponse2 = await this.executeSearch(searchQuery, limit);
            results = this.parseSearchResults(fallbackResponse2.data, limit);
          }
        }
      }
      // BUSCA NACIONAL (quando nenhum tribunal especificado)
      else if (!tribunal && (sites.length === 0 || sites.length > 5)) {
        console.log('[GoogleSearch] Busca NACIONAL em todos os tribunais .jus.br');
        searchQuery = `jurisprudencia brasileira ${query} site:jus.br`;
        const response = await this.executeSearch(searchQuery, limit);
        results = this.parseSearchResults(response.data, limit);
      }
      // Tentar busca com filtro de sites (mais relevante)
      else if (sites.length > 0 && sites.length <= 5) {
        // Se poucos sites, usar filtro direto
        const siteOperator = sites.map(s => `site:${s}`).join(' OR ');
        searchQuery = `jurisprudencia ${query} (${siteOperator})`;

        const response = await this.executeSearch(searchQuery, limit);
        results = this.parseSearchResults(response.data, limit);

        // Se 0 resultados, tentar sem filtro de sites
        if (results.length === 0) {
          console.log('[GoogleSearch] Busca com filtro de sites retornou 0 resultados, tentando fallback');
          usedFallback = true;
          searchQuery = `jurisprudencia brasileira ${query} site:jus.br`;

          const fallbackResponse = await this.executeSearch(searchQuery, limit);
          results = this.parseSearchResults(fallbackResponse.data, limit);

          // Último fallback: busca geral MAS SEMPRE com site:jus.br (SEGURANÇA)
          if (results.length === 0) {
            console.log('[GoogleSearch] Fallback nível 2 - busca geral com site:jus.br obrigatório');
            searchQuery = `jurisprudencia "${query}" tribunal site:jus.br`;
            const generalResponse = await this.executeSearch(searchQuery, limit);
            results = this.parseSearchResults(generalResponse.data, limit);
          }
        }
      } else {
        // Muitos sites ou nenhum filtro - busca mais ampla
        searchQuery = `jurisprudencia brasileira ${query} site:jus.br`;
        const response = await this.executeSearch(searchQuery, limit);
        results = this.parseSearchResults(response.data, limit);

        // Fallback se ainda 0 resultados (SEMPRE com site:jus.br - SEGURANÇA)
        if (results.length === 0) {
          console.log('[GoogleSearch] Fallback final - mantendo site:jus.br obrigatório');
          usedFallback = true;
          searchQuery = `jurisprudencia "${query}" site:jus.br`;
          const fallbackResponse = await this.executeSearch(searchQuery, limit);
          results = this.parseSearchResults(fallbackResponse.data, limit);
        }
      }

      if (results.length > 0) {
        console.log(`[GoogleSearch] ${results.length} resultados encontrados${usedFallback ? ' (via fallback)' : ''}`);
      } else {
        console.warn('[GoogleSearch] Nenhum resultado encontrado mesmo com fallbacks');
      }

      return {
        success: true,
        source: 'google-search',
        query: searchQuery,
        results,
        total: results.length,
        usedFallback
      };

    } catch (error) {
      console.error('[GoogleSearch] Erro na busca:', error.message);

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
          error: 'Credenciais invalidas - verifique API_KEY e CX',
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
   * Executar busca na API do Google
   */
  async executeSearch(searchQuery, limit) {
    return await axios.get(this.baseUrl, {
      params: {
        key: this.apiKey,
        cx: this.cx,
        q: searchQuery,
        num: Math.min(limit, 10),
        lr: 'lang_pt',
        safe: 'off'
      },
      timeout: this.timeout
    });
  }

  /**
   * Validar se URL é de site oficial do Poder Judiciário
   * PROTEÇÃO CRÍTICA: Apenas .jus.br são aceitos
   */
  isOfficialJudicialSite(url) {
    if (!url) return false;

    const urlLower = url.toLowerCase();

    // Aceitar APENAS domínios .jus.br
    return urlLower.includes('.jus.br');
  }

  /**
   * Parse de resultados da API do Google
   * VALIDAÇÃO ESTRITA: Rejeita resultados não-oficiais
   * ✅ Proteção: Timeout e limitação de processamento
   */
  parseSearchResults(data, limit) {
    if (!data.items || !Array.isArray(data.items)) {
      return [];
    }

    let rejectedCount = 0;
    const startTime = Date.now();
    const MAX_PARSE_TIME = 10000; // ✅ Máximo 10s para parsing

    const results = data.items.slice(0, limit).map((item, index) => {
      // ✅ Proteção: Verificar timeout
      if (Date.now() - startTime > MAX_PARSE_TIME) {
        console.warn(`⚠️ [TIMEOUT] Parsing interrompido após ${index} itens (${MAX_PARSE_TIME}ms)`);
        return null;
      }

      try {
        // Extrair informações
        const url = item.link;

        // 🔒 VALIDAÇÃO ESTRITA: Rejeitar URLs não-oficiais
        if (!this.isOfficialJudicialSite(url)) {
          rejectedCount++;
          console.warn(`⚠️ [SEGURANÇA] Resultado rejeitado (não é .jus.br): ${url}`);
          return null; // Marca para remoção
        }

        const tribunal = this.extractTribunalFromUrl(url);

        // ✅ Proteção: Limitar tamanho de strings antes de processar
        const safeTitle = (item.title || '').substring(0, 1000);
        const safeSnippet = (item.snippet || '').substring(0, 2000);

        const numero = this.extractNumeroProcesso(safeTitle + ' ' + safeSnippet);
        const data_julgamento = this.extractDate(safeSnippet);

        return {
          tribunal: tribunal || 'Web',
          tipo: 'Jurisprudência',
          numero: numero || 'N/A',
          titulo: safeTitle,
          ementa: safeSnippet,
          url: url,
          data: data_julgamento || new Date().toISOString(),
          relator: this.extractRelator(safeSnippet),
          displayLink: item.displayLink,
          cacheId: item.cacheId || null,
          relevancia: this.calculateRelevance(item),
          source: 'google-search-real',
          verified: true, // ✓ Passou pela validação
          metadados: {
            formattedUrl: item.formattedUrl,
            htmlTitle: (item.htmlTitle || '').substring(0, 500),
            htmlSnippet: (item.htmlSnippet || '').substring(0, 1000)
          }
        };
      } catch (error) {
        console.error(`❌ [PARSING] Erro ao processar item ${index}:`, error.message);
        return null; // Skip item com erro
      }
    }).filter(item => item !== null); // Remove rejeitados

    if (rejectedCount > 0) {
      console.log(`🔒 [SEGURANÇA] ${rejectedCount} resultado(s) não-oficial(is) rejeitado(s)`);
    }

    return results;
  }

  /**
   * Obter site oficial de um tribunal específico
   * Suporta TODOS os tribunais brasileiros (superiores, federais, estaduais)
   */
  getTribunalSite(tribunalSigla) {
    if (!tribunalSigla) return null;

    const siglaUpper = tribunalSigla.toUpperCase();

    // Mapa completo de tribunais brasileiros
    const tribunalMap = {
      // Superiores
      'STF': 'stf.jus.br',
      'STJ': 'stj.jus.br',
      'TST': 'tst.jus.br',
      'TSE': 'tse.jus.br',
      'STM': 'stm.jus.br',

      // Tribunais Regionais Federais
      'TRF1': 'trf1.jus.br',
      'TRF-1': 'trf1.jus.br',
      'TRF2': 'trf2.jus.br',
      'TRF-2': 'trf2.jus.br',
      'TRF3': 'trf3.jus.br',
      'TRF-3': 'trf3.jus.br',
      'TRF4': 'trf4.jus.br',
      'TRF-4': 'trf4.jus.br',
      'TRF5': 'trf5.jus.br',
      'TRF-5': 'trf5.jus.br',
      'TRF6': 'trf6.jus.br',
      'TRF-6': 'trf6.jus.br',

      // Tribunais de Justiça Estaduais
      'TJAC': 'tjac.jus.br',
      'TJAL': 'tjal.jus.br',
      'TJAM': 'tjam.jus.br',
      'TJAP': 'tjap.jus.br',
      'TJBA': 'tjba.jus.br',
      'TJCE': 'tjce.jus.br',
      'TJDF': 'tjdf.jus.br',
      'TJDFT': 'tjdft.jus.br',
      'TJES': 'tjes.jus.br',
      'TJGO': 'tjgo.jus.br',
      'TJMA': 'tjma.jus.br',
      'TJMG': 'tjmg.jus.br',
      'TJMS': 'tjms.jus.br',
      'TJMT': 'tjmt.jus.br',
      'TJPA': 'tjpa.jus.br',
      'TJPB': 'tjpb.jus.br',
      'TJPE': 'tjpe.jus.br',
      'TJPI': 'tjpi.jus.br',
      'TJPR': 'tjpr.jus.br',
      'TJRJ': 'tjrj.jus.br',
      'TJRN': 'tjrn.jus.br',
      'TJRO': 'tjro.jus.br',
      'TJRR': 'tjrr.jus.br',
      'TJRS': 'tjrs.jus.br',
      'TJSC': 'tjsc.jus.br',
      'TJSE': 'tjse.jus.br',
      'TJSP': 'tjsp.jus.br',
      'TJTO': 'tjto.jus.br',

      // Tribunais Regionais do Trabalho
      'TRT1': 'trt1.jus.br',
      'TRT2': 'trt2.jus.br',
      'TRT3': 'trt3.jus.br',
      'TRT4': 'trt4.jus.br',
      'TRT5': 'trt5.jus.br',
      'TRT6': 'trt6.jus.br',
      'TRT7': 'trt7.jus.br',
      'TRT8': 'trt8.jus.br',
      'TRT9': 'trt9.jus.br',
      'TRT10': 'trt10.jus.br',
      'TRT11': 'trt11.jus.br',
      'TRT12': 'trt12.jus.br',
      'TRT13': 'trt13.jus.br',
      'TRT14': 'trt14.jus.br',
      'TRT15': 'trt15.jus.br',
      'TRT16': 'trt16.jus.br',
      'TRT17': 'trt17.jus.br',
      'TRT18': 'trt18.jus.br',
      'TRT19': 'trt19.jus.br',
      'TRT20': 'trt20.jus.br',
      'TRT21': 'trt21.jus.br',
      'TRT22': 'trt22.jus.br',
      'TRT23': 'trt23.jus.br',
      'TRT24': 'trt24.jus.br',

      // Tribunais Regionais Eleitorais
      'TRE-AC': 'tre-ac.jus.br',
      'TRE-AL': 'tre-al.jus.br',
      'TRE-AM': 'tre-am.jus.br',
      'TRE-AP': 'tre-ap.jus.br',
      'TRE-BA': 'tre-ba.jus.br',
      'TRE-CE': 'tre-ce.jus.br',
      'TRE-DF': 'tre-df.jus.br',
      'TRE-ES': 'tre-es.jus.br',
      'TRE-GO': 'tre-go.jus.br',
      'TRE-MA': 'tre-ma.jus.br',
      'TRE-MG': 'tre-mg.jus.br',
      'TRE-MS': 'tre-ms.jus.br',
      'TRE-MT': 'tre-mt.jus.br',
      'TRE-PA': 'tre-pa.jus.br',
      'TRE-PB': 'tre-pb.jus.br',
      'TRE-PE': 'tre-pe.jus.br',
      'TRE-PI': 'tre-pi.jus.br',
      'TRE-PR': 'tre-pr.jus.br',
      'TRE-RJ': 'tre-rj.jus.br',
      'TRE-RN': 'tre-rn.jus.br',
      'TRE-RO': 'tre-ro.jus.br',
      'TRE-RR': 'tre-rr.jus.br',
      'TRE-RS': 'tre-rs.jus.br',
      'TRE-SC': 'tre-sc.jus.br',
      'TRE-SE': 'tre-se.jus.br',
      'TRE-SP': 'tre-sp.jus.br',
      'TRE-TO': 'tre-to.jus.br'
    };

    return tribunalMap[siglaUpper] || null;
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
   * ✅ Proteção: Limita tamanho do texto
   */
  extractNumeroProcesso(text) {
    // ✅ Proteger contra textos muito grandes
    if (!text || text.length > 5000) {
      return null;
    }

    try {
      // Formato: 0000000-00.0000.0.00.0000
      const match = text.match(/\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/);
      return match ? match[0] : null;
    } catch (error) {
      console.warn('[GoogleSearch] Erro ao extrair número processo (regex):', error.message);
      return null;
    }
  }

  /**
   * Extrair data
   * ✅ Proteção: Validação de entrada
   */
  extractDate(text) {
    // ✅ Proteger contra textos muito grandes
    if (!text || text.length > 2000) {
      return null;
    }

    try {
      // Formato: DD/MM/YYYY
      const match = text.match(/\d{2}\/\d{2}\/\d{4}/);
      if (match) {
        const [dia, mes, ano] = match[0].split('/');
        return new Date(`${ano}-${mes}-${dia}`).toISOString();
      }
    } catch (error) {
      console.warn('[GoogleSearch] Erro ao extrair data (regex):', error.message);
    }
    return null;
  }

  /**
   * Extrair relator
   * ✅ Proteção: Limita tamanho do texto para evitar catastrophic backtracking
   */
  extractRelator(text) {
    // ✅ Proteger contra textos muito grandes (max 2000 chars)
    if (!text || text.length > 2000) {
      return null;
    }

    const patterns = [
      /Relator[a]?:?\s*([^,\.\n]{1,100})/i, // ✅ Limitado a 100 chars
      /Rel\.?\s*([^,\.\n]{1,100})/i,
      /Min\.?\s*([^,\.\n]{1,100})/i,
      /Des\.?\s*([^,\.\n]{1,100})/i
    ];

    try {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          return match[1].trim().substring(0, 100); // ✅ Garantir limite
        }
      }
    } catch (error) {
      console.warn('[GoogleSearch] Erro ao extrair relator (regex):', error.message);
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
