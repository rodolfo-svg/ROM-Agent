/**
 * ROM Agent - KB Analyze V2 Direct Endpoint
 *
 * Endpoint direto para análise V2 de documentos da KB
 * Bypassa o LLM e invoca documentProcessorV2 diretamente
 *
 * @version 1.0.0
 */

import express from 'express';
import { documentProcessorV2 } from '../../lib/document-processor-v2.js';
import { ACTIVE_PATHS } from '../../lib/storage-config.js';
import extractionProgressService from '../services/extraction-progress.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

/**
 * POST /api/kb/analyze-v2
 *
 * Analisa documento da KB usando arquitetura V2
 *
 * Body:
 * {
 *   "documentName": "Report01770235205448.pdf",
 *   "analysisType": "complete" | "extract_only" | "custom",
 *   "model": "haiku" | "sonnet" | "opus",
 *   "customPrompt": "string" (opcional, apenas para custom)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "extraction": { ... },
 *     "intermediateDoc": { ... },
 *     "technicalFiles": { ... },
 *     "metadata": { ... }
 *   }
 * }
 */
router.post('/', async (req, res) => {
  try {
    console.log('\n🔬 [V2 Direct] Requisição recebida');

    const {
      documentName,
      analysisType = 'complete',
      model = 'sonnet',
      customPrompt = ''
    } = req.body;

    // Validação de parâmetros
    if (!documentName) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "documentName" é obrigatório'
      });
    }

    const validAnalysisTypes = ['complete', 'extract_only', 'custom'];
    if (!validAnalysisTypes.includes(analysisType)) {
      return res.status(400).json({
        success: false,
        error: `analysisType deve ser um de: ${validAnalysisTypes.join(', ')}`
      });
    }

    const validModels = ['haiku', 'sonnet', 'opus'];
    if (!validModels.includes(model)) {
      return res.status(400).json({
        success: false,
        error: `model deve ser um de: ${validModels.join(', ')}`
      });
    }

    if (analysisType === 'custom' && !customPrompt) {
      return res.status(400).json({
        success: false,
        error: 'customPrompt é obrigatório quando analysisType="custom"'
      });
    }

    console.log(`   📄 Documento: ${documentName}`);
    console.log(`   🔧 Tipo: ${analysisType}`);
    console.log(`   🤖 Modelo: ${model}`);

    // Buscar documento na KB
    const kbDocsPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');

    if (!fs.existsSync(kbDocsPath)) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge Base vazia. Faça upload de documentos primeiro.'
      });
    }

    const allDocs = JSON.parse(fs.readFileSync(kbDocsPath, 'utf8'));
    console.log(`   📚 Total de documentos na KB: ${allDocs.length}`);

    // 🚨 FIX CRÍTICO: Filtrar extraction packages (são diretórios, não arquivos)
    const validDocs = allDocs.filter(d => !d.metadata?.isExtractionPackage);
    console.log(`   ✅ Documentos válidos (sem extraction packages): ${validDocs.length}`);

    // Busca melhorada
    const doc = validDocs.find(d => {
      const searchName = documentName.toLowerCase();
      return d.name?.toLowerCase().includes(searchName) ||
             d.originalName?.toLowerCase().includes(searchName) ||
             d.metadata?.parentDocument?.toLowerCase().includes(searchName) ||
             d.id?.toLowerCase().includes(searchName);
    });

    if (!doc) {
      const availableDocs = allDocs
        .filter(d => !d.metadata?.isStructuredDocument)
        .slice(0, 10)
        .map(d => d.originalName || d.name || d.id);

      return res.status(404).json({
        success: false,
        error: `Documento "${documentName}" não encontrado na KB`,
        availableDocuments: availableDocs,
        totalDocuments: allDocs.length
      });
    }

    console.log(`   ✅ Documento encontrado: ${doc.name || doc.originalName}`);
    console.log(`   📂 Path: ${doc.path}`);
    console.log(`   👤 Owner userId: ${doc.userId || 'não definido'}`);

    // ═══════════════════════════════════════════════════════════
    // MERGE-FIRST ANALYSIS: Detectar documentos mesclados
    // ═══════════════════════════════════════════════════════════
    const isMergedDocument = doc.metadata?.isMergedDocument === true;
    const sourceVolumes = doc.metadata?.sourceVolumes || [];

    // Obter texto do documento (com fallback)
    let rawText;
    let isPDF = false;

    // Tentar ler do path físico primeiro
    if (doc.path && fs.existsSync(doc.path)) {
      console.log(`   ✅ Path existe no disco: ${doc.path}`);

      // 🚨 VALIDAÇÃO CRÍTICA: Verificar se é arquivo e não diretório
      const stats = fs.statSync(doc.path);
      if (stats.isDirectory()) {
        console.error(`   ❌ ERRO: Path é um DIRETÓRIO, não um arquivo!`);
        console.error(`      Path: ${doc.path}`);
        console.error(`      Isso indica bug no upload - path deve ser arquivo, não pasta`);

        return res.status(500).json({
          success: false,
          error: `Path do documento é um diretório, não um arquivo`,
          path: doc.path,
          details: {
            isDirectory: true,
            message: 'O documento foi salvo incorretamente. Por favor, faça upload novamente.'
          }
        });
      }

      console.log(`   📖 Lendo arquivo do disco...`);
      console.log(`   📊 Tamanho no disco: ${Math.round(stats.size / 1024)}KB`);

      try {
      const fileExtension = path.extname(doc.path).toLowerCase();

      if (fileExtension === '.pdf' && isMergedDocument && sourceVolumes.length > 0) {
        // ═══════════════════════════════════════════════════════════
        // DOCUMENTO MESCLADO: Processar volumes originais em PARALELO
        // ═══════════════════════════════════════════════════════════
        console.log(`\n   🔀 DOCUMENTO MESCLADO DETECTADO`);
        console.log(`   📦 ${sourceVolumes.length} volumes originais encontrados`);
        console.log(`   🚀 Estratégia: Extrair texto de cada volume em PARALELO`);
        console.log(`   💡 Análise será ÚNICA e CONSOLIDADA (custo menor, 1 arquivo)`);

        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;

        // Processar volumes em paralelo
        const volumePromises = sourceVolumes.map(async (volume, index) => {
          console.log(`\n   📄 Volume ${index + 1}/${sourceVolumes.length}: ${volume.originalName}`);

          if (!volume.path || !fs.existsSync(volume.path)) {
            console.log(`   ⚠️  Arquivo não encontrado: ${volume.path}`);
            return {
              index,
              text: `\n\n═══════════════════════════════════════\nVOLUME ${index + 1}: ${volume.originalName}\n[ARQUIVO NÃO ENCONTRADO]\n═══════════════════════════════════════\n\n`,
              pages: 0,
              error: 'Arquivo não encontrado'
            };
          }

          try {
            const startTime = Date.now();
            const dataBuffer = fs.readFileSync(volume.path);
            const pdfData = await pdfParse(dataBuffer);
            const elapsed = Math.round((Date.now() - startTime) / 1000);

            console.log(`   ✅ Volume ${index + 1} processado em ${elapsed}s`);
            console.log(`      Páginas: ${pdfData.numpages}`);
            console.log(`      Texto: ${Math.round(pdfData.text.length / 1000)}k chars`);

            return {
              index,
              text: `\n\n═══════════════════════════════════════\nVOLUME ${index + 1}: ${volume.originalName}\nPÁGINAS: ${pdfData.numpages}\n═══════════════════════════════════════\n\n${pdfData.text}`,
              pages: pdfData.numpages,
              size: pdfData.text.length
            };
          } catch (error) {
            console.log(`   ❌ Erro no volume ${index + 1}: ${error.message}`);
            return {
              index,
              text: `\n\n═══════════════════════════════════════\nVOLUME ${index + 1}: ${volume.originalName}\n[ERRO AO PROCESSAR: ${error.message}]\n═══════════════════════════════════════\n\n`,
              pages: 0,
              error: error.message
            };
          }
        });

        const volumeResults = await Promise.all(volumePromises);

        // Concatenar textos na ordem correta
        rawText = volumeResults
          .sort((a, b) => a.index - b.index)
          .map(v => v.text)
          .join('\n\n');

        const totalPages = volumeResults.reduce((sum, v) => sum + (v.pages || 0), 0);

        console.log(`\n   ✅ MERGE-FIRST COMPLETO`);
        console.log(`   📊 Total: ${totalPages} páginas, ${Math.round(rawText.length / 1000)}k caracteres`);
        console.log(`   💰 Custo de extração: $0 (pdf-parse)`);
        console.log(`   🎯 Próximo: Análise ÚNICA e CONSOLIDADA`);

        isPDF = true;

      } else if (fileExtension === '.pdf') {
        // PDF simples (não mesclado)
        console.log(`   📄 Arquivo PDF detectado - extraindo texto...`);
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
        const dataBuffer = fs.readFileSync(doc.path);
        const pdfData = await pdfParse(dataBuffer);
        rawText = pdfData.text;
        isPDF = true;
        console.log(`   ✅ PDF parseado: ${pdfData.numpages} páginas`);
        console.log(`   📊 Texto extraído: ${Math.round(rawText.length / 1000)}k caracteres`);

        // 🔥 FIX v2: Detectar PDF escaneado por múltiplos critérios
        const charsPerPage = rawText.length / pdfData.numpages;
        const fileSizeKB = fs.statSync(doc.path).size / 1024;
        const textSizeKB = rawText.length / 1024;
        const textToFileSizeRatio = textSizeKB / fileSizeKB;

        console.log(`   📊 Análise de PDF:`);
        console.log(`      Arquivo: ${Math.round(fileSizeKB)} KB`);
        console.log(`      Texto: ${Math.round(textSizeKB)} KB`);
        console.log(`      Chars/página: ${Math.round(charsPerPage)}`);
        console.log(`      Ratio texto/arquivo: ${(textToFileSizeRatio * 100).toFixed(2)}%`);

        // 🔥 MODO FORÇADO: Para PDFs grandes (>10 MB), SEMPRE tentar OCR
        const FORCE_OCR_SIZE_MB = 10;
        const fileSizeMB = fileSizeKB / 1024;
        const shouldForceOCR = fileSizeMB > FORCE_OCR_SIZE_MB;

        // PDF escaneado tem MUITO menos texto que o tamanho do arquivo
        const MIN_TEXT_RATIO = 0.01; // 1% - se texto é menos que 1% do arquivo, é escaneado
        const MIN_CHARS_PER_PAGE = 500; // Ou menos que 500 chars/página

        const isScannedByRatio = textToFileSizeRatio < MIN_TEXT_RATIO || charsPerPage < MIN_CHARS_PER_PAGE;
        const isScanned = isScannedByRatio || shouldForceOCR;

        if (isScanned) {
          if (shouldForceOCR && !isScannedByRatio) {
            console.log(`   🔥 MODO FORÇADO: PDF grande (${Math.round(fileSizeMB)} MB > ${FORCE_OCR_SIZE_MB} MB)`);
            console.log(`      Tentando OCR independente da detecção automática...`);
          } else {
            console.log(`   ⚠️  PDF ESCANEADO DETECTADO!`);
            console.log(`      Motivo: ${textToFileSizeRatio < MIN_TEXT_RATIO ? `Texto é apenas ${(textToFileSizeRatio * 100).toFixed(2)}% do arquivo` : `Apenas ${Math.round(charsPerPage)} chars/página`}`);
          }
          console.log(`   ⚠️  PDF escaneado detectado: ${Math.round(charsPerPage)} chars/página (< ${MIN_CHARS_PER_PAGE})`);
          console.log(`   🔄 Iniciando OCR com Tesseract.js...`);

          try {
            const { performOCROnPDF } = await import('../services/ocr-service.js');
            const ocrOutputFolder = path.join(path.dirname(doc.path), `ocr_${doc.id}`);

            const ocrResult = await performOCROnPDF(doc.path, ocrOutputFolder, {
              processAllPages: true,
              maxPages: Math.min(pdfData.numpages, 500), // Limitar a 500 páginas
              confidenceThreshold: 60,
              saveIndividualPages: false,
              workerCount: 2 // Usar 2 workers para não sobrecarregar
            });

            if (ocrResult.success && ocrResult.fullText) {
              rawText = ocrResult.fullText;
              console.log(`   ✅ OCR concluído: ${Math.round(rawText.length / 1000)}k caracteres`);
              console.log(`   📊 Confiança média: ${Math.round(ocrResult.averageConfidence)}%`);
              console.log(`   ⏱️  Tempo de OCR: ${Math.round(ocrResult.processingTime / 1000)}s`);
            } else {
              console.log(`   ⚠️  OCR falhou ou retornou pouco texto, usando texto original`);
            }
          } catch (ocrError) {
            console.error(`   ❌ Erro no OCR:`, ocrError.message);
            console.log(`   📝 Continuando com texto extraído por pdf-parse (${rawText.length} chars)`);
          }
        } else {
          console.log(`   💡 PDF digital (${Math.round(charsPerPage)} chars/página) - texto OK`);
        }
      } else {
        // Texto puro (.txt, .md, etc)
        rawText = fs.readFileSync(doc.path, 'utf-8');
        console.log(`   ✅ Arquivo texto lido com sucesso`);
        console.log(`   📊 Tamanho: ${Math.round(rawText.length / 1000)}k caracteres`);
      }
    } catch (readError) {
      console.error(`   ❌ Erro ao ler arquivo:`, readError);
      return res.status(500).json({
        success: false,
        error: `Erro ao ler arquivo: ${readError.message}`,
        path: doc.path
      });
    }
  }
  // Fallback: usar extractedText do registro KB (documentos estruturados)
  else if (doc.extractedText) {
      console.log(`   ⚠️  Path não existe, usando extractedText do registro KB`);
      console.log(`      - doc.path: ${doc.path || 'não definido'}`);
      console.log(`      - extractedText length: ${doc.extractedText.length} chars`);
      rawText = doc.extractedText;
    }
    // Nenhuma fonte de texto disponível
    else {
      console.log(`   ❌ ERRO: Nenhuma fonte de texto disponível!`);
      console.log(`      - doc.path: ${doc.path || 'não definido'}`);
      console.log(`      - fs.existsSync: ${doc.path ? fs.existsSync(doc.path) : 'N/A'}`);
      console.log(`      - doc.extractedText: ${doc.extractedText ? 'exists' : 'undefined'}`);

      return res.status(404).json({
        success: false,
        error: `Erro ao acessar documento "${doc.name}"`,
        details: {
          path: doc.path || 'não definido',
          fileExists: doc.path ? fs.existsSync(doc.path) : false,
          hasExtractedText: !!doc.extractedText
        },
        message: 'Por favor, faça upload do documento novamente.'
      });
    }

    // Validar rawText
    if (!rawText || rawText.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Arquivo vazio ou não pôde ser lido',
        path: doc.path
      });
    }

    // LIMITE DE 100MB: Aplicar apenas a PDFs NÃO mesclados
    // Documentos mesclados usam estratégia de volumes (sem limite)
    if (isPDF && !isMergedDocument && doc.size > 100 * 1024 * 1024) {
      console.log(`   ⚠️ PDF muito grande (${Math.round(doc.size/1024/1024)}MB) - processamento pode falhar`);
      return res.status(400).json({
        success: false,
        error: `PDF muito grande (${Math.round(doc.size/1024/1024)}MB). Limite: 100MB para PDFs únicos. Use função de merge de volumes para processar documentos grandes.`,
        size: doc.size,
        limit: 100 * 1024 * 1024
      });
    }

    // Create extraction job for progress tracking
    let job;
    try {
      job = await extractionProgressService.createJob(
        doc.id,
        doc.name || doc.originalName,
        req.session?.user?.id || 'anonymous',
        {
          analysisType,
          model,
          originalSize: rawText.length
        }
      );

      console.log(`   📊 Created extraction job: ${job.id}`);
    } catch (jobError) {
      console.error(`   ⚠️ Failed to create extraction job:`, jobError);
      // Continue without job tracking
    }

    // Return job ID immediately for progress tracking
    res.json({
      success: true,
      jobId: job?.id || null,
      message: 'Extraction started. Use jobId to track progress.'
    });

    // 🔥 FIX CRÍTICO: Usar userId do documento ORIGINAL, não da sessão
    // Fichamentos devem ter MESMO userId do documento pai para aparecer no filtro
    const documentUserId = doc.userId || req.session?.user?.id || 'web-upload';
    console.log(`   🔐 userId para fichamentos: ${documentUserId} (documento: ${doc.userId || 'não definido'}, sessão: ${req.session?.user?.id || 'não definido'})`);

    // Process in background (don't await)
    processExtractionInBackground(
      job?.id || null,
      doc,
      rawText,
      analysisType,
      model,
      documentUserId,  // 🔥 FIX: Usar userId do documento original
      isPDF  // Pass PDF flag to skip AI extraction
    ).catch(error => {
      console.error(`   ❌ Background extraction failed:`, error);
      if (job?.id) {
        extractionProgressService.failJob(job.id, error.message);
      }
    });

    return;
  } catch (error) {
    console.error('❌ [V2 Direct] Erro completo:', error);
    console.error('   Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      errorType: error.name,
      stack: error.stack
    });
  }
});

