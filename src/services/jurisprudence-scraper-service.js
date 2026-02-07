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
import { getPuppeteerScraper } from './puppeteer-scraper-service.js';

// Cache de ementas completas (24h TTL)
const ementaCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

/**
 * Detectar Cloudflare automaticamente na resposta HTTP
 * VANTAGENS:
 * - Funciona com TODOS os tribunais (27 TJs + STJ/STF/TRFs)
 * - Não precisa manter lista hardcoded
 * - Se tribunal adicionar Cloudflare, sistema detecta automaticamente
 */
function detectCloudflare(html, statusCode, headers = {}) {
  // Sinal 1: Headers específicos do Cloudflare
  const hasCloudflareHeaders =
    headers['cf-ray'] ||
    headers['cf-cache-status'] ||
    headers['cf-request-id'] ||
    headers['server']?.toLowerCase().includes('cloudflare');

  // Sinal 2: Status 403/503 típico de challenge
  const isChallengeStatus = statusCode === 403 || statusCode === 503;

  // Sinal 3: HTML contém sinais de Cloudflare challenge
  if (html && typeof html === 'string') {
    const htmlLower = html.toLowerCase();
    const cloudflareSignals = [
      'just a moment',           // Título da página de challenge
      'checking your browser',   // Texto da página de challenge
      'challenge-platform',      // ID da div de challenge
      'cloudflare',              // Menção explícita
      'cdn-cgi/challenge',       // URL de challenge
      'cf-browser-verification', // Classe CSS do challenge
      '__cf_chl_jschl_tk__',    // Token JavaScript do challenge
      'ray id:'                  // ID de rastreamento Cloudflare
    ];

    const hasCloudflareHtml = cloudflareSignals.some(signal => htmlLower.includes(signal));

    if (hasCloudflareHtml) {
      return true;
    }
  }

  // Cloudflare detectado se houver headers OU status de challenge
  return hasCloudflareHeaders && isChallengeStatus;
}

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
   * ESTRATÉGIA HÍBRIDA COM DETECÇÃO AUTOMÁTICA:
   * 1. Fase 1: HTTP simples (rápido) - detecta Cloudflare automaticamente
   * 2. Fase 2: Puppeteer apenas para falhas (Cloudflare, timeout, etc)
   *
   * VANTAGENS:
   * - Funciona com TODOS os 27 TJs automaticamente
   * - Não precisa manter lista hardcoded de tribunais
   * - Adapta-se automaticamente se tribunal adicionar/remover Cloudflare
   *
   * @param {Array} decisions - Array de { url, tribunal, titulo, snippet }
   * @returns {Promise<Array>} Decisões enriquecidas com ementas completas
   */
  async enrichDecisions(decisions) {
    if (!decisions || decisions.length === 0) {
      return [];
    }

    logger.info(`[Scraper] Enriquecendo ${decisions.length} decisões com ementas completas`);
    const startTime = Date.now();

    // FASE 1: Tentar HTTP simples para todas (rápido)
    logger.info(`[Scraper] Fase 1/2: HTTP simples (rápido)`);
    const promises = decisions.map(decision =>
      this.limiter(() => this.scrapeEmenta(decision))
    );

    const enriched = await Promise.allSettled(promises);

    const results = enriched.map((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        return result.value;
      } else {
        return {
          ...decisions[index],
          ementaCompleta: decisions[index].ementa || decisions[index].snippet,
          scraped: false,
          scrapeFailed: true,
          httpError: result.reason?.message
        };
      }
    });

    // FASE 2: Identificar decisões que precisam de Puppeteer
    // ✅ DETECÇÃO AUTOMÁTICA: Usa Puppeteer apenas se HTTP falhou
    // (Cloudflare já causa falha automática no scrapeHtml)
    const needsPuppeteer = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => {
        // Usar Puppeteer se scraping HTTP falhou por qualquer motivo:
        // - Cloudflare detectado (já gera erro)
        // - Timeout
        // - 403/500/etc
        // - Ementa não encontrada
        const failed = !result.scraped || result.scrapeFailed;
        return failed;
      });

    if (needsPuppeteer.length > 0) {
      logger.info(`[Scraper] Fase 2/2: Puppeteer para ${needsPuppeteer.length} decisões (HTTP falhou - Cloudflare/timeout/etc)`);

      try {
        const puppeteerScraper = getPuppeteerScraper();

        // Preparar tasks para Puppeteer
        const tasks = needsPuppeteer.map(({ result, index }) => ({
          url: decisions[index].url,
          tribunal: decisions[index].tribunal,
          titulo: decisions[index].titulo,
          originalIndex: index
        }));

        // Scrape em paralelo com Puppeteer
        const puppeteerResults = await puppeteerScraper.scrapeMultiple(tasks);

        // Processar resultados do Puppeteer
        for (let i = 0; i < puppeteerResults.length; i++) {
          const puppeteerResult = puppeteerResults[i];
          const originalIndex = tasks[i].originalIndex;

          if (puppeteerResult.success && puppeteerResult.html) {
            try {
              // Extrair ementa do HTML
              const $ = cheerio.load(puppeteerResult.html);
              const tribunal = decisions[originalIndex].tribunal;
              let ementa = this.extractByTribunal($, tribunal, puppeteerResult.url);

              if (!ementa || ementa.length < 100) {
                ementa = this.extractGeneric($);
              }

              if (ementa && ementa.length >= 100) {
                const enrichedDecision = {
                  ...decisions[originalIndex],
                  ementaCompleta: this.cleanText(ementa),
                  ementaLength: ementa.length,
                  scraped: true,
                  scrapedAt: new Date().toISOString(),
                  method: 'puppeteer',
                  cloudflareBypass: puppeteerResult.cloudflareBypass || false
                };

                // Salvar no cache
                const cacheKey = `ementa:${decisions[originalIndex].url}`;
                ementaCache.set(cacheKey, enrichedDecision);

                results[originalIndex] = enrichedDecision;
                this.stats.scraped++;

                logger.info(`[Puppeteer] ✅ Sucesso: ${decisions[originalIndex].url?.substring(0, 60)} (${ementa.length} chars)`);
              } else {
                logger.warn(`[Puppeteer] Ementa não encontrada no HTML de ${decisions[originalIndex].url?.substring(0, 60)}`);
              }
            } catch (parseError) {
              logger.error(`[Puppeteer] Erro ao processar HTML: ${parseError.message}`);
            }
          } else {
            logger.warn(`[Puppeteer] Falha: ${decisions[originalIndex].url?.substring(0, 60)} - ${puppeteerResult.error}`);
          }
        }

        // Log de estatísticas do Puppeteer
        const puppeteerStats = puppeteerScraper.getStats();
        logger.info(`[Puppeteer] Stats: ${puppeteerStats.scraped} scraped, ${puppeteerStats.bypassed} Cloudflare bypass, ${puppeteerStats.successRate}% success rate`);

      } catch (puppeteerError) {
        logger.error(`[Puppeteer] Erro crítico: ${puppeteerError.message}`);
      }
    }

    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.scraped).length;
    const failCount = results.filter(r => !r.scraped).length;

    logger.info(`[Scraper] Concluído em ${duration}ms - Sucesso: ${successCount}, Falha: ${failCount}`);

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
      // ✅ Filtro de páginas de listagem/notícias reativado
      if (this.isListingPage(url)) {
        logger.warn(`[Scraper] URL rejeitada (página de listagem/notícia): ${url.substring(0, 80)}`);
        throw new Error('URL de listagem/busca/notícia - não contém decisão individual');
      }

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

      // ✅ Threshold aumentado: 500 chars para forçar Puppeteer em snippets curtos
      if (!ementaCompleta || ementaCompleta.length < 500) {
        throw new Error(`Ementa muito curta (${ementaCompleta?.length || 0} chars) - tentando Puppeteer`);
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

    // ✅ NOVO: Detectar Cloudflare automaticamente
    const cloudflareDetected = detectCloudflare(response.data, response.status, response.headers);

    if (cloudflareDetected) {
      logger.warn(`[Scraper] ⚠️ Cloudflare detectado em ${url.substring(0, 60)} - será retentado com Puppeteer`);
      throw new Error('Cloudflare challenge detectado - usar Puppeteer');
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
      metadata,
      cloudflareDetected: false  // Se chegou aqui, não tem Cloudflare
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
      // ✅ Seletores melhorados baseados na estrutura real do STJ
      return $('.ementa').text() ||
             $('#ementa').text() ||
             $('.secao-ementa').text() ||
             $('.decisao-ementa').text() ||
             $('.documento-ementa').text() ||
             $('.conteudo-ementa').text() ||
             // Inteiro teor (quando disponível)
             $('.inteiro-teor').text() ||
             $('.texto-integral').text() ||
             $('[id*="inteiro"]').first().text() ||
             // Fallback genérico
             $('[id*="ementa"]').first().text() ||
             $('[class*="ementa"]').first().text() ||
             // Textos de decisão
             $('.texto-decisao').text() ||
             $('.acordao-texto').text();
    }

    // ========================================
    // STF - Supremo Tribunal Federal
    // ========================================
    if (tribunalUpper === 'STF' || urlLower.includes('stf.jus.br') || urlLower.includes('portal.stf.jus.br')) {
      // ✅ Seletores melhorados para o novo portal do STF
      return $('.ementa').text() ||
             $('.decisao-ementa').text() ||
             $('#ementa-completa').text() ||
             $('.texto-ementa').text() ||
             $('.ementa-acordao').text() ||
             // Inteiro teor
             $('.inteiro-teor').text() ||
             $('.texto-integral').text() ||
             $('.documento-completo').text() ||
             // Portal antigo
             $('.decision-content').text() ||
             $('.processo-conteudo').text() ||
             // Fallback
             $('[class*="ementa"]').first().text() ||
             $('[id*="ementa"]').first().text() ||
             $('.acordao').text();
    }

    // ========================================
    // TJSP - Tribunal de Justiça de São Paulo
    // ========================================
    if (tribunalUpper === 'TJSP' || urlLower.includes('tjsp.jus.br')) {
      // ✅ Seletores específicos para TJSP (sistema ESAJ)
      return $('.ementaClass').text() ||
             $('.ementa').text() ||
             $('#ementa').text() ||
             $('.acordaoEmenta').text() ||
             $('.linhaTabela').text() ||
             // Sistema ESAJ
             $('[name="ementa"]').text() ||
             $('[id*="Ementa"]').first().text() ||
             // Inteiro teor
             $('.texto-acordao').text() ||
             $('.integra-texto').text() ||
             // Fallback
             $('[class*="ementa"]').first().text() ||
             $('.decisao-texto').text();
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
    // ✅ Seletores expandidos com prioridade correta
    const selectors = [
      // Prioridade 1: Ementa específica
      '.ementa',
      '#ementa',
      '.ementaClass',
      // Prioridade 2: Inteiro teor
      '.inteiro-teor',
      '.texto-integral',
      '.integra',
      // Prioridade 3: Decisão/Acórdão
      '.acordao',
      '.texto-acordao',
      '.acordao-texto',
      '.decisao',
      '.texto-decisao',
      '.conteudo-decisao',
      // Prioridade 4: IDs e classes parciais
      '[id*="ementa"]',
      '[class*="ementa"]',
      '[id*="acordao"]',
      '[class*="acordao"]',
      '[id*="decisao"]',
      // Prioridade 5: Estruturas genéricas
      'article.content',
      '.content-text',
      '.document-content',
      'main article',
      '.main-content'
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
   * Verificar se URL é de página de listagem/busca (não decisão individual)
   * URLs de listagem não têm ementa completa
   * ✅ APENAS padrões REALMENTE problemáticos (não bloquear decisões válidas)
   */
  isListingPage(url) {
    if (!url) return false;

    const urlLower = url.toLowerCase();

    // ✅ REFINADO: Apenas padrões que SÃO definitivamente listagens
    const listingPatterns = [
      '/toc.jsp',         // STJ: table of contents
      '/index.jsp',       // Páginas index
      '/sumario',         // Sumários
      '/indice',          // Índices
      'q=',               // Query string de busca (ex: ?q=termo)
      'buscar=',          // Form de busca
      'pesquisar=',       // Form de busca
      '/resultados',      // Página de resultados
      '/lista.php',       // Listas PHP
      '/search.php',      // Páginas de busca PHP
      '/Noticias/',       // Páginas de notícias (STJ, TJs)
      '/Comunicacao/'     // Páginas de comunicação/notícias
    ];

    return listingPatterns.some(pattern => urlLower.includes(pattern));
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
