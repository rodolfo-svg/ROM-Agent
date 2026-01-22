/**
 * ROM Agent - Export Service
 *
 * Serviço unificado para exportação de conteúdo em múltiplos formatos
 * com formatação jurídica ABNT.
 *
 * Formatos suportados:
 * - DOCX (Word) - Formatação ABNT completa
 * - PDF - Alta qualidade via Puppeteer
 * - HTML - Com CSS ABNT
 * - Markdown - Formatado
 * - TXT - Texto simples
 *
 * Templates disponíveis:
 * - oab: Padrão OAB para petições (default)
 * - abnt: Acadêmico ABNT
 * - moderno: Formatação moderna
 * - compacto: Formatação compacta
 * - classico: Formatação clássica
 */

import path from 'path';
import { marked } from 'marked';
import { createRequire } from 'module';
import formattingTemplates from '../../lib/formatting-templates.js';
import PDFGenerator from './pdf-generator-service.js';
import handlebars from 'handlebars';

// Import CommonJS modules
const require = createRequire(import.meta.url);
const DocxExporter = require('../../lib/docx-exporter.cjs');

class ExportService {
  constructor() {
    this.formattingTemplates = formattingTemplates;
    this.docxExporter = DocxExporter;
  }

  /**
   * Exporta conteúdo em formato específico com formatação ABNT
   *
   * @param {Object} options - Opções de exportação
   * @param {string} options.content - Conteúdo a exportar
   * @param {string} options.format - 'docx' | 'pdf' | 'html' | 'markdown' | 'txt'
   * @param {string} options.title - Título do documento
   * @param {string} options.type - 'artifact' | 'jurisprudence' | 'analysis' | 'chat'
   * @param {Object} options.metadata - { author, date, tribunal, etc }
   * @param {string} options.template - 'oab' | 'abnt' | 'moderno' | etc (default: 'oab')
   * @returns {Promise<Buffer|string>} - Documento gerado
   */
  async export({
    content,
    format,
    title,
    type = 'generic',
    metadata = {},
    template = 'oab'
  }) {
    console.log(`[ExportService] Exportando: ${title} (formato: ${format}, template: ${template})`);

    // 1. Detectar tipo de conteúdo
    const contentType = this.detectContentType(content, type);
    console.log(`[ExportService] Tipo detectado: ${contentType}`);

    // 2. Aplicar pré-processamento
    const processedContent = await this.preprocessContent(content, contentType);

    // 3. Aplicar template ABNT
    const formattedContent = this.applyABNTTemplate(processedContent, template);

    // 4. Gerar documento no formato solicitado
    switch (format) {
      case 'docx':
        return await this.generateDOCX(formattedContent, { title, type: contentType, ...metadata });
      case 'pdf':
        return await this.generatePDF(formattedContent, { title, type: contentType, ...metadata });
      case 'html':
        return await this.generateHTML(formattedContent, { title, type: contentType, ...metadata });
      case 'markdown':
        return this.generateMarkdown(formattedContent, { title, type: contentType, ...metadata });
      case 'txt':
        return this.generateTXT(formattedContent);
      default:
        throw new Error(`Formato não suportado: ${format}`);
    }
  }

  /**
   * Detecta tipo de conteúdo para formatação apropriada
   */
  detectContentType(content, hint) {
    // Se hint foi fornecido, usar
    if (hint && hint !== 'generic') {
      return hint;
    }

    // Detectar baseado no conteúdo
    const lowerContent = content.toLowerCase();

    // Jurisprudência: contém tribunal, relator, ementa
    if (/(stf|stj|tst|trf|tj)/i.test(content) &&
        /(relator|ementa|acórdão)/i.test(content)) {
      return 'jurisprudence';
    }

    // Peça jurídica: contém excelentíssimo, requerente, pedido
    if (/(excelentíssimo|requerente|requerido|pedido)/i.test(content)) {
      return 'legal_brief';
    }

    // Análise processual: contém layers, timeline, análise
    if (/(layer|análise|timeline|processo)/i.test(content)) {
      return 'analysis';
    }

    // Contrato: contém cláusula, partes, contratante
    if (/(cláusula|contratante|contratado)/i.test(content)) {
      return 'contract';
    }

    return 'generic';
  }

  /**
   * Pré-processa conteúdo (extrai citações, formata)
   */
  async preprocessContent(content, type) {
    switch (type) {
      case 'jurisprudence':
        return this.formatJurisprudenceCitations(content);

      case 'analysis':
        return this.formatCaseAnalysis(content);

      case 'legal_brief':
        return this.formatLegalBrief(content);

      case 'contract':
        return this.formatContract(content);

      default:
        return content;
    }
  }

  /**
   * Aplica template ABNT do formatting-templates.js
   */
  applyABNTTemplate(content, templateId = 'oab') {
    const template = this.formattingTemplates.getPreset(templateId);

    if (!template) {
      console.warn(`[ExportService] Template '${templateId}' não encontrado, usando 'oab'`);
      return this.applyABNTTemplate(content, 'oab');
    }

    return {
      content,
      template,
      docxConfig: this.formattingTemplates.toDocxConfig(templateId),
      css: this.formattingTemplates.toCSS(templateId)
    };
  }

