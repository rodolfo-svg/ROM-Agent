# ✅ Roteiro Staging (Render) - Deploy Incremental

**Branch**: `staging` (commit: `0dd64067`)
**Service**: rom-agent-ia-onrender-com.onrender.com
**Estratégia**: Deploy fail-safe → Ativar gradualmente

---

## 📋 PRÉ-REQUISITOS

- [x] Branches main e staging sincronizadas (commit 0dd64067)
- [x] Código dos PRs #4, #5, #6 merged
- [x] Scripts de validação prontos
- [ ] Acesso ao Render Dashboard
- [ ] Admin Token disponível

---

## 🎯 ETAPA 1: Confirmar Serviço no Branch Correto

### Render Dashboard → Service Settings

1. Acessar: https://dashboard.render.com
2. Service: **rom-agent-ia-onrender-com**
3. Tab: **Settings** → **Build & Deploy**

### Verificar Configuração:

```
✓ Deploy Branch: staging
✓ Auto-Deploy: Yes (recomendado)
```

### Deploy Manual (se necessário):

1. Clicar em **"Manual Deploy"**
2. Selecionar **"Deploy latest commit"**
3. Aguardar deploy completar (~3-5 min)

### Validar Commit Deployado:

Após deploy, verificar em **"Events"** ou **"Logs"**:
```
Deployed commit: 0dd64067 (ou posterior)
Status: Live
```

**Validação via API**:
```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/api/info | jq -r '.versao, .timestamp'
```

- [ ] **CHECKPOINT 1**: Serviço rodando no branch staging com commit correto

---

## 🎯 ETAPA 2: Definir ENV Base (Fail-Safe) + Alinhar Bottleneck

### Render Dashboard → Settings → Environment

**Configurar variáveis de ambiente**:

### Feature Flags (TODAS OFF inicialmente):
```bash
ENABLE_RETRY=true              # ✅ ON (já validado anteriormente)
ENABLE_METRICS=true            # ✅ ON (necessário para observabilidade)
ENABLE_CIRCUIT_BREAKER=false   # ❌ OFF (ativar na Etapa 4)
ENABLE_BOTTLENECK=false        # ❌ OFF (ativar na Etapa 5)
ENABLE_GUARDRAILS=false        # ❌ OFF (P0-3 ainda não implementado)
```

### Parâmetros Bottleneck (recomendado):
```bash
MAX_CONCURRENT=5               # Processar 5 requisições simultâneas
MAX_QUEUE=20                   # Fila de até 20 requisições
```

### Parâmetros Circuit Breaker:
```bash
CIRCUIT_BREAKER_THRESHOLD=5    # 5 falhas para abrir circuito
```

### Outros (manter existentes):
```bash
MAX_RETRIES=3
LOG_LEVEL=info
GUARDRAIL_MODE=off
GUARDRAIL_SOFT_LIMIT=12
GUARDRAIL_HARD_LIMIT=25
```

### Ações:
1. Modificar variáveis conforme acima
2. Clicar em **"Save Changes"**
3. Aguardar redeploy automático (~3-5 min)
4. Verificar status: **"Live"**

- [ ] **CHECKPOINT 2**: ENV base configurado, flags OFF (fail-safe)

---

## 🎯 ETAPA 3: Validar Base (Sem Resiliência Ligada)

### 3.1. Verificar Versão e Commit

```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/api/info | jq '.'
```

**Esperado**:
- `versao`: "2.4.19" (ou atual)
- `health.status`: "healthy"
- `bedrock.status`: "connected"

### 3.2. Verificar Métricas Base

```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/metrics | grep -E "http_requests_total|http_request_duration"
```

**Esperado**:
- ✅ `http_requests_total` presente
- ✅ `http_request_duration_seconds` presente
- ❌ `circuit_breaker_*` ausente (ainda OFF)
- ❌ `bottleneck_*` ausente (ainda OFF)

### 3.3. Smoke Test (20 requisições)

```bash
cd ~/ROM-Agent
./scripts/smoke-test-pr5.sh
```

**Critério de Sucesso**:
- ✅ 90%+ de sucesso (18-20 requisições)
- ✅ Endpoints `/health`, `/api/info`, `/metrics` funcionando
- ✅ API respondendo (mesmo com HTTP 500 por falta de Bedrock válido)

