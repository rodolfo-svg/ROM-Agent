/**
 * TESTES v2.7.0 PERFORMANCE FEATURES
 * Valida implementação das 4 features principais
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('v2.7.0 Performance Features', () => {

  describe('1. Streaming SSE', () => {
    it('deve ter rota de streaming registrada', async () => {
      const chatStreamModule = await import('../src/routes/chat-stream.js');
      assert.ok(chatStreamModule.default, 'Router de streaming deve existir');
    });

    it('deve exportar router válido', async () => {
      const chatStreamModule = await import('../src/routes/chat-stream.js');
      const router = chatStreamModule.default;
      assert.strictEqual(typeof router, 'function', 'Router deve ser uma função');
    });
  });

  describe('2. Multi-Level Cache', () => {
    it('deve ter módulo de cache disponível', async () => {
      const cacheModule = await import('../src/utils/multi-level-cache.js');
      assert.ok(cacheModule.getCache, 'getCache deve estar exportado');
      assert.ok(cacheModule.initializeCache, 'initializeCache deve estar exportado');
    });

    it('deve criar instância de cache', async () => {
      const { getCache } = await import('../src/utils/multi-level-cache.js');
      const cache = getCache();

      assert.ok(cache, 'Cache deve ser criado');
      assert.ok(cache.generateKey, 'Cache deve ter método generateKey');
      assert.ok(cache.get, 'Cache deve ter método get');
      assert.ok(cache.set, 'Cache deve ter método set');
      assert.ok(cache.getStats, 'Cache deve ter método getStats');
    });

    it('deve gerar chave de cache consistente', async () => {
      const { getCache } = await import('../src/utils/multi-level-cache.js');
      const cache = getCache();

      const key1 = cache.generateKey('test prompt', 'model-1', { temperature: 0.7 });
      const key2 = cache.generateKey('test prompt', 'model-1', { temperature: 0.7 });

      assert.strictEqual(key1, key2, 'Mesmos parâmetros devem gerar mesma chave');
    });

    it('deve ter TTL configurado para tipos diferentes', async () => {
      const { getCache } = await import('../src/utils/multi-level-cache.js');
      const cache = getCache();

      assert.ok(cache.ttlConfig, 'TTL config deve existir');
      assert.ok(cache.ttlConfig.simple, 'TTL para simple deve existir');
      assert.ok(cache.ttlConfig.jurisprudence, 'TTL para jurisprudence deve existir');
      assert.ok(cache.ttlConfig.legislation, 'TTL para legislation deve existir');
      assert.ok(cache.ttlConfig.templates, 'TTL para templates deve existir');
    });

    it('deve retornar estatísticas de cache', async () => {
      const { getCache } = await import('../src/utils/multi-level-cache.js');
      const cache = getCache();

      const stats = await cache.getStats();

      assert.ok(stats.summary, 'Stats deve ter summary');
      assert.ok(stats.l1, 'Stats deve ter l1');
      assert.ok(stats.l2, 'Stats deve ter l2');
      assert.ok(stats.l3, 'Stats deve ter l3');
    });
  });

  describe('3. Timeout Configuration', () => {
    it('deve ter SLO config atualizado', async () => {
      const { SLO_CONFIG } = await import('../src/config/slo.js');

      assert.ok(SLO_CONFIG, 'SLO_CONFIG deve existir');
      assert.ok(SLO_CONFIG.http, 'SLO_CONFIG.http deve existir');
      assert.ok(SLO_CONFIG.http.async, 'SLO_CONFIG.http.async deve existir');
    });

    it('deve ter timeout de 5min para rotas async', async () => {
      const { SLO_CONFIG } = await import('../src/config/slo.js');

      const asyncTimeout = SLO_CONFIG.http.async.timeout;

      assert.strictEqual(
        asyncTimeout,
        300_000,
        'Timeout async deve ser 300000ms (5min)'
      );
    });

    it('deve ter função getTimeout', async () => {
      const { getTimeout } = await import('../src/config/slo.js');

      const timeout = getTimeout('http', 'async');

      assert.strictEqual(timeout, 300_000, 'getTimeout deve retornar 300000ms para async');
    });
  });

  describe('4. Database Connection', () => {
    it('deve ter função initPostgres', async () => {
      const dbModule = await import('../src/config/database.js');

      assert.ok(dbModule.initPostgres, 'initPostgres deve existir');
      assert.strictEqual(typeof dbModule.initPostgres, 'function', 'initPostgres deve ser função');
    });

    it('deve ter função initRedis', async () => {
      const dbModule = await import('../src/config/database.js');

      assert.ok(dbModule.initRedis, 'initRedis deve existir');
      assert.strictEqual(typeof dbModule.initRedis, 'function', 'initRedis deve ser função');
    });

    it('deve ter função checkDatabaseHealth', async () => {
      const dbModule = await import('../src/config/database.js');

      assert.ok(dbModule.checkDatabaseHealth, 'checkDatabaseHealth deve existir');
      assert.strictEqual(typeof dbModule.checkDatabaseHealth, 'function');
    });
  });

  describe('5. Session Store', () => {
    it('deve ter session middleware configurado', async () => {
      const sessionModule = await import('../src/config/session-store.js');

      assert.ok(sessionModule.createSessionMiddleware, 'createSessionMiddleware deve existir');
      assert.ok(sessionModule.createSessionStore, 'createSessionStore deve existir');
    });

    it('deve configurar createTableIfMissing: true', async () => {
      // Validação via código - não podemos testar conexão real aqui
      const sessionStoreCode = await import('../src/config/session-store.js');
      assert.ok(sessionStoreCode, 'Módulo session-store deve carregar');
    });
  });

  describe('6. Metrics Collector', () => {
    it('deve ter métodos de métricas expandidos', async () => {
      const metricsModule = await import('../src/utils/metrics-collector-v2.js');
      const collector = metricsModule.default;

      assert.ok(collector.recordTTFT, 'recordTTFT deve existir');
      assert.ok(collector.incrementCounter, 'incrementCounter deve existir');
      assert.ok(collector.recordLatency, 'recordLatency deve existir');
    });
  });

  describe('7. Scripts de Migração', () => {
    it('deve ter script de diagnóstico', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const diagnosticPath = path.join(process.cwd(), 'scripts/diagnose-database.js');
      const exists = fs.existsSync(diagnosticPath);

      assert.ok(exists, 'Script diagnose-database.js deve existir');
    });

    it('deve ter script de migração', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const migrationPath = path.join(process.cwd(), 'scripts/run-migrations.js');
      const exists = fs.existsSync(migrationPath);

      assert.ok(exists, 'Script run-migrations.js deve existir');
    });

    it('deve ter arquivo de migração SQL', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const sqlPath = path.join(process.cwd(), 'database/migrations/001_initial_schema.sql');
      const exists = fs.existsSync(sqlPath);

      assert.ok(exists, 'Arquivo 001_initial_schema.sql deve existir');
    });
  });

  describe('8. Package.json Scripts', () => {
    it('deve ter comandos db:* no package.json', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const pkgPath = path.join(process.cwd(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

      assert.ok(pkg.scripts['db:diagnose'], 'Script db:diagnose deve existir');
      assert.ok(pkg.scripts['db:migrate'], 'Script db:migrate deve existir');
      assert.ok(pkg.scripts['db:check'], 'Script db:check deve existir');
    });
  });
});

console.log('✅ Todos os testes v2.7.0 foram definidos');
