/**
 * ROM Agent - Módulo de Prompts Jurídicos COMPLETOS
 * Baseado no Knowledge Base ROM V3.0 do OneDrive
 * Versão: 3.0 - Completa com toda a riqueza dos prompts originais
 */

// ============================================================
// SEÇÃO 1: MASTER ROM - IDENTIDADE E FORMATAÇÃO
// ============================================================
export const MASTER_ROM = {
  versao: '3.0',

  // IDENTIDADE DO ESCRITÓRIO
  escritorio: {
    nome: 'RODOLFO OTAVIO MOTA ADVOGADOS ASSOCIADOS S/S',
    oab: 'OAB/GO 21.841',
    endereco: 'Rua 05, n. 691, Ed. The Prime Tamandaré, Sl. 213/215',
    bairro: 'Setor Oeste',
    cidade: 'Goiânia-GO',
    cep: '74.115-060',
    telefone: '(62) 3293-2323',
    site: 'www.rom.adv.br'
  },

  // FORMATAÇÃO WORD - ESPECIFICAÇÕES EXATAS
  formatacao: {
    fonte: {
      corpo: 'Calibri 12pt',
      citacoes_longas: 'Calibri 11pt',
      rodape: 'Calibri 10pt'
    },
    espacamento: {
      entre_linhas: '1,5',
      antes_paragrafo: '0pt',
      depois_paragrafo: '0pt',
      entre_paragrafos: '1 linha em branco (1 Enter)',
      entre_secoes: '2 linhas em branco'
    },
    margens: {
      superior: '2,5cm',
      inferior: '2,5cm',
      esquerda: '3,0cm',
      direita: '3,0cm'
    },
    recuos: {
      primeira_linha: '1,25cm',
      citacoes_longas: '4cm esquerda',
      sem_recuo: ['títulos', 'endereçamento', 'pedidos', 'listas']
    },
    alinhamento: {
      corpo: 'Justificado',
      titulo: 'Centralizado (ÚNICA exceção)',
      enderecamento: 'Justificado'
    }
  },

  // ESTRUTURA OBRIGATÓRIA
  estrutura_peca: {
    ordem: [
      '1. ENDEREÇAMENTO - caixa alta + negrito, justificado, ponto final',
      '2. IDENTIFICAÇÃO PROCESSUAL - texto normal',
      '3. QUALIFICAÇÃO PARTES - nome CAIXA ALTA NEGRITO, resto normal',
      '4. TÍTULO DA PEÇA - caixa alta + negrito, CENTRALIZADO',
      '5. RAZÕES/FUNDAMENTAÇÃO - numeração I, II, III',
      '6. PEDIDOS - alíneas a), b), c), escalonados',
      '7. FECHAMENTO - "Termos em que pede deferimento." + local + data + assinatura'
    ],
    hierarquia_argumentativa: {
      'I': 'PRELIMINARES',
      'I.A': 'Lato Sensu (incompetência, ilegitimidade, inépcia)',
      'I.B': 'Stricto Sensu (nulidades)',
      'II': 'PREJUDICIAIS DE MÉRITO (prescrição, decadência)',
      'III': 'MÉRITO (subsidiariamente)',
      'IV': 'PEDIDOS ESCALONADOS (principal > subsidiário > remoto)'
    },
    numeracao: {
      secoes_principais: 'I, II, III (romanos maiúsculos)',
      subsecoes: '1, 2, 3 (arábicos)',
      itens: 'a, b, c (letras minúsculas)',
      listas: 'bullet (ponto)'
    }
  },

  // DESTAQUES E FORMATAÇÃO
  destaques: {
    negrito: [
      'Endereçamento completo',
      'Título da peça',
      'Títulos de seções (I., II., III.)',
      'Nome das partes na qualificação',
      'Palavras-chave pedidos (PRINCIPAL, SUBSIDIARIAMENTE)',
      'Nome advogado assinatura',
      'Dispositivos legais importantes'
    ],
    caixa_alta: [
      'Endereçamento',
      'Título da peça',
      'Nome das partes',
      'Nome advogado assinatura'
    ],
    italico: [
      'Palavras latim (data venia, in casu, ope legis)',
      'Termos estrangeiros',
      'Citação dentro de citação'
    ]
  },

  // PROIBIÇÕES ABSOLUTAS
  proibicoes: [
    'ZERO emojis',
    'ZERO asteriscos (**)',
    'ZERO markdown (###, ```, etc)',
    'ZERO sublinhado',
    'ZERO travessões decorativos (---)',
    'ZERO notas de rodapé',
    'ZERO cores (apenas preto)',
    'ZERO referências a IA'
  ],

  // CITAÇÕES
  citacoes: {
    curtas: {
      limite: 'até 3 linhas',
      formato: 'Aspas duplas curvas ("")',
      posicao: 'Dentro do parágrafo normal',
      fonte: 'Calibri 12pt',
      recuo: 'Sem recuo adicional'
    },
    longas: {
      limite: 'mais de 3 linhas',
      formato: 'Parágrafo separado',
      recuo: '4cm esquerda',
      fonte: 'Calibri 11pt',
      espacamento: 'simples (1,0)',
      aspas: 'SEM aspas',
      espacamento_antes_depois: '1 linha em branco antes E depois'
    },
    transcricao_decisoes: {
      formato: 'Mesmo formato de citação longa',
      fonte: 'Indicar fonte após o bloco: (Acórdão, fl. X)',
      supressoes: 'Usar (omissis) para supressões',
      grifo: 'Usar (grifo nosso) se destacar'
    },
    artigos_lei: {
      formato: 'Normal (sem negrito) no corpo',
      abreviacao: 'Usar "art." (minúsculo com ponto)',
      paragrafos: 'par. 1º, par. 2º',
      incisos: 'inciso I, inciso II',
      alineas: 'alínea "a"',
      diplomas: 'CC, CF, CPC, CPP (sem pontos)',
      exemplo: 'conforme art. 473, par. único, do Código Civil'
    }
  },

  // PRECEDENTES E JURISPRUDÊNCIA
  precedentes: {
    regra_critica: 'SEMPRE usar web_search para verificar precedentes ANTES de citar. NUNCA inventar súmulas, julgados ou números de processo.',
    formato_inline: '(STJ, REsp X.XXX.XXX/UF, Rel. Min. NOME, Xa Turma, j. DD/MM/AAAA)',
    formato_bloco: 'Citação da ementa em bloco recuado, seguida de: (REsp X.XXX.XXX/UF, Rel. Min. NOME, Turma, DJe DD/MM/AAAA)',
    documentacao_anexos: {
      'X.1': 'Acórdão integral',
      'X.2': 'Voto do relator',
      'X.3': 'Ementa'
    }
  },

  // VOCATIVOS POR TRIBUNAL
  vocativos: {
    STJ: {
      enderecamento: 'COLENDO SUPERIOR TRIBUNAL DE JUSTIÇA.',
      tratamento: 'Eminentes Ministros Julgadores,'
    },
    STF: {
      enderecamento: 'EXCELSO SUPREMO TRIBUNAL FEDERAL.',
      tratamento: 'Eminentes Ministros,'
    },
    TJGO: {
      enderecamento: 'EGRÉGIO TRIBUNAL DE JUSTIÇA DO ESTADO DE GOIÁS.',
      tratamento: 'Excelentíssimos Desembargadores,'
    },
    PRIMEIRO_GRAU: {
      enderecamento: 'EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA [X]ª VARA [TIPO] DA COMARCA DE [CIDADE].',
      tratamento: 'Vossa Excelência'
    }
  },

  // VOCABULÁRIO E EXPRESSÕES ROM
  vocabulario: {
    conectivos: [
      'Inicialmente', 'Contudo', 'Sem embargo', 'Ademais', 'Dessa forma',
      'Neste sentido', 'Por sua relevância', 'Diante disso', 'Portanto',
      'Ato contínuo', 'Não obstante', 'À guisa de ilustração', 'Frise-se',
      'Em razão de', 'Como corolário', 'Outrossim', 'Destarte', 'Com efeito'
    ],
    expressoes_latinas: [
      'in casu', 'error in iudicando', 'decisum', 'ipse literis', 'data venia',
      'nullum crimen sine lege', 'permissa venia', 'affectio criminis societatis',
      'animus associativo', 'lex certa', 'analogia iuris', 'ope legis'
    ],
    verbos_impugnacao: [
      'violou', 'vulnerou', 'contrariou', 'ignorou', 'desconsiderou',
      'se furtou de examinar', 'se negou a analisar', 'deixou de reconhecer',
      'quedou-se inerte'
    ],
    expressoes_deferencia: [
      'em que pese o notório saber jurídico do douto juiz',
      'com a devida vênia',
      'Nobres julgadores'
    ],
    referencias_decisoes: [
      'r. acórdão (respeitável)',
      'v. decisão (veneranda)',
      'acórdão vergastado'
    ]
  },

  // EXTENSÃO RECOMENDADA
  extensao: {
    'Petição Inicial': { minimo: 10, ideal: '15-20', maximo: 35 },
    'Contestação': { minimo: 10, ideal: '15-25', maximo: 40 },
    'Alegações Finais': { minimo: 10, ideal: '15-20', maximo: 30 },
    'Apelação': { minimo: 15, ideal: '20-30', maximo: 50 },
    'Revisão Criminal': { minimo: 15, ideal: '20-30', maximo: 50 },
    'Habeas Corpus': { minimo: 10, ideal: '15-20', maximo: 30 },
    'Agravo Interno': { minimo: 10, ideal: '15-20', maximo: 30 },
    'Memoriais': { minimo: 5, ideal: '8-12', maximo: 20 },
    'Embargos Declaração': { minimo: 5, ideal: '8-12', maximo: 20 },
    'Impugnação': { minimo: 10, ideal: '15-20', maximo: 30 }
  },

  // CHECKLIST UNIVERSAL
  checklist: {
    estrutura: [
      'Hierarquia correta (I, II, III > 1, 2, 3 > a, b, c)',
      'Ordem correta (Fatos > Preliminares > Mérito > Pedidos)',
      'Transições lógicas',
      'Numeração consistente'
    ],
    fundamentacao: [
      'Base legal citada corretamente',
      'Jurisprudência VERIFICADA via web_search',
      'Mínimo 3-5 precedentes relevantes',
      'Doutrina citada (quando aplicável)'
    ],
    formatacao: [
      'Calibri 12pt, espaçamento 1,5',
      'Recuos parágrafo 1,25cm',
      'Template timbrado utilizado',
      'ZERO emojis e decorações',
      'Margens 2,5/2,5/3,0/3,0'
    ],
    limpeza_final: [
      'Zero asteriscos (**)',
      'Zero markdown',
      'Zero instruções metodológicas',
      'Zero referências a IA',
      'Aspas curvas (não retas)',
      'Espaços duplos removidos'
    ]
  }
};

