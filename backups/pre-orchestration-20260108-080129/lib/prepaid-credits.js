/**
 * SISTEMA DE CRÉDITOS PREPAGOS
 * Compra antecipada de créditos para uso
 *
 * Funcionalidades:
 * - Pacotes de créditos com desconto por volume
 * - Conversão crédito → operações
 * - Tracking de saldo
 * - Histórico de uso
 * - Alertas de saldo baixo
 */

import { calculateGlobalOperationCost } from './global-pricing.js';

// ═══════════════════════════════════════════════════════════════
// PACOTES DE CRÉDITOS PREPAGOS
// ═══════════════════════════════════════════════════════════════

export const CREDIT_PACKAGES = {
  // Pacote Starter - Para testes
  starter: {
    credits: 100,
    priceUSD: 10,
    priceBRL: 58,
    discount: 0,              // 0% desconto
    bonus: 0,                 // 0 créditos bônus
    recommended: 'Testes e avaliação'
  },

  // Pacote Basic - Uso leve
  basic: {
    credits: 500,
    priceUSD: 45,
    priceBRL: 261,
    discount: 0.10,           // 10% desconto
    bonus: 50,                // 50 créditos bônus
    recommended: 'Escritórios pequenos (1-3 usuários)'
  },

  // Pacote Pro - Uso médio
  pro: {
    credits: 2000,
    priceUSD: 160,
    priceBRL: 928,
    discount: 0.20,           // 20% desconto
    bonus: 300,               // 300 créditos bônus
    recommended: 'Escritórios médios (4-10 usuários)',
    popular: true
  },

  // Pacote Business - Uso pesado
  business: {
    credits: 5000,
    priceUSD: 375,
    priceBRL: 2175,
    discount: 0.25,           // 25% desconto
    bonus: 1000,              // 1000 créditos bônus
    recommended: 'Escritórios grandes (10+ usuários)'
  },

  // Pacote Enterprise - Uso muito pesado
  enterprise: {
    credits: 15000,
    priceUSD: 1050,
    priceBRL: 6090,
    discount: 0.30,           // 30% desconto
    bonus: 4500,              // 4500 créditos bônus (30%)
    recommended: 'Grandes escritórios (50+ usuários)'
  }
};

// ═══════════════════════════════════════════════════════════════
// CONVERSÃO CRÉDITOS → OPERAÇÕES
// ═══════════════════════════════════════════════════════════════

/**
 * Quanto custa (em créditos) uma operação
 */
export const CREDIT_RATES = {
  // Modelos de IA
  models: {
    haiku: 1,           // 1 crédito = 1 operação Haiku
    sonnet: 5,          // 5 créditos = 1 operação Sonnet
    opus: 25            // 25 créditos = 1 operação Opus
  },

  // Operações especiais
  operations: {
    'peticao-inicial': 50,          // Petição inicial completa
    'recurso-apelacao': 75,         // Recurso de apelação
    'recurso-especial': 100,        // Recurso especial/extraordinário
    'parecer-juridico': 40,         // Parecer jurídico
    'contrato-simples': 30,         // Contrato simples
    'contrato-complexo': 80,        // Contrato complexo
    'analise-documento': 20,        // Análise de documento
    'correcao-texto': 10,           // Correção de texto
    'pesquisa-datajud': 5,          // Consulta DataJud
    'pesquisa-web': 3               // Web search
  },

  // Armazenamento
  storage: {
    per_gb_month: 1             // 1 crédito = 1GB/mês
  }
};

// ═══════════════════════════════════════════════════════════════
// CÁLCULO DE PREÇO DE PACOTE
// ═══════════════════════════════════════════════════════════════

/**
 * Calcula preço final de pacote de créditos
 * Inclui desconto e bônus
 */
export function calculateCreditPackagePrice(packageName) {
  const pkg = CREDIT_PACKAGES[packageName];
  if (!pkg) {
    throw new Error(`Pacote inválido: ${packageName}`);
  }

  const totalCredits = pkg.credits + pkg.bonus;
  const pricePerCredit = pkg.priceUSD / totalCredits;
  const savings = pkg.priceUSD * pkg.discount;

  return {
    package: packageName,
    credits: pkg.credits,
    bonus: pkg.bonus,
    totalCredits,
    priceUSD: pkg.priceUSD,
    priceBRL: pkg.priceBRL,
    discount: (pkg.discount * 100).toFixed(0) + '%',
    savings: savings.toFixed(2),
    pricePerCredit: pricePerCredit.toFixed(4),
    recommended: pkg.recommended,
    popular: pkg.popular || false
  };
}

// ═══════════════════════════════════════════════════════════════
// GESTÃO DE SALDO DE CRÉDITOS
// ═══════════════════════════════════════════════════════════════

/**
 * Classe para gerenciar saldo de créditos de um usuário/escritório
 */
export class CreditBalance {
  constructor(entityId, entityType = 'user') {
    this.entityId = entityId;          // userId ou officeId
    this.entityType = entityType;       // 'user' ou 'office'
    this.balance = 0;
    this.totalPurchased = 0;
    this.totalUsed = 0;
    this.transactions = [];
  }