/**
 * Background extraction processing
 */
async function processExtractionInBackground(jobId, doc, rawText, analysisType, model, userId, isPDF = false) {
  try {
    if (jobId) {
      // Definir número de etapas baseado no tipo de análise
      // complete: extraction + saving + persistence + 4 analysis + saving_files = 8
      const chunksTotal = analysisType === 'complete' ? 8 : (analysisType === 'extract_only' ? 2 : 3);
      await extractionProgressService.startJob(jobId, 'multi-step', chunksTotal);
    }

    // Processar com V2
    let result;

    if (analysisType === 'complete') {
      console.log(`   ⚙️ Processamento COMPLETO iniciado...`);

      // Etapa 1: Extração (0-15%)
      if (jobId) {
        await extractionProgressService.updateChunkProgress(jobId, 0, {
          stage: 'extraction',
          message: 'Extraindo texto com Nova Micro...'
        });
      }

      result = await documentProcessorV2.processComplete(
        rawText,
        doc.id,
        doc.name || doc.originalName,
        {
          extractionModel: 'nova-micro',
          analysisModel: model,
          generateFiles: true,
          saveToKB: true,
          userId: userId,  // ✅ FIX: Pass userId for document creation
          skipExtraction: isPDF,  // ✅ Skip AI extraction for PDFs (already clean)
          filePath: doc.path,  // ✅ UNIVERSAL: Pass file path for ANY format extraction
          pdfPath: isPDF ? doc.path : null,  // ✅ LEGACY: Maintain PDF compatibility
          audioFiles: [],  // Future: audio transcription support
          analyzeFrames: true,  // ✅ Analyze video frames with Claude Vision
          fps: 1,  // ✅ Extract 1 frame per second from videos
          progressCallback: async (stage, progress, message) => {
            // Callback para atualizar progresso durante processamento
            if (jobId) {
              const chunkMap = {
                'extraction': 0,
                'saving': 1,
                'persistence': 2,  // ✅ Nova etapa: persistência completa
                'fichamento': 3,
                'analise': 4,
                'cronologia': 5,
                'resumo': 6,
                'saving_files': 7
              };
              const chunkNumber = chunkMap[stage] || 0;
              await extractionProgressService.updateChunkProgress(jobId, chunkNumber, {
                stage,
                message,
                progress
              });
            }
          }
        }
      );

      // Mark job as completed
      if (jobId) {
        await extractionProgressService.completeJob(
          jobId,
          result.intermediateDoc?.id || doc.id,
          {
            extractionCost: result.metadata?.extractionCost || 0,
            analysisCost: result.metadata?.analysisCost || 0,
            totalCost: result.metadata?.totalCost || 0,
            filesGenerated: result.metadata?.filesGenerated || 0
          }
        );
      }

    } else if (analysisType === 'extract_only') {
      console.log(`   ⚙️ Extração APENAS iniciada...`);

      let extraction;
      let intermediateDoc;

      if (isPDF) {
        // PDF já tem texto limpo - pular extração com IA
        console.log(`   💡 PDF detectado - pulando extração com IA`);
        console.log(`   ✅ Usando texto extraído diretamente do pdf-parse`);

        intermediateDoc = await documentProcessorV2.saveExtractedTextToKB(
          rawText,  // Usar texto do pdf-parse diretamente
          doc.id,
          doc.name || doc.originalName
        );

        extraction = {
          metadata: {
            method: 'pdf-parse-direct',
            processingTime: 0,
            cost: 0,
            originalSize: rawText.length,
            extractedSize: rawText.length
          }
        };

      } else {
        // Texto precisa de extração com IA
        extraction = await documentProcessorV2.extractFullText(
          rawText,
          doc.id,
          doc.name || doc.originalName
        );

        intermediateDoc = await documentProcessorV2.saveExtractedTextToKB(
          extraction.extractedText,
          doc.id,
          doc.name || doc.originalName
        );
      }

      result = {
        success: true,
        extraction: extraction.metadata,
        intermediateDoc,
        technicalFiles: null,
        metadata: {
          totalTime: extraction.metadata.processingTime || 0,
          totalCost: extraction.metadata.cost || 0,
          extractionCost: extraction.metadata.cost || 0,
          analysisCost: 0,
          filesGenerated: 0
        }
      };

      // Mark job as completed
      if (jobId) {
        await extractionProgressService.completeJob(
          jobId,
          intermediateDoc.id,
          {
            extractionCost: extraction.metadata.cost,
            analysisCost: 0,
            totalCost: extraction.metadata.cost,
            extractedSize: extraction.extractedText.length,
            method: extraction.metadata.method
          }
        );
      }

    } else if (analysisType === 'custom') {
      console.log(`   ⚙️ Análise CUSTOMIZADA iniciada...`);

      const extraction = await documentProcessorV2.extractFullText(
        rawText,
        doc.id,
        doc.name || doc.originalName
      );

      const analysis = await documentProcessorV2.analyzeWithPremiumLLM(
        extraction.extractedText,
        customPrompt,
        model,
        'Você é um assistente jurídico especializado em análise de documentos processuais brasileiros.'
      );

      result = {
        success: analysis.success,
        extraction: extraction.metadata,
        customAnalysis: analysis.analysis,
        metadata: {
          totalTime: extraction.metadata.processingTime + (analysis.metadata?.processingTime || 0),
          totalCost: extraction.metadata.cost + (analysis.metadata?.cost || 0),
          extractionCost: extraction.metadata.cost,
          analysisCost: analysis.metadata?.cost || 0,
          filesGenerated: 0
        }
      };

      // Mark job as completed
      if (jobId) {
        await extractionProgressService.completeJob(
          jobId,
          doc.id,
          {
            extractionCost: extraction.metadata.cost,
            analysisCost: analysis.metadata?.cost || 0,
            totalCost: result.metadata.totalCost
          }
        );
      }
    }

    if (!result.success) {
      if (jobId) {
        await extractionProgressService.failJob(jobId, `Erro no processamento V2: ${result.error}`);
      }
      return;
    }

    console.log(`   ✅ Processamento concluído!`);
    console.log(`   💰 Custo total: $${result.metadata.totalCost.toFixed(4)}`);
    console.log(`   ⏱️  Tempo total: ${result.metadata.totalTime}s`);

  } catch (error) {
    console.error('❌ [Background Extraction] Erro completo:', error);
    console.error('   Stack trace:', error.stack);

    if (jobId) {
      await extractionProgressService.failJob(jobId, error.message);
    }
  }
}

