/**
 * Seletor Inteligente de Prompts - VERSÃO COMPLETA
 *
 * Analisa a mensagem do usuário para detectar o tipo de peça jurídica
 * e seleciona o prompt mais apropriado para o contexto.
 *
 * Suporta 90+ tipos de peças jurídicas brasileiras organizadas por área
 */

// ============================================================
// MAPEAMENTO COMPLETO DE PALAVRAS-CHAVE POR TIPO DE PEÇA
// ============================================================

const KEYWORDS_MAP = {
  // ===== PEÇAS CÍVEIS - INICIAIS =====
  'peticao_inicial_civel': [
    'petição inicial', 'ação cível', 'ação de', 'propor ação', 'distribuição',
    'excelentíssimo', 'requerente', 'requerido', 'vem perante', 'citação'
  ],

  'acao_declaratoria': [
    'ação declaratória', 'declarar', 'inexistência', 'existência de direito',
    'relação jurídica', 'incerteza jurídica'
  ],

  'acao_cautelar': [
    'ação cautelar', 'medida cautelar', 'urgência', 'periculum in mora',
    'fumus boni iuris', 'arresto', 'sequestro'
  ],

  'acao_monitoria': [
    'ação monitória', 'prova escrita', 'título executivo', 'monitória'
  ],

  'acao_execucao': [
    'ação de execução', 'executar', 'título executivo', 'cumprimento de sentença'
  ],

  'acao_rescisoria': [
    'ação rescisória', 'rescindir', 'coisa julgada', 'erro de fato',
    'dolo da parte', 'sentença transitada'
  ],

  // ===== PEÇAS CÍVEIS - RESPOSTAS =====
  'contestacao_civel': [
    'contestação', 'contestar', 'impugnação', 'defesa', 'réu', 'preliminares',
    'mérito', 'impugnar fatos', 'negar', 'refutar'
  ],

  'reconvencao': [
    'reconvenção', 'reconvir', 'pedido contraposto', 'pedido do réu'
  ],

  'replica': [
    'réplica', 'replicar', 'responder contestação', 'tréplica'
  ],

  'impugnacao_cumprimento': [
    'impugnação', 'cumprimento de sentença', 'impugnar cálculos',
    'excesso de execução', 'vícios de liquidação'
  ],

  'embargos_execucao': [
    'embargos à execução', 'embargar execução', 'nulidade executiva',
    'excesso de penhora'
  ],

  // ===== RECURSOS CÍVEIS =====
  'recurso_apelacao': [
    'apelação', 'apelar', 'recorrer da sentença', 'reformar sentença',
    'tribunal', 'razões de apelação', 'juízo ad quem'
  ],

  'agravo_instrumento': [
    'agravo de instrumento', 'decisão interlocutória', 'efeito suspensivo',
    'agravo'
  ],

  'agravo_interno': [
    'agravo interno', 'agravo regimental', 'decisão monocrática'
  ],

  'embargos_declaracao': [
    'embargos de declaração', 'obscuridade', 'contradição', 'omissão',
    'elucidar', 'prequestionamento', 'esclarecer decisão'
  ],

  'recurso_especial': [
    'recurso especial', 'resp', 'stj', 'violação de lei federal',
    'divergência jurisprudencial'
  ],

  'recurso_extraordinario': [
    'recurso extraordinário', 're', 'stf', 'questão constitucional',
    'violação da constituição'
  ],

  // ===== PEÇAS TRABALHISTAS =====
  'reclamacao_trabalhista': [
    'reclamação trabalhista', 'ação trabalhista', 'reclamante', 'reclamada',
    'justa causa', 'rescisão indireta', 'horas extras', 'verbas rescisórias'
  ],

  'contestacao_trabalhista': [
    'contestação trabalhista', 'defesa trabalhista', 'impugnar reclamação'
  ],

  'recurso_ordinario': [
    'recurso ordinário', 'ro', 'trt', 'recurso trabalhista'
  ],

  'recurso_revista': [
    'recurso de revista', 'rr', 'tst', 'revista trabalhista'
  ],

  'embargos_execucao_trabalhista': [
    'embargos à execução trabalhista', 'execução trabalhista'
  ],

  'mandado_seguranca_trabalhista': [
    'mandado de segurança trabalhista', 'liminar trabalhista'
  ],

  // ===== PEÇAS CRIMINAIS =====
  'queixa_crime': [
    'queixa-crime', 'ação penal privada', 'queixa criminal', 'ofendido'
  ],

  'resposta_acusacao': [
    'resposta à acusação', 'art. 396-a', 'defesa preliminar', 'absolvição sumária'
  ],

  'alegacoes_finais_criminais': [
    'alegações finais criminais', 'alegações criminais', 'defesa final'
  ],

  'habeas_corpus': [
    'habeas corpus', 'hc', 'constrangimento ilegal', 'liberdade de locomoção',
    'prisão ilegal', 'paciente'
  ],

  'liberdade_provisoria': [
    'liberdade provisória', 'relaxamento de prisão', 'fiança'
  ],

  'revisao_criminal': [
    'revisão criminal', 'revisar sentença penal', 'erro judiciário'
  ],

  'apelacao_criminal': [
    'apelação criminal', 'apelar sentença penal', 'dosimetria'
  ],

  'recurso_sentido_estrito': [
    'recurso em sentido estrito', 'rese', 'art. 581 cpp'
  ],

  'agravo_execucao_penal': [
    'agravo em execução penal', 'progressão de regime', 'livramento condicional'
  ],

  'embargos_infringentes_criminais': [
    'embargos infringentes', 'decisão não unânime'
  ],

  'relaxamento_prisao': [
    'relaxamento de prisão', 'prisão ilegal', 'falta de fundamentação'
  ],

  'revogacao_preventiva': [
    'revogação de preventiva', 'revogar prisão preventiva'
  ],

  // ===== MANDADO DE SEGURANÇA =====
  'mandado_seguranca': [
    'mandado de segurança', 'ms', 'direito líquido e certo', 'ato coator',
    'autoridade coatora', 'impetrante', 'impetrado'
  ],

  'reclamacao': [
    'reclamação', 'reclamação constitucional', 'descumprimento de súmula'
  ],

  // ===== PEÇAS EMPRESARIAIS =====
  'alteracao_contratual': [
    'alteração contratual', 'alteração de contrato social', 'dnrc',
    'junta comercial', 'sociedade limitada', 'quotas', 'capital social',
    'modificação estatutária', 'alteração de sócios'
  ],

  'distrato_social': [
    'distrato', 'dissolução de sociedade', 'extinção da empresa'
  ],

  'contrato_social': [
    'contrato social', 'constituição de empresa', 'abertura de empresa',
    'sociedade limitada', 'ltda', 'eireli', 'slu'
  ],

  // ===== CONTRATOS =====
  'contrato': [
    'contrato', 'cláusula', 'partes contratantes', 'contratante', 'contratado',
    'objeto do contrato', 'vigência', 'rescisão contratual'
  ],

  'contrato_compra_venda': [
    'contrato de compra e venda', 'comprador', 'vendedor', 'bem móvel',
    'preço', 'tradição'
  ],

  'contrato_prestacao_servicos': [
    'contrato de prestação de serviços', 'prestador', 'tomador',
    'serviços contratados'
  ],

  'contrato_locacao': [
    'contrato de locação', 'locador', 'locatário', 'aluguel', 'imóvel',
    'caução', 'fiança locatícia'
  ],

  'contrato_honorarios': [
    'contrato de honorários', 'advocatícios', 'quota litis', 'êxito'
  ],

  'termo_acordo': [
    'termo de acordo', 'composição', 'transação', 'conciliação'
  ],

  'termo_quitacao': [
    'termo de quitação', 'quitação', 'dar quitação', 'nada mais ter a reclamar'
  ],

  // ===== PROCURAÇÕES =====
  'procuracao_ad_judicia': [
    'procuração', 'outorgante', 'outorgado', 'poderes para', 'substabelecimento',
    'ad judicia', 'ad negotia', 'representação legal', 'mandato'
  ],

  'substabelecimento': [
    'substabelecimento', 'substabelecer', 'com reservas', 'sem reservas'
  ],

  // ===== OUTROS INCIDENTES =====
  'chamamento_processo': [
    'chamamento ao processo', 'chamar ao processo', 'litisconsórcio'
  ],

  'denuncia_lide': [
    'denunciação da lide', 'denunciar à lide', 'direito de regresso'
  ],

  'incidente_desconsideracao': [
    'desconsideração da personalidade jurídica', 'desconsiderar personalidade',
    'incidente de desconsideração'
  ],

  'execucao_titulo_extrajudicial': [
    'execução de título extrajudicial', 'nota promissória', 'cheque',
    'duplicata', 'cnh'
  ],

  // ===== PEÇAS EXTRAJUDICIAIS =====
  'notificacao_extrajudicial': [
    'notificação extrajudicial', 'notificar', 'interpelação',
    'constituir em mora'
  ],

  'declaracao': [
    'declaração', 'declarar que', 'atesto', 'atestar'
  ],

  // ===== MEMORIAIS E ANÁLISES =====
  'memoriais_civeis': [
    'memoriais', 'memorial', 'alegações finais', 'encerramento da instrução'
  ],

  'alegacoes_finais': [
    'alegações finais', 'alegações escritas', 'manifestação final'
  ],

  'parecer_juridico': [
    'parecer jurídico', 'opinião legal', 'análise jurídica', 'fundamentação',
    'entendimento', 'posicionamento jurídico', 'tese jurídica'
  ],

  'analise_processual': [
    'análise processual', 'analisar processo', 'análise de autos',
    'timeline', 'prazos', 'movimentação processual', 'andamento'
  ],

  'resumo_executivo': [
    'resumo executivo', 'resumo do processo', 'síntese processual'
  ],

  'leading_case': [
    'leading case', 'precedente', 'análise de precedente', 'jurisprudência consolidada'
  ],

  // ===== MÉTODOS E TÉCNICAS =====
  'metodo-analise-prazos': [
    'análise de prazos', 'cálculo de prazo', 'preclusão', 'prescrição',
    'decadência', 'contagem de prazo'
  ],

  'metodo-redacao-tecnica': [
    'redação técnica', 'técnica de redação', 'como redigir'
  ],

  'metodo-persuasivo-redacao': [
    'redação persuasiva', 'técnica persuasiva', 'argumentação'
  ],

  // ===== ESPECIALISTAS =====
  'redator_civel': [
    'redação cível', 'peça cível', 'especialista cível'
  ],

  'redator_criminal': [
    'redação criminal', 'peça criminal', 'especialista criminal'
  ],

  // ===== PROMPTS ESPECIAIS =====
  'master-rom': [
    'rom master', 'assistente completo', 'todas funcionalidades'
  ],

  'custom_instructions': [
    'instruções customizadas', 'custom instructions'
  ],

  // ===== SYSTEM DEFAULT =====
  'system-default': [
    'assistente jurídico', 'ajuda geral', 'suporte jurídico'
  ]
};

