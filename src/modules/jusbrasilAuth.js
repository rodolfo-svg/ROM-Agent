/**
 * ROM Agent - Módulo Jusbrasil Autenticado
 * Automação de navegador para acesso autenticado ao Jusbrasil
 *
 * IMPORTANTE: Use com responsabilidade. Automação pode violar termos de uso.
 *
 * @version 1.0.0
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Adicionar plugin stealth para evitar detecção de bot
puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const CONFIG = {
  // URLs do Jusbrasil
  urls: {
    base: 'https://www.jusbrasil.com.br',
    login: 'https://www.jusbrasil.com.br/login',
    jurisprudencia: 'https://www.jusbrasil.com.br/jurisprudencia',
    busca: 'https://www.jusbrasil.com.br/jurisprudencia/busca'
  },

  // Configurações do navegador
  browser: {
    headless: 'new', // 'new' para headless, false para ver o navegador
    slowMo: 50, // Delay entre ações (ms)
    timeout: 60000, // Timeout geral (ms)
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080'
    ]
  },

  // Seletores CSS (podem mudar se o site atualizar)
  selectors: {
    // Login
    emailInput: 'input[name="email"], input[type="email"], #email',
    passwordInput: 'input[name="password"], input[type="password"], #password',
    loginButton: 'button[type="submit"], input[type="submit"], .login-button',
    loginSuccess: '.user-menu, .avatar, [data-testid="user-menu"]',

    // Pesquisa
    searchInput: 'input[name="q"], input[type="search"], .search-input',
    searchButton: 'button[type="submit"], .search-button',

    // Resultados
    resultItem: '.search-result, .jurisprudencia-item, [data-testid="search-result"]',
    resultTitle: '.title, h2, h3',
    resultEmenta: '.ementa, .summary, .description',
    resultTribunal: '.tribunal, .court',
    resultData: '.date, time',
    resultLink: 'a[href*="/jurisprudencia/"]',

    // Paginação
    nextPage: '.pagination .next, [aria-label="Próxima página"]',

    // Conteúdo completo
    fullContent: '.inteiro-teor, .full-content, .document-content'
  },

  // Caminho para salvar cookies
  cookiesPath: path.join(__dirname, '../../.jusbrasil-cookies.json'),

  // Delay entre requisições (respeitar o site)
  delayEntreAcoes: 1500
};

// ============================================================
// ESTADO GLOBAL
// ============================================================

let browser = null;
let page = null;
let isLoggedIn = false;

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

/**
 * Delay para simular comportamento humano
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Salva cookies para sessão persistente
 */
async function salvarCookies() {
  if (page) {
    const cookies = await page.cookies();
    fs.writeFileSync(CONFIG.cookiesPath, JSON.stringify(cookies, null, 2));
  }
}

/**
 * Carrega cookies salvos
 */
async function carregarCookies() {
  if (fs.existsSync(CONFIG.cookiesPath)) {
    const cookies = JSON.parse(fs.readFileSync(CONFIG.cookiesPath, 'utf-8'));
    if (page && cookies.length > 0) {
      await page.setCookie(...cookies);
      return true;
    }
  }
  return false;
}

/**
 * Aguarda seletor com fallback para múltiplos seletores
 */
async function aguardarSeletor(seletores, timeout = 10000) {
  const seletorArray = seletores.split(', ');

  for (const seletor of seletorArray) {
    try {
      await page.waitForSelector(seletor, { timeout: timeout / seletorArray.length });
      return seletor;
    } catch (e) {
      continue;
    }
  }
  throw new Error(`Nenhum seletor encontrado: ${seletores}`);
}

/**
 * Tenta clicar em um elemento usando múltiplos seletores
 */
async function clicarSeletor(seletores) {
  const seletorArray = seletores.split(', ');

  for (const seletor of seletorArray) {
    try {
      const elemento = await page.$(seletor);
      if (elemento) {
        await elemento.click();
        return true;
      }
    } catch (e) {
      continue;
    }
  }
  return false;
}

/**
 * Digita texto com delay para simular humano
 */
async function digitarTexto(seletor, texto) {
  const seletorArray = seletor.split(', ');

  for (const sel of seletorArray) {
    try {
      const elemento = await page.$(sel);
      if (elemento) {
        await elemento.click();
        await elemento.type(texto, { delay: 50 + Math.random() * 50 });
        return true;
      }
    } catch (e) {
      continue;
    }
  }
  return false;
}

// ============================================================
// FUNÇÕES PRINCIPAIS
// ============================================================

/**
 * Inicializa o navegador
 */
