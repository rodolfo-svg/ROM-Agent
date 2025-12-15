#!/usr/bin/env node
/**
 * TESTE DO SITE DE PRODUÇÃO - iarom.com.br
 * SEMPRE testa o site REAL, não localhost
 * Inclui testes específicos para MOBILE
 */

import fetch from 'node-fetch';

// SEMPRE testar produção, NUNCA localhost
const PRODUCTION_URL = 'https://iarom.com.br';
const BASE_URL = process.env.TEST_URL || PRODUCTION_URL;

const ERRORS = [];
const WARNINGS = [];
const SUCCESS = [];
const MOBILE_ISSUES = [];

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(type, message, details = '') {
  const timestamp = new Date().toISOString();
  const prefix = {
    error: `${colors.red}❌ ERRO${colors.reset}`,
    warn: `${colors.yellow}⚠️  AVISO${colors.reset}`,
    success: `${colors.green}✅ OK${colors.reset}`,
    info: `${colors.blue}ℹ️  INFO${colors.reset}`,
    test: `${colors.magenta}🧪 TESTE${colors.reset}`,
    mobile: `${colors.cyan}📱 MOBILE${colors.reset}`
  }[type] || '';

  console.log(`[${timestamp}] ${prefix} ${message}`);
  if (details) console.log(`   → ${details}`);

  if (type === 'error') ERRORS.push({ message, details });
  if (type === 'warn') WARNINGS.push({ message, details });
  if (type === 'success') SUCCESS.push({ message, details });
  if (type === 'mobile') MOBILE_ISSUES.push({ message, details });
}

/**
 * User Agents para simular dispositivos mobile
 */
const USER_AGENTS = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
};

/**
 * Teste 1: Site está no ar?
 */
async function testSiteOnline() {
  log('test', `Testando site de PRODUÇÃO: ${BASE_URL}`);

  try {
    const response = await fetch(`${BASE_URL}/api/info`, {
      timeout: 10000,
      headers: { 'User-Agent': USER_AGENTS.desktop }
    });

    if (response.ok) {
      const data = await response.json();
      log('success', 'Site de PRODUÇÃO está no ar', `Versão: ${data.version || 'N/A'}`);

      // Verificar versão
      if (data.version) {
        const version = data.version;
        if (version.startsWith('2.0')) {
          log('error', 'VERSÃO ANTIGA DETECTADA!', `Site em v${version} - Deveria ser v2.4+`);
        } else {
          log('success', 'Versão correta', `v${version}`);
        }
      }

      // Verificar AWS
      if (data.aws && data.aws.configured) {
        log('success', 'AWS Bedrock configurado em PRODUÇÃO');
      } else {
        log('error', 'AWS Bedrock NÃO configurado', 'IA não vai funcionar!');
      }

      return data;
    } else {
      log('error', 'Site retornou erro', `Status: ${response.status}`);
      return null;
    }
  } catch (error) {
    log('error', 'Site NÃO está acessível', error.message);
    return null;
  }
}

/**
 * Teste 2: Páginas HTML carregam em MOBILE?
 */
async function testMobilePages() {
  log('mobile', 'Testando páginas MOBILE de PRODUÇÃO...');

  const mobilePages = [
    { path: '/', name: 'Home (Mobile)' },
    { path: '/mobile-timbrado.html', name: 'Timbrado Mobile' },
    { path: '/tarifa.html', name: 'Calculadora Mobile' },
    { path: '/login.html', name: 'Login Mobile' },
    { path: '/index.html', name: 'Chat Mobile' }
  ];

  for (const page of mobilePages) {
    try {
      // Testar com iPhone
      const responseIphone = await fetch(`${BASE_URL}${page.path}`, {
        headers: { 'User-Agent': USER_AGENTS.iphone },
        timeout: 10000
      });

      // Testar com Android
      const responseAndroid = await fetch(`${BASE_URL}${page.path}`, {
        headers: { 'User-Agent': USER_AGENTS.android },
        timeout: 10000
      });

      if (responseIphone.ok && responseAndroid.ok) {
        const html = await responseIphone.text();

        // Verificar meta viewport (essencial para mobile)
        if (!html.includes('viewport')) {
          log('error', `${page.name} SEM meta viewport`, 'Não vai funcionar bem em mobile!');
        } else {
          log('success', `${page.name} com viewport correto`);
        }

        // Verificar se tem JavaScript
        if (html.includes('fetch(') || html.includes('addEventListener')) {
          log('success', `${page.name} tem JavaScript ativo`);
        } else {
          log('warn', `${page.name} pode não ter JavaScript`, 'Botões podem não funcionar');
        }

        // Verificar tamanho (mobile deve ser otimizado)
        const sizeKB = html.length / 1024;
        if (sizeKB > 500) {
          log('warn', `${page.name} muito grande para mobile`, `${sizeKB.toFixed(1)} KB`);
        } else {
          log('success', `${page.name} tamanho OK para mobile`, `${sizeKB.toFixed(1)} KB`);
        }

      } else {
        log('error', `${page.name} não carrega em mobile`,
          `iPhone: ${responseIphone.status}, Android: ${responseAndroid.status}`);
      }
    } catch (error) {
      log('error', `${page.name} erro ao testar mobile`, error.message);
    }
  }
}

