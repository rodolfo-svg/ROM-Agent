/**
 * ROM Agent - Arquivo Principal
 *
 * Integra todas as funcionalidades:
 * - Roteamento inteligente de modelos
 * - Prompt caching otimizado
 * - Servidor MCP DataJud
 * - Monitoramento de custos
 * - Sistema de parceiros
 * - Analytics avançado
 */

import router from './lib/router.js';
import monitor from './lib/monitor.js';
import partners from './lib/partners.js';
import analytics from './lib/analytics.js';
import extractor from './lib/extractor-pipeline.js';
// import datajud from './mcp-servers/datajud-server.js';

// =============================================================================
// FUNÇÕES PRINCIPAIS
// =============================================================================

/**
 * Processa uma requisição de peça jurídica
 * @param {string} pieceType - Tipo da peça
 * @param {string} area - Área do direito
 * @param {object} content - Conteúdo (caseData, documents, instruction)
 * @param {string} modeOverride - Override manual de modo
 * @returns {object} - Configuração para chamada ao modelo
 */
export function processRequest(pieceType, area, content = {}, modeOverride = null) {
  // 1. Selecionar modelo
  const modelSelection = router.selectModel(pieceType, area, modeOverride);

  // 2. Construir prompt otimizado para cache
  const prompt = router.buildOptimizedPrompt(
    { additional: content.additionalInstructions },
    {
      caseData: content.caseData,
      documents: content.documents,
      jurisprudence: content.jurisprudence,
      instruction: content.instruction
    }
  );

  // 3. Verificar se precisa pipeline
  const needsPipeline = router.requiresPipeline(pieceType);

  return {
    model: modelSelection.config.primary_model,
    tier: modelSelection.tier,
    profile: modelSelection.profile,
    maxTokens: modelSelection.config.max_tokens,
    temperature: modelSelection.config.temperature,
    useCache: modelSelection.config.use_cache,
    prompt: prompt,
    pipeline: needsPipeline ? router.getPipelineConfig() : null,
    estimatedCost: router.estimateCost(pieceType)
  };
}

/**
 * Registra uso após chamada ao modelo
 * @param {object} params - Parâmetros da requisição
 * @param {number} inputTokens - Tokens de entrada
 * @param {number} outputTokens - Tokens de saída
 */
export function logUsage(params, inputTokens, outputTokens) {
  return monitor.logRequest({
    model: params.model,
    tier: params.tier,
    pieceType: params.pieceType,
    inputTokens,
    outputTokens
  });
}

/**
 * Registra uso com tarifação para parceiros
 * @param {object} params - Parâmetros da requisição
 * @param {string} userId - ID do usuário
 * @param {string} partnerId - ID do parceiro (ou 'rom')
 */
export function logUsageWithBilling(params, userId, partnerId) {
  // Registrar no monitor geral
  const result = monitor.logRequest({
    model: params.model,
    tier: params.tier,
    pieceType: params.pieceType,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens
  });

  // Registrar para tarifação do parceiro
  if (partnerId) {
    partners.registrarUso({
      userId,
      partnerId,
      pieceType: params.pieceType,
      tier: params.tier,
      cost: result.cost,
      tokens: params.inputTokens + params.outputTokens
    });
  }

  return result;
}

/**
 * Busca jurisprudência relevante
 * @param {string} termo - Termo de busca
 * @param {string} tribunal - Tribunal (opcional)
 * @returns {Promise<array>}
 */
export async function buscarJurisprudencia(termo, tribunal = null) {
  // Por enquanto usa DataJud, pode ser expandido para JusBrasil, APIs diretas, etc.
  try {
    // const result = await datajud.buscarPorParte(termo, tribunal, 10);
    // if (result.hits && result.hits.hits) {
    //   return result.hits.hits.map(datajud.formatarResultado);
    // }
    console.log('DataJud: Busca por', termo, tribunal ? `no ${tribunal}` : '');
    return [];
  } catch (e) {
    console.error('Erro na busca:', e.message);
    return [];
  }
}

// =============================================================================
// FUNÇÕES PARA AGENTE DE IA (CUSTO $0)
// =============================================================================

