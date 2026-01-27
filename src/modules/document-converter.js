/**
 * ROM Agent - Document Converter
 *
 * Converte documentos Markdown para múltiplos formatos:
 * - DOCX (Word) com formatação profissional
 * - PDF com timbrado
 * - HTML formatado
 * - TXT puro
 *
 * Integra com sistema existente de templates e formatação
 *
 * @version 1.0.0
 * @since Fase 2 - Word por padrão
 */

import { marked } from 'marked';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, TableOfContents } from 'docx';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURAÇÕES DE FORMATAÇÃO
// ============================================================================

const FORMATO_CONFIG = {
  word: {
    margens: {
      top: 1440,    // 1 inch (twips)
      bottom: 1440,
      left: 1440,
      right: 1440
    },
    fonte: {
      principal: 'Times New Roman',
      codigo: 'Courier New',
      tamanho: {
        titulo1: 32,  // 16pt
        titulo2: 28,  // 14pt
        titulo3: 26,  // 13pt
        corpo: 24,    // 12pt
        citacao: 22,  // 11pt
        codigo: 20    // 10pt
      }
    },
    espacamento: {
      paragrafo: 360,  // 1.5 linhas
      depois: 240      // Espaço após parágrafo
    }
  },
  pdf: {
    margens: {
      top: 72,      // 1 inch (pontos)
      bottom: 72,
      left: 72,
      right: 72
    },
    fonte: {
      titulo: 16,
      subtitulo: 14,
      corpo: 12,
      citacao: 11,
      codigo: 10
    }
  }
};

// ============================================================================
// PARSER MARKDOWN → ESTRUTURA
// ============================================================================

/**
 * Parse Markdown para estrutura intermediária
 */
function parseMarkdownToStructure(markdown) {
  const tokens = marked.lexer(markdown);
  const structure = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        structure.push({
          type: 'heading',
          level: token.depth,
          text: token.text
        });
        break;

      case 'paragraph':
        structure.push({
          type: 'paragraph',
          text: token.text
        });
        break;

      case 'list':
        structure.push({
          type: 'list',
          ordered: token.ordered,
          items: token.items.map(item => item.text)
        });
        break;

      case 'blockquote':
        structure.push({
          type: 'blockquote',
          text: token.text
        });
        break;

      case 'code':
        structure.push({
          type: 'code',
          language: token.lang || 'text',
          text: token.text
        });
        break;

      case 'table':
        structure.push({
          type: 'table',
          header: token.header.map(h => h.text),
          rows: token.rows.map(row => row.map(cell => cell.text))
        });
        break;

      case 'hr':
        structure.push({ type: 'hr' });
        break;

      case 'space':
        // Ignorar espaços extras
        break;

      default:
        console.warn(`[DocumentConverter] Token type não suportado: ${token.type}`);
    }
  }

  return structure;
}

// ============================================================================
// MARKDOWN → WORD (DOCX)
// ============================================================================

/**
 * Converte Markdown para DOCX
 */
export async function markdownToWord(markdown, options = {}) {
  const {
    title = 'Documento',
    author = 'ROM Agent',
    subject = 'Documento Jurídico',
    timbrado = false
  } = options;

  console.log(`[DocumentConverter] Convertendo Markdown → Word (${markdown.length} chars)`);

  const structure = parseMarkdownToStructure(markdown);
  const children = [];

  // Adicionar título do documento (se fornecido)
  if (title && title !== 'Documento') {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: title.toUpperCase(),
            bold: true,
            size: FORMATO_CONFIG.word.fonte.tamanho.titulo1,
            font: FORMATO_CONFIG.word.fonte.principal
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );
  }

  // Converter estrutura para elementos Word
  for (const element of structure) {
    switch (element.type) {
      case 'heading':
        children.push(createHeading(element));
        break;

      case 'paragraph':
        children.push(createParagraph(element));
        break;

      case 'list':
        children.push(...createList(element));
        break;

      case 'blockquote':
        children.push(createBlockquote(element));
        break;

      case 'code':
        children.push(createCodeBlock(element));
        break;

      case 'hr':
        children.push(createHorizontalRule());
        break;
    }
  }

  // Criar documento
  const doc = new Document({
    creator: author,
    title: title,
    subject: subject,
    sections: [{
      properties: {
        page: {
          margin: FORMATO_CONFIG.word.margens
        }
      },
      children: children
    }]
  });

  // Gerar buffer
  const buffer = await Packer.toBuffer(doc);

  console.log(`[DocumentConverter] ✅ Word gerado (${buffer.length} bytes)`);

  return buffer;
}

/**
 * Criar heading (título)
 */
function createHeading(element) {
  const headingLevels = {
    1: { level: HeadingLevel.HEADING_1, size: FORMATO_CONFIG.word.fonte.tamanho.titulo1 },
    2: { level: HeadingLevel.HEADING_2, size: FORMATO_CONFIG.word.fonte.tamanho.titulo2 },
    3: { level: HeadingLevel.HEADING_3, size: FORMATO_CONFIG.word.fonte.tamanho.titulo3 }
  };

  const config = headingLevels[element.level] || headingLevels[3];

  return new Paragraph({
    children: [
      new TextRun({
        text: element.text,
        bold: true,
        size: config.size,
        font: FORMATO_CONFIG.word.fonte.principal
      })
    ],
    heading: config.level,
    spacing: { before: 400, after: 240 }
  });
}

