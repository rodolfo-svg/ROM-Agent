/**
 * ROM Agent - Extrator de Entidades Jurídicas
 *
 * Extrai e estrutura entidades relevantes de documentos jurídicos:
 * - Partes processuais (pessoas físicas e jurídicas)
 * - Valores monetários
 * - Datas e prazos
 * - Números de processo (formato CNJ)
 * - CPF, CNPJ, OAB
 * - Citações legais (leis, artigos, parágrafos)
 * - Órgãos judiciais
 *
 * @version 2.0
 */

/**
 * Extrair números de processo no formato CNJ
 */
export function extrairNumerosProcesso(texto) {
  const regex = /(\d{7})[-\s]*(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})/g;
  const matches = [];
  let match;

  while ((match = regex.exec(texto)) !== null) {
    const numeroFormatado = `${match[1]}-${match[2]}.${match[3]}.${match[4]}.${match[5]}.${match[6]}`;
    matches.push({
      numero: numeroFormatado,
      numeroLimpo: match[0].replace(/[^\d]/g, ''),
      segmento: match[4],
      tribunal: match[5],
      ano: match[3],
      posicao: match.index,
      contexto: extrairContexto(texto, match.index, 80)
    });
  }

  return [...new Map(matches.map(m => [m.numero, m])).values()];
}

/**
 * Extrair CPFs
 */
export function extrairCPFs(texto) {
  const regex = /(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/g;
  const matches = [];
  let match;

  while ((match = regex.exec(texto)) !== null) {
    matches.push({
      cpf: match[0],
      cpfLimpo: match[0].replace(/[^\d]/g, ''),
      posicao: match.index,
      contexto: extrairContexto(texto, match.index, 60)
    });
  }

  return [...new Map(matches.map(m => [m.cpf, m])).values()];
}

/**
 * Extrair CNPJs
 */
export function extrairCNPJs(texto) {
  const regex = /(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})-(\d{2})/g;
  const matches = [];
  let match;

  while ((match = regex.exec(texto)) !== null) {
    matches.push({
      cnpj: match[0],
      cnpjLimpo: match[0].replace(/[^\d]/g, ''),
      posicao: match.index,
      contexto: extrairContexto(texto, match.index, 60)
    });
  }

  return [...new Map(matches.map(m => [m.cnpj, m])).values()];
}

/**
 * Extrair números de OAB
 */
export function extrairOABs(texto) {
  const regex = /OAB\s*[\/\-]?\s*([A-Z]{2})\s*[:\-]?\s*(\d+)/gi;
  const matches = [];
  let match;

  while ((match = regex.exec(texto)) !== null) {
    matches.push({
      oab: `OAB/${match[1].toUpperCase()} ${match[2]}`,
      uf: match[1].toUpperCase(),
      numero: match[2],
      posicao: match.index,
      contexto: extrairContexto(texto, match.index, 80)
    });
  }

  return [...new Map(matches.map(m => [m.oab, m])).values()];
}

/**
 * Extrair valores monetários
 */
export function extrairValoresMonetarios(texto) {
  // Múltiplos padrões para capturar diferentes formatos
  const patterns = [
    /R\$\s*([\d.]+,\d{2})/g,
    /R\$\s*([\d.]+)/g,
    /([\d.]+,\d{2})\s*reais/gi,
    /(?:valor|quantia|montante|soma)\s+de\s+R\$\s*([\d.]+(?:,\d{2})?)/gi
  ];

  const matches = [];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(texto)) !== null) {
      const valorStr = match[1] || match[0].replace(/R\$\s*/, '');
      const valorNumerico = parseValorMonetario(valorStr);

      if (valorNumerico > 0) {
        matches.push({
          valorFormatado: `R$ ${formatarValor(valorNumerico)}`,
          valorNumerico: valorNumerico,
          valorOriginal: match[0],
          posicao: match.index,
          contexto: extrairContexto(texto, match.index, 100)
        });
      }
    }
  }

  // Remover duplicatas próximas e ordenar por valor
  return [...new Map(matches.map(m => [m.valorNumerico, m])).values()]
    .sort((a, b) => b.valorNumerico - a.valorNumerico);
}

