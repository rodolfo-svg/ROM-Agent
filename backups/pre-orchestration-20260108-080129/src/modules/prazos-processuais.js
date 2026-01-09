/**
 * MÓDULO DE ANÁLISE DE PRAZOS PROCESSUAIS
 *
 * Base Legal:
 * - Lei nº 11.419/2006 (Art. 4º, §3º e §4º) - Lei do Processo Eletrônico
 * - Resolução CNJ 234/2016 - DJEN (Diário de Justiça Eletrônico Nacional)
 * - Resolução CNJ 455/2022 - Regulamentação do DJEN
 * - CPC/2015 - Arts. 212-225 (Prazos Processuais)
 * - Lei nº 5.010/1966 (Art. 1º) - Contagem de prazos
 *
 * REGRA DE PUBLICAÇÃO E PRAZOS:
 * 1. Disponibilização: 1º dia útil após inserção no sistema
 * 2. Publicação: Dia útil seguinte à disponibilização
 * 3. Início do prazo: 1º dia útil APÓS a publicação
 *
 * Exemplo: Segunda (disponibilização) → Terça (publicação) → Quarta (início)
 *
 * @version 1.0.0
 * @author ROM Agent System
 */

import axios from 'axios';

/**
 * Classe principal para análise de prazos processuais
 */
class PrazosProcessuaisService {
  constructor() {
    // Cache de feriados por tribunal
    this.feriadosCache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 horas
  }

  /**
   * Calcula prazos a partir da data de publicação no DJe/DJEN
   *
   * @param {string} dataDisponibilizacao - Data de disponibilização no DJe (ISO 8601)
   * @param {number} quantidadeDias - Quantidade de dias do prazo
   * @param {string} tribunal - Código do tribunal (ex: 'TJSP', 'STJ', 'TST')
   * @param {object} options - Opções adicionais
   * @returns {Promise<object>} Resultado com datas calculadas e análise
   */
  async calcularPrazo(dataDisponibilizacao, quantidadeDias, tribunal = 'CNJ', options = {}) {
    try {
      const disponibilizacao = new Date(dataDisponibilizacao);

      // Validar data
      if (isNaN(disponibilizacao.getTime())) {
        throw new Error('Data de disponibilização inválida');
      }

      // 1. Calcular data de PUBLICAÇÃO (dia útil seguinte à disponibilização)
      const dataPublicacao = await this.proximoDiaUtil(disponibilizacao, tribunal);

      // 2. Calcular data de INÍCIO DO PRAZO (dia útil seguinte à publicação)
      const dataInicioPrazo = await this.proximoDiaUtil(dataPublicacao, tribunal);

      // 3. Calcular data de VENCIMENTO (considerando apenas dias úteis)
      const dataVencimento = await this.calcularDataVencimento(
        dataInicioPrazo,
        quantidadeDias,
        tribunal
      );

      // 4. Verificar se o prazo está em dobro (Fazenda Pública, Defensoria, etc)
      const prazoEmDobro = options.prazoEmDobro || false;
      const dataVencimentoFinal = prazoEmDobro
        ? await this.calcularDataVencimento(dataInicioPrazo, quantidadeDias * 2, tribunal)
        : dataVencimento;

      // 5. Calcular dias úteis restantes
      const diasUteisRestantes = await this.calcularDiasUteisEntre(
        new Date(),
        dataVencimentoFinal,
        tribunal
      );

      // 6. Verificar status do prazo
      const status = this.verificarStatusPrazo(dataVencimentoFinal, diasUteisRestantes);

      // 7. Verificar preclusão, prescrição e decadência
      const analiseTemporal = this.analisarPreclusaoPrescricaoDecadencia(
        dataVencimentoFinal,
        diasUteisRestantes,
        options
      );

      return {
        sucesso: true,
        tribunal,
        prazoEmDobro,
        quantidadeDias: prazoEmDobro ? quantidadeDias * 2 : quantidadeDias,
        datas: {
          disponibilizacao: this.formatarData(disponibilizacao),
          publicacao: this.formatarData(dataPublicacao),
          inicioPrazo: this.formatarData(dataInicioPrazo),
          vencimento: this.formatarData(dataVencimentoFinal)
        },
        diasUteisRestantes,
        status,
        analiseTemporal,
        alertas: this.gerarAlertas(diasUteisRestantes, status, analiseTemporal)
      };
    } catch (error) {
      console.error('Erro ao calcular prazo:', error);
      return {
        sucesso: false,
        erro: error.message
      };
    }
  }