export async function inicializarNavegador(options = {}) {
  if (browser) {
    return { sucesso: true, mensagem: 'Navegador já inicializado' };
  }

  try {
    browser = await puppeteer.launch({
      ...CONFIG.browser,
      headless: options.headless !== undefined ? options.headless : CONFIG.browser.headless
    });

    page = await browser.newPage();

    // Configurar viewport e user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Tentar carregar cookies salvos
    await carregarCookies();

    return { sucesso: true, mensagem: 'Navegador inicializado com sucesso' };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Fecha o navegador
 */
export async function fecharNavegador() {
  if (browser) {
    await salvarCookies();
    await browser.close();
    browser = null;
    page = null;
    isLoggedIn = false;
  }
  return { sucesso: true, mensagem: 'Navegador fechado' };
}

/**
 * Faz login no Jusbrasil
 * @param {string} email - Email da conta
 * @param {string} senha - Senha da conta
 * @param {object} options - Opções
 */
export async function login(email, senha, options = {}) {
  const { aguardarManual = false, timeout = 60000 } = options;

  if (!browser) {
    await inicializarNavegador();
  }

  try {
    // Navegar para página de login
    console.log('[Jusbrasil] Navegando para página de login...');
    await page.goto(CONFIG.urls.login, { waitUntil: 'networkidle0', timeout: CONFIG.browser.timeout });
    await delay(3000);

    // Verificar se já está logado (cookies válidos)
    const jaLogado = await page.evaluate(() => {
      // Verificar múltiplos indicadores de login
      const indicadores = [
        document.querySelector('[data-testid="user-menu"]'),
        document.querySelector('.user-menu'),
        document.querySelector('.avatar'),
        document.querySelector('[class*="UserMenu"]'),
        document.querySelector('[class*="logged"]'),
        document.querySelector('a[href*="/sair"]'),
        document.querySelector('a[href*="/logout"]')
      ];
      return indicadores.some(el => el !== null);
    });

    if (jaLogado) {
      isLoggedIn = true;
      await salvarCookies();
      return { sucesso: true, mensagem: 'Já estava logado (cookies válidos)' };
    }

    // Tirar screenshot para debug
    await page.screenshot({ path: '/tmp/jusbrasil-login-page.png' });
    console.log('[Jusbrasil] Screenshot salvo em /tmp/jusbrasil-login-page.png');

    // Verificar se há CAPTCHA
    const temCaptcha = await page.evaluate(() => {
      const captchaIndicadores = [
        document.querySelector('[class*="captcha"]'),
        document.querySelector('[class*="recaptcha"]'),
        document.querySelector('iframe[src*="recaptcha"]'),
        document.querySelector('[data-sitekey]')
      ];
      return captchaIndicadores.some(el => el !== null);
    });

    if (temCaptcha && !aguardarManual) {
      return {
        sucesso: false,
        erro: 'CAPTCHA detectado na página de login',
        dica: 'Use login() com aguardarManual: true e resolva o CAPTCHA manualmente',
        screenshot: '/tmp/jusbrasil-login-page.png'
      };
    }

    // Tentar encontrar e preencher campos de login
    console.log('[Jusbrasil] Preenchendo credenciais...');

    // Estratégia 1: Seletores específicos
    let emailPreenchido = false;
    let senhaPreenchida = false;

    // Tentar preencher email
    const emailSelectors = [
      'input[name="email"]',
      'input[type="email"]',
      'input[id="email"]',
      'input[placeholder*="mail"]',
      'input[placeholder*="E-mail"]',
      'input[autocomplete="email"]'
    ];

    for (const sel of emailSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          await el.type(email, { delay: 100 });
          emailPreenchido = true;
          console.log(`[Jusbrasil] Email preenchido com seletor: ${sel}`);
          break;
        }
      } catch (e) { continue; }
    }

    // Se não conseguiu, tentar via evaluate
    if (!emailPreenchido) {
      emailPreenchido = await page.evaluate((email) => {
        const inputs = Array.from(document.querySelectorAll('input'));
        for (const input of inputs) {
          const isEmail = input.type === 'email' ||
                          input.name?.toLowerCase().includes('email') ||
                          input.id?.toLowerCase().includes('email') ||
                          input.placeholder?.toLowerCase().includes('email') ||
                          input.placeholder?.toLowerCase().includes('e-mail');
          if (isEmail) {
            input.focus();
            input.value = email;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      }, email);
    }

    await delay(1000);

    // Tentar preencher senha
    const senhaSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[id="password"]',
      'input[name="senha"]',
      'input[placeholder*="enha"]'
    ];

    for (const sel of senhaSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          await el.type(senha, { delay: 100 });
          senhaPreenchida = true;
          console.log(`[Jusbrasil] Senha preenchida com seletor: ${sel}`);
          break;
        }
      } catch (e) { continue; }
    }

    // Se não conseguiu, tentar via evaluate
    if (!senhaPreenchida) {
      senhaPreenchida = await page.evaluate((senha) => {
        const inputs = Array.from(document.querySelectorAll('input'));
        for (const input of inputs) {
          if (input.type === 'password') {
            input.focus();
            input.value = senha;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      }, senha);
    }

    await delay(1000);

    // Screenshot após preencher
    await page.screenshot({ path: '/tmp/jusbrasil-login-filled.png' });

    // Clicar no botão de login
    console.log('[Jusbrasil] Clicando no botão de login...');
    const botaoSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:contains("Entrar")',
      'button:contains("Login")',
      '[data-testid="login-button"]',
      '.login-button',
      'button[class*="login"]',
      'button[class*="submit"]'
    ];

    let botaoClicado = false;
    for (const sel of botaoSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          botaoClicado = true;
          console.log(`[Jusbrasil] Botão clicado com seletor: ${sel}`);
          break;
        }
      } catch (e) { continue; }
    }

    // Se não achou botão, tentar Enter
    if (!botaoClicado) {
      await page.keyboard.press('Enter');
      console.log('[Jusbrasil] Pressionado Enter');
    }

    // Aguardar navegação/resposta
    console.log('[Jusbrasil] Aguardando resposta...');
    await delay(3000);

    // VERIFICAR SE É LOGIN EM 2 ETAPAS (página de senha)
    const urlAposEmail = page.url();
    if (urlAposEmail.includes('/login/details') || urlAposEmail.includes('/login')) {
      console.log('[Jusbrasil] Login em 2 etapas detectado - preenchendo senha...');

      // Aguardar página de senha carregar
      await delay(2000);

      // Preencher senha na segunda etapa
      let senhaPreenchidaEtapa2 = false;

      for (const sel of senhaSelectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            await el.click();
            await page.keyboard.type(senha, { delay: 100 });
            senhaPreenchidaEtapa2 = true;
            console.log(`[Jusbrasil] Senha preenchida (etapa 2) com seletor: ${sel}`);
            break;
          }
        } catch (e) { continue; }
      }

      // Se não conseguiu, tentar via evaluate
      if (!senhaPreenchidaEtapa2) {
        senhaPreenchidaEtapa2 = await page.evaluate((senha) => {
          const inputs = Array.from(document.querySelectorAll('input'));
          for (const input of inputs) {
            if (input.type === 'password') {
              input.focus();
              input.value = senha;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
          }
          return false;
        }, senha);
      }

      senhaPreenchida = senhaPreenchidaEtapa2;

      await delay(1000);
      await page.screenshot({ path: '/tmp/jusbrasil-login-step2.png' });

      // Clicar no botão ENTRAR
      console.log('[Jusbrasil] Clicando em ENTRAR...');
      for (const sel of botaoSelectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            await el.click();
            console.log(`[Jusbrasil] Botão ENTRAR clicado com seletor: ${sel}`);
            break;
          }
        } catch (e) { continue; }
      }

      // Aguardar login completar
      await delay(5000);
    }

    console.log('[Jusbrasil] Verificando resultado do login...');

    if (aguardarManual) {
      console.log('[Jusbrasil] Aguardando resolução manual (CAPTCHA)...');
      // Aguardar até 2 minutos para o usuário resolver CAPTCHA
      await page.waitForFunction(() => {
        const indicadores = [
          document.querySelector('[data-testid="user-menu"]'),
          document.querySelector('.user-menu'),
          document.querySelector('.avatar'),
          document.querySelector('a[href*="/sair"]')
        ];
        return indicadores.some(el => el !== null);
      }, { timeout });
    } else {
      await delay(5000);
    }

    // Verificar se login foi bem sucedido
    const loginSucesso = await page.evaluate(() => {
      const indicadores = [
        document.querySelector('[data-testid="user-menu"]'),
        document.querySelector('.user-menu'),
        document.querySelector('.avatar'),
        document.querySelector('[class*="UserMenu"]'),
        document.querySelector('[class*="logged"]'),
        document.querySelector('a[href*="/sair"]'),
        document.querySelector('a[href*="/logout"]')
      ];
      return indicadores.some(el => el !== null);
    });

    // Verificar também pela URL
    const urlAtual = page.url();
    const loginNaUrl = !urlAtual.includes('/login');

    await page.screenshot({ path: '/tmp/jusbrasil-login-result.png' });

    if (loginSucesso || loginNaUrl) {
      isLoggedIn = true;
      await salvarCookies();
      return {
        sucesso: true,
        mensagem: 'Login realizado com sucesso',
        url: urlAtual
      };
    }

    // Verificar se há mensagem de erro
    const erro = await page.evaluate(() => {
      const errorSeletores = [
        '.error',
        '.alert-danger',
        '.alert-error',
        '[role="alert"]',
        '[class*="error"]',
        '[class*="Error"]'
      ];
      for (const sel of errorSeletores) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) {
          return el.textContent.trim();
        }
      }
      return null;
    });

    return {
      sucesso: false,
      erro: erro || 'Falha no login - verifique credenciais ou resolva CAPTCHA',
      dica: 'Tente: 1) Verificar credenciais 2) Usar aguardarManual:true para CAPTCHA 3) Fazer login manual no navegador primeiro',
      screenshots: [
        '/tmp/jusbrasil-login-page.png',
        '/tmp/jusbrasil-login-filled.png',
        '/tmp/jusbrasil-login-result.png'
      ],
      emailPreenchido,
      senhaPreenchida,
      botaoClicado,
      urlAtual
    };

  } catch (error) {
    await page.screenshot({ path: '/tmp/jusbrasil-login-error.png' });
    return {
      sucesso: false,
      erro: error.message,
      screenshot: '/tmp/jusbrasil-login-error.png'
    };
  }
}

