/**
 * ROM Agent - Cache Statistics Endpoint
 *
 * Expõe estatísticas do cache de análises (Fase 3)
 */

import { Router } from 'express';
import analysisCache from '../utils/analysis-cache.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/cache/stats
 * Obter estatísticas do cache de análises
 */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const stats = analysisCache.getCacheStats();

    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    console.error('[CacheStats] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Falha ao obter estatísticas do cache',
      message: error.message
    });
  }
});

/**
 * POST /api/cache/clear
 * Limpar todo o cache (apenas admin)
 */
router.post('/clear', requireAuth, async (req, res) => {
  try {
    // Verificar se é admin
    if (req.session.user.role !== 'master_admin' && req.session.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Apenas administradores podem limpar o cache'
      });
    }

    const cleared = analysisCache.clearCache();

    res.json({
      success: true,
      message: `Cache limpo com sucesso (${cleared} entradas removidas)`,
      cleared
    });
  } catch (error) {
    console.error('[CacheStats] Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Falha ao limpar cache',
      message: error.message
    });
  }
});

/**
 * POST /api/cache/clean-expired
 * Limpar apenas entradas expiradas
 */
router.post('/clean-expired', requireAuth, async (req, res) => {
  try {
    const cleaned = analysisCache.cleanExpiredEntries();

    res.json({
      success: true,
      message: `Entradas expiradas removidas (${cleaned} entradas)`,
      cleaned
    });
  } catch (error) {
    console.error('[CacheStats] Error cleaning expired:', error);
    res.status(500).json({
      success: false,
      error: 'Falha ao limpar entradas expiradas',
      message: error.message
    });
  }
});

export default router;
