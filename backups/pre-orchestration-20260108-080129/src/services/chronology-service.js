/**
 * ROM Agent - Serviço de Cronologia e Matrizes de Prazos
 * Geração de cronologias processuais e cálculo de prazos jurídicos
 *
 * Funcionalidades:
 * - Cronologia completa de processos
 * - Cálculo de prazos legais (preclusão, decadência, prescrição)
 * - Matriz de prazos por tipo de ação
 * - Identificação automática de marcos temporais
 * - Alertas de prazos vencidos e vincendos
 * - Exportação em múltiplos formatos
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Tipos de prazos jurídicos
 */
const TIPOS_PRAZO = {
  PRECLUSAO: 'preclusão',
  DECADENCIA: 'decadência',
  PRESCRICAO: 'prescrição',
  PROCESSUAL: 'processual',
  RECURSAL: 'recursal'
};

/**
 * Tabela de prazos processuais (CPC/2015)
 */
const PRAZOS_CPC = {
  'contestação': { dias: 15, tipo: TIPOS_PRAZO.PROCESSUAL },
  'reconvenção': { dias: 15, tipo: TIPOS_PRAZO.PROCESSUAL },
  'impugnação': { dias: 15, tipo: TIPOS_PRAZO.PROCESSUAL },
  'réplica': { dias: 15, tipo: TIPOS_PRAZO.PROCESSUAL },
  'manifestação': { dias: 15, tipo: TIPOS_PRAZO.PROCESSUAL },
  'apelação': { dias: 15, tipo: TIPOS_PRAZO.RECURSAL },
  'agravo de instrumento': { dias: 15, tipo: TIPOS_PRAZO.RECURSAL },
  'embargos de declaração': { dias: 5, tipo: TIPOS_PRAZO.RECURSAL },
  'recurso especial': { dias: 15, tipo: TIPOS_PRAZO.RECURSAL },
  'recurso extraordinário': { dias: 15, tipo: TIPOS_PRAZO.RECURSAL }
};

/**
 * Tabela de prazos trabalhistas (CLT)
 */
const PRAZOS_CLT = {
  'contestação': { dias: 5, tipo: TIPOS_PRAZO.PROCESSUAL, audiencia: true },
  'recurso ordinário': { dias: 8, tipo: TIPOS_PRAZO.RECURSAL },
  'recurso de revista': { dias: 8, tipo: TIPOS_PRAZO.RECURSAL },
  'embargos': { dias: 5, tipo: TIPOS_PRAZO.RECURSAL },
  'impugnação cálculos': { dias: 5, tipo: TIPOS_PRAZO.PROCESSUAL }
};

/**
 * Gerar cronologia completa do processo
 *
 * @param {Object} processData - Dados do processo com movimentações
 * @param {Object} options - Opções de geração
 * @returns {Object} - Cronologia estruturada
 */
export async function generateChronology(processData, options = {}) {
  const {
    includeDocuments = true,
    includeParties = true,
    sortOrder = 'desc', // 'asc' ou 'desc'
    groupByMonth = false
  } = options;

  const chronology = {
    processNumber: processData.processNumber || processData.numero,
    generatedAt: new Date().toISOString(),
    totalEvents: 0,
    startDate: null,
    endDate: null,
    events: [],
    summary: {
      totalMovements: 0,
      totalDocuments: 0,
      totalDecisions: 0,
      durationDays: 0
    }
  };

  try {
    const events = [];

    // Processar movimentações
    if (processData.movimentacoes && Array.isArray(processData.movimentacoes)) {
      for (const mov of processData.movimentacoes) {
        events.push({
          date: mov.data || mov.dataHora,
          type: 'movimento',
          description: mov.descricao || mov.movimento,
          category: categorizeMovement(mov.descricao || mov.movimento),
          details: mov
        });
      }
      chronology.summary.totalMovements = processData.movimentacoes.length;
    }

    // Processar documentos (se disponíveis)
    if (includeDocuments && processData.documentos && Array.isArray(processData.documentos)) {
      for (const doc of processData.documentos) {
        events.push({
          date: doc.data || doc.dataJuntada,
          type: 'documento',
          description: `Juntada: ${doc.nome || doc.tipo}`,
          category: 'documento',
          details: doc
        });
      }
      chronology.summary.totalDocuments = processData.documentos.length;
    }

    // Processar decisões
    if (processData.decisoes && Array.isArray(processData.decisoes)) {
      for (const decisao of processData.decisoes) {
        events.push({
          date: decisao.data,
          type: 'decisão',
          description: decisao.tipo || 'Decisão',
          category: 'decisão',
          importance: 'high',
          details: decisao
        });
      }
      chronology.summary.totalDecisions = processData.decisoes.length;
    }

    // Ordenar eventos por data
    events.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    chronology.events = events;
    chronology.totalEvents = events.length;

    // Calcular datas início/fim e duração
    if (events.length > 0) {
      const dates = events.map(e => new Date(e.date)).sort((a, b) => a - b);
      chronology.startDate = dates[0].toISOString();
      chronology.endDate = dates[dates.length - 1].toISOString();
      chronology.summary.durationDays = Math.ceil(
        (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24)
      );
    }

    // Agrupar por mês se solicitado
    if (groupByMonth) {
      chronology.eventsByMonth = groupEventsByMonth(events);
    }

    return chronology;

  } catch (error) {
    console.error('Erro ao gerar cronologia:', error);
    return {
      ...chronology,
      error: error.message
    };
  }
}

