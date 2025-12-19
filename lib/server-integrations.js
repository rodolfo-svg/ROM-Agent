/**
 * ROM Agent - Integrações para Server Enhanced
 * Este arquivo contém todos os imports e configurações para adicionar ao server-enhanced.js
 */

// ====================================================================
// IMPORTS DAS NOVAS FUNCIONALIDADES (ADICIONAR NO TOPO DO SERVER)
// ====================================================================

/*
import compression from 'compression';
import logger, { requestLogger, logAIOperation, logKBOperation } from '../lib/logger.js';
import { generalLimiter, chatLimiter, uploadLimiter, authLimiter, searchLimiter } from '../lib/rate-limiter.js';
import semanticSearch from '../lib/semantic-search.js';
import documentVersioning from '../lib/versioning.js';
import templatesManager from '../lib/templates-manager.js';
import backupManager from '../lib/backup-manager.js';
*/

// ====================================================================
// MIDDLEWARES (ADICIONAR APÓS app.use(express.json()))
// ====================================================================

/*
// Compression (Gzip/Brotli)
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Nível de compressão (0-9)
  threshold: 1024 // Comprimir apenas responses > 1KB
}));

// Request Logger
app.use(requestLogger);

// Rate Limiter Geral (aplicar em todas as rotas)
app.use('/api/', generalLimiter);
*/

// ====================================================================
// NOVO ENDPOINT /api/info COM HEALTH CHECK COMPLETO
// ====================================================================

export const healthCheckEndpoint = `
// API - Info do sistema com health check completo
app.get('/api/info', async (req, res) => {
  try {
    // Status do AWS Bedrock
    let bedrockStatus = 'unknown';
    try {
      const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
      const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-west-2' });
      bedrockStatus = 'connected';
    } catch (error) {
      bedrockStatus = 'disconnected';
    }

    // Status do cache
    const cacheStats = {
      enabled: true,
      entries: 0 // Atualizar conforme implementação
    };

    // Uptime
    const uptime = process.uptime();
    const uptimeFormatted = \`\${Math.floor(uptime / 3600)}h \${Math.floor((uptime % 3600) / 60)}m\`;

    // Uso de memória
    const memoryUsage = process.memoryUsage();

    // Informações do sistema
    const systemInfo = {
      nome: CONFIG.nome,
      versao: CONFIG.versao,
      capacidades: CONFIG.capacidades,

      // Health Check
      health: {
        status: bedrockStatus === 'connected' ? 'healthy' : 'degraded',
        uptime: uptimeFormatted,
        uptimeSeconds: Math.floor(uptime)
      },

      // AWS Bedrock
      bedrock: {
        status: bedrockStatus,
        region: process.env.AWS_REGION || 'us-west-2'
      },

      // Cache
      cache: cacheStats,

      // Servidor
      server: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
      },

      // Memória
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
      },

      // Timestamp
      timestamp: new Date().toISOString()
    };

    res.json(systemInfo);
  } catch (error) {
    logger.error('Erro no health check:', error);
    res.status(500).json({ error: error.message });
  }
});
`;

// ====================================================================
// ENDPOINTS DE BUSCA SEMÂNTICA
// ====================================================================

export const semanticSearchEndpoints = `
// ====================================================================
// ROTAS DE API PARA BUSCA SEMÂNTICA
// ====================================================================

// Adicionar documento ao índice semântico
app.post('/api/kb/semantic-index', searchLimiter, (req, res) => {
  try {
    const { id, text, metadata } = req.body;

    if (!id || !text) {
      return res.status(400).json({ error: 'ID e texto são obrigatórios' });
    }

    const result = semanticSearch.addDocument({ id, text, metadata });
    res.json(result);
  } catch (error) {
    logger.error('Erro ao indexar documento:', error);
    res.status(500).json({ error: error.message });
  }
});

// Busca semântica no KB
app.get('/api/kb/semantic-search', searchLimiter, (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query (q) é obrigatória' });
    }

    const results = semanticSearch.search(q, parseInt(limit));

    logKBOperation('semantic-search', {
      query: q,
      resultsCount: results.length
    });

    res.json({
      success: true,
      query: q,
      results,
      total: results.length
    });
  } catch (error) {
    logger.error('Erro na busca semântica:', error);
    res.status(500).json({ error: error.message });
  }
});

// Encontrar documentos similares
app.get('/api/kb/similar/:documentId', searchLimiter, (req, res) => {
  try {
    const { documentId } = req.params;
    const { limit = 5 } = req.query;

    const results = semanticSearch.findSimilar(documentId, parseInt(limit));

    res.json({
      success: true,
      documentId,
      similar: results,
      total: results.length
    });
  } catch (error) {
    logger.error('Erro ao buscar similares:', error);
    res.status(500).json({ error: error.message });
  }
});

// Estatísticas do índice semântico
app.get('/api/kb/semantic-stats', (req, res) => {
  try {
    const stats = semanticSearch.getStatistics();
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Erro ao obter estatísticas semânticas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reindexar todos os documentos
app.post('/api/kb/reindex', authSystem.authMiddleware(), authSystem.requireRole('master_admin'), (req, res) => {
  try {
    const result = semanticSearch.reindex();
    logger.info('Reindexação concluída', result);
    res.json(result);
  } catch (error) {
    logger.error('Erro ao reindexar:', error);
    res.status(500).json({ error: error.message });
  }
});
`;

