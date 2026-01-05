/**
 * ROM Agent V3 Pipeline Routes
 * API endpoints para pipeline de produção jurídica em escala
 *
 * Pipeline de 4 estágios:
 * 1. EXTRAÇÃO - Adaptativa por volume
 * 2. ANÁLISE - Fichamento/resumo por importância
 * 3. REDAÇÃO - Criação de documentos jurídicos
 * 4. AUDITORIA - Revisão final de qualidade
 */

import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Logger com fallback seguro
let logger;
try {
  const loggerModule = await import('../src/utils/logger.js');
  logger = loggerModule.logger || loggerModule.default || console;
} catch (error) {
  logger = console;
  console.warn('Logger não disponível, usando console:', error.message);
}

// ============================================================
// PIPELINE V3 ROUTES
// ============================================================

/**
 * GET /pipeline/status
 * Verifica se o pipeline está disponível
 */
router.get('/pipeline/status', (req, res) => {
  res.json({
    success: true,
    message: 'ROM Agent V3 Pipeline está disponível',
    version: '3.0.0',
    stages: ['extraction', 'analysis', 'drafting', 'audit'],
    features: {
      multiModel: true,
      adaptiveSelection: true,
      costOptimization: true,
      qualityControl: true,
      parallelProcessing: true
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /pipeline/configure
 * Configura o pipeline baseado em parâmetros do processo
 *
 * Body:
 * {
 *   priority: 'critical' | 'high' | 'standard' | 'bulk',
 *   volume: 'single' | 'small' | 'medium' | 'large' | 'massive',
 *   quality: 'perfect' | 'high' | 'standard' | 'draft',
 *   speed: 'urgent' | 'fast' | 'normal' | 'relaxed',
 *   tribunal: string (optional),
 *   materia: string (optional),
 *   valorCausa: number (optional),
 *   envolvLiberdade: boolean (optional),
 *   clienteVip: boolean (optional)
 * }
 */
router.post('/pipeline/configure', async (req, res) => {
  try {
    const {
      priority = 'standard',
      volume = 'single',
      quality = 'high',
      speed = 'normal',
      tribunal,
      materia,
      valorCausa,
      envolvLiberdade = false,
      clienteVip = false
    } = req.body;

    // Validações
    const validPriorities = ['critical', 'high', 'standard', 'bulk'];
    const validVolumes = ['single', 'small', 'medium', 'large', 'massive'];
    const validQualities = ['perfect', 'high', 'standard', 'draft'];
    const validSpeeds = ['urgent', 'fast', 'normal', 'relaxed'];

    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: `priority inválido. Valores aceitos: ${validPriorities.join(', ')}`
      });
    }

    if (!validVolumes.includes(volume)) {
      return res.status(400).json({
        success: false,
        error: `volume inválido. Valores aceitos: ${validVolumes.join(', ')}`
      });
    }

    if (!validQualities.includes(quality)) {
      return res.status(400).json({
        success: false,
        error: `quality inválido. Valores aceitos: ${validQualities.join(', ')}`
      });
    }

    if (!validSpeeds.includes(speed)) {
      return res.status(400).json({
        success: false,
        error: `speed inválido. Valores aceitos: ${validSpeeds.join(', ')}`
      });
    }

    // Auto-ajustar prioridade se necessário
    let adjustedPriority = priority;
    if (envolvLiberdade || clienteVip) {
      adjustedPriority = 'critical';
    } else if (tribunal && (tribunal.includes('STJ') || tribunal.includes('STF'))) {
      adjustedPriority = priority === 'bulk' ? 'high' : priority;
    }

    const configuration = {
      priority: adjustedPriority,
      volume,
      quality,
      speed,
      enableAudit: quality === 'perfect' || quality === 'high',
      auditDepth: quality === 'perfect' ? 'deep' : quality === 'high' ? 'standard' : 'light',
      parallelProcessing: volume === 'massive' || volume === 'large',
      maxConcurrent: volume === 'massive' ? 10 : volume === 'large' ? 5 : 3,
      context: {
        tribunal,
        materia,
        valorCausa,
        envolvLiberdade,
        clienteVip
      }
    };

    // Calcular modelos que serão usados (simulação)
    const modelSelection = {
      extraction: getExtractionModel(volume, adjustedPriority),
      analysis: getAnalysisModel(quality, adjustedPriority),
      drafting: getDraftingModel(speed, adjustedPriority),
      audit: configuration.enableAudit ? getAuditModel(configuration.auditDepth, adjustedPriority) : null
    };

    logger.info(`Pipeline configurado: ${adjustedPriority}/${quality}/${speed} para ${tribunal || 'tribunal genérico'}`);

    res.json({
      success: true,
      configuration,
      modelSelection,
      estimatedTime: estimateTime(configuration),
      recommendations: generateRecommendations(configuration),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Erro ao configurar pipeline:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /pipeline/estimate
 * Estima custo e tempo de processamento
 *
 * Body:
 * {
 *   configuration: {...},
 *   documents: number,
 *   totalTokens: number (optional),
 *   draftType: string (optional)
 * }
 */
router.post('/pipeline/estimate', async (req, res) => {
  try {
    const {
      configuration,
      documents = 1,
      totalTokens = 10000,
      draftType = 'peticao'
    } = req.body;

    if (!configuration) {
      return res.status(400).json({
        success: false,
        error: 'configuration é obrigatório'
      });
    }

    // Calcular estimativas
    const estimate = {
      stages: {
        extraction: {
          model: getExtractionModel(configuration.volume, configuration.priority),
          estimatedTokens: totalTokens * 0.3,
          estimatedCostUSD: calculateCost('extraction', totalTokens * 0.3, configuration)
        },
        analysis: {
          model: getAnalysisModel(configuration.quality, configuration.priority),
          estimatedTokens: totalTokens * 0.5,
          estimatedCostUSD: calculateCost('analysis', totalTokens * 0.5, configuration)
        },
        drafting: {
          model: getDraftingModel(configuration.speed, configuration.priority),
          estimatedTokens: totalTokens * 2,
          estimatedCostUSD: calculateCost('drafting', totalTokens * 2, configuration)
        },
        audit: configuration.enableAudit ? {
          model: getAuditModel(configuration.auditDepth, configuration.priority),
          estimatedTokens: totalTokens * 0.8,
          estimatedCostUSD: calculateCost('audit', totalTokens * 0.8, configuration)
        } : null
      },
      total: {
        documents,
        estimatedTokens: 0,
        estimatedCostUSD: 0,
        estimatedCostBRL: 0,
        estimatedTimeMinutes: 0
      }
    };

    // Somar totais
    Object.values(estimate.stages).forEach(stage => {
      if (stage) {
        estimate.total.estimatedTokens += stage.estimatedTokens;
        estimate.total.estimatedCostUSD += stage.estimatedCostUSD;
      }
    });

    estimate.total.estimatedCostBRL = estimate.total.estimatedCostUSD * 5.0; // Taxa de câmbio exemplo
    estimate.total.estimatedTimeMinutes = estimateTime(configuration);

    logger.info(`Estimativa gerada: ${documents} doc(s), ~$${estimate.total.estimatedCostUSD.toFixed(4)} USD`);

    res.json({
      success: true,
      estimate,
      recommendations: [
        estimate.total.estimatedCostUSD > 1 ? '⚠️ Custo elevado - considere reduzir qualidade ou usar modelos mais econômicos' : null,
        configuration.quality === 'perfect' && configuration.speed === 'urgent' ? '⚠️ Qualidade perfeita + urgência = custo muito alto' : null,
        configuration.volume === 'massive' && !configuration.parallelProcessing ? '💡 Ative parallelProcessing para volumes massivos' : null
      ].filter(Boolean),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Erro ao estimar pipeline:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /pipeline/execute
 * Executa o pipeline completo (requer Python instalado)
 *
 * Body:
 * {
 *   configuration: {...},
 *   documents: [paths],
 *   outputPath: string
 * }
 */
router.post('/pipeline/execute', async (req, res) => {
  try {
    const { configuration, documents, outputPath } = req.body;

    if (!configuration || !documents || !Array.isArray(documents)) {
      return res.status(400).json({
        success: false,
        error: 'configuration e documents (array) são obrigatórios'
      });
    }

    logger.info(`Executando pipeline para ${documents.length} documento(s)`);

    // Preparar dados para o Python
    const pipelineInput = JSON.stringify({
      configuration,
      documents,
      outputPath: outputPath || './output'
    });

    const pythonPath = path.join(__dirname, '../src/pipelines/rom_agent_v3_pipeline.py');

    // Executar Python script
    const pythonProcess = spawn('python3', [pythonPath], {
      env: { ...process.env, PIPELINE_INPUT: pipelineInput }
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          logger.info('Pipeline executado com sucesso');
          res.json({
            success: true,
            result,
            timestamp: new Date().toISOString()
          });
        } catch (parseError) {
          res.json({
            success: true,
            output,
            warning: 'Output não é JSON válido',
            timestamp: new Date().toISOString()
          });
        }
      } else {
        logger.error(`Pipeline falhou com código ${code}`);
        res.status(500).json({
          success: false,
          error: `Pipeline falhou com código ${code}`,
          stderr: errorOutput
        });
      }
    });

  } catch (error) {
    logger.error('Erro ao executar pipeline:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getExtractionModel(volume, priority) {
  const matrix = {
    single: { critical: 'claude-haiku-3', high: 'claude-haiku-3', standard: 'claude-haiku-3', bulk: 'nova-lite' },
    small: { critical: 'claude-haiku-3', high: 'claude-haiku-3', standard: 'nova-pro', bulk: 'nova-lite' },
    medium: { critical: 'claude-sonnet-3.5', high: 'nova-pro', standard: 'nova-pro', bulk: 'nova-lite' },
    large: { critical: 'claude-sonnet-4', high: 'claude-sonnet-3.5', standard: 'nova-pro', bulk: 'nova-lite' },
    massive: { critical: 'claude-opus-4.5', high: 'claude-sonnet-4', standard: 'claude-sonnet-3.5', bulk: 'nova-pro' }
  };
  return matrix[volume]?.[priority] || 'claude-haiku-3';
}

function getAnalysisModel(quality, priority) {
  const matrix = {
    perfect: { critical: 'claude-opus-4.5', high: 'claude-opus-4.5', standard: 'claude-sonnet-4', bulk: 'claude-sonnet-4' },
    high: { critical: 'claude-opus-4.5', high: 'claude-sonnet-4', standard: 'deepseek-r1', bulk: 'claude-sonnet-3.5' },
    standard: { critical: 'claude-sonnet-4', high: 'deepseek-r1', standard: 'claude-sonnet-3.5', bulk: 'nova-pro' },
    draft: { critical: 'claude-sonnet-3.5', high: 'claude-haiku-3', standard: 'nova-pro', bulk: 'nova-lite' }
  };
  return matrix[quality]?.[priority] || 'claude-sonnet-3.5';
}

function getDraftingModel(speed, priority) {
  const matrix = {
    urgent: { critical: 'claude-sonnet-4', high: 'claude-haiku-3', standard: 'claude-haiku-3', bulk: 'nova-lite' },
    fast: { critical: 'claude-opus-4.5', high: 'claude-sonnet-4', standard: 'claude-sonnet-3.5', bulk: 'claude-haiku-3' },
    normal: { critical: 'claude-opus-4.5', high: 'claude-sonnet-4', standard: 'claude-sonnet-4', bulk: 'claude-sonnet-3.5' },
    relaxed: { critical: 'claude-opus-4.5', high: 'claude-opus-4.5', standard: 'claude-sonnet-4', bulk: 'claude-sonnet-4' }
  };
  return matrix[speed]?.[priority] || 'claude-sonnet-4';
}

function getAuditModel(depth, priority) {
  const matrix = {
    deep: { critical: 'claude-opus-4.5', high: 'claude-sonnet-3.7', standard: 'claude-sonnet-4', bulk: 'claude-sonnet-3.5' },
    standard: { critical: 'claude-sonnet-3.7', high: 'claude-sonnet-4', standard: 'claude-sonnet-3.5', bulk: 'claude-haiku-3' },
    light: { critical: 'claude-sonnet-4', high: 'claude-haiku-3', standard: 'claude-haiku-3', bulk: 'nova-lite' }
  };
  return matrix[depth]?.[priority] || 'claude-sonnet-3.5';
}

function calculateCost(stage, tokens, configuration) {
  // Custos por 1M tokens (valores aproximados)
  const costs = {
    'claude-opus-4.5': { input: 15, output: 75 },
    'claude-sonnet-4': { input: 3, output: 15 },
    'claude-sonnet-3.7': { input: 3, output: 15 },
    'claude-sonnet-3.5': { input: 3, output: 15 },
    'claude-haiku-3': { input: 0.25, output: 1.25 },
    'deepseek-r1': { input: 0.55, output: 2.19 },
    'nova-pro': { input: 0.8, output: 3.2 },
    'nova-lite': { input: 0.06, output: 0.24 }
  };

  const model = stage === 'extraction' ? getExtractionModel(configuration.volume, configuration.priority) :
                stage === 'analysis' ? getAnalysisModel(configuration.quality, configuration.priority) :
                stage === 'drafting' ? getDraftingModel(configuration.speed, configuration.priority) :
                getAuditModel(configuration.auditDepth, configuration.priority);

  const pricing = costs[model] || { input: 1, output: 5 };
  const inputCost = (tokens / 1000000) * pricing.input;
  const outputCost = (tokens * 0.5 / 1000000) * pricing.output; // Assume 50% de output

  return inputCost + outputCost;
}

function estimateTime(configuration) {
  const baseTime = {
    urgent: 5,
    fast: 15,
    normal: 30,
    relaxed: 60
  }[configuration.speed] || 30;

  const volumeMultiplier = {
    single: 1,
    small: 1.5,
    medium: 2,
    large: 3,
    massive: 5
  }[configuration.volume] || 1;

  const auditTime = configuration.enableAudit ? baseTime * 0.3 : 0;

  return Math.round((baseTime * volumeMultiplier) + auditTime);
}

function generateRecommendations(configuration) {
  const recommendations = [];

  if (configuration.priority === 'critical' && configuration.speed === 'relaxed') {
    recommendations.push('💡 Processo CRITICAL com speed RELAXED - considere FAST para melhor qualidade');
  }

  if (configuration.quality === 'perfect' && configuration.speed === 'urgent') {
    recommendations.push('⚠️ Qualidade PERFECT + URGENT é muito custoso - considere HIGH quality');
  }

  if (configuration.volume === 'massive' && !configuration.parallelProcessing) {
    recommendations.push('🚀 Ative parallelProcessing para volume MASSIVE (até 10x mais rápido)');
  }

  if (configuration.priority === 'bulk' && configuration.quality === 'perfect') {
    recommendations.push('⚠️ Bulk processing com qualidade PERFECT é ineficiente');
  }

  if (!configuration.enableAudit && configuration.quality !== 'draft') {
    recommendations.push('💡 Considere ativar auditoria para qualidade HIGH ou PERFECT');
  }

  return recommendations;
}

export default router;
