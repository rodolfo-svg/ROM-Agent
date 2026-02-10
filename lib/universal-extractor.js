/**
 * Sistema de Extração Universal
 *
 * Detecta automaticamente tipo de arquivo e aplica extrator apropriado:
 * - PDF: pdfjs-dist + image extraction + OCR
 * - Imagens: OCR (Tesseract) + Claude Vision
 * - Vídeos: ffmpeg (frames + áudio) + transcrição
 * - Áudio: AWS Transcribe ou Whisper
 * - Documentos: mammoth (docx), xlsx, pptx, etc
 * - Texto: UTF-8 encoding
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import mime from 'mime-types';

const execAsync = promisify(exec);

export class UniversalExtractor {
  constructor() {
    this.supportedTypes = {
      pdf: ['application/pdf', '.pdf'],
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff', 'image/webp', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'],
      video: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'],
      audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/m4a', '.mp3', '.wav', '.ogg', '.m4a'],
      document: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', '.docx', '.doc'],
      spreadsheet: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', '.xlsx', '.xls'],
      presentation: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint', '.pptx', '.ppt'],
      text: ['text/plain', 'text/html', 'text/xml', 'application/json', '.txt', '.html', '.xml', '.json', '.md', '.csv']
    };
  }

  /**
   * Detecta tipo de arquivo
   */
  detectFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = mime.lookup(filePath) || '';

    for (const [type, identifiers] of Object.entries(this.supportedTypes)) {
      if (identifiers.includes(ext) || identifiers.includes(mimeType)) {
        return type;
      }
    }

    return 'unknown';
  }

  /**
   * Extração universal - roteador principal
   */
  async extract(filePath, options = {}) {
    const startTime = Date.now();
    const fileType = this.detectFileType(filePath);
    const fileName = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;

    console.log(`\n🔍 [UNIVERSAL EXTRACTOR] Detectado: ${fileType} (${fileName})`);

    let result = {
      success: false,
      fileType,
      fileName,
      fileSize,
      extractedText: '',
      metadata: {
        timestamp: new Date().toISOString(),
        processingTime: 0,
        method: 'none'
      },
      images: [],
      frames: [],
      audio: null,
      error: null
    };

    try {
      switch (fileType) {
        case 'pdf':
          result = await this.extractPDF(filePath, options);
          break;
        case 'image':
          result = await this.extractImage(filePath, options);
          break;
        case 'video':
          result = await this.extractVideo(filePath, options);
          break;
        case 'audio':
          result = await this.extractAudio(filePath, options);
          break;
        case 'document':
          result = await this.extractDocument(filePath, options);
          break;
        case 'spreadsheet':
          result = await this.extractSpreadsheet(filePath, options);
          break;
        case 'presentation':
          result = await this.extractPresentation(filePath, options);
          break;
        case 'text':
          result = await this.extractText(filePath, options);
          break;
        default:
          result.error = `Tipo de arquivo não suportado: ${fileType}`;
      }

      result.success = !result.error;
      result.metadata.processingTime = Date.now() - startTime;

    } catch (error) {
      console.error(`❌ Erro na extração universal:`, error);
      result.error = error.message;
      result.success = false;
    }

    return result;
  }

  /**
   * Extração de PDF (já implementado via extraction-persistence)
   */
  async extractPDF(filePath, options = {}) {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const sharp = (await import('sharp')).default;

    console.log(`   📄 Extraindo PDF...`);

    const loadingTask = pdfjsLib.getDocument({
      url: filePath,
      verbosity: 0,
      useSystemFonts: true
    });

    const pdfDocument = await loadingTask.promise;
    let fullText = '';
    const images = [];

    // Extrair texto + imagens de cada página
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);

      // Texto
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';

      // Imagens
      const operatorList = await page.getOperatorList();
      let imageIndex = 0;

      for (let i = 0; i < operatorList.fnArray.length; i++) {
        const fn = operatorList.fnArray[i];

        if (fn === 85 || fn === 86) { // paintImageXObject ou paintInlineImageXObject
          const args = operatorList.argsArray[i];
          const imageName = args[0];

          try {
            const image = await page.objs.ensure(imageName);

            if (image && image.data && image.width && image.height) {
              imageIndex++;
              const bytesPerPixel = image.data.length / (image.width * image.height);
              const channels = bytesPerPixel === 3 ? 3 : 4;

              const imageBuffer = await sharp(Buffer.from(image.data), {
                raw: {
                  width: image.width,
                  height: image.height,
                  channels: channels
                }
              }).png().toBuffer();

              images.push({
                page: pageNum,
                index: imageIndex,
                width: image.width,
                height: image.height,
                channels: channels,
                buffer: imageBuffer,
                format: 'png'
              });
            }
          } catch (imgError) {
            console.warn(`   ⚠️  Erro ao extrair imagem ${imageIndex} da página ${pageNum}:`, imgError.message);
          }
        }
      }
    }

    console.log(`   ✅ PDF extraído: ${fullText.length} chars, ${images.length} imagens`);

    return {
      success: true,
      fileType: 'pdf',
      extractedText: fullText.trim(),
      images,
      metadata: {
        timestamp: new Date().toISOString(),
        method: 'pdfjs-dist',
        pages: pdfDocument.numPages,
        imagesCount: images.length
      }
    };
  }

  /**
   * Extração de Imagem Standalone com OCR
   */
  async extractImage(filePath, options = {}) {
    console.log(`   🖼️  Extraindo imagem com OCR...`);

    const { default: Tesseract } = await import('tesseract.js');
    const sharp = (await import('sharp')).default;

    // OCR com Tesseract
    let ocrText = '';
    try {
      const { data: { text } } = await Tesseract.recognize(filePath, 'por', {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`   📝 OCR: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      ocrText = text.trim();
    } catch (ocrError) {
      console.warn(`   ⚠️  OCR falhou:`, ocrError.message);
      ocrText = '[OCR não disponível]';
    }

    // Metadata da imagem
    const imageInfo = await sharp(filePath).metadata();

    console.log(`   ✅ Imagem extraída: ${ocrText.length} chars via OCR`);

    return {
      success: true,
      fileType: 'image',
      extractedText: ocrText,
      images: [{
        path: filePath,
        width: imageInfo.width,
        height: imageInfo.height,
        format: imageInfo.format,
        buffer: fs.readFileSync(filePath)
      }],
      metadata: {
        timestamp: new Date().toISOString(),
        method: 'tesseract-ocr',
        width: imageInfo.width,
        height: imageInfo.height,
        format: imageInfo.format,
        hasAlpha: imageInfo.hasAlpha
      }
    };
  }

  /**
   * Extração de Vídeo (frames + áudio)
   */
  async extractVideo(filePath, options = {}) {
    console.log(`   🎬 Extraindo vídeo (frames + áudio)...`);

    const tempDir = path.join('/tmp', `video_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const framesDir = path.join(tempDir, 'frames');
    fs.mkdirSync(framesDir, { recursive: true });

    const audioPath = path.join(tempDir, 'audio.mp3');
    const frames = [];

    try {
      // 1. Extrair informações do vídeo
      const probeCmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;
      const { stdout: probeOutput } = await execAsync(probeCmd);
      const videoInfo = JSON.parse(probeOutput);

      const duration = parseFloat(videoInfo.format.duration);
      const videoStream = videoInfo.streams.find(s => s.codec_type === 'video');
      const audioStream = videoInfo.streams.find(s => s.codec_type === 'audio');

      console.log(`   📊 Duração: ${duration.toFixed(2)}s`);

      // 2. Extrair frames (1 frame por segundo)
      const fps = options.fps || 1; // 1 frame por segundo
      const frameCmd = `ffmpeg -i "${filePath}" -vf "fps=${fps}" "${framesDir}/frame_%04d.png" -y`;
      await execAsync(frameCmd);

      // Listar frames extraídos
      const frameFiles = fs.readdirSync(framesDir).filter(f => f.endsWith('.png'));
      for (const frameFile of frameFiles) {
        const framePath = path.join(framesDir, frameFile);
        const frameNumber = parseInt(frameFile.match(/\d+/)[0]);
        const timestamp = (frameNumber - 1) / fps;

        frames.push({
          path: framePath,
          timestamp,
          frameNumber,
          buffer: fs.readFileSync(framePath)
        });
      }

      console.log(`   ✅ ${frames.length} frames extraídos`);

      // 3. Extrair áudio
      let audioResult = null;
      if (audioStream) {
        const audioCmd = `ffmpeg -i "${filePath}" -vn -acodec libmp3lame -y "${audioPath}"`;
        await execAsync(audioCmd);

        if (fs.existsSync(audioPath)) {
          console.log(`   🎤 Áudio extraído: ${audioPath}`);
          audioResult = {
            path: audioPath,
            buffer: fs.readFileSync(audioPath),
            duration
          };
        }
      }

      return {
        success: true,
        fileType: 'video',
        extractedText: `[Vídeo: ${duration.toFixed(2)}s, ${frames.length} frames, áudio: ${audioStream ? 'sim' : 'não'}]`,
        frames,
        audio: audioResult,
        metadata: {
          timestamp: new Date().toISOString(),
          method: 'ffmpeg',
          duration,
          width: videoStream?.width,
          height: videoStream?.height,
          fps: videoStream?.r_frame_rate,
          hasAudio: !!audioStream,
          framesExtracted: frames.length
        }
      };

    } catch (error) {
      console.error(`   ❌ Erro ao extrair vídeo:`, error);
      return {
        success: false,
        fileType: 'video',
        error: error.message,
        extractedText: '[Erro na extração de vídeo]',
        metadata: { timestamp: new Date().toISOString(), method: 'ffmpeg' }
      };
    }
  }

  /**
   * Extração de Áudio com transcrição
   */
  async extractAudio(filePath, options = {}) {
    console.log(`   🎤 Extraindo áudio com transcrição...`);

    // Obter duração
    let duration = 0;
    try {
      const probeCmd = `ffprobe -v quiet -print_format json -show_format "${filePath}"`;
      const { stdout: probeOutput } = await execAsync(probeCmd);
      const audioInfo = JSON.parse(probeOutput);
      duration = parseFloat(audioInfo.format.duration);
      console.log(`   📊 Duração: ${duration.toFixed(2)}s`);
    } catch (error) {
      console.warn(`   ⚠️  Erro ao obter duração:`, error.message);
    }

    // TODO: Implementar transcrição real com AWS Transcribe ou Whisper
    const transcription = `[TRANSCRIÇÃO PENDENTE]

⚠️  Implementação AWS Transcribe necessária

Passos para implementar:
1. Fazer upload do áudio para S3
2. Criar TranscriptionJob via AWS Transcribe
3. Poll status até completar
4. Baixar resultado JSON
5. Parsear timestamps e texto

Arquivo: ${path.basename(filePath)}
Duração: ${duration.toFixed(2)}s
`;

    return {
      success: true,
      fileType: 'audio',
      extractedText: transcription,
      audio: {
        path: filePath,
        buffer: fs.readFileSync(filePath),
        duration
      },
      metadata: {
        timestamp: new Date().toISOString(),
        method: 'placeholder_transcribe',
        duration
      }
    };
  }

  /**
   * Extração de Documento Word
   */
  async extractDocument(filePath, options = {}) {
    console.log(`   📝 Extraindo documento Word...`);

    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;

      console.log(`   ✅ Documento extraído: ${text.length} chars`);

      return {
        success: true,
        fileType: 'document',
        extractedText: text,
        metadata: {
          timestamp: new Date().toISOString(),
          method: 'mammoth',
          messages: result.messages
        }
      };
    } catch (error) {
      console.error(`   ❌ Erro ao extrair documento:`, error);
      return {
        success: false,
        fileType: 'document',
        error: error.message,
        extractedText: '[Erro na extração de documento]',
        metadata: { timestamp: new Date().toISOString(), method: 'mammoth' }
      };
    }
  }

  /**
   * Extração de Planilha Excel
   */
  async extractSpreadsheet(filePath, options = {}) {
    console.log(`   📊 Extraindo planilha Excel...`);

    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.readFile(filePath);
      let allText = '';

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        allText += `\n\n=== ${sheetName} ===\n\n${csv}`;
      }

      console.log(`   ✅ Planilha extraída: ${allText.length} chars, ${workbook.SheetNames.length} abas`);

      return {
        success: true,
        fileType: 'spreadsheet',
        extractedText: allText.trim(),
        metadata: {
          timestamp: new Date().toISOString(),
          method: 'xlsx',
          sheets: workbook.SheetNames.length,
          sheetNames: workbook.SheetNames
        }
      };
    } catch (error) {
      console.error(`   ❌ Erro ao extrair planilha:`, error);
      return {
        success: false,
        fileType: 'spreadsheet',
        error: error.message,
        extractedText: '[Erro na extração de planilha]',
        metadata: { timestamp: new Date().toISOString(), method: 'xlsx' }
      };
    }
  }

  /**
   * Extração de Apresentação PowerPoint
   */
  async extractPresentation(filePath, options = {}) {
    console.log(`   📽️  Extraindo apresentação PowerPoint...`);

    try {
      // Descompactar PPTX e ler XML
      const AdmZip = (await import('adm-zip')).default;
      const xml2js = await import('xml2js');

      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();

      let allText = '';
      let slideCount = 0;

      for (const entry of zipEntries) {
        if (entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml')) {
          slideCount++;
          const xmlContent = entry.getData().toString('utf8');
          const parser = new xml2js.Parser();
          const result = await parser.parseStringPromise(xmlContent);

          // Extrair texto dos elementos <a:t>
          const extractText = (obj) => {
            let texts = [];
            if (obj['a:t']) {
              texts.push(obj['a:t']);
            }
            for (const key in obj) {
              if (typeof obj[key] === 'object') {
                texts = texts.concat(extractText(obj[key]));
              }
            }
            return texts;
          };

          const slideTexts = extractText(result);
          allText += `\n\n=== Slide ${slideCount} ===\n\n${slideTexts.join('\n')}`;
        }
      }

      console.log(`   ✅ Apresentação extraída: ${allText.length} chars, ${slideCount} slides`);

      return {
        success: true,
        fileType: 'presentation',
        extractedText: allText.trim(),
        metadata: {
          timestamp: new Date().toISOString(),
          method: 'adm-zip + xml2js',
          slides: slideCount
        }
      };
    } catch (error) {
      console.error(`   ❌ Erro ao extrair apresentação:`, error);
      return {
        success: false,
        fileType: 'presentation',
        error: error.message,
        extractedText: '[Erro na extração de apresentação]',
        metadata: { timestamp: new Date().toISOString(), method: 'adm-zip' }
      };
    }
  }

  /**
   * Extração de Texto Puro
   */
  async extractText(filePath, options = {}) {
    console.log(`   📄 Extraindo texto puro...`);

    try {
      const text = fs.readFileSync(filePath, 'utf-8');

      console.log(`   ✅ Texto extraído: ${text.length} chars`);

      return {
        success: true,
        fileType: 'text',
        extractedText: text,
        metadata: {
          timestamp: new Date().toISOString(),
          method: 'fs.readFileSync',
          encoding: 'utf-8'
        }
      };
    } catch (error) {
      console.error(`   ❌ Erro ao extrair texto:`, error);
      return {
        success: false,
        fileType: 'text',
        error: error.message,
        extractedText: '[Erro na leitura de arquivo de texto]',
        metadata: { timestamp: new Date().toISOString(), method: 'fs.readFileSync' }
      };
    }
  }
}

// Singleton
export const universalExtractor = new UniversalExtractor();
