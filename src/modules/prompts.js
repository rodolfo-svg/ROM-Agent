/**
 * ROM Agent - Módulo de Prompts Jurídicos
 * Todos os tipos de peças processuais e extraprocessuais
 */

// ============================================================
// PEÇAS PROCESSUAIS CÍVEIS
// ============================================================
export const PECAS_CIVEIS = {
  peticao_inicial: {
    nome: 'Petição Inicial',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO',
      'QUALIFICAÇÃO DAS PARTES',
      'I. DOS FATOS',
      'II. DO DIREITO',
      'III. DOS PEDIDOS',
      'IV. DO VALOR DA CAUSA',
      'V. DAS PROVAS',
      'FECHAMENTO'
    ],
    instrucoes: `
PETIÇÃO INICIAL - ESTRUTURA COMPLETA

1. ENDEREÇAMENTO
- EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA ___ VARA [CÍVEL/FAMÍLIA/FAZENDA] DA COMARCA DE ___.
- Caixa alta, negrito, justificado

2. QUALIFICAÇÃO DAS PARTES
- Nome em CAIXA ALTA NEGRITO
- Nacionalidade, estado civil, profissão, RG, CPF
- Endereço completo para citação
- E-mail e telefone

3. DOS FATOS
- Narrativa cronológica e detalhada
- Datas, locais, valores específicos
- Documentos comprobatórios referenciados

4. DO DIREITO
- Fundamentação legal completa
- Jurisprudência atualizada (verificar via web_search)
- Doutrina quando aplicável
- Subsunção dos fatos às normas

5. DOS PEDIDOS
- PRINCIPAL: em negrito
- Pedidos específicos em alíneas a), b), c)
- Pedidos subsidiários se aplicável
- Tutela de urgência se cabível
- Justiça gratuita se aplicável
- Citação do réu
- Condenação em honorários e custas

6. VALOR DA CAUSA
- Conforme art. 292 do CPC
- Justificar o cálculo

7. PROVAS
- Documental (listar docs anexos)
- Testemunhal (se necessário)
- Pericial (se necessário)
- Depoimento pessoal

EXTENSÃO: 10-35 páginas
`
  },

  contestacao: {
    nome: 'Contestação',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'QUALIFICAÇÃO DO CONTESTANTE',
      'I. SÍNTESE DA INICIAL',
      'II. PRELIMINARES',
      'III. PREJUDICIAIS DE MÉRITO',
      'IV. DO MÉRITO',
      'V. DOS PEDIDOS',
      'FECHAMENTO'
    ],
    instrucoes: `
CONTESTAÇÃO - ESTRUTURA COMPLETA

1. PRELIMINARES (art. 337 CPC)
- Inexistência ou nulidade da citação
- Incompetência absoluta e relativa
- Incorreção do valor da causa
- Inépcia da inicial
- Perempção, litispendência, coisa julgada
- Conexão, continência
- Incapacidade da parte, defeito de representação
- Convenção de arbitragem
- Ausência de legitimidade
- Falta de interesse processual
- Falta de caução
- Indevida concessão de justiça gratuita

2. PREJUDICIAIS DE MÉRITO
- Prescrição
- Decadência
- Outras

3. MÉRITO
- Impugnação específica de cada fato
- Contraprova documental
- Teses defensivas fundamentadas
- Jurisprudência favorável

4. PEDIDOS
- Acolhimento das preliminares
- Reconhecimento das prejudiciais
- Improcedência total dos pedidos
- Subsidiariamente: improcedência parcial
- Condenação em honorários

EXTENSÃO: 10-40 páginas
`
  },

  replica: {
    nome: 'Réplica',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. DAS PRELIMINARES ARGUIDAS',
      'II. DAS PREJUDICIAIS',
      'III. DO MÉRITO',
      'IV. REITERAÇÃO DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  embargos_declaracao: {
    nome: 'Embargos de Declaração',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. TEMPESTIVIDADE',
      'II. CABIMENTO',
      'III. DA OMISSÃO/CONTRADIÇÃO/OBSCURIDADE',
      'IV. DOS PEDIDOS',
      'FECHAMENTO'
    ],
    instrucoes: `
EMBARGOS DE DECLARAÇÃO - art. 1.022 CPC

HIPÓTESES DE CABIMENTO:
1. OBSCURIDADE - falta de clareza
2. CONTRADIÇÃO - incompatibilidade interna
3. OMISSÃO - ponto não analisado
4. ERRO MATERIAL - equívoco evidente

PREQUESTIONAMENTO:
- Indicar expressamente os dispositivos legais
- Requerer manifestação explícita sobre cada ponto
- Fundamentar o prequestionamento ficto se necessário

PRAZO: 5 dias (art. 1.023 CPC)
EFEITO INTERRUPTIVO: reinicia prazo de outros recursos
`
  },

  agravo_interno: {
    nome: 'Agravo Interno',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. TEMPESTIVIDADE E CABIMENTO',
      'II. DA DECISÃO AGRAVADA',
      'III. DAS RAZÕES DO INCONFORMISMO',
      'IV. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  agravo_instrumento: {
    nome: 'Agravo de Instrumento',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. TEMPESTIVIDADE',
      'II. CABIMENTO',
      'III. DA DECISÃO AGRAVADA',
      'IV. DO DIREITO',
      'V. DO PERIGO DA DEMORA',
      'VI. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  apelacao_civel: {
    nome: 'Apelação Cível',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. TEMPESTIVIDADE E PREPARO',
      'II. DA SENTENÇA RECORRIDA',
      'III. DO CABIMENTO',
      'IV. DAS RAZÕES DO RECURSO',
      'V. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  recurso_especial: {
    nome: 'Recurso Especial',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO AO STJ',
      'REFERÊNCIA AO PROCESSO',
      'I. TEMPESTIVIDADE E PREPARO',
      'II. DO CABIMENTO',
      'III. DO PREQUESTIONAMENTO',
      'IV. DA VIOLAÇÃO À LEI FEDERAL',
      'V. DO DISSÍDIO JURISPRUDENCIAL',
      'VI. DAS RAZÕES DO RECURSO',
      'VII. DOS PEDIDOS',
      'FECHAMENTO'
    ],
    instrucoes: `
RECURSO ESPECIAL - art. 105, III, CF

HIPÓTESES:
a) Contrariar tratado ou lei federal
b) Julgar válido ato de governo local contestado em face de lei federal
c) Der a lei federal interpretação divergente da que lhe haja dado outro tribunal

REQUISITOS:
1. Prequestionamento expresso (Súmula 211/STJ)
2. Esgotamento das instâncias ordinárias
3. Não reexame de provas (Súmula 7/STJ)
4. Demonstração analítica do dissídio (se aplicável)

PREQUESTIONAMENTO FICTO:
- Oposição de embargos de declaração
- Art. 1.025 CPC
`
  },

  recurso_extraordinario: {
    nome: 'Recurso Extraordinário',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO AO STF',
      'REFERÊNCIA AO PROCESSO',
      'I. TEMPESTIVIDADE E PREPARO',
      'II. DO CABIMENTO',
      'III. DO PREQUESTIONAMENTO',
      'IV. DA REPERCUSSÃO GERAL',
      'V. DA VIOLAÇÃO CONSTITUCIONAL',
      'VI. DAS RAZÕES DO RECURSO',
      'VII. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  acao_rescisoria: {
    nome: 'Ação Rescisória',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO',
      'QUALIFICAÇÃO DAS PARTES',
      'I. DA DECISÃO RESCINDENDA',
      'II. DO PRAZO DECADENCIAL',
      'III. DO CABIMENTO (art. 966 CPC)',
      'IV. DOS FATOS',
      'V. DO DIREITO',
      'VI. DOS PEDIDOS (RESCISÃO + NOVO JULGAMENTO)',
      'FECHAMENTO'
    ]
  },

  mandado_seguranca: {
    nome: 'Mandado de Segurança',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO',
      'QUALIFICAÇÃO DO IMPETRANTE',
      'AUTORIDADE COATORA',
      'I. DOS FATOS',
      'II. DO DIREITO LÍQUIDO E CERTO',
      'III. DA ILEGALIDADE/ABUSO DE PODER',
      'IV. DA LIMINAR',
      'V. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  execucao_titulo_extrajudicial: {
    nome: 'Execução de Título Extrajudicial',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO',
      'QUALIFICAÇÃO DAS PARTES',
      'I. DO TÍTULO EXECUTIVO',
      'II. DA CERTEZA, LIQUIDEZ E EXIGIBILIDADE',
      'III. DO CÁLCULO DO DÉBITO',
      'IV. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  embargos_execucao: {
    nome: 'Embargos à Execução',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA À EXECUÇÃO',
      'I. TEMPESTIVIDADE',
      'II. GARANTIA DO JUÍZO',
      'III. DAS MATÉRIAS ARGUÍVEIS',
      'IV. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  impugnacao_cumprimento_sentenca: {
    nome: 'Impugnação ao Cumprimento de Sentença',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. TEMPESTIVIDADE',
      'II. DAS MATÉRIAS (art. 525 CPC)',
      'III. DO EXCESSO DE EXECUÇÃO',
      'IV. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  reconvencao: {
    nome: 'Reconvenção',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. DO CABIMENTO',
      'II. DOS FATOS',
      'III. DO DIREITO',
      'IV. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  denuncia_lide: {
    nome: 'Denunciação da Lide',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. DO CABIMENTO (art. 125 CPC)',
      'II. DOS FATOS',
      'III. DO DIREITO DE REGRESSO',
      'IV. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  chamamento_processo: {
    nome: 'Chamamento ao Processo',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. DO CABIMENTO (art. 130 CPC)',
      'II. DOS FATOS',
      'III. DO DIREITO',
      'IV. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  incidente_desconsideracao: {
    nome: 'Incidente de Desconsideração da Personalidade Jurídica',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. DO CABIMENTO',
      'II. DOS FATOS',
      'III. DA CONFUSÃO PATRIMONIAL/DESVIO DE FINALIDADE',
      'IV. DA TEORIA MAIOR/MENOR',
      'V. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  memoriais_civeis: {
    nome: 'Memoriais Cíveis',
    categoria: 'civel',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. SÍNTESE DOS FATOS',
      'II. DA INSTRUÇÃO PROCESSUAL',
      'III. DO DIREITO',
      'IV. CONCLUSÃO',
      'FECHAMENTO'
    ]
  }
};

