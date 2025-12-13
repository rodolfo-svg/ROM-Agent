# 🌐 Guia Completo: Configurar Domínio para ROM Agent

## 📋 Visão Geral

Para ter seu ROM Agent com domínio próprio (ex: `agente.rom.adv.br`), você precisa:
1. Registrar/ter um domínio
2. Fazer deploy do servidor
3. Configurar DNS
4. Configurar SSL/HTTPS

---

## 🛒 PASSO 1: Registrar Domínio

### Opção A: Usar Domínio Existente

Se você já tem `rom.adv.br`, pode criar um subdomínio:
- `agente.rom.adv.br`
- `ia.rom.adv.br`
- `chat.rom.adv.br`
- `rom-ai.rom.adv.br`

**Vantagem:** Não precisa comprar novo domínio!

### Opção B: Registrar Novo Domínio

#### Registradores Recomendados

**1. Registro.br (Domínios .br)**
- Website: https://registro.br
- Preço: ~R$ 40/ano
- Processo: Direto, sem intermediários
- Ideal para: Domínios .adv.br, .com.br, .br

**2. Cloudflare Registrar**
- Website: https://cloudflare.com
- Preço: Ao custo (sem markup)
- Vantagem: DNS grátis e CDN incluído
- Ideal para: .com, .net, .org

**3. Hostinger**
- Website: https://hostinger.com.br
- Preço: ~R$ 40/ano
- Vantagem: Interface em português
- Bônus: Às vezes vem com hospedagem

**4. GoDaddy**
- Website: https://godaddy.com
- Preço: ~R$ 50/ano (primeiro ano mais barato)
- Vantagem: Conhecido e confiável

### Recomendação

Para escritório de advocacia: **`seunome.adv.br`** no Registro.br

---

## 🚀 PASSO 2: Deploy do Servidor

Antes de configurar DNS, você precisa fazer deploy. Escolha uma plataforma:

### Opção A: Render (GRÁTIS - Recomendado para Início)

**Vantagens:**
- ✅ Grátis (com limitações)
- ✅ SSL automático
- ✅ Deploy fácil
- ✅ Domínio customizado grátis

**Como fazer:**

1. Acesse https://render.com
2. Crie uma conta
3. "New +" → "Web Service"
4. Conecte seu GitHub
5. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm run web:enhanced`
   - **Environment Variables:**
     - `ANTHROPIC_API_KEY`: sua_chave
     - `NODE_ENV`: production
     - `SESSION_SECRET`: gerar_aleatório

6. Deploy!

Você receberá uma URL: `https://rom-agent.onrender.com`

### Opção B: Railway

**Vantagens:**
- ✅ $5 crédito grátis/mês
- ✅ SSL automático
- ✅ Deploy muito rápido
- ✅ Domínio customizado

**Como fazer:**

1. Acesse https://railway.app
2. "New Project" → "Deploy from GitHub"
3. Conecte seu repositório
4. Configure variáveis de ambiente
5. Deploy automático!

URL: `https://rom-agent.up.railway.app`

### Opção C: VPS (Controle Total)

**Provedores:**
- **DigitalOcean:** $6/mês (droplet básico)
- **Linode:** $5/mês
- **Vultr:** $6/mês
- **AWS Lightsail:** $5/mês

**Requer:** Conhecimentos de Linux e servidor.

---

## 🔧 PASSO 3: Configurar DNS

### Onde Está o DNS?

O DNS geralmente é gerenciado onde você comprou o domínio, MAS você pode usar serviço externo:

**Opções:**
1. **DNS do Registrador** (Registro.br, GoDaddy, etc)
2. **Cloudflare** (Recomendado!) - Grátis e rápido
3. **DNS da plataforma** (Render, Railway)

### RECOMENDADO: Cloudflare

**Por quê?**
- ✅ Grátis
- ✅ Rápido (CDN global)
- ✅ Proteção DDoS
- ✅ SSL automático
- ✅ Analytics

