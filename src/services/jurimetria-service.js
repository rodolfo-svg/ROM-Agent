/**
 * ROM Agent - Serviço de Jurimetria
 * Análise quantitativa e qualitativa de decisões judiciais por magistrado
 *
 * FUNCIONALIDADES:
 * - Busca por juiz/relator/ministro específico (prevento)
 * - Análise de padrão de julgamento
 * - Extração de inteiro teor (não só ementa)
 * - Cotejamento analítico
 * - Distinguishing
 * - Validação cruzada (DataJud + JusBrasil + Jus.IA)
 *
 * @version 1.0.0
 */

import { BEDROCK_TOOLS, executeTool } from '../modules/bedrock-tools.js';
import { conversar } from '../modules/bedrock.js';

class JurimetriaService {
  constructor() {
    this.fontes = {
      datajud: 'consultar_cnj_datajud',
      jusbrasil: 'pesquisar_jusbrasil',
      jurisprudencia: 'pesquisar_jurisprudencia'
    };

    // Cache de análises para evitar reprocessamento
    this.cache = new Map();
  }

  /**
   * Analisar padrão de julgamento de magistrado específico
   *
   * @param {object} params - Parâmetros da análise
   * @returns {Promise<object>} Análise jurímétrica completa
   */
  async analisarMagistrado(params) {
    const {
      nomeMagistrado,     // Nome do juiz/relator/ministro
      materia,            // Matéria jurídica
      tribunal,           // Tribunal (TJRJ, STJ, etc)
      tipoDecisao = 'todas', // sentenca, acórdão, monocratica
      periodo = null,     // { inicio: 'YYYY-MM-DD', fim: 'YYYY-MM-DD' }
      limiteBuscas = 20   // Máximo de decisões a analisar
    } = params;

    console.log(`🔍 [Jurimetria] Iniciando análise do magistrado: ${nomeMagistrado}`);
    console.log(`   Matéria: ${materia}`);
    console.log(`   Tribunal: ${tribunal}`);

    try {
      // ETAPA 1: Buscar decisões do magistrado
      const decisoes = await this.buscarDecisoesMagistrado({
        nomeMagistrado,
        materia,
        tribunal,
        tipoDecisao,
        periodo,
        limite: limiteBuscas
      });

      if (decisoes.length === 0) {
        return {
          sucesso: false,
          mensagem: `Nenhuma decisão encontrada para ${nomeMagistrado} sobre ${materia}`
        };
      }

      console.log(`✅ [Jurimetria] ${decisoes.length} decisões encontradas`);

      // ETAPA 2: Validar decisões (double check)
      const decisoesValidadas = await this.validarDecisoesCruzadas(decisoes);

      console.log(`✅ [Jurimetria] ${decisoesValidadas.length} decisões validadas`);

      // ETAPA 3: Extrair inteiro teor
      const decisoesCompletas = await this.extrairInteiroTeor(decisoesValidadas);

      // ETAPA 4: Análise jurímétrica
      const analiseJurimetrica = await this.analisarPadraoJulgamento({
        magistrado: nomeMagistrado,
        decisoes: decisoesCompletas,
        materia
      });

      // ETAPA 5: Identificar contradições (se houver)
      const contradicoes = await this.identificarContradicoes(decisoesCompletas);

      return {
        sucesso: true,
        magistrado: nomeMagistrado,
        tribunal,
        materia,
        totalDecisoes: decisoes.length,
        decisoesValidadas: decisoesValidadas.length,
        analiseJurimetrica,
        decisoesAnalisadas: decisoesCompletas,
        contradicoes,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ [Jurimetria] Erro:', error);
      return {
        sucesso: false,
        erro: error.message
      };
    }
  }

  /**
   * Buscar decisões de magistrado específico
   */
  async buscarDecisoesMagistrado(params) {
    const {
      nomeMagistrado,
      materia,
      tribunal,
      tipoDecisao,
      periodo,
      limite
    } = params;

    const decisoes = [];

    // FONTE 1: DataJud CNJ
    try {
      console.log('   📡 Buscando no DataJud CNJ...');

      const queryDataJud = `magistrado:"${nomeMagistrado}" AND ${materia}`;

      const resultadosDataJud = await executeTool('consultar_cnj_datajud', {
        numeroProcesso: null,
        query: queryDataJud,
        tribunal
      });

      if (resultadosDataJud.sucesso && resultadosDataJud.dados) {
        const decisoesDataJud = this.parseDecisoes(resultadosDataJud.dados, 'datajud');
        decisoes.push(...decisoesDataJud.slice(0, Math.floor(limite / 2)));
      }
    } catch (err) {
      console.warn('   ⚠️ Erro no DataJud:', err.message);
    }

    // FONTE 2: JusBrasil
    try {
      console.log('   📡 Buscando no JusBrasil...');

      const queryJusBrasil = `"${nomeMagistrado}" ${materia} ${tribunal}`;

      const resultadosJusBrasil = await executeTool('pesquisar_jusbrasil', {
        termo: queryJusBrasil,
        tipo: tipoDecisao === 'todas' ? 'jurisprudencia' : tipoDecisao,
        limite: Math.floor(limite / 2)
      });

      if (resultadosJusBrasil.sucesso && resultadosJusBrasil.resultados) {
        const decisoesJusBrasil = this.parseDecisoes(resultadosJusBrasil.resultados, 'jusbrasil');
        decisoes.push(...decisoesJusBrasil);
      }
    } catch (err) {
      console.warn('   ⚠️ Erro no JusBrasil:', err.message);
    }

    // FONTE 3: Pesquisa de Jurisprudência (STF/STJ/TST)
    if (['STF', 'STJ', 'TST', 'TSE'].includes(tribunal)) {
      try {
        console.log('   📡 Buscando em tribunais superiores...');

        const resultadosJuris = await executeTool('pesquisar_jurisprudencia', {
          termo: `${nomeMagistrado} ${materia}`,
          tribunal
        });

        if (resultadosJuris.sucesso && resultadosJuris.resultados) {
          const decisoesJuris = this.parseDecisoes(resultadosJuris.resultados, 'jurisprudencia');
          decisoes.push(...decisoesJuris.slice(0, Math.floor(limite / 3)));
        }
      } catch (err) {
        console.warn('   ⚠️ Erro na pesquisa de jurisprudência:', err.message);
      }
    }

    // Remover duplicatas
    const decisoesUnicas = this.removerDuplicatas(decisoes);

    return decisoesUnicas.slice(0, limite);
  }

  /**
   * Parse de decisões de diferentes fontes para formato unificado
   */
  parseDecisoes(dados, fonte) {
    if (!dados || !Array.isArray(dados)) {
      return [];
    }

    return dados.map(item => ({
      id: this.gerarIdDecisao(item, fonte),
      fonte,
      numeroProcesso: item.numeroProcesso || item.numero || item.processo,
      tipo: item.tipo || item.tipoDecisao || 'não informado',
      data: item.data || item.dataPublicacao || item.dataJulgamento,
      ementa: item.ementa || item.resumo || '',
      inteiroTeor: item.inteiroTeor || item.texto || null,
      orgaoJulgador: item.orgaoJulgador || item.orgao || item.turma,
      relator: item.relator || item.magistrado,
      link: item.link || item.url,
      original: item
    }));
  }

  /**
   * Gerar ID único para decisão
   */
  gerarIdDecisao(item, fonte) {
    const numero = item.numeroProcesso || item.numero || item.processo || '';
    const hash = Buffer.from(`${fonte}_${numero}_${item.data || Date.now()}`).toString('base64');
    return hash.substring(0, 16);
  }

  /**
   * Remover duplicatas (mesmo processo de fontes diferentes)
   */
  removerDuplicatas(decisoes) {
    const mapa = new Map();

    for (const decisao of decisoes) {
      const chave = decisao.numeroProcesso || decisao.id;

      if (!mapa.has(chave)) {
        mapa.set(chave, decisao);
      } else {
        // Se já existe, manter a que tem inteiro teor
        const existente = mapa.get(chave);
        if (decisao.inteiroTeor && !existente.inteiroTeor) {
          mapa.set(chave, decisao);
        }
      }
    }

    return Array.from(mapa.values());
  }

  /**
   * Validar decisões cruzando fontes (double check)
   */
  async validarDecisoesCruzadas(decisoes) {
    console.log('🔍 [Jurimetria] Validando decisões com double check...');

    const validadas = [];

    for (const decisao of decisoes) {
      // Verificar se decisão é real
      const validacao = await this.verificarAutenticidade(decisao);

      if (validacao.valida) {
        validadas.push({
          ...decisao,
          validacao: {
            status: 'validada',
            fontesConfirmadas: validacao.fontes,
            confiabilidade: validacao.confiabilidade
          }
        });
      } else {
        console.warn(`   ⚠️ Decisão não validada: ${decisao.numeroProcesso}`);
      }
    }

    return validadas;
  }

  /**
   * Verificar autenticidade de decisão
   */
  async verificarAutenticidade(decisao) {
    const fontesConfirmadas = [decisao.fonte];
    let tentativas = 0;

    // Tentar confirmar em outra fonte
    if (decisao.numeroProcesso) {
      try {
        // Tentar DataJud se veio de outra fonte
        if (decisao.fonte !== 'datajud') {
          const confirmacao = await executeTool('consultar_cnj_datajud', {
            numeroProcesso: decisao.numeroProcesso
          });

          if (confirmacao.sucesso && confirmacao.dados) {
            fontesConfirmadas.push('datajud');
            tentativas++;
          }
        }

        // Tentar JusBrasil se veio de outra fonte
        if (decisao.fonte !== 'jusbrasil' && tentativas < 2) {
          const confirmacao = await executeTool('pesquisar_jusbrasil', {
            termo: decisao.numeroProcesso,
            tipo: 'jurisprudencia',
            limite: 1
          });

          if (confirmacao.sucesso && confirmacao.resultados?.length > 0) {
            fontesConfirmadas.push('jusbrasil');
          }
        }
      } catch (err) {
        // Ignorar erros de validação
      }
    }

    // Decisão validada se confirmada em 1+ fonte OU tem link oficial
    const valida = fontesConfirmadas.length >= 1 || decisao.link;

    return {
      valida,
      fontes: fontesConfirmadas,
      confiabilidade: fontesConfirmadas.length >= 2 ? 'alta' : 'média'
    };
  }

  /**
   * Extrair inteiro teor das decisões
   */
  async extrairInteiroTeor(decisoes) {
    console.log('📄 [Jurimetria] Extraindo inteiro teor...');

    const decisoesCompletas = [];

    for (const decisao of decisoes) {
      if (decisao.inteiroTeor) {
        // Já tem inteiro teor
        decisoesCompletas.push(decisao);
      } else if (decisao.link) {
        // Tentar buscar inteiro teor via link
        try {
          const inteiroTeor = await this.buscarInteiroTeorPorLink(decisao.link);
          decisoesCompletas.push({
            ...decisao,
            inteiroTeor
          });
        } catch (err) {
          // Se falhar, usar apenas ementa
          decisoesCompletas.push(decisao);
        }
      } else {
        // Usar apenas ementa
        decisoesCompletas.push(decisao);
      }
    }

    return decisoesCompletas;
  }

  /**
   * Buscar inteiro teor via link (placeholder - implementar scraping)
   */
  async buscarInteiroTeorPorLink(link) {
    // TODO: Implementar scraping de inteiro teor
    // Por enquanto, retorna null
    return null;
  }

  /**
   * Análise jurímétrica: identificar padrão de julgamento
   */
  async analisarPadraoJulgamento(params) {
    const { magistrado, decisoes, materia } = params;

    console.log('📊 [Jurimetria] Analisando padrão de julgamento...');

    // Preparar dados para análise
    const dadosAnalise = decisoes.map(d => ({
      processo: d.numeroProcesso,
      data: d.data,
      tipo: d.tipo,
      ementa: d.ementa,
      inteiroTeor: d.inteiroTeor || d.ementa,
      resultado: this.extrairResultado(d)
    }));

    // Usar IA para análise profunda
    const promptAnalise = `Você é um especialista em jurimetria. Analise o padrão de julgamento do magistrado ${magistrado} sobre ${materia}.

DECISÕES ANALISADAS (${decisoes.length}):

${dadosAnalise.map((d, i) => `
DECISÃO ${i + 1}:
Processo: ${d.processo}
Data: ${d.data}
Tipo: ${d.tipo}
Ementa: ${d.ementa.substring(0, 500)}...
${d.inteiroTeor ? `Inteiro Teor (trecho): ${d.inteiroTeor.substring(0, 1000)}...` : ''}
`).join('\n---\n')}

ANÁLISE SOLICITADA:

1. **Padrão de Julgamento:**
   - Qual é a tendência predominante do magistrado nesta matéria?
   - Há consistência nas decisões?
   - Percentual de provimento vs. desprovimento (se aplicável)

2. **Fundamentos Mais Utilizados:**
   - Quais precedentes o magistrado cita com frequência?
   - Quais dispositivos legais são mais invocados?
   - Há alguma doutrina preferencial?

3. **Evolução Temporal:**
   - Houve mudança de entendimento ao longo do tempo?
   - As decisões mais recentes mantêm o mesmo padrão?

4. **Distinguishing:**
   - Identifique situações onde o magistrado distinguiu casos aparentemente similares
   - Quais fatores foram determinantes para diferenciar?

5. **Contradições Aparentes:**
   - Existem decisões que parecem contraditórias?
   - Se sim, quais as possíveis explicações?

Forneça uma análise estruturada e objetiva.`;

    const analise = await conversar(promptAnalise, {
      modelo: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
      maxTokens: 16384,
      systemPrompt: 'Você é um especialista em jurimetria e análise de decisões judiciais.'
    });

    return {
      magistrado,
      materia,
      totalDecisoes: decisoes.length,
      analiseQualitativa: analise.resposta,
      estatisticas: this.calcularEstatisticas(decisoes),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Extrair resultado da decisão (provido, desprovido, parcial, etc)
   */
  extrairResultado(decisao) {
    const texto = (decisao.ementa + ' ' + (decisao.inteiroTeor || '')).toLowerCase();

    if (texto.includes('provid') && texto.includes('não')) {
      return 'desprovido';
    } else if (texto.includes('provid') && texto.includes('parcial')) {
      return 'parcialmente provido';
    } else if (texto.includes('provid')) {
      return 'provido';
    } else if (texto.includes('deferido')) {
      return 'deferido';
    } else if (texto.includes('indeferido')) {
      return 'indeferido';
    } else if (texto.includes('procedente') && texto.includes('improcedente')) {
      return 'parcialmente procedente';
    } else if (texto.includes('procedente')) {
      return 'procedente';
    } else if (texto.includes('improcedente')) {
      return 'improcedente';
    }

    return 'não identificado';
  }

  /**
   * Calcular estatísticas básicas
   */
  calcularEstatisticas(decisoes) {
    const resultados = {};
    const anos = {};

    for (const decisao of decisoes) {
      const resultado = this.extrairResultado(decisao);
      resultados[resultado] = (resultados[resultado] || 0) + 1;

      if (decisao.data) {
        const ano = decisao.data.substring(0, 4);
        anos[ano] = (anos[ano] || 0) + 1;
      }
    }

    return {
      porResultado: resultados,
      porAno: anos,
      total: decisoes.length
    };
  }

  /**
   * Identificar contradições entre decisões
   */
  async identificarContradicoes(decisoes) {
    console.log('🔍 [Jurimetria] Identificando contradições...');

    if (decisoes.length < 2) {
      return [];
    }

    const contradicoes = [];

    // Comparar decisões par a par
    for (let i = 0; i < decisoes.length - 1; i++) {
      for (let j = i + 1; j < decisoes.length; j++) {
        const d1 = decisoes[i];
        const d2 = decisoes[j];

        // Verificar se decisões são sobre matéria similar
        const similares = await this.decisoesSimilares(d1, d2);

        if (similares.saoSimilares) {
          const resultado1 = this.extrairResultado(d1);
          const resultado2 = this.extrairResultado(d2);

          // Se resultados opostos, pode ser contradição
          if (this.resultadosOpostos(resultado1, resultado2)) {
            contradicoes.push({
              decisao1: {
                processo: d1.numeroProcesso,
                data: d1.data,
                resultado: resultado1,
                ementa: d1.ementa.substring(0, 200)
              },
              decisao2: {
                processo: d2.numeroProcesso,
                data: d2.data,
                resultado: resultado2,
                ementa: d2.ementa.substring(0, 200)
              },
              similaridade: similares.grauSimilaridade,
              possiveisMotivos: similares.diferencas
            });
          }
        }
      }
    }

    return contradicoes.slice(0, 5); // Limitar a 5 contradições mais relevantes
  }

  /**
   * Verificar se duas decisões são similares
   */
  async decisoesSimilares(d1, d2) {
    // Análise simples baseada em palavras-chave comuns
    const palavras1 = new Set((d1.ementa || '').toLowerCase().split(/\s+/));
    const palavras2 = new Set((d2.ementa || '').toLowerCase().split(/\s+/));

    const intersecao = new Set([...palavras1].filter(p => palavras2.has(p)));
    const uniao = new Set([...palavras1, ...palavras2]);

    const jaccard = intersecao.size / uniao.size;

    return {
      saoSimilares: jaccard > 0.3, // Threshold de 30% similaridade
      grauSimilaridade: Math.round(jaccard * 100),
      diferencas: []
    };
  }

  /**
   * Verificar se resultados são opostos
   */
  resultadosOpostos(r1, r2) {
    const oposicoes = {
      'provido': ['desprovido', 'improcedente'],
      'desprovido': ['provido', 'procedente'],
      'deferido': ['indeferido'],
      'indeferido': ['deferido'],
      'procedente': ['improcedente', 'desprovido'],
      'improcedente': ['procedente', 'provido']
    };

    return oposicoes[r1]?.includes(r2) || oposicoes[r2]?.includes(r1);
  }

  /**
   * Cotejamento analítico entre caso atual e decisões anteriores
   */
  async cotejarComCasoAtual(params) {
    const {
      casoAtual,          // Descrição do caso atual
      decisoesReferencia, // Decisões para comparar
      pontosControversos  // Pontos específicos a analisar
    } = params;

    console.log('⚖️ [Jurimetria] Realizando cotejamento analítico...');

    const promptCotejo = `Você é um especialista em análise jurídica comparativa. Realize um cotejamento analítico detalhado.

CASO ATUAL:
${casoAtual}

PONTOS CONTROVERSOS:
${pontosControversos.join('\n- ')}

DECISÕES DE REFERÊNCIA DO MAGISTRADO:
${decisoesReferencia.map((d, i) => `
DECISÃO ${i + 1}:
Processo: ${d.numeroProcesso}
Data: ${d.data}
Ementa: ${d.ementa}
${d.inteiroTeor ? `Inteiro Teor: ${d.inteiroTeor}` : ''}
`).join('\n---\n')}

COTEJAMENTO SOLICITADO:

1. **Análise de Similaridade:**
   - Quais pontos do caso atual se assemelham às decisões anteriores?
   - Quais são as diferenças factuais relevantes?

2. **Aplicabilidade dos Precedentes:**
   - Os precedentes são diretamente aplicáveis ao caso atual?
   - Ou é necessário fazer distinguishing?

3. **Amoldamento ao Leading Case:**
   - Identifique o leading case mais aplicável
   - Demonstre como o caso atual se amolda (ou não) ao precedente
   - Crie tabela comparativa

4. **Fundamentação Sugerida:**
   - Como argumentar pela aplicação dos precedentes favoráveis?
   - Como distinguir os precedentes desfavoráveis?

Apresente em formato estruturado com tabelas onde apropriado.`;

    const cotejamento = await conversar(promptCotejo, {
      modelo: 'anthropic.claude-opus-4-5-20250514-v1:0', // Usar Opus para análise complexa
      maxTokens: 32000,
      systemPrompt: 'Você é um especialista em cotejamento analítico e distinguishing.'
    });

    return {
      casoAtual,
      decisoesAnalisadas: decisoesReferencia.length,
      cotejamento: cotejamento.resposta,
      timestamp: new Date().toISOString()
    };
  }
}

// Singleton
const jurimetriaService = new JurimetriaService();

export default jurimetriaService;
