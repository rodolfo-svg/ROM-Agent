/**
 * ROM Agent - Scraper Inteligente de Jurisprudência
 *
 * DIFERENCIAL COMPETITIVO:
 * - Extrai EMENTAS COMPLETAS (não apenas snippets de 200 chars)
 * - Suporta HTML + PDF
 * - Parsers específicos por tribunal
 * - Cache agressivo (24h)
 * - Processamento paralelo
 * - Análise semântica com Bedrock
 *
 * O que o mercado NÃO tem: ementas completas + análise jurídica automática
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger.js';
import NodeCache from 'node-cache';
import pLimit from 'p-limit';

// Cache de ementas completas (24h TTL)
const ementaCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

class JurisprudenceScraperService {
  constructor() {
    this.timeout = 15000; // 15s por página
    this.userAgent = 'Mozilla/5.0 (compatible; ROMAgent/2.9.0; +https://iarom.com.br)';
    this.maxRetries = 2;
    this.concurrencyLimit = 3; // 3 URLs simultâneas
    this.limiter = pLimit(this.concurrencyLimit);

    // Estatísticas
    this.stats = {
      scraped: 0,
      cached: 0,
      failed: 0,
      pdfExtracted: 0
    };
  }

  /**
   * Scrape múltiplas decisões em paralelo
   * @param {Array} decisions - Array de { url, tribunal, titulo, snippet }
   * @returns {Promise<Array>} Decisões enriquecidas com ementas completas
   */
  async enrichDecisions(decisions) {
    if (!decisions || decisions.length === 0) {
      return [];
    }

    logger.info(`[Scraper] Enriquecendo ${decisions.length} decisões com ementas completas`);
    const startTime = Date.now();

    // Processar em paralelo com limite de concorrência
    const promises = decisions.map(decision =>
      this.limiter(() => this.scrapeEmenta(decision))
    );

    const enriched = await Promise.allSettled(promises);

    const results = enriched.map((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        return result.value;
      } else {
        // Manter decisão original se scraping falhar
        logger.warn(`[Scraper] Falha em ${decisions[index].url?.substring(0, 80)}: ${result.reason?.message}`);
        return {
          ...decisions[index],
          ementaCompleta: decisions[index].ementa || decisions[index].snippet,
          scraped: false,
          scrapeFailed: true
        };
      }
    });

    const duration = Date.now() - startTime;
    logger.info(`[Scraper] Concluído em ${duration}ms - Sucesso: ${this.stats.scraped}, Cache: ${this.stats.cached}, Falha: ${this.stats.failed}`);

    return results;
  }

  /**
   * Scrape ementa completa de uma decisão
   */
  async scrapeEmenta(decision) {
    const { url, tribunal, titulo, ementa: snippet } = decision;

    if (!url) {
      return { ...decision, ementaCompleta: snippet, scraped: false };
    }

    // Verificar cache primeiro
    const cacheKey = `ementa:${url}`;
    const cached = ementaCache.get(cacheKey);
    if (cached) {
      this.stats.cached++;
      return {
        ...decision,
        ...cached,
        fromCache: true
      };
    }

    try {
      // Detectar tipo de documento
      const urlLower = url.toLowerCase();
      const isPdf = urlLower.endsWith('.pdf') || urlLower.includes('.pdf?');

      let ementaCompleta;
      let metadata = {};

      if (isPdf) {
        // Extrair texto de PDF
        ementaCompleta = await this.extractPdfText(url);
        this.stats.pdfExtracted++;
      } else {
        // Scrape HTML
        const scraped = await this.scrapeHtml(url, tribunal);
        ementaCompleta = scraped.ementa;
        metadata = scraped.metadata;
      }

      if (!ementaCompleta || ementaCompleta.length < 100) {
        throw new Error('Ementa muito curta ou não encontrada');
      }

      this.stats.scraped++;

      const enrichedDecision = {
        ...decision,
        ementaCompleta,
        ementaLength: ementaCompleta.length,
        scraped: true,
        scrapedAt: new Date().toISOString(),
        ...metadata
      };

      // Salvar no cache
      ementaCache.set(cacheKey, enrichedDecision);

      return enrichedDecision;

    } catch (error) {
      this.stats.failed++;
      logger.warn(`[Scraper] Erro ao scrape ${url.substring(0, 80)}: ${error.message}`);

      // Fallback: usar snippet original
      return {
        ...decision,
        ementaCompleta: snippet || titulo,
        scraped: false,
        scrapeError: error.message
      };
    }
  }

  /**
   * Scrape HTML de página do tribunal
   */
  async scrapeHtml(url, tribunal) {
    const response = await axios.get(url, {
      timeout: this.timeout,
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Cache-Control': 'no-cache'
      },
      maxRedirects: 3,
      validateStatus: (status) => status < 500
    });

    // ✅ CORREÇÃO: Aceitar 403/401 se houver conteúdo HTML válido
    // Muitos tribunais retornam 403 (anti-scraping) mas ainda enviam HTML
    if (response.status >= 500) {
      throw new Error(`HTTP ${response.status} - Server Error`);
    }

    // Verificar se há conteúdo válido
    if (!response.data || response.data.length < 100) {
      throw new Error(`HTTP ${response.status} - Conteúdo vazio ou inválido`);
    }

    const $ = cheerio.load(response.data);

    // Tentar parsers específicos do tribunal
    let ementa = this.extractByTribunal($, tribunal, url);

    // Fallback: seletores genéricos
    if (!ementa || ementa.length < 100) {
      ementa = this.extractGeneric($);
    }

    if (!ementa || ementa.length < 100) {
      throw new Error('Ementa não encontrada na página');
    }

    // Extrair metadados adicionais
    const metadata = this.extractMetadata($, tribunal);

    return {
      ementa: this.cleanText(ementa),
      metadata
    };
  }

  /**
   * Parsers específicos por tribunal (seletores CSS otimizados)
   */
  extractByTribunal($, tribunal, url) {
    const urlLower = url.toLowerCase();
    const tribunalUpper = tribunal?.toUpperCase() || '';

    // ========================================
    // STJ - Superior Tribunal de Justiça
    // ========================================
    if (tribunalUpper === 'STJ' || urlLower.includes('stj.jus.br')) {
      return $('.ementa').text() ||
             $('#ementa').text() ||
             $('.secao-ementa').text() ||
             $('.decisao-ementa').text() ||
             $('[id*="ementa"]').first().text() ||
             $('[class*="ementa"]').first().text();
    }

    // ========================================
    // STF - Supremo Tribunal Federal
    // ========================================
    if (tribunalUpper === 'STF' || urlLower.includes('stf.jus.br') || urlLower.includes('portal.stf.jus.br')) {
      return $('.ementa').text() ||
             $('.decisao-ementa').text() ||
             $('#ementa-completa').text() ||
             $('.texto-ementa').text() ||
             $('[class*="ementa"]').first().text();
    }

    // ========================================
    // TJGO - Tribunal de Justiça de Goiás
    // ========================================
    if (tribunalUpper === 'TJGO' || urlLower.includes('tjgo.jus.br')) {
      return $('.ementa').text() ||
             $('.ementaClass').text() ||
             $('#ementa').text() ||
             $('.decision-text').text() ||
             $('.conteudo-ementa').text() ||
             $('[id*="ementa"]').first().text() ||
             $('.acordao-ementa').text();
    }

    // ========================================
    // TRF - Tribunais Regionais Federais
    // ========================================
    if (tribunalUpper.startsWith('TRF') || (urlLower.includes('trf') && urlLower.includes('.jus.br'))) {
      return $('.ementa').text() ||
             $('#ementa').text() ||
             $('.ementario').text() ||
             $('.texto-acordao').text() ||
             $('[class*="ementa"]').first().text();
    }

    // ========================================
    // TJ Estaduais (genérico)
    // ========================================
    if (tribunalUpper.startsWith('TJ') || (urlLower.includes('tj') && urlLower.includes('.jus.br'))) {
      return $('.ementa').text() ||
             $('.ementaClass').text() ||
             $('#ementa').text() ||
             $('.conteudo-ementa').text() ||
             $('[class*="ementa"]').first().text() ||
             $('.decisao').text() ||
             $('.acordao').text();
    }

    return null;
  }

  /**
   * Seletores genéricos (fallback)
   */
  extractGeneric($) {
    const selectors = [
      '.ementa',
      '#ementa',
      '[id*="ementa"]',
      '[class*="ementa"]',
      '.decisao',
      '.acordao',
      '.texto-acordao',
      '.conteudo-decisao',
      '.texto-decisao',
      'article.content',
      '.content-text',
      'main article',
      '.document-content'
    ];

    for (const selector of selectors) {
      const text = $(selector).first().text();
      if (text && text.length > 100) {
        return text;
      }
    }

    // Último recurso: todo o texto do body
    const bodyText = $('body').text();
    if (bodyText && bodyText.length > 500) {
      // Tentar extrair bloco de texto mais longo
      const paragraphs = $('p').map((i, el) => $(el).text()).get();
      const longestParagraph = paragraphs.reduce((longest, current) =>
        current.length > longest.length ? current : longest
      , '');

      if (longestParagraph.length > 200) {
        return longestParagraph;
      }
    }

    return null;
  }

  /**
   * Extrair metadados adicionais da página
   */
  extractMetadata($, tribunal) {
    const metadata = {};

    // Número do processo
    const numeroTexts = [
      $('[class*="processo"]').first().text(),
      $('[id*="processo"]').first().text(),
      $('.numero-processo').text(),
      $('#numero-processo').text()
    ];

    for (const text of numeroTexts) {
      const match = text.match(/\d{7}-?\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}/);
      if (match) {
        metadata.numeroProcesso = match[0];
        break;
      }
    }

    // Relator
    const relatorTexts = [
      $('.relator').text(),
      $('[class*="relator"]').text(),
      $('#relator').text()
    ];

    for (const text of relatorTexts) {
      if (text && text.length > 5 && text.length < 100) {
        metadata.relator = this.cleanText(text);
        break;
      }
    }

    // Data do julgamento
    const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}/;
    $('body').find('*').each((i, el) => {
      const text = $(el).text();
      if (text.includes('Julgamento') || text.includes('julgamento')) {
        const match = text.match(dateRegex);
        if (match) {
          metadata.dataJulgamento = match[0];
          return false; // break
        }
      }
    });

    return metadata;
  }

  /**
   * Extrair texto de PDF (usando pdfjs-dist)
   */
  async extractPdfText(url) {
    try {
      // ✅ OTIMIZAÇÃO: Verificar tamanho antes de baixar
      const headResponse = await axios.head(url, {
        timeout: 5000,
        headers: { 'User-Agent': this.userAgent }
      }).catch(() => null);

      if (headResponse) {
        const contentLength = parseInt(headResponse.headers['content-length'] || '0');
        const sizeMB = contentLength / (1024 * 1024);

        // Skip PDFs maiores que 5MB para economizar memória
        if (sizeMB > 5) {
          logger.warn(`[Scraper] PDF muito grande (${sizeMB.toFixed(1)}MB), pulando: ${url}`);
          throw new Error(`PDF muito grande (${sizeMB.toFixed(1)}MB) - limite 5MB`);
        }
      }

      // ✅ OTIMIZAÇÃO: Usar pdf-parse (mais leve que pdfjs-dist)
      const pdfParse = (await import('pdf-parse')).default;

      // Download PDF com limite menor
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: this.timeout,
        headers: { 'User-Agent': this.userAgent },
        maxContentLength: 5 * 1024 * 1024 // Máximo 5MB (otimizado)
      });

      const pdfBuffer = Buffer.from(response.data);

      // ✅ OTIMIZAÇÃO: Extrair apenas primeiras 10 páginas
      const options = {
        max: 10  // Limite de páginas para economizar memória
      };

      const data = await pdfParse(pdfBuffer, options);

      // Limpar e retornar texto
      const cleanedText = this.cleanText(data.text);

      // Limitar tamanho do texto final (máximo 50.000 chars)
      return cleanedText.length > 50000
        ? cleanedText.substring(0, 50000) + '...'
        : cleanedText;

    } catch (error) {
      logger.error(`[Scraper] Erro ao extrair PDF: ${error.message}`);
      throw new Error(`Falha na extração de PDF: ${error.message}`);
    }
  }

  /**
   * Limpar e normalizar texto extraído
   */
  cleanText(text) {
    if (!text) return '';

    return text
      .trim()
      .replace(/\s+/g, ' ')          // Múltiplos espaços → 1 espaço
      .replace(/\n+/g, '\n')         // Múltiplas quebras → 1 quebra
      .replace(/\t+/g, ' ')          // Tabs → espaços
      .replace(/\r/g, '')            // Remove \r
      .replace(/[^\S\n]+/g, ' ')     // Whitespace exceto \n
      .substring(0, 20000);          // Limitar a 20k caracteres
  }

  /**
   * Obter estatísticas do scraper
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: ementaCache.keys().length,
      cacheHitRate: this.stats.cached / (this.stats.scraped + this.stats.cached) * 100
    };
  }

  /**
   * Limpar cache (para testes)
   */
  clearCache() {
    ementaCache.flushAll();
    this.stats = { scraped: 0, cached: 0, failed: 0, pdfExtracted: 0 };
  }
}

export default new JurisprudenceScraperService();
