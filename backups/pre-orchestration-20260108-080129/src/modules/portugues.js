/**
 * ROM Agent - Módulo de Português e Correção
 * Correção ortográfica, gramatical, concordância e estilo jurídico
 */

// Dicionário de termos jurídicos
const DICIONARIO_JURIDICO = {
  // Latinismos
  'ab initio': 'desde o início',
  'ab ovo': 'desde o ovo, desde a origem',
  'ad hoc': 'para este caso específico',
  'ad judicia': 'para o foro, para processos judiciais',
  'ad quem': 'para o qual (tribunal de destino)',
  'a quo': 'do qual (tribunal de origem)',
  'animus necandi': 'intenção de matar',
  'caput': 'cabeça do artigo',
  'corpus delicti': 'corpo de delito',
  'data venia': 'com a devida permissão',
  'de cujus': 'falecido, de cuja sucessão se trata',
  'erga omnes': 'contra todos, efeito geral',
  'ex nunc': 'a partir de agora, sem retroatividade',
  'ex officio': 'de ofício, por iniciativa própria',
  'ex tunc': 'desde então, com efeito retroativo',
  'fumus boni iuris': 'fumaça do bom direito, aparência de direito',
  'habeas corpus': 'que tenhas o corpo',
  'habeas data': 'que tenhas os dados',
  'in casu': 'no caso',
  'in dubio pro reo': 'na dúvida, em favor do réu',
  'in fine': 'no final',
  'in limine': 'no limiar, preliminarmente',
  'inter partes': 'entre as partes',
  'inaudita altera parte': 'sem ouvir a outra parte',
  'ipsis litteris': 'pelas mesmas letras, literalmente',
  'jus postulandi': 'direito de postular',
  'lato sensu': 'em sentido amplo',
  'lex posterior derogat priori': 'lei posterior revoga a anterior',
  'lis pendens': 'litispendência',
  'mandamus': 'mandamos',
  'modus operandi': 'modo de operar',
  'mutatis mutandis': 'mudando o que deve ser mudado',
  'non bis in idem': 'não duas vezes pelo mesmo fato',
  'nulla poena sine lege': 'não há pena sem lei',
  'pari passu': 'em igualdade de condições',
  'periculum in mora': 'perigo na demora',
  'prima facie': 'à primeira vista',
  'pro rata': 'proporcionalmente',
  'quantum': 'quanto, valor',
  'reformatio in pejus': 'reforma para pior',
  'res judicata': 'coisa julgada',
  'sine qua non': 'sem a qual não',
  'stricto sensu': 'em sentido estrito',
  'sub judice': 'sob julgamento',
  'sui generis': 'de seu próprio gênero, único',
  'ultra petita': 'além do pedido'
};

// Expressões jurídicas formais
const EXPRESSOES_FORMAIS = {
  // Início de peças
  'vem respeitosamente': 'fórmula de apresentação',
  'vem perante': 'fórmula de endereçamento',
  'expor e requerer': 'fórmula de petição',

  // Conectivos jurídicos
  'destarte': 'assim sendo',
  'dessarte': 'dessa forma',
  'outrossim': 'além disso',
  'mormente': 'principalmente',
  'sobretudo': 'especialmente',
  'porquanto': 'porque, visto que',
  'conquanto': 'embora, ainda que',
  'inobstante': 'não obstante',
  'nada obstante': 'apesar de',

  // Fechamentos
  'termos em que': 'fórmula de fechamento',
  'pede deferimento': 'fórmula final'
};

// Regras de concordância verbal comuns em textos jurídicos
const CONCORDANCIA_VERBAL = {
  'a maioria': 'verbo no singular ou plural',
  'grande parte': 'verbo no singular ou plural',
  'mais de um': 'verbo no singular',
  'cada um': 'verbo no singular',
  'qualquer um': 'verbo no singular',
  'nenhum dos': 'verbo no singular',
  'algum dos': 'verbo no singular',
  'um e outro': 'verbo no singular ou plural',
  'nem um nem outro': 'verbo no singular',
  'um ou outro': 'verbo no singular'
};

