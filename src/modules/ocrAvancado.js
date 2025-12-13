/**
 * ROM Agent - Módulo de OCR e Extração Avançada
 * OCR com Tesseract.js e processamento de imagens com Sharp
 */

import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// CONFIGURAÇÃO DO OCR
// ============================================================================

const OCR_CONFIG = {
  lang: 'por',  // Português
  oem: 1,       // LSTM neural net
  psm: 3,       // Fully automatic page segmentation
  tessedit_char_whitelist: '',
  preserve_interword_spaces: '1'
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
      // Binarização (preto e branco)
      .threshold(128)
      // Salvar como PNG
      .png()
      .toFile(output);

    return output;
  },

  /**
   * Remove ruído da imagem
   */
  async removerRuido(inputPath, outputPath = null) {
    const output = outputPath || inputPath.replace(/\.[^/.]+$/, '_limpo.png');

    await sharp(inputPath)
      .median(3)  // Filtro mediano para remover ruído
      .grayscale()
      .normalize()
      .toFile(output);

    return output;
  },

  /**
   * Corrige rotação da imagem
   */
  async corrigirRotacao(inputPath, outputPath = null) {
    const output = outputPath || inputPath.replace(/\.[^/.]+$/, '_rotacionado.png');

    await sharp(inputPath)
      .rotate()  // Auto-rotação baseada em EXIF
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
   * Divide imagem em páginas/seções
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
   * Obtém metadados da imagem
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
        throw new Error(`Formato não suportado: ${formato}`);
    }

    await sharpInstance.toFile(output);
    return output;
  }
};

// ============================================================================
// OCR COM TESSERACT
// ============================================================================

