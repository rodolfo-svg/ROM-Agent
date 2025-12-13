# 🚀 Deploy no Render - Passo a Passo Completo

## ⏱️ Tempo Total: 10-15 minutos

---

## 📋 PRÉ-REQUISITOS

Antes de começar, você precisa:

- [ ] Conta no GitHub (grátis)
- [ ] Código do ROM Agent no GitHub
- [ ] Chave API da Anthropic
- [ ] Email para criar conta no Render

---

## 🎯 PASSO 1: Preparar Repositório GitHub

### 1.1. Criar Repositório (se ainda não tem)

```bash
# No terminal, na pasta do projeto
cd ROM-Agent

# Inicializar Git (se ainda não fez)
git init

# Adicionar arquivos
git add .

# Commit inicial
git commit -m "Deploy: ROM Agent Web com sistema de branding"

# Criar repositório no GitHub:
# 1. Acesse https://github.com/new
# 2. Nome: ROM-Agent
# 3. Descrição: Agente jurídico com IA - ROM
# 4. Público ou Privado (sua escolha)
# 5. Criar repositório

# Conectar ao GitHub
git remote add origin https://github.com/SEU-USUARIO/ROM-Agent.git
git branch -M main
git push -u origin main
```

### 1.2. Verificar Arquivos Importantes

Certifique-se que estes arquivos estão no repositório:

```bash
# Verificar
ls -la render.yaml
ls -la package.json
ls -la src/server-enhanced.js

# Deve mostrar os 3 arquivos
```

---

## 🌟 PASSO 2: Criar Conta no Render

### 2.1. Acessar Render

1. Abra: https://render.com
2. Clique em **"Get Started"** ou **"Sign Up"**

### 2.2. Criar Conta

**Opção A: GitHub (Recomendado)**
```
1. Clique em "Sign up with GitHub"
2. Autorize o Render a acessar seus repositórios
3. Pronto! Conta criada e conectada
```

**Opção B: Email**
```
1. Digite seu email
2. Crie uma senha
3. Confirme email
4. Conecte o GitHub depois em Settings
```

---

## 🎨 PASSO 3: Criar Web Service

### 3.1. Dashboard do Render

Após login, você verá o dashboard:
```
┌─────────────────────────────────────┐
│  Render Dashboard                   │
│                                     │
│  [+ New]  ▼                        │
│   ├─ Web Service                   │
│   ├─ Static Site                   │
│   ├─ Cron Job                      │
│   └─ Background Worker             │
└─────────────────────────────────────┘
```

### 3.2. Criar Novo Serviço

1. Clique em **"+ New"** (canto superior direito)
2. Selecione **"Web Service"**

### 3.3. Conectar Repositório

```
┌─────────────────────────────────────────────┐
│  Connect a repository                       │
│                                             │
│  [GitHub] [GitLab]                         │
│                                             │
│  ✓ SEU-USUARIO/ROM-Agent                   │
│    Your ROM Agent repository                │
│    [Connect]                                │
└─────────────────────────────────────────────┘
```

1. Se não aparecer seu repositório:
   - Clique em "Configure account"
   - Autorize acesso ao repositório
   - Volte e refresh

2. Clique em **"Connect"** ao lado do ROM-Agent

---

## ⚙️ PASSO 4: Configurar Serviço

### 4.1. Configurações Básicas

```
Name: rom-agent
   ou: rom-agent-web
   ou: agente-rom

Region: Oregon (US West)
   ou: Frankfurt (Europe)

Branch: main

Root Directory: (deixe vazio)
```

### 4.2. Build & Deploy

O Render detecta automaticamente o `render.yaml`, mas você pode conferir:

```
Build Command: npm install
Start Command: npm run web:enhanced
```

### 4.3. Plano (IMPORTANTE!)

```
┌─────────────────────────────────────┐
│  Select a plan:                     │
│                                     │
│  ○ Free                            │
│    $0/month                         │
│    750 hours/month                  │
│    Sleeps after 15 min inactivity  │
│    [This is fine for testing!]     │
│                                     │
│  ○ Starter                         │
│    $7/month                         │
│    Always on                        │
│    Better performance               │
└─────────────────────────────────────┘
```