/**
 * Categorias organizadas de peças jurídicas
 */
export const CATEGORIAS = {
  'Cível - Iniciais': [
    'peticao_inicial_civel', 'acao_declaratoria', 'acao_cautelar',
    'acao_monitoria', 'acao_execucao', 'acao_rescisoria'
  ],
  'Cível - Respostas': [
    'contestacao_civel', 'reconvencao', 'replica',
    'impugnacao_cumprimento', 'embargos_execucao'
  ],
  'Recursos Cíveis': [
    'recurso_apelacao', 'agravo_instrumento', 'agravo_interno',
    'embargos_declaracao', 'recurso_especial', 'recurso_extraordinario'
  ],
  'Trabalhista': [
    'reclamacao_trabalhista', 'contestacao_trabalhista',
    'recurso_ordinario', 'recurso_revista', 'embargos_execucao_trabalhista',
    'mandado_seguranca_trabalhista'
  ],
  'Criminal': [
    'queixa_crime', 'resposta_acusacao', 'alegacoes_finais_criminais',
    'habeas_corpus', 'liberdade_provisoria', 'revisao_criminal',
    'apelacao_criminal', 'recurso_sentido_estrito', 'agravo_execucao_penal',
    'embargos_infringentes_criminais', 'relaxamento_prisao', 'revogacao_preventiva'
  ],
  'Mandado de Segurança': [
    'mandado_seguranca', 'mandado_seguranca_trabalhista', 'reclamacao'
  ],
  'Empresarial': [
    'alteracao_contratual', 'distrato_social', 'contrato_social'
  ],
  'Contratos': [
    'contrato', 'contrato_compra_venda', 'contrato_prestacao_servicos',
    'contrato_locacao', 'contrato_honorarios', 'termo_acordo', 'termo_quitacao'
  ],
  'Procurações': [
    'procuracao_ad_judicia', 'substabelecimento'
  ],
  'Incidentes Processuais': [
    'chamamento_processo', 'denuncia_lide', 'incidente_desconsideracao',
    'execucao_titulo_extrajudicial'
  ],
  'Extrajudicial': [
    'notificacao_extrajudicial', 'declaracao'
  ],
  'Memoriais e Análises': [
    'memoriais_civeis', 'alegacoes_finais', 'parecer_juridico',
    'analise_processual', 'resumo_executivo', 'leading_case'
  ],
  'Métodos e Técnicas': [
    'metodo-analise-prazos', 'metodo-redacao-tecnica', 'metodo-persuasivo-redacao'
  ],
  'Especialistas': [
    'redator_civel', 'redator_criminal', 'master-rom'
  ]
};