/**
 * Pesquisa jurisprudência autenticada
 * @param {string} termo - Termo de busca
 * @param {object} options - Opções de busca
 */
export async function pesquisarJurisprudencia(termo, options = {}) {
  const {
    tribunal = null,
    pagina = 1,
    limite = 10
  } = options;

  if (!browser) {
    await inicializarNavegador();
  }

  if (!isLoggedIn) {
    return {
      sucesso: false,
      erro: 'Não está logado. Execute login() primeiro.',
      dica: 'Use: await jusbrasilAuth.login("email", "senha")'
    };
  }

  try {
    // Construir URL de busca
    let url = `${CONFIG.urls.busca}?q=${encodeURIComponent(termo)}`;
    if (tribunal) {
      url += `&tribunal=${encodeURIComponent(tribunal.toUpperCase())}`;
    }
    if (pagina > 1) {
      url += `&p=${pagina}`;
    }

    // Navegar para página de busca
    console.log('[Jusbrasil] Navegando para:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: CONFIG.browser.timeout });
    await delay(3000);

    // Screenshot da página de resultados
    await page.screenshot({ path: '/tmp/jusbrasil-search-results.png', fullPage: true });
    console.log('[Jusbrasil] Screenshot da busca salvo em /tmp/jusbrasil-search-results.png');

    // Debug: ver estrutura HTML
    const htmlPreview = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      return main.innerHTML.substring(0, 2000);
    });
    console.log('[Jusbrasil] HTML preview:', htmlPreview.substring(0, 500));

    // Extrair resultados
    const resultados = await page.evaluate((selectors, maxResultados) => {
      const items = [];

      // Tentar diferentes seletores de resultado
      const possiveisSeletores = [
        'article',
        '.search-result',
        '[data-testid="search-result"]',
        '.jurisprudencia-item',
        '.resultado-item',
        'li[class*="result"]',
        'div[class*="result"]'
      ];

      let elementos = [];
      for (const sel of possiveisSeletores) {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) {
          elementos = found;
          break;
        }
      }

      elementos.forEach((el, index) => {
        if (index >= maxResultados) return;

        // Extrair título
        const tituloEl = el.querySelector('h2, h3, h4, .title, [class*="title"]');
        const titulo = tituloEl ? tituloEl.textContent.trim() : '';

        // Extrair ementa
        const ementaEl = el.querySelector('p, .ementa, .summary, .description, [class*="ementa"]');
        const ementa = ementaEl ? ementaEl.textContent.trim() : '';

        // Extrair tribunal
        const tribunalEl = el.querySelector('.tribunal, .court, [class*="tribunal"], [class*="court"]');
        const tribunal = tribunalEl ? tribunalEl.textContent.trim() : '';

        // Extrair data
        const dataEl = el.querySelector('time, .date, [class*="date"]');
        const data = dataEl ? dataEl.textContent.trim() : '';

        // Extrair link
        const linkEl = el.querySelector('a[href*="/jurisprudencia/"]');
        const link = linkEl ? linkEl.href : '';

        // Extrair número do processo
        const numeroEl = el.querySelector('[class*="numero"], [class*="number"], [class*="processo"]');
        const numero = numeroEl ? numeroEl.textContent.trim() : '';

        if (titulo || ementa) {
          items.push({
            titulo: titulo || 'Sem título',
            ementa: ementa.substring(0, 1000),
            tribunal: tribunal || 'Não identificado',
            data,
            numero,
            link,
            fonte: 'Jusbrasil (Autenticado)'
          });
        }
      });

      return items;
    }, CONFIG.selectors, limite);

    await delay(CONFIG.delayEntreAcoes);

    return {
      sucesso: true,
      fonte: 'Jusbrasil (Autenticado)',
      termo,
      tribunal: tribunal || 'Todos',
      pagina,
      totalEncontrados: resultados.length,
      resultados
    };

  } catch (error) {
    return { sucesso: false, erro: error.message, termo };
  }
}

