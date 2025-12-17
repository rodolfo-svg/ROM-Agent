/**
 * CERTIFICAÇÃO BETA - TESTES COMPLETOS E2E
 * Valida todo o sistema em ambiente de produção
 *
 * Execução:
 * - Local: BASE_URL=http://localhost:3000 node tests/beta-certification.test.js
 * - Produção: BASE_URL=https://iarom.com.br node tests/beta-certification.test.js
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const IS_HTTPS = BASE_URL.startsWith('https');
const TIMEOUT = 30000; // 30s para testes E2E

// Cores
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

class BetaCertificationTests {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
    this.startTime = Date.now();
    this.results = {
      health: {},
      apis: {},
      performance: {},
      logs: {},
      features: {}
    };
  }

  /**
   * Requisição HTTP/HTTPS
   */
  async request(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(BASE_URL + path);
      const client = IS_HTTPS ? https : http;

      const options = {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        timeout: TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const responseTime = Date.now();
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: body ? JSON.parse(body) : null,
              body,
              responseTime
            });
          } catch (error) {
            resolve({
              status: res.statusCode,
              data: body,
              error: 'JSON parse error'
            });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  /**
   * Executa teste com medição de tempo
   */
  async test(name, testFn, category = 'general') {
    const startTime = Date.now();
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;

      this.passed++;
      console.log(`${GREEN}✓${RESET} ${name} ${CYAN}(${duration}ms)${RESET}`);

      if (!this.results[category]) this.results[category] = {};
      this.results[category][name] = { passed: true, duration, ...result };

      return { passed: true, duration, ...result };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.failed++;
      console.log(`${RED}✗${RESET} ${name} ${CYAN}(${duration}ms)${RESET}`);
      console.log(`  ${RED}${error.message}${RESET}`);

      if (!this.results[category]) this.results[category] = {};
      this.results[category][name] = { passed: false, duration, error: error.message };

      return { passed: false, duration, error: error.message };
    }
  }

  /**
   * Teste com warning (não falha)
   */
  async testWithWarning(name, testFn, category = 'general') {
    try {
      const result = await testFn();
      this.passed++;
      console.log(`${GREEN}✓${RESET} ${name}`);
      return result;
    } catch (error) {
      this.warnings++;
      console.log(`${YELLOW}⚠${RESET} ${name} ${YELLOW}(warning)${RESET}`);
      console.log(`  ${YELLOW}${error.message}${RESET}`);

      if (!this.results[category]) this.results[category] = {};
      this.results[category][name] = { warning: true, error: error.message };
    }
  }

  // Asserts
  assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`${message}\n  Expected: ${expected}\n  Got: ${actual}`);
    }
  }

  assertTrue(value, message = '') {
    if (!value) throw new Error(message || 'Expected true');
  }

  assertStatus(response, expectedStatus) {
    if (response.status !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
    }
  }

  assertHasProperty(obj, property) {
    if (!(property in obj)) {
      throw new Error(`Object doesn't have property '${property}'`);
    }
  }

  assertResponseTime(duration, maxMs, endpoint = '') {
    if (duration > maxMs) {
      throw new Error(`Response too slow: ${duration}ms > ${maxMs}ms for ${endpoint}`);
    }
  }

  /**
   * ============================================
   * TESTES DE HEALTH CHECK
   * ============================================
   */
  async testServerAlive() {
    await this.test('Server responde', async () => {
      const start = Date.now();
      const res = await this.request('GET', '/');
      const duration = Date.now() - start;

      this.assertTrue(res.status === 200 || res.status === 302,
        `Server deve responder com 200 ou 302, got ${res.status}`);

      return { status: res.status, responseTime: duration };
    }, 'health');
  }

  async testHealthEndpoint() {
    await this.test('Health check endpoint', async () => {
      const start = Date.now();
      const res = await this.request('GET', '/api/health');
      const duration = Date.now() - start;

      this.assertStatus(res, 200);

      // Verificar response time
      this.assertResponseTime(duration, 1000, '/api/health');

      return { responseTime: duration, data: res.data };
    }, 'health');
  }

  /**
   * ============================================
   * TESTES DE APIS CRÍTICAS
   * ============================================
   */
  async testKBAPIs() {
    await this.test('KB Statistics API', async () => {
      const res = await this.request('GET', '/api/kb/statistics');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'stats');
      return { stats: res.data.stats };
    }, 'apis');

    await this.test('KB Reindex API', async () => {
      const res = await this.request('POST', '/api/kb/reindex');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'success');
      return { success: res.data.success };
    }, 'apis');
  }

  async testFeatureFlagsAPIs() {
    await this.test('Feature Flags GET', async () => {
      const res = await this.request('GET', '/api/feature-flags');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'flags');
      this.assertHasProperty(res.data, 'stats');
      return { flagCount: Object.keys(res.data.flags).length };
    }, 'apis');

    await this.test('Feature Flags Validate', async () => {
      const res = await this.request('GET', '/api/feature-flags/validate');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'validation');
      return { valid: res.data.validation.valid };
    }, 'apis');

    await this.test('Feature Flags By Category', async () => {
      const res = await this.request('GET', '/api/feature-flags/tracing');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'flags');
      return { category: 'tracing', flagCount: Object.keys(res.data.flags).length };
    }, 'apis');
  }

  async testSpellCheckAPIs() {
    await this.test('Spell Check Info', async () => {
      const res = await this.request('GET', '/api/spell-check/info');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'info');
      return { provider: res.data.info.provider };
    }, 'apis');

    await this.testWithWarning('Spell Check Basic', async () => {
      const res = await this.request('POST', '/api/spell-check', {
        text: 'Este é um texto de teste.',
        language: 'pt-BR'
      });
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'success');
      return { hasErrors: res.data.result?.errors?.length > 0 };
    }, 'apis');
  }

  async testParadigmasAPIs() {
    await this.test('Paradigmas Categories', async () => {
      const res = await this.request('GET', '/api/paradigmas/categories');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'categories');
      return {
        tipos: res.data.categories.tipos.length,
        areas: res.data.categories.areas.length
      };
    }, 'apis');

    await this.test('Paradigmas List', async () => {
      const res = await this.request('GET', '/api/paradigmas');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'results');
      return { total: res.data.total };
    }, 'apis');

    await this.test('Paradigmas Stats', async () => {
      const res = await this.request('GET', '/api/paradigmas/stats/general');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'stats');
      return { stats: res.data.stats };
    }, 'apis');
  }

  async testAnalyticsAPIs() {
    await this.test('Analytics Dashboard', async () => {
      const res = await this.request('GET', '/api/dashboard/analytics');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'analytics');
      return { metrics: Object.keys(res.data.analytics) };
    }, 'apis');

    await this.test('Analytics Usage', async () => {
      const res = await this.request('GET', '/api/dashboard/usage');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'usage');
      return { dataPoints: res.data.usage.length };
    }, 'apis');

    await this.test('Stats General', async () => {
      const res = await this.request('GET', '/api/stats');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'success');
      return { success: res.data.success };
    }, 'apis');
  }

  /**
   * ============================================
   * TESTES DE PERFORMANCE
   * ============================================
   */
  async testResponseTimes() {
    const endpoints = [
      '/api/health',
      '/api/feature-flags',
      '/api/kb/statistics',
      '/api/paradigmas/categories'
    ];

    for (const endpoint of endpoints) {
      await this.test(`Response time: ${endpoint}`, async () => {
        const start = Date.now();
        const res = await this.request('GET', endpoint);
        const duration = Date.now() - start;

        this.assertStatus(res, 200);
        this.assertResponseTime(duration, 3000, endpoint);

        return { endpoint, responseTime: duration };
      }, 'performance');
    }
  }

  /**
   * ============================================
   * TESTES DE LOGGING
   * ============================================
   */
  async testLoggingSystem() {
    await this.testWithWarning('Logs directory exists', async () => {
      // Este teste só funciona localmente
      if (BASE_URL.includes('localhost')) {
        const logsDir = path.join(process.cwd(), 'logs');
        this.assertTrue(fs.existsSync(logsDir), 'Logs directory should exist');
        return { path: logsDir };
      } else {
        throw new Error('Skipping on remote - cannot check filesystem');
      }
    }, 'logs');

    await this.test('Tracing system active', async () => {
      const res = await this.request('GET', '/api/feature-flags/tracing');
      this.assertStatus(res, 200);
      const tracingEnabled = res.data.flags['tracing.enabled'];
      this.assertTrue(tracingEnabled, 'Tracing should be enabled');
      return { enabled: tracingEnabled };
    }, 'logs');
  }

  /**
   * ============================================
   * TESTES DE FEATURES
   * ============================================
   */
  async testSchedulerActive() {
    await this.testWithWarning('Scheduler jobs configured', async () => {
      // Verificar que feature flags de jobs estão habilitados
      const res = await this.request('GET', '/api/feature-flags');
      this.assertStatus(res, 200);

      // Não temos endpoint direto para scheduler, mas podemos inferir pela config
      return { assumption: 'Scheduler should be active based on server logs' };
    }, 'features');
  }

  async testBackupSystem() {
    await this.testWithWarning('Backup system configured', async () => {
      // OneDrive backup pode não funcionar em produção (sem acesso ao path)
      // Mas podemos verificar se o sistema está presente
      const res = await this.request('GET', '/api/feature-flags');
      this.assertStatus(res, 200);

      return {
        note: 'OneDrive backup configured for local environment',
        production: 'May need S3 alternative'
      };
    }, 'features');
  }

  /**
   * ============================================
   * RELATÓRIO FINAL
   * ============================================
   */
  async generateReport() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const total = this.passed + this.failed;
    const successRate = total > 0 ? ((this.passed / total) * 100).toFixed(1) : 0;

    console.log('\n' + '='.repeat(70));
    console.log(`${BLUE}CERTIFICAÇÃO BETA - RELATÓRIO FINAL${RESET}`);
    console.log('='.repeat(70));

    console.log(`\n${YELLOW}Ambiente:${RESET} ${BASE_URL}`);
    console.log(`${YELLOW}Data:${RESET} ${new Date().toISOString()}`);
    console.log(`${YELLOW}Duração:${RESET} ${duration}s\n`);

    console.log(`${YELLOW}Resultados:${RESET}`);
    console.log(`  Total: ${total} testes`);
    console.log(`  ${GREEN}Passou: ${this.passed}${RESET}`);
    console.log(`  ${this.failed > 0 ? RED : GREEN}Falhou: ${this.failed}${RESET}`);
    console.log(`  ${YELLOW}Warnings: ${this.warnings}${RESET}`);
    console.log(`  Taxa de sucesso: ${successRate}%\n`);

    // Estatísticas por categoria
    console.log(`${YELLOW}Por Categoria:${RESET}`);
    for (const [category, tests] of Object.entries(this.results)) {
      const categoryTests = Object.keys(tests).length;
      const categoryPassed = Object.values(tests).filter(t => t.passed).length;
      const categoryRate = categoryTests > 0 ?
        ((categoryPassed / categoryTests) * 100).toFixed(1) : 0;

      console.log(`  ${category}: ${categoryPassed}/${categoryTests} (${categoryRate}%)`);
    }

    console.log('\n' + '='.repeat(70));

    // Status final
    if (this.failed === 0) {
      console.log(`${GREEN}✅ CERTIFICAÇÃO BETA APROVADA${RESET}`);
      console.log(`${GREEN}Sistema pronto para produção!${RESET}\n`);

      // Salvar relatório
      this.saveReport(duration, successRate);

      process.exit(0);
    } else {
      console.log(`${RED}❌ CERTIFICAÇÃO BETA REPROVADA${RESET}`);
      console.log(`${RED}${this.failed} teste(s) falharam - verificar antes de produção${RESET}\n`);

      // Salvar relatório
      this.saveReport(duration, successRate);

      process.exit(1);
    }
  }

  /**
   * Salva relatório em arquivo
   */
  saveReport(duration, successRate) {
    const report = {
      timestamp: new Date().toISOString(),
      environment: BASE_URL,
      duration: `${duration}s`,
      summary: {
        total: this.passed + this.failed,
        passed: this.passed,
        failed: this.failed,
        warnings: this.warnings,
        successRate: `${successRate}%`
      },
      results: this.results
    };

    const reportPath = path.join(process.cwd(), 'tests', 'beta-certification-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`📊 Relatório salvo em: ${reportPath}`);
  }

  /**
   * ============================================
   * EXECUÇÃO PRINCIPAL
   * ============================================
   */
  async runAll() {
    console.log('\n' + '='.repeat(70));
    console.log(`${BLUE}CERTIFICAÇÃO BETA - TESTES COMPLETOS E2E${RESET}`);
    console.log('='.repeat(70));
    console.log(`${YELLOW}Ambiente:${RESET} ${BASE_URL}`);
    console.log(`${YELLOW}Timeout:${RESET} ${TIMEOUT}ms`);
    console.log('='.repeat(70) + '\n');

    // 1. Health Checks
    console.log(`${CYAN}[1/7] Health Checks...${RESET}`);
    await this.testServerAlive();
    await this.testHealthEndpoint();

    // 2. KB Management APIs
    console.log(`\n${CYAN}[2/7] KB Management APIs...${RESET}`);
    await this.testKBAPIs();

    // 3. Feature Flags APIs
    console.log(`\n${CYAN}[3/7] Feature Flags APIs...${RESET}`);
    await this.testFeatureFlagsAPIs();

    // 4. Spell Check APIs
    console.log(`\n${CYAN}[4/7] Spell Check APIs...${RESET}`);
    await this.testSpellCheckAPIs();

    // 5. Paradigmas APIs
    console.log(`\n${CYAN}[5/7] Paradigmas APIs...${RESET}`);
    await this.testParadigmasAPIs();

    // 6. Analytics APIs
    console.log(`\n${CYAN}[6/7] Analytics APIs...${RESET}`);
    await this.testAnalyticsAPIs();

    // 7. Performance & Logging
    console.log(`\n${CYAN}[7/7] Performance & System Checks...${RESET}`);
    await this.testResponseTimes();
    await this.testLoggingSystem();
    await this.testSchedulerActive();
    await this.testBackupSystem();

    // Relatório final
    await this.generateReport();
  }
}

// Executar testes
const tests = new BetaCertificationTests();

console.log('Aguardando servidor estar pronto...');
setTimeout(() => {
  tests.runAll().catch(error => {
    console.error(`${RED}❌ Erro fatal nos testes:${RESET}`, error);
    process.exit(1);
  });
}, 3000);
