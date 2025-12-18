# GO LIVE ACELERADO - ROM Agent Beta 2.8.1.1

**Objetivo**: Colocar ROM Agent Beta em produção estável para 6-10 usuários simultâneos em **7 dias** (vs. 14 dias originais).

**Data início**: 2025-12-17
**Data término**: 2025-12-24
**Status**: 🟡 Aguardando início

---

## ESCOPO P0 - MÍNIMO VIÁVEL

### P0-1: Feature Flags + Rollback (BASE) - 1 dia
**Branch**: `feature/go-live-flags`
**Arquivos**:
- `src/utils/feature-flags.js` - Sistema de flags runtime
- `server.js` - Endpoints admin (POST /admin/reload-flags, GET /admin/flags)
- `.env.example` - Todas as flags documentadas

**Flags**:
```bash
BEDROCK_ENABLED=false
GUARDRAILS_ENABLED=false
CIRCUIT_BREAKER_ENABLED=false
RETRY_ENABLED=false
BOTTLENECK_LIMITER_ENABLED=false
MAX_LOOPS_SOFT=12
MAX_LOOPS_HARD=25
MAX_CONCURRENT_REQUESTS=6
```

**DoD**:
- [ ] Flags carregadas de .env
- [ ] Endpoint reload-flags funcional
- [ ] Endpoint flags retorna JSON
- [ ] Testes unitários flags.test.js
- [ ] ci:local passa (10 cores)
- [ ] ci:remote passa (staging.iarom.com.br)

---

### P0-2: Observabilidade Mínima - 2 dias (PARALLEL)
**Branch**: `feature/go-live-observability`
**Arquivos**:
- `src/middleware/request-logger.js` - traceId, requestId
- `src/utils/metrics-collector.js` - Prometheus básico
- `src/utils/structured-logger.js` - JSON logs

**Métricas**:
- `rom_requests_total` (counter)
- `rom_requests_duration_seconds` (histogram)
- `rom_bedrock_tokens_total` (counter)
- `rom_active_requests` (gauge)

**DoD**:
- [ ] Todo request tem traceId
- [ ] Logs estruturados JSON
- [ ] GET /metrics retorna Prometheus
- [ ] Testes observability.test.js
- [ ] ci:local + ci:remote passam

---

### P0-3: Guardrails Tool-Loop - 2 dias (PARALLEL)
**Branch**: `feature/go-live-guardrails`
**Arquivos**:
- `src/utils/loop-guardrails.js` - Contadores soft/hard
- `src/services/bedrock-integration.js` - Integração com tool-loop

**Lógica**:
- Loop 12 (soft): warning log
- Loop 25 (hard): força stop + fallback
- Detecção repetição: 3 mesmas tools seguidas = stop

**DoD**:
- [ ] Soft limit warning funciona
- [ ] Hard limit força parada
- [ ] Detecção repetição funciona
- [ ] Testes guardrails.test.js
- [ ] ci:local + ci:remote passam

---

### P0-4: Retry + Backoff - 1 dia (PARALLEL)
**Branch**: `feature/go-live-retry`
**Arquivos**:
- `src/utils/retry-with-backoff.js` - Retry exponencial + jitter

**Estratégia**:
- Retry apenas: 429, 5xx, timeout
- NÃO retry: 4xx (exceto 429)
- Max 3 tentativas
- Backoff: 1s, 2s, 4s + jitter ±20%

**DoD**:
- [ ] Retry funciona em 429
- [ ] NÃO retry em 400/404
- [ ] Jitter aplicado
- [ ] Testes retry.test.js
- [ ] ci:local + ci:remote passam

---

### P0-5: Circuit Breaker + Fallback - 1 dia (APÓS P0-4)
**Branch**: `feature/go-live-circuit-breaker`
**Arquivos**:
- `src/utils/circuit-breaker.js` - Estados CLOSED/OPEN/HALF_OPEN
- `src/utils/model-fallback.js` - Cadeia de fallback

**Estados**:
- CLOSED: normal
- OPEN: 5 falhas em 60s → bloqueia 30s
- HALF_OPEN: testa 1 request

**Fallback**:
- Primary: anthropic.claude-sonnet-4-5
- Fallback: anthropic.claude-sonnet-3-7

**DoD**:
- [ ] Circuit abre após 5 falhas
- [ ] Half-open testa recuperação
- [ ] Fallback preserva qualidade
- [ ] Testes circuit-breaker.test.js
- [ ] ci:local + ci:remote passam

---

### P0-6: Bottleneck Limiter - 1 dia (PARALLEL)
**Branch**: `feature/go-live-limiter`
**Arquivos**:
- `src/middleware/bottleneck-limiter.js` - Fila de concorrência

**Limites**:
- Max concurrent: 6
- Max queue: 10
- Timeout queue: 30s
- Rejeição: HTTP 503

**DoD**:
- [ ] Bloqueia request #7
- [ ] Fila até 10
- [ ] HTTP 503 após fila cheia
- [ ] Testes limiter.test.js
- [ ] ci:local + ci:remote passam

---

### P0-7: Backup + Git Tags - 0.5 dia (PARALLEL)
**Branch**: `feature/go-live-backup`
**Arquivos**:
- `scripts/backup-before-pr.sh` - Backup automático
- `scripts/create-checkpoint.sh` - Git tags

**Fluxo**:
```bash
# Antes de cada merge
./scripts/backup-before-pr.sh
git tag -a v2.8.1.1-checkpoint-1 -m "Pre-merge PR#1"
git push origin v2.8.1.1-checkpoint-1
```

**DoD**:
- [ ] Script backup funciona
- [ ] Tags criadas corretamente
- [ ] Rollback testado
- [ ] Documentação rollback.md

