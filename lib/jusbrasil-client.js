/**
 * JusBrasil Client - Scraping Autenticado
 *
 * Implementação real de busca no JusBrasil usando credenciais de login.
 * Utiliza Puppeteer para autenticação e scraping de resultados.
 */

import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

export class JusBrasilClient {
  constructor(options = {}) {
    this.email = options.email || process.env.JUSBRASIL_EMAIL;
    this.senha = options.senha || process.env.JUSBRASIL_SENHA;
    this.headless = options.headless !== false; // default: true
    this.timeout = options.timeout || 30000;
    this.browser = null;
    this.page = null;
    this.isAuthenticated = false;
  }

  /**
   * Inicializar browser e fazer login
   */
  async initialize() {
    if (this.browser) {
      return; // Já inicializado
    }

    console.log('🌐 Inicializando JusBrasil Client...');

    this.browser = await puppeteer.launch({
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    );

    console.log('✅ Browser inicializado');
  }

  /**
   * Fazer login no JusBrasil
   */
  async login() {
    if (this.isAuthenticated) {
      console.log('ℹ️ Já autenticado no JusBrasil');
      return true;
    }

    if (!this.email || !this.senha) {
      throw new Error('Credenciais do JusBrasil não configuradas (JUSBRASIL_EMAIL e JUSBRASIL_SENHA)');
    }

    try {
      console.log(`🔐 Fazendo login no JusBrasil (${this.email})...`);

      await this.page.goto('https://www.jusbrasil.com.br/login', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      // Preencher formulário de login
      await this.page.type('input[name="email"], input[type="email"]', this.email, { delay: 100 });
      await this.page.type('input[name="password"], input[type="password"]', this.senha, { delay: 100 });

      // Submeter formulário
      await Promise.all([
        this.page.click('button[type="submit"], input[type="submit"]'),
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: this.timeout })
      ]);

      // Verificar se login foi bem-sucedido
      const currentUrl = this.page.url();
      if (currentUrl.includes('/login')) {
        throw new Error('Login falhou - ainda na página de login');
      }

      this.isAuthenticated = true;
      console.log('✅ Login realizado com sucesso');
      return true;

    } catch (error) {
      console.error('❌ Erro no login do JusBrasil:', error.message);
      throw error;
    }
  }

  /**
   * Buscar jurisprudência no JusBrasil
   */
  async search(query, options = {}) {
    const { limit = 10, tribunal = null } = options;

    try {
      await this.initialize();
      await this.login();

      console.log(`🔍 Buscando no JusBrasil: "${query}"`);

      // Construir URL de busca
      const searchQuery = tribunal ? `${query} ${tribunal}` : query;
      const encodedQuery = encodeURIComponent(searchQuery);
      const searchUrl = `https://www.jusbrasil.com.br/jurisprudencia/busca?q=${encodedQuery}`;

      await this.page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      // Aguardar resultados carregarem
      await this.page.waitForSelector('.SearchResult, .jurisprudence-item, article', {
        timeout: 10000
      }).catch(() => {
        console.warn('⚠️ Seletor de resultados não encontrado, tentando scraping geral');
      });

      // Extrair HTML da página
      const html = await this.page.content();
      const results = this.parseSearchResults(html, limit);

      console.log(`✅ Encontrados ${results.length} resultados no JusBrasil`);

      return {
        success: true,
        source: 'jusbrasil',
        query: searchQuery,
        results,
        total: results.length
      };

    } catch (error) {
      console.error('❌ Erro na busca do JusBrasil:', error.message);
      return {
        success: false,
        source: 'jusbrasil',
        error: error.message,
        results: []
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
   * Fechar browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isAuthenticated = false;
      console.log('✅ JusBrasil Client fechado');
    }
  }

  /**
   * Destructor (cleanup)
   */
  async destroy() {
    await this.close();
  }
}

export default JusBrasilClient;
