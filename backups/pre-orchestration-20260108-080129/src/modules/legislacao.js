/**
 * ROM Agent - Módulo de Legislação e Jurisprudência
 * Integração completa com bases legais nacionais e internacionais
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// URLs das bases de legislação
const BASES_LEGISLACAO = {
  // Legislação Federal
  planalto: 'https://www.planalto.gov.br',
  senado: 'https://www.senado.leg.br/atividade/const/constituicao-federal.asp',
  camara: 'https://www.camara.leg.br/legislacao',

  // Diários Oficiais
  dou: 'https://www.in.gov.br/servicos/diario-oficial-da-uniao',

  // Legislação Internacional
  onu: 'https://www.un.org/en/about-us/universal-declaration-of-human-rights',
  oea: 'https://www.oas.org/pt/cidh/',
  cidh: 'https://www.corteidh.or.cr/',

  // Pactos Internacionais
  pactosOnu: 'https://www.ohchr.org/en/instruments-listings',

  // Agências Reguladoras
  anatel: 'https://www.gov.br/anatel/pt-br/regulado/normatizacao',
  anvisa: 'https://www.gov.br/anvisa/pt-br/assuntos/regulamentacao',
  aneel: 'https://www.aneel.gov.br/legislacao',
  ana: 'https://www.gov.br/ana/pt-br/assuntos/regulacao',
  anac: 'https://www.gov.br/anac/pt-br/assuntos/legislacao',
  cvm: 'https://www.gov.br/cvm/pt-br/assuntos/normas',
  bacen: 'https://www.bcb.gov.br/estabilidadefinanceira/normasprudenciais'
};

// Categorias de legislação
const CATEGORIAS = {
  CONSTITUCIONAL: 'constitucional',
  INFRACONSTITUCIONAL: 'infraconstitucional',
  INTERNACIONAL: 'internacional',
  COMPLEMENTAR: 'complementar',
  ORDINARIA: 'ordinaria',
  DECRETO: 'decreto',
  PORTARIA: 'portaria',
  RESOLUCAO: 'resolucao',
  INSTRUCAO_NORMATIVA: 'instrucao_normativa',
  SUMULA: 'sumula',
  SUMULA_VINCULANTE: 'sumula_vinculante'
};

// Base de Emendas Constitucionais
const EMENDAS_CONSTITUCIONAIS = {
  total: 132, // Atualizado até 2024
  baseUrl: 'https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/'
};

// Principais Códigos
const CODIGOS = {
  CF: { nome: 'Constituição Federal', url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm' },
  CC: { nome: 'Código Civil', url: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm' },
  CPC: { nome: 'Código de Processo Civil', url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm' },
  CP: { nome: 'Código Penal', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm' },
  CPP: { nome: 'Código de Processo Penal', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm' },
  CLT: { nome: 'Consolidação das Leis do Trabalho', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm' },
  CDC: { nome: 'Código de Defesa do Consumidor', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm' },
  CTN: { nome: 'Código Tributário Nacional', url: 'https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm' },
  ECA: { nome: 'Estatuto da Criança e do Adolescente', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8069.htm' },
  LEP: { nome: 'Lei de Execução Penal', url: 'https://www.planalto.gov.br/ccivil_03/leis/l7210.htm' },
  ESTATUTO_IDOSO: { nome: 'Estatuto do Idoso', url: 'https://www.planalto.gov.br/ccivil_03/leis/2003/l10.741.htm' },
  LIA: { nome: 'Lei de Improbidade Administrativa', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8429.htm' },
  LAC: { nome: 'Lei Anticorrupção', url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12846.htm' },
  LGPD: { nome: 'Lei Geral de Proteção de Dados', url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm' },
  MARIA_PENHA: { nome: 'Lei Maria da Penha', url: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm' },
  DROGAS: { nome: 'Lei de Drogas', url: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11343.htm' },
  CRIMES_HEDIONDOS: { nome: 'Lei de Crimes Hediondos', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8072.htm' },
  JUIZADOS: { nome: 'Lei dos Juizados Especiais', url: 'https://www.planalto.gov.br/ccivil_03/leis/l9099.htm' },
  LICITACOES: { nome: 'Lei de Licitações', url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm' },
  LOCACOES: { nome: 'Lei do Inquilinato', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8245.htm' },
  FALENCIAS: { nome: 'Lei de Falências', url: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11101.htm' }
};

// Tratados Internacionais de Direitos Humanos
const TRATADOS_INTERNACIONAIS = {
  DUDH: { nome: 'Declaração Universal dos Direitos Humanos', ano: 1948 },
  PIDCP: { nome: 'Pacto Internacional dos Direitos Civis e Políticos', ano: 1966 },
  PIDESC: { nome: 'Pacto Internacional dos Direitos Econômicos, Sociais e Culturais', ano: 1966 },
  CADH: { nome: 'Convenção Americana de Direitos Humanos (Pacto de San José)', ano: 1969 },
  PROTOCOLO_SAN_SALVADOR: { nome: 'Protocolo de San Salvador', ano: 1988 },
  CONVENCAO_TORTURA: { nome: 'Convenção contra a Tortura', ano: 1984 },
  CEDAW: { nome: 'Convenção sobre Eliminação de Discriminação contra a Mulher', ano: 1979 },
  CRC: { nome: 'Convenção sobre os Direitos da Criança', ano: 1989 },
  CERD: { nome: 'Convenção sobre Eliminação de Discriminação Racial', ano: 1965 },
  ESTATUTO_ROMA: { nome: 'Estatuto de Roma do TPI', ano: 1998 },
  CONVENCAO_HAIA: { nome: 'Convenções de Haia', ano: 1907 },
  CONVENCOES_GENEBRA: { nome: 'Convenções de Genebra', ano: 1949 }
};

/**
 * Busca legislação por termo
 */
