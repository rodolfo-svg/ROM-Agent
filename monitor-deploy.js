/**
 * Monitor de Deploy em Produção
 * Verifica a cada 30s se o novo commit foi deployado
 */

const BASE_URL = 'https://iarom.com.br';
const EXPECTED_COMMITS = ['71095689', '4df84534', '935638fc', '6a9862c1'];
const MAX_CHECKS = 12; // 6 minutos total
const INTERVAL = 30000; // 30 segundos

const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

let checks = 0;

async function checkDeploy() {
  checks++;
  console.log(`${c.cyan}${'━'.repeat(60)}${c.reset}`);
  console.log(`${c.blue}Verificação ${checks}/${MAX_CHECKS} - ${new Date().toLocaleTimeString('pt-BR')}${c.reset}`);
  console.log(`${c.cyan}${'━'.repeat(60)}${c.reset}`);

  try {
    const response = await fetch(`${BASE_URL}/api/info`);
    const data = await response.json();

    const commit = data.server.gitCommit;
    const uptime = data.health.uptime;

    console.log(`Commit atual: ${commit}`);
    console.log(`Uptime: ${uptime}`);

    // Verifica se é um dos commits esperados
    const isDeployed = EXPECTED_COMMITS.some(expected => commit.startsWith(expected));

    if (isDeployed) {
      console.log(`\n${c.green}${c.bright}✅ DEPLOY DETECTADO! Novo commit em produção!${c.reset}\n`);

      // Executa testes
      const { spawn } = require('child_process');
      const test = spawn('node', ['test-pipeline-production.js']);

      test.stdout.on('data', (data) => process.stdout.write(data.toString()));
      test.stderr.on('data', (data) => process.stderr.write(data.toString()));

      test.on('close', (code) => {
        process.exit(code);
      });

      return;
    }

    if (checks >= MAX_CHECKS) {
      console.log(`\n${c.yellow}⚠️  Deploy não iniciou após ${MAX_CHECKS * 30} segundos.${c.reset}`);
      console.log(`${c.blue}Recomendação: Acesse o Render Dashboard e force o deploy manualmente.${c.reset}\n`);
      process.exit(1);
    }

    console.log(`${c.yellow}Aguardando 30 segundos...${c.reset}\n`);
    setTimeout(checkDeploy, INTERVAL);

  } catch (error) {
    console.log(`${c.red}❌ Erro ao conectar: ${error.message}${c.reset}`);

    if (checks >= MAX_CHECKS) {
      process.exit(1);
    }

    console.log(`${c.yellow}Tentando novamente em 30 segundos...${c.reset}\n`);
    setTimeout(checkDeploy, INTERVAL);
  }
}

console.log(`\n${c.cyan}${c.bright}🔍 MONITORANDO DEPLOY EM PRODUÇÃO${c.reset}`);
console.log(`${c.blue}URL: ${BASE_URL}${c.reset}`);
console.log(`${c.blue}Commits esperados: ${EXPECTED_COMMITS.join(', ')}${c.reset}\n`);

checkDeploy();
