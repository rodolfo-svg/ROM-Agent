# 🚀 CONFIGURAR AUTO-DEPLOY AUTOMÁTICO

**Problema**: Deploy manual necessário a cada commit
**Solução**: Configurar webhook GitHub → Render para deploy automático
**Tempo**: 5 minutos
**Resultado**: Push → Deploy automático SEMPRE

---

## 🎯 OPÇÃO 1: WEBHOOK RENDER (RECOMENDADO)

### **Passo 1: Obter Deploy Hook do Render**

1. Acesse: https://dashboard.render.com/
2. Clique no serviço **"rom-agent"**
3. Vá em **"Settings"** (menu lateral esquerdo)
4. Role até **"Deploy Hook"**
5. Clique em **"Create Deploy Hook"**
6. **Copie a URL** que aparece (formato: `https://api.render.com/deploy/srv-xxxxx?key=xxxxx`)

### **Passo 2: Adicionar Webhook no GitHub**

1. Acesse: https://github.com/rodolfo-svg/ROM-Agent/settings/hooks
2. Clique em **"Add webhook"**
3. Preencha:
   - **Payload URL**: Cole a URL do Render (passo 1)
   - **Content type**: `application/json`
   - **Secret**: (deixar vazio)
   - **Which events**: `Just the push event`
   - **Active**: ✅ Marcar
4. Clique em **"Add webhook"**

### **Passo 3: Testar**

```bash
# Fazer um commit de teste:
echo "# Auto-deploy test" >> README.md
git add README.md
git commit -m "test: Testar auto-deploy"
git push origin main

# Aguardar 30 segundos
# Verificar se deploy iniciou automaticamente no Render
```

**Resultado Esperado**:
- ✅ Push detectado pelo GitHub
- ✅ Webhook dispara para Render
- ✅ Render inicia deploy automaticamente
- ✅ Deploy completa em ~5-7 minutos
- ✅ Site atualizado automaticamente

---

## 🎯 OPÇÃO 2: CONECTAR REPOSITÓRIO RENDER

Se webhook não funcionar, reconectar o repositório:

### **Passo 1: Desconectar**

1. Render Dashboard → **rom-agent**
2. **Settings** → **Source**
3. **Disconnect Repository** (se existir)

### **Passo 2: Reconectar**

1. Clique em **"Connect Repository"**
2. Autorize Render a acessar GitHub (se necessário)
3. Selecione: **rodolfo-svg/ROM-Agent**
4. Branch: **main**
5. Auto-Deploy: **Yes** ✅
6. Salvar

### **Passo 3: Confirmar**

1. Em **Settings** → **Build & Deploy**
2. Verificar:
   - ✅ **Auto-Deploy**: Enabled
   - ✅ **Branch**: main
   - ✅ **Deploy on Push**: Yes

**Resultado**:
- Render cria webhook automaticamente
- Push → Deploy automático

---

## 🎯 OPÇÃO 3: GITHUB ACTIONS (MAIS AVANÇADO)

Se as opções acima não funcionarem, usar GitHub Actions:

### **Passo 1: Obter API Key do Render**

1. Render Dashboard → **Account Settings**
2. **API Keys** → **Create API Key**
3. Nome: `github-actions-deploy`
4. **Copiar a key** (guarde, não mostra novamente!)

### **Passo 2: Adicionar Secret no GitHub**

1. GitHub → ROM-Agent → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
3. Nome: `RENDER_API_KEY`
4. Value: Cole a API key do Render
5. **Add secret**

### **Passo 3: Já está configurado!**

O arquivo `.github/workflows/deploy-and-verify.yml` já existe no código!

Mas precisa de token com scope `workflow`. Para ativar:

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. **Generate new token (classic)**
3. Scopes:
   - ✅ `repo` (all)
   - ✅ `workflow`
4. **Generate token**
5. **Copiar token**

Depois, no terminal local:

```bash
# Atualizar token do git
git remote set-url origin https://YOUR_TOKEN@github.com/rodolfo-svg/ROM-Agent.git

# Push das GitHub Actions
git add .github/workflows/
git commit -m "ci: Ativar GitHub Actions para deploy automático"
git push origin main
```

**Resultado**:
- Cada push dispara GitHub Actions
- GitHub Actions verifica código
- Trigger deploy no Render via API
- Verifica se deploy funcionou
- Testa endpoints

---

## ✅ VALIDAR AUTO-DEPLOY FUNCIONANDO

Após configurar qualquer opção acima:

### **Teste 1: Commit Simples**

```bash
# Criar arquivo de teste
echo "$(date)" > .deploy-test
git add .deploy-test
git commit -m "test: Auto-deploy validation"
git push origin main
```

### **Teste 2: Verificar Webhook (GitHub)**

1. GitHub → Settings → Webhooks
2. Clicar no webhook do Render
3. Aba **"Recent Deliveries"**
4. Ver se último push foi entregue ✅
5. Response deve ser `200 OK`

### **Teste 3: Verificar Deploy (Render)**

1. Render Dashboard → rom-agent
2. **Events** (menu lateral)
3. Ver se deploy iniciou automaticamente
4. Status deve mostrar: "Deploying..." → "Live"

