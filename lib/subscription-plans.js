/**
 * SISTEMA DE PLANOS MENSAIS (ASSINATURAS)
 * Para escritórios parceiros e usuários finais
 *
 * Tipos de planos:
 * - Básico: Uso leve
 * - Profissional: Uso médio
 * - Enterprise: Uso ilimitado
 */

import { CREDIT_RATES } from './prepaid-credits.js';

// ═══════════════════════════════════════════════════════════════
// PLANOS PARA ESCRITÓRIOS PARCEIROS
// ═══════════════════════════════════════════════════════════════

export const PARTNER_PLANS = {
  // Plano Básico - Escritórios pequenos
  basic: {
    name: 'Básico Parceiro',
    priceUSD: 99,
    priceBRL: 574.20,
    billingCycle: 'monthly',

    limits: {
      users: 3,                     // Até 3 usuários
      operationsPerMonth: 500,      // 500 operações/mês
      modelsAllowed: ['haiku', 'sonnet'],  // Apenas Haiku e Sonnet
      storageGB: 5,                 // 5GB storage
      support: 'email'              // Suporte por email
    },

    features: [
      'Até 3 usuários',
      '500 operações/mês',
      'Modelos Haiku e Sonnet',
      '5GB de armazenamento',
      'Suporte por email',
      'Timbrado personalizado',
      'Relatórios básicos'
    ],

    recommended: 'Escritórios com 1-3 advogados'
  },

  // Plano Profissional - Escritórios médios
  professional: {
    name: 'Profissional Parceiro',
    priceUSD: 249,
    priceBRL: 1444.20,
    billingCycle: 'monthly',
    popular: true,

    limits: {
      users: 10,                    // Até 10 usuários
      operationsPerMonth: 2000,     // 2000 operações/mês
      modelsAllowed: ['haiku', 'sonnet', 'opus'],  // Todos os modelos
      storageGB: 25,                // 25GB storage
      support: 'priority'           // Suporte prioritário
    },

    features: [
      'Até 10 usuários',
      '2000 operações/mês',
      'Todos os modelos (Haiku, Sonnet, Opus)',
      '25GB de armazenamento',
      'Suporte prioritário',
      'Timbrado personalizado',
      'Relatórios avançados',
      'Integrações DataJud e JusBrasil',
      'API de acesso',
      'White label disponível'
    ],

    recommended: 'Escritórios com 4-10 advogados'
  },

  // Plano Enterprise - Escritórios grandes
  enterprise: {
    name: 'Enterprise Parceiro',
    priceUSD: 699,
    priceBRL: 4054.20,
    billingCycle: 'monthly',

    limits: {
      users: -1,                    // Usuários ilimitados
      operationsPerMonth: 10000,    // 10000 operações/mês
      modelsAllowed: ['haiku', 'sonnet', 'opus'],
      storageGB: 100,               // 100GB storage
      support: 'dedicated'          // Gerente de conta dedicado
    },

    features: [
      'Usuários ilimitados',
      '10.000 operações/mês',
      'Todos os modelos (Haiku, Sonnet, Opus)',
      '100GB de armazenamento',
      'Gerente de conta dedicado',
      'Suporte 24/7',
      'Timbrado personalizado',
      'Relatórios customizados',
      'Todas as integrações',
      'API completa',
      'White label completo',
      'SLA garantido',
      'Treinamento da equipe',
      'Customizações sob demanda'
    ],

    recommended: 'Escritórios com 10+ advogados',
    custom: true  // Pode ser customizado
  },

  // Plano Custom - Sob consulta
  custom: {
    name: 'Custom Parceiro',
    priceUSD: null,  // Sob consulta
    priceBRL: null,
    billingCycle: 'custom',

    limits: {
      users: -1,
      operationsPerMonth: -1,  // Ilimitado
      modelsAllowed: ['haiku', 'sonnet', 'opus'],
      storageGB: -1,  // Ilimitado
      support: 'dedicated'
    },

    features: [
      'Tudo do Enterprise',
      'Limites customizados',
      'Infraestrutura dedicada',
      'Deploy on-premise disponível',
      'Integrações customizadas',
      'Desenvolvimento de features exclusivas',
      'Consultoria jurídica + tech'
    ],

    recommended: 'Grandes escritórios e redes',
    contactSales: true
  }
};

// ═══════════════════════════════════════════════════════════════
// PLANOS PARA USUÁRIOS FINAIS
// ═══════════════════════════════════════════════════════════════

