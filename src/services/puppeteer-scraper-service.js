/**
 * ROM Agent - Puppeteer Scraper com Pool de Agentes
 *
 * ARQUITETURA:
 * - Pool de navegadores reutilizáveis (evita overhead de lançamento)
 * - Orquestrador com controle de concorrência (3-5 páginas simultâneas)
 * - Retry automático em caso de falha
 * - Timeout por página (15s)
 * - Bypass de Cloudflare e outros anti-bots
 *
 * USO:
 * const scraper = new PuppeteerScraperService();
 * const results = await scraper.scrapeMultiple([url1, url2, url3]);
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { logger } from '../utils/logger.js';
import pLimit from 'p-limit';

class PuppeteerScraperService {
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || 3; // 3 páginas simultâneas
    this.timeout = options.timeout || 15000; // 15s por página
    this.maxRetries = options.maxRetries || 2;
    this.headless = options.headless !== false; // Default: true

    // Pool de navegadores
    this.browserPool = [];
    this.maxBrowsers = options.maxBrowsers || 2; // 2 navegadores no pool
    this.browserInitialized = false;

    // Limiter para controle de concorrência
    this.limiter = pLimit(this.maxConcurrency);

    // Estatísticas
    this.stats = {
      scraped: 0,
      failed: 0,
      bypassed: 0, // Cloudflare bypassados
      totalTime: 0
    };
  }

  /**
   * Inicializar pool de navegadores
   * GRACEFUL DEGRADATION: Se falhar, continua sem Puppeteer
   */
  async initBrowserPool() {
    if (this.browserInitialized) return;
    if (this.initFailed) {
      logger.warn(`[Puppeteer] Inicialização falhou anteriormente - pulando`);
      return;
    }

    try {
      logger.info(`[Puppeteer] Inicializando pool com ${this.maxBrowsers} navegadores...`);

      // Timeout de 30s para inicialização
      const initPromise = Promise.all(
        Array(this.maxBrowsers).fill(null).map(async () =>
          puppeteer.launch({
            headless: chromium.headless,
            executablePath: await chromium.executablePath(),
            args: [
              ...chromium.args,
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--window-size=1920x1080',
              '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ],
            timeout: 30000  // 30s timeout
          })
        )
      );

      // Race com timeout
      this.browserPool = await Promise.race([
        initPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Browser init timeout')), 30000)
        )
      ]);

      this.browserInitialized = true;
      logger.info(`[Puppeteer] ✅ Pool inicializado com sucesso`);

    } catch (error) {
      this.initFailed = true;
      logger.warn(`[Puppeteer] ⚠️ Falha ao inicializar: ${error.message}`);
      logger.warn(`[Puppeteer] Sistema continuará apenas com HTTP scraping (sem bypass Cloudflare)`);
    }

    logger.info(`[Puppeteer] Pool inicializado com sucesso`);
  }

  /**
   * Obter navegador disponível do pool (round-robin)
   */
  getBrowser() {
    const index = this.stats.scraped % this.browserPool.length;
    return this.browserPool[index];
  }

  /**
   * Scrape múltiplas URLs em paralelo (ORQUESTRADOR)
   * @param {Array<Object>} tasks - Array de { url, tribunal, titulo }
   * @returns {Promise<Array>} Resultados com HTML extraído
   */
  async scrapeMultiple(tasks) {
    if (!tasks || tasks.length === 0) {
      return [];
    }

    logger.info(`[Puppeteer Orchestrator] Processando ${tasks.length} URLs com ${this.maxConcurrency} agentes paralelos`);
    const startTime = Date.now();

    // Inicializar pool se necessário
    await this.initBrowserPool();

    // Se inicialização falhou, retornar falhas para todas as tasks
    if (this.initFailed || !this.browserInitialized) {
      logger.warn(`[Puppeteer] Pool não inicializado - retornando falhas`);
      return tasks.map(task => ({
        url: task.url,
        success: false,
        error: 'Puppeteer não disponível (falha na inicialização do Chromium)'
      }));
    }

    // Processar em paralelo com limite de concorrência
    const promises = tasks.map(task =>
      this.limiter(() => this.scrapeSingleWithRetry(task))
    );

    const results = await Promise.allSettled(promises);

    const duration = Date.now() - startTime;
    this.stats.totalTime += duration;

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value?.success).length;

    logger.info(`[Puppeteer Orchestrator] Concluído em ${duration}ms - Sucesso: ${successful}, Falha: ${failed}`);

    return results.map((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        return result.value;
      } else {
        return {
          ...tasks[index],
          success: false,
          html: null,
          error: result.reason?.message || 'Unknown error'
        };
      }
    });
  }

  /**
   * Scrape com retry automático
   */
  async scrapeSingleWithRetry(task) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.scrapeSingle(task);
      } catch (error) {
        lastError = error;
        logger.warn(`[Puppeteer] Tentativa ${attempt}/${this.maxRetries} falhou para ${task.url?.substring(0, 60)}: ${error.message}`);

        if (attempt < this.maxRetries) {
          // Aguardar antes de retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // Todas as tentativas falharam
    this.stats.failed++;
    throw lastError;
  }

  /**
   * Scrape de uma única URL
   */
  async scrapeSingle(task) {
    const { url, tribunal, titulo } = task;

    if (!url) {
      throw new Error('URL não fornecida');
    }

    const browser = this.getBrowser();
    const page = await browser.newPage();

    try {
      // Configurar timeout
      page.setDefaultTimeout(this.timeout);
      page.setDefaultNavigationTimeout(this.timeout);

      // Configurar viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Headers adicionais
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      });

      logger.info(`[Puppeteer] Navegando para ${url.substring(0, 80)}...`);

      // Navegar e aguardar carregamento
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded', // Mais rápido que 'networkidle0'
        timeout: this.timeout
      });

      const statusCode = response.status();
      logger.info(`[Puppeteer] HTTP ${statusCode} - ${url.substring(0, 60)}`);

      // Detectar Cloudflare challenge
      const hasCloudflare = await page.evaluate(() => {
        return document.title.includes('Just a moment') ||
               document.body.textContent.includes('Cloudflare') ||
               document.body.textContent.includes('challenge-platform');
      });

      if (hasCloudflare) {
        logger.info(`[Puppeteer] Cloudflare detectado, aguardando bypass...`);

        // Aguardar até 10s para Cloudflare resolver
        try {
          await page.waitForFunction(
            () => {
              return !document.title.includes('Just a moment') &&
                     !document.body.textContent.includes('challenge-platform');
            },
            { timeout: 10000 }
          );
          this.stats.bypassed++;
          logger.info(`[Puppeteer] Cloudflare bypassado com sucesso!`);
        } catch (e) {
          logger.warn(`[Puppeteer] Timeout aguardando bypass do Cloudflare`);
        }
      }

      // Aguardar um pouco mais se página ainda está carregando
      await new Promise(resolve => setTimeout(resolve, 500));

      // Extrair HTML completo
      const html = await page.content();

      this.stats.scraped++;

      await page.close();

      return {
        ...task,
        success: true,
        html,
        htmlLength: html.length,
        statusCode,
        cloudflareBypass: hasCloudflare,
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      await page.close().catch(() => {});

      this.stats.failed++;

      logger.error(`[Puppeteer] Erro ao scrape ${url.substring(0, 60)}: ${error.message}`);

      throw error;
    }
  }

  /**
   * Fechar pool de navegadores
   */
  async close() {
    logger.info('[Puppeteer] Fechando pool de navegadores...');

    const closePromises = this.browserPool.map(browser =>
      browser.close().catch(err =>
        logger.error(`[Puppeteer] Erro ao fechar navegador: ${err.message}`)
      )
    );

    await Promise.all(closePromises);

    this.browserPool = [];
    this.browserInitialized = false;

    logger.info('[Puppeteer] Pool fechado');
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    return {
      ...this.stats,
      avgTimePerPage: this.stats.scraped > 0 ? Math.round(this.stats.totalTime / this.stats.scraped) : 0,
      successRate: this.stats.scraped + this.stats.failed > 0
        ? Math.round((this.stats.scraped / (this.stats.scraped + this.stats.failed)) * 100)
        : 0
    };
  }
}

// Singleton para reutilizar pool
let instance = null;

export function getPuppeteerScraper() {
  if (!instance) {
    instance = new PuppeteerScraperService({
      maxConcurrency: 3,  // 3 páginas simultâneas
      maxBrowsers: 2,     // 2 navegadores no pool
      timeout: 15000,     // 15s por página
      headless: true
    });
  }
  return instance;
}

export default new PuppeteerScraperService();