### **Teste 4: Confirmar Atualização**

```bash
# Aguardar 5-7 minutos após push
curl https://iarom.com.br/api/info | jq '.health.uptime'

# Uptime deve ser < 10 minutos (reiniciou recentemente)
```

---

## 🔍 TROUBLESHOOTING

### **Webhook não dispara**:

**Possíveis causas**:
- ❌ URL do webhook incorreta
- ❌ Webhook inativo
- ❌ Branch errada configurada

**Solução**:
1. Deletar webhook existente
2. Criar novo webhook
3. Verificar URL está correta
4. Marcar "Active" ✅
5. Testar com "Redeliver"

### **Webhook dispara mas deploy não inicia**:

**Possíveis causas**:
- ❌ Auto-deploy desabilitado no Render
- ❌ Branch diferente de `main`
- ❌ Falha de autenticação

**Solução**:
1. Render → Settings → Build & Deploy
2. Verificar "Auto-Deploy" = **Enabled**
3. Branch = **main**
4. Reconectar repositório se necessário

### **Deploy inicia mas falha**:

**Possíveis causas**:
- ❌ Erro de build
- ❌ Erro de sintaxe no código
- ❌ Dependências faltando

**Solução**:
1. Ver logs do build no Render
2. Corrigir erros
3. Novo commit
4. Deploy automático deve funcionar

---

## 📊 COMO SABER SE ESTÁ FUNCIONANDO

### **✅ Auto-Deploy ATIVO**:

```
Commit + Push
↓ (30 segundos)
GitHub webhook dispara
↓ (10 segundos)
Render detecta mudança
↓ (2 minutos)
Build iniciado
↓ (5 minutos)
Deploy concluído
↓
✅ SITE ATUALIZADO AUTOMATICAMENTE
```

**Indicadores**:
- ✅ GitHub webhook mostra `200 OK` em Recent Deliveries
- ✅ Render Events mostra deploy automático
- ✅ Logs do Render mostram build iniciado
- ✅ Site atualiza sem intervenção manual

### **❌ Auto-Deploy INATIVO**:

```
Commit + Push
↓
... nada acontece ...
↓
❌ SITE NÃO ATUALIZA
```

**Indicadores**:
- ❌ GitHub webhook não configurado ou falha
- ❌ Render Events não mostra deploy novo
- ❌ Site continua com uptime longo (não reiniciou)
- ❌ Precisa deploy manual

---

## 🎯 RECOMENDAÇÃO FINAL

**Escolha OPÇÃO 1** (Webhook Render):
- ✅ Mais simples
- ✅ Mais rápido (30s para detectar)
- ✅ Menos dependências
- ✅ Funciona 99% dos casos

**Se falhar → OPÇÃO 2** (Reconectar Repo):
- ✅ Render cria webhook automaticamente
- ✅ Garante configuração correta

**Se ainda falhar → OPÇÃO 3** (GitHub Actions):
- ✅ Mais controle
- ✅ Testes automáticos
- ✅ Verificação pós-deploy
- ⚠️ Mais complexo

---

## ⏱️ TIMELINE DE IMPLEMENTAÇÃO

**OPÇÃO 1**: 5 minutos
```
Obter Deploy Hook (2 min)
+ Configurar Webhook GitHub (2 min)
+ Testar (1 min)
= 5 minutos
```

**OPÇÃO 2**: 3 minutos
```
Desconectar repositório (1 min)
+ Reconectar com auto-deploy (1 min)
+ Confirmar (1 min)
= 3 minutos
```

**OPÇÃO 3**: 15 minutos
```
Obter API Key (3 min)
+ Configurar Secrets (3 min)
+ Configurar Token Workflow (5 min)
+ Push Actions (2 min)
+ Testar (2 min)
= 15 minutos
```

---

## ✅ CHECKLIST

### **Antes de Configurar**:
- [ ] Acesso ao GitHub (Settings → Webhooks)
- [ ] Acesso ao Render Dashboard
- [ ] Permissões de admin no repositório

### **Configuração (Opção 1)**:
- [ ] Obter Deploy Hook do Render
- [ ] Adicionar Webhook no GitHub
- [ ] Marcar "Active" no webhook
- [ ] Selecionar "Just the push event"

### **Validação**:
- [ ] Fazer commit de teste
- [ ] Push para main
- [ ] Aguardar 30 segundos
- [ ] Verificar deploy iniciou automaticamente
- [ ] Confirmar site atualizado

### **Pós-Configuração**:
- [ ] Documentar webhook configurado
- [ ] Deletar arquivo de teste
- [ ] Confirmar auto-deploy em próximos commits

---

## 🎉 RESULTADO ESPERADO

**Após configuração correta**:

```
ANTES:
Commit → Push → ❌ Nada → Deploy Manual → 😫

AGORA:
Commit → Push → ✅ Deploy Automático → 🎉

FUTURO (sempre):
Qualquer commit → Deploy automático em 5-7 min
```

---

**Quer que eu te ajude a configurar agora?**
Posso te guiar passo a passo! 🚀

© 2025 - Configuração de Auto-Deploy ROM Agent
