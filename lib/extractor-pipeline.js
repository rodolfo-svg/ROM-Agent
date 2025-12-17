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
 * ║  ├── 33 ferramentas de limpeza de texto                                  ║
 * ║  └── 10 processadores de otimização                                      ║
 * ║                                                                          ║
 * ║  ECONOMIA: Se usasse IA para extrair 1M tokens = $15-60                  ║
 * ║            Com este pipeline = $0.00                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

// Bibliotecas Node.js para extração
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

// Módulos ROM existentes
import extracao from '../src/modules/extracao.js';
import ocrAvancado from '../src/modules/ocrAvancado.js';

// ✅ IMPORTAR ACTIVE_PATHS para usar disco persistente no Render
import { ACTIVE_PATHS } from './storage-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// CONFIGURAÇÃO
// =============================================================================

const CONFIG = {
  // ✅ Usar ACTIVE_PATHS para suportar disco persistente no Render (/var/data)
  uploadFolder: process.env.UPLOAD_FOLDER || ACTIVE_PATHS.upload,
  extractedFolder: process.env.EXTRACTED_FOLDER || ACTIVE_PATHS.extracted,
  processedFolder: process.env.PROCESSED_FOLDER || ACTIVE_PATHS.processed,

  // AWS
  s3Bucket: process.env.S3_BUCKET || 'rom-agent-documents',
  s3Region: process.env.AWS_REGION || 'us-east-1',
  s3Prefix: process.env.S3_PREFIX || 'documents/',

  // Bedrock Knowledge Base (opcional)
  knowledgeBaseId: process.env.BEDROCK_KB_ID || null,

  // Processamento
  supportedFormats: ['.pdf', '.docx', '.doc', '.txt', '.rtf', '.odt', '.png', '.jpg', '.jpeg', '.tiff', '.bmp'],
  imageFormats: ['.png', '.jpg', '.jpeg', '.tiff', '.bmp'],
  maxFileSizeMB: 100,

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
    apply33Tools: true,         // ✅ 33 ferramentas de limpeza - GRATUITO
    apply10Processors: true,    // ✅ 10 processadores otimização - GRATUITO
    generateChunks: true,       // ✅ Gerar chunks otimizados - GRATUITO
    chunkSize: 450000,          // Tamanho do chunk em bytes
  },

  // Monitoramento
  watchInterval: 5000, // 5 segundos
};

