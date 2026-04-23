/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ROM Agent - Pipeline de Extração 100% LOCAL e GRATUITO                  ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CUSTO: $0.00 (ZERO TOKENS CONSUMIDOS)                                   ║
 * ║                                                                          ║
 * ║  Ferramentas locais utilizadas:                                          ║
 * ║  ├── pdf-parse (Node.js) - Extração de PDF                               ║
 * ║  ├── pdftotext (Poppler) - Extração com layout                           ║
 * ║  ├── mammoth - Conversão DOCX                                            ║
 * ║  ├── pandoc - Conversão universal                                        ║
 * ║  ├── textutil (macOS) - Conversão nativa                                 ║
 * ║  ├── Tesseract.js - OCR gratuito                                         ║
 * ║  ├── Sharp - Pré-processamento de imagem                                 ║
 * ║  ├── 91 ferramentas de limpeza de texto                                  ║
 * ║  └── 10 processadores de otimização                                      ║
 * ║                                                                          ║
 * ║  ECONOMIA: Se usasse IA para extrair 1M tokens = $15-60                  ║
 * ║            Com este pipeline = $0.00                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

// Bibliotecas Node.js para extração
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import mime from 'mime-types';

// AWS SDK v3 para S3 e Bedrock Agent (assíncrono, não bloqueante)
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { BedrockAgentClient, StartIngestionJobCommand } from '@aws-sdk/client-bedrock-agent';

// Módulos ROM existentes
import extracao from '../src/modules/extracao.js';
import ocrAvancado from '../src/modules/ocrAvancado.js';

// ✅ IMPORTAR ACTIVE_PATHS para usar disco persistente no Render
import { ACTIVE_PATHS } from './storage-config.js';

// =============================================================================
// CONFIGURACAO DE OCR PARALELO
// =============================================================================

/**
 * Calcula numero otimo de workers para OCR baseado em CPU cores
 * Usa env var OCR_WORKERS se disponivel, senao calcula automaticamente
 */
function getOCRWorkerConfig() {
  const cpuCores = os.cpus().length;
  const envWorkers = parseInt(process.env.OCR_WORKERS, 10);

  // Usar env var se valida, senao 50% dos cores (min 2, max 8)
  const workers = !isNaN(envWorkers) && envWorkers > 0
    ? Math.min(envWorkers, cpuCores)
    : Math.max(2, Math.min(8, Math.floor(cpuCores * 0.5)));

  // Chunk size: 4-8 paginas por batch
  const envChunkSize = parseInt(process.env.OCR_CHUNK_SIZE, 10);
  const chunkSize = !isNaN(envChunkSize) && envChunkSize >= 2 && envChunkSize <= 16
    ? envChunkSize
    : 6; // Default: 6 paginas

  return {
    workers,
    chunkSize,
    cpuCores,
    parallel: process.env.OCR_PARALLEL !== 'false'
  };
}

const OCR_PARALLEL_CONFIG = getOCRWorkerConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// CONFIGURAÇÃO DE TIPOS DE ARQUIVO (EXTRACTOR_CONFIG)
// =============================================================================

/**
 * Configuração de extratores por tipo de arquivo
 * Define MIME types, extensões e métodos de extração para cada formato
 */
const EXTRACTOR_CONFIG = {
  // Documentos PDF
  pdf: {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    methods: ['pdf-parse', 'pdftotext', 'tesseract-ocr'],
    description: 'Portable Document Format',
    maxSizeMB: 500,
    supportsOCR: true
  },

  // Documentos Word modernos (DOCX)
  docx: {
    extensions: ['.docx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    methods: ['mammoth', 'pandoc', 'textutil'],
    description: 'Microsoft Word 2007+ Document',
    maxSizeMB: 200,
    supportsOCR: false
  },

  // Documentos Word antigos (DOC - Word 97-2003)
  doc: {
    extensions: ['.doc'],
    mimeTypes: ['application/msword'],
    methods: ['textract', 'antiword', 'pandoc', 'textutil'],
    description: 'Microsoft Word 97-2003 Document',
    maxSizeMB: 100,
    supportsOCR: false
  },

  // OpenDocument Text (ODT)
  odt: {
    extensions: ['.odt'],
    mimeTypes: ['application/vnd.oasis.opendocument.text'],
    methods: ['pandoc', 'textutil', 'odt2txt'],
    description: 'OpenDocument Text',
    maxSizeMB: 100,
    supportsOCR: false
  },

  // Rich Text Format (RTF)
  rtf: {
    extensions: ['.rtf'],
    mimeTypes: ['application/rtf', 'text/rtf'],
    methods: ['textutil', 'pandoc', 'unrtf'],
    description: 'Rich Text Format',
    maxSizeMB: 50,
    supportsOCR: false
  },

  // Plain Text (TXT)
  txt: {
    extensions: ['.txt', '.text', '.log'],
    mimeTypes: ['text/plain'],
    methods: ['direct-read'],
    description: 'Plain Text File',
    maxSizeMB: 50,
    supportsOCR: false
  },

  // Imagens com suporte a OCR
  image: {
    extensions: ['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.gif', '.webp'],
    mimeTypes: [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/tiff',
      'image/bmp',
      'image/gif',
      'image/webp'
    ],
    methods: ['tesseract-ocr', 'sharp'],
    description: 'Image files (OCR extraction)',
    maxSizeMB: 100,
    supportsOCR: true
  }
};

/**
 * Detecta o tipo de arquivo baseado na extensão e MIME type
 * @param {string} filePath - Caminho do arquivo
 * @returns {object} Configuração do extrator para o tipo detectado
 */
function detectFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const detectedMime = mime.lookup(filePath) || null;

  // Verificar por extensão primeiro
  for (const [type, config] of Object.entries(EXTRACTOR_CONFIG)) {
    if (config.extensions.includes(ext)) {
      return {
        type,
        config,
        extension: ext,
        mimeType: detectedMime,
        matchedBy: 'extension'
      };
    }
  }

  // Fallback: verificar por MIME type
  if (detectedMime) {
    for (const [type, config] of Object.entries(EXTRACTOR_CONFIG)) {
      if (config.mimeTypes.includes(detectedMime)) {
        return {
          type,
          config,
          extension: ext,
          mimeType: detectedMime,
          matchedBy: 'mime'
        };
      }
    }
  }

  return {
    type: 'unknown',
    config: null,
    extension: ext,
    mimeType: detectedMime,
    matchedBy: 'none'
  };
}

/**
 * Verifica se um arquivo é suportado para extração
 * @param {string} filePath - Caminho do arquivo
 * @returns {boolean}
 */
function isFileSupported(filePath) {
  const { type } = detectFileType(filePath);
  return type !== 'unknown';
}

/**
 * Retorna lista de todas as extensões suportadas
 * @returns {string[]}
 */
function getSupportedExtensions() {
  const extensions = [];
  for (const config of Object.values(EXTRACTOR_CONFIG)) {
    extensions.push(...config.extensions);
  }
  return [...new Set(extensions)];
}

/**
 * Retorna lista de todos os MIME types suportados
 * @returns {string[]}
 */
function getSupportedMimeTypes() {
  const mimeTypes = [];
  for (const config of Object.values(EXTRACTOR_CONFIG)) {
    mimeTypes.push(...config.mimeTypes);
  }
  return [...new Set(mimeTypes)];
}

// =============================================================================
// HELPER: Spawn Assíncrono (substitui execSync bloqueante)
// =============================================================================

/**
 * Executa comando externo de forma ASSÍNCRONA usando spawn
 * Substitui execSync que bloqueia o event loop do Node.js
 *
 * @param {string} command - Comando a executar
 * @param {string[]} args - Argumentos do comando
 * @param {object} options - Opções (timeout, maxBuffer, etc)
 * @returns {Promise<string>} - Stdout do comando
 */
function spawnAsync(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const { timeout = 600000, maxBuffer = 50 * 1024 * 1024, input = null } = options;

    const child = spawn(command, args, {
      maxBuffer,
      stdio: input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timeoutId = null;

    // Coletar stdout
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Coletar stderr
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Timeout handling
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timeout after ${timeout}ms: ${command} ${args.join(' ')}`));
      }, timeout);
    }

    // Se tem input (para stdin), enviar
    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }

    // Quando processo termina
    child.on('close', (code) => {
      if (timeoutId) clearTimeout(timeoutId);

      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed (exit ${code}): ${command} ${args.join(' ')}\n${stderr}`));
      }
    });

    // Erro ao iniciar processo
    child.on('error', (error) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(new Error(`Failed to start command: ${command} ${args.join(' ')}\n${error.message}`));
    });
  });
}

// =============================================================================
// CONFIGURAÇÃO
// =============================================================================

