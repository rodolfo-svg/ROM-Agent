/**
 * ROM Agent - Servico de OCR (Optical Character Recognition)
 * Extracao de texto de imagens e PDFs sem texto selecionavel
 *
 * REFATORADO: Agora usa Tesseract.js em vez de AWS Textract
 *
 * Funcionalidades:
 * - OCR de PDFs sem texto usando Tesseract.js
 * - OCR de imagens individuais (PNG, JPG, etc.)
 * - Processamento pagina por pagina com worker pool
 * - Pre-processamento de imagens com Sharp
 * - Relatorios de confianca e qualidade
 * - Deteccao de falhas e warnings
 * - Exportacao em multiplos formatos
 */

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { TesseractOCRService, getTesseractOCRService } from './tesseract-ocr-service.js';

// Instancia global do servico de OCR
let ocrService = null;

/**
 * Obter ou criar instancia do servico de OCR
 * @param {number} workerCount - Numero de workers
 * @returns {TesseractOCRService}
 */
function getOCRService(workerCount = 4) {
  if (!ocrService) {
    ocrService = new TesseractOCRService(workerCount);
  }
  return ocrService;
}

/**
 * Realizar OCR em um PDF completo
 *
 * @param {string} pdfPath - Caminho do PDF
 * @param {string} outputFolder - Pasta para salvar resultados OCR
 * @param {Object} options - Opcoes de processamento
 * @returns {Object} - Resultado do OCR com texto extraido e metadados
 */
export async function performOCROnPDF(pdfPath, outputFolder, options = {}) {
  const {
    processAllPages = true,
    maxPages = 100,
    confidenceThreshold = 70,
    saveIndividualPages = true,
    workerCount = 4
  } = options;

  // Criar pasta de saida se nao existir
  await fs.mkdir(outputFolder, { recursive: true });

  // Obter servico de OCR
  const service = getOCRService(workerCount);
  await service.initialize({ language: 'por', verbose: true });

  // Executar OCR no PDF
  const result = await service.performOCROnPDF(pdfPath, outputFolder, {
    maxPages: processAllPages ? maxPages : 10,
    confidenceThreshold,
    saveIndividualPages
  });

  return result;
}

/**
 * Realizar OCR em uma imagem individual
 *
 * @param {string|Buffer} imagePath - Caminho da imagem ou buffer
 * @param {number} pageNumber - Numero da pagina (para tracking)
 * @param {Object} options - Opcoes
 * @returns {Object} - Resultado do OCR
 */
export async function performOCROnImage(imagePath, pageNumber = 1, options = {}) {
  const {
    isBase64 = false,
    confidenceThreshold = 70,
    analyzeLayout = false,
    workerCount = 4
  } = options;

  const result = {
    success: false,
    pageNumber,
    text: '',
    words: [],
    lines: [],
    blocks: [],
    wordCount: 0,
    averageConfidence: 0,
    lowConfidenceWords: [],
    error: null
  };

  try {
    let imageBytes;

    if (isBase64) {
      // Converter base64 para buffer
      imageBytes = Buffer.from(imagePath, 'base64');
    } else if (Buffer.isBuffer(imagePath)) {
      imageBytes = imagePath;
    } else {
      // Ler arquivo de imagem
      imageBytes = await fs.readFile(imagePath);
    }

    // Obter servico de OCR
    const service = getOCRService(workerCount);
    await service.initialize({ language: 'por', verbose: false });

    // Executar OCR
    const ocrResult = await service.performOCR(imageBytes, {
      confidenceThreshold,
      preprocess: true,
      preprocessOptions: {
        grayscale: true,
        normalize: true,
        sharpen: true
      }
    });

    if (!ocrResult.success) {
      result.error = ocrResult.error || 'Falha no OCR';
      return result;
    }

    // Mapear resultado para formato esperado
    result.success = true;
    result.text = ocrResult.text;
    result.words = ocrResult.words;
    result.lines = ocrResult.lines;
    result.blocks = ocrResult.blocks;
    result.wordCount = ocrResult.wordCount;
    result.averageConfidence = ocrResult.confidence;
    result.lowConfidenceWords = ocrResult.lowConfidenceWords || [];

    return result;

  } catch (error) {
    result.error = error.message;
    result.success = false;

    console.error(`Erro no OCR da pagina ${pageNumber}:`, error.message);

    return result;
  }
}

