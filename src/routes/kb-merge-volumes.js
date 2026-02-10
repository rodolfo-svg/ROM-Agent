/**
 * KB Merge Volumes - Endpoint para mesclar múltiplos PDFs
 *
 * Permite upload de múltiplos volumes de um mesmo processo
 * e mescla automaticamente em um único PDF antes da análise
 */

import express from 'express';
import multer from 'multer';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { ACTIVE_PATHS } from '../../lib/storage-config.js';
import logger from '../../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Configurar multer para aceitar múltiplos arquivos
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const tempDir = path.join(ACTIVE_PATHS.data, 'temp-merge');
    try {
      await fs.mkdir(tempDir, { recursive: true });
      cb(null, tempDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB
    files: 10 // Máximo 10 arquivos
  },
  fileFilter: (req, file, cb) => {
    // ✅ ACEITA QUALQUER FORMATO DE ARQUIVO
    // - PDF (merge de volumes)
    // - Imagens (JPG, PNG, GIF, BMP, TIFF, WebP) - OCR automático
    // - Vídeos (MP4, AVI, MOV, WMV) - extração de frames + áudio
    // - Áudio (MP3, WAV, OGG, M4A) - transcrição
    // - Documentos (DOCX, XLSX, PPTX) - extração de texto
    // - Texto (TXT, HTML, XML, JSON, MD, CSV) - leitura direta
    cb(null, true); // Aceita tudo
  }
});

/**
 * POST /api/kb/merge-volumes
 *
 * Mescla múltiplos PDFs em um único arquivo
 *
 * Body (multipart/form-data):
 * - files[]: Array de PDFs (2-10 arquivos)
 * - processName: Nome do processo (opcional)
 * - autoAnalyze: Se true, inicia análise automática após merge (default: false)
 *
 * Response:
 * {
 *   success: true,
 *   mergedDocument: {
 *     id: "...",
 *     name: "...",
 *     path: "...",
 *     size: 12345,
 *     volumesCount: 3,
 *     totalPages: 530
 *   },
 *   message: "3 volumes mesclados com sucesso"
 * }
 */
