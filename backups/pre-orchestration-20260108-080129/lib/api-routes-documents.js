/**
 * Documents & Extraction Routes
 * Endpoints para extração de documentos e processamento
 *
 * VERSÃO ROBUSTA: Router sempre é exportado, mesmo se serviços não estiverem disponíveis
 * Cada endpoint verifica individualmente se o serviço está disponível
 */

import express from 'express';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Logger com fallback seguro (sem top-level await)
let logger = console;
import('../src/utils/logger.js')
  .then(loggerModule => {
    logger = loggerModule.logger || loggerModule.default || console;
  })
  .catch(error => {
    console.warn('Logger não disponível, usando console:', error.message);
  });

// Lazy imports - carregados apenas quando necessário
let extractionService = null;
let documentExtractionService = null;
let servicesLoaded = false;

async function loadServices() {
  if (servicesLoaded) return;

  try {
    extractionService = await import('../src/services/extraction-service.js');
    logger.info('Extraction service carregado com sucesso');
  } catch (error) {
    logger.warn('Extraction service não disponível:', error.message);
  }

  try {
    documentExtractionService = await import('../src/services/document-extraction-service.js');
    logger.info('Document extraction service carregado com sucesso');
  } catch (error) {
    logger.warn('Document extraction service não disponível:', error.message);
  }

  servicesLoaded = true;
}

// Tentar carregar serviços no background (não-bloqueante)
loadServices().catch(err => logger.warn('Erro ao carregar serviços:', err.message));

// ============================================================
// TEST ROUTE - Confirma que router está carregado
// ============================================================

