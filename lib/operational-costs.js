/**
 * Cálculo de Custos Operacionais Completos
 * Inclui TODOS os custos de infraestrutura e serviços
 */

export const OPERATIONAL_COSTS = {
  // Custos Fixos Mensais (USD)
  monthly: {
    // Hospedagem
    render: {
      free: 0,           // Plan free (limitado)
      starter: 7,        // Plan starter
      standard: 25,      // Plan standard
      pro: 85            // Plan pro
    },

    // Repositório
    github: {
      free: 0,           // Public repo
      team: 4,           // GitHub Team (por usuário/mês)
      enterprise: 21     // GitHub Enterprise
    },

    // Armazenamento
    storage: {
      render_disk: 1,    // 1GB disco adicional no Render
      s3: 0.023          // AWS S3 ($0.023/GB/mês)
    },

    // Domínio
    domain: {
      br: 40 / 12,       // .com.br (~R$40/ano = ~$7/ano = ~$0.58/mês)
      com: 12 / 12       // .com (~$12/ano = ~$1/mês)
    },

    // SSL
    ssl: 0,              // Gratuito (Let's Encrypt via Render)

    // Monitoramento
    monitoring: 0,       // Gratuito (logs básicos do Render)

    // Email
    email: 0,            // Gratuito (CloudFlare ou similar)

    // TOTAL MENSAL MÍNIMO (Plan Free + domínio .br)
    total_minimum: 0 + 0 + 0 + (40 / 12) + 0 + 0 + 0 // ~$0.58/mês
  },

  // Custos Variáveis (por operação)
  variable: {
    // AWS Bedrock (por 1K tokens)
    bedrock: {
      haiku: { input: 0.00025, output: 0.00125 },
      sonnet: { input: 0.003, output: 0.015 },
      opus: { input: 0.015, output: 0.075 }
    },

    // Processamento
    compute: {
      render_cpu: 0,     // Incluído no plan
      lambda: 0.0000002  // AWS Lambda (se usar)
    },

    // Rede/Banda
    bandwidth: {
      render: 0,         // 100GB/mês incluído
      cdn: 0             // CloudFlare free
    },

    // API Calls
    api_calls: {
      github_actions: 0, // 2000 min/mês grátis
      render_api: 0      // Ilimitado
    }
  },

  // Taxas de Transação
  transaction_fees: {
    // IOF (Imposto sobre Operações Financeiras)
    iof: 0.0638,         // 6.38% para transações internacionais

    // Payment Gateway (se usar)
    stripe: {
      percentage: 0.029, // 2.9% + $0.30 por transação
      fixed: 0.30
    },

    paypal: {
      percentage: 0.0349, // 3.49% + $0.49 por transação
      fixed: 0.49
    },

    mercadopago: {
      percentage: 0.0499, // 4.99% por transação
      fixed: 0.39
    },

    // PIX (Brasil)
    pix: {
      percentage: 0,      // Geralmente gratuito
      fixed: 0
    }
  },

  // Margens
  margins: {
    operational_markup: 0.15,  // 15% para custos operacionais
    profit_margin: 0.30        // 30% margem de lucro
  }
};

/**
 * Calcula o custo operacional total por operação
 */