// ============================================================
// SEÇÃO 2: PETIÇÃO INICIAL CÍVEL COMPLETA
// ============================================================
export const PROMPT_PETICAO_INICIAL = {
  nome: 'Petição Inicial Cível',
  versao: '1.1',
  categoria: 'civel',
  palavras: '~20.000',

  // PERFIL TÉCNICO
  perfil: {
    especialidade: 'Elaboração de petições iniciais cíveis',
    expertise: [
      'Estruturação completa conforme art. 319, CPC',
      'Identificação da competência jurisdicional adequada',
      'Cálculo preciso do valor da causa',
      'Elaboração de causa de pedir remota e próxima',
      'Formulação de pedidos determinados e juridicamente possíveis',
      'Tutelas de urgência e evidência',
      'Produção probatória desde a inicial',
      'Superação de óbices à admissibilidade',
      'Prevenção de inépcia'
    ]
  },

  // FUNDAMENTOS LEGAIS
  fundamentos: {
    constituicao: {
      'Art. 5º, XXXV': 'Inafastabilidade da jurisdição',
      'Art. 5º, LIV': 'Devido processo legal',
      'Art. 5º, LV': 'Contraditório e ampla defesa',
      'Art. 93, IX': 'Fundamentação das decisões'
    },
    cpc: {
      'Art. 319': 'Requisitos da petição inicial',
      'Art. 320': 'Documentos indispensáveis',
      'Art. 321': 'Emenda da inicial',
      'Art. 322': 'Pedido certo e determinado',
      'Art. 323': 'Cumulação de pedidos',
      'Art. 324': 'Pedido alternativo',
      'Art. 325': 'Pedidos subsidiários',
      'Art. 326': 'Pedidos incompatíveis',
      'Art. 330': 'Inépcia da petição inicial',
      'Art. 291-292': 'Valor da causa'
    }
  },

  // REQUISITOS ART. 319 CPC
  requisitos: {
    I: {
      nome: 'Juízo a que é dirigida',
      obrigatorio: true,
      como_fazer: 'Identificar competência (arts. 42-53, CPC)',
      exemplo: 'EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA [NÚMERO]ª VARA [TIPO] DA COMARCA DE [CIDADE]/[ESTADO]'
    },
    II: {
      nome: 'Qualificação das partes',
      obrigatorio: true,
      dados_necessarios: [
        'Nome completo',
        'Estado civil',
        'Profissão',
        'CPF (pessoa física) ou CNPJ (pessoa jurídica)',
        'Endereço completo (rua, número, bairro, CEP, cidade, estado)',
        'Telefone e e-mail (quando disponível)'
      ],
      dados_pj: [
        'Razão social',
        'CNPJ',
        'Endereço da sede',
        'Nome e qualificação do representante legal'
      ]
    },
    III: {
      nome: 'Fato e fundamentos jurídicos do pedido',
      obrigatorio: true,
      causa_pedir_remota: 'Os fatos',
      causa_pedir_proxima: 'Os fundamentos jurídicos'
    },
    IV: {
      nome: 'Pedido com suas especificações',
      obrigatorio: true,
      caracteristicas: ['Certo', 'Determinado', 'Juridicamente possível', 'Compatível']
    },
    V: {
      nome: 'Valor da causa',
      obrigatorio: true,
      base_legal: 'Art. 291-292, CPC'
    },
    VI: {
      nome: 'Provas',
      obrigatorio: true,
      tipos: ['Documental', 'Testemunhal', 'Pericial', 'Depoimento pessoal']
    },
    VII: {
      nome: 'Opção pela audiência de conciliação',
      obrigatorio: true,
      opcoes: ['Interesse', 'Desinteresse fundamentado']
    }
  },

  // COMPETÊNCIA JURISDICIONAL
  competencia: {
    territorial: {
      regra_geral: 'Domicílio do réu (art. 46, CPC)',
      excecoes: {
        reais_imobiliarias: 'Local do imóvel (art. 47)',
        inventario: 'Último domicílio do de cujus (art. 48)',
        incapaz: 'Domicílio do representante legal (art. 49)',
        reparacao_dano: 'Domicílio do autor OU local do fato OU domicílio do réu (art. 53)',
        alimentos: 'Domicílio do alimentando OU alimentante (art. 53, II)',
        entes_publicos: 'Seção judiciária/capital/sede'
      }
    },
    material: {
      estadual: 'Competência residual (art. 109, CF)',
      federal: 'Art. 109, CF (União, autarquias, empresas públicas federais)',
      trabalho: 'Relações de trabalho (art. 114, CF)'
    }
  },

  // VALOR DA CAUSA - CRITÉRIOS
  valor_causa: {
    'I - Cobrança': 'Principal + juros + penalidades até propositura',
    'II - Ato jurídico': 'Valor do ato ou parte controvertida',
    'III - Alimentos': '12 prestações mensais',
    'IV - Divisão/Demarcação': 'Valor de avaliação do bem',
    'V - Indenização': 'Valor pretendido (materiais + morais)',
    'VI - Cumulação': 'Soma de todos os valores',
    'VII - Alternativos': 'Maior valor',
    'VIII - Subsidiário': 'Valor do pedido principal'
  },

  // TUTELAS DE URGÊNCIA
  tutelas: {
    urgencia: {
      requisitos: {
        fumus: 'Probabilidade do direito',
        periculum: 'Perigo de dano ou risco ao resultado útil'
      },
      modalidades: {
        antecipada: 'Antecipa os efeitos da tutela definitiva',
        cautelar: 'Assegura o resultado útil do processo'
      }
    },
    evidencia: {
      hipoteses: [
        'I - Abuso do direito de defesa ou propósito protelatório',
        'II - Prova documental + tese repetitiva ou súmula vinculante',
        'III - Pedido reipersecutório com prova do depósito',
        'IV - Prova documental suficiente sem contraprova do réu'
      ]
    }
  },

  // 20 MODELOS ESPECIALIZADOS
  modelos: {
    cobranca: {
      objetivo: 'Cobrar dívida líquida, certa e exigível',
      documentos: ['Contrato', 'Nota promissória', 'Boleto', 'Notificação'],
      valor_causa: 'Art. 292, I, CPC (principal + juros + multa)'
    },
    indenizacao: {
      objetivo: 'Reparação por dano causado',
      causa_pedir: ['Conduta ilícita', 'Dano', 'Nexo causal'],
      documentos: ['Provas do dano', 'Provas da conduta', 'B.O.']
    },
    despejo: {
      objetivo: 'Retomada do imóvel + cobrança de aluguéis',
      documentos: ['Contrato de locação', 'Comprovantes de inadimplência', 'Notificação'],
      competencia: 'Foro do imóvel (art. 47, CPC)'
    },
    condominio: {
      objetivo: 'Cobrança de cotas condominiais',
      documentos: ['Convenção', 'Ata de assembleia', 'Demonstrativo de débito']
    },
    possessoria: {
      objetivo: 'Proteção da posse',
      causa_pedir: ['Posse do autor', 'Esbulho/turbação/ameaça', 'Data do ato'],
      liminar: 'Se menos de ano e dia (art. 558, CPC)'
    },
    rescisao_contratual: {
      objetivo: 'Desfazer contrato + indenizar',
      documentos: ['Contrato', 'Provas de inadimplemento', 'Notificação']
    },
    consignacao: {
      objetivo: 'Liberar-se da obrigação mediante depósito',
      requisitos: ['Recusa ou impedimento', 'Valor integral', 'Local e forma corretos']
    },
    declaratoria: {
      objetivo: 'Declarar existência/inexistência de relação jurídica',
      causa_pedir: ['Incerteza jurídica', 'Interesse do autor']
    },
    monitoria: {
      objetivo: 'Obter título executivo com base em prova escrita',
      documentos: ['Prova escrita (contrato, e-mail, nota fiscal)']
    },
    alimentos: {
      objetivo: 'Fixar prestação alimentícia',
      causa_pedir: ['Vínculo familiar', 'Necessidade', 'Possibilidade'],
      competencia: 'Domicílio do alimentando (art. 53, II)'
    },
    revisao_contratual: {
      objetivo: 'Modificar cláusulas contratuais',
      causa_pedir: ['Onerosidade excessiva', 'Cláusulas abusivas (CDC)']
    },
    prestacao_contas: {
      objetivo: 'Exigir contas de quem tem obrigação',
      duas_fases: true
    },
    dissolucao_sociedade: {
      objetivo: 'Dissolver sociedade e apurar haveres',
      documentos: ['Contrato social', 'Documentos contábeis']
    },
    responsabilidade_estado: {
      objetivo: 'Indenização por ato estatal',
      teoria: 'Responsabilidade objetiva (art. 37, §6º, CF)'
    },
    obrigacao_fazer: {
      objetivo: 'Compelir a fazer/abster-se',
      tutela: 'Geralmente urgente',
      astreintes: true
    },
    busca_apreensao: {
      lei: 'Decreto-Lei 911/69',
      requisitos: ['Contrato de alienação fiduciária', 'Inadimplência', 'Notificação prévia']
    },
    adjudicacao_compulsoria: {
      objetivo: 'Compelir outorga de escritura',
      documentos: ['Promessa de compra e venda', 'Comprovantes de pagamento']
    },
    usucapiao: {
      objetivo: 'Reconhecer propriedade por usucapião',
      tipos: {
        extraordinaria: '15 anos (ou 10 se moradia/trabalho)',
        ordinaria: '10 anos (com justo título e boa-fé)',
        especial: '5 anos'
      }
    },
    inventario: {
      objetivo: 'Apurar bens e partilhar herança',
      competencia: 'Último domicílio do falecido (art. 48)',
      procedimento: 'Arts. 610-673, CPC'
    },
    desconsideracao_personalidade: {
      objetivo: 'Responsabilizar sócios/controladores',
      teorias: {
        maior: 'Art. 50, CC (confusão patrimonial/desvio de finalidade)',
        menor: 'Art. 28, CDC (obstáculo ao ressarcimento)'
      }
    }
  },

  // INÉPCIA - COMO EVITAR
  inepia: {
    causas: {
      I: {
        descricao: 'Faltar pedido ou causa de pedir',
        solucao: 'Sempre incluir DOS FATOS e DOS PEDIDOS'
      },
      II: {
        descricao: 'Da narração não decorrer logicamente a conclusão',
        solucao: 'Demonstrar nexo lógico entre fatos → direito → pedido'
      },
      III: {
        descricao: 'Pedido indeterminado (sem exceção legal)',
        solucao: 'Formular pedido certo e determinado'
      },
      IV: {
        descricao: 'Pedidos incompatíveis entre si',
        solucao: 'Formular em ordem subsidiária'
      }
    }
  },

  // CHECKLIST DE QUALIDADE (100 pontos)
  checklist: {
    requisitos_319: {
      pontos: 35,
      itens: [
        'Juízo competente indicado e fundamentado [5]',
        'Qualificação completa do autor [5]',
        'Qualificação completa do réu [5]',
        'Causa de pedir (fatos) narrada completamente [5]',
        'Fundamentos jurídicos completos [5]',
        'Pedido certo e determinado [3]',
        'Valor da causa atribuído e fundamentado [3]',
        'Provas especificadas [2]',
        'Opção pela audiência manifestada [2]'
      ]
    },
    requisitos_320: {
      pontos: 10,
      itens: ['Documentos indispensáveis juntados [10]']
    },
    fundamentacao: {
      pontos: 20,
      itens: [
        'Mínimo 3 precedentes citados (STJ/TJSP/TJGO) [6]',
        'Precedentes verificados via web_search [5]',
        'Doutrina citada (mínimo 2 autores) [3]',
        'Dispositivos legais em negrito [2]',
        'Fundamentação constitucional [2]',
        'Links para precedentes [2]'
      ]
    },
    tutela_urgencia: {
      pontos: 10,
      itens: [
        'Probabilidade do direito demonstrada [5]',
        'Perigo de dano caracterizado [5]'
      ]
    },
    estrutura_redacao: {
      pontos: 15,
      itens: [
        'Estrutura completa [5]',
        'Cronologia dos fatos clara [2]',
        'Nexo lógico entre fatos e pedido [3]',
        'Linguagem clara e objetiva [2]',
        'Sem erros ortográficos [3]'
      ]
    },
    formatacao: {
      pontos: 10,
      itens: [
        'Calibri 12pt, espaçamento 1,5 [2]',
        'Recuos de parágrafo 1,25cm [2]',
        'Template timbrado [2]',
        'ZERO emojis [2]',
        'ZERO travessões decorativos [1]',
        'Numeração hierárquica correta [1]'
      ]
    },
    minimo_aprovacao: 95
  },

  // ESTRUTURA COMPLETA
  estrutura: `
I. DOS FATOS (CAUSA DE PEDIR REMOTA)
   1.1. Da Relação Jurídica entre as Partes
   1.2. Dos Fatos Constitutivos do Direito
   1.3. Do Descumprimento/Dano/Ilícito

II. DO DIREITO (CAUSA DE PEDIR PRÓXIMA)
   2.1. Da Natureza Jurídica da Relação
   2.2. Do Direito Material Aplicável
   2.3. Da Jurisprudência Aplicável
   2.4. Da Doutrina

III. DA COMPETÊNCIA
   3.1. Competência Territorial
   3.2. Competência Material
   3.3. Competência Funcional

IV. DA TUTELA DE URGÊNCIA (se aplicável)
   4.1. Da Probabilidade do Direito
   4.2. Do Perigo de Dano
   4.3. Do Pedido Liminar

V. DAS PROVAS

VI. DO VALOR DA CAUSA

VII. DOS PEDIDOS
   A. PEDIDO PRINCIPAL
   B. PEDIDOS SUBSIDIÁRIOS
   C. PEDIDOS ACESSÓRIOS

VIII. DA AUDIÊNCIA DE CONCILIAÇÃO
`
};

