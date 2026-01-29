# 🎛️ Configurar Feature Flags no Render

**Objetivo**: Adicionar variáveis de feature flags ao ambiente Render
**Tempo**: 5 minutos
**URL**: https://iarom.com.br já está LIVE ✓

---

## 🎯 Próximo Passo Imediato

### 1. Acessar Dashboard Render

👉 **https://dashboard.render.com**

### 2. Navegar para Environment Variables

```
Dashboard → Services → rom-agent → Environment
```

### 3. Adicionar Feature Flags (TODAS DESATIVADAS)

Clique em "Add Environment Variable" e adicione **uma por vez**:

```bash
# FASE 2: Google Search
FF_GOOGLE_TIMEOUT_20S=false
FF_REDIS_CACHE=false
FF_CACHE_GOOGLE=false

# FASE 3: STJ Scraping
FF_USER_AGENT_ROTATION=false
FF_PROXY_POOL=false
FF_STJ_FALLBACK=false

# FASE 4: Resiliência  
FF_CIRCUIT_BREAKER=false
FF_RETRY_BACKOFF=false
FF_GLOBAL_FALLBACK=false

# FASE 5: Monitoramento
FF_STRUCTURED_LOGGING=false

# Canary Deployment
FF_CANARY_PERCENTAGE=0
```

### 4. Salvar e Redeploy

**IMPORTANTE**: Render vai fazer **redeploy automático** quando você salvar.

✅ Isso é **SEGURO** - todas as flags estão desativadas (false/0)

---

## ⏱️ Cronograma de Ativação

### Dia 0 (HOJE)
✅ Sistema LIVE com flags desativadas
✅ Validar funcionamento por 24 horas

### Dia 1 (Amanhã - 2026-01-29)
**Ativar Cache para 10% dos usuários**

Dashboard → Environment → Editar:
```
FF_CANARY_PERCENTAGE=10
FF_REDIS_CACHE=true
FF_CACHE_GOOGLE=true
```

**Monitorar**:
- Cache hit rate > 30%
- Latência queries cache < 500ms
- Nenhum erro Redis

### Dia 2-3 (2026-01-30 a 31)
**Expandir Cache**

```
FF_CANARY_PERCENTAGE=50  # Dia 2
FF_CANARY_PERCENTAGE=100 # Dia 3 (se OK)
```

### Dia 4 (2026-02-01)
**Ativar Timeout 20s**

```
FF_GOOGLE_TIMEOUT_20S=true
```

**Monitorar**: Taxa de timeout cai de 60% → 15%

### Semana 2 (2026-02-03)
**Ativar User-Agent Rotation**

```
FF_USER_AGENT_ROTATION=true
```

**Monitorar**: Erros HTTP 403 caem de 66% → 5%

### Semana 3 (2026-02-10)
**Ativar Circuit Breaker + Retry**

```
FF_CIRCUIT_BREAKER=true
FF_RETRY_BACKOFF=true
```

**Monitorar**: Resiliência aumenta, erros transientes caem

---

## 📊 Monitoramento

### Logs em Tempo Real
```
Dashboard → rom-agent → Logs
```

Procure por:
- `[FeatureFlags] Loaded:` - Confirma flags carregadas
- `[CACHE HIT]` / `[CACHE MISS]` - Cache funcionando
- `[ProxyPool]` - Proxy rotation
- `[Retry]` - Retry em ação

### Métricas Prometheus

```bash
curl https://iarom.com.br/metrics | grep -E "cache_hit|circuit_breaker|retry"
```

### Health Check

```bash
curl https://iarom.com.br/api/info | jq .health
```

---

## 🔄 Rollback Rápido (< 15 segundos)

Se algo der errado após ativar uma flag:

### Opção 1: Desativar Flag Específica
Dashboard → Environment → Editar a flag problemática:
```
FF_CACHE_GOOGLE=false
```

### Opção 2: Desativar TUDO
```
FF_REDIS_CACHE=false
FF_CACHE_GOOGLE=false
FF_GOOGLE_TIMEOUT_20S=false
FF_USER_AGENT_ROTATION=false
FF_CANARY_PERCENTAGE=0
```

**Render aplica mudanças em ~10 segundos sem redeploy**

### Opção 3: Rollback de Deploy
Dashboard → Deploys → Rollback to previous deploy

---

## ✅ Checklist

- [ ] Feature flags adicionadas ao Render Environment
- [ ] Sistema validado por 24h (chat, upload, buscas)
- [ ] Nenhum erro crítico nos logs
- [ ] Monitoramento configurado
- [ ] Equipe notificada sobre deploy

---

## 🎯 Impacto Esperado

Quando todas as flags estiverem ativadas:

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| Google Timeout | 60% | 15% | **75% ↓** |
| Google Latência (cache) | 15s | 200ms | **98.7% ↓** |
| STJ HTTP 403 | 66% | 5% | **92% ↓** |
| Erros Transientes | 15% | 3% | **80% ↓** |

---

## 📞 Documentação

- **Relatório Completo**: RELATORIO-IMPLEMENTACAO-FINAL-20260128.md
- **Status Deploy**: DEPLOY-RENDER-STATUS.md
- **Este Guia**: RENDER-FEATURE-FLAGS.md

---

**Próximo passo**: Adicionar flags ao Render Environment ↑