/**
 * Obtém inteiro teor de uma decisão
 * @param {string} url - URL da decisão no Jusbrasil
 */
export async function obterInteiroTeor(url) {
  if (!browser) {
    await inicializarNavegador();
  }

  if (!isLoggedIn) {
    return {
      sucesso: false,
      erro: 'Não está logado. Execute login() primeiro.'
    };
  }

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: CONFIG.browser.timeout });
    await delay(2000);

    const conteudo = await page.evaluate(() => {
      // Tentar extrair conteúdo completo
      const seletores = [
        '.inteiro-teor',
        '.full-content',
        '.document-content',
        '.content-body',
        'article .content',
        '[class*="inteiro"]',
        '[class*="teor"]'
      ];

      for (const sel of seletores) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 100) {
          return el.textContent.trim();
        }
      }

      // Fallback: pegar todo o conteúdo principal
      const main = document.querySelector('main, article, .main-content');
      return main ? main.textContent.trim() : document.body.textContent.trim();
    });

    // Extrair metadados
    const metadados = await page.evaluate(() => {
      return {
        titulo: document.querySelector('h1')?.textContent?.trim() || '',
        tribunal: document.querySelector('[class*="tribunal"], [class*="court"]')?.textContent?.trim() || '',
        relator: document.querySelector('[class*="relator"], [class*="ministro"]')?.textContent?.trim() || '',
        data: document.querySelector('time, [class*="date"]')?.textContent?.trim() || '',
        numero: document.querySelector('[class*="numero"], [class*="processo"]')?.textContent?.trim() || ''
      };
    });

    await delay(CONFIG.delayEntreAcoes);

    return {
      sucesso: true,
      url,
      metadados,
      conteudo: conteudo.substring(0, 50000), // Limitar tamanho
      tamanho: conteudo.length,
      fonte: 'Jusbrasil (Autenticado)'
    };

  } catch (error) {
    return { sucesso: false, erro: error.message, url };
  }
}

