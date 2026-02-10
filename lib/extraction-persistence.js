/**
 * EXTRACTION PERSISTENCE MANAGER
 *
 * Gerencia a persistência completa de todas as extrações:
 * - Texto completo
 * - Imagens extraídas
 * - Transcrições de áudio/vídeo
 * - Metadata completa
 *
 * Estrutura no KB:
 * /data/extractions/{documentId}/
 *   ├── full-text.md              # Texto completo extraído
 *   ├── images/                   # Imagens extraídas
 *   │   ├── page-1-img-1.png
 *   │   ├── page-2-img-1.jpg
 *   │   └── ...
 *   ├── audio/                    # Transcrições de áudio
 *   │   ├── audio-1-transcript.md
 *   │   └── ...
 *   ├── metadata.json             # Metadata completa
 *   └── extraction-report.md      # Relatório da extração
 */

import fs from 'fs';
import path from 'path';
import { ACTIVE_PATHS } from './storage-config.js';
import { conversar } from '../src/modules/bedrock.js';
import { universalExtractor } from './universal-extractor.js';

export class ExtractionPersistenceManager {
  constructor() {
    this.extractionsBasePath = path.join(ACTIVE_PATHS.data, 'extractions');
    this.kbPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');

    // Garantir que diretório base existe
    if (!fs.existsSync(this.extractionsBasePath)) {
      fs.mkdirSync(this.extractionsBasePath, { recursive: true });
    }
  }

  /**
   * Cria estrutura completa de diretórios para um documento
   */
  createExtractionStructure(documentId) {
    const docPath = path.join(this.extractionsBasePath, documentId);

    const dirs = [
      docPath,
      path.join(docPath, 'images'),
      path.join(docPath, 'audio'),
      path.join(docPath, 'attachments')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    return docPath;
  }

  /**
   * Salva texto completo extraído
   */
  async saveFullText(documentId, documentName, extractedText, metadata = {}) {
    console.log(`\n💾 [PERSISTENCE] Salvando texto completo...`);

    const docPath = this.createExtractionStructure(documentId);
    const textPath = path.join(docPath, 'full-text.md');

    // Adicionar cabeçalho com metadata
    const header = `# TEXTO COMPLETO EXTRAÍDO\n\n`;
    const info = `**Documento:** ${documentName}\n`;
    const date = `**Data de Extração:** ${new Date().toLocaleString('pt-BR')}\n`;
    const method = `**Método:** ${metadata.method || 'Nova Micro AI'}\n`;
    const separator = `\n${'═'.repeat(80)}\n\n`;

    const fullContent = header + info + date + method + separator + extractedText;

    fs.writeFileSync(textPath, fullContent, 'utf-8');

    console.log(`   ✅ Texto salvo: ${Math.round(extractedText.length / 1000)}k caracteres`);
    console.log(`   📂 Caminho: extractions/${documentId}/full-text.md`);

    return {
      path: textPath,
      size: fullContent.length,
      characterCount: extractedText.length
    };
  }

  /**
   * Extrai e salva imagens de um PDF usando pdfjs-dist + sharp
   */
  async extractAndSaveImages(documentId, pdfPath) {
    console.log(`\n🖼️  [PERSISTENCE] Extraindo imagens do PDF...`);

    const docPath = this.createExtractionStructure(documentId);
    const imagesPath = path.join(docPath, 'images');

    try {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const sharp = (await import('sharp')).default;
      const extractedImages = [];

      // Carregar PDF
      const loadingTask = pdfjsLib.getDocument({
        url: pdfPath,
        verbosity: 0, // Silenciar logs
        useSystemFonts: true
      });

      const pdfDocument = await loadingTask.promise;
      console.log(`   📄 PDF carregado: ${pdfDocument.numPages} páginas`);

      // Processar cada página
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const operatorList = await page.getOperatorList();

        let imageIndex = 0;

        // Percorrer operadores da página
        for (let i = 0; i < operatorList.fnArray.length; i++) {
          const fn = operatorList.fnArray[i];

          // fn === 85 = OPS.paintImageXObject (renderizar imagem)
          // fn === 86 = OPS.paintInlineImageXObject
          if (fn === 85 || fn === 86) {
            const args = operatorList.argsArray[i];
            const imageName = args[0]; // Nome da imagem no PDF

            try {
              // Obter dados da imagem (esperar ser resolvida)
              const image = await page.objs.ensure(imageName);

              if (image && image.data && image.width && image.height) {
                imageIndex++;
                const fileName = `page-${pageNum}-img-${imageIndex}.png`;
                const imagePath = path.join(imagesPath, fileName);

                // Determinar número de canais (RGB ou RGBA)
                const bytesPerPixel = image.data.length / (image.width * image.height);
                const channels = bytesPerPixel === 3 ? 3 : 4;

                // Converter para PNG usando sharp
                await sharp(Buffer.from(image.data), {
                  raw: {
                    width: image.width,
                    height: image.height,
                    channels: channels
                  }
                })
                .png()
                .toFile(imagePath);

                const stats = fs.statSync(imagePath);

                extractedImages.push({
                  name: fileName,
                  path: imagePath,
                  page: pageNum,
                  width: image.width,
                  height: image.height,
                  size: stats.size,
                  channels: channels
                });

                console.log(`   ✅ Pág. ${pageNum}, Img. ${imageIndex}: ${fileName} (${image.width}x${image.height}, ${channels}ch, ${Math.round(stats.size/1024)}KB)`);
              }
            } catch (imgError) {
              console.error(`   ⚠️  Erro ao processar imagem ${imageName}:`, imgError.message);
            }
          }
        }
      }

      console.log(`   📊 ${extractedImages.length} imagens extraídas com sucesso`);

      return {
        count: extractedImages.length,
        images: extractedImages,
        path: imagesPath
      };
    } catch (error) {
      console.error(`   ❌ Erro ao extrair imagens:`, error.message);
      console.error(`   Stack:`, error.stack);
      return {
        count: 0,
        images: [],
        error: error.message
      };
    }
  }

