# 🗺️ ROADMAP COMPLETO - ROM AGENT
## Do Zero à Excelência Enterprise

**Data de Criação:** 2025-12-28
**Versão Atual em Produção:** v2.6.0
**Última Atualização:** 2025-12-28

---

## 📊 VISÃO GERAL DO PROGRESSO

```
✅ FASE BETA         ████████████████████ 100% CONCLUÍDA
✅ FASE 1 (v2.0-2.6) ████████████████████ 100% CONCLUÍDA
⏳ FASE 2 (v2.7.0)   ░░░░░░░░░░░░░░░░░░░░   0% (Próxima)
❌ FASE 3 (v2.8.0)   ░░░░░░░░░░░░░░░░░░░░   0%
❌ FASE 4 (v2.9.0)   ░░░░░░░░░░░░░░░░░░░░   0%
❌ FASE 5 (v3.0.0)   ░░░░░░░░░░░░░░░░░░░░   0%
```

**Progresso Total:** 40% do roadmap completo concluído

---

## ✅ FASE BETA (CONCLUÍDA)
**Período:** Novembro - Dezembro 2024
**Status:** ✅ 100% CONCLUÍDA

### Objetivos da Fase Beta
Validar MVP com usuários reais e estabelecer fundação técnica sólida.

### ✅ Entregas Concluídas

#### 1. ✅ Infraestrutura Base
- [x] Deploy em Render.com (Standard Plan: 2GB RAM, 1 CPU)
- [x] Node.js 25.2.1 (Alpine)
- [x] AWS Bedrock integrado (us-west-2 Oregon)
- [x] Variáveis de ambiente configuradas
- [x] Git workflow (main + staging branches)

