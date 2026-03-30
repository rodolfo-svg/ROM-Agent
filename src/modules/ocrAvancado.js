/**
 * ROM Agent - Modulo de OCR e Extracao Avancada
 * OCR com Tesseract.js e processamento de imagens com Sharp
 *
 * REFATORADO: Integrado com TesseractOCRService para melhor performance
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getTesseractOCRService, TesseractOCRService } from '../services/tesseract-ocr-service.js';

const execAsync = promisify(exec);

// ============================================================================
// CONFIGURACAO DO OCR
// ============================================================================

const OCR_CONFIG = {
  lang: 'por',  // Portugues
  workerCount: 4,
  confidenceThreshold: 70
};

// ============================================================================
// PROCESSAMENTO DE IMAGENS COM SHARP
// ============================================================================

export const processadorImagem = {
  /**
   * Prepara imagem para OCR (melhora qualidade)
   */
  async prepararParaOCR(inputPath, outputPath = null) {
    const output = outputPath || inputPath.replace(/\.[^/.]+$/, '_processado.png');

    await sharp(inputPath)
      // Converter para escala de cinza
      .grayscale()
      // Aumentar contraste
      .normalize()
      // Aumentar nitidez
      .sharpen({ sigma: 1.5 })
      // Redimensionar se muito pequeno
      .resize({
        width: 2000,
        height: 3000,
        fit: 'inside',
        withoutEnlargement: false
      })
      // Binarizacao (preto e branco)
      .threshold(128)
      // Salvar como PNG
      .png()
      .toFile(output);

    return output;
  },

  /**
   * Remove ruido da imagem
   */
  async removerRuido(inputPath, outputPath = null) {
    const output = outputPath || inputPath.replace(/\.[^/.]+$/, '_limpo.png');

    await sharp(inputPath)
      .median(3)  // Filtro mediano para remover ruido
      .grayscale()
      .normalize()
      .toFile(output);

    return output;
  },

  /**
   * Corrige rotacao da imagem
   */
  async corrigirRotacao(inputPath, outputPath = null) {
    const output = outputPath || inputPath.replace(/\.[^/.]+$/, '_rotacionado.png');

    await sharp(inputPath)
      .rotate()  // Auto-rotacao baseada em EXIF
      .toFile(output);

    return output;
  },

  /**
   * Recorta margens da imagem
   */
  async recortarMargens(inputPath, outputPath = null, margem = 50) {
    const output = outputPath || inputPath.replace(/\.[^/.]+$/, '_recortado.png');

    const metadata = await sharp(inputPath).metadata();

    await sharp(inputPath)
      .extract({
        left: margem,
        top: margem,
        width: metadata.width - (margem * 2),
        height: metadata.height - (margem * 2)
      })
      .toFile(output);

    return output;
  },

  /**
   * Divide imagem em paginas/secoes
   */
  async dividirEmSecoes(inputPath, numSecoes = 2) {
    const metadata = await sharp(inputPath).metadata();
    const alturaSecao = Math.floor(metadata.height / numSecoes);
    const secoes = [];

    for (let i = 0; i < numSecoes; i++) {
      const outputPath = inputPath.replace(/\.[^/.]+$/, `_secao${i + 1}.png`);

      await sharp(inputPath)
        .extract({
          left: 0,
          top: i * alturaSecao,
          width: metadata.width,
          height: alturaSecao
        })
        .toFile(outputPath);

      secoes.push(outputPath);
    }

    return secoes;
  },

  /**
   * Obtem metadados da imagem
   */
  async obterMetadados(inputPath) {
    return await sharp(inputPath).metadata();
  },

  /**
   * Converte formato de imagem
   */
  async converter(inputPath, formato, outputPath = null) {
    const output = outputPath || inputPath.replace(/\.[^/.]+$/, `.${formato}`);

    let sharpInstance = sharp(inputPath);

    switch (formato.toLowerCase()) {
      case 'png':
        sharpInstance = sharpInstance.png();
        break;
      case 'jpg':
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality: 90 });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality: 90 });
        break;
      case 'tiff':
        sharpInstance = sharpInstance.tiff();
        break;
      default:
        throw new Error(`Formato nao suportado: ${formato}`);
    }

    await sharpInstance.toFile(output);
    return output;
  }
};