/**
 * Gerar relatorio completo de OCR
 *
 * @param {Object} ocrResult - Resultado do OCR
 * @param {string} outputFolder - Pasta de saida
 */
async function generateOCRReport(ocrResult, outputFolder) {
  const report = {
    geradoEm: new Date().toISOString(),
    motor: 'Tesseract.js',
    resumo: {
      sucesso: ocrResult.success,
      totalPaginas: ocrResult.totalPages,
      paginasProcessadas: ocrResult.processedPages,
      paginasFalhas: ocrResult.failedPages.length,
      taxaSucesso: `${((ocrResult.processedPages / ocrResult.totalPages) * 100).toFixed(1)}%`,
      totalPalavras: ocrResult.totalWords,
      confianciaMedia: `${ocrResult.averageConfidence.toFixed(1)}%`,
      tempoProcessamento: `${(ocrResult.processingTime / 1000).toFixed(1)}s`
    },
    detalhes: {
      pdfOriginal: ocrResult.pdfPath,
      tamanhoArquivo: ocrResult.fileSizeBytes ? `${(ocrResult.fileSizeBytes / 1024 / 1024).toFixed(2)} MB` : 'N/A'
    },
    paginas: ocrResult.pages.map(page => ({
      numero: page.pageNumber,
      palavras: page.wordCount,
      confianca: `${page.averageConfidence?.toFixed(1) || page.confidence?.toFixed(1) || 0}%`,
      palavrasBaixaConfianca: page.lowConfidenceWords?.length || page.lowConfidenceCount || 0
    })),
    falhas: ocrResult.failedPages,
    avisos: ocrResult.warnings,
    erros: ocrResult.errors
  };

  // Salvar relatorio JSON
  await fs.writeFile(
    path.join(outputFolder, 'relatorio-ocr.json'),
    JSON.stringify(report, null, 2),
    'utf-8'
  );

  // Salvar relatorio Markdown
  const markdownReport = generateOCRReportMarkdown(report);
  await fs.writeFile(
    path.join(outputFolder, 'relatorio-ocr.md'),
    markdownReport,
    'utf-8'
  );

  // Salvar texto completo extraido
  await fs.writeFile(
    path.join(outputFolder, 'texto-completo-ocr.txt'),
    ocrResult.fullText,
    'utf-8'
  );

  console.log(`Relatorio OCR salvo em: ${outputFolder}`);
}

/**
 * Gerar relatorio OCR em Markdown
 */
function generateOCRReportMarkdown(report) {
  return `# Relatorio de OCR

**Gerado em:** ${new Date(report.geradoEm).toLocaleString('pt-BR')}
**Motor:** ${report.motor}

## Resumo

- **Status:** ${report.resumo.sucesso ? 'Sucesso' : 'Falha'}
- **Total de Paginas:** ${report.resumo.totalPaginas}
- **Paginas Processadas:** ${report.resumo.paginasProcessadas}
- **Taxa de Sucesso:** ${report.resumo.taxaSucesso}
- **Total de Palavras:** ${report.resumo.totalPalavras}
- **Confianca Media:** ${report.resumo.confianciaMedia}
- **Tempo de Processamento:** ${report.resumo.tempoProcessamento}

## Detalhes do Arquivo

- **PDF Original:** \`${report.detalhes.pdfOriginal}\`
- **Tamanho:** ${report.detalhes.tamanhoArquivo}

## Resultados por Pagina

| Pagina | Palavras | Confianca | Palavras Baixa Confianca |
|--------|----------|-----------|-------------------------|
${report.paginas.map(p =>
  `| ${p.numero} | ${p.palavras} | ${p.confianca} | ${p.palavrasBaixaConfianca} |`
).join('\n')}

${report.falhas.length > 0 ? `
## Paginas com Falha

${report.falhas.map(f => `- **Pagina ${f.page}:** ${f.error}`).join('\n')}
` : ''}

${report.avisos.length > 0 ? `
## Avisos

${report.avisos.map(a => `- ${a}`).join('\n')}
` : ''}

${report.erros.length > 0 ? `
## Erros

${report.erros.map(e => `- ${e}`).join('\n')}
` : ''}

---

**Processado por:** ROM Agent - Tesseract.js OCR Service
`;
}