---

## AUTOMAÇÃO - SCRIPTS

### scripts/ci-local.sh
```bash
#!/bin/bash
set -e
echo "🧪 CI Local (10 cores)"
npm run lint
npm run test -- --maxWorkers=10
echo "✅ CI Local passou"
```

### scripts/ci-remote.sh
```bash
#!/bin/bash
set -e
BASE_URL="${BASE_URL:-https://staging.iarom.com.br}"
echo "🌐 CI Remote: $BASE_URL"
curl -f "$BASE_URL/health" || exit 1
curl -f "$BASE_URL/metrics" || exit 1
echo "✅ CI Remote passou"
```

### scripts/gate-checker.js
```javascript
// Verifica gates automáticos para canary
const axios = require('axios');

async function checkGates() {
  const metrics = await axios.get('https://iarom.com.br/metrics');
  const text = metrics.data;

  // Parse métricas
  const errorRate = parseMetric(text, 'rom_requests_total{status="error"}');
  const totalRate = parseMetric(text, 'rom_requests_total');
  const errorPercent = (errorRate / totalRate) * 100;

  const p95Latency = parseMetric(text, 'rom_requests_duration_seconds{quantile="0.95"}');

  // Gates
  const gates = {
    errorRate: errorPercent < 1.0, // <1% erro
    latency: p95Latency < 30.0,    // <30s P95
    memory: await checkMemory() < 75 // <75% RAM
  };

  console.log('Gates:', gates);
  return Object.values(gates).every(g => g);
}

module.exports = { checkGates };
```

---

## TIMELINE - 7 DIAS

### Dia 1 (17/12) - Flags
- 08:00 - Criar branch flags
- 10:00 - Implementar feature-flags.js
- 12:00 - Adicionar endpoints admin
- 14:00 - Testes unitários
- 16:00 - ci:local + ci:remote
- 17:00 - Criar PR#1
- **STOP → Aguardar aprovação merge**

### Dia 2-3 (18-19/12) - Parallel (4 PRs)
- Dia 2 manhã: Implementar observability + guardrails + retry + limiter
- Dia 2 tarde: Testes unitários (4 PRs)
- Dia 3 manhã: ci:local para os 4 (paralelo)
- Dia 3 tarde: ci:remote para os 4
- Dia 3 final: Criar PR#2,3,4,6
- **STOP → Aguardar aprovação merge**

### Dia 4 (20/12) - Circuit Breaker
- Após merge PR#2,3,4,6
- Implementar circuit-breaker + fallback
- Testes + CI
- Criar PR#5
- **STOP → Aguardar aprovação merge**

### Dia 5 (21/12) - Smoke Tests + Deploy
- Smoke tests em staging.iarom.com.br
- Load test: 10 users, 20-30 min
- Deploy produção com flags OFF
- **STOP → Aguardar aprovação deploy**

### Dia 6-7 (22-23/12) - Canary
- Fase 1: 10% tráfego, aguardar gate (2h)
- Fase 2: 50% tráfego, aguardar gate (4h)
- Fase 3: 100% tráfego, monitorar 24h
- **STOP → Aguardar aprovação ativação flags em cada fase**

---

## CAPACIDADE - RENDER 2GB/1CPU

### Limites Seguros
- **6 concurrent requests**: 60% RAM (SAFE)
- **10 concurrent requests**: 91% RAM (CRITICAL)
- **Max 2 exhaustive analyses** simultâneas

### Thresholds
- Alerta: RAM >75% OU 429 rate >5%
- Crítico: RAM >90% OU 429 rate >10%

### Upgrade Triggers
- 429 rate >10% por 1h
- RAM >80% sustentada 1h
- P95 latency >45s por 30min

---

## ROLLBACK PROCEDURES

### Rollback via Flags (PREFERENCIAL)
```bash
# Desabilitar feature específica
curl -X POST https://iarom.com.br/admin/reload-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "BEDROCK_ENABLED=false"
```

### Rollback via Git
```bash
# Reverter para checkpoint anterior
git checkout v2.8.1.1-checkpoint-3
git push origin main --force-with-lease
# Redeploy Render
```

### Rollback via Render
```bash
# Via Render Dashboard
# Deploy → History → Rollback to previous deploy
```

---

## MÉTRICAS DE SUCESSO

### P0 - Obrigatórias
- [ ] Zero regressão qualidade (blind test)
- [ ] <1% erro em produção
- [ ] P95 latency <30s
- [ ] RAM <75% sustained
- [ ] 6 usuários simultâneos estáveis
- [ ] Rollback <5 min (flags) ou <15 min (git)

### P1 - Desejáveis
- 39% redução custo AWS (vs baseline atual)
- 94% economia vs Claude API mantida
- Uptime >99.5%

---

## STOP POINTS - APROVAÇÃO OBRIGATÓRIA

1. **Merge para main** (cada PR)
2. **Deploy produção** (Dia 5)
3. **Ativação flags** (Canary fases 1,2,3)
4. **Qualquer alteração fora escopo P0**

---

## REMOVER HEROKU - PADRONIZAR RENDER

### Arquivos para limpar
- `render.yaml` - Atualizar para 2GB/1CPU
- `README.md` - Remover menções Heroku
- `.github/workflows/*` - Apenas Render
- Variáveis ENV - Remover HEROKU_*

---

## PRÓXIMOS PASSOS

1. ✅ Commit documentação existente
2. ✅ Criar GO_LIVE_ACELERADO.md
3. ⏳ Criar scripts automação
4. ⏳ Iniciar PR#1 (Flags)

---

**Última atualização**: 2025-12-17
**Responsável**: Claude Code + Usuário
**Prazo**: 7 dias (até 24/12/2025)
