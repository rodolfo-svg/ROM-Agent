/**
 * TESTES ANTI-ROLLBACK - BETA SPEC
 * Garante que funcionalidades existentes não foram quebradas
 *
 * Testa todas as APIs críticas implementadas no BETA:
 * - KB Management
 * - Feature Flags
 * - Spell Check
 * - Paradigmas
 * - Analytics
 */

import http from 'http';

const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 5000;

// Cores para output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

class AntiRollbackTests {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.startTime = Date.now();
  }

  /**
   * Faz requisição HTTP
   */
  async request(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        method,
        timeout: TIMEOUT
      };

      const req = http.request(BASE_URL + path, options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              data: body ? JSON.parse(body) : null
            });
          } catch (error) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (data) {
        req.setHeader('Content-Type', 'application/json');
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  /**
   * Executa um teste
   */
  async test(name, testFn) {
    try {
      await testFn();
      this.passed++;
      console.log(`${GREEN}✓${RESET} ${name}`);
      return true;
    } catch (error) {
      this.failed++;
      console.log(`${RED}✗${RESET} ${name}`);
      console.log(`  ${RED}Error: ${error.message}${RESET}`);
      return false;
    }
  }

  /**
   * Asserts
   */
  assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`${message}\n  Expected: ${expected}\n  Got: ${actual}`);
    }
  }

  assertTrue(value, message = '') {
    if (!value) {
      throw new Error(message || 'Expected true');
    }
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

  /**
   * TESTES - KB Management
   */
  async testKBStatistics() {
    await this.test('KB Statistics API', async () => {
      const res = await this.request('GET', '/api/kb/statistics');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'stats');
    });
  }

  async testKBReindex() {
    await this.test('KB Reindex API', async () => {
      const res = await this.request('POST', '/api/kb/reindex');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'success');
      this.assertTrue(res.data.success, 'Reindex should succeed');
    });
  }

  /**
   * TESTES - Feature Flags
   */
  async testFeatureFlagsGet() {
    await this.test('Feature Flags GET API', async () => {
      const res = await this.request('GET', '/api/feature-flags');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'success');
      this.assertHasProperty(res.data, 'flags');
      this.assertHasProperty(res.data, 'stats');
    });
  }

  async testFeatureFlagsValidate() {
    await this.test('Feature Flags Validate API', async () => {
      const res = await this.request('GET', '/api/feature-flags/validate');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'success');
      this.assertHasProperty(res.data, 'validation');
    });
  }

  async testFeatureFlagsByCategory() {
    await this.test('Feature Flags By Category API', async () => {
      const res = await this.request('GET', '/api/feature-flags/tracing');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'success');
      this.assertHasProperty(res.data, 'flags');
    });
  }

  /**
   * TESTES - Spell Check
   */
  async testSpellCheckInfo() {
    await this.test('Spell Check Info API', async () => {
      const res = await this.request('GET', '/api/spell-check/info');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'success');
      this.assertHasProperty(res.data, 'info');
    });
  }

  async testSpellCheckBasic() {
    await this.test('Spell Check Basic API', async () => {
      const res = await this.request('POST', '/api/spell-check', {
        text: 'Este é um texto de teste.',
        language: 'pt-BR'
      });
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'success');
      this.assertHasProperty(res.data, 'result');
    });
  }

  /**
   * TESTES - Paradigmas
   */
  async testParadigmasCategories() {
    await this.test('Paradigmas Categories API', async () => {
      const res = await this.request('GET', '/api/paradigmas/categories');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'success');
      this.assertHasProperty(res.data, 'categories');
    });
  }

  async testParadigmasList() {
    await this.test('Paradigmas List API', async () => {
      const res = await this.request('GET', '/api/paradigmas');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'success');
      this.assertHasProperty(res.data, 'results');
      this.assertHasProperty(res.data, 'total');
    });
  }

  async testParadigmasStats() {
    await this.test('Paradigmas Stats API', async () => {
      const res = await this.request('GET', '/api/paradigmas/stats/general');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'success');
      this.assertHasProperty(res.data, 'stats');
    });
  }

  /**
   * TESTES - Analytics
   */
  async testAnalyticsDashboard() {
    await this.test('Analytics Dashboard API', async () => {
      const res = await this.request('GET', '/api/dashboard/analytics');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'analytics');
    });
  }

  async testAnalyticsUsage() {
    await this.test('Analytics Usage API', async () => {
      const res = await this.request('GET', '/api/dashboard/usage');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'usage');
    });
  }

  async testStatsGeneral() {
    await this.test('Stats General API', async () => {
      const res = await this.request('GET', '/api/stats');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'success');
    });
  }

  async testAnalyticsQuality() {
    await this.test('Analytics Quality API', async () => {
      const res = await this.request('GET', '/api/dashboard/quality');
      this.assertStatus(res, 200);
      this.assertHasProperty(res.data, 'quality');
    });
  }

  /**
   * Executa todos os testes
   */
  async runAll() {
    console.log('\n' + '='.repeat(60));
    console.log(`${YELLOW}TESTES ANTI-ROLLBACK - BETA SPEC${RESET}`);
    console.log('='.repeat(60) + '\n');

    console.log(`${YELLOW}[1/5] Testando KB Management APIs...${RESET}`);
    await this.testKBStatistics();
    await this.testKBReindex();

    console.log(`\n${YELLOW}[2/5] Testando Feature Flags APIs...${RESET}`);
    await this.testFeatureFlagsGet();
    await this.testFeatureFlagsValidate();
    await this.testFeatureFlagsByCategory();

    console.log(`\n${YELLOW}[3/5] Testando Spell Check APIs...${RESET}`);
    await this.testSpellCheckInfo();
    await this.testSpellCheckBasic();

    console.log(`\n${YELLOW}[4/5] Testando Paradigmas APIs...${RESET}`);
    await this.testParadigmasCategories();
    await this.testParadigmasList();
    await this.testParadigmasStats();

    console.log(`\n${YELLOW}[5/5] Testando Analytics APIs...${RESET}`);
    await this.testAnalyticsDashboard();
    await this.testAnalyticsUsage();
    await this.testAnalyticsQuality();
    await this.testStatsGeneral();

    this.printSummary();
  }

  /**
   * Imprime resumo dos testes
   */
  printSummary() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const total = this.passed + this.failed;
    const successRate = total > 0 ? ((this.passed / total) * 100).toFixed(1) : 0;

    console.log('\n' + '='.repeat(60));
    console.log(`${YELLOW}RESUMO${RESET}`);
    console.log('='.repeat(60));
    console.log(`Total de testes: ${total}`);
    console.log(`${GREEN}Passou: ${this.passed}${RESET}`);
    console.log(`${this.failed > 0 ? RED : GREEN}Falhou: ${this.failed}${RESET}`);
    console.log(`Taxa de sucesso: ${successRate}%`);
    console.log(`Duração: ${duration}s`);
    console.log('='.repeat(60) + '\n');

    if (this.failed === 0) {
      console.log(`${GREEN}✅ TODOS OS TESTES PASSARAM - NENHUM ROLLBACK DETECTADO${RESET}\n`);
      process.exit(0);
    } else {
      console.log(`${RED}❌ ${this.failed} TESTE(S) FALHARAM - POSSÍVEL ROLLBACK${RESET}\n`);
      process.exit(1);
    }
  }
}

// Executar testes
const tests = new AntiRollbackTests();

// Aguardar servidor estar pronto
console.log('Aguardando servidor estar pronto...');
setTimeout(() => {
  tests.runAll().catch(error => {
    console.error(`${RED}❌ Erro fatal nos testes:${RESET}`, error);
    process.exit(1);
  });
}, 3000);
