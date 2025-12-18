# Deploy Staging - ROM Agent

## Arquitetura de Deploy

O projeto ROM Agent agora possui **dois ambientes separados no Render**:

### 1. **Produção** (`rom-agent`)
- **Branch:** `main`
- **URL:** https://iarom.com.br / https://www.iarom.com.br
- **Serviço Render:** `rom-agent`
- **NODE_ENV:** `production`
- **Auto-deploy:** ✅ Sim (qualquer push para `main`)

### 2. **Staging** (`rom-agent-staging`)
- **Branch:** `feature/go-live-observability`
- **URL:** https://rom-agent-staging.onrender.com (gerada automaticamente pelo Render)
- **Serviço Render:** `rom-agent-staging`
- **NODE_ENV:** `staging`
- **Auto-deploy:** ✅ Sim (qualquer push para `feature/go-live-observability`)

## Diferenças entre Ambientes

| Aspecto | Produção | Staging |
|---------|----------|---------|
| Branch | `main` | `feature/go-live-observability` |
| Rate Limit/min | 10 | 20 (mais permissivo) |
| Rate Limit/hora | 100 | 200 (mais permissivo) |
| Domínio Custom | ✅ iarom.com.br | ❌ Apenas subdomain Render |
| Disco Persistente | ✅ 1GB | ✅ 1GB (separado) |

## Como Funciona

### Deploy para Staging
```bash
# 1. Fazer mudanças na branch feature/go-live-observability
git checkout feature/go-live-observability
# ... fazer mudanças ...
git add .
git commit -m "feat: nova feature"

# 2. Push para disparar deploy automático
git push origin feature/go-live-observability

# 3. O Render automaticamente faz deploy em rom-agent-staging
```

### Deploy para Produção
```bash
# 1. Testar no staging primeiro!

# 2. Fazer merge para main
git checkout main
git merge feature/go-live-observability

# 3. Push para disparar deploy automático
git push origin main

# 4. O Render automaticamente faz deploy em rom-agent (produção)
```

## Endpoints de Monitoramento

### Staging
- **Health:** https://rom-agent-staging.onrender.com/api/info
- **Metrics:** https://rom-agent-staging.onrender.com/metrics

### Produção
- **Health:** https://iarom.com.br/api/info
- **Metrics:** https://iarom.com.br/metrics

## Configuração no Render Dashboard

### Primeira vez (manual)

1. **Acesse:** https://dashboard.render.com
2. **Vá em:** Services
3. O Render detectará automaticamente o `render.yaml` e criará os dois serviços:
   - `rom-agent` (produção)
   - `rom-agent-staging` (staging)

### Variáveis de Ambiente

Ambos os serviços precisam das mesmas variáveis secretas:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `ANTHROPIC_API_KEY`
- `DATAJUD_API_KEY`

**IMPORTANTE:** Configure as variáveis no Dashboard do Render para ambos os serviços.

## Gate Checker - Monitoramento

Para monitorar o staging:

```bash
STAGING_URL=https://rom-agent-staging.onrender.com \
GATE_PATH=/api/info \
GATE_WINDOW_MS=900000 \
GATE_INTERVAL_MS=60000 \
node scripts/gate-checker.js
```

Para monitorar produção:

```bash
STAGING_URL=https://iarom.com.br \
GATE_PATH=/api/info \
GATE_WINDOW_MS=900000 \
GATE_INTERVAL_MS=60000 \
node scripts/gate-checker.js
```

## Workflow Recomendado

1. ✅ **Desenvolver** na branch `feature/go-live-observability`
2. ✅ **Push** → deploy automático para **staging**
3. ✅ **Testar** no ambiente de staging
4. ✅ **Gate checker** passou? → Fazer **merge para main**
5. ✅ **Push main** → deploy automático para **produção**

## Troubleshooting

### Staging não deployou?
```bash
# Verificar se o push foi feito
git log --oneline -5

# Verificar se a branch está correta
git branch -a | grep feature/go-live-observability

# Ver logs no Render Dashboard
https://dashboard.render.com → rom-agent-staging → Logs
```

### Como reverter staging?
```bash
# Staging sempre reflete o HEAD da branch feature/go-live-observability
git checkout feature/go-live-observability
git reset --hard <commit-anterior>
git push -f origin feature/go-live-observability
```

### Como reverter produção?
```bash
# CUIDADO! Produção está na main
git checkout main
git revert <commit-ruim>
git push origin main
```

## URLs Importantes

- **Render Dashboard:** https://dashboard.render.com
- **Staging:** https://rom-agent-staging.onrender.com
- **Produção:** https://iarom.com.br
- **GitHub Repo:** https://github.com/rodolfo-svg/ROM-Agent