// ============================================================================
// OCR ENGINE COM TESSERACT.JS (usando TesseractOCRService)
// ============================================================================

export const ocrEngine = {
  service: null,

  /**
   * Inicializa o servico de OCR
   */
  async inicializar() {
    if (this.service && this.service.isInitialized) return;

    this.service = getTesseractOCRService(OCR_CONFIG.workerCount);
    await this.service.initialize({ language: OCR_CONFIG.lang, verbose: true });

    console.log('\nTesseract OCR inicializado com worker pool');
  },

  /**
   * Finaliza o servico
   */
  async finalizar() {
    if (this.service) {
      await this.service.terminate();
      this.service = null;
    }
  },

  /**
   * Executa OCR em uma imagem
   */
  async executarOCR(imagePath, opcoes = {}) {
    await this.inicializar();

    const {
      preprocessar = true,
      psm = 3,
      idioma = 'por'
    } = opcoes;

    let imagemProcessada = imagePath;

    // Pre-processamento
    if (preprocessar && typeof imagePath === 'string' && existsSync(imagePath)) {
      imagemProcessada = await processadorImagem.prepararParaOCR(imagePath);
    }

    // Ler imagem para buffer se for path
    let imageBuffer;
    if (typeof imagemProcessada === 'string') {
      imageBuffer = await fs.readFile(imagemProcessada);
    } else {
      imageBuffer = imagemProcessada;
    }

    // Executar OCR usando o service
    const result = await this.service.performOCR(imageBuffer, {
      confidenceThreshold: OCR_CONFIG.confidenceThreshold,
      preprocess: false // ja preprocessamos acima
    });

    // Limpar arquivo temporario
    if (preprocessar && typeof imagePath === 'string' && imagemProcessada !== imagePath) {
      try {
        await fs.unlink(imagemProcessada);
      } catch (e) {
        // Ignorar erro se arquivo nao existir
      }
    }

    return {
      texto: result.text,
      confianca: result.confidence,
      palavras: result.words?.map(w => ({
        texto: w.text,
        confianca: w.confidence,
        bbox: w.bbox
      })),
      linhas: result.lines?.map(l => ({
        texto: l.text,
        confianca: l.confidence
      })),
      blocos: result.blocks?.length || 0,
      tempoProcessamento: result.processingTime
    };
  },

  /**
   * OCR em multiplas imagens
   */
  async executarOCRMultiplo(imagePaths, opcoes = {}) {
    await this.inicializar();

    const { onProgress, ...ocrOptions } = opcoes; // Extrair callback de progresso

    const resultados = [];
    const BATCH_SIZE = 16; // Processar 16 páginas em paralelo (4 por worker com 4 workers)
    const totalPages = imagePaths.length;
    const totalBatches = Math.ceil(totalPages / BATCH_SIZE);

    console.log(`\n🚀 Processamento paralelo: ${totalPages} páginas em ${totalBatches} batches de ${BATCH_SIZE}`);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, totalPages);
      const batch = imagePaths.slice(startIdx, endIdx);

      const batchNumber = batchIndex + 1;
      const progress = ((batchIndex / totalBatches) * 100).toFixed(1);
      console.log(`\n📊 Batch ${batchNumber}/${totalBatches} (${progress}%): Processando páginas ${startIdx + 1}-${endIdx} simultaneamente...`);

      // Processar batch em paralelo
      const batchResults = await Promise.all(
        batch.map(async (imagePath, idx) => {
          const pageNum = startIdx + idx + 1;
          const resultado = await this.executarOCR(imagePath, ocrOptions);
          return {
            arquivo: imagePath,
            pagina: pageNum,
            ...resultado
          };
        })
      );

      resultados.push(...batchResults);

      // Log de progresso
      const pagesProcessed = Math.min((batchIndex + 1) * BATCH_SIZE, totalPages);
      const actualProgress = ((pagesProcessed / totalPages) * 100).toFixed(1);
      console.log(`   ✅ Batch ${batchNumber} concluído - ${pagesProcessed}/${totalPages} páginas (${actualProgress}%)`);

      // Callback de progresso (se fornecido)
      if (onProgress && typeof onProgress === 'function') {
        onProgress({
          phase: 'ocr',
          batch: batchNumber,
          totalBatches,
          pagesProcessed,
          totalPages,
          percent: parseFloat(actualProgress)
        });
      }
    }

    return {
      resultados,
      textoCompleto: resultados.map(r => r.texto).join('\n\n--- PAGINA ---\n\n'),
      confiancaMedia: resultados.reduce((acc, r) => acc + r.confianca, 0) / resultados.length
    };
  },

  /**
   * OCR com deteccao de layout
   */
  async ocrComLayout(imagePath) {
    await this.inicializar();

    const imagemProcessada = await processadorImagem.prepararParaOCR(imagePath);

    // Ler imagem
    const imageBuffer = await fs.readFile(imagemProcessada);

    // Executar OCR
    const result = await this.service.performOCR(imageBuffer, {
      confidenceThreshold: OCR_CONFIG.confidenceThreshold,
      preprocess: false
    });

    // Organizar por posicao
    const elementos = [];

    if (result.blocks) {
      for (const bloco of result.blocks) {
        elementos.push({
          tipo: 'bloco',
          texto: bloco.text,
          posicao: bloco.bbox,
          confianca: bloco.confidence,
          paragrafos: bloco.paragraphs || 0
        });
      }
    }

    // Limpar
    try {
      await fs.unlink(imagemProcessada);
    } catch (e) {}

    return {
      texto: result.text,
      elementos,
      orientacao: 0,
      rotacao: 0
    };
  }
};