### 3.4. Verificar Feature Flags

```bash
export ADMIN_TOKEN="63a2de1784b57db90b3139277e1ed75b0daca799073c638442f57a46e79bc4ff"

curl -H "X-Admin-Token: $ADMIN_TOKEN" \
  https://rom-agent-ia-onrender-com.onrender.com/admin/flags | jq '.flags'
```

**Esperado**:
```json
{
  "ENABLE_RETRY": true,
  "ENABLE_METRICS": true,
  "ENABLE_CIRCUIT_BREAKER": false,
  "ENABLE_BOTTLENECK": false,
  "ENABLE_GUARDRAILS": false,
  "MAX_CONCURRENT": 5,
  "MAX_QUEUE": 20,
  "CIRCUIT_BREAKER_THRESHOLD": 5
}
```

- [ ] **CHECKPOINT 3**: Base validada, API funcionando, flags corretas

---

## 🎯 ETAPA 4: Ligar Circuit Breaker (Redeploy)

### Render Dashboard → Settings → Environment

**Modificar APENAS**:
```bash
ENABLE_CIRCUIT_BREAKER=true    # Mudar de false para true
```

**Manter**:
```bash
ENABLE_BOTTLENECK=false        # Ainda OFF
MAX_CONCURRENT=5
MAX_QUEUE=20
# ... resto igual
```

### Ações:
1. Modificar `ENABLE_CIRCUIT_BREAKER=true`
2. Save Changes
3. Aguardar redeploy (~3-5 min)
4. Verificar status: "Live"

### 4.1. Validar Circuit Breaker Ativo

```bash
curl -H "X-Admin-Token: $ADMIN_TOKEN" \
  https://rom-agent-ia-onrender-com.onrender.com/admin/flags | jq '.flags.ENABLE_CIRCUIT_BREAKER'
```

**Esperado**: `true`

### 4.2. Verificar Métricas Circuit Breaker

```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/metrics | grep -E "circuit_breaker|model_fallback"
```

**Esperado**:
```
circuit_breaker_state{state="CLOSED"} 0
circuit_breaker_success_total{operation="converse"} X
circuit_breaker_failure_total{operation="converse"} X
circuit_breaker_rejected_total{operation="converse"} X
model_fallback_total{from_model="...",to_model="..."} X
model_fallback_attempt_total{model_id="..."} X
model_fallback_success_total{model_id="..."} X
model_fallback_exhausted_total X
```

### 4.3. Executar Validação Completa

```bash
cd ~/ROM-Agent
./scripts/validate-circuit-breaker.sh
```

**O script vai**:
1. Verificar estado inicial (CLOSED)
2. Forçar 5 falhas consecutivas
3. Confirmar transição CLOSED → OPEN
4. Aguardar cooldown (30s)
5. Confirmar transição OPEN → HALF_OPEN
6. Enviar requisição de sucesso
7. Confirmar transição HALF_OPEN → CLOSED

**Critério de Sucesso**:
- ✅ Ciclo completo de estados confirmado
- ✅ Métricas incrementando corretamente
- ✅ Cooldown de 30s funcionando

### 4.4. Validar Model Fallback (Observação)

Nesta fase, sem credenciais Bedrock válidas, o fallback não será testado completamente.

**Verificar que as métricas existem**:
```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/metrics | grep "model_fallback"
```

**Esperado**: Métricas presentes (valores podem ser 0)

- [ ] **CHECKPOINT 4**: Circuit Breaker ativado e validado

---

## 🎯 ETAPA 5: Ligar Bottleneck (Redeploy)

### Render Dashboard → Settings → Environment

**Modificar APENAS**:
```bash
ENABLE_BOTTLENECK=true         # Mudar de false para true
```

**Manter**:
```bash
ENABLE_CIRCUIT_BREAKER=true    # Já ativo
MAX_CONCURRENT=5
MAX_QUEUE=20
# ... resto igual
```

### Ações:
1. Modificar `ENABLE_BOTTLENECK=true`
2. Save Changes
3. Aguardar redeploy (~3-5 min)
4. Verificar status: "Live"

