/**
 * ROM Agent - Módulo de Jurisprudência
 * Pesquisa integrada de jurisprudência em múltiplas fontes
 *
 * Fontes suportadas:
 * - Jusbrasil (web scraping)
 * - STF (web scraping)
 * - STJ (web scraping)
 * - CNJ Datajud (API)
 * - Tribunais Estaduais
 *
 * @version 1.0.0
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { conversar } from './bedrock.js';

// Agente HTTPS que ignora erros de certificado (necessário para alguns sites de tribunais)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const CONFIG = {
  // User-Agents rotativos para evitar bloqueio
  userAgents: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
  ],

  // Timeout padrão (ms)
  timeout: 30000,

  // Delay entre requisições (ms) - respeitar rate limits
  delayEntreRequisicoes: 2000,

  // Cache em memória (TTL em ms)
  cacheTTL: 30 * 60 * 1000, // 30 minutos

  // URLs base
  urls: {
    jusbrasil: 'https://www.jusbrasil.com.br',
    stf: 'https://jurisprudencia.stf.jus.br',
    stfPortal: 'https://portal.stf.jus.br',
    stj: 'https://scon.stj.jus.br',
    datajud: 'https://api-publica.datajud.cnj.jus.br'
  }
};

// Função para obter User-Agent aleatório
function getRandomUserAgent() {
  return CONFIG.userAgents[Math.floor(Math.random() * CONFIG.userAgents.length)];
}

// Cache em memória
const cache = new Map();

// ============================================================
// UTILITÁRIOS
// ============================================================

/**
 * Delay para respeitar rate limits
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Faz requisição HTTP com retry
 */
async function fetchComRetry(url, options = {}, maxRetries = 3) {
  const config = {
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      ...options.headers
    },
    timeout: CONFIG.timeout,
    httpsAgent, // Ignora erros de certificado SSL
    maxRedirects: 5,
    ...options
  };

  for (let tentativa = 1; tentativa <= maxRetries; tentativa++) {
    try {
      const response = await axios(url, config);
      return response;
    } catch (error) {
      if (tentativa === maxRetries) {
        throw error;
      }
      await delay(1000 * tentativa);
    }
  }
}

/**
 * Verifica e retorna cache se válido
 */
