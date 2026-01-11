/**
 * ROM Agent - Serviço de Extração Completa de Documentos Jurídicos
 *
 * Extrai e organiza:
 * - Índice completo
 * - Resumo executivo
 * - Ficheiro completo
 * - Microfichas por documento/movimento
 * - Cronologia detalhada
 * - Matrizes de prazos (preclusão, decadência, prescrição)
 * - OCR de imagens
 * - Transcrições de vídeos com timestamp
 * - Relatórios de imagens
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { extractTextFromPDF } from '../modules/textract.js';
// OCR and Chronology são imports dinâmicos (opcional - podem não estar disponíveis)
import { uploadToKnowledgeBase } from '../modules/knowledgeBase.js';
import progressEmitter from '../utils/progress-emitter.js';

// Detectar sistema operacional
const IS_MAC = os.platform() === 'darwin';
const IS_WINDOWS = os.platform() === 'win32';

// Caminho base no Desktop
const getDesktopPath = () => {
  const homeDir = os.homedir();
  if (IS_MAC) {
    return path.join(homeDir, 'Desktop');
  } else if (IS_WINDOWS) {
    return path.join(homeDir, 'Desktop');
  } else {
    return path.join(homeDir, 'Área de Trabalho'); // Linux
  }
};

const BASE_EXTRACTION_FOLDER = 'ROM-Extractions';

/**
 * Estrutura de pastas para cada processo:
 *
 * Desktop/
 * └── ROM-Extractions/
 *     └── Processo_XXXXXXX-XX.XXXX.X.XX.XXXX/
 *         ├── original/
 *         │   └── documento.pdf
 *         ├── extracted/
 *         │   ├── indice.json
 *         │   ├── indice.md
 *         │   ├── resumo-executivo.md
 *         │   ├── ficheiro-completo.json
 *         │   ├── ficheiro-completo.txt
 *         │   ├── cronologia.json
 *         │   ├── cronologia.md
 *         │   ├── matrizes-prazos.json
 *         │   ├── matrizes-prazos.md
 *         │   └── microfichas/
 *         │       ├── movimento-001.json
 *         │       ├── movimento-002.json
 *         │       └── ...
 *         ├── ocr/
 *         │   ├── pagina-001-ocr.txt
 *         │   ├── pagina-002-ocr.txt
 *         │   └── relatorio-ocr.json
 *         ├── images/
 *         │   ├── imagem-001.png
 *         │   ├── imagem-001-analise.json
 *         │   └── relatorio-imagens.json
 *         ├── videos/
 *         │   ├── video-001.mp4
 *         │   ├── video-001-transcricao.txt
 *         │   ├── video-001-transcricao.json
 *         │   └── relatorio-videos.json
 *         └── metadata.json
 */

/**
 * Criar estrutura de pastas para um processo
 */
