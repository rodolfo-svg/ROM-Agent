/**
 * Sistema de Análise de Direito Intertemporal
 *
 * Responsável por:
 * 1. Determinar qual norma aplicar baseado na data dos fatos
 * 2. Verificar aplicabilidade ao ramo do direito
 * 3. Analisar natureza jurídica do processo
 * 4. Verificar instância recursal
 * 5. Identificar aplicação subsidiária
 *
 * PRINCÍPIO: "Tempus regit actum" - A lei do tempo rege o ato
 */

class DireitoIntertemporal {
  constructor() {
    // Marcos temporais importantes da legislação brasileira
    this.marcosLegislativos = {
      'CPC': [
        { inicio: '1973-01-01', fim: '2016-03-17', lei: 'Lei 5.869/1973', nome: 'CPC/1973' },
        { inicio: '2016-03-18', fim: null, lei: 'Lei 13.105/2015', nome: 'CPC/2015' }
      ],
      'CC': [
        { inicio: '1916-01-01', fim: '2003-01-10', lei: 'Lei 3.071/1916', nome: 'CC/1916' },
        { inicio: '2003-01-11', fim: null, lei: 'Lei 10.406/2002', nome: 'CC/2002' }
      ],
      'CPP': [
        { inicio: '1942-01-01', fim: null, lei: 'Decreto-Lei 3.689/1941', nome: 'CPP/1941', nota: 'Com diversas alterações' }
      ],
      'CP': [
        { inicio: '1942-01-01', fim: null, lei: 'Decreto-Lei 2.848/1940', nome: 'CP/1940', nota: 'Com diversas alterações' }
      ],
      'CLT': [
        { inicio: '1943-05-01', fim: null, lei: 'Decreto-Lei 5.452/1943', nome: 'CLT/1943', nota: 'Com Reforma Trabalhista (Lei 13.467/2017)' }
      ]
    };

    // Alterações legislativas importantes
    this.alteracoesImportantes = [
      {
        lei: 'Lei 13.467/2017',
        tipo: 'Reforma Trabalhista',
        vigencia: '2017-11-11',
        impacto: 'Alterou profundamente a CLT'
      },
      {
        lei: 'Lei 13.105/2015',
        tipo: 'Novo CPC',
        vigencia: '2016-03-18',
        impacto: 'Revogou CPC/1973 completamente'
      },
      {
        lei: 'Lei 11.719/2008',
        tipo: 'Reforma do CPP',
        vigencia: '2008-08-22',
        impacto: 'Alterou procedimento ordinário criminal'
      }
    ];

    // Ramos do direito e suas codificações
    this.ramosDireito = {
      'civil': {
        material: ['CC/2002', 'CC/1916'],
        processual: ['CPC/2015', 'CPC/1973'],
        leis_especiais: ['CDC', 'Lei de Locações', 'Lei de Falências']
      },
      'penal': {
        material: ['CP/1940'],
        processual: ['CPP/1941'],
        leis_especiais: ['Lei de Drogas', 'Lei Maria da Penha', 'ECA']
      },
      'trabalhista': {
        material: ['CLT/1943'],
        processual: ['CLT/1943', 'CPC subsidiário'],
        leis_especiais: ['Lei 13.467/2017']
      },
      'tributario': {
        material: ['CTN'],
        processual: ['CPC', 'Lei de Execuções Fiscais'],
        leis_especiais: []
      }
    };

    // Natureza jurídica dos processos
    this.naturezasProcesso = {
      'conhecimento': {
        fases: ['petição inicial', 'contestação', 'instrução', 'sentença'],
        normas: ['CPC Arts. 318-512']
      },
      'execucao': {
        fases: ['petição inicial', 'citação', 'penhora', 'expropriação'],
        normas: ['CPC Arts. 513-538 (judicial)', 'CPC Arts. 771-925 (extrajudicial)']
      },
      'cautelar': {
        fases: ['tutela provisória'],
        normas: ['CPC Arts. 294-311']
      }
    };

    // Instâncias recursais
    this.instancias = {
      'primeira': {
        juizo: 'Juiz de Direito / Juiz Federal',
        recursos_cabiveis: ['apelação', 'agravo de instrumento'],
        competencia: 'Causas originariamente'
      },
      'segunda': {
        juizo: 'TJ / TRF / TRT',
        recursos_cabiveis: ['recurso especial', 'recurso extraordinário', 'embargos de declaração'],
        competencia: 'Recursos de 1ª instância'
      },
      'superior': {
        juizo: 'STJ',
        recursos_cabiveis: ['agravo interno', 'embargos de declaração', 'recurso extraordinário'],
        competencia: 'Recurso especial (violação lei federal)'
      },
      'suprema': {
        juizo: 'STF',
        recursos_cabiveis: ['agravo interno', 'embargos de declaração'],
        competencia: 'Recurso extraordinário (questão constitucional)'
      }
    };
  }