/**
 * Pesquisa peças processuais (petições, contratos, etc)
 * @param {string} termo - Termo de busca
 * @param {string} tipo - Tipo: peticao, contrato, recurso, etc
 */
export async function pesquisarPecas(termo, tipo = 'peticao', options = {}) {
  const { limite = 10 } = options;

  if (!browser) {
    await inicializarNavegador();
  }

  if (!isLoggedIn) {
    return {
      sucesso: false,
      erro: 'Não está logado. Execute login() primeiro.'
    };
  }

  try {
    // URL de busca de peças
    const url = `${CONFIG.urls.base}/busca?q=${encodeURIComponent(termo)}&type=${tipo}`;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: CONFIG.browser.timeout });
    await delay(2000);

    const resultados = await page.evaluate((maxResultados) => {
      const items = [];
      const elementos = document.querySelectorAll('article, .search-result, [class*="result"]');

      elementos.forEach((el, index) => {
        if (index >= maxResultados) return;

        const titulo = el.querySelector('h2, h3, .title')?.textContent?.trim() || '';
        const descricao = el.querySelector('p, .description')?.textContent?.trim() || '';
        const link = el.querySelector('a')?.href || '';

        if (titulo) {
          items.push({ titulo, descricao, link, fonte: 'Jusbrasil (Autenticado)' });
        }
      });

      return items;
    }, limite);

    await delay(CONFIG.delayEntreAcoes);

    return {
      sucesso: true,
      fonte: 'Jusbrasil (Autenticado)',
      termo,
      tipo,
      totalEncontrados: resultados.length,
      resultados
    };

  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Acessa o Jus IA (se disponível no plano)
 * @param {string} pergunta - Pergunta para o Jus IA
 */
