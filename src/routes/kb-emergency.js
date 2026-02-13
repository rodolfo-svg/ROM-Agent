/**
 * Rotas de Emergência para KB
 * Usadas quando kb-documents.json está corrompido
 *
 * @version 1.0.0
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { ACTIVE_PATHS } from '../../lib/storage-config.js';
import { DocumentProcessorV2 } from '../../lib/document-processor-v2.js';

const router = express.Router();

/**
 * GET /api/kb/emergency/files
 *
 * Lista arquivos PDF diretamente do filesystem
 * NÃO depende de kb-documents.json
 */
router.get('/files', (req, res) => {
  try {
    const uploadsDir = path.join(ACTIVE_PATHS.data, 'uploads');

    if (!fs.existsSync(uploadsDir)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(uploadsDir)
      .filter(f => f.endsWith('.pdf'))
      .map(f => {
        try {
          const fullPath = path.join(uploadsDir, f);
          const stats = fs.statSync(fullPath);
          return {
            name: f,
            size: stats.size,
            path: fullPath,
            modifiedAt: stats.mtime.toISOString()
          };
        } catch (err) {
          return null;
        }
      })
      .filter(f => f !== null)
      .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

    console.log(`✅ [Emergency] ${files.length} arquivos encontrados`);

    res.json({
      success: true,
      files,
      count: files.length
    });

  } catch (error) {
    console.error('❌ [Emergency] Erro ao listar arquivos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/kb/emergency/analyze
 *
 * Analisa PDF diretamente do filesystem
 * NÃO depende de kb-documents.json
 */
router.post('/analyze', async (req, res) => {
  try {
    const {
      fileName,
      analysisType = 'complete',
      model = 'sonnet'
    } = req.body;

    if (!fileName) {
      return res.status(400).json({
        success: false,
        error: 'fileName é obrigatório'
      });
    }

    console.log(`\n🚨 [Emergency] Análise direta: ${fileName}`);

    const filePath = path.join(ACTIVE_PATHS.data, 'uploads', fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: `Arquivo não encontrado: ${fileName}`
      });
    }

    console.log(`   ✅ Arquivo encontrado: ${filePath}`);

    // Ler PDF
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    const dataBuffer = fs.readFileSync(filePath);

    console.log(`   📖 Lendo PDF (${Math.round(dataBuffer.length / 1024)}KB)...`);

    const pdfData = await pdfParse(dataBuffer);

    console.log(`   ✅ PDF parseado: ${pdfData.numpages} páginas, ${Math.round(pdfData.text.length / 1000)}k chars`);

    // Processar com V2
    const processor = new DocumentProcessorV2();

    let result;

    if (analysisType === 'extract_only') {
      // Apenas extração
      console.log(`   🔍 Modo: extract_only (sem análise)`);

      const extraction = await processor.extractFullText(
        pdfData.text,
        fileName.replace('.pdf', ''),
        fileName,
        null
      );

      if (!extraction.success) {
        throw new Error(`Extração falhou: ${extraction.error}`);
      }

      // Salvar no KB
      const saved = await processor.saveExtractedTextToKB(
        extraction.extractedText,
        fileName.replace('.pdf', ''),
        fileName
      );

      result = {
        extraction,
        intermediateDoc: saved,
        metadata: {
          totalCost: extraction.metadata.totalCost,
          totalTime: extraction.metadata.totalTime,
          analysisType: 'extract_only'
        }
      };

    } else if (analysisType === 'complete') {
      // Extração + Análise
      console.log(`   🧠 Modo: complete (extração + análise)`);

      result = await processor.processDocument(
        pdfData.text,
        fileName.replace('.pdf', ''),
        fileName,
        analysisType,
        model,
        null
      );
    }

    console.log(`   ✅ Processamento concluído!`);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ [Emergency] Erro na análise:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * POST /api/kb/emergency/fix-json
 *
 * Tenta reparar kb-documents.json corrompido
 */
router.post('/fix-json', async (req, res) => {
  try {
    const kbPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');

    console.log(`\n🔧 [Emergency] Tentando reparar ${kbPath}...`);

    // Fazer backup
    const backupPath = `${kbPath}.CORRUPTED.${Date.now()}.backup`;

    if (fs.existsSync(kbPath)) {
      fs.copyFileSync(kbPath, backupPath);
      console.log(`   ✅ Backup criado: ${backupPath}`);
    }

    // Tentar ler e reparar
    const content = fs.readFileSync(kbPath, 'utf8');

    console.log(`   📊 Tamanho: ${Math.round(content.length / 1024)}KB`);

    // Tentar parsear
    let docs;
    try {
      docs = JSON.parse(content);
      console.log(`   ✅ JSON válido! ${docs.length} documentos`);
      return res.json({
        success: true,
        message: 'JSON está válido',
        docsCount: docs.length
      });
    } catch (parseError) {
      console.log(`   ❌ JSON corrompido: ${parseError.message}`);

      // Recriar vazio
      fs.writeFileSync(kbPath, '[]', 'utf8');
      console.log(`   ✅ JSON recriado vazio`);

      return res.json({
        success: true,
        message: 'JSON recriado vazio (backup feito)',
        backupPath
      });
    }

  } catch (error) {
    console.error('❌ [Emergency] Erro ao reparar JSON:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
