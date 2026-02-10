/**
 * ROM Agent - Serviço de Extração de Documentos Gerais v2.0
 *
 * NOVO PIPELINE: 18 Ficheiros Completos com Análise Profunda
 *
 * Extrai e organiza qualquer tipo de documento:
 * - PDFs (com OCR se necessário)
 * - Imagens (PNG, JPG, etc.)
 * - Vídeos (com transcrição)
 * - Documentos Office (DOCX, XLSX, PPTX)
 * - Arquivos de texto
 *
 * Funcionalidades v2.0:
 * - Pipeline completo de 18 ficheiros estruturados
 * - Análise jurídica profunda com IA
 * - Extração de entidades (partes, valores, datas, leis)
 * - Resumos executivos em múltiplos níveis
 * - Análise de risco e recomendações
 * - Classificação documental automática
 * - Cronologia de eventos
 * - Estratégia de custos (Haiku vs Sonnet)
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { extractTextFromPDF } from '../modules/textract.js';
// OCR é import dinâmico (opcional - pode não estar disponível)
import { uploadToKnowledgeBase } from '../modules/knowledgeBase.js';
import gerador18Ficheiros from './gerador-18-ficheiros.js';
import logger from '../../lib/logger.js';

// Detectar sistema operacional
const IS_MAC = os.platform() === 'darwin';
const IS_WINDOWS = os.platform() === 'win32';
const IS_LINUX = os.platform() === 'linux';

const BASE_EXTRACTION_FOLDER = 'ROM-Extractions-v2';

/**
 * Obter caminho para saída de extrações (cross-platform)
 * Detecta automaticamente o melhor diretório baseado no SO
 */
export function getOutputBasePath() {
  const homeDir = os.homedir();

  // Se definido no .env, usar esse caminho
  if (process.env.OUTPUT_BASE_DIR) {
    return process.env.OUTPUT_BASE_DIR;
  }

  // Windows
  if (IS_WINDOWS) {
    const desktopPath = path.join(homeDir, 'Desktop');
    const documentsPath = path.join(homeDir, 'Documents');

    try {
      if (fsSync.existsSync(desktopPath)) {
        return path.join(desktopPath, BASE_EXTRACTION_FOLDER);
      } else if (fsSync.existsSync(documentsPath)) {
        return path.join(documentsPath, BASE_EXTRACTION_FOLDER);
      }
    } catch (e) {
      // Fallback
    }

    return path.join(homeDir, BASE_EXTRACTION_FOLDER);
  }

  // macOS
  if (IS_MAC) {
    const desktopPath = path.join(homeDir, 'Desktop');
    const documentsPath = path.join(homeDir, 'Documents');

    try {
      if (fsSync.existsSync(desktopPath)) {
        return path.join(desktopPath, BASE_EXTRACTION_FOLDER);
      } else if (fsSync.existsSync(documentsPath)) {
        return path.join(documentsPath, BASE_EXTRACTION_FOLDER);
      }
    } catch (e) {
      // Fallback
    }

    return path.join(homeDir, BASE_EXTRACTION_FOLDER);
  }

  // Linux
  if (IS_LINUX) {
    const desktopPaths = [
      path.join(homeDir, 'Desktop'),
      path.join(homeDir, 'Área de Trabalho'),
      path.join(homeDir, 'Escritorio')
    ];

    for (const desktopPath of desktopPaths) {
      try {
        if (fsSync.existsSync(desktopPath)) {
          return path.join(desktopPath, BASE_EXTRACTION_FOLDER);
        }
      } catch (e) {
        continue;
      }
    }

    const documentsPath = path.join(homeDir, 'Documents');
    try {
      if (fsSync.existsSync(documentsPath)) {
        return path.join(documentsPath, BASE_EXTRACTION_FOLDER);
      }
    } catch (e) {
      // Fallback
    }

    return path.join(homeDir, BASE_EXTRACTION_FOLDER);
  }

  // Fallback genérico
  return path.join(homeDir, BASE_EXTRACTION_FOLDER);
}