const CONFIG = {
  // ✅ SEMPRE usar ACTIVE_PATHS (detecta Render automaticamente por /var/data)
  // Env vars são fallback secundário caso usuário queira override manual
  uploadFolder: ACTIVE_PATHS.upload || process.env.UPLOAD_FOLDER,
  extractedFolder: ACTIVE_PATHS.extracted || process.env.EXTRACTED_FOLDER,
  processedFolder: ACTIVE_PATHS.processed || process.env.PROCESSED_FOLDER,

  // AWS
  s3Bucket: process.env.S3_BUCKET || 'rom-agent-documents',
  s3Region: process.env.AWS_REGION || 'us-west-2',
  s3Prefix: process.env.S3_PREFIX || 'documents/',

  // Bedrock Knowledge Base (opcional)
  knowledgeBaseId: process.env.BEDROCK_KB_ID || null,

  // Processamento
  supportedFormats: ['.pdf', '.docx', '.doc', '.txt', '.rtf', '.odt', '.png', '.jpg', '.jpeg', '.tiff', '.bmp'],
  imageFormats: ['.png', '.jpg', '.jpeg', '.tiff', '.bmp'],
  maxFileSizeMB: 500, // Aumentado para processos jurídicos grandes

  // ==========================================================================
  // CONFIGURACAO DE OCR PARALELO
  // ==========================================================================
  // Configurado via variaveis de ambiente:
  //   OCR_WORKERS=4       (numero de workers, default: 50% dos CPU cores)
  //   OCR_CHUNK_SIZE=6    (paginas por chunk, default: 6)
  //   OCR_PARALLEL=true   (habilitar paralelismo, default: true)
  // ==========================================================================
  ocr: {
    workers: OCR_PARALLEL_CONFIG.workers,           // Workers paralelos
    chunkSize: OCR_PARALLEL_CONFIG.chunkSize,       // Paginas por chunk (4-8)
    cpuCores: OCR_PARALLEL_CONFIG.cpuCores,         // CPU cores disponiveis
    parallel: OCR_PARALLEL_CONFIG.parallel,         // Modo paralelo ativado
    fallbackSequential: true                        // Fallback se paralelo falhar
  },

  // Opções de extração - 100% LOCAL (CUSTO ZERO - SEM TOKENS)
  extraction: {
    // ═══════════════════════════════════════════════════════════════
    // IMPORTANTE: NUNCA usar IA/Bedrock para extração!
    // Todas as ferramentas abaixo são LOCAIS e GRATUITAS
    // ═══════════════════════════════════════════════════════════════
    useAI: false,               // ❌ NUNCA usar IA para extração
    usePdfParse: true,          // ✅ pdf-parse (Node.js) - GRATUITO
    usePdftotext: true,         // ✅ pdftotext (CLI) - GRATUITO
    useMammoth: true,           // ✅ mammoth para DOCX - GRATUITO
    useOCR: true,               // ✅ Tesseract.js OCR - GRATUITO
    useSharp: true,             // ✅ Sharp pré-processamento - GRATUITO
    usePandoc: true,            // ✅ Pandoc conversão - GRATUITO
    useTextutil: true,          // ✅ textutil macOS - GRATUITO
    apply33Tools: true,         // ✅ 91 ferramentas de limpeza - GRATUITO
    apply10Processors: true,    // ✅ 10 processadores otimização - GRATUITO
    generateChunks: true,       // ✅ Gerar chunks otimizados - GRATUITO
    chunkSize: 450000,          // Tamanho do chunk em bytes
  },

  // Monitoramento
  watchInterval: 5000, // 5 segundos
};

// Log de configuracao OCR na inicializacao
console.log(`\n${'='.repeat(60)}`);
console.log(`  PIPELINE DE EXTRACAO - CONFIGURACAO OCR PARALELO`);
console.log(`${'='.repeat(60)}`);
console.log(`   CPU Cores disponiveis: ${CONFIG.ocr.cpuCores}`);
console.log(`   OCR Workers: ${CONFIG.ocr.workers}`);
console.log(`   Chunk Size: ${CONFIG.ocr.chunkSize} paginas`);
console.log(`   Modo Paralelo: ${CONFIG.ocr.parallel ? 'ATIVADO' : 'DESATIVADO'}`);
console.log(`   Fallback Sequencial: ${CONFIG.ocr.fallbackSequential ? 'SIM' : 'NAO'}`);
console.log(`${'='.repeat(60)}\n`);

// Estatísticas de ferramentas usadas
const STATS = {
  toolsUsed: new Set(),
  filesProcessed: 0,
  totalTextExtracted: 0,
  ocrUsed: 0,
};

// 🚀 Clientes AWS assíncronos (AWS SDK v3)
const s3Client = new S3Client({
  region: CONFIG.s3Region,
  maxAttempts: 3
});

const bedrockAgentClient = new BedrockAgentClient({
  region: CONFIG.s3Region,
  maxAttempts: 3
});

// Garantir pastas existem
[CONFIG.uploadFolder, CONFIG.extractedFolder, CONFIG.processedFolder].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// =============================================================================
// EXTRAÇÃO DE DOCUMENTOS (LOCAL - CUSTO ZERO)
// Usa TODAS as ferramentas disponíveis com fallbacks inteligentes
// =============================================================================

/**
 * Extrai texto de PDF usando múltiplas ferramentas
 * Ordem: pdf-parse → pdftotext → OCR (Tesseract)
 */
async function extractPDF(filePath, onProgress = null) {
  const methods = [];
  const stats = fs.statSync(filePath);
  const sizeMB = stats.size / (1024 * 1024);
  const sizeKB = stats.size / 1024;
  const isLargePDF = sizeMB > 10; // PDFs >10 MB precisam processamento especial

  if (isLargePDF) {
    console.log(`   ⚠️  PDF grande (${sizeMB.toFixed(1)} MB) - usando processamento otimizado`);
  }

  let extractedText = null;
  let extractionMethod = null;
  let pageCount = null;

  // 1. Tentar pdf-parse (Node.js - mais rápido)
  if (CONFIG.extraction.usePdfParse && !isLargePDF) {
    // Desabilitar pdf-parse para PDFs grandes (usa muita RAM de uma vez)
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);

      if (data.text && data.text.trim().length > 100) {
        STATS.toolsUsed.add('pdf-parse');
        methods.push('pdf-parse');
        extractedText = data.text;
        extractionMethod = 'pdf-parse';
        pageCount = data.numpages;
        console.log(`   ✅ pdf-parse extraiu ${Math.round(extractedText.length / 1000)}k caracteres`);
      }
    } catch (e) {
      console.log(`   ⚠️  pdf-parse falhou: ${e.message}`);
    }
  } else if (isLargePDF) {
    console.log(`   ⏭️  Pulando pdf-parse (PDF muito grande, usa muita RAM)`);
  }

  // 2. Tentar pdftotext (CLI - melhor layout) se pdf-parse não funcionou
  if (!extractedText && CONFIG.extraction.usePdftotext) {
    try {
      // 🚀 OTIMIZADO: spawnAsync não bloqueia Node.js (antes: execSync bloqueante)
      const output = await spawnAsync('pdftotext', ['-layout', filePath, '-'], {
        maxBuffer: 500 * 1024 * 1024, // 500 MB
        timeout: 1800000 // 30 minutos max (para arquivos grandes até 500MB)
      });

      if (output && output.trim().length > 100) {
        STATS.toolsUsed.add('pdftotext');
        methods.push('pdftotext');
        extractedText = output;
        extractionMethod = 'pdftotext';
        console.log(`   ✅ pdftotext extraiu ${Math.round(extractedText.length / 1000)}k caracteres`);
      }
    } catch (e) {
      console.log(`   ⚠️  pdftotext falhou: ${e.message}`);
    }
  }

  // 🔥 DETECÇÃO DE PDF ESCANEADO - Verificar SE o texto extraído é muito pequeno
  if (extractedText) {
    const textSizeKB = extractedText.length / 1024;
    const textToFileSizeRatio = textSizeKB / sizeKB;

    console.log(`   📊 Análise de extração:`);
    console.log(`      Arquivo: ${Math.round(sizeKB)} KB`);
    console.log(`      Texto extraído: ${Math.round(textSizeKB)} KB`);
    console.log(`      Ratio: ${(textToFileSizeRatio * 100).toFixed(2)}%`);

    // 🔥 FORÇA OCR se:
    // - Arquivo > 10 MB E ratio < 10% (PDF grande com pouco texto = escaneado)
    // - OU qualquer PDF com ratio < 2% (muito pouco texto)
    // Nota: PDFs digitais reais têm >15% de texto. 4-10% geralmente são escaneados com índice/metadados.
    const shouldForceOCR = (isLargePDF && textToFileSizeRatio < 0.10) || textToFileSizeRatio < 0.02;

    if (shouldForceOCR && CONFIG.extraction.useOCR) {
      console.log(`   🔥 MODO FORÇADO: PDF escaneado detectado (${(textToFileSizeRatio * 100).toFixed(3)}% de texto)`);
      console.log(`   🔄 Ignorando extração anterior e forçando OCR com Tesseract.js...`);

      try {
        const ocrResult = await ocrAvancado.extratorPDF.ocrPDFCompleto(filePath, {
          dpi: 300,
          preprocessar: true,
          onProgress: onProgress ? (progressData) => {
            // Mapear progresso OCR (0-100%) para progresso total (0-30%)
            const ocrPercent = progressData.percent || 0;
            const totalPercent = Math.floor(ocrPercent * 0.30); // OCR é 0-30% do total
            onProgress(`OCR: Processando batch ${progressData.batch}/${progressData.totalBatches} (${progressData.pagesProcessed}/${progressData.totalPages} páginas)`, totalPercent);
          } : null
        });

        if (ocrResult.success && ocrResult.texto && ocrResult.texto.trim().length > 50) {
          STATS.toolsUsed.add('tesseract-ocr');
          STATS.toolsUsed.add('sharp');
          STATS.ocrUsed++;
          methods.push('tesseract-ocr');
          console.log(`   ✅ OCR concluído: ${Math.round(ocrResult.texto.length / 1000)}k caracteres`);
          console.log(`   📊 Confiança média: ${Math.round(ocrResult.confiancaMedia)}%`);
          return {
            success: true,
            text: ocrResult.texto,
            method: 'tesseract-ocr',
            pages: ocrResult.paginas,
            confidence: ocrResult.confiancaMedia
          };
        } else {
          console.log(`   ⚠️  OCR não retornou texto suficiente, usando extração anterior`);
        }
      } catch (e) {
        console.log(`   ⚠️  OCR falhou: ${e.message}, usando extração anterior`);
      }
    } else {
      console.log(`   💡 PDF digital (${(textToFileSizeRatio * 100).toFixed(2)}% de texto) - usando ${extractionMethod}`);
    }

    // Se chegou aqui, usar texto extraído por pdf-parse/pdftotext
    return {
      success: true,
      text: extractedText,
      method: extractionMethod,
      pages: pageCount
    };
  }

  // 3. Tentar OCR (Tesseract.js) - fallback se nada funcionou
  if (CONFIG.extraction.useOCR) {
    try {
      console.log(`   🔍 Tentando OCR (documento pode ser escaneado)...`);
      const ocrResult = await ocrAvancado.extratorPDF.ocrPDFCompleto(filePath, {
        dpi: 300,
        preprocessar: true,
        onProgress: onProgress ? (progressData) => {
          // Mapear progresso OCR (0-100%) para progresso total (0-30%)
          const ocrPercent = progressData.percent || 0;
          const totalPercent = Math.floor(ocrPercent * 0.30);
          onProgress(`OCR: Processando batch ${progressData.batch}/${progressData.totalBatches} (${progressData.pagesProcessed}/${progressData.totalPages} páginas)`, totalPercent);
        } : null
      });

      if (ocrResult.success && ocrResult.texto && ocrResult.texto.trim().length > 50) {
        STATS.toolsUsed.add('tesseract-ocr');
        STATS.toolsUsed.add('sharp');
        STATS.ocrUsed++;
        methods.push('tesseract-ocr');
        return {
          success: true,
          text: ocrResult.texto,
          method: 'tesseract-ocr',
          pages: ocrResult.paginas,
          confidence: ocrResult.confiancaMedia
        };
      }
    } catch (e) {
      console.log(`   ⚠️  OCR falhou: ${e.message}`);
    }
  }

  return { success: false, error: 'Todas as ferramentas de extração falharam', methods };
}

