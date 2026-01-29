# 🚀 Deploy para Heroku - ROM Agent

## Pré-requisitos

1. Heroku CLI instalado
2. Git configurado
3. Acesso ao app Heroku

## Instalação do Heroku CLI (se necessário)

```bash
# macOS
brew tap heroku/brew && brew install heroku

# Verificar instalação
heroku --version
```

## Login no Heroku

```bash
heroku login
```

## Deploy

### 1. Adicionar Remote Heroku (primeira vez)

```bash
# Verificar se já existe
git remote -v

# Se não existir, adicionar
heroku git:remote -a iarom

# Verificar novamente
git remote -v
# Deve mostrar: heroku  https://git.heroku.com/iarom.git (fetch)
```

### 2. Deploy para Produção

```bash
# Push para Heroku (isso faz deploy automaticamente)
git push heroku main

# Aguardar build e deploy (2-5 minutos)
# Output esperado:
# - Building...
# - Installing dependencies...
# - Launching...
# - Deployed to Heroku
```

### 3. Verificar Deploy

```bash
# Abrir app no browser
heroku open -a iarom

# Ver logs em tempo real
heroku logs --tail -a iarom

# Verificar status
heroku ps -a iarom
```

### 4. Monitoramento Automático

```bash
# Executar script de monitoramento
APP_URL=https://iarom.herokuapp.com HEROKU_APP=iarom ./scripts/monitor-deployment.sh
```

## Comandos Úteis

```bash
# Ver logs (últimas 100 linhas)
heroku logs -n 100 -a iarom

# Ver logs em tempo real
heroku logs --tail -a iarom

# Ver status do dyno
heroku ps -a iarom

# Reiniciar dyno
heroku restart -a iarom

# Ver configurações
heroku config -a iarom

# Abrir app
heroku open -a iarom
```

## Ativação de Feature Flags (Pós-Deploy)

### Fase 1: Cache Redis (Baixo Risco)

```bash
# 1. Provisionar Redis (se ainda não tiver)
heroku addons:create heroku-redis:mini -a iarom

# 2. Verificar credenciais (já configuradas automaticamente)
heroku config:get REDIS_URL -a iarom

# 3. Ativar cache para 10% dos usuários
heroku config:set FF_CANARY_PERCENTAGE=10 -a iarom
heroku config:set FF_REDIS_CACHE=true -a iarom
heroku config:set FF_CACHE_GOOGLE=true -a iarom

# 4. Aguardar 10 segundos (flags recarregam automaticamente)
sleep 10

# 5. Monitorar
heroku logs --tail -a iarom | grep -i "cache\|redis"

# 6. Verificar métricas
curl https://iarom.herokuapp.com/metrics | grep cache_hit
```

**Monitorar por 24 horas**:
- Cache hit rate deve ser > 30%
- Nenhum erro "Redis connection failed"
- Latência de queries em cache < 500ms

### Fase 2: Timeout Google 20s (Baixo Risco)

```bash
# Ativar timeout aumentado para todos
heroku config:set FF_GOOGLE_TIMEOUT_20S=true -a iarom

# Monitorar
heroku logs --tail -a iarom | grep -i "google\|timeout"
```

**Monitorar por 48 horas**:
- Taxa de timeout deve cair de 60% → 15%
- Latência média < 18s

### Fase 3: User-Agent Rotation (Médio Risco)

```bash
# Ativar rotação de user agents
heroku config:set FF_USER_AGENT_ROTATION=true -a iarom

# Monitorar
heroku logs --tail -a iarom | grep -i "user-agent\|403"
```

**Monitorar por 48 horas**:
- Erros HTTP 403 devem cair de 66% → 5%
- Nenhum bloqueio de IP adicional

### Fase 4: Proxy Pool (Alto Risco - Opcional)

```bash
# Configurar proxies (se tiver)
heroku config:set PROXY_1=http://user:pass@proxy1.com:8080 -a iarom
heroku config:set PROXY_2=http://user:pass@proxy2.com:8080 -a iarom

# Ativar proxy pool
heroku config:set FF_PROXY_POOL=true -a iarom

# Monitorar
heroku logs --tail -a iarom | grep -i "proxy"
```

**Monitorar por 72 horas**:
- Rotação de IPs funcionando
- Proxies não causando timeouts adicionais

### Fase 5: Circuit Breaker + Retry (Médio Risco)

```bash
# Ativar circuit breaker e retry
heroku config:set FF_CIRCUIT_BREAKER=true -a iarom
heroku config:set FF_RETRY_BACKOFF=true -a iarom

# Monitorar
heroku logs --tail -a iarom | grep -i "circuit\|retry"
```

**Monitorar por 72 horas**:
- Circuit breaker evita cascading failures
- Retry reduz erros transientes
- Latência não aumenta excessivamente

### Fase 6: Expandir para 100%

```bash
# Expandir canary para todos os usuários
heroku config:set FF_CANARY_PERCENTAGE=100 -a iarom

# Verificar
heroku config -a iarom | grep FF_
```