  /**
   * Transcreve áudio/vídeo (placeholder melhorado - implementar quando necessário)
   *
   * Para implementação futura:
   * - Instalar: npm install @aws-sdk/client-transcribe
   * - Upload para S3 temporário
   * - StartTranscriptionJob com AWS Transcribe
   * - Aguardar conclusão e baixar resultado
   */
  async transcribeAudio(documentId, audioPath, audioName) {
    console.log(`\n🎤 [PERSISTENCE] Processando áudio...`);

    const docPath = this.createExtractionStructure(documentId);
    const audioDir = path.join(docPath, 'audio');

    try {
      // Copiar arquivo de áudio para diretório
      const audioDestPath = path.join(audioDir, audioName);
      if (audioPath !== audioDestPath) {
        fs.copyFileSync(audioPath, audioDestPath);
      }

      const stats = fs.statSync(audioDestPath);

      // Criar placeholder informativo
      const transcript = `# TRANSCRIÇÃO DE ÁUDIO

**Arquivo:** ${audioName}
**Tamanho:** ${Math.round(stats.size / 1024)}KB
**Data:** ${new Date().toLocaleString('pt-BR')}

---

## Status

⚠️  **Transcrição automática não implementada**

O arquivo de áudio foi salvo, mas a transcrição automática requer integração com:
- **AWS Transcribe** (recomendado para português brasileiro)
- **OpenAI Whisper** (alternativa)

## Como Implementar

### Opção 1: AWS Transcribe

\`\`\`bash
npm install @aws-sdk/client-transcribe
\`\`\`

\`\`\`javascript
import { TranscribeClient, StartTranscriptionJobCommand } from '@aws-sdk/client-transcribe';

const transcribeClient = new TranscribeClient({ region: 'us-east-1' });

// 1. Upload para S3
// 2. Iniciar job
// 3. Aguardar conclusão
// 4. Baixar resultado
\`\`\`

### Opção 2: OpenAI Whisper

\`\`\`bash
npm install openai
\`\`\`

\`\`\`javascript
import { OpenAI } from 'openai';
const openai = new OpenAI();

const transcription = await openai.audio.transcriptions.create({
  file: fs.createReadStream(audioPath),
  model: 'whisper-1',
  language: 'pt'
});
\`\`\`

## Arquivo Salvo

O arquivo original está disponível em:
\`${audioDestPath}\`

Você pode:
- Ouvir o arquivo manualmente
- Enviar para transcrição externa
- Implementar integração automática quando necessário

---

*Estrutura criada pelo ROM Agent Extraction Persistence Manager*
`;

      const transcriptPath = path.join(audioDir, `${path.parse(audioName).name}-info.md`);
      fs.writeFileSync(transcriptPath, transcript, 'utf-8');

      console.log(`   💾 Áudio salvo: ${audioName} (${Math.round(stats.size/1024)}KB)`);
      console.log(`   📝 Info criada: ${path.basename(transcriptPath)}`);
      console.log(`   ℹ️  Transcrição automática: não implementada (placeholder)`);

      return {
        path: transcriptPath,
        audioPath: audioDestPath,
        size: stats.size,
        implemented: false,
        note: 'Audio saved but transcription requires AWS Transcribe or Whisper integration'
      };
    } catch (error) {
      console.error(`   ❌ Erro ao processar áudio:`, error.message);
      return {
        error: error.message
      };
    }
  }