/**
 * Criar parágrafo
 */
function createParagraph(element) {
  return new Paragraph({
    children: [
      new TextRun({
        text: element.text,
        size: FORMATO_CONFIG.word.fonte.tamanho.corpo,
        font: FORMATO_CONFIG.word.fonte.principal
      })
    ],
    alignment: AlignmentType.JUSTIFIED,
    spacing: {
      line: FORMATO_CONFIG.word.espacamento.paragrafo,
      after: FORMATO_CONFIG.word.espacamento.depois
    }
  });
}

/**
 * Criar lista
 */
function createList(element) {
  return element.items.map((item, index) => {
    const prefix = element.ordered ? `${index + 1}. ` : '• ';

    return new Paragraph({
      children: [
        new TextRun({
          text: prefix + item,
          size: FORMATO_CONFIG.word.fonte.tamanho.corpo,
          font: FORMATO_CONFIG.word.fonte.principal
        })
      ],
      indent: { left: 720, hanging: 360 },
      spacing: { after: 120 }
    });
  });
}

/**
 * Criar citação
 */
function createBlockquote(element) {
  return new Paragraph({
    children: [
      new TextRun({
        text: element.text,
        italics: true,
        size: FORMATO_CONFIG.word.fonte.tamanho.citacao,
        font: FORMATO_CONFIG.word.fonte.principal
      })
    ],
    indent: { left: 720, right: 720 },
    spacing: { before: 240, after: 240 }
  });
}

/**
 * Criar bloco de código
 */
function createCodeBlock(element) {
  return new Paragraph({
    children: [
      new TextRun({
        text: element.text,
        size: FORMATO_CONFIG.word.fonte.tamanho.codigo,
        font: FORMATO_CONFIG.word.fonte.codigo
      })
    ],
    indent: { left: 720 },
    spacing: { before: 240, after: 240 },
    shading: {
      fill: 'F5F5F5'
    }
  });
}

/**
 * Criar linha horizontal
 */
function createHorizontalRule() {
  return new Paragraph({
    children: [
      new TextRun({
        text: '─'.repeat(60),
        size: FORMATO_CONFIG.word.fonte.tamanho.corpo
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 240 }
  });
}

// ============================================================================
// MARKDOWN → PDF
// ============================================================================

/**
 * Converte Markdown para PDF
 */
export async function markdownToPDF(markdown, options = {}) {
  const {
    title = 'Documento',
    author = 'ROM Agent'
  } = options;

  console.log(`[DocumentConverter] Convertendo Markdown → PDF (${markdown.length} chars)`);

  return new Promise((resolve, reject) => {
    const structure = parseMarkdownToStructure(markdown);
    const chunks = [];

    const doc = new PDFDocument({
      margins: FORMATO_CONFIG.pdf.margens,
      info: {
        Title: title,
        Author: author
      }
    });

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      console.log(`[DocumentConverter] ✅ PDF gerado (${buffer.length} bytes)`);
      resolve(buffer);
    });
    doc.on('error', reject);

    // Título
    if (title && title !== 'Documento') {
      doc.fontSize(FORMATO_CONFIG.pdf.fonte.titulo)
         .font('Times-Bold')
         .text(title.toUpperCase(), { align: 'center' })
         .moveDown(2);
    }

    // Converter estrutura para PDF
    for (const element of structure) {
      switch (element.type) {
        case 'heading':
          const headingSizes = {
            1: FORMATO_CONFIG.pdf.fonte.titulo,
            2: FORMATO_CONFIG.pdf.fonte.subtitulo,
            3: FORMATO_CONFIG.pdf.fonte.corpo
          };
          doc.fontSize(headingSizes[element.level] || FORMATO_CONFIG.pdf.fonte.corpo)
             .font('Times-Bold')
             .text(element.text, { align: 'left' })
             .moveDown(0.5);
          break;

        case 'paragraph':
          doc.fontSize(FORMATO_CONFIG.pdf.fonte.corpo)
             .font('Times-Roman')
             .text(element.text, { align: 'justify' })
             .moveDown(0.5);
          break;

        case 'list':
          element.items.forEach((item, index) => {
            const prefix = element.ordered ? `${index + 1}. ` : '• ';
            doc.fontSize(FORMATO_CONFIG.pdf.fonte.corpo)
               .font('Times-Roman')
               .text(prefix + item, { indent: 20 })
               .moveDown(0.3);
          });
          doc.moveDown(0.5);
          break;

        case 'blockquote':
          doc.fontSize(FORMATO_CONFIG.pdf.fonte.citacao)
             .font('Times-Italic')
             .text(element.text, { indent: 40, align: 'justify' })
             .moveDown(0.5);
          break;

        case 'code':
          doc.fontSize(FORMATO_CONFIG.pdf.fonte.codigo)
             .font('Courier')
             .fillColor('#333333')
             .text(element.text, { indent: 20 })
             .fillColor('#000000')
             .moveDown(0.5);
          break;

        case 'hr':
          doc.moveDown(0.5)
             .strokeColor('#CCCCCC')
             .lineWidth(1)
             .moveTo(doc.x, doc.y)
             .lineTo(doc.page.width - FORMATO_CONFIG.pdf.margens.right, doc.y)
             .stroke()
             .strokeColor('#000000')
             .moveDown(0.5);
          break;
      }
    }

    doc.end();
  });
}