/**
 * Extrai texto de DOCX usando múltiplas ferramentas
 * Ordem: mammoth → pandoc → textutil
 */
async function extractDOCX(filePath, sizeMB) {
  const isLargeFile = sizeMB > 10; // Arquivos >10 MB precisam processamento especial

  if (isLargeFile) {
    console.log(`   ⚠️  DOCX grande (${sizeMB.toFixed(1)} MB) - usando processamento otimizado`);
  }

  // Buffer otimizado baseado no tamanho do arquivo
  const maxBuffer = isLargeFile ? 500 * 1024 * 1024 : 100 * 1024 * 1024;

  // 1. Tentar mammoth (Node.js - melhor preservação de formatação)
  // Para arquivos grandes, mammoth pode ter problemas de memória, pular para CLI
  if (CONFIG.extraction.useMammoth && !isLargeFile) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });

      if (result.value && result.value.trim().length > 50) {
        STATS.toolsUsed.add('mammoth');
        return {
          success: true,
          text: result.value,
          method: 'mammoth',
          messages: result.messages
        };
      }
    } catch (e) {
      console.log(`   ⚠️  mammoth falhou: ${e.message}`);
    }
  } else if (isLargeFile) {
    console.log(`   ⏭️  Pulando mammoth (DOCX muito grande, usa muita RAM)`);
  }

  // 2. Tentar pandoc (CLI) - melhor para arquivos grandes
  try {
    // 🚀 OTIMIZADO: spawnAsync não bloqueia Node.js
    const output = await spawnAsync('pandoc', ['-f', 'docx', '-t', 'plain', filePath], {
      maxBuffer,
      timeout: 1800000 // 30 minutos max
    });

    if (output && output.trim().length > 50) {
      STATS.toolsUsed.add('pandoc');
      return { success: true, text: output, method: 'pandoc' };
    }
  } catch (e) {
    console.log(`   ⚠️  pandoc falhou: ${e.message}`);
  }

  // 3. Tentar textutil (macOS)
  try {
    // 🚀 OTIMIZADO: spawnAsync não bloqueia Node.js
    const output = await spawnAsync('textutil', ['-convert', 'txt', '-stdout', filePath], {
      maxBuffer,
      timeout: 1800000
    });

    if (output && output.trim().length > 50) {
      STATS.toolsUsed.add('textutil');
      return { success: true, text: output, method: 'textutil' };
    }
  } catch (e) {
    console.log(`   ⚠️  textutil falhou: ${e.message}`);
  }

  return { success: false, error: 'Todas as ferramentas falharam' };
}

/**
 * Extrai texto de DOC (Word 97-2003) usando múltiplas ferramentas
 * Ordem: antiword → textract → pandoc → textutil
 *
 * NOTA: O formato .doc é binário e mais complexo que DOCX.
 * Algumas ferramentas podem não estar disponíveis em todos os sistemas.
 */
async function extractDOC(filePath, sizeMB) {
  const isLargeFile = sizeMB > 10;
  const maxBuffer = isLargeFile ? 500 * 1024 * 1024 : 100 * 1024 * 1024;

  if (isLargeFile) {
    console.log(`   ⚠️  DOC grande (${sizeMB.toFixed(1)} MB) - usando processamento otimizado`);
  }

  // 1. Tentar antiword (ferramenta CLI específica para .doc)
  try {
    const output = await spawnAsync('antiword', [filePath], {
      maxBuffer,
      timeout: 600000 // 10 minutos
    });

    if (output && output.trim().length > 50) {
      STATS.toolsUsed.add('antiword');
      console.log(`   ✅ antiword extraiu ${Math.round(output.length / 1000)}k caracteres`);
      return { success: true, text: output, method: 'antiword' };
    }
  } catch (e) {
    console.log(`   ⚠️  antiword falhou ou não disponível: ${e.message}`);
  }

  // 2. Tentar catdoc (outra ferramenta CLI para .doc)
  try {
    const output = await spawnAsync('catdoc', ['-w', filePath], {
      maxBuffer,
      timeout: 600000
    });

    if (output && output.trim().length > 50) {
      STATS.toolsUsed.add('catdoc');
      console.log(`   ✅ catdoc extraiu ${Math.round(output.length / 1000)}k caracteres`);
      return { success: true, text: output, method: 'catdoc' };
    }
  } catch (e) {
    console.log(`   ⚠️  catdoc falhou ou não disponível: ${e.message}`);
  }

  // 3. Tentar textutil (macOS) - suporta .doc nativamente
  try {
    const output = await spawnAsync('textutil', ['-convert', 'txt', '-stdout', filePath], {
      maxBuffer,
      timeout: 1800000
    });

    if (output && output.trim().length > 50) {
      STATS.toolsUsed.add('textutil');
      console.log(`   ✅ textutil extraiu ${Math.round(output.length / 1000)}k caracteres`);
      return { success: true, text: output, method: 'textutil' };
    }
  } catch (e) {
    console.log(`   ⚠️  textutil falhou: ${e.message}`);
  }

  // 4. Tentar pandoc com especificação de formato
  try {
    const output = await spawnAsync('pandoc', ['-f', 'doc', '-t', 'plain', '--wrap=none', filePath], {
      maxBuffer,
      timeout: 1800000
    });

    if (output && output.trim().length > 50) {
      STATS.toolsUsed.add('pandoc');
      console.log(`   ✅ pandoc extraiu ${Math.round(output.length / 1000)}k caracteres`);
      return { success: true, text: output, method: 'pandoc' };
    }
  } catch (e) {
    console.log(`   ⚠️  pandoc falhou: ${e.message}`);
  }

  // 5. Tentar LibreOffice (conversão headless) como último recurso
  try {
    // Criar diretório temporário para output
    const tempDir = path.join(CONFIG.extractedFolder, '.temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    await spawnAsync('soffice', [
      '--headless',
      '--convert-to', 'txt:Text',
      '--outdir', tempDir,
      filePath
    ], {
      maxBuffer,
      timeout: 300000 // 5 minutos
    });

    // Ler arquivo convertido
    const baseName = path.basename(filePath, '.doc');
    const txtPath = path.join(tempDir, `${baseName}.txt`);

    if (fs.existsSync(txtPath)) {
      const output = fs.readFileSync(txtPath, 'utf8');
      fs.unlinkSync(txtPath); // Limpar arquivo temporário

      if (output && output.trim().length > 50) {
        STATS.toolsUsed.add('libreoffice');
        console.log(`   ✅ LibreOffice extraiu ${Math.round(output.length / 1000)}k caracteres`);
        return { success: true, text: output, method: 'libreoffice' };
      }
    }
  } catch (e) {
    console.log(`   ⚠️  LibreOffice falhou ou não disponível: ${e.message}`);
  }

  return {
    success: false,
    error: 'Nenhuma ferramenta conseguiu extrair o arquivo .doc. Instale: antiword, catdoc, ou LibreOffice.'
  };
}

/**
 * Extrai texto de ODT (OpenDocument Text) usando múltiplas ferramentas
 * Ordem: pandoc → odt2txt → textutil → LibreOffice
 */
async function extractODT(filePath, sizeMB) {
  const isLargeFile = sizeMB > 10;
  const maxBuffer = isLargeFile ? 500 * 1024 * 1024 : 100 * 1024 * 1024;

  if (isLargeFile) {
    console.log(`   ⚠️  ODT grande (${sizeMB.toFixed(1)} MB) - usando processamento otimizado`);
  }

  // 1. Tentar pandoc (melhor opção, preserva estrutura)
  try {
    const output = await spawnAsync('pandoc', ['-f', 'odt', '-t', 'plain', '--wrap=none', filePath], {
      maxBuffer,
      timeout: 1800000
    });

    if (output && output.trim().length > 50) {
      STATS.toolsUsed.add('pandoc');
      console.log(`   ✅ pandoc extraiu ${Math.round(output.length / 1000)}k caracteres`);
      return { success: true, text: output, method: 'pandoc' };
    }
  } catch (e) {
    console.log(`   ⚠️  pandoc falhou: ${e.message}`);
  }

  // 2. Tentar odt2txt (ferramenta específica)
  try {
    const output = await spawnAsync('odt2txt', ['--encoding=UTF-8', filePath], {
      maxBuffer,
      timeout: 600000
    });

    if (output && output.trim().length > 50) {
      STATS.toolsUsed.add('odt2txt');
      console.log(`   ✅ odt2txt extraiu ${Math.round(output.length / 1000)}k caracteres`);
      return { success: true, text: output, method: 'odt2txt' };
    }
  } catch (e) {
    console.log(`   ⚠️  odt2txt falhou ou não disponível: ${e.message}`);
  }

  // 3. Tentar textutil (macOS)
  try {
    const output = await spawnAsync('textutil', ['-convert', 'txt', '-stdout', filePath], {
      maxBuffer,
      timeout: 1800000
    });

    if (output && output.trim().length > 50) {
      STATS.toolsUsed.add('textutil');
      console.log(`   ✅ textutil extraiu ${Math.round(output.length / 1000)}k caracteres`);
      return { success: true, text: output, method: 'textutil' };
    }
  } catch (e) {
    console.log(`   ⚠️  textutil falhou: ${e.message}`);
  }

  // 4. Extrair manualmente do ZIP (ODT é um arquivo ZIP)
  try {
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(filePath);
    const contentXml = zip.readAsText('content.xml');

    if (contentXml) {
      // Remover tags XML e extrair apenas texto
      const text = contentXml
        .replace(/<text:p[^>]*>/g, '\n') // Parágrafos
        .replace(/<text:h[^>]*>/g, '\n\n') // Headers
        .replace(/<text:tab[^\/]*\/>/g, '\t') // Tabs
        .replace(/<text:s[^\/]*\/>/g, ' ') // Espaços
        .replace(/<[^>]+>/g, '') // Remover todas as tags
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (text && text.length > 50) {
        STATS.toolsUsed.add('odt-zip-extract');
        console.log(`   ✅ Extração ZIP extraiu ${Math.round(text.length / 1000)}k caracteres`);
        return { success: true, text, method: 'odt-zip-extract' };
      }
    }
  } catch (e) {
    console.log(`   ⚠️  Extração ZIP falhou: ${e.message}`);
  }

  return {
    success: false,
    error: 'Nenhuma ferramenta conseguiu extrair o arquivo .odt. Instale: pandoc ou odt2txt.'
  };
}