/**
 * Prepara documento para uso pelo agente de IA
 * Extração local = $0 (vs $15-60/1M tokens se enviar PDF direto)
 *
 * @param {string} filePath - Caminho do arquivo (PDF, DOCX, imagem, etc)
 * @returns {Promise<object>} - Texto extraído + metadados
 */
export async function prepareDocumentForAI(filePath) {
  const result = await extractor.extractDocument(filePath);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    text: result.text,
    wordCount: result.wordCount,
    charCount: result.charCount,
    estimatedTokens: Math.ceil(result.charCount / 4),
    method: result.method,
    metadados: result.processingStats?.metadados || {},
    costSaved: `$${(Math.ceil(result.charCount / 4) / 1000000 * 15).toFixed(4)}`,
    toolsUsed: extractor.getSessionStats().toolsUsed
  };
}

/**
 * Processa múltiplos documentos para o agente de IA
 * @param {Array<string>} filePaths - Lista de caminhos
 * @returns {Promise<object>} - Textos extraídos concatenados
 */
export async function prepareMultipleDocuments(filePaths) {
  const results = [];
  let allText = '';
  let totalTokens = 0;

  for (const filePath of filePaths) {
    const result = await prepareDocumentForAI(filePath);
    results.push(result);

    if (result.success) {
      allText += `\n\n=== ${filePath} ===\n${result.text}`;
      totalTokens += result.estimatedTokens;
    }
  }

  return {
    success: results.filter(r => r.success).length > 0,
    documents: results,
    combinedText: allText.trim(),
    totalTokens,
    totalCostSaved: `$${(totalTokens / 1000000 * 15).toFixed(4)}`
  };
}

/**
 * Extrai e processa documento do processo automaticamente
 * Para uso direto pelo agente na geração de peças
 *
 * @param {string} filePath - Caminho do documento
 * @param {string} pieceType - Tipo de peça a gerar
 * @param {string} area - Área do direito
 * @returns {Promise<object>} - Configuração completa para IA
 */
export async function processDocumentForPiece(filePath, pieceType, area = null) {
  // 1. Extrair documento (CUSTO: $0)
  const extraction = await prepareDocumentForAI(filePath);

  if (!extraction.success) {
    return { success: false, error: extraction.error };
  }

  // 2. Selecionar modelo apropriado
  const modelConfig = processRequest(pieceType, area, {
    documents: extraction.text,
    caseData: extraction.metadados
  });

  return {
    success: true,
    extraction: {
      text: extraction.text,
      tokens: extraction.estimatedTokens,
      metadados: extraction.metadados,
      costSaved: extraction.costSaved
    },
    model: {
      name: modelConfig.model,
      tier: modelConfig.tier,
      maxTokens: modelConfig.maxTokens,
      temperature: modelConfig.temperature
    },
    prompt: modelConfig.prompt,
    estimatedCost: modelConfig.estimatedCost,
    toolsUsed: extraction.toolsUsed
  };
}

/**
 * Processa pasta de upload e retorna textos para IA
 * @returns {Promise<object>} - Todos os documentos extraídos
 */
export async function processUploadForAI() {
  const results = await extractor.processUploadFolder();

  return {
    success: results.filter(r => r.success).length > 0,
    processed: results.length,
    successful: results.filter(r => r.success).length,
    documents: results.filter(r => r.success).map(r => ({
      file: r.file,
      tokens: r.extraction?.estimatedTokens || 0,
      method: r.extraction?.method
    })),
    totalCostSaved: extractor.generateSavingsReport(),
    toolsUsed: extractor.getSessionStats().toolsUsed
  };
}

/**
 * Lista ferramentas de extração disponíveis
 * @returns {object} - Todas as ferramentas integradas
 */
export function getAvailableExtractionTools() {
  return extractor.listAvailableTools();
}

// =============================================================================
// EXPORTAR
// =============================================================================

