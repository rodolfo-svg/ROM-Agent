# Deploy e Validação PR#2 - Staging

**Objetivo**: Validar PR#2 (Observability + prom-client) em https://staging.iarom.com.br

**Branch**: `feature/go-live-observability`
**Commit**: `88c07bd4`

---

## 📋 PASSO 1: Deploy para Staging

### 1.1 Plataforma (Render/etc)
Deploy do branch `feature/go-live-observability` (commit `88c07bd4`) para:
```
https://staging.iarom.com.br
```

### 1.2 Configurar Variáveis de Ambiente (OBRIGATÓRIO)

```bash
# ============================================
# ADMIN (Obrigatório)
# ============================================
ADMIN_TOKEN=<executar: openssl rand -hex 32>

# ============================================
# FEATURE FLAGS (Todas OFF por segurança)
# ============================================
ENABLE_GUARDRAILS=false
ENABLE_RETRY=false
ENABLE_CIRCUIT_BREAKER=false
ENABLE_BOTTLENECK=false

# Métricas (ON para validação)
ENABLE_METRICS=true
LOG_LEVEL=info

# ============================================
# Parâmetros Numéricos (defaults seguros)
# ============================================
GUARDRAIL_MODE=off
GUARDRAIL_SOFT_LIMIT=12
GUARDRAIL_HARD_LIMIT=25
MAX_RETRIES=3
CIRCUIT_BREAKER_THRESHOLD=5
MAX_CONCURRENT=6
MAX_QUEUE=10

# ============================================
# AWS/Anthropic (manter existentes)
# ============================================
AWS_ACCESS_KEY_ID=<existente>
AWS_SECRET_ACCESS_KEY=<existente>
AWS_REGION=us-east-1
ANTHROPIC_API_KEY=<existente>

# Outras vars existentes...
```

---

## 📋 PASSO 2: Smoke Tests (OBRIGATÓRIO)

### 2.1 Executar CI Remote

**Comando**:
```bash
BASE_URL=https://staging.iarom.com.br \
  ADMIN_TOKEN="<token-configurado>" \
  ./scripts/ci-remote.sh
```

**Resultado Esperado**:
```
🌐 CI Remote - ROM Agent
URL: https://staging.iarom.com.br
====================================

🔍 Testing /health endpoint...
✅ Health check passed

🔍 Testing /metrics endpoint...
✅ Metrics endpoint passed

🔍 Testing /admin/flags endpoint...
✅ Admin flags endpoint passed

🔍 Testing /admin/reload-flags endpoint...
✅ Admin reload-flags endpoint passed

🔍 Testing /api/chat endpoint (basic)...
✅ API endpoint responding (HTTP 200/400/401)

====================================
✅ CI REMOTE PASSOU
====================================
```

**SE FALHAR**: STOP aqui, reportar output completo.

---

## 📋 PASSO 3: Verificar Métricas Prometheus

### 3.1 Verificar Formato e Nomes

**Comando**:
```bash
curl -s https://staging.iarom.com.br/metrics | egrep -n \
  'http_requests_total|http_request_duration_seconds_bucket|nodejs_heap_size_|bedrock_requests_total|bedrock_cost_usd_total|bedrock_errors_total|guardrails_triggered_total' | head -20
```

**Resultado Esperado** (exemplo):
```
15:http_requests_total{method="GET",path="/metrics",status="200"} 1
16:http_requests_total{method="GET",path="/health",status="200"} 1
30:http_request_duration_seconds_bucket{method="GET",path="/metrics",le="0.1"} 1
31:http_request_duration_seconds_bucket{method="GET",path="/metrics",le="0.5"} 1
32:http_request_duration_seconds_bucket{method="GET",path="/metrics",le="1"} 1
45:bedrock_requests_total 0
46:bedrock_tokens_total 0
47:bedrock_cost_usd_total 0
60:nodejs_heap_size_used_bytes 45678912
61:nodejs_heap_size_total_bytes 67108864
```