/**
 * Verificar se um PDF precisa de OCR
 *
 * @param {string} pdfPath - Caminho do PDF
 * @returns {Promise<boolean>} - true se precisa de OCR
 */
export async function needsOCR(pdfPath) {
  try {
    // Tentar extrair texto do PDF
    const { extractTextFromPDF } = await import('../modules/textract.js');
    const result = await extractTextFromPDF(pdfPath);

    if (!result.success || !result.text || result.text.trim().length < 100) {
      // PDF sem texto ou com muito pouco texto = precisa OCR
      return true;
    }

    return false;

  } catch (error) {
    console.error('Erro ao verificar necessidade de OCR:', error);
    // Em caso de erro, assumir que precisa de OCR
    return true;
  }
}

/**
 * Realizar OCR inteligente (detecta automaticamente se e necessario)
 *
 * @param {string} pdfPath - Caminho do PDF
 * @param {string} outputFolder - Pasta de saida
 * @param {Object} options - Opcoes
 * @returns {Object} - Resultado
 */
export async function smartOCR(pdfPath, outputFolder, options = {}) {
  const result = {
    ocrNeeded: false,
    ocrPerformed: false,
    text: '',
    source: 'unknown',
    details: {}
  };

  try {
    // Verificar se precisa de OCR
    result.ocrNeeded = await needsOCR(pdfPath);

    if (result.ocrNeeded) {
      console.log('PDF sem texto detectado - Executando OCR com Tesseract.js...');
      const ocrResult = await performOCROnPDF(pdfPath, outputFolder, options);

      result.ocrPerformed = true;
      result.text = ocrResult.fullText;
      result.source = 'ocr-tesseract';
      result.details = ocrResult;

    } else {
      console.log('PDF com texto detectado - Usando extracao direta...');
      const { extractTextFromPDF } = await import('../modules/textract.js');
      const extractResult = await extractTextFromPDF(pdfPath);

      result.ocrPerformed = false;
      result.text = extractResult.text || '';
      result.source = 'direct';
      result.details = extractResult;
    }

    return result;

  } catch (error) {
    console.error('Erro no smartOCR:', error);
    return {
      ...result,
      error: error.message
    };
  }
}

/**
 * Funcao de conveniencia para OCR (compatibilidade com extraction-service)
 * @param {string} pdfPath - Caminho do PDF
 * @param {string} outputFolder - Pasta de saida
 * @param {Object} options - Opcoes
 * @returns {Promise<Object>} - Resultado do OCR
 */
export async function performOCR(pdfPath, outputFolder, options = {}) {
  return performOCROnPDF(pdfPath, outputFolder, options);
}

/**
 * Encerra o servico de OCR e libera recursos
 */
export async function terminateOCRService() {
  if (ocrService) {
    await ocrService.terminate();
    ocrService = null;
  }
}

/**
 * Obtem metricas de performance do servico de OCR
 * @returns {Object} - Metricas
 */
export function getOCRMetrics() {
  if (ocrService) {
    return ocrService.getMetrics();
  }
  return {
    totalProcessed: 0,
    totalTime: 0,
    averageTime: 0,
    errors: 0,
    workersAtivos: 0,
    inicializado: false
  };
}

export default {
  performOCROnPDF,
  performOCROnImage,
  needsOCR,
  smartOCR,
  performOCR,
  terminateOCRService,
  getOCRMetrics
};