export async function perguntarJusIA(pergunta) {
  if (!browser) {
    await inicializarNavegador();
  }

  if (!isLoggedIn) {
    return {
      sucesso: false,
      erro: 'Não está logado. Execute login() primeiro.'
    };
  }

  try {
    // Navegar para o Jus IA
    await page.goto('https://ia.jusbrasil.com.br/', { waitUntil: 'networkidle2', timeout: CONFIG.browser.timeout });
    await delay(3000);

    // Verificar se tem acesso
    const temAcesso = await page.evaluate(() => {
      const bloqueio = document.querySelector('[class*="paywall"], [class*="blocked"], [class*="upgrade"]');
      return !bloqueio;
    });

    if (!temAcesso) {
      return {
        sucesso: false,
        erro: 'Acesso ao Jus IA bloqueado - verifique se seu plano inclui este recurso'
      };
    }

    // Encontrar campo de input
    const inputSeletores = 'textarea, input[type="text"], [contenteditable="true"], .chat-input';

    await aguardarSeletor(inputSeletores, 10000);
    await digitarTexto(inputSeletores, pergunta);

    // Enviar pergunta (Enter ou botão)
    await page.keyboard.press('Enter');

    // Aguardar resposta
    await delay(10000); // Jus IA pode demorar

    // Extrair resposta
    const resposta = await page.evaluate(() => {
      const mensagens = document.querySelectorAll('[class*="message"], [class*="response"], [class*="answer"]');
      if (mensagens.length > 0) {
        return mensagens[mensagens.length - 1].textContent.trim();
      }
      return null;
    });

    return {
      sucesso: !!resposta,
      pergunta,
      resposta: resposta || 'Não foi possível obter resposta',
      fonte: 'Jus IA (Jusbrasil)'
    };

  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Verifica status do login
 */
export async function verificarLogin() {
  return {
    navegadorAtivo: !!browser,
    logado: isLoggedIn,
    cookiesSalvos: fs.existsSync(CONFIG.cookiesPath)
  };
}

/**
 * Configura credenciais via variáveis de ambiente
 * @param {string} email
 * @param {string} senha
 */
export function configurarCredenciais(email, senha) {
  process.env.JUSBRASIL_EMAIL = email;
  process.env.JUSBRASIL_SENHA = senha;
  return { sucesso: true, mensagem: 'Credenciais configuradas em memória' };
}

/**
 * Login usando credenciais das variáveis de ambiente
 */
export async function loginComCredenciaisConfiguradas() {
  const email = process.env.JUSBRASIL_EMAIL;
  const senha = process.env.JUSBRASIL_SENHA;

  if (!email || !senha) {
    return {
      sucesso: false,
      erro: 'Credenciais não configuradas',
      dica: 'Use configurarCredenciais(email, senha) primeiro ou defina JUSBRASIL_EMAIL e JUSBRASIL_SENHA'
    };
  }

  return await login(email, senha);
}

/**
 * Login manual interativo - abre navegador visível para resolver CAPTCHA
 * Execute isso uma vez para salvar os cookies, depois use loginComCookies()
 * @param {string} email
 * @param {string} senha
 */
export async function loginManual(email, senha) {
  console.log('\n========================================');
  console.log('LOGIN MANUAL - RESOLVA O CAPTCHA NO NAVEGADOR');
  console.log('========================================\n');

  // Inicializar com navegador VISÍVEL
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }

  browser = await puppeteer.launch({
    headless: false, // VISÍVEL
    slowMo: 100,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800'
    ]
  });

  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Carregar cookies existentes se houver
  await carregarCookies();

  console.log('1. Abrindo página de login...');
  await page.goto(CONFIG.urls.login, { waitUntil: 'networkidle2', timeout: 60000 });
  await delay(2000);

  // Verificar se já logado
  const jaLogado = await page.evaluate(() => {
    return document.querySelector('a[href*="/sair"]') !== null;
  });

  if (jaLogado) {
    console.log('Já está logado! Salvando cookies...');
    await salvarCookies();
    isLoggedIn = true;
    await browser.close();
    browser = null;
    page = null;
    return { sucesso: true, mensagem: 'Já estava logado. Cookies salvos.' };
  }

  // Preencher email se campo existir
  try {
    const emailInput = await page.$('input[name="email"], input[type="email"]');
    if (emailInput) {
      await emailInput.type(email, { delay: 100 });
      console.log('2. Email preenchido');
    }
  } catch (e) {}

  await delay(1000);

  // Clicar em continuar/submit
  try {
    const btn = await page.$('button[type="submit"]');
    if (btn) await btn.click();
  } catch (e) {}

  await delay(3000);

  // Se estiver na página de senha, preencher
  const urlAtual = page.url();
  if (urlAtual.includes('/login/details') || urlAtual.includes('/login')) {
    try {
      const senhaInput = await page.$('input[type="password"]');
      if (senhaInput) {
        await senhaInput.type(senha, { delay: 100 });
        console.log('3. Senha preenchida');
      }
    } catch (e) {}
  }

  console.log('\n========================================');
  console.log('AGUARDANDO VOCÊ:');
  console.log('1. Resolver qualquer CAPTCHA que aparecer');
  console.log('2. Clicar em ENTRAR');
  console.log('3. Aguardar o login completar');
  console.log('========================================\n');
  console.log('Aguardando login por até 2 minutos...\n');

  // Aguardar login (até 2 minutos)
  try {
    await page.waitForFunction(() => {
      return document.querySelector('a[href*="/sair"]') !== null ||
             !window.location.href.includes('/login');
    }, { timeout: 120000 });

    console.log('Login detectado! Salvando cookies...');
    await salvarCookies();
    isLoggedIn = true;

    // Fechar navegador
    await browser.close();
    browser = null;
    page = null;

    return {
      sucesso: true,
      mensagem: 'Login realizado com sucesso! Cookies salvos para uso futuro.',
      cookiesPath: CONFIG.cookiesPath
    };

  } catch (e) {
    console.log('Timeout ou erro. Salvando estado atual...');
    await salvarCookies();
    await browser.close();
    browser = null;
    page = null;

    return {
      sucesso: false,
      erro: 'Timeout aguardando login. Tente novamente.',
      cookiesPath: CONFIG.cookiesPath
    };
  }
}

/**
 * Login usando apenas cookies salvos (após loginManual)
 * @param {boolean} headless - Se false, abre navegador visível (evita Cloudflare)
 */
