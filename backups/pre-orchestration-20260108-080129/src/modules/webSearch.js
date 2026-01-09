/**
 * ROM Agent - Módulo de Web Search Jurídico
 * Busca integrada em sites jurídicos, artigos científicos e bases de dados
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// Sites Jurídicos Principais
const SITES_JURIDICOS = {
  // Bases de Jurisprudência e Doutrinas
  jusbrasil: {
    nome: 'JusBrasil',
    url: 'https://www.jusbrasil.com.br',
    busca: 'https://www.jusbrasil.com.br/busca',
    tipo: 'jurisprudencia_doutrina'
  },
  conjur: {
    nome: 'Consultor Jurídico',
    url: 'https://www.conjur.com.br',
    busca: 'https://www.conjur.com.br/busca',
    tipo: 'noticias_artigos'
  },
  migalhas: {
    nome: 'Migalhas',
    url: 'https://www.migalhas.com.br',
    busca: 'https://www.migalhas.com.br/busca',
    tipo: 'noticias_artigos'
  },
  direitonet: {
    nome: 'DireitoNet',
    url: 'https://www.direitonet.com.br',
    busca: 'https://www.direitonet.com.br/busca',
    tipo: 'artigos_modelos'
  },
  jota: {
    nome: 'JOTA',
    url: 'https://www.jota.info',
    busca: 'https://www.jota.info/?s=',
    tipo: 'noticias_analises'
  },

  // Bases Acadêmicas
  scielo: {
    nome: 'SciELO',
    url: 'https://www.scielo.br',
    busca: 'https://search.scielo.org/',
    tipo: 'artigos_cientificos'
  },
  bdtd: {
    nome: 'BDTD - Biblioteca Digital de Teses e Dissertações',
    url: 'https://bdtd.ibict.br',
    busca: 'https://bdtd.ibict.br/vufind/Search/Results',
    tipo: 'teses_dissertacoes'
  },
  googleScholar: {
    nome: 'Google Scholar',
    url: 'https://scholar.google.com.br',
    busca: 'https://scholar.google.com.br/scholar?q=',
    tipo: 'artigos_cientificos'
  },
  capes: {
    nome: 'Portal de Periódicos CAPES',
    url: 'https://www.periodicos.capes.gov.br',
    busca: 'https://www.periodicos.capes.gov.br/index.php/buscador-primo.html',
    tipo: 'periodicos'
  },

  // Bases de Direito Internacional
  icjCij: {
    nome: 'Corte Internacional de Justiça',
    url: 'https://www.icj-cij.org',
    tipo: 'jurisprudencia_internacional'
  },
  corteidh: {
    nome: 'Corte Interamericana de Direitos Humanos',
    url: 'https://www.corteidh.or.cr',
    tipo: 'jurisprudencia_internacional'
  },
  echr: {
    nome: 'Corte Europeia de Direitos Humanos',
    url: 'https://www.echr.coe.int',
    tipo: 'jurisprudencia_internacional'
  },

  // Órgãos de Classe
  oab: {
    nome: 'OAB - Ordem dos Advogados do Brasil',
    url: 'https://www.oab.org.br',
    tipo: 'institucional'
  },
  cnj: {
    nome: 'Conselho Nacional de Justiça',
    url: 'https://www.cnj.jus.br',
    tipo: 'institucional_normas'
  },
  cnmp: {
    nome: 'Conselho Nacional do Ministério Público',
    url: 'https://www.cnmp.mp.br',
    tipo: 'institucional_normas'
  }
};

// Bases de Artigos Científicos por Área
const BASES_CIENTIFICAS = {
  direito: ['scielo', 'bdtd', 'googleScholar', 'capes'],
  medicina: ['pubmed', 'scielo', 'medline', 'lilacs'],
  engenharia: ['ieee', 'scienceDirect', 'scopus'],
  multidisciplinar: ['googleScholar', 'scielo', 'capes', 'bdtd']
};

// URLs de bases científicas adicionais
const BASES_CIENTIFICAS_URLS = {
  pubmed: {
    nome: 'PubMed',
    url: 'https://pubmed.ncbi.nlm.nih.gov',
    busca: 'https://pubmed.ncbi.nlm.nih.gov/?term='
  },
  lilacs: {
    nome: 'LILACS',
    url: 'https://lilacs.bvsalud.org',
    busca: 'https://lilacs.bvsalud.org/pt/'
  },
  ieee: {
    nome: 'IEEE Xplore',
    url: 'https://ieeexplore.ieee.org',
    busca: 'https://ieeexplore.ieee.org/search/searchresult.jsp?queryText='
  },
  scopus: {
    nome: 'Scopus',
    url: 'https://www.scopus.com',
    busca: 'https://www.scopus.com/search/form.uri'
  }
};

/**
 * Buscar em sites jurídicos
 */
export async function buscarSitesJuridicos(termo, sites = null, options = {}) {
  const sitesParaBuscar = sites || Object.keys(SITES_JURIDICOS);
  const resultados = [];

  for (const siteKey of sitesParaBuscar) {
    const site = SITES_JURIDICOS[siteKey];
    if (site) {
      resultados.push({
        site: siteKey,
        nome: site.nome,
        tipo: site.tipo,
        urlBusca: site.busca ? `${site.busca}?q=${encodeURIComponent(termo)}` : site.url,
        urlBase: site.url,
        termo
      });
    }
  }

  return resultados;
}