/**
 * GET /api/kb/analyze-v2/status
 *
 * Retorna status do serviço V2
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    service: 'KB Analyze V2',
    version: '1.0.0',
    status: 'operational',
    features: {
      analysisTypes: ['complete', 'extract_only', 'custom'],
      models: ['haiku', 'sonnet', 'opus'],
      technicalFiles: ['FICHAMENTO', 'ANALISE_JURIDICA', 'CRONOLOGIA', 'RESUMO_EXECUTIVO']
    },
    documentation: '/api/kb/analyze-v2/docs'
  });
});

/**
 * GET /api/kb/analyze-v2/docs
 *
 * Retorna documentação da API
 */
router.get('/docs', (req, res) => {
  res.json({
    endpoint: '/api/kb/analyze-v2',
    method: 'POST',
    description: 'Analisa documentos da Knowledge Base usando arquitetura V2',
    authentication: 'Required (session cookie)',
    parameters: {
      documentName: {
        type: 'string',
        required: true,
        description: 'Nome do documento da KB (ex: "Report01770235205448.pdf")'
      },
      analysisType: {
        type: 'string',
        required: false,
        default: 'complete',
        enum: ['complete', 'extract_only', 'custom'],
        description: 'Tipo de análise a realizar'
      },
      model: {
        type: 'string',
        required: false,
        default: 'sonnet',
        enum: ['haiku', 'sonnet', 'opus'],
        description: 'Modelo LLM para análise'
      },
      customPrompt: {
        type: 'string',
        required: false,
        description: 'Prompt customizado (obrigatório se analysisType="custom")'
      }
    },
    examples: [
      {
        description: 'Análise completa com Sonnet',
        request: {
          documentName: 'Report01770235205448.pdf',
          analysisType: 'complete',
          model: 'sonnet'
        }
      },
      {
        description: 'Apenas extração',
        request: {
          documentName: 'processo.pdf',
          analysisType: 'extract_only'
        }
      },
      {
        description: 'Análise customizada',
        request: {
          documentName: 'contrato.pdf',
          analysisType: 'custom',
          model: 'opus',
          customPrompt: 'Identifique cláusulas abusivas neste contrato'
        }
      }
    ],
    response: {
      success: true,
      data: {
        extraction: {
          extractedText: 'string',
          metadata: {}
        },
        intermediateDoc: {
          id: 'string',
          name: 'string'
        },
        technicalFiles: {
          FICHAMENTO: 'string',
          ANALISE_JURIDICA: 'string',
          CRONOLOGIA: 'string',
          RESUMO_EXECUTIVO: 'string'
        },
        metadata: {
          totalTime: 'number',
          totalCost: 'number',
          filesGenerated: 'number'
        }
      }
    },
    costEstimates: {
      '100pages': {
        extractionCost: 0.017,
        analysisCost: 1.5,
        totalCost: 1.517
      },
      '300pages': {
        extractionCost: 0.052,
        analysisCost: 4.5,
        totalCost: 4.552
      },
      '500pages': {
        extractionCost: 0.087,
        analysisCost: 7.5,
        totalCost: 7.587
      }
    }
  });
});

export default router;
