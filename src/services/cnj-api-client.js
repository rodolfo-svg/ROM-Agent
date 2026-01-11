/**
 * ROM Agent - Cliente API CNJ (DataJud)
 * Cliente dedicado para integração com a API oficial do CNJ
 *
 * Documentação: https://datajud-wiki.cnj.jus.br/
 *
 * @version 1.0.0
 */

import axios from 'axios';
import NodeCache from 'node-cache';

// Cache de 1 hora para resultados
const cache = new NodeCache({ stdTTL: 3600 });

// Constantes
const DEFAULT_TIMEOUT = 30000; // 30 segundos
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 segundo

/**
 * Cliente para API DataJud do CNJ
 */
export class CNJApiClient {
  constructor(options = {}) {
    this.apiToken = options.apiToken || process.env.DATAJUD_API_TOKEN || process.env.DATAJUD_API_KEY;
    this.baseUrl = options.baseUrl || process.env.DATAJUD_API_URL || 'https://datajud-api.cnj.jus.br/api_publica';
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.userAgent = options.userAgent || 'ROM-Agent/2.8.0';
    this.maxRetries = options.maxRetries || MAX_RETRIES;
    this.retryDelay = options.retryDelay || RETRY_DELAY;

    // Endpoints disponíveis
    this.endpoints = {
      processos: '/processos',
      decisoes: '/decisoes',
      movimentacoes: '/movimentacoes',
      partes: '/partes',
      classes: '/classes',
      assuntos: '/assuntos',
      tribunais: '/tribunais',
      busca: '/busca',
      jurisprudencia: '/jurisprudencia'
    };

    // Códigos de tribunais CNJ
    this.tribunais = {
      // Superiores
      STF: 1,
      STJ: 3,
      STM: 5,
      TSE: 7,
      TST: 9,

      // Tribunais Regionais Federais
      TRF1: 11,
      TRF2: 13,
      TRF3: 15,
      TRF4: 17,
      TRF5: 19,
      TRF6: 21,

      // Tribunais de Justica Estaduais
      TJAC: 101,
      TJAL: 103,
      TJAP: 105,
      TJAM: 107,
      TJBA: 109,
      TJCE: 111,
      TJDF: 113,
      TJES: 115,
      TJGO: 117,
      TJMA: 119,
      TJMT: 121,
      TJMS: 123,
      TJMG: 125,
      TJPA: 127,
      TJPB: 129,
      TJPR: 131,
      TJPE: 133,
      TJPI: 135,
      TJRJ: 137,
      TJRN: 139,
      TJRS: 141,
      TJRO: 143,
      TJRR: 145,
      TJSC: 147,
      TJSP: 149,
      TJSE: 151,
      TJTO: 153,

      // Tribunais Regionais do Trabalho
      TRT1: 201,
      TRT2: 203,
      TRT3: 205,
      TRT4: 207,
      TRT5: 209,
      TRT6: 211,
      TRT7: 213,
      TRT8: 215,
      TRT9: 217,
      TRT10: 219,
      TRT11: 221,
      TRT12: 223,
      TRT13: 225,
      TRT14: 227,
      TRT15: 229,
      TRT16: 231,
      TRT17: 233,
      TRT18: 235,
      TRT19: 237,
      TRT20: 239,
      TRT21: 241,
      TRT22: 243,
      TRT23: 245,
      TRT24: 247
    };
  }

  /**
   * Verificar se cliente esta configurado
   */
  isConfigured() {
    return !!this.apiToken;
  }

  /**
   * Obter codigo do tribunal pela sigla
   */
  getTribunalCode(sigla) {
    if (!sigla) return null;
    const siglaUpper = sigla.toUpperCase().replace('-', '');
    return this.tribunais[siglaUpper] || null;
  }