// ============================================================================
// MARKDOWN → HTML
// ============================================================================

/**
 * Converte Markdown para HTML formatado
 */
export function markdownToHTML(markdown, options = {}) {
  const {
    title = 'Documento',
    styles = true
  } = options;

  console.log(`[DocumentConverter] Convertendo Markdown → HTML (${markdown.length} chars)`);

  const html = marked.parse(markdown);

  if (!styles) {
    return html;
  }

  // HTML com CSS inline para melhor compatibilidade
  const styledHTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      color: #333;
    }
    h1 {
      font-size: 16pt;
      font-weight: bold;
      margin-top: 24pt;
      margin-bottom: 12pt;
      text-align: center;
      text-transform: uppercase;
    }
    h2 {
      font-size: 14pt;
      font-weight: bold;
      margin-top: 18pt;
      margin-bottom: 10pt;
    }
    h3 {
      font-size: 13pt;
      font-weight: bold;
      margin-top: 14pt;
      margin-bottom: 8pt;
    }
    p {
      text-align: justify;
      margin-bottom: 12pt;
    }
    blockquote {
      margin: 20px 40px;
      padding: 10px 20px;
      border-left: 4px solid #ccc;
      font-style: italic;
      color: #666;
    }
    code {
      font-family: 'Courier New', monospace;
      font-size: 10pt;
      background-color: #f5f5f5;
      padding: 2px 4px;
      border-radius: 3px;
    }
    pre {
      background-color: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
    }
    pre code {
      background-color: transparent;
      padding: 0;
    }
    ul, ol {
      margin-bottom: 12pt;
      padding-left: 40px;
    }
    li {
      margin-bottom: 6pt;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    hr {
      border: none;
      border-top: 1px solid #ccc;
      margin: 24pt 0;
    }
    @media print {
      body {
        margin: 0;
        padding: 20mm;
      }
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>
  `.trim();

  console.log(`[DocumentConverter] ✅ HTML gerado`);

  return styledHTML;
}

// ============================================================================
// MARKDOWN → TXT (Plain Text)
// ============================================================================

/**
 * Converte Markdown para TXT puro (remove formatação)
 */
export function markdownToText(markdown) {
  console.log(`[DocumentConverter] Convertendo Markdown → TXT (${markdown.length} chars)`);

  // Remove formatação Markdown mantendo texto
  let text = markdown
    // Headers
    .replace(/^#{1,6}\s+/gm, '')
    // Bold/Italic
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Links
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // Images
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
    // Code blocks
    .replace(/```[\s\S]*?```/g, match => match.replace(/```[^\n]*\n?/g, '').trim())
    // Inline code
    .replace(/`([^`]+)`/g, '$1')
    // Blockquotes
    .replace(/^>\s+/gm, '')
    // Lists
    .replace(/^[\*\-\+]\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, (match) => match)
    // Horizontal rules
    .replace(/^[\-\*_]{3,}$/gm, '─'.repeat(60))
    // Multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  console.log(`[DocumentConverter] ✅ TXT gerado (${text.length} chars)`);

  return text;
}

// ============================================================================
// FUNÇÃO UNIFICADA DE CONVERSÃO
// ============================================================================

/**
 * Converte Markdown para formato especificado
 *
 * @param {string} markdown - Conteúdo em Markdown
 * @param {string} format - Formato de saída: 'docx', 'pdf', 'html', 'txt', 'md'
 * @param {Object} options - Opções de conversão
 * @returns {Promise<Buffer|string>} - Documento convertido
 */
export async function convertDocument(markdown, format = 'docx', options = {}) {
  if (!markdown || typeof markdown !== 'string') {
    throw new Error('Markdown inválido');
  }

  const formatLower = format.toLowerCase();

  console.log(`[DocumentConverter] Iniciando conversão para ${formatLower.toUpperCase()}`);

  switch (formatLower) {
    case 'docx':
    case 'word':
      return await markdownToWord(markdown, options);

    case 'pdf':
      return await markdownToPDF(markdown, options);

    case 'html':
      return markdownToHTML(markdown, options);

    case 'txt':
    case 'text':
      return markdownToText(markdown);

    case 'md':
    case 'markdown':
      // Retornar Markdown como está
      return markdown;

    default:
      throw new Error(`Formato não suportado: ${format}. Use: docx, pdf, html, txt, md`);
  }
}

// Exportar tudo
export default {
  convertDocument,
  markdownToWord,
  markdownToPDF,
  markdownToHTML,
  markdownToText
};
