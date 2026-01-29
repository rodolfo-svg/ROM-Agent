# 📊 Status dos Logs - ROM Agent

**Data**: 2026-01-28 18:45
**URL**: https://iarom.com.br
**Commit**: 3855883

---

## ✅ SISTEMA HEALTHY

```json
{
  "nome": "ROM",
  "versao": "2.8.0",
  "commit": "3855883",
  "status": "healthy",
  "uptime": "5h 0m",
  "bedrock": "connected"
}
```

---

## 📊 Métricas Atuais

### Sistema
- **Memory**: 162 MB / 166 MB (heap)
- **RSS**: 358 MB
- **Uptime**: 5 horas
- **Node**: v25.2.1

### Bedrock AWS
- **Status**: ✅ Connected
- **Region**: us-west-2
- **Credentials**: ✅ Válidas
- **Requests**: 0 (nenhuma chamada ainda)
- **Cost**: $0.00

### Circuit Breaker
- **Default**: 🟢 CLOSED (0 = funcionando normal)
- **Converse**: 🟢 CLOSED (0 = funcionando normal)
- **Success Events**: 183 (converse)

### Cache Redis
- **Status**: ⚪ Não ativado ainda
- **Metrics**: Nenhuma (aguardando ativação de FF_REDIS_CACHE)

### HTTP Requests
- Poucas requisições registradas (sistema estável)
- Nenhum erro crítico detectado

---

## 🎯 Como Ver Logs Completos

### Opção 1: Render Dashboard (Recomendado)

**Acesse**: https://dashboard.render.com

1. **Login** com suas credenciais
2. **Navegue**: Services → `rom-agent`
3. **Clique**: Tab "Logs"
4. **Ver**: Logs em tempo real (auto-refresh)

**Filtros úteis no search:**
- `ERROR` - Ver apenas erros
- `WARN` - Ver avisos
- `[FeatureFlags]` - Ver flags carregadas
- `[CACHE]` - Ver operações de cache
- `[ProxyPool]` - Ver proxy rotation
- `[Retry]` - Ver retries
- `3855883` - Ver logs do commit atual

### Opção 2: Via Script Local

```bash
./scripts/view-render-logs.sh
```

### Opção 3: Via Curl (Métricas)

```bash
# Todas as métricas
curl https://iarom.com.br/metrics

# Filtrar específicas
curl https://iarom.com.br/metrics | grep circuit_breaker
curl https://iarom.com.br/metrics | grep cache
curl https://iarom.com.br/metrics | grep http_requests
```

---

## 🔍 O Que Procurar nos Logs

### ✅ Sinais de Saúde (BONS)

```
[INFO] Logger inicializado
[INFO] Server listening on port 10000
[FeatureFlags] Loaded: { ... }
bedrock: connected
```

### ⚠️ Avisos (ATENÇÃO)

```
[WARN] Circuit Breaker: Request failed
[WARN] Retry: Attempt failed, retrying...
[WARN] Redis connection failed (esperado se não ativado)
```

### ❌ Erros Críticos (PROBLEMAS)

```
[ERROR] Unhandled error
[ERROR] Database connection failed
[ERROR] AWS Bedrock authentication failed
circuit_breaker_state 2 (OPEN = bloqueando requests)
```

---

## 📈 Próximos Passos

### 1. Adicionar Feature Flags ao Render

```
Dashboard → rom-agent → Environment → Add Variable
```

Adicionar:
```bash
FF_REDIS_CACHE=false
FF_CACHE_GOOGLE=false
FF_GOOGLE_TIMEOUT_20S=false
FF_USER_AGENT_ROTATION=false
FF_CIRCUIT_BREAKER=false
FF_RETRY_BACKOFF=false
FF_CANARY_PERCENTAGE=0
```

### 2. Validar por 24h

Monitorar:
- ✅ Nenhum erro crítico
- ✅ Memory estável (< 200 MB)
- ✅ Bedrock connected
- ✅ Circuit breakers CLOSED

### 3. Ativar Features (Dia 1+)

Começar com cache:
```bash
FF_CANARY_PERCENTAGE=10
FF_REDIS_CACHE=true
FF_CACHE_GOOGLE=true
```

Monitorar logs para:
- `[CACHE HIT]` - Cache funcionando
- `[CACHE MISS]` - Misses normais
- `[Redis connected]` - Conexão OK

---

## 🚨 Alertas Configurados

Monitorar automaticamente:
- Memory > 400 MB → Investigar memory leak
- Circuit breaker OPEN > 5min → Problema de conectividade
- Error rate > 5% → Investigar causa raiz
- Uptime restart < 10min → Crash recente

---

## 📞 Acesso Rápido

- **Dashboard**: https://dashboard.render.com
- **App Live**: https://iarom.com.br
- **Metrics**: https://iarom.com.br/metrics
- **Health**: https://iarom.com.br/api/info
- **Script Local**: `./scripts/view-render-logs.sh`

---

**Status**: ✅ Sistema saudável e rodando normalmente
**Ação**: Monitorar por 24h antes de ativar features
