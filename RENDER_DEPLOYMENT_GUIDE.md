# Guia de Deploy Incremental - Render Dashboard

**Data**: 2025-12-18
**Ambiente**: Staging (rom-agent-ia-onrender-com.onrender.com)
**Estratégia**: Deploy incremental com validação entre etapas

---

## 🎯 Objetivo

Ativar Circuit Breaker (PR#5) e Bottleneck (PR#6) em staging de forma segura e validada.

---

## ⚙️ Configuração Atual (Antes das Mudanças)

```bash
# Feature Flags
ENABLE_GUARDRAILS=false
ENABLE_RETRY=true                    # ✅ Já ativo
ENABLE_CIRCUIT_BREAKER=false         # ❌ Desativado
ENABLE_BOTTLENECK=false              # ❌ Desativado
ENABLE_METRICS=true                  # ✅ Já ativo

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=5          # ✅ OK

# Bottleneck (valores inconsistentes)
MAX_CONCURRENT=6                     # ⚠️ Código default: 5
MAX_QUEUE=10                         # ⚠️ Código default: 20

# Guardrails
GUARDRAIL_MODE=off
GUARDRAIL_SOFT_LIMIT=12
GUARDRAIL_HARD_LIMIT=25

# Outros
MAX_RETRIES=3
LOG_LEVEL=info
```

---

## 📋 Plano de Execução (3 Etapas)

### **ETAPA A**: Alinhar Parâmetros do Bottleneck ⚙️
**Objetivo**: Corrigir inconsistências antes de ativar features
**Tempo Estimado**: 5min (redeploy)

### **ETAPA B**: Ativar Circuit Breaker 🔴
**Objetivo**: Validar Circuit Breaker + Model Fallback
**Tempo Estimado**: 10min (redeploy + validação)

### **ETAPA C**: Ativar Bottleneck 🚦
**Objetivo**: Validar controle de concorrência e fila
**Tempo Estimado**: 10min (redeploy + validação)

**Tempo Total**: ~25 minutos

---

## 🔧 ETAPA A: Alinhar Parâmetros do Bottleneck

### 1. Acessar Render Dashboard
```
URL: https://dashboard.render.com
Service: rom-agent-ia-onrender-com
Tab: Settings → Environment
```

### 2. Atualizar Variáveis de Ambiente

**Modificar**:
```bash
MAX_CONCURRENT=5    # Era: 6 → Novo: 5 (alinhado com código)
MAX_QUEUE=20        # Era: 10 → Novo: 20 (alinhado com código)
```

**Manter o resto igual**:
```bash
ENABLE_CIRCUIT_BREAKER=false  # Ainda OFF
ENABLE_BOTTLENECK=false       # Ainda OFF
ENABLE_RETRY=true
ENABLE_METRICS=true
CIRCUIT_BREAKER_THRESHOLD=5
# ... resto das variáveis
```

### 3. Salvar e Aguardar Redeploy
- Clicar em **"Save Changes"**
- Render vai iniciar redeploy automático
- Aguardar status: **"Live"** (geralmente 3-5 minutos)

### 4. Validar
```bash
# Verificar que flags não mudaram (ainda OFF)
curl -H "X-Admin-Token: 63a2de1784b57db90b3139277e1ed75b0daca799073c638442f57a46e79bc4ff" \
  https://rom-agent-ia-onrender-com.onrender.com/admin/flags | jq '.flags'

# Deve mostrar:
# MAX_CONCURRENT: 5
# MAX_QUEUE: 20
# ENABLE_CIRCUIT_BREAKER: false
# ENABLE_BOTTLENECK: false
```

✅ **Critério de Sucesso**: Parâmetros atualizados, features ainda OFF

---

## 🔴 ETAPA B: Ativar Circuit Breaker

### 1. Atualizar Variáveis de Ambiente

**Modificar APENAS**:
```bash
ENABLE_CIRCUIT_BREAKER=true   # Era: false → Novo: true
```

**Manter**:
```bash
ENABLE_BOTTLENECK=false       # Ainda OFF (ativar na Etapa C)
MAX_CONCURRENT=5
MAX_QUEUE=20
# ... resto igual
```

### 2. Salvar e Aguardar Redeploy
- **"Save Changes"**
- Aguardar status: **"Live"**

### 3. Validar Circuit Breaker Ativo

#### 3.1. Verificar Feature Flag
```bash
curl -H "X-Admin-Token: 63a2de1784b57db90b3139277e1ed75b0daca799073c638442f57a46e79bc4ff" \
  https://rom-agent-ia-onrender-com.onrender.com/admin/flags | jq '.flags.ENABLE_CIRCUIT_BREAKER'

# Deve retornar: true
```

#### 3.2. Verificar Métricas Prometheus
```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/metrics | grep -E "circuit_breaker|model_fallback"

# Deve aparecer:
# circuit_breaker_state{state="CLOSED"} 0
# circuit_breaker_success_total{operation="converse"} X
# model_fallback_attempt_total{...} X
```

✅ **Critério de Sucesso**: Métricas `circuit_breaker_*` e `model_fallback_*` presentes

---

### 4. Validar Transições do Circuit Breaker

#### Script de Validação
```bash
# Executar no terminal local:
cd ~/ROM-Agent
chmod +x scripts/validate-circuit-breaker.sh
./scripts/validate-circuit-breaker.sh
```

Ou manualmente:

#### 4.1. Verificar Estado Inicial (CLOSED)
```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/metrics | grep "circuit_breaker_state"
# Esperado: circuit_breaker_state{state="CLOSED"} 0
```

#### 4.2. Forçar 5 Falhas Consecutivas
```bash
# Enviar 5 requisições que vão falhar
for i in {1..5}; do
  echo "Falha $i/5..."
  curl -sS -X POST https://rom-agent-ia-onrender-com.onrender.com/api/chat \
    -H "Content-Type: application/json" \
    -d "{\"mensagem\": \"FORCE_ERROR_$i\", \"conversationId\": \"cb-test-$i\"}"
  sleep 1
done
```

#### 4.3. Verificar Transição para OPEN
```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/metrics | grep "circuit_breaker_state"
# Esperado: circuit_breaker_state{state="OPEN"} 2
```

#### 4.4. Aguardar Cooldown (30 segundos)
```bash
echo "Aguardando cooldown (30s)..."
sleep 30
```

#### 4.5. Verificar Transição para HALF_OPEN
```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/metrics | grep "circuit_breaker_state"
# Esperado: circuit_breaker_state{state="HALF_OPEN"} 1
```

#### 4.6. Enviar Requisição de Sucesso
```bash
curl -sS -X POST https://rom-agent-ia-onrender-com.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"mensagem": "Teste recuperação", "conversationId": "cb-recovery"}'
```

#### 4.7. Verificar Retorno para CLOSED
```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/metrics | grep "circuit_breaker_state"
# Esperado: circuit_breaker_state{state="CLOSED"} 0
```

✅ **Critério de Sucesso**: Ciclo completo CLOSED → OPEN → HALF_OPEN → CLOSED

---

### 5. Validar Model Fallback

**Nota**: Validação completa de fallback requer credenciais Bedrock válidas. Por ora, verificar que as métricas existem:

```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/metrics | grep "model_fallback"

# Deve aparecer (mesmo com valores 0):
# model_fallback_total{...} 0
# model_fallback_attempt_total{...} 0
# model_fallback_success_total{...} 0
# model_fallback_exhausted_total 0
```

✅ **Critério de Sucesso**: Métricas de fallback presentes (valores 0 são OK nesta fase)

---

## 🚦 ETAPA C: Ativar Bottleneck

### 1. Atualizar Variáveis de Ambiente

**Modificar APENAS**:
```bash
ENABLE_BOTTLENECK=true   # Era: false → Novo: true
```

**Manter**:
```bash
ENABLE_CIRCUIT_BREAKER=true  # Já ativo da Etapa B
MAX_CONCURRENT=5
MAX_QUEUE=20
# ... resto igual
```

### 2. Salvar e Aguardar Redeploy
- **"Save Changes"**
- Aguardar status: **"Live"**

### 3. Validar Bottleneck Ativo

#### 3.1. Verificar Feature Flag
```bash
curl -H "X-Admin-Token: 63a2de1784b57db90b3139277e1ed75b0daca799073c638442f57a46e79bc4ff" \
  https://rom-agent-ia-onrender-com.onrender.com/admin/flags | jq '.flags.ENABLE_BOTTLENECK'

# Deve retornar: true
```

#### 3.2. Verificar Métricas Prometheus
```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/metrics | grep "bottleneck"

# Deve aparecer:
# bottleneck_running_total{operation="converse"} X
# bottleneck_queued_total{operation="converse"} X
# bottleneck_rejected_total{operation="converse"} X
```

✅ **Critério de Sucesso**: Métricas `bottleneck_*` presentes

---

### 4. Validar Rejeição com Fila Cheia (HTTP 503)

#### Cenário de Teste:
- MAX_CONCURRENT = 5
- MAX_QUEUE = 20
- Total antes de rejeitar = 25 requisições

#### 4.1. Enviar Rajada de 30 Requisições Simultâneas
```bash
# Executar script de validação:
cd ~/ROM-Agent
chmod +x scripts/validate-bottleneck.sh
./scripts/validate-bottleneck.sh
```

Ou manualmente:

```bash
# Enviar 30 requisições em paralelo
for i in {1..30}; do
  (curl -sS -X POST https://rom-agent-ia-onrender-com.onrender.com/api/chat \
    -H "Content-Type: application/json" \
    -d "{\"mensagem\": \"Teste concorrência $i\", \"conversationId\": \"bn-test-$i\"}" \
    -w "\nHTTP: %{http_code}\n" &)
done

wait
```

#### 4.2. Verificar Rejeições (HTTP 503)
```bash
# Esperado:
# - ~5 requisições processando (running)
# - ~20 requisições na fila (queued)
# - ~5 requisições rejeitadas com HTTP 503
```

#### 4.3. Verificar Métricas
```bash
curl -sS https://rom-agent-ia-onrender-com.onrender.com/metrics | grep "bottleneck_rejected"
# Deve mostrar: bottleneck_rejected_total{operation="converse"} >= 5
```

✅ **Critério de Sucesso**: Rejeição com HTTP 503 quando fila > 20

---

## 📊 Checklist de Validação Completa

### Pós-Etapa A (Parâmetros):
- [ ] MAX_CONCURRENT=5
- [ ] MAX_QUEUE=20
- [ ] Serviço rodando (status Live)

### Pós-Etapa B (Circuit Breaker):
- [ ] ENABLE_CIRCUIT_BREAKER=true
- [ ] Métricas `circuit_breaker_*` presentes
- [ ] Métricas `model_fallback_*` presentes
- [ ] Transição CLOSED → OPEN confirmada
- [ ] Transição OPEN → HALF_OPEN → CLOSED confirmada

### Pós-Etapa C (Bottleneck):
- [ ] ENABLE_BOTTLENECK=true
- [ ] Métricas `bottleneck_*` presentes
- [ ] Rejeição HTTP 503 confirmada (fila cheia)
- [ ] Contadores `bottleneck_rejected_total` incrementando

### Status Final:
- [ ] ENABLE_RETRY=true ✅
- [ ] ENABLE_CIRCUIT_BREAKER=true ✅
- [ ] ENABLE_BOTTLENECK=true ✅
- [ ] ENABLE_GUARDRAILS=false (ainda OFF)
- [ ] Todas as métricas funcionando

---

## 🚨 Plano de Rollback

### Se algo der errado em qualquer etapa:

#### Rollback via Render Dashboard:
1. Settings → Environment
2. Modificar flag problemática para `false`:
   - `ENABLE_CIRCUIT_BREAKER=false`
   - `ENABLE_BOTTLENECK=false`
3. Save → Aguardar redeploy

#### Verificar Rollback:
```bash
curl -H "X-Admin-Token: 63a2de1784b57db90b3139277e1ed75b0daca799073c638442f57a46e79bc4ff" \
  https://rom-agent-ia-onrender-com.onrender.com/admin/flags
```

**Tempo de Rollback**: ~3-5 minutos (tempo de redeploy)

---

## 📝 Após Conclusão

### 1. Documentar Configuração Final
Atualizar `STAGING_VALIDATION_REPORT.md` com:
- ✅ Circuit Breaker ativado e validado
- ✅ Bottleneck ativado e validado
- ✅ Métricas funcionando
- ⏸️ Guardrails ainda OFF (P0-3 pendente)

### 2. Monitorar por 24h
- Acompanhar métricas no endpoint `/metrics`
- Verificar logs para erros inesperados
- Confirmar estabilidade

### 3. Decisão GO/NO-GO para Produção
Após 24h de staging estável:
- GO: Deploy em produção com mesmas configurações
- NO-GO: Investigar problemas e corrigir

---

## 🔗 Links Úteis

- **Render Dashboard**: https://dashboard.render.com
- **Staging URL**: https://rom-agent-ia-onrender-com.onrender.com
- **Métricas**: https://rom-agent-ia-onrender-com.onrender.com/metrics
- **Health**: https://rom-agent-ia-onrender-com.onrender.com/health
- **Admin Token**: `63a2de1784b57db90b3139277e1ed75b0daca799073c638442f57a46e79bc4ff`

---

**Criado por**: Claude Code (Sonnet 4.5)
**Data**: 2025-12-18T20:50:00Z
**Projeto**: ROM Agent - Go Live Acelerado 2.8.1.1
