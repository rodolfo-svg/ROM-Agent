/**
 * ROM Agent - Servidor MCP para DataJud (CNJ)
 *
 * Integração gratuita com a API pública do CNJ para consulta
 * de processos em todos os tribunais brasileiros.
 *
 * Documentação: https://datajud-wiki.cnj.jus.br/api-publica/
 */

import https from 'https';

// Configuração da API DataJud
const DATAJUD_CONFIG = {
  baseUrl: 'api-publica.datajud.cnj.jus.br',
  version: 'v1',
  // Chave pública (solicitar em: https://datajud-wiki.cnj.jus.br/api-publica/)
  apiKey: process.env.DATAJUD_API_KEY || 'sua-chave-api-aqui'
};

// Mapeamento de tribunais
export const TRIBUNAIS = {
  // Tribunais Superiores
  'STF': 'stf',
  'STJ': 'stj',
  'TST': 'tst',
  'TSE': 'tse',
  'STM': 'stm',

  // Justiça Federal
  'TRF1': 'trf1',
  'TRF2': 'trf2',
  'TRF3': 'trf3',
  'TRF4': 'trf4',
  'TRF5': 'trf5',
  'TRF6': 'trf6',

  // Justiça Estadual (Goiás)
  'TJGO': 'tjgo',

  // Outros TJs
  'TJSP': 'tjsp',
  'TJRJ': 'tjrj',
  'TJMG': 'tjmg',
  'TJRS': 'tjrs',
  'TJPR': 'tjpr',
  'TJSC': 'tjsc',
  'TJBA': 'tjba',
  'TJPE': 'tjpe',
  'TJCE': 'tjce',
  'TJDF': 'tjdft'
};

/**
 * Faz requisição à API DataJud
 * @param {string} endpoint - Endpoint da API
 * @param {object} params - Parâmetros da consulta
 * @returns {Promise<object>} - Resposta da API
 */
function requestDatajud(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    const queryString = new URLSearchParams(params).toString();
    const path = `/api_publica_${DATAJUD_CONFIG.version}/_search?${queryString}`;

    const options = {
      hostname: DATAJUD_CONFIG.baseUrl,
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${DATAJUD_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Erro ao parsear resposta: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(params));
    req.end();
  });
}

/**
 * Busca processo por número
 * @param {string} numeroProcesso - Número do processo (formato CNJ)
 * @param {string} tribunal - Sigla do tribunal (ex: 'TJGO')
 * @returns {Promise<object>}
 */
export async function buscarProcesso(numeroProcesso, tribunal = null) {
  const query = {
    query: {
      match: {
        numeroProcesso: numeroProcesso.replace(/[^\d]/g, '')
      }
    },
    size: 10
  };

  if (tribunal && TRIBUNAIS[tribunal]) {
    query.query = {
      bool: {
        must: [
          { match: { numeroProcesso: numeroProcesso.replace(/[^\d]/g, '') } },
          { match: { siglaTribunal: TRIBUNAIS[tribunal] } }
        ]
      }
    };
  }

  return await requestDatajud('/_search', query);
}

/**
 * Busca processos por nome da parte
 * @param {string} nomeParte - Nome da parte
 * @param {string} tribunal - Sigla do tribunal (opcional)
 * @param {number} limite - Quantidade máxima de resultados
 * @returns {Promise<object>}
 */
export async function buscarPorParte(nomeParte, tribunal = null, limite = 20) {
  const query = {
    query: {
      bool: {
        must: [
          { match: { "partes.nome": nomeParte } }
        ]
      }
    },
    size: limite
  };

  if (tribunal && TRIBUNAIS[tribunal]) {
    query.query.bool.must.push({ match: { siglaTribunal: TRIBUNAIS[tribunal] } });
  }

  return await requestDatajud('/_search', query);
}

/**
 * Busca processos por CPF/CNPJ
 * @param {string} documento - CPF ou CNPJ
 * @param {string} tribunal - Sigla do tribunal (opcional)
 * @returns {Promise<object>}
 */
export async function buscarPorDocumento(documento, tribunal = null) {
  const docLimpo = documento.replace(/[^\d]/g, '');

  const query = {
    query: {
      bool: {
        must: [
          { match: { "partes.documento": docLimpo } }
        ]
      }
    },
    size: 50
  };

  if (tribunal && TRIBUNAIS[tribunal]) {
    query.query.bool.must.push({ match: { siglaTribunal: TRIBUNAIS[tribunal] } });
  }

  return await requestDatajud('/_search', query);
}

/**
 * Busca por classe processual
 * @param {string} classe - Classe processual (ex: "Recurso Especial")
 * @param {string} tribunal - Sigla do tribunal
 * @param {string} assunto - Assunto (opcional)
 * @returns {Promise<object>}
 */
export async function buscarPorClasse(classe, tribunal, assunto = null) {
  const query = {
    query: {
      bool: {
        must: [
          { match: { classe: classe } },
          { match: { siglaTribunal: TRIBUNAIS[tribunal] || tribunal } }
        ]
      }
    },
    size: 50
  };

  if (assunto) {
    query.query.bool.must.push({ match: { assunto: assunto } });
  }

  return await requestDatajud('/_search', query);
}