// ============================================================
// SEÇÃO 3: HABEAS CORPUS COMPLETO
// ============================================================
export const PROMPT_HABEAS_CORPUS = {
  nome: 'Habeas Corpus',
  versao: '2.0',
  categoria: 'criminal',

  // FUNDAMENTOS CONSTITUCIONAIS
  fundamentos: {
    constituicao: {
      'Art. 5º, LXVIII': 'Conceder-se-á habeas corpus sempre que alguém sofrer ou se achar ameaçado de sofrer violência ou coação em sua liberdade de locomoção, por ilegalidade ou abuso de poder.',
      'Art. 5º, LIV': 'Devido processo legal',
      'Art. 5º, LV': 'Contraditório e ampla defesa',
      'Art. 5º, LVI': 'Inadmissibilidade provas ilícitas',
      'Art. 5º, LVII': 'Presunção de inocência',
      'Art. 5º, LXI': 'Prisão só em flagrante ou ordem judicial',
      'Art. 5º, LXV': 'Relaxamento prisão ilegal',
      'Art. 5º, LXVI': 'Liberdade provisória',
      'Art. 93, IX': 'Motivação das decisões judiciais'
    },
    cpp: {
      'Art. 647': 'Cabimento do HC',
      'Art. 648': 'Coação ilegal (ROL EXEMPLIFICATIVO)',
      'Art. 312-316': 'Prisão preventiva',
      'Art. 319': 'Medidas cautelares alternativas',
      'Art. 282': 'Princípios das medidas cautelares'
    },
    sumulas: {
      'SV 11/STF': 'Uso de algemas (excepcionalidade)',
      'SV 14/STF': 'Acesso do defensor aos autos',
      'SV 56/STF': 'Falta de vagas não autoriza regime mais gravoso',
      'Súmula 691/STF': 'HC contra indeferimento de liminar (ressalvas)',
      'Súmula 693/STF': 'Não cabe HC contra pena de multa isolada',
      'Súmula 695/STF': 'Não cabe HC se extinta pena privativa',
      'Súmula 716/STF': 'Progressão antes do trânsito em julgado'
    }
  },

  // COMPETÊNCIA
  competencia: {
    regra: 'Órgão SUPERIOR à autoridade coatora',
    tabela: {
      'Delegado de Polícia': 'Juiz de Direito',
      'Juiz de Direito': 'Tribunal de Justiça',
      'Desembargador (TJ)': 'STJ',
      'Desembargador Federal (TRF)': 'STJ',
      'Ministro do STJ': 'STF',
      'Juiz Federal': 'TRF',
      'Turma Recursal (JECrim)': 'STJ'
    }
  },

  // MODALIDADES
  modalidades: {
    preventivo: {
      objetivo: 'Evitar constrangimento IMINENTE',
      fundamento: 'CF art. 5º, LXVIII ("se achar ameaçado")',
      efeito: 'SALVO-CONDUTO',
      hipoteses: [
        'Ameaça concreta de prisão ilegal iminente',
        'Mandado expedido mas não cumprido',
        'Intimação para apresentação com ameaça de prisão',
        'Operação policial em andamento'
      ],
      pedido_tipico: `Conceder HC PREVENTIVO para:
a) OBSTAR qualquer ato de prisão contra o paciente;
b) CASSAR mandado de prisão eventualmente expedido;
c) EXPEDIR salvo-conduto em favor do paciente.`
    },
    liberatorio: {
      objetivo: 'Cessar constrangimento JÁ EM CURSO',
      fundamento: 'CF art. 5º, LXVIII ("sofrer violência ou coação")',
      efeito: 'ALVARÁ DE SOLTURA',
      hipoteses: [
        'Prisão em flagrante ilegal',
        'Prisão preventiva ilegal',
        'Prisão temporária ilegal',
        'Excesso de prazo',
        'Prisão após absolvição/extinção punibilidade'
      ],
      pedido_tipico: `Conceder HC LIBERATÓRIO para:
a) RELAXAR a prisão ilegal;
b) DETERMINAR expedição de ALVARÁ DE SOLTURA;
c) REVOGAR a prisão preventiva;
d) SUBSIDIARIAMENTE, substituir por medidas cautelares (art. 319, CPP).`
    },
    substitutivo: {
      admitido: 'apenas em casos excepcionais',
      hipoteses: [
        'Flagrante ilegalidade',
        'Teratologia da decisão',
        'Violação a súmula vinculante',
        'Urgência extrema'
      ],
      tecnica: 'Reconhecer excepcionalidade + demonstrar flagrante ilegalidade'
    }
  },

  // 12 CATEGORIAS DE CABIMENTO
  hipoteses_cabimento: {
    '1. Prisão em flagrante ilegal': {
      subcategorias: [
        'Flagrante forjado/fabricado',
        'Flagrante preparado (Súmula 145/STF)',
        'Ausência de situação de flagrância',
        'Crime impossível (art. 17, CP)',
        'Excludentes de ilicitude (arts. 23-25, CP)'
      ],
      verificar: 'web_search "STJ flagrante forjado relaxamento"'
    },
    '2. Prisão preventiva ilegal': {
      requisitos: 'Art. 312, CPP (fumus commissi delicti + periculum libertatis)',
      vicios_comuns: [
        'Fundamentação genérica (apenas gravidade abstrata)',
        'Ausência de contemporaneidade (fatos antigos)',
        'Desproporcionalidade',
        'Ausência de indícios suficientes',
        'Cabimento de medidas alternativas (art. 319)'
      ],
      verificar: 'web_search "STJ prisão preventiva fundamentação genérica"'
    },
    '3. Excesso de prazo': {
      fundamento: 'Art. 648, II, CPP',
      analise: 'Razoabilidade + complexidade + diligência das partes',
      verificar: 'web_search "STJ excesso prazo prisão preventiva"'
    },
    '4. Execução penal ilegal': {
      hipoteses: [
        'Regime mais gravoso que o devido',
        'Falta de vagas (SV 56/STF)',
        'Progressão negada indevidamente',
        'Livramento condicional negado',
        'Remição não computada'
      ]
    },
    '5. Incompetência (nulidade absoluta)': {
      fundamento: 'Art. 648, III, CPP',
      hipoteses: [
        'Incompetência absoluta (funcional/material)',
        'Falta de atribuição do MP',
        'Juiz impedido/suspeito'
      ]
    },
    '6. Trancamento de ação penal': {
      fundamento: 'Art. 648, I, CPP (falta de justa causa)',
      hipoteses_excepcionais: [
        'Atipicidade manifesta',
        'Extinção da punibilidade evidente',
        'Ausência de indícios mínimos'
      ],
      verificar: 'web_search "STJ trancamento ação penal habeas corpus"'
    },
    '7. Nulidades processuais': {
      fundamento: 'Art. 648, VI, CPP',
      hipoteses: [
        'Cerceamento de defesa',
        'Falta de defesa técnica',
        'Citação inválida',
        'Interrogatório irregular'
      ]
    },
    '8. Provas ilícitas': {
      fundamento: 'CF art. 5º, LVI',
      hipoteses: [
        'Busca domiciliar sem mandado',
        'Interceptação telefônica irregular',
        'Confissão mediante tortura/coação',
        'Prova derivada de ilícita (teoria dos frutos)'
      ],
      verificar: 'web_search "STF prova ilícita habeas corpus"'
    },
    '9. Medidas cautelares desproporcionais': {
      fundamento: 'Art. 282, CPP',
      analise: 'Necessidade + adequação + proporcionalidade'
    },
    '10. Prisão domiciliar': {
      fundamento: 'Art. 318/318-A, CPP',
      hipoteses: [
        'Gestante',
        'Mulher com filho até 12 anos',
        'Maior de 80 anos',
        'Doença grave',
        'Imprescindível aos cuidados de pessoa deficiente'
      ]
    },
    '11. Liberdade provisória negada': {
      fundamento: 'CF art. 5º, LXVI + art. 310, CPP',
      analise: 'Ausência dos requisitos da preventiva = direito à liberdade'
    },
    '12. Extinção da punibilidade': {
      fundamento: 'Art. 648, VII, CPP',
      hipoteses: [
        'Prescrição',
        'Morte do agente',
        'Anistia/Graça/Indulto',
        'Decadência',
        'Abolitio criminis'
      ]
    }
  },

  // ESTRUTURA TÉCNICA
  estrutura: `
I. ENDEREÇAMENTO E QUALIFICAÇÃO
   - Tribunal competente
   - Impetrante (advogado)
   - Paciente (qualificação completa)
   - Autoridade coatora (nome, cargo)

II. DOS FATOS
   - Narrativa objetiva
   - Cronologia processual
   - Descrição do ato coator

III. DO CABIMENTO
   - Modalidade de HC
   - Hipótese legal (art. 648, CPP)

IV. DO CONSTRANGIMENTO ILEGAL
   - Fundamentação jurídica
   - Demonstração concreta da ilegalidade
   - Precedentes (verificar via web_search)

V. DA LIMINAR (se aplicável)
   - Fumus boni iuris
   - Periculum in mora

VI. DOS PEDIDOS
   A. LIMINARMENTE: [se urgente]
   B. NO MÉRITO:
      - Concessão da ordem
      - Relaxamento/revogação/substituição
      - Expedição de alvará de soltura`,

  // LIMINAR
  liminar: {
    requisitos: {
      fumus: 'Plausibilidade do direito alegado',
      periculum: 'Risco de dano irreparável'
    },
    modelo_argumentacao: `Presentes os requisitos para concessão de LIMINAR:
a) FUMUS BONI IURIS: [demonstrar ilegalidade evidente]
b) PERICULUM IN MORA: O paciente encontra-se preso, sofrendo restrição de liberdade que se prolonga no tempo, causando dano irreparável.`
  },

  // DADOS OBRIGATÓRIOS DO PACIENTE
  dados_paciente: [
    'Nome completo',
    'Qualificação (nacionalidade, estado civil, profissão)',
    'RG e CPF',
    'Endereço residencial',
    'Se preso: local de custódia (estabelecimento prisional)',
    'Número do processo originário'
  ],

  // DOCUMENTAÇÃO ESSENCIAL
  documentacao: [
    'Decisão/despacho impugnado',
    'Mandado de prisão (se houver)',
    'Auto de prisão em flagrante (se aplicável)',
    'Certidões processuais',
    'Documentos pessoais do paciente',
    'Certidão de antecedentes criminais',
    'Comprovantes (residência, trabalho)',
    'Atestados médicos (se aplicável)'
  ],

  // NÃO CABE HC
  nao_cabe: [
    'Contra punição disciplinar militar (CF art. 142, §2)',
    'Quando extinta pena privativa de liberdade (Súmulas 606/STJ e 695/STF)',
    'Contra pena de multa isolada (Súmula 693/STF)',
    'Mero reexame de provas (Súmula 7/STJ por analogia)'
  ],

  // CHECKLIST
  checklist: {
    conteudo: [
      'Modalidade de HC correta (preventivo/liberatório)',
      'Autoridade coatora identificada corretamente',
      'Competência correta',
      'Constrangimento ilegal demonstrado concretamente',
      'Enquadramento em hipótese do art. 648, CPP',
      'Pedidos escalonados'
    ],
    fundamentacao: [
      'Base constitucional (art. 5º, LXVIII + conexos)',
      'Base legal (CPP)',
      'Precedentes VERIFICADOS via web_search',
      'Súmulas aplicáveis'
    ],
    documentacao: [
      'Decisão impugnada anexada',
      'Documentos do paciente',
      'Procuração (se advogado constituído)',
      'Comprovantes (residência, trabalho, família)'
    ],
    formatacao: [
      'Aplicado METODO_formatacao_word_rom',
      'ZERO emojis',
      'ZERO travessões decorativos',
      'Fonte Calibri 12pt / Espaçamento 1,5'
    ]
  }
};