  /**
   * Gera DOCX usando lib/docx-exporter.cjs
   */
  async generateDOCX(formattedContent, metadata) {
    try {
      // Use exportToDocx function from docx-exporter.cjs
      const buffer = await this.docxExporter.exportToDocx({
        content: formattedContent.content,
        title: metadata.title,
        author: metadata.author || 'ROM Agent',
        date: metadata.date || new Date(),
        template: formattedContent.template,
        // Papel timbrado se for peça jurídica
        letterhead: metadata.type === 'legal_brief'
      });

      console.log(`[ExportService] DOCX gerado com sucesso: ${Buffer.byteLength(buffer)} bytes`);
      return buffer;
    } catch (error) {
      console.error('[ExportService] Erro ao gerar DOCX:', error);
      throw new Error(`Falha ao gerar DOCX: ${error.message}`);
    }
  }

  /**
   * Gera PDF usando Puppeteer (HTML → PDF)
   */
  async generatePDF(formattedContent, metadata) {
    try {
      // 1. Gerar HTML formatado
      const html = await this.generateHTML(formattedContent, metadata);

      // 2. Renderizar HTML → PDF com Puppeteer
      const pdfBuffer = await PDFGenerator.htmlToPDF(html, {
        format: 'A4',
        margin: {
          top: formattedContent.template.margins.top,
          right: formattedContent.template.margins.right,
          bottom: formattedContent.template.margins.bottom,
          left: formattedContent.template.margins.left
        },
        displayHeaderFooter: true,
        headerTemplate: this.buildHeader(metadata),
        footerTemplate: this.buildFooter(metadata)
      });

      console.log(`[ExportService] PDF gerado com sucesso: ${Buffer.byteLength(pdfBuffer)} bytes`);
      return pdfBuffer;
    } catch (error) {
      console.error('[ExportService] Erro ao gerar PDF:', error);
      throw new Error(`Falha ao gerar PDF: ${error.message}`);
    }
  }