/**
 * Gerar matriz de prazos (preclusão, decadência, prescrição)
 *
 * @param {Object} processData - Dados do processo
 * @param {Object} options - Opções
 * @returns {Object} - Matriz de prazos
 */
export async function generateMatrizes(processData, options = {}) {
  const {
    area = 'civel', // civel, trabalhista, penal
    calculateDeadlines = true,
    includeAlerts = true
  } = options;

  const matrices = {
    processNumber: processData.processNumber || processData.numero,
    area,
    generatedAt: new Date().toISOString(),
    prazos: [],
    preclusao: [],
    decadencia: [],
    prescricao: [],
    alerts: {
      vencidos: [],
      vincendos: []
    },
    summary: {
      totalPrazos: 0,
      prazosAtivos: 0,
      prazosVencidos: 0,
      proximoVencimento: null
    }
  };

  try {
    const hoje = new Date();

    // Identificar prazos processuais
    if (calculateDeadlines && processData.movimentacoes) {
      const prazosTable = area === 'trabalhista' ? PRAZOS_CLT : PRAZOS_CPC;

      for (const mov of processData.movimentacoes) {
        const descricao = (mov.descricao || mov.movimento || '').toLowerCase();
        const dataMov = new Date(mov.data || mov.dataHora);

        // Buscar prazos aplicáveis
        for (const [tipo, config] of Object.entries(prazosTable)) {
          if (descricao.includes(tipo) || descricao.includes(tipo.replace(' ', ''))) {
            const dataVencimento = addDiasUteis(dataMov, config.dias);
            const status = dataVencimento < hoje ? 'vencido' : 'ativo';
            const diasRestantes = Math.ceil((dataVencimento - hoje) / (1000 * 60 * 60 * 24));

            const prazo = {
              tipo,
              categoria: config.tipo,
              dataInicio: dataMov.toISOString(),
              dataVencimento: dataVencimento.toISOString(),
              dias: config.dias,
              status,
              diasRestantes,
              movimento: mov.descricao || mov.movimento
            };

            matrices.prazos.push(prazo);

            // Adicionar à categoria específica
            if (config.tipo === TIPOS_PRAZO.PRECLUSAO) {
              matrices.preclusao.push(prazo);
            }

            // Alertas
            if (status === 'vencido' && includeAlerts) {
              matrices.alerts.vencidos.push(prazo);
            } else if (diasRestantes >= 0 && diasRestantes <= 5 && includeAlerts) {
              matrices.alerts.vincendos.push({
                ...prazo,
                urgencia: diasRestantes <= 2 ? 'alta' : 'média'
              });
            }
          }
        }
      }
    }

    // Identificar prazos de decadência
    matrices.decadencia = identifyDecadencia(processData, area);

    // Identificar prazos de prescrição
    matrices.prescricao = identifyPrescricao(processData, area);

    // Calcular sumário
    matrices.summary.totalPrazos = matrices.prazos.length;
    matrices.summary.prazosAtivos = matrices.prazos.filter(p => p.status === 'ativo').length;
    matrices.summary.prazosVencidos = matrices.prazos.filter(p => p.status === 'vencido').length;

    // Próximo vencimento
    const prazosAtivos = matrices.prazos
      .filter(p => p.status === 'ativo')
      .sort((a, b) => new Date(a.dataVencimento) - new Date(b.dataVencimento));

    if (prazosAtivos.length > 0) {
      matrices.summary.proximoVencimento = prazosAtivos[0];
    }

    return matrices;

  } catch (error) {
    console.error('Erro ao gerar matrizes:', error);
    return {
      ...matrices,
      error: error.message
    };
  }
}