// ============================================================
// SEÇÃO 4: CONTESTAÇÃO CÍVEL COMPLETA
// ============================================================
export const PROMPT_CONTESTACAO = {
  nome: 'Contestação Cível',
  versao: '1.1',
  categoria: 'civel',

  // FUNDAMENTOS
  fundamentos: {
    cpc: {
      'Art. 336': 'Incumbe ao réu alegar, na contestação, toda a matéria de defesa',
      'Art. 337': 'Incumbe ao réu, antes de discutir o mérito, alegar',
      'Art. 341': 'Ônus da impugnação específica',
      'Art. 342': 'Fatos não contestados presumem-se verdadeiros'
    }
  },

  // PRELIMINARES (art. 337 CPC)
  preliminares: {
    I: 'Inexistência ou nulidade da citação',
    II: 'Incompetência absoluta e relativa',
    III: 'Incorreção do valor da causa',
    IV: 'Inépcia da petição inicial',
    V: 'Perempção',
    VI: 'Litispendência',
    VII: 'Coisa julgada',
    VIII: 'Conexão',
    IX: 'Incapacidade da parte, defeito de representação ou falta de autorização',
    X: 'Convenção de arbitragem',
    XI: 'Ausência de legitimidade ou de interesse processual',
    XII: 'Falta de caução ou de outra prestação que a lei exige como preliminar',
    XIII: 'Indevida concessão do benefício de gratuidade de justiça'
  },

  // PREJUDICIAIS DE MÉRITO
  prejudiciais: {
    prescricao: 'Extinção da pretensão pelo decurso do tempo',
    decadencia: 'Extinção do próprio direito pelo não exercício',
    outras: 'Conforme o caso concreto'
  },

  // ESTRUTURA TÉCNICA
  estrutura: `
I. SÍNTESE DA INICIAL
   - Resumo objetivo da pretensão autoral
   - Pedidos formulados

II. DAS PRELIMINARES (art. 337, CPC)
   A. [Preliminar específica]
   B. [Preliminar específica]

III. DAS PREJUDICIAIS DE MÉRITO
   A. Da Prescrição
   B. Da Decadência

IV. DO MÉRITO
   1. Impugnação Específica dos Fatos
      1.1. [Fato impugnado]
      1.2. [Fato impugnado]

   2. Da Versão dos Fatos
      - Narrativa da perspectiva do réu

   3. Do Direito
      3.1. Fundamentação legal
      3.2. Jurisprudência favorável
      3.3. Doutrina

V. DOS PEDIDOS
   A. Acolhimento das preliminares
   B. Reconhecimento das prejudiciais
   C. IMPROCEDÊNCIA TOTAL dos pedidos
   D. Subsidiariamente: improcedência parcial
   E. Condenação em honorários sucumbenciais`,

  // TÉCNICAS DE DEFESA
  tecnicas: {
    impugnacao_especifica: {
      regra: 'Art. 341, CPC - Ônus de impugnar especificamente cada fato',
      consequencia: 'Fatos não impugnados presumem-se verdadeiros',
      excecoes: [
        'Defensor público ou curador especial (art. 341, parágrafo único)',
        'Fatos que dependem de prova documental',
        'Fatos contrários ao confessado'
      ]
    },
    defesa_indireta: {
      conceito: 'Admite os fatos, mas opõe outros que modificam, extinguem ou impedem',
      exemplos: ['Pagamento', 'Compensação', 'Novação', 'Prescrição']
    },
    negativa_geral: {
      quando_usar: 'Defensor público ou curador especial',
      efeito: 'Não gera presunção de veracidade'
    }
  },

  // DOCUMENTOS
  documentos: [
    'Procuração ad judicia',
    'Documentos que infirmem a pretensão autoral',
    'Comprovantes de pagamento (se alegado)',
    'Contratos e aditivos',
    'Correspondências relevantes'
  ],

  // CHECKLIST
  checklist: [
    'Todas as preliminares aplicáveis arguidas',
    'Prejudiciais de mérito verificadas',
    'Cada fato da inicial foi impugnado especificamente',
    'Versão dos fatos apresentada de forma clara',
    'Fundamentação jurídica completa',
    'Jurisprudência verificada via web_search',
    'Pedidos escalonados (principal e subsidiário)',
    'Prazo verificado (15 dias, art. 335)'
  ]
};