export function calculateOperationalCosts(params = {}) {
  const {
    model = 'sonnet',
    inputTokens = 5000,
    outputTokens = 8000,
    monthlyOperations = 1000,    // Estimativa de operações/mês para rateio de fixos
    paymentMethod = 'pix',        // Método de pagamento
    planType = 'free'             // Tipo de plan Render
  } = params;

  // 1. Custo de IA (Bedrock)
  const modelPricing = OPERATIONAL_COSTS.variable.bedrock[model.toLowerCase()];
  const inputCost = (inputTokens / 1000) * modelPricing.input;
  const outputCost = (outputTokens / 1000) * modelPricing.output;
  const aiCost = inputCost + outputCost;

  // 2. Rateio de Custos Fixos Mensais
  const monthlyFixed =
    OPERATIONAL_COSTS.monthly.render[planType] +
    OPERATIONAL_COSTS.monthly.github.free +
    OPERATIONAL_COSTS.monthly.domain.br +
    OPERATIONAL_COSTS.monthly.storage.render_disk;

  const fixedCostPerOperation = monthlyFixed / monthlyOperations;

  // 3. Custo Total antes de impostos
  const subtotal = aiCost + fixedCostPerOperation;

  // 4. IOF (6.38%)
  const iofAmount = subtotal * OPERATIONAL_COSTS.transaction_fees.iof;
  const subtotalWithIOF = subtotal + iofAmount;

  // 5. Taxa de Payment Gateway
  const paymentFees = OPERATIONAL_COSTS.transaction_fees[paymentMethod];
  const paymentFeeAmount = paymentFees.percentage
    ? subtotalWithIOF * paymentFees.percentage + (paymentFees.fixed || 0)
    : 0;

  const subtotalWithPayment = subtotalWithIOF + paymentFeeAmount;

  // 6. Markup Operacional (15%)
  const operationalMarkup = subtotalWithPayment * OPERATIONAL_COSTS.margins.operational_markup;

  // 7. Margem de Lucro (30%)
  const profitMargin = (subtotalWithPayment + operationalMarkup) * OPERATIONAL_COSTS.margins.profit_margin;

  // 8. Preço Final
  const finalPrice = subtotalWithPayment + operationalMarkup + profitMargin;

  return {
    breakdown: {
      aiCost: aiCost.toFixed(6),
      fixedCostPerOperation: fixedCostPerOperation.toFixed(6),
      subtotal: subtotal.toFixed(6),
      iof: iofAmount.toFixed(6),
      subtotalWithIOF: subtotalWithIOF.toFixed(6),
      paymentFee: paymentFeeAmount.toFixed(6),
      subtotalWithPayment: subtotalWithPayment.toFixed(6),
      operationalMarkup: operationalMarkup.toFixed(6),
      profitMargin: profitMargin.toFixed(6),
      finalPrice: finalPrice.toFixed(4)
    },
    summary: {
      costUSD: finalPrice.toFixed(4),
      costBRL: (finalPrice * 5.80).toFixed(2),
      effectiveMargin: (((finalPrice - subtotal) / subtotal) * 100).toFixed(2) + '%'
    },
    details: {
      model,
      inputTokens,
      outputTokens,
      planType,
      paymentMethod,
      monthlyFixed: monthlyFixed.toFixed(2),
      monthlyOperations
    },
    notes: [
      `Custo IA (Bedrock ${model}): $${aiCost.toFixed(6)}`,
      `Rateio custos fixos ($${monthlyFixed.toFixed(2)}/mês ÷ ${monthlyOperations} ops): $${fixedCostPerOperation.toFixed(6)}`,
      `IOF 6.38%: $${iofAmount.toFixed(6)}`,
      `Taxa pagamento (${paymentMethod}): $${paymentFeeAmount.toFixed(6)}`,
      `Markup operacional 15%: $${operationalMarkup.toFixed(6)}`,
      `Margem lucro 30%: $${profitMargin.toFixed(6)}`,
      `PREÇO FINAL inclui TODOS os custos operacionais`
    ]
  };
}

/**
 * Calcula custos mensais projetados
 */
export function projectMonthlyCosts(params = {}) {
  const {
    estimatedOperations = 1000,
    modelDistribution = { haiku: 0.3, sonnet: 0.6, opus: 0.1 },
    avgInputTokens = 5000,
    avgOutputTokens = 8000,
    planType = 'starter'
  } = params;

  const costs = {
    haiku: calculateOperationalCosts({
      model: 'haiku',
      inputTokens: avgInputTokens,
      outputTokens: avgOutputTokens,
      monthlyOperations: estimatedOperations,
      planType
    }),
    sonnet: calculateOperationalCosts({
      model: 'sonnet',
      inputTokens: avgInputTokens,
      outputTokens: avgOutputTokens,
      monthlyOperations: estimatedOperations,
      planType
    }),
    opus: calculateOperationalCosts({
      model: 'opus',
      inputTokens: avgInputTokens,
      outputTokens: avgOutputTokens,
      monthlyOperations: estimatedOperations,
      planType
    })
  };

  const avgCostPerOperation =
    (parseFloat(costs.haiku.summary.costUSD) * modelDistribution.haiku) +
    (parseFloat(costs.sonnet.summary.costUSD) * modelDistribution.sonnet) +
    (parseFloat(costs.opus.summary.costUSD) * modelDistribution.opus);

  const monthlyRevenue = avgCostPerOperation * estimatedOperations;
  const monthlyProfit = monthlyRevenue * 0.30; // 30% margem

  return {
    estimatedOperations,
    avgCostPerOperation: avgCostPerOperation.toFixed(4),
    monthlyRevenue: monthlyRevenue.toFixed(2),
    monthlyProfit: monthlyProfit.toFixed(2),
    breakdownByModel: costs
  };
}

export default {
  OPERATIONAL_COSTS,
  calculateOperationalCosts,
  projectMonthlyCosts
};
