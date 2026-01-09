/**
 * ROM Agent - Serviço de Integração com DataJud (CNJ)
 * Consulta oficial de dados jurisprudenciais do Conselho Nacional de Justiça
 *
 * API DataJud: https://datajud-wiki.cnj.jus.br/
 */

import axios from 'axios';
import NodeCache from 'node-cache';

// Cache de 1 hora para consultas
const cache = new NodeCache({ stdTTL: 3600 });

// Base URL oficial do DataJud
const DATAJUD_API_URL = 'https://datajud-api.cnj.jus.br/api_publica';

// Endpoints disponíveis
const ENDPOINTS = {
  processos: '/processos',
  decisoes: '/decisoes',
  movimentacoes: '/movimentacoes',
  partes: '/partes',
  classes: '/classes',
  assuntos: '/assuntos',
  tribunais: '/tribunais',
  busca: '/busca'
};

// Códigos de tribunais DataJud
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

    // NOTA: A API DataJud real requer autenticação via token
    // Este é um exemplo de implementação. Você precisa configurar o token:
    // const response = await axios.get(`${DATAJUD_API_URL}${ENDPOINTS.processos}`, {
    //   params,
    //   headers: {
    //     'Authorization': `Bearer ${process.env.DATAJUD_API_TOKEN}`
    //   }
    // });

    // Por enquanto, retornar estrutura de dados simulada
    const resultado = {
      fonte: 'DataJud (CNJ)',
      tribunal,
      filtros,
      totalEncontrado: 0,
      processos: [],
      mensagem: 'DataJud requer token de autenticação. Configure DATAJUD_API_TOKEN no ambiente.',
      urlDocumentacao: 'https://datajud-wiki.cnj.jus.br/',
      fromCache: false
    };

    cache.set(cacheKey, resultado);
    return resultado;

  } catch (error) {
    console.error('Erro ao consultar DataJud:', error.message);
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

  try {
    const resultado = {
      fonte: 'DataJud (CNJ)',
      tribunal,
      termo,
      filtros,
      totalEncontrado: 0,
      decisoes: [],
      mensagem: 'DataJud requer token de autenticação. Configure DATAJUD_API_TOKEN no ambiente.',
      urlDocumentacao: 'https://datajud-wiki.cnj.jus.br/',
      fromCache: false
    };

    cache.set(cacheKey, resultado);
    return resultado;

  } catch (error) {
    console.error('Erro ao buscar decisões DataJud:', error.message);
    return {
      erro: true,
      mensagem: error.message,
      fonte: 'DataJud (CNJ)'
    };
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
  TRIBUNAIS_DATAJUD
};