export const USER_PLANS = {
  // Plano Básico - Usuário individual
  basic: {
    name: 'Básico Individual',
    priceUSD: 29,
    priceBRL: 168.20,
    billingCycle: 'monthly',

    limits: {
      operationsPerMonth: 100,
      modelsAllowed: ['haiku', 'sonnet'],
      storageGB: 2,
      support: 'community'
    },

    features: [
      '100 operações/mês',
      'Modelos Haiku e Sonnet',
      '2GB de armazenamento',
      'Suporte da comunidade',
      'Modelos de documentos',
      'Correção ortográfica',
      'Pesquisa jurisprudência'
    ],

    recommended: 'Advogados autônomos'
  },

  // Plano Profissional - Uso intenso
  professional: {
    name: 'Profissional Individual',
    priceUSD: 79,
    priceBRL: 458.20,
    billingCycle: 'monthly',
    popular: true,

    limits: {
      operationsPerMonth: 500,
      modelsAllowed: ['haiku', 'sonnet', 'opus'],
      storageGB: 10,
      support: 'email'
    },

    features: [
      '500 operações/mês',
      'Todos os modelos (Haiku, Sonnet, Opus)',
      '10GB de armazenamento',
      'Suporte por email',
      'Todos os modelos de documentos',
      'Correção ortográfica avançada',
      'Pesquisa jurisprudência ilimitada',
      'Análise de contratos',
      'Geração de pareceres',
      'Integrações DataJud e JusBrasil'
    ],

    recommended: 'Advogados com alta demanda'
  },

  // Plano Premium - Máximo desempenho
  premium: {
    name: 'Premium Individual',
    priceUSD: 149,
    priceBRL: 864.20,
    billingCycle: 'monthly',

    limits: {
      operationsPerMonth: 2000,
      modelsAllowed: ['haiku', 'sonnet', 'opus'],
      storageGB: 50,
      support: 'priority'
    },

    features: [
      '2000 operações/mês',
      'Todos os modelos com prioridade',
      '50GB de armazenamento',
      'Suporte prioritário',
      'Todas as features do Profissional',
      'API de acesso',
      'Processamento prioritário',
      'Backup automático',
      'Versionamento de documentos',
      'Colaboração em tempo real'
    ],

    recommended: 'Advogados e consultores de alto volume'
  }
};

// ═══════════════════════════════════════════════════════════════
// DESCONTOS POR PERÍODO
// ═══════════════════════════════════════════════════════════════

export const BILLING_DISCOUNTS = {
  monthly: {
    discount: 0,
    label: 'Mensal'
  },
  quarterly: {
    discount: 0.10,  // 10% desconto
    label: 'Trimestral (10% OFF)'
  },
  semiannual: {
    discount: 0.15,  // 15% desconto
    label: 'Semestral (15% OFF)'
  },
  annual: {
    discount: 0.20,  // 20% desconto
    label: 'Anual (20% OFF)',
    recommended: true
  }
};

// ═══════════════════════════════════════════════════════════════
// CÁLCULO DE PREÇO COM DESCONTO
// ═══════════════════════════════════════════════════════════════

/**
 * Calcula preço final considerando período de cobrança
 */
export function calculatePlanPrice(planType, planName, billingCycle = 'monthly') {
  const plans = planType === 'partner' ? PARTNER_PLANS : USER_PLANS;
  const plan = plans[planName];

  if (!plan) {
    throw new Error(`Plano inválido: ${planName}`);
  }

  if (plan.priceUSD === null) {
    return {
      plan: plan.name,
      pricing: 'custom',
      contactSales: true,
      message: 'Entre em contato para cotação personalizada'
    };
  }

  const discount = BILLING_DISCOUNTS[billingCycle]?.discount || 0;
  const multiplier = {
    monthly: 1,
    quarterly: 3,
    semiannual: 6,
    annual: 12
  }[billingCycle] || 1;

  const basePrice = plan.priceUSD * multiplier;
  const discountAmount = basePrice * discount;
  const finalPrice = basePrice - discountAmount;

  const basePriceBRL = plan.priceBRL * multiplier;
  const discountAmountBRL = basePriceBRL * discount;
  const finalPriceBRL = basePriceBRL - discountAmountBRL;

  return {
    plan: plan.name,
    planKey: planName,
    planType,
    billingCycle,
    billingLabel: BILLING_DISCOUNTS[billingCycle]?.label || 'Mensal',

    pricing: {
      baseMonthlyUSD: plan.priceUSD,
      baseMonthlyBRL: plan.priceBRL,
      basePriceUSD: basePrice.toFixed(2),
      basePriceBRL: basePriceBRL.toFixed(2),
      discountPercent: (discount * 100).toFixed(0) + '%',
      discountAmountUSD: discountAmount.toFixed(2),
      discountAmountBRL: discountAmountBRL.toFixed(2),
      finalPriceUSD: finalPrice.toFixed(2),
      finalPriceBRL: finalPriceBRL.toFixed(2),
      savingsUSD: discountAmount.toFixed(2),
      savingsBRL: discountAmountBRL.toFixed(2)
    },

    limits: plan.limits,
    features: plan.features,
    popular: plan.popular || false,
    recommended: plan.recommended
  };
}

// ═══════════════════════════════════════════════════════════════
// COMPARAÇÃO DE PLANOS
// ═══════════════════════════════════════════════════════════════

/**
 * Gera tabela comparativa de planos
 */
