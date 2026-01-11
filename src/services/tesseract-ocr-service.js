/**
 * ROM Agent - Tesseract.js OCR Service
 *
 * Servico otimizado de OCR usando Tesseract.js com:
 * - Worker pool para processamento paralelo
 * - Pre-processamento de imagens com Sharp
 * - Suporte a portugues (por) e ingles (eng)
 * - Filtragem por confianca
 * - Metricas de performance
 */

import { createWorker, createScheduler } from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Classe principal do servico de OCR com Tesseract.js
 */
export class TesseractOCRService {
  /**
   * @param {number} workerCount - Numero de workers no pool (default: 4)
   */
  constructor(workerCount = 4) {
    this.scheduler = null;
    this.workers = [];
    this.workerCount = workerCount;
    this.isInitialized = false;
    this.metrics = {
      totalProcessed: 0,
      totalTime: 0,
      averageTime: 0,
      errors: 0
    };
  }

  /**
   * Inicializa o pool de workers do Tesseract
   * @param {Object} options - Opcoes de inicializacao
   * @param {string} options.language - Idioma principal (default: 'por')
   * @param {boolean} options.verbose - Exibir logs de progresso
   */
  async initialize(options = {}) {
    const { language = 'por', verbose = true } = options;

    if (this.isInitialized) {
      console.log('TesseractOCRService ja inicializado');
      return;
    }

    console.log(`Inicializando TesseractOCRService com ${this.workerCount} workers...`);

    this.scheduler = createScheduler();

    for (let i = 0; i < this.workerCount; i++) {
      const workerOptions = verbose ? {
        logger: m => {
          if (m.status === 'recognizing text') {
            process.stdout.write(`\rWorker ${i + 1}: ${(m.progress * 100).toFixed(1)}%`);
          }
        }
      } : {};

      const worker = await createWorker(language, 1, workerOptions);

      // Configurar parametros otimizados para documentos juridicos
      await worker.setParameters({
        tessedit_pageseg_mode: '3', // Fully automatic page segmentation
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: '', // Aceitar todos os caracteres
      });

      this.scheduler.addWorker(worker);
      this.workers.push(worker);
    }

    this.isInitialized = true;
    console.log(`\nTesseractOCRService inicializado com sucesso`);
  }

