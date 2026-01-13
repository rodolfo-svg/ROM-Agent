/**
 * ROM Agent - Servico de Integracao com DataJud (CNJ)
 * Consulta oficial de dados jurisprudenciais do Conselho Nacional de Justica
 *
 * API DataJud: https://datajud-wiki.cnj.jus.br/
 *
 * @version 2.0.0 - Implementacao real com fallback para Google Search
 */

import axios from 'axios';
import NodeCache from 'node-cache';
import { CNJApiClient } from './cnj-api-client.js';
import { logger } from '../utils/logger.js';

// Cache de 1 hora para consultas
const cache = new NodeCache({ stdTTL: 3600 });

// Cliente CNJ dedicado
const cnjClient = new CNJApiClient();

// ✅ Base URL oficial do DataJud (CORRIGIDO - fonte: https://datajud-wiki.cnj.jus.br/)
const DATAJUD_BASE_URL = 'https://api-publica.datajud.cnj.jus.br';

// ✅ Mapeamento de tribunais para aliases da API DataJud
const TRIBUNAL_ALIASES = {
  STF: 'stf',
  STJ: 'stj',
  STM: 'stm',
  TSE: 'tse',
  TST: 'tst',
  TRF1: 'trf1',
  TRF2: 'trf2',
  TRF3: 'trf3',
  TRF4: 'trf4',
  TRF5: 'trf5',
  TRF6: 'trf6',
  TJGO: 'tjgo',  // Tribunal de Justiça de Goiás
  TJSP: 'tjsp',
  TJRJ: 'tjrj',
  TJMG: 'tjmg',
  TJRS: 'tjrs',
  TJPR: 'tjpr',
  TJSC: 'tjsc',
  TJBA: 'tjba',
  TJPE: 'tjpe',
  TJCE: 'tjce'
  // Adicionar outros conforme necessário
};

// ✅ Endpoint padrão: /api_publica_[tribunal]/_search
const SEARCH_ENDPOINT = '/_search';

/**
 * Construir URL do endpoint DataJud para um tribunal específico
 * @param {string} tribunal - Sigla do tribunal (ex: 'TJGO', 'STJ')
 * @returns {string|null} URL completa ou null se tribunal não suportado
 */
function getDatajudUrl(tribunal) {
  if (!tribunal) return null;

  const alias = TRIBUNAL_ALIASES[tribunal.toUpperCase()];
  if (!alias) {
    logger.warn(`DataJud: Tribunal ${tribunal} não tem alias mapeado`);
    return null;
  }

  return `${DATAJUD_BASE_URL}/api_publica_${alias}${SEARCH_ENDPOINT}`;
}

// Códigos de tribunais DataJud (legacy - manter para compatibilidade)
const TRIBUNAIS_DATAJUD = {
  STF: 1,
  STJ: 3,
  STM: 5,
  TSE: 7,
  TST: 9,
  TRF1: 11,
  TRF2: 13,
  TRF3: 15,
  TRF4: 17,
  TRF5: 19,
  TRF6: 21,
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
  TJTO: 153
};

/**
 * Buscar processos no DataJud
 */