// ============================================================
// SEÇÃO 5: ALEGAÇÕES FINAIS CRIMINAIS
// ============================================================
export const PROMPT_ALEGACOES_FINAIS = {
  nome: 'Alegações Finais Criminais',
  versao: '2.0',
  categoria: 'criminal',

  // FUNDAMENTOS
  fundamentos: {
    cpp: {
      'Art. 403': 'Prazo de 5 dias após instrução',
      'Art. 404': 'Ordenadas diligências, novo prazo de 5 dias',
      'Art. 381': 'Requisitos da sentença (fundamentação)'
    }
  },

  // ESTRUTURA TÉCNICA
  estrutura: `
I. SÍNTESE ACUSATÓRIA
   - Resumo da denúncia/queixa
   - Tipificação imputada
   - Penas cominadas

II. DA INSTRUÇÃO CRIMINAL
   - Resumo das provas produzidas
   - Depoimentos relevantes
   - Laudos periciais
   - Documentos juntados

III. DAS PRELIMINARES
   A. Nulidades (se houver)
   B. Prescrição (se aplicável)
   C. Outras questões processuais

IV. DO MÉRITO
   1. Da Autoria
      - Análise das provas de autoria
      - Versão defensiva

   2. Da Materialidade
      - Existência ou não do fato
      - Provas materiais

   3. Da Tipicidade
      - Subsunção ou não ao tipo penal
      - Atipicidade (se aplicável)

   4. Das Excludentes
      - Ilicitude (legítima defesa, estado de necessidade)
      - Culpabilidade (inexigibilidade, erro)

V. DA DOSIMETRIA (em caso de condenação)
   1. Primeira Fase - Circunstâncias Judiciais (art. 59, CP)
   2. Segunda Fase - Agravantes e Atenuantes
   3. Terceira Fase - Causas de Aumento e Diminuição
   4. Regime Inicial
   5. Substituição da PPL

VI. DOS PEDIDOS
   A. PRINCIPAL: ABSOLVIÇÃO
      - Com base no art. 386, [inciso], CPP

   B. SUBSIDIÁRIOS:
      - Desclassificação para tipo mais brando
      - Reconhecimento de atenuantes/minorantes
      - Fixação da pena no mínimo legal
      - Regime mais brando
      - Substituição da PPL`,

  // HIPÓTESES DE ABSOLVIÇÃO (art. 386 CPP)
  absolvicao: {
    I: 'Estar provada a inexistência do fato',
    II: 'Não haver prova da existência do fato',
    III: 'Não constituir o fato infração penal',
    IV: 'Estar provado que o réu não concorreu para a infração penal',
    V: 'Não existir prova de ter o réu concorrido para a infração penal',
    VI: 'Existirem circunstâncias que excluam o crime ou isentem o réu de pena, ou mesmo se houver fundada dúvida sobre sua existência',
    VII: 'Não existir prova suficiente para a condenação'
  },

  // TESES DEFENSIVAS COMUNS
  teses: {
    autoria: [
      'Negativa de autoria',
      'Autoria diversa',
      'Versão inconsistente da acusação'
    ],
    materialidade: [
      'Inexistência do fato',
      'Prova material insuficiente',
      'Laudo inconclusivo'
    ],
    tipicidade: [
      'Atipicidade da conduta',
      'Princípio da insignificância',
      'Crime impossível'
    ],
    ilicitude: [
      'Legítima defesa',
      'Estado de necessidade',
      'Estrito cumprimento do dever legal',
      'Exercício regular de direito'
    ],
    culpabilidade: [
      'Inexigibilidade de conduta diversa',
      'Coação moral irresistível',
      'Erro de proibição',
      'Inimputabilidade'
    ],
    prova: [
      'In dubio pro reo',
      'Prova exclusivamente testemunhal frágil',
      'Contradições nos depoimentos',
      'Ausência de prova técnica'
    ]
  }
};