  /**
   * Pre-processa imagem para melhorar qualidade do OCR
   * @param {Buffer} buffer - Buffer da imagem
   * @param {Object} options - Opcoes de preprocessamento
   * @returns {Promise<Buffer>} - Buffer da imagem otimizada
   */
  async preprocessImage(buffer, options = {}) {
    const {
      width = 2480,
      height = 3508,
      grayscale = true,
      normalize = true,
      sharpen = true,
      denoise = false,
      threshold = false
    } = options;

    let sharpInstance = sharp(buffer)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      });

    if (grayscale) {
      sharpInstance = sharpInstance.grayscale();
    }

    if (normalize) {
      sharpInstance = sharpInstance.normalize();
    }

    if (sharpen) {
      sharpInstance = sharpInstance.sharpen({ sigma: 1.5 });
    }

    if (denoise) {
      sharpInstance = sharpInstance.median(3);
    }

    if (threshold) {
      sharpInstance = sharpInstance.threshold(128);
    }

    return await sharpInstance.png().toBuffer();
  }

  /**
   * Executa OCR em uma imagem
   * @param {string|Buffer} imagePath - Caminho da imagem ou buffer
   * @param {Object} options - Opcoes de OCR
   * @returns {Promise<Object>} - Resultado do OCR
   */
  async performOCR(imagePath, options = {}) {
    const {
      confidenceThreshold = 70,
      preprocess = true,
      preprocessOptions = {}
    } = options;

    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      let imageBuffer;

      if (Buffer.isBuffer(imagePath)) {
        imageBuffer = imagePath;
      } else if (typeof imagePath === 'string') {
        // Verificar se e base64
        if (imagePath.length > 500 && !existsSync(imagePath)) {
          imageBuffer = Buffer.from(imagePath, 'base64');
        } else {
          imageBuffer = await fs.readFile(imagePath);
        }
      } else {
        throw new Error('Formato de entrada invalido. Esperado: string (path ou base64) ou Buffer');
      }

      // Pre-processar imagem se solicitado
      const optimizedImage = preprocess
        ? await this.preprocessImage(imageBuffer, preprocessOptions)
        : imageBuffer;

      // Executar OCR
      const { data } = await this.scheduler.addJob('recognize', optimizedImage);

      // Processar resultado
      const processingTime = Date.now() - startTime;

      // Atualizar metricas
      this.metrics.totalProcessed++;
      this.metrics.totalTime += processingTime;
      this.metrics.averageTime = this.metrics.totalTime / this.metrics.totalProcessed;

      // Filtrar palavras por confianca
      const filteredWords = (data.words || []).filter(w => w.confidence >= confidenceThreshold);
      const lowConfidenceWords = (data.words || []).filter(w => w.confidence < confidenceThreshold);

      return {
        success: true,
        text: data.text || '',
        confidence: data.confidence || 0,
        words: filteredWords.map(w => ({
          text: w.text,
          confidence: w.confidence,
          bbox: w.bbox
        })),
        lines: (data.lines || []).map(l => ({
          text: l.text,
          confidence: l.confidence,
          bbox: l.bbox
        })),
        blocks: (data.blocks || []).map(b => ({
          text: b.text,
          confidence: b.confidence,
          bbox: b.bbox,
          paragraphs: b.paragraphs?.length || 0
        })),
        wordCount: filteredWords.length,
        totalWords: data.words?.length || 0,
        lowConfidenceCount: lowConfidenceWords.length,
        lowConfidenceWords: lowConfidenceWords.slice(0, 20).map(w => ({
          word: w.text,
          confidence: w.confidence
        })),
        processingTime,
        hocr: data.hocr || null
      };

    } catch (error) {
      this.metrics.errors++;

      return {
        success: false,
        text: '',
        confidence: 0,
        words: [],
        lines: [],
        blocks: [],
        wordCount: 0,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Executa OCR em multiplas imagens em paralelo
   * @param {Array<string|Buffer>} images - Array de imagens (caminhos ou buffers)
   * @param {Object} options - Opcoes de OCR
   * @returns {Promise<Object>} - Resultado consolidado
   */
  async performOCRBatch(images, options = {}) {
    const {
      confidenceThreshold = 70,
      preprocess = true,
      preprocessOptions = {},
      onProgress = null
    } = options;

    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const results = [];
    const allText = [];
    let totalConfidence = 0;
    let totalWords = 0;
    let failedPages = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: images.length,
          percentage: ((i + 1) / images.length * 100).toFixed(1)
        });
      }

      console.log(`\nProcessando pagina ${i + 1}/${images.length}...`);

      const result = await this.performOCR(image, {
        confidenceThreshold,
        preprocess,
        preprocessOptions
      });

      results.push({
        pageNumber: i + 1,
        ...result
      });

      if (result.success) {
        allText.push(result.text);
        totalConfidence += result.confidence;
        totalWords += result.wordCount;
      } else {
        failedPages.push({
          page: i + 1,
          error: result.error
        });
      }
    }

    const successfulPages = results.filter(r => r.success).length;
    const totalTime = Date.now() - startTime;

    return {
      success: successfulPages > 0,
      totalPages: images.length,
      processedPages: successfulPages,
      failedPages,
      pages: results,
      fullText: allText.join('\n\n--- PAGINA ---\n\n'),
      averageConfidence: successfulPages > 0 ? totalConfidence / successfulPages : 0,
      totalWords,
      processingTime: totalTime,
      averageTimePerPage: totalTime / images.length
    };
  }

  /**
   * Executa OCR em um PDF (requer conversao previa para imagens)
   * @param {string} pdfPath - Caminho do PDF
   * @param {string} outputFolder - Pasta para salvar resultados
   * @param {Object} options - Opcoes de processamento
   * @returns {Promise<Object>} - Resultado do OCR
   */
  async performOCROnPDF(pdfPath, outputFolder, options = {}) {
    const {
      maxPages = 100,
      confidenceThreshold = 70,
      saveIndividualPages = true,
      dpi = 300
    } = options;

    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

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

    try {
      // Criar pasta temporaria
      const tempFolder = path.join(outputFolder, 'temp-images');
      await fs.mkdir(tempFolder, { recursive: true });

      // Importar dinamicamente pdf2pic ou poppler
      let images = [];

      try {
        // Tentar usar pdf2pic se disponivel
        const { default: pdf2pic } = await import('pdf2pic');

        const converter = pdf2pic.fromPath(pdfPath, {
          density: dpi,
          saveFilename: 'page',
          savePath: tempFolder,
          format: 'png',
          width: 2480,
          height: 3508
        });

        // Converter todas as paginas
        const pdfBuffer = await fs.readFile(pdfPath);

        // Estimar numero de paginas baseado no tamanho
        const estimatedPages = Math.min(maxPages, 100);

        for (let pageNum = 1; pageNum <= estimatedPages; pageNum++) {
          try {
            const result = await converter(pageNum, { responseType: 'base64' });

            if (result && result.base64) {
              images.push({
                pageNumber: pageNum,
                base64: result.base64
              });
              ocrResult.totalPages = pageNum;
            } else {
              // Fim do documento
              break;
            }
          } catch (pageError) {
            if (pageError.message.includes('Invalid page') ||
                pageError.message.includes('not found')) {
              break;
            }
            console.warn(`Aviso na pagina ${pageNum}: ${pageError.message}`);
          }
        }
      } catch (pdf2picError) {
        // Fallback: tentar usar poppler via shell
        console.warn('pdf2pic nao disponivel, tentando pdftoppm...');

        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        const baseName = path.basename(pdfPath, '.pdf');
        const outputPrefix = path.join(tempFolder, baseName);

        await execAsync(`pdftoppm -png -r ${dpi} "${pdfPath}" "${outputPrefix}"`);

        // Listar imagens geradas
        const files = await fs.readdir(tempFolder);
        const pngFiles = files.filter(f => f.endsWith('.png')).sort();

        for (let i = 0; i < pngFiles.length && i < maxPages; i++) {
          const imagePath = path.join(tempFolder, pngFiles[i]);
          const imageBuffer = await fs.readFile(imagePath);
          images.push({
            pageNumber: i + 1,
            buffer: imageBuffer
          });
        }

        ocrResult.totalPages = images.length;
      }

      if (images.length === 0) {
        throw new Error('Nenhuma pagina extraida do PDF');
      }

      console.log(`Extraidas ${images.length} paginas do PDF`);

      // Processar cada pagina com OCR
      const allText = [];

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        console.log(`\nProcessando pagina ${image.pageNumber}/${ocrResult.totalPages}...`);

        const imageInput = image.base64
          ? Buffer.from(image.base64, 'base64')
          : image.buffer;

        const pageResult = await this.performOCR(imageInput, {
          confidenceThreshold,
          preprocess: true
        });

        if (pageResult.success) {
          ocrResult.pages.push({
            pageNumber: image.pageNumber,
            ...pageResult
          });
          allText.push(pageResult.text);
          ocrResult.processedPages++;
          ocrResult.totalWords += pageResult.wordCount;

          // Salvar resultado individual
          if (saveIndividualPages) {
            const pageFileName = `pagina-${String(image.pageNumber).padStart(3, '0')}-ocr`;

            await fs.writeFile(
              path.join(outputFolder, `${pageFileName}.json`),
              JSON.stringify({
                pageNumber: image.pageNumber,
                ...pageResult
              }, null, 2),
              'utf-8'
            );

            await fs.writeFile(
              path.join(outputFolder, `${pageFileName}.txt`),
              pageResult.text,
              'utf-8'
            );
          }

          console.log(`  Pagina ${image.pageNumber}: ${pageResult.wordCount} palavras, confianca ${pageResult.confidence.toFixed(1)}%`);
        } else {
          ocrResult.failedPages.push({
            page: image.pageNumber,
            error: pageResult.error
          });
          ocrResult.errors.push(`Pagina ${image.pageNumber}: ${pageResult.error}`);
          console.log(`  FALHA na pagina ${image.pageNumber}: ${pageResult.error}`);
        }
      }

      // Compilar texto completo
      ocrResult.fullText = allText.join('\n\n--- PAGINA ---\n\n');

      // Calcular confianca media
      if (ocrResult.pages.length > 0) {
        const totalConfidence = ocrResult.pages.reduce((sum, page) => sum + page.confidence, 0);
        ocrResult.averageConfidence = totalConfidence / ocrResult.pages.length;
      }

      // Verificar taxa de sucesso
      const successRate = (ocrResult.processedPages / ocrResult.totalPages) * 100;
      if (successRate < 50) {
        ocrResult.warnings.push(`Taxa de sucesso baixa: ${successRate.toFixed(1)}%`);
      }

      if (ocrResult.averageConfidence < confidenceThreshold) {
        ocrResult.warnings.push(`Confianca media abaixo do esperado: ${ocrResult.averageConfidence.toFixed(1)}%`);
      }

      // Limpar pasta temporaria
      await fs.rm(tempFolder, { recursive: true, force: true });

      ocrResult.success = ocrResult.processedPages > 0;
      ocrResult.processingTime = Date.now() - startTime;

      console.log(`\nOCR concluido: ${ocrResult.processedPages}/${ocrResult.totalPages} paginas em ${(ocrResult.processingTime / 1000).toFixed(1)}s`);

      // Gerar relatorio
      await this.generateOCRReport(ocrResult, outputFolder);

      return ocrResult;

    } catch (error) {
      ocrResult.success = false;
      ocrResult.errors.push(`Erro fatal no OCR: ${error.message}`);
      ocrResult.processingTime = Date.now() - startTime;

      console.error(`ERRO fatal no OCR:`, error);

      return ocrResult;
    }
  }

  /**
   * Gera relatorio de OCR em JSON e Markdown
   * @param {Object} ocrResult - Resultado do OCR
   * @param {string} outputFolder - Pasta de saida
   */
  async generateOCRReport(ocrResult, outputFolder) {
    const report = {
      geradoEm: new Date().toISOString(),
      motor: 'Tesseract.js',
      versao: '6.0.1',
      resumo: {
        sucesso: ocrResult.success,
        totalPaginas: ocrResult.totalPages,
        paginasProcessadas: ocrResult.processedPages,
        paginasFalhas: ocrResult.failedPages.length,
        taxaSucesso: `${((ocrResult.processedPages / ocrResult.totalPages) * 100).toFixed(1)}%`,
        totalPalavras: ocrResult.totalWords,
        confianciaMedia: `${ocrResult.averageConfidence.toFixed(1)}%`,
        tempoProcessamento: `${(ocrResult.processingTime / 1000).toFixed(1)}s`,
        tempoMedioPorPagina: `${(ocrResult.processingTime / ocrResult.totalPages / 1000).toFixed(2)}s`
      },
      detalhes: {
        pdfOriginal: ocrResult.pdfPath
      },
      paginas: ocrResult.pages.map(page => ({
        numero: page.pageNumber,
        palavras: page.wordCount,
        confianca: `${page.confidence.toFixed(1)}%`,
        palavrasBaixaConfianca: page.lowConfidenceCount || 0,
        tempoProcessamento: `${(page.processingTime / 1000).toFixed(2)}s`
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
    const markdownReport = this.generateOCRReportMarkdown(report);
    await fs.writeFile(
      path.join(outputFolder, 'relatorio-ocr.md'),
      markdownReport,
      'utf-8'
    );

    // Salvar texto completo
    await fs.writeFile(
      path.join(outputFolder, 'texto-completo-ocr.txt'),
      ocrResult.fullText,
      'utf-8'
    );

    console.log(`Relatorio OCR salvo em: ${outputFolder}`);
  }

  /**
   * Gera relatorio em Markdown
   * @param {Object} report - Dados do relatorio
   * @returns {string} - Conteudo Markdown
   */
  generateOCRReportMarkdown(report) {
    return `# Relatorio de OCR

**Gerado em:** ${new Date(report.geradoEm).toLocaleString('pt-BR')}
**Motor:** ${report.motor} v${report.versao}

## Resumo

- **Status:** ${report.resumo.sucesso ? 'Sucesso' : 'Falha'}
- **Total de Paginas:** ${report.resumo.totalPaginas}
- **Paginas Processadas:** ${report.resumo.paginasProcessadas}
- **Taxa de Sucesso:** ${report.resumo.taxaSucesso}
- **Total de Palavras:** ${report.resumo.totalPalavras}
- **Confianca Media:** ${report.resumo.confianciaMedia}
- **Tempo de Processamento:** ${report.resumo.tempoProcessamento}
- **Tempo Medio por Pagina:** ${report.resumo.tempoMedioPorPagina}

## Detalhes do Arquivo

- **PDF Original:** \`${report.detalhes.pdfOriginal}\`

## Resultados por Pagina

| Pagina | Palavras | Confianca | Palavras Baixa Confianca | Tempo |
|--------|----------|-----------|-------------------------|-------|
${report.paginas.map(p =>
  `| ${p.numero} | ${p.palavras} | ${p.confianca} | ${p.palavrasBaixaConfianca} | ${p.tempoProcessamento} |`
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
   * Retorna metricas de performance
   * @returns {Object} - Metricas
   */
  getMetrics() {
    return {
      ...this.metrics,
      workersAtivos: this.workers.length,
      inicializado: this.isInitialized
    };
  }

  /**
   * Encerra todos os workers
   */
  async terminate() {
    if (this.scheduler) {
      await this.scheduler.terminate();
      this.scheduler = null;
      this.workers = [];
      this.isInitialized = false;
      console.log('TesseractOCRService encerrado');
    }
  }
}

// Instancia singleton para uso global
let _instance = null;

/**
 * Obtem instancia singleton do TesseractOCRService
 * @param {number} workerCount - Numero de workers
 * @returns {TesseractOCRService}
 */
export function getTesseractOCRService(workerCount = 4) {
  if (!_instance) {
    _instance = new TesseractOCRService(workerCount);
  }
  return _instance;
}

/**
 * Funcao de conveniencia para OCR rapido de uma imagem
 * @param {string|Buffer} image - Imagem
 * @param {Object} options - Opcoes
 * @returns {Promise<Object>} - Resultado
 */
export async function quickOCR(image, options = {}) {
  const service = getTesseractOCRService();
  await service.initialize();
  return service.performOCR(image, options);
}

/**
 * Funcao de conveniencia para OCR de PDF
 * @param {string} pdfPath - Caminho do PDF
 * @param {string} outputFolder - Pasta de saida
 * @param {Object} options - Opcoes
 * @returns {Promise<Object>} - Resultado
 */
export async function ocrPDF(pdfPath, outputFolder, options = {}) {
  const service = getTesseractOCRService();
  await service.initialize();
  return service.performOCROnPDF(pdfPath, outputFolder, options);
}

export default TesseractOCRService;