router.post('/', requireAuth, upload.array('files', 10), async (req, res) => {
  const uploadedFiles = req.files || [];
  const tempFiles = [];

  try {
    logger.info(`🔀 [Merge] Iniciando merge de ${uploadedFiles.length} volume(s)`);

    // Validação
    if (uploadedFiles.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'É necessário pelo menos 2 arquivos para mesclar'
      });
    }

    const { processName = 'Processo', autoAnalyze = 'false' } = req.body;

    // Adicionar arquivos à lista de temp para cleanup
    tempFiles.push(...uploadedFiles.map(f => f.path));

    // Ordenar arquivos por volume (Vol1, Vol2, Vol3)
    const sortedFiles = uploadedFiles.sort((a, b) => {
      const aVol = extractVolumeNumber(a.originalname);
      const bVol = extractVolumeNumber(b.originalname);
      return aVol - bVol;
    });

    logger.info(`   📋 Ordem dos volumes:`);
    sortedFiles.forEach((f, i) => {
      logger.info(`      ${i + 1}. ${f.originalname} (${formatBytes(f.size)})`);
    });

    // Criar novo PDF mesclado
    const mergedPdf = await PDFDocument.create();
    let totalPages = 0;

    for (const file of sortedFiles) {
      logger.info(`   ⏳ Processando: ${file.originalname}`);

      // Ler PDF
      const pdfBytes = await fs.readFile(file.path);
      const pdf = await PDFDocument.load(pdfBytes);

      // Copiar todas as páginas
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach(page => mergedPdf.addPage(page));

      totalPages += pdf.getPageCount();
      logger.info(`      ✅ ${pdf.getPageCount()} página(s) adicionada(s)`);
    }

    // Salvar volumes individuais em diretório permanente (para merge-first analysis)
    const timestamp = Date.now();
    const safeName = processName.replace(/[^a-zA-Z0-9\s]/g, '_').replace(/\s+/g, '_');
    const volumesDir = path.join(ACTIVE_PATHS.data, 'uploads', 'volumes', `${timestamp}_${safeName}`);

    await fs.mkdir(volumesDir, { recursive: true });

    logger.info(`   💾 Salvando volumes individuais para análise futura...`);
    const permanentVolumes = [];

    for (const file of sortedFiles) {
      const volumeFilename = `${file.originalname}`;
      const volumePath = path.join(volumesDir, volumeFilename);

      // Copiar arquivo temporário para local permanente
      await fs.copyFile(file.path, volumePath);

      permanentVolumes.push({
        originalName: file.originalname,
        size: file.size,
        path: volumePath  // ✅ FIX: Incluir path para merge-first analysis
      });

      logger.info(`      ✅ ${file.originalname} → volumes/${timestamp}_${safeName}/`);
    }

    // Salvar PDF mesclado
    const mergedFilename = `${timestamp}_${safeName}_Completo.pdf`;
    const mergedPath = path.join(ACTIVE_PATHS.data, 'uploads', mergedFilename);

    // Garantir que diretório existe
    await fs.mkdir(path.dirname(mergedPath), { recursive: true });

    const mergedBytes = await mergedPdf.save();
    await fs.writeFile(mergedPath, mergedBytes);

    const mergedSize = (await fs.stat(mergedPath)).size;

    logger.info(`   ✅ PDF mesclado criado: ${mergedFilename}`);
    logger.info(`   📊 Total: ${totalPages} páginas, ${formatBytes(mergedSize)}`);

    // Criar documento no KB
    const kbDocsPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');
    let allDocs = [];

    try {
      const content = await fs.readFile(kbDocsPath, 'utf8');
      allDocs = JSON.parse(content);
    } catch (error) {
      // Arquivo não existe, criar novo array
      allDocs = [];
    }

    const documentId = `merged-${timestamp}`;

    // DEBUG: Log session info
    const userId = req.session?.user?.id || 'web-upload';
    logger.info(`   🔐 Session check: hasSession=${!!req.session}, hasUser=${!!req.session?.user}, userId=${userId}`);

    const newDoc = {
      id: documentId,
      name: mergedFilename,
      originalName: mergedFilename,
      type: 'application/pdf',
      size: mergedSize,
      path: mergedPath,
      userId: userId,
      uploadedAt: new Date().toISOString(),
      metadata: {
        isMergedDocument: true,
        volumesCount: sortedFiles.length,
        totalPages,
        sourceVolumes: permanentVolumes,  // ✅ FIX: Usar volumes permanentes com paths
        processName
      }
    };

    allDocs.push(newDoc);
    await fs.writeFile(kbDocsPath, JSON.stringify(allDocs, null, 2));

    logger.info(`   ✅ Documento adicionado ao KB: ${documentId}`);

    // Limpar arquivos temporários
    for (const tempFile of tempFiles) {
      try {
        await fs.unlink(tempFile);
      } catch (error) {
        logger.warn(`   ⚠️ Não foi possível deletar arquivo temp: ${tempFile}`);
      }
    }

    logger.info(`   🧹 Arquivos temporários limpos`);

    res.json({
      success: true,
      mergedDocument: {
        id: documentId,
        name: mergedFilename,
        path: mergedPath,
        size: mergedSize,
        volumesCount: sortedFiles.length,
        totalPages,
        processName
      },
      message: `${sortedFiles.length} volume(s) mesclado(s) com sucesso`
    });

  } catch (error) {
    logger.error('❌ [Merge] Erro ao mesclar PDFs:', error);

    // Limpar arquivos temporários em caso de erro
    for (const tempFile of tempFiles) {
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignorar erros de cleanup
      }
    }

    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * Extrai número do volume do nome do arquivo
 *
 * Reconhece padrões:
 * - Vol1, Vol2, Vol3
 * - Volume 1, Volume 2
 * - v1, v2, v3
 * - parte1, parte2
 * - apenso1, apenso2
 *
 * @param {string} filename - Nome do arquivo
 * @returns {number} Número do volume (ou 0 se não detectado)
 */