  /**
   * Obter headers de autenticacao
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': this.userAgent
    };
  }

  /**
   * Fazer requisicao com retry automatico
   */
  async request(method, endpoint, params = {}, options = {}) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'DATAJUD_API_TOKEN nao configurado. Obtenha em: https://datajud-wiki.cnj.jus.br/',
        needsSetup: true
      };
    }

    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      method,
      url,
      headers: this.getHeaders(),
      timeout: options.timeout || this.timeout
    };

    if (method.toUpperCase() === 'GET') {
      config.params = params;
    } else {
      config.data = params;
    }

    let lastError = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[CNJ] Requisicao ${method.toUpperCase()} ${endpoint} (tentativa ${attempt}/${this.maxRetries})`);

        const response = await axios(config);

        return {
          success: true,
          status: response.status,
          data: response.data,
          headers: response.headers
        };

      } catch (error) {
        lastError = error;

        // Log detalhado do erro
        const errorDetails = {
          attempt,
          status: error.response?.status,
          message: error.message
        };
        console.warn(`[CNJ] Erro na tentativa ${attempt}:`, errorDetails);

        // Nao fazer retry para erros de autenticacao/autorizacao
        if (error.response?.status === 401 || error.response?.status === 403) {
          return {
            success: false,
            error: 'Credenciais invalidas ou token expirado',
            authError: true,
            status: error.response.status
          };
        }

        // Nao fazer retry para erros 4xx (exceto 429)
        if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
          return {
            success: false,
            error: error.response?.data?.message || error.message,
            status: error.response.status
          };
        }

        // Rate limit - esperar mais tempo
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '5', 10);
          console.log(`[CNJ] Rate limit - aguardando ${retryAfter}s...`);
          await this.sleep(retryAfter * 1000);
          continue;
        }

        // Aguardar antes de tentar novamente
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay * attempt);
        }
      }
    }

    // Todas as tentativas falharam
    return {
      success: false,
      error: lastError?.message || 'Erro desconhecido apos multiplas tentativas',
      isTimeout: lastError?.code === 'ECONNABORTED',
      retried: this.maxRetries
    };
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Buscar processos
   */
  async buscarProcessos(filtros = {}, options = {}) {
    const {
      tribunal = null,
      numero = null,
      classe = null,
      assunto = null,
      dataInicio = null,
      dataFim = null,
      limit = 50,
      offset = 0
    } = filtros;

    // Verificar cache
    const cacheKey = `cnj:processos:${JSON.stringify(filtros)}`;
    if (!options.noCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('[CNJ] Resultado em cache');
        return { ...cached, fromCache: true };
      }
    }

    // Construir parametros
    const params = {};
    if (tribunal) {
      const tribunalCod = this.getTribunalCode(tribunal);
      if (tribunalCod) params.tribunal = tribunalCod;
    }
    if (numero) params.numero = numero;
    if (classe) params.classe = classe;
    if (assunto) params.assunto = assunto;
    if (dataInicio) params.dataInicio = dataInicio;
    if (dataFim) params.dataFim = dataFim;
    params.limit = limit;
    params.offset = offset;

    const response = await this.request('GET', this.endpoints.processos, params, options);

    if (!response.success) {
      return {
        erro: true,
        mensagem: response.error,
        fonte: 'DataJud (CNJ)',
        ...response
      };
    }

    const resultado = {
      fonte: 'DataJud (CNJ)',
      tribunal,
      filtros,
      totalEncontrado: response.data?.total || 0,
      processos: response.data?.processos || response.data?.resultados || [],
      fromCache: false,
      timestamp: new Date().toISOString()
    };

    // Salvar no cache
    cache.set(cacheKey, resultado);

    return resultado;
  }

  /**
   * Buscar decisoes/jurisprudencia
   */
  async buscarDecisoes(filtros = {}, options = {}) {
    const {
      tribunal = null,
      termo = null,
      dataInicio = null,
      dataFim = null,
      orgaoJulgador = null,
      relator = null,
      limit = 50,
      offset = 0
    } = filtros;

    // Verificar cache
    const cacheKey = `cnj:decisoes:${JSON.stringify(filtros)}`;
    if (!options.noCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('[CNJ] Resultado em cache');
        return { ...cached, fromCache: true };
      }
    }

    // Construir parametros
    const params = {};
    if (tribunal) {
      const tribunalCod = this.getTribunalCode(tribunal);
      if (tribunalCod) params.tribunal = tribunalCod;
    }
    if (termo) params.q = termo;
    if (dataInicio) params.dataInicio = dataInicio;
    if (dataFim) params.dataFim = dataFim;
    if (orgaoJulgador) params.orgaoJulgador = orgaoJulgador;
    if (relator) params.relator = relator;
    params.limit = limit;
    params.offset = offset;

    const response = await this.request('GET', this.endpoints.jurisprudencia, params, options);

    if (!response.success) {
      return {
        erro: true,
        mensagem: response.error,
        fonte: 'DataJud (CNJ)',
        ...response
      };
    }

    const resultado = {
      fonte: 'DataJud (CNJ)',
      tribunal,
      termo,
      filtros,
      totalEncontrado: response.data?.total || 0,
      decisoes: this.parseDecisoes(response.data),
      fromCache: false,
      timestamp: new Date().toISOString()
    };

    // Salvar no cache
    cache.set(cacheKey, resultado);

    return resultado;
  }

  /**
   * Buscar movimentacoes de um processo
   */
  async buscarMovimentacoes(numeroProcesso, options = {}) {
    // Verificar cache
    const cacheKey = `cnj:movimentacoes:${numeroProcesso}`;
    if (!options.noCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    const response = await this.request('GET', `${this.endpoints.movimentacoes}/${numeroProcesso}`, {}, options);

    if (!response.success) {
      return {
        erro: true,
        mensagem: response.error,
        numeroProcesso,
        fonte: 'DataJud (CNJ)'
      };
    }

    const resultado = {
      fonte: 'DataJud (CNJ)',
      numeroProcesso,
      movimentacoes: response.data?.movimentacoes || [],
      fromCache: false,
      timestamp: new Date().toISOString()
    };

    cache.set(cacheKey, resultado);
    return resultado;
  }

  /**
   * Buscar detalhes de um processo
   */
  async buscarProcesso(numeroProcesso, options = {}) {
    // Verificar cache
    const cacheKey = `cnj:processo:${numeroProcesso}`;
    if (!options.noCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    const response = await this.request('GET', `${this.endpoints.processos}/${numeroProcesso}`, {}, options);

    if (!response.success) {
      return {
        erro: true,
        mensagem: response.error,
        numeroProcesso,
        fonte: 'DataJud (CNJ)'
      };
    }

    const resultado = {
      fonte: 'DataJud (CNJ)',
      processo: response.data,
      fromCache: false,
      timestamp: new Date().toISOString()
    };

    cache.set(cacheKey, resultado);
    return resultado;
  }

  /**
   * Listar tribunais disponiveis
   */
  async listarTribunais(options = {}) {
    const cacheKey = 'cnj:tribunais';
    if (!options.noCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    const response = await this.request('GET', this.endpoints.tribunais, {}, options);

    if (!response.success) {
      // Fallback para lista local
      console.log('[CNJ] Usando lista local de tribunais');
      return {
        fonte: 'DataJud (CNJ) - local',
        tribunais: Object.entries(this.tribunais).map(([sigla, codigo]) => ({
          sigla,
          codigo
        })),
        fromCache: false
      };
    }

    const resultado = {
      fonte: 'DataJud (CNJ)',
      tribunais: response.data?.tribunais || [],
      fromCache: false
    };

    cache.set(cacheKey, resultado);
    return resultado;
  }

  /**
   * Parser de decisoes
   */
  parseDecisoes(data) {
    if (!data?.resultados && !data?.decisoes) {
      return [];
    }

    const items = data.resultados || data.decisoes || [];

    return items.map(item => ({
      tribunal: item.tribunal || 'Nao informado',
      tipo: item.tipoDocumento || item.tipo || 'Acordao',
      numero: item.numeroProcesso || item.numero || item.id,
      ementa: item.ementa || item.texto || '',
      data: item.dataPublicacao || item.dataJulgamento || item.data,
      relator: item.relator || null,
      orgaoJulgador: item.orgaoJulgador || null,
      url: item.url || null,
      classe: item.classeProcessual || item.classe || null,
      assunto: item.assunto || null
    }));
  }

  /**
   * Validar numero de processo (padrao CNJ)
   */
  validarNumeroProcesso(numero) {
    // Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
    const regex = /^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/;
    const match = numero.match(regex);

    if (!match) {
      return {
        valido: false,
        mensagem: 'Formato invalido. Use: NNNNNNN-DD.AAAA.J.TR.OOOO'
      };
    }

    const [, sequencial, digito, ano, segmento, tribunal, origem] = match;

    const segmentos = {
      '1': 'Supremo Tribunal Federal',
      '2': 'Conselho Nacional de Justica',
      '3': 'Superior Tribunal de Justica',
      '4': 'Justica Federal',
      '5': 'Justica do Trabalho',
      '6': 'Justica Eleitoral',
      '7': 'Justica Militar da Uniao',
      '8': 'Justica Estadual',
      '9': 'Justica Militar Estadual'
    };

    return {
      valido: true,
      sequencial,
      digito,
      ano,
      segmento,
      tribunal,
      origem,
      segmentoDescricao: segmentos[segmento] || 'Desconhecido'
    };
  }

  /**
   * Limpar cache
   */
  limparCache() {
    cache.flushAll();
    return { sucesso: true, mensagem: 'Cache do CNJ limpo' };
  }

  /**
   * Estatisticas do cache
   */
  estatisticasCache() {
    const stats = cache.getStats();
    return {
      hits: stats.hits,
      misses: stats.misses,
      keys: stats.keys,
      ksize: stats.ksize,
      vsize: stats.vsize
    };
  }

  /**
   * Health check - verificar conexao com API
   */
  async healthCheck() {
    if (!this.isConfigured()) {
      return {
        healthy: false,
        error: 'Token nao configurado'
      };
    }

    try {
      const response = await this.request('GET', this.endpoints.tribunais, {}, { timeout: 5000 });

      return {
        healthy: response.success,
        latency: response.latency,
        error: response.error || null
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

// Singleton para uso global
export const cnjClient = new CNJApiClient();

export default CNJApiClient;
