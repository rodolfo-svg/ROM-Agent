/**
 * ROM Agent - Módulo de Integração com Tribunais
 * Consulta de jurisprudência, processos e andamentos
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// Tribunais Superiores
const TRIBUNAIS_SUPERIORES = {
  STF: {
    nome: 'Supremo Tribunal Federal',
    site: 'https://portal.stf.jus.br',
    jurisprudencia: 'https://jurisprudencia.stf.jus.br/pages/search',
    processos: 'https://portal.stf.jus.br/processos/',
    api: 'https://portal.stf.jus.br/servicos/atividade/'
  },
  STJ: {
    nome: 'Superior Tribunal de Justiça',
    site: 'https://www.stj.jus.br',
    jurisprudencia: 'https://scon.stj.jus.br/SCON/',
    processos: 'https://processo.stj.jus.br/processo/pesquisa/',
    api: 'https://processo.stj.jus.br/SCON/servlet/BuscaAcordaos'
  },
  TST: {
    nome: 'Tribunal Superior do Trabalho',
    site: 'https://www.tst.jus.br',
    jurisprudencia: 'https://jurisprudencia.tst.jus.br/',
    processos: 'https://consultaprocessual.tst.jus.br/'
  },
  TSE: {
    nome: 'Tribunal Superior Eleitoral',
    site: 'https://www.tse.jus.br',
    jurisprudencia: 'https://www.tse.jus.br/jurisprudencia',
    processos: 'https://www.tse.jus.br/servicos-judiciais/processos'
  },
  STM: {
    nome: 'Superior Tribunal Militar',
    site: 'https://www.stm.jus.br',
    jurisprudencia: 'https://www.stm.jus.br/servicos-stm/jurisprudencia',
    processos: 'https://www.stm.jus.br/servicos-stm/processos'
  }
};

// Tribunais Regionais Federais
const TRFs = {
  TRF1: {
    nome: 'TRF da 1ª Região',
    estados: ['AC', 'AM', 'AP', 'BA', 'DF', 'GO', 'MA', 'MG', 'MT', 'PA', 'PI', 'RO', 'RR', 'TO'],
    site: 'https://www.trf1.jus.br',
    jurisprudencia: 'https://jurisprudencia.trf1.jus.br/busca/'
  },
  TRF2: {
    nome: 'TRF da 2ª Região',
    estados: ['RJ', 'ES'],
    site: 'https://www.trf2.jus.br',
    jurisprudencia: 'https://jurisprudencia.trf2.jus.br/'
  },
  TRF3: {
    nome: 'TRF da 3ª Região',
    estados: ['SP', 'MS'],
    site: 'https://www.trf3.jus.br',
    jurisprudencia: 'https://web.trf3.jus.br/acordaos/'
  },
  TRF4: {
    nome: 'TRF da 4ª Região',
    estados: ['PR', 'SC', 'RS'],
    site: 'https://www.trf4.jus.br',
    jurisprudencia: 'https://jurisprudencia.trf4.jus.br/'
  },
  TRF5: {
    nome: 'TRF da 5ª Região',
    estados: ['AL', 'CE', 'PB', 'PE', 'RN', 'SE'],
    site: 'https://www.trf5.jus.br',
    jurisprudencia: 'https://www4.trf5.jus.br/jurisprudencia/'
  },
  TRF6: {
    nome: 'TRF da 6ª Região',
    estados: ['MG'],
    site: 'https://www.trf6.jus.br',
    jurisprudencia: 'https://www.trf6.jus.br/jurisprudencia/'
  }
};

// Tribunais de Justiça Estaduais
const TJs = {
  TJAC: { nome: 'TJ do Acre', uf: 'AC', site: 'https://www.tjac.jus.br' },
  TJAL: { nome: 'TJ de Alagoas', uf: 'AL', site: 'https://www.tjal.jus.br' },
  TJAM: { nome: 'TJ do Amazonas', uf: 'AM', site: 'https://www.tjam.jus.br' },
  TJAP: { nome: 'TJ do Amapá', uf: 'AP', site: 'https://www.tjap.jus.br' },
  TJBA: { nome: 'TJ da Bahia', uf: 'BA', site: 'https://www.tjba.jus.br' },
  TJCE: { nome: 'TJ do Ceará', uf: 'CE', site: 'https://www.tjce.jus.br' },
  TJDFT: { nome: 'TJ do Distrito Federal', uf: 'DF', site: 'https://www.tjdft.jus.br' },
  TJES: { nome: 'TJ do Espírito Santo', uf: 'ES', site: 'https://www.tjes.jus.br' },
  TJGO: { nome: 'TJ de Goiás', uf: 'GO', site: 'https://www.tjgo.jus.br' },
  TJMA: { nome: 'TJ do Maranhão', uf: 'MA', site: 'https://www.tjma.jus.br' },
  TJMG: { nome: 'TJ de Minas Gerais', uf: 'MG', site: 'https://www.tjmg.jus.br' },
  TJMS: { nome: 'TJ do Mato Grosso do Sul', uf: 'MS', site: 'https://www.tjms.jus.br' },
  TJMT: { nome: 'TJ do Mato Grosso', uf: 'MT', site: 'https://www.tjmt.jus.br' },
  TJPA: { nome: 'TJ do Pará', uf: 'PA', site: 'https://www.tjpa.jus.br' },
  TJPB: { nome: 'TJ da Paraíba', uf: 'PB', site: 'https://www.tjpb.jus.br' },
  TJPE: { nome: 'TJ de Pernambuco', uf: 'PE', site: 'https://www.tjpe.jus.br' },
  TJPI: { nome: 'TJ do Piauí', uf: 'PI', site: 'https://www.tjpi.jus.br' },
  TJPR: { nome: 'TJ do Paraná', uf: 'PR', site: 'https://www.tjpr.jus.br' },
  TJRJ: { nome: 'TJ do Rio de Janeiro', uf: 'RJ', site: 'https://www.tjrj.jus.br' },
  TJRN: { nome: 'TJ do Rio Grande do Norte', uf: 'RN', site: 'https://www.tjrn.jus.br' },
  TJRO: { nome: 'TJ de Rondônia', uf: 'RO', site: 'https://www.tjro.jus.br' },
  TJRR: { nome: 'TJ de Roraima', uf: 'RR', site: 'https://www.tjrr.jus.br' },
  TJRS: { nome: 'TJ do Rio Grande do Sul', uf: 'RS', site: 'https://www.tjrs.jus.br' },
  TJSC: { nome: 'TJ de Santa Catarina', uf: 'SC', site: 'https://www.tjsc.jus.br' },
  TJSE: { nome: 'TJ de Sergipe', uf: 'SE', site: 'https://www.tjse.jus.br' },
  TJSP: { nome: 'TJ de São Paulo', uf: 'SP', site: 'https://www.tjsp.jus.br' },
  TJTO: { nome: 'TJ do Tocantins', uf: 'TO', site: 'https://www.tjto.jus.br' }
};

// Tribunais Regionais do Trabalho
const TRTs = {
  TRT1: { nome: 'TRT da 1ª Região', uf: 'RJ', site: 'https://www.trt1.jus.br' },
  TRT2: { nome: 'TRT da 2ª Região', uf: 'SP', site: 'https://www.trt2.jus.br' },
  TRT3: { nome: 'TRT da 3ª Região', uf: 'MG', site: 'https://www.trt3.jus.br' },
  TRT4: { nome: 'TRT da 4ª Região', uf: 'RS', site: 'https://www.trt4.jus.br' },
  TRT5: { nome: 'TRT da 5ª Região', uf: 'BA', site: 'https://www.trt5.jus.br' },
  TRT6: { nome: 'TRT da 6ª Região', uf: 'PE', site: 'https://www.trt6.jus.br' },
  TRT7: { nome: 'TRT da 7ª Região', uf: 'CE', site: 'https://www.trt7.jus.br' },
  TRT8: { nome: 'TRT da 8ª Região', uf: 'PA/AP', site: 'https://www.trt8.jus.br' },
  TRT9: { nome: 'TRT da 9ª Região', uf: 'PR', site: 'https://www.trt9.jus.br' },
  TRT10: { nome: 'TRT da 10ª Região', uf: 'DF/TO', site: 'https://www.trt10.jus.br' },
  TRT11: { nome: 'TRT da 11ª Região', uf: 'AM/RR', site: 'https://www.trt11.jus.br' },
  TRT12: { nome: 'TRT da 12ª Região', uf: 'SC', site: 'https://www.trt12.jus.br' },
  TRT13: { nome: 'TRT da 13ª Região', uf: 'PB', site: 'https://www.trt13.jus.br' },
  TRT14: { nome: 'TRT da 14ª Região', uf: 'RO/AC', site: 'https://www.trt14.jus.br' },
  TRT15: { nome: 'TRT da 15ª Região', uf: 'SP (Campinas)', site: 'https://www.trt15.jus.br' },
  TRT16: { nome: 'TRT da 16ª Região', uf: 'MA', site: 'https://www.trt16.jus.br' },
  TRT17: { nome: 'TRT da 17ª Região', uf: 'ES', site: 'https://www.trt17.jus.br' },
  TRT18: { nome: 'TRT da 18ª Região', uf: 'GO', site: 'https://www.trt18.jus.br' },
  TRT19: { nome: 'TRT da 19ª Região', uf: 'AL', site: 'https://www.trt19.jus.br' },
  TRT20: { nome: 'TRT da 20ª Região', uf: 'SE', site: 'https://www.trt20.jus.br' },
  TRT21: { nome: 'TRT da 21ª Região', uf: 'RN', site: 'https://www.trt21.jus.br' },
  TRT22: { nome: 'TRT da 22ª Região', uf: 'PI', site: 'https://www.trt22.jus.br' },
  TRT23: { nome: 'TRT da 23ª Região', uf: 'MT', site: 'https://www.trt23.jus.br' },
  TRT24: { nome: 'TRT da 24ª Região', uf: 'MS', site: 'https://www.trt24.jus.br' }
};

// Justiça Militar
const JUSTICA_MILITAR = {
  STM: TRIBUNAIS_SUPERIORES.STM,
  TJM_MG: { nome: 'TJ Militar de MG', site: 'https://www.tjmmg.jus.br' },
  TJM_RS: { nome: 'TJ Militar do RS', site: 'https://www.tjmrs.jus.br' },
  TJM_SP: { nome: 'TJ Militar de SP', site: 'https://www.tjmsp.jus.br' }
};

// Justiça Desportiva
const JUSTICA_DESPORTIVA = {
  STJD_FUTEBOL: { nome: 'STJD Futebol', site: 'https://www.stjd.org.br' },
  STJD_OUTROS: { nome: 'Tribunais de Justiça Desportiva', site: 'https://www.cob.org.br' }
};

/**
 * Buscar jurisprudência em um tribunal específico
 */