/**
 * @deprecated Use getOutputBasePath() instead
 * Mantido para compatibilidade com código antigo
 */
export function getDesktopPath() {
  return getOutputBasePath();
}

/**
 * Estrutura de pastas para documentos gerais:
 *
 * Desktop/
 * └── ROM-Extractions/
 *     └── [Nome-Customizado]/
 *         ├── original/
 *         │   ├── documento1.pdf
 *         │   ├── imagem1.png
 *         │   └── video1.mp4
 *         ├── extracted/
 *         │   ├── documento-completo.json
 *         │   ├── documento-completo.txt
 *         │   ├── resumo.md
 *         │   └── indice.json
 *         ├── ocr/
 *         │   ├── documento1-ocr.txt
 *         │   └── relatorio-ocr.json
 *         ├── images/
 *         │   ├── imagem1.png
 *         │   ├── imagem1-analise.json
 *         │   └── relatorio-imagens.json
 *         ├── videos/
 *         │   ├── video1.mp4
 *         │   ├── video1-transcricao.txt
 *         │   ├── video1-transcricao.json (com timestamps)
 *         │   └── relatorio-videos.json
 *         └── metadata.json
 */

/**
 * Criar estrutura de pastas com nome customizado
 */
export async function createCustomFolderStructure(folderName, projectName = 'ROM') {
  try {
    const desktopPath = getDesktopPath();
    const baseFolder = path.join(desktopPath, BASE_EXTRACTION_FOLDER);

    // Sanitizar nome da pasta (remover caracteres inválidos)
    const safeFolderName = folderName.replace(/[<>:"/\\|?*]/g, '-');
    const customFolder = path.join(baseFolder, safeFolderName);

    // Criar pastas
    const folders = [
      customFolder,
      path.join(customFolder, 'original'),
      path.join(customFolder, 'extracted'),
      path.join(customFolder, 'ocr'),
      path.join(customFolder, 'images'),
      path.join(customFolder, 'videos')
    ];

    for (const folder of folders) {
      await fs.mkdir(folder, { recursive: true });
    }

    // Criar metadata inicial
    const metadata = {
      folderName: safeFolderName,
      projectName,
      createdAt: new Date().toISOString(),
      type: 'document-extraction',
      status: 'created',
      files: [],
      extractionLog: []
    };

    const metadataPath = path.join(customFolder, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

    return {
      success: true,
      customFolder,
      folders,
      metadata: metadataPath
    };

  } catch (error) {
    throw new Error(`Erro ao criar estrutura de pastas: ${error.message}`);
  }
}

/**
 * Detectar tipo de arquivo
 */
function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  const types = {
    // Documentos
    '.pdf': 'pdf',
    '.doc': 'document',
    '.docx': 'document',
    '.odt': 'document',

    // Imagens
    '.jpg': 'image',
    '.jpeg': 'image',
    '.png': 'image',
    '.gif': 'image',
    '.bmp': 'image',
    '.tiff': 'image',
    '.webp': 'image',

    // Vídeos
    '.mp4': 'video',
    '.avi': 'video',
    '.mov': 'video',
    '.wmv': 'video',
    '.flv': 'video',
    '.webm': 'video',

    // Áudio
    '.mp3': 'audio',
    '.wav': 'audio',
    '.m4a': 'audio',

    // Planilhas
    '.xls': 'spreadsheet',
    '.xlsx': 'spreadsheet',
    '.csv': 'spreadsheet',

    // Apresentações
    '.ppt': 'presentation',
    '.pptx': 'presentation',

    // Texto
    '.txt': 'text',
    '.md': 'text',
    '.rtf': 'text'
  };

  return types[ext] || 'unknown';
}

/**
 * Processar arquivo PDF
 */
async function processPDF(filePath, outputFolder) {
  try {
    const result = {
      type: 'pdf',
      success: false,
      text: '',
      pages: 0,
      ocrNeeded: false,
      warnings: [],
      errors: []
    };

    // Tentar extração direta de texto
    try {
      const textResult = await extractTextFromPDF(filePath);
      result.text = textResult.text || '';
      result.pages = textResult.pages || 0;

      // Se não extraiu texto, precisa de OCR
      if (!result.text || result.text.trim().length < 50) {
        result.ocrNeeded = true;
        result.warnings.push('PDF sem texto selecionável - OCR necessário');

        // Executar OCR (import dinâmico)
        try {
          const { smartOCR } = await import('./ocr-service.js');
          const ocrResult = await smartOCR(filePath, outputFolder);
          result.text = ocrResult.fullText || '';
          result.ocrApplied = true;
          result.ocrConfidence = ocrResult.averageConfidence;
        } catch (importError) {
          result.warnings.push('OCR service não disponível - dependências AWS Textract não instaladas');
        }
      }

      result.success = true;
    } catch (error) {
      result.errors.push(`Erro ao processar PDF: ${error.message}`);
    }

    return result;
  } catch (error) {
    throw new Error(`Erro ao processar PDF: ${error.message}`);
  }
}

/**
 * Processar imagem
 */
async function processImage(filePath, outputFolder) {
  try {
    const result = {
      type: 'image',
      success: false,
      analysis: null,
      ocr: null,
      warnings: [],
      errors: []
    };

    // OCR na imagem (import dinâmico)
    try {
      const { smartOCR } = await import('./ocr-service.js');
      const ocrResult = await smartOCR(filePath, outputFolder);
      result.ocr = {
        text: ocrResult.fullText || '',
        confidence: ocrResult.averageConfidence
      };
      result.success = true;
    } catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND') {
        result.warnings.push('OCR service não disponível - dependências AWS Textract não instaladas');
        result.success = true; // Não é um erro crítico
      } else {
        result.errors.push(`Erro no OCR da imagem: ${error.message}`);
      }
    }

    // Análise da imagem (placeholder para integração futura com Claude Vision ou AWS Rekognition)
    result.analysis = {
      description: 'Análise de imagem pendente - integrar com Claude Vision ou AWS Rekognition',
      labels: [],
      faces: 0,
      text: result.ocr?.text || ''
    };

    return result;
  } catch (error) {
    throw new Error(`Erro ao processar imagem: ${error.message}`);
  }
}