  /**
   * Determina qual legislação aplicar baseado na data dos fatos
   * @param {string} dataDosFatos - Data no formato YYYY-MM-DD
   * @param {string} tipo - Tipo de legislação (CPC, CC, CPP, etc.)
   * @returns {Object} Informações sobre a legislação aplicável
   */
  determinarLegislacaoAplicavel(dataDosFatos, tipo) {
    const data = new Date(dataDosFatos);
    const marcos = this.marcosLegislativos[tipo];

    if (!marcos) {
      return {
        erro: true,
        mensagem: `Tipo de legislação '${tipo}' não encontrado`
      };
    }

    for (const marco of marcos) {
      const dataInicio = new Date(marco.inicio);
      const dataFim = marco.fim ? new Date(marco.fim) : new Date();

      if (data >= dataInicio && data <= dataFim) {
        return {
          aplicavel: true,
          legislacao: marco.nome,
          lei: marco.lei,
          vigencia: {
            inicio: marco.inicio,
            fim: marco.fim || 'Vigente'
          },
          observacao: marco.nota || null,
          fundamentacao: `Aplica-se ${marco.nome} pois os fatos ocorreram em ${dataDosFatos}, quando esta legislação estava em vigor (vigência: ${marco.inicio} até ${marco.fim || 'atual'}).`
        };
      }
    }

    return {
      erro: true,
      mensagem: `Não foi possível determinar legislação aplicável para ${tipo} na data ${dataDosFatos}`
    };
  }

