#!/usr/bin/env node

/**
 * ════════════════════════════════════════════════════════════════
 * ROM AGENT - SITE MONITORING CLI
 * ════════════════════════════════════════════════════════════════
 * Monitora status do site iarom.com.br em tempo real
 *
 * Uso:
 *   npm run monitor                   # Monitoramento contínuo
 *   npm run monitor:once              # Verificação única
 *   node monitor-site.js --interval 30 # Check a cada 30 segundos
 * ════════════════════════════════════════════════════════════════
 */

import https from 'https';
import http from 'http';

// Configuração
const SITE_URL = process.env.MONITOR_URL || 'https://iarom.com.br';
const DEFAULT_INTERVAL = 10; // segundos
const TIMEOUT = 15000; // 15 segundos

// Parse argumentos
const args = process.argv.slice(2);
const isOnce = args.includes('--once');
const intervalIndex = args.indexOf('--interval');
const interval = intervalIndex >= 0 ? parseInt(args[intervalIndex + 1]) : DEFAULT_INTERVAL;

// Estado
let checkCount = 0;
let errorCount = 0;
let lastStatus = null;

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

/**
 * Faz requisição HTTP com timeout
 */
function makeRequest(url, path) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url + path);
    const client = urlObj.protocol === 'https:' ? https : http;

    const startTime = Date.now();

    const req = client.get({
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'ROM-Agent-Monitor/1.0'
      }
    }, (res) => {
      let data = '';

      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const responseTime = Date.now() - startTime;

        try {
          const json = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: json,
            responseTime
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            responseTime
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Verifica saúde do servidor
 */
async function checkHealth() {
  try {
    const result = await makeRequest(SITE_URL, '/api/info');
    return {
      success: true,
      status: result.status,
      data: result.data,
      responseTime: result.responseTime
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verifica disponibilidade do KB
 */
async function checkKB() {
  try {
    const result = await makeRequest(SITE_URL, '/api/kb/documents');
    // 200 = OK, 302 = Redirect para login (API funcional), 401 = Não autenticado
    const isWorking = result.status === 200 || result.status === 302 || result.status === 401;
    return {
      success: isWorking,
      status: result.status,
      responseTime: result.responseTime,
      authenticated: result.status === 200
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Formata tempo de resposta com cores
 */
function formatResponseTime(ms) {
  if (ms < 500) return `${colors.green}${ms}ms${colors.reset}`;
  if (ms < 2000) return `${colors.yellow}${ms}ms${colors.reset}`;
  return `${colors.red}${ms}ms${colors.reset}`;
}

/**
 * Formata status com cores
 */
function formatStatus(success) {
  return success
    ? `${colors.green}✓ ONLINE${colors.reset}`
    : `${colors.red}✗ OFFLINE${colors.reset}`;
}

/**
 * Exibe resultado da verificação
 */
function displayCheck(health, kb) {
  checkCount++;

  const timestamp = new Date().toLocaleString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  console.log(`\n${colors.blue}═══════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}Check #${checkCount} - ${timestamp}${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════${colors.reset}`);

  // Status principal
  if (health.success) {
    const data = health.data;
    console.log(`\n🌐 Site:        ${formatStatus(true)} ${formatResponseTime(health.responseTime)}`);
    console.log(`📊 Uptime:      ${data.uptime || 'N/A'}`);
    console.log(`💾 Memória:     ${data.memory?.heapUsed || 'N/A'} / ${data.memory?.heapTotal || 'N/A'}`);
    console.log(`👥 Usuários:    ${data.stats?.activeUsers || 0} ativos / ${data.stats?.totalUsers || 0} total`);
    console.log(`📁 Documentos:  ${data.stats?.totalDocuments || 0}`);
    console.log(`💬 Conversas:   ${data.stats?.totalConversations || 0}`);

    if (data.version) {
      console.log(`📦 Versão:      ${data.version}`);
    }

    errorCount = 0;
  } else {
    console.log(`\n🌐 Site:        ${formatStatus(false)}`);
    console.log(`❌ Erro:        ${health.error}`);
    errorCount++;
  }

  // Status do KB
  if (kb.success) {
    const authStatus = kb.authenticated ? '' : ` ${colors.gray}(sem auth)${colors.reset}`;
    console.log(`📚 KB API:      ${formatStatus(true)} ${formatResponseTime(kb.responseTime)}${authStatus}`);
  } else {
    console.log(`📚 KB API:      ${formatStatus(false)}`);
    if (kb.error) {
      console.log(`   Erro:        ${kb.error}`);
    }
  }

  // Alertas
  if (errorCount > 0) {
    console.log(`\n${colors.red}⚠️  ALERTA: ${errorCount} erro(s) consecutivo(s)${colors.reset}`);
  }

  if (health.success && health.responseTime > 5000) {
    console.log(`\n${colors.yellow}⚠️  ALERTA: Latência alta (${health.responseTime}ms)${colors.reset}`);
  }

  lastStatus = health;
}

/**
 * Executa verificação completa
 */
async function runCheck() {
  const [health, kb] = await Promise.all([
    checkHealth(),
    checkKB()
  ]);

  displayCheck(health, kb);

  return health.success;
}

/**
 * Loop principal
 */
async function main() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║   ROM AGENT - MONITOR DE PRODUÇÃO             ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\nMonitorando: ${colors.green}${SITE_URL}${colors.reset}`);

  if (isOnce) {
    console.log(`Modo: Verificação única\n`);
    await runCheck();
    process.exit(0);
  } else {
    console.log(`Intervalo: ${interval} segundos`);
    console.log(`${colors.gray}Pressione Ctrl+C para parar${colors.reset}\n`);

    // Primeira verificação imediata
    await runCheck();

    // Loop contínuo
    setInterval(async () => {
      await runCheck();
    }, interval * 1000);
  }
}

// Tratamento de sinais
process.on('SIGINT', () => {
  console.log(`\n\n${colors.blue}═══════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}Monitor encerrado${colors.reset}`);
  console.log(`Total de verificações: ${checkCount}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════${colors.reset}\n`);
  process.exit(0);
});

// Executar
main().catch(error => {
  console.error(`${colors.red}Erro fatal:${colors.reset}`, error);
  process.exit(1);
});