**Verificações**:
- ✅ Métrica `http_request_duration_seconds_bucket` presente
- ✅ Buckets `le="0.1"`, `le="0.5"`, `le="1"`, `le="5"`, `le="10"`, `le="30"`, `le="60"`
- ✅ Métricas bedrock/guardrails presentes (mesmo com valor 0)
- ✅ Heap metrics presentes

**SE FALHAR**: STOP aqui, reportar output.

---

## 📋 PASSO 4: Gate Checker Modo Rápido

### 4.1 Executar Gate Checker (15 minutos)

**Comando**:
```bash
STAGING_URL=https://staging.iarom.com.br \
  GATE_WINDOW_MS=900000 \
  GATE_INTERVAL_MS=60000 \
  node scripts/gate-checker.js
```

**Configuração**:
- STAGING_URL: https://staging.iarom.com.br
- GATE_WINDOW_MS: 900000 (15 minutos)
- GATE_INTERVAL_MS: 60000 (1 minuto - coleta a cada 1min)

**Duração**: ~15 minutos

**Resultado Esperado**:
```
🔍 Gate Checker (P95 via buckets) iniciado
URL: https://staging.iarom.com.br
Path alvo: /api/chat
Intervalo: 60s | Janela: 15min

[2025-12-17T...]
  • error_rate: 0.000% ✅
  • latency_p95: 0.50s ✅
  • ram: 45.00% ✅
  • cost/req: 0.000 ✅
  • 429_rate: 0.000% ✅
  • guardrails_fp(proxy): 0.000% ✅

... (coletas a cada 1 min por 15 min) ...

✅ ====================================
✅ TODOS OS GATES PASSARAM NA JANELA
✅ PODE AVANÇAR PARA PRÓXIMA FASE
✅ ====================================
```

**Exit Code**: 0

**Gates Verificados**:
- `error_rate < 0.1%` (5xx errors)
- `latency_p95 < 30s` (P95 via buckets)
- `ram < 70%` (nodejs heap)
- `cost/req < $0.50`
- `429_rate < 0.5%` (ThrottlingException)
- `guardrails_fp < 1%` (false positives proxy)

**SE FALHAR**:
- Exit code: 1
- Output mostrará qual gate falhou
- **STOP aqui, reportar output completo**
- NÃO avançar para PR#3/4/6

---

## 📋 DECISÃO FINAL

### ✅ SE TODOS OS TESTES PASSARAM:

1. **Merge PR#2 para main**:
   ```bash
   git checkout main
   git merge feature/go-live-observability --no-ff -m "Merge PR#2: Observability validada em staging"
   git push origin main
   ```

2. **Prosseguir em paralelo**:
   - Iniciar PR#3: Guardrails Tool-Loop
   - Iniciar PR#4: Retry + Backoff
   - Iniciar PR#6: Bottleneck Limiter

### ❌ SE QUALQUER TESTE FALHOU:

1. **STOP imediatamente**
2. **Reportar**:
   - Qual teste falhou
   - Output completo do erro
   - Métricas capturadas
3. **Corrigir** o problema
4. **Re-testar** completo antes de prosseguir

---

## 🔒 REGRAS INEGOCIÁVEIS

1. **Nenhum teste em localhost** - Sempre https://staging.iarom.com.br
2. **Todas flags OFF** exceto ENABLE_METRICS=true
3. **ADMIN_TOKEN obrigatório** - Sem token, sem deploy
4. **Gate checker deve PASSAR** - Não "passar de mentirinha"
5. **Fail-closed**: Se métricas faltando, gate FALHA

---

## 📊 Checklist de Validação

- [ ] Deploy feature/go-live-observability (88c07bd4) em staging
- [ ] ENV configurado (ADMIN_TOKEN + flags OFF)
- [ ] ci-remote.sh passou (todos endpoints OK)
- [ ] Métricas Prometheus verificadas (buckets, nomes corretos)
- [ ] Gate checker passou (15min, todos gates ✅)
- [ ] Merge PR#2 para main (só se tudo passou)

---

**Data**: 2025-12-17
**Status**: ⏸️ Aguardando deploy e validação em staging
**Next**: Executar passos 1-4, reportar resultados