/**
 * Processar vídeo
 * Placeholder para integração com AWS Transcribe
 */
async function processVideo(filePath, outputFolder) {
  try {
    const result = {
      type: 'video',
      success: false,
      transcription: '',
      timestamps: [],
      duration: 0,
      warnings: [],
      errors: []
    };

    // Placeholder - integrar com AWS Transcribe
    result.warnings.push('Transcrição de vídeo pendente - integrar com AWS Transcribe');
    result.transcription = '[Transcrição automática será implementada com AWS Transcribe]';
    result.timestamps = [
      { time: '00:00:00', text: 'Início do vídeo' },
      { time: '00:00:05', text: '[Conteúdo será transcrito automaticamente]' }
    ];

    // Salvar transcrição
    const fileName = path.basename(filePath, path.extname(filePath));
    const transcriptionPath = path.join(outputFolder, `${fileName}-transcricao.txt`);
    const transcriptionJSON = path.join(outputFolder, `${fileName}-transcricao.json`);

    await fs.writeFile(transcriptionPath, result.transcription, 'utf-8');
    await fs.writeFile(transcriptionJSON, JSON.stringify({
      fileName,
      transcription: result.transcription,
      timestamps: result.timestamps,
      duration: result.duration
    }, null, 2), 'utf-8');

    result.success = true;
    return result;

  } catch (error) {
    throw new Error(`Erro ao processar vídeo: ${error.message}`);
  }
}