**Escolha: FREE** (pode upgradar depois)

### 4.4. Variáveis de Ambiente (CRÍTICO!)

Role para baixo até "Environment Variables":

```
┌─────────────────────────────────────────────┐
│  Environment Variables                      │
│                                             │
│  [+ Add Environment Variable]               │
└─────────────────────────────────────────────┘
```

Adicione estas variáveis:

#### Variável 1: ANTHROPIC_API_KEY
```
Key: ANTHROPIC_API_KEY
Value: sk-ant-api03-... (sua chave real)
```

#### Variável 2: NODE_ENV
```
Key: NODE_ENV
Value: production
```

#### Variável 3: SESSION_SECRET
```
Key: SESSION_SECRET
Value: [clique em "Generate" para criar aleatório]
   ou digite: rom-secret-2024-change-in-prod
```

#### Variável 4: PORT
```
Key: PORT
Value: 10000
```

**IMPORTANTE:** Render usa porta 10000 automaticamente, mas é bom definir.

---

## 🚀 PASSO 5: Deploy!

### 5.1. Criar Serviço

1. Revise todas as configurações
2. Clique em **"Create Web Service"** (botão verde no final)

### 5.2. Aguardar Build

Você será redirecionado para a tela de logs:

```
┌─────────────────────────────────────────────┐
│  rom-agent | Deploying...                   │
│                                             │
│  ==> Cloning from GitHub...                │
│  ✓ Cloned repository                       │
│                                             │
│  ==> Running build command...              │
│  npm install                                │
│  ✓ Dependencies installed                  │
│                                             │
│  ==> Starting service...                   │
│  npm run web:enhanced                      │
│  ✓ Server started on port 10000           │
│                                             │
│  🎉 Deploy succeeded!                      │
└─────────────────────────────────────────────┘
```

**Tempo:** 3-5 minutos

### 5.3. Obter URL

Quando terminar, você verá:

```
┌─────────────────────────────────────────────┐
│  ✓ Live                                     │
│                                             │
│  https://rom-agent.onrender.com            │
│  [Copy URL]  [View Logs]                   │
└─────────────────────────────────────────────┘
```

**ANOTE ESTA URL!** Você vai precisar para configurar o DNS.

---

## 🧪 PASSO 6: Testar Deploy

### 6.1. Acessar Site

1. Clique na URL: `https://rom-agent.onrender.com`
2. Deve abrir a interface do ROM Agent
3. Sua logo deve aparecer!

### 6.2. Testar Funcionalidades

- [ ] Chat carrega
- [ ] Logo aparece corretamente
- [ ] Tema dark/light funciona
- [ ] Upload de arquivo funciona
- [ ] Histórico salva

### 6.3. Verificar Logs

Se algo não funcionar:

1. No dashboard do Render
2. Clique em **"Logs"**
3. Procure por erros (linhas vermelhas)

**Erros comuns:**
```
Error: ANTHROPIC_API_KEY not found
→ Solução: Adicionar variável de ambiente

Error: Cannot find module
→ Solução: Verificar package.json e rebuild

Port 3000 in use
→ Normal! Render usa porta 10000
```

---

## 🌐 PASSO 7: Domínio Customizado

### 7.1. Adicionar Domínio

No dashboard do serviço:

```
┌─────────────────────────────────────────────┐
│  Settings                                   │
│                                             │
│  Custom Domains                             │
│  [+ Add Custom Domain]                      │
└─────────────────────────────────────────────┘
```

1. Clique em **"+ Add Custom Domain"**
2. Digite: `agente.rom.adv.br`
3. Render vai mostrar instruções de DNS

### 7.2. Configurar DNS (Ver guia específico)

Render vai pedir algo assim:

```
Configure DNS:

Type: CNAME
Name: agente
Value: rom-agent.onrender.com
```

**Importante:** Configure isso no Cloudflare (veja guia CLOUDFLARE-PASSO-A-PASSO.md)

---

## 📊 PASSO 8: Monitoramento

### 8.1. Dashboard

O Render mostra métricas em tempo real:

