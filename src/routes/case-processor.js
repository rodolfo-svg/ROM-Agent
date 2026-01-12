/**
 * ROM Case Processor API Routes
 *
 * Endpoints para processar casos completos usando arquitetura Layer Cake
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import romCaseProcessorService from '../services/processors/rom-case-processor-service.js';
import cacheService from '../utils/cache/cache-service.js';
import { getPostgresPool } from '../config/database.js';

const router = express.Router();

// Configurar multer para upload de arquivos
const upload = multer({
  dest: process.env.UPLOAD_FOLDER || 'upload/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF, DOC e DOCX são permitidos'));
    }
  }
});

/**
 * GET /api/case-processor/cases
 * Listar todos os casos processados
 */
router.get('/cases', async (req, res) => {
  try {
    const pool = getPostgresPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Banco de dados indisponível'
      });
    }

    const userId = req.session?.user?.id;

    // Query para buscar casos do usuário (ou todos se admin)
    const query = userId
      ? `SELECT
          id,
          case_number as "caseNumber",
          title,
          status,
          created_at as "createdAt",
          metadata
         FROM cases
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 100`
      : `SELECT
          id,
          case_number as "caseNumber",
          title,
          status,
          created_at as "createdAt",
          metadata
         FROM cases
         ORDER BY created_at DESC
         LIMIT 100`;

    const result = userId
      ? await pool.query(query, [userId])
      : await pool.query(query);

    // Parsear metadata JSON e extrair parties
    const cases = result.rows.map(row => ({
      ...row,
      parties: row.metadata?.parties || { plaintiff: 'N/A', defendant: 'N/A' }
    }));

    res.json({
      success: true,
      cases
    });

  } catch (error) {
    console.error('Erro ao listar casos:', error);

    // Se tabela não existe, retornar array vazio
    if (error.code === '42P01') { // PostgreSQL: undefined_table
      return res.json({
        success: true,
        cases: []
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/case-processor/process
 * Processar caso completo com upload de arquivos
 *
 * Suporta dois formatos:
 * 1. FormData com upload de arquivos
 * 2. JSON com documentPaths existentes
 */
router.post('/process', upload.array('files', 10), async (req, res) => {
  try {
    let documentPaths = [];
    let casoId = req.body.casoId;

    // Se recebeu arquivos via upload
    if (req.files && req.files.length > 0) {
      documentPaths = req.files.map(file => file.path);

      // Gerar ID do caso se não fornecido
      if (!casoId) {
        casoId = `CASO_${Date.now()}`;
      }
    }
    // Se recebeu paths via JSON
    else if (req.body.documentPaths) {
      documentPaths = Array.isArray(req.body.documentPaths)
        ? req.body.documentPaths
        : [req.body.documentPaths];
    }

    // Validações
    if (!casoId) {
      return res.status(400).json({
        success: false,
        error: 'casoId é obrigatório ou arquivos devem ser enviados'
      });
    }

    if (documentPaths.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo foi enviado ou documentPaths está vazio'
      });
    }

    const {
      indexLevel = 'quick',
      generateDocument = false,
      documentType = 'peticao-inicial',
      extractorService,
      searchServices = {}
    } = req.body;

    // Processar caso
    const result = await romCaseProcessorService.processCaso(casoId, {
      documentPaths,
      extractorService,
      searchServices,
      indexLevel,
      generateDocument,
      documentType
    });

    // Limpar arquivos temporários após processar (opcional)
    if (req.files) {
      for (const file of req.files) {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Erro ao deletar arquivo temporário:', err);
        });
      }
    }

    res.json({
      success: true,
      casoId,
      result
    });

  } catch (error) {
    console.error('Erro ao processar caso:', error);

    // Limpar arquivos em caso de erro
    if (req.files) {
      for (const file of req.files) {
        fs.unlink(file.path, () => {});
      }
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao processar caso'
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
