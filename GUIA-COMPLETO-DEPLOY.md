# 🌟 GUIA COMPLETO: Do Zero ao Online

## Do código local até domínio próprio com HTTPS - Passo a Passo Definitivo

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Preparação (10 min)](#preparação)
3. [Deploy no Render (15 min)](#deploy-no-render)
4. [Configurar Cloudflare (20 min)](#configurar-cloudflare)
5. [Aguardar Propagação (2-6h)](#aguardar-propagação)
6. [Testar e Validar (10 min)](#testar-e-validar)
7. [Próximos Passos](#próximos-passos)

**Tempo Total:** ~1 hora de trabalho + 2-6h de espera (propagação DNS)

---

## 🎯 VISÃO GERAL

### O Que Vamos Fazer

```
┌─────────────────┐      ┌──────────────┐      ┌────────────────┐
│  Código Local   │──1──>│   GitHub     │──2──>│  Render (Free) │
│  (seu PC)       │      │  (repositório)│     │  (servidor)    │
└─────────────────┘      └──────────────┘      └────────────────┘
                                                        │
                                                        3
                                                        ↓
                            ┌─────────────────────────────────────┐
                            │  Cloudflare (DNS + SSL + CDN)       │
                            │  Transforma em: agente.rom.adv.br  │
                            └─────────────────────────────────────┘
```

### O Que Você Vai Conseguir

- ✅ Site online 24/7 (grátis no Render)
- ✅ Domínio profissional (`agente.rom.adv.br`)
- ✅ HTTPS automático (cadeado verde)
- ✅ CDN global (Cloudflare)
- ✅ Proteção DDoS
- ✅ Deploy automático (push e está online!)

---

## 🛠️ PREPARAÇÃO

### Requisitos

- [ ] Código do ROM Agent funcionando localmente
- [ ] Git instalado
- [ ] Conta no GitHub
- [ ] ANTHROPIC_API_KEY (Claude)
- [ ] Domínio registrado (ou pode usar subdomínio existente)
- [ ] ~1 hora de tempo

### Verificar Se Está Tudo OK

```bash
# No terminal, pasta do projeto:
cd ROM-Agent

# Testar localmente
npm install
npm run web:enhanced

# Se abrir em http://localhost:3000 está OK!
```

---

## 📦 PARTE 1: GitHub (10 min)

### 1.1. Inicializar Git

```bash
cd ROM-Agent

# Se ainda não tem git
git init

# Adicionar todos os arquivos
git add .

# Primeiro commit
git commit -m "Deploy inicial: ROM Agent Web completo"
```

### 1.2. Criar Repositório no GitHub

1. Acesse: https://github.com/new
2. Nome: `ROM-Agent`
3. Descrição: `Agente jurídico com IA - Sistema ROM`
4. Público ou Privado (sua escolha)
5. **NÃO** marque "Initialize with README"
6. Criar repositório

### 1.3. Conectar e Enviar

```bash
# Substituir SEU-USUARIO pelo seu username do GitHub
git remote add origin https://github.com/SEU-USUARIO/ROM-Agent.git

git branch -M main
git push -u origin main
```

**✓ Checkpoint:** Código no GitHub!

---

## 🚀 PARTE 2: Deploy no Render (15 min)

### 2.1. Criar Conta

1. Acesse: https://render.com
2. **"Sign up with GitHub"** (recomendado)
3. Autorize Render a acessar repositórios

### 2.2. Criar Web Service

1. Dashboard → **"+ New"** → **"Web Service"**
2. Conectar repositório: `ROM-Agent`
3. Configurar:

```
Name: rom-agent
Region: Oregon (US West)
Branch: main
Build Command: npm install
Start Command: npm run web:enhanced
Plan: FREE
```

### 2.3. Variáveis de Ambiente (IMPORTANTE!)

Adicionar 4 variáveis:

```
ANTHROPIC_API_KEY = sk-ant-api03-... (sua chave)
NODE_ENV = production
SESSION_SECRET = [Clique em "Generate"]
PORT = 10000
```

### 2.4. Deploy!

1. **"Create Web Service"**
2. Aguardar build (~3-5 min)
3. Quando terminar: ✓ Live

**URL gerada:** `https://rom-agent.onrender.com`

**✓ Checkpoint:** Site online no Render!

---

## ☁️ PARTE 3: Cloudflare (20 min)

### 3.1. Criar Conta

1. Acesse: https://cloudflare.com/sign-up
2. Email + senha
3. Verificar email

### 3.2. Adicionar Domínio

1. **"+ Add a Site"**
2. Digite: `rom.adv.br` (seu domínio)
3. Plano: **FREE**
4. Cloudflare vai escanear DNS (~30s)

### 3.3. Anotar Nameservers

Cloudflare mostra algo como:

```
amber.ns.cloudflare.com
hugo.ns.cloudflare.com
```

**ANOTE ESTES!** Você vai precisar.

### 3.4. Alterar no Registro.br

1. Acesse: https://registro.br
2. Login
3. Meus Domínios → `rom.adv.br`
4. **"Alterar servidores DNS"**
5. Substituir por nameservers do Cloudflare
6. Salvar

**⏳ Aguarde confirmação:** "DNS alterados com sucesso"

### 3.5. Confirmar no Cloudflare

Volte ao Cloudflare:
- Marque: "I have changed my nameservers"
- **"Done, check nameservers"**

---

## ⏳ PARTE 4: Aguardar Propagação (2-6 horas)

### O Que Está Acontecendo

```
Registro.br
    ↓ (atualiza)
Nameservers globais
    ↓ (propagam)
Seu computador / Outros usuários
    ↓ (conseguem acessar)
agente.rom.adv.br ✓
```

### Durante a Espera

Você receberá email do Cloudflare quando ativar (geralmente 2-6h).

**Enquanto isso, pode:**
- ☕ Tomar café
- 📧 Responder emails
- 🎮 Jogar algo
- 📺 Assistir série

---

## 🎨 PARTE 5: Configurar DNS no Cloudflare

**APÓS** nameservers propagarem (recebeu email):

### 5.1. Adicionar CNAME

Dashboard Cloudflare → `rom.adv.br` → **DNS** → **Records**

**"+ Add record"**

```
Type: CNAME
Name: agente
Target: rom-agent.onrender.com
Proxy: ✅ ATIVADO (nuvem laranja)
TTL: Auto
```

**"Save"**

### 5.2. Configurar SSL

**SSL/TLS** → Overview:
- Modo: **Full**

**SSL/TLS** → Edge Certificates:
- ☑ **Always Use HTTPS**
- ☑ **Automatic HTTPS Rewrites**

---

## 🧪 PARTE 6: Testar Tudo (10 min)

### 6.1. Usar Script Automático

```bash
# No terminal
./scripts/deploy/check-dns.sh agente.rom.adv.br
```

Deve mostrar vários ✓ verdes!

### 6.2. Teste Manual

```bash
# Verificar DNS
dig agente.rom.adv.br

# Testar HTTPS
curl -I https://agente.rom.adv.br

# Deve retornar: HTTP/2 200
```

### 6.3. Teste no Navegador

1. Abra: `https://agente.rom.adv.br`
2. Deve carregar o ROM Agent
3. Logo do escritório aparece
4. Cadeado verde 🔒 no navegador
5. Testar chat, upload, tema dark/light

### 6.4. Teste de SSL

```
Acesse: https://www.ssllabs.com/ssltest/
Digite: agente.rom.adv.br

Score esperado: A ou A+
```

---

## ✅ CHECKLIST FINAL

### Deploy

- [ ] Código no GitHub
- [ ] Conta no Render criada
- [ ] Web Service criado
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy bem-sucedido
- [ ] URL funcionando: `https://rom-agent.onrender.com`

### DNS

- [ ] Conta no Cloudflare
- [ ] Domínio adicionado
- [ ] Nameservers alterados no Registro.br
- [ ] Nameservers propagados (email recebido)
- [ ] CNAME configurado
- [ ] SSL modo Full
- [ ] Always HTTPS ativado

### Validação

- [ ] Site carrega: `https://agente.rom.adv.br`
- [ ] Cadeado verde (HTTPS) ✓
- [ ] Logo aparece corretamente
- [ ] Chat funciona
- [ ] Upload funciona
- [ ] Tema dark/light funciona
- [ ] SSL Labs score A/A+
- [ ] Script check-dns.sh tudo verde

---

## 🎉 PRONTO!

**Parabéns! Seu ROM Agent está online! 🚀**

### URLs Finais

- **Produção:** https://agente.rom.adv.br
- **Dashboard Render:** https://dashboard.render.com
- **Dashboard Cloudflare:** https://dash.cloudflare.com
- **Admin Parceiros:** https://agente.rom.adv.br/admin-partners.html

---

## 📈 PRÓXIMOS PASSOS

### Curto Prazo

1. **Cadastrar parceiros**
   - Acesse: `/admin-partners.html`
   - Adicione escritórios parceiros
   - Upload de logos

2. **Testar funcionalidades**
   - Chat com IA
   - Upload de PDFs
   - Geração de peças

3. **Compartilhar**
   - Envie link para usuários
   - Treine equipe
   - Colete feedback

### Médio Prazo

1. **Monitorar uso**
   - Analytics do Cloudflare
   - Logs do Render
   - Feedback dos usuários

2. **Otimizações**
   - Ajustar cache
   - Configurar firewall
   - Add rate limiting

3. **Considerar upgrade**
   - Render Starter ($7/mês) se tráfego aumentar
   - Cloudflare Pro ($20/mês) para analytics avançado

### Longo Prazo

1. **Backup e segurança**
   - Backup regular do banco
   - Logs de auditoria
   - Monitoramento 24/7

2. **Novos recursos**
   - Integração WhatsApp
   - API pública
   - Mobile app

3. **Escalar**
   - Mais servidores
   - Load balancer
   - CDN adicional

---

## 📚 DOCUMENTAÇÃO COMPLETA

### Guias Criados Para Você

1. **INICIO-RAPIDO.md** - Começar em 5 minutos
2. **DEPLOY-RENDER-PASSO-A-PASSO.md** - Deploy detalhado
3. **CLOUDFLARE-PASSO-A-PASSO.md** - DNS e SSL
4. **DOMINIO-GUIDE.md** - Tudo sobre domínios
5. **scripts/deploy/README.md** - Scripts de automação
6. **IMPLEMENTADO.md** - O que foi feito
7. **BRANDING-GUIDE.md** - Sistema de parceiros

### Scripts Úteis

```bash
# Verificar DNS
./scripts/deploy/check-dns.sh agente.rom.adv.br

# Preparar deploy
./scripts/deploy/deploy-render.sh
```

---

## 🆘 SUPORTE

### Problemas Comuns

**Site não carrega:**
- Aguarde propagação DNS (2-6h)
- Verifique nameservers: `dig NS rom.adv.br`
- Teste: `./scripts/deploy/check-dns.sh`

**HTTPS não funciona:**
- SSL mode: Full (não Flexible)
- Always HTTPS: Ativado
- Aguarde certificado (até 24h)

**Deploy falhou:**
- Verificar logs no Render
- Testar localmente primeiro
- Verificar variáveis de ambiente

### Onde Buscar Ajuda

**Documentação Oficial:**
- Render: https://render.com/docs
- Cloudflare: https://developers.cloudflare.com

**Community:**
- GitHub Issues
- Discord/Slack (se tiver)
- Email: contato@rom.adv.br

---

## 💰 CUSTOS MENSAIS

### Setup Atual (Grátis/Baixo Custo)

```
Domínio:     R$ 3,33/mês  (R$ 40/ano)
Render:      R$ 0/mês     (plano free)
Cloudflare:  R$ 0/mês     (plano free)
──────────────────────────────────────
TOTAL:       R$ 3,33/mês  💰
```

### Se Escalar (Produção)

```
Domínio:     R$ 3,33/mês
Render:      $7/mês       (~R$ 35/mês)
Cloudflare:  $0 ou $20/mês
API Claude:  Variável (uso)
──────────────────────────────────────
TOTAL:       R$ 38-138/mês
```

---

## 🏆 VOCÊ CONSEGUIU!

De código local para:
- ✅ Site profissional online
- ✅ Domínio próprio
- ✅ HTTPS seguro
- ✅ CDN global
- ✅ Deploy automático
- ✅ Sistema de parceiros
- ✅ Completamente funcional

**Tempo investido:** ~1h + 2-6h espera
**Resultado:** Aplicação web profissional em produção!

**Compartilhe com sua equipe e comece a usar! 🎊**

---

**Criado por:** Rodolfo Otávio Mota - OAB/GO 21.841
**Contato:** contato@rom.adv.br
**Website:** https://rom.adv.br