/**
 * Extrai texto de TXT (Plain Text) - leitura direta
 * Suporta diferentes encodings e detecta automaticamente
 */
async function extractTXT(filePath, sizeMB) {
  const isLargeFile = sizeMB > 10;

  if (isLargeFile) {
    console.log(`   ⚠️  TXT grande (${sizeMB.toFixed(1)} MB) - usando streaming`);
  }

  try {
    // Para arquivos grandes, usar streaming
    if (isLargeFile) {
      return new Promise((resolve, reject) => {
        let text = '';
        const stream = fs.createReadStream(filePath, {
          encoding: 'utf8',
          highWaterMark: 64 * 1024 // 64KB chunks
        });

        stream.on('data', (chunk) => {
          text += chunk;
        });

        stream.on('end', () => {
          STATS.toolsUsed.add('direct-read-stream');
          console.log(`   ✅ Leitura stream extraiu ${Math.round(text.length / 1000)}k caracteres`);
          resolve({
            success: true,
            text,
            method: 'direct-read-stream'
          });
        });

        stream.on('error', (err) => {
          reject(err);
        });
      });
    }

    // Para arquivos pequenos, leitura direta
    let text;

    // Tentar UTF-8 primeiro
    try {
      text = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      // Fallback para latin1 se UTF-8 falhar
      console.log(`   ⚠️  UTF-8 falhou, tentando latin1...`);
      text = fs.readFileSync(filePath, 'latin1');
    }

    // Normalizar quebras de linha
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    STATS.toolsUsed.add('direct-read');
    console.log(`   ✅ Leitura direta extraiu ${Math.round(text.length / 1000)}k caracteres`);

    return {
      success: true,
      text,
      method: 'direct-read'
    };
  } catch (e) {
    return {
      success: false,
      error: `Erro ao ler arquivo TXT: ${e.message}`
    };
  }
}

/**
 * Extrai texto de RTF (Rich Text Format) usando múltiplas ferramentas
 * Ordem: textutil → unrtf → pandoc → striprtf
 */