/**
 * Buscar artigos científicos
 */
export async function buscarArtigosCientificos(termo, area = 'multidisciplinar', options = {}) {
  const bases = BASES_CIENTIFICAS[area] || BASES_CIENTIFICAS.multidisciplinar;
  const resultados = [];

  for (const baseKey of bases) {
    let base = SITES_JURIDICOS[baseKey] || BASES_CIENTIFICAS_URLS[baseKey];
    if (base) {
      resultados.push({
        base: baseKey,
        nome: base.nome,
        urlBusca: base.busca ? `${base.busca}${encodeURIComponent(termo)}` : base.url,
        urlBase: base.url,
        area,
        termo
      });
    }
  }

  return resultados;
}

/**
 * Buscar jurisprudência no JusBrasil (instrução)
 */
export async function buscarJusBrasil(termo, tipo = 'tudo', options = {}) {
  const tipos = {
    jurisprudencia: 'jurisprudencia',
    noticias: 'noticias',
    artigos: 'artigos',
    peticoes: 'peticoes',
    modelos: 'modelos',
    tudo: ''
  };

  const tipoFiltro = tipos[tipo] || '';
  const url = `https://www.jusbrasil.com.br/busca?q=${encodeURIComponent(termo)}${tipoFiltro ? `&type=${tipoFiltro}` : ''}`;

  return {
    fonte: 'JusBrasil',
    termo,
    tipo,
    url,
    instrucao: `Acesse ${url} para buscar "${termo}" no JusBrasil`
  };
}

/**
 * Construir query de busca avançada
 */
export function construirQueryAvancada(params) {
  const {
    termos,
    operador = 'AND',
    excluir = [],
    exato = null,
    site = null,
    dataInicio = null,
    dataFim = null
  } = params;

  let query = '';

  // Termos principais
  if (Array.isArray(termos)) {
    query = termos.join(` ${operador} `);
  } else {
    query = termos;
  }

  // Frase exata
  if (exato) {
    query += ` "${exato}"`;
  }

  // Exclusões
  for (const termo of excluir) {
    query += ` -${termo}`;
  }

  // Site específico
  if (site) {
    query += ` site:${site}`;
  }

  // Filtro de data (para Google)
  // Formato: after:YYYY-MM-DD before:YYYY-MM-DD

  return query.trim();
}

/**
 * Buscar em bases de direito internacional
 */
export async function buscarDireitoInternacional(termo, corte = null) {
  const cortes = {
    cij: SITES_JURIDICOS.icjCij,
    cidh: SITES_JURIDICOS.corteidh,
    cedh: SITES_JURIDICOS.echr
  };

  if (corte && cortes[corte.toLowerCase()]) {
    const corteInfo = cortes[corte.toLowerCase()];
    return {
      corte: corte.toUpperCase(),
      nome: corteInfo.nome,
      url: corteInfo.url,
      termo,
      instrucao: `Pesquise "${termo}" em ${corteInfo.nome}: ${corteInfo.url}`
    };
  }

  // Buscar em todas as cortes
  return Object.entries(cortes).map(([key, value]) => ({
    corte: key.toUpperCase(),
    nome: value.nome,
    url: value.url,
    termo
  }));
}

/**
 * Buscar notícias jurídicas
 */
export async function buscarNoticiasJuridicas(termo, fontes = ['conjur', 'migalhas', 'jota']) {
  const resultados = [];

  for (const fonte of fontes) {
    const site = SITES_JURIDICOS[fonte];
    if (site) {
      resultados.push({
        fonte,
        nome: site.nome,
        urlBusca: site.busca ? `${site.busca}?q=${encodeURIComponent(termo)}` : site.url,
        termo
      });
    }
  }

  return resultados;
}

/**
 * Buscar teses e dissertações
 */
export async function buscarTesesDissertacoes(termo, options = {}) {
  const bdtd = SITES_JURIDICOS.bdtd;

  return {
    base: 'BDTD',
    nome: bdtd.nome,
    urlBusca: `${bdtd.busca}?lookfor=${encodeURIComponent(termo)}&type=AllFields`,
    termo,
    instrucao: `Pesquise teses e dissertações sobre "${termo}" em ${bdtd.url}`
  };
}

/**
 * Listar todas as fontes disponíveis
 */
export function listarFontes() {
  return {
    sitesJuridicos: Object.entries(SITES_JURIDICOS).map(([key, value]) => ({
      id: key,
      nome: value.nome,
      tipo: value.tipo,
      url: value.url
    })),
    basesCientificas: BASES_CIENTIFICAS,
    basesCientificasUrls: Object.entries(BASES_CIENTIFICAS_URLS).map(([key, value]) => ({
      id: key,
      nome: value.nome,
      url: value.url
    }))
  };
}

export default {
  buscarSitesJuridicos,
  buscarArtigosCientificos,
  buscarJusBrasil,
  construirQueryAvancada,
  buscarDireitoInternacional,
  buscarNoticiasJuridicas,
  buscarTesesDissertacoes,
  listarFontes,
  SITES_JURIDICOS,
  BASES_CIENTIFICAS,
  BASES_CIENTIFICAS_URLS
};