router.get('/documents/status', (req, res) => {
  res.json({
    success: true,
    message: 'Documents router está funcionando',
    servicesLoaded,
    extractionServiceAvailable: !!extractionService,
    documentExtractionServiceAvailable: !!documentExtractionService,
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// EXTRACTION ROUTES (Process-specific)
// ============================================================

/**
 * POST /extraction/extract
 * Extrai documentos completos com OCR, cronologia, matrizes, etc.
 */
router.post('/extraction/extract', async (req, res) => {
  try {
    const {
      filePath,
      processNumber,
      projectName = 'ROM',
      uploadToKB = true,
      generateAllFormats = true
    } = req.body;

    // Validações
    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'filePath é obrigatório'
      });
    }

    if (!processNumber) {
      return res.status(400).json({
        success: false,
        error: 'processNumber é obrigatório'
      });
    }

    logger.info(`Iniciando extração: ${processNumber} (Projeto: ${projectName})`);

    // Garantir que serviços estão carregados
    await loadServices();

    if (!extractionService) {
      return res.status(503).json({
        success: false,
        error: 'Extraction service não está disponível neste ambiente',
        details: 'O serviço de extração requer dependências que não estão instaladas'
      });
    }

    // Executar extração completa
    const result = await extractionService.extractCompleteDocument({
      filePath,
      processNumber,
      projectName,
      uploadToKB,
      generateAllFormats
    });

    logger.info(`Extração concluída: ${processNumber}`);

    res.json({
      success: true,
      processNumber,
      projectName,
      extractionFolder: result.processFolder,
      outputs: result.outputs,
      log: result.log
    });

  } catch (error) {
    logger.error('Erro na extração de documento:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /extraction/folder-structure/:processNumber
 * Retorna a estrutura de pastas criada para um processo
 */
router.get('/extraction/folder-structure/:processNumber', async (req, res) => {
  try {
    const { processNumber } = req.params;
    const { projectName = 'ROM' } = req.query;

    const service = await getExtractionService();
    const structure = await service.createProcessFolderStructure(
      processNumber,
      projectName
    );

    res.json({
      success: true,
      processNumber,
      projectName,
      structure
    });

  } catch (error) {
    logger.error('Erro ao criar estrutura de pastas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /extraction/ocr
 * Executa OCR em um PDF ou imagem
 */
router.post('/extraction/ocr', async (req, res) => {
  try {
    const { filePath, outputFolder, forceOCR = false } = req.body;

    if (!filePath || !outputFolder) {
      return res.status(400).json({
        success: false,
        error: 'filePath e outputFolder são obrigatórios'
      });
    }

    // Importar OCR service (opcional - pode não estar disponível)
    try {
      const ocrService = await import('../src/services/ocr-service.js');

      const result = forceOCR
        ? await ocrService.performOCROnPDF(filePath, outputFolder)
        : await ocrService.smartOCR(filePath, outputFolder);

      res.json({
        success: result.success,
        ocrNeeded: result.ocrNeeded,
        totalPages: result.totalPages,
        processedPages: result.processedPages,
        averageConfidence: result.averageConfidence,
        warnings: result.warnings,
        errors: result.errors,
        outputPath: result.outputPath
      });
    } catch (importError) {
      // OCR service não disponível (dependências faltando)
      logger.warn('OCR service não disponível:', importError.message);
      res.status(503).json({
        success: false,
        error: 'OCR service não está disponível neste ambiente',
        details: 'Dependências do AWS Textract não instaladas'
      });
    }

  } catch (error) {
    logger.error('Erro no OCR:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /extraction/chronology
 * Gera cronologia de um processo
 */
router.post('/extraction/chronology', async (req, res) => {
  try {
    const { processData, includeMatrizes = true } = req.body;

    if (!processData) {
      return res.status(400).json({
        success: false,
        error: 'processData é obrigatório'
      });
    }

    // Importar chronology service (opcional)
    try {
      const chronologyService = await import('../src/services/chronology-service.js');

      const chronology = await chronologyService.generateChronology(processData);
      let matrices = null;

      if (includeMatrizes) {
        matrices = await chronologyService.generateMatrizes(processData);
      }

      res.json({
        success: true,
        chronology,
        matrices
      });
    } catch (importError) {
      logger.warn('Chronology service não disponível:', importError.message);
      res.status(503).json({
        success: false,
        error: 'Chronology service não está disponível neste ambiente'
      });
    }

  } catch (error) {
    logger.error('Erro ao gerar cronologia:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /extraction/desktop-path
 * Retorna o caminho da pasta de extrações no Desktop
 */
router.get('/extraction/desktop-path', async (req, res) => {
  try {
    const service = await getDocumentExtractionService();
    const desktopPath = service.getDesktopPath();
    const basePath = path.join(desktopPath, 'ROM-Extractions');

    res.json({
      success: true,
      desktopPath,
      basePath,
      platform: process.platform
    });

  } catch (error) {
    logger.error('Erro ao obter caminho do Desktop:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// DOCUMENTS ROUTES (General documents)
// ============================================================

/**
 * POST /documents/extract
 * Extrai documentos gerais (PDFs, imagens, vídeos, Office, etc.)
 */
router.post('/documents/extract', async (req, res) => {
  try {
    const { files, folderName, projectName, uploadToKB } = req.body;

    // Validações
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Array de arquivos é obrigatório (files)'
      });
    }

    if (!folderName || typeof folderName !== 'string' || folderName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Nome da pasta é obrigatório (folderName)'
      });
    }

    // Verificar se arquivos existem
    for (const filePath of files) {
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: `Arquivo não encontrado: ${filePath}`
        });
      }
    }

    logger.info(`Iniciando extração de ${files.length} documento(s) para pasta: ${folderName}`);

    // Executar extração
    const service = await getDocumentExtractionService();
    const resultado = await service.extractGeneralDocuments({
      files,
      folderName,
      projectName: projectName || 'ROM',
      uploadToKB: uploadToKB !== undefined ? uploadToKB : true,
      generateAllFormats: true
    });

    logger.info(`Extração concluída com sucesso: ${resultado.folder}`);

    res.json({
      success: true,
      message: `${files.length} documento(s) extraído(s) com sucesso`,
      ...resultado
    });

  } catch (error) {
    logger.error('Erro ao extrair documentos gerais:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * POST /documents/create-folder
 * Cria estrutura de pastas customizada para documentos
 */
router.post('/documents/create-folder', async (req, res) => {
  try {
    const { folderName, projectName } = req.body;

    if (!folderName || typeof folderName !== 'string' || folderName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Nome da pasta é obrigatório (folderName)'
      });
    }

    const service = await getDocumentExtractionService();
    const estrutura = await service.createCustomFolderStructure(
      folderName,
      projectName || 'ROM'
    );

    logger.info(`Estrutura de pastas criada: ${estrutura.baseFolder}`);

    res.json({
      success: true,
      message: 'Estrutura de pastas criada com sucesso',
      ...estrutura
    });

  } catch (error) {
    logger.error('Erro ao criar estrutura de pastas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /documents/supported-types
 * Lista todos os tipos de arquivo suportados
 */
router.get('/documents/supported-types', (req, res) => {
  try {
    const tiposSuportados = {
      pdf: {
        extensoes: ['.pdf'],
        descricao: 'Documentos PDF com OCR automático se necessário',
        recursos: ['Extração de texto', 'OCR', 'Análise de conteúdo']
      },
      imagem: {
        extensoes: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'],
        descricao: 'Imagens com OCR e análise visual',
        recursos: ['OCR', 'Análise de imagem', 'Extração de texto']
      },
      video: {
        extensoes: ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv'],
        descricao: 'Vídeos com transcrição automática',
        recursos: ['Transcrição com timestamps', 'Análise de conteúdo', 'Extração de áudio']
      },
      documento: {
        extensoes: ['.docx', '.doc', '.odt', '.rtf'],
        descricao: 'Documentos de texto do Word e similares',
        recursos: ['Extração de texto', 'Preservação de formatação']
      },
      planilha: {
        extensoes: ['.xlsx', '.xls', '.ods', '.csv'],
        descricao: 'Planilhas do Excel e similares',
        recursos: ['Extração de dados', 'Análise de tabelas']
      },
      apresentacao: {
        extensoes: ['.pptx', '.ppt', '.odp'],
        descricao: 'Apresentações do PowerPoint e similares',
        recursos: ['Extração de conteúdo', 'Análise de slides']
      },
      texto: {
        extensoes: ['.txt', '.md', '.json', '.xml', '.html', '.css', '.js'],
        descricao: 'Arquivos de texto simples e código',
        recursos: ['Leitura direta', 'Análise de conteúdo']
      }
    };

    const totalExtensoes = Object.values(tiposSuportados)
      .reduce((acc, tipo) => acc + tipo.extensoes.length, 0);

    res.json({
      success: true,
      message: `Sistema suporta ${totalExtensoes} tipos de arquivo`,
      totalTipos: Object.keys(tiposSuportados).length,
      totalExtensoes,
      tipos: tiposSuportados,
      observacoes: [
        'Suporte para múltiplos documentos sem limite',
        'Processamento automático por tipo de arquivo',
        'Export em JSON e TXT',
        'Upload automático para Knowledge Base',
        'Estrutura de pastas customizável'
      ]
    });

  } catch (error) {
    logger.error('Erro ao listar tipos suportados:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /documents/desktop-path
 * Retorna o caminho da pasta de extrações de documentos gerais no Desktop
 */
router.get('/documents/desktop-path', async (req, res) => {
  try {
    const service = await getDocumentExtractionService();
    const desktopPath = service.getDesktopPath();
    const basePath = path.join(desktopPath, 'ROM-Extractions');

    res.json({
      success: true,
      desktopPath,
      basePath,
      platform: process.platform,
      observacao: 'Todas as extrações são salvas em subpastas customizadas dentro de ROM-Extractions'
    });

  } catch (error) {
    logger.error('Erro ao obter caminho do Desktop:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