/**
 * Extrair datas
 */
export function extrairDatas(texto) {
  const regex = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g;
  const matches = [];
  let match;

  while ((match = regex.exec(texto)) !== null) {
    const dia = match[1].padStart(2, '0');
    const mes = match[2].padStart(2, '0');
    let ano = match[3];

    // Converter ano de 2 dígitos
    if (ano.length === 2) {
      ano = parseInt(ano) > 50 ? `19${ano}` : `20${ano}`;
    }

    // Validar data
    if (validarData(dia, mes, ano)) {
      matches.push({
        dataFormatada: `${dia}/${mes}/${ano}`,
        dataISO: `${ano}-${mes}-${dia}`,
        dia: parseInt(dia),
        mes: parseInt(mes),
        ano: parseInt(ano),
        dataOriginal: match[0],
        posicao: match.index,
        contexto: extrairContexto(texto, match.index, 80)
      });
    }
  }

  // Remover duplicatas e ordenar cronologicamente
  return [...new Map(matches.map(m => [m.dataISO, m])).values()]
    .sort((a, b) => new Date(a.dataISO) - new Date(b.dataISO));
}

/**
 * Extrair citações legais (leis, artigos, parágrafos)
 */
export function extrairCitacoesLegais(texto) {
  const citacoes = {
    leis: [],
    artigos: [],
    paragrafos: [],
    incisos: []
  };

  // Leis
  const regexLeis = /Lei\s+(?:n[º°]?\s*)?(\d+\.?\d*)[\/\-](\d{2,4})/gi;
  let match;
  while ((match = regexLeis.exec(texto)) !== null) {
    citacoes.leis.push({
      lei: `Lei ${match[1]}/${match[2]}`,
      numero: match[1],
      ano: match[2],
      contexto: extrairContexto(texto, match.index, 100)
    });
  }

  // Artigos
  const regexArtigos = /Art(?:igo)?\.?\s*(\d+)[º°]?(?:[-\s]*([A-Z]))?/gi;
  while ((match = regexArtigos.exec(texto)) !== null) {
    citacoes.artigos.push({
      artigo: `Art. ${match[1]}${match[2] ? `-${match[2]}` : ''}`,
      numero: match[1],
      letra: match[2] || null,
      contexto: extrairContexto(texto, match.index, 80)
    });
  }

  // Parágrafos
  const regexParagrafos = /§\s*(\d+)[º°]?/g;
  while ((match = regexParagrafos.exec(texto)) !== null) {
    citacoes.paragrafos.push({
      paragrafo: `§${match[1]}º`,
      numero: match[1],
      contexto: extrairContexto(texto, match.index, 60)
    });
  }

  // Incisos
  const regexIncisos = /\b([IVX]+)\s*[-–]\s*/g;
  while ((match = regexIncisos.exec(texto)) !== null) {
    if (match[1].length <= 5 && /^[IVX]+$/.test(match[1])) {
      citacoes.incisos.push({
        inciso: match[1],
        contexto: extrairContexto(texto, match.index, 60)
      });
    }
  }

  // Remover duplicatas
  citacoes.leis = [...new Map(citacoes.leis.map(l => [l.lei, l])).values()];
  citacoes.artigos = [...new Map(citacoes.artigos.map(a => [a.artigo, a])).values()];
  citacoes.paragrafos = [...new Map(citacoes.paragrafos.map(p => [p.paragrafo, p])).values()];
  citacoes.incisos = [...new Map(citacoes.incisos.map(i => [i.inciso, i])).values()];

  return citacoes;
}

/**
 * Extrair órgãos judiciais
 */
