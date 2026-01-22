/**
 * ROM Agent - Export Routes
 *
 * Rotas para exportação de conteúdo em múltiplos formatos.
 *
 * Endpoints:
 * - POST /api/export/docx - Exporta para Word
 * - POST /api/export/pdf - Exporta para PDF
 * - POST /api/export/html - Exporta para HTML
 * - POST /api/export/markdown - Exporta para Markdown
 * - POST /api/export/txt - Exporta para TXT
 * - POST /api/export/:format - Endpoint genérico
 */

import express from 'express';
import ExportService from '../services/export-service.js';
import PDFGenerator from '../services/pdf-generator-service.js';

const router = express.Router();

// MIME types por formato
const MIME_TYPES = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  html: 'text/html; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8'
};

// Extensões de arquivo por formato
const EXTENSIONS = {
  docx: 'docx',
  pdf: 'pdf',
  html: 'html',
  markdown: 'md',
  txt: 'txt'
};

/**
 * Middleware de validação
 */
function validateExportRequest(req, res, next) {
  const { content, title } = req.body;

  if (!content || typeof content !== 'string') {
    return res.status(400).json({
      error: 'Conteúdo é obrigatório',
      details: 'O campo "content" deve ser uma string não vazia'
    });
  }

  if (content.length > 10 * 1024 * 1024) {  // 10MB
    return res.status(413).json({
      error: 'Conteúdo muito grande',
      details: 'Limite de 10MB de conteúdo'
    });
  }

  // Título padrão se não fornecido
  if (!title) {
    req.body.title = 'Documento ROM Agent';
  }

  next();
}

/**
 * POST /api/export/:format
 * Endpoint genérico de exportação
 */
router.post('/:format', validateExportRequest, async (req, res) => {
  const startTime = Date.now();
  const { format } = req.params;
  const { content, title, type, metadata, template } = req.body;

  console.log(`[Export] Requisição recebida: ${format.toUpperCase()} - ${title}`);

  try {
    // Validar formato
    if (!['docx', 'pdf', 'html', 'markdown', 'txt'].includes(format)) {
      return res.status(400).json({
        error: 'Formato inválido',
        details: `Formatos suportados: docx, pdf, html, markdown, txt (recebido: ${format})`
      });
    }

    // Exportar usando o serviço
    const result = await ExportService.export({
      content,
      format,
      title: title || 'Documento ROM Agent',
      type: type || 'generic',
      metadata: metadata || {},
      template: template || 'oab'
    });

    // Preparar resposta
    const filename = `${sanitizeFilename(title || 'documento')}.${EXTENSIONS[format]}`;
    const mimeType = MIME_TYPES[format];

    // Headers de resposta
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Formatos de texto (HTML, Markdown, TXT) → enviar como string
    if (format === 'html' || format === 'markdown' || format === 'txt') {
      res.send(result);
    }
    // Formatos binários (DOCX, PDF) → enviar como buffer
    else {
      res.send(Buffer.from(result));
    }

    const duration = Date.now() - startTime;
    console.log(`[Export] ${format.toUpperCase()} gerado em ${duration}ms: ${filename}`);

  } catch (error) {
    console.error(`[Export] Erro ao exportar ${format}:`, error);

    res.status(500).json({
      error: 'Erro ao gerar documento',
      details: error.message,
      format
    });
  }
});

/**
 * POST /api/export/docx
 * Atalho para exportação Word
 */
router.post('/docx', validateExportRequest, async (req, res) => {
  req.params.format = 'docx';
  return router.handle(req, res);
});

/**
 * POST /api/export/pdf
 * Atalho para exportação PDF
 */
router.post('/pdf', validateExportRequest, async (req, res) => {
  req.params.format = 'pdf';
  return router.handle(req, res);
});

/**
 * GET /api/export/status
 * Verifica status do serviço de exportação
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      service: 'export',
      status: 'operational',
      formats: ['docx', 'pdf', 'html', 'markdown', 'txt'],
      templates: ['oab', 'abnt', 'moderno', 'compacto', 'classico'],
      puppeteer: await PDFGenerator.isAvailable()
    };

    res.json(status);
  } catch (error) {
    res.status(500).json({
      service: 'export',
      status: 'error',
      error: error.message
    });
  }
});

/**
 * Sanitiza nome de arquivo removendo caracteres inválidos
 *
 * @param {string} filename - Nome original
 * @returns {string} - Nome sanitizado
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')  // Remove caracteres inválidos
    .replace(/\s+/g, '_')                    // Espaços → underscores
    .replace(/_{2,}/g, '_')                  // Múltiplos underscores → um
    .replace(/^_|_$/g, '')                   // Remove underscores início/fim
    .substring(0, 200);                      // Limita tamanho
}

export default router;