function getFromCache(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CONFIG.cacheTTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

/**
 * Salva no cache
 */
function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Limpa texto removendo espaços extras
 */
function limparTexto(texto) {
  if (!texto) return '';
  return texto.replace(/\s+/g, ' ').trim();
}

// ============================================================
// JUSBRASIL
// ============================================================

/**
 * Pesquisa jurisprudência no Jusbrasil
 * @param {string} termo - Termo de busca
 * @param {object} options - Opções de busca
 */
export async function pesquisarJusbrasil(termo, options = {}) {
  const {
    tribunal = null,      // Filtrar por tribunal (stf, stj, tjsp, etc)
    pagina = 1,
    limite = 10
  } = options;

  const cacheKey = `jusbrasil:${termo}:${tribunal}:${pagina}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    // Construir URL de busca
    let url = `${CONFIG.urls.jusbrasil}/jurisprudencia/busca`;
    const params = new URLSearchParams({
      q: termo,
      p: pagina
    });

    if (tribunal) {
      params.append('tribunal', tribunal.toUpperCase());
    }

    const response = await fetchComRetry(`${url}?${params.toString()}`);
    const $ = cheerio.load(response.data);

    const resultados = [];

    // Parsear resultados da página
    $('div[class*="SearchResult"], article[class*="jurisprudence"]').each((i, el) => {
      if (i >= limite) return false;

      const $el = $(el);

      // Extrair dados
      const titulo = limparTexto($el.find('h2, h3, [class*="title"]').first().text());
      const ementa = limparTexto($el.find('[class*="ementa"], [class*="summary"], p').first().text());
      const tribunalNome = limparTexto($el.find('[class*="tribunal"], [class*="court"]').text());
      const data = limparTexto($el.find('[class*="date"], time').text());
      const link = $el.find('a').first().attr('href');
      const numero = limparTexto($el.find('[class*="numero"], [class*="number"]').text());

      if (titulo || ementa) {
        resultados.push({
          titulo: titulo || 'Sem título',
          ementa: ementa.substring(0, 500) + (ementa.length > 500 ? '...' : ''),
          tribunal: tribunalNome || tribunal?.toUpperCase() || 'Não informado',
          data,
          numero,
          link: link?.startsWith('http') ? link : `${CONFIG.urls.jusbrasil}${link}`,
          fonte: 'Jusbrasil'
        });
      }
    });

    // Se não encontrou com seletores específicos, tentar genérico
    if (resultados.length === 0) {
      $('a[href*="/jurisprudencia/"]').each((i, el) => {
        if (i >= limite) return false;

        const $el = $(el);
        const href = $el.attr('href');
        const texto = limparTexto($el.text());

        if (texto && texto.length > 20 && href) {
          resultados.push({
            titulo: texto.substring(0, 200),
            ementa: '',
            tribunal: 'Não identificado',
            data: '',
            numero: '',
            link: href.startsWith('http') ? href : `${CONFIG.urls.jusbrasil}${href}`,
            fonte: 'Jusbrasil'
          });
        }
      });
    }

    const resultado = {
      sucesso: true,
      fonte: 'Jusbrasil',
      termo,
      totalEncontrados: resultados.length,
      pagina,
      resultados
    };

    setCache(cacheKey, resultado);
    await delay(CONFIG.delayEntreRequisicoes);

    return resultado;

  } catch (error) {
    return {
      sucesso: false,
      fonte: 'Jusbrasil',
      erro: error.message,
      termo
    };
  }
}

// ============================================================
// STF - SUPREMO TRIBUNAL FEDERAL
// ============================================================

/**
 * Pesquisa jurisprudência no STF
 * @param {string} termo - Termo de busca
 * @param {object} options - Opções de busca
 */
export async function pesquisarSTF(termo, options = {}) {
  const {
    base = 'ACOR',  // ACOR (acórdãos), SJUR (súmulas), PRES (presidência)
    pagina = 1,
    limite = 10
  } = options;

  const cacheKey = `stf:${termo}:${base}:${pagina}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    // API de pesquisa do STF
    const url = `${CONFIG.urls.stf}/api/search/pesquisar`;

    const response = await fetchComRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: JSON.stringify({
        query: termo,
        base: base,
        page: pagina - 1,
        pageSize: limite,
        sort: 'date',
        sortOrder: 'desc'
      })
    });

    const data = response.data;
    const resultados = [];

    if (data.result && Array.isArray(data.result)) {
      for (const item of data.result) {
        resultados.push({
          titulo: item.titulo || item.classe + ' ' + item.numero,
          ementa: limparTexto(item.ementa || item.texto || '').substring(0, 500),
          tribunal: 'STF',
          data: item.dataJulgamento || item.dataPublicacao || '',
          numero: item.numero || item.incidente || '',
          relator: item.relator || '',
          classe: item.classe || '',
          link: `${CONFIG.urls.stf}/#/jurisprudencia/detalhe/${item.id}`,
          fonte: 'STF'
        });
      }
    }

    const resultado = {
      sucesso: true,
      fonte: 'STF',
      termo,
      totalEncontrados: data.totalElements || resultados.length,
      pagina,
      resultados
    };

    setCache(cacheKey, resultado);
    await delay(CONFIG.delayEntreRequisicoes);

    return resultado;

  } catch (error) {
    // Fallback: scraping da página de pesquisa
    return await pesquisarSTFFallback(termo, options);
  }
}

/**
 * Fallback: scraping do portal de jurisprudência do STF
 */
async function pesquisarSTFFallback(termo, options = {}) {
  const { pagina = 1, limite = 10 } = options;

  try {
    const url = `https://portal.stf.jus.br/jurisprudencia/`;
    const params = new URLSearchParams({
      s1: termo,
      pagina: pagina
    });

    const response = await fetchComRetry(`${url}?${params.toString()}`);
    const $ = cheerio.load(response.data);

    const resultados = [];

    $('.jurisprudencia-item, .resultado-item, [class*="decision"]').each((i, el) => {
      if (i >= limite) return false;

      const $el = $(el);
      const titulo = limparTexto($el.find('h3, h4, .titulo').text());
      const ementa = limparTexto($el.find('.ementa, .resumo, p').text());
      const numero = limparTexto($el.find('.numero, .processo').text());
      const relator = limparTexto($el.find('.relator, .ministro').text());
      const data = limparTexto($el.find('.data, time').text());

      if (titulo || ementa) {
        resultados.push({
          titulo: titulo || numero || 'Decisão STF',
          ementa: ementa.substring(0, 500),
          tribunal: 'STF',
          data,
          numero,
          relator,
          link: CONFIG.urls.stf,
          fonte: 'STF'
        });
      }
    });

    return {
      sucesso: true,
      fonte: 'STF (fallback)',
      termo,
      totalEncontrados: resultados.length,
      pagina,
      resultados
    };

  } catch (error) {
    return {
      sucesso: false,
      fonte: 'STF',
      erro: error.message,
      termo
    };
  }
}

