/**
 * JusBrasil Client - Busca HTTP (sem Puppeteer)
 *
 * Implementacao alternativa que usa axios/cheerio para scraping
 * sem depender de Puppeteer (que nao funciona no Render).
 *
 * Fallback: Se scraping falhar, retorna mensagem informativa.
 *
 * @version 2.0.0 - Sem Puppeteer para compatibilidade com Render
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// User agents rotativos
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];

export class JusBrasilClient {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.baseUrl = 'https://www.jusbrasil.com.br';
  }

  /**
   * Obter User-Agent aleatorio
   */
  getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  /**
   * Buscar jurisprudencia no JusBrasil (sem Puppeteer)
   * Usa scraping HTTP simples - pode falhar se site bloquear
   */
  async search(query, options = {}) {
    const { limit = 10, tribunal = null } = options;

    try {
      console.log(`[JusBrasil] Buscando: "${query}"${tribunal ? ` no ${tribunal}` : ''}`);

      // Construir URL de busca publica (nao requer login)
      const searchQuery = tribunal ? `${query} ${tribunal}` : query;
      const encodedQuery = encodeURIComponent(searchQuery);
      const searchUrl = `${this.baseUrl}/jurisprudencia/busca?q=${encodedQuery}`;

      // Fazer requisicao HTTP com timeout mais agressivo
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: Math.min(this.timeout, 8000), // ✅ Máximo 8 segundos
        maxRedirects: 3, // ✅ Reduzido de 5 para 3
        validateStatus: (status) => status < 500 // ✅ Aceita 4xx mas não 5xx
      });

      // Parse HTML
      const results = this.parseSearchResults(response.data, limit);

      if (results.length > 0) {
        console.log(`[JusBrasil] ${results.length} resultados encontrados`);
      } else {
        console.log('[JusBrasil] Nenhum resultado encontrado (pode ser bloqueio anti-bot)');
      }

      return {
        success: true,
        source: 'jusbrasil',
        query: searchQuery,
        results,
        total: results.length,
        note: results.length === 0 ? 'JusBrasil pode estar bloqueando scraping. Considere usar Google Search como alternativa.' : null
      };

    } catch (error) {
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
      const isBlocked = error.response?.status === 403 || error.response?.status === 429;

      console.warn(`[JusBrasil] ${isTimeout ? 'TIMEOUT' : isBlocked ? 'BLOQUEADO' : 'ERRO'}: ${error.message}`);

      // Retornar erro amigavel com sugestao de alternativa
      return {
        success: false,
        source: 'jusbrasil',
        error: isTimeout
          ? 'JusBrasil não respondeu a tempo (timeout)'
          : isBlocked
            ? 'JusBrasil bloqueou o acesso (anti-bot)'
            : `Busca no JusBrasil indisponível: ${error.message}`,
        results: [],
        suggestion: 'Usando Google Search como fonte principal. JusBrasil está com problemas.',
        isBlockedOrUnavailable: true,
        isTimeout,
        isBlocked
      };
    }
  }

  /**
   * Parse HTML de resultados usando Cheerio
   */
  parseSearchResults(html, limit) {
    const $ = cheerio.load(html);
    const results = [];

    // Seletores possíveis (JusBrasil pode mudar estrutura)
    const selectors = [
      '.SearchResult',
      '.jurisprudence-item',
      'article[data-doc-type="jurisprudence"]',
      '.search-result-item',
      'div[itemtype="http://schema.org/Article"]'
    ];

    let elements = $();
    for (const selector of selectors) {
      elements = $(selector);
      if (elements.length > 0) {
        console.log(`✅ Usando seletor: ${selector} (${elements.length} resultados)`);
        break;
      }
    }

    if (elements.length === 0) {
      console.warn('⚠️ Nenhum resultado encontrado com seletores conhecidos');
      return [];
    }

    elements.slice(0, limit).each((index, element) => {
      try {
        const $el = $(element);

        // Extrair informações
        const titulo = $el.find('h3, h2, .result-title, [data-testid="title"]').first().text().trim();
        const ementa = $el.find('.ementa, .result-description, p').first().text().trim();
        const link = $el.find('a').first().attr('href');
        const tribunal = this.extractTribunal($el.text());
        const numero = this.extractNumeroProcesso($el.text());
        const data = this.extractDate($el.text());
        const relator = this.extractRelator($el.text());

        if (titulo || ementa) {
          results.push({
            tribunal: tribunal || 'JusBrasil',
            tipo: 'Jurisprudência',
            numero: numero || `Resultado ${index + 1}`,
            titulo: titulo,
            ementa: ementa || titulo,
            data: data || new Date().toISOString(),
            relator: relator,
            url: link ? (link.startsWith('http') ? link : `https://www.jusbrasil.com.br${link}`) : null,
            relevancia: 'high',
            source: 'jusbrasil-real'
          });
        }

      } catch (error) {
        console.warn(`⚠️ Erro ao parsear resultado ${index}:`, error.message);
      }
    });

    return results;
  }

  /**
   * Extrair tribunal do texto
   */
  extractTribunal(text) {
    const tribunais = [
      'STF', 'STJ', 'TST', 'TSE', 'STM',
      'TRF-1', 'TRF-2', 'TRF-3', 'TRF-4', 'TRF-5', 'TRF-6',
      'TJSP', 'TJRJ', 'TJMG', 'TJRS', 'TJGO', 'TJDF',
      'TRT-1', 'TRT-2', 'TRT-3', 'TRT-4', 'TRT-5',
      'TJDFT', 'TJMT', 'TJMS', 'TJPR', 'TJSC'
    ];

    for (const tribunal of tribunais) {
      if (text.includes(tribunal)) {
        return tribunal;
      }
    }

    return null;
  }

  /**
   * Extrair número de processo
   */
  extractNumeroProcesso(text) {
    // Formato: 0000000-00.0000.0.00.0000
    const match = text.match(/\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/);
    return match ? match[0] : null;
  }

  /**
   * Extrair data
   */
  extractDate(text) {
    // Formato: DD/MM/YYYY
    const match = text.match(/\d{2}\/\d{2}\/\d{4}/);
    if (match) {
      const [dia, mes, ano] = match[0].split('/');
      return new Date(`${ano}-${mes}-${dia}`).toISOString();
    }
    return null;
  }

  /**
   * Extrair relator
   */
  extractRelator(text) {
    const patterns = [
      /Relator[a]?:?\s*([^,\n]+)/i,
      /Rel\.?\s*([^,\n]+)/i,
      /Min\.?\s*([^,\n]+)/i,
      /Des\.?\s*([^,\n]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Fechar cliente (noop - sem browser para fechar)
   */
  async close() {
    // Nada a fazer - sem Puppeteer
  }

  /**
   * Destructor (cleanup)
   */
  async destroy() {
    // Nada a fazer - sem Puppeteer
  }
}

export default JusBrasilClient;