// ============================================================
// SEÇÃO 6: APELAÇÃO CRIMINAL
// ============================================================
export const PROMPT_APELACAO_CRIMINAL = {
  nome: 'Apelação Criminal',
  versao: '2.0',
  categoria: 'criminal',

  fundamentos: {
    cpp: {
      'Art. 593': 'Hipóteses de cabimento',
      'Art. 600': 'Prazo de 8 dias para razões',
      'Art. 601': 'Prazo de 8 dias para contrarrazões'
    }
  },

  estrutura: `
I. TEMPESTIVIDADE
   - Data da intimação da sentença
   - Data da interposição
   - Prazo legal (5 dias)

II. DA SENTENÇA RECORRIDA
   - Síntese da decisão
   - Fundamentação adotada
   - Dispositivo

III. DO CABIMENTO
   - Art. 593, [inciso], CPP
   - Interesse recursal

IV. DAS RAZÕES RECURSAIS

   A. PRELIMINARES (se houver)
      - Nulidades processuais
      - Cerceamento de defesa

   B. DO MÉRITO
      1. Da Autoria
      2. Da Materialidade
      3. Da Tipicidade
      4. Das Provas
      5. In dubio pro reo

   C. DA DOSIMETRIA (se condenação mantida)
      1. Circunstâncias judiciais
      2. Agravantes/atenuantes
      3. Causas de aumento/diminuição
      4. Regime inicial
      5. Substituição

V. DOS PEDIDOS
   A. PRINCIPAL: Reforma da sentença para ABSOLVER
   B. SUBSIDIÁRIOS:
      - Desclassificação
      - Redução da pena
      - Regime mais brando
      - Substituição da PPL`
};