export async function buscarJurisprudencia(tribunal, termo, options = {}) {
  const tribunalUpper = tribunal.toUpperCase();
  let tribunalInfo = null;

  // Buscar em todas as categorias
  if (TRIBUNAIS_SUPERIORES[tribunalUpper]) {
    tribunalInfo = TRIBUNAIS_SUPERIORES[tribunalUpper];
  } else if (TRFs[tribunalUpper]) {
    tribunalInfo = TRFs[tribunalUpper];
  } else if (TJs[tribunalUpper]) {
    tribunalInfo = TJs[tribunalUpper];
  } else if (TRTs[tribunalUpper]) {
    tribunalInfo = TRTs[tribunalUpper];
  }

  if (!tribunalInfo) {
    throw new Error(`Tribunal ${tribunal} não encontrado`);
  }

  return {
    tribunal: tribunalUpper,
    nome: tribunalInfo.nome,
    termo,
    urlJurisprudencia: tribunalInfo.jurisprudencia || tribunalInfo.site,
    urlSite: tribunalInfo.site,
    instrucao: `Pesquise "${termo}" na jurisprudência do ${tribunalInfo.nome}`
  };
}

/**
 * Consultar processo por número
 */
export async function consultarProcesso(numeroProcesso, tribunal = null) {
  // Extrair informações do número do processo (formato CNJ)
  const regexCNJ = /(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})/;
  const match = numeroProcesso.match(regexCNJ);

  let tribunalIdentificado = tribunal;
  let segmentoJustica = null;

  if (match) {
    const [, sequencial, digito, ano, segmento, tribunalCod, origem] = match;
    segmentoJustica = {
      '1': 'STF',
      '2': 'CNJ',
      '3': 'STJ',
      '4': 'Justiça Federal',
      '5': 'Justiça do Trabalho',
      '6': 'Justiça Eleitoral',
      '7': 'Justiça Militar da União',
      '8': 'Justiça Estadual',
      '9': 'Justiça Militar Estadual'
    }[segmento] || 'Desconhecido';
  }

  return {
    numeroProcesso,
    tribunal: tribunalIdentificado,
    segmentoJustica,
    instrucao: `Consulte o processo ${numeroProcesso} no sistema do tribunal`
  };
}