## Rollback (< 15 segundos)

Se algo der errado:

```bash
# Desativar TODAS as flags
heroku config:unset FF_REDIS_CACHE -a iarom
heroku config:unset FF_CACHE_GOOGLE -a iarom
heroku config:unset FF_GOOGLE_TIMEOUT_20S -a iarom
heroku config:unset FF_USER_AGENT_ROTATION -a iarom
heroku config:unset FF_PROXY_POOL -a iarom
heroku config:unset FF_CIRCUIT_BREAKER -a iarom
heroku config:unset FF_RETRY_BACKOFF -a iarom
heroku config:set FF_CANARY_PERCENTAGE=0 -a iarom

# Aguardar 10 segundos
sleep 10

# Verificar sistema voltou ao normal
curl https://iarom.herokuapp.com/api/health
```

**OU** fazer rollback do código:

```bash
# Reverter último commit
git revert HEAD
git push heroku main

# Aguardar rebuild (2-5 minutos)
```

## Troubleshooting

### Deploy Falhou

```bash
# Ver logs de build
heroku logs --tail -a iarom

# Verificar buildpacks
heroku buildpacks -a iarom

# Reinstalar dependências
heroku run npm install -a iarom

# Reiniciar dyno
heroku restart -a iarom
```

### Redis Não Conecta

```bash
# Verificar addon Redis
heroku addons -a iarom

# Ver URL do Redis
heroku config:get REDIS_URL -a iarom

# Testar conexão
heroku run node -e "const redis = require('redis'); const client = redis.createClient({url: process.env.REDIS_URL}); client.connect().then(() => console.log('OK')).catch(e => console.error(e));" -a iarom

# Se persistir, desativar
heroku config:set FF_REDIS_CACHE=false -a iarom
```

### Circuit Breaker Bloqueando Requisições

```bash
# Verificar métricas
curl https://iarom.herokuapp.com/metrics | grep circuit_breaker_state

# Se state = 2 (OPEN), reset manual via logs
heroku logs --tail -a iarom

# Desativar se necessário
heroku config:set FF_CIRCUIT_BREAKER=false -a iarom
```

### Proxy Pool Causando Timeouts

```bash
# Ver status dos proxies
heroku logs --tail -a iarom | grep "ProxyPool"

# Desabilitar temporariamente
heroku config:set FF_PROXY_POOL=false -a iarom

# Ou remover proxies problemáticos
heroku config:unset PROXY_2 -a iarom
```

## Métricas e Monitoramento

### Dashboard Heroku

```bash
# Abrir dashboard de métricas
heroku open -a iarom

# Ir para: More > Metrics
```

### Prometheus Metrics

```bash
# Ver todas as métricas
curl https://iarom.herokuapp.com/metrics

# Cache hit rate
curl https://iarom.herokuapp.com/metrics | grep cache_hit

# Circuit breaker state
curl https://iarom.herokuapp.com/metrics | grep circuit_breaker_state

# HTTP requests
curl https://iarom.herokuapp.com/metrics | grep http_requests_total
```

### Logs Estruturados

```bash
# Filtrar por tipo
heroku logs --tail -a iarom | grep ERROR
heroku logs --tail -a iarom | grep WARN
heroku logs --tail -a iarom | grep "Feature Flags"

# Exportar logs (últimas 24h)
heroku logs -n 1500 -a iarom > logs-$(date +%Y%m%d).txt
```

## Checklist Pós-Deploy

- [ ] Deploy concluído sem erros
- [ ] Health endpoint responde HTTP 200
- [ ] Logs não mostram erros críticos
- [ ] Todas as feature flags estão DESATIVADAS
- [ ] Sistema funciona identicamente ao anterior
- [ ] Métricas Prometheus acessíveis em /metrics
- [ ] Redis provisionado (se necessário)
- [ ] Monitoramento configurado
- [ ] Equipe notificada sobre deploy

## Próximos Passos

1. **Dia 0 (Hoje)**: Deploy com flags desativadas, monitorar por 4-6 horas
2. **Dia 1**: Ativar cache para 10% (FF_CANARY_PERCENTAGE=10)
3. **Dia 2-3**: Monitorar cache hit rate, expandir para 50%
4. **Dia 4**: Expandir cache para 100%
5. **Dia 5**: Ativar timeout 20s (FF_GOOGLE_TIMEOUT_20S=true)
6. **Semana 2**: Ativar user-agent rotation
7. **Semana 3**: Ativar circuit breaker + retry
8. **Semana 4**: Avaliar proxy pool (se necessário)

## Contatos

- **GitHub**: https://github.com/rodolfo-svg/ROM-Agent
- **Relatório Completo**: RELATORIO-IMPLEMENTACAO-FINAL-20260128.md
- **Monitoramento**: ./scripts/monitor-deployment.sh

---

**Status**: ✅ Pronto para deploy
**Versão**: v2.8.1 (Feature Flags Edition)
**Data**: 2026-01-28