/**
 * Teste 3: APIs funcionam em PRODUÇÃO?
 */
async function testProductionAPIs() {
  log('test', 'Testando APIs de PRODUÇÃO...');

  const criticalAPIs = [
    { method: 'GET', path: '/api/info', name: 'System Info' },
    { method: 'GET', path: '/api/projects', name: 'Projetos ROM' },
    { method: 'GET', path: '/api/partners', name: 'Parceiros' },
    { method: 'GET', path: '/api/pricing/table', name: 'Tabela de Preços' },
    { method: 'GET', path: '/api/team/members', name: 'Equipe ROM' }
  ];

  for (const api of criticalAPIs) {
    try {
      const response = await fetch(`${BASE_URL}${api.path}`, {
        method: api.method,
        headers: { 'User-Agent': USER_AGENTS.desktop },
        timeout: 10000
      });

      if (response.ok) {
        log('success', `${api.name} funcionando em PRODUÇÃO`);
      } else if (response.status === 404) {
        log('error', `${api.name} NÃO EXISTE em produção (404)`, 'Feature não deployada');
      } else if (response.status === 500) {
        log('error', `${api.name} com erro interno (500)`, 'Verificar logs do servidor');
      } else {
        log('warn', `${api.name} retornou ${response.status}`);
      }
    } catch (error) {
      log('error', `${api.name} não responde`, error.message);
    }
  }
}

/**
 * Teste 4: Chat funciona em MOBILE?
 */
async function testMobileChat() {
  log('mobile', 'Testando CHAT em dispositivo MOBILE...');

  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENTS.iphone
      },
      body: JSON.stringify({
        message: 'Teste mobile',
        model: 'haiku'
      }),
      timeout: 15000
    });

    if (response.ok) {
      log('success', 'Chat funcionando em MOBILE (iPhone)');
    } else if (response.status === 500) {
      log('error', 'Chat com erro 500 em mobile', 'AWS Bedrock não configurado?');
    } else if (response.status === 401) {
      log('warn', 'Chat requer autenticação em mobile');
    } else {
      log('error', `Chat falhou em mobile: ${response.status}`);
    }
  } catch (error) {
    log('error', 'Chat não responde em mobile', error.message);
  }
}

/**
 * Teste 5: Upload funciona em MOBILE?
 */