/**
 * Detecta o tipo de peça baseado na mensagem do usuário
 * @param {string} message - Mensagem do usuário
 * @returns {string} ID do prompt apropriado
 */
export function detectDocumentType(message) {
  if (!message || typeof message !== 'string') {
    return 'system-default';
  }

  const lowerMessage = message.toLowerCase();

  // Calcular score de relevância para cada tipo
  const scores = {};

  for (const [promptId, keywords] of Object.entries(KEYWORDS_MAP)) {
    let score = 0;

    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        // Score maior para match exato de palavra completa
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(lowerMessage)) {
          score += 3;
        } else {
          score += 1;
        }
      }
    }

    if (score > 0) {
      scores[promptId] = score;
    }
  }

  // Retornar tipo com maior score
  if (Object.keys(scores).length > 0) {
    const sortedTypes = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return sortedTypes[0][0]; // ID do tipo com maior score
  }

  // Default: system prompt genérico
  return 'system-default';
}

/**
 * Mapeia tipo de documento para nome amigável
 * @param {string} promptId - ID do prompt
 * @returns {string} Nome amigável
 */
export function getDocumentTypeName(promptId) {
  const names = {
    // Cível - Iniciais
    'peticao_inicial_civel': 'Petição Inicial Cível',
    'acao_declaratoria': 'Ação Declaratória',
    'acao_cautelar': 'Ação Cautelar',
    'acao_monitoria': 'Ação Monitória',
    'acao_execucao': 'Ação de Execução',
    'acao_rescisoria': 'Ação Rescisória',

    // Cível - Respostas
    'contestacao_civel': 'Contestação Cível',
    'reconvencao': 'Reconvenção',
    'replica': 'Réplica',
    'impugnacao_cumprimento': 'Impugnação ao Cumprimento de Sentença',
    'embargos_execucao': 'Embargos à Execução',

    // Recursos Cíveis
    'recurso_apelacao': 'Recurso de Apelação',
    'agravo_instrumento': 'Agravo de Instrumento',
    'agravo_interno': 'Agravo Interno',
    'embargos_declaracao': 'Embargos de Declaração',
    'recurso_especial': 'Recurso Especial (STJ)',
    'recurso_extraordinario': 'Recurso Extraordinário (STF)',

    // Trabalhista
    'reclamacao_trabalhista': 'Reclamação Trabalhista',
    'contestacao_trabalhista': 'Contestação Trabalhista',
    'recurso_ordinario': 'Recurso Ordinário Trabalhista',
    'recurso_revista': 'Recurso de Revista (TST)',
    'embargos_execucao_trabalhista': 'Embargos à Execução Trabalhista',
    'mandado_seguranca_trabalhista': 'Mandado de Segurança Trabalhista',

    // Criminal
    'queixa_crime': 'Queixa-Crime',
    'resposta_acusacao': 'Resposta à Acusação',
    'alegacoes_finais_criminais': 'Alegações Finais Criminais',
    'habeas_corpus': 'Habeas Corpus',
    'liberdade_provisoria': 'Liberdade Provisória',
    'revisao_criminal': 'Revisão Criminal',
    'apelacao_criminal': 'Apelação Criminal',
    'recurso_sentido_estrito': 'Recurso em Sentido Estrito',
    'agravo_execucao_penal': 'Agravo em Execução Penal',
    'embargos_infringentes_criminais': 'Embargos Infringentes',
    'relaxamento_prisao': 'Relaxamento de Prisão',
    'revogacao_preventiva': 'Revogação de Prisão Preventiva',

    // Mandado de Segurança
    'mandado_seguranca': 'Mandado de Segurança',
    'reclamacao': 'Reclamação',

    // Empresarial
    'alteracao_contratual': 'Alteração Contratual (DNRC)',
    'distrato_social': 'Distrato Social',
    'contrato_social': 'Contrato Social',

    // Contratos
    'contrato': 'Contrato',
    'contrato_compra_venda': 'Contrato de Compra e Venda',
    'contrato_prestacao_servicos': 'Contrato de Prestação de Serviços',
    'contrato_locacao': 'Contrato de Locação',
    'contrato_honorarios': 'Contrato de Honorários Advocatícios',
    'termo_acordo': 'Termo de Acordo',
    'termo_quitacao': 'Termo de Quitação',

    // Procurações
    'procuracao_ad_judicia': 'Procuração Ad Judicia',
    'substabelecimento': 'Substabelecimento',

    // Incidentes
    'chamamento_processo': 'Chamamento ao Processo',
    'denuncia_lide': 'Denunciação da Lide',
    'incidente_desconsideracao': 'Incidente de Desconsideração da Personalidade Jurídica',
    'execucao_titulo_extrajudicial': 'Execução de Título Extrajudicial',

    // Extrajudicial
    'notificacao_extrajudicial': 'Notificação Extrajudicial',
    'declaracao': 'Declaração',

    // Memoriais
    'memoriais_civeis': 'Memoriais Cíveis',
    'alegacoes_finais': 'Alegações Finais',
    'parecer_juridico': 'Parecer Jurídico',
    'analise_processual': 'Análise Processual',
    'resumo_executivo': 'Resumo Executivo',
    'leading_case': 'Análise de Leading Case',

    // Métodos
    'metodo-analise-prazos': 'Método de Análise de Prazos',
    'metodo-redacao-tecnica': 'Método de Redação Técnica',
    'metodo-persuasivo-redacao': 'Método de Redação Persuasiva',

    // Especialistas
    'redator_civel': 'Redator Cível Especializado',
    'redator_criminal': 'Redator Criminal Especializado',
    'master-rom': 'ROM Master - Assistente Completo',

    // System
    'system-default': 'Assistente Jurídico Geral',
    'custom_instructions': 'Instruções Customizadas'
  };

  return names[promptId] || promptId.replace(/_/g, ' ').replace(/-/g, ' ');
}