// ============================================================
// STJ - SUPERIOR TRIBUNAL DE JUSTIÇA
// ============================================================

/**
 * Pesquisa jurisprudência no STJ
 * @param {string} termo - Termo de busca
 * @param {object} options - Opções de busca
 */
export async function pesquisarSTJ(termo, options = {}) {
  const {
    tipo = 'ACOR',  // ACOR (acórdãos), SUMU (súmulas)
    pagina = 1,
    limite = 10
  } = options;

  const cacheKey = `stj:${termo}:${tipo}:${pagina}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    // URL do SCON (Sistema de Consulta)
    const url = `${CONFIG.urls.stj}/SCON/pesquisar.jsp`;

    const params = new URLSearchParams({
      livre: termo,
      b: tipo,
      p: true,
      thesaurus: 'JURIDICO',
      l: limite,
      i: ((pagina - 1) * limite) + 1
    });

    const response = await fetchComRetry(`${url}?${params.toString()}`);
    const $ = cheerio.load(response.data);

    const resultados = [];

    // Parsear resultados do STJ
    $('.documento, .docReferencia, [class*="resultado"]').each((i, el) => {
      if (i >= limite) return false;

      const $el = $(el);

      const classe = limparTexto($el.find('.classeProcesso, .classe').text());
      const numero = limparTexto($el.find('.numeroProcesso, .numero').text());
      const relator = limparTexto($el.find('.relator, .ministro').text());
      const orgaoJulgador = limparTexto($el.find('.orgaoJulgador, .orgao').text());
      const dataJulgamento = limparTexto($el.find('.dataJulgamento, .data').text());
      const ementa = limparTexto($el.find('.ementa, .textoEmenta').text());
      const link = $el.find('a[href*="documento"]').attr('href');

      if (classe || numero || ementa) {
        resultados.push({
          titulo: `${classe} ${numero}`.trim() || 'Decisão STJ',
          ementa: ementa.substring(0, 500) + (ementa.length > 500 ? '...' : ''),
          tribunal: 'STJ',
          data: dataJulgamento,
          numero,
          classe,
          relator,
          orgaoJulgador,
          link: link ? `${CONFIG.urls.stj}${link}` : CONFIG.urls.stj,
          fonte: 'STJ'
        });
      }
    });

    const resultado = {
      sucesso: true,
      fonte: 'STJ',
      termo,
      totalEncontrados: resultados.length,
      pagina,
      resultados
    };

    setCache(cacheKey, resultado);
    await delay(CONFIG.delayEntreRequisicoes);

    return resultado;

  } catch (error) {
    return {
      sucesso: false,
      fonte: 'STJ',
      erro: error.message,
      termo
    };
  }
}

// ============================================================
// CNJ DATAJUD API
// ============================================================

/**
 * Pesquisa processos no CNJ Datajud
 * Nota: Requer chave de API (solicitar em: https://www.cnj.jus.br/sistemas/datajud/api-publica/)
 * @param {string} numeroProcesso - Número CNJ do processo
 * @param {object} options - Opções de busca
 */
export async function pesquisarDatajud(numeroProcesso, options = {}) {
  const {
    apiKey = process.env.CNJ_DATAJUD_API_KEY,
    tribunal = null
  } = options;

  if (!apiKey) {
    return {
      sucesso: false,
      fonte: 'CNJ Datajud',
      erro: 'Chave de API não configurada. Configure CNJ_DATAJUD_API_KEY ou solicite em: https://www.cnj.jus.br/sistemas/datajud/api-publica/',
      numeroProcesso
    };
  }

  const cacheKey = `datajud:${numeroProcesso}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    // Determinar tribunal pelo número CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO)
    const tribunalCode = tribunal || extrairTribunalDoNumero(numeroProcesso);

    const url = `${CONFIG.urls.datajud}/processo/${tribunalCode}/_search`;

    const response = await fetchComRetry(url, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({
        query: {
          match: {
            numeroProcesso: numeroProcesso.replace(/[.-]/g, '')
          }
        }
      })
    });

    const data = response.data;
    const hits = data.hits?.hits || [];

    const resultados = hits.map(hit => ({
      numeroProcesso: hit._source.numeroProcesso,
      classe: hit._source.classe?.nome || '',
      assuntos: hit._source.assuntos?.map(a => a.nome) || [],
      orgaoJulgador: hit._source.orgaoJulgador?.nome || '',
      dataAjuizamento: hit._source.dataAjuizamento,
      movimentos: hit._source.movimentos?.slice(0, 10) || [],
      tribunal: tribunalCode,
      fonte: 'CNJ Datajud'
    }));

    const resultado = {
      sucesso: true,
      fonte: 'CNJ Datajud',
      numeroProcesso,
      totalEncontrados: hits.length,
      resultados
    };

    setCache(cacheKey, resultado);
    return resultado;

  } catch (error) {
    return {
      sucesso: false,
      fonte: 'CNJ Datajud',
      erro: error.message,
      numeroProcesso
    };
  }
}