  /**
   * Analisa se norma é aplicável ao caso concreto
   * @param {Object} caso - Dados do caso
   * @returns {Object} Análise completa
   */
  analisarAplicabilidade(caso) {
    const analise = {
      dataDosFatos: caso.dataDosFatos,
      ramoDireito: caso.ramoDireito,
      naturezaProcesso: caso.naturezaProcesso,
      instancia: caso.instancia,
      legislacaoAplicavel: {},
      aplicacaoSubsidiaria: [],
      direitoIntertemporal: {},
      recomendacoes: []
    };

    // 1. DIREITO INTERTEMPORAL - Determinar legislação pela data dos fatos
    if (caso.dataDosFatos) {
      // Direito Material
      if (caso.ramoDireito === 'civil') {
        analise.legislacaoAplicavel.material = this.determinarLegislacaoAplicavel(caso.dataDosFatos, 'CC');
        analise.direitoIntertemporal.material = `⚠️ ATENÇÃO: Os fatos ocorreram em ${caso.dataDosFatos}. Aplicar ${analise.legislacaoAplicavel.material.legislacao} (direito material).`;
      } else if (caso.ramoDireito === 'penal') {
        analise.legislacaoAplicavel.material = this.determinarLegislacaoAplicavel(caso.dataDosFatos, 'CP');
        analise.direitoIntertemporal.material = `⚠️ ATENÇÃO: Crime ocorreu em ${caso.dataDosFatos}. Aplicar ${analise.legislacaoAplicavel.material.legislacao} vigente à época.`;

        // Princípio da lex mitior (lei mais benéfica)
        analise.recomendacoes.push({
          tipo: 'DIREITO PENAL',
          texto: 'Verificar se lei posterior é mais benéfica ao réu (Art. 5º, XL, CF - lex mitior). Em caso positivo, aplicar retroativamente.'
        });
      }

      // Direito Processual - data da propositura da ação
      if (caso.dataAjuizamento) {
        analise.legislacaoAplicavel.processual = this.determinarLegislacaoAplicavel(caso.dataAjuizamento, 'CPC');
        analise.direitoIntertemporal.processual = `⚠️ ATENÇÃO: Ação ajuizada em ${caso.dataAjuizamento}. Aplicar ${analise.legislacaoAplicavel.processual.legislacao} (direito processual).`;

        // Regra: Direito processual aplica-se imediatamente (não retroage)
        analise.recomendacoes.push({
          tipo: 'DIREITO PROCESSUAL',
          texto: `Lei processual aplica-se aos processos em curso. Verificar Art. 14 do CPC/2015 para regras de transição entre CPC/1973 e CPC/2015.`
        });
      }
    }

    // 2. RAMO DO DIREITO - Verificar aplicabilidade
    if (caso.ramoDireito) {
      const ramo = this.ramosDireito[caso.ramoDireito.toLowerCase()];
      if (ramo) {
        analise.ramoDireito = {
          material: ramo.material,
          processual: ramo.processual,
          leisEspeciais: ramo.leis_especiais
        };

        // Aplicação subsidiária
        if (ramo.processual.includes('CPC subsidiário')) {
          analise.aplicacaoSubsidiaria.push({
            norma: 'CPC',
            fundamento: 'Art. 15 do CPC - Aplica-se subsidiariamente a processos trabalhistas, penais, etc.',
            condicao: 'Quando não houver norma específica na legislação especial'
          });
        }
      }
    }

    // 3. NATUREZA JURÍDICA DO PROCESSO
    if (caso.naturezaProcesso) {
      const natureza = this.naturezasProcesso[caso.naturezaProcesso.toLowerCase()];
      if (natureza) {
        analise.naturezaProcesso = {
          tipo: caso.naturezaProcesso,
          fases: natureza.fases,
          normasAplicaveis: natureza.normas
        };
      }
    }

    // 4. INSTÂNCIA RECURSAL
    if (caso.instancia) {
      const instancia = this.instancias[caso.instancia.toLowerCase()];
      if (instancia) {
        analise.instancia = {
          juizo: instancia.juizo,
          recursosPodem: instancia.recursos_cabiveis,
          competencia: instancia.competencia
        };

        // Recomendações específicas por instância
        if (caso.instancia.toLowerCase() === 'superior' || caso.instancia.toLowerCase() === 'suprema') {
          analise.recomendacoes.push({
            tipo: 'TRIBUNAIS SUPERIORES',
            texto: 'Fundamentar apenas em violação de lei federal (STJ) ou questão constitucional (STF). Não rediscutir fatos (Súmula 7/STJ).'
          });
        }
      }
    }

    // 5. RECOMENDAÇÕES GERAIS
    analise.recomendacoes.push({
      tipo: 'DIREITO INTERTEMPORAL',
      texto: 'Sempre verificar: (1) Lei vigente na data dos FATOS para direito material; (2) Lei vigente na data do AJUIZAMENTO para direito processual.'
    });

    return analise;
  }

