/**
 * ROM Agent V3 Pipeline - Production Test
 * Testa pipeline em PRODUÇÃO (iarom.com.br)
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

async function testProduction() {
  console.log(`\n${c.cyan}══════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bright}  🚀 TESTANDO PRODUÇÃO - ROM AGENT V3 PIPELINE${c.reset}`);
  console.log(`${c.blue}  URL: ${BASE_URL}${c.reset}`);
  console.log(`${c.cyan}══════════════════════════════════════════════════════${c.reset}\n`);

  // Verificar commit atual
  try {
    const infoRes = await fetch(`${BASE_URL}/api/info`);
    const info = await infoRes.json();

    console.log(`${c.blue}Status do Servidor:${c.reset}`);
    console.log(`  Commit: ${info.server.gitCommit}`);
    console.log(`  Uptime: ${info.health.uptime}`);
    console.log(`  Status: ${info.health.status}\n`);

    if (!info.server.gitCommit.startsWith('7a7a2cb8') && !info.server.gitCommit.startsWith('68062c5f')) {
      console.log(`${c.yellow}⚠️  Pipeline ainda não deployado em produção${c.reset}`);
      console.log(`   Commit atual: ${info.server.gitCommit}`);
      console.log(`   Esperado: 7a7a2cb8 ou 68062c5f\n`);
      console.log(`${c.blue}Aguarde o deploy ou force manualmente no Render Dashboard${c.reset}\n`);
      return;
    }
  } catch (error) {
    console.log(`${c.red}❌ Erro ao conectar: ${error.message}${c.reset}\n`);
    return;
  }

  // Testar pipeline
  console.log(`${c.green}✅ Commit correto detectado! Testando pipeline...\n${c.reset}`);

  try {
    const statusRes = await fetch(`${BASE_URL}/api/pipeline/status`);
    const status = await statusRes.json();

    if (status.success) {
      console.log(`${c.green}✅ Pipeline disponível em PRODUÇÃO!${c.reset}`);
      console.log(`   Versão: ${status.version}`);
      console.log(`   Estágios: ${status.stages.join(', ')}\n`);

      // Teste rápido de configuração
      const configRes = await fetch(`${BASE_URL}/api/pipeline/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priority: 'high',
          volume: 'medium',
          quality: 'high',
          speed: 'normal'
        })
      });

      const config = await configRes.json();

      if (config.success) {
        console.log(`${c.green}✅ Configuração funcionando${c.reset}`);
        console.log(`   Modelos: ${Object.values(config.modelSelection).filter(Boolean).join(', ')}\n`);

        console.log(`${c.green}${c.bright}🎉 PIPELINE V3 OPERACIONAL EM PRODUÇÃO!${c.reset}\n`);
      }
    }
  } catch (error) {
    console.log(`${c.red}❌ Pipeline não disponível: ${error.message}${c.reset}\n`);
  }
}

testProduction();