function extractVolumeNumber(filename) {
  const patterns = [
    /vol[ume]*[\s_-]*(\d+)/i,
    /v[\s_-]*(\d+)/i,
    /parte[\s_-]*(\d+)/i,
    /apenso[\s_-]*(\d+)/i,
    /(\d+)[\s_-]*vol/i,
    /\((\d+)\)/,
    /_(\d+)\./
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      return parseInt(match[1]);
    }
  }

  return 0;
}

/**
 * Formata bytes em formato legível
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * POST /api/kb/merge-volumes/from-paths
 *
 * Mescla PDFs a partir de paths de arquivos já uploadados
 * (útil para arquivos que vieram via chunked upload)
 *
 * Body (JSON):
 * - paths: Array de caminhos absolutos dos PDFs já uploadados
 * - processName: Nome do processo (opcional)
 *
 * Response:
 * {
 *   success: true,
 *   mergedDocument: {
 *     id: "...",
 *     name: "...",
 *     path: "...",
 *     size: 12345,
 *     volumesCount: 3,
 *     totalPages: 530
 *   },
 *   message: "3 volumes mesclados com sucesso"
 * }
 */
router.post('/from-paths', requireAuth, async (req, res) => {
  try {
    const { paths, processName = 'Processo' } = req.body;

    logger.info(`🔀 [Merge from Paths] Iniciando merge de ${paths.length} arquivo(s) já uploadados`);

    // Validação
    if (!paths || !Array.isArray(paths) || paths.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'É necessário pelo menos 2 arquivos para mesclar'
      });
    }

    // Verificar se todos os arquivos existem
    for (const filePath of paths) {
      try {
        await fs.access(filePath);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: `Arquivo não encontrado: ${path.basename(filePath)}`
        });
      }
    }

    // Ordenar arquivos por volume
    const sortedFiles = paths
      .map(filePath => ({
        path: filePath,
        name: path.basename(filePath),
        volumeNumber: extractVolumeNumber(path.basename(filePath))
      }))
      .sort((a, b) => a.volumeNumber - b.volumeNumber);

    logger.info(`   📋 Ordem dos volumes:`);
    sortedFiles.forEach((f, i) => {
      logger.info(`      ${i + 1}. ${f.name} (Vol ${f.volumeNumber || 'N/A'})`);
    });

    // Criar novo PDF mesclado
    const mergedPdf = await PDFDocument.create();
    let totalPages = 0;

    for (const file of sortedFiles) {
      logger.info(`   ⏳ Processando: ${file.name}`);

      // Ler PDF
      const pdfBytes = await fs.readFile(file.path);
      const pdf = await PDFDocument.load(pdfBytes);

      // Copiar todas as páginas
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach(page => mergedPdf.addPage(page));

      totalPages += pdf.getPageCount();
      logger.info(`      ✅ ${pdf.getPageCount()} página(s) adicionada(s)`);
    }

    // Salvar PDF mesclado
    const timestamp = Date.now();
    const safeName = processName.replace(/[^a-zA-Z0-9\\s]/g, '_').replace(/\\s+/g, '_');
    const mergedFilename = `${timestamp}_${safeName}_Completo.pdf`;
    const mergedPath = path.join(ACTIVE_PATHS.data, 'uploads', mergedFilename);

    // Garantir que diretório existe
    await fs.mkdir(path.dirname(mergedPath), { recursive: true });

    const mergedBytes = await mergedPdf.save();
    await fs.writeFile(mergedPath, mergedBytes);

    const mergedSize = (await fs.stat(mergedPath)).size;

    logger.info(`   ✅ PDF mesclado criado: ${mergedFilename}`);
    logger.info(`   📊 Total: ${totalPages} páginas, ${formatBytes(mergedSize)}`);

    // Criar documento no KB
    const kbDocsPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');
    let allDocs = [];

    try {
      const content = await fs.readFile(kbDocsPath, 'utf8');
      allDocs = JSON.parse(content);
    } catch (error) {
      allDocs = [];
    }

    const documentId = `merged-${timestamp}`;

    // DEBUG: Log session info
    const userId = req.session?.user?.id || 'web-upload';
    logger.info(`   🔐 Session check: hasSession=${!!req.session}, hasUser=${!!req.session?.user}, userId=${userId}`);

    const newDoc = {
      id: documentId,
      name: mergedFilename,
      originalName: mergedFilename,
      type: 'application/pdf',
      size: mergedSize,
      path: mergedPath,
      userId: userId,
      uploadedAt: new Date().toISOString(),
      metadata: {
        isMergedDocument: true,
        volumesCount: sortedFiles.length,
        totalPages,
        sourceVolumes: sortedFiles.map(f => ({
          originalName: f.name,
          path: f.path
        })),
        processName
      }
    };

    allDocs.push(newDoc);
    await fs.writeFile(kbDocsPath, JSON.stringify(allDocs, null, 2));

    logger.info(`   ✅ Documento adicionado ao KB: ${documentId}`);

    res.json({
      success: true,
      mergedDocument: {
        id: documentId,
        name: mergedFilename,
        path: mergedPath,
        size: mergedSize,
        volumesCount: sortedFiles.length,
        totalPages,
        processName
      },
      message: `${sortedFiles.length} volume(s) mesclado(s) com sucesso`
    });

  } catch (error) {
    logger.error('❌ [Merge from Paths] Erro ao mesclar PDFs:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * GET /api/kb/merge-volumes/status
 *
 * Retorna status do serviço de merge
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    service: 'KB Merge Volumes',
    version: '1.0.0',
    status: 'operational',
    features: {
      maxFiles: 10,
      maxFileSize: '500 MB',
      supportedFormats: ['PDF'],
      autoVolumeDetection: true,
      chunkedUploadSupport: true
    }
  });
});