  /**
   * Gera HTML formatado com CSS ABNT
   */
  async generateHTML(formattedContent, metadata) {
    const template = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <style>
    /* Reset básico */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    /* CSS ABNT do formatting-templates.js */
    {{{css}}}

    /* Estilos adicionais para impressão */
    @media print {
      @page {
        size: A4;
        margin: {{margins}};
      }
      body {
        margin: 0;
      }
    }

    /* Container principal */
    body {
      background: #f5f5f5;
      padding: 20px;
    }

    article {
      max-width: 21cm;
      margin: 0 auto;
      background: white;
      padding: {{margins}};
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    /* Metadata */
    .metadata {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e0e0e0;
      font-size: 0.9rem;
      color: #666;
    }

    .metadata p {
      margin: 0.25rem 0;
    }

    /* Conteúdo */
    .content {
      line-height: {{lineSpacing}};
    }

    .content h1, .content h2, .content h3 {
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
    }

    .content p {
      margin-bottom: 1rem;
      text-align: justify;
    }

    .content ul, .content ol {
      margin-left: 2rem;
      margin-bottom: 1rem;
    }

    /* Links */
    a {
      color: #d97706;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    /* Rodapé */
    footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid #e0e0e0;
      font-size: 0.8rem;
      color: #999;
      text-align: center;
    }

    @media screen and (max-width: 768px) {
      article {
        padding: 1rem;
      }
    }
  </style>
</head>
<body>
  <article>
    <h1>{{title}}</h1>
    {{#if showMetadata}}
    <div class="metadata">
      {{#if author}}<p><strong>Autor:</strong> {{author}}</p>{{/if}}
      {{#if date}}<p><strong>Data:</strong> {{date}}</p>{{/if}}
      {{#if tribunal}}<p><strong>Tribunal:</strong> {{tribunal}}</p>{{/if}}
    </div>
    {{/if}}
    <div class="content">
      {{{content}}}
    </div>
    <footer>
      <p>Documento gerado por ROM Agent - Assistente Jurídico</p>
      <p>{{generatedAt}}</p>
    </footer>
  </article>
</body>
</html>`;

    try {
      const compiled = handlebars.compile(template);

      return compiled({
        title: metadata.title || 'Documento',
        author: metadata.author,
        date: this.formatDate(metadata.date),
        tribunal: metadata.tribunal,
        showMetadata: metadata.author || metadata.date || metadata.tribunal,
        css: formattedContent.css,
        content: this.markdownToHTML(formattedContent.content),
        margins: this.cssMargins(formattedContent.template.margins),
        lineSpacing: formattedContent.template.paragraph.lineSpacing,
        generatedAt: new Date().toLocaleString('pt-BR')
      });
    } catch (error) {
      console.error('[ExportService] Erro ao gerar HTML:', error);
      throw new Error(`Falha ao gerar HTML: ${error.message}`);
    }
  }

  /**
   * Gera Markdown formatado
   */
  generateMarkdown(formattedContent, metadata) {
    const lines = [];

    // Cabeçalho
    lines.push(`# ${metadata.title || 'Documento'}`);
    lines.push('');

    // Metadata
    if (metadata.author) {
      lines.push(`**Autor:** ${metadata.author}`);
    }
    if (metadata.date) {
      lines.push(`**Data:** ${this.formatDate(metadata.date)}`);
    }
    if (metadata.tribunal) {
      lines.push(`**Tribunal:** ${metadata.tribunal}`);
    }
    if (metadata.author || metadata.date || metadata.tribunal) {
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // Conteúdo
    lines.push(formattedContent.content);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('*Documento gerado por ROM Agent - Assistente Jurídico*');

    return lines.join('\n');
  }

  /**
   * Gera TXT simples
   */
  generateTXT(formattedContent) {
    // Remove formatação Markdown/HTML, mantém apenas texto
    return this.stripFormatting(formattedContent.content);
  }

  // ========== HELPERS ==========

  /**
   * Converte Markdown para HTML
   */
  markdownToHTML(markdown) {
    try {
      return marked.parse(markdown);
    } catch (error) {
      console.warn('[ExportService] Erro ao converter Markdown:', error);
      return markdown.replace(/\n/g, '<br>');
    }
  }

  /**
   * Remove formatação Markdown/HTML
   */
  stripFormatting(content) {
    return content
      .replace(/[#*_~`]/g, '')           // Remove marcadores Markdown
      .replace(/<[^>]*>/g, '')           // Remove tags HTML
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Remove links Markdown
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')   // Remove imagens
      .trim();
  }

  /**
   * Formata margens para CSS
   */
  cssMargins(margins) {
    return `${margins.top}cm ${margins.right}cm ${margins.bottom}cm ${margins.left}cm`;
  }

  /**
   * Gera header HTML para PDF
   */
  buildHeader(metadata) {
    return `<div style="font-size: 9px; text-align: center; width: 100%; padding: 0 1cm; color: #666;">
      <span>${metadata.title || ''}</span>
    </div>`;
  }

  /**
   * Gera footer HTML para PDF
   */
  buildFooter(metadata) {
    return `<div style="font-size: 9px; text-align: center; width: 100%; padding: 0 1cm; color: #666;">
      <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
      <span style="float: right;">ROM Agent</span>
    </div>`;
  }

  /**
   * Formata data para exibição
   */
  formatDate(date) {
    if (!date) return new Date().toLocaleDateString('pt-BR');

    if (typeof date === 'string') {
      return new Date(date).toLocaleDateString('pt-BR');
    }

    if (date instanceof Date) {
      return date.toLocaleDateString('pt-BR');
    }

    return date;
  }

  // ========== FORMATADORES POR TIPO ==========

  /**
   * Formata citações jurídicas ABNT
   */
  formatJurisprudenceCitations(content) {
    // TODO: Implementar parsing e formatação de citações
    // Regex para detectar: (STF|STJ|TST|TRF\d|TJ[A-Z]{2}).*?(\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4})
    // Usar this.abntCitations.formatarAcordaoABNT()

    console.log('[ExportService] Formatação de citações não implementada ainda');
    return content;
  }

  /**
   * Formata análise de caso processual
   */
  formatCaseAnalysis(content) {
    // Adicionar estrutura de tópicos ABNT
    // Layer 1 → Seção I (MAIÚSCULAS)
    // Layer 2 → Seção 1 (Negrito)
    // Layer 3 → Seção a (Normal)

    return content
      .replace(/^### (.+)$/gm, '\n\n**I. $1**\n')      // Layer 1
      .replace(/^## (.+)$/gm, '\n\n**1. $1**\n')       // Layer 2
      .replace(/^# (.+)$/gm, '\n\na) $1\n');           // Layer 3
  }

  /**
   * Formata peça jurídica
   */
  formatLegalBrief(content) {
    // Detectar estrutura de petição
    // Adicionar formatação de partes (MAIÚSCULAS)
    // Formatar pedidos (enumerados)

    return content
      .replace(/EXCELENTÍSSIMO.*?JUIZ/gi, match => match.toUpperCase())
      .replace(/REQUERENTE:.*$/gm, match => `**${match.toUpperCase()}**`)
      .replace(/REQUERIDO:.*$/gm, match => `**${match.toUpperCase()}**`)
      .replace(/^PEDIDOS?:?$/gmi, '**PEDIDOS:**');
  }

  /**
   * Formata contrato
   */
  formatContract(content) {
    // Formatar cláusulas
    return content
      .replace(/CLÁUSULA\s+(\w+)/gi, (match, num) => `**${match.toUpperCase()}**`)
      .replace(/CONTRATANTE:.*$/gm, match => `**${match.toUpperCase()}**`)
      .replace(/CONTRATADO:.*$/gm, match => `**${match.toUpperCase()}**`);
  }
}

export default new ExportService();
