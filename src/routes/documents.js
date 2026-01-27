/**
 * ROM Agent - Documents Routes
 *
 * Endpoints para conversão e download de documentos
 *
 * Features:
 * - Conversão Markdown → Word (DOCX)
 * - Conversão Markdown → PDF
 * - Conversão Markdown → HTML
 * - Conversão Markdown → TXT
 * - Download direto com headers corretos
 *
 * @version 1.0.0
 * @since Fase 2 - Word por padrão
 */

import express from 'express';
import { convertDocument } from '../modules/document-converter.js';
import { logger } from '../utils/logger.js';
import metricsCollector from '../utils/metrics-collector-v2.js';

const router = express.Router();

// Content-Types para cada formato
const CONTENT_TYPES = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  html: 'text/html; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8'
};

// Extensões de arquivo
const FILE_EXTENSIONS = {
  docx: '.docx',
  pdf: '.pdf',
  html: '.html',
  txt: '.txt',
  md: '.md'
};

/**
 * POST /api/documents/convert
 *
 * Converte documento Markdown para formato especificado e retorna para download
 *
 * Body:
 * {
 *   "content": "# Título\n\nConteúdo em Markdown...",
 *   "format": "docx",  // docx, pdf, html, txt, md
 *   "title": "Meu Documento",  // opcional
 *   "filename": "documento"  // opcional (sem extensão)
 * }
 *
 * Response:
 * - Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
 * - Content-Disposition: attachment; filename="documento.docx"
 * - Body: Buffer do documento
 */
router.post('/convert', async (req, res) => {
  const startTime = Date.now();
  const requestId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const {
      content,
      format = 'docx',
      title = 'Documento',
      filename = 'documento',
      author = 'ROM Agent'
    } = req.body;

    // Validações
    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Campo "content" é obrigatório e deve ser uma string'
      });
    }

    if (!CONTENT_TYPES[format]) {
      return res.status(400).json({
        success: false,
        error: `Formato inválido: ${format}. Formatos suportados: docx, pdf, html, txt, md`
      });
    }

    logger.info(`[${requestId}] Convertendo documento`, {
      format,
      contentLength: content.length,
      title,
      filename
    });

    // Converter documento
    const result = await convertDocument(content, format, {
      title,
      author
    });

    const totalTime = Date.now() - startTime;

    // Preparar filename com extensão
    const fullFilename = filename + FILE_EXTENSIONS[format];

    // Configurar headers
    res.setHeader('Content-Type', CONTENT_TYPES[format]);
    res.setHeader('Content-Disposition', `attachment; filename="${fullFilename}"`);

    // Se for buffer (docx, pdf), enviar como binary
    if (Buffer.isBuffer(result)) {
      res.setHeader('Content-Length', result.length);
      res.send(result);
    } else {
      // Se for string (html, txt, md), enviar como texto
      res.send(result);
    }

    logger.info(`[${requestId}] Documento convertido com sucesso`, {
      format,
      totalTime: `${totalTime}ms`,
      outputSize: Buffer.isBuffer(result) ? result.length : result.length
    });

    // Métricas
    metricsCollector.incrementCounter('document_conversion_success', { format });
    metricsCollector.recordLatency('document_conversion', totalTime, format);

  } catch (error) {
    const totalTime = Date.now() - startTime;

    logger.error(`[${requestId}] Erro ao converter documento`, {
      error: error.message,
      stack: error.stack,
      totalTime: `${totalTime}ms`
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao converter documento'
    });

    // Métricas
    metricsCollector.incrementCounter('document_conversion_error', {
      format: req.body.format || 'unknown',
      error_type: error.name || 'unknown'
    });
  }
});

/**
 * POST /api/documents/convert/batch
 *
 * Converte documento para múltiplos formatos de uma vez
 *
 * Body:
 * {
 *   "content": "# Título\n\nConteúdo...",
 *   "formats": ["docx", "pdf"],  // array de formatos
 *   "title": "Meu Documento"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "documents": {
 *     "docx": "<base64>",
 *     "pdf": "<base64>"
 *   }
 * }
 */