// Erros comuns em textos jurídicos
const ERROS_COMUNS = {
  'a nível de': 'em nível de / no âmbito de',
  'face a': 'em face de / ante / diante de',
  'onde': 'em que (quando não indica lugar)',
  'sendo que': 'evitar; usar: e, mas, porém',
  'o mesmo': 'evitar como pronome; usar: ele, este',
  'através de': 'por meio de / por intermédio de',
  'junto a': 'junto de / ao lado de',
  'enquanto que': 'enquanto (sem o "que")',
  'em sendo': 'sendo / se for',
  'há anos atrás': 'há anos / anos atrás',
  'anexo segue': 'segue anexo / anexo, segue',
  'fazer referência a': 'referir-se a / mencionar',
  'de vez que': 'uma vez que / já que / visto que'
};

// Pontuação em textos jurídicos
const REGRAS_PONTUACAO = {
  virgula_antes_e: 'Não usar vírgula antes de "e" em enumerações simples',
  virgula_vocativo: 'Sempre isolar vocativos com vírgulas',
  virgula_aposto: 'Sempre isolar apostos explicativos com vírgulas',
  ponto_e_virgula: 'Usar para separar itens em enumerações complexas',
  dois_pontos: 'Usar antes de citações, explicações e enumerações',
  ponto_final: 'Evitar pontos finais em títulos e rubricas'
};

/**
 * Verificar ortografia (placeholder para integração com hunspell)
 */
export async function verificarOrtografia(texto) {
  // Lista de palavras para verificar
  const palavras = texto.match(/[a-záàâãéèêíïóôõöúüçñ]+/gi) || [];
  const erros = [];

  // Aqui seria integrado com hunspell ou LanguageTool
  // Por enquanto, retorna estrutura para integração

  return {
    texto,
    totalPalavras: palavras.length,
    errosEncontrados: erros,
    instrucao: 'Integrar com LanguageTool API para verificação completa'
  };
}

/**
 * Verificar gramática e concordância
 */
export async function verificarGramatica(texto) {
  const problemas = [];

  // Verificar erros comuns
  for (const [erro, correcao] of Object.entries(ERROS_COMUNS)) {
    const regex = new RegExp(erro, 'gi');
    const matches = texto.match(regex);
    if (matches) {
      problemas.push({
        tipo: 'erro_comum',
        encontrado: erro,
        sugestao: correcao,
        ocorrencias: matches.length
      });
    }
  }

  return {
    texto: texto.substring(0, 100) + '...',
    problemasEncontrados: problemas.length,
    problemas,
    instrucao: 'Revise os problemas encontrados'
  };
}

/**
 * Sugerir sinônimos jurídicos
 */
export function sugerirSinonimos(termo) {
  const sinonimos = {
    'autor': ['requerente', 'demandante', 'postulante', 'suplicante'],
    'réu': ['requerido', 'demandado', 'suplicado'],
    'juiz': ['magistrado', 'julgador', 'togado'],
    'sentença': ['decisum', 'decisão', 'provimento'],
    'recurso': ['apelo', 'irresignação', 'inconformismo'],
    'pedido': ['pretensão', 'requerimento', 'postulação'],
    'prova': ['elemento probatório', 'evidência', 'comprovação'],
    'crime': ['delito', 'ilícito penal', 'infração penal'],
    'contrato': ['negócio jurídico', 'avença', 'pacto'],
    'dano': ['prejuízo', 'lesão', 'gravame'],
    'culpa': ['negligência', 'imprudência', 'imperícia'],
    'dolo': ['intenção', 'vontade consciente', 'desígnio'],
    'portanto': ['destarte', 'assim', 'dessa forma', 'por conseguinte'],
    'entretanto': ['todavia', 'contudo', 'não obstante', 'porém'],
    'porque': ['porquanto', 'visto que', 'uma vez que', 'dado que'],
    'embora': ['conquanto', 'ainda que', 'mesmo que', 'não obstante']
  };

  const termoLower = termo.toLowerCase();

  if (sinonimos[termoLower]) {
    return {
      termo,
      sinonimos: sinonimos[termoLower]
    };
  }

  return {
    termo,
    sinonimos: [],
    mensagem: 'Termo não encontrado no dicionário de sinônimos jurídicos'
  };
}

/**
 * Consultar dicionário jurídico
 */
export function consultarDicionario(termo) {
  const termoLower = termo.toLowerCase();

  // Buscar em latinismos
  if (DICIONARIO_JURIDICO[termoLower]) {
    return {
      termo,
      tipo: 'latinismo',
      significado: DICIONARIO_JURIDICO[termoLower]
    };
  }

  // Buscar em expressões formais
  if (EXPRESSOES_FORMAIS[termoLower]) {
    return {
      termo,
      tipo: 'expressao_formal',
      significado: EXPRESSOES_FORMAIS[termoLower]
    };
  }

  return {
    termo,
    encontrado: false,
    mensagem: 'Termo não encontrado no dicionário jurídico interno'
  };
}