export function comparePlans(planType = 'partner', billingCycle = 'monthly') {
  const plans = planType === 'partner' ? PARTNER_PLANS : USER_PLANS;
  const comparison = [];

  for (const [key, plan] of Object.entries(plans)) {
    if (key === 'custom') continue;  // Pular plano custom

    const pricing = calculatePlanPrice(planType, key, billingCycle);
    comparison.push(pricing);
  }

  return {
    planType,
    billingCycle,
    plans: comparison,
    currency: {
      primary: 'BRL',
      secondary: 'USD',
      exchangeRate: 5.80
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// RECOMENDAÇÃO DE PLANO
// ═══════════════════════════════════════════════════════════════

/**
 * Recomendar plano baseado em uso estimado
 */
export function recommendPlan(params = {}) {
  const {
    planType = 'user',
    userCount = 1,
    monthlyOperations = 100,
    modelsUsed = ['haiku', 'sonnet'],
    storageNeeded = 2
  } = params;

  const plans = planType === 'partner' ? PARTNER_PLANS : USER_PLANS;
  let recommendedPlan = null;

  for (const [key, plan] of Object.entries(plans)) {
    if (key === 'custom') continue;

    // Verificar limites
    const meetsUsers = plan.limits.users === -1 || plan.limits.users >= userCount;
    const meetsOperations = plan.limits.operationsPerMonth === -1 ||
                           plan.limits.operationsPerMonth >= monthlyOperations;
    const meetsStorage = plan.limits.storageGB === -1 ||
                        plan.limits.storageGB >= storageNeeded;
    const meetsModels = modelsUsed.every(m => plan.limits.modelsAllowed.includes(m));

    if (meetsUsers && meetsOperations && meetsStorage && meetsModels) {
      if (!recommendedPlan || plan.priceUSD < recommendedPlan.priceUSD) {
        recommendedPlan = { key, ...plan };
      }
    }
  }

  if (!recommendedPlan) {
    return {
      recommended: 'custom',
      message: 'Seus requisitos excedem os planos padrão. Entre em contato para plano customizado.',
      contactSales: true
    };
  }

  return {
    recommended: recommendedPlan.key,
    planDetails: calculatePlanPrice(planType, recommendedPlan.key, 'monthly'),
    fits: {
      userCount: `${userCount} / ${recommendedPlan.limits.users === -1 ? '∞' : recommendedPlan.limits.users} usuários`,
      operations: `${monthlyOperations} / ${recommendedPlan.limits.operationsPerMonth === -1 ? '∞' : recommendedPlan.limits.operationsPerMonth} operações/mês`,
      storage: `${storageNeeded} / ${recommendedPlan.limits.storageGB === -1 ? '∞' : recommendedPlan.limits.storageGB} GB`
    },
    suggestion: recommendedPlan.recommended
  };
}

// ═══════════════════════════════════════════════════════════════
// CÁLCULO DE ROI (PLANOS vs CRÉDITOS)
// ═══════════════════════════════════════════════════════════════

/**
 * Comparar plano mensal vs créditos prepagos
 */
export function comparePlanVsCredits(params = {}) {
  const {
    planType = 'user',
    planName = 'basic',
    monthlyOperations = 100,
    billingCycle = 'monthly'
  } = params;

  const planPricing = calculatePlanPrice(planType, planName, billingCycle);

  // Simular custo com créditos (assumindo pacote Pro)
  const creditsNeeded = monthlyOperations * 5;  // Média 5 créditos por operação
  const creditPackagePrice = 160;  // Pacote Pro
  const creditPackageSize = 2300;  // 2000 + 300 bônus
  const creditCost = (creditsNeeded / creditPackageSize) * creditPackagePrice;

  const multiplier = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[billingCycle] || 1;
  const planMonthlyCost = parseFloat(planPricing.pricing.finalPriceUSD) / multiplier;

  return {
    comparison: {
      plan: {
        name: planPricing.plan,
        monthlyCostUSD: planMonthlyCost.toFixed(2),
        billingCycle,
        operationsIncluded: planPricing.limits.operationsPerMonth
      },
      credits: {
        name: 'Créditos Prepagos',
        monthlyCostUSD: creditCost.toFixed(2),
        creditsNeeded,
        flexible: true
      },
      savings: {
        withPlan: (creditCost - planMonthlyCost).toFixed(2),
        recommendation: creditCost > planMonthlyCost ? 'plan' : 'credits'
      }
    },
    verdict: creditCost > planMonthlyCost
      ? `Plano ${planName} economiza $${(creditCost - planMonthlyCost).toFixed(2)}/mês`
      : `Créditos prepagos economizam $${(planMonthlyCost - creditCost).toFixed(2)}/mês`
  };
}

export default {
  PARTNER_PLANS,
  USER_PLANS,
  BILLING_DISCOUNTS,
  calculatePlanPrice,
  comparePlans,
  recommendPlan,
  comparePlanVsCredits
};