**Como configurar:**

#### 1. Adicionar Domínio ao Cloudflare

1. Acesse https://cloudflare.com
2. Crie conta (grátis)
3. "Add a Site" → Digite seu domínio
4. Escolha plano "Free"
5. Cloudflare vai escanear seus DNS atuais

#### 2. Alterar Nameservers no Registrador

Cloudflare vai fornecer 2 nameservers, algo como:
```
amber.ns.cloudflare.com
hugo.ns.cloudflare.com
```

**No Registro.br:**
1. Acesse https://registro.br
2. Login
3. Meus Domínios → Seu domínio
4. "Alterar servidores DNS"
5. Cole os nameservers do Cloudflare
6. Salvar

**Tempo de propagação:** 2-48 horas (geralmente 2-6 horas)

#### 3. Configurar DNS Records no Cloudflare

Depois que nameservers propagarem:

**Para Render/Railway:**

1. No Cloudflare, vá em "DNS" → "Records"
2. Adicione record:

**Opção A: Domínio raiz (rom.adv.br)**
```
Type: CNAME
Name: @
Target: rom-agent.onrender.com
Proxy: Ativado (nuvem laranja)
```

**Opção B: Subdomínio (agente.rom.adv.br)**
```
Type: CNAME
Name: agente
Target: rom-agent.onrender.com
Proxy: Ativado (nuvem laranja)
```

**Para VPS:**
```
Type: A
Name: agente (ou @)
IPv4: IP_DO_SEU_SERVIDOR
Proxy: Ativado
```

---

## 🔒 PASSO 4: Configurar SSL (HTTPS)

### Com Render/Railway/Cloudflare

**SSL é AUTOMÁTICO!** 🎉

Não precisa fazer nada. Quando configurar o domínio customizado na plataforma, o SSL é gerado automaticamente.

### Com VPS (Certbot)

```bash
# Instalar Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Gerar certificado
sudo certbot --nginx -d agente.rom.adv.br

# Renovação automática
sudo certbot renew --dry-run
```

---

## 🎯 CONFIGURAÇÃO COMPLETA POR PLATAFORMA

### RENDER + Cloudflare (RECOMENDADO)

#### 1. Deploy no Render
```bash
# Já feito no PASSO 2
URL gerada: https://rom-agent.onrender.com
```

#### 2. Adicionar Domínio Customizado no Render
1. No Render, vá em seu serviço
2. "Settings" → "Custom Domain"
3. Adicione: `agente.rom.adv.br`
4. Render vai pedir para configurar DNS

#### 3. Configurar DNS no Cloudflare
```
Type: CNAME
Name: agente
Target: rom-agent.onrender.com
Proxy: Ativado (nuvem laranja)
TTL: Auto
```

#### 4. Aguardar Propagação
- Teste: https://agente.rom.adv.br
- Pode demorar até 48h (geralmente 2-6h)

#### 5. Forçar HTTPS
No Cloudflare:
- SSL/TLS → Overview → "Full"
- Edge Certificates → "Always Use HTTPS" → ON

---

### RAILWAY + Cloudflare

#### 1. Deploy no Railway
```bash
# URL gerada: https://rom-agent.up.railway.app
```

#### 2. Adicionar Domínio no Railway
1. Settings → Domains
2. "Custom Domain" → Digite: `agente.rom.adv.br`
3. Railway mostra o CNAME

#### 3. DNS no Cloudflare
```
Type: CNAME
Name: agente
Target: <valor-fornecido-pelo-railway>
Proxy: Ativado
```

---

### VPS + Nginx + Cloudflare

#### 1. Configurar Nginx