async function extractRTF(filePath, sizeMB) {
  const isLargeFile = sizeMB > 10;
  const maxBuffer = isLargeFile ? 500 * 1024 * 1024 : 100 * 1024 * 1024;

  if (isLargeFile) {
    console.log(`   ⚠️  RTF grande (${sizeMB.toFixed(1)} MB) - usando processamento otimizado`);
  }

  // 1. Tentar textutil (macOS) - melhor qualidade
  try {
    const output = await spawnAsync('textutil', ['-convert', 'txt', '-stdout', filePath], {
      maxBuffer,
      timeout: 1800000
    });

    if (output && output.trim().length > 10) {
      STATS.toolsUsed.add('textutil');
      console.log(`   ✅ textutil extraiu ${Math.round(output.length / 1000)}k caracteres`);
      return { success: true, text: output, method: 'textutil' };
    }
  } catch (e) {
    console.log(`   ⚠️  textutil falhou: ${e.message}`);
  }

  // 2. Tentar unrtf (ferramenta específica para RTF)
  try {
    const output = await spawnAsync('unrtf', ['--text', '--nopict', filePath], {
      maxBuffer,
      timeout: 600000
    });

    if (output && output.trim().length > 10) {
      // unrtf adiciona header, remover
      const cleanOutput = output
        .replace(/^-+\n.*?-+\n/s, '') // Remover header
        .trim();

      STATS.toolsUsed.add('unrtf');
      console.log(`   ✅ unrtf extraiu ${Math.round(cleanOutput.length / 1000)}k caracteres`);
      return { success: true, text: cleanOutput, method: 'unrtf' };
    }
  } catch (e) {
    console.log(`   ⚠️  unrtf falhou ou não disponível: ${e.message}`);
  }

  // 3. Tentar pandoc
  try {
    const output = await spawnAsync('pandoc', ['-f', 'rtf', '-t', 'plain', '--wrap=none', filePath], {
      maxBuffer,
      timeout: 1800000
    });

    if (output && output.trim().length > 10) {
      STATS.toolsUsed.add('pandoc');
      console.log(`   ✅ pandoc extraiu ${Math.round(output.length / 1000)}k caracteres`);
      return { success: true, text: output, method: 'pandoc' };
    }
  } catch (e) {
    console.log(`   ⚠️  pandoc falhou: ${e.message}`);
  }

  // 4. Fallback: extração básica de texto do RTF (regex)
  try {
    const rtfContent = fs.readFileSync(filePath, 'latin1');

    // Extrair texto removendo comandos RTF
    let text = rtfContent
      // Remover grupos de controle
      .replace(/\{\\[^{}]+\}/g, '')
      // Remover comandos de controle
      .replace(/\\[a-z]+[\d]*\s?/gi, '')
      // Remover caracteres especiais RTF
      .replace(/\\'([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      // Remover chaves restantes
      .replace(/[{}]/g, '')
      // Limpar espaços extras
      .replace(/\s+/g, ' ')
      .trim();

    if (text && text.length > 10) {
      STATS.toolsUsed.add('rtf-regex-extract');
      console.log(`   ✅ Extração regex extraiu ${Math.round(text.length / 1000)}k caracteres`);
      return { success: true, text, method: 'rtf-regex-extract' };
    }
  } catch (e) {
    console.log(`   ⚠️  Extração regex falhou: ${e.message}`);
  }

  return {
    success: false,
    error: 'Nenhuma ferramenta conseguiu extrair o arquivo .rtf. Instale: textutil (macOS), unrtf ou pandoc.'
  };
}

/**
 * Extrai texto de imagem usando OCR (Tesseract.js + Sharp)
 */
async function extractImage(filePath, sizeMB) {
  const isLargeFile = sizeMB > 10;

  if (isLargeFile) {
    console.log(`   ⚠️  Imagem grande (${sizeMB.toFixed(1)} MB) - usando processamento otimizado`);
  }

  if (!CONFIG.extraction.useOCR) {
    return { success: false, error: 'OCR desabilitado' };
  }

  try {
    console.log(`   🔍 Executando OCR em imagem...`);

    // Para imagens grandes, usar DPI menor para economizar memória
    const dpi = isLargeFile ? 200 : 300;

    // Pré-processar imagem com Sharp (com otimizações para arquivos grandes)
    const processedImage = await ocrAvancado.processadorImagem.prepararParaOCR(filePath, {
      maxWidth: isLargeFile ? 3000 : undefined, // Limitar largura em imagens grandes
      quality: isLargeFile ? 85 : 95
    });
    STATS.toolsUsed.add('sharp');

    // Executar OCR
    const result = await ocrAvancado.ocrEngine.executarOCR(processedImage, {
      preprocessar: false, // já pré-processado
      psm: 3,
      dpi
    });

    STATS.toolsUsed.add('tesseract-ocr');
    STATS.ocrUsed++;

    // Limpar arquivo temporário
    if (processedImage !== filePath) {
      try { fs.unlinkSync(processedImage); } catch (e) {}
    }

    return {
      success: true,
      text: result.texto,
      method: 'tesseract-ocr+sharp',
      confidence: result.confianca
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Extrai texto de qualquer formato suportado
 * Usa TODAS as ferramentas disponíveis
 */
export async function extractDocument(filePath, onProgress = null) {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  const stats = fs.statSync(filePath);
  const sizeMB = stats.size / (1024 * 1024);

  console.log(`📄 Extraindo: ${fileName} (${sizeMB.toFixed(2)} MB)`);

  if (sizeMB > CONFIG.maxFileSizeMB) {
    return { success: false, error: `Arquivo muito grande (max: ${CONFIG.maxFileSizeMB}MB)` };
  }

  let result;
  const isLargeFile = sizeMB > 10;

  // Buffer otimizado para comandos CLI baseado no tamanho do arquivo
  const maxBuffer = isLargeFile ? 500 * 1024 * 1024 : 100 * 1024 * 1024;

  // Detectar tipo de arquivo com MIME type
  const fileInfo = detectFileType(filePath);
  console.log(`   📋 Tipo detectado: ${fileInfo.type} (${fileInfo.mimeType || 'MIME desconhecido'})`);

  switch (ext) {
    case '.pdf':
      result = await extractPDF(filePath, onProgress);
      break;

    case '.docx':
      // Word 2007+ (DOCX)
      result = await extractDOCX(filePath, sizeMB);
      break;

    case '.doc':
      // Word 97-2003 (DOC) - usa funcao dedicada
      result = await extractDOC(filePath, sizeMB);
      break;

    case '.rtf':
      // Rich Text Format
      result = await extractRTF(filePath, sizeMB);
      break;

    case '.txt':
    case '.text':
    case '.log':
      // Plain Text - usa funcao dedicada com suporte a encoding
      result = await extractTXT(filePath, sizeMB);
      break;

    case '.odt':
      // OpenDocument Text - usa funcao dedicada
      result = await extractODT(filePath, sizeMB);
      break;

    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.tiff':
    case '.tif':
    case '.bmp':
    case '.gif':
    case '.webp':
      // Imagens - OCR com Tesseract
      result = await extractImage(filePath, sizeMB);
      break;
    default:
      result = { success: false, error: `Formato não suportado: ${ext}` };
  }

  if (result.success) {
    // Aplicar 91 ferramentas de processamento de texto
    const processed = await applyTextProcessing(result.text);
    result.text = processed.text;
    result.processingStats = processed.stats;

    result.wordCount = result.text.split(/\s+/).length;
    result.charCount = result.text.length;
    console.log(`   ✅ ${result.wordCount} palavras extraídas via ${result.method}`);
    if (processed.stats.reducao) {
      console.log(`   📊 Redução: ${processed.stats.reducao} (${processed.stats.ferramentasAplicadas} ferramentas)`);
    }
  } else {
    console.log(`   ❌ Erro: ${result.error}`);
  }

  STATS.filesProcessed++;
  STATS.totalTextExtracted += result.charCount || 0;

  // Adicionar campos que o server espera
  if (result.success) {
    result.textLength = result.charCount || result.text?.length || 0;
    result.toolsUsed = Array.from(STATS.toolsUsed);
  }

  return result;
}

/**
 * Aplica as 91 ferramentas de processamento de texto + 10 processadores
 * Usando o módulo extracao.js
 */
async function applyTextProcessing(text) {
  if (!CONFIG.extraction.apply33Tools) {
    return { text, stats: { ferramentasAplicadas: 0 } };
  }

  console.log(`   🔧 Aplicando 91 ferramentas de processamento...`);

  try {
    // Verificar se módulo extracao está disponível
    if (!extracao || typeof extracao.aplicarFerramentas !== 'function') {
      console.error(`   ❌ ERRO: Módulo extracao não disponível ou método aplicarFerramentas não encontrado`);
      return {
        text: cleanTextBasic(text),
        stats: { ferramentasAplicadas: 0, error: 'Módulo extracao não disponível' }
      };
    }

    // Aplicar 91 ferramentas de limpeza
    const resultado = await extracao.aplicarFerramentas(text);
    STATS.toolsUsed.add('33-ferramentas-processamento');
    console.log(`   ✅ 91 ferramentas aplicadas: ${resultado.ferramentasAplicadas} de 33`);

    let textoFinal = resultado.textoProcessado;
    let chunks = null;
    let metadados = null;

    // Aplicar 10 processadores de otimização
    if (CONFIG.extraction.apply10Processors) {
      console.log(`   ⚙️  Aplicando 10 processadores de otimização...`);
      const processadores = await extracao.aplicarProcessadores(textoFinal, {
        tamanhoChunk: CONFIG.extraction.chunkSize
      });
      STATS.toolsUsed.add('10-processadores-otimizacao');
      console.log(`   ✅ 10 processadores aplicados (chunks: ${processadores.chunks?.length || 0})`);

      chunks = CONFIG.extraction.generateChunks ? processadores.chunks : null;
      metadados = processadores.metadados;
    }

    return {
      text: textoFinal,
      stats: {
        tamanhoOriginal: resultado.tamanhoOriginal,
        tamanhoFinal: resultado.tamanhoFinal,
        reducao: resultado.reducao,
        ferramentasAplicadas: resultado.ferramentasAplicadas,
        chunks: chunks?.length || 0,
        metadados
      },
      chunks
    };
  } catch (e) {
    console.error(`   ❌ ERRO CRÍTICO no processamento: ${e.message}`);
    console.error(`   Stack: ${e.stack}`);
    // Fallback para limpeza básica
    return {
      text: cleanTextBasic(text),
      stats: { ferramentasAplicadas: 0, error: e.message }
    };
  }
}

/**
 * Limpeza básica de texto (fallback)
 */
function cleanTextBasic(text) {
  return text
    // Normalizar Unicode
    .normalize('NFKC')
    // Remover múltiplas quebras de linha
    .replace(/\n{3,}/g, '\n\n')
    // Remover espaços extras
    .replace(/[ \t]+/g, ' ')
    // Remover linhas só com espaços
    .replace(/^\s+$/gm, '')
    // Normalizar quebras de linha
    .replace(/\r\n/g, '\n')
    .trim();
}

// =============================================================================
// UPLOAD PARA AWS S3
// =============================================================================

/**
 * Faz upload de arquivo para S3 usando AWS SDK v3 (assíncrono)
 * 🚀 OTIMIZADO: AWS SDK não bloqueia Node.js (antes: aws cli execSync)
 */
export async function uploadToS3(localPath, s3Key = null) {
  const fileName = path.basename(localPath);
  const key = s3Key || `${CONFIG.s3Prefix}${fileName}`;

  try {
    // Ler arquivo com fs.promises (não bloqueante)
    const fileContent = await fs.promises.readFile(localPath);

    // Upload com AWS SDK v3 (assíncrono)
    const command = new PutObjectCommand({
      Bucket: CONFIG.s3Bucket,
      Key: key,
      Body: fileContent
    });

    await s3Client.send(command);

    const s3Uri = `s3://${CONFIG.s3Bucket}/${key}`;
    console.log(`   ☁️  Upload: ${s3Uri}`);

    return {
      success: true,
      bucket: CONFIG.s3Bucket,
      key: key,
      uri: s3Uri,
      url: `https://${CONFIG.s3Bucket}.s3.${CONFIG.s3Region}.amazonaws.com/${key}`
    };
  } catch (e) {
    console.log(`   ❌ Erro S3: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Lista arquivos no bucket S3 usando AWS SDK v3 (assíncrono)
 * 🚀 OTIMIZADO: AWS SDK não bloqueia Node.js (antes: aws cli execSync)
 */
export async function listS3Files(prefix = CONFIG.s3Prefix) {
  try {
    const command = new ListObjectsV2Command({
      Bucket: CONFIG.s3Bucket,
      Prefix: prefix
    });

    const response = await s3Client.send(command);

    if (!response.Contents || response.Contents.length === 0) {
      return [];
    }

    return response.Contents.map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified
    }));
  } catch (e) {
    console.log(`   ❌ Erro ao listar S3: ${e.message}`);
    return [];
  }
}

// =============================================================================
// PIPELINE COMPLETO
// =============================================================================
// GERAÇÃO DE DOCUMENTOS ESTRUTURADOS (100% LOCAL - SEM CUSTO)
// =============================================================================

/**
 * Gera fichamento do documento
 */
function generateFichamento(text, baseName) {
  const lines = text.split('\n').filter(l => l.trim());
  const totalWords = text.split(/\s+/).length;

  return `# FICHAMENTO: ${baseName}

## Informações Gerais
- **Total de palavras**: ${totalWords.toLocaleString('pt-BR')}
- **Total de linhas**: ${lines.length.toLocaleString('pt-BR')}
- **Gerado em**: ${new Date().toLocaleString('pt-BR')}

## Primeiras 50 linhas
\`\`\`
${lines.slice(0, 50).join('\n')}
\`\`\`

## Últimas 50 linhas
\`\`\`
${lines.slice(-50).join('\n')}
\`\`\`
`;
}

/**
 * Gera índice cronológico (identifica datas)
 */
function generateIndiceCronologico(text) {
  // Regex para datas brasileiras (dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy)
  const dateRegex = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g;
  const dates = [];
  let match;

  while ((match = dateRegex.exec(text)) !== null) {
    const context = text.substring(Math.max(0, match.index - 100), Math.min(text.length, match.index + 100));
    dates.push({
      date: match[1],
      context: context.replace(/\n/g, ' ').trim()
    });
  }

  let output = `# ÍNDICE CRONOLÓGICO\n\n`;
  output += `**Total de datas encontradas**: ${dates.length}\n\n`;

  dates.slice(0, 50).forEach((d, i) => {
    output += `## ${i + 1}. Data: ${d.date}\n`;
    output += `**Contexto**: ...${d.context}...\n\n`;
  });

  return output;
}

/**
 * Gera índice por tipo de documento
 */
function generateIndiceTipo(text) {
  const tipos = {
    'Petição Inicial': /petição\s+inicial/gi,
    'Contestação': /contestação/gi,
    'Sentença': /sentença/gi,
    'Acórdão': /acórdão/gi,
    'Decisão': /decisão/gi,
    'Despacho': /despacho/gi,
    'Certidão': /certidão|certid[ãa]o/gi,
    'Procuração': /procuração|procuraç[ãa]o/gi,
    'Recurso': /recurso/gi,
    'Agravo': /agravo/gi,
    'Apelação': /apelação|apelaç[ãa]o/gi,
    'Embargos': /embargos/gi
  };

  let output = `# ÍNDICE POR TIPO DE DOCUMENTO\n\n`;

  Object.entries(tipos).forEach(([tipo, regex]) => {
    const matches = (text.match(regex) || []).length;
    if (matches > 0) {
      output += `- **${tipo}**: ${matches} ocorrência(s)\n`;
    }
  });

  return output;
}

/**
 * Extrai entidades (partes, advogados, etc)
 */
function extractEntities(text) {
  const cpfRegex = /\b\d{3}\.?\d{3}\.?\d{3}\-?\d{2}\b/g;
  const cnpjRegex = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}\-?\d{2}\b/g;
  const oabRegex = /\bOAB[\/\s]*([A-Z]{2})[\/\s]*(\d+)/gi;

  return {
    cpfs: [...new Set((text.match(cpfRegex) || []))].slice(0, 20),
    cnpjs: [...new Set((text.match(cnpjRegex) || []))].slice(0, 20),
    oabs: [...new Set((text.match(oabRegex) || []))].slice(0, 20),
    totalCPFs: (text.match(cpfRegex) || []).length,
    totalCNPJs: (text.match(cnpjRegex) || []).length,
    totalOABs: (text.match(oabRegex) || []).length
  };
}

/**
 * Analisa pedidos
 */
function analyzePedidos(text) {
  const pedidosRegex = /(?:requer|requerem|pede|pedem|pleiteia|pleiteiam)[^\n]{10,200}/gi;
  const pedidos = (text.match(pedidosRegex) || []).slice(0, 30);

  let output = `# ANÁLISE DE PEDIDOS\n\n`;
  output += `**Total de pedidos identificados**: ${pedidos.length}\n\n`;

  pedidos.forEach((p, i) => {
    output += `## Pedido ${i + 1}\n${p.trim()}\n\n`;
  });

  return output;
}

/**
 * Extrai fatos relevantes
 */
function extractFatos(text) {
  const fatosRegex = /(?:fato|ocorreu|aconteceu|sucedeu)[^\n]{20,300}/gi;
  const fatos = (text.match(fatosRegex) || []).slice(0, 20);

  let output = `# FATOS RELEVANTES\n\n`;
  output += `**Total de fatos identificados**: ${fatos.length}\n\n`;

  fatos.forEach((f, i) => {
    output += `## Fato ${i + 1}\n${f.trim()}\n\n`;
  });

  return output;
}

/**
 * Extrai legislação citada
 */
function extractLegislacao(text) {
  const legislacaoRegex = /(?:Lei|Decreto|Medida Provisória|Código)[^\n]{10,150}/gi;
  const artigos = /(?:art\.?|artigo)\s*\d+[^\n]{0,100}/gi;

  const leis = [...new Set((text.match(legislacaoRegex) || []))].slice(0, 50);
  const artigosLista = [...new Set((text.match(artigos) || []))].slice(0, 50);

  let output = `# LEGISLAÇÃO CITADA\n\n`;
  output += `## Leis e Normas (${leis.length})\n\n`;
  leis.forEach((l, i) => {
    output += `${i + 1}. ${l.trim()}\n`;
  });

  output += `\n## Artigos Mencionados (${artigosLista.length})\n\n`;
  artigosLista.forEach((a, i) => {
    output += `${i + 1}. ${a.trim()}\n`;
  });

  return output;
}

/**
 * Gera documentos estruturados (fichamentos, índices, análises)
 * 100% LOCAL - SEM CUSTO
 */
async function generateStructuredDocuments(extractedText, baseName, timestamp) {
  const outputBase = path.join(CONFIG.extractedFolder, 'structured', baseName);
  if (!fs.existsSync(outputBase)) {
    fs.mkdirSync(outputBase, { recursive: true });
  }

  const startTime = Date.now();

  // 🚀 OTIMIZAÇÃO: Gerar todos os documentos EM PARALELO
  const [
    fichamento,
    indiceCronologico,
    indiceTipo,
    entidades,
    pedidos,
    fatos,
    legislacao
  ] = await Promise.all([
    Promise.resolve(generateFichamento(extractedText, baseName)),
    Promise.resolve(generateIndiceCronologico(extractedText)),
    Promise.resolve(generateIndiceTipo(extractedText)),
    Promise.resolve(extractEntities(extractedText)),
    Promise.resolve(analyzePedidos(extractedText)),
    Promise.resolve(extractFatos(extractedText)),
    Promise.resolve(extractLegislacao(extractedText))
  ]);

  // 🚀 OTIMIZAÇÃO: Escrever todos os arquivos EM PARALELO
  const writePromises = [
    fs.promises.writeFile(path.join(outputBase, `01_FICHAMENTO.md`), fichamento, 'utf8'),
    fs.promises.writeFile(path.join(outputBase, `02_INDICE_CRONOLOGICO.md`), indiceCronologico, 'utf8'),
    fs.promises.writeFile(path.join(outputBase, `03_INDICE_POR_TIPO.md`), indiceTipo, 'utf8'),
    fs.promises.writeFile(path.join(outputBase, `04_ENTIDADES.json`), JSON.stringify(entidades, null, 2), 'utf8'),
    fs.promises.writeFile(path.join(outputBase, `05_ANALISE_PEDIDOS.md`), pedidos, 'utf8'),
    fs.promises.writeFile(path.join(outputBase, `06_FATOS_RELEVANTES.md`), fatos, 'utf8'),
    fs.promises.writeFile(path.join(outputBase, `07_LEGISLACAO_CITADA.md`), legislacao, 'utf8')
  ];

  await Promise.all(writePromises);

  const elapsed = Date.now() - startTime;
  console.log(`      ✓ 7 documentos estruturados gerados em ${elapsed}ms (paralelo)`);

  const filesGenerated = [
    'FICHAMENTO',
    'ÍNDICE_CRONOLÓGICO',
    'ÍNDICE_POR_TIPO',
    'ENTIDADES',
    'ANÁLISE_PEDIDOS',
    'FATOS_RELEVANTES',
    'LEGISLAÇÃO_CITADA'
  ];

  return {
    success: true,
    filesGenerated: filesGenerated.length,
    files: filesGenerated,
    outputPath: outputBase,
    elapsedMs: elapsed
  };
}

// =============================================================================

/**
 * Processa um arquivo: extrai, salva localmente, sobe para S3
 * Usa TODAS as ferramentas disponíveis
 */
export async function processFile(filePath, onProgress = null) {
  const fileName = path.basename(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Helper para emitir progresso
  const emitProgress = (stage, percent) => {
    if (onProgress) {
      onProgress(stage, percent);
    }
  };

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📁 Processando: ${fileName}`);
  console.log(`${'═'.repeat(60)}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Etapa 1: Extrair texto (0-30%)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  emitProgress('Extraindo texto do documento...', 0);
  const extraction = await extractDocument(filePath, emitProgress);
  if (!extraction.success) {
    return { success: false, error: extraction.error, file: fileName };
  }
  emitProgress('Texto extraído com sucesso', 30);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Etapa 2-4: Salvar texto, chunks e metadados EM PARALELO (30-75%)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  emitProgress('Salvando arquivos...', 30);
  const extractedFileName = `${baseName}_${timestamp}.txt`;
  const extractedPath = path.join(CONFIG.extractedFolder, extractedFileName);

  // Preparar metadados
  const metadata = {
    originalFile: fileName,
    extractedFile: extractedFileName,
    extractedAt: new Date().toISOString(),
    method: extraction.method,
    wordCount: extraction.wordCount,
    charCount: extraction.charCount,
    estimatedTokens: Math.ceil(extraction.charCount / 4),
    costSaved: `$${(Math.ceil(extraction.charCount / 4) / 1000000 * 15).toFixed(4)} (vs. enviar PDF para modelo)`,
    processing: {
      ferramentasAplicadas: extraction.processingStats?.ferramentasAplicadas || 0,
      reducao: extraction.processingStats?.reducao || '0%',
      tamanhoOriginal: extraction.processingStats?.tamanhoOriginal || 0,
      tamanhoFinal: extraction.processingStats?.tamanhoFinal || 0,
      chunks: extraction.processingStats?.chunks?.length || 0
    },
    metadados: extraction.processingStats?.metadados || {},
    toolsUsed: Array.from(STATS.toolsUsed),
    confidence: extraction.confidence || null
  };

  const metadataPath = path.join(CONFIG.extractedFolder, `${baseName}_${timestamp}.json`);

  // 🚀 OTIMIZAÇÃO: Preparar chunks em paralelo
  let chunkFiles = [];
  let chunkWritePromises = [];
  if (extraction.processingStats?.chunks?.length > 0) {
    const chunksFolder = path.join(CONFIG.extractedFolder, 'chunks', baseName);
    if (!fs.existsSync(chunksFolder)) {
      fs.mkdirSync(chunksFolder, { recursive: true });
    }

    chunkWritePromises = extraction.processingStats.chunks.map((chunk, i) => {
      const chunkName = `PARTE_${String(i + 1).padStart(2, '0')}_de_${String(extraction.processingStats.chunks.length).padStart(2, '0')}.txt`;
      const chunkPath = path.join(chunksFolder, chunkName);
      chunkFiles.push(chunkPath);
      return fs.promises.writeFile(chunkPath, chunk, 'utf8');
    });
  }

  // 🚀 OTIMIZAÇÃO: Escrever TUDO em paralelo (texto principal + metadados + chunks)
  // 🔥 FIX: Adicionar timeout de 60s para evitar travamento
  const saveStartTime = Date.now();

  const saveWithTimeout = (promise, name, timeoutMs = 60000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout salvando ${name} após ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  };

  try {
    await Promise.all([
      saveWithTimeout(
        fs.promises.writeFile(extractedPath, extraction.text, 'utf8'),
        'texto principal',
        60000
      ),
      saveWithTimeout(
        fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8'),
        'metadados',
        30000
      ),
      ...chunkWritePromises.map((p, i) =>
        saveWithTimeout(p, `chunk ${i + 1}/${chunkWritePromises.length}`, 30000)
      )
    ]);

    const saveTime = Date.now() - saveStartTime;
    console.log(`   💾 Salvos: texto + metadados + ${chunkFiles.length} chunks em ${saveTime}ms (paralelo)`);
    emitProgress('Arquivos salvos com sucesso', 75);
  } catch (saveError) {
    console.error(`   ❌ Erro ao salvar arquivos: ${saveError.message}`);
    // Tentar salvar apenas o essencial (texto principal)
    try {
      await fs.promises.writeFile(extractedPath, extraction.text, 'utf8');
      console.log(`   ⚠️  Salvo apenas texto principal (chunks falharam)`);
      emitProgress('Texto principal salvo (chunks falharam)', 75);
    } catch (fallbackError) {
      throw new Error(`Falha crítica ao salvar: ${fallbackError.message}`);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Etapa 5: Upload para S3 (75-85%) - OPCIONAL E NÃO BLOQUEANTE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  let s3Result = { success: false };
  if (CONFIG.s3Bucket && CONFIG.s3Bucket !== 'rom-agent-documents') {
    emitProgress('Enviando para S3...', 75);

    try {
      // 🚀 OTIMIZAÇÃO: Upload de TODOS os arquivos em paralelo
      // 🔥 FIX: Timeout de 30s por arquivo para evitar travamento
      const s3StartTime = Date.now();
      const S3_TIMEOUT = 30000; // 30 segundos por arquivo

      const uploadWithTimeout = (uploadPromise, fileName) => {
        return Promise.race([
          uploadPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`S3 timeout: ${fileName}`)), S3_TIMEOUT)
          )
        ]);
      };

      const s3Uploads = [
        uploadWithTimeout(
          uploadToS3(extractedPath, `extracted/${extractedFileName}`),
          extractedFileName
        ),
        uploadWithTimeout(
          uploadToS3(metadataPath, `metadata/${baseName}_${timestamp}.json`),
          'metadata'
        ),
        ...chunkFiles.map((chunkFile, i) =>
          uploadWithTimeout(
            uploadToS3(chunkFile, `chunks/${baseName}/${path.basename(chunkFile)}`),
            `chunk ${i + 1}`
          )
        )
      ];

      const s3Results = await Promise.allSettled(s3Uploads);
      const successCount = s3Results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
      const failedCount = s3Results.length - successCount;

      s3Result = { success: successCount > 0, uploadedFiles: successCount, failedFiles: failedCount };

      const s3Time = Date.now() - s3StartTime;
      console.log(`   ☁️  S3: ${successCount}/${s3Results.length} arquivos enviados em ${s3Time}ms`);

      if (failedCount > 0) {
        console.log(`   ⚠️  ${failedCount} arquivo(s) falharam no S3 (continuando sem S3)`);
      }

      emitProgress('Upload S3 concluído', 85);
    } catch (s3Error) {
      console.error(`   ❌ Erro no upload S3: ${s3Error.message}`);
      console.log(`   ⚠️  Continuando sem S3...`);
      emitProgress('S3 falhou (continuando)', 85);
      s3Result = { success: false, error: s3Error.message };
    }
  } else {
    console.log(`   ⚠️  S3 não configurado (pulando upload)`);
    emitProgress('S3 não configurado (pulando)', 85);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Etapa 6: Gerar 7 documentos estruturados (85-95%)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  emitProgress('Gerando 7 documentos estruturados...', 85);
  console.log(`\n   ━━━ Gerando Documentos Estruturados ━━━`);
  const structuredDocs = await generateStructuredDocuments(extraction.text, baseName, timestamp);
  console.log(`   ✅ ${structuredDocs.filesGenerated} documentos estruturados criados`);
  emitProgress('Documentos estruturados criados', 95);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Etapa 7: Finalização (95-100%)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  emitProgress('Finalizando processamento...', 95);
  const processedPath = path.join(CONFIG.processedFolder, fileName);
  fs.renameSync(filePath, processedPath);
  console.log(`   📦 Movido para: processed/${fileName}`);

  // Mostrar ferramentas utilizadas
  console.log(`   🔧 Ferramentas: ${Array.from(STATS.toolsUsed).join(', ')}`);

  emitProgress('Processamento concluído', 100);

  return {
    success: true,
    file: fileName,
    extracted: extractedFileName,
    extraction: {
      method: extraction.method,
      wordCount: extraction.wordCount,
      charCount: extraction.charCount,
      estimatedTokens: metadata.estimatedTokens,
      confidence: extraction.confidence
    },
    processing: metadata.processing,
    structuredDocuments: structuredDocs,
    s3: s3Result.success ? s3Result : null,
    metadata,
    toolsUsed: Array.from(STATS.toolsUsed)
  };
}

/**
 * Processa todos os arquivos na pasta de upload
 */
export async function processUploadFolder() {
  const files = fs.readdirSync(CONFIG.uploadFolder)
    .filter(f => CONFIG.supportedFormats.includes(path.extname(f).toLowerCase()))
    .map(f => path.join(CONFIG.uploadFolder, f));

  if (files.length === 0) {
    console.log('📭 Nenhum arquivo para processar');
    return [];
  }

  console.log(`\n📬 ${files.length} arquivo(s) encontrado(s)\n`);

  const results = [];
  for (const file of files) {
    const result = await processFile(file);
    results.push(result);
  }

  return results;
}

// =============================================================================
// MONITORAMENTO DE PASTA (WATCH)
// =============================================================================

let watchInterval = null;

/**
 * Inicia monitoramento da pasta de upload
 */
export function startWatching() {
  console.log(`\n👁️  Monitorando pasta: ${CONFIG.uploadFolder}`);
  console.log(`   Intervalo: ${CONFIG.watchInterval / 1000}s`);
  console.log(`   Formatos: ${CONFIG.supportedFormats.join(', ')}`);
  console.log(`   Ctrl+C para parar\n`);

  // Processar arquivos existentes
  processUploadFolder();

  // Monitorar novos arquivos
  watchInterval = setInterval(async () => {
    const files = fs.readdirSync(CONFIG.uploadFolder)
      .filter(f => CONFIG.supportedFormats.includes(path.extname(f).toLowerCase()));

    if (files.length > 0) {
      await processUploadFolder();
    }
  }, CONFIG.watchInterval);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Parando monitoramento...');
    stopWatching();
    process.exit(0);
  });
}

/**
 * Para o monitoramento
 */
export function stopWatching() {
  if (watchInterval) {
    clearInterval(watchInterval);
    watchInterval = null;
  }
}

// =============================================================================
// INTEGRAÇÃO COM BEDROCK KNOWLEDGE BASE
// =============================================================================

/**
 * Sincroniza documentos extraídos com Bedrock Knowledge Base usando AWS SDK v3
 * (Requer Knowledge Base configurada no AWS Console)
 * 🚀 OTIMIZADO: AWS SDK não bloqueia Node.js (antes: aws cli execSync)
 */
export async function syncWithKnowledgeBase(dataSourceId = 'default') {
  if (!CONFIG.knowledgeBaseId) {
    console.log('⚠️  Knowledge Base não configurada (defina BEDROCK_KB_ID)');
    return { success: false, error: 'Knowledge Base não configurada' };
  }

  try {
    // Iniciar ingestion job com AWS SDK v3
    const command = new StartIngestionJobCommand({
      knowledgeBaseId: CONFIG.knowledgeBaseId,
      dataSourceId: dataSourceId
    });

    const response = await bedrockAgentClient.send(command);

    console.log('🔄 Sincronização iniciada com Bedrock Knowledge Base');
    return {
      success: true,
      ingestionJobId: response.ingestionJob?.ingestionJobId,
      status: response.ingestionJob?.status
    };
  } catch (e) {
    console.log(`   ❌ Erro ao iniciar sync KB: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// =============================================================================
// ESTATÍSTICAS
// =============================================================================

/**
 * Gera relatório de economia com detalhes de ferramentas
 */
export function generateSavingsReport() {
  const extractedFiles = fs.readdirSync(CONFIG.extractedFolder)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(CONFIG.extractedFolder, f), 'utf8'));
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);

  const totalChars = extractedFiles.reduce((sum, f) => sum + (f.charCount || 0), 0);
  const totalTokens = Math.ceil(totalChars / 4);
  const totalWords = extractedFiles.reduce((sum, f) => sum + (f.wordCount || 0), 0);

  // Coletar todas as ferramentas usadas
  const allTools = new Set();
  extractedFiles.forEach(f => {
    if (f.toolsUsed) {
      f.toolsUsed.forEach(t => allTools.add(t));
    }
  });

  // Estatísticas de processamento
  const processingStats = {
    totalReducao: 0,
    totalChunks: 0,
    filesWithOCR: 0
  };

  extractedFiles.forEach(f => {
    if (f.processing) {
      processingStats.totalChunks += f.processing.chunks || 0;
      if (f.processing.reducao) {
        const reducao = parseFloat(f.processing.reducao);
        if (!isNaN(reducao)) processingStats.totalReducao += reducao;
      }
    }
    if (f.method?.includes('ocr')) processingStats.filesWithOCR++;
  });

  // Custo se enviasse PDFs diretamente para modelo
  const costIfDirect = {
    fast: totalTokens / 1000000 * 0.30,
    standard: totalTokens / 1000000 * 2,
    premium: totalTokens / 1000000 * 15,
    ultra: totalTokens / 1000000 * 60
  };

  // Custo real (extração local = $0, S3 = ~$0.023/GB)
  const s3Cost = (totalChars / (1024 * 1024 * 1024)) * 0.023;

  const report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║       ROM AGENT - RELATÓRIO DE ECONOMIA COM EXTRAÇÃO COMPLETA                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

════════════════════════════════════════════════════════════════════════════════
DOCUMENTOS PROCESSADOS
════════════════════════════════════════════════════════════════════════════════
  Total de Arquivos:        ${extractedFiles.length}
  Total de Palavras:        ${totalWords.toLocaleString()}
  Total de Caracteres:      ${totalChars.toLocaleString()}
  Tokens Estimados:         ${totalTokens.toLocaleString()}
  Chunks para RAG:          ${processingStats.totalChunks}
  Arquivos com OCR:         ${processingStats.filesWithOCR}

════════════════════════════════════════════════════════════════════════════════
FERRAMENTAS UTILIZADAS (${allTools.size} ferramentas)
════════════════════════════════════════════════════════════════════════════════
${Array.from(allTools).map(t => `  ✓ ${t}`).join('\n') || '  (nenhuma)'}

════════════════════════════════════════════════════════════════════════════════
BIBLIOTECAS NODE.JS INTEGRADAS
════════════════════════════════════════════════════════════════════════════════
  ✓ pdf-parse          - Extração de texto de PDFs
  ✓ mammoth            - Conversão DOCX para texto
  ✓ tesseract.js       - OCR para documentos escaneados
  ✓ sharp              - Processamento de imagens para OCR
  ✓ 91 ferramentas     - Limpeza e normalização de texto jurídico
  ✓ 10 processadores   - Otimização e chunking para RAG

════════════════════════════════════════════════════════════════════════════════
ECONOMIA POR TIER (vs. enviar PDF bruto para modelo)
════════════════════════════════════════════════════════════════════════════════
  TIER_1_FAST (Nova Lite):     $${costIfDirect.fast.toFixed(4)} economizado
  TIER_2_STANDARD (Nova Pro):  $${costIfDirect.standard.toFixed(4)} economizado
  TIER_3_PREMIUM (Sonnet):     $${costIfDirect.premium.toFixed(4)} economizado
  TIER_4_ULTRA (Opus):         $${costIfDirect.ultra.toFixed(4)} economizado

════════════════════════════════════════════════════════════════════════════════
CUSTO REAL
════════════════════════════════════════════════════════════════════════════════
  Extração Local:              $0.00 (GRÁTIS - todas as ferramentas)
  Armazenamento S3 (estimado): $${s3Cost.toFixed(6)}/mês
  ──────────────────────────────────────────────────
  CUSTO TOTAL:                 $${s3Cost.toFixed(6)}/mês

════════════════════════════════════════════════════════════════════════════════
ECONOMIA TOTAL (comparado a PREMIUM)
════════════════════════════════════════════════════════════════════════════════
  Se enviasse PDFs para Sonnet: $${costIfDirect.premium.toFixed(4)}
  Custo com extração local:     $${s3Cost.toFixed(6)}
  ──────────────────────────────────────────────────
  ECONOMIA:                     $${(costIfDirect.premium - s3Cost).toFixed(4)} (${((1 - s3Cost / (costIfDirect.premium || 1)) * 100).toFixed(1)}%)
`;

  return report;
}

/**
 * Lista todas as ferramentas disponíveis no pipeline
 */
export function listAvailableTools() {
  return {
    extraction: {
      // PDF
      'pdf-parse': 'Extração de texto de PDFs (Node.js)',
      'pdftotext': 'Extração de PDFs com layout preservado (CLI Poppler)',

      // Word/Office
      'mammoth': 'Conversão DOCX para texto (Node.js)',
      'antiword': 'Extração de DOC Word 97-2003 (CLI)',
      'catdoc': 'Extração de DOC Word 97-2003 (CLI alternativo)',

      // OpenDocument
      'odt2txt': 'Extração de ODT OpenDocument (CLI)',
      'odt-zip-extract': 'Extração de ODT via descompactação ZIP (fallback)',

      // Rich Text e Plain Text
      'unrtf': 'Conversão RTF para texto (CLI)',
      'rtf-regex-extract': 'Extração RTF via regex (fallback)',
      'direct-read': 'Leitura direta de arquivos TXT',
      'direct-read-stream': 'Leitura streaming de arquivos TXT grandes',

      // Conversores universais
      'pandoc': 'Conversão universal de documentos (CLI)',
      'textutil': 'Conversão nativa macOS (RTF/DOC/DOCX/ODT)',
      'libreoffice': 'Conversão via LibreOffice headless (fallback)',

      // OCR/Imagens
      'tesseract-ocr': 'OCR para documentos escaneados e imagens',
      'sharp': 'Pré-processamento de imagens para melhor OCR'
    },
    formats: {
      pdf: EXTRACTOR_CONFIG.pdf,
      docx: EXTRACTOR_CONFIG.docx,
      doc: EXTRACTOR_CONFIG.doc,
      odt: EXTRACTOR_CONFIG.odt,
      rtf: EXTRACTOR_CONFIG.rtf,
      txt: EXTRACTOR_CONFIG.txt,
      image: EXTRACTOR_CONFIG.image
    },
    supportedExtensions: getSupportedExtensions(),
    supportedMimeTypes: getSupportedMimeTypes(),
    processing: {
      '33-ferramentas': extracao.FERRAMENTAS_PROCESSAMENTO?.map(f => f.nome) || [],
      '10-processadores': extracao.PROCESSADORES_OTIMIZACAO?.map(p => p.nome) || []
    },
    nodeLibraries: [
      'pdf-parse', 'mammoth', 'tesseract.js', 'sharp',
      'pdf-lib', 'pdfkit', 'jimp', 'adm-zip', 'mime-types'
    ]
  };
}

/**
 * Retorna estatísticas da sessão atual
 */
export function getSessionStats() {
  return {
    toolsUsed: Array.from(STATS.toolsUsed),
    filesProcessed: STATS.filesProcessed,
    totalTextExtracted: STATS.totalTextExtracted,
    ocrUsed: STATS.ocrUsed
  };
}

// =============================================================================
// EXPORTAÇÕES
// =============================================================================

// Named exports para importação direta
export {
  CONFIG,
  EXTRACTOR_CONFIG,
  detectFileType,
  isFileSupported,
  getSupportedExtensions,
  getSupportedMimeTypes
};

export default {
  CONFIG,
  EXTRACTOR_CONFIG,
  STATS,
  // Detecção de tipo
  detectFileType,
  isFileSupported,
  getSupportedExtensions,
  getSupportedMimeTypes,
  // Extração
  extractDocument,
  uploadToS3,
  listS3Files,
  processFile,
  processUploadFolder,
  startWatching,
  stopWatching,
  syncWithKnowledgeBase,
  generateSavingsReport,
  listAvailableTools,
  getSessionStats
};

// =============================================================================
// CLI
// =============================================================================

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'watch') {
    startWatching();

  } else if (cmd === 'process') {
    processUploadFolder().then(results => {
      console.log(`\n✅ ${results.filter(r => r.success).length}/${results.length} arquivos processados`);
      console.log(`\n🔧 Ferramentas usadas: ${Array.from(STATS.toolsUsed).join(', ')}`);
    });

  } else if (cmd === 'extract' && args[1]) {
    extractDocument(args[1]).then(result => {
      if (result.success) {
        console.log(`\n${result.text.substring(0, 2000)}...`);
        console.log(`\n[${result.wordCount} palavras | ${result.charCount} caracteres]`);
        console.log(`\n🔧 Ferramentas: ${Array.from(STATS.toolsUsed).join(', ')}`);
      }
    });

  } else if (cmd === 'upload' && args[1]) {
    uploadToS3(args[1]).then(result => {
      console.log(result);
    });

  } else if (cmd === 's3-list') {
    const files = listS3Files();
    console.log('Arquivos no S3:');
    files.forEach(f => console.log(`  ${f}`));

  } else if (cmd === 'sync-kb') {
    syncWithKnowledgeBase().then(result => {
      console.log(result);
    });

  } else if (cmd === 'report') {
    console.log(generateSavingsReport());

  } else if (cmd === 'tools') {
    const tools = listAvailableTools();
    console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║              ROM AGENT - FERRAMENTAS DE EXTRAÇÃO DISPONÍVEIS                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

════════════════════════════════════════════════════════════════════════════════
EXTRAÇÃO DE DOCUMENTOS
════════════════════════════════════════════════════════════════════════════════`);
    Object.entries(tools.extraction).forEach(([name, desc]) => {
      console.log(`  ✓ ${name.padEnd(20)} - ${desc}`);
    });

    console.log(`
════════════════════════════════════════════════════════════════════════════════
33 FERRAMENTAS DE PROCESSAMENTO DE TEXTO
════════════════════════════════════════════════════════════════════════════════`);
    tools.processing['33-ferramentas'].forEach((name, i) => {
      console.log(`  ${String(i + 1).padStart(2)}. ${name}`);
    });

    console.log(`
════════════════════════════════════════════════════════════════════════════════
10 PROCESSADORES DE OTIMIZAÇÃO
════════════════════════════════════════════════════════════════════════════════`);
    tools.processing['10-processadores'].forEach((name, i) => {
      console.log(`  ${String(i + 1).padStart(2)}. ${name}`);
    });

    console.log(`
════════════════════════════════════════════════════════════════════════════════
BIBLIOTECAS NODE.JS
════════════════════════════════════════════════════════════════════════════════
  ${tools.nodeLibraries.join(', ')}
`);

  } else if (cmd === 'stats') {
    const stats = getSessionStats();
    console.log(`
════════════════════════════════════════════════════════════════════════════════
ESTATÍSTICAS DA SESSÃO
════════════════════════════════════════════════════════════════════════════════
  Arquivos processados:    ${stats.filesProcessed}
  Texto extraído total:    ${stats.totalTextExtracted.toLocaleString()} caracteres
  OCR utilizado:           ${stats.ocrUsed} vezes
  Ferramentas usadas:      ${stats.toolsUsed.length > 0 ? stats.toolsUsed.join(', ') : '(nenhuma)'}
`);

  } else {
    console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║         ROM AGENT - PIPELINE DE EXTRAÇÃO COMPLETO                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

INTEGRA TODAS AS FERRAMENTAS:
  • pdf-parse, mammoth (Node.js)
  • pdftotext, pandoc, textutil (CLI)
  • tesseract.js + sharp (OCR)
  • 91 ferramentas de processamento de texto
  • 10 processadores de otimização

════════════════════════════════════════════════════════════════════════════════
COMANDOS
════════════════════════════════════════════════════════════════════════════════
  node lib/extractor-pipeline.js watch           - Monitorar pasta de upload
  node lib/extractor-pipeline.js process         - Processar arquivos pendentes
  node lib/extractor-pipeline.js extract <file>  - Extrair texto de um arquivo
  node lib/extractor-pipeline.js upload <file>   - Upload para S3
  node lib/extractor-pipeline.js s3-list         - Listar arquivos no S3
  node lib/extractor-pipeline.js sync-kb         - Sincronizar com Knowledge Base
  node lib/extractor-pipeline.js report          - Relatório de economia
  node lib/extractor-pipeline.js tools           - Listar todas as ferramentas
  node lib/extractor-pipeline.js stats           - Estatísticas da sessão

════════════════════════════════════════════════════════════════════════════════
CONFIGURAÇÃO (variáveis de ambiente)
════════════════════════════════════════════════════════════════════════════════
  UPLOAD_FOLDER      - Pasta de upload (default: ./upload)
  EXTRACTED_FOLDER   - Pasta de extraídos (default: ./extracted)
  S3_BUCKET          - Bucket S3 para upload
  AWS_REGION         - Região AWS (default: us-west-2)
  BEDROCK_KB_ID      - ID do Knowledge Base (opcional)

════════════════════════════════════════════════════════════════════════════════
FLUXO
════════════════════════════════════════════════════════════════════════════════
  1. Coloque PDFs/DOCXs/Imagens na pasta 'upload/'
  2. Execute 'watch' ou 'process'
  3. Textos extraídos vão para 'extracted/'
  4. Chunks para RAG vão para 'extracted/chunks/'
  5. Originais vão para 'processed/'
  6. Se S3 configurado, upload automático

════════════════════════════════════════════════════════════════════════════════
FORMATOS SUPORTADOS
════════════════════════════════════════════════════════════════════════════════
  PDF, DOCX, DOC, RTF, ODT, TXT, PNG, JPG, JPEG, TIFF, BMP
`);
  }
}
