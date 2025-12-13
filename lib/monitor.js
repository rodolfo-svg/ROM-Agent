/**
 * ROM Agent - Monitoramento de Custos e Uso
 *
 * Rastreia uso de tokens, custos e eficiência do roteamento
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Arquivo de log
const LOG_FILE = path.join(__dirname, '..', 'logs', 'usage.json');

// Preços por modelo (por 1M tokens) - Input / Output
export const MODEL_PRICES = {
  'us.amazon.nova-lite-v1:0': { input: 0.00006, output: 0.00024 },
  'us.amazon.nova-micro-v1:0': { input: 0.000035, output: 0.00014 },
  'us.amazon.nova-pro-v1:0': { input: 0.0008, output: 0.0032 },
  'us.amazon.nova-premier-v1:0': { input: 0.0025, output: 0.01 },
  'us.anthropic.claude-haiku-4-5-20251001-v1:0': { input: 0.0008, output: 0.004 },
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0': { input: 0.003, output: 0.015 },
  'us.anthropic.claude-3-7-sonnet-20250219-v1:0': { input: 0.003, output: 0.015 },
  'us.anthropic.claude-opus-4-5-20251101-v1:0': { input: 0.015, output: 0.075 },
  'us.meta.llama-4-maverick-17b-instruct-v1:0': { input: 0.00024, output: 0.00097 },
  'us.meta.llama-4-scout-17b-instruct-v1:0': { input: 0.0002, output: 0.0006 },
  'us.meta.llama-3-3-70b-instruct-v1:0': { input: 0.00072, output: 0.00072 },
  'us.mistral.mistral-large-2411-v1:0': { input: 0.002, output: 0.006 },
  'us.mistral.pixtral-large-2411-v1:0': { input: 0.002, output: 0.006 },
  'us.mistral.ministral-8b-2410-v1:0': { input: 0.0001, output: 0.0001 },
  'us.deepseek.r1-v1:0': { input: 0.001, output: 0.005 },
  'us.cohere.command-r-plus-v1:0': { input: 0.0025, output: 0.01 },
  'us.cohere.command-r-v1:0': { input: 0.0005, output: 0.0015 }
};

// Preço de referência (Sonnet) para calcular economia
const REFERENCE_PRICE = { input: 0.003, output: 0.015 };

/**
 * Carrega dados de uso existentes
 */
export function loadUsageData() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Erro ao carregar dados:', e.message);
  }
  return {
    startDate: new Date().toISOString(),
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    totalSavings: 0,
    byModel: {},
    byTier: {},
    byPieceType: {},
    daily: {}
  };
}

/**
 * Salva dados de uso
 */
function saveUsageData(data) {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2));
}

/**
 * Registra uma requisição
 */
