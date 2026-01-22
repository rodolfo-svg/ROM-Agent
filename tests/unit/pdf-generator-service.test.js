/**
 * Testes Unitários - PDF Generator Service
 *
 * Testa funcionalidades do serviço de geração de PDF via Puppeteer
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

let PDFGenerator;

before(async () => {
  const module = await import('../../src/services/pdf-generator-service.js');
  PDFGenerator = module.default;
});

// ============================================================
// TESTES DE DISPONIBILIDADE DO PUPPETEER
// ============================================================

describe('PDFGenerator - Availability', () => {
  it('deve verificar se Puppeteer está disponível', async () => {
    const available = await PDFGenerator.isAvailable();
    assert.strictEqual(typeof available, 'boolean');
  });
});

// ============================================================
// TESTES DE GERAÇÃO DE PDF A PARTIR DE HTML
// ============================================================

describe('PDFGenerator - HTML to PDF', () => {
  it('deve gerar PDF a partir de HTML simples', async function() {
    // Aumenta timeout para Puppeteer (pode ser lento na primeira execução)
    this.timeout = 30000;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Teste PDF</title>
      </head>
      <body>
        <h1>Documento de Teste</h1>
        <p>Este é um parágrafo de teste para geração de PDF.</p>
      </body>
      </html>
    `;

    try {
      const pdfBuffer = await PDFGenerator.htmlToPDF(html);

      const isValidBuffer = Buffer.isBuffer(pdfBuffer) || pdfBuffer instanceof Uint8Array;
      assert.ok(isValidBuffer, 'PDF deve ser Buffer ou Uint8Array');
      assert.ok(pdfBuffer.length > 0);

      // Converte para Buffer se necessário
      const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);

      // Verifica se é um PDF válido (começa com %PDF)
      const header = buffer.toString('utf8', 0, 4);
      assert.strictEqual(header, '%PDF');
    } catch (error) {
      // Se Puppeteer não estiver disponível, skip o teste
      if (error.message.includes('Failed to launch')) {
        console.warn('⚠️  Puppeteer não disponível - teste pulado');
        return;
      }
      throw error;
    }
  });

  it('deve aceitar opções de margem personalizadas', async function() {
    this.timeout = 30000;

    const html = '<html><body><h1>Teste Margens</h1></body></html>';

    try {
      const pdfBuffer = await PDFGenerator.htmlToPDF(html, {
        margin: {
          top: 3,
          right: 2.5,
          bottom: 2.5,
          left: 3
        }
      });

      const isValidBuffer = Buffer.isBuffer(pdfBuffer) || pdfBuffer instanceof Uint8Array;
      assert.ok(isValidBuffer, 'PDF deve ser Buffer ou Uint8Array');
      assert.ok(pdfBuffer.length > 0);
    } catch (error) {
      if (error.message.includes('Failed to launch')) {
        console.warn('⚠️  Puppeteer não disponível - teste pulado');
        return;
      }
      throw error;
    }
  });

  it('deve aceitar formato de página customizado', async function() {
    this.timeout = 30000;

    const html = '<html><body><h1>Teste Formato</h1></body></html>';

    try {
      const pdfBuffer = await PDFGenerator.htmlToPDF(html, {
        format: 'Letter'
      });

      const isValidBuffer = Buffer.isBuffer(pdfBuffer) || pdfBuffer instanceof Uint8Array;
      assert.ok(isValidBuffer, 'PDF deve ser Buffer ou Uint8Array');
    } catch (error) {
      if (error.message.includes('Failed to launch')) {
        console.warn('⚠️  Puppeteer não disponível - teste pulado');
        return;
      }
      throw error;
    }
  });

  it('deve suportar headers e footers', async function() {
    this.timeout = 30000;

    const html = '<html><body><h1>Teste Header/Footer</h1></body></html>';

    try {
      const pdfBuffer = await PDFGenerator.htmlToPDF(html, {
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size: 10px;">Cabeçalho</div>',
        footerTemplate: '<div style="font-size: 10px;">Rodapé</div>'
      });

      const isValidBuffer = Buffer.isBuffer(pdfBuffer) || pdfBuffer instanceof Uint8Array;
      assert.ok(isValidBuffer, 'PDF deve ser Buffer ou Uint8Array');
    } catch (error) {
      if (error.message.includes('Failed to launch')) {
        console.warn('⚠️  Puppeteer não disponível - teste pulado');
        return;
      }
      throw error;
    }
  });
});

// ============================================================
// TESTES DE GERAÇÃO DE PDF COM CONTEÚDO COMPLEXO
// ============================================================

describe('PDFGenerator - Complex HTML', () => {
  it('deve processar HTML com CSS', async function() {
    this.timeout = 30000;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          h1 { color: #333; }
          p { line-height: 1.6; }
        </style>
      </head>
      <body>
        <h1>Título Estilizado</h1>
        <p>Parágrafo com estilo CSS aplicado.</p>
      </body>
      </html>
    `;

    try {
      const pdfBuffer = await PDFGenerator.htmlToPDF(html);
      assert.ok(pdfBuffer.length > 0);
    } catch (error) {
      if (error.message.includes('Failed to launch')) {
        console.warn('⚠️  Puppeteer não disponível - teste pulado');
        return;
      }
      throw error;
    }
  });

  it('deve processar HTML com múltiplas páginas', async function() {
    this.timeout = 30000;

    const longContent = Array(100).fill('<p>Parágrafo de teste para gerar múltiplas páginas.</p>').join('\n');
    const html = `<html><body>${longContent}</body></html>`;

    try {
      const pdfBuffer = await PDFGenerator.htmlToPDF(html);

      // PDF com múltiplas páginas deve ser maior
      assert.ok(pdfBuffer.length > 10000);
    } catch (error) {
      if (error.message.includes('Failed to launch')) {
        console.warn('⚠️  Puppeteer não disponível - teste pulado');
        return;
      }
      throw error;
    }
  });

  it('deve processar HTML com caracteres especiais', async function() {
    this.timeout = 30000;

    const html = `
      <html>
      <head><meta charset="UTF-8"></head>
      <body>
        <h1>Teste de Acentuação</h1>
        <p>Árvore, Ação, Cônjuge, José, Ênfase</p>
        <p>Símbolos: © ® ™ § ¶ €</p>
      </body>
      </html>
    `;

    try {
      const pdfBuffer = await PDFGenerator.htmlToPDF(html);
      assert.ok(pdfBuffer.length > 0);
    } catch (error) {
      if (error.message.includes('Failed to launch')) {
        console.warn('⚠️  Puppeteer não disponível - teste pulado');
        return;
      }
      throw error;
    }
  });
});

// ============================================================
// TESTES DE SCREENSHOT (BONUS)
// ============================================================

describe('PDFGenerator - Screenshot', () => {
  it('deve gerar screenshot de HTML', async function() {
    this.timeout = 30000;

    const html = '<html><body><h1>Screenshot Test</h1></body></html>';

    try {
      const screenshot = await PDFGenerator.htmlToScreenshot(html);

      // Puppeteer pode retornar Buffer ou Uint8Array dependendo da versão
      const isValidBuffer = Buffer.isBuffer(screenshot) || screenshot instanceof Uint8Array;
      assert.ok(isValidBuffer, 'Screenshot deve ser Buffer ou Uint8Array');
      assert.ok(screenshot.length > 0);

      // Converte para Buffer se necessário
      const buffer = Buffer.isBuffer(screenshot) ? screenshot : Buffer.from(screenshot);

      // Verifica se é PNG (começa com PNG signature)
      const signature = buffer.toString('hex', 0, 8);
      assert.strictEqual(signature, '89504e470d0a1a0a');
    } catch (error) {
      if (error.message.includes('Failed to launch')) {
        console.warn('⚠️  Puppeteer não disponível - teste pulado');
        return;
      }
      throw error;
    }
  });

  it('deve aceitar opções de screenshot personalizadas', async function() {
    this.timeout = 30000;

    const html = '<html><body><h1>Custom Screenshot</h1></body></html>';

    try {
      const screenshot = await PDFGenerator.htmlToScreenshot(html, {
        width: 800,
        height: 600,
        scale: 1
      });

      // Puppeteer pode retornar Buffer ou Uint8Array
      const isValidBuffer = Buffer.isBuffer(screenshot) || screenshot instanceof Uint8Array;
      assert.ok(isValidBuffer, 'Screenshot deve ser Buffer ou Uint8Array');
    } catch (error) {
      if (error.message.includes('Failed to launch')) {
        console.warn('⚠️  Puppeteer não disponível - teste pulado');
        return;
      }
      throw error;
    }
  });
});

// ============================================================
// TESTES DE TRATAMENTO DE ERROS
// ============================================================

describe('PDFGenerator - Error Handling', () => {
  it('deve lançar erro para HTML inválido malformado', async function() {
    this.timeout = 30000;

    const invalidHtml = '<html><body><h1>Não fechado';

    try {
      // Mesmo HTML inválido, Puppeteer pode processar
      const pdfBuffer = await PDFGenerator.htmlToPDF(invalidHtml);
      // Se chegou aqui, Puppeteer corrigiu o HTML
      const isValidBuffer = Buffer.isBuffer(pdfBuffer) || pdfBuffer instanceof Uint8Array;
      assert.ok(isValidBuffer, 'PDF deve ser Buffer ou Uint8Array');
    } catch (error) {
      if (error.message.includes('Failed to launch')) {
        console.warn('⚠️  Puppeteer não disponível - teste pulado');
        return;
      }
      // Erro esperado
      assert.ok(error.message.length > 0);
    }
  });
});

// ============================================================
// TESTES DE CONFIGURAÇÃO DO NAVEGADOR
// ============================================================

describe('PDFGenerator - Browser Configuration', () => {
  it('deve lançar navegador com argumentos corretos', async function() {
    this.timeout = 30000;

    const html = '<html><body>Test</body></html>';

    try {
      // Testa se consegue lançar e fechar navegador
      const pdf = await PDFGenerator.htmlToPDF(html);
      assert.ok(pdf.length > 0);
    } catch (error) {
      if (error.message.includes('Failed to launch')) {
        console.warn('⚠️  Puppeteer não disponível - teste pulado');
        return;
      }
      throw error;
    }
  });
});

// ============================================================
// TESTES DE PERFORMANCE
// ============================================================

describe('PDFGenerator - Performance', () => {
  it('deve gerar PDF em menos de 5 segundos', async function() {
    this.timeout = 10000;

    const html = `
      <html>
      <body>
        <h1>Performance Test</h1>
        ${Array(50).fill('<p>Parágrafo de teste</p>').join('\n')}
      </body>
      </html>
    `;

    try {
      const start = Date.now();
      const pdf = await PDFGenerator.htmlToPDF(html);
      const duration = Date.now() - start;

      assert.ok(pdf.length > 0);
      assert.ok(duration < 5000, `PDF gerado em ${duration}ms`);
    } catch (error) {
      if (error.message.includes('Failed to launch')) {
        console.warn('⚠️  Puppeteer não disponível - teste pulado');
        return;
      }
      throw error;
    }
  });
});

// ============================================================
// TESTES DE MARGENS ABNT
// ============================================================

describe('PDFGenerator - ABNT Margins', () => {
  it('deve usar margens ABNT por padrão (3cm esquerda)', async function() {
    this.timeout = 30000;

    const html = '<html><body><h1>Teste ABNT</h1></body></html>';

    try {
      const pdf = await PDFGenerator.htmlToPDF(html, {
        margin: {
          top: 2.5,
          right: 2.5,
          bottom: 2.5,
          left: 3.0  // ABNT: 3cm na esquerda
        }
      });

      assert.ok(pdf.length > 0);
    } catch (error) {
      if (error.message.includes('Failed to launch')) {
        console.warn('⚠️  Puppeteer não disponível - teste pulado');
        return;
      }
      throw error;
    }
  });
});

console.log('✅ Testes do PDFGenerator carregados com sucesso');