/**
 * Buscar jurisprudência em múltiplos tribunais
 */
export async function buscarJurisprudenciaMultipla(termo, tribunais = ['STF', 'STJ'], options = {}) {
  const resultados = [];

  for (const tribunal of tribunais) {
    try {
      const resultado = await buscarJurisprudencia(tribunal, termo, options);
      resultados.push(resultado);
    } catch (error) {
      resultados.push({
        tribunal,
        erro: error.message
      });
    }
  }

  return resultados;
}

/**
 * Obter informações de um tribunal
 */
export function obterInfoTribunal(tribunal) {
  const tribunalUpper = tribunal.toUpperCase();

  if (TRIBUNAIS_SUPERIORES[tribunalUpper]) {
    return { categoria: 'Superior', ...TRIBUNAIS_SUPERIORES[tribunalUpper] };
  }
  if (TRFs[tribunalUpper]) {
    return { categoria: 'TRF', ...TRFs[tribunalUpper] };
  }
  if (TJs[tribunalUpper]) {
    return { categoria: 'TJ', ...TJs[tribunalUpper] };
  }
  if (TRTs[tribunalUpper]) {
    return { categoria: 'TRT', ...TRTs[tribunalUpper] };
  }
  if (JUSTICA_MILITAR[tribunalUpper]) {
    return { categoria: 'Militar', ...JUSTICA_MILITAR[tribunalUpper] };
  }

  return null;
}