// ============================================================================
// EXTRACAO DE IMAGENS DE PDF
// ============================================================================

export const extratorPDF = {
  /**
   * Extrai imagens de um PDF usando pdfimages
   */
  async extrairImagensPDF(pdfPath, outputDir = null) {
    const dir = outputDir || path.dirname(pdfPath);
    const baseName = path.basename(pdfPath, '.pdf');
    const outputPrefix = path.join(dir, `${baseName}_img`);

    try {
      // Usar pdfimages se disponivel
      await execAsync(`pdfimages -png "${pdfPath}" "${outputPrefix}"`);

      // Listar imagens extraidas
      const arquivos = await fs.readdir(dir);
      const imagens = arquivos
        .filter(f => f.startsWith(`${baseName}_img`) && f.endsWith('.png'))
        .map(f => path.join(dir, f));

      return {
        success: true,
        imagens,
        quantidade: imagens.length
      };
    } catch (error) {
      // Se pdfimages nao disponivel, tentar pdftoppm
      try {
        await execAsync(`pdftoppm -png "${pdfPath}" "${outputPrefix}"`);

        const arquivos = await fs.readdir(dir);
        const imagens = arquivos
          .filter(f => f.startsWith(`${baseName}_img`))
          .map(f => path.join(dir, f));

        return {
          success: true,
          imagens,
          quantidade: imagens.length
        };
      } catch (e) {
        return {
          success: false,
          error: 'Ferramentas de extracao nao disponiveis (pdfimages/pdftoppm)',
          imagens: []
        };
      }
    }
  },

  /**
   * Converte PDF para imagens
   */
  async pdfParaImagens(pdfPath, outputDir = null, dpi = 300, onProgress = null) {
    const dir = outputDir || path.dirname(pdfPath);
    const baseName = path.basename(pdfPath, '.pdf');
    const outputPrefix = path.join(dir, baseName);

    try {
      // Reportar início da conversão (suporta AMBOS os formatos)
      if (onProgress) {
        // Tentar formato objeto primeiro, fallback para string
        try {
          onProgress('Convertendo PDF para imagens...', 0);
        } catch (e) {
          onProgress({ status: 'Convertendo PDF para imagens...', percent: 0 });
        }
      }

      console.log(`🔄 Iniciando conversão: pdftoppm -png -r ${dpi}`);
      const startTime = Date.now();

      // Converter PDF para imagens (com timeout de 30 minutos)
      await execAsync(`pdftoppm -png -r ${dpi} "${pdfPath}" "${outputPrefix}"`, {
        timeout: 1800000, // 30 minutos
        maxBuffer: 500 * 1024 * 1024 // 500MB
      });

      const elapsedSec = Math.round((Date.now() - startTime) / 1000);
      console.log(`✅ Conversão concluída em ${elapsedSec}s`);

      const arquivos = await fs.readdir(dir);
      const imagens = arquivos
        .filter(f => f.startsWith(baseName) && f.endsWith('.png'))
        .sort()
        .map(f => path.join(dir, f));

      console.log(`✅ ${imagens.length} imagens geradas`);

      if (onProgress) {
        // Tentar formato objeto primeiro, fallback para string
        try {
          onProgress(`${imagens.length} imagens geradas, iniciando OCR...`, 5);
        } catch (e) {
          onProgress({ status: `${imagens.length} imagens geradas`, percent: 10 });
        }
      }

      return {
        success: true,
        imagens,
        quantidade: imagens.length,
        dpi
      };
    } catch (error) {
      console.error(`❌ Erro na conversão PDF→imagens: ${error.message}`);
      return {
        success: false,
        error: error.message,
        imagens: []
      };
    }
  },

  /**
   * OCR completo de PDF (converte para imagens + OCR)
   */
  async ocrPDFCompleto(pdfPath, opcoes = {}) {
    const {
      dpi = 300,
      preprocessar = true,
      limparTemporarios = true,
      onProgress = null
    } = opcoes;

    console.log('🔄 Convertendo PDF para imagens...');

    // Wrapper para mapear progresso da conversão (0-10%)
    // IMPORTANTE: Suporta AMBOS os formatos: (string, number) E (object)
    const conversionProgress = onProgress ? (statusOrData, percentOrUndefined) => {
      // Se receber string (formato antigo do extractor-pipeline)
      if (typeof statusOrData === 'string') {
        onProgress({
          status: statusOrData,
          percent: Math.floor(percentOrUndefined || 0),
          batch: 0,
          totalBatches: 0,
          pagesProcessed: 0,
          totalPages: 0
        });
      } else {
        // Já é objeto (formato novo do pdfParaImagens)
        onProgress({
          status: statusOrData.status || 'Convertendo PDF...',
          percent: Math.floor(statusOrData.percent || 0),
          batch: 0,
          totalBatches: 0,
          pagesProcessed: 0,
          totalPages: 0
        });
      }
    } : null;

    const conversao = await this.pdfParaImagens(pdfPath, null, dpi, conversionProgress);

    if (!conversao.success || conversao.imagens.length === 0) {
      return {
        success: false,
        error: conversao.error || 'Nenhuma imagem extraida',
        texto: ''
      };
    }

    console.log(`🔍 Executando OCR em ${conversao.imagens.length} páginas...`);

    // Wrapper para mapear progresso do OCR (10-100%)
    // IMPORTANTE: Suporta AMBOS os formatos: (string, number) E (object)
    const ocrProgress = onProgress ? (statusOrData, percentOrUndefined) => {
      // Se receber string (formato antigo)
      if (typeof statusOrData === 'string') {
        const mappedPercent = 10 + Math.floor((percentOrUndefined || 0) * 0.9);
        onProgress({
          status: statusOrData,
          percent: mappedPercent,
          batch: 0,
          totalBatches: 0,
          pagesProcessed: 0,
          totalPages: 0
        });
      } else {
        // Já é objeto (formato do OCR engine)
        const ocrPercent = statusOrData.percent || 0;
        const mappedPercent = 10 + Math.floor(ocrPercent * 0.9);
        onProgress({
          ...statusOrData,
          percent: mappedPercent
        });
      }
    } : null;

    const resultado = await ocrEngine.executarOCRMultiplo(conversao.imagens, { preprocessar, onProgress: ocrProgress });

    // Limpar arquivos temporarios
    if (limparTemporarios) {
      for (const img of conversao.imagens) {
        try {
          await fs.unlink(img);
        } catch (e) {}
      }
    }

    return {
      success: true,
      texto: resultado.textoCompleto,
      paginas: resultado.resultados.length,
      confiancaMedia: resultado.confiancaMedia,
      detalhes: resultado.resultados
    };
  }
};