// ============================================================
// PEÇAS PROCESSUAIS CRIMINAIS
// ============================================================
export const PECAS_CRIMINAIS = {
  resposta_acusacao: {
    nome: 'Resposta à Acusação',
    categoria: 'criminal',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'QUALIFICAÇÃO DO ACUSADO',
      'I. SÍNTESE DA ACUSAÇÃO',
      'II. PRELIMINARES',
      'III. MÉRITO - ABSOLVIÇÃO SUMÁRIA',
      'IV. PROVAS A PRODUZIR',
      'V. DOS PEDIDOS',
      'FECHAMENTO'
    ],
    instrucoes: `
RESPOSTA À ACUSAÇÃO - art. 396-A CPP

PRELIMINARES:
- Inépcia da denúncia/queixa
- Ilegitimidade de parte
- Coisa julgada
- Prescrição
- Ausência de justa causa
- Nulidades

ABSOLVIÇÃO SUMÁRIA (art. 397 CPP):
I - Existência manifesta de causa excludente da ilicitude
II - Existência manifesta de causa excludente da culpabilidade (salvo inimputabilidade)
III - Fato narrado evidentemente não constitui crime
IV - Extinta a punibilidade do agente

PRAZO: 10 dias
ROL DE TESTEMUNHAS: até 8 testemunhas
`
  },

  alegacoes_finais_criminais: {
    nome: 'Alegações Finais Criminais',
    categoria: 'criminal',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. SÍNTESE ACUSATÓRIA',
      'II. DA INSTRUÇÃO CRIMINAL',
      'III. PRELIMINARES',
      'IV. DO MÉRITO',
      'V. DA DOSIMETRIA (se condenação)',
      'VI. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  apelacao_criminal: {
    nome: 'Apelação Criminal',
    categoria: 'criminal',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. TEMPESTIVIDADE',
      'II. DA SENTENÇA RECORRIDA',
      'III. DAS RAZÕES',
      'IV. DA ABSOLVIÇÃO/REDUÇÃO DA PENA',
      'V. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  habeas_corpus: {
    nome: 'Habeas Corpus',
    categoria: 'criminal',
    estrutura: [
      'ENDEREÇAMENTO',
      'QUALIFICAÇÃO DO PACIENTE',
      'AUTORIDADE COATORA',
      'I. DOS FATOS',
      'II. DO CONSTRANGIMENTO ILEGAL',
      'III. DO DIREITO',
      'IV. DA LIMINAR',
      'V. DOS PEDIDOS',
      'FECHAMENTO'
    ],
    instrucoes: `
HABEAS CORPUS - art. 5º, LXVIII, CF

HIPÓTESES DE CABIMENTO:
1. Prisão ilegal
2. Excesso de prazo
3. Falta de justa causa
4. Incompetência do juízo
5. Nulidade processual
6. Extinção da punibilidade
7. Direito de aguardar em liberdade

DOCUMENTOS ESSENCIAIS:
- Cópia do auto de prisão
- Decisão que decretou a prisão
- Certidão de antecedentes
- Comprovante de residência
- Comprovante de trabalho
- FAC (se possível)

LIMINAR: art. 660, §2º, CPP
`
  },

  revisao_criminal: {
    nome: 'Revisão Criminal',
    categoria: 'criminal',
    estrutura: [
      'ENDEREÇAMENTO',
      'QUALIFICAÇÃO DO REQUERENTE',
      'I. DO CABIMENTO (art. 621 CPP)',
      'II. DA SENTENÇA CONDENATÓRIA',
      'III. DOS FATOS',
      'IV. DO DIREITO',
      'V. DOS PEDIDOS',
      'FECHAMENTO'
    ],
    instrucoes: `
REVISÃO CRIMINAL - art. 621 CPP

HIPÓTESES:
I - Sentença contrária ao texto expresso da lei ou à evidência dos autos
II - Sentença fundada em depoimentos, exames ou documentos comprovadamente falsos
III - Descoberta de novas provas de inocência ou circunstância que autorize diminuição da pena

LEGITIMADOS: Condenado ou procurador, cônjuge, parente, herdeiros
PRAZO: Não há - pode ser ajuizada a qualquer tempo
COMPETÊNCIA: Tribunal que proferiu a condenação
`
  },

  agravo_execucao_penal: {
    nome: 'Agravo em Execução Penal',
    categoria: 'criminal',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. TEMPESTIVIDADE',
      'II. DA DECISÃO AGRAVADA',
      'III. DAS RAZÕES',
      'IV. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  recurso_sentido_estrito: {
    nome: 'Recurso em Sentido Estrito',
    categoria: 'criminal',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. TEMPESTIVIDADE',
      'II. CABIMENTO (art. 581 CPP)',
      'III. DA DECISÃO RECORRIDA',
      'IV. DAS RAZÕES',
      'V. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  embargos_infringentes_criminais: {
    nome: 'Embargos Infringentes e de Nulidade',
    categoria: 'criminal',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. TEMPESTIVIDADE',
      'II. DO CABIMENTO',
      'III. DO VOTO VENCIDO',
      'IV. DAS RAZÕES',
      'V. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  queixa_crime: {
    nome: 'Queixa-Crime',
    categoria: 'criminal',
    estrutura: [
      'ENDEREÇAMENTO',
      'QUALIFICAÇÃO DO QUERELANTE',
      'QUALIFICAÇÃO DO QUERELADO',
      'I. DOS FATOS',
      'II. DO CRIME',
      'III. DO DIREITO',
      'IV. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  liberdade_provisoria: {
    nome: 'Pedido de Liberdade Provisória',
    categoria: 'criminal',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'QUALIFICAÇÃO DO REQUERENTE',
      'I. DOS FATOS',
      'II. DA AUSÊNCIA DOS REQUISITOS DA PRISÃO',
      'III. DAS CONDIÇÕES PESSOAIS',
      'IV. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  relaxamento_prisao: {
    nome: 'Pedido de Relaxamento de Prisão',
    categoria: 'criminal',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. DA PRISÃO',
      'II. DA ILEGALIDADE',
      'III. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  revogacao_preventiva: {
    nome: 'Pedido de Revogação de Prisão Preventiva',
    categoria: 'criminal',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. DA PRISÃO PREVENTIVA',
      'II. DA AUSÊNCIA DOS REQUISITOS',
      'III. DAS MEDIDAS CAUTELARES ALTERNATIVAS',
      'IV. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  }
};

// ============================================================
// PEÇAS PROCESSUAIS TRABALHISTAS
// ============================================================
export const PECAS_TRABALHISTAS = {
  reclamacao_trabalhista: {
    nome: 'Reclamação Trabalhista',
    categoria: 'trabalhista',
    estrutura: [
      'ENDEREÇAMENTO',
      'QUALIFICAÇÃO DAS PARTES',
      'I. DO CONTRATO DE TRABALHO',
      'II. DOS FATOS',
      'III. DO DIREITO',
      'IV. DOS PEDIDOS',
      'V. DO VALOR DA CAUSA',
      'VI. DAS PROVAS',
      'FECHAMENTO'
    ]
  },

  contestacao_trabalhista: {
    nome: 'Contestação Trabalhista',
    categoria: 'trabalhista',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. PRELIMINARES',
      'II. PREJUDICIAIS DE MÉRITO',
      'III. DO MÉRITO',
      'IV. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  recurso_ordinario: {
    nome: 'Recurso Ordinário Trabalhista',
    categoria: 'trabalhista',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. TEMPESTIVIDADE E PREPARO',
      'II. DA SENTENÇA RECORRIDA',
      'III. DAS RAZÕES',
      'IV. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  recurso_revista: {
    nome: 'Recurso de Revista',
    categoria: 'trabalhista',
    estrutura: [
      'ENDEREÇAMENTO AO TST',
      'REFERÊNCIA AO PROCESSO',
      'I. TEMPESTIVIDADE E PREPARO',
      'II. DO CABIMENTO',
      'III. DO PREQUESTIONAMENTO',
      'IV. DA VIOLAÇÃO LEGAL/DIVERGÊNCIA',
      'V. DAS RAZÕES',
      'VI. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  agravo_peticao: {
    nome: 'Agravo de Petição',
    categoria: 'trabalhista',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. TEMPESTIVIDADE',
      'II. DELIMITAÇÃO DA MATÉRIA',
      'III. DAS RAZÕES',
      'IV. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  embargos_execucao_trabalhista: {
    nome: 'Embargos à Execução Trabalhista',
    categoria: 'trabalhista',
    estrutura: [
      'ENDEREÇAMENTO',
      'REFERÊNCIA AO PROCESSO',
      'I. TEMPESTIVIDADE',
      'II. GARANTIA DO JUÍZO',
      'III. DAS MATÉRIAS',
      'IV. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  },

  mandado_seguranca_trabalhista: {
    nome: 'Mandado de Segurança Trabalhista',
    categoria: 'trabalhista',
    estrutura: [
      'ENDEREÇAMENTO',
      'QUALIFICAÇÃO DO IMPETRANTE',
      'AUTORIDADE COATORA',
      'I. DOS FATOS',
      'II. DO DIREITO LÍQUIDO E CERTO',
      'III. DA LIMINAR',
      'IV. DOS PEDIDOS',
      'FECHAMENTO'
    ]
  }
};

// ============================================================
// PEÇAS EXTRAPROCESSUAIS
// ============================================================
export const PECAS_EXTRAPROCESSUAIS = {
  contrato_social: {
    nome: 'Contrato Social',
    categoria: 'empresarial',
    estrutura: [
      'PREÂMBULO',
      'CLÁUSULA 1ª - DENOMINAÇÃO SOCIAL',
      'CLÁUSULA 2ª - SEDE',
      'CLÁUSULA 3ª - OBJETO SOCIAL',
      'CLÁUSULA 4ª - PRAZO DE DURAÇÃO',
      'CLÁUSULA 5ª - CAPITAL SOCIAL',
      'CLÁUSULA 6ª - QUOTAS',
      'CLÁUSULA 7ª - ADMINISTRAÇÃO',
      'CLÁUSULA 8ª - PRO LABORE',
      'CLÁUSULA 9ª - RESPONSABILIDADE',
      'CLÁUSULA 10ª - CESSÃO DE QUOTAS',
      'CLÁUSULA 11ª - DELIBERAÇÕES',
      'CLÁUSULA 12ª - EXERCÍCIO SOCIAL',
      'CLÁUSULA 13ª - LUCROS E PREJUÍZOS',
      'CLÁUSULA 14ª - DISSOLUÇÃO',
      'CLÁUSULA 15ª - FORO',
      'ENCERRAMENTO E ASSINATURAS'
    ],
    instrucoes: `
CONTRATO SOCIAL - NORMAS DNRC

REQUISITOS (IN DREI nº 81/2020):
- Nome empresarial (firma ou denominação)
- Capital social e forma de integralização
- Quotas de cada sócio
- Endereço completo da sede
- Objeto social (CNAE)
- Prazo de duração
- Administração e poderes
- Participação nos lucros

TIPOS SOCIETÁRIOS:
- Sociedade Limitada (LTDA)
- Sociedade Anônima (S/A)
- EIRELI
- Sociedade Simples

DOCUMENTOS PARA REGISTRO:
1. Contrato Social em 3 vias
2. RG e CPF dos sócios
3. Comprovante de endereço da sede
4. Taxa de registro (DARE)
5. DBE (CNPJ)
`
  },

  alteracao_contratual: {
    nome: 'Alteração Contratual',
    categoria: 'empresarial',
    estrutura: [
      'PREÂMBULO',
      'CLÁUSULA ALTERADA',
      'CONSOLIDAÇÃO (se aplicável)',
      'ENCERRAMENTO E ASSINATURAS'
    ]
  },

  distrato_social: {
    nome: 'Distrato Social',
    categoria: 'empresarial',
    estrutura: [
      'PREÂMBULO',
      'CLÁUSULA 1ª - DISSOLUÇÃO',
      'CLÁUSULA 2ª - LIQUIDAÇÃO',
      'CLÁUSULA 3ª - NOMEAÇÃO DO LIQUIDANTE',
      'CLÁUSULA 4ª - ATIVO E PASSIVO',
      'CLÁUSULA 5ª - RESPONSABILIDADES',
      'CLÁUSULA 6ª - GUARDA DE DOCUMENTOS',
      'ENCERRAMENTO E ASSINATURAS'
    ]
  },

  procuracao_ad_judicia: {
    nome: 'Procuração Ad Judicia',
    categoria: 'procuracoes',
    estrutura: [
      'OUTORGANTE',
      'OUTORGADO',
      'PODERES',
      'LOCAL E DATA',
      'ASSINATURA'
    ],
    instrucoes: `
PROCURAÇÃO AD JUDICIA - art. 105 CPC

PODERES DA CLÁUSULA AD JUDICIA:
- Propor ações
- Contestar
- Recorrer
- Transigir
- Desistir (poder especial)
- Reconhecer procedência (poder especial)
- Receber citação (poder especial)
- Confessar (poder especial)
- Renunciar (poder especial)
- Receber e dar quitação (poder especial)
- Substabelecer (com ou sem reservas)

REQUISITOS:
- Qualificação completa do outorgante
- Nome e OAB do advogado
- Poderes específicos se necessário
- Data e assinatura
`
  },

  substabelecimento: {
    nome: 'Substabelecimento',
    categoria: 'procuracoes',
    estrutura: [
      'SUBSTABELECENTE',
      'SUBSTABELECIDO',
      'TIPO (com ou sem reservas)',
      'PROCESSO/ASSUNTO',
      'LOCAL E DATA',
      'ASSINATURA'
    ]
  },

  notificacao_extrajudicial: {
    nome: 'Notificação Extrajudicial',
    categoria: 'notificacoes',
    estrutura: [
      'NOTIFICANTE',
      'NOTIFICADO',
      'I. DOS FATOS',
      'II. DO DIREITO',
      'III. DA NOTIFICAÇÃO',
      'IV. DO PRAZO',
      'V. DAS CONSEQUÊNCIAS',
      'LOCAL E DATA',
      'ASSINATURA'
    ],
    instrucoes: `
NOTIFICAÇÃO EXTRAJUDICIAL

FINALIDADES:
- Constituir em mora (art. 397 CC)
- Interromper prescrição
- Comprovar ciência
- Preservar direitos
- Requisitar providências

FORMAS DE ENVIO:
1. Cartório de RTD (registro e autenticação)
2. AR (Aviso de Recebimento)
3. Oficial de Justiça (se judicial)

REQUISITOS:
- Identificação completa das partes
- Descrição clara dos fatos
- Fundamentação legal
- Prazo para resposta/cumprimento
- Consequências do descumprimento
`
  },

  parecer_juridico: {
    nome: 'Parecer Jurídico',
    categoria: 'pareceres',
    estrutura: [
      'IDENTIFICAÇÃO',
      'CONSULENTE',
      'ASSUNTO',
      'I. DOS FATOS',
      'II. DA CONSULTA',
      'III. DO PARECER',
      'III.1 DO DIREITO APLICÁVEL',
      'III.2 DA JURISPRUDÊNCIA',
      'III.3 DA ANÁLISE',
      'IV. CONCLUSÃO',
      'LOCAL E DATA',
      'ASSINATURA'
    ]
  },

  contrato_prestacao_servicos: {
    nome: 'Contrato de Prestação de Serviços',
    categoria: 'contratos',
    estrutura: [
      'PARTES',
      'CLÁUSULA 1ª - OBJETO',
      'CLÁUSULA 2ª - PRAZO',
      'CLÁUSULA 3ª - REMUNERAÇÃO',
      'CLÁUSULA 4ª - FORMA DE PAGAMENTO',
      'CLÁUSULA 5ª - OBRIGAÇÕES DO CONTRATANTE',
      'CLÁUSULA 6ª - OBRIGAÇÕES DO CONTRATADO',
      'CLÁUSULA 7ª - RESCISÃO',
      'CLÁUSULA 8ª - CONFIDENCIALIDADE',
      'CLÁUSULA 9ª - FORO',
      'ASSINATURAS E TESTEMUNHAS'
    ]
  },

  contrato_honorarios: {
    nome: 'Contrato de Honorários Advocatícios',
    categoria: 'contratos',
    estrutura: [
      'PARTES',
      'CLÁUSULA 1ª - OBJETO',
      'CLÁUSULA 2ª - SERVIÇOS',
      'CLÁUSULA 3ª - HONORÁRIOS',
      'CLÁUSULA 4ª - FORMA DE PAGAMENTO',
      'CLÁUSULA 5ª - ÊXITO',
      'CLÁUSULA 6ª - DESPESAS',
      'CLÁUSULA 7ª - OBRIGAÇÕES DO CLIENTE',
      'CLÁUSULA 8ª - OBRIGAÇÕES DO ADVOGADO',
      'CLÁUSULA 9ª - PRAZO',
      'CLÁUSULA 10ª - RESCISÃO',
      'CLÁUSULA 11ª - FORO',
      'ASSINATURAS E TESTEMUNHAS'
    ]
  },

  contrato_locacao: {
    nome: 'Contrato de Locação',
    categoria: 'contratos',
    estrutura: [
      'PARTES',
      'CLÁUSULA 1ª - OBJETO',
      'CLÁUSULA 2ª - PRAZO',
      'CLÁUSULA 3ª - VALOR DO ALUGUEL',
      'CLÁUSULA 4ª - REAJUSTE',
      'CLÁUSULA 5ª - FORMA DE PAGAMENTO',
      'CLÁUSULA 6ª - GARANTIA',
      'CLÁUSULA 7ª - ENCARGOS',
      'CLÁUSULA 8ª - OBRIGAÇÕES DO LOCADOR',
      'CLÁUSULA 9ª - OBRIGAÇÕES DO LOCATÁRIO',
      'CLÁUSULA 10ª - BENFEITORIAS',
      'CLÁUSULA 11ª - RESCISÃO',
      'CLÁUSULA 12ª - FORO',
      'ASSINATURAS E TESTEMUNHAS'
    ]
  },

  contrato_compra_venda: {
    nome: 'Contrato de Compra e Venda',
    categoria: 'contratos',
    estrutura: [
      'PARTES',
      'CLÁUSULA 1ª - OBJETO',
      'CLÁUSULA 2ª - PREÇO',
      'CLÁUSULA 3ª - FORMA DE PAGAMENTO',
      'CLÁUSULA 4ª - TRADIÇÃO',
      'CLÁUSULA 5ª - GARANTIAS',
      'CLÁUSULA 6ª - EVICÇÃO',
      'CLÁUSULA 7ª - VÍCIOS',
      'CLÁUSULA 8ª - RESCISÃO',
      'CLÁUSULA 9ª - FORO',
      'ASSINATURAS E TESTEMUNHAS'
    ]
  },

  declaracao: {
    nome: 'Declaração',
    categoria: 'declaracoes',
    estrutura: [
      'IDENTIFICAÇÃO DO DECLARANTE',
      'TEXTO DA DECLARAÇÃO',
      'FINALIDADE',
      'LOCAL E DATA',
      'ASSINATURA'
    ]
  },

  termo_quitacao: {
    nome: 'Termo de Quitação',
    categoria: 'termos',
    estrutura: [
      'PARTES',
      'OBJETO',
      'VALOR QUITADO',
      'FORMA DE PAGAMENTO',
      'DECLARAÇÃO DE QUITAÇÃO',
      'LOCAL E DATA',
      'ASSINATURAS'
    ]
  },

  termo_acordo: {
    nome: 'Termo de Acordo Extrajudicial',
    categoria: 'termos',
    estrutura: [
      'PARTES',
      'CLÁUSULA 1ª - OBJETO',
      'CLÁUSULA 2ª - OBRIGAÇÕES',
      'CLÁUSULA 3ª - PRAZOS',
      'CLÁUSULA 4ª - QUITAÇÃO',
      'CLÁUSULA 5ª - MULTA',
      'CLÁUSULA 6ª - FORO',
      'ASSINATURAS E TESTEMUNHAS'
    ]
  }
};

// ============================================================
// FUNÇÃO PARA OBTER PROMPT COMPLETO
// ============================================================
export function obterPromptCompleto(tipoPeca) {
  const todasPecas = {
    ...PECAS_CIVEIS,
    ...PECAS_CRIMINAIS,
    ...PECAS_TRABALHISTAS,
    ...PECAS_EXTRAPROCESSUAIS
  };

  const peca = todasPecas[tipoPeca];
  if (!peca) {
    return null;
  }

  return {
    ...peca,
    promptCompleto: gerarPromptCompleto(peca)
  };
}

function gerarPromptCompleto(peca) {
  return `
================================================================================
PROMPT: ${peca.nome.toUpperCase()}
================================================================================
CATEGORIA: ${peca.categoria.toUpperCase()}
SISTEMA: ROM v1.0

ESTRUTURA OBRIGATÓRIA:
${peca.estrutura.map((s, i) => `${i + 1}. ${s}`).join('\n')}

${peca.instrucoes || ''}

FORMATAÇÃO:
- Fonte: Calibri 12pt
- Espaçamento: 1,5
- Margens: 2,5cm (superior/inferior), 3cm (esquerda/direita)
- Recuo primeira linha: 1,25cm
- Alinhamento: Justificado
- Título: Centralizado, negrito, caixa alta

PROIBIÇÕES:
- ZERO emojis
- ZERO markdown
- ZERO asteriscos
- ZERO referências a IA

CHECKLIST:
[ ] Estrutura completa
[ ] Fundamentação adequada
[ ] Pedidos claros e específicos
[ ] Formatação profissional
[ ] Revisão ortográfica

================================================================================
`;
}

// ============================================================
// LISTAR TODAS AS PEÇAS
// ============================================================
export function listarTodasPecas() {
  return {
    civeis: Object.entries(PECAS_CIVEIS).map(([k, v]) => ({ id: k, nome: v.nome })),
    criminais: Object.entries(PECAS_CRIMINAIS).map(([k, v]) => ({ id: k, nome: v.nome })),
    trabalhistas: Object.entries(PECAS_TRABALHISTAS).map(([k, v]) => ({ id: k, nome: v.nome })),
    extraprocessuais: Object.entries(PECAS_EXTRAPROCESSUAIS).map(([k, v]) => ({ id: k, nome: v.nome }))
  };
}

export default {
  PECAS_CIVEIS,
  PECAS_CRIMINAIS,
  PECAS_TRABALHISTAS,
  PECAS_EXTRAPROCESSUAIS,
  obterPromptCompleto,
  listarTodasPecas
};