// Estatísticas de ferramentas usadas
const STATS = {
  toolsUsed: new Set(),
  filesProcessed: 0,
  totalTextExtracted: 0,
  ocrUsed: 0,
};

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
async function extractPDF(filePath) {
  const methods = [];

  // 1. Tentar pdf-parse (Node.js - mais rápido)
  if (CONFIG.extraction.usePdfParse) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);

      if (data.text && data.text.trim().length > 100) {
        STATS.toolsUsed.add('pdf-parse');
        methods.push('pdf-parse');
        return {
          success: true,
          text: data.text,
          method: 'pdf-parse',
          pages: data.numpages,
          info: data.info
        };
      }
    } catch (e) {
      console.log(`   ⚠️  pdf-parse falhou: ${e.message}`);
    }
  }

  // 2. Tentar pdftotext (CLI - melhor layout)
  if (CONFIG.extraction.usePdftotext) {
    try {
      const output = execSync(`pdftotext -layout "${filePath}" -`, {
        encoding: 'utf8',
        maxBuffer: 100 * 1024 * 1024
      });

      if (output && output.trim().length > 100) {
        STATS.toolsUsed.add('pdftotext');
        methods.push('pdftotext');
        return { success: true, text: output, method: 'pdftotext' };
      }
    } catch (e) {
      console.log(`   ⚠️  pdftotext falhou: ${e.message}`);
    }
  }

  // 3. Tentar OCR (Tesseract.js) - para PDFs escaneados
  if (CONFIG.extraction.useOCR) {
    try {
      console.log(`   🔍 Tentando OCR (documento pode ser escaneado)...`);
      const ocrResult = await ocrAvancado.extratorPDF.ocrPDFCompleto(filePath, {
        dpi: 300,
        preprocessar: true
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
async function extractDOCX(filePath) {
  // 1. Tentar mammoth (Node.js - melhor preservação de formatação)
  if (CONFIG.extraction.useMammoth) {
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
  }

  // 2. Tentar pandoc (CLI)
  try {
    const output = execSync(`pandoc -f docx -t plain "${filePath}"`, {
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024
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
    const output = execSync(`textutil -convert txt -stdout "${filePath}"`, {
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024
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
 * Extrai texto de RTF
 */
function extractRTF(filePath) {
  // Tentar textutil (macOS)
  try {
    const output = execSync(`textutil -convert txt -stdout "${filePath}"`, {
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024
    });
    STATS.toolsUsed.add('textutil');
    return { success: true, text: output, method: 'textutil' };
  } catch (e) {
    // Tentar pandoc
    try {
      const output = execSync(`pandoc -f rtf -t plain "${filePath}"`, {
        encoding: 'utf8',
        maxBuffer: 100 * 1024 * 1024
      });
      STATS.toolsUsed.add('pandoc');
      return { success: true, text: output, method: 'pandoc' };
    } catch (e2) {
      return { success: false, error: e2.message };
    }
  }
}

/**
 * Extrai texto de imagem usando OCR (Tesseract.js + Sharp)
 */
async function extractImage(filePath) {
  if (!CONFIG.extraction.useOCR) {
    return { success: false, error: 'OCR desabilitado' };
  }

  try {
    console.log(`   🔍 Executando OCR em imagem...`);

    // Pré-processar imagem com Sharp
    const processedImage = await ocrAvancado.processadorImagem.prepararParaOCR(filePath);
    STATS.toolsUsed.add('sharp');

    // Executar OCR
    const result = await ocrAvancado.ocrEngine.executarOCR(processedImage, {
      preprocessar: false, // já pré-processado
      psm: 3
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
export async function extractDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  const stats = fs.statSync(filePath);
  const sizeMB = stats.size / (1024 * 1024);

  console.log(`📄 Extraindo: ${fileName} (${sizeMB.toFixed(2)} MB)`);

  if (sizeMB > CONFIG.maxFileSizeMB) {
    return { success: false, error: `Arquivo muito grande (max: ${CONFIG.maxFileSizeMB}MB)` };
  }

  let result;

  switch (ext) {
    case '.pdf':
      result = await extractPDF(filePath);
      break;
    case '.docx':
    case '.doc':
      result = await extractDOCX(filePath);
      break;
    case '.rtf':
      result = extractRTF(filePath);
      break;
    case '.txt':
      result = { success: true, text: fs.readFileSync(filePath, 'utf8'), method: 'direct' };
      STATS.toolsUsed.add('direct-read');
      break;
    case '.odt':
      try {
        const output = execSync(`pandoc -f odt -t plain "${filePath}"`, {
          encoding: 'utf8',
          maxBuffer: 100 * 1024 * 1024
        });
        result = { success: true, text: output, method: 'pandoc' };
        STATS.toolsUsed.add('pandoc');
      } catch (e) {
        result = { success: false, error: e.message };
      }
      break;
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.tiff':
    case '.bmp':
      result = await extractImage(filePath);
      break;
    default:
      result = { success: false, error: `Formato não suportado: ${ext}` };
  }

  if (result.success) {
    // Aplicar 33 ferramentas de processamento de texto
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
 * Aplica as 33 ferramentas de processamento de texto + 10 processadores
 * Usando o módulo extracao.js
 */
async function applyTextProcessing(text) {
  if (!CONFIG.extraction.apply33Tools) {
    return { text, stats: { ferramentasAplicadas: 0 } };
  }

  console.log(`   🔧 Aplicando 33 ferramentas de processamento...`);

  try {
    // Verificar se módulo extracao está disponível
    if (!extracao || typeof extracao.aplicarFerramentas !== 'function') {
      console.error(`   ❌ ERRO: Módulo extracao não disponível ou método aplicarFerramentas não encontrado`);
      return {
        text: cleanTextBasic(text),
        stats: { ferramentasAplicadas: 0, error: 'Módulo extracao não disponível' }
      };
    }

    // Aplicar 33 ferramentas de limpeza
    const resultado = await extracao.aplicarFerramentas(text);
    STATS.toolsUsed.add('33-ferramentas-processamento');
    console.log(`   ✅ 33 ferramentas aplicadas: ${resultado.ferramentasAplicadas} de 33`);

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
 * Faz upload de arquivo para S3 usando AWS CLI
 */
export async function uploadToS3(localPath, s3Key = null) {
  const fileName = path.basename(localPath);
  const key = s3Key || `${CONFIG.s3Prefix}${fileName}`;

  try {
    execSync(
      `aws s3 cp "${localPath}" "s3://${CONFIG.s3Bucket}/${key}" --region ${CONFIG.s3Region}`,
      { encoding: 'utf8', stdio: 'pipe' }
    );

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
 * Lista arquivos no bucket S3
 */
export function listS3Files(prefix = CONFIG.s3Prefix) {
  try {
    const output = execSync(
      `aws s3 ls "s3://${CONFIG.s3Bucket}/${prefix}" --recursive --human-readable`,
      { encoding: 'utf8' }
    );
    return output.trim().split('\n').filter(Boolean);
  } catch (e) {
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

  const filesGenerated = [];

  // 1. FICHAMENTO
  const fichamento = generateFichamento(extractedText, baseName);
  const fichamentoPath = path.join(outputBase, `01_FICHAMENTO.md`);
  fs.writeFileSync(fichamentoPath, fichamento);
  filesGenerated.push('FICHAMENTO');
  console.log(`      ✓ Fichamento`);

  // 2. ÍNDICE CRONOLÓGICO
  const indiceCronologico = generateIndiceCronologico(extractedText);
  const indiceCronPath = path.join(outputBase, `02_INDICE_CRONOLOGICO.md`);
  fs.writeFileSync(indiceCronPath, indiceCronologico);
  filesGenerated.push('ÍNDICE_CRONOLÓGICO');
  console.log(`      ✓ Índice cronológico`);

  // 3. ÍNDICE POR TIPO
  const indiceTipo = generateIndiceTipo(extractedText);
  const indiceTipoPath = path.join(outputBase, `03_INDICE_POR_TIPO.md`);
  fs.writeFileSync(indiceTipoPath, indiceTipo);
  filesGenerated.push('ÍNDICE_POR_TIPO');
  console.log(`      ✓ Índice por tipo`);

  // 4. ENTIDADES
  const entidades = extractEntities(extractedText);
  const entidadesPath = path.join(outputBase, `04_ENTIDADES.json`);
  fs.writeFileSync(entidadesPath, JSON.stringify(entidades, null, 2));
  filesGenerated.push('ENTIDADES');
  console.log(`      ✓ Entidades`);

  // 5. ANÁLISE DE PEDIDOS
  const pedidos = analyzePedidos(extractedText);
  const pedidosPath = path.join(outputBase, `05_ANALISE_PEDIDOS.md`);
  fs.writeFileSync(pedidosPath, pedidos);
  filesGenerated.push('ANÁLISE_PEDIDOS');
  console.log(`      ✓ Análise de pedidos`);

  // 6. FATOS RELEVANTES
  const fatos = extractFatos(extractedText);
  const fatosPath = path.join(outputBase, `06_FATOS_RELEVANTES.md`);
  fs.writeFileSync(fatosPath, fatos);
  filesGenerated.push('FATOS_RELEVANTES');
  console.log(`      ✓ Fatos relevantes`);

  // 7. LEGISLAÇÃO CITADA
  const legislacao = extractLegislacao(extractedText);
  const legislacaoPath = path.join(outputBase, `07_LEGISLACAO_CITADA.md`);
  fs.writeFileSync(legislacaoPath, legislacao);
  filesGenerated.push('LEGISLAÇÃO_CITADA');
  console.log(`      ✓ Legislação citada`);

  return {
    success: true,
    filesGenerated: filesGenerated.length,
    files: filesGenerated,
    outputPath: outputBase
  };
}

// =============================================================================

/**
 * Processa um arquivo: extrai, salva localmente, sobe para S3
 * Usa TODAS as ferramentas disponíveis
 */
export async function processFile(filePath) {
  const fileName = path.basename(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📁 Processando: ${fileName}`);
  console.log(`${'═'.repeat(60)}`);

  // 1. Extrair texto (CUSTO: $0) - usando TODAS as ferramentas
  const extraction = await extractDocument(filePath);
  if (!extraction.success) {
    return { success: false, error: extraction.error, file: fileName };
  }

  // 2. Salvar texto extraído localmente
  const extractedFileName = `${baseName}_${timestamp}.txt`;
  const extractedPath = path.join(CONFIG.extractedFolder, extractedFileName);
  fs.writeFileSync(extractedPath, extraction.text, 'utf8');
  console.log(`   💾 Salvo: ${extractedFileName}`);

  // 3. Salvar chunks se gerados (para RAG)
  let chunkFiles = [];
  if (extraction.processingStats?.chunks?.length > 0) {
    const chunksFolder = path.join(CONFIG.extractedFolder, 'chunks', baseName);
    if (!fs.existsSync(chunksFolder)) {
      fs.mkdirSync(chunksFolder, { recursive: true });
    }

    for (let i = 0; i < extraction.processingStats.chunks.length; i++) {
      const chunkName = `PARTE_${String(i + 1).padStart(2, '0')}_de_${String(extraction.processingStats.chunks.length).padStart(2, '0')}.txt`;
      const chunkPath = path.join(chunksFolder, chunkName);
      fs.writeFileSync(chunkPath, extraction.processingStats.chunks[i]);
      chunkFiles.push(chunkPath);
    }
    console.log(`   📑 ${chunkFiles.length} chunks salvos para RAG`);
  }

  // 4. Criar metadados completos
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
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  // 5. Upload para S3 (CUSTO: ~$0.023/GB/mês)
  let s3Result = { success: false };
  if (CONFIG.s3Bucket && CONFIG.s3Bucket !== 'rom-agent-documents') {
    s3Result = await uploadToS3(extractedPath, `extracted/${extractedFileName}`);
    if (s3Result.success) {
      // Upload metadados também
      await uploadToS3(metadataPath, `metadata/${baseName}_${timestamp}.json`);

      // Upload chunks para S3
      for (const chunkFile of chunkFiles) {
        const chunkName = path.basename(chunkFile);
        await uploadToS3(chunkFile, `chunks/${baseName}/${chunkName}`);
      }
    }
  } else {
    console.log(`   ⚠️  S3 não configurado (defina S3_BUCKET)`);
  }

  // 6. Gerar documentos estruturados (fichamentos, índices, análises)
  console.log(`\n   ━━━ Gerando Documentos Estruturados ━━━`);
  const structuredDocs = await generateStructuredDocuments(extraction.text, baseName, timestamp);
  console.log(`   ✅ ${structuredDocs.filesGenerated} documentos estruturados criados`);

  // 7. Mover original para processados
  const processedPath = path.join(CONFIG.processedFolder, fileName);
  fs.renameSync(filePath, processedPath);
  console.log(`   📦 Movido para: processed/${fileName}`);

  // 8. Mostrar ferramentas utilizadas
  console.log(`   🔧 Ferramentas: ${Array.from(STATS.toolsUsed).join(', ')}`);

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
 * Sincroniza documentos extraídos com Bedrock Knowledge Base
 * (Requer Knowledge Base configurada no AWS Console)
 */
export async function syncWithKnowledgeBase() {
  if (!CONFIG.knowledgeBaseId) {
    console.log('⚠️  Knowledge Base não configurada (defina BEDROCK_KB_ID)');
    return { success: false, error: 'Knowledge Base não configurada' };
  }

  try {
    // Iniciar sincronização
    const output = execSync(
      `aws bedrock-agent start-ingestion-job --knowledge-base-id ${CONFIG.knowledgeBaseId} --data-source-id default --region ${CONFIG.s3Region}`,
      { encoding: 'utf8' }
    );

    console.log('🔄 Sincronização iniciada com Bedrock Knowledge Base');
    return { success: true, output: JSON.parse(output) };
  } catch (e) {
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
  ✓ 33 ferramentas     - Limpeza e normalização de texto jurídico
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
      'pdf-parse': 'Extração de texto de PDFs (Node.js)',
      'pdftotext': 'Extração de PDFs com layout (CLI)',
      'mammoth': 'Conversão DOCX para texto (Node.js)',
      'pandoc': 'Conversão de documentos (CLI)',
      'textutil': 'Conversão de RTF/DOC (macOS)',
      'tesseract-ocr': 'OCR para documentos escaneados',
      'sharp': 'Pré-processamento de imagens para OCR'
    },
    processing: {
      '33-ferramentas': extracao.FERRAMENTAS_PROCESSAMENTO.map(f => f.nome),
      '10-processadores': extracao.PROCESSADORES_OTIMIZACAO.map(p => p.nome)
    },
    nodeLibraries: [
      'pdf-parse', 'mammoth', 'tesseract.js', 'sharp',
      'pdf-lib', 'pdfkit', 'jimp'
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
export { CONFIG };

export default {
  CONFIG,
  STATS,
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
  • 33 ferramentas de processamento de texto
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
  AWS_REGION         - Região AWS (default: us-east-1)
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