### 5.1. Validar Bottleneck Ativo

```bash
curl -H "X-Admin-Token: $ADMIN_TOKEN" \
  https://rom-agent-ia-onrender-com.onrender.com/admin/flags | jq '.flags.ENABLE_BOTTLENECK'
```

**Esperado**: `true`

### 5.2. Verificar Métricas Bottleneck

```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/metrics | grep "bottleneck"
```

**Esperado**:
```
bottleneck_running_total{operation="converse"} X
bottleneck_queued_total{operation="converse"} X
bottleneck_rejected_total{operation="converse"} X
bottleneck_completed_total{operation="converse"} X
bottleneck_queue_size{operation="converse"} X
bottleneck_timeout_total{operation="converse"} X
```

### 5.3. Executar Validação Completa

```bash
cd ~/ROM-Agent
./scripts/validate-bottleneck.sh
```

**O script vai**:
1. Verificar métricas iniciais
2. Enviar rajada de 30 requisições simultâneas
3. Validar rejeições HTTP 503
4. Contar distribuição de respostas (200, 500, 503)
5. Verificar métricas finais

**Critério de Sucesso**:
- ✅ Capacidade: 25 requisições (5 concurrent + 20 queue)
- ✅ Rejeições: ~5 requisições com HTTP 503
- ✅ Métricas `bottleneck_rejected_total` > 0

- [ ] **CHECKPOINT 5**: Bottleneck ativado e validado

---

## 🎯 ETAPA 6: Soak Test (24h - Monitoramento)

### Configuração Final Ativa:

```bash
ENABLE_RETRY=true              ✅
ENABLE_CIRCUIT_BREAKER=true    ✅
ENABLE_BOTTLENECK=true         ✅
ENABLE_METRICS=true            ✅
ENABLE_GUARDRAILS=false        ❌ (P0-3 pendente)

MAX_CONCURRENT=5
MAX_QUEUE=20
CIRCUIT_BREAKER_THRESHOLD=5
```

### Métricas para Monitorar (24h):

#### 1. Taxa de Rejeição (HTTP 503)
```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/metrics | grep "bottleneck_rejected_total"
```

**Análise**:
- Normal: < 5% das requisições totais
- Alerta: > 10% (pode indicar capacidade insuficiente)

#### 2. Frequência de Circuit Breaker OPEN
```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/metrics | grep "circuit_breaker_state"
```

**Análise**:
- Normal: CLOSED (0) a maior parte do tempo
- Alerta: OPEN (2) frequente (pode indicar problema upstream)

#### 3. Fallback de Modelos (4.5 → 3.7 → 3.5)
```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/metrics | grep "model_fallback_total"
```

**Análise**:
- Normal: Fallback ocasional (<10% das requisições)
- Alerta: Fallback frequente (>20% - Sonnet 4.5 pode estar instável)
- Crítico: `model_fallback_exhausted_total` > 0 (todos modelos falharam)

#### 4. Latência (p95/p99)
```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/metrics | grep "http_request_duration_seconds"
```

**Análise**:
- Normal: p95 < 5s, p99 < 10s
- Alerta: p95 > 10s, p99 > 30s

#### 5. Taxa de Sucesso Global
```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/metrics | grep "http_requests_total"
```

**Análise**:
- Normal: 200/201 > 80% das requisições
- Alerta: 500/503 > 20% (investigar)

### Script de Monitoramento Contínuo