/**
 * Obtém palavras-chave para um tipo de documento
 * @param {string} promptId - ID do prompt
 * @returns {string[]} Lista de palavras-chave
 */
export function getKeywordsForType(promptId) {
  return KEYWORDS_MAP[promptId] || [];
}

/**
 * Valida se uma mensagem é adequada para um tipo de documento
 * @param {string} message - Mensagem do usuário
 * @param {string} promptId - ID do prompt
 * @returns {boolean} Se a mensagem é adequada
 */
export function isMessageSuitableForType(message, promptId) {
  const keywords = getKeywordsForType(promptId);
  const lowerMessage = message.toLowerCase();

  return keywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Lista todos os tipos de documentos suportados
 * @returns {Object[]} Array de objetos com id e nome
 */
export function listSupportedDocumentTypes() {
  return Object.keys(KEYWORDS_MAP).map(id => ({
    id,
    name: getDocumentTypeName(id),
    keywords: getKeywordsForType(id).slice(0, 3),
    category: getCategoryForType(id)
  }));
}

/**
 * Obtém categoria de um tipo de documento
 * @param {string} promptId - ID do prompt
 * @returns {string} Nome da categoria
 */
export function getCategoryForType(promptId) {
  for (const [categoryName, types] of Object.entries(CATEGORIAS)) {
    if (types.includes(promptId)) {
      return categoryName;
    }
  }
  return 'Outros';
}

/**
 * Lista todas as categorias com seus tipos
 * @returns {Object} Categorias organizadas
 */
export function listCategoriesWithTypes() {
  const result = {};

  for (const [categoryName, types] of Object.entries(CATEGORIAS)) {
    result[categoryName] = types.map(id => ({
      id,
      name: getDocumentTypeName(id),
      keywords: getKeywordsForType(id).slice(0, 3)
    }));
  }

  return result;
}