router.post('/convert/batch', async (req, res) => {
  const startTime = Date.now();
  const requestId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const {
      content,
      formats = ['docx'],
      title = 'Documento',
      author = 'ROM Agent'
    } = req.body;

    // Validações
    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Campo "content" é obrigatório e deve ser uma string'
      });
    }

    if (!Array.isArray(formats) || formats.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Campo "formats" deve ser um array não-vazio'
      });
    }

    // Validar formatos
    for (const format of formats) {
      if (!CONTENT_TYPES[format]) {
        return res.status(400).json({
          success: false,
          error: `Formato inválido: ${format}`
        });
      }
    }

    logger.info(`[${requestId}] Convertendo documento em batch`, {
      formats,
      contentLength: content.length,
      title
    });

    // Converter para cada formato
    const documents = {};

    for (const format of formats) {
      const result = await convertDocument(content, format, { title, author });

      // Converter para base64 se for buffer
      if (Buffer.isBuffer(result)) {
        documents[format] = result.toString('base64');
      } else {
        documents[format] = result;
      }
    }

    const totalTime = Date.now() - startTime;

    logger.info(`[${requestId}] Batch conversion concluída`, {
      formats,
      totalTime: `${totalTime}ms`
    });

    res.json({
      success: true,
      documents,
      formats: formats,
      contentTypes: formats.reduce((acc, format) => {
        acc[format] = CONTENT_TYPES[format];
        return acc;
      }, {})
    });

    // Métricas
    metricsCollector.incrementCounter('document_batch_conversion_success', {
      formats_count: formats.length
    });
    metricsCollector.recordLatency('document_batch_conversion', totalTime);

  } catch (error) {
    const totalTime = Date.now() - startTime;

    logger.error(`[${requestId}] Erro ao converter batch`, {
      error: error.message,
      stack: error.stack,
      totalTime: `${totalTime}ms`
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao converter documentos'
    });

    // Métricas
    metricsCollector.incrementCounter('document_batch_conversion_error', {
      error_type: error.name || 'unknown'
    });
  }
});

/**
 * GET /api/documents/formats
 *
 * Lista formatos suportados
 *
 * Response:
 * {
 *   "success": true,
 *   "formats": [
 *     {
 *       "format": "docx",
 *       "name": "Microsoft Word",
 *       "extension": ".docx",
 *       "contentType": "application/vnd..."
 *     },
 *     ...
 *   ]
 * }
 */
router.get('/formats', (req, res) => {
  const formats = [
    {
      format: 'docx',
      name: 'Microsoft Word',
      description: 'Documento Word formatado profissionalmente',
      extension: FILE_EXTENSIONS.docx,
      contentType: CONTENT_TYPES.docx,
      features: ['Formatação completa', 'Timbrado', 'Estilos ABNT']
    },
    {
      format: 'pdf',
      name: 'PDF',
      description: 'Documento PDF portátil',
      extension: FILE_EXTENSIONS.pdf,
      contentType: CONTENT_TYPES.pdf,
      features: ['Visualização universal', 'Não editável', 'Compacto']
    },
    {
      format: 'html',
      name: 'HTML',
      description: 'Página web com CSS',
      extension: FILE_EXTENSIONS.html,
      contentType: CONTENT_TYPES.html,
      features: ['Visualização no navegador', 'Responsivo', 'Estilizado']
    },
    {
      format: 'txt',
      name: 'Texto Puro',
      description: 'Texto sem formatação',
      extension: FILE_EXTENSIONS.txt,
      contentType: CONTENT_TYPES.txt,
      features: ['Máxima compatibilidade', 'Tamanho mínimo', 'Editável']
    },
    {
      format: 'md',
      name: 'Markdown',
      description: 'Markdown original',
      extension: FILE_EXTENSIONS.md,
      contentType: CONTENT_TYPES.md,
      features: ['Formato fonte', 'Editável', 'Versionável']
    }
  ];

  res.json({
    success: true,
    formats,
    default: 'docx'
  });
});

/**
 * GET /api/documents/health
 *
 * Health check do serviço de documentos
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    features: ['convert', 'batch', 'formats'],
    supportedFormats: Object.keys(CONTENT_TYPES),
    timestamp: new Date().toISOString()
  });
});

export default router;