export function logRequest(params) {
  const { model, tier, pieceType, inputTokens, outputTokens } = params;

  const data = loadUsageData();
  const today = new Date().toISOString().split('T')[0];

  // Calcular custos
  const prices = MODEL_PRICES[model] || REFERENCE_PRICE;
  const cost = (inputTokens / 1000000 * prices.input) + (outputTokens / 1000000 * prices.output);
  const referenceCost = (inputTokens / 1000000 * REFERENCE_PRICE.input) + (outputTokens / 1000000 * REFERENCE_PRICE.output);
  const savings = Math.max(0, referenceCost - cost);

  // Atualizar totais
  data.totalRequests++;
  data.totalInputTokens += inputTokens;
  data.totalOutputTokens += outputTokens;
  data.totalCost += cost;
  data.totalSavings += savings;

  // Por modelo
  if (!data.byModel[model]) {
    data.byModel[model] = { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
  }
  data.byModel[model].requests++;
  data.byModel[model].inputTokens += inputTokens;
  data.byModel[model].outputTokens += outputTokens;
  data.byModel[model].cost += cost;

  // Por tier
  if (tier) {
    if (!data.byTier[tier]) {
      data.byTier[tier] = { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
    }
    data.byTier[tier].requests++;
    data.byTier[tier].inputTokens += inputTokens;
    data.byTier[tier].outputTokens += outputTokens;
    data.byTier[tier].cost += cost;
  }

  // Por tipo de peça
  if (pieceType) {
    if (!data.byPieceType[pieceType]) {
      data.byPieceType[pieceType] = { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
    }
    data.byPieceType[pieceType].requests++;
    data.byPieceType[pieceType].inputTokens += inputTokens;
    data.byPieceType[pieceType].outputTokens += outputTokens;
    data.byPieceType[pieceType].cost += cost;
  }

  // Diário
  if (!data.daily[today]) {
    data.daily[today] = { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0, savings: 0 };
  }
  data.daily[today].requests++;
  data.daily[today].inputTokens += inputTokens;
  data.daily[today].outputTokens += outputTokens;
  data.daily[today].cost += cost;
  data.daily[today].savings += savings;

  saveUsageData(data);

  return { cost, savings, referenceCost };
}

/**
 * Gera relatório de uso
 */
export function generateReport() {
  const data = loadUsageData();
  const startDate = data.startDate ? data.startDate.split('T')[0] : 'N/A';
  const today = new Date().toISOString().split('T')[0];
  const totalWithRef = data.totalCost + data.totalSavings;
  const savingsPercent = totalWithRef > 0 ? ((data.totalSavings / totalWithRef) * 100).toFixed(1) : 0;

  let report = `
╔══════════════════════════════════════════════════════════════╗
║           ROM AGENT - RELATÓRIO DE USO E CUSTOS              ║
╚══════════════════════════════════════════════════════════════╝

Período: ${startDate} até ${today}

═══════════════════════════════════════════════════════════════
TOTAIS
═══════════════════════════════════════════════════════════════
  Requisições:      ${data.totalRequests.toLocaleString()}
  Input Tokens:     ${data.totalInputTokens.toLocaleString()}
  Output Tokens:    ${data.totalOutputTokens.toLocaleString()}
  Custo Total:      $${data.totalCost.toFixed(4)}
  Economia Total:   $${data.totalSavings.toFixed(4)} (vs. sempre Sonnet)

═══════════════════════════════════════════════════════════════
POR TIER
═══════════════════════════════════════════════════════════════`;

  for (const [tier, stats] of Object.entries(data.byTier || {})) {
    report += `\n  ${tier}: ${stats.requests} req | $${stats.cost.toFixed(4)}`;
  }

  report += `

═══════════════════════════════════════════════════════════════
POR MODELO
═══════════════════════════════════════════════════════════════`;

  const sortedModels = Object.entries(data.byModel || {}).sort((a, b) => b[1].cost - a[1].cost);
  for (const [model, stats] of sortedModels) {
    const modelName = model.split('.').pop().split('-v1')[0];
    report += `\n  ${modelName}: ${stats.requests} req | $${stats.cost.toFixed(4)}`;
  }

  report += `

═══════════════════════════════════════════════════════════════
TOP 10 TIPOS DE PEÇA (por custo)
═══════════════════════════════════════════════════════════════`;

  const sortedPieces = Object.entries(data.byPieceType || {})
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 10);

  for (const [piece, stats] of sortedPieces) {
    report += `\n  ${piece}: ${stats.requests} req | $${stats.cost.toFixed(4)}`;
  }

  report += `

═══════════════════════════════════════════════════════════════
ÚLTIMOS 7 DIAS
═══════════════════════════════════════════════════════════════`;

  const days = Object.entries(data.daily || {}).slice(-7);
  for (const [date, stats] of days) {
    report += `\n  ${date}: ${stats.requests} req | $${stats.cost.toFixed(4)} | Econ: $${stats.savings.toFixed(4)}`;
  }

  report += `

═══════════════════════════════════════════════════════════════
ECONOMIA
═══════════════════════════════════════════════════════════════
  Se todas usassem Sonnet: $${totalWithRef.toFixed(4)}
  Custo real (roteamento): $${data.totalCost.toFixed(4)}
  ECONOMIA TOTAL:          $${data.totalSavings.toFixed(4)} (${savingsPercent}%)
`;

  return report;
}

/**
 * Reseta os dados de monitoramento
 */
export function resetData() {
  saveUsageData({
    startDate: new Date().toISOString(),
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    totalSavings: 0,
    byModel: {},
    byTier: {},
    byPieceType: {},
    daily: {}
  });
  console.log('Dados resetados com sucesso!');
}

// Export default
export default {
  logRequest,
  generateReport,
  resetData,
  loadUsageData,
  MODEL_PRICES
};

// Se executado diretamente
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const args = process.argv.slice(2);

  if (args[0] === 'report') {
    console.log(generateReport());
  } else if (args[0] === 'reset') {
    resetData();
  } else if (args[0] === 'test') {
    logRequest({
      model: 'us.amazon.nova-lite-v1:0',
      tier: 'TIER_1_FAST',
      pieceType: 'notificacao_extrajudicial',
      inputTokens: 1000,
      outputTokens: 500
    });
    logRequest({
      model: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
      tier: 'TIER_3_PREMIUM',
      pieceType: 'apelação',
      inputTokens: 5000,
      outputTokens: 3000
    });
    logRequest({
      model: 'us.anthropic.claude-opus-4-5-20251101-v1:0',
      tier: 'TIER_4_ULTRA',
      pieceType: 'recurso_especial',
      inputTokens: 10000,
      outputTokens: 8000
    });
    console.log('Requisições de teste registradas!');
    console.log(generateReport());
  } else {
    console.log('ROM Agent - Monitor de Custos');
    console.log('');
    console.log('Uso:');
    console.log('  node lib/monitor.js report  - Exibe relatório');
    console.log('  node lib/monitor.js reset   - Reseta dados');
    console.log('  node lib/monitor.js test    - Simula requisições de teste');
  }
}
