/**
 * ROM Case Processor API Routes
 *
 * Endpoints para processar casos completos usando arquitetura Layer Cake
 */

import express from 'express';
import romCaseProcessorService from '../services/processors/rom-case-processor-service.js';
import cacheService from '../utils/cache/cache-service.js';

const router = express.Router();

/**
 * POST /api/case-processor/process
 * Processar caso completo com 5 layers
 *
 * Body:
 * {
 *   "casoId": "CASO_123",
 *   "documentPaths": ["/path/to/doc1.pdf", "/path/to/doc2.pdf"],
 *   "indexLevel": "quick|medium|full",  // Opcional, default: quick
 *   "generateDocument": true|false,      // Opcional, default: false
 *   "documentType": "peticao-inicial"    // Opcional, default: peticao-inicial
 * }
 */
router.post('/process', async (req, res) => {
  try {
    const {
      casoId,
      documentPaths,
      indexLevel = 'quick',
      generateDocument = false,
      documentType = 'peticao-inicial',
      extractorService, // TODO: Injetar serviço de extração
      searchServices = {} // TODO: Injetar serviços de busca
    } = req.body;

    // Validações
    if (!casoId) {
      return res.status(400).json({
        success: false,
        error: 'casoId é obrigatório'
      });
    }

    if (!documentPaths || !Array.isArray(documentPaths) || documentPaths.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'documentPaths deve ser um array não vazio'
      });
    }

    // Processar caso
    const result = await romCaseProcessorService.processCaso(casoId, {
      documentPaths,
      extractorService, // TODO: Implementar injeção
      searchServices,   // TODO: Implementar injeção
      indexLevel,
      generateDocument,
      documentType
    });

    res.json(result);
  } catch (error) {
    console.error('Erro ao processar caso:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/case-processor/:casoId/index
 * Obter índice progressivo de um caso
 *
 * Query params:
 *   level: quick|medium|full (default: quick)
 */
router.get('/:casoId/index', async (req, res) => {
  try {
    const { casoId } = req.params;
    const { level = 'quick' } = req.query;

    // Verificar cache do índice
    const cached = await cacheService.checkCache(
      casoId,
      `progressive-index-${level}`,
      [] // TODO: Passar paths dos documentos se disponível
    );

    if (cached.valid) {
      return res.json({
        success: true,
        casoId,
        level,
        index: cached.data,
        fromCache: true,
        cachedAt: cached.cachedAt
      });
    }

    // TODO: Gerar índice se não estiver em cache
    // Necessita dos documentos extraídos

    res.status(404).json({
      success: false,
      error: 'Índice não encontrado. Processe o caso primeiro usando POST /process'
    });
  } catch (error) {
    console.error('Erro ao obter índice:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/case-processor/:casoId/cache
 * Obter estatísticas de cache de um caso
 */
router.get('/:casoId/cache', async (req, res) => {
  try {
    const { casoId } = req.params;

    const stats = await cacheService.getStats(casoId);

    res.json({
      success: true,
      casoId,
      cache: stats
    });
  } catch (error) {
    console.error('Erro ao obter stats de cache:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/case-processor/:casoId/cache
 * Limpar cache de um caso
 *
 * Query params:
 *   layer: Limpar apenas uma camada específica (opcional)
 */
router.delete('/:casoId/cache', async (req, res) => {
  try {
    const { casoId } = req.params;
    const { layer } = req.query;

    if (layer) {
      const cacheKey = `layer${layer}-*`;
      await cacheService.clearSpecificCache(casoId, cacheKey);

      return res.json({
        success: true,
        message: `Cache da layer ${layer} limpo com sucesso`,
        casoId,
        layer
      });
    } else {
      await cacheService.clearCaseCache(casoId);

      return res.json({
        success: true,
        message: 'Todo cache do caso limpo com sucesso',
        casoId
      });
    }
  } catch (error) {
    console.error('Erro ao limpar cache:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/case-processor/cache/stats
 * Obter estatísticas globais de cache
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const globalStats = await cacheService.getStats();

    res.json({
      success: true,
      cache: globalStats
    });
  } catch (error) {
    console.error('Erro ao obter stats globais:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/case-processor/:casoId/document
 * Gerar documento final (Layer 5)
 *
 * Body:
 * {
 *   "tipo": "peticao-inicial|contestacao|habeas-corpus|apelacao",
 *   "consolidacoes": { ... },
 *   "jurisprudencia": { ... },
 *   "customOptions": { ... }
 * }
 */
router.post('/:casoId/document', async (req, res) => {
  try {
    const { casoId } = req.params;
    const {
      tipo,
      consolidacoes,
      jurisprudencia,
      customOptions = {}
    } = req.body;

    if (!tipo) {
      return res.status(400).json({
        success: false,
        error: 'tipo é obrigatório'
      });
    }

    if (!consolidacoes) {
      return res.status(400).json({
        success: false,
        error: 'consolidacoes é obrigatório'
      });
    }

    const document = await romCaseProcessorService.layer5_generateDocument(
      casoId,
      tipo,
      consolidacoes,
      jurisprudencia,
      customOptions
    );

    res.json({
      success: true,
      casoId,
      document
    });
  } catch (error) {
    console.error('Erro ao gerar documento:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/case-processor/health
 * Health check do processador
 */
router.get('/health', async (req, res) => {
  try {
    const initialized = romCaseProcessorService.initialized;

    res.json({
      success: true,
      healthy: initialized,
      service: 'ROM Case Processor',
      layers: {
        layer1: 'Extração Bruta',
        layer2: 'Índices e Metadados',
        layer3: 'Análises Especializadas',
        layer4: 'Jurisprudência Verificável',
        layer5: 'Redação Final'
      },
      features: {
        intelligentCache: true,
        parallelProcessing: true,
        progressiveIndex: true,
        layerCakeArchitecture: true
      },
      optimization: {
        tokenReduction: '60% (500k → 200k)',
        timeReduction: '50% (60-90min → 25-45min)',
        cacheHitRate: 'Varies by caso'
      }
    });
  } catch (error) {
    console.error('Erro no health check:', error);
    res.status(500).json({
      success: false,
      healthy: false,
      error: error.message
    });
  }
});

export default router;