/**
 * Processar documento Word (DOCX)
 */
async function processWordDocument(filePath) {
  try {
    const result = {
      type: 'document',
      success: false,
      text: '',
      lines: 0,
      words: 0,
      format: 'docx',
      warnings: [],
      errors: []
    };

    // Importar mammoth para extração de texto de DOCX
    const mammoth = await import('mammoth');

    // Extrair texto do DOCX
    const buffer = await fs.readFile(filePath);
    const extractionResult = await mammoth.extractRawText({ buffer });

    result.text = extractionResult.value || '';
    result.lines = result.text.split('\n').length;
    result.words = result.text.split(/\s+/).filter(w => w.length > 0).length;

    // Adicionar warnings do mammoth (se houver problemas de conversão)
    if (extractionResult.messages && extractionResult.messages.length > 0) {
      result.warnings = extractionResult.messages.map(m => m.message);
    }

    result.success = true;

    return result;
  } catch (error) {
    throw new Error(`Erro ao processar documento Word: ${error.message}`);
  }
}

/**
 * Processar documento de texto
 */
async function processTextDocument(filePath) {
  try {
    const result = {
      type: 'text',
      success: false,
      text: '',
      lines: 0,
      words: 0,
      errors: []
    };

    const text = await fs.readFile(filePath, 'utf-8');
    result.text = text;
    result.lines = text.split('\n').length;
    result.words = text.split(/\s+/).filter(w => w.length > 0).length;
    result.success = true;

    return result;
  } catch (error) {
    throw new Error(`Erro ao processar documento de texto: ${error.message}`);
  }
}

/**
 * Extrair documentos gerais
 */
