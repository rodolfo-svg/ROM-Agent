/**
 * Endpoint de teste para diagnóstico do Puppeteer
 */

import express from 'express';
import { logger } from '../utils/logger.js';
import { getPuppeteerScraper } from '../services/puppeteer-scraper-service.js';

const router = express.Router();

router.get('/test-puppeteer', async (req, res) => {
  try {
    logger.info('[TEST] Iniciando teste de Puppeteer...');
    
    const result = {
      timestamp: new Date().toISOString(),
      env: {
        USE_BROWSERLESS: process.env.USE_BROWSERLESS,
        USE_BROWSERLESS_type: typeof process.env.USE_BROWSERLESS,
        HAS_API_KEY: !!process.env.BROWSERLESS_API_KEY,
        API_KEY_length: process.env.BROWSERLESS_API_KEY?.length || 0
      },
      test: null,
      error: null
    };

    logger.info('[TEST] Variáveis ENV:', result.env);

    // Tentar obter instância do Puppeteer
    const puppeteerScraper = getPuppeteerScraper();
    logger.info('[TEST] Instância obtida');

    // Tentar inicializar
    await puppeteerScraper.initBrowserPool();
    logger.info('[TEST] initBrowserPool() chamado');

    // Verificar estado
    result.test = {
      browserInitialized: puppeteerScraper.browserInitialized,
      initFailed: puppeteerScraper.initFailed,
      poolSize: puppeteerScraper.browserPool?.length || 0
    };

    logger.info('[TEST] Estado do Puppeteer:', result.test);

    res.json(result);

  } catch (error) {
    logger.error('[TEST] Erro:', error.message);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

export default router;