/**
 * Extrai código do tribunal do número CNJ
 */
function extrairTribunalDoNumero(numeroCNJ) {
  // Formato: NNNNNNN-DD.AAAA.J.TR.OOOO
  const match = numeroCNJ.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\./);
  if (match) {
    const justica = match[1];
    const tribunal = match[2];
    // Mapear para código do tribunal
    const mapa = {
      '8': { // Justiça Estadual
        '26': 'tjsp', '19': 'tjrj', '13': 'tjmg', '21': 'tjrs'
      },
      '4': 'trf', // Justiça Federal
      '5': 'trt', // Justiça do Trabalho
      '1': 'stf',
      '2': 'stj'
    };
    // Simplificado - retornar código genérico
    return `api_publica_${justica}_${tribunal}`;
  }
  return 'api_publica';
}

// ============================================================
// PESQUISA VIA IA (BEDROCK)
// ============================================================

/**
 * Pesquisa jurisprudência usando IA (mais confiável que scraping)
 * @param {string} termo - Termo de busca
 * @param {object} options - Opções
 */
export async function pesquisarViaIA(termo, options = {}) {
  const {
    modelo = 'amazon.nova-pro-v1:0',
    tribunal = null,
    maxTokens = 4096
  } = options;

  const tribunalFiltro = tribunal ? ` no ${tribunal.toUpperCase()}` : ' nos tribunais superiores brasileiros (STF, STJ)';

  const systemPrompt = `Você é um pesquisador jurídico especializado em jurisprudência brasileira.
Pesquise e apresente precedentes relevantes sobre o tema solicitado.

Para cada precedente encontrado, forneça:
1. Tribunal e classe processual (ex: STF, HC 123456)
2. Relator
3. Data do julgamento
4. Ementa resumida
5. Tese firmada

IMPORTANTE:
- Cite apenas precedentes que você tem conhecimento confiável
- Indique quando um precedente pode estar desatualizado
- Priorize: súmulas vinculantes, repercussão geral, recursos repetitivos
- Seja preciso nas informações`;

  const prompt = `Pesquise jurisprudência${tribunalFiltro} sobre: "${termo}"

Liste os principais precedentes relevantes com suas ementas resumidas.`;

  const resultado = await conversar(prompt, {
    systemPrompt,
    modelo,
    maxTokens
  });

  return {
    sucesso: resultado.sucesso,
    fonte: 'IA Bedrock',
    termo,
    tribunal: tribunal || 'Todos',
    modelo,
    resultados: resultado.resposta,
    uso: resultado.uso,
    observacao: 'Precedentes gerados por IA - verificar nas fontes oficiais'
  };
}

// ============================================================
// PESQUISA UNIFICADA
// ============================================================

/**
 * Pesquisa jurisprudência em todas as fontes disponíveis
 * @param {string} termo - Termo de busca
 * @param {object} options - Opções de busca
 */
