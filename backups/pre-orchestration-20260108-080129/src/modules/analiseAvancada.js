/**
 * ROM Agent - Módulo de Análise Avançada de Texto Jurídico
 * Ferramentas de NLP, validação e processamento para excelência jurídica
 */

import compromise from 'compromise';
import { cpf, cnpj } from 'cpf-cnpj-validator';
import validator from 'validator';
import { DateTime } from 'luxon';
import Dinero from 'dinero.js';
import * as math from 'mathjs';
import stringSimilarity from 'string-similarity';
import keywordExtractor from 'keyword-extractor';
import FlexSearch from 'flexsearch';
import NodeCache from 'node-cache';

// ============================================================================
// CACHE PARA PERFORMANCE
// ============================================================================
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// ============================================================================
// ANÁLISE DE TEXTO JURÍDICO COM NLP
// ============================================================================

export const analisadorNLP = {
  /**
   * Extrai entidades nomeadas do texto jurídico
   */
  extrairEntidades(texto) {
    const doc = compromise(texto);

    return {
      pessoas: doc.people().out('array'),
      lugares: doc.places().out('array'),
      organizacoes: doc.organizations().out('array'),
      datas: this.extrairDatas(texto),
      valores: this.extrairValores(texto),
      cpfs: this.extrairCPFs(texto),
      cnpjs: this.extrairCNPJs(texto),
      processos: this.extrairNumerosProcesso(texto),
      artigos: this.extrairArtigosLei(texto),
      tribunais: this.extrairTribunais(texto)
    };
  },

  /**
   * Extrai datas do texto em formato brasileiro
   */
  extrairDatas(texto) {
    const padroes = [
      /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g,  // DD/MM/YYYY
      /(\d{1,2})\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/gi
    ];

    const datas = [];
    for (const padrao of padroes) {
      const matches = texto.matchAll(padrao);
      for (const match of matches) {
        datas.push({
          original: match[0],
          posicao: match.index
        });
      }
    }

    return [...new Set(datas.map(d => d.original))];
  },

  /**
   * Extrai valores monetários
   */
  extrairValores(texto) {
    const padroes = [
      /R\$\s*[\d\.,]+/g,
      /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:reais|real)/gi
    ];

    const valores = [];
    for (const padrao of padroes) {
      const matches = texto.matchAll(padrao);
      for (const match of matches) {
        valores.push(match[0]);
      }
    }

    return [...new Set(valores)];
  },

  /**
   * Extrai CPFs do texto
   */
  extrairCPFs(texto) {
    const padrao = /\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}/g;
    const matches = texto.match(padrao) || [];

    return matches.filter(m => {
      const numeros = m.replace(/\D/g, '');
      return cpf.isValid(numeros);
    });
  },

  /**
   * Extrai CNPJs do texto
   */
  extrairCNPJs(texto) {
    const padrao = /\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-.\s]?\d{2}/g;
    const matches = texto.match(padrao) || [];

    return matches.filter(m => {
      const numeros = m.replace(/\D/g, '');
      return cnpj.isValid(numeros);
    });
  },

  /**
   * Extrai números de processo (formato CNJ)
   */
  extrairNumerosProcesso(texto) {
    // Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
    const padrao = /\d{7}[-.]?\d{2}[.]?\d{4}[.]?\d[.]?\d{2}[.]?\d{4}/g;
    return texto.match(padrao) || [];
  },

  /**
   * Extrai referências a artigos de lei
   */
  extrairArtigosLei(texto) {
    const padroes = [
      /art(?:igo)?\.?\s*(\d+)(?:,?\s*(?:§|parágrafo)\s*(\d+))?(?:,?\s*(?:inciso\s+)?([IVXLCDM]+))?(?:,?\s*(?:alínea\s+)?["']?([a-z])["']?)?/gi,
      /arts?\.?\s*(\d+)\s*(?:a|e|,)\s*(\d+)/gi
    ];

    const artigos = [];
    for (const padrao of padroes) {
      const matches = texto.matchAll(padrao);
      for (const match of matches) {
        artigos.push({
          completo: match[0],
          artigo: match[1],
          paragrafo: match[2] || null,
          inciso: match[3] || null,
          alinea: match[4] || null
        });
      }
    }

    return artigos;
  },

  /**
   * Extrai menções a tribunais
   */
  extrairTribunais(texto) {
    const tribunais = [
      'STF', 'STJ', 'TST', 'TSE', 'STM',
      'TRF1', 'TRF2', 'TRF3', 'TRF4', 'TRF5', 'TRF6',
      'TJSP', 'TJRJ', 'TJMG', 'TJRS', 'TJPR', 'TJSC', 'TJBA',
      'TJPE', 'TJCE', 'TJGO', 'TJDF', 'TJMT', 'TJMS', 'TJES',
      'TJMA', 'TJPA', 'TJAM', 'TJAL', 'TJSE', 'TJPB', 'TJRN',
      'TJPI', 'TJAC', 'TJAP', 'TJRO', 'TJRR', 'TJTO',
      'TRT', 'TRE'
    ];

    const encontrados = [];
    const textoUpper = texto.toUpperCase();

    for (const tribunal of tribunais) {
      if (textoUpper.includes(tribunal)) {
        encontrados.push(tribunal);
      }
    }

    return [...new Set(encontrados)];
  },

  /**
   * Extrai palavras-chave do texto
   */
  extrairPalavrasChave(texto, quantidade = 10) {
    return keywordExtractor.extract(texto, {
      language: 'portuguese',
      remove_digits: false,
      return_changed_case: true,
      remove_duplicates: true
    }).slice(0, quantidade);
  },

  /**
   * Analisa estrutura de sentenças
   */
  analisarSentencas(texto) {
    const sentencas = texto.split(/[.!?]+/).filter(s => s.trim().length > 0);

    return {
      total: sentencas.length,
      mediaPalavras: math.mean(sentencas.map(s => s.split(/\s+/).length)),
      maiorSentenca: Math.max(...sentencas.map(s => s.split(/\s+/).length)),
      menorSentenca: Math.min(...sentencas.map(s => s.split(/\s+/).length))
    };
  }
};

// ============================================================================
// VALIDADORES JURÍDICOS
// ============================================================================

export const validadores = {
  /**
   * Valida CPF
   */
  validarCPF(numero) {
    const limpo = numero.replace(/\D/g, '');
    return {
      valido: cpf.isValid(limpo),
      formatado: cpf.format(limpo),
      numero: limpo
    };
  },

  /**
   * Valida CNPJ
   */
  validarCNPJ(numero) {
    const limpo = numero.replace(/\D/g, '');
    return {
      valido: cnpj.isValid(limpo),
      formatado: cnpj.format(limpo),
      numero: limpo
    };
  },

  /**
   * Valida número de processo CNJ
   */
  validarProcessoCNJ(numero) {
    const limpo = numero.replace(/\D/g, '');

    if (limpo.length !== 20) {
      return { valido: false, erro: 'Número deve ter 20 dígitos' };
    }

    // Extrair componentes
    const nnnnnnn = limpo.slice(0, 7);   // Número sequencial
    const dd = limpo.slice(7, 9);         // Dígito verificador
    const aaaa = limpo.slice(9, 13);      // Ano
    const j = limpo.slice(13, 14);        // Segmento de justiça
    const tr = limpo.slice(14, 16);       // Tribunal
    const oooo = limpo.slice(16, 20);     // Origem

    // Calcular dígito verificador
    const resto = BigInt(nnnnnnn + aaaa + j + tr + oooo) % 97n;
    const dvCalculado = String(97n - resto).padStart(2, '0');

    const valido = dd === dvCalculado;

    // Identificar segmento
    const segmentos = {
      '1': 'Supremo Tribunal Federal',
      '2': 'Conselho Nacional de Justiça',
      '3': 'Superior Tribunal de Justiça',
      '4': 'Justiça Federal',
      '5': 'Justiça do Trabalho',
      '6': 'Justiça Eleitoral',
      '7': 'Justiça Militar da União',
      '8': 'Justiça dos Estados',
      '9': 'Justiça Militar Estadual'
    };

    return {
      valido,
      formatado: `${nnnnnnn}-${dd}.${aaaa}.${j}.${tr}.${oooo}`,
      componentes: {
        sequencial: nnnnnnn,
        digitoVerificador: dd,
        ano: aaaa,
        segmento: segmentos[j] || 'Desconhecido',
        tribunal: tr,
        origem: oooo
      },
      dvCalculado,
      erro: valido ? null : `Dígito verificador incorreto (esperado: ${dvCalculado})`
    };
  },

  /**
   * Valida OAB
   */
  validarOAB(inscricao) {
    // Formato: UF 123456 ou 123456/UF
    const padrao = /^([A-Z]{2})\s*(\d+)|(\d+)\s*[\/\\]\s*([A-Z]{2})$/i;
    const match = inscricao.match(padrao);

    if (!match) {
      return { valido: false, erro: 'Formato inválido' };
    }

    const uf = (match[1] || match[4]).toUpperCase();
    const numero = match[2] || match[3];

    const ufsValidas = [
      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
      'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
      'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
    ];

    return {
      valido: ufsValidas.includes(uf),
      uf,
      numero,
      formatado: `OAB/${uf} ${numero}`
    };
  },

  /**
   * Valida email
   */
  validarEmail(email) {
    return {
      valido: validator.isEmail(email),
      email: email.toLowerCase().trim()
    };
  },

  /**
   * Valida URL
   */
  validarURL(url) {
    return {
      valido: validator.isURL(url),
      url
    };
  }
};

// ============================================================================
// CALCULADORA JUDICIAL AVANÇADA
// ============================================================================

export const calculadoraJudicial = {
  // Índices de correção monetária (valores de exemplo)
  indices: {
    INPC: { nome: 'INPC', mensal: 0.0045 },
    IPCA: { nome: 'IPCA', mensal: 0.0042 },
    'IGP-M': { nome: 'IGP-M', mensal: 0.0038 },
    'TR': { nome: 'TR', mensal: 0.0000 },
    SELIC: { nome: 'SELIC', mensal: 0.0085 }
  },

  /**
   * Calcula correção monetária
   */
  calcularCorrecaoMonetaria(valor, dataInicial, dataFinal, indice = 'INPC') {
    const inicio = DateTime.fromFormat(dataInicial, 'dd/MM/yyyy');
    const fim = DateTime.fromFormat(dataFinal, 'dd/MM/yyyy');
    const meses = fim.diff(inicio, 'months').months;

    const taxaMensal = this.indices[indice]?.mensal || 0.0045;
    const fatorCorrecao = Math.pow(1 + taxaMensal, meses);
    const valorCorrigido = valor * fatorCorrecao;

    return {
      valorOriginal: this.formatarMoeda(valor),
      valorCorrigido: this.formatarMoeda(valorCorrigido),
      fatorCorrecao: fatorCorrecao.toFixed(8),
      meses: Math.round(meses),
      indice,
      dataInicial,
      dataFinal,
      correcao: this.formatarMoeda(valorCorrigido - valor)
    };
  },

  /**
   * Calcula juros de mora
   */
  calcularJurosMora(valor, dataInicial, dataFinal, taxaMensal = 0.01) {
    const inicio = DateTime.fromFormat(dataInicial, 'dd/MM/yyyy');
    const fim = DateTime.fromFormat(dataFinal, 'dd/MM/yyyy');
    const meses = fim.diff(inicio, 'months').months;

    const juros = valor * taxaMensal * meses;

    return {
      valorPrincipal: this.formatarMoeda(valor),
      juros: this.formatarMoeda(juros),
      taxaMensal: `${(taxaMensal * 100).toFixed(2)}%`,
      meses: Math.round(meses),
      total: this.formatarMoeda(valor + juros)
    };
  },

  /**
   * Calcula débito atualizado completo
   */
  calcularDebitoAtualizado(valor, dataVencimento, dataCalculo, opcoes = {}) {
    const {
      indiceCorrecao = 'INPC',
      jurosMensal = 0.01,
      multaPercentual = 0
    } = opcoes;

    // Correção monetária
    const correcao = this.calcularCorrecaoMonetaria(
      valor,
      dataVencimento,
      dataCalculo,
      indiceCorrecao
    );

    const valorCorrigido = parseFloat(correcao.valorCorrigido.replace(/[^\d,]/g, '').replace(',', '.'));

    // Juros de mora
    const juros = this.calcularJurosMora(
      valorCorrigido,
      dataVencimento,
      dataCalculo,
      jurosMensal
    );

    const valorComJuros = parseFloat(juros.total.replace(/[^\d,]/g, '').replace(',', '.'));

    // Multa
    const multa = valorCorrigido * multaPercentual;

    // Total
    const total = valorComJuros + multa;

    return {
      principal: this.formatarMoeda(valor),
      correcaoMonetaria: correcao.correcao,
      juros: juros.juros,
      multa: this.formatarMoeda(multa),
      total: this.formatarMoeda(total),
      detalhamento: {
        correcao,
        juros,
        multaPercentual: `${(multaPercentual * 100).toFixed(2)}%`
      },
      dataVencimento,
      dataCalculo
    };
  },

  /**
   * Calcula verbas trabalhistas
   */
  calcularVerbasTrabalistas(salario, mesesTrabalhados, opcoes = {}) {
    const {
      feriasVencidas = 0,
      feriasProporcionais = true,
      decimoTerceiro = true,
      avisoPrevio = true,
      fgts = true,
      multa40 = true
    } = opcoes;

    const calculos = {
      salarioBase: salario,
      mesesTrabalhados
    };

    // Férias vencidas + 1/3
    if (feriasVencidas > 0) {
      calculos.feriasVencidas = salario * feriasVencidas;
      calculos.tercoFeriasVencidas = calculos.feriasVencidas / 3;
    }

    // Férias proporcionais + 1/3
    if (feriasProporcionais) {
      const mesesFerias = mesesTrabalhados % 12;
      calculos.feriasProporcionais = (salario / 12) * mesesFerias;
      calculos.tercoFeriasProporcionais = calculos.feriasProporcionais / 3;
    }

    // 13º salário proporcional
    if (decimoTerceiro) {
      const meses13 = mesesTrabalhados % 12;
      calculos.decimoTerceiro = (salario / 12) * meses13;
    }

    // Aviso prévio indenizado
    if (avisoPrevio) {
      const diasAdicionais = Math.min(Math.floor(mesesTrabalhados / 12) * 3, 60);
      calculos.avisoPrevio = salario + (salario / 30) * diasAdicionais;
    }

    // FGTS
    if (fgts) {
      calculos.fgtsDepositos = salario * 0.08 * mesesTrabalhados;
      if (multa40) {
        calculos.fgtsMulta40 = calculos.fgtsDepositos * 0.40;
      }
    }

    // Total
    calculos.total = Object.entries(calculos)
      .filter(([k, v]) => typeof v === 'number' && !['salarioBase', 'mesesTrabalhados'].includes(k))
      .reduce((acc, [k, v]) => acc + v, 0);

    // Formatar valores
    const formatado = {};
    for (const [chave, valor] of Object.entries(calculos)) {
      formatado[chave] = typeof valor === 'number'
        ? this.formatarMoeda(valor)
        : valor;
    }

    return formatado;
  },

  /**
   * Calcula honorários advocatícios
   */
  calcularHonorarios(valorCausa, percentual = 0.20, opcoes = {}) {
    const {
      minimo = null,
      maximo = null,
      sucumbencia = false,
      exito = false,
      percentualExito = 0.30
    }= opcoes;

    let honorarios = valorCausa * percentual;

    if (minimo && honorarios < minimo) honorarios = minimo;
    if (maximo && honorarios > maximo) honorarios = maximo;

    const resultado = {
      valorCausa: this.formatarMoeda(valorCausa),
      percentual: `${(percentual * 100).toFixed(2)}%`,
      honorariosContratuais: this.formatarMoeda(honorarios)
    };

    if (sucumbencia) {
      // Art. 85, §2º, CPC: 10% a 20%
      const sucumbenciaMin = valorCausa * 0.10;
      const sucumbenciaMax = valorCausa * 0.20;
      resultado.sucumbenciaMinima = this.formatarMoeda(sucumbenciaMin);
      resultado.sucumbenciaMaxima = this.formatarMoeda(sucumbenciaMax);
    }

    if (exito) {
      resultado.honorariosExito = this.formatarMoeda(valorCausa * percentualExito);
      resultado.percentualExito = `${(percentualExito * 100).toFixed(2)}%`;
    }

    return resultado;
  },

  /**
   * Formata valor como moeda brasileira
   */
  formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  },

  /**
   * Parseia valor monetário brasileiro
   */
  parsearMoeda(texto) {
    const limpo = texto
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    return parseFloat(limpo);
  }
};