/**
 * POST /api/kb/cleanup
 * Limpa documentos do KB por filtro (admin only)
 */
router.post('/cleanup', requireAuth, async (req, res) => {
  try {
    const { filter } = req.body; // Ex: "ernesto"
    const kbPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');

    // Ler KB
    const kbData = await fs.readFile(kbPath, 'utf8');
    const allDocs = JSON.parse(kbData);

    const before = allDocs.length;

    // Filtrar
    const cleaned = allDocs.filter(doc => {
      const shouldRemove = doc.name?.toLowerCase().includes(filter.toLowerCase());
      if (shouldRemove) {
        logger.info(`Removendo: ${doc.id} - ${doc.name}`);
      }
      return !shouldRemove;
    });

    const removed = before - cleaned.length;

    // Salvar
    await fs.writeFile(kbPath, JSON.stringify(cleaned, null, 2));

    res.json({
      success: true,
      message: `${removed} documentos removidos`,
      before,
      after: cleaned.length
    });
  } catch (error) {
    logger.error('Erro no cleanup:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/kb/documents/:id
 * Deleta um documento do KB
 */
router.delete('/documents/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[KB DELETE] Iniciando deleção: ${id}`);

    const kbPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');
    console.log(`[KB DELETE] Path: ${kbPath}`);

    // Verificar se arquivo existe
    try {
      await fs.access(kbPath);
    } catch {
      console.error(`[KB DELETE] Arquivo não existe: ${kbPath}`);
      return res.status(500).json({
        success: false,
        error: 'Arquivo kb-documents.json não encontrado'
      });
    }

    // Ler KB atual (é um array direto)
    const fileContent = await fs.readFile(kbPath, 'utf8');
    console.log(`[KB DELETE] Arquivo lido: ${fileContent.length} bytes`);

    const allDocs = JSON.parse(fileContent);
    console.log(`[KB DELETE] Total docs: ${allDocs.length}`);

    // Filtrar removendo o documento
    const filtered = allDocs.filter(d => d.id !== id);
    console.log(`[KB DELETE] Após filtro: ${filtered.length}`);

    if (filtered.length === allDocs.length) {
      console.log(`[KB DELETE] Documento não encontrado: ${id}`);
      return res.status(404).json({
        success: false,
        error: 'Documento não encontrado'
      });
    }

    // Salvar
    await fs.writeFile(kbPath, JSON.stringify(filtered, null, 2));
    console.log(`[KB DELETE] Arquivo salvo com sucesso`);

    res.json({
      success: true,
      message: 'Documento deletado',
      deletedId: id
    });
  } catch (error) {
    console.error('[KB DELETE] Erro:', error);
    console.error('[KB DELETE] Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;