export default {
  // Funções principais
  processRequest,
  logUsage,
  logUsageWithBilling,
  buscarJurisprudencia,

  // Funções para Agente de IA (CUSTO $0)
  prepareDocumentForAI,          // Extrai documento → texto (grátis)
  prepareMultipleDocuments,      // Extrai múltiplos documentos
  processDocumentForPiece,       // Extrai + configura modelo
  processUploadForAI,            // Processa pasta upload
  getAvailableExtractionTools,   // Lista ferramentas disponíveis

  // Submódulos
  router,
  monitor,
  partners,
  analytics,
  extractor,
  // datajud,

  // Atalhos úteis
  selectModel: router.selectModel,
  estimateCost: router.estimateCost,
  generateReport: monitor.generateReport,
  extractDocument: extractor.extractDocument,

  // Partners
  SUBSCRIPTION_PLANS: partners.SUBSCRIPTION_PLANS,
  ADMIN_MARKUP: partners.ADMIN_MARKUP,
  dashboardFaturamento: partners.dashboardFaturamento,
  dashboardEscritorio: partners.dashboardEscritorio,
  dashboardROM: partners.dashboardROM
};

// =============================================================================
// CLI
// =============================================================================

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const args = process.argv.slice(2);

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                        ROM AGENT v2.0                         ║
║         Assistente Jurídico com IA Otimizada                 ║
╚══════════════════════════════════════════════════════════════╝

Escritório: Rodolfo Otávio Mota - Advogados Associados
OAB/GO: 21.841

Módulos carregados:
  ✓ Router (roteamento inteligente de modelos)
  ✓ Monitor (monitoramento de custos)
  ✓ Partners (gestão de parceiros)
  ✓ Analytics (análise de produtividade)
  ✓ Extractor (extração automatizada de documentos)

Comandos disponíveis:
  node index.js test <tipo_peca> [area]  - Testa roteamento
  node index.js report                    - Relatório de custos
  node index.js models                    - Lista modelos configurados
  node index.js dashboard                 - Dashboard de faturamento
  node index.js parceiros                 - Relatório de parceiros
  node index.js rom                       - Dashboard equipe ROM
  node index.js extract                   - Processar documentos na pasta upload/
  node index.js watch                     - Monitorar pasta upload/ continuamente
  node index.js savings                   - Relatório de economia com extração
`);

  if (args[0] === 'test' && args[1]) {
    const pieceType = args[1];
    const area = args[2] || null;
    const result = processRequest(pieceType, area, { instruction: 'Teste' });
    console.log('Resultado do roteamento:');
    console.log(`  Peça: ${pieceType}`);
    console.log(`  Área: ${area || 'não especificada'}`);
    console.log(`  Tier: ${result.tier}`);
    console.log(`  Modelo: ${result.model}`);
    console.log(`  Max Tokens: ${result.maxTokens}`);
    console.log(`  Pipeline: ${result.pipeline ? 'Sim' : 'Não'}`);
    console.log(`  Custo est.: ${result.estimatedCost.estimatedCost}`);
    console.log(`  Economia: ${result.estimatedCost.savings}`);
  } else if (args[0] === 'report') {
    console.log(monitor.generateReport());
  } else if (args[0] === 'models') {
    console.log('Modelos configurados por tier:\n');
    const profiles = router.routerConfig.router_profiles;
    for (const [name, config] of Object.entries(profiles)) {
      console.log(`${name}:`);
      console.log(`  Primary: ${config.primary_model}`);
      if (config.fallback_model) console.log(`  Fallback: ${config.fallback_model}`);
      if (config.reasoning_model) console.log(`  Reasoning: ${config.reasoning_model}`);
      console.log(`  Custo: ${config.estimated_cost_per_1m_tokens}/1M tokens\n`);
    }
  } else if (args[0] === 'dashboard') {
    console.log(partners.dashboardFaturamento());
  } else if (args[0] === 'parceiros') {
    console.log(partners.relatorioParceiros());
  } else if (args[0] === 'rom') {
    console.log(partners.dashboardROM());
  } else if (args[0] === 'analytics') {
    console.log(analytics.gerarDashboard());

  } else if (args[0] === 'extract') {
    // Processar documentos pendentes
    extractor.processUploadFolder().then(results => {
      const success = results.filter(r => r.success).length;
      console.log(`\n✅ ${success}/${results.length} arquivos processados`);
      if (results.length > 0) {
        console.log(extractor.generateSavingsReport());
      }
    });

  } else if (args[0] === 'watch') {
    // Monitorar pasta de upload
    extractor.startWatching();

  } else if (args[0] === 'savings') {
    // Relatório de economia
    console.log(extractor.generateSavingsReport());
  }
}