// ============================================================================
// ANÁLISE DE LEGIBILIDADE E QUALIDADE
// ============================================================================

export const analiseQualidade = {
  /**
   * Calcula índice de legibilidade Flesch adaptado para português
   */
  calcularLegibilidade(texto) {
    const palavras = texto.split(/\s+/).filter(p => p.length > 0);
    const sentencas = texto.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const silabas = palavras.reduce((acc, p) => acc + this.contarSilabas(p), 0);

    if (palavras.length === 0 || sentencas.length === 0) {
      return { indice: 0, classificacao: 'Texto muito curto' };
    }

    // Fórmula Flesch adaptada para português
    const mediaPS = palavras.length / sentencas.length;
    const mediaSP = silabas / palavras.length;
    const indice = 248.835 - (1.015 * mediaPS) - (84.6 * mediaSP);

    let classificacao;
    if (indice >= 75) classificacao = 'Muito fácil';
    else if (indice >= 50) classificacao = 'Fácil';
    else if (indice >= 25) classificacao = 'Moderado';
    else if (indice >= 0) classificacao = 'Difícil';
    else classificacao = 'Muito difícil';

    return {
      indice: Math.round(indice),
      classificacao,
      estatisticas: {
        palavras: palavras.length,
        sentencas: sentencas.length,
        silabas,
        mediaPalavrasPorSentenca: mediaPS.toFixed(1),
        mediaSilabasPorPalavra: mediaSP.toFixed(1)
      }
    };
  },

  /**
   * Conta sílabas em português (aproximado)
   */
  contarSilabas(palavra) {
    const vogais = palavra.toLowerCase().match(/[aeiouáéíóúâêîôûãõàèìòù]/g);
    return vogais ? vogais.length : 1;
  },

  /**
   * Analisa qualidade do texto jurídico
   */
  analisarQualidadeJuridica(texto) {
    const problemas = [];
    const sugestoes = [];

    // Verificar parágrafos muito longos
    const paragrafos = texto.split(/\n\n+/);
    paragrafos.forEach((p, i) => {
      const palavras = p.split(/\s+/).length;
      if (palavras > 200) {
        problemas.push(`Parágrafo ${i + 1} muito longo (${palavras} palavras)`);
        sugestoes.push('Divida parágrafos com mais de 200 palavras');
      }
    });

    // Verificar sentenças muito longas
    const sentencas = texto.split(/[.!?]+/);
    sentencas.forEach((s, i) => {
      const palavras = s.split(/\s+/).filter(p => p.length > 0).length;
      if (palavras > 40) {
        problemas.push(`Sentença ${i + 1} muito longa (${palavras} palavras)`);
        sugestoes.push('Divida sentenças com mais de 40 palavras');
      }
    });

    // Verificar uso excessivo de gerúndio
    const gerundios = texto.match(/\b\w+ndo\b/gi) || [];
    if (gerundios.length > texto.split(/\s+/).length * 0.05) {
      problemas.push('Uso excessivo de gerúndio');
      sugestoes.push('Reduza o uso de gerúndio para melhorar clareza');
    }

    // Verificar voz passiva
    const vozPassiva = texto.match(/\b(foi|foram|é|são|será|serão)\s+\w+d[oa]s?\b/gi) || [];
    if (vozPassiva.length > 5) {
      problemas.push(`Uso frequente de voz passiva (${vozPassiva.length} ocorrências)`);
      sugestoes.push('Prefira voz ativa quando possível');
    }

    // Legibilidade
    const legibilidade = this.calcularLegibilidade(texto);

    return {
      legibilidade,
      problemas,
      sugestoes,
      estatisticas: {
        caracteres: texto.length,
        palavras: texto.split(/\s+/).length,
        paragrafos: paragrafos.length,
        sentencas: sentencas.length
      }
    };
  },

  /**
   * Compara similaridade entre textos
   */
  compararTextos(texto1, texto2) {
    const similaridade = stringSimilarity.compareTwoStrings(texto1, texto2);

    return {
      similaridade: (similaridade * 100).toFixed(2) + '%',
      indice: similaridade,
      interpretacao: similaridade > 0.8 ? 'Muito similar'
        : similaridade > 0.5 ? 'Moderadamente similar'
        : similaridade > 0.2 ? 'Pouco similar'
        : 'Textos diferentes'
    };
  }
};

