/**
 * ROM Agent - Cache Statistics Endpoint
 *
 * Expõe estatísticas do cache de análises (Fase 3) + Redis cache management
 */

import { Router } from 'express';
import analysisCache from '../utils/analysis-cache.js';
import { requireAuth } from '../middleware/auth.js';
import { getRedisClient, isRedisReady } from '../config/database.js';

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

// =============================================================================
// REDIS CACHE MANAGEMENT
// =============================================================================

/**
 * GET /api/cache/redis/status
 * Verificar status do Redis e listar keys
 */
router.get('/redis/status', requireAuth, async (req, res) => {
  try {
    // Verificar se é admin
    if (req.session.user.role !== 'master_admin' && req.session.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Apenas administradores podem acessar status do Redis'
      });
    }

    const redis = getRedisClient();

    if (!redis || !isRedisReady()) {
      return res.json({
        success: true,
        redis: {
          connected: false,
          message: 'Redis não está conectado ou desabilitado (DISABLE_REDIS=true)'
        }
      });
    }

    // Listar todas as keys
    const allKeys = await redis.keys('*');
    const kbKeys = await redis.keys('kb:*');
    const sessionKeys = await redis.keys('sess:*');

    // Agrupar keys por prefixo
    const keysByPrefix = {};
    for (const key of allKeys) {
      const prefix = key.split(':')[0];
      if (!keysByPrefix[prefix]) {
        keysByPrefix[prefix] = [];
      }
      keysByPrefix[prefix].push(key);
    }

    res.json({
      success: true,
      redis: {
        connected: true,
        ready: isRedisReady(),
        stats: {
          total: allKeys.length,
          kbKeys: kbKeys.length,
          sessionKeys: sessionKeys.length,
          byPrefix: Object.keys(keysByPrefix).map(prefix => ({
            prefix,
            count: keysByPrefix[prefix].length
          }))
        },
        kbKeys: kbKeys.slice(0, 50), // Primeiras 50 keys KB
        allKeys: allKeys.slice(0, 100) // Primeiras 100 keys totais
      }
    });
  } catch (error) {
    console.error('[CacheStats] Error getting Redis status:', error);
    res.status(500).json({
      success: false,
      error: 'Falha ao obter status do Redis',
      message: error.message
    });
  }
});

/**
 * POST /api/cache/redis/flush
 * Limpar cache Redis (keys específicas ou todas)
 */
router.post('/redis/flush', requireAuth, async (req, res) => {
  try {
    // Verificar se é admin
    if (req.session.user.role !== 'master_admin' && req.session.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Apenas administradores podem limpar o cache Redis'
      });
    }

    const redis = getRedisClient();

    if (!redis || !isRedisReady()) {
      return res.status(400).json({
        success: false,
        error: 'Redis não está conectado ou desabilitado'
      });
    }

    // Opção: pattern para filtrar (default: kb:*)
    const pattern = req.body.pattern || 'kb:*';
    const flushAll = req.body.flushAll === true;

    let deletedCount = 0;
    let deletedKeys = [];

    if (flushAll) {
      // CUIDADO: Deleta TODAS as keys (incluindo sessões!)
      await redis.flushdb();
      deletedCount = await redis.dbsize();
      console.log(`⚠️  [Redis] FLUSHDB executado - ${deletedCount} keys deletadas`);
    } else {
      // Deletar apenas keys com o pattern
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        deletedCount = await redis.del(...keys);
        deletedKeys = keys;
        console.log(`🗑️  [Redis] ${deletedCount} keys deletadas (pattern: ${pattern})`);
      }
    }

    res.json({
      success: true,
      message: flushAll
        ? `Todos os caches Redis foram limpos (${deletedCount} keys)`
        : `Cache Redis limpo: ${deletedCount} keys deletadas (pattern: ${pattern})`,
      deletedCount,
      deletedKeys: flushAll ? [] : deletedKeys.slice(0, 50), // Primeiras 50
      pattern: flushAll ? '*' : pattern
    });
  } catch (error) {
    console.error('[CacheStats] Error flushing Redis:', error);
    res.status(500).json({
      success: false,
      error: 'Falha ao limpar cache Redis',
      message: error.message
    });
  }
});

/**
 * POST /api/cache/redis/flush-kb
 * Atalho: Limpar apenas cache KB (kb:*)
 */
router.post('/redis/flush-kb', requireAuth, async (req, res) => {
  try {
    // Verificar se é admin
    if (req.session.user.role !== 'master_admin' && req.session.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Apenas administradores podem limpar o cache KB'
      });
    }

    const redis = getRedisClient();

    if (!redis || !isRedisReady()) {
      return res.status(400).json({
        success: false,
        error: 'Redis não está conectado ou desabilitado'
      });
    }

    // Listar keys KB antes de deletar
    const kbKeys = await redis.keys('kb:*');

    let deletedCount = 0;
    if (kbKeys.length > 0) {
      deletedCount = await redis.del(...kbKeys);
      console.log(`🗑️  [Redis] Cache KB limpo: ${deletedCount} keys deletadas`);
    }

    res.json({
      success: true,
      message: `Cache KB limpo: ${deletedCount} keys deletadas`,
      deletedCount,
      deletedKeys: kbKeys.slice(0, 50) // Primeiras 50
    });
  } catch (error) {
    console.error('[CacheStats] Error flushing KB cache:', error);
    res.status(500).json({
      success: false,
      error: 'Falha ao limpar cache KB',
      message: error.message
    });
  }
});

/**
 * POST /api/cache/emergency-password-fix
 * ENDPOINT DE EMERGÊNCIA - Resetar senha sem CSRF
 * DELETAR APÓS USAR!
 */
router.post('/emergency-password-fix', async (req, res) => {
  try {
    const { secret } = req.body;

    // Secret key hardcoded
    if (secret !== 'mota2323kb-emergency-fix-2026') {
      return res.status(403).json({
        success: false,
        error: 'Invalid secret key'
      });
    }

    const bcrypt = (await import('bcryptjs')).default;
    const email = 'rodolfo@rom.adv.br';
    const newPassword = 'Mota@2323';

    console.log('🚨 [EMERGENCY] Reset senha para:', email);

    // Verificar usuário
    const { pool } = await import('../config/database.js');
    const userCheck = await pool.query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [email]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userCheck.rows[0];

    // Hash senha
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Calcular expiração (90 dias)
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    // Atualizar
    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           password_changed_at = $2,
           password_expires_at = $3,
           force_password_change = false,
           account_locked = false,
           account_locked_until = NULL,
           updated_at = NOW()
       WHERE id = $4`,
      [passwordHash, now, expiresAt, user.id]
    );

    console.log('✅ [EMERGENCY] Senha resetada!');

    res.json({
      success: true,
      message: 'Password reset successfully',
      user: { id: user.id, email: user.email, name: user.name },
      passwordInfo: {
        changedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        daysUntilExpiry: 90
      }
    });

  } catch (error) {
    console.error('❌ [EMERGENCY] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
      message: error.message
    });
  }
});

export default router;