export async function buscarProcessos(filtros = {}, options = {}) {
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

  // Gerar chave de cache
  const cacheKey = `datajud:processos:${JSON.stringify(filtros)}`;
  const cached = cache.get(cacheKey);
  if (cached && !options.noCache) {
    return { ...cached, fonte: 'DataJud (CNJ)', fromCache: true };
  }

  try {
    const params = new URLSearchParams();

    if (tribunal) {
      const tribunalCod = TRIBUNAIS_DATAJUD[tribunal.toUpperCase()];
      if (tribunalCod) params.append('tribunal', tribunalCod);
    }
    if (numero) params.append('numero', numero);
    if (classe) params.append('classe', classe);
    if (assunto) params.append('assunto', assunto);
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    params.append('limit', limit);
    params.append('offset', offset);

    // Verificar se token esta configurado
    const DATAJUD_TOKEN = process.env.DATAJUD_API_TOKEN || process.env.DATAJUD_API_KEY;
    if (!DATAJUD_TOKEN) {
      logger.warn('DataJud: Token nao configurado, usando fallback');
      return await fallbackToGoogleSearch(filtros, 'processos');
    }

    try {
      const response = await axios.get(`${DATAJUD_API_URL}${ENDPOINTS.processos}`, {
        params,
        headers: {
          'Authorization': `Bearer ${DATAJUD_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'ROM-Agent/2.8.0'
        },
        timeout: 30000
      });

      const resultado = {
        fonte: 'DataJud (CNJ)',
        tribunal,
        filtros,
        totalEncontrado: response.data.total || 0,
        processos: response.data.processos || response.data.resultados || [],
        fromCache: false,
        timestamp: new Date().toISOString()
      };

      cache.set(cacheKey, resultado);
      logger.info(`DataJud: ${resultado.totalEncontrado} processo(s) encontrado(s)`);
      return resultado;

    } catch (error) {
      logger.warn('DataJud falhou, usando fallback Google Search', { error: error.message });
      return await fallbackToGoogleSearch(filtros, 'processos');
    }

  } catch (error) {
    logger.error('Erro critico ao consultar DataJud:', { error: error.message });
    return {
      erro: true,
      mensagem: error.message,
      fonte: 'DataJud (CNJ)'
    };
  }
}

/**
 * Buscar decisões/acórdãos no DataJud
 */
export async function buscarDecisoes(filtros = {}, options = {}) {
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

  const cacheKey = `datajud:decisoes:${JSON.stringify(filtros)}`;
  const cached = cache.get(cacheKey);
  if (cached && !options.noCache) {
    return { ...cached, fonte: 'DataJud (CNJ)', fromCache: true };
  }

  // Verificar se token esta configurado
  const DATAJUD_TOKEN = process.env.DATAJUD_API_TOKEN || process.env.DATAJUD_API_KEY;
  if (!DATAJUD_TOKEN) {
    logger.warn('DataJud: Token nao configurado, usando fallback para decisoes');
    return await fallbackToGoogleSearch({ ...filtros, termo }, 'decisoes');
  }

  try {
    // ✅ Construir URL específica para o tribunal
    const url = getDatajudUrl(tribunal);
    if (!url) {
      logger.warn(`DataJud: Tribunal ${tribunal} não suportado, usando fallback`);
      return await fallbackToGoogleSearch({ ...filtros, termo }, 'decisoes');
    }

    // ✅ Body da requisição no formato ElasticSearch Query DSL
    const queryBody = {
      query: {
        bool: {
          must: []
        }
      },
      from: offset,
      size: limit,
      sort: [{ dataPublicacao: { order: 'desc' } }]
    };

    // Adicionar termo de busca
    if (termo) {
      queryBody.query.bool.must.push({
        multi_match: {
          query: termo,
          fields: ['ementa^3', 'textoIntegral', 'palavrasChave^2'],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      });
    }

    // Filtro de data
    if (dataInicio || dataFim) {
      const rangeFilter = { dataPublicacao: {} };
      if (dataInicio) rangeFilter.dataPublicacao.gte = dataInicio;
      if (dataFim) rangeFilter.dataPublicacao.lte = dataFim;
      queryBody.query.bool.must.push({ range: rangeFilter });
    }

    // Filtros adicionais
    if (orgaoJulgador) {
      queryBody.query.bool.must.push({ match: { orgaoJulgador } });
    }
    if (relator) {
      queryBody.query.bool.must.push({ match: { relator } });
    }

    logger.info(`[DataJud] Buscando decisões em ${url}`);

    const response = await axios.post(url, queryBody, {
      headers: {
        'Authorization': `ApiKey ${DATAJUD_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ROM-Agent/2.8.0'
      },
      timeout: 30000
    });

    const resultado = {
      fonte: 'DataJud (CNJ)',
      tribunal,
      termo,
      filtros,
      totalEncontrado: response.data.total || 0,
      decisoes: parseDecisoes(response.data),
      fromCache: false,
      timestamp: new Date().toISOString()
    };

    cache.set(cacheKey, resultado);
    logger.info(`DataJud: ${resultado.totalEncontrado} decisao(oes) encontrada(s)`);
    return resultado;

  } catch (error) {
    logger.warn('DataJud decisoes falhou, usando fallback Google Search', { error: error.message });
    return await fallbackToGoogleSearch({ ...filtros, termo }, 'decisoes');
  }
}

/**
 * Buscar movimentações processuais
 */
export async function buscarMovimentacoes(numeroProcesso, options = {}) {
  const cacheKey = `datajud:movimentacoes:${numeroProcesso}`;
  const cached = cache.get(cacheKey);
  if (cached && !options.noCache) {
    return { ...cached, fromCache: true };
  }

  try {
    const resultado = {
      fonte: 'DataJud (CNJ)',
      numeroProcesso,
      movimentacoes: [],
      mensagem: 'DataJud requer token de autenticação',
      fromCache: false
    };

    cache.set(cacheKey, resultado);
    return resultado;

  } catch (error) {
    return {
      erro: true,
      mensagem: error.message
    };
  }
}

/**
 * Listar classes processuais
 */
export async function listarClasses(options = {}) {
  const cacheKey = 'datajud:classes';
  const cached = cache.get(cacheKey);
  if (cached && !options.noCache) {
    return cached;
  }

  try {
    // Classes processuais comuns
    const classes = [
      { codigo: 1, nome: 'Procedimento Comum' },
      { codigo: 2, nome: 'Procedimento Sumário' },
      { codigo: 3, nome: 'Procedimento Ordinário' },
      { codigo: 7, nome: 'Ação Civil Pública' },
      { codigo: 11, nome: 'Ação Popular' },
      { codigo: 15, nome: 'Mandado de Segurança' },
      { codigo: 17, nome: 'Habeas Corpus' },
      { codigo: 19, nome: 'Habeas Data' },
      { codigo: 23, nome: 'Mandado de Injunção' },
      { codigo: 31, nome: 'Ação Direta de Inconstitucionalidade' },
      { codigo: 33, nome: 'Ação Declaratória de Constitucionalidade' },
      { codigo: 39, nome: 'Recurso Extraordinário' },
      { codigo: 41, nome: 'Recurso Especial' },
      { codigo: 43, nome: 'Agravo de Instrumento' },
      { codigo: 45, nome: 'Apelação' },
      { codigo: 47, nome: 'Embargos de Declaração' }
    ];

    const resultado = {
      fonte: 'DataJud (CNJ)',
      total: classes.length,
      classes
    };

    cache.set(cacheKey, resultado);
    return resultado;

  } catch (error) {
    return {
      erro: true,
      mensagem: error.message
    };
  }
}

/**
 * Listar assuntos processuais
 */
export async function listarAssuntos(area = null, options = {}) {
  const cacheKey = `datajud:assuntos:${area || 'all'}`;
  const cached = cache.get(cacheKey);
  if (cached && !options.noCache) {
    return cached;
  }

  try {
    // Assuntos por área (simplificado)
    const assuntosCivel = [
      { codigo: 1, nome: 'Direito Civil' },
      { codigo: 2, nome: 'Obrigações' },
      { codigo: 3, nome: 'Responsabilidade Civil' },
      { codigo: 4, nome: 'Família' },
      { codigo: 5, nome: 'Sucessões' },
      { codigo: 6, nome: 'Contratos' },
      { codigo: 7, nome: 'Direito das Coisas' },
      { codigo: 8, nome: 'Direito do Consumidor' }
    ];

    const assuntosTrabalhista = [
      { codigo: 101, nome: 'Rescisão do Contrato de Trabalho' },
      { codigo: 102, nome: 'FGTS' },
      { codigo: 103, nome: 'Horas Extras' },
      { codigo: 104, nome: 'Dano Moral' },
      { codigo: 105, nome: 'Adicional de Insalubridade' },
      { codigo: 106, nome: 'Estabilidade' }
    ];

    const assuntosPenal = [
      { codigo: 201, nome: 'Crimes Contra a Pessoa' },
      { codigo: 202, nome: 'Crimes Contra o Patrimônio' },
      { codigo: 203, nome: 'Crimes Contra a Administração Pública' },
      { codigo: 204, nome: 'Tráfico de Drogas' },
      { codigo: 205, nome: 'Crimes Hediondos' }
    ];

    let assuntos = [];
    if (!area || area === 'civel') assuntos = [...assuntos, ...assuntosCivel];
    if (!area || area === 'trabalhista') assuntos = [...assuntos, ...assuntosTrabalhista];
    if (!area || area === 'penal') assuntos = [...assuntos, ...assuntosPenal];

    const resultado = {
      fonte: 'DataJud (CNJ)',
      area: area || 'todas',
      total: assuntos.length,
      assuntos
    };

    cache.set(cacheKey, resultado);
    return resultado;

  } catch (error) {
    return {
      erro: true,
      mensagem: error.message
    };
  }
}

/**
 * Obter informações de tribunal
 */
export function obterTribunal(sigla) {
  const codigo = TRIBUNAIS_DATAJUD[sigla.toUpperCase()];
  if (!codigo) {
    return null;
  }

  return {
    sigla: sigla.toUpperCase(),
    codigo,
    fonte: 'DataJud (CNJ)'
  };
}

/**
 * Validar número de processo (padrão CNJ)
 */
export function validarNumeroProcesso(numero) {
  // Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
  const regex = /^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/;
  const match = numero.match(regex);

  if (!match) {
    return {
      valido: false,
      mensagem: 'Formato inválido. Use: NNNNNNN-DD.AAAA.J.TR.OOOO'
    };
  }

  const [, sequencial, digito, ano, segmento, tribunal, origem] = match;

  return {
    valido: true,
    sequencial,
    digito,
    ano,
    segmento,
    tribunal,
    origem,
    segmentoDescricao: {
      '1': 'Supremo Tribunal Federal',
      '2': 'Conselho Nacional de Justiça',
      '3': 'Superior Tribunal de Justiça',
      '4': 'Justiça Federal',
      '5': 'Justiça do Trabalho',
      '6': 'Justiça Eleitoral',
      '7': 'Justiça Militar da União',
      '8': 'Justiça Estadual',
      '9': 'Justiça Militar Estadual'
    }[segmento] || 'Desconhecido'
  };
}

/**
 * Parser de decisoes da API DataJud (formato ElasticSearch)
 */
function parseDecisoes(data) {
  // ✅ Formato ElasticSearch: data.hits.hits[]._source
  if (data?.hits?.hits) {
    return data.hits.hits.map(hit => {
      const source = hit._source || {};
      return {
        tribunal: source.tribunal || source.siglaTribunal || 'Não informado',
        tipo: source.tipoDocumento || source.tipo || 'Acórdão',
        numero: source.numeroProcesso || source.numero || hit._id,
        ementa: source.ementa || source.texto || source.ementaCompleta || '',
        data: source.dataPublicacao || source.dataJulgamento || source.data,
        relator: source.relator || source.nomeRelator || null,
        orgaoJulgador: source.orgaoJulgador || null,
        url: source.url || source.link || null,
        classe: source.classeProcessual || source.classe || null,
        assunto: source.assunto || source.assuntos?.[0] || null,
        score: hit._score || 0
      };
    });
  }

  // Legacy format (fallback)
  if (data?.resultados || data?.decisoes) {
    const items = data.resultados || data.decisoes || [];
    return items.map(item => ({
      tribunal: item.tribunal || 'Não informado',
      tipo: item.tipoDocumento || item.tipo || 'Acórdão',
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

  return [];
}

/**
 * Fallback para Google Search quando DataJud falha ou nao esta configurado
 * Usa o Google Custom Search API para buscar em sites .jus.br
 */
async function fallbackToGoogleSearch(filtros = {}, tipo = 'processos') {
  logger.info(`[Fallback] Usando Google Search para ${tipo}`);

  try {
    // Importar dinamicamente o cliente Google Search
    const { GoogleSearchClient } = await import('../../lib/google-search-client.js');

    const client = new GoogleSearchClient({
      apiKey: process.env.GOOGLE_SEARCH_API_KEY,
      cx: process.env.GOOGLE_SEARCH_CX,
      timeout: 15000
    });

    // Verificar se Google Search esta configurado
    if (!client.isConfigured()) {
      logger.warn('[Fallback] Google Search nao configurado');
      return {
        erro: false,
        fonte: 'Fallback (nao disponivel)',
        mensagem: 'Nem DataJud nem Google Search estao configurados. Configure DATAJUD_API_TOKEN ou GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX.',
        totalEncontrado: 0,
        processos: [],
        decisoes: [],
        needsSetup: true,
        setupInstructions: {
          datajud: 'Obtenha token em: https://datajud-wiki.cnj.jus.br/',
          google: 'Configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX'
        }
      };
    }

    // Construir query baseada nos filtros
    let query = '';
    const { tribunal, numero, classe, assunto, termo } = filtros;

    if (numero) {
      query = `processo ${numero}`;
    } else if (termo) {
      query = termo;
    } else {
      const parts = [];
      if (classe) parts.push(classe);
      if (assunto) parts.push(assunto);
      if (tribunal) parts.push(tribunal);
      query = parts.length > 0 ? parts.join(' ') : 'jurisprudencia';
    }

    // Executar busca
    const result = await client.search(query, {
      limit: filtros.limit || 20,
      tribunal: tribunal
    });

    if (!result.success) {
      logger.warn(`[Fallback] Google Search falhou: ${result.error}`);
      return {
        erro: true,
        fonte: 'Google Search (fallback)',
        mensagem: result.error,
        totalEncontrado: 0,
        processos: [],
        decisoes: []
      };
    }

    // Converter resultados para formato DataJud
    const processos = (result.results || []).map(item => ({
      tribunal: item.tribunal || 'Web',
      numero: item.numero || 'N/A',
      classe: classe || 'Nao especificada',
      assunto: assunto || 'Nao especificado',
      ementa: item.ementa || item.titulo,
      data: item.data,
      url: item.url,
      relator: item.relator,
      fonte: 'Google Search (fallback)'
    }));

    const resultado = {
      erro: false,
      fonte: 'Google Search (fallback)',
      tribunal,
      filtros,
      totalEncontrado: processos.length,
      processos: tipo === 'processos' ? processos : [],
      decisoes: tipo === 'decisoes' ? processos : [],
      fromCache: false,
      fallbackUsed: true,
      timestamp: new Date().toISOString()
    };

    logger.info(`[Fallback] ${processos.length} resultado(s) encontrado(s) via Google Search`);
    return resultado;

  } catch (error) {
    logger.error('[Fallback] Erro ao usar Google Search', { error: error.message });
    return {
      erro: true,
      fonte: 'Fallback (erro)',
      mensagem: `Erro no fallback: ${error.message}`,
      totalEncontrado: 0,
      processos: [],
      decisoes: []
    };
  }
}

/**
 * Limpar cache
 */
export function limparCache() {
  cache.flushAll();
  return { sucesso: true, mensagem: 'Cache do DataJud limpo' };
}

/**
 * Estatísticas do cache
 */
export function estatisticasCache() {
  const stats = cache.getStats();
  return {
    hits: stats.hits,
    misses: stats.misses,
    keys: stats.keys,
    ksize: stats.ksize,
    vsize: stats.vsize
  };
}

// Exportar funcao de fallback para uso externo
export { fallbackToGoogleSearch };

export default {
  buscarProcessos,
  buscarDecisoes,
  buscarMovimentacoes,
  listarClasses,
  listarAssuntos,
  obterTribunal,
  validarNumeroProcesso,
  limparCache,
  estatisticasCache,
  fallbackToGoogleSearch,
  cnjClient,
  TRIBUNAIS_DATAJUD
};