```nginx
# /etc/nginx/sites-available/rom-agent
server {
    listen 80;
    server_name agente.rom.adv.br;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/rom-agent /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 2. DNS no Cloudflare
```
Type: A
Name: agente
IPv4: IP_DO_SEU_VPS
Proxy: Ativado
```

#### 3. SSL com Certbot
```bash
sudo certbot --nginx -d agente.rom.adv.br
```

---

## 🧪 TESTAR CONFIGURAÇÃO

### 1. Verificar DNS Propagado

```bash
# Linux/Mac
dig agente.rom.adv.br

# Windows
nslookup agente.rom.adv.br

# Online
https://dnschecker.org
```

### 2. Testar HTTPS

```bash
curl -I https://agente.rom.adv.br
```

Deve retornar `HTTP/2 200`

### 3. Verificar SSL

```bash
# Linux/Mac
openssl s_client -connect agente.rom.adv.br:443

# Online
https://www.ssllabs.com/ssltest/
```

---

## 📊 RESUMO: MELHOR SETUP

### Setup Recomendado (Grátis)

```
1. Domínio: rom.adv.br (Registro.br - R$ 40/ano)
2. Subdomínio: agente.rom.adv.br
3. DNS: Cloudflare (grátis)
4. Servidor: Render (grátis com limitações)
5. SSL: Automático (Cloudflare + Render)
```

**Custo total: R$ 40/ano (só o domínio)**

### Setup Profissional

```
1. Domínio: rom.adv.br
2. Subdomínio: agente.rom.adv.br
3. DNS: Cloudflare Pro (R$ 100/mês) - Opcional
4. Servidor: Railway ($20/mês) ou VPS ($6/mês)
5. SSL: Automático
```

**Custo: R$ 40/ano + $6-20/mês**

---

## ⚡ PASSO A PASSO SIMPLIFICADO

### Para Iniciantes (Grátis)

1. **Registrar domínio** no Registro.br
2. **Deploy no Render** (conectar GitHub)
3. **Adicionar domínio ao Cloudflare**
4. **Alterar nameservers** no Registro.br para Cloudflare
5. **Adicionar CNAME** no Cloudflare apontando para Render
6. **Aguardar 2-6 horas**
7. **Acessar** https://agente.rom.adv.br
8. **Pronto!** 🎉

---

## 🆘 PROBLEMAS COMUNS

### DNS não propaga

**Solução:**
- Aguarde até 48h
- Verifique nameservers: `dig NS rom.adv.br`
- Limpe cache: `ipconfig /flushdns` (Windows)

### SSL não funciona

**Solução:**
- Certifique-se que proxy Cloudflare está ativo (nuvem laranja)
- SSL/TLS mode: "Full" ou "Full (strict)"
- Aguarde geração de certificado (até 24h)

### Site não carrega

**Solução:**
- Verifique se servidor está rodando
- Teste URL original do Render
- Verifique logs do servidor
- DNS pode não ter propagado

### Erro 522 (Cloudflare)

**Solução:**
- Servidor está offline
- Firewall bloqueando Cloudflare
- Adicionar IPs do Cloudflare no firewall

---

## 📞 SUPORTE

**Cloudflare:**
- Docs: https://developers.cloudflare.com
- Community: https://community.cloudflare.com

**Render:**
- Docs: https://render.com/docs
- Support: Via dashboard

**Registro.br:**
- Suporte: https://registro.br/ajuda/

---

## 🎯 CHECKLIST FINAL

- [ ] Domínio registrado
- [ ] Servidor deployed (Render/Railway/VPS)
- [ ] Cloudflare configurado
- [ ] Nameservers alterados
- [ ] DNS CNAME adicionado
- [ ] Domínio customizado adicionado na plataforma
- [ ] SSL ativo (cadeado verde)
- [ ] Site acessível via HTTPS
- [ ] Teste em diferentes dispositivos

---

**Pronto! Seu ROM Agent estará online com domínio profissional! 🚀**

Tempo total: 2-6 horas (maioria é aguardar DNS)
Dificuldade: Média (com este guia: Fácil)
Custo: R$ 40/ano (só domínio)
