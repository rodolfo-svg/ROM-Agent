# GUIA DE DEPLOY - BETA SPEC
**Versão**: BETA 1.0
**Data**: 2025-12-17
**Ambiente**: Produção (Render + iarom.com.br)

---

## 📋 PRÉ-REQUISITOS

### 1. Variáveis de Ambiente Necessárias

**Obrigatórias**:
```bash
ANTHROPIC_API_KEY=sk-ant-...           # Claude API
AWS_ACCESS_KEY_ID=AKIA...              # AWS Bedrock
AWS_SECRET_ACCESS_KEY=...              # AWS Bedrock
AWS_REGION=us-east-1                   # AWS Region
NODE_ENV=production                     # Ambiente
PORT=3000                              # Porta do servidor
```

**Opcionais** (mas recomendadas):
```bash
SESSION_SECRET=...                      # Sessões seguras
ONEDRIVE_BACKUP_ENABLED=true          # Backup automático
FEATURE_FLAGS_PERSIST=true             # Persistir feature flags
TRACING_ENABLED=true                   # Sistema de rastreamento
```

### 2. Recursos Necessários

**Servidor Render**:
- Plano: Standard ou superior
- RAM: Mínimo 2GB (recomendado 4GB)
- CPU: 2+ cores
- Storage: 10GB+ para KB e backups

---

## 🚀 DEPLOY PARA RENDER

### Passo 1: Preparar Código Local

```bash
# 1. Verificar estado do repositório
git status

# 2. Adicionar todas as mudanças BETA
git add .

# 3. Criar commit BETA
git commit -m "BETA SPEC v1.0 - Sistema completo

- ✅ 25 APIs testadas (100% passando)
- ✅ Sistema de Paradigmas (9 endpoints)
- ✅ Backup OneDrive automático
- ✅ Testes anti-rollback (13/13)
- ✅ Correções de rotas
- ✅ Documentação completa

🚀 Pronto para produção com 6 usuários"

# 4. Push para GitHub
git push origin main
```

### Passo 2: Configurar Render

**Render Dashboard**: https://dashboard.render.com

1. **Selecionar Web Service**: ROM-Agent
2. **Auto-Deploy**: Ativado (deploy automático após push)
3. **Build Command**: `npm install`
4. **Start Command**: `node src/server-enhanced.js`

### Passo 3: Verificar Variáveis de Ambiente

No Render Dashboard → Environment:

```
✅ ANTHROPIC_API_KEY
✅ AWS_ACCESS_KEY_ID
✅ AWS_SECRET_ACCESS_KEY
✅ AWS_REGION
✅ NODE_ENV=production
✅ PORT=3000
```

### Passo 4: Trigger Deploy

**Opção A - Auto Deploy**:
- Push para GitHub → Deploy automático

**Opção B - Manual Deploy**:
1. Render Dashboard → Manual Deploy
2. Clear build cache: YES (recomendado para BETA)
3. Deploy latest commit

### Passo 5: Monitorar Build

```
Logs → Build Logs

Esperado:
✅ Installing dependencies
✅ Build succeeded
✅ Starting server
✅ ROM Agent v2.4.16 started
✅ APIs inicializadas
✅ Scheduler iniciado
✅ Server listening on port 3000
```

---

## 🔍 VERIFICAÇÃO PÓS-DEPLOY

### 1. Health Check Básico

```bash
# Verificar se servidor está respondendo
curl https://iarom.com.br/api/health

# Esperado: 200 OK
{
  "status": "healthy",
  "version": "2.4.16",
  "uptime": "XXs"
}
```

### 2. Verificar APIs Críticas

```bash
# Feature Flags
curl https://iarom.com.br/api/feature-flags

# KB Statistics
curl https://iarom.com.br/api/kb/statistics

# Paradigmas Categories
curl https://iarom.com.br/api/paradigmas/categories
```

### 3. Verificar Logs

```
Render Dashboard → Logs

Procurar por:
✅ "Servidor Web MELHORADO"
✅ "APIs inicializadas"
✅ "Scheduler iniciado"
❌ Errors ou exceptions
```

### 4. Testar Interface Web

1. Acessar: https://iarom.com.br
2. Login com credenciais de teste
3. Upload de documento pequeno
4. Verificar processamento
5. Testar geração de peça simples

---

## 🐛 TROUBLESHOOTING

### Problema: Build Falha

**Sintomas**: Build failed no Render

**Soluções**:
```bash
# 1. Verificar package.json
npm install --production

# 2. Limpar cache do Render
Settings → Clear build cache

# 3. Verificar Node version
# Render usa Node 18+ por padrão
# Adicionar em package.json se necessário:
"engines": {
  "node": ">=18.0.0"
}
```

### Problema: Server Não Inicia

**Sintomas**: Build OK mas server não inicia