```bash
# Monitorar a cada 5 minutos por 24h
cd ~/ROM-Agent

# Criar script de monitoramento
cat > scripts/monitor-soak-24h.sh << 'EOF'
#!/bin/bash
URL="https://rom-agent-ia-onrender-com.onrender.com"
DURATION_HOURS=24
INTERVAL_SECONDS=300  # 5 minutos

END_TIME=$(($(date +%s) + DURATION_HOURS * 3600))

while [ $(date +%s) -lt $END_TIME ]; do
  echo "========================================="
  echo "📊 Soak Test - $(date '+%Y-%m-%d %H:%M:%S')"
  echo "========================================="

  # Health
  curl -sS "$URL/health" | jq -r '.status'

  # Métricas críticas
  echo ""
  echo "Circuit Breaker State:"
  curl -sS "$URL/metrics" | grep "circuit_breaker_state" | tail -1

  echo ""
  echo "Bottleneck Rejections:"
  curl -sS "$URL/metrics" | grep "bottleneck_rejected_total" | tail -1

  echo ""
  echo "Model Fallback:"
  curl -sS "$URL/metrics" | grep "model_fallback_exhausted_total" | tail -1

  echo ""
  echo "HTTP Requests (últimas 10):"
  curl -sS "$URL/metrics" | grep "http_requests_total" | tail -10

  echo ""
  echo "Próxima verificação em $INTERVAL_SECONDS segundos..."
  echo ""

  sleep $INTERVAL_SECONDS
done

echo "✅ Soak test de 24h completo!"
EOF

chmod +x scripts/monitor-soak-24h.sh

# Executar em background
nohup ./scripts/monitor-soak-24h.sh > soak-test-24h.log 2>&1 &
echo "Monitor iniciado. Ver log: tail -f soak-test-24h.log"
```

- [ ] **CHECKPOINT 6**: Soak test de 24h iniciado

---

## 📊 CRITÉRIOS DE GO/NO-GO PARA PRODUÇÃO

### ✅ GO (Aprovar para Produção)

Após 24h de soak test, verificar:

- [x] **Estabilidade**: Serviço manteve status "Live" por 24h
- [x] **Taxa de Sucesso**: > 90% de requisições bem-sucedidas
- [x] **Rejeições Bottleneck**: < 5% das requisições (503)
- [x] **Circuit Breaker**: Sem OPEN prolongado (>5 min)
- [x] **Fallback**: < 10% de fallbacks (ou 0 se sem tráfego real)
- [x] **Latência**: p95 < 5s, p99 < 10s
- [x] **Métricas**: Todas funcionando e incrementando corretamente
- [x] **Logs**: Sem erros críticos ou crashes

### ❌ NO-GO (Manter em Staging)

Bloquear produção se:

- [ ] Crashes ou restarts frequentes
- [ ] Taxa de sucesso < 80%
- [ ] Circuit Breaker em OPEN > 50% do tempo
- [ ] Fallback exhausted (todos modelos falhando)
- [ ] Latência p99 > 30s
- [ ] Métricas não incrementando ou com valores estranhos
- [ ] Erros desconhecidos nos logs

---

## 🚨 PLANO DE ROLLBACK

Se qualquer problema crítico for detectado:

### Opção 1: Desativar Features via ENV (Rápido - 3-5 min)

```bash
# No Render Dashboard → Environment:
ENABLE_CIRCUIT_BREAKER=false
ENABLE_BOTTLENECK=false

# Save Changes → Redeploy automático
```

### Opção 2: Reverter para Commit Anterior (Médio - 5-10 min)

```bash
# No Render Dashboard → Manual Deploy:
# Selecionar commit anterior estável (antes dos PRs)
# Ex: commit antes de fd07a850
```

### Opção 3: Mudar Deploy Branch (Drástico - 10-15 min)

```bash
# No Render Dashboard → Settings → Build & Deploy:
# Deploy Branch: main (em vez de staging)
# Manual Deploy → Deploy latest commit
```

---

## 📝 CHECKLIST FINAL

### Pré-Deploy:
- [x] Código merged em staging (0dd64067)
- [x] Scripts de validação prontos
- [x] Documentação completa

### Deploy Incremental:
- [ ] Etapa 1: Serviço no branch correto
- [ ] Etapa 2: ENV base configurado (fail-safe)
- [ ] Etapa 3: Base validada (smoke test)
- [ ] Etapa 4: Circuit Breaker ativado e validado
- [ ] Etapa 5: Bottleneck ativado e validado
- [ ] Etapa 6: Soak test 24h completo

### Pós-Soak:
- [ ] Análise de métricas
- [ ] Decisão GO/NO-GO
- [ ] Deploy em produção OU correções

---

**Criado por**: Claude Code (Sonnet 4.5)
**Data**: 2025-12-18T21:00:00Z
**Versão**: ROM Agent Beta 2.8.1.1