/**
 * Formatar texto jurídico
 */
export function formatarTextoJuridico(texto, options = {}) {
  let textoFormatado = texto;

  // Capitalizar início de frases
  textoFormatado = textoFormatado.replace(/(?:^|[.!?]\s+)([a-z])/g, (match, letra) => {
    return match.slice(0, -1) + letra.toUpperCase();
  });

  // Normalizar espaços
  textoFormatado = textoFormatado.replace(/\s+/g, ' ');

  // Remover espaços antes de pontuação
  textoFormatado = textoFormatado.replace(/\s+([.,;:!?])/g, '$1');

  // Adicionar espaço após pontuação
  textoFormatado = textoFormatado.replace(/([.,;:!?])([A-Za-záàâãéèêíïóôõöúçñ])/g, '$1 $2');

  // Normalizar aspas
  textoFormatado = textoFormatado.replace(/[""]/g, '"');

  return {
    original: texto.substring(0, 50) + '...',
    formatado: textoFormatado,
    alteracoes: texto !== textoFormatado
  };
}

/**
 * Analisar estilo do texto
 */
export function analisarEstilo(texto) {
  const palavras = texto.split(/\s+/);
  const frases = texto.split(/[.!?]+/);
  const paragrafos = texto.split(/\n\n+/);

  // Métricas
  const mediaPalavrasPorFrase = palavras.length / frases.length;
  const mediaCaracteresPorPalavra = texto.replace(/\s/g, '').length / palavras.length;

  // Análise de formalidade
  let termosFormais = 0;
  for (const termo of Object.keys(DICIONARIO_JURIDICO)) {
    if (texto.toLowerCase().includes(termo)) {
      termosFormais++;
    }
  }
  for (const termo of Object.keys(EXPRESSOES_FORMAIS)) {
    if (texto.toLowerCase().includes(termo)) {
      termosFormais++;
    }
  }

  return {
    estatisticas: {
      totalPalavras: palavras.length,
      totalFrases: frases.length,
      totalParagrafos: paragrafos.length,
      mediaPalavrasPorFrase: Math.round(mediaPalavrasPorFrase),
      mediaCaracteresPorPalavra: Math.round(mediaCaracteresPorPalavra * 10) / 10
    },
    formalidade: {
      termosJuridicosEncontrados: termosFormais,
      nivel: termosFormais > 10 ? 'alto' : termosFormais > 5 ? 'medio' : 'baixo'
    },
    recomendacoes: mediaPalavrasPorFrase > 30 ?
      ['Considere dividir frases muito longas para melhor clareza'] : []
  };
}

/**
 * Verificar citações e referências
 */
export function verificarCitacoes(texto) {
  const citacoes = [];

  // Padrões de citação
  const padroes = {
    artigo: /Art\.\s*\d+/gi,
    paragraf: /§\s*\d+/gi,
    inciso: /inciso\s+[IVXLCDM]+/gi,
    alinea: /alínea\s+["']?[a-z]["']?/gi,
    lei: /Lei\s+(?:n[°º.]?\s*)?\d+[./]\d+/gi,
    decreto: /Decreto\s+(?:n[°º.]?\s*)?\d+[./]?\d*/gi,
    sumula: /Súmula\s+(?:Vinculante\s+)?\d+/gi,
    jurisprudencia: /\(.*?(?:STF|STJ|TST|TRF|TJ|TRT).*?\)/gi
  };

  for (const [tipo, padrao] of Object.entries(padroes)) {
    const matches = texto.match(padrao) || [];
    for (const match of matches) {
      citacoes.push({ tipo, citacao: match });
    }
  }

  return {
    totalCitacoes: citacoes.length,
    citacoes: citacoes.slice(0, 50), // Limitar a 50
    porTipo: citacoes.reduce((acc, c) => {
      acc[c.tipo] = (acc[c.tipo] || 0) + 1;
      return acc;
    }, {})
  };
}

export default {
  verificarOrtografia,
  verificarGramatica,
  sugerirSinonimos,
  consultarDicionario,
  formatarTextoJuridico,
  analisarEstilo,
  verificarCitacoes,
  DICIONARIO_JURIDICO,
  EXPRESSOES_FORMAIS,
  ERROS_COMUNS,
  CONCORDANCIA_VERBAL,
  REGRAS_PONTUACAO
};