/**
 * Busca movimentações de um processo
 * @param {string} numeroProcesso - Número do processo
 * @returns {Promise<object>}
 */
export async function buscarMovimentacoes(numeroProcesso) {
  const query = {
    query: {
      match: {
        numeroProcesso: numeroProcesso.replace(/[^\d]/g, '')
      }
    },
    _source: ["numeroProcesso", "movimentos", "dataAjuizamento", "classe"],
    size: 1
  };

  return await requestDatajud('/_search', query);
}

/**
 * Formata resultado para exibição
 * @param {object} hit - Hit do Elasticsearch
 * @returns {object} - Resultado formatado
 */
export function formatarResultado(hit) {
  const source = hit._source || {};
  return {
    numero: source.numeroProcesso,
    tribunal: source.siglaTribunal,
    classe: source.classe,
    assuntos: source.assuntos || [],
    dataAjuizamento: source.dataAjuizamento,
    partes: (source.partes || []).map(p => ({
      nome: p.nome,
      tipo: p.tipoParte,
      documento: p.documento
    })),
    ultimaMovimentacao: source.movimentos ? source.movimentos[0] : null
  };
}

// =============================================================================
// INTERFACE MCP
// =============================================================================

/**
 * Handler para ferramentas MCP
 */
export const mcpTools = {
  /**
   * Ferramenta: buscar_processo
   */
  buscar_processo: {
    description: "Busca um processo pelo número no DataJud (CNJ)",
    parameters: {
      numeroProcesso: { type: "string", description: "Número do processo (formato CNJ)" },
      tribunal: { type: "string", description: "Sigla do tribunal (ex: TJGO, STJ)", optional: true }
    },
    handler: async (params) => {
      const result = await buscarProcesso(params.numeroProcesso, params.tribunal);
      if (result.hits && result.hits.hits.length > 0) {
        return result.hits.hits.map(formatarResultado);
      }
      return { message: "Processo não encontrado" };
    }
  },

  /**
   * Ferramenta: buscar_por_parte
   */
  buscar_por_parte: {
    description: "Busca processos por nome da parte",
    parameters: {
      nomeParte: { type: "string", description: "Nome da parte" },
      tribunal: { type: "string", description: "Sigla do tribunal", optional: true },
      limite: { type: "number", description: "Limite de resultados", optional: true, default: 20 }
    },
    handler: async (params) => {
      const result = await buscarPorParte(params.nomeParte, params.tribunal, params.limite || 20);
      if (result.hits && result.hits.hits.length > 0) {
        return result.hits.hits.map(formatarResultado);
      }
      return { message: "Nenhum processo encontrado" };
    }
  },

  /**
   * Ferramenta: buscar_por_documento
   */
  buscar_por_documento: {
    description: "Busca processos por CPF ou CNPJ",
    parameters: {
      documento: { type: "string", description: "CPF ou CNPJ" },
      tribunal: { type: "string", description: "Sigla do tribunal", optional: true }
    },
    handler: async (params) => {
      const result = await buscarPorDocumento(params.documento, params.tribunal);
      if (result.hits && result.hits.hits.length > 0) {
        return result.hits.hits.map(formatarResultado);
      }
      return { message: "Nenhum processo encontrado" };
    }
  },

  /**
   * Ferramenta: buscar_movimentacoes
   */
  buscar_movimentacoes: {
    description: "Busca movimentações de um processo",
    parameters: {
      numeroProcesso: { type: "string", description: "Número do processo" }
    },
    handler: async (params) => {
      const result = await buscarMovimentacoes(params.numeroProcesso);
      if (result.hits && result.hits.hits.length > 0) {
        const processo = result.hits.hits[0]._source;
        return {
          numero: processo.numeroProcesso,
          classe: processo.classe,
          dataAjuizamento: processo.dataAjuizamento,
          movimentos: (processo.movimentos || []).slice(0, 20)
        };
      }
      return { message: "Processo não encontrado" };
    }
  }
};

// Export default
export default {
  buscarProcesso,
  buscarPorParte,
  buscarPorDocumento,
  buscarPorClasse,
  buscarMovimentacoes,
  formatarResultado,
  mcpTools,
  TRIBUNAIS
};

// Teste se executado diretamente
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  console.log('=== ROM Agent - Servidor MCP DataJud ===\n');
  console.log('Ferramentas disponíveis:');
  Object.keys(mcpTools).forEach(tool => {
    console.log(`  - ${tool}: ${mcpTools[tool].description}`);
  });
  console.log('\nTribunais suportados:', Object.keys(TRIBUNAIS).join(', '));
  console.log('\nNOTA: Configure DATAJUD_API_KEY nas variáveis de ambiente');
  console.log('Solicite sua chave em: https://datajud-wiki.cnj.jus.br/api-publica/');
}
