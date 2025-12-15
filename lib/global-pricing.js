/**
 * SISTEMA DE TARIFAÇÃO GLOBAL - ROM Agent
 * Visível APENAS para equipe ROM
 *
 * Calcula custos totais incluindo:
 * - Uso da equipe ROM
 * - Uso de todos os escritórios parceiros
 * - Uso individual de cada usuário
 * - Custos operacionais (hospedagem, Render, GitHub, AWS)
 * - IOF (6.38%)
 * - Taxas de método de pagamento
 * - Margem de lucro
 */

import { OPERATIONAL_COSTS } from './operational-costs.js';

// ═══════════════════════════════════════════════════════════════
// CUSTOS FIXOS MENSAIS GLOBAIS
// ═══════════════════════════════════════════════════════════════

export const GLOBAL_FIXED_COSTS = {
  // Infraestrutura
  infrastructure: {
    render: 7,              // Render Plan Starter
    github: 0,              // GitHub Free (public repo)
    domain: 40 / 12,        // .com.br anual / 12
    ssl: 0,                 // Let's Encrypt (grátis)
    storage: 0,             // 1GB incluído no Render
    backup: 0               // Automático
  },

  // Operação
  operational: {
    monitoring: 0,          // Logs básicos grátis
    support: 0,             // Email suporte incluído
    maintenance: 50,        // Custo mensal de manutenção/updates
    development: 200,       // Custo de desenvolvimento contínuo
    claudeCode: 20,         // Claude Code Pro (se aplicável)
    anthropicAPI: 0         // API Anthropic (alternativa ao Bedrock, se usar)
  },

  // Total mensal fixo
  get total() {
    const infra = Object.values(this.infrastructure).reduce((a, b) => a + b, 0);
    const ops = Object.values(this.operational).reduce((a, b) => a + b, 0);
    return infra + ops;
  }
};

// ═══════════════════════════════════════════════════════════════
// CUSTOS VARIÁVEIS POR OPERAÇÃO
// ═══════════════════════════════════════════════════════════════

export const VARIABLE_COSTS = {
  // AWS Bedrock (por 1K tokens) - PRINCIPAL
  // Recomendado: Melhor custo, sem limite de rate, deploy controlado
  bedrock: {
    haiku: {
      input: 0.00025,   // $0.25 por 1M tokens
      output: 0.00125   // $1.25 por 1M tokens
    },
    sonnet: {
      input: 0.003,     // $3.00 por 1M tokens
      output: 0.015     // $15.00 por 1M tokens
    },
    opus: {
      input: 0.015,     // $15.00 por 1M tokens
      output: 0.075     // $75.00 por 1M tokens
    }
  },

  // Anthropic API (alternativa/fallback) - por 1K tokens
  // Usar apenas se Bedrock indisponível
  anthropic: {
    haiku: {
      input: 0.00025,
      output: 0.00125
    },
    sonnet: {
      input: 0.003,
      output: 0.015
    },
    opus: {
      input: 0.015,
      output: 0.075
    }
  },

  // DataJud API (se aplicável)
  datajud: {
    perQuery: 0.01          // $0.01 por consulta
  },

  // Storage (por GB/mês)
  storage: {
    perGB: 0.023            // AWS S3 pricing
  }
};

// ═══════════════════════════════════════════════════════════════
// TAXAS E IMPOSTOS
// ═══════════════════════════════════════════════════════════════

export const FEES_AND_TAXES = {
  // IOF para transações internacionais
  iof: 0.0638,              // 6.38%

  // Métodos de pagamento
  payment: {
    pix: {
      percentage: 0,
      fixed: 0
    },
    credit_card: {
      percentage: 0.0349,   // 3.49%
      fixed: 0.39
    },
    boleto: {
      percentage: 0.0199,   // 1.99%
      fixed: 2.50
    },
    transfer: {
      percentage: 0,
      fixed: 0
    }
  },

  // Impostos Brasil
  taxes: {
    iss: 0.05,              // ISS 5% (serviço)
    pis: 0.0065,            // PIS 0.65%
    cofins: 0.03            // COFINS 3%
  },

  // Total de impostos
  get totalTaxes() {
    return this.taxes.iss + this.taxes.pis + this.taxes.cofins;
  }
};

// ═══════════════════════════════════════════════════════════════
// MARGENS DE LUCRO
// ═══════════════════════════════════════════════════════════════

export const PROFIT_MARGINS = {
  // Margem por tipo de cliente
  rom_team: 0,              // 0% - custo interno
  partner_office: 0.30,     // 30% margem para escritórios parceiros
  partner_user: 0.40,       // 40% margem para usuários finais

  // Margem por tipo de plano
  prepaid: 0.25,            // 25% margem créditos prepagos
  basic: 0.35,              // 35% margem plano básico
  professional: 0.40,       // 40% margem plano profissional
  enterprise: 0.45          // 45% margem plano enterprise
};