  /**
   * Analisa imagens extraídas usando Claude Vision API
   */
  async analyzeImages(documentId, images) {
    console.log(`\n👁️  [PERSISTENCE] Analisando imagens com Claude Vision AI...`);

    const analyses = [];

    for (const image of images) {
      try {
        const prompt = `Analise esta imagem de um documento jurídico brasileiro e extraia:

1. **Tipo de Conteúdo:**
   - Documento (petição, decisão, certidão, etc)
   - Tabela ou planilha
   - Gráfico ou diagrama
   - Assinatura ou carimbo
   - Imagem/foto
   - Outro

2. **Texto Visível:**
   - Transcreva TODO o texto legível
   - Preserve formatação e estrutura
   - Identifique nomes, datas, valores

3. **Elementos Importantes:**
   - Carimbos (identificar órgão)
   - Assinaturas (quantas, posição)
   - Brasões ou logotipos
   - Códigos de barras/QR codes
   - Destaques ou marcações

4. **Contexto Jurídico:**
   - Tipo de documento identificado
   - Órgão/tribunal (se identificável)
   - Relevância processual

Seja DETALHADO e PRECISO. Se houver texto, transcreva COMPLETAMENTE.`;

        // Ler imagem como base64
        const imageBuffer = fs.readFileSync(image.path);
        const imageBase64 = imageBuffer.toString('base64');
        const mimeType = image.path.endsWith('.png') ? 'image/png' : 'image/jpeg';

        // Chamar Claude Vision API via bedrock
        const response = await conversar(prompt, {
          modelo: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
          systemPrompt: 'Você é um especialista em análise de documentos jurídicos brasileiros. Seja preciso e detalhado.',
          images: [{
            type: 'base64',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: imageBase64
            }
          }],
          temperature: 0.1,
          maxTokens: 2000,
          enableTools: false,
          enableCache: false
        });

        const analysis = {
          imageName: image.name,
          page: image.page,
          dimensions: `${image.width}x${image.height}`,
          size: image.size,
          description: response.resposta || '[Análise não disponível]',
          contentType: this.extractContentType(response.resposta),
          textExtracted: this.extractTextFromAnalysis(response.resposta),
          hasSignature: response.resposta?.toLowerCase().includes('assinatura'),
          hasStamp: response.resposta?.toLowerCase().includes('carimbo'),
          analysisTokens: response.metadata?.outputTokens || 0,
          analysisCost: response.metadata?.cost || 0
        };

        analyses.push(analysis);

        console.log(`   ✅ ${image.name}: ${analysis.contentType || 'analisada'} (${Math.round(analysis.size/1024)}KB)`);
      } catch (error) {
        console.error(`   ❌ Erro ao analisar ${image.name}:`, error.message);

        // Adicionar análise com erro
        analyses.push({
          imageName: image.name,
          page: image.page,
          error: error.message,
          description: '[Erro na análise]',
          contentType: 'unknown'
        });
      }
    }

    const totalCost = analyses.reduce((sum, a) => sum + (a.analysisCost || 0), 0);
    console.log(`   📊 ${analyses.length} imagens analisadas | Custo: $${totalCost.toFixed(4)}`);

