/**
 * API ROUTES - STORAGE MONITORING
 * Endpoints para monitoramento de armazenamento persistente
 *
 * @version 1.0.0
 */

import express from 'express';
import { ACTIVE_PATHS, STORAGE_INFO, getStorageUsage, cleanOldFiles } from './storage-config.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// STORAGE STATUS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/storage/status
 * Retorna informações sobre o armazenamento
 */
router.get('/storage/status', (req, res) => {
  try {
    const usage = getStorageUsage();

    // Calcular totais
    let totalFiles = 0;
    let totalSize = 0;

    Object.values(usage).forEach(dir => {
      if (dir.files) totalFiles += dir.files;
      if (dir.size) totalSize += dir.size;
    });

    res.json({
      environment: STORAGE_INFO.environment,
      isPersistent: STORAGE_INFO.isPersistent,
      basePath: STORAGE_INFO.basePath,
      diskSize: STORAGE_INFO.diskSize,
      usage: usage,
      totals: {
        files: totalFiles,
        size: totalSize,
        sizeFormatted: formatBytes(totalSize)
      },
      paths: ACTIVE_PATHS
    });
  } catch (error) {
    console.error('Erro ao obter status do storage:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/storage/info
 * Informações básicas do sistema de armazenamento
 */
router.get('/storage/info', (req, res) => {
  res.json({
    nome: 'Sistema de Armazenamento Persistente ROM Agent',
    versao: '1.0.0',
    descricao: 'Armazenamento persistente em disco para uploads, documentos processados e dados do sistema',
    caracteristicas: {
      persistent: {
        ativo: STORAGE_INFO.isPersistent,
        path: STORAGE_INFO.basePath,
        size: STORAGE_INFO.diskSize,
        descricao: STORAGE_INFO.isPersistent
          ? 'Armazenamento mantido após reiniciar (disco persistente)'
          : 'Armazenamento local de desenvolvimento'
      },
      autoBackup: {
        ativo: true,
        horario: '03:00',
        rotacao: '7 dias',
        destino: '/var/data/backups'
      },
      autoCleanup: {
        ativo: true,
        idadeMaxima: '30 dias',
        descricao: 'Remove arquivos antigos automaticamente'
      }
    },
    diretorios: {
      upload: 'Arquivos enviados (PDF, DOCX)',
      processed: 'Arquivos processados',
      extracted: 'Conteúdo extraído (JSON + TXT)',
      data: 'Dados do sistema (KB, conversas, projetos)',
      kb: 'Knowledge Base indexada',
      backups: 'Backups diários',
      logs: 'Logs do sistema',
      partners: 'Logos e timbrados de parceiros'
    },
    endpoints: {
      status: 'GET /api/storage/status',
      info: 'GET /api/storage/info',
      cleanup: 'POST /api/storage/cleanup'
    }
  });
});

/**
 * POST /api/storage/cleanup
 * Limpa arquivos antigos (mais de 30 dias)
 */
router.post('/storage/cleanup', async (req, res) => {
  try {
    const daysOld = parseInt(req.body.daysOld) || 30;

    const results = {
      upload: cleanOldFiles(ACTIVE_PATHS.upload, daysOld),
      processed: cleanOldFiles(ACTIVE_PATHS.processed, daysOld),
      extracted: cleanOldFiles(ACTIVE_PATHS.extracted, daysOld),
      logs: cleanOldFiles(ACTIVE_PATHS.logs, daysOld)
    };

    // Calcular totais
    let totalDeleted = 0;
    let totalFreed = 0;

    Object.values(results).forEach(result => {
      totalDeleted += result.deleted || 0;
      totalFreed += result.freed || 0;
    });

    res.json({
      success: true,
      message: `Limpeza concluída: ${totalDeleted} arquivos removidos`,
      totalDeleted,
      totalFreed,
      totalFreedFormatted: formatBytes(totalFreed),
      daysOld,
      details: results
    });
  } catch (error) {
    console.error('Erro ao limpar arquivos:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default router;
