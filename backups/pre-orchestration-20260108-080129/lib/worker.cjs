/**
 * Worker Thread para Processamento Paralelo
 *
 * Executa tarefas em paralelo sem bloquear thread principal
 */

const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');

// Módulos para processamento (carregar sob demanda)
let pdfParse = null;
let mammoth = null;

const workerId = workerData.workerId;

console.log(`✅ Worker ${workerId} iniciado`);

/**
 * Processar tarefa
 * @param {Object} task
 * @returns {Promise<Object>} Resultado
 */
async function processTask(task) {
  const { type, data } = task;

  switch (type) {
    case 'extract_pdf':
      return await extractPDF(data);

    case 'extract_docx':
      return await extractDOCX(data);

    case 'extract_txt':
      return await extractTXT(data);

    case 'analyze_text':
      return await analyzeText(data);

    case 'process_batch':
      return await processBatch(data);

    default:
      throw new Error(`Tipo de tarefa desconhecido: ${type}`);
  }
}

/**
 * Extrair texto de PDF (SEM usar API/tokens)
 * @param {Object} data
 * @returns {Promise<Object>} Resultado
 */
async function extractPDF(data) {
  const { filePath } = data;

  // Carregar pdf-parse sob demanda
  if (!pdfParse) {
    pdfParse = require('pdf-parse');
  }

  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);

  return {
    text: pdfData.text,
    pages: pdfData.numpages,
    info: pdfData.info,
    metadata: pdfData.metadata,
    extractedAt: new Date().toISOString()
  };
}

/**
 * Extrair texto de DOCX (SEM usar API/tokens)
 * @param {Object} data
 * @returns {Promise<Object>} Resultado
 */
async function extractDOCX(data) {
  const { filePath } = data;

  // Carregar mammoth sob demanda
  if (!mammoth) {
    mammoth = require('mammoth');
  }

  const result = await mammoth.extractRawText({ path: filePath });

  return {
    text: result.value,
    messages: result.messages,
    extractedAt: new Date().toISOString()
  };
}

/**
 * Extrair texto de TXT
 * @param {Object} data
 * @returns {Promise<Object>} Resultado
 */
async function extractTXT(data) {
  const { filePath } = data;

  const text = fs.readFileSync(filePath, 'utf8');

  return {
    text,
    size: text.length,
    lines: text.split('\n').length,
    extractedAt: new Date().toISOString()
  };
}

/**
 * Analisar texto (processamento básico sem usar tokens)
 * @param {Object} data
 * @returns {Promise<Object>} Resultado
 */
async function analyzeText(data) {
  const { text } = data;

  // Análises básicas que não usam tokens
  const wordCount = text.split(/\s+/).length;
  const charCount = text.length;
  const lineCount = text.split('\n').length;
  const paragraphCount = text.split(/\n\n+/).length;

  // Extrair datas (formato brasileiro)
  const dateRegex = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g;
  const dates = [...text.matchAll(dateRegex)].map(m => m[0]);

  // Extrair valores monetários
  const moneyRegex = /R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g;
  const values = [...text.matchAll(moneyRegex)].map(m => m[0]);

  // Extrair números de processo
  const processRegex = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
  const processNumbers = [...text.matchAll(processRegex)].map(m => m[0]);

  // Extrair CPFs
  const cpfRegex = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
  const cpfs = [...text.matchAll(cpfRegex)].map(m => m[0]);

  // Extrair CNPJs
  const cnpjRegex = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g;
  const cnpjs = [...text.matchAll(cnpjRegex)].map(m => m[0]);

  // Extrair artigos de lei
  const artigoRegex = /(?:Art\.|Artigo)\s*\d+[º°]?(?:[-,]\s*[§¶]\s*\d+[º°]?)?/gi;
  const artigos = [...text.matchAll(artigoRegex)].map(m => m[0]);

  // Extrair menções a tribunais
  const tribunais = [];
  const tribunaisRegex = /\b(STF|STJ|TST|TSE|TRF[1-6]|TJ[A-Z]{2}|TRT[0-9]{1,2})\b/g;
  const tribunaisMatches = [...text.matchAll(tribunaisRegex)];
  tribunaisMatches.forEach(m => {
    if (!tribunais.includes(m[0])) {
      tribunais.push(m[0]);
    }
  });

  return {
    statistics: {
      wordCount,
      charCount,
      lineCount,
      paragraphCount
    },
    extracted: {
      dates,
      values,
      processNumbers,
      cpfs,
      cnpjs,
      artigos,
      tribunais
    },
    analyzedAt: new Date().toISOString()
  };
}

/**
 * Processar lote de arquivos
 * @param {Object} data
 * @returns {Promise<Object>} Resultado
 */
async function processBatch(data) {
  const { files } = data;

  const results = [];

  for (const file of files) {
    try {
      const ext = path.extname(file).toLowerCase();

      let result;
      if (ext === '.pdf') {
        result = await extractPDF({ filePath: file });
      } else if (ext === '.docx' || ext === '.doc') {
        result = await extractDOCX({ filePath: file });
      } else if (ext === '.txt') {
        result = await extractTXT({ filePath: file });
      } else {
        throw new Error(`Tipo de arquivo não suportado: ${ext}`);
      }

      // Analisar texto extraído
      const analysis = await analyzeText({ text: result.text });

      results.push({
        file,
        success: true,
        result: {
          ...result,
          analysis
        }
      });
    } catch (error) {
      results.push({
        file,
        success: false,
        error: error.message
      });
    }
  }

  return {
    totalFiles: files.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}

// Escutar mensagens do processo pai
parentPort.on('message', async (message) => {
  const { type, taskId, data } = message;

  if (type === 'task') {
    const startTime = Date.now();

    try {
      const result = await processTask(data);
      const processingTime = Date.now() - startTime;

      parentPort.postMessage({
        type: 'result',
        taskId,
        result,
        processingTime
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;

      parentPort.postMessage({
        type: 'result',
        taskId,
        error: error.message,
        processingTime
      });
    }
  }
});

// Sinalizar que o worker está pronto
parentPort.postMessage({ type: 'ready', workerId });