// ============================================================================
// PIPELINE COMPLETO DE OCR JURIDICO
// ============================================================================

export const pipelineOCRJuridico = {
  /**
   * Processa documento juridico escaneado
   */
  async processarDocumentoEscaneado(inputPath, opcoes = {}) {
    const {
      outputDir = null,
      preprocessar = true,
      extrairEntidades = true,
      salvarResultado = true
    } = opcoes;

    const ext = path.extname(inputPath).toLowerCase();
    const dir = outputDir || path.dirname(inputPath);
    const baseName = path.basename(inputPath, ext);

    console.log(`\nProcessando: ${inputPath}`);
    console.log(`Tipo: ${ext}`);

    let resultado;

    // PDF
    if (ext === '.pdf') {
      resultado = await extratorPDF.ocrPDFCompleto(inputPath, { preprocessar });
    }
    // Imagem
    else if (['.png', '.jpg', '.jpeg', '.tiff', '.bmp'].includes(ext)) {
      const ocrResult = await ocrEngine.executarOCR(inputPath, { preprocessar });
      resultado = {
        success: true,
        texto: ocrResult.texto,
        paginas: 1,
        confiancaMedia: ocrResult.confianca,
        detalhes: [ocrResult]
      };
    }
    else {
      return {
        success: false,
        error: `Formato nao suportado: ${ext}`
      };
    }

    if (!resultado.success) {
      return resultado;
    }

    // Pos-processamento do texto
    resultado.texto = this.posProcessarTexto(resultado.texto);

    // Extrair entidades juridicas
    if (extrairEntidades) {
      resultado.entidades = this.extrairEntidadesJuridicas(resultado.texto);
    }

    // Salvar resultado
    if (salvarResultado) {
      const outputPath = path.join(dir, `${baseName}_ocr.txt`);
      await fs.writeFile(outputPath, resultado.texto, 'utf-8');
      resultado.arquivoSaida = outputPath;
      console.log(`\nTexto salvo em: ${outputPath}`);
    }

    return resultado;
  },

  /**
   * Pos-processa texto de OCR
   */
  posProcessarTexto(texto) {
    return texto
      // Normalizar espacos
      .replace(/\s+/g, ' ')
      // Corrigir quebras de linha
      .replace(/\s*\n\s*/g, '\n')
      // Remover linhas em branco excessivas
      .replace(/\n{3,}/g, '\n\n')
      // Corrigir hifenizacao
      .replace(/(\w)-\n(\w)/g, '$1$2')
      // Corrigir espacos antes de pontuacao
      .replace(/\s+([.,;:!?])/g, '$1')
      // Corrigir espacos apos pontuacao
      .replace(/([.,;:!?])(?=[^\s\n])/g, '$1 ')
      // Trim
      .trim();
  },

  /**
   * Extrai entidades juridicas do texto de OCR
   */
  extrairEntidadesJuridicas(texto) {
    const entidades = {
      processos: [],
      cpfs: [],
      cnpjs: [],
      datas: [],
      valores: [],
      artigos: [],
      tribunais: []
    };

    // Numeros de processo CNJ
    const processoRegex = /\d{7}[-.]?\d{2}[.]?\d{4}[.]?\d[.]?\d{2}[.]?\d{4}/g;
    entidades.processos = [...new Set(texto.match(processoRegex) || [])];

    // CPFs
    const cpfRegex = /\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}/g;
    entidades.cpfs = [...new Set(texto.match(cpfRegex) || [])];

    // CNPJs
    const cnpjRegex = /\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-.\s]?\d{2}/g;
    entidades.cnpjs = [...new Set(texto.match(cnpjRegex) || [])];

    // Datas
    const dataRegex = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g;
    entidades.datas = [...new Set(texto.match(dataRegex) || [])];

    // Valores monetarios
    const valorRegex = /R\$\s*[\d\.,]+/g;
    entidades.valores = [...new Set(texto.match(valorRegex) || [])];

    // Artigos de lei
    const artigoRegex = /art(?:igo)?\.?\s*\d+/gi;
    entidades.artigos = [...new Set(texto.match(artigoRegex) || [])];

    // Tribunais
    const tribunais = ['STF', 'STJ', 'TST', 'TSE', 'STM', 'TRF', 'TJSP', 'TJRJ', 'TJMG'];
    for (const tribunal of tribunais) {
      if (texto.toUpperCase().includes(tribunal)) {
        entidades.tribunais.push(tribunal);
      }
    }

    return entidades;
  }
};

// ============================================================================
// EXPORTACAO
// ============================================================================

export default {
  processadorImagem,
  ocrEngine,
  extratorPDF,
  pipelineOCRJuridico
};