export async function buscarLegislacao(termo, categoria = null, options = {}) {
  const resultados = [];

  try {
    // Busca no Planalto
    const urlPlanalto = `${BASES_LEGISLACAO.planalto}/ccivil_03/leis/pesquisa.htm`;

    // Adicionar resultados dos códigos relevantes
    for (const [sigla, codigo] of Object.entries(CODIGOS)) {
      if (termo.toLowerCase().includes(sigla.toLowerCase()) ||
          codigo.nome.toLowerCase().includes(termo.toLowerCase())) {
        resultados.push({
          tipo: 'codigo',
          sigla,
          nome: codigo.nome,
          url: codigo.url,
          relevancia: 100
        });
      }
    }

    // Buscar tratados internacionais
    for (const [sigla, tratado] of Object.entries(TRATADOS_INTERNACIONAIS)) {
      if (termo.toLowerCase().includes(sigla.toLowerCase()) ||
          tratado.nome.toLowerCase().includes(termo.toLowerCase())) {
        resultados.push({
          tipo: 'tratado_internacional',
          sigla,
          nome: tratado.nome,
          ano: tratado.ano,
          relevancia: 90
        });
      }
    }

  } catch (error) {
    console.error('Erro ao buscar legislação:', error.message);
  }

  return resultados;
}

/**
 * Obter artigo específico de um código
 */
export async function obterArtigo(codigo, artigo, options = {}) {
  const codigoInfo = CODIGOS[codigo.toUpperCase()];
  if (!codigoInfo) {
    throw new Error(`Código ${codigo} não encontrado`);
  }

  return {
    codigo: codigo.toUpperCase(),
    codigoNome: codigoInfo.nome,
    artigo,
    url: codigoInfo.url,
    instrucao: `Consulte o Art. ${artigo} do ${codigoInfo.nome} em ${codigoInfo.url}`
  };
}

/**
 * Obter emenda constitucional
 */
export async function obterEmendaConstitucional(numero) {
  if (numero < 1 || numero > EMENDAS_CONSTITUCIONAIS.total) {
    throw new Error(`Emenda Constitucional ${numero} não encontrada. Total disponível: ${EMENDAS_CONSTITUCIONAIS.total}`);
  }

  const url = `${EMENDAS_CONSTITUCIONAIS.baseUrl}emc${numero}.htm`;

  return {
    tipo: 'emenda_constitucional',
    numero,
    url,
    instrucao: `Consulte a EC ${numero} em ${url}`
  };
}

/**
 * Listar todas as fontes de legislação disponíveis
 */
export function listarFontes() {
  return {
    bases: BASES_LEGISLACAO,
    codigos: Object.keys(CODIGOS),
    tratados: Object.keys(TRATADOS_INTERNACIONAIS),
    categorias: Object.values(CATEGORIAS),
    emendasConstitucionais: EMENDAS_CONSTITUCIONAIS.total
  };
}

/**
 * Buscar súmulas
 */
export async function buscarSumulas(tribunal, termo = null) {
  const tribunais = {
    STF: 'https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp',
    STJ: 'https://www.stj.jus.br/docs_internet/VerbsumbSTJ.txt',
    TST: 'https://www.tst.jus.br/sumulas',
    TSE: 'https://www.tse.jus.br/jurisprudencia/sumulas'
  };

  const urlTribunal = tribunais[tribunal.toUpperCase()];
  if (!urlTribunal) {
    throw new Error(`Tribunal ${tribunal} não suportado para busca de súmulas`);
  }

  return {
    tribunal: tribunal.toUpperCase(),
    url: urlTribunal,
    termo,
    instrucao: `Consulte as súmulas do ${tribunal} em ${urlTribunal}`
  };
}

/**
 * Buscar legislação de agências reguladoras
 */
export async function buscarNormaAgencia(agencia, termo = null) {
  const agenciaKey = agencia.toLowerCase();
  const url = BASES_LEGISLACAO[agenciaKey];

  if (!url) {
    throw new Error(`Agência ${agencia} não encontrada. Disponíveis: ${Object.keys(BASES_LEGISLACAO).filter(k => ['anatel', 'anvisa', 'aneel', 'ana', 'anac', 'cvm', 'bacen'].includes(k)).join(', ')}`);
  }

  return {
    agencia: agencia.toUpperCase(),
    url,
    termo,
    instrucao: `Consulte as normas da ${agencia.toUpperCase()} em ${url}`
  };
}

export default {
  buscarLegislacao,
  obterArtigo,
  obterEmendaConstitucional,
  listarFontes,
  buscarSumulas,
  buscarNormaAgencia,
  CODIGOS,
  TRATADOS_INTERNACIONAIS,
  CATEGORIAS,
  BASES_LEGISLACAO
};
