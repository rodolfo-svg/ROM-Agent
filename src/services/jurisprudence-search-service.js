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

    // ⚡ CIRCUIT BREAKER: Para parar de tentar se DataJud falhar muito
    this.circuitBreaker = {
      failures: 0,
      lastFailure: null,
      threshold: 3,          // Após 3 falhas consecutivas, abre o circuito
      timeout: 60000,        // Após 60s, tenta novamente (half-open)
      isOpen: false
    };

    this.config = {
      datajud: {
        // ✅ HABILITADO: DataJud CNJ suporta busca semântica completa via ElasticSearch
        // Busca em: ementa (boost x3), textoIntegral, palavrasChave (boost x2)
        // Fallback inteligente: Google primeiro, DataJud se ementa incompleta
        enabled: process.env.DATAJUD_ENABLED === 'true' || false,
        apiUrl: process.env.DATAJUD_API_URL || 'https://api-publica.datajud.cnj.jus.br',
        apiKey: process.env.DATAJUD_API_KEY || null,
        timeout: 5000 // ⚡ AGRESSIVO: 5s (era 12s) - não bloquear chat
      },
      jusbrasil: {
        enabled: process.env.JUSBRASIL_ENABLED === 'true' || false, // Desabilitado: bloqueio anti-bot 100%
        apiUrl: 'https://www.jusbrasil.com.br/busca',
        timeout: 30000
      },
      websearch: {
        enabled: true,
        timeout: 30000
      },
      puppeteer: {
        enabled: process.env.USE_BROWSERLESS === 'true',
        provider: 'browserless.io',
        timeout: 15000
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
      enableCache = true,
      forcarPuppeteer = false  // Modo de teste Browserless
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
      // ⚡ NOVA ESTRATÉGIA: FONTE OFICIAL PRIMEIRO
      // ═══════════════════════════════════════════════════════════════
      // 1. DataJud CNJ PRIMEIRO (5s timeout) - FONTE OFICIAL
      //    - ElasticSearch Query DSL com busca semântica
      //    - multi_match em: ementa^3, textoIntegral, palavrasChave^2
      //    - Top 5 tribunais: STF, STJ, TJSP, TJRJ, TJMG
      //    - Circuit Breaker: para se falhar muito
      // 2. Google Search FALLBACK (se DataJud falhar ou retornar vazio)
      //    - Backup confiável, 90+ tribunais
      //    - Mais lento mas boa cobertura
      // ═══════════════════════════════════════════════════════════════

      // ⚡ Timeouts AGRESSIVOS: Não bloquear chat
      const DATAJUD_TIMEOUT = 5000;  // ⚡ 5s MAX - fonte oficial CNJ
      const GOOGLE_TIMEOUT = 10000;  // 10s - fallback (era 18s)

      const results = [];
      let usedGoogleFallback = false;

      // PRIORIDADE 1: DataJud CNJ (Fonte Oficial)
      // ⚡ CIRCUIT BREAKER: Verificar se DataJud está disponível
      const canUseDataJud = this.config.datajud.enabled &&
                            this.config.datajud.apiKey &&
                            !this.isCircuitOpen();

      if (canUseDataJud) {
        console.log('🔍 [DATAJUD] Buscando na fonte oficial do CNJ...');
        sources.push('datajud');

        try {
          const datajudResult = await this.withTimeout(
            this.searchDataJud(tese, { limit, tribunal, dataInicio, dataFim }),
            DATAJUD_TIMEOUT,
            'DataJud CNJ (Oficial)'
          );

          results.push({ status: 'fulfilled', value: datajudResult });

          // ✅ Sucesso no DataJud: resetar circuit breaker
          this.recordSuccess();

          const resultCount = datajudResult.results?.length || 0;
          console.log(`✅ [DATAJUD] Retornou ${resultCount} resultado(s)`);

          // Se DataJud retornou resultados, não precisa Google
          if (resultCount > 0) {
            console.log('✅ [DATAJUD] Resultados suficientes, não precisa fallback');
          } else {
            console.log('🔄 [FALLBACK] DataJud sem resultados, ativando Google Search...');
            usedGoogleFallback = true;
          }

        } catch (error) {
          console.error(`❌ [DATAJUD] Falhou: ${error.message}`);

          // ❌ Falha no DataJud: registrar no circuit breaker
          this.recordFailure();

          results.push({ status: 'rejected', reason: error });
          usedGoogleFallback = true;
        }
      } else {
        if (this.isCircuitOpen()) {
          console.warn('⚠️ [CIRCUIT BREAKER] DataJud temporariamente desabilitado (muitas falhas)');
        }
        console.log('🔄 [FALLBACK] DataJud não disponível, usando Google Search...');
        usedGoogleFallback = true;
      }

      // FALLBACK: Google Search (se DataJud falhou ou não retornou resultados)
      if (usedGoogleFallback && this.config.websearch.enabled) {
        sources.push('websearch');

        try {
          const googleResult = await this.withTimeout(
            this.searchWeb(tese, { limit, tribunal }),
            GOOGLE_TIMEOUT,
            'Google Search (Fallback)'
          );
          results.push({ status: 'fulfilled', value: googleResult });

          console.log(`✅ [GOOGLE] Fallback retornou ${googleResult.results?.length || 0} resultado(s)`);
        } catch (error) {
          console.error(`❌ [GOOGLE] Fallback falhou: ${error.message}`);
          results.push({ status: 'rejected', reason: error });
        }
      }

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
        const enriched = await this.enrichWithCompleteEmentas(consolidated.allResults, tese, { forcarPuppeteer });

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
        successfulSources: sources.filter((_, i) => results[i].status === 'fulfilled').length,
        ...(usedDataJudFallback && { usedDataJudFallback: true })
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
   * ✅ ATUALIZADO: Usa datajud-service.js com busca em múltiplos tribunais
   */
  async searchDataJud(tese, options = {}) {
    if (!this.config.datajud.apiKey) {
      throw new Error('DataJud API Key não configurada');
    }

    const { limit = 10, tribunal = null, dataInicio = null, dataFim = null } = options;

    try {
      // ✅ Importar nosso serviço DataJud real
      const datajudService = await import('./datajud-service.js');

      console.log(`🔍 [DATAJUD] Buscando "${tese.substring(0, 50)}..." ${tribunal ? `no ${tribunal}` : 'em múltiplos tribunais'}`);

      let result;

      if (tribunal) {
        // Busca em tribunal específico
        result = await datajudService.buscarDecisoes({
          tribunal: tribunal,
          termo: tese,
          limit: limit,
          dataInicio: dataInicio,
          dataFim: dataFim
        });
      } else {
        // Busca inteligente: Top 5 tribunais mais relevantes (STF, STJ, TJSP, TJRJ, TJMG)
        const top5Tribunais = ['STF', 'STJ', 'TJSP', 'TJRJ', 'TJMG'];
        console.log(`🔍 [DATAJUD] Buscando nos Top 5 tribunais: ${top5Tribunais.join(', ')}`);

        result = await datajudService.buscarTodosTribunais({
          tribunais: top5Tribunais,
          numero: null,  // Busca por termo, não por número
          limit: Math.ceil(limit / top5Tribunais.length)  // Dividir limite entre tribunais
        });
      }

      // Parsear resultados
      const parsedResults = this.parseDataJudServiceResults(result, tese);

      console.log(`✅ [DATAJUD] Encontrados ${parsedResults.length} resultado(s)`);

      return {
        success: true,
        source: 'datajud',
        results: parsedResults,
        totalFound: parsedResults.length
      };

    } catch (error) {
      console.error('❌ [DATAJUD] Erro:', error.message);
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
   * Parser de resultados do DataJud (formato antigo - deprecado)
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
   * ✅ Parser de resultados do datajud-service.js (NOVO)
   * Transforma resultados do nosso serviço DataJud para formato jurisprudence-search
   */
  parseDataJudServiceResults(data, tese) {
    const results = [];

    // Caso 1: Resultado de buscarTodosTribunais (múltiplos tribunais)
    if (data.resultados && Array.isArray(data.resultados)) {
      data.resultados.forEach(tribunalResult => {
        if (tribunalResult.processos && Array.isArray(tribunalResult.processos)) {
          tribunalResult.processos.forEach(proc => {
            results.push({
              tribunal: tribunalResult.tribunal || proc.tribunal || 'Não informado',
              tipo: proc.classe || 'Processo',
              numero: proc.numeroProcesso || proc.numero || 'N/A',
              ementa: proc.ementa || proc.assunto || tese.substring(0, 200),
              data: proc.dataAjuizamento || proc.dataPublicacao || null,
              relator: proc.relator || null,
              orgaoJulgador: proc.orgaoJulgador || null,
              url: proc.url || null,
              relevancia: 'medium',
              movimentacoes: proc.movimentacoes || [],
              fonte: 'DataJud CNJ'
            });
          });
        }
      });
    }

    // Caso 2: Resultado de buscarDecisoes (busca por termo)
    if (data.decisoes && Array.isArray(data.decisoes)) {
      data.decisoes.forEach(decisao => {
        results.push({
          tribunal: decisao.tribunal || 'Não informado',
          tipo: decisao.tipo || 'Decisão',
          numero: decisao.numeroProcesso || decisao.id || 'N/A',
          ementa: decisao.ementa || decisao.texto || '',
          data: decisao.dataPublicacao || decisao.data || null,
          relator: decisao.relator || null,
          orgaoJulgador: decisao.orgaoJulgador || null,
          url: decisao.url || null,
          relevancia: this.calculateRelevanceScore(decisao, tese) > 15 ? 'high' : 'medium',
          fonte: 'DataJud CNJ'
        });
      });
    }

    // Caso 3: Resultado de buscarProcessos (tribunal único)
    if (data.processos && Array.isArray(data.processos)) {
      data.processos.forEach(proc => {
        results.push({
          tribunal: proc.tribunal || data.tribunal || 'Não informado',
          tipo: proc.classe || 'Processo',
          numero: proc.numeroProcesso || proc.numero || 'N/A',
          ementa: proc.ementa || proc.assunto || proc.descricao || '',
          data: proc.dataAjuizamento || proc.dataPublicacao || null,
          relator: proc.relator || null,
          orgaoJulgador: proc.orgaoJulgador || null,
          url: proc.url || null,
          relevancia: 'medium',
          movimentacoes: proc.movimentacoes || [],
          fonte: 'DataJud CNJ'
        });
      });
    }

    return results;
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
   * ⚡ CIRCUIT BREAKER: Verificar se circuito está aberto
   */
  isCircuitOpen() {
    if (!this.circuitBreaker.isOpen) {
      return false;
    }

    // Verificar se passou o timeout (tentar novamente - half-open state)
    const timeSinceLastFailure = Date.now() - (this.circuitBreaker.lastFailure || 0);
    if (timeSinceLastFailure > this.circuitBreaker.timeout) {
      console.log('⚡ [CIRCUIT BREAKER] Tentando novamente (half-open)...');
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failures = Math.floor(this.circuitBreaker.failures / 2); // Reduzir pela metade
      return false;
    }

    return true;
  }

  /**
   * ⚡ CIRCUIT BREAKER: Registrar sucesso
   */
  recordSuccess() {
    if (this.circuitBreaker.failures > 0) {
      console.log(`⚡ [CIRCUIT BREAKER] Sucesso! Resetando contador (estava em ${this.circuitBreaker.failures})`);
    }
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.lastFailure = null;
  }

  /**
   * ⚡ CIRCUIT BREAKER: Registrar falha
   */
  recordFailure() {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();

    console.warn(`⚠️ [CIRCUIT BREAKER] Falha ${this.circuitBreaker.failures}/${this.circuitBreaker.threshold}`);

    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.isOpen = true;
      console.error(`🔴 [CIRCUIT BREAKER] ABERTO! DataJud desabilitado por ${this.circuitBreaker.timeout / 1000}s`);
    }
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
  async enrichWithCompleteEmentas(decisoes, contextoUsuario = '', options = {}) {
    if (!decisoes || decisoes.length === 0) {
      return decisoes;
    }

    const { forcarPuppeteer = false } = options;

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
      const scraped = await scraper.enrichDecisions(decisoes, { forcarPuppeteer });

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