  /**
   * Busca feriados do tribunal específico
   * Prioridade: 1) CNJ, 2) Tribunal local, 3) Municipais
   *
   * @param {string} tribunal - Código do tribunal
   * @param {number} ano - Ano para buscar feriados
   * @returns {Promise<Array>} Lista de feriados
   */
  async buscarFeriados(tribunal, ano = new Date().getFullYear()) {
    const cacheKey = `${tribunal}_${ano}`;

    // Verificar cache
    if (this.feriadosCache.has(cacheKey)) {
      const cache = this.feriadosCache.get(cacheKey);
      if (Date.now() - cache.timestamp < this.cacheExpiry) {
        console.log(`✅ Feriados do ${tribunal} (${ano}) obtidos do cache`);
        return cache.feriados;
      }
    }

    console.log(`🔍 Buscando feriados do ${tribunal} para ${ano}...`);

    try {
      // Feriados nacionais fixos
      const feriadosNacionais = this.getFeriadosNacionaisFixos(ano);

      // Feriados móveis (Páscoa, Carnaval, Corpus Christi)
      const feriadosMoveis = this.calcularFeriadosMoveis(ano);

      // Combinar todos os feriados
      const todosFeriados = [...feriadosNacionais, ...feriadosMoveis];

      // Tentar buscar feriados específicos do tribunal via API do CNJ
      try {
        const feriadosTribunal = await this.buscarFeriadosCNJ(tribunal, ano);
        todosFeriados.push(...feriadosTribunal);
      } catch (apiError) {
        console.warn(`⚠️ Não foi possível buscar feriados do CNJ: ${apiError.message}`);
      }

      // Ordenar por data
      todosFeriados.sort((a, b) => new Date(a.data) - new Date(b.data));

      // Salvar no cache
      this.feriadosCache.set(cacheKey, {
        feriados: todosFeriados,
        timestamp: Date.now()
      });

      console.log(`✅ ${todosFeriados.length} feriados encontrados para ${tribunal} (${ano})`);
      return todosFeriados;
    } catch (error) {
      console.error(`Erro ao buscar feriados:`, error);
      // Retornar apenas feriados nacionais em caso de erro
      return [...this.getFeriadosNacionaisFixos(ano), ...this.calcularFeriadosMoveis(ano)];
    }
  }

  /**
   * Busca feriados via API do CNJ (quando disponível)
   *
   * @param {string} tribunal - Código do tribunal
   * @param {number} ano - Ano
   * @returns {Promise<Array>} Feriados do tribunal
   */
  async buscarFeriadosCNJ(tribunal, ano) {
    // TODO: Implementar integração real com API do CNJ quando disponível
    // Por enquanto, retorna array vazio
    // URL esperada: https://api-publica.datajud.cnj.jus.br/api_publica_calendarios/_search

    console.log(`ℹ️ API do CNJ para feriados ainda não implementada`);
    return [];
  }

  /**
   * Retorna feriados nacionais fixos
   */
  getFeriadosNacionaisFixos(ano) {
    return [
      { data: `${ano}-01-01`, nome: 'Confraternização Universal', tipo: 'nacional' },
      { data: `${ano}-04-21`, nome: 'Tiradentes', tipo: 'nacional' },
      { data: `${ano}-05-01`, nome: 'Dia do Trabalho', tipo: 'nacional' },
      { data: `${ano}-09-07`, nome: 'Independência do Brasil', tipo: 'nacional' },
      { data: `${ano}-10-12`, nome: 'Nossa Senhora Aparecida', tipo: 'nacional' },
      { data: `${ano}-11-02`, nome: 'Finados', tipo: 'nacional' },
      { data: `${ano}-11-15`, nome: 'Proclamação da República', tipo: 'nacional' },
      { data: `${ano}-11-20`, nome: 'Consciência Negra', tipo: 'nacional' },
      { data: `${ano}-12-25`, nome: 'Natal', tipo: 'nacional' }
    ];
  }