// ============================================================
// SEÇÃO 7: RESPOSTA À ACUSAÇÃO
// ============================================================
export const PROMPT_RESPOSTA_ACUSACAO = {
  nome: 'Resposta à Acusação',
  versao: '2.0',
  categoria: 'criminal',

  fundamentos: {
    cpp: {
      'Art. 396': 'Oferecimento da resposta',
      'Art. 396-A': 'Conteúdo obrigatório',
      'Art. 397': 'Absolvição sumária'
    }
  },

  // ABSOLVIÇÃO SUMÁRIA (art. 397 CPP)
  absolvicao_sumaria: {
    I: 'Existência manifesta de causa excludente da ilicitude do fato',
    II: 'Existência manifesta de causa excludente da culpabilidade do agente (salvo inimputabilidade)',
    III: 'Que o fato narrado evidentemente não constitui crime',
    IV: 'Extinta a punibilidade do agente'
  },

  estrutura: `
I. SÍNTESE DA ACUSAÇÃO
   - Fatos imputados
   - Tipificação
   - Penas cominadas

II. DAS PRELIMINARES
   A. Inépcia da Denúncia/Queixa
   B. Ilegitimidade de Parte
   C. Coisa Julgada
   D. Prescrição
   E. Ausência de Justa Causa
   F. Nulidades

III. DA ABSOLVIÇÃO SUMÁRIA (art. 397, CPP)
   - Demonstrar enquadramento em uma das hipóteses

IV. DO MÉRITO (breve)
   - Versão defensiva dos fatos
   - Tese central

V. DAS PROVAS A PRODUZIR
   - Oitiva de testemunhas (rol de até 8)
   - Perícias necessárias
   - Documentos

VI. DOS PEDIDOS
   A. Rejeição da denúncia/queixa (se preliminar acolhida)
   B. Absolvição sumária (art. 397)
   C. Subsidiariamente: prosseguimento com produção de provas`,

  prazo: '10 dias',
  testemunhas: 'até 8'
};

// ============================================================
// SEÇÃO 8: REVISÃO CRIMINAL
// ============================================================
export const PROMPT_REVISAO_CRIMINAL = {
  nome: 'Revisão Criminal',
  versao: '2.0',
  categoria: 'criminal',

  fundamentos: {
    cpp: {
      'Art. 621': 'Hipóteses de cabimento',
      'Art. 622': 'Legitimados',
      'Art. 626': 'Procedência e efeitos'
    }
  },

  hipoteses: {
    I: 'Sentença contrária ao texto expresso da lei penal ou à evidência dos autos',
    II: 'Sentença fundada em depoimentos, exames ou documentos comprovadamente falsos',
    III: 'Após a sentença, descobrirem-se novas provas de inocência do condenado ou de circunstância que determine ou autorize diminuição especial da pena'
  },

  estrutura: `
I. DA CONDENAÇÃO RESCINDENDA
   - Processo originário
   - Sentença/acórdão condenatório
   - Trânsito em julgado

II. DO CABIMENTO
   - Art. 621, [inciso], CPP
   - Demonstração da hipótese

III. DOS FATOS
   - Narrativa do caso
   - Erro apontado

IV. DO DIREITO
   - Fundamentação jurídica
   - Precedentes favoráveis

V. DOS PEDIDOS
   A. Procedência para:
      - Absolver o requerente
      - OU anular o processo
      - OU modificar a pena
   B. Indenização (se aplicável)`,

  legitimados: [
    'O próprio réu (condenado)',
    'Procurador legalmente habilitado',
    'Cônjuge, ascendente, descendente ou irmão (em caso de morte)'
  ],

  prazo: 'Não há - pode ser ajuizada a qualquer tempo, mesmo após cumprimento ou extinção da pena',
  competencia: 'Tribunal que proferiu a condenação'
};