```
┌─────────────────────────────────────────────┐
│  Metrics                                    │
│                                             │
│  CPU Usage:     ▂▃▅▇▃▂ 45%                │
│  Memory:        ▃▅▇▅▃▂ 180 MB              │
│  Requests:      ▂▃▅▇█▅ 124 req/min         │
│  Response Time: ▃▂▃▂▃▂ 250ms avg           │
└─────────────────────────────────────────────┘
```

### 8.2. Logs em Tempo Real

```bash
# Via Dashboard: Logs tab
# Ou via CLI:
render logs -s rom-agent -f
```

### 8.3. Alertas

Configure em Settings → Notifications:
- Email quando deploy falhar
- Slack/Discord webhook
- Status do serviço

---

## 🔄 PASSO 9: Atualizações

### 9.1. Deploy Automático

Render faz deploy automático quando você faz push:

```bash
# Fazer mudanças no código
git add .
git commit -m "Nova funcionalidade"
git push

# Render detecta e faz deploy automático!
```

### 9.2. Deploy Manual

Se precisar forçar rebuild:

1. Dashboard → "Manual Deploy"
2. Escolha branch
3. "Deploy Latest Commit"

---

## 💰 PASSO 10: Custos e Limitações

### Plano Free

**Inclui:**
- ✅ 750 horas/mês (mais que suficiente)
- ✅ SSL automático
- ✅ Deploy ilimitados
- ✅ Domínio customizado

**Limitações:**
- ⚠️ Sleep após 15 min sem uso
- ⚠️ Wake up demora ~30 segundos
- ⚠️ 512 MB RAM
- ⚠️ Compartilha CPU

**Ideal para:** Testes, demos, uso pessoal

### Upgrade para Starter ($7/mês)

**Quando fazer:**
- Site com tráfego constante
- Não pode ter downtime
- Precisa de performance

**Vantagens:**
- ✅ Always on (sem sleep)
- ✅ 512 MB RAM dedicado
- ✅ Melhor performance
- ✅ Support prioritário

---

## 🆘 TROUBLESHOOTING

### Deploy falhou

```
Erro: Build failed

Solução:
1. Verifique logs
2. Teste localmente: npm install && npm run web:enhanced
3. Verifique package.json
4. Rebuild manual
```

### Site não carrega

```
Erro: Application timeout

Solução:
1. Verifique se servidor inicia (logs)
2. Porta deve ser 10000 ou process.env.PORT
3. Verifique variáveis de ambiente
```

### API Key não funciona

```
Erro: Invalid API key

Solução:
1. Settings → Environment
2. Verifique ANTHROPIC_API_KEY
3. Sem espaços antes/depois
4. Restart service
```

### Domínio não funciona

```
Erro: DNS not configured

Solução:
1. Verifique DNS no Cloudflare
2. Aguarde propagação (2-6h)
3. Teste: dig agente.rom.adv.br
```

---

## 📝 CHECKLIST FINAL

- [ ] Repositório no GitHub
- [ ] Conta no Render criada
- [ ] Web Service criado
- [ ] Variáveis de ambiente configuradas
  - [ ] ANTHROPIC_API_KEY
  - [ ] NODE_ENV=production
  - [ ] SESSION_SECRET
  - [ ] PORT=10000
- [ ] Deploy bem-sucedido
- [ ] URL funcionando: https://rom-agent.onrender.com
- [ ] Logo aparecendo corretamente
- [ ] Funcionalidades testadas
- [ ] Domínio customizado adicionado (opcional)
- [ ] DNS configurado (se usar domínio)

---

## 🎉 PRONTO!

Seu ROM Agent está no ar! 🚀

**URL:** https://rom-agent.onrender.com

**Próximos passos:**
1. Configure domínio customizado (CLOUDFLARE-PASSO-A-PASSO.md)
2. Teste todas as funcionalidades
3. Cadastre parceiros
4. Compartilhe com usuários!

**Dúvidas?**
- Docs Render: https://render.com/docs
- Logs: Dashboard → Logs
- Support: Dashboard → Help

---

**Parabéns! Deploy concluído com sucesso! 🎊**