// ============================================================================
// INDEXADOR E BUSCADOR
// ============================================================================

export const indexador = {
  index: null,

  /**
   * Inicializa índice de busca
   */
  inicializar() {
    this.index = new FlexSearch.Document({
      document: {
        id: 'id',
        index: ['titulo', 'conteudo', 'tipo', 'tags'],
        store: ['titulo', 'tipo', 'data', 'resumo']
      },
      tokenize: 'forward',
      language: 'pt'
    });
  },

  /**
   * Adiciona documento ao índice
   */
  adicionar(documento) {
    if (!this.index) this.inicializar();
    this.index.add(documento);
  },

  /**
   * Busca documentos
   */
  buscar(query, opcoes = {}) {
    if (!this.index) return [];

    const { limite = 10, campo = null } = opcoes;

    const resultados = campo
      ? this.index.search(query, { field: campo, limit: limite })
      : this.index.search(query, { limit: limite });

    return resultados;
  },

  /**
   * Remove documento
   */
  remover(id) {
    if (this.index) {
      this.index.remove(id);
    }
  }
};

// ============================================================================
// FORMATADORES JURÍDICOS
// ============================================================================

export const formatadores = {
  /**
   * Formata CPF
   */
  formatarCPF(cpfNum) {
    const limpo = cpfNum.replace(/\D/g, '');
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  },

  /**
   * Formata CNPJ
   */
  formatarCNPJ(cnpjNum) {
    const limpo = cnpjNum.replace(/\D/g, '');
    return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  },

  /**
   * Formata número de processo CNJ
   */
  formatarProcessoCNJ(numero) {
    const limpo = numero.replace(/\D/g, '');
    if (limpo.length !== 20) return numero;
    return limpo.replace(/(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})/, '$1-$2.$3.$4.$5.$6');
  },

  /**
   * Formata data por extenso
   */
  formatarDataExtenso(data) {
    const dt = DateTime.fromFormat(data, 'dd/MM/yyyy').setLocale('pt-BR');
    return dt.toFormat("d 'de' MMMM 'de' yyyy");
  },

  /**
   * Formata valor por extenso
   */
  formatarValorExtenso(valor) {
    const extenso = require('extenso');
    return extenso(valor, { mode: 'currency' });
  },

  /**
   * Capitaliza nome próprio
   */
  capitalizarNome(nome) {
    const excecoes = ['de', 'da', 'do', 'das', 'dos', 'e'];
    return nome.toLowerCase().split(' ').map((palavra, i) => {
      if (i > 0 && excecoes.includes(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    }).join(' ');
  },

  /**
   * Formata qualificação completa
   */
  formatarQualificacao(dados) {
    const {
      nome,
      nacionalidade = 'brasileiro(a)',
      estadoCivil,
      profissao,
      cpf,
      rg,
      endereco
    } = dados;

    return `${this.capitalizarNome(nome)}, ${nacionalidade}, ${estadoCivil}, ${profissao}, inscrito(a) no CPF sob nº ${this.formatarCPF(cpf)}${rg ? `, RG nº ${rg}` : ''}, residente e domiciliado(a) em ${endereco}`;
  }
};

// ============================================================================
// EXPORTAÇÃO PRINCIPAL
// ============================================================================

export default {
  analisadorNLP,
  validadores,
  calculadoraJudicial,
  analiseQualidade,
  indexador,
  formatadores,
  cache
};
