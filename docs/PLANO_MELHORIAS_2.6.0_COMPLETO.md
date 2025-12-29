# PLANO COMPLETO DE MELHORIAS - ROM AGENT v2.6.0

**Versão:** 2.6.0 → 2.7.0 (Estabilidade e Performance)
**Data:** 2025-12-28
**Responsável Técnico:** Claude Code
**Aprovação Necessária:** Dr. Rodolfo Otávio Mota, OAB/GO 21.841
**Status:** 🔴 AGUARDANDO APROVAÇÃO

---

## 🎯 OBJETIVO

Consolidar e **melhorar profundamente** a versão 2.6.0 ANTES de expandir para multi-tenant.

**Foco:**
- ✅ Estabilidade absoluta
- ✅ Performance comparável ao Claude.ai
- ✅ Redução de custo (39%)
- ✅ Experiência de usuário premium
- ✅ Fundação sólida para futuro

**NÃO incluído (fica para depois):**
- ❌ Multi-tenant / Multi-escritórios
- ❌ Expansão de capacidade além de 6 usuários
- ❌ Novos recursos/features

---

## 📊 RESUMO EXECUTIVO

### Status Atual (v2.6.0)
- ✅ PostgreSQL + Redis configurados
- ✅ Session-based auth funcionando
- ✅ Sistema de jurisprudência universal
- ✅ 6 usuários simultâneos suportados
- ⚠️ Primeira palavra em 5-10s (lento)
- ⚠️ Custo $144.50/mês (otimizável)
- ⚠️ Sem guardrails robusto
- ⚠️ Observabilidade limitada

### Meta (v2.7.0)
- 🎯 Primeira palavra em 0.5-1s (streaming)
- 🎯 Custo $88/mês (39% redução)
- 🎯 Zero crashes em 30 dias
- 🎯 Latência P95 <10s
- 🎯 Observabilidade completa
- 🎯 Rate limits e circuit breakers

---

## 📋 PLANO DIVIDIDO EM 3 FASES

### **FASE 1: PERFORMANCE CRÍTICA** (2-3 dias) - PRIORIDADE MÁXIMA
**Objetivo:** Igualar Claude.ai em velocidade percebida

#### 1.1 Streaming Real-Time ⚡⚡⚡⚡⚡
**Impacto:** ALTÍSSIMO
**Esforço:** 2-3h
**ROI:** MÁXIMO

**Problema Atual:**
```
Usuário espera 5-10 segundos até ver primeira palavra
→ Percepção de lentidão
→ Experiência inferior ao Claude.ai
```

**Solução:**
```javascript
// src/modules/bedrock-streaming.js (NOVO)

import { BedrockRuntimeClient, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';

export async function* conversarStream(mensagem, opcoes = {}) {
  const {
    modelo = 'anthropic.claude-sonnet-4-5-20250929-v1:0',
    systemPrompt = null,
    historico = [],
    maxTokens = 8192,
    temperature = 0.7
  } = opcoes;

  const client = new BedrockRuntimeClient({ region: 'us-east-1' });

  const messages = [
    ...historico.map(h => ({
      role: h.role,
      content: [{ text: h.content }]
    })),
    {
      role: 'user',
      content: [{ text: mensagem }]
    }
  ];

  const command = new ConverseStreamCommand({
    modelId: modelo,
    messages,
    system: systemPrompt ? [{ text: systemPrompt }] : undefined,
    inferenceConfig: {
      maxTokens,
      temperature
    }
  });

  const response = await client.send(command);

  let fullText = '';

  for await (const event of response.stream) {
    if (event.contentBlockDelta?.delta?.text) {
      const chunk = event.contentBlockDelta.delta.text;
      fullText += chunk;

      yield {
        type: 'chunk',
        content: chunk,
        fullText: fullText
      };
    }

    if (event.messageStop) {
      yield {
        type: 'complete',
        fullText: fullText,
        stopReason: event.messageStop.stopReason
      };
    }

    if (event.metadata) {
      yield {
        type: 'metadata',
        usage: event.metadata.usage
      };
    }
  }
}
```

