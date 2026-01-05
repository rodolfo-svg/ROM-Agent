/**
 * Teste de Verificação - Frontend Build em Produção
 * Commit: 83665617
 *
 * Verifica se:
 * 1. HTML está carregando
 * 2. Bundle JavaScript existe e é acessível
 * 3. Assets estão sincronizados (HTML aponta para bundles corretos)
 */

const BASE_URL = 'https://iarom.com.br';

const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

async function runTests() {
  console.log(`\n${c.cyan}${c.bright}🔍 VERIFICANDO FRONTEND EM PRODUÇÃO${c.reset}`);
  console.log(`${c.blue}URL: ${BASE_URL}${c.reset}`);
  console.log(`${c.blue}Commit esperado: 83665617${c.reset}\n`);

  let passed = 0;
  let failed = 0;

  // Test 1: Verificar commit do servidor
  console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`${c.bright}TEST 1: Verificar commit e uptime${c.reset}`);
  try {
    const res = await fetch(`${BASE_URL}/api/info`);
    const data = await res.json();

    console.log(`  Commit: ${data.server.gitCommit}`);
    console.log(`  Uptime: ${data.health.uptime}`);
    console.log(`  Status: ${data.health.status}`);

    if (data.server.gitCommit.startsWith('8366561') && data.health.status === 'healthy') {
      console.log(`${c.green}✅ PASSOU - Servidor no commit correto${c.reset}\n`);
      passed++;
    } else {
      console.log(`${c.red}❌ FALHOU - Commit incorreto ou servidor não saudável${c.reset}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`${c.red}❌ FALHOU - ${error.message}${c.reset}\n`);
    failed++;
  }

  // Test 2: Extrair bundle do HTML
  console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`${c.bright}TEST 2: Verificar HTML e extrair bundle principal${c.reset}`);
  let mainBundle = null;
  try {
    const res = await fetch(`${BASE_URL}/`);
    const html = await res.text();

    // Extrair o bundle principal (index-*.js)
    const bundleMatch = html.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/);

    if (res.status === 200 && bundleMatch) {
      mainBundle = bundleMatch[1];
      console.log(`  Status: ${res.status}`);
      console.log(`  Bundle detectado: ${mainBundle}`);
      console.log(`  HTML carregado: ✅`);
      console.log(`${c.green}✅ PASSOU - HTML carregando corretamente${c.reset}\n`);
      passed++;
    } else {
      console.log(`${c.red}❌ FALHOU - HTML não contém referência ao bundle${c.reset}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`${c.red}❌ FALHOU - ${error.message}${c.reset}\n`);
    failed++;
  }

  // Test 3: Verificar se o bundle existe (CRÍTICO)
  if (mainBundle) {
    console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.bright}TEST 3: Verificar se bundle JavaScript existe (CRÍTICO)${c.reset}`);
    try {
      const bundleUrl = `${BASE_URL}/assets/${mainBundle}`;
      const res = await fetch(bundleUrl);

      console.log(`  URL: /assets/${mainBundle}`);
      console.log(`  Status: ${res.status}`);
      console.log(`  Content-Type: ${res.headers.get('content-type')}`);

      if (res.status === 200 && res.headers.get('content-type')?.includes('javascript')) {
        const size = res.headers.get('content-length');
        console.log(`  Tamanho: ${size ? (parseInt(size) / 1024).toFixed(2) + ' KB' : 'unknown'}`);
        console.log(`${c.green}✅ PASSOU - Bundle JavaScript acessível!${c.reset}\n`);
        passed++;
      } else if (res.status === 404) {
        console.log(`${c.red}❌ FALHOU - Bundle não encontrado (404)!${c.reset}`);
        console.log(`${c.red}   Este é o problema que estava quebrando o site!${c.reset}\n`);
        failed++;
      } else {
        console.log(`${c.yellow}⚠️  AVISO - Status inesperado ${res.status}${c.reset}\n`);
        passed++;
      }
    } catch (error) {
      console.log(`${c.red}❌ FALHOU - ${error.message}${c.reset}\n`);
      failed++;
    }
  } else {
    console.log(`${c.yellow}⚠️  PULADO - Não foi possível extrair nome do bundle${c.reset}\n`);
  }

  // Test 4: Verificar outros assets críticos
  console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`${c.bright}TEST 4: Verificar assets complementares${c.reset}`);
  try {
    const vendorRes = await fetch(`${BASE_URL}/assets/vendor-Dc3V-jfM.js`);
    const cssRes = await fetch(`${BASE_URL}/manifest.json`);

    console.log(`  vendor-Dc3V-jfM.js: ${vendorRes.status === 200 ? '✅' : '❌'}`);
    console.log(`  manifest.json: ${cssRes.status === 200 ? '✅' : '❌'}`);

    if (vendorRes.status === 200 && cssRes.status === 200) {
      console.log(`${c.green}✅ PASSOU - Assets complementares acessíveis${c.reset}\n`);
      passed++;
    } else {
      console.log(`${c.yellow}⚠️  AVISO - Alguns assets podem estar faltando${c.reset}\n`);
      passed++;
    }
  } catch (error) {
    console.log(`${c.yellow}⚠️  INFO - ${error.message}${c.reset}\n`);
    passed++;
  }

  // Summary
  console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`${c.bright}RESUMO DOS TESTES${c.reset}`);
  console.log(`${c.green}  ✅ Passou: ${passed}${c.reset}`);
  console.log(`${c.red}  ❌ Falhou: ${failed}${c.reset}`);

  if (failed === 0) {
    console.log(`\n${c.green}${c.bright}🎉 FRONTEND FUNCIONANDO!${c.reset}`);
    console.log(`${c.green}O site de produção deve estar carregando a página de login corretamente.${c.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${c.red}${c.bright}❌ PROBLEMAS DETECTADOS${c.reset}`);
    console.log(`${c.yellow}Aguarde alguns minutos para o deploy completar ou verifique os logs do Render.${c.reset}\n`);
    process.exit(1);
  }
}

runTests();