export const ocrEngine = {
  worker: null,

  /**
   * Inicializa o worker do Tesseract
   */
  async inicializar() {
    if (this.worker) return;

    this.worker = await Tesseract.createWorker('por', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\rOCR: ${(m.progress * 100).toFixed(1)}%`);
        }
      }
    });

    console.log('\nTesseract OCR inicializado');
  },

  /**
   * Finaliza o worker
   */
  async finalizar() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
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

    // Pré-processamento
    if (preprocessar) {
      imagemProcessada = await processadorImagem.prepararParaOCR(imagePath);
    }

    // Configurar parâmetros
    await this.worker.setParameters({
      tessedit_pageseg_mode: psm
    });

    // Executar OCR
    const { data } = await this.worker.recognize(imagemProcessada);

    // Limpar arquivo temporário
    if (preprocessar && imagemProcessada !== imagePath) {
      try {
        await fs.unlink(imagemProcessada);
      } catch (e) {
        // Ignorar erro se arquivo não existir
      }
    }

    return {
      texto: data.text,
      confianca: data.confidence,
      palavras: data.words?.map(w => ({
        texto: w.text,
        confianca: w.confidence,
        bbox: w.bbox
      })),
      linhas: data.lines?.map(l => ({
        texto: l.text,
        confianca: l.confidence
      })),
      blocos: data.blocks?.length || 0
    };
  },

  /**
   * OCR em múltiplas imagens
   */
  async executarOCRMultiplo(imagePaths, opcoes = {}) {
    const resultados = [];

    for (let i = 0; i < imagePaths.length; i++) {
      console.log(`\nProcessando imagem ${i + 1}/${imagePaths.length}`);
      const resultado = await this.executarOCR(imagePaths[i], opcoes);
      resultados.push({
        arquivo: imagePaths[i],
        ...resultado
      });
    }

    return {
      resultados,
      textoCompleto: resultados.map(r => r.texto).join('\n\n--- PÁGINA ---\n\n'),
      confiancaMedia: resultados.reduce((acc, r) => acc + r.confianca, 0) / resultados.length
    };
  },

  /**
   * OCR com detecção de layout
   */
  async ocrComLayout(imagePath) {
    await this.inicializar();

    const imagemProcessada = await processadorImagem.prepararParaOCR(imagePath);

    // PSM 1 = Automatic page segmentation with OSD
    await this.worker.setParameters({
      tessedit_pageseg_mode: 1
    });

    const { data } = await this.worker.recognize(imagemProcessada);

    // Organizar por posição
    const elementos = [];

    if (data.blocks) {
      for (const bloco of data.blocks) {
        elementos.push({
          tipo: 'bloco',
          texto: bloco.text,
          posicao: bloco.bbox,
          confianca: bloco.confidence,
          paragrafos: bloco.paragraphs?.length || 0
        });
      }
    }

    // Limpar
    try {
      await fs.unlink(imagemProcessada);
    } catch (e) {}

    return {
      texto: data.text,
      elementos,
      orientacao: data.osd?.orientation || 0,
      rotacao: data.osd?.rotate || 0
    };
  }
};

// ============================================================================
// EXTRAÇÃO DE IMAGENS DE PDF
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
      // Usar pdfimages se disponível
      await execAsync(`pdfimages -png "${pdfPath}" "${outputPrefix}"`);

      // Listar imagens extraídas
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
      // Se pdfimages não disponível, tentar pdftoppm
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
          error: 'Ferramentas de extração não disponíveis (pdfimages/pdftoppm)',
          imagens: []
        };
      }
    }
  },

  /**
   * Converte PDF para imagens
   */
  async pdfParaImagens(pdfPath, outputDir = null, dpi = 300) {
    const dir = outputDir || path.dirname(pdfPath);
    const baseName = path.basename(pdfPath, '.pdf');
    const outputPrefix = path.join(dir, baseName);

    try {
      await execAsync(`pdftoppm -png -r ${dpi} "${pdfPath}" "${outputPrefix}"`);

      const arquivos = await fs.readdir(dir);
      const imagens = arquivos
        .filter(f => f.startsWith(baseName) && f.endsWith('.png'))
        .sort()
        .map(f => path.join(dir, f));

      return {
        success: true,
        imagens,
        quantidade: imagens.length,
        dpi
      };
    } catch (error) {
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
      limparTemporarios = true
    } = opcoes;

    console.log('Convertendo PDF para imagens...');
    const conversao = await this.pdfParaImagens(pdfPath, null, dpi);

    if (!conversao.success || conversao.imagens.length === 0) {
      return {
        success: false,
        error: conversao.error || 'Nenhuma imagem extraída',
        texto: ''
      };
    }

    console.log(`Executando OCR em ${conversao.imagens.length} páginas...`);
    const resultado = await ocrEngine.executarOCRMultiplo(conversao.imagens, { preprocessar });

    // Limpar arquivos temporários
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
// PIPELINE COMPLETO DE OCR JURÍDICO
// ============================================================================

export const pipelineOCRJuridico = {
  /**
   * Processa documento jurídico escaneado
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
        error: `Formato não suportado: ${ext}`
      };
    }

    if (!resultado.success) {
      return resultado;
    }

    // Pós-processamento do texto
    resultado.texto = this.posProcessarTexto(resultado.texto);

    // Extrair entidades jurídicas
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
   * Pós-processa texto de OCR
   */
  posProcessarTexto(texto) {
    return texto
      // Normalizar espaços
      .replace(/\s+/g, ' ')
      // Corrigir quebras de linha
      .replace(/\s*\n\s*/g, '\n')
      // Remover linhas em branco excessivas
      .replace(/\n{3,}/g, '\n\n')
      // Corrigir hifenização
      .replace(/(\w)-\n(\w)/g, '$1$2')
      // Corrigir espaços antes de pontuação
      .replace(/\s+([.,;:!?])/g, '$1')
      // Corrigir espaços após pontuação
      .replace(/([.,;:!?])(?=[^\s\n])/g, '$1 ')
      // Trim
      .trim();
  },

  /**
   * Extrai entidades jurídicas do texto de OCR
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

    // Números de processo CNJ
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

    // Valores monetários
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
// EXPORTAÇÃO
// ============================================================================

export default {
  processadorImagem,
  ocrEngine,
  extratorPDF,
  pipelineOCRJuridico
};
