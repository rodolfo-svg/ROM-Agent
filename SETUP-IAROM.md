# 🚀 Configuração do Domínio iarom.com.br

Guia passo a passo para colocar o ROM Agent online em **https://agente.iarom.com.br**

---

## 📋 Checklist Rápido

- [ ] Domínio iarom.com.br registrado no Registro.br
- [ ] Conta criada no Cloudflare
- [ ] Conta criada no Render
- [ ] Código no GitHub
- [ ] ANTHROPIC_API_KEY em mãos

**Tempo total:** ~1 hora de trabalho + 2-6h de propagação DNS

---

## 🎯 PARTE 1: Preparação (5 min)

### 1.1. Verificar se tem tudo

```bash
# Teste local primeiro
cd ROM-Agent
npm install
npm run web:enhanced

# Deve abrir em http://localhost:3000
```

✅ Se funcionar localmente, pode continuar!

### 1.2. Informações necessárias

Tenha em mãos:
- ✅ Usuário e senha do Registro.br (CPF/CNPJ)
- ✅ Email para criar conta Cloudflare
- ✅ Email para criar conta Render
- ✅ Sua ANTHROPIC_API_KEY

---

## 📦 PARTE 2: GitHub (10 min)

### 2.1. Verificar Git

```bash
cd ROM-Agent

# Se não tem git iniciado
git init

# Adicionar tudo
git add .

# Primeiro commit
git commit -m "Deploy inicial ROM Agent para iarom.com.br"
```

### 2.2. Criar repositório no GitHub

1. Acesse: https://github.com/new
2. Nome: `ROM-Agent`
3. Descrição: `ROM Agent - Sistema IA para Advocacia`
4. Público ou Privado (sua escolha)
5. **NÃO** marque "Initialize with README"
6. **Create repository**

### 2.3. Conectar e enviar

```bash
# Substituir SEU-USUARIO pelo seu GitHub username
git remote add origin https://github.com/SEU-USUARIO/ROM-Agent.git

git branch -M main
git push -u origin main
```

✅ **Checkpoint 1:** Código no GitHub!

---

## 🚀 PARTE 3: Render (15 min)

### 3.1. Criar conta

1. Acesse: https://render.com
2. **"Sign up with GitHub"** (recomendado)
3. Autorize Render a acessar seus repositórios

### 3.2. Criar Web Service

1. Dashboard → **"+ New"** → **"Web Service"**
2. Selecione: `ROM-Agent`
3. Configure:

```
Name:           rom-agent-iarom
Region:         Oregon (US West)
Branch:         main
Build Command:  npm install
Start Command:  npm run web:enhanced
Instance Type:  FREE
```

### 3.3. Variáveis de Ambiente (IMPORTANTE!)

Clique em **"Advanced"** e adicione:

```
ANTHROPIC_API_KEY = sk-ant-api03-... (sua chave)
NODE_ENV = production
SESSION_SECRET = [Clique em "Generate"]
PORT = 10000
```

### 3.4. Deploy!

1. **"Create Web Service"**
2. Aguardar build (~3-5 min)
3. Quando aparecer **"Live"** em verde, está pronto!

**Anotar a URL gerada:**
```
https://rom-agent-iarom.onrender.com
```

✅ **Checkpoint 2:** Site online no Render!

Teste agora: abra essa URL no navegador. Deve aparecer o ROM Agent funcionando!

---

## ☁️ PARTE 4: Cloudflare (20 min)

### 4.1. Criar conta

1. Acesse: https://cloudflare.com/sign-up
2. Email + senha
3. Verificar email

### 4.2. Adicionar domínio

1. **"+ Add a Site"**
2. Digite: `iarom.com.br`
3. Plano: **FREE** (Selecione!)
4. **"Continue"**
5. Cloudflare vai escanear DNS (~30s)

### 4.3. ANOTAR NAMESERVERS (IMPORTANTE!)

O Cloudflare vai mostrar 2 nameservers, algo como:

```
amber.ns.cloudflare.com
hugo.ns.cloudflare.com
```

**📝 ANOTE ESTES DOIS!**

(Podem ser outros nomes: aron, bella, luna, etc.)

### 4.4. Alterar no Registro.br

**AGORA FAÇA ISSO:**

1. Abra nova aba: https://registro.br
2. Login com seu CPF/CNPJ
3. Menu: **"Domínios"**
4. Clique em: `iarom.com.br`
5. Botão: **"Alterar servidores DNS"**
6. Remova os DNS atuais
7. Adicione os 2 nameservers do Cloudflare:

```
DNS Primário:   [primeiro nameserver do Cloudflare]
DNS Secundário: [segundo nameserver do Cloudflare]
```

8. **"Salvar alterações"**

### 4.5. Confirmar no Cloudflare

Volte para o Cloudflare:
- Marque: **"I have changed my nameservers"**
- **"Done, check nameservers"**

**Mensagem esperada:** "Great news! Cloudflare is now protecting your site"

Se aparecer "Pending", é normal. Continue!

✅ **Checkpoint 3:** Nameservers alterados!

---

## ⏳ PARTE 5: Aguardar Propagação (2-6 horas)

### O que está acontecendo

```
Registro.br
    ↓ (notifica servidores DNS globais)
Internet
    ↓ (propaga novo DNS)
Cloudflare
    ↓ (ativa domínio)
Você receberá EMAIL ✉️
```

### Enquanto espera

Você vai receber EMAIL do Cloudflare (geralmente 2-6h, pode ser até 24h):

**Assunto:** "Cloudflare is now active for iarom.com.br"

**Enquanto isso:**
- ☕ Café
- 📧 Emails
- 🎮 Relaxar
- 📺 Netflix

**NÃO faça a Parte 6 antes de receber o email!**

---

