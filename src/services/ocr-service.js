/**
 * ROM Agent - Serviço de OCR (Optical Character Recognition)
 * Extração de texto de imagens e PDFs sem texto selecionável
 *
 * Funcionalidades:
 * - OCR de PDFs sem texto usando AWS Textract
 * - OCR de imagens individuais (PNG, JPG, etc.)
 * - Processamento página por página
 * - Relatórios de confiança e qualidade
 * - Detecção de falhas e warnings
 * - Exportação em múltiplos formatos
 */

import fs from 'fs/promises';
import path from 'path';
import { TextractClient, DetectDocumentTextCommand, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';
import { fromEnv } from '@aws-sdk/credential-providers';
import sharp from 'sharp';
import pdf2pic from 'pdf2pic';

// Cliente AWS Textract
const textractClient = new TextractClient({
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: fromEnv()
});

// Configuração de conversão PDF para imagem
const PDF_TO_IMAGE_OPTIONS = {
  density: 300,       // DPI - qualidade da imagem
  saveFilename: 'page',
  savePath: './temp',
  format: 'png',
  width: 2480,        // A4 em 300 DPI
  height: 3508
};

/**
 * Realizar OCR em um PDF completo
 *
 * @param {string} pdfPath - Caminho do PDF
 * @param {string} outputFolder - Pasta para salvar resultados OCR
 * @param {Object} options - Opções de processamento
 * @returns {Object} - Resultado do OCR com texto extraído e metadados
 */
export async function performOCROnPDF(pdfPath, outputFolder, options = {}) {
  const {
    processAllPages = true,
    maxPages = 100,
    confidenceThreshold = 70,
    saveIndividualPages = true
  } = options;

  const ocrResult = {
    success: false,
    pdfPath,
    totalPages: 0,
    processedPages: 0,
    failedPages: [],
    warnings: [],
    errors: [],
    pages: [],
    fullText: '',
    averageConfidence: 0,
    totalWords: 0,
    processingTime: 0
  };

  const startTime = Date.now();

  try {
    // Criar pasta temporária para imagens
    const tempFolder = path.join(outputFolder, 'temp-images');
    await fs.mkdir(tempFolder, { recursive: true });

    // Converter PDF para imagens
    const converter = pdf2pic({
      ...PDF_TO_IMAGE_OPTIONS,
      savePath: tempFolder
    });

    // Detectar número de páginas
    const pdfStats = await fs.stat(pdfPath);
    ocrResult.fileSizeBytes = pdfStats.size;

    console.log(`📄 Iniciando OCR do PDF: ${path.basename(pdfPath)}`);

    // Processar páginas
    let pageNumber = 1;
    let allPagesText = [];

    while (processAllPages || pageNumber <= maxPages) {
      try {
        console.log(`  📃 Processando página ${pageNumber}...`);

        // Converter página para imagem
        const imageResult = await converter(pageNumber, { responseType: 'base64' });

        if (!imageResult || !imageResult.base64) {
          // Fim do documento
          break;
        }

        ocrResult.totalPages = pageNumber;

        // Realizar OCR na imagem usando AWS Textract
        const ocrPageResult = await performOCROnImage(
          imageResult.base64,
          pageNumber,
          { isBase64: true, confidenceThreshold }
        );

        if (ocrPageResult.success) {
          ocrResult.pages.push(ocrPageResult);
          allPagesText.push(ocrPageResult.text);
          ocrResult.processedPages++;
          ocrResult.totalWords += ocrPageResult.wordCount;

          // Salvar resultado individual da página
          if (saveIndividualPages) {
            const pageFileName = `pagina-${String(pageNumber).padStart(3, '0')}-ocr.json`;
            await fs.writeFile(
              path.join(outputFolder, pageFileName),
              JSON.stringify(ocrPageResult, null, 2),
              'utf-8'
            );

            // Salvar também texto puro
            const textFileName = `pagina-${String(pageNumber).padStart(3, '0')}-ocr.txt`;
            await fs.writeFile(
              path.join(outputFolder, textFileName),
              ocrPageResult.text,
              'utf-8'
            );
          }

          console.log(`    ✅ Página ${pageNumber}: ${ocrPageResult.wordCount} palavras, confiança ${ocrPageResult.averageConfidence.toFixed(1)}%`);

        } else {
          ocrResult.failedPages.push({
            page: pageNumber,
            error: ocrPageResult.error
          });
          ocrResult.errors.push(`Página ${pageNumber}: ${ocrPageResult.error}`);
          console.log(`    ❌ Falha na página ${pageNumber}: ${ocrPageResult.error}`);
        }

        pageNumber++;

      } catch (pageError) {
        if (pageError.message.includes('not found') || pageError.message.includes('Invalid page')) {
          // Fim do documento
          break;
        }

        ocrResult.failedPages.push({
          page: pageNumber,
          error: pageError.message
        });
        ocrResult.errors.push(`Erro na página ${pageNumber}: ${pageError.message}`);
        console.log(`    ❌ Erro na página ${pageNumber}: ${pageError.message}`);

        pageNumber++;
      }
    }

    // Compilar texto completo
    ocrResult.fullText = allPagesText.join('\n\n--- PÁGINA ' + (allPagesText.indexOf(allPagesText[allPagesText.length - 1]) + 2) + ' ---\n\n');

    // Calcular confiança média
    if (ocrResult.pages.length > 0) {
      const totalConfidence = ocrResult.pages.reduce((sum, page) => sum + page.averageConfidence, 0);
      ocrResult.averageConfidence = totalConfidence / ocrResult.pages.length;
    }

    // Verificar taxa de sucesso
    const successRate = (ocrResult.processedPages / ocrResult.totalPages) * 100;

    if (successRate < 50) {
      ocrResult.warnings.push(`Taxa de sucesso baixa: ${successRate.toFixed(1)}% (${ocrResult.processedPages}/${ocrResult.totalPages} páginas)`);
    }

    if (ocrResult.averageConfidence < confidenceThreshold) {
      ocrResult.warnings.push(`Confiança média abaixo do esperado: ${ocrResult.averageConfidence.toFixed(1)}%`);
    }

    // Limpar pasta temporária
    await fs.rm(tempFolder, { recursive: true, force: true });

    ocrResult.success = ocrResult.processedPages > 0;
    ocrResult.processingTime = Date.now() - startTime;

    console.log(`✅ OCR concluído: ${ocrResult.processedPages}/${ocrResult.totalPages} páginas em ${(ocrResult.processingTime / 1000).toFixed(1)}s`);

    // Gerar relatório completo
    await generateOCRReport(ocrResult, outputFolder);

    return ocrResult;

  } catch (error) {
    ocrResult.success = false;
    ocrResult.errors.push(`Erro fatal no OCR: ${error.message}`);
    ocrResult.processingTime = Date.now() - startTime;

    console.error(`❌ Erro fatal no OCR:`, error);

    return ocrResult;
  }
}

/**
 * Realizar OCR em uma imagem individual
 *
 * @param {string|Buffer} imagePath - Caminho da imagem ou buffer
 * @param {number} pageNumber - Número da página (para tracking)
 * @param {Object} options - Opções
 * @returns {Object} - Resultado do OCR
 */
export async function performOCROnImage(imagePath, pageNumber = 1, options = {}) {
  const {
    isBase64 = false,
    confidenceThreshold = 70,
    analyzeLayout = false
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

    // Otimizar imagem para OCR (reduzir tamanho se necessário)
    const optimizedImage = await sharp(imageBytes)
      .resize(2480, 3508, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    // Preparar comando Textract
    const command = analyzeLayout
      ? new AnalyzeDocumentCommand({
          Document: { Bytes: optimizedImage },
          FeatureTypes: ['TABLES', 'FORMS', 'LAYOUT']
        })
      : new DetectDocumentTextCommand({
          Document: { Bytes: optimizedImage }
        });

    // Executar OCR com AWS Textract
    const response = await textractClient.send(command);

    if (!response.Blocks || response.Blocks.length === 0) {
      result.error = 'Nenhum texto detectado na imagem';
      return result;
    }

    // Processar blocos de texto
    const textBlocks = [];
    const lines = [];
    const words = [];
    let totalConfidence = 0;
    let confidenceCount = 0;

    for (const block of response.Blocks) {
      if (block.BlockType === 'LINE' && block.Text) {
        lines.push({
          text: block.Text,
          confidence: block.Confidence || 0,
          geometry: block.Geometry
        });
        textBlocks.push(block.Text);

        if (block.Confidence) {
          totalConfidence += block.Confidence;
          confidenceCount++;
        }
      }

      if (block.BlockType === 'WORD' && block.Text) {
        const wordConfidence = block.Confidence || 0;

        words.push({
          text: block.Text,
          confidence: wordConfidence,
          geometry: block.Geometry
        });

        // Rastrear palavras com baixa confiança
        if (wordConfidence < confidenceThreshold) {
          result.lowConfidenceWords.push({
            word: block.Text,
            confidence: wordConfidence
          });
        }
      }
    }

    // Compilar texto completo
    result.text = textBlocks.join('\n');
    result.lines = lines;
    result.words = words;
    result.wordCount = words.length;
    result.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
    result.success = result.text.length > 0;

    return result;

  } catch (error) {
    result.error = error.message;
    result.success = false;

    console.error(`❌ Erro no OCR da página ${pageNumber}:`, error.message);

    return result;
  }
}

/**
 * Gerar relatório completo de OCR
 *
 * @param {Object} ocrResult - Resultado do OCR
 * @param {string} outputFolder - Pasta de saída
 */
async function generateOCRReport(ocrResult, outputFolder) {
  const report = {
    geradoEm: new Date().toISOString(),
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
      tamanhoArquivo: `${(ocrResult.fileSizeBytes / 1024 / 1024).toFixed(2)} MB`
    },
    paginas: ocrResult.pages.map(page => ({
      numero: page.pageNumber,
      palavras: page.wordCount,
      confianca: `${page.averageConfidence.toFixed(1)}%`,
      palavrasBaixaConfianca: page.lowConfidenceWords.length
    })),
    falhas: ocrResult.failedPages,
    avisos: ocrResult.warnings,
    erros: ocrResult.errors
  };

  // Salvar relatório JSON
  await fs.writeFile(
    path.join(outputFolder, 'relatorio-ocr.json'),
    JSON.stringify(report, null, 2),
    'utf-8'
  );

  // Salvar relatório Markdown
  const markdownReport = generateOCRReportMarkdown(report);
  await fs.writeFile(
    path.join(outputFolder, 'relatorio-ocr.md'),
    markdownReport,
    'utf-8'
  );

  // Salvar texto completo extraído
  await fs.writeFile(
    path.join(outputFolder, 'texto-completo-ocr.txt'),
    ocrResult.fullText,
    'utf-8'
  );

  console.log(`📋 Relatório OCR salvo em: ${outputFolder}`);
}

/**
 * Gerar relatório OCR em Markdown
 */
function generateOCRReportMarkdown(report) {
  return `# Relatório de OCR

**Gerado em:** ${new Date(report.geradoEm).toLocaleString('pt-BR')}

## 📊 Resumo

- **Status:** ${report.resumo.sucesso ? '✅ Sucesso' : '❌ Falha'}
- **Total de Páginas:** ${report.resumo.totalPaginas}
- **Páginas Processadas:** ${report.resumo.paginasProcessadas}
- **Taxa de Sucesso:** ${report.resumo.taxaSucesso}
- **Total de Palavras:** ${report.resumo.totalPalavras}
- **Confiança Média:** ${report.resumo.confianciaMedia}
- **Tempo de Processamento:** ${report.resumo.tempoProcessamento}

## 📄 Detalhes do Arquivo

- **PDF Original:** \`${report.detalhes.pdfOriginal}\`
- **Tamanho:** ${report.detalhes.tamanhoArquivo}

## 📃 Resultados por Página

| Página | Palavras | Confiança | Palavras Baixa Confiança |
|--------|----------|-----------|-------------------------|
${report.paginas.map(p =>
  `| ${p.numero} | ${p.palavras} | ${p.confianca} | ${p.palavrasBaixaConfianca} |`
).join('\n')}

${report.falhas.length > 0 ? `
## ❌ Páginas com Falha

${report.falhas.map(f => `- **Página ${f.page}:** ${f.error}`).join('\n')}
` : ''}

${report.avisos.length > 0 ? `
## ⚠️ Avisos

${report.avisos.map(a => `- ${a}`).join('\n')}
` : ''}

${report.erros.length > 0 ? `
## 🚨 Erros

${report.erros.map(e => `- ${e}`).join('\n')}
` : ''}

---

**Processado por:** ROM Agent - Sistema de Extração de Documentos
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
    const { extractTextFromPDF } = await import('./textract.js');
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
 * Realizar OCR inteligente (detecta automaticamente se é necessário)
 *
 * @param {string} pdfPath - Caminho do PDF
 * @param {string} outputFolder - Pasta de saída
 * @param {Object} options - Opções
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
      console.log('📸 PDF sem texto detectado - Executando OCR...');
      const ocrResult = await performOCROnPDF(pdfPath, outputFolder, options);

      result.ocrPerformed = true;
      result.text = ocrResult.fullText;
      result.source = 'ocr';
      result.details = ocrResult;

    } else {
      console.log('📝 PDF com texto detectado - Usando extração direta...');
      const { extractTextFromPDF } = await import('./textract.js');
      const extractResult = await extractTextFromPDF(pdfPath);

      result.ocrPerformed = false;
      result.text = extractResult.text || '';
      result.source = 'direct';
      result.details = extractResult;
    }

    return result;

  } catch (error) {
    console.error('❌ Erro no smartOCR:', error);
    return {
      ...result,
      error: error.message
    };
  }
}

export default {
  performOCROnPDF,
  performOCROnImage,
  needsOCR,
  smartOCR
};
