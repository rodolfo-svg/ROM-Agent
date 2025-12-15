const https = require('https');

const BASE_URL = 'https://iarom.com.br';
const TIMEOUT = 30000;

let results = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: TIMEOUT
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: jsonData, rawData: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, rawData: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function logTest(name, passed, details = '') {
  results.total++;
  if (passed) {
    results.passed++;
    console.log(`✅ ${name}`);
  } else {
    results.failed++;
    console.log(`❌ ${name} - ${details}`);
  }
  results.tests.push({ name, passed, details });
}

async function testProduction() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  TESTE DE PRODUÇÃO - iarom.com.br                        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // 1. Health Check
  console.log('\n📋 Categoria: Sistema e Health Check\n');
  try {
    const infoRes = await makeRequest(`${BASE_URL}/api/info`);
    logTest('Health Check (/api/info)', infoRes.status === 200 && infoRes.data.health.status === 'healthy');

    const statsRes = await makeRequest(`${BASE_URL}/api/stats`);
    logTest('Estatísticas do Sistema', statsRes.status === 200 && statsRes.data.success === true);
  } catch (err) {
    logTest('Health Check', false, err.message);
  }

  // 2. Frontend
  console.log('\n📋 Categoria: Frontend\n');
  try {
    const htmlRes = await makeRequest(BASE_URL);
    const hasViewport = htmlRes.rawData && htmlRes.rawData.includes('viewport');
    const hasNovoProjetoBotao = htmlRes.rawData && htmlRes.rawData.includes('Novo Projeto');
    const hasModal = htmlRes.rawData && htmlRes.rawData.includes('newProjectModal');
    const hasCustomInstructions = htmlRes.rawData && htmlRes.rawData.includes('projectInstructions');
    const hasKBSize = htmlRes.rawData && htmlRes.rawData.includes('projectKBSize');

    logTest('Página Principal HTML', htmlRes.status === 200);
    logTest('Meta Viewport Mobile', hasViewport);
    logTest('Botão "Novo Projeto"', hasNovoProjetoBotao);
    logTest('Modal de Novo Projeto', hasModal);
    logTest('Campo Custom Instructions', hasCustomInstructions);
    logTest('Seletor de Tamanho de KB', hasKBSize);
  } catch (err) {
    logTest('Frontend', false, err.message);
  }

  // 3. Projetos
  console.log('\n📋 Categoria: Sistema de Projetos\n');
  try {
    const listRes = await makeRequest(`${BASE_URL}/api/projects/list`);
    logTest('Listar Projetos', listRes.status === 200 && Array.isArray(listRes.data));
  } catch (err) {
    logTest('Listar Projetos', false, err.message);
  }

  // 4. KB Status
  console.log('\n📋 Categoria: Knowledge Base\n');
  try {
    const kbRes = await makeRequest(`${BASE_URL}/api/kb/status`);
    logTest('Status do KB', kbRes.status === 200 && kbRes.data.success === true);
  } catch (err) {
    logTest('KB Status', false, err.message);
  }

  // 5. Export Endpoints
  console.log('\n📋 Categoria: Export e Conversação\n');
  try {
    const conversationsRes = await makeRequest(`${BASE_URL}/api/conversations/list`);
    logTest('Listar Conversas para Export', conversationsRes.status === 200);
  } catch (err) {
    logTest('Conversas', false, err.message);
  }

  // 6. Ferramentas Avançadas
  console.log('\n📋 Categoria: Ferramentas Avançadas\n');
  try {
    const templatesRes = await makeRequest(`${BASE_URL}/api/templates/list`);
    logTest('Listar Templates', templatesRes.status === 200);

    const backupRes = await makeRequest(`${BASE_URL}/api/backup/status`);
    logTest('Status de Backups', backupRes.status === 200);

    const cacheRes = await makeRequest(`${BASE_URL}/api/cache/statistics`);
    logTest('Estatísticas de Cache', cacheRes.status === 200);
  } catch (err) {
    logTest('Ferramentas', false, err.message);
  }

  // 7. Bedrock Connection
  console.log('\n📋 Categoria: AWS Bedrock\n');
  try {
    const infoRes = await makeRequest(`${BASE_URL}/api/info`);
    const bedrockConnected = infoRes.data && infoRes.data.bedrock && infoRes.data.bedrock.status === 'connected';
    const region = infoRes.data && infoRes.data.bedrock && infoRes.data.bedrock.region;
    logTest('Bedrock Conectado (us-east-1)', bedrockConnected && region === 'us-east-1');
  } catch (err) {
    logTest('Bedrock', false, err.message);
  }

  // 8. Mobile Optimization
  console.log('\n📋 Categoria: Mobile Optimization\n');
  try {
    const htmlRes = await makeRequest(BASE_URL);
    const hasAppleMobile = htmlRes.rawData && htmlRes.rawData.includes('apple-mobile-web-app');
    const hasSafeArea = htmlRes.rawData && htmlRes.rawData.includes('safe-area-inset');
    const hasTouchOptimization = htmlRes.rawData && htmlRes.rawData.includes('touch-action');

    logTest('Suporte iOS (Apple)', hasAppleMobile);
    logTest('Safe Area (Notch)', hasSafeArea);
    logTest('Touch Optimization', hasTouchOptimization);
  } catch (err) {
    logTest('Mobile', false, err.message);
  }

  // Resumo Final
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  RESULTADO DOS TESTES DE PRODUÇÃO                        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const successRate = ((results.passed / results.total) * 100).toFixed(1);

  console.log(`Total de Testes:     ${results.total}`);
  console.log(`✅ Passaram:         ${results.passed} (${successRate}%)`);
  console.log(`❌ Falharam:         ${results.failed} (${((results.failed / results.total) * 100).toFixed(1)}%)`);
  console.log(`⚠️  Avisos:           ${results.warnings}`);

  if (successRate >= 95) {
    console.log('\n✅ PRODUÇÃO VERIFICADA - SISTEMA OPERACIONAL!\n');
  } else if (successRate >= 80) {
    console.log('\n⚠️ PRODUÇÃO COM AVISOS - VERIFICAR FALHAS\n');
  } else {
    console.log('\n❌ PRODUÇÃO COM PROBLEMAS - INTERVENÇÃO NECESSÁRIA\n');
  }

  // Detalhes do deploy
  try {
    const infoRes = await makeRequest(`${BASE_URL}/api/info`);
    console.log('\n📊 DETALHES DO AMBIENTE DE PRODUÇÃO:\n');
    console.log(`Versão: ${infoRes.data.versao}`);
    console.log(`Health: ${infoRes.data.health.status}`);
    console.log(`Uptime: ${infoRes.data.health.uptime}`);
    console.log(`Bedrock: ${infoRes.data.bedrock.status} (${infoRes.data.bedrock.region})`);
    console.log(`Sessões ativas: ${infoRes.data.cache.activeSessions}`);
    console.log(`Platform: ${infoRes.data.server.platform}`);
    console.log(`Node.js: ${infoRes.data.server.nodeVersion}`);
  } catch (err) {
    console.log('\n⚠️ Não foi possível obter detalhes do ambiente');
  }

  console.log('\n');
}

testProduction().catch(console.error);