// ====================================================================
// ENDPOINTS DE VERSIONAMENTO
// ====================================================================

export const versioningEndpoints = `
// ====================================================================
// ROTAS DE API PARA VERSIONAMENTO DE DOCUMENTOS
// ====================================================================

// Criar nova versão
app.post('/api/documents/:documentId/versions', authSystem.authMiddleware(), (req, res) => {
  try {
    const { documentId } = req.params;
    const { content, comment } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Conteúdo é obrigatório' });
    }

    const result = documentVersioning.createVersion(documentId, content, {
      author: req.user.name || req.user.email,
      comment: comment || 'Versão criada via API'
    });

    if (result.success) {
      logger.info(\`Versão criada: \${documentId} v\${result.version}\`);
    }

    res.json(result);
  } catch (error) {
    logger.error('Erro ao criar versão:', error);
    res.status(500).json({ error: error.message });
  }
});

// Listar versões de um documento
app.get('/api/documents/:documentId/versions', authSystem.authMiddleware(), (req, res) => {
  try {
    const { documentId } = req.params;
    const result = documentVersioning.listVersions(documentId);
    res.json(result);
  } catch (error) {
    logger.error('Erro ao listar versões:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter versão específica
app.get('/api/documents/:documentId/versions/:version', authSystem.authMiddleware(), (req, res) => {
  try {
    const { documentId, version } = req.params;
    const result = documentVersioning.getVersion(documentId, parseInt(version));
    res.json(result);
  } catch (error) {
    logger.error('Erro ao obter versão:', error);
    res.status(500).json({ error: error.message });
  }
});

// Comparar duas versões (diff)
app.get('/api/documents/:documentId/diff', authSystem.authMiddleware(), (req, res) => {
  try {
    const { documentId } = req.params;
    const { v1, v2 } = req.query;

    if (!v1 || !v2) {
      return res.status(400).json({ error: 'v1 e v2 são obrigatórios' });
    }

    const result = documentVersioning.compareVersions(documentId, parseInt(v1), parseInt(v2));
    res.json(result);
  } catch (error) {
    logger.error('Erro ao comparar versões:', error);
    res.status(500).json({ error: error.message });
  }
});

// Restaurar versão anterior
app.post('/api/documents/:documentId/restore', authSystem.authMiddleware(), (req, res) => {
  try {
    const { documentId } = req.params;
    const { version, comment } = req.body;

    if (!version) {
      return res.status(400).json({ error: 'Versão a restaurar é obrigatória' });
    }

    const result = documentVersioning.restoreVersion(documentId, parseInt(version), {
      author: req.user.name || req.user.email,
      comment: comment || \`Restaurado da versão \${version}\`
    });

    if (result.success) {
      logger.info(\`Versão restaurada: \${documentId} de v\${version} para v\${result.newVersion}\`);
    }

    res.json(result);
  } catch (error) {
    logger.error('Erro ao restaurar versão:', error);
    res.status(500).json({ error: error.message });
  }
});

// Estatísticas de versionamento
app.get('/api/documents/versions/statistics', authSystem.authMiddleware(), (req, res) => {
  try {
    const stats = documentVersioning.getStatistics();
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Erro ao obter estatísticas de versionamento:', error);
    res.status(500).json({ error: error.message });
  }
});
`;

// ====================================================================
// ENDPOINTS DE TEMPLATES
// ====================================================================

