# PR#5 - Circuit Breaker + Fallback - Validação Staging

**Data**: 2025-12-18
**Branch**: `feature/go-live-circuit-breaker` → `main`
**Commits**:
- `fd07a850` - feat(resilience): Add Circuit Breaker + Model Fallback (PR#5)
- `65d65e96` - Merge PR#5: Circuit Breaker + Model Fallback

---

## 📋 CHECKLIST DE DEPLOY - STAGING (iarom.com.br)

### 1. ✅ Subir em Staging com FLAGS OFF

**Configuração Inicial** (fail-safe):
```bash
# Deploy com flags desabilitadas
ENABLE_CIRCUIT_BREAKER=false
ENABLE_RETRY=false  # Já existente
ENABLE_BOTTLENECK=false  # Já existente
```

**Motivo**: Garantir que o código está presente mas inativo, permitindo rollback instantâneo via flags sem redeploy.

**Validação**:
```bash
curl https://iarom.com.br/api/info
# Verificar que flags aparecem como "false"
```

---

### 2. 🧪 Smoke Test (10-20 requisições reais)

**Script de Teste**:
```bash
#!/bin/bash
# smoke-test-pr5.sh

STAGING_URL="https://iarom.com.br"
echo "=== PR#5 Smoke Test - Circuit Breaker OFF ==="

for i in {1..20}; do
  echo "Request $i..."
  curl -s -X POST "$STAGING_URL/api/chat" \
    -H "Content-Type: application/json" \
    -d '{
      "mensagem": "Teste rápido PR#5",
      "conversationId": "smoke-test-'$i'"
    }' | jq -r '.sucesso, .erro'

  sleep 2
done

echo "✅ Smoke test completo"
```

**Critério de Sucesso**:
- ✅ 18-20 requisições bem-sucedidas (90-100%)
- ✅ Sem erros relacionados a circuit breaker
- ✅ Tempo de resposta normal (< 5s)

---

### 3. 🔴 Ligar Circuit Breaker em Staging

**Atualizar ENV**:
```bash
ENABLE_CIRCUIT_BREAKER=true
CIRCUIT_BREAKER_THRESHOLD=3  # Baixo para testes rápidos
```

**Redeploy** (Render):
```bash
# Via Render Dashboard:
# 1. Settings → Environment
# 2. Atualizar ENABLE_CIRCUIT_BREAKER=true
# 3. Save → Manual Deploy
```

**Validação Básica**:
```bash
curl https://iarom.com.br/metrics | grep circuit_breaker_state
# Espera: circuit_breaker_state{state="CLOSED"} 0
```

---

#### 3.1. Validar Abertura/Fechamento do Circuit Breaker

**Teste de Abertura** (forçar erros):
```bash
#!/bin/bash
# test-circuit-breaker-open.sh

STAGING_URL="https://iarom.com.br"
echo "=== Forçando Falhas para Abrir Circuit Breaker ==="

# Simular 5 requisições com timeout/erro
for i in {1..5}; do
  echo "Erro forçado $i..."
  curl -s -X POST "$STAGING_URL/api/chat" \
    -H "Content-Type: application/json" \
    -d '{
      "mensagem": "FORCE_TIMEOUT_ERROR",
      "conversationId": "cb-test-'$i'"
    }' --max-time 2

  sleep 1
done

echo ""
echo "✅ Checando estado do circuit breaker..."
curl -s https://iarom.com.br/metrics | grep -E "circuit_breaker_state|circuit_breaker_rejected"
```

**Resultado Esperado**:
```
circuit_breaker_state{state="OPEN"} 2
circuit_breaker_rejected_total{operation="converse"} 2
circuit_breaker_failure_total{operation="converse"} 3
```

**Teste de Fechamento** (aguardar cooldown):
```bash
# Aguardar 30s (cooldown padrão)
echo "Aguardando cooldown (30s)..."
sleep 30

# Verificar transição para HALF_OPEN
curl -s https://iarom.com.br/metrics | grep circuit_breaker_state
# Espera: circuit_breaker_state{state="HALF_OPEN"} 1

# Enviar requisição de sucesso
curl -s -X POST https://iarom.com.br/api/chat \
  -H "Content-Type: application/json" \
  -d '{"mensagem": "Teste recuperação", "conversationId": "cb-recovery"}'

# Verificar retorno para CLOSED
curl -s https://iarom.com.br/metrics | grep circuit_breaker_state
# Espera: circuit_breaker_state{state="CLOSED"} 0
```

---

### 4. 🔄 Validar Model Fallback

**Configuração**:
```bash
# Circuit breaker já ativo
ENABLE_CIRCUIT_BREAKER=true
```

**Teste de Fallback** (simular falha do modelo primário):

**Opção A: Forçar erro via código** (temporário):
```javascript
// Em model-fallback.js, adicionar log de fallback
console.log('[FALLBACK] Trying model:', currentModelId);
```

**Opção B: Monitorar métricas durante falha real**:
```bash
# Executar requisição que falhe no Sonnet 4.5
curl -s -X POST https://iarom.com.br/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mensagem": "Teste com prompt muito longo...[repetir 10000x]",
    "conversationId": "fallback-test"
  }'

# Verificar métricas de fallback
curl -s https://iarom.com.br/metrics | grep model_fallback
```

**Resultado Esperado**:
```
model_fallback_total{from_model="anthropic.claude-sonnet-4-5-v2:0",to_model="us.anthropic.claude-sonnet-3-7-v1:0"} 1
model_fallback_attempt_total{model_id="us.anthropic.claude-sonnet-3-7-v1:0"} 1
model_fallback_success_total{model_id="us.anthropic.claude-sonnet-3-7-v1:0"} 1
```

**Validação de Qualidade**:
- ✅ Resposta gerada com sucesso
- ✅ Modelo usado: Sonnet 3.7 ou 3.5 (não 4.5)
- ✅ Tempo de resposta razoável
- ✅ Sem perda de contexto

---

### 5. 📊 Validar Métricas

**Endpoint de Métricas**:
```bash
curl https://iarom.com.br/metrics
```

**Métricas Obrigatórias**:

#### Circuit Breaker:
```
# HELP circuit_breaker_state Current circuit breaker state (CLOSED=0, HALF_OPEN=1, OPEN=2)
# TYPE circuit_breaker_state gauge
circuit_breaker_state{state="CLOSED"} 0

# HELP circuit_breaker_rejected_total Total requests rejected due to open circuit
# TYPE circuit_breaker_rejected_total counter
circuit_breaker_rejected_total{operation="converse"} 0

# HELP circuit_breaker_success_total Total successful requests through circuit breaker
# TYPE circuit_breaker_success_total counter
circuit_breaker_success_total{operation="converse"} 125

# HELP circuit_breaker_failure_total Total failed requests through circuit breaker
# TYPE circuit_breaker_failure_total counter
circuit_breaker_failure_total{operation="converse"} 3
```

#### Model Fallback:
```
# HELP model_fallback_total Total model fallback transitions
# TYPE model_fallback_total counter
model_fallback_total{from_model="anthropic.claude-sonnet-4-5-v2:0",to_model="us.anthropic.claude-sonnet-3-7-v1:0"} 2

# HELP model_fallback_attempt_total Total fallback attempts per model
# TYPE model_fallback_attempt_total counter
model_fallback_attempt_total{model_id="anthropic.claude-sonnet-4-5-v2:0"} 100
model_fallback_attempt_total{model_id="us.anthropic.claude-sonnet-3-7-v1:0"} 2

# HELP model_fallback_success_total Total successful fallbacks per model
# TYPE model_fallback_success_total counter
model_fallback_success_total{model_id="us.anthropic.claude-sonnet-3-7-v1:0"} 2

# HELP model_fallback_exhausted_total Total times all models in chain failed
# TYPE model_fallback_exhausted_total counter
model_fallback_exhausted_total 0
```

**Validação**:
- ✅ Todos os contadores incrementando corretamente
- ✅ Circuit breaker state reflete estado real
- ✅ Nenhum fallback_exhausted (todos os modelos falhando)

---

### 6. 🔙 Plano de Rollback

#### Opção 1: Rollback Instantâneo (via FLAGS) ⚡
```bash
# Desabilitar Circuit Breaker
ENABLE_CIRCUIT_BREAKER=false

# Sistema volta ao comportamento anterior (apenas Retry + Bottleneck)
# Não requer redeploy
```

**Tempo**: < 5 minutos
**Impacto**: Zero downtime

#### Opção 2: Rollback via Git (caso código tenha bugs)
```bash
# 1. Reverter merge
git revert 65d65e96 -m 1

# 2. Commit
git commit -m "Revert PR#5: Circuit Breaker + Fallback"

# 3. Push
git push origin main

# 4. Redeploy em staging
```

**Tempo**: 5-10 minutos
**Impacto**: Downtime durante redeploy

#### Opção 3: Rollback via Render (UI)
```
1. Render Dashboard → ROM-Agent-Staging
2. "Manual Deploy" → "Deploy from Branch"
3. Selecionar commit anterior: 67b05365
4. Confirmar deploy
```

**Tempo**: 5-10 minutos
**Impacto**: Downtime durante redeploy

---

## 📝 CHECKLIST DE VALIDAÇÃO - RESUMO

| #   | Teste                              | Status | Evidência                          |
|-----|-------------------------------------|--------|------------------------------------|
| 1   | Deploy com flags OFF               | ⏳      | Logs do Render                    |
| 2   | Smoke test (20 requisições)        | ⏳      | 90%+ sucesso                      |
| 3   | Ligar Circuit Breaker              | ⏳      | Métricas mostram CLOSED           |
| 3.1 | Forçar abertura (5 erros)          | ⏳      | Estado OPEN nas métricas          |
| 3.2 | Validar cooldown → HALF_OPEN       | ⏳      | Transição após 30s                |
| 3.3 | Validar recuperação → CLOSED       | ⏳      | Sucesso fecha circuito            |
| 4   | Validar fallback Sonnet 4.5→3.7    | ⏳      | model_fallback_total > 0          |
| 5   | Validar métricas Prometheus        | ⏳      | Todos contadores funcionando      |
| 6   | Teste de rollback via flags        | ⏳      | Sistema volta ao normal           |

---

## 🚀 CRITÉRIOS DE GO/NO-GO PARA PRODUÇÃO

### ✅ GO (Deploy em Produção):
- ✅ Todos os 6 testes do checklist passaram
- ✅ Métricas funcionando corretamente
- ✅ Nenhum erro inesperado em 24h de staging
- ✅ Rollback via flags testado e funcional
- ✅ Equipe preparada para monitorar pós-deploy

### ❌ NO-GO (Manter em Staging):
- ❌ Qualquer teste falhando
- ❌ Erros ou crashes inesperados
- ❌ Métricas não incrementando
- ❌ Fallback não funcionando
- ❌ Circuit breaker causando false positives
- ❌ Rollback não funcional

---

## 📊 MONITORAMENTO PÓS-DEPLOY

**Alertas Recomendados** (Prometheus/Grafana):

```yaml
# Alerta 1: Circuit Breaker Aberto
- alert: CircuitBreakerOpen
  expr: circuit_breaker_state{state="OPEN"} == 2
  for: 5m
  annotations:
    summary: "Circuit breaker está OPEN há 5 minutos"

# Alerta 2: Fallback Exausto
- alert: ModelFallbackExhausted
  expr: increase(model_fallback_exhausted_total[5m]) > 0
  annotations:
    summary: "Todos os modelos falharam - cadeia de fallback exaurida"

# Alerta 3: Taxa de Rejeição Alta
- alert: HighRejectionRate
  expr: rate(circuit_breaker_rejected_total[5m]) > 10
  annotations:
    summary: "Taxa de rejeição > 10 req/s"
```

---

**Criado por**: Claude Code (Sonnet 4.5)
**Data**: 2025-12-18T20:10:00Z
**Projeto**: ROM Agent - Go Live Acelerado 2.8.1.1