**Integração no Backend:**
```javascript
// src/routes/chat.js

import { conversarStream } from '../modules/bedrock-streaming.js';

router.post('/api/chat/stream', async (req, res) => {
  // SSE (Server-Sent Events)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { message, mode } = req.body;

  try {
    for await (const event of conversarStream(message, { mode })) {
      if (event.type === 'chunk') {
        // Enviar chunk imediatamente
        res.write(`data: ${JSON.stringify({
          type: 'token',
          content: event.content
        })}\n\n`);
      }

      if (event.type === 'complete') {
        res.write(`data: ${JSON.stringify({
          type: 'done',
          fullText: event.fullText
        })}\n\n`);
        res.end();
      }
    }
  } catch (error) {
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message
    })}\n\n`);
    res.end();
  }
});
```

**Frontend:**
```javascript
// public/js/chat-streaming.js (NOVO)

async function sendMessageWithStreaming(message) {
  const responseContainer = document.getElementById('response');
  responseContainer.innerHTML = '';

  const eventSource = new EventSource('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, mode: 'juridico' })
  });

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'token') {
      // Append token IMEDIATAMENTE
      responseContainer.innerHTML += data.content;

      // Auto-scroll
      responseContainer.scrollTop = responseContainer.scrollHeight;
    }

    if (data.type === 'done') {
      eventSource.close();
      console.log('Streaming completo!');
    }

    if (data.type === 'error') {
      eventSource.close();
      console.error('Erro:', data.error);
    }
  };
}
```

**Ganho:**
- Primeira palavra: 5-10s → **0.5-1s** ✅
- Percepção de velocidade: **5-8x mais rápido**
- Experiência equivalente ao Claude.ai ✅

---

#### 1.2 Cache Inteligente Multi-Nível ⚡⚡⚡⚡⚡
**Impacto:** ALTÍSSIMO
**Esforço:** 3-4h
**ROI:** MÁXIMO

**Problema Atual:**
```
Consultas repetidas fazem request completo ao Bedrock
→ Latência desnecessária
→ Custo desnecessário
→ Experiência ruim
```

**Solução - 3 Níveis de Cache:**

```javascript
// src/utils/cache-manager.js (NOVO)

import crypto from 'crypto';
import { LRUCache } from 'lru-cache';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

class CacheManager {
  constructor() {
    // L1: Memória (LRU) - Ultra rápido
    this.memoryCache = new LRUCache({
      max: 100,              // 100 entradas
      ttl: 1000 * 60 * 5,    // 5 minutos
      updateAgeOnGet: true
    });

    // L2: SQLite (Disco) - Persistente
    this.diskCache = null;
    this.initDiskCache();

    // L3: Similaridade (Embeddings) - Inteligente
    this.similarityThreshold = 0.85;
  }

  async initDiskCache() {
    this.diskCache = await open({
      filename: '/var/data/cache.db',
      driver: sqlite3.Database
    });

    await this.diskCache.exec(`
      CREATE TABLE IF NOT EXISTS response_cache (
        key TEXT PRIMARY KEY,
        prompt TEXT,
        response TEXT,
        metadata TEXT,
        created_at INTEGER,
        accessed_at INTEGER,
        hit_count INTEGER DEFAULT 1
      )
    `);

    await this.diskCache.exec(`
      CREATE INDEX IF NOT EXISTS idx_accessed
      ON response_cache(accessed_at DESC)
    `);
  }

  hashPrompt(prompt) {
    return crypto.createHash('sha256').update(prompt).digest('hex');
  }