**Verificar**:
1. ✅ PORT está correto (3000 ou $PORT)
2. ✅ ANTHROPIC_API_KEY está configurada
3. ✅ AWS credentials estão corretas
4. ✅ Todas as dependências instaladas

**Logs comuns**:
```
❌ "ANTHROPIC_API_KEY not configured"
→ Adicionar variável no Render

❌ "Cannot find module"
→ npm install no build

❌ "Port already in use"
→ Usar process.env.PORT
```

### Problema: 502 Bad Gateway

**Sintomas**: Site retorna 502

**Causas comuns**:
1. Server travou (check logs)
2. Timeout no startup (aumentar timeout)
3. Health check failing

**Solução**:
```bash
# Verificar health check route
# Render espera resposta em /
# Ou configurar custom health check path
```

### Problema: APIs Retornam 404

**Sintomas**: APIs retornam 404 após deploy

**Verificar ordem de rotas**:
```javascript
// ✅ CORRETO
app.get('/api/paradigmas/categories', ...);  // específica
app.get('/api/paradigmas/:id', ...);         // genérica

// ❌ ERRADO
app.get('/api/paradigmas/:id', ...);         // captura tudo
app.get('/api/paradigmas/categories', ...);  // nunca alcançada
```

### Problema: Backup OneDrive Não Funciona

**Sintomas**: Backup job não executa em produção

**Causa**: OneDrive path não existe em Render

**Solução**:
```javascript
// Em produção, desabilitar OneDrive backup ou usar S3
// Feature flag: onedrive.backup.enabled = false

// Alternativa: usar AWS S3 para backups
```

---

## 📊 MONITORAMENTO PÓS-DEPLOY

### Métricas a Observar (Primeiras 24h)

**Performance**:
- ✅ Response time < 3s
- ✅ CPU usage < 70%
- ✅ Memory usage < 80%
- ✅ Uptime > 99%

**APIs**:
- ✅ Success rate > 95%
- ✅ Sem erros 500
- ✅ Rate limiting funcionando

**Sistema**:
- ✅ Scheduler executando
- ✅ Logs sendo gerados
- ✅ Tracing funcionando
- ✅ Feature flags respondendo

### Ferramentas de Monitoramento

**Render Built-in**:
- Metrics → CPU/Memory/Network
- Logs → Real-time logs
- Events → Deploy history

**Externas** (opcional):
- Datadog
- New Relic
- Sentry (error tracking)

---

## 🔄 ROLLBACK (Se Necessário)

### Quando fazer rollback?

❌ **Rollback imediato se**:
- Taxa de erro > 10%
- Server crashando repetidamente
- Funcionalidade crítica quebrada
- Perda de dados

### Como fazer rollback

**Opção 1 - Render Dashboard**:
1. Deploy → View all deploys
2. Selecionar deploy anterior estável
3. Redeploy

**Opção 2 - Git Revert**:
```bash
# 1. Reverter commit BETA
git revert HEAD

# 2. Push
git push origin main

# 3. Render fará auto-deploy
```

**Opção 3 - Git Reset (cuidado!)**:
```bash
# 1. Reset para commit anterior
git reset --hard HEAD~1

# 2. Force push
git push --force origin main

# ⚠️ Usar apenas em emergência
```

---

## ✅ CHECKLIST DE DEPLOY

### Pré-Deploy
- [ ] Todos os testes locais passando
- [ ] Anti-rollback tests: 13/13 ✅
- [ ] Backup OneDrive realizado
- [ ] Documentação atualizada
- [ ] CHANGELOG criado
- [ ] Variáveis de ambiente verificadas

### Durante Deploy
- [ ] Build completed successfully
- [ ] No build warnings críticos
- [ ] Server started
- [ ] APIs inicializadas
- [ ] Scheduler iniciado

### Pós-Deploy
- [ ] Health check OK
- [ ] APIs respondendo (curl)
- [ ] Interface web acessível
- [ ] Login funcionando
- [ ] Upload/processamento OK
- [ ] Logs sendo gerados
- [ ] Sem erros críticos

### Monitoramento (24h)
- [ ] Uptime > 99%
- [ ] Response time < 3s
- [ ] CPU < 70%
- [ ] Memory < 80%
- [ ] Nenhum crash
- [ ] Feedback de 6 usuários BETA

---

## 📞 SUPORTE

**Em caso de problemas**:

1. **Verificar logs primeiro**: Render Dashboard → Logs
2. **Verificar status**: https://iarom.com.br/api/health
3. **Testar APIs**: Usar scripts de teste (`tests/`)
4. **Rollback se necessário**: Seguir seção "ROLLBACK"

**Contatos**:
- GitHub Issues: Reportar bugs
- Documentação: Ver `TROUBLESHOOTING-BETA.md`
- Testes: Executar `node tests/beta-certification.test.js`

---

**Última atualização**: 2025-12-17
**Versão**: BETA 1.0
**Status**: Pronto para produção