export async function pesquisarJurisprudencia(termo, options = {}) {
  const {
    fontes = ['ia', 'stf', 'stj'],
    limite = 10,
    paralelo = true,
    modelo = 'amazon.nova-pro-v1:0'
  } = options;

  const resultados = {
    sucesso: true,
    termo,
    timestamp: new Date().toISOString(),
    fontes: {},
    totalGeral: 0
  };

  const pesquisas = [];

  // Usar IA como fonte principal (mais confiável)
  if (fontes.includes('ia')) {
    pesquisas.push(
      pesquisarViaIA(termo, { modelo })
        .then(r => ({ fonte: 'ia', resultado: r }))
    );
  }

  // Preparar pesquisas tradicionais (podem falhar por bloqueio)
  if (fontes.includes('jusbrasil')) {
    pesquisas.push(
      pesquisarJusbrasil(termo, { limite })
        .then(r => ({ fonte: 'jusbrasil', resultado: r }))
    );
  }

  if (fontes.includes('stf')) {
    pesquisas.push(
      pesquisarSTF(termo, { limite })
        .then(r => ({ fonte: 'stf', resultado: r }))
    );
  }

  if (fontes.includes('stj')) {
    pesquisas.push(
      pesquisarSTJ(termo, { limite })
        .then(r => ({ fonte: 'stj', resultado: r }))
    );
  }

  // Executar pesquisas
  if (paralelo) {
    const respostas = await Promise.allSettled(pesquisas);
    for (const resposta of respostas) {
      if (resposta.status === 'fulfilled') {
        const { fonte, resultado } = resposta.value;
        resultados.fontes[fonte] = resultado;
        if (resultado.sucesso) {
          resultados.totalGeral += resultado.totalEncontrados || (fonte === 'ia' ? 1 : 0);
        }
      }
    }
  } else {
    for (const pesquisa of pesquisas) {
      const { fonte, resultado } = await pesquisa;
      resultados.fontes[fonte] = resultado;
      if (resultado.sucesso) {
        resultados.totalGeral += resultado.totalEncontrados || (fonte === 'ia' ? 1 : 0);
      }
      await delay(CONFIG.delayEntreRequisicoes);
    }
  }

  return resultados;
}

// ============================================================
// ANÁLISE COM IA
// ============================================================

/**
 * Pesquisa e analisa jurisprudência com IA
 * @param {string} tese - Tese ou argumento jurídico
 * @param {object} options - Opções
 */
export async function analisarJurisprudenciaIA(tese, options = {}) {
  const {
    modelo = 'amazon.nova-pro-v1:0',
    fontes = ['stf', 'stj'],
    limite = 5
  } = options;

  // 1. Pesquisar jurisprudência
  const pesquisa = await pesquisarJurisprudencia(tese, { fontes, limite });

  // 2. Consolidar resultados
  const decisoes = [];
  for (const [fonte, resultado] of Object.entries(pesquisa.fontes)) {
    if (resultado.sucesso && resultado.resultados) {
      decisoes.push(...resultado.resultados);
    }
  }

  if (decisoes.length === 0) {
    return {
      sucesso: false,
      erro: 'Nenhuma jurisprudência encontrada para análise',
      tese
    };
  }

  // 3. Preparar contexto para IA
  const contexto = decisoes.map((d, i) => `
[${i + 1}] ${d.tribunal} - ${d.titulo}
Data: ${d.data || 'Não informada'}
Relator: ${d.relator || 'Não informado'}
Ementa: ${d.ementa}
`).join('\n---\n');

  // 4. Analisar com IA
  const systemPrompt = `Você é um analista jurídico especializado em jurisprudência brasileira.
Analise as decisões fornecidas e apresente:

1. TESE PREDOMINANTE: Qual o entendimento majoritário dos tribunais
2. ARGUMENTOS FAVORÁVEIS: Fundamentos que apoiam a tese do usuário
3. ARGUMENTOS CONTRÁRIOS: Fundamentos que podem ser usados contra
4. EVOLUÇÃO JURISPRUDENCIAL: Se houve mudança de entendimento
5. RECOMENDAÇÃO: Sugestão estratégica para o caso

Seja objetivo e cite os precedentes relevantes.`;

  const prompt = `TESE A ANALISAR: ${tese}

DECISÕES ENCONTRADAS:
${contexto}

Analise a jurisprudência acima em relação à tese apresentada.`;

  const analise = await conversar(prompt, {
    systemPrompt,
    modelo,
    maxTokens: 4096
  });

  return {
    sucesso: analise.sucesso,
    tese,
    totalDecisoes: decisoes.length,
    decisoes: decisoes.slice(0, 5), // Primeiras 5
    analise: analise.resposta,
    modelo: analise.modelo,
    fontesPesquisadas: Object.keys(pesquisa.fontes)
  };
}