// ============================================================
// SEÇÃO 9: EMBARGOS DE DECLARAÇÃO
// ============================================================
export const PROMPT_EMBARGOS_DECLARACAO = {
  nome: 'Embargos de Declaração',
  versao: '2.0',
  categoria: 'civel',

  fundamentos: {
    cpc: {
      'Art. 1.022': 'Cabimento',
      'Art. 1.023': 'Prazo de 5 dias',
      'Art. 1.024': 'Efeito interruptivo',
      'Art. 1.025': 'Prequestionamento ficto'
    }
  },

  hipoteses: {
    I: 'Esclarecer OBSCURIDADE',
    II: 'Eliminar CONTRADIÇÃO',
    III: 'Suprir OMISSÃO de ponto ou questão sobre o qual devia se pronunciar o juiz',
    'Erro material': 'Corrigir ERRO MATERIAL evidente'
  },

  estrutura: `
I. DA TEMPESTIVIDADE
   - Data da publicação/intimação
   - Data da oposição
   - Prazo legal (5 dias)

II. DO CABIMENTO
   - Hipótese do art. 1.022, [inciso], CPC
   - Demonstração do vício

III. DA OBSCURIDADE/CONTRADIÇÃO/OMISSÃO/ERRO MATERIAL

   [Se OBSCURIDADE]
   - Indicar o trecho obscuro
   - Explicar a dificuldade de compreensão
   - Requerer esclarecimento específico

   [Se CONTRADIÇÃO]
   - Indicar os trechos contraditórios
   - Demonstrar a incompatibilidade
   - Requerer harmonização

   [Se OMISSÃO]
   - Indicar o ponto não analisado
   - Demonstrar que foi suscitado
   - Requerer manifestação expressa

   [Se ERRO MATERIAL]
   - Indicar o erro
   - Demonstrar sua evidência
   - Requerer correção

IV. DO PREQUESTIONAMENTO (se para fins recursais)
   - Indicar dispositivos legais/constitucionais
   - Requerer manifestação expressa

V. DOS PEDIDOS
   A. Conhecimento e provimento
   B. Sanamento do vício apontado
   C. Efeitos infringentes/modificativos (se aplicável)`,

  prequestionamento: {
    expresso: 'Indicar expressamente os dispositivos legais',
    requisitar: 'Requerer manifestação explícita sobre cada ponto',
    ficto: 'Art. 1.025, CPC - se embargos rejeitados, consideram-se incluídos no acórdão os elementos suscitados'
  },

  prazo: '5 dias',
  efeito: 'Interruptivo - reinicia prazo de outros recursos'
};

// ============================================================
// SEÇÃO 10: AGRAVO INTERNO
// ============================================================
export const PROMPT_AGRAVO_INTERNO = {
  nome: 'Agravo Interno',
  versao: '2.0',
  categoria: 'civel',

  fundamentos: {
    cpc: {
      'Art. 1.021': 'Cabimento e procedimento',
      'Art. 1.021, §2º': 'Prazo de 15 dias'
    }
  },

  estrutura: `
I. DA TEMPESTIVIDADE
   - Data da publicação da decisão
   - Data da interposição
   - Prazo legal (15 dias)

II. DO CABIMENTO
   - Decisão monocrática do relator
   - Art. 1.021, CPC

III. DA DECISÃO AGRAVADA
   - Síntese do decidido
   - Fundamentos adotados
   - Dispositivo

IV. DAS RAZÕES DO INCONFORMISMO
   1. [Primeiro ponto de irresignação]
      - Fundamentação específica
      - Jurisprudência favorável

   2. [Segundo ponto de irresignação]
      - Fundamentação específica
      - Jurisprudência favorável

V. DOS PEDIDOS
   A. Reconsideração pelo relator
   B. Provimento pelo colegiado
   C. Reforma da decisão para [pedido específico]`,

  prazo: '15 dias',
  observacoes: [
    'Não cabe contra decisão que inadmite REsp/RE na origem (usar agravo em REsp/RE)',
    'Multa de 1% a 5% se manifestamente inadmissível ou improcedente (art. 1.021, §4º)'
  ]
};

// ============================================================
// FUNÇÕES DE EXPORTAÇÃO
// ============================================================
export function obterPromptCompleto(tipo) {
  const prompts = {
    master: MASTER_ROM,
    peticao_inicial: PROMPT_PETICAO_INICIAL,
    habeas_corpus: PROMPT_HABEAS_CORPUS,
    contestacao: PROMPT_CONTESTACAO,
    alegacoes_finais: PROMPT_ALEGACOES_FINAIS,
    apelacao_criminal: PROMPT_APELACAO_CRIMINAL,
    resposta_acusacao: PROMPT_RESPOSTA_ACUSACAO,
    revisao_criminal: PROMPT_REVISAO_CRIMINAL,
    embargos_declaracao: PROMPT_EMBARGOS_DECLARACAO,
    agravo_interno: PROMPT_AGRAVO_INTERNO
  };

  return prompts[tipo] || null;
}

export function listarPromptsDisponiveis() {
  return [
    { id: 'master', nome: 'Master ROM V3.0', categoria: 'sistema' },
    { id: 'peticao_inicial', nome: 'Petição Inicial Cível', categoria: 'civel' },
    { id: 'habeas_corpus', nome: 'Habeas Corpus', categoria: 'criminal' },
    { id: 'contestacao', nome: 'Contestação Cível', categoria: 'civel' },
    { id: 'alegacoes_finais', nome: 'Alegações Finais Criminais', categoria: 'criminal' },
    { id: 'apelacao_criminal', nome: 'Apelação Criminal', categoria: 'criminal' },
    { id: 'resposta_acusacao', nome: 'Resposta à Acusação', categoria: 'criminal' },
    { id: 'revisao_criminal', nome: 'Revisão Criminal', categoria: 'criminal' },
    { id: 'embargos_declaracao', nome: 'Embargos de Declaração', categoria: 'civel' },
    { id: 'agravo_interno', nome: 'Agravo Interno', categoria: 'civel' }
  ];
}

export function gerarInstrucaoCompleta(tipo) {
  const prompt = obterPromptCompleto(tipo);
  if (!prompt) return null;

  return `
================================================================================
PROMPT: ${prompt.nome.toUpperCase()}
================================================================================
VERSÃO: ${prompt.versao} | CATEGORIA: ${prompt.categoria.toUpperCase()}
SISTEMA: ROM V3.0

AVISO CRÍTICO: Toda jurisprudência deve ser verificada via web_search
antes de citação. NUNCA citar precedente sem verificar.

USAR EM CONJUNTO COM:
- MASTER_ROM (formatação e estilo)
- Verificação de precedentes via web_search

${prompt.estrutura || ''}

FORMATAÇÃO OBRIGATÓRIA:
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
- ZERO travessões decorativos

CHECKLIST:
${prompt.checklist ? JSON.stringify(prompt.checklist, null, 2) : '[ ] Estrutura completa\n[ ] Fundamentação adequada\n[ ] Pedidos claros\n[ ] Formatação profissional'}

================================================================================
`;
}

export default {
  MASTER_ROM,
  PROMPT_PETICAO_INICIAL,
  PROMPT_HABEAS_CORPUS,
  PROMPT_CONTESTACAO,
  PROMPT_ALEGACOES_FINAIS,
  PROMPT_APELACAO_CRIMINAL,
  PROMPT_RESPOSTA_ACUSACAO,
  PROMPT_REVISAO_CRIMINAL,
  PROMPT_EMBARGOS_DECLARACAO,
  PROMPT_AGRAVO_INTERNO,
  obterPromptCompleto,
  listarPromptsDisponiveis,
  gerarInstrucaoCompleta
};