## 🎨 PARTE 6: Configurar DNS no Cloudflare

**⚠️ SÓ FAZER APÓS RECEBER EMAIL DO CLOUDFLARE!**

### 6.1. Adicionar CNAME

1. Dashboard Cloudflare
2. Clique em: `iarom.com.br`
3. Menu: **"DNS"** → **"Records"**
4. **"+ Add record"**

Configure assim:

```
Type:    CNAME
Name:    agente
Target:  rom-agent-iarom.onrender.com
Proxy:   ✅ ATIVADO (nuvem laranja)
TTL:     Auto
```

5. **"Save"**

### 6.2. (Opcional) Adicionar www

Se quiser que `www.iarom.com.br` também funcione:

**"+ Add record"** novamente:

```
Type:    CNAME
Name:    www
Target:  rom-agent-iarom.onrender.com
Proxy:   ✅ ATIVADO
TTL:     Auto
```

### 6.3. Configurar SSL

**SSL/TLS** → **Overview**:
- Selecione: **"Full"**

**SSL/TLS** → **Edge Certificates**:
- ☑ **"Always Use HTTPS"** → ON
- ☑ **"Automatic HTTPS Rewrites"** → ON

✅ **Checkpoint 4:** DNS configurado!

---

## 🧪 PARTE 7: Testar (10 min)

### Aguardar mais um pouco

Após adicionar o CNAME, aguarde **5-15 minutos** para propagar.

### 7.1. Teste automático

```bash
cd ROM-Agent

# Testar DNS
./scripts/deploy/check-dns.sh agente.iarom.com.br
```

Deve mostrar vários ✅ verdes!

### 7.2. Teste manual

```bash
# Verificar DNS
dig agente.iarom.com.br

# Deve aparecer o CNAME apontando para rom-agent-iarom.onrender.com

# Testar HTTPS
curl -I https://agente.iarom.com.br

# Deve retornar: HTTP/2 200
```

### 7.3. Teste no navegador

Abra: **https://agente.iarom.com.br**

Deve aparecer:
- ✅ ROM Agent carregando
- ✅ Logo do escritório
- ✅ Cadeado verde 🔒 (HTTPS)
- ✅ Chat funcionando
- ✅ Upload funcionando

### 7.4. Teste SSL

Acesse: https://www.ssllabs.com/ssltest/

Digite: `agente.iarom.com.br`

**Score esperado:** A ou A+

---

## ✅ CHECKLIST FINAL

### Deploy
- [ ] Código no GitHub
- [ ] Render criado e rodando
- [ ] Variáveis de ambiente configuradas
- [ ] URL Render funcionando: `https://rom-agent-iarom.onrender.com`

### DNS
- [ ] Conta Cloudflare criada
- [ ] Domínio iarom.com.br adicionado
- [ ] Nameservers anotados
- [ ] Nameservers alterados no Registro.br
- [ ] Email de confirmação recebido
- [ ] CNAME agente criado
- [ ] SSL modo Full
- [ ] Always HTTPS ativado

### Validação
- [ ] Site carrega: `https://agente.iarom.com.br`
- [ ] Cadeado verde (HTTPS)
- [ ] Logo aparece
- [ ] Chat funciona
- [ ] Upload funciona
- [ ] Tema dark/light funciona
- [ ] SSL Labs score A/A+

---

## 🎉 PRONTO!

### Suas URLs finais:

- **Produção:** https://agente.iarom.com.br
- **Admin Parceiros:** https://agente.iarom.com.br/admin-partners.html
- **Admin Formatação:** https://agente.iarom.com.br/admin-formatting.html
- **Dashboard Render:** https://dashboard.render.com
- **Dashboard Cloudflare:** https://dash.cloudflare.com

---

## 🔄 Atualizações Futuras

Quando fizer mudanças no código:

```bash
git add .
git commit -m "Descrição da mudança"
git push

# Render detecta e faz deploy automático!
```

---

## 📱 Próximos Passos

### 1. Cadastrar parceiros
```
https://agente.iarom.com.br/admin-partners.html
```

### 2. Configurar formatação
```
https://agente.iarom.com.br/admin-formatting.html
```

### 3. Compartilhar com clientes
```
Envie o link: https://agente.iarom.com.br
```

---

## 🆘 Problemas?

### Site não carrega

```bash
# Verificar DNS
./scripts/deploy/check-dns.sh agente.iarom.com.br

# Ver propagação global
https://dnschecker.org/#CNAME/agente.iarom.com.br
```

### HTTPS não funciona

1. Cloudflare → SSL/TLS → Modo **Full**
2. Edge Certificates → **Always HTTPS** ON
3. Aguardar até 24h para certificado

### Deploy falhou no Render

1. Render Dashboard → Seu serviço
2. **"Logs"** → Ver o erro
3. Verificar variáveis de ambiente

---

## 💰 Custos Mensais

```
Domínio iarom.com.br:  R$ 40/ano  = R$ 3,33/mês
Render (Free):         R$ 0/mês
Cloudflare (Free):     R$ 0/mês
API Claude:            Variável (conforme uso)
────────────────────────────────────────────────
TOTAL FIXO:            R$ 3,33/mês
```

---

## 📚 Documentação Completa

- **GUIA-COMPLETO-DEPLOY.md** - Guia geral de deploy
- **DEPLOY-RENDER-PASSO-A-PASSO.md** - Detalhes Render
- **CLOUDFLARE-PASSO-A-PASSO.md** - Detalhes Cloudflare
- **BRANDING-GUIDE.md** - Sistema de parceiros
- **FORMATTING-TEMPLATES-GUIDE.md** - Templates de formatação

---

**Criado especificamente para:** iarom.com.br
**Data:** Dezembro 2024
**Status:** ✅ Pronto para uso!