/**
 * Listar todos os tribunais disponíveis
 */
export function listarTribunais() {
  return {
    superiores: Object.keys(TRIBUNAIS_SUPERIORES),
    trfs: Object.keys(TRFs),
    tjs: Object.keys(TJs),
    trts: Object.keys(TRTs),
    militar: Object.keys(JUSTICA_MILITAR),
    desportiva: Object.keys(JUSTICA_DESPORTIVA)
  };
}

/**
 * Buscar tribunal por UF
 */
export function buscarTribunalPorUF(uf) {
  const ufUpper = uf.toUpperCase();
  const resultado = {
    tj: null,
    trf: null,
    trt: null
  };

  // Buscar TJ
  for (const [sigla, info] of Object.entries(TJs)) {
    if (info.uf === ufUpper) {
      resultado.tj = { sigla, ...info };
      break;
    }
  }

  // Buscar TRF
  for (const [sigla, info] of Object.entries(TRFs)) {
    if (info.estados && info.estados.includes(ufUpper)) {
      resultado.trf = { sigla, ...info };
      break;
    }
  }

  // Buscar TRT
  for (const [sigla, info] of Object.entries(TRTs)) {
    if (info.uf && info.uf.includes(ufUpper)) {
      resultado.trt = { sigla, ...info };
      break;
    }
  }

  return resultado;
}

export default {
  buscarJurisprudencia,
  consultarProcesso,
  buscarJurisprudenciaMultipla,
  obterInfoTribunal,
  listarTribunais,
  buscarTribunalPorUF,
  TRIBUNAIS_SUPERIORES,
  TRFs,
  TJs,
  TRTs,
  JUSTICA_MILITAR,
  JUSTICA_DESPORTIVA
};