export async function extractGeneralDocuments(options = {}) {
  const {
    files = [],          // Array de caminhos de arquivos
    folderName,          // Nome customizado da pasta
    projectName = 'ROM',
    uploadToKB = true,
    generateAllFormats = true
  } = options;

  if (!folderName) {
    throw new Error('Nome da pasta (folderName) é obrigatório');
  }

  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('Pelo menos um arquivo deve ser fornecido');
  }

  const extractionLog = {
    startTime: new Date().toISOString(),
    folderName,
    projectName,
    totalFiles: files.length,
    processedFiles: 0,
    steps: [],
    warnings: [],
    errors: [],
    outputs: {}
  };

  try {
    // Passo 1: Criar estrutura de pastas
    extractionLog.steps.push({ step: 1, action: 'Criando estrutura de pastas', status: 'success' });
    const structure = await createCustomFolderStructure(folderName, projectName);
    const { customFolder } = structure;

    const originalFolder = path.join(customFolder, 'original');
    const extractedFolder = path.join(customFolder, 'extracted');
    const ocrFolder = path.join(customFolder, 'ocr');
    const imagesFolder = path.join(customFolder, 'images');
    const videosFolder = path.join(customFolder, 'videos');

    // Passo 2: Copiar arquivos originais e processar
    extractionLog.steps.push({ step: 2, action: 'Copiando e processando arquivos', status: 'in_progress' });

    const processedDocuments = [];
    const allText = [];

    for (const filePath of files) {
      try {
        const fileName = path.basename(filePath);
        const fileType = getFileType(filePath);
        const destPath = path.join(originalFolder, fileName);

        // Copiar arquivo original
        await fs.copyFile(filePath, destPath);

        let processResult = null;

        // Processar baseado no tipo
        switch (fileType) {
          case 'pdf':
            processResult = await processPDF(filePath, ocrFolder);
            if (processResult.text) allText.push(processResult.text);
            break;

          case 'document':
            processResult = await processWordDocument(filePath);
            if (processResult.text) allText.push(processResult.text);
            break;

          case 'image':
            processResult = await processImage(filePath, imagesFolder);
            if (processResult.ocr?.text) allText.push(processResult.ocr.text);
            break;

          case 'video':
            processResult = await processVideo(filePath, videosFolder);
            if (processResult.transcription) allText.push(processResult.transcription);
            break;

          case 'text':
            processResult = await processTextDocument(filePath);
            if (processResult.text) allText.push(processResult.text);
            break;

          default:
            extractionLog.warnings.push(`Tipo de arquivo não suportado: ${fileName} (${fileType})`);
            processResult = { type: fileType, success: false, message: 'Tipo não suportado' };
        }

        processedDocuments.push({
          fileName,
          fileType,
          originalPath: destPath,
          processResult
        });

        extractionLog.processedFiles++;

      } catch (error) {
        extractionLog.errors.push({
          file: path.basename(filePath),
          error: error.message
        });
      }
    }

    extractionLog.steps[extractionLog.steps.length - 1].status = 'success';

    // Passo 3: Gerar documento completo
    extractionLog.steps.push({ step: 3, action: 'Gerando documento completo', status: 'in_progress' });

    const documentoCompleto = {
      folderName,
      projectName,
      createdAt: new Date().toISOString(),
      totalFiles: files.length,
      processedFiles: extractionLog.processedFiles,
      documents: processedDocuments,
      fullText: allText.join('\n\n---\n\n'),
      summary: {
        totalDocuments: processedDocuments.length,
        byType: {}
      }
    };

    // Contar por tipo
    processedDocuments.forEach(doc => {
      if (!documentoCompleto.summary.byType[doc.fileType]) {
        documentoCompleto.summary.byType[doc.fileType] = 0;
      }
      documentoCompleto.summary.byType[doc.fileType]++;
    });

    // Salvar JSON
    const jsonPath = path.join(extractedFolder, 'documento-completo.json');
    await fs.writeFile(jsonPath, JSON.stringify(documentoCompleto, null, 2), 'utf-8');
    extractionLog.outputs.documentoCompletoJSON = jsonPath;

    // Salvar TXT
    const txtPath = path.join(extractedFolder, 'documento-completo.txt');
    await fs.writeFile(txtPath, documentoCompleto.fullText, 'utf-8');
    extractionLog.outputs.documentoCompletoTXT = txtPath;

    extractionLog.steps[extractionLog.steps.length - 1].status = 'success';

    // Passo 4: Gerar índice
    extractionLog.steps.push({ step: 4, action: 'Gerando índice', status: 'in_progress' });

    const indice = {
      folderName,
      totalFiles: processedDocuments.length,
      files: processedDocuments.map((doc, index) => ({
        index: index + 1,
        fileName: doc.fileName,
        type: doc.fileType,
        processed: doc.processResult?.success || false
      }))
    };

    const indicePath = path.join(extractedFolder, 'indice.json');
    await fs.writeFile(indicePath, JSON.stringify(indice, null, 2), 'utf-8');
    extractionLog.outputs.indice = indicePath;

    extractionLog.steps[extractionLog.steps.length - 1].status = 'success';

    // Passo 5: Gerar resumo
    extractionLog.steps.push({ step: 5, action: 'Gerando resumo executivo', status: 'in_progress' });

    const resumoMD = `# Resumo Executivo - ${folderName}

## Informações Gerais

- **Projeto**: ${projectName}
- **Pasta**: ${folderName}
- **Data de Extração**: ${new Date().toISOString()}
- **Total de Arquivos**: ${processedDocuments.length}

## Arquivos Processados

${processedDocuments.map((doc, i) => `
### ${i + 1}. ${doc.fileName}

- **Tipo**: ${doc.fileType}
- **Status**: ${doc.processResult?.success ? '✅ Sucesso' : '❌ Falhou'}
${doc.processResult?.warnings?.length > 0 ? `- **Avisos**: ${doc.processResult.warnings.join(', ')}` : ''}
`).join('\n')}

## Estatísticas

${Object.entries(documentoCompleto.summary.byType).map(([type, count]) =>
  `- **${type}**: ${count} arquivo(s)`
).join('\n')}

## Texto Extraído

Total de caracteres: ${documentoCompleto.fullText.length}

---
*Gerado automaticamente pelo ROM Agent*
`;

    const resumoPath = path.join(extractedFolder, 'resumo.md');
    await fs.writeFile(resumoPath, resumoMD, 'utf-8');
    extractionLog.outputs.resumo = resumoPath;

    extractionLog.steps[extractionLog.steps.length - 1].status = 'success';

    // Passo 6: Upload para KB (se solicitado)
    if (uploadToKB) {
      extractionLog.steps.push({ step: 6, action: 'Upload para Knowledge Base', status: 'in_progress' });

      try {
        // Upload do documento completo JSON
        await uploadToKnowledgeBase({
          projectName,
          fileName: `${folderName}-completo.json`,
          content: JSON.stringify(documentoCompleto, null, 2),
          type: 'document-extraction'
        });

        // Upload do documento completo TXT
        await uploadToKnowledgeBase({
          projectName,
          fileName: `${folderName}-completo.txt`,
          content: documentoCompleto.fullText,
          type: 'document-extraction-text'
        });

        extractionLog.steps[extractionLog.steps.length - 1].status = 'success';
      } catch (error) {
        extractionLog.warnings.push(`Upload para KB falhou: ${error.message}`);
        extractionLog.steps[extractionLog.steps.length - 1].status = 'warning';
      }
    }

    // Passo 7: Atualizar metadata
    const metadata = JSON.parse(await fs.readFile(path.join(customFolder, 'metadata.json'), 'utf-8'));
    metadata.status = 'completed';
    metadata.completedAt = new Date().toISOString();
    metadata.files = processedDocuments.map(d => d.fileName);
    metadata.extractionLog = extractionLog;

    await fs.writeFile(
      path.join(customFolder, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    // Finalizar log
    extractionLog.endTime = new Date().toISOString();
    extractionLog.duration = new Date(extractionLog.endTime) - new Date(extractionLog.startTime);

    return {
      success: true,
      customFolder,
      outputs: extractionLog.outputs,
      log: extractionLog,
      documentoCompleto
    };

  } catch (error) {
    extractionLog.errors.push({
      critical: true,
      error: error.message,
      stack: error.stack
    });
    extractionLog.endTime = new Date().toISOString();

    throw error;
  }
}

/**
 * NOVO: Extrair documento com pipeline de 18 ficheiros completos
 *
 * Esta é a versão v2.0 que gera análise profunda
 */
export async function extractDocumentWithFullAnalysis(options = {}) {
  const {
    filePath,          // Caminho do arquivo PDF
    outputFolderName,  // Nome da pasta de saída
    projectName = 'ROM',
    uploadToKB = false,
    useHaikuForExtraction = true,  // Usar Haiku para extração inicial (barato)
    useSonnetForAnalysis = true     // Usar Sonnet para análises (premium)
  } = options;

  if (!filePath) {
    throw new Error('Caminho do arquivo (filePath) é obrigatório');
  }

  if (!outputFolderName) {
    throw new Error('Nome da pasta de saída (outputFolderName) é obrigatório');
  }

  const inicioGeral = Date.now();

  try {
    logger.info('🚀 Iniciando extração com pipeline de 18 ficheiros', {
      arquivo: filePath,
      pastaOutput: outputFolderName
    });

    // PASSO 1: Extrair texto do PDF
    logger.info('📄 Extraindo texto do PDF...');
    const extractionResult = await extractTextFromPDF(filePath);

    if (!extractionResult || !extractionResult.text) {
      throw new Error('Falha ao extrair texto do PDF');
    }

    const textoOriginal = extractionResult.text;
    logger.info('✅ Texto extraído', {
      caracteres: textoOriginal.length,
      paginas: extractionResult.pages || 0
    });

    // PASSO 2: Definir pasta de saída (detecta automaticamente o SO)
    const outputBasePath = getOutputBasePath();
    const pastaBase = path.join(outputBasePath, outputFolderName);

    // Garantir que pasta base existe
    await fs.mkdir(pastaBase, { recursive: true });

    // PASSO 3: Gerar 18 ficheiros completos
    logger.info('🎯 Gerando 18 ficheiros com análise profunda...');

    const documentId = `doc-${Date.now()}`;
    const resultado = await gerador18Ficheiros.gerar18FicheirosCompletos(textoOriginal, {
      pastaBase,
      documentId,
      nomeDocumento: path.basename(filePath, path.extname(filePath)),
      modeloOverride: null  // Usar configuração padrão de modelos
    });

    // PASSO 4: Upload para KB (opcional)
    if (uploadToKB && resultado.metadata) {
      logger.info('☁️ Fazendo upload para Knowledge Base...');

      try {
        // Upload do resumo executivo
        const resumoPath = path.join(resultado.estrutura.resumos, '03_resumo_executivo.md');
        const resumoConteudo = await fs.readFile(resumoPath, 'utf-8');

        await uploadToKnowledgeBase({
          projectName,
          fileName: `${outputFolderName}-resumo-executivo.md`,
          content: resumoConteudo,
          type: 'resumo-executivo-v2'
        });

        // Upload do texto normalizado
        const textoNormalizadoPath = path.join(resultado.estrutura.nucleo, '02_texto_normalizado.txt');
        const textoNormalizado = await fs.readFile(textoNormalizadoPath, 'utf-8');

        await uploadToKnowledgeBase({
          projectName,
          fileName: `${outputFolderName}-texto-completo.txt`,
          content: textoNormalizado,
          type: 'texto-completo-v2'
        });

        logger.info('✅ Upload para KB concluído');
      } catch (uploadError) {
        logger.warn('⚠️ Falha no upload para KB', { erro: uploadError.message });
      }
    }

    const duracaoTotal = Math.round((Date.now() - inicioGeral) / 1000);

    logger.info('🎉 Extração completa finalizada!', {
      arquivosGerados: resultado.totalArquivos,
      pastaBase: resultado.pastaBase,
      duracaoSegundos: duracaoTotal
    });

    return {
      success: true,
      versao: '2.0',
      pipeline: '18_ficheiros_completos',

      // Caminhos
      pastaBase: resultado.pastaBase,
      estrutura: resultado.estrutura,

      // Estatísticas
      totalArquivos: resultado.totalArquivos,
      duracaoSegundos: duracaoTotal,

      // Metadados
      metadata: resultado.metadata,
      estatisticas: resultado.estatisticas,

      // Log completo
      log: resultado.log,

      // Atalhos para arquivos principais
      arquivosPrincipais: {
        resumoExecutivo: path.join(resultado.estrutura.resumos, '03_resumo_executivo.md'),
        resumoUltraCurto: path.join(resultado.estrutura.resumos, '04_resumo_ultra_curto.md'),
        pontosCriticos: path.join(resultado.estrutura.resumos, '05_pontos_criticos.md'),
        analiseCompleta: path.join(resultado.estrutura.analises, '06_analise_completa.md'),
        analiseRisco: path.join(resultado.estrutura.juridico, '15_analise_risco.md'),
        indiceNavegacao: path.join(resultado.estrutura.metadados, '18_indice_navegacao.md')
      }
    };

  } catch (error) {
    logger.error('❌ Erro na extração com pipeline de 18 ficheiros', {
      erro: error.message,
      stack: error.stack
    });

    throw new Error(`Erro na extração: ${error.message}`);
  }
}

export default {
  getDesktopPath,  // deprecated
  getOutputBasePath,  // NOVO: v2.0 - cross-platform
  createCustomFolderStructure,
  extractGeneralDocuments,
  extractDocumentWithFullAnalysis  // NOVO: v2.0
};
