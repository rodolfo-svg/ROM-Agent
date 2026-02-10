/**
 * ROM Agent - Rotas de Extração v2.0 (18 Ficheiros Completos)
 *
 * API REST para acionar o novo pipeline de extração com análise profunda
 *
 * Endpoints:
 * - POST /api/extraction/v2/extract - Extrai documento com análise completa
 * - GET /api/extraction/v2/status/:jobId - Verifica status de job
 * - GET /api/extraction/v2/result/:jobId - Obtém resultado de extração
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { extractDocumentWithFullAnalysis } from '../services/document-extraction-service.js';
import logger from '../../lib/logger.js';

const router = express.Router();

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'temp', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024  // 50MB máximo
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.txt', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo não suportado: ${ext}. Permitidos: ${allowedTypes.join(', ')}`));
    }
  }
});

// Store de jobs em memória (em produção, usar Redis ou DB)
const jobsStore = new Map();

/**
 * POST /api/extraction/v2/extract
 *
 * Extrai documento com pipeline de 18 ficheiros completos
 *
 * Body (multipart/form-data):
 * - file: Arquivo PDF/DOCX/TXT
 * - outputFolderName: Nome da pasta de saída (opcional)
 * - projectName: Nome do projeto (opcional, default: ROM)
 * - uploadToKB: Se deve fazer upload para Knowledge Base (opcional, default: false)
 * - async: Se deve processar de forma assíncrona (opcional, default: true)
 */
router.post('/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Nenhum arquivo foi enviado',
        message: 'Envie um arquivo no campo "file"'
      });
    }

    const {
      outputFolderName,
      projectName = 'ROM',
      uploadToKB = 'false',
      async = 'true'
    } = req.body;

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const filePath = req.file.path;
    const fileName = req.file.originalname;

    // Nome da pasta baseado no arquivo se não fornecido
    const nomePasta = outputFolderName ||
      `${path.basename(fileName, path.extname(fileName))}_${Date.now()}`;

    logger.info('🆕 Nova requisição de extração v2.0', {
      jobId,
      arquivo: fileName,
      tamanho: req.file.size,
      pastaOutput: nomePasta,
      async: async === 'true'
    });

    // Configurar job
    const jobConfig = {
      jobId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      filePath,
      fileName,
      outputFolderName: nomePasta,
      projectName,
      uploadToKB: uploadToKB === 'true',
      result: null,
      error: null
    };

    jobsStore.set(jobId, jobConfig);

    // Processar assíncronamente
    if (async === 'true') {
      // Processar em background
      processarExtracao(jobId, jobConfig).catch(error => {
        logger.error('Erro no processamento assíncrono', { jobId, error: error.message });
      });

      return res.status(202).json({
        success: true,
        message: 'Extração iniciada em background',
        jobId,
        statusUrl: `/api/extraction/v2/status/${jobId}`,
        resultUrl: `/api/extraction/v2/result/${jobId}`
      });
    } else {
      // Processar sincronamente (bloqueante)
      jobConfig.status = 'processing';
      jobsStore.set(jobId, jobConfig);

      const resultado = await extractDocumentWithFullAnalysis({
        filePath,
        outputFolderName: nomePasta,
        projectName,
        uploadToKB: uploadToKB === 'true'
      });

      // Limpar arquivo temporário
      await fs.unlink(filePath).catch(() => {});

      jobConfig.status = 'completed';
      jobConfig.completedAt = new Date().toISOString();
      jobConfig.result = resultado;
      jobsStore.set(jobId, jobConfig);

      return res.status(200).json({
        success: true,
        message: 'Extração concluída',
        jobId,
        result: resultado
      });
    }

  } catch (error) {
    logger.error('Erro na rota de extração v2.0', {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      error: 'Erro ao processar extração',
      message: error.message
    });
  }
});

/**
 * Função auxiliar para processar extração em background
 */
async function processarExtracao(jobId, jobConfig) {
  try {
    logger.info('⚙️ Iniciando processamento', { jobId });

    jobConfig.status = 'processing';
    jobConfig.startedAt = new Date().toISOString();
    jobsStore.set(jobId, jobConfig);

    const resultado = await extractDocumentWithFullAnalysis({
      filePath: jobConfig.filePath,
      outputFolderName: jobConfig.outputFolderName,
      projectName: jobConfig.projectName,
      uploadToKB: jobConfig.uploadToKB
    });

    // Limpar arquivo temporário
    await fs.unlink(jobConfig.filePath).catch(() => {});

    jobConfig.status = 'completed';
    jobConfig.completedAt = new Date().toISOString();
    jobConfig.result = resultado;
    jobsStore.set(jobId, jobConfig);

    logger.info('✅ Processamento concluído', {
      jobId,
      duracaoSegundos: resultado.duracaoSegundos
    });

  } catch (error) {
    logger.error('❌ Erro no processamento', {
      jobId,
      error: error.message,
      stack: error.stack
    });

    jobConfig.status = 'failed';
    jobConfig.failedAt = new Date().toISOString();
    jobConfig.error = {
      message: error.message,
      stack: error.stack
    };
    jobsStore.set(jobId, jobConfig);
  }
}

/**
 * GET /api/extraction/v2/status/:jobId
 *
 * Verifica status de um job de extração
 */
router.get('/status/:jobId', (req, res) => {
  const { jobId } = req.params;

  const job = jobsStore.get(jobId);

  if (!job) {
    return res.status(404).json({
      error: 'Job não encontrado',
      jobId
    });
  }

  return res.status(200).json({
    jobId,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    failedAt: job.failedAt,
    fileName: job.fileName,
    hasResult: !!job.result,
    error: job.error ? job.error.message : null
  });
});

/**
 * GET /api/extraction/v2/result/:jobId
 *
 * Obtém resultado de uma extração concluída
 */
router.get('/result/:jobId', (req, res) => {
  const { jobId } = req.params;

  const job = jobsStore.get(jobId);

  if (!job) {
    return res.status(404).json({
      error: 'Job não encontrado',
      jobId
    });
  }

  if (job.status === 'pending' || job.status === 'processing') {
    return res.status(202).json({
      message: 'Extração ainda em andamento',
      jobId,
      status: job.status,
      statusUrl: `/api/extraction/v2/status/${jobId}`
    });
  }

  if (job.status === 'failed') {
    return res.status(500).json({
      error: 'Extração falhou',
      jobId,
      message: job.error.message
    });
  }

  // Status: completed
  return res.status(200).json({
    jobId,
    status: job.status,
    fileName: job.fileName,
    result: job.result
  });
});

/**
 * GET /api/extraction/v2/jobs
 *
 * Lista todos os jobs de extração
 */
router.get('/jobs', (req, res) => {
  const jobs = Array.from(jobsStore.values()).map(job => ({
    jobId: job.jobId,
    status: job.status,
    fileName: job.fileName,
    createdAt: job.createdAt,
    completedAt: job.completedAt
  }));

  return res.status(200).json({
    total: jobs.length,
    jobs
  });
});

/**
 * DELETE /api/extraction/v2/job/:jobId
 *
 * Remove um job do store
 */
router.delete('/job/:jobId', (req, res) => {
  const { jobId } = req.params;

  if (!jobsStore.has(jobId)) {
    return res.status(404).json({
      error: 'Job não encontrado',
      jobId
    });
  }

  jobsStore.delete(jobId);

  return res.status(200).json({
    message: 'Job removido',
    jobId
  });
});

export default router;