export function extrairOrgaosJudiciais(texto) {
  const padroes = [
    // Varas
    /(\d+[ªº]?\s+(?:Vara|UPJ|Juizado)[^\.]{0,80}(?:de|da)\s+[^\.]{0,50})/gi,

    // Tribunais
    /(Tribunal\s+(?:de\s+)?Justiça\s+(?:do|de|da)\s+[^\.]{0,40})/gi,
    /(TJ[A-Z]{2})/g,
    /(TRF\d)/g,
    /(STJ|STF|TST|TSE)/g,

    // Comarcas
    /Comarca\s+de\s+([^\/\n]{3,40})/gi
  ];

  const orgaos = [];

  for (const regex of padroes) {
    let match;
    while ((match = regex.exec(texto)) !== null) {
      orgaos.push({
        nome: match[0].trim(),
        tipo: identificarTipoOrgao(match[0]),
        posicao: match.index,
        contexto: extrairContexto(texto, match.index, 100)
      });
    }
  }

  return [...new Map(orgaos.map(o => [o.nome.toLowerCase(), o])).values()];
}

/**
 * Identificar partes processuais (autor/réu)
 */
export function identificarPartesProcessuais(texto) {
  const partes = {
    poloAtivo: [],
    poloPassivo: []
  };

  // Padrões para identificar partes
  const padraoAutor = /(?:autor|requerente|exequente|impetrante)[:\s]*([^,\n]{5,80})/gi;
  const padraoReu = /(?:r[ée]u?s?|requerido|executado|impetrado)[:\s]*([^,\n]{5,80})/gi;

  let match;

  // Polo ativo
  while ((match = padraoAutor.exec(texto)) !== null) {
    const nome = match[1].trim();
    if (nome.length > 5 && nome.length < 100) {
      partes.poloAtivo.push({
        nome: nome,
        papel: match[0].split(/[:\s]/)[0].toLowerCase(),
        contexto: extrairContexto(texto, match.index, 120)
      });
    }
  }

  // Polo passivo
  while ((match = padraoReu.exec(texto)) !== null) {
    const nome = match[1].trim();
    if (nome.length > 5 && nome.length < 100) {
      partes.poloPassivo.push({
        nome: nome,
        papel: match[0].split(/[:\s]/)[0].toLowerCase(),
        contexto: extrairContexto(texto, match.index, 120)
      });
    }
  }

  // Remover duplicatas
  partes.poloAtivo = [...new Map(partes.poloAtivo.map(p => [p.nome.toLowerCase(), p])).values()];
  partes.poloPassivo = [...new Map(partes.poloPassivo.map(p => [p.nome.toLowerCase(), p])).values()];

  return partes;
}

/**
 * Extrair todas as entidades do texto
 */
export function extrairTodasEntidades(texto) {
  return {
    processosJudiciais: extrairNumerosProcesso(texto),
    cpfs: extrairCPFs(texto),
    cnpjs: extrairCNPJs(texto),
    oabs: extrairOABs(texto),
    valoresMonetarios: extrairValoresMonetarios(texto),
    datas: extrairDatas(texto),
    citacoesLegais: extrairCitacoesLegais(texto),
    orgaosJudiciais: extrairOrgaosJudiciais(texto),
    partesProcessuais: identificarPartesProcessuais(texto),

    // Estatísticas
    estatisticas: {
      totalProcessos: 0,
      totalCPFs: 0,
      totalCNPJs: 0,
      totalOABs: 0,
      totalValores: 0,
      totalDatas: 0,
      totalLeis: 0,
      totalArtigos: 0,
      totalOrgaos: 0,
      maiorValor: null,
      menorValor: null,
      dataMinima: null,
      dataMaxima: null
    }
  };
}

// Funções auxiliares

function extrairContexto(texto, posicao, tamanho = 80) {
  const inicio = Math.max(0, posicao - tamanho / 2);
  const fim = Math.min(texto.length, posicao + tamanho / 2);
  let contexto = texto.substring(inicio, fim).trim();

  if (inicio > 0) contexto = '...' + contexto;
  if (fim < texto.length) contexto = contexto + '...';

  return contexto;
}