  async get(prompt) {
    const key = this.hashPrompt(prompt);

    // L1: Verificar memória
    const memoryHit = this.memoryCache.get(key);
    if (memoryHit) {
      console.log('[Cache L1] HIT (memória)');
      return {
        ...memoryHit,
        source: 'memory',
        latency: 0.001 // 1ms
      };
    }

    // L2: Verificar disco
    const diskRow = await this.diskCache.get(
      'SELECT * FROM response_cache WHERE key = ?',
      [key]
    );

    if (diskRow) {
      console.log('[Cache L2] HIT (disco)');

      const response = {
        response: diskRow.response,
        metadata: JSON.parse(diskRow.metadata),
        source: 'disk',
        latency: 0.010 // 10ms
      };

      // Promover para L1
      this.memoryCache.set(key, response);

      // Atualizar estatísticas
      await this.diskCache.run(
        'UPDATE response_cache SET accessed_at = ?, hit_count = hit_count + 1 WHERE key = ?',
        [Date.now(), key]
      );

      return response;
    }

    // L3: Busca por similaridade (futuro - embeddings)
    // const similar = await this.findSimilar(prompt);
    // if (similar) return similar;

    console.log('[Cache] MISS - Será buscado no Bedrock');
    return null;
  }

  async set(prompt, response, metadata = {}) {
    const key = this.hashPrompt(prompt);
    const now = Date.now();

    const cacheEntry = {
      response,
      metadata,
      created_at: now
    };

    // L1: Salvar em memória
    this.memoryCache.set(key, cacheEntry);

    // L2: Salvar em disco
    await this.diskCache.run(
      `INSERT OR REPLACE INTO response_cache
       (key, prompt, response, metadata, created_at, accessed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        key,
        prompt,
        response,
        JSON.stringify(metadata),
        now,
        now
      ]
    );

    console.log('[Cache] Salvo em L1 + L2');
  }

  async clear() {
    this.memoryCache.clear();
    await this.diskCache.run('DELETE FROM response_cache');
    console.log('[Cache] Limpo completamente');
  }

  async stats() {
    const memorySize = this.memoryCache.size;

    const diskStats = await this.diskCache.get(`
      SELECT
        COUNT(*) as total,
        SUM(hit_count) as total_hits,
        AVG(hit_count) as avg_hits_per_entry
      FROM response_cache
    `);

    return {
      memory: {
        entries: memorySize,
        maxSize: 100
      },
      disk: diskStats
    };
  }
}

export default new CacheManager();
```

**Integração:**
```javascript
// src/modules/bedrock.js

import cacheManager from '../utils/cache-manager.js';

export async function conversar(mensagem, opcoes = {}) {
  const { enableCache = true } = opcoes;

  // Verificar cache
  if (enableCache) {
    const cached = await cacheManager.get(mensagem);
    if (cached) {
      logger.info('[Bedrock] Usando resposta em cache', {
        source: cached.source,
        latency: cached.latency
      });

      return {
        sucesso: true,
        resposta: cached.response,
        fromCache: true,
        cacheSource: cached.source
      };
    }
  }

  // Cache miss - buscar no Bedrock
  const resultado = await bedrockConverse(mensagem, opcoes);

  // Salvar em cache
  if (enableCache && resultado.sucesso) {
    await cacheManager.set(mensagem, resultado.resposta, {
      modelo: opcoes.modelo,
      tokens: resultado.usage
    });
  }

  return resultado;
}
```

**Ganho:**
- Consultas exatas: **10-50x mais rápido** (0.001s vs 5-10s)
- Consultas similares: **5-10x mais rápido**
- Economia: **$20-30/mês** (consultas repetidas)
- Taxa de hit esperada: **20-30%**

---

#### 1.3 Preload de Modelos ⚡⚡⚡⚡
**Impacto:** ALTO
**Esforço:** 1h
**ROI:** ALTO

**Problema Atual:**
```
Cold start do Bedrock: 2-3s na primeira chamada
→ Primeira request sempre lenta
```

**Solução:**
```javascript
// src/utils/model-preloader.js (NOVO)

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { logger } from './logger.js';

const MODELS_TO_PRELOAD = [
  'anthropic.claude-sonnet-4-5-20250929-v1:0',
  'anthropic.claude-haiku-4-5-20251001-v1:0',
  'us.amazon.nova-pro-v1:0'
];

class ModelPreloader {
  constructor() {
    this.client = new BedrockRuntimeClient({ region: 'us-east-1' });
    this.preloadInterval = null;
  }

  async warmupModel(modelId) {
    try {
      const command = new ConverseCommand({
        modelId,
        messages: [{
          role: 'user',
          content: [{ text: 'ping' }]
        }],
        inferenceConfig: {
          maxTokens: 10,
          temperature: 0.1
        }
      });

      const start = Date.now();
      await this.client.send(command);
      const latency = Date.now() - start;

      logger.info('[Preload] Modelo aquecido', {
        modelo: modelId,
        latency: `${latency}ms`
      });

      return true;
    } catch (error) {
      logger.error('[Preload] Erro ao aquecer modelo', {
        modelo: modelId,
        error: error.message
      });
      return false;
    }
  }

  async preloadAll() {
    logger.info('[Preload] Iniciando warmup de modelos...');

    const promises = MODELS_TO_PRELOAD.map(modelId =>
      this.warmupModel(modelId)
    );

    await Promise.all(promises);

    logger.info('[Preload] Todos os modelos aquecidos');
  }

  startPeriodicPreload() {
    // Aquecer imediatamente
    this.preloadAll();

    // Repetir a cada 5 minutos (keep-alive)
    this.preloadInterval = setInterval(() => {
      this.preloadAll();
    }, 5 * 60 * 1000);

    logger.info('[Preload] Keep-alive iniciado (5min)');
  }

  stopPeriodicPreload() {
    if (this.preloadInterval) {
      clearInterval(this.preloadInterval);
      this.preloadInterval = null;
      logger.info('[Preload] Keep-alive parado');
    }
  }
}

export default new ModelPreloader();
```

**Inicialização:**
```javascript
// src/server.js

import modelPreloader from './utils/model-preloader.js';

// Após servidor iniciar
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);

  // Iniciar preload de modelos
  modelPreloader.startPeriodicPreload();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  modelPreloader.stopPeriodicPreload();
  // ...
});
```

**Ganho:**
- Elimina cold start: **-2-3s**
- Primeira request sempre rápida
- Keep-alive previne timeout de modelos

---

#### 1.4 Tool Use Paralelo ⚡⚡⚡⚡
**Impacto:** ALTO
**Esforço:** 2h
**ROI:** ALTO

**Problema Atual:**
```javascript
// Busca sequencial (LENTO)
const datajud = await buscarDataJud(query);
const jusbrasil = await buscarJusBrasil(query);
const google = await buscarGoogle(query);
// Total: 3-5s + 2-3s + 1-2s = 6-10s
```

**Solução:**
```javascript
// src/services/jurisprudence-search-service.js

async searchAll(query, options = {}) {
  const { limit = 20, tribunal = null } = options;

  console.log('[Jurisprudence] Buscando em paralelo...');
  const start = Date.now();

  // Executar TODAS as buscas em paralelo
  const [datajudResults, jusbrasilResults, googleResults] = await Promise.all([
    this.searchDataJud(query, { limit, tribunal }).catch(err => {
      logger.warn('[DataJud] Erro (não crítico)', { error: err.message });
      return [];
    }),

    this.searchJusBrasil(query, { limit, tribunal }).catch(err => {
      logger.warn('[JusBrasil] Erro (não crítico)', { error: err.message });
      return [];
    }),

    this.searchGoogle(query, { limit, tribunal }).catch(err => {
      logger.warn('[Google] Erro (não crítico)', { error: err.message });
      return [];
    })
  ]);

  const latency = Date.now() - start;

  console.log(`[Jurisprudence] Busca paralela concluída em ${latency}ms`);
  console.log(`  - DataJud: ${datajudResults.length} resultados`);
  console.log(`  - JusBrasil: ${jusbrasilResults.length} resultados`);
  console.log(`  - Google: ${googleResults.length} resultados`);

  // Consolidar e ranquear
  const allResults = [
    ...datajudResults,
    ...jusbrasilResults,
    ...googleResults
  ];

  const ranked = this.rankByRelevance(allResults, query);

  return {
    totalResults: ranked.length,
    allResults: ranked.slice(0, limit),
    sources: {
      datajud: datajudResults.length,
      jusbrasil: jusbrasilResults.length,
      google: googleResults.length
    },
    latency
  };
}
```

**Ganho:**
- Busca jurídica: 6-10s → **2-3s** (3-5x mais rápido)
- Usa o tempo da busca mais lenta (não soma todas)
- Robustez: se um source falha, outros continuam

---

### **RESUMO FASE 1:**

| Melhoria | Impacto | Esforço | Ganho |
|----------|---------|---------|-------|
| Streaming | ⚡⚡⚡⚡⚡ | 2-3h | Primeira palavra: 5-10s → 0.5-1s |
| Cache | ⚡⚡⚡⚡⚡ | 3-4h | Consultas repetidas: 10-50x mais rápido |
| Preload | ⚡⚡⚡⚡ | 1h | Elimina cold start (-2-3s) |
| Tool Paralelo | ⚡⚡⚡⚡ | 2h | Busca jurídica: 3-5x mais rápido |

**Total Fase 1:** 8-10h de implementação
**Ganho percebido:** **Sistema 5-8x mais rápido** para o usuário

---

## **FASE 2: ESTABILIDADE E GUARDRAILS** (3-4 dias)

### 2.1 Guardrails Robusto ⚡⚡⚡⚡⚡
**Impacto:** CRÍTICO
**Esforço:** 1 dia

**Problema Atual:**
```
MAX_LOOPS = 100 (muito alto)
→ Bug pode custar $40+ em uma request
→ Sem circuit breaker
→ Sem timeout adequado
```

**Solução:**
```javascript
// src/config/guardrails.js (NOVO)

export const GUARDRAILS = {
  // Tool loops
  MAX_TOOL_LOOPS: 10,                    // Reduzido de 100
  MAX_TOOL_LOOPS_PER_TYPE: 5,            // Máximo por tipo de tool

  // Timeouts
  TIMEOUT_SIMPLE_ANALYSIS: 30000,        // 30s
  TIMEOUT_KB_ANALYSIS: 120000,           // 2min
  TIMEOUT_EXHAUSTIVE_ANALYSIS: 300000,   // 5min

  // Rate limits
  RATE_LIMIT_USER: '3/min',              // 3 req/min por usuário
  RATE_LIMIT_GLOBAL: '6/sec',            // 6 req/sec global

  // Circuit breaker
  CIRCUIT_BREAKER_THRESHOLD: 5,          // 5 erros consecutivos
  CIRCUIT_BREAKER_TIMEOUT: 60000,        // 1min para tentar novamente

  // Memory
  MAX_MEMORY_PERCENT: 75,                // Alerta se >75% RAM
  MAX_CONCURRENT_EXHAUSTIVE: 2,          // Máximo 2 análises exaustivas

  // Tokens
  MAX_INPUT_TOKENS: 200000,              // Claude Sonnet 4.5 limit
  MAX_OUTPUT_TOKENS: 16384,              // Máximo output

  // History
  MAX_HISTORY_MESSAGES: 20,              // Máximo 20 msgs no histórico

  // Features
  ENABLE_PROMPT_CACHING: true,
  ENABLE_STREAMING: true,
  ENABLE_CACHE: true
};
```

**Circuit Breaker:**
```javascript
// src/utils/circuit-breaker.js (NOVO)

class CircuitBreaker {
  constructor(options = {}) {
    this.threshold = options.threshold || 5;
    this.timeout = options.timeout || 60000;
    this.failures = 0;
    this.state = 'CLOSED';  // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker OPEN - aguarde antes de tentar novamente');
      }

      // Tentar half-open
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();

      // Sucesso - resetar
      this.onSuccess();

      return result;
    } catch (error) {
      // Falha - incrementar
      this.onFailure();

      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
    logger.info('[CircuitBreaker] Resetado para CLOSED');
  }

  onFailure() {
    this.failures++;

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;

      logger.error('[CircuitBreaker] ABERTO - muitas falhas', {
        failures: this.failures,
        nextAttempt: new Date(this.nextAttempt).toISOString()
      });
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      threshold: this.threshold
    };
  }
}

export default CircuitBreaker;
```

---

### 2.2 Observabilidade Completa ⚡⚡⚡⚡⚡
**Impacto:** CRÍTICO
**Esforço:** 1-2 dias

**Logs Estruturados:**
```javascript
// src/utils/logger.js (MELHORADO)

import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'rom-agent',
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV
  },
  transports: [
    // Console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),

    // Arquivo (erros)
    new winston.transports.File({
      filename: '/var/data/logs/error.log',
      level: 'error',
      maxsize: 10485760,  // 10MB
      maxFiles: 5
    }),

    // Arquivo (todos)
    new winston.transports.File({
      filename: '/var/data/logs/combined.log',
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Trace ID para correlação
export function generateTraceId() {
  return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export { logger };
```

**Métricas Prometheus:**
```javascript
// src/utils/metrics-collector-v2.js (JÁ EXISTE - MELHORAR)

// Adicionar métricas de performance
export const performanceHistogram = new client.Histogram({
  name: 'rom_request_duration_seconds',
  help: 'Duração de requests em segundos',
  labelNames: ['endpoint', 'method', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
});

export const cacheHitCounter = new client.Counter({
  name: 'rom_cache_hits_total',
  help: 'Total de cache hits',
  labelNames: ['cache_level'] // memory, disk, similarity
});

export const toolLoopGauge = new client.Gauge({
  name: 'rom_tool_loops_current',
  help: 'Número atual de tool loops',
  labelNames: ['request_id']
});
```

---

### 2.3 Redução de Custo (Otimizações P1) ⚡⚡⚡⚡⚡
**Impacto:** ALTO (39% economia)
**Esforço:** 2 dias

#### 2.3.1 Prompt Caching (AWS Bedrock)
```javascript
// src/modules/bedrock-caching.js (NOVO)

export async function conversarComCache(mensagem, opcoes = {}) {
  const { kbContext = null } = opcoes;

  // Se tem KB, cachear o contexto
  if (kbContext) {
    const messages = [
      {
        role: 'user',
        content: [
          {
            text: kbContext,
            // Marcar para cache (AWS Bedrock feature)
            cacheControl: {
              type: 'ephemeral'  // Cache por 5 minutos
            }
          },
          {
            text: mensagem
          }
        ]
      }
    ];

    // KB cacheado: 85K tokens × $3/M → $0.3/M (90% desconto)
    // Economia: $0.77 por análise exaustiva
  }

  // ... resto da lógica
}
```

**Economia:** $38.50/mês (27%)

#### 2.3.2 Limpeza de Histórico
```javascript
// src/utils/history-manager.js (NOVO)

export function truncateHistory(historico, maxMessages = 20) {
  if (historico.length <= maxMessages) {
    return historico;
  }

  // Manter system message + últimas N mensagens
  const systemMessages = historico.filter(m => m.role === 'system');
  const conversationMessages = historico.filter(m => m.role !== 'system');

  const truncated = [
    ...systemMessages,
    ...conversationMessages.slice(-maxMessages)
  ];

  logger.info('[History] Truncado', {
    original: historico.length,
    truncated: truncated.length,
    removed: historico.length - truncated.length
  });

  return truncated;
}
```

**Economia:** $18/mês (12%)

---

## **FASE 3: EXPERIÊNCIA DE USUÁRIO** (2-3 dias)

### 3.1 PWA Mobile ⚡⚡⚡
**Impacto:** MÉDIO
**Esforço:** 4-6h

**Solução:**
```javascript
// public/manifest.json (NOVO)

{
  "name": "ROM Agent",
  "short_name": "ROM",
  "description": "Redator de Obras Magistrais - IA Jurídica",
  "start_url": "/index.html",
  "display": "standalone",
  "theme_color": "#1a202c",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

```javascript
// public/sw.js (Service Worker - NOVO)

const CACHE_NAME = 'rom-agent-v1';
const urlsToCache = [
  '/index.html',
  '/login.html',
  '/css/styles.css',
  '/js/chat.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
```

**Ganho:**
- Instalável no iPhone/Android
- Funciona offline (interface)
- Performance nativa

---

### 3.2 Atalhos de Teclado ⚡⚡
**Impacto:** BAIXO
**Esforço:** 2-3h

```javascript
// public/js/keyboard-shortcuts.js (NOVO)

document.addEventListener('keydown', (e) => {
  // Ctrl+K ou Cmd+K: Buscar KB
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    openKBSearch();
  }

  // Ctrl+N ou Cmd+N: Nova conversa
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    newConversation();
  }

  // Esc: Cancelar geração
  if (e.key === 'Escape') {
    stopGeneration();
  }

  // Ctrl+Enter: Enviar mensagem
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    submitMessage();
  }
});
```

---

## 📊 CRONOGRAMA DE IMPLEMENTAÇÃO

```
┌─────────────────────────────────────────────────────────┐
│  PLANO MELHORIAS v2.6.0 → v2.7.0 (7-10 dias)            │
└─────────────────────────────────────────────────────────┘

SPRINT 0: PREPARAÇÃO (1 dia)
├─ Setup de testes (Jest)
├─ Coletar baseline de métricas (48h)
└─ Tag: v2.6.0-baseline

FASE 1: PERFORMANCE CRÍTICA (2-3 dias)
├─ Dia 1:
│   ├─ Streaming real-time (2-3h)
│   └─ Preload de modelos (1h)
├─ Dia 2:
│   ├─ Cache inteligente (3-4h)
│   └─ Tool use paralelo (2h)
└─ Dia 3:
    └─ Testes e validação

FASE 2: ESTABILIDADE (3-4 dias)
├─ Dia 1: Guardrails + Circuit breaker
├─ Dia 2: Observabilidade (logs + métricas)
├─ Dia 3: Prompt caching + Limpeza histórico
└─ Dia 4: Testes exaustivos

FASE 3: UX (2-3 dias)
├─ Dia 1-2: PWA Mobile
└─ Dia 3: Atalhos + Polimento

✅ MARCO: v2.7.0 COMPLETO (7-10 dias)

DEPLOY CANARY:
├─ Staging: 24h de validação
├─ Produção: 10% → 50% → 100% (48h)
└─ Tag: v2.7.0-stable
```

---

## 🎯 CRITÉRIOS DE SUCESSO

### Performance
- [ ] Primeira palavra <1s (streaming)
- [ ] Consultas em cache <0.01s
- [ ] Busca jurídica <5s
- [ ] Latência P95 <10s

### Estabilidade
- [ ] Zero crashes em 30 dias
- [ ] Uptime >99.9%
- [ ] 429 errors <2%
- [ ] RAM usage <70%

### Custo
- [ ] <$100/mês AWS Bedrock
- [ ] Redução 39% vs baseline
- [ ] Cache hit rate >20%

### Qualidade
- [ ] Sem regressão funcional
- [ ] Testes passando 100%
- [ ] Dr. Rodolfo valida qualidade mantida

---

## 📞 APROVAÇÃO E PRÓXIMOS PASSOS

**DECISÃO REQUERIDA:**

Dr. Rodolfo, você aprova este plano de melhorias da v2.6.0?

- **SIM** → Iniciar Sprint 0 (preparação)
- **NÃO** → Solicitar ajustes

**Após aprovação:**
1. Setup de testes (1 dia)
2. Baseline de métricas (48h)
3. Implementação Fase 1 (2-3 dias)
4. Implementação Fase 2 (3-4 dias)
5. Implementação Fase 3 (2-3 dias)
6. Deploy canary (48h validação)
7. **v2.7.0 em produção** ✅

**Depois da v2.7.0 estável:**
- Aí sim podemos pensar em multi-tenant (Sprint 4)
- Fundação sólida para expandir

---

**Elaborado por:** Claude Code
**Data:** 2025-12-28
**Versão:** 1.0
**Status:** 🔴 AGUARDANDO APROVAÇÃO

---

*Este plano foca exclusivamente em melhorar a v2.6.0 ANTES de qualquer expansão. Estabilidade e qualidade primeiro, escala depois.*