/**
 * Categorizar movimento processual
 */
function categorizeMovement(description) {
  const desc = (description || '').toLowerCase();

  if (desc.includes('sentença') || desc.includes('decisão')) return 'decisão';
  if (desc.includes('recurso') || desc.includes('apelação') || desc.includes('agravo')) return 'recurso';
  if (desc.includes('juntada') || desc.includes('petição')) return 'documento';
  if (desc.includes('audiência') || desc.includes('despacho')) return 'audiência';
  if (desc.includes('trânsito em julgado')) return 'transitado';
  if (desc.includes('cumprimento') || desc.includes('execução')) return 'execução';
  if (desc.includes('intimação') || desc.includes('citação')) return 'intimação';

  return 'movimento geral';
}

/**
 * Agrupar eventos por mês
 */
function groupEventsByMonth(events) {
  const grouped = {};

  for (const event of events) {
    const date = new Date(event.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!grouped[monthKey]) {
      grouped[monthKey] = {
        month: monthKey,
        totalEvents: 0,
        events: []
      };
    }

    grouped[monthKey].events.push(event);
    grouped[monthKey].totalEvents++;
  }

  return Object.values(grouped);
}

/**
 * Adicionar dias úteis a uma data
 */
function addDiasUteis(data, dias) {
  const result = new Date(data);
  let diasAdicionados = 0;

  while (diasAdicionados < dias) {
    result.setDate(result.getDate() + 1);

    // Ignorar sábados (6) e domingos (0)
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      diasAdicionados++;
    }
  }

  return result;
}

/**
 * Identificar prazos de decadência
 */
function identifyDecadencia(processData, area) {
  const prazos = [];

  // Decadência de direitos potestativos (ex: ação anulatória)
  if (area === 'civel') {
    const tiposDecadencia = {
      'anulação de negócio jurídico': { anos: 4 },
      'revogação de doação': { anos: 1 },
      'ação pauliana': { anos: 4 }
    };

    // Verificar tipo de ação no processo
    const tipo = (processData.classe || '').toLowerCase();

    for (const [acao, config] of Object.entries(tiposDecadencia)) {
      if (tipo.includes(acao)) {
        prazos.push({
          tipo: acao,
          prazoAnos: config.anos,
          categoria: TIPOS_PRAZO.DECADENCIA,
          observacao: 'Prazo decadencial - não se interrompe ou suspende'
        });
      }
    }
  }

  return prazos;
}

/**
 * Identificar prazos de prescrição
 */
function identifyPrescricao(processData, area) {
  const prazos = [];

  if (area === 'civel') {
    // Prescrição cível (Código Civil)
    const tiposPrescricao = {
      'reparação civil': { anos: 3, artigo: 'Art. 206, §3º, V, CC' },
      'pretensão execução': { anos: 5, artigo: 'Art. 206, §5º, I, CC' },
      'cobrança de dívidas': { anos: 5, artigo: 'Art. 206, §5º, CC' },
      'pretensão geral': { anos: 10, artigo: 'Art. 205, CC' }
    };

    const assunto = (processData.assunto || processData.classe || '').toLowerCase();

    for (const [tipo, config] of Object.entries(tiposPrescricao)) {
      if (assunto.includes(tipo.split(' ')[0])) {
        prazos.push({
          tipo,
          prazoAnos: config.anos,
          fundamentacao: config.artigo,
          categoria: TIPOS_PRAZO.PRESCRICAO,
          observacao: 'Prazo prescricional - pode ser interrompido ou suspenso'
        });
      }
    }
  }

  if (area === 'trabalhista') {
    prazos.push({
      tipo: 'Créditos trabalhistas',
      prazoAnos: 5,
      fundamentacao: 'Art. 7º, XXIX, CF/88',
      categoria: TIPOS_PRAZO.PRESCRICAO,
      observacao: '5 anos até o limite de 2 anos após extinção do contrato'
    });
  }

  return prazos;
}

/**
 * Exportar cronologia para Markdown
 */