  /**
   * Calcula feriados móveis baseados na Páscoa
   */
  calcularFeriadosMoveis(ano) {
    const pascoa = this.calcularDomingoPascoa(ano);
    const feriados = [];

    // Carnaval (47 dias antes da Páscoa)
    const carnaval = new Date(pascoa);
    carnaval.setDate(carnaval.getDate() - 47);
    feriados.push({
      data: this.formatarData(carnaval),
      nome: 'Carnaval',
      tipo: 'movel'
    });

    // Sexta-feira Santa (2 dias antes da Páscoa)
    const sextaSanta = new Date(pascoa);
    sextaSanta.setDate(sextaSanta.getDate() - 2);
    feriados.push({
      data: this.formatarData(sextaSanta),
      nome: 'Sexta-feira Santa',
      tipo: 'movel'
    });

    // Corpus Christi (60 dias após a Páscoa)
    const corpusChristi = new Date(pascoa);
    corpusChristi.setDate(corpusChristi.getDate() + 60);
    feriados.push({
      data: this.formatarData(corpusChristi),
      nome: 'Corpus Christi',
      tipo: 'movel'
    });

    return feriados;
  }

  /**
   * Calcula o Domingo de Páscoa usando o algoritmo de Meeus
   */
  calcularDomingoPascoa(ano) {
    const a = ano % 19;
    const b = Math.floor(ano / 100);
    const c = ano % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(ano, mes - 1, dia);
  }

  /**
   * Verifica se uma data é dia útil (não é sábado, domingo ou feriado)
   */
  async ehDiaUtil(data, tribunal = 'CNJ') {
    const diaSemana = data.getDay();

    // Sábado (6) ou Domingo (0)
    if (diaSemana === 0 || diaSemana === 6) {
      return false;
    }

    // Verificar se é feriado
    const ano = data.getFullYear();
    const feriados = await this.buscarFeriados(tribunal, ano);
    const dataStr = this.formatarData(data);

    return !feriados.some(feriado => feriado.data === dataStr);
  }

  /**
   * Retorna o próximo dia útil após uma data
   */
  async proximoDiaUtil(data, tribunal = 'CNJ') {
    let proximaData = new Date(data);
    proximaData.setDate(proximaData.getDate() + 1);

    while (!(await this.ehDiaUtil(proximaData, tribunal))) {
      proximaData.setDate(proximaData.getDate() + 1);
    }

    return proximaData;
  }

  /**
   * Calcula a data de vencimento considerando apenas dias úteis
   */
  async calcularDataVencimento(dataInicio, quantidadeDias, tribunal = 'CNJ') {
    let dataAtual = new Date(dataInicio);
    let diasContados = 0;

    while (diasContados < quantidadeDias) {
      dataAtual.setDate(dataAtual.getDate() + 1);

      if (await this.ehDiaUtil(dataAtual, tribunal)) {
        diasContados++;
      }
    }

    return dataAtual;
  }

  /**
   * Calcula quantidade de dias úteis entre duas datas
   */
  async calcularDiasUteisEntre(dataInicio, dataFim, tribunal = 'CNJ') {
    let diasUteis = 0;
    let dataAtual = new Date(dataInicio);
    dataAtual.setHours(0, 0, 0, 0);

    const fim = new Date(dataFim);
    fim.setHours(0, 0, 0, 0);

    while (dataAtual < fim) {
      if (await this.ehDiaUtil(dataAtual, tribunal)) {
        diasUteis++;
      }
      dataAtual.setDate(dataAtual.getDate() + 1);
    }

    return diasUteis;
  }

  /**
   * Verifica status do prazo
   */
  verificarStatusPrazo(dataVencimento, diasUteisRestantes) {
    if (diasUteisRestantes < 0) {
      return 'VENCIDO';
    } else if (diasUteisRestantes === 0) {
      return 'VENCE HOJE';
    } else if (diasUteisRestantes <= 3) {
      return 'URGENTE';
    } else if (diasUteisRestantes <= 7) {
      return 'ATENÇÃO';
    } else {
      return 'NO PRAZO';
    }
  }