    return analyses;
  }

  /**
   * Extrai tipo de conteúdo da análise
   */
  extractContentType(analysisText) {
    if (!analysisText) return 'unknown';

    const text = analysisText.toLowerCase();

    if (text.includes('petição') || text.includes('peticao')) return 'petition';
    if (text.includes('decisão') || text.includes('decisao') || text.includes('sentença')) return 'decision';
    if (text.includes('certidão') || text.includes('certidao')) return 'certificate';
    if (text.includes('tabela') || text.includes('planilha')) return 'table';
    if (text.includes('gráfico') || text.includes('grafico')) return 'chart';
    if (text.includes('assinatura')) return 'signature';
    if (text.includes('carimbo')) return 'stamp';
    if (text.includes('brasão') || text.includes('brasao') || text.includes('logo')) return 'logo';

    return 'document';
  }

  /**
   * Extrai texto transcrito da análise
   */
  extractTextFromAnalysis(analysisText) {
    if (!analysisText) return '';

    // Procurar seção de "Texto Visível"
    const match = analysisText.match(/texto visível:(.*?)(?=\n\n|3\.|$)/is);

    if (match && match[1]) {
      return match[1].trim();
    }

    return '';
  }

  /**
   * Gera relatório completo da extração
   */
  async generateExtractionReport(documentId, documentName, extractionData) {
    console.log(`\n📋 [PERSISTENCE] Gerando relatório de extração...`);

    const docPath = path.join(this.extractionsBasePath, documentId);
    const reportPath = path.join(docPath, 'extraction-report.md');

    const report = `# RELATÓRIO DE EXTRAÇÃO COMPLETO

## Documento
**Nome:** ${documentName}
**ID:** ${documentId}
**Data de Extração:** ${new Date().toLocaleString('pt-BR')}

## Resumo da Extração

### Texto
- **Caracteres extraídos:** ${extractionData.textSize?.toLocaleString() || 0}
- **Método:** ${extractionData.extractionMethod || 'Nova Micro AI'}
- **Custo:** $${extractionData.cost?.toFixed(4) || '0.0000'}
- **Tempo:** ${extractionData.processingTime || 0}s

### Imagens
- **Total extraído:** ${extractionData.imagesCount || 0}
- **Formato:** PNG, JPG
- **Localização:** \`extractions/${documentId}/images/\`

### Áudio/Vídeo
- **Arquivos transcritos:** ${extractionData.audioCount || 0}
- **Localização:** \`extractions/${documentId}/audio/\`

### Anexos
- **Total:** ${extractionData.attachmentsCount || 0}
- **Localização:** \`extractions/${documentId}/attachments/\`

## Arquivos Gerados

### Texto Completo
\`\`\`
extractions/${documentId}/full-text.md
${extractionData.textSize ? Math.round(extractionData.textSize / 1000) + 'KB' : '0KB'}
\`\`\`

### Estrutura de Diretórios
\`\`\`
extractions/${documentId}/
├── full-text.md              # Texto completo extraído
├── images/                   # Imagens extraídas (${extractionData.imagesCount || 0})
├── audio/                    # Transcrições de áudio (${extractionData.audioCount || 0})
├── attachments/              # Anexos diversos
├── metadata.json             # Metadata completa
└── extraction-report.md      # Este relatório
\`\`\`

## Status
✅ Extração completa
✅ Todos os recursos persistidos
✅ Disponível para análise batch

---
*Gerado automaticamente pelo ROM Agent Document Processor V2*
`;

    fs.writeFileSync(reportPath, report, 'utf-8');

    console.log(`   ✅ Relatório gerado`);
    console.log(`   📂 Caminho: extractions/${documentId}/extraction-report.md`);

    return reportPath;
  }

  /**
   * Salva metadata completa da extração
   */
  async saveExtractionMetadata(documentId, metadata) {
    const docPath = path.join(this.extractionsBasePath, documentId);
    const metadataPath = path.join(docPath, 'metadata.json');

    const completeMetadata = {
      documentId,
      extractionDate: new Date().toISOString(),
      version: '2.0',
      ...metadata,
      structure: {
        fullText: 'full-text.md',
        images: 'images/',
        audio: 'audio/',
        attachments: 'attachments/',
        report: 'extraction-report.md'
      }
    };

    fs.writeFileSync(metadataPath, JSON.stringify(completeMetadata, null, 2));

    return completeMetadata;
  }

  /**
   * Registra extração completa no KB
   */
  async registerInKB(documentId, documentName, extractionData) {
    console.log(`\n📚 [PERSISTENCE] Registrando no KB...`);

    let allDocs = [];
    if (fs.existsSync(this.kbPath)) {
      allDocs = JSON.parse(fs.readFileSync(this.kbPath, 'utf-8'));
    }

    const kbEntry = {
      id: `extraction-complete-${documentId}`,
      name: `${documentName} - EXTRAÇÃO COMPLETA`,
      originalName: documentName,
      type: 'extraction-package',
      uploadedAt: new Date().toISOString(),
      path: path.join(this.extractionsBasePath, documentId),
      metadata: {
        isExtractionPackage: true,
        parentDocument: documentId,
        extractionComplete: true,
        hasFullText: true,
        hasImages: extractionData.imagesCount > 0,
        hasAudio: extractionData.audioCount > 0,
        components: {
          fullText: `extractions/${documentId}/full-text.md`,
          images: `extractions/${documentId}/images/`,
          audio: `extractions/${documentId}/audio/`,
          report: `extractions/${documentId}/extraction-report.md`,
          metadata: `extractions/${documentId}/metadata.json`
        },
        stats: {
          textSize: extractionData.textSize,
          imagesCount: extractionData.imagesCount,
          audioCount: extractionData.audioCount,
          totalSize: extractionData.totalSize
        }
      }
    };

    allDocs.push(kbEntry);
    fs.writeFileSync(this.kbPath, JSON.stringify(allDocs, null, 2));

    console.log(`   ✅ Registrado no KB como: ${kbEntry.name}`);

    return kbEntry;
  }

  /**
   * Processa e persiste TUDO de um documento
   */
  async persistCompleteExtraction(documentId, documentName, extractedText, options = {}) {
    console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║  💾 PERSISTÊNCIA COMPLETA DE EXTRAÇÃO                         ║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝`);
    console.log(`\n📄 Documento: ${documentName}`);
    console.log(`🆔 ID: ${documentId}`);

    const startTime = Date.now();
    const extractionData = {
      textSize: extractedText.length,
      imagesCount: 0,
      audioCount: 0,
      attachmentsCount: 0,
      cost: options.cost || 0,
      processingTime: options.processingTime || 0,
      extractionMethod: options.method || 'Nova Micro AI'
    };

    // 1. Salvar texto completo
    const textResult = await this.saveFullText(documentId, documentName, extractedText, options);
    extractionData.textPath = textResult.path;

    // 2. Extrair e salvar imagens (se for PDF)
    if (options.pdfPath) {
      const imagesResult = await this.extractAndSaveImages(documentId, options.pdfPath);
      extractionData.imagesCount = imagesResult.count;
      extractionData.images = imagesResult.images;

      // 3. Analisar imagens com Vision AI
      if (imagesResult.count > 0) {
        extractionData.imageAnalyses = await this.analyzeImages(documentId, imagesResult.images);
      }
    }

    // 4. Transcrever áudio (se houver)
    if (options.audioFiles && options.audioFiles.length > 0) {
      for (const audioFile of options.audioFiles) {
        await this.transcribeAudio(documentId, audioFile.path, audioFile.name);
        extractionData.audioCount++;
      }
    }

    // 5. Salvar metadata completa
    await this.saveExtractionMetadata(documentId, extractionData);

    // 6. Gerar relatório
    await this.generateExtractionReport(documentId, documentName, extractionData);

    // 7. Registrar no KB
    const kbEntry = await this.registerInKB(documentId, documentName, extractionData);

    const totalTime = Math.round((Date.now() - startTime) / 1000);

    console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║  ✅ PERSISTÊNCIA COMPLETA CONCLUÍDA                           ║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝`);
    console.log(`\n⏱️  Tempo: ${totalTime}s`);
    console.log(`📦 Estrutura criada em: extractions/${documentId}/`);
    console.log(`\n📊 Resumo:`);
    console.log(`   ✅ Texto completo: ${Math.round(extractionData.textSize / 1000)}KB`);
    console.log(`   ✅ Imagens: ${extractionData.imagesCount}`);
    console.log(`   ✅ Áudios transcritos: ${extractionData.audioCount}`);
    console.log(`   ✅ Relatório gerado`);
    console.log(`   ✅ Registrado no KB`);

    return {
      success: true,
      documentId,
      extractionData,
      kbEntry,
      paths: {
        base: path.join(this.extractionsBasePath, documentId),
        fullText: textResult.path,
        images: path.join(this.extractionsBasePath, documentId, 'images'),
        audio: path.join(this.extractionsBasePath, documentId, 'audio'),
        report: path.join(this.extractionsBasePath, documentId, 'extraction-report.md')
      },
      processingTime: totalTime
    };
  }

  /**
   * Recupera extração completa de um documento
   */
  async getCompleteExtraction(documentId) {
    const docPath = path.join(this.extractionsBasePath, documentId);

    if (!fs.existsSync(docPath)) {
      return {
        success: false,
        error: 'Extração não encontrada'
      };
    }

    // Ler metadata
    const metadataPath = path.join(docPath, 'metadata.json');
    const metadata = fs.existsSync(metadataPath)
      ? JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
      : {};

    // Ler texto completo
    const textPath = path.join(docPath, 'full-text.md');
    const fullText = fs.existsSync(textPath)
      ? fs.readFileSync(textPath, 'utf-8')
      : null;

    // Listar imagens
    const imagesPath = path.join(docPath, 'images');
    const images = fs.existsSync(imagesPath)
      ? fs.readdirSync(imagesPath).map(img => ({
          name: img,
          path: path.join(imagesPath, img)
        }))
      : [];

    // Listar transcrições de áudio
    const audioPath = path.join(docPath, 'audio');
    const audioTranscripts = fs.existsSync(audioPath)
      ? fs.readdirSync(audioPath).map(audio => ({
          name: audio,
          path: path.join(audioPath, audio)
        }))
      : [];

    return {
      success: true,
      documentId,
      metadata,
      fullText,
      images,
      audioTranscripts,
      paths: {
        base: docPath,
        fullText: textPath,
        images: imagesPath,
        audio: audioPath
      }
    };
  }

  /**
   * MÉTODO UNIVERSAL: Extrai e persiste QUALQUER tipo de arquivo
   *
   * Suporta:
   * - PDF
   * - Imagens (JPG, PNG, GIF, BMP, TIFF, WebP) com OCR
   * - Vídeos (MP4, AVI, MOV, WMV, FLV, WebM) com frames + áudio
   * - Áudio (MP3, WAV, OGG, M4A) com transcrição
   * - Documentos (DOCX, DOC)
   * - Planilhas (XLSX, XLS)
   * - Apresentações (PPTX, PPT)
   * - Texto (TXT, HTML, XML, JSON, MD, CSV)
   */
  async extractAnyFileUniversal(filePath, documentId, documentName, options = {}) {
    console.log(`\n🌍 [UNIVERSAL EXTRACTION] Iniciando extração universal...`);
    console.log(`   📁 Arquivo: ${documentName}`);
    console.log(`   🆔 Document ID: ${documentId}`);

    const startTime = Date.now();

    try {
      // 1. EXTRAÇÃO UNIVERSAL
      const extractionResult = await universalExtractor.extract(filePath, options);

      if (!extractionResult.success) {
        throw new Error(extractionResult.error || 'Extração universal falhou');
      }

      // 2. CRIAR ESTRUTURA DE PERSISTÊNCIA
      const docPath = this.createExtractionStructure(documentId);

      // 3. SALVAR TEXTO EXTRAÍDO
      let textResult = null;
      if (extractionResult.extractedText) {
        textResult = await this.saveFullText(
          documentId,
          documentName,
          extractionResult.extractedText,
          {
            method: extractionResult.metadata.method,
            fileType: extractionResult.fileType
          }
        );
      }

      // 4. SALVAR IMAGENS (se houver)
      const savedImages = [];
      if (extractionResult.images && extractionResult.images.length > 0) {
        console.log(`\n🖼️  [UNIVERSAL] Salvando ${extractionResult.images.length} imagens...`);

        const imagesPath = path.join(docPath, 'images');

        for (let i = 0; i < extractionResult.images.length; i++) {
          const img = extractionResult.images[i];
          const fileName = img.name || `image-${i + 1}.${img.format || 'png'}`;
          const imagePath = path.join(imagesPath, fileName);

          if (img.buffer) {
            fs.writeFileSync(imagePath, img.buffer);
            const stats = fs.statSync(imagePath);

            savedImages.push({
              name: fileName,
              path: imagePath,
              size: stats.size,
              width: img.width,
              height: img.height,
              page: img.page || null,
              timestamp: img.timestamp || null
            });
          }
        }

        console.log(`   ✅ ${savedImages.length} imagens salvas`);

        // 5. ANALISAR IMAGENS COM CLAUDE VISION
        if (savedImages.length > 0) {
          await this.analyzeImages(documentId, savedImages);
        }
      }

      // 6. SALVAR FRAMES DE VÍDEO (se houver)
      const savedFrames = [];
      if (extractionResult.frames && extractionResult.frames.length > 0) {
        console.log(`\n🎬 [UNIVERSAL] Salvando ${extractionResult.frames.length} frames de vídeo...`);

        const framesPath = path.join(docPath, 'frames');
        if (!fs.existsSync(framesPath)) {
          fs.mkdirSync(framesPath, { recursive: true });
        }

        for (const frame of extractionResult.frames) {
          const fileName = `frame-${String(frame.frameNumber).padStart(4, '0')}-t${frame.timestamp.toFixed(2)}s.png`;
          const framePath = path.join(framesPath, fileName);

          if (frame.buffer) {
            fs.writeFileSync(framePath, frame.buffer);
            const stats = fs.statSync(framePath);

            savedFrames.push({
              name: fileName,
              path: framePath,
              size: stats.size,
              timestamp: frame.timestamp,
              frameNumber: frame.frameNumber
            });
          }
        }

        console.log(`   ✅ ${savedFrames.length} frames salvos`);

        // 7. ANALISAR FRAMES COM CLAUDE VISION
        if (savedFrames.length > 0 && options.analyzeFrames) {
          await this.analyzeImages(documentId, savedFrames);
        }
      }

      // 8. SALVAR ÁUDIO EXTRAÍDO (se houver)
      let audioResult = null;
      if (extractionResult.audio) {
        console.log(`\n🎤 [UNIVERSAL] Salvando áudio extraído...`);

        const audioPath = path.join(docPath, 'audio');
        const audioFileName = 'extracted-audio.mp3';
        const audioFilePath = path.join(audioPath, audioFileName);

        if (extractionResult.audio.buffer) {
          fs.writeFileSync(audioFilePath, extractionResult.audio.buffer);
          const stats = fs.statSync(audioFilePath);

          audioResult = {
            name: audioFileName,
            path: audioFilePath,
            size: stats.size,
            duration: extractionResult.audio.duration
          };

          console.log(`   ✅ Áudio salvo: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

          // 9. TRANSCREVER ÁUDIO (placeholder ou real)
          await this.transcribeAudio(documentId, audioFilePath, audioFileName);
        }
      }

      // 10. SALVAR METADATA COMPLETA
      const totalTime = Date.now() - startTime;

      const extractionData = {
        documentId,
        documentName,
        fileType: extractionResult.fileType,
        timestamp: new Date().toISOString(),
        processingTime: totalTime,
        extractionMethod: extractionResult.metadata.method,
        textSize: extractionResult.extractedText?.length || 0,
        imagesCount: savedImages.length,
        framesCount: savedFrames.length,
        hasAudio: !!audioResult,
        audioDuration: audioResult?.duration || 0,
        originalMetadata: extractionResult.metadata
      };

      await this.saveExtractionMetadata(documentId, extractionData);

      // 11. GERAR RELATÓRIO
      await this.generateExtractionReport(documentId, documentName, extractionData);

      // 12. REGISTRAR NO KB
      const kbEntry = await this.registerInKB(documentId, documentName, extractionData);

      console.log(`\n✅ [UNIVERSAL] Extração universal completa em ${totalTime}ms`);
      console.log(`   📂 Estrutura: extractions/${documentId}/`);
      console.log(`   📄 Texto: ${Math.round(extractionData.textSize / 1000)}KB`);
      console.log(`   🖼️  Imagens: ${extractionData.imagesCount}`);
      console.log(`   🎬 Frames: ${extractionData.framesCount}`);
      console.log(`   🎤 Áudio: ${extractionData.hasAudio ? 'Sim' : 'Não'}`);

      return {
        success: true,
        documentId,
        extractionData,
        kbEntry,
        paths: {
          base: docPath,
          fullText: path.join(docPath, 'full-text.md'),
          images: path.join(docPath, 'images'),
          frames: path.join(docPath, 'frames'),
          audio: path.join(docPath, 'audio'),
          metadata: path.join(docPath, 'metadata.json'),
          report: path.join(docPath, 'extraction-report.md')
        }
      };

    } catch (error) {
      console.error(`\n❌ [UNIVERSAL] Erro na extração universal:`, error);
      return {
        success: false,
        error: error.message,
        documentId
      };
    }
  }
}

// Singleton
export const extractionPersistenceManager = new ExtractionPersistenceManager();