/**
 * Busca precedentes para fundamentação de peça
 * @param {string} tema - Tema jurídico
 * @param {string} tipoPeca - Tipo de peça (habeas_corpus, apelacao, etc)
 */
export async function buscarPrecedentes(tema, tipoPeca, options = {}) {
  const {
    modelo = 'amazon.nova-pro-v1:0',
    limite = 10
  } = options;

  // Pesquisar em múltiplas fontes
  const pesquisa = await pesquisarJurisprudencia(tema, {
    fontes: ['stf', 'stj', 'jusbrasil'],
    limite
  });

  // Consolidar
  const precedentes = [];
  for (const resultado of Object.values(pesquisa.fontes)) {
    if (resultado.sucesso && resultado.resultados) {
      precedentes.push(...resultado.resultados);
    }
  }

  // Usar IA para selecionar os mais relevantes
  const systemPrompt = `Você é um assistente jurídico especializado em seleção de precedentes.
Analise os precedentes fornecidos e selecione os mais relevantes para uma ${tipoPeca}.

Para cada precedente selecionado, forneça:
1. Citação formatada (tribunal, classe, número, relator, data)
2. Tese aplicável
3. Trecho relevante para citação

Priorize:
- Precedentes do STF e STJ
- Decisões recentes
- Teses consolidadas (súmulas, repercussão geral, recursos repetitivos)`;

  const prompt = `TEMA: ${tema}
TIPO DE PEÇA: ${tipoPeca}

PRECEDENTES ENCONTRADOS:
${JSON.stringify(precedentes.slice(0, 15), null, 2)}

Selecione e formate os precedentes mais relevantes.`;

  const selecao = await conversar(prompt, {
    systemPrompt,
    modelo,
    maxTokens: 4096
  });

  return {
    sucesso: selecao.sucesso,
    tema,
    tipoPeca,
    totalEncontrados: precedentes.length,
    precedentesFormatados: selecao.resposta,
    precedentesOriginais: precedentes.slice(0, 10)
  };
}

// ============================================================
// SÚMULAS
// ============================================================

/**
 * Pesquisa súmulas relevantes
 * @param {string} tema - Tema jurídico
 */
export async function pesquisarSumulas(tema, options = {}) {
  const { tribunais = ['stf', 'stj'] } = options;

  const resultados = {
    sucesso: true,
    tema,
    sumulas: []
  };

  // STF - Súmulas
  if (tribunais.includes('stf')) {
    const stf = await pesquisarSTF(tema, { base: 'SJUR', limite: 20 });
    if (stf.sucesso) {
      resultados.sumulas.push(...stf.resultados.map(r => ({
        ...r,
        tipo: 'Súmula STF'
      })));
    }
  }

  // STJ - Súmulas
  if (tribunais.includes('stj')) {
    const stj = await pesquisarSTJ(tema, { tipo: 'SUMU', limite: 20 });
    if (stj.sucesso) {
      resultados.sumulas.push(...stj.resultados.map(r => ({
        ...r,
        tipo: 'Súmula STJ'
      })));
    }
  }

  return resultados;
}

// ============================================================
// MONITORAMENTO DE TESE
// ============================================================

/**
 * Configura monitoramento de tese jurídica
 * (Armazena configuração para pesquisas periódicas)
 */
export async function monitorarTese(tese, options = {}) {
  const {
    tribunais = ['stf', 'stj'],
    callback = null,
    intervaloHoras = 24
  } = options;

  // Pesquisa inicial
  const resultadoInicial = await pesquisarJurisprudencia(tese, {
    fontes: tribunais,
    limite: 20
  });

  return {
    sucesso: true,
    tese,
    tribunais,
    intervaloHoras,
    resultadoInicial,
    mensagem: 'Monitoramento configurado. Execute periodicamente para verificar novas decisões.'
  };
}

// ============================================================
// EXPORTAÇÕES
// ============================================================

export default {
  // Configuração
  CONFIG,

  // Pesquisa por fonte
  pesquisarJusbrasil,
  pesquisarSTF,
  pesquisarSTJ,
  pesquisarDatajud,

  // Pesquisa via IA (mais confiável)
  pesquisarViaIA,

  // Pesquisa unificada
  pesquisarJurisprudencia,
  pesquisarSumulas,

  // Análise com IA
  analisarJurisprudenciaIA,
  buscarPrecedentes,

  // Monitoramento
  monitorarTese,

  // Utilitários
  limparCache: () => cache.clear()
};