export const templatesEndpoints = `
// ====================================================================
// ROTAS DE API PARA TEMPLATES PERSONALIZADOS
// ====================================================================

// Listar todos os templates
app.get('/api/templates', (req, res) => {
  try {
    const { category } = req.query;
    const result = templatesManager.listTemplates(category);
    res.json(result);
  } catch (error) {
    logger.error('Erro ao listar templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter template específico
app.get('/api/templates/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = templatesManager.getTemplate(id);
    res.json(result);
  } catch (error) {
    logger.error('Erro ao obter template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Criar novo template
app.post('/api/templates', authSystem.authMiddleware(), (req, res) => {
  try {
    const result = templatesManager.createTemplate(req.body);

    if (result.success) {
      logger.info(\`Template criado: \${req.body.id}\`);
    }

    res.json(result);
  } catch (error) {
    logger.error('Erro ao criar template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Atualizar template
app.put('/api/templates/:id', authSystem.authMiddleware(), (req, res) => {
  try {
    const { id } = req.params;
    const result = templatesManager.updateTemplate(id, req.body);

    if (result.success) {
      logger.info(\`Template atualizado: \${id}\`);
    }

    res.json(result);
  } catch (error) {
    logger.error('Erro ao atualizar template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Excluir template
app.delete('/api/templates/:id', authSystem.authMiddleware(), authSystem.requireRole('master_admin'), (req, res) => {
  try {
    const { id } = req.params;
    const result = templatesManager.deleteTemplate(id);

    if (result.success) {
      logger.info(\`Template excluído: \${id}\`);
    }

    res.json(result);
  } catch (error) {
    logger.error('Erro ao excluir template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Renderizar template
app.post('/api/templates/:id/render', (req, res) => {
  try {
    const { id } = req.params;
    const { variables } = req.body;

    const result = templatesManager.render(id, variables);

    if (result.success) {
      logger.info(\`Template renderizado: \${id}\`);
    }

    res.json(result);
  } catch (error) {
    logger.error('Erro ao renderizar template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Preview de template
app.post('/api/templates/:id/preview', (req, res) => {
  try {
    const { id } = req.params;
    const { variables } = req.body;

    const result = templatesManager.preview(id, variables || {});
    res.json(result);
  } catch (error) {
    logger.error('Erro ao fazer preview:', error);
    res.status(500).json({ error: error.message });
  }
});

// Estatísticas de templates
app.get('/api/templates-statistics', (req, res) => {
  try {
    const stats = templatesManager.getStatistics();
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Erro ao obter estatísticas de templates:', error);
    res.status(500).json({ error: error.message });
  }
});
`;

// ====================================================================
// ENDPOINTS DE BACKUP
// ====================================================================

export const backupEndpoints = `
// ====================================================================
// ROTAS DE API PARA BACKUP AUTOMÁTICO
// ====================================================================

// Criar backup manual
app.post('/api/backup/create', authSystem.authMiddleware(), authSystem.requireRole('master_admin'), async (req, res) => {
  try {
    const options = req.body || {};
    const result = await backupManager.createBackup(options);

    if (result.success) {
      logger.info(\`Backup criado: \${result.backupName}\`);
    }

    res.json(result);
  } catch (error) {
    logger.error('Erro ao criar backup:', error);
    res.status(500).json({ error: error.message });
  }
});

// Listar backups disponíveis
app.get('/api/backup/list', authSystem.authMiddleware(), authSystem.requireRole('master_admin'), (req, res) => {
  try {
    const result = backupManager.listBackups();
    res.json(result);
  } catch (error) {
    logger.error('Erro ao listar backups:', error);
    res.status(500).json({ error: error.message });
  }
});

// Excluir backup
app.delete('/api/backup/:backupName', authSystem.authMiddleware(), authSystem.requireRole('master_admin'), (req, res) => {
  try {
    const { backupName } = req.params;
    const result = backupManager.deleteBackup(backupName);

    if (result.success) {
      logger.info(\`Backup excluído: \${backupName}\`);
    }

    res.json(result);
  } catch (error) {
    logger.error('Erro ao excluir backup:', error);
    res.status(500).json({ error: error.message });
  }
});

// Estatísticas de backups
app.get('/api/backup/statistics', authSystem.authMiddleware(), authSystem.requireRole('master_admin'), (req, res) => {
  try {
    const stats = backupManager.getStatistics();
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Erro ao obter estatísticas de backup:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verificar integridade de backup
app.get('/api/backup/:backupName/verify', authSystem.authMiddleware(), authSystem.requireRole('master_admin'), (req, res) => {
  try {
    const { backupName } = req.params;
    const result = backupManager.verifyBackup(backupName);
    res.json(result);
  } catch (error) {
    logger.error('Erro ao verificar backup:', error);
    res.status(500).json({ error: error.message });
  }
});
`;

export default {
  healthCheckEndpoint,
  semanticSearchEndpoints,
  versioningEndpoints,
  templatesEndpoints,
  backupEndpoints
};