  /**
   * Gera fundamentação sobre direito intertemporal
   * @param {string} dataDosFatos - Data dos fatos
   * @param {string} dataAjuizamento - Data do ajuizamento
   * @param {string} ramoDireito - Ramo do direito
   * @returns {string} Texto fundamentado
   */
  gerarFundamentacaoDireitoIntertemporal(dataDosFatos, dataAjuizamento, ramoDireito) {
    let fundamentacao = '\n## ⚖️ DIREITO INTERTEMPORAL\n\n';

    // Direito Material
    const legislacaoMaterial = ramoDireito === 'civil' ?
      this.determinarLegislacaoAplicavel(dataDosFatos, 'CC') :
      this.determinarLegislacaoAplicavel(dataDosFatos, 'CP');

    fundamentacao += `### Direito Material\n\n`;
    fundamentacao += `Os fatos geradores da presente demanda ocorreram em **${dataDosFatos}**.\n\n`;
    fundamentacao += `Aplica-se, portanto, o **${legislacaoMaterial.legislacao}** (${legislacaoMaterial.lei}), que estava em vigor à época dos fatos.\n\n`;
    fundamentacao += `**Fundamento**: *Tempus regit actum* - O direito material aplicável é o vigente no momento da ocorrência dos fatos, salvo disposição expressa em contrário.\n\n`;

    // Direito Processual
    if (dataAjuizamento) {
      const legislacaoProcessual = this.determinarLegislacaoAplicavel(dataAjuizamento, 'CPC');

      fundamentacao += `### Direito Processual\n\n`;
      fundamentacao += `A presente ação foi ajuizada em **${dataAjuizamento}**.\n\n`;
      fundamentacao += `Aplica-se, portanto, o **${legislacaoProcessual.legislacao}** (${legislacaoProcessual.lei}) quanto às normas processuais.\n\n`;
      fundamentacao += `**Fundamento**: A lei processual tem aplicação imediata aos processos em curso (Art. 14 do CPC/2015).\n\n`;

      // Se houve transição CPC/1973 → CPC/2015
      if (new Date(dataAjuizamento) < new Date('2016-03-18') && legislacaoProcessual.nome === 'CPC/1973') {
        fundamentacao += `⚠️ **ATENÇÃO - TRANSIÇÃO LEGISLATIVA**: Como a ação foi ajuizada antes de 18/03/2016, aplica-se o CPC/1973. Porém, atos processuais praticados após 18/03/2016 devem observar o CPC/2015 (Art. 14, parágrafo único).\n\n`;
      }
    }

    // Se penal, adicionar observação sobre lex mitior
    if (ramoDireito === 'penal') {
      fundamentacao += `### ⚖️ Princípio da Lex Mitior (Direito Penal)\n\n`;
      fundamentacao += `**Art. 5º, XL, CF**: "A lei penal não retroagirá, salvo para beneficiar o réu."\n\n`;
      fundamentacao += `Ainda que os fatos tenham ocorrido sob vigência de lei anterior, **deve-se verificar se lei posterior é mais benéfica ao réu**. Em caso positivo, aplica-se retroativamente a lei mais favorável.\n\n`;
    }

    return fundamentacao;
  }

  /**
   * Verifica aplicação subsidiária de normas
   * @param {string} ramoDireitoPrincipal - Ramo principal
   * @returns {Array} Lista de normas subsidiárias aplicáveis
   */
  verificarAplicacaoSubsidiaria(ramoDireitoPrincipal) {
    const subsidiarias = [];

    if (ramoDireitoPrincipal === 'trabalhista') {
      subsidiarias.push({
        norma: 'CPC',
        fundamento: 'Art. 15 do CPC e Art. 769 da CLT',
        texto: 'Nos casos omissos na CLT, aplica-se subsidiariamente o CPC.'
      });
    }

    if (ramoDireitoPrincipal === 'penal') {
      subsidiarias.push({
        norma: 'CPC',
        fundamento: 'Art. 3º do CPP',
        texto: 'A lei processual penal admitirá interpretação extensiva e aplicação analógica, bem como o suplemento dos princípios gerais de direito.'
      });
    }

    if (ramoDireitoPrincipal === 'tributario') {
      subsidiarias.push({
        norma: 'CPC',
        fundamento: 'Art. 15 do CPC',
        texto: 'Aplica-se subsidiariamente o CPC aos processos de execução fiscal (Lei 6.830/1980).'
      });
    }

    return subsidiarias;
  }
}

module.exports = DireitoIntertemporal;