export function exportChronologyToMarkdown(chronology) {
  let md = `# Cronologia Processual\n\n`;
  md += `**Processo:** ${chronology.processNumber}\n`;
  md += `**Período:** ${new Date(chronology.startDate).toLocaleDateString('pt-BR')} a ${new Date(chronology.endDate).toLocaleDateString('pt-BR')}\n`;
  md += `**Duração:** ${chronology.summary.durationDays} dias\n`;
  md += `**Total de eventos:** ${chronology.totalEvents}\n\n`;

  md += `## 📊 Resumo\n\n`;
  md += `- **Movimentos:** ${chronology.summary.totalMovements}\n`;
  md += `- **Documentos:** ${chronology.summary.totalDocuments}\n`;
  md += `- **Decisões:** ${chronology.summary.totalDecisions}\n\n`;

  md += `## 📅 Linha do Tempo\n\n`;

  for (const event of chronology.events) {
    const date = new Date(event.date).toLocaleDateString('pt-BR');
    const icon = event.type === 'decisão' ? '⚖️' : event.type === 'documento' ? '📄' : '📌';

    md += `### ${icon} ${date} - ${event.description}\n\n`;
    md += `- **Tipo:** ${event.type}\n`;
    md += `- **Categoria:** ${event.category}\n`;

    if (event.importance) {
      md += `- **Importância:** ${event.importance}\n`;
    }

    md += `\n`;
  }

  md += `---\n\n`;
  md += `*Gerado em: ${new Date(chronology.generatedAt).toLocaleString('pt-BR')}*\n`;

  return md;
}

/**
 * Exportar matrizes para Markdown
 */
export function exportMatrizesToMarkdown(matrices) {
  let md = `# Matriz de Prazos Processuais\n\n`;
  md += `**Processo:** ${matrices.processNumber}\n`;
  md += `**Área:** ${matrices.area}\n`;
  md += `**Gerado em:** ${new Date(matrices.generatedAt).toLocaleString('pt-BR')}\n\n`;

  // Alertas
  if (matrices.alerts.vencidos.length > 0 || matrices.alerts.vincendos.length > 0) {
    md += `## 🚨 Alertas\n\n`;

    if (matrices.alerts.vencidos.length > 0) {
      md += `### ❌ Prazos Vencidos (${matrices.alerts.vencidos.length})\n\n`;
      for (const prazo of matrices.alerts.vencidos) {
        md += `- **${prazo.tipo}** - Venceu em ${new Date(prazo.dataVencimento).toLocaleDateString('pt-BR')}\n`;
      }
      md += `\n`;
    }

    if (matrices.alerts.vincendos.length > 0) {
      md += `### ⚠️ Prazos Vincendos (${matrices.alerts.vincendos.length})\n\n`;
      for (const prazo of matrices.alerts.vincendos) {
        const urgencia = prazo.urgencia === 'alta' ? '🔴' : '🟡';
        md += `- ${urgencia} **${prazo.tipo}** - Vence em ${new Date(prazo.dataVencimento).toLocaleDateString('pt-BR')} (${prazo.diasRestantes} dias)\n`;
      }
      md += `\n`;
    }
  }

  // Prazos processuais
  md += `## 📋 Prazos Processuais (${matrices.prazos.length})\n\n`;
  md += `| Tipo | Início | Vencimento | Dias | Status | Dias Restantes |\n`;
  md += `|------|--------|------------|------|--------|----------------|\n`;

  for (const prazo of matrices.prazos) {
    const inicio = new Date(prazo.dataInicio).toLocaleDateString('pt-BR');
    const vencimento = new Date(prazo.dataVencimento).toLocaleDateString('pt-BR');
    const statusIcon = prazo.status === 'vencido' ? '❌' : '✅';

    md += `| ${prazo.tipo} | ${inicio} | ${vencimento} | ${prazo.dias} | ${statusIcon} ${prazo.status} | ${prazo.diasRestantes} |\n`;
  }

  md += `\n`;

  // Prescrição
  if (matrices.prescricao.length > 0) {
    md += `## ⏳ Prescrição\n\n`;
    for (const prazo of matrices.prescricao) {
      md += `### ${prazo.tipo}\n\n`;
      md += `- **Prazo:** ${prazo.prazoAnos} anos\n`;
      md += `- **Fundamentação:** ${prazo.fundamentacao}\n`;
      md += `- **Observação:** ${prazo.observacao}\n\n`;
    }
  }

  // Decadência
  if (matrices.decadencia.length > 0) {
    md += `## 📉 Decadência\n\n`;
    for (const prazo of matrices.decadencia) {
      md += `### ${prazo.tipo}\n\n`;
      md += `- **Prazo:** ${prazo.prazoAnos} anos\n`;
      md += `- **Observação:** ${prazo.observacao}\n\n`;
    }
  }

  md += `---\n\n`;
  md += `*Gerado por: ROM Agent - Sistema de Análise Processual*\n`;

  return md;
}

export default {
  generateChronology,
  generateMatrizes,
  exportChronologyToMarkdown,
  exportMatrizesToMarkdown,
  TIPOS_PRAZO
};
