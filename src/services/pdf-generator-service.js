/**
 * ROM Agent - PDF Generator Service
 *
 * Serviço para geração de PDFs usando Puppeteer.
 * Renderiza HTML → PDF com alta qualidade e formatação ABNT.
 *
 * Features:
 * - Margens personalizáveis (ABNT: 3cm esquerda, 2.5cm demais)
 * - Headers e footers
 * - Numeração de páginas
 * - Alta qualidade de impressão
 * - Background e CSS completo
 */

import puppeteer from 'puppeteer';

class PDFGeneratorService {
  constructor() {
    this.browserInstance = null;
    this.browserTimeout = 30000; // 30 segundos
  }

  /**
   * Converte HTML para PDF usando Puppeteer
   *
   * @param {string} html - HTML completo a renderizar
   * @param {Object} options - Opções de geração
   * @param {string} options.format - Formato da página (default: 'A4')
   * @param {Object} options.margin - Margens { top, right, bottom, left } em cm
   * @param {boolean} options.displayHeaderFooter - Mostrar header/footer
   * @param {string} options.headerTemplate - Template HTML do header
   * @param {string} options.footerTemplate - Template HTML do footer
   * @returns {Promise<Buffer>} - Buffer do PDF gerado
   */
  async htmlToPDF(html, options = {}) {
    const startTime = Date.now();
    console.log('[PDFGenerator] Iniciando geração de PDF...');

    let browser = null;

    try {
      // 1. Lançar navegador
      browser = await this.launchBrowser();

      // 2. Criar página
      const page = await browser.newPage();

      // 3. Configurar viewport (importante para renderização)
      await page.setViewport({
        width: 794,   // A4 width em pixels (21cm @ 96dpi)
        height: 1123, // A4 height em pixels (29.7cm @ 96dpi)
        deviceScaleFactor: 2  // Alta resolução
      });

      // 4. Carregar HTML
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: this.browserTimeout
      });

      // 5. Gerar PDF
      const pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        printBackground: true,
        margin: {
          top: `${options.margin?.top || 2.5}cm`,
          right: `${options.margin?.right || 2.5}cm`,
          bottom: `${options.margin?.bottom || 2.5}cm`,
          left: `${options.margin?.left || 3.0}cm`
        },
        displayHeaderFooter: options.displayHeaderFooter || false,
        headerTemplate: options.headerTemplate || '<div></div>',
        footerTemplate: options.footerTemplate || '<div></div>',
        preferCSSPageSize: true,
        omitBackground: false
      });

      const duration = Date.now() - startTime;
      console.log(`[PDFGenerator] PDF gerado com sucesso em ${duration}ms (${Buffer.byteLength(pdfBuffer)} bytes)`);

      return pdfBuffer;

    } catch (error) {
      console.error('[PDFGenerator] Erro ao gerar PDF:', error);
      throw new Error(`Falha na geração do PDF: ${error.message}`);

    } finally {
      // 6. Fechar navegador
      if (browser) {
        await browser.close().catch(err => {
          console.error('[PDFGenerator] Erro ao fechar navegador:', err);
        });
      }
    }
  }

  /**
   * Gera PDF a partir de URL
   *
   * @param {string} url - URL da página a converter
   * @param {Object} options - Opções de geração
   * @returns {Promise<Buffer>} - Buffer do PDF gerado
   */
  async urlToPDF(url, options = {}) {
    const startTime = Date.now();
    console.log(`[PDFGenerator] Gerando PDF de URL: ${url}`);

    let browser = null;

    try {
      // 1. Lançar navegador
      browser = await this.launchBrowser();

      // 2. Criar página
      const page = await browser.newPage();

      // 3. Navegar para URL
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: this.browserTimeout
      });

      // 4. Gerar PDF
      const pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        printBackground: true,
        margin: options.margin || {
          top: '2.5cm',
          right: '2.5cm',
          bottom: '2.5cm',
          left: '3.0cm'
        },
        displayHeaderFooter: options.displayHeaderFooter || false,
        headerTemplate: options.headerTemplate || '<div></div>',
        footerTemplate: options.footerTemplate || '<div></div>',
        preferCSSPageSize: true
      });

      const duration = Date.now() - startTime;
      console.log(`[PDFGenerator] PDF de URL gerado em ${duration}ms`);

      return pdfBuffer;

    } catch (error) {
      console.error('[PDFGenerator] Erro ao gerar PDF de URL:', error);
      throw new Error(`Falha na geração do PDF de URL: ${error.message}`);

    } finally {
      if (browser) {
        await browser.close().catch(err => {
          console.error('[PDFGenerator] Erro ao fechar navegador:', err);
        });
      }
    }
  }

  /**
   * Lança instância do Puppeteer
   *
   * @returns {Promise<Browser>} - Instância do navegador
   * @private
   */
  async launchBrowser() {
    console.log('[PDFGenerator] Lançando navegador Puppeteer...');

    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',      // Reduz uso de memória compartilhada
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-web-security',       // Permite carregar recursos locais
          '--allow-file-access-from-files'
        ],
        timeout: this.browserTimeout
      });

      console.log('[PDFGenerator] Navegador lançado com sucesso');
      return browser;

    } catch (error) {
      console.error('[PDFGenerator] Erro ao lançar navegador:', error);
      throw new Error(`Falha ao iniciar Puppeteer: ${error.message}`);
    }
  }

  /**
   * Gera screenshot de HTML (útil para debug)
   *
   * @param {string} html - HTML a renderizar
   * @param {Object} options - Opções
   * @returns {Promise<Buffer>} - Buffer da imagem PNG
   */
  async htmlToScreenshot(html, options = {}) {
    let browser = null;

    try {
      browser = await this.launchBrowser();
      const page = await browser.newPage();

      await page.setViewport({
        width: options.width || 1200,
        height: options.height || 800,
        deviceScaleFactor: options.scale || 2
      });

      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: this.browserTimeout
      });

      const screenshot = await page.screenshot({
        fullPage: options.fullPage !== false,
        type: 'png'
      });

      console.log(`[PDFGenerator] Screenshot gerado: ${Buffer.byteLength(screenshot)} bytes`);

      return screenshot;

    } catch (error) {
      console.error('[PDFGenerator] Erro ao gerar screenshot:', error);
      throw new Error(`Falha ao gerar screenshot: ${error.message}`);

    } finally {
      if (browser) {
        await browser.close().catch(err => {
          console.error('[PDFGenerator] Erro ao fechar navegador:', err);
        });
      }
    }
  }

  /**
   * Valida se Puppeteer está disponível
   *
   * @returns {Promise<boolean>} - true se disponível
   */
  async isAvailable() {
    try {
      const browser = await this.launchBrowser();
      await browser.close();
      return true;
    } catch (error) {
      console.error('[PDFGenerator] Puppeteer não disponível:', error.message);
      return false;
    }
  }
}

export default new PDFGeneratorService();