// ═══════════════════════════════════════════════════════════════
// CÁLCULO DE CUSTO GLOBAL POR OPERAÇÃO
// ═══════════════════════════════════════════════════════════════

/**
 * Calcula custo completo de uma operação
 * Inclui TODOS os custos operacionais
 */
export function calculateGlobalOperationCost(params = {}) {
  const {
    model = 'sonnet',
    inputTokens = 5000,
    outputTokens = 8000,
    includeDataJud = false,
    storageGB = 0,
    clientType = 'partner_user',  // rom_team | partner_office | partner_user
    paymentMethod = 'pix',
    monthlyOperations = 1000       // Para rateio de custos fixos
  } = params;

  // 1. Custo de IA (Bedrock)
  const modelPricing = VARIABLE_COSTS.bedrock[model.toLowerCase()];
  const aiCost = (inputTokens / 1000) * modelPricing.input +
                 (outputTokens / 1000) * modelPricing.output;

  // 2. Custo de APIs externas
  const apiCost = includeDataJud ? VARIABLE_COSTS.datajud.perQuery : 0;

  // 3. Custo de storage (se aplicável)
  const storageCost = storageGB * VARIABLE_COSTS.storage.perGB;

  // 4. Rateio de custos fixos mensais
  const fixedCostPerOperation = GLOBAL_FIXED_COSTS.total / monthlyOperations;

  // 5. Custo base total
  const baseCost = aiCost + apiCost + storageCost + fixedCostPerOperation;

  // 6. IOF (6.38%)
  const iofAmount = baseCost * FEES_AND_TAXES.iof;

  // 7. Subtotal com IOF
  const subtotalWithIOF = baseCost + iofAmount;

  // 8. Taxa de método de pagamento
  const paymentFee = FEES_AND_TAXES.payment[paymentMethod];
  const paymentFeeAmount = paymentFee.percentage
    ? subtotalWithIOF * paymentFee.percentage + paymentFee.fixed
    : paymentFee.fixed;

  // 9. Subtotal com pagamento
  const subtotalWithPayment = subtotalWithIOF + paymentFeeAmount;

  // 10. Impostos (ISS + PIS + COFINS)
  const taxAmount = subtotalWithPayment * FEES_AND_TAXES.totalTaxes;

  // 11. Custo total (sem margem)
  const totalCost = subtotalWithPayment + taxAmount;

  // 12. Margem de lucro (baseada no tipo de cliente)
  const profitMargin = PROFIT_MARGINS[clientType] || 0.30;
  const profitAmount = totalCost * profitMargin;

  // 13. Preço final de venda
  const finalPrice = totalCost + profitAmount;

  return {
    breakdown: {
      aiCost: aiCost.toFixed(6),
      apiCost: apiCost.toFixed(6),
      storageCost: storageCost.toFixed(6),
      fixedCostPerOp: fixedCostPerOperation.toFixed(6),
      baseCost: baseCost.toFixed(6),
      iof: iofAmount.toFixed(6),
      paymentFee: paymentFeeAmount.toFixed(6),
      taxes: taxAmount.toFixed(6),
      totalCost: totalCost.toFixed(6),
      profitMargin: profitAmount.toFixed(6),
      finalPrice: finalPrice.toFixed(6)
    },
    summary: {
      costUSD: totalCost.toFixed(4),
      priceUSD: finalPrice.toFixed(4),
      costBRL: (totalCost * 5.80).toFixed(2),
      priceBRL: (finalPrice * 5.80).toFixed(2),
      profitUSD: profitAmount.toFixed(4),
      profitBRL: (profitAmount * 5.80).toFixed(2),
      marginPercentage: (profitMargin * 100).toFixed(1) + '%'
    },
    details: {
      model,
      inputTokens,
      outputTokens,
      clientType,
      paymentMethod,
      monthlyOperations,
      exchangeRate: 5.80
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// CÁLCULO DE CUSTO MENSAL POR ESCRITÓRIO
// ═══════════════════════════════════════════════════════════════

/**
 * Calcula custo mensal total de um escritório
 */
export function calculateOfficeMonthlyCost(params = {}) {
  const {
    officeId,
    officeName,
    userCount = 1,
    operations = {
      haiku: 100,
      sonnet: 500,
      opus: 50
    },
    datajudQueries = 0,
    storageGB = 1,
    paymentMethod = 'pix'
  } = params;

  const totalOperations = operations.haiku + operations.sonnet + operations.opus;

  // Calcular custo para cada modelo
  const costs = {
    haiku: calculateGlobalOperationCost({
      model: 'haiku',
      inputTokens: 3000,
      outputTokens: 5000,
      clientType: 'partner_office',
      paymentMethod,
      monthlyOperations: totalOperations
    }),
    sonnet: calculateGlobalOperationCost({
      model: 'sonnet',
      inputTokens: 5000,
      outputTokens: 8000,
      clientType: 'partner_office',
      paymentMethod,
      monthlyOperations: totalOperations
    }),
    opus: calculateGlobalOperationCost({
      model: 'opus',
      inputTokens: 8000,
      outputTokens: 12000,
      clientType: 'partner_office',
      paymentMethod,
      monthlyOperations: totalOperations
    })
  };

  // Custo total mensal
  const monthlyCost =
    (parseFloat(costs.haiku.summary.costUSD) * operations.haiku) +
    (parseFloat(costs.sonnet.summary.costUSD) * operations.sonnet) +
    (parseFloat(costs.opus.summary.costUSD) * operations.opus) +
    (datajudQueries * VARIABLE_COSTS.datajud.perQuery) +
    (storageGB * VARIABLE_COSTS.storage.perGB);

  const monthlyRevenue =
    (parseFloat(costs.haiku.summary.priceUSD) * operations.haiku) +
    (parseFloat(costs.sonnet.summary.priceUSD) * operations.sonnet) +
    (parseFloat(costs.opus.summary.priceUSD) * operations.opus);

  const monthlyProfit = monthlyRevenue - monthlyCost;

  return {
    officeId,
    officeName,
    userCount,
    operations: {
      total: totalOperations,
      byModel: operations,
      datajudQueries,
      storageGB
    },
    costs: {
      monthlyCostUSD: monthlyCost.toFixed(2),
      monthlyRevenueUSD: monthlyRevenue.toFixed(2),
      monthlyProfitUSD: monthlyProfit.toFixed(2),
      monthlyCostBRL: (monthlyCost * 5.80).toFixed(2),
      monthlyRevenueBRL: (monthlyRevenue * 5.80).toFixed(2),
      monthlyProfitBRL: (monthlyProfit * 5.80).toFixed(2),
      costPerUser: (monthlyCost / userCount).toFixed(2),
      revenuePerUser: (monthlyRevenue / userCount).toFixed(2),
      profitMargin: ((monthlyProfit / monthlyRevenue) * 100).toFixed(1) + '%'
    },
    breakdown: costs
  };
}

// ═══════════════════════════════════════════════════════════════
// VISÃO GLOBAL - TODOS OS ESCRITÓRIOS
// ═══════════════════════════════════════════════════════════════

/**
 * Calcula métricas globais de todos os escritórios
 * APENAS para equipe ROM
 */
export function calculateGlobalMetrics(offices = []) {
  let totalCost = 0;
  let totalRevenue = 0;
  let totalUsers = 0;
  let totalOperations = 0;

  const officeDetails = offices.map(office => {
    const officeCost = calculateOfficeMonthlyCost(office);

    totalCost += parseFloat(officeCost.costs.monthlyCostUSD);
    totalRevenue += parseFloat(officeCost.costs.monthlyRevenueUSD);
    totalUsers += office.userCount;
    totalOperations += officeCost.operations.total;

    return officeCost;
  });

  const totalProfit = totalRevenue - totalCost;

  // Adicionar custos fixos globais
  const globalFixedCosts = GLOBAL_FIXED_COSTS.total;
  const netProfit = totalProfit - globalFixedCosts;

  return {
    global: {
      totalOffices: offices.length,
      totalUsers,
      totalOperations,
      totalCostUSD: totalCost.toFixed(2),
      totalRevenueUSD: totalRevenue.toFixed(2),
      totalProfitUSD: totalProfit.toFixed(2),
      globalFixedCosts: globalFixedCosts.toFixed(2),
      netProfitUSD: netProfit.toFixed(2),
      totalCostBRL: (totalCost * 5.80).toFixed(2),
      totalRevenueBRL: (totalRevenue * 5.80).toFixed(2),
      netProfitBRL: (netProfit * 5.80).toFixed(2),
      profitMargin: ((netProfit / totalRevenue) * 100).toFixed(1) + '%',
      costPerUser: (totalCost / totalUsers).toFixed(2),
      revenuePerUser: (totalRevenue / totalUsers).toFixed(2)
    },
    offices: officeDetails,
    fixedCosts: GLOBAL_FIXED_COSTS
  };
}

export default {
  GLOBAL_FIXED_COSTS,
  VARIABLE_COSTS,
  FEES_AND_TAXES,
  PROFIT_MARGINS,
  calculateGlobalOperationCost,
  calculateOfficeMonthlyCost,
  calculateGlobalMetrics
};
