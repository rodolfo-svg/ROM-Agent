/**
 * CONFIGURAÇÕES POR ESCRITÓRIO PARCEIRO - ROM Agent
 * Cada escritório pode escolher sua estratégia de IA com alertas de custo
 *
 * Funcionalidades:
 * - Escolha entre economia, balanceado, qualidade máxima
 * - Alertas de custo em tempo real
 * - Limites de gastos configuráveis
 * - Estatísticas de uso
 * - Controle granular por modelo
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SETTINGS_DIR = path.join(__dirname, '../data/partner-settings');

// Criar diretório se não existir
if (!fs.existsSync(SETTINGS_DIR)) {
  fs.mkdirSync(SETTINGS_DIR, { recursive: true });
}

// ═══════════════════════════════════════════════════════════════
// ESTRATÉGIAS PRÉ-DEFINIDAS
// ═══════════════════════════════════════════════════════════════

export const ESTRATEGIAS_IA = {
  // Estratégia 1: ECONOMIA MÁXIMA (60-80% economia)
  economia: {
    id: 'economia',
    nome: 'Economia Máxima',
    descricao: 'Prioriza modelos gratuitos/baratos. Usa premium apenas quando absolutamente necessário.',
    icone: '💰',
    cor: '#48bb78',
    custoEstimado: '$99.50/mês (1000 ops)',
    economia: '85%',
    distribuicao: {
      gratuitos: 60,   // 60% das operações
      economicos: 25,  // 25% das operações
      intermediarios: 10, // 10% das operações
      premium: 5       // 5% das operações
    },
    preferencias: {
      tarefaSimples: 'llama-3.3-70b',         // Gratuito
      tarefaMedia: 'claude-haiku-4',          // Barato
      tarefaComplexa: 'claude-sonnet-4',      // Médio
      tarefaCritica: 'claude-opus-4'          // Premium (apenas 5%)
    },
    limites: {
      custoMaximoDiario: 10.00,   // $10/dia
      custoMaximoMensal: 150.00,  // $150/mês
      alertaEm: 0.80              // Alerta em 80% do limite
    }
  },

  // Estratégia 2: BALANCEADO (40-60% economia)
  balanceado: {
    id: 'balanceado',
    nome: 'Balanceado',
    descricao: 'Equilíbrio entre custo e qualidade. Usa modelos intermediários frequentemente.',
    icone: '⚖️',
    cor: '#4299e1',
    custoEstimado: '$245.00/mês (1000 ops)',
    economia: '64%',
    distribuicao: {
      gratuitos: 30,      // 30% das operações
      economicos: 30,     // 30% das operações
      intermediarios: 30, // 30% das operações
      premium: 10         // 10% das operações
    },
    preferencias: {
      tarefaSimples: 'llama-3.3-70b',         // Gratuito
      tarefaMedia: 'claude-haiku-4',          // Barato
      tarefaComplexa: 'claude-sonnet-4',      // Médio
      tarefaCritica: 'claude-opus-4'          // Premium
    },
    limites: {
      custoMaximoDiario: 20.00,   // $20/dia
      custoMaximoMensal: 300.00,  // $300/mês
      alertaEm: 0.80
    }
  },

  // Estratégia 3: QUALIDADE MÁXIMA (0% economia, usa premium sempre)
  qualidadeMaxima: {
    id: 'qualidadeMaxima',
    nome: 'Qualidade Máxima',
    descricao: 'Sempre usa modelos premium para garantir excelência absoluta em todas as tarefas.',
    icone: '💎',
    cor: '#9f7aea',
    custoEstimado: '$675.00/mês (1000 ops)',
    economia: '0%',
    distribuicao: {
      gratuitos: 0,        // 0% das operações
      economicos: 0,       // 0% das operações
      intermediarios: 20,  // 20% das operações
      premium: 80          // 80% das operações
    },
    preferencias: {
      tarefaSimples: 'claude-haiku-4',        // Barato (mínimo aceitável)
      tarefaMedia: 'claude-sonnet-4',         // Médio
      tarefaComplexa: 'claude-sonnet-4.5',    // Premium
      tarefaCritica: 'claude-opus-4'          // Premium
    },
    limites: {
      custoMaximoDiario: 50.00,   // $50/dia
      custoMaximoMensal: 1000.00, // $1000/mês
      alertaEm: 0.90
    }
  },

  // Estratégia 4: PERSONALIZADA (configurada manualmente)
  personalizada: {
    id: 'personalizada',
    nome: 'Personalizada',
    descricao: 'Configuração customizada pelo escritório. Controle total sobre cada parâmetro.',
    icone: '⚙️',
    cor: '#ed8936',
    custoEstimado: 'Variável',
    economia: 'Variável',
    distribuicao: {
      gratuitos: 40,
      economicos: 30,
      intermediarios: 20,
      premium: 10
    },
    preferencias: {
      tarefaSimples: 'llama-3.3-70b',
      tarefaMedia: 'claude-haiku-4',
      tarefaComplexa: 'claude-sonnet-4',
      tarefaCritica: 'claude-opus-4'
    },
    limites: {
      custoMaximoDiario: 25.00,
      custoMaximoMensal: 500.00,
      alertaEm: 0.80
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// GERENCIADOR DE CONFIGURAÇÕES
// ═══════════════════════════════════════════════════════════════

class PartnerOfficeSettings {
  constructor() {
    this.settings = this.loadAllSettings();
  }

  /**
   * Carregar todas as configurações de escritórios
   */
  loadAllSettings() {
    const settings = {};

    if (fs.existsSync(SETTINGS_DIR)) {
      const files = fs.readdirSync(SETTINGS_DIR);

      files.forEach(file => {
        if (file.endsWith('.json')) {
          const officeId = file.replace('.json', '');
          const filePath = path.join(SETTINGS_DIR, file);

          try {
            const data = fs.readFileSync(filePath, 'utf8');
            settings[officeId] = JSON.parse(data);
          } catch (error) {
            console.error(`Erro ao carregar configurações de ${officeId}:`, error);
          }
        }
      });
    }

    return settings;
  }

  /**
   * Salvar configurações de um escritório
   */
  saveSettings(officeId, settings) {
    const filePath = path.join(SETTINGS_DIR, `${officeId}.json`);

    try {
      fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');
      this.settings[officeId] = settings;
      return { success: true };
    } catch (error) {
      console.error(`Erro ao salvar configurações de ${officeId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Criar configuração inicial para escritório
   */
  createOfficeSettings(params = {}) {
    const {
      officeId,
      officeName,
      estrategia = 'balanceado',  // Padrão: balanceado
      limitesMensais = null,
      alertas = true
    } = params;

    if (!officeId || !officeName) {
      throw new Error('officeId e officeName são obrigatórios');
    }

    const estrategiaConfig = ESTRATEGIAS_IA[estrategia] || ESTRATEGIAS_IA.balanceado;

    const settings = {
      officeId,
      officeName,
      estrategia: estrategiaConfig.id,
      estrategiaConfig: { ...estrategiaConfig },

      // Limites personalizados (sobrescreve padrão da estratégia)
      limites: limitesMensais || estrategiaConfig.limites,

      // Alertas
      alertas: {
        ativo: alertas,
        email: null,
        webhook: null,
        niveis: {
          '50%': { enviado: false },
          '80%': { enviado: false },
          '95%': { enviado: false },
          '100%': { enviado: false }
        }
      },

      // Estatísticas de uso
      estatisticas: {
        mes: new Date().toISOString().slice(0, 7), // YYYY-MM
        operacoes: 0,
        custoTotal: 0,
        custoPorModelo: {},
        distribuicaoReal: {
          gratuitos: 0,
          economicos: 0,
          intermediarios: 0,
          premium: 0
        }
      },

      // Metadados
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return this.saveSettings(officeId, settings);
  }

  /**
   * Obter configurações de um escritório
   */
  getSettings(officeId) {
    if (!this.settings[officeId]) {
      // Criar configuração padrão se não existir
      this.createOfficeSettings({
        officeId,
        officeName: officeId,
        estrategia: 'balanceado'
      });
    }

    return this.settings[officeId];
  }

  /**
   * Atualizar estratégia de um escritório
   */
  updateEstrategia(officeId, novaEstrategia) {
    const settings = this.getSettings(officeId);

    if (!ESTRATEGIAS_IA[novaEstrategia]) {
      return { success: false, error: 'Estratégia inválida' };
    }

    const estrategiaConfig = ESTRATEGIAS_IA[novaEstrategia];

    settings.estrategia = novaEstrategia;
    settings.estrategiaConfig = { ...estrategiaConfig };
    settings.updatedAt = new Date().toISOString();

    return this.saveSettings(officeId, settings);
  }

  /**
   * Atualizar limites de custo
   */
  updateLimites(officeId, novosLimites) {
    const settings = this.getSettings(officeId);

    settings.limites = {
      ...settings.limites,
      ...novosLimites
    };
    settings.updatedAt = new Date().toISOString();

    return this.saveSettings(officeId, settings);
  }

  /**
   * Registrar operação e calcular custo
   */
  registrarOperacao(officeId, operacao) {
    const {
      modelo,
      inputTokens,
      outputTokens,
      custo,
      tier  // 1=gratuito, 2=economico, 3=intermediario, 4=premium
    } = operacao;

    const settings = this.getSettings(officeId);

    // Verificar se é o mesmo mês
    const mesAtual = new Date().toISOString().slice(0, 7);
    if (settings.estatisticas.mes !== mesAtual) {
      // Novo mês, resetar estatísticas
      settings.estatisticas = {
        mes: mesAtual,
        operacoes: 0,
        custoTotal: 0,
        custoPorModelo: {},
        distribuicaoReal: {
          gratuitos: 0,
          economicos: 0,
          intermediarios: 0,
          premium: 0
        }
      };
    }

    // Atualizar estatísticas
    settings.estatisticas.operacoes++;
    settings.estatisticas.custoTotal += custo;

    // Custo por modelo
    if (!settings.estatisticas.custoPorModelo[modelo]) {
      settings.estatisticas.custoPorModelo[modelo] = { operacoes: 0, custo: 0 };
    }
    settings.estatisticas.custoPorModelo[modelo].operacoes++;
    settings.estatisticas.custoPorModelo[modelo].custo += custo;

    // Distribuição real
    const tierMap = {
      1: 'gratuitos',
      2: 'economicos',
      3: 'intermediarios',
      4: 'premium'
    };
    const tierKey = tierMap[tier] || 'economicos';
    settings.estatisticas.distribuicaoReal[tierKey]++;

    settings.updatedAt = new Date().toISOString();

    // Verificar alertas
    const alertas = this.verificarAlertas(officeId, settings);

    // Salvar
    this.saveSettings(officeId, settings);

    return {
      success: true,
      custoTotal: settings.estatisticas.custoTotal,
      limite: settings.limites.custoMaximoMensal,
      percentualUsado: (settings.estatisticas.custoTotal / settings.limites.custoMaximoMensal * 100).toFixed(1) + '%',
      alertas
    };
  }

  /**
   * Verificar alertas de custo
   */
  verificarAlertas(officeId, settings) {
    const custoAtual = settings.estatisticas.custoTotal;
    const limiteMax = settings.limites.custoMaximoMensal;
    const percentual = (custoAtual / limiteMax) * 100;

    const alertas = [];

    // Verificar níveis de alerta
    const niveis = [
      { nivel: '50%', percentual: 50 },
      { nivel: '80%', percentual: 80 },
      { nivel: '95%', percentual: 95 },
      { nivel: '100%', percentual: 100 }
    ];

    niveis.forEach(({ nivel, percentual: limitePercentual }) => {
      if (percentual >= limitePercentual && !settings.alertas.niveis[nivel].enviado) {
        alertas.push({
          nivel,
          percentual: percentual.toFixed(1) + '%',
          custoAtual: custoAtual.toFixed(2),
          limite: limiteMax.toFixed(2),
          mensagem: `⚠️ Alerta: ${nivel} do limite mensal atingido ($${custoAtual.toFixed(2)} de $${limiteMax.toFixed(2)})`
        });

        // Marcar como enviado
        settings.alertas.niveis[nivel].enviado = true;
      }
    });

    return alertas;
  }

  /**
   * Obter modelo recomendado baseado na configuração do escritório
   */
  getModeloRecomendado(officeId, complexidade) {
    const settings = this.getSettings(officeId);
    const prefs = settings.estrategiaConfig.preferencias;

    const complexityMap = {
      1: prefs.tarefaSimples,
      2: prefs.tarefaMedia,
      3: prefs.tarefaComplexa,
      4: prefs.tarefaCritica
    };

    return complexityMap[complexidade] || prefs.tarefaMedia;
  }

  /**
   * Obter estatísticas do escritório
   */
  getEstatisticas(officeId) {
    const settings = this.getSettings(officeId);

    const { estatisticas, limites, estrategiaConfig } = settings;

    const percentualLimite = (estatisticas.custoTotal / limites.custoMaximoMensal * 100).toFixed(1);

    // Calcular distribuição percentual real
    const total = estatisticas.operacoes;
    const distribuicaoPercentual = {};

    Object.keys(estatisticas.distribuicaoReal).forEach(key => {
      distribuicaoPercentual[key] = total > 0
        ? ((estatisticas.distribuicaoReal[key] / total) * 100).toFixed(1) + '%'
        : '0%';
    });

    return {
      officeId,
      mes: estatisticas.mes,
      estrategia: {
        id: settings.estrategia,
        nome: estrategiaConfig.nome,
        icone: estrategiaConfig.icone
      },
      operacoes: estatisticas.operacoes,
      custo: {
        total: estatisticas.custoTotal.toFixed(2),
        limite: limites.custoMaximoMensal.toFixed(2),
        percentualUsado: percentualLimite + '%',
        restante: (limites.custoMaximoMensal - estatisticas.custoTotal).toFixed(2),
        status: percentualLimite < 80 ? 'ok' : percentualLimite < 95 ? 'alerta' : 'critico'
      },
      distribuicao: {
        esperada: estrategiaConfig.distribuicao,
        real: estatisticas.distribuicaoReal,
        percentual: distribuicaoPercentual
      },
      modelosMaisUsados: this.getModelosMaisUsados(estatisticas.custoPorModelo)
    };
  }

  /**
   * Obter modelos mais usados
   */
  getModelosMaisUsados(custoPorModelo) {
    return Object.entries(custoPorModelo)
      .map(([modelo, data]) => ({
        modelo,
        operacoes: data.operacoes,
        custo: data.custo.toFixed(4)
      }))
      .sort((a, b) => b.operacoes - a.operacoes)
      .slice(0, 5);
  }

  /**
   * Listar todas as estratégias disponíveis
   */
  listarEstrategias() {
    return Object.values(ESTRATEGIAS_IA).map(estrategia => ({
      id: estrategia.id,
      nome: estrategia.nome,
      descricao: estrategia.descricao,
      icone: estrategia.icone,
      cor: estrategia.cor,
      custoEstimado: estrategia.custoEstimado,
      economia: estrategia.economia,
      distribuicao: estrategia.distribuicao
    }));
  }

  /**
   * Comparar estratégias
   */
  compararEstrategias() {
    return {
      estrategias: this.listarEstrategias(),
      comparacao: {
        economia: {
          melhor: 'economia',
          economia: ESTRATEGIAS_IA.economia.custoEstimado
        },
        balanceado: {
          recomendado: 'balanceado',
          custoMedio: ESTRATEGIAS_IA.balanceado.custoEstimado
        },
        qualidade: {
          melhorQualidade: 'qualidadeMaxima',
          custo: ESTRATEGIAS_IA.qualidadeMaxima.custoEstimado
        }
      },
      recomendacao: {
        paraIniciantes: 'balanceado',
        paraEconomia: 'economia',
        paraExcelencia: 'qualidadeMaxima',
        paraAvancados: 'personalizada'
      }
    };
  }
}

// Exportar instância única
const partnerSettings = new PartnerOfficeSettings();
export default partnerSettings;
export { PartnerOfficeSettings };
