# 🚨 INSTRUÇÕES PARA DEPLOY MANUAL - URGENTE

**Data**: 15/12/2025 19:41 UTC
**Problema**: Auto-deploy do Render NÃO está funcionando
**Status Atual**: Servidor rodando código de 11h atrás

---

## 🔍 SITUAÇÃO ATUAL

### Evidências do Problema:
```
❌ Uptime: 11h 41min (servidor não reiniciou)
❌ Último deploy: 07:58:19 GMT (ontem)
❌ Commits no GitHub: 4 commits novos NÃO deployados
❌ /api/auto-update/status retorna "Cannot GET"
✅ render.yaml tem autoDeploy: true (mas não funciona)
```

### Commits Aguardando Deploy:
```
89c115a7 - EMERGENCY: Force deploy trigger (AGORA)
6448901c - Fix: createRequire em api-routes-auto-update.js
da459310 - CRITICAL: Ativar scheduler e backup automáticos
0d940305 - Diagnóstico: Site desatualizado
```

---

## ✅ SOLUÇÃO 1: DEPLOY MANUAL VIA RENDER DASHBOARD

### Passo a Passo:

#### 1. Acessar Render Dashboard
```
https://dashboard.render.com/
```
- Login com conta GitHub

#### 2. Selecionar Serviço
- Procurar por: **"rom-agent"**
- Clicar no serviço

#### 3. Fazer Deploy Manual
**Opção A - Deploy Simples**:
1. Clicar em "Manual Deploy" (botão no topo direito)
2. Selecionar branch: **main**
3. Clicar "Deploy"

**Opção B - Deploy com Cache Limpo** (RECOMENDADO):
1. Ir em "Settings" → "Build & Deploy"
2. Clicar em "Clear build cache"
3. Depois: "Manual Deploy" → "Deploy latest commit"

#### 4. Aguardar Deploy Completar
- Tempo estimado: **5-7 minutos**
- Acompanhar logs em tempo real
- Esperar até ver: "Build successful" e "Live"

#### 5. Verificar Sucesso
```bash
# Testar API (uptime deve ser < 10 min)
curl https://iarom.com.br/api/info | grep uptime

# Testar auto-update (deve retornar JSON)
curl https://iarom.com.br/api/auto-update/status
```

---

## ✅ SOLUÇÃO 2: VERIFICAR WEBHOOK GITHUB

Se deploy manual funcionar mas auto-deploy continuar falhando:

### 1. Acessar Configurações do Repositório
```
https://github.com/rodolfo-svg/ROM-Agent/settings/hooks
```

### 2. Verificar Webhook do Render
- Procurar webhook com URL: `https://api.render.com/deploy/...`
- Verificar se está **ativo** (✓ verde)

### 3. Ver Deliveries Recentes
- Clicar no webhook
- Ver "Recent Deliveries"
- Se houver erros ❌:
  - Clicar em cada delivery
  - Ver "Response"
  - Verificar erro

### 4. Reenviar Webhook (se falhou)
- Clicar em delivery falhado
- Botão "Redeliver"
- Aguardar resposta

### 5. Se Webhook Não Existir
**Criar Webhook Manualmente**:
1. No Render Dashboard → rom-agent → Settings
2. Copiar "Deploy Hook URL"
3. No GitHub → Settings → Webhooks → Add webhook
4. Colar URL do Render
5. Content type: `application/json`
6. Trigger: "Just the push event"
7. Salvar

---

## ✅ SOLUÇÃO 3: REINICIAR SERVIÇO (EMERGENCIAL)

Se deploy manual também falhar:

### Via Render Dashboard:
1. Serviço "rom-agent"
2. "Settings" → "Suspend"
3. Aguardar suspender (30s)
4. "Resume"
5. Aguardar iniciar (2-3 min)

---

## 📊 VERIFICAÇÕES PÓS-DEPLOY

Após deploy completar, executar:

### 1. Verificar Uptime
```bash
curl -s https://iarom.com.br/api/info | jq '.health.uptime'
# Deve mostrar < 10 minutos
```

### 2. Verificar Auto-Update
```bash
curl -s https://iarom.com.br/api/auto-update/status
# Deve retornar JSON com "status": "ativo"
```

### 3. Verificar Logs do Render
Deve aparecer nas linhas finais:
```
✅ Sistema de auto-atualização ATIVO
✅ Scheduler ATIVO - Deploy às 02h
✅ Backup automático ATIVO - Execução às 03h
```

### 4. Testar Endpoints
```bash
# Auto-update info
curl https://iarom.com.br/api/auto-update/info

# Projects
curl https://iarom.com.br/api/projects/list

# Site HTML
curl https://iarom.com.br/ | grep "v2.7"
```

---

## 🎯 CHECKLIST COMPLETO

Marque conforme for fazendo:

### Deploy:
- [ ] Acessei Render Dashboard
- [ ] Encontrei serviço "rom-agent"
- [ ] Cliquei "Clear build cache"
- [ ] Fiz "Manual Deploy"
- [ ] Aguardei 5-7 minutos
- [ ] Vi "Build successful"
- [ ] Vi "Live"

### Verificação:
- [ ] Uptime < 10 minutos ✅
- [ ] `/api/auto-update/status` retorna JSON ✅
- [ ] `/api/auto-update/info` retorna JSON ✅
- [ ] Logs mostram scheduler ativo ✅
- [ ] Logs mostram backup ativo ✅
- [ ] Site mostra v2.7 ✅

### Webhook (se auto-deploy continuar falhando):
- [ ] Verifiquei webhook no GitHub
- [ ] Webhook existe e está ativo
- [ ] Testei reenviar delivery
- [ ] Se não existia, criei webhook

---

## 🚨 SE TUDO FALHAR

### Contatar Suporte Render:
```
https://render.com/support
```

### Ou verificar status da plataforma:
```
https://status.render.com/
```

---

## 📝 INFORMAÇÕES TÉCNICAS

### Commits Pendentes:
- **89c115a7**: Emergency force trigger
- **6448901c**: Fix require() CommonJS
- **da459310**: Ativar scheduler + backup
- **0d940305**: Diagnóstico completo

### Correções Aguardando Deploy:
1. ✅ `scheduler.start()` em server-enhanced.js
2. ✅ `backupManager.scheduleBackup('03:00')` em server-enhanced.js
3. ✅ `createRequire` em api-routes-auto-update.js
4. ✅ Rotas auto-update integradas

### Sistemas Que Serão Ativados:
1. ⏰ **Deploy automático às 02h** (todo dia)
2. 💾 **Backup automático às 03h** (todo dia)
3. 🔄 **Auto-update de prompts** (a cada 24h)
4. 🎯 **Health check** (a cada hora)

---

## ⏰ TEMPO ESTIMADO

**Deploy Manual**: 7 minutos (total)
- Acessar dashboard: 1 min
- Configurar deploy: 1 min
- Aguardar build: 5 min

**Verificação**: 2 minutos
- Testar endpoints: 1 min
- Verificar logs: 1 min

**TOTAL**: ~10 minutos para sistema 100% operacional

---

**AÇÃO IMEDIATA NECESSÁRIA**: Fazer deploy manual via Render Dashboard

© 2025 - Deploy Manual Urgente