export async function loginComCookies(headless = false) {
  if (!fs.existsSync(CONFIG.cookiesPath)) {
    return {
      sucesso: false,
      erro: 'Cookies não encontrados. Execute loginManual() primeiro.',
      dica: 'Use: await jusbrasilAuth.loginManual("email", "senha")'
    };
  }

  // Fechar navegador existente se houver
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }

  // Abrir navegador (visível por padrão para evitar Cloudflare)
  browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    slowMo: 50,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800'
    ]
  });

  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Carregar cookies
  await carregarCookies();

  // Navegar para verificar se login é válido
  console.log('[Jusbrasil] Verificando sessão...');
  await page.goto('https://www.jusbrasil.com.br/', { waitUntil: 'networkidle2', timeout: 60000 });
  await delay(3000);

  // Verificar se há Cloudflare challenge
  const temCloudflare = await page.evaluate(() => {
    return document.body.innerHTML.includes('Verify you are human') ||
           document.body.innerHTML.includes('Confirme que você é humano');
  });

  if (temCloudflare) {
    console.log('[Jusbrasil] Cloudflare detectado - aguardando resolução manual...');
    // Aguardar usuário resolver (até 60s)
    try {
      await page.waitForFunction(() => {
        return !document.body.innerHTML.includes('Verify you are human') &&
               !document.body.innerHTML.includes('Confirme que você é humano');
      }, { timeout: 60000 });
      await delay(2000);
    } catch (e) {
      return { sucesso: false, erro: 'Timeout aguardando resolução do Cloudflare' };
    }
  }

  const logado = await page.evaluate(() => {
    return document.querySelector('a[href*="/sair"]') !== null ||
           document.querySelector('[class*="UserMenu"]') !== null ||
           document.querySelector('[class*="avatar"]') !== null;
  });

  if (logado) {
    isLoggedIn = true;
    await salvarCookies(); // Atualizar cookies
    return { sucesso: true, mensagem: 'Login restaurado via cookies' };
  }

  return {
    sucesso: false,
    erro: 'Cookies expirados ou inválidos. Execute loginManual() novamente.'
  };
}

/**
 * Sessão completa interativa - login + pesquisa em uma única sessão
 * Mantém navegador aberto para evitar Cloudflare
 * @param {string} email
 * @param {string} senha
 * @param {string} termoBusca - Termo para pesquisar após login
 */