async function testMobileUpload() {
  log('mobile', 'Testando UPLOAD em dispositivo MOBILE...');

  try {
    // Testar inicialização de upload chunked
    const response = await fetch(`${BASE_URL}/api/upload/chunked/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENTS.android
      },
      body: JSON.stringify({
        filename: 'teste-mobile.pdf',
        fileSize: 5000000,
        contentType: 'application/pdf'
      }),
      timeout: 10000
    });

    if (response.ok) {
      log('success', 'Upload chunked funcionando em MOBILE');
    } else {
      log('error', `Upload falhou em mobile: ${response.status}`);
    }
  } catch (error) {
    log('warn', 'Upload não testável em mobile', error.message);
  }
}

/**
 * Teste 6: Recursos Mobile-Specific
 */
async function testMobileFeatures() {
  log('mobile', 'Verificando recursos mobile-specific em PRODUÇÃO...');

  const pages = ['/', '/mobile-timbrado.html', '/tarifa.html'];

  for (const page of pages) {
    try {
      const response = await fetch(`${BASE_URL}${page}`, {
        headers: { 'User-Agent': USER_AGENTS.iphone },
        timeout: 10000
      });

      if (response.ok) {
        const html = await response.text();

        // Recursos essenciais para mobile
        const mobileChecks = {
          'viewport': html.includes('viewport'),
          'touch-action': html.includes('touch-action') || html.includes('touchstart'),
          'apple-mobile-web-app': html.includes('apple-mobile-web-app'),
          '-webkit-overflow-scrolling': html.includes('-webkit-overflow-scrolling'),
          'safe-area-inset': html.includes('safe-area-inset')
        };

        let missingFeatures = [];
        for (const [feature, present] of Object.entries(mobileChecks)) {
          if (!present) {
            missingFeatures.push(feature);
          }
        }

        if (missingFeatures.length === 0) {
          log('success', `${page} totalmente otimizado para mobile`);
        } else {
          log('warn', `${page} faltam recursos mobile`, missingFeatures.join(', '));
        }
      }
    } catch (error) {
      log('warn', `Não foi possível verificar ${page}`, error.message);
    }
  }
}

/**
 * Teste 7: Performance Mobile
 */
async function testMobilePerformance() {
  log('mobile', 'Testando PERFORMANCE em MOBILE...');

  const start = Date.now();

  try {
    const response = await fetch(`${BASE_URL}/`, {
      headers: { 'User-Agent': USER_AGENTS.iphone },
      timeout: 30000
    });

    const loadTime = Date.now() - start;
    const html = await response.text();
    const sizeKB = html.length / 1024;

    if (loadTime < 3000) {
      log('success', `Página carrega RÁPIDO em mobile`, `${loadTime}ms`);
    } else if (loadTime < 5000) {
      log('warn', `Página um pouco lenta em mobile`, `${loadTime}ms`);
    } else {
      log('error', `Página MUITO LENTA em mobile`, `${loadTime}ms - Otimizar!`);
    }

    if (sizeKB < 200) {
      log('success', `Tamanho otimizado para mobile`, `${sizeKB.toFixed(1)} KB`);
    } else {
      log('warn', `Página grande para mobile`, `${sizeKB.toFixed(1)} KB - Considerar lazy load`);
    }
  } catch (error) {
    log('error', 'Erro ao testar performance mobile', error.message);
  }
}

/**
 * RELATÓRIO FINAL
 */
function printProductionReport() {
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.blue}📊 RELATÓRIO DE PRODUÇÃO - ${BASE_URL}${colors.reset}`);
  console.log('='.repeat(80));

  console.log(`\n${colors.green}✅ SUCESSOS: ${SUCCESS.length}${colors.reset}`);
  SUCCESS.slice(0, 10).forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.message}${s.details ? ` → ${s.details}` : ''}`);
  });
  if (SUCCESS.length > 10) {
    console.log(`  ... e mais ${SUCCESS.length - 10} sucessos`);
  }

  if (WARNINGS.length > 0) {
    console.log(`\n${colors.yellow}⚠️  AVISOS: ${WARNINGS.length}${colors.reset}`);
    WARNINGS.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.message}${w.details ? ` → ${w.details}` : ''}`);
    });
  }

  if (ERRORS.length > 0) {
    console.log(`\n${colors.red}❌ ERROS CRÍTICOS: ${ERRORS.length}${colors.reset}`);
    ERRORS.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.message}${e.details ? ` → ${e.details}` : ''}`);
    });
  }

  if (MOBILE_ISSUES.length > 0) {
    console.log(`\n${colors.cyan}📱 PROBLEMAS MOBILE: ${MOBILE_ISSUES.length}${colors.reset}`);
    MOBILE_ISSUES.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.message}${m.details ? ` → ${m.details}` : ''}`);
    });
  }

  console.log('\n' + '='.repeat(80));

  // Status final
  if (ERRORS.length === 0 && WARNINGS.length <= 2) {
    console.log(`${colors.green}🎉 SITE DE PRODUÇÃO 100% FUNCIONAL!${colors.reset}`);
    console.log(`${colors.green}📱 MOBILE TOTALMENTE OPERACIONAL!${colors.reset}`);
  } else if (ERRORS.length === 0) {
    console.log(`${colors.yellow}⚠️  Site funcional com avisos menores${colors.reset}`);
  } else {
    console.log(`${colors.red}🚨 SITE COM PROBLEMAS CRÍTICOS EM PRODUÇÃO!${colors.reset}`);
  }

  console.log('='.repeat(80) + '\n');

  return ERRORS.length === 0 ? 0 : 1;
}

/**
 * EXECUTAR TODOS OS TESTES
 */
async function runProductionTests() {
  console.log(`${colors.magenta}🌐 TESTANDO SITE DE PRODUÇÃO REAL${colors.reset}\n`);
  console.log(`URL: ${BASE_URL}`);
  console.log(`Dispositivos: Desktop, iPhone, Android, iPad\n`);

  const siteData = await testSiteOnline();

  if (!siteData) {
    console.log(`\n${colors.red}🚨 SITE NÃO ESTÁ ACESSÍVEL!${colors.reset}\n`);
    return 1;
  }

  await testProductionAPIs();
  await testMobilePages();
  await testMobileChat();
  await testMobileUpload();
  await testMobileFeatures();
  await testMobilePerformance();

  return printProductionReport();
}

// Executar
runProductionTests()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    console.error(`${colors.red}❌ ERRO FATAL:${colors.reset}`, error);
    process.exit(1);
  });