  /**
   * Analisa preclusão, prescrição e decadência
   */
  analisarPreclusaoPrescricaoDecadencia(dataVencimento, diasUteisRestantes, options = {}) {
    const analise = {
      preclusao: {
        ocorreu: false,
        tipo: null,
        descricao: null
      },
      prescricao: {
        risco: false,
        prazo: null,
        descricao: null
      },
      decadencia: {
        risco: false,
        prazo: null,
        descricao: null
      }
    };

    // PRECLUSÃO - Perda do direito de praticar ato processual
    if (diasUteisRestantes < 0) {
      analise.preclusao.ocorreu = true;
      analise.preclusao.tipo = 'temporal';
      analise.preclusao.descricao = 'Prazo processual vencido - Preclusão temporal consumada';
    }

    // PRESCRIÇÃO - Análise de prazos prescricionais (se informado)
    if (options.tipoDireito === 'pessoal') {
      // Prazo geral de prescrição: 10 anos (CC, Art. 205)
      analise.prescricao.prazo = '10 anos';
      analise.prescricao.descricao = 'Prazo geral de prescrição (CC, Art. 205)';
    } else if (options.tipoDireito === 'responsabilidade_civil') {
      // Prazo de prescrição: 3 anos (CC, Art. 206, §3º, V)
      analise.prescricao.prazo = '3 anos';
      analise.prescricao.descricao = 'Reparação civil (CC, Art. 206, §3º, V)';
    }

    // DECADÊNCIA - Análise de prazos decadenciais (se informado)
    if (options.tipoAcao === 'anulatoria') {
      // Prazo decadencial de 2 anos (CC, Art. 179)
      analise.decadencia.prazo = '2 anos';
      analise.decadencia.descricao = 'Anulação de negócio jurídico (CC, Art. 179)';
    } else if (options.tipoAcao === 'rescisoria') {
      // Prazo decadencial de 2 anos (CPC, Art. 975)
      analise.decadencia.prazo = '2 anos';
      analise.decadencia.descricao = 'Ação rescisória (CPC, Art. 975)';
    }

    return analise;
  }

  /**
   * Gera alertas baseados na análise de prazos
   */
  gerarAlertas(diasUteisRestantes, status, analiseTemporal) {
    const alertas = [];

    // Alertas de vencimento
    if (status === 'VENCIDO') {
      alertas.push({
        nivel: 'CRÍTICO',
        mensagem: '⛔ PRAZO VENCIDO - Preclusão temporal consumada',
        tipo: 'vencimento'
      });
    } else if (status === 'VENCE HOJE') {
      alertas.push({
        nivel: 'URGENTE',
        mensagem: '🚨 PRAZO VENCE HOJE - Última oportunidade para protocolo',
        tipo: 'vencimento'
      });
    } else if (status === 'URGENTE') {
      alertas.push({
        nivel: 'ALTO',
        mensagem: `⚠️ PRAZO URGENTE - Restam apenas ${diasUteisRestantes} dia(s) útil(eis)`,
        tipo: 'vencimento'
      });
    }

    // Alertas de preclusão
    if (analiseTemporal.preclusao.ocorreu) {
      alertas.push({
        nivel: 'CRÍTICO',
        mensagem: `⛔ PRECLUSÃO ${analiseTemporal.preclusao.tipo.toUpperCase()} - ${analiseTemporal.preclusao.descricao}`,
        tipo: 'preclusao'
      });
    }

    // Alertas de prescrição
    if (analiseTemporal.prescricao.risco) {
      alertas.push({
        nivel: 'ALTO',
        mensagem: `⚠️ RISCO DE PRESCRIÇÃO - ${analiseTemporal.prescricao.descricao}`,
        tipo: 'prescricao'
      });
    }

    // Alertas de decadência
    if (analiseTemporal.decadencia.risco) {
      alertas.push({
        nivel: 'ALTO',
        mensagem: `⚠️ RISCO DE DECADÊNCIA - ${analiseTemporal.decadencia.descricao}`,
        tipo: 'decadencia'
      });
    }

    return alertas;
  }

  /**
   * Formata data no padrão ISO (YYYY-MM-DD)
   */
  formatarData(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  /**
   * Formata data no padrão brasileiro (DD/MM/YYYY)
   */
  formatarDataBR(data) {
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }
}

// Singleton
const prazosProcessuaisService = new PrazosProcessuaisService();

export default prazosProcessuaisService;
export { PrazosProcessuaisService };