export async function sessaoCompleta(email, senha, termoBusca, options = {}) {
  const { limite = 10 } = options;

  console.log('\n========================================');
  console.log('SESSÃO JUSBRASIL - LOGIN + PESQUISA');
  console.log('========================================\n');

  // Fechar navegador existente
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }

  // Abrir navegador VISÍVEL
  browser = await puppeteer.launch({
    headless: false,
    slowMo: 50,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1400,900'
    ]
  });

  page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // Carregar cookies se existirem
  await carregarCookies();

  // ETAPA 1: Login
  console.log('ETAPA 1: Verificando login...');
  await page.goto(CONFIG.urls.base, { waitUntil: 'networkidle2', timeout: 60000 });
  await delay(3000);

  // Verificar se precisa fazer login
  let precisaLogin = await page.evaluate(() => {
    return document.querySelector('a[href*="/sair"]') === null;
  });

  // Verificar Cloudflare na home
  const cloudflareHome = await page.evaluate(() => {
    return document.body.innerHTML.includes('Verify you are human') ||
           document.body.innerHTML.includes('Confirme que você é humano') ||
           document.body.innerHTML.includes('Verifying you are human');
  });

  if (cloudflareHome) {
    console.log('Cloudflare detectado na home - aguardando resolução manual...');
    await page.waitForFunction(() => {
      return !document.body.innerHTML.includes('Verify you are human') &&
             !document.body.innerHTML.includes('Confirme que você é humano') &&
             !document.body.innerHTML.includes('Verifying you are human');
    }, { timeout: 120000 });
    await delay(2000);
  }

  // Verificar novamente se precisa login
  precisaLogin = await page.evaluate(() => {
    return document.querySelector('a[href*="/sair"]') === null;
  });

  if (precisaLogin) {
    console.log('Navegando para login...');
    await page.goto(CONFIG.urls.login, { waitUntil: 'networkidle2', timeout: 60000 });
    await delay(2000);

    // Preencher email
    try {
      const emailInput = await page.$('input[name="email"], input[type="email"]');
      if (emailInput) {
        await emailInput.type(email, { delay: 80 });
        console.log('Email preenchido');
      }
    } catch (e) {}

    await delay(500);

    // Clicar continuar
    try {
      const btn = await page.$('button[type="submit"]');
      if (btn) await btn.click();
    } catch (e) {}

    await delay(3000);

    // Preencher senha se na página de detalhes
    if (page.url().includes('/login')) {
      try {
        const senhaInput = await page.$('input[type="password"]');
        if (senhaInput) {
          await senhaInput.type(senha, { delay: 80 });
          console.log('Senha preenchida');
        }
      } catch (e) {}
    }

    console.log('\n>>> RESOLVA O CAPTCHA E CLIQUE EM ENTRAR <<<\n');
    console.log('Aguardando login (até 2 min)...');

    // Aguardar login
    await page.waitForFunction(() => {
      return document.querySelector('a[href*="/sair"]') !== null ||
             !window.location.href.includes('/login');
    }, { timeout: 120000 });

    console.log('Login detectado!');
    await salvarCookies();
    isLoggedIn = true;
  } else {
    console.log('Já está logado!');
    isLoggedIn = true;
  }

  await delay(2000);

  // ETAPA 2: Pesquisa
  console.log('\nETAPA 2: Pesquisando "' + termoBusca + '"...');

  const urlBusca = `${CONFIG.urls.busca}?q=${encodeURIComponent(termoBusca)}`;
  await page.goto(urlBusca, { waitUntil: 'networkidle2', timeout: 60000 });
  await delay(3000);

  // Verificar Cloudflare na busca
  const cloudflareBusca = await page.evaluate(() => {
    return document.body.innerHTML.includes('Verify you are human') ||
           document.body.innerHTML.includes('Confirme que você é humano') ||
           document.body.innerHTML.includes('Verifying you are human');
  });

  if (cloudflareBusca) {
    console.log('Cloudflare na busca - aguardando resolução...');
    await page.waitForFunction(() => {
      return !document.body.innerHTML.includes('Verify you are human') &&
             !document.body.innerHTML.includes('Confirme que você é humano') &&
             !document.body.innerHTML.includes('Verifying you are human');
    }, { timeout: 120000 });
    await delay(3000);
  }

  // Extrair resultados
  console.log('Extraindo resultados...');
  await page.screenshot({ path: '/tmp/jusbrasil-final-results.png', fullPage: true });

  const resultados = await page.evaluate((maxResultados) => {
    const items = [];

    // Seletores para resultados do Jusbrasil
    const seletores = [
      'article',
      '[data-testid*="result"]',
      '.DocumentSnippet',
      '.search-result',
      'li[class*="result"]'
    ];

    let elementos = [];
    for (const sel of seletores) {
      const found = document.querySelectorAll(sel);
      if (found.length > 2) { // Pelo menos 3 resultados
        elementos = found;
        break;
      }
    }

    // Se não encontrou, tentar pegar links de jurisprudência
    if (elementos.length === 0) {
      elementos = document.querySelectorAll('a[href*="/jurisprudencia/"]');
    }

    elementos.forEach((el, index) => {
      if (index >= maxResultados) return;

      let titulo = '';
      let ementa = '';
      let tribunal = '';
      let link = '';

      // Se é um link
      if (el.tagName === 'A') {
        titulo = el.textContent.trim();
        link = el.href;
      } else {
        // Extrair de elemento container
        titulo = (el.querySelector('h2, h3, h4, [class*="title"]') || el.querySelector('a'))?.textContent?.trim() || '';
        ementa = el.querySelector('p, [class*="ementa"], [class*="snippet"]')?.textContent?.trim() || '';
        tribunal = el.querySelector('[class*="tribunal"], [class*="court"], [class*="source"]')?.textContent?.trim() || '';
        link = el.querySelector('a')?.href || '';
      }

      if (titulo && titulo.length > 10) {
        items.push({
          titulo: titulo.substring(0, 200),
          ementa: ementa.substring(0, 500),
          tribunal: tribunal || 'Jusbrasil',
          link,
          fonte: 'Jusbrasil (Autenticado)'
        });
      }
    });

    return items;
  }, limite);

  console.log(`\nEncontrados: ${resultados.length} resultados`);

  // Salvar cookies atualizados
  await salvarCookies();

  return {
    sucesso: true,
    loginRealizado: true,
    termo: termoBusca,
    totalEncontrados: resultados.length,
    resultados,
    screenshot: '/tmp/jusbrasil-final-results.png',
    mensagem: 'Use fecharNavegador() quando terminar ou mantenha aberto para mais pesquisas'
  };
}

// ============================================================
// EXPORTAÇÕES
// ============================================================

export default {
  // Configuração
  CONFIG,

  // Navegador
  inicializarNavegador,
  fecharNavegador,

  // Autenticação
  login,
  loginManual,           // Login com navegador visível para CAPTCHA
  loginComCookies,       // Login usando cookies salvos
  loginComCredenciaisConfiguradas,
  configurarCredenciais,
  verificarLogin,

  // Pesquisa
  pesquisarJurisprudencia,
  pesquisarPecas,
  obterInteiroTeor,

  // Sessão completa (login + pesquisa em uma única sessão)
  sessaoCompleta,

  // Jus IA
  perguntarJusIA
};