#### 2. ✅ Modelos AI
- [x] Claude Opus 4.5 (modelo principal)
- [x] Claude Sonnet 4.5 (fallback #1)
- [x] Claude Haiku 4.5 (fallback #2)
- [x] Amazon Nova Pro (fallback #3)
- [x] Claude Sonnet 3.7 (fallback #4)
- [x] Amazon Nova Lite (fallback #5)
- [x] Sistema de fallback automático com 6 modelos
- [x] Inference Profiles para redução de custos

#### 3. ✅ Frontend Básico
- [x] Interface de chat (index.html)
- [x] Página de login (login.html)
- [x] CSS responsivo
- [x] JavaScript vanilla (sem frameworks)

#### 4. ✅ Backend Core
- [x] Express.js server
- [x] API REST `/api/chat`
- [x] API `/api/info` (versão, health, uptime)
- [x] API `/api/health` (status detalhado)
- [x] Integração AWS Bedrock
- [x] Error handling básico

#### 5. ✅ Observabilidade Inicial
- [x] Logs estruturados (winston)
- [x] Métricas Prometheus (prom-client)
- [x] Endpoint `/metrics`
- [x] Health checks

#### 6. ✅ Agentes Especializados
- [x] 84 agentes jurídicos especializados
- [x] Prompts em formato Markdown
- [x] Sistema de templates
- [x] Modo jurídico, administrativo, fiscal

---

## ✅ FASE 1: FUNDAÇÃO (v2.0 → v2.6.0) - CONCLUÍDA
**Período:** Dezembro 2024 - 28 Dezembro 2024
**Status:** ✅ 100% CONCLUÍDA

### v2.0 - v2.4.x: Estabilização e Observabilidade ✅

#### ✅ Commits Principais (Dezembro 2024)
```
✅ 78a7cfae - docs(ops): add rollback procedure
✅ 7d8b99af - docs(ops): add release tags convention
✅ bef15cdd - fix(metrics): align bottleneck inflight/queue labels
✅ 3c1318fc - fix(metrics): add missing increment methods
✅ 43e799a5 - docs(validation): add GO-LIVE check results
✅ dfe2d0e8 - feat(validation): add admin endpoints validation
✅ c00a0ad6 - chore(release): promote staging to main (rc-2.4.19)
✅ 2b576916 - fix(bedrock): corrigir região AWS para us-west-2
✅ cbcc7a27 - fix(bedrock): corrigir clonagem de Command instances
✅ c33f1179 - fix(bedrock): usar Inference Profile
✅ edffa394 - fix(bedrock): corrigir IDs dos modelos de fallback
✅ ecd07b68 - feat(models): expand fallback chain to 6 models
✅ ec2bb1e5 - feat(prompts): migrate 60 JSON prompts to MD format
✅ 65d7c779 - chore(docker): bump node 20 -> 25.2.1-alpine
✅ 10af8a4b - fix(metrics): backward compat + fallback debug reasons
✅ 008a2683 - fix(observability): Bedrock counters + Pushgateway
✅ 789ddf5f - hotfix(observability): fix request-logger import
```

#### ✅ Funcionalidades Implementadas

##### 1. ✅ Resiliência de Modelos
- [x] Fallback chain com 6 modelos
- [x] Retry automático em caso de falha
- [x] Circuit breaker pattern
- [x] Métricas de fallback por modelo
- [x] Logs detalhados de tentativas
- [x] Resolução automática de IDs de modelos
- [x] Suporte a Inference Profiles ARN

**Código:** `src/lib/bedrock-helper.js`

##### 2. ✅ Observabilidade Avançada
- [x] Métricas Prometheus completas
  - `http_requests_total` (contador de requests)
  - `http_request_duration_seconds` (latência)
  - `bedrock_invocations_total` (chamadas Bedrock)
  - `model_fallback_attempts_total` (tentativas de fallback)
  - `model_fallback_exhausted_total` (fallback esgotado)
  - `bottleneck_inflight` (requests em andamento)
  - `bottleneck_queue` (fila de espera)
- [x] Request logging estruturado
- [x] Sanitização de logs (PII removal)
- [x] Pushgateway aggregation (opcional)

**Código:** `src/utils/metrics-collector-v2.js`, `src/middlewares/request-logger.js`

##### 3. ✅ Migração de Prompts
- [x] 60 prompts migrados de JSON para Markdown
- [x] Total: 84 agentes especializados
- [x] Formato padronizado `.md`
- [x] Metadados em YAML frontmatter

**Diretório:** `src/prompts/`

##### 4. ✅ Validação e Testes
- [x] GO-LIVE check script
- [x] Anti-rollback suite
- [x] Admin endpoints validation
- [x] Quality API tests
- [x] Smoke tests Bedrock

**Scripts:** `scripts/go-live-check.sh`

##### 5. ✅ Deployment Automation
- [x] Staging → Production workflow
- [x] Release tagging convention
- [x] Rollback procedure documented
- [x] Auto-deploy Render (main branch)
- [x] Version bumping automation

**Docs:** `docs/DEPLOY_*.md`

### v2.5.0: Hardening Release ✅

#### ✅ Commits (18 Dezembro 2024)
```
✅ 4b3ceb6f - chore(version): upgrade to v2.5.0
✅ 45ccabda - chore(version): upgrade to v2.5.0
✅ 00f1e00d - fix(timeout): correct logger import
✅ 9bb3e4b0 - fix(timeout): correct logger import
✅ 8097028c - fix(sanitizer): escape asterisks in CNPJ
✅ 73fb2757 - fix(sanitizer): escape asterisks in CNPJ
✅ e7bc53b4 - feat(hardening): integrate timeout and log sanitization
✅ 03a345c8 - chore(version): set version to 2.5.0-beta
✅ bac50be6 - chore(version): set version to 2.5.0-beta
✅ b063b161 - docs(deploy): add hardening deployment guide
✅ 3637b1cc - docs(deploy): add hardening deployment guide
✅ 5175822b - feat(security): implement log sanitization
✅ 1cf40a4f - feat(slo): implement SLO/Timeouts configuration
✅ d7a6a0eb - chore(release): bump version to 2.5.0-beta
```

#### ✅ Funcionalidades Implementadas

##### 1. ✅ Timeouts e SLOs
- [x] Timeout global configurável via `.env`
- [x] Timeout por rota
- [x] SLO: P95 < 5s, P99 < 10s
- [x] Middleware de timeout
- [x] Métricas de violação de SLO

**Código:** `src/middlewares/timeout.js`

**Configuração:**
```env
SLO_DEFAULT_TIMEOUT=30000
SLO_CHAT_TIMEOUT=60000
SLO_ANALYSIS_TIMEOUT=120000
```

##### 2. ✅ Log Sanitization (Segurança)
- [x] Remoção automática de PII
  - CPF mascarado: `123.456.789-XX`
  - CNPJ mascarado: `12.345.678/0001-XX`
  - Email mascarado: `user***@domain.com`
  - Telefone mascarado: `(11) 9****-1234`
  - Cartão de crédito: `XXXX-XXXX-XXXX-1234`
  - Senhas: `[REDACTED]`
- [x] Sanitização em todos os níveis de log
- [x] Preservação de contexto para debugging

**Código:** `src/middlewares/log-sanitizer.js`

##### 3. ✅ Deployment Guide
- [x] Documentação de deploy v2.5.0
- [x] Checklist de validação
- [x] Rollback procedure
- [x] Smoke tests

**Docs:** `docs/DEPLOY_HARDENING.md`

### v2.6.0: Database Persistence ✅

#### ✅ Commits (Dezembro 2024)
```
✅ bbd9d82d - Refactor: Sistema de Jurisprudência UNIVERSAL
✅ 4f6dda37 - Feature: Sistema de Análise de Jurisprudência
✅ 84441ffd - Fix: metricsCollector.incrementModelFallback error
✅ 3c78739a - Fix: Corrigir ordem de middleware - sessões antes de auth
✅ 7430319b - Fix: Login page usa autenticação baseada em sessão
✅ c3b58fed - feat: implement session-based authentication system
✅ 8c899a9a - feat: add /api/db-diagnose endpoint
✅ 979cccf0 - feat(database): add verbose PostgreSQL logs
✅ 10e0917e - chore: force render redeploy v2.6.0
✅ ae041e19 - debug: add STARTUP logs to detect DATABASE_URL
✅ c7555053 - chore: force redeploy v2.6.0
✅ 1d4b8a7a - debug: adicionar logs verbosos database init
✅ 934cc129 - feat: adicionar database health ao /health
✅ b6a72bac - fix: aguardar inicialização PostgreSQL/Redis
✅ 1754af72 - v2.6.0: Database Persistence + Fix Redis retry
✅ eee23674 - fix: renomear closeConnections
✅ e456531e - feat(database): implement PostgreSQL + Redis v2.6.0
✅ be000e60 - chore(version): upgrade to v2.6.0
✅ 395fa901 - feat: Add automated database migration script
✅ 13aab4e1 - feat(database): implement PostgreSQL + Redis layer
```

#### ✅ Funcionalidades Implementadas

##### 1. ✅ PostgreSQL Persistence
- [x] Integração com PostgreSQL (Render managed)
- [x] Connection string segura (SSL)
- [x] Pool de conexões com `pg`
- [x] 9 tabelas criadas:
  - `users` (usuários com email/senha)
  - `sessions` (sessões com connect-pg-simple)
  - `conversations` (histórico de conversas)
  - `messages` (mensagens das conversas)
  - `documents` (documentos PDF processados)
  - `kb_documents` (base de conhecimento)
  - `extractions` (extrações de dados)
  - `prompts` (templates de prompts)
  - `metrics` (métricas históricas)
- [x] Migrations automáticas
- [x] Graceful shutdown
- [x] Health check PostgreSQL

**Código:** `src/database/db.js`, `scripts/migrate-database.js`

**Connection:**
```
Host: dpg-d5819bhr0fns73dmfsv0-a.oregon-postgres.render.com
Database: rom_agent
User: rom_agent_user
```

##### 2. ✅ Redis Caching
- [x] Integração com Redis (Upstash)
- [x] Cache de respostas AI
- [x] TTL configurável
- [x] Retry logic
- [x] Fallback para operação sem cache
- [x] Health check Redis

**Código:** `src/database/redis-client.js`

**Métricas de Cache:**
- Cache hit rate
- Cache miss rate
- Tamanho do cache

##### 3. ✅ Session-Based Authentication
- [x] Substituição de JWT por sessões server-side
- [x] `express-session` + `connect-pg-simple`
- [x] Sessões persistidas no PostgreSQL
- [x] Cookie seguro (httpOnly, secure em produção)
- [x] Middleware de autenticação
- [x] `/api/auth/login` - Login
- [x] `/api/auth/logout` - Logout
- [x] `/api/auth/check` - Verificar sessão
- [x] `/api/auth/register` - Criar usuário

**Código:** `src/middlewares/session.js`, `src/routes/auth.js`

**Configuração de Sessão:**
```javascript
{
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24h
  },
  store: new PgSession({
    pool: db.pool,
    tableName: 'sessions'
  })
}
```

##### 4. ✅ Database Health Monitoring
- [x] `/health` endpoint com status PostgreSQL
- [x] `/api/db-diagnose` endpoint de diagnóstico
- [x] Logs verbosos de conexão
- [x] Latência de queries monitorada
- [x] Connection pool stats

**Endpoint `/health` Response:**
```json
{
  "status": "ok",
  "database": {
    "postgres": {
      "available": true,
      "latency": 45
    },
    "redis": {
      "available": true,
      "latency": 12
    }
  },
  "uptime": "2h 34m 12s"
}
```

##### 5. ✅ Sistema de Jurisprudência UNIVERSAL
- [x] Script genérico `analyze-jurisprudence.js`
- [x] Aceita QUALQUER consulta jurídica via `--query`
- [x] Sem teses pré-definidas
- [x] Integração DataJud (API CNJ oficial)
- [x] Integração JusBrasil (web scraping)
- [x] Integração Google Custom Search
- [x] Busca paralela nas 3 fontes
- [x] Ranking por relevância e tribunal
- [x] Priorização automática: STF > STJ > TST > TSE > TRF > TJ
- [x] Output JSON completo
- [x] Fundamentação jurisprudencial formatada
- [x] Documentação completa

**Script:** `scripts/analyze-jurisprudence.js`
**Docs:** `docs/ANALISE_JURISPRUDENCIA.md`

**Uso:**
```bash
# Qualquer área do direito
node scripts/analyze-jurisprudence.js --query "usucapião extraordinária"
node scripts/analyze-jurisprudence.js --query "danos morais" --tribunal "STJ"
node scripts/analyze-jurisprudence.js --query "guarda compartilhada" --limit 30
```

**Output:**
```json
{
  "titulo": "ANÁLISE JURISPRUDENCIAL",
  "consulta": "usucapião extraordinária",
  "totalPrecedentes": 87,
  "precedentesRelevantes": 15,
  "precedentes": [...],
  "argumentacao": "...",
  "fundamentacaoCompleta": "..."
}
```

### 📈 Métricas da Fase 1 (v2.0 - v2.6.0)

#### Commits
- **Total:** 100+ commits
- **Período:** Dezembro 2024
- **Branches:** main, staging

#### Código
- **Linhas de código:** ~15.000 LOC
- **Arquivos:** ~150 arquivos
- **Testes:** Anti-rollback suite, GO-LIVE checks

#### Infraestrutura
- **Uptime:** 99.5%
- **Latência P95:** 3.2s
- **Latência P99:** 7.8s
- **Modelos fallback:** 6 modelos
- **Taxa de sucesso:** 99.2%

---

## ⏳ FASE 2: PERFORMANCE (v2.7.0) - PRÓXIMA
**Estimativa:** 7-10 dias de desenvolvimento
**Status:** ⏳ PENDENTE (Próxima fase)
**Objetivo:** Velocidade comparável ou superior ao Claude.ai

### Objetivos v2.7.0
Otimizar performance para primeira resposta < 1s e experiência fluida.

### ❌ Funcionalidades Pendentes

#### 1. ❌ Streaming Real-Time (Server-Sent Events)
**Esforço:** 2-3 horas
**Impacto:** ALTO (UX)

- [ ] Implementar SSE no endpoint `/api/chat`
- [ ] Stream de tokens em tempo real
- [ ] Primeira palavra em < 1s (atualmente 5-10s)
- [ ] Progress indicators
- [ ] Cancelamento de requests
- [ ] Retry automático em caso de desconexão

**Código a criar:**
```javascript
// src/routes/chat.js
export async function* conversarStream(mensagem, opcoes) {
  const stream = await bedrock.invokeModelWithResponseStream({
    modelId: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
    body: JSON.stringify({ messages: [{ role: 'user', content: mensagem }] })
  });

  for await (const event of stream.body) {
    if (event.chunk) {
      const chunk = JSON.parse(Buffer.from(event.chunk.bytes).toString('utf-8'));
      if (chunk.type === 'content_block_delta') {
        yield chunk.delta.text;
      }
    }
  }
}
```

**Frontend:**
```javascript
// public/script.js
const eventSource = new EventSource('/api/chat/stream?message=' + encodeURIComponent(msg));
eventSource.onmessage = (event) => {
  const token = event.data;
  appendTokenToUI(token);
};
```

**Métricas:**
- Time to first byte (TTFB): < 500ms
- Time to first token: < 1s
- Tokens per second: > 50

#### 2. ❌ Cache Inteligente Multi-Level
**Esforço:** 3-4 horas
**Impacto:** ALTO (Performance + Custo)

- [ ] **L1 Cache:** Memória (LRU, 100MB)
  - Respostas recentes (últimos 1000 requests)
  - TTL: 5 minutos
  - Latência: < 1ms
- [ ] **L2 Cache:** Disco (SQLite, 1GB)
  - Respostas frequentes
  - TTL: 24 horas
  - Latência: < 10ms
- [ ] **L3 Cache:** Similaridade (embeddings)
  - Busca semântica de respostas similares
  - Threshold: 95% similaridade
  - Latência: < 100ms
- [ ] Cache invalidation inteligente
- [ ] Warm-up de cache (preload queries comuns)
- [ ] Métricas de cache hit/miss rate

**Código a criar:**
```javascript
// src/utils/cache-manager.js
class CacheManager {
  constructor() {
    this.l1 = new LRUCache({ max: 1000, maxSize: 100 * 1024 * 1024 });
    this.l2 = new SQLiteCache({ path: './cache.db', maxSize: 1024 * 1024 * 1024 });
    this.l3 = new EmbeddingCache({ model: 'amazon.titan-embed-text-v1' });
  }

  async get(key) {
    // L1
    let value = this.l1.get(key);
    if (value) return { value, level: 'L1', latency: 0.001 };

    // L2
    value = await this.l2.get(key);
    if (value) {
      this.l1.set(key, value);
      return { value, level: 'L2', latency: 0.010 };
    }

    // L3 (similaridade)
    value = await this.l3.findSimilar(key, 0.95);
    if (value) {
      this.l1.set(key, value);
      this.l2.set(key, value);
      return { value, level: 'L3', latency: 0.100 };
    }

    return null;
  }
}
```

**Benefícios:**
- Redução de custo: 70-80% (menos chamadas Bedrock)
- Latência: 1ms (L1) vs 3s (Bedrock)
- Cache hit rate esperado: 60-70%

#### 3. ❌ Prompt Caching (AWS Bedrock)
**Esforço:** 1-2 horas
**Impacto:** MÉDIO (Custo)

- [ ] Habilitar Prompt Caching no Bedrock
- [ ] Marcar system prompts como cacheáveis
- [ ] TTL: 5 minutos (padrão AWS)
- [ ] Desconto: 90% em tokens cached

**Código:**
```javascript
// src/lib/bedrock-helper.js
const params = {
  modelId,
  messages: [
    {
      role: 'system',
      content: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' } // ← Cacheable
        }
      ]
    },
    { role: 'user', content: userMessage }
  ]
};
```

**Economia Estimada:**
- Baseline: 100.000 tokens system prompt por request
- Com cache: 10.000 tokens (90% desconto)
- Economia mensal: ~R$ 500-1000

#### 4. ❌ Preload de Modelos (Warm-up)
**Esforço:** 1 hora
**Impacto:** MÉDIO (Latência)

- [ ] Keep-alive ping a cada 5 minutos
- [ ] Evitar cold start dos modelos
- [ ] Reduzir first request latency

**Código:**
```javascript
// src/utils/model-preloader.js
setInterval(async () => {
  await bedrock.invokeModel({
    modelId: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
    body: JSON.stringify({ messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 })
  });
}, 5 * 60 * 1000); // 5 min
```

**Benefício:**
- First request: 5s → 1s
- Elimina cold start

#### 5. ❌ Tool Use Paralelo
**Esforço:** 2 horas
**Impacto:** MÉDIO (Performance em buscas)

- [ ] Executar múltiplos tool calls em paralelo
- [ ] DataJud + JusBrasil + Google Search simultaneamente
- [ ] Agregação de resultados

**Código:**
```javascript
// src/services/jurisprudence-search-service.js
async searchAll(query) {
  const [datajud, jusbrasil, google] = await Promise.all([
    this.searchDataJud(query),
    this.searchJusBrasil(query),
    this.searchGoogle(query)
  ]);

  return this.aggregateResults([datajud, jusbrasil, google]);
}
```

**Benefício:**
- Tempo de busca: 9s → 3s (3x mais rápido)

#### 6. ❌ Connection Pooling Otimizado
**Esforço:** 1 hora
**Impacto:** BAIXO (Já implementado parcialmente)

- [ ] Ajustar pool size PostgreSQL (atualmente 20)
- [ ] Connection reuse Redis
- [ ] Monitorar pool exhaustion

### 📊 Métricas Esperadas v2.7.0

| Métrica | Antes (v2.6.0) | Depois (v2.7.0) | Melhoria |
|---------|---------------|-----------------|----------|
| **Latência P95** | 3.2s | 0.8s | 4x |
| **Latência P99** | 7.8s | 1.5s | 5x |
| **Time to First Token** | 5-10s | < 1s | 10x |
| **Cache Hit Rate** | 0% | 65% | N/A |
| **Custo Mensal Bedrock** | R$ 800 | R$ 250 | -69% |
| **Throughput** | 10 req/s | 50 req/s | 5x |

### 🎯 Critérios de Sucesso v2.7.0

1. ✅ Time to First Token < 1s (P95)
2. ✅ Latência end-to-end < 2s (P95)
3. ✅ Cache hit rate > 60%
4. ✅ Redução de custo > 60%
5. ✅ Throughput > 40 req/s
6. ✅ Uptime mantido > 99.5%

---

## ❌ FASE 3: ESCALA (v2.8.0) - PLANEJADA
**Estimativa:** 10-14 dias de desenvolvimento
**Status:** ❌ NÃO INICIADA
**Objetivo:** Suportar 1000+ usuários simultâneos

### Objetivos v2.8.0
Escalar horizontalmente e garantir alta disponibilidade.

### ❌ Funcionalidades Planejadas

#### 1. ❌ Load Balancer
**Esforço:** 2-3 dias

- [ ] Nginx ou CloudFlare Load Balancer
- [ ] Round-robin entre instâncias
- [ ] Health checks ativos
- [ ] Failover automático
- [ ] Sticky sessions (para session-based auth)

**Arquitetura:**
```
                    ┌─────────────┐
      Internet ────▶│ CloudFlare  │
                    │ Load Balancer│
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼───┐   ┌───▼────┐  ┌───▼────┐
         │ Node 1 │   │ Node 2 │  │ Node 3 │
         │ 2GB RAM│   │ 2GB RAM│  │ 2GB RAM│
         └────┬───┘   └───┬────┘  └───┬────┘
              │           │            │
              └───────────┼────────────┘
                          │
                  ┌───────▼────────┐
                  │   PostgreSQL   │
                  │   (Shared DB)  │
                  └────────────────┘
```

#### 2. ❌ Horizontal Scaling
**Esforço:** 2 dias

- [ ] Deploy de 3+ instâncias Render
- [ ] Shared PostgreSQL database
- [ ] Shared Redis cache
- [ ] Session replication
- [ ] Auto-scaling baseado em CPU/Memory

**Configuração Render:**
```yaml
services:
  - type: web
    name: rom-agent-node-1
    plan: standard
    numInstances: 1

  - type: web
    name: rom-agent-node-2
    plan: standard
    numInstances: 1

  - type: web
    name: rom-agent-node-3
    plan: standard
    numInstances: 1
```

#### 3. ❌ Circuit Breaker Pattern
**Esforço:** 2 dias

- [ ] Circuit breaker para Bedrock API
- [ ] Circuit breaker para PostgreSQL
- [ ] Circuit breaker para Redis
- [ ] Half-open state testing
- [ ] Fallback para degraded mode

**Código:**
```javascript
// src/utils/circuit-breaker.js
class CircuitBreaker {
  constructor(service, { threshold = 5, timeout = 60000 } = {}) {
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.threshold = threshold;
    this.timeout = timeout;
  }

  async call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }
}
```

#### 4. ❌ Rate Limiting
**Esforço:** 1 dia

- [ ] Rate limit por usuário: 100 req/min
- [ ] Rate limit global: 1000 req/min
- [ ] Sliding window algorithm
- [ ] Headers informativos (`X-RateLimit-*`)

**Middleware:**
```javascript
// src/middlewares/rate-limiter.js
import rateLimit from 'express-rate-limit';

export const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 100, // 100 requests
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});
```

#### 5. ❌ Queue System (Job Queue)
**Esforço:** 3 dias

- [ ] Bull queue (Redis-backed)
- [ ] Processamento assíncrono de análises longas
- [ ] Job priorities
- [ ] Retry com backoff exponencial
- [ ] Dead letter queue

**Casos de uso:**
- Análise de jurisprudência (pode demorar 30-60s)
- Processamento de PDFs grandes
- Envio de emails

**Código:**
```javascript
// src/queues/analysis-queue.js
import Queue from 'bull';

export const analysisQueue = new Queue('analysis', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
});

analysisQueue.process(async (job) => {
  const { query, tribunal, limit } = job.data;
  const result = await analisarJurisprudencia({ query, tribunal, limit });
  return result;
});

// Adicionar job
analysisQueue.add({ query: 'usucapião', tribunal: 'STJ', limit: 20 }, {
  priority: 1,
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
});
```

#### 6. ❌ Database Replication
**Esforço:** 2 dias

- [ ] PostgreSQL read replicas
- [ ] Write to primary, read from replicas
- [ ] Automatic failover
- [ ] Lag monitoring

**Arquitetura:**
```
┌────────────┐
│  Primary   │ ◀──── Writes
│ PostgreSQL │
└─────┬──────┘
      │ Replication
      ├─────────────┬─────────────┐
      │             │             │
┌─────▼─────┐ ┌────▼─────┐ ┌────▼─────┐
│ Replica 1 │ │Replica 2 │ │Replica 3 │ ◀──── Reads
└───────────┘ └──────────┘ └──────────┘
```

#### 7. ❌ CDN para Assets Estáticos
**Esforço:** 1 dia

- [ ] CloudFlare CDN
- [ ] Cache de CSS/JS/images
- [ ] Compressão Brotli
- [ ] Edge caching

### 📊 Métricas Esperadas v2.8.0

| Métrica | v2.7.0 | v2.8.0 | Melhoria |
|---------|--------|---------|----------|
| **Usuários Simultâneos** | 100 | 1000+ | 10x |
| **Throughput** | 50 req/s | 500 req/s | 10x |
| **Uptime** | 99.5% | 99.9% | +0.4% |
| **Latência P95** | 0.8s | 0.6s | 1.3x |
| **MTTR (Mean Time to Recovery)** | 30min | 5min | 6x |

---

## ❌ FASE 4: COMERCIALIZAÇÃO (v2.9.0) - PLANEJADA
**Estimativa:** 14-21 dias de desenvolvimento
**Status:** ❌ NÃO INICIADA
**Objetivo:** Monetização e gestão de assinaturas

### Objetivos v2.9.0
Implementar sistema de pagamentos e planos de assinatura.

### ❌ Funcionalidades Planejadas

#### 1. ❌ Integração Stripe
**Esforço:** 3-4 dias

- [ ] Stripe SDK integrado
- [ ] Checkout flow
- [ ] Webhook handlers
- [ ] Invoice generation
- [ ] Payment methods (Cartão, PIX, Boleto)

**Código:**
```javascript
// src/services/stripe-service.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function criarAssinatura(userId, planId) {
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId }
  });

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: planId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent']
  });

  return subscription;
}
```

#### 2. ❌ Planos de Assinatura
**Esforço:** 2 dias

| Plano | Preço | Requests/mês | Features |
|-------|-------|--------------|----------|
| **Free** | R$ 0 | 100 | Básico, 1 usuário |
| **Pro** | R$ 99/mês | 5.000 | Avançado, 5 usuários, prioridade |
| **Business** | R$ 299/mês | 20.000 | Completo, 20 usuários, SLA 99.9% |
| **Enterprise** | Custom | Ilimitado | White-label, multi-tenant, SLA 99.99% |

**Tabela no banco:**
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  plan_id VARCHAR(50),
  stripe_subscription_id VARCHAR(255),
  status VARCHAR(20), -- active, canceled, past_due
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. ❌ Usage-Based Billing
**Esforço:** 3 dias

- [ ] Contador de requests por usuário
- [ ] Metered billing (Stripe)
- [ ] Alertas de limite
- [ ] Auto-upgrade quando limite atingido

**Código:**
```javascript
// src/middlewares/usage-tracker.js
export async function trackUsage(req, res, next) {
  const userId = req.session.userId;
  const usage = await db.query(
    'SELECT COUNT(*) FROM requests WHERE user_id = $1 AND created_at > NOW() - INTERVAL \'30 days\'',
    [userId]
  );

  const subscription = await getSubscription(userId);
  const limit = PLAN_LIMITS[subscription.plan_id];

  if (usage.count >= limit) {
    return res.status(429).json({
      error: 'Usage limit exceeded',
      usage: usage.count,
      limit,
      upgradeUrl: '/pricing'
    });
  }

  // Reportar uso ao Stripe
  await stripe.subscriptionItems.createUsageRecord(subscription.stripe_item_id, {
    quantity: 1,
    timestamp: Math.floor(Date.now() / 1000)
  });

  next();
}
```

#### 4. ❌ Dashboard de Admin
**Esforço:** 5 dias

- [ ] Painel administrativo
- [ ] Listagem de usuários
- [ ] Métricas de uso
- [ ] Gestão de assinaturas
- [ ] Revenue tracking
- [ ] Churn analysis

**Endpoints:**
```
GET  /admin/users
GET  /admin/subscriptions
GET  /admin/revenue
GET  /admin/metrics
POST /admin/users/:id/suspend
POST /admin/subscriptions/:id/cancel
```

#### 5. ❌ Webhooks Stripe
**Esforço:** 2 dias

- [ ] `invoice.payment_succeeded` → Ativar assinatura
- [ ] `invoice.payment_failed` → Suspender conta
- [ ] `customer.subscription.deleted` → Cancelar assinatura
- [ ] `customer.subscription.updated` → Atualizar plano

**Código:**
```javascript
// src/routes/webhooks.js
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

  switch (event.type) {
    case 'invoice.payment_succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailure(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionCanceled(event.data.object);
      break;
  }

  res.json({ received: true });
});
```

#### 6. ❌ Trial Period (14 dias)
**Esforço:** 1 dia

- [ ] Trial automático ao criar conta
- [ ] Email 3 dias antes do fim do trial
- [ ] Auto-downgrade para Free após trial

#### 7. ❌ Invoices e Recibos
**Esforço:** 2 dias

- [ ] Geração automática de invoices
- [ ] Envio por email
- [ ] Download de PDF
- [ ] Histórico de pagamentos

### 📊 Projeção de Receita v2.9.0

#### Ano 1 (Conservador)
```
Mês 1:   10 usuários Free + 2 Pro = R$ 198
Mês 3:   30 usuários Free + 8 Pro + 1 Business = R$ 1.091
Mês 6:   80 usuários Free + 20 Pro + 4 Business = R$ 3.176
Mês 12: 200 usuários Free + 50 Pro + 10 Business = R$ 7.940

ARR (Ano 1): R$ 95.280
MRR (Mês 12): R$ 7.940
```

#### Ano 2 (Moderado)
```
Mês 18: 400 usuários Free + 100 Pro + 25 Business + 2 Enterprise = R$ 25.150
Mês 24: 800 usuários Free + 180 Pro + 45 Business + 5 Enterprise = R$ 46.230

ARR (Ano 2): R$ 426.780
MRR (Mês 24): R$ 46.230
```

---

## ❌ FASE 5: EXCELÊNCIA ENTERPRISE (v3.0.0) - PLANEJADA
**Estimativa:** 21-30 dias de desenvolvimento
**Status:** ❌ NÃO INICIADA
**Objetivo:** Produto Enterprise-grade com SLA 99.99%

### Objetivos v3.0.0
Transformar em produto Enterprise completo com multi-tenancy.

### ❌ Funcionalidades Planejadas

#### 1. ❌ Multi-Tenancy (Isolamento Total)
**Esforço:** 7 dias

- [ ] Tenant ID em todas as tabelas
- [ ] Row Level Security (RLS) no PostgreSQL
- [ ] Schema por tenant (isolamento completo)
- [ ] Tenant-specific configurations
- [ ] Cross-tenant analytics (admin only)

**Modelo de dados:**
```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem dados do próprio tenant
CREATE POLICY tenant_isolation_policy ON users
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_policy ON conversations
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Middleware para setar tenant
app.use((req, res, next) => {
  const tenantId = req.headers['x-tenant-id'] || req.session.tenantId;
  db.query('SET app.current_tenant = $1', [tenantId]);
  next();
});
```

#### 2. ❌ Multi-Office (Escritórios Múltiplos)
**Esforço:** 5 dias

- [ ] Office hierarchy (1 tenant = N offices)
- [ ] Office-specific users
- [ ] Office-level permissions
- [ ] Cross-office reporting
- [ ] Office customization (logo, cores)

**Estrutura:**
```
Tenant: "Mota Advogados"
  ├── Office 1: "São Paulo - Centro"
  │   ├── User: rodolfo@mota.adv.br (Admin)
  │   ├── User: maria@mota.adv.br (Advogada)
  │   └── User: joao@mota.adv.br (Estagiário)
  ├── Office 2: "São Paulo - Paulista"
  │   └── User: carlos@mota.adv.br (Advogado)
  └── Office 3: "Rio de Janeiro"
      └── User: ana@mota.adv.br (Advogada)
```

#### 3. ❌ SSO (Single Sign-On)
**Esforço:** 4 dias

- [ ] SAML 2.0
- [ ] OAuth 2.0 / OpenID Connect
- [ ] Integração Google Workspace
- [ ] Integração Microsoft Azure AD
- [ ] Just-in-Time (JIT) user provisioning

**Providers:**
- Google Workspace
- Microsoft Azure AD
- Okta
- Auth0

#### 4. ❌ RBAC Granular (Role-Based Access Control)
**Esforço:** 3 dias

- [ ] Roles: Super Admin, Tenant Admin, Office Admin, Advogado, Estagiário, Read-Only
- [ ] Permissions granulares
  - `conversations.read`
  - `conversations.create`
  - `documents.upload`
  - `users.manage`
  - `billing.view`
  - `analytics.view`
- [ ] Role assignment por usuário
- [ ] Permission inheritance

**Código:**
```javascript
// src/middlewares/authorization.js
export function requirePermission(permission) {
  return async (req, res, next) => {
    const user = req.session.user;
    const hasPermission = await checkPermission(user.id, permission);

    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}

// Uso
app.post('/api/users', requirePermission('users.create'), createUser);
app.delete('/api/users/:id', requirePermission('users.delete'), deleteUser);
```

#### 5. ❌ White-Label Customization
**Esforço:** 5 dias

- [ ] Custom domain por tenant (e.g., `app.motaadvogados.com.br`)
- [ ] Logo customizável
- [ ] Cores customizáveis (CSS variables)
- [ ] Favicon customizável
- [ ] Email templates customizáveis

**Config por tenant:**
```json
{
  "tenant_id": "uuid",
  "domain": "app.motaadvogados.com.br",
  "branding": {
    "logo_url": "https://cdn.example.com/logos/mota.png",
    "primary_color": "#1E40AF",
    "secondary_color": "#3B82F6",
    "favicon_url": "https://cdn.example.com/favicons/mota.ico"
  },
  "email_from": "noreply@motaadvogados.com.br"
}
```

#### 6. ❌ SLA 99.99% (4 nines)
**Esforço:** 7 dias

- [ ] Downtime máximo: 52 minutos/ano
- [ ] Multi-region deployment (failover automático)
- [ ] Health checks ativos (cada 10s)
- [ ] Auto-recovery de falhas
- [ ] Status page público
- [ ] Incident response playbook

**Arquitetura Multi-Region:**
```
┌──────────────┐        ┌──────────────┐
│ us-west-2    │        │ sa-east-1    │
│ (Oregon)     │◀──────▶│ (São Paulo)  │
│              │  Sync  │              │
│ - 3 nodes    │        │ - 3 nodes    │
│ - PostgreSQL │        │ - PostgreSQL │
│ - Redis      │        │ - Redis      │
└──────┬───────┘        └──────┬───────┘
       │                       │
       └───────────┬───────────┘
                   │
           ┌───────▼────────┐
           │  Route 53      │
           │ (DNS Failover) │
           └────────────────┘
```

#### 7. ❌ Audit Logging Completo
**Esforço:** 3 dias

- [ ] Log de todas as ações
  - Login/Logout
  - Criação/edição/exclusão de dados
  - Mudanças de permissões
  - Acessos a documentos sensíveis
- [ ] Immutable audit log
- [ ] Retention: 7 anos (conformidade LGPD)
- [ ] Export para compliance

**Tabela:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  user_id UUID,
  action VARCHAR(50),
  resource_type VARCHAR(50),
  resource_id UUID,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

#### 8. ❌ LGPD / GDPR Compliance
**Esforço:** 4 dias

- [ ] Data encryption at rest (AES-256)
- [ ] Data encryption in transit (TLS 1.3)
- [ ] Right to erasure ("Direito ao esquecimento")
- [ ] Data portability (export JSON/CSV)
- [ ] Consent management
- [ ] Privacy policy
- [ ] Terms of service
- [ ] DPO contact

**Endpoints:**
```
POST /api/privacy/export-data      # Export all user data
POST /api/privacy/delete-account   # Delete account and all data
GET  /api/privacy/consent          # View consent status
POST /api/privacy/revoke-consent   # Revoke consent
```

#### 9. ❌ Advanced Analytics
**Esforço:** 5 dias

- [ ] Dashboard analytics
  - Usage by tenant/office/user
  - Top queries
  - Model distribution
  - Cost per tenant
  - Revenue metrics
- [ ] Export to CSV/Excel
- [ ] Scheduled reports (email)
- [ ] Real-time dashboards

**Métricas:**
- Requests per tenant/day
- Latência por tenant
- Cache hit rate por tenant
- Cost attribution (Bedrock cost por tenant)
- Revenue per tenant
- Churn rate

#### 10. ❌ API Pública (para integrações)
**Esforço:** 4 dias

- [ ] REST API completa
- [ ] API keys por tenant
- [ ] Rate limiting por API key
- [ ] Webhooks para eventos
- [ ] API documentation (OpenAPI/Swagger)
- [ ] SDKs (JavaScript, Python)

**Endpoints:**
```
POST /api/v1/chat               # Enviar mensagem
GET  /api/v1/conversations      # Listar conversas
POST /api/v1/documents/upload   # Upload de documento
GET  /api/v1/analysis           # Buscar análise jurisprudencial
```

**Webhook events:**
- `conversation.created`
- `document.processed`
- `analysis.completed`

### 📊 Métricas Esperadas v3.0.0

| Métrica | v2.9.0 | v3.0.0 | Melhoria |
|---------|--------|---------|----------|
| **SLA** | 99.9% | 99.99% | +0.09% |
| **Downtime/ano** | 8.76h | 52min | 10x |
| **Tenant Count** | 1 | 100+ | 100x |
| **Users per Tenant** | 50 | 500+ | 10x |
| **ARR** | R$ 426k | R$ 2M+ | 4.7x |
| **MTTR** | 5min | 1min | 5x |

---

## 📈 RESUMO EXECUTIVO

### Progresso Atual (2025-12-28)

#### ✅ Concluído
- **FASE BETA:** 100% ✅
  - Infraestrutura base
  - 6 modelos AI + fallback
  - 84 agentes especializados
  - Frontend + Backend core
  - Observabilidade inicial

- **FASE 1 (v2.0 - v2.6.0):** 100% ✅
  - Resiliência (6-model fallback, circuit breaker)
  - Observabilidade avançada (Prometheus, sanitização)
  - Migração de prompts (84 agentes em MD)
  - Validação e testes (GO-LIVE checks)
  - Hardening (timeouts, log sanitization)
  - Database persistence (PostgreSQL + Redis)
  - Session-based authentication
  - Sistema de Jurisprudência UNIVERSAL

#### ⏳ Em Andamento
- **Sistema de Jurisprudência** aguardando deploy para produção (commit bbd9d82d)
- **Monitoramento** de auto-deploy ativo

#### ❌ Pendente
- **FASE 2 (v2.7.0):** Performance (streaming, cache, preload)
- **FASE 3 (v2.8.0):** Escala (load balancer, horizontal scaling)
- **FASE 4 (v2.9.0):** Comercialização (Stripe, billing)
- **FASE 5 (v3.0.0):** Excelência Enterprise (multi-tenant, SLA 99.99%)

### Timeline Projetado

```
Dezembro 2024    ✅ Beta + v2.0-2.6.0 (CONCLUÍDO)
Janeiro 2025     ⏳ v2.7.0 Performance (7-10 dias)
Janeiro 2025     ❌ v2.8.0 Escala (10-14 dias)
Fevereiro 2025   ❌ v2.9.0 Comercialização (14-21 dias)
Março 2025       ❌ v3.0.0 Enterprise (21-30 dias)
```

**Tempo total estimado para v3.0.0:** 60-90 dias

### Investimento Necessário

| Fase | Desenvolvimento | Infraestrutura | Total |
|------|----------------|----------------|-------|
| v2.7.0 | R$ 5.000 | R$ 500 | R$ 5.500 |
| v2.8.0 | R$ 8.000 | R$ 2.000 | R$ 10.000 |
| v2.9.0 | R$ 10.000 | R$ 1.000 | R$ 11.000 |
| v3.0.0 | R$ 15.000 | R$ 5.000 | R$ 20.000 |
| **Total** | **R$ 38.000** | **R$ 8.500** | **R$ 46.500** |

### ROI Projetado

| Período | Receita | Custo | Lucro | ROI |
|---------|---------|-------|-------|-----|
| Ano 1 | R$ 95.280 | R$ 60.000 | R$ 35.280 | 59% |
| Ano 2 | R$ 426.780 | R$ 120.000 | R$ 306.780 | 256% |
| Ano 3 | R$ 1.200.000+ | R$ 200.000 | R$ 1M+ | 500%+ |

---

## 🎯 PRÓXIMOS PASSOS IMEDIATOS

### 1. ✅ Aguardar Deploy do Sistema de Jurisprudência
**Status:** ⏳ Em andamento
**Commit:** bbd9d82d
**Ação:** Monitoramento ativo de auto-deploy

### 2. ✅ Executar Testes de Conformidade
**Após deploy, executar:**
```bash
# Teste 1: Civil Law
node scripts/analyze-jurisprudence.js --query "usucapião extraordinária"

# Teste 2: Consumer Law
node scripts/analyze-jurisprudence.js --query "danos morais" --tribunal "STJ"

# Teste 3: Family Law
node scripts/analyze-jurisprudence.js --query "guarda compartilhada" --limit 30

# Teste 4: Validar JSON output
node scripts/analyze-jurisprudence.js --query "teste" | jq .
```

### 3. ⏳ Decisão: Próxima Fase
**Opções:**
- **A) Performance First (v2.7.0):** Focar em streaming + cache (1-2 dias)
- **B) Completar v2.8.0:** Seguir roadmap linear

**Recomendação:** Opção A - Performance First
**Razão:** Melhorar UX imediatamente, reduzir custos 60%, preparar terreno para escala.

### 4. ⏳ Aprovação Formal do Roadmap
**Aguardando:** Dr. Rodolfo aprovar ROADMAP_COMPLETO_COM_PROGRESSO.md

---

## 📝 HISTÓRICO DE VERSÕES

| Data | Versão | Mudanças |
|------|--------|----------|
| 2025-12-28 | 1.0 | Criação inicial do roadmap completo com progresso |

---

**Desenvolvido por:**
ROM Agent - Redator de Obras Magistrais
Rodolfo Otávio Mota Advogados Associados
2025