  /**
   * Adicionar créditos (compra)
   */
  addCredits(amount, packageName, transactionId) {
    this.balance += amount;
    this.totalPurchased += amount;

    this.transactions.push({
      type: 'purchase',
      amount: +amount,
      packageName,
      transactionId,
      balance: this.balance,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      newBalance: this.balance,
      added: amount
    };
  }

  /**
   * Debitar créditos (uso)
   */
  debitCredits(amount, operation, metadata = {}) {
    if (this.balance < amount) {
      return {
        success: false,
        error: 'Saldo insuficiente',
        required: amount,
        available: this.balance,
        missing: amount - this.balance
      };
    }

    this.balance -= amount;
    this.totalUsed += amount;

    this.transactions.push({
      type: 'usage',
      amount: -amount,
      operation,
      metadata,
      balance: this.balance,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      newBalance: this.balance,
      debited: amount
    };
  }

  /**
   * Calcular quanto custa uma operação em créditos
   */
  static calculateOperationCost(operation, model = 'sonnet') {
    // Se for uma operação especial
    if (CREDIT_RATES.operations[operation]) {
      return CREDIT_RATES.operations[operation];
    }

    // Senão, usar custo por modelo
    return CREDIT_RATES.models[model] || CREDIT_RATES.models.sonnet;
  }

  /**
   * Verificar se tem saldo suficiente
   */
  hasEnoughCredits(operation, model = 'sonnet') {
    const cost = CreditBalance.calculateOperationCost(operation, model);
    return this.balance >= cost;
  }

  /**
   * Obter status do saldo
   */
  getStatus() {
    const lowBalanceThreshold = 50;
    const criticalBalanceThreshold = 10;

    let status = 'ok';
    let alert = null;

    if (this.balance <= 0) {
      status = 'empty';
      alert = 'Saldo zerado! Recarregue seus créditos.';
    } else if (this.balance < criticalBalanceThreshold) {
      status = 'critical';
      alert = `Saldo crítico! Apenas ${this.balance} créditos restantes.`;
    } else if (this.balance < lowBalanceThreshold) {
      status = 'low';
      alert = `Saldo baixo. ${this.balance} créditos restantes.`;
    }

    return {
      entityId: this.entityId,
      entityType: this.entityType,
      balance: this.balance,
      totalPurchased: this.totalPurchased,
      totalUsed: this.totalUsed,
      utilizationRate: this.totalPurchased > 0
        ? ((this.totalUsed / this.totalPurchased) * 100).toFixed(1) + '%'
        : '0%',
      status,
      alert,
      recommendedRecharge: status !== 'ok' ? 'basic' : null
    };
  }

  /**
   * Histórico de transações
   */
  getHistory(limit = 50) {
    return this.transactions
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Exportar dados
   */
  export() {
    return {
      entityId: this.entityId,
      entityType: this.entityType,
      balance: this.balance,
      totalPurchased: this.totalPurchased,
      totalUsed: this.totalUsed,
      transactions: this.transactions
    };
  }

  /**
   * Importar dados
   */
  static import(data) {
    const instance = new CreditBalance(data.entityId, data.entityType);
    instance.balance = data.balance;
    instance.totalPurchased = data.totalPurchased;
    instance.totalUsed = data.totalUsed;
    instance.transactions = data.transactions || [];
    return instance;
  }
}

// ═══════════════════════════════════════════════════════════════
// ESTIMATIVAS E RECOMENDAÇÕES
// ═══════════════════════════════════════════════════════════════

/**
 * Recomendar pacote baseado em uso estimado
 */
export function recommendCreditPackage(params = {}) {
  const {
    monthlyOperations = 100,
    modelDistribution = { haiku: 0.3, sonnet: 0.6, opus: 0.1 },
    includeSpecialOperations = 0
  } = params;

  // Calcular créditos necessários por mês
  const creditsNeeded =
    (monthlyOperations * modelDistribution.haiku * CREDIT_RATES.models.haiku) +
    (monthlyOperations * modelDistribution.sonnet * CREDIT_RATES.models.sonnet) +
    (monthlyOperations * modelDistribution.opus * CREDIT_RATES.models.opus) +
    includeSpecialOperations;

  // Encontrar melhor pacote
  let recommendedPackage = 'starter';
  let bestValue = null;

  for (const [name, pkg] of Object.entries(CREDIT_PACKAGES)) {
    const totalCredits = pkg.credits + pkg.bonus;

    if (totalCredits >= creditsNeeded) {
      const pricePerCredit = pkg.priceUSD / totalCredits;

      if (!bestValue || pricePerCredit < bestValue.pricePerCredit) {
        recommendedPackage = name;
        bestValue = {
          pricePerCredit,
          totalCredits,
          package: pkg
        };
      }
    }
  }

  const pkg = CREDIT_PACKAGES[recommendedPackage];
  const totalCredits = pkg.credits + pkg.bonus;

  return {
    recommendedPackage,
    creditsNeeded: Math.ceil(creditsNeeded),
    packageDetails: calculateCreditPackagePrice(recommendedPackage),
    willLast: `~${Math.floor(totalCredits / creditsNeeded)} meses`,
    monthlyEstimate: {
      operations: monthlyOperations,
      creditsUsed: Math.ceil(creditsNeeded),
      costUSD: (pkg.priceUSD / totalCredits * creditsNeeded).toFixed(2),
      costBRL: (pkg.priceBRL / totalCredits * creditsNeeded).toFixed(2)
    }
  };
}

export default {
  CREDIT_PACKAGES,
  CREDIT_RATES,
  calculateCreditPackagePrice,
  CreditBalance,
  recommendCreditPackage
};