export async function createProcessFolderStructure(processNumber, projectName = 'ROM') {
  try {
    const desktopPath = getDesktopPath();
    const baseFolder = path.join(desktopPath, BASE_EXTRACTION_FOLDER);
    const processFolder = path.join(baseFolder, `Processo_${processNumber.replace(/\//g, '-')}`);

    // Criar pastas
    const folders = [
      processFolder,
      path.join(processFolder, 'original'),
      path.join(processFolder, 'extracted'),
      path.join(processFolder, 'extracted', 'microfichas'),
      path.join(processFolder, 'ocr'),
      path.join(processFolder, 'images'),
      path.join(processFolder, 'videos')
    ];

    for (const folder of folders) {
      await fs.mkdir(folder, { recursive: true });
    }

    // Criar metadata.json
    const metadata = {
      processNumber,
      projectName,
      createdAt: new Date().toISOString(),
      extractionVersion: '1.0.0',
      status: 'iniciado',
      paths: {
        base: processFolder,
        original: path.join(processFolder, 'original'),
        extracted: path.join(processFolder, 'extracted'),
        ocr: path.join(processFolder, 'ocr'),
        images: path.join(processFolder, 'images'),
        videos: path.join(processFolder, 'videos')
      }
    };

    await fs.writeFile(
      path.join(processFolder, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    return { success: true, processFolder, metadata };

  } catch (error) {
    console.error('Erro ao criar estrutura de pastas:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extração completa de um documento
 */
export async function extractCompleteDocument(options = {}) {
  const {
    filePath,
    processNumber,
    projectName = 'ROM',
    uploadToKB = true,
    generateAllFormats = true
  } = options;

  const extractionLog = {
    startTime: new Date().toISOString(),
    processNumber,
    projectName,
    filePath,
    steps: [],
    warnings: [],
    errors: [],
    outputs: {}
  };

  try {
    // Iniciar sessão de progresso
    const sessionId = `extraction-${processNumber}-${Date.now()}`;
    progressEmitter.startSession(sessionId, {
      processNumber,
      projectName,
      totalSteps: 12
    });

    // 1. Criar estrutura de pastas
    progressEmitter.addStep(sessionId, 'Criando estrutura de pastas', 'processing');
    console.log('📁 Criando estrutura de pastas...');
    const folderResult = await createProcessFolderStructure(processNumber, projectName);

    if (!folderResult.success) {
      throw new Error(`Falha ao criar pasta: ${folderResult.error}`);
    }

    progressEmitter.addSuccess(sessionId, 'Estrutura de pastas criada', { path: folderResult.processFolder });
    extractionLog.steps.push({ step: 'criar-pastas', status: 'sucesso', timestamp: new Date().toISOString() });
    const { processFolder, metadata } = folderResult;

    // 2. Copiar arquivo original
    progressEmitter.addStep(sessionId, 'Copiando arquivo original', 'processing');
    console.log('📄 Copiando arquivo original...');
    const originalFileName = path.basename(filePath);
    const originalDestPath = path.join(metadata.paths.original, originalFileName);
    await fs.copyFile(filePath, originalDestPath);
    progressEmitter.addSuccess(sessionId, 'Arquivo original copiado');
    extractionLog.steps.push({ step: 'copiar-original', status: 'sucesso', file: originalDestPath });

    // 3. Extrair texto do PDF
    progressEmitter.addStep(sessionId, 'Extraindo texto do PDF', 'processing');
    console.log('📝 Extraindo texto do PDF...');
    let textContent = null;
    let textExtraction = { success: false };

    try {
      textExtraction = await extractTextFromPDF(filePath);

      if (textExtraction.success) {
        textContent = textExtraction.text;
        progressEmitter.addSuccess(sessionId, `Texto extraído: ${textExtraction.pageCount} páginas`);
        extractionLog.steps.push({ step: 'extrair-texto', status: 'sucesso', pages: textExtraction.pageCount });
      } else {
        progressEmitter.addWarning(sessionId, 'PDF sem texto extraível - OCR será necessário');
        extractionLog.warnings.push('PDF sem texto extraível - OCR será necessário');
        extractionLog.steps.push({ step: 'extrair-texto', status: 'falha', reason: 'PDF sem texto' });
      }
    } catch (error) {
      extractionLog.errors.push({ step: 'extrair-texto', error: error.message });
    }

    // 4. Se não há texto, fazer OCR
    if (!textContent || textContent.trim().length === 0) {
      progressEmitter.addStep(sessionId, 'Executando OCR nas páginas', 'processing');
      console.log('🔍 Executando OCR...');

      try {
        // Import OCR service (Tesseract.js)
        const { performOCR } = await import('./ocr-service.js');
        const ocrResult = await performOCR(filePath, metadata.paths.ocr);

        if (ocrResult.success) {
          textContent = ocrResult.fullText;
          progressEmitter.addSuccess(sessionId, `OCR concluido: ${ocrResult.processedPages} paginas processadas`);
          extractionLog.steps.push({
            step: 'ocr',
            status: 'sucesso',
            pages: ocrResult.processedPages,
            confidence: ocrResult.averageConfidence,
            motor: 'Tesseract.js'
          });
        } else {
          progressEmitter.addError(sessionId, 'Falha no OCR', ocrResult.errors?.join(', ') || 'Erro desconhecido');
          extractionLog.errors.push({ step: 'ocr', error: ocrResult.errors?.join(', ') || 'Erro desconhecido' });
        }
      } catch (importError) {
        const errorMsg = `OCR service nao disponivel: ${importError.message}`;
        console.warn(`  ${errorMsg}`);
        progressEmitter.addWarning(sessionId, errorMsg);
        extractionLog.warnings = extractionLog.warnings || [];
        extractionLog.warnings.push({ step: 'ocr', message: errorMsg });
      }
    }

    // 5. Gerar índice
    console.log('📚 Gerando índice...');
    const indice = await generateIndice(textContent, processNumber);

    // Salvar em múltiplos formatos
    await fs.writeFile(
      path.join(metadata.paths.extracted, 'indice.json'),
      JSON.stringify(indice, null, 2),
      'utf-8'
    );
    await fs.writeFile(
      path.join(metadata.paths.extracted, 'indice.md'),
      generateIndiceMD(indice),
      'utf-8'
    );

    extractionLog.outputs.indice = indice;
    extractionLog.steps.push({ step: 'gerar-indice', status: 'sucesso', items: indice.items.length });

    // 6. Gerar resumo executivo
    console.log('📋 Gerando resumo executivo...');
    const resumoExecutivo = await generateResumoExecutivo(textContent, processNumber);

    await fs.writeFile(
      path.join(metadata.paths.extracted, 'resumo-executivo.md'),
      resumoExecutivo,
      'utf-8'
    );
    await fs.writeFile(
      path.join(metadata.paths.extracted, 'resumo-executivo.json'),
      JSON.stringify({ processNumber, resumo: resumoExecutivo, geradoEm: new Date().toISOString() }, null, 2),
      'utf-8'
    );

    extractionLog.outputs.resumoExecutivo = resumoExecutivo;
    extractionLog.steps.push({ step: 'gerar-resumo', status: 'sucesso' });

    // 7. Gerar ficheiro completo
    console.log('📄 Gerando ficheiro completo...');
    const ficheiroCompleto = {
      processNumber,
      metadata: metadata,
      textoCompleto: textContent,
      totalPaginas: textExtraction.pageCount || 0,
      textoPorPagina: textExtraction.pages || [],
      geradoEm: new Date().toISOString()
    };

    await fs.writeFile(
      path.join(metadata.paths.extracted, 'ficheiro-completo.json'),
      JSON.stringify(ficheiroCompleto, null, 2),
      'utf-8'
    );
    await fs.writeFile(
      path.join(metadata.paths.extracted, 'ficheiro-completo.txt'),
      textContent || '',
      'utf-8'
    );

    extractionLog.steps.push({ step: 'gerar-ficheiro', status: 'sucesso' });

    // 8. Gerar cronologia
    console.log('📅 Gerando cronologia...');
    let cronologia = null;
    let matrizes = null;

    try {
      // Import dinâmico - Chronology pode não estar disponível
      const { generateChronology, generateMatrices } = await import('./chronology-service.js');

      cronologia = await generateChronology(textContent, processNumber);

      await fs.writeFile(
        path.join(metadata.paths.extracted, 'cronologia.json'),
        JSON.stringify(cronologia, null, 2),
        'utf-8'
      );
      await fs.writeFile(
        path.join(metadata.paths.extracted, 'cronologia.md'),
        generateCronologiaMD(cronologia),
        'utf-8'
      );

      extractionLog.outputs.cronologia = cronologia;
      extractionLog.steps.push({ step: 'gerar-cronologia', status: 'sucesso', eventos: cronologia.eventos.length });

      // 9. Gerar matrizes de prazos
      console.log('⏰ Gerando matrizes de prazos...');
      matrizes = await generateMatrices(textContent, cronologia);

      await fs.writeFile(
        path.join(metadata.paths.extracted, 'matrizes-prazos.json'),
        JSON.stringify(matrizes, null, 2),
        'utf-8'
      );
      await fs.writeFile(
        path.join(metadata.paths.extracted, 'matrizes-prazos.md'),
        generateMatrizesMD(matrizes),
        'utf-8'
      );

      extractionLog.outputs.matrizes = matrizes;
      extractionLog.steps.push({ step: 'gerar-matrizes', status: 'sucesso' });

    } catch (importError) {
      const errorMsg = 'Chronology service não disponível (pulando cronologia e matrizes)';
      console.warn(`⚠️  ${errorMsg}`);
      extractionLog.warnings = extractionLog.warnings || [];
      extractionLog.warnings.push({ step: 'cronologia', message: errorMsg });
    }

    // 10. Gerar microfichas
    console.log('📇 Gerando microfichas...');
    const microfichas = await generateMicrofichas(textContent, processNumber);

    for (let i = 0; i < microfichas.length; i++) {
      const microficha = microfichas[i];
      const fichaNumber = String(i + 1).padStart(3, '0');

      await fs.writeFile(
        path.join(metadata.paths.extracted, 'microfichas', `movimento-${fichaNumber}.json`),
        JSON.stringify(microficha, null, 2),
        'utf-8'
      );
    }

    extractionLog.steps.push({ step: 'gerar-microfichas', status: 'sucesso', total: microfichas.length });

    // 11. Upload para Knowledge Base (se solicitado)
    if (uploadToKB) {
      console.log('☁️  Fazendo upload para Knowledge Base...');

      try {
        const kbResult = await uploadToKnowledgeBase({
          projectName,
          processNumber,
          files: [
            { path: path.join(metadata.paths.extracted, 'resumo-executivo.md'), type: 'resumo' },
            { path: path.join(metadata.paths.extracted, 'cronologia.md'), type: 'cronologia' },
            { path: path.join(metadata.paths.extracted, 'matrizes-prazos.md'), type: 'matrizes' },
            { path: path.join(metadata.paths.extracted, 'indice.md'), type: 'indice' }
          ]
        });

        extractionLog.steps.push({ step: 'upload-kb', status: kbResult.success ? 'sucesso' : 'falha' });

        if (kbResult.success) {
          extractionLog.outputs.kbUploadIds = kbResult.uploadIds;
        }
      } catch (error) {
        extractionLog.errors.push({ step: 'upload-kb', error: error.message });
      }
    }

    // 12. Atualizar metadata final
    metadata.status = 'concluído';
    metadata.completedAt = new Date().toISOString();
    metadata.extractionLog = extractionLog;

    await fs.writeFile(
      path.join(processFolder, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    extractionLog.endTime = new Date().toISOString();
    extractionLog.status = 'concluído';

    // Finalizar sessão de progresso com sucesso
    progressEmitter.completeSession(sessionId, {
      processNumber,
      totalSteps: extractionLog.steps.length,
      warnings: extractionLog.warnings.length,
      errors: extractionLog.errors.length
    });

    return {
      success: true,
      processFolder,
      metadata,
      extractionLog,
      outputs: extractionLog.outputs
    };

  } catch (error) {
    console.error('Erro na extração completa:', error);
    extractionLog.errors.push({ step: 'geral', error: error.message });
    extractionLog.status = 'erro';
    extractionLog.endTime = new Date().toISOString();

    // Finalizar sessão com erro
    if (typeof sessionId !== 'undefined') {
      progressEmitter.failSession(sessionId, error);
    }

    return {
      success: false,
      error: error.message,
      extractionLog
    };
  }
}

/**
 * Gerar índice do documento
 */
async function generateIndice(textContent, processNumber) {
  // Aqui você pode usar IA para gerar um índice inteligente
  // Por enquanto, vamos criar uma estrutura básica

  const linhas = textContent ? textContent.split('\n') : [];
  const items = [];

  // Procurar por seções típicas de petições
  const secoes = [
    'EXCELENTÍSSIMO',
    'DOS FATOS',
    'DO DIREITO',
    'DOS PEDIDOS',
    'TERMOS EM QUE',
    'REQUERIMENTO',
    'DOCUMENTOS'
  ];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();

    for (const secao of secoes) {
      if (linha.toUpperCase().includes(secao)) {
        items.push({
          secao,
          linha: i + 1,
          conteudo: linha
        });
      }
    }
  }

  return {
    processNumber,
    totalItens: items.length,
    items,
    geradoEm: new Date().toISOString()
  };
}

/**
 * Gerar resumo executivo
 */
async function generateResumoExecutivo(textContent, processNumber) {
  if (!textContent) {
    return `# Resumo Executivo - Processo ${processNumber}\n\n**⚠️ Aviso**: Não foi possível extrair texto do documento.\n`;
  }

  // Aqui você integraria com AWS Bedrock para gerar um resumo inteligente
  // Por enquanto, vamos fazer um resumo simples

  const primeirasPalavras = textContent.substring(0, 500);

  return `# Resumo Executivo - Processo ${processNumber}

**Gerado em**: ${new Date().toLocaleString('pt-BR')}

## Visão Geral

${primeirasPalavras}...

## Informações Principais

- **Número do Processo**: ${processNumber}
- **Total de Caracteres**: ${textContent.length}
- **Status da Extração**: Concluída

## Próximos Passos

1. Revisar documentação completa
2. Analisar cronologia de eventos
3. Verificar prazos e matrizes
4. Preparar estratégia processual

---

*Este resumo foi gerado automaticamente pelo ROM Agent.*
`;
}

/**
 * Gerar microfichas por movimento/documento
 */
async function generateMicrofichas(textContent, processNumber) {
  // Dividir em microfichas (uma por página ou movimento)
  const microfichas = [];

  if (!textContent) return microfichas;

  // Dividir por páginas (aproximadamente 3000 caracteres por página)
  const tamanhoPagina = 3000;
  let numeroMovimento = 1;

  for (let i = 0; i < textContent.length; i += tamanhoPagina) {
    const trecho = textContent.substring(i, i + tamanhoPagina);

    microfichas.push({
      processNumber,
      movimentoNumero: numeroMovimento,
      conteudo: trecho,
      caracteres: trecho.length,
      geradoEm: new Date().toISOString()
    });

    numeroMovimento++;
  }

  return microfichas;
}

/**
 * Gerar markdown do índice
 */
function generateIndiceMD(indice) {
  let md = `# Índice - Processo ${indice.processNumber}\n\n`;
  md += `**Total de Seções**: ${indice.totalItens}\n`;
  md += `**Gerado em**: ${new Date(indice.geradoEm).toLocaleString('pt-BR')}\n\n`;
  md += `---\n\n`;

  for (const item of indice.items) {
    md += `## ${item.secao}\n`;
    md += `- **Linha**: ${item.linha}\n`;
    md += `- **Conteúdo**: ${item.conteudo}\n\n`;
  }

  return md;
}

/**
 * Gerar markdown da cronologia
 */
function generateCronologiaMD(cronologia) {
  let md = `# Cronologia - Processo ${cronologia.processNumber}\n\n`;
  md += `**Total de Eventos**: ${cronologia.eventos.length}\n`;
  md += `**Gerado em**: ${new Date(cronologia.geradoEm).toLocaleString('pt-BR')}\n\n`;
  md += `---\n\n`;

  for (const evento of cronologia.eventos) {
    md += `## ${evento.data} - ${evento.tipo}\n`;
    md += `${evento.descricao}\n\n`;
  }

  return md;
}

/**
 * Gerar markdown das matrizes
 */
function generateMatrizesMD(matrizes) {
  let md = `# Matrizes de Prazos - Processo ${matrizes.processNumber}\n\n`;
  md += `**Gerado em**: ${new Date(matrizes.geradoEm).toLocaleString('pt-BR')}\n\n`;
  md += `---\n\n`;

  md += `## Prazos de Preclusão\n\n`;
  for (const prazo of matrizes.preclusao) {
    md += `- **${prazo.descricao}**: ${prazo.prazo} dias (vencimento: ${prazo.vencimento})\n`;
  }

  md += `\n## Prazos de Decadência\n\n`;
  for (const prazo of matrizes.decadencia) {
    md += `- **${prazo.descricao}**: ${prazo.prazo}\n`;
  }

  md += `\n## Prazos de Prescrição\n\n`;
  for (const prazo of matrizes.prescricao) {
    md += `- **${prazo.descricao}**: ${prazo.prazo}\n`;
  }

  return md;
}

export default {
  createProcessFolderStructure,
  extractCompleteDocument,
  getDesktopPath,
  BASE_EXTRACTION_FOLDER
};