function parseValorMonetario(valorStr) {
  // Remove tudo exceto dígitos, vírgula e ponto
  let valor = valorStr.replace(/[^\d,\.]/g, '');

  // Detectar formato (1.000,00 ou 1,000.00)
  const ultimaVirgula = valor.lastIndexOf(',');
  const ultimoPonto = valor.lastIndexOf('.');

  if (ultimaVirgula > ultimoPonto) {
    // Formato brasileiro: 1.000.000,00
    valor = valor.replace(/\./g, '').replace(',', '.');
  } else {
    // Formato americano: 1,000,000.00
    valor = valor.replace(/,/g, '');
  }

  return parseFloat(valor) || 0;
}

function formatarValor(valor) {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function validarData(dia, mes, ano) {
  const d = parseInt(dia);
  const m = parseInt(mes);
  const a = parseInt(ano);

  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  if (a < 1900 || a > 2100) return false;

  // Validação básica de dias por mês
  const diasPorMes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Ano bissexto
  if ((a % 4 === 0 && a % 100 !== 0) || a % 400 === 0) {
    diasPorMes[1] = 29;
  }

  return d <= diasPorMes[m - 1];
}

function identificarTipoOrgao(nome) {
  const nomeUpper = nome.toUpperCase();

  if (nomeUpper.includes('VARA') || nomeUpper.includes('UPJ') || nomeUpper.includes('JUIZADO')) {
    return 'vara';
  }
  if (nomeUpper.includes('TRIBUNAL')) {
    return 'tribunal';
  }
  if (nomeUpper.match(/^(STJ|STF|TST|TSE)$/)) {
    return 'tribunal_superior';
  }
  if (nomeUpper.match(/^TJ[A-Z]{2}$/)) {
    return 'tribunal_justica_estadual';
  }
  if (nomeUpper.match(/^TRF\d$/)) {
    return 'tribunal_regional_federal';
  }
  if (nomeUpper.includes('COMARCA')) {
    return 'comarca';
  }

  return 'outros';
}

/**
 * Calcular estatísticas das entidades extraídas
 */
export function calcularEstatisticas(entidades) {
  const stats = {
    totalProcessos: entidades.processosJudiciais.length,
    totalCPFs: entidades.cpfs.length,
    totalCNPJs: entidades.cnpjs.length,
    totalOABs: entidades.oabs.length,
    totalValores: entidades.valoresMonetarios.length,
    totalDatas: entidades.datas.length,
    totalLeis: entidades.citacoesLegais.leis.length,
    totalArtigos: entidades.citacoesLegais.artigos.length,
    totalParagrafos: entidades.citacoesLegais.paragrafos.length,
    totalIncisos: entidades.citacoesLegais.incisos.length,
    totalOrgaos: entidades.orgaosJudiciais.length,
    totalPartePoloAtivo: entidades.partesProcessuais.poloAtivo.length,
    totalPartePoloPassivo: entidades.partesProcessuais.poloPassivo.length
  };

  // Maior e menor valor
  if (entidades.valoresMonetarios.length > 0) {
    stats.maiorValor = entidades.valoresMonetarios[0].valorFormatado;
    stats.menorValor = entidades.valoresMonetarios[entidades.valoresMonetarios.length - 1].valorFormatado;
  }

  // Data mínima e máxima
  if (entidades.datas.length > 0) {
    stats.dataMinima = entidades.datas[0].dataFormatada;
    stats.dataMaxima = entidades.datas[entidades.datas.length - 1].dataFormatada;
  }

  stats.totalEntidades = Object.values(stats).reduce((acc, val) => {
    return acc + (typeof val === 'number' ? val : 0);
  }, 0);

  return stats;
}

export default {
  extrairNumerosProcesso,
  extrairCPFs,
  extrairCNPJs,
  extrairOABs,
  extrairValoresMonetarios,
  extrairDatas,
  extrairCitacoesLegais,
  extrairOrgaosJudiciais,
  identificarPartesProcessuais,
  extrairTodasEntidades,
  calcularEstatisticas
};
