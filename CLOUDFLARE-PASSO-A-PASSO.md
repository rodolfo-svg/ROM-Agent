# ☁️ Cloudflare - Configuração Completa Passo a Passo

## ⏱️ Tempo Total: 15-20 minutos (+ 2-6h propagação DNS)

---

## 🎯 O QUE VAMOS FAZER

1. Criar conta no Cloudflare (grátis)
2. Adicionar seu domínio
3. Alterar nameservers no Registro.br
4. Configurar DNS para apontar ao Render
5. Ativar SSL/HTTPS
6. Otimizações e segurança

---

## 🌟 PASSO 1: Criar Conta no Cloudflare

### 1.1. Acessar Cloudflare

```
URL: https://dash.cloudflare.com/sign-up
```

### 1.2. Criar Conta

```
┌─────────────────────────────────────────┐
│  Create your Cloudflare account        │
│                                         │
│  Email: _________________________      │
│         contato@rom.adv.br            │
│                                         │
│  Password: ______________________      │
│           [criar senha forte]          │
│                                         │
│  [Sign Up]                             │
└─────────────────────────────────────────┘
```

**Dicas:**
- Use email profissional
- Senha forte (12+ caracteres, números, símbolos)
- Anote a senha em lugar seguro

### 1.3. Verificar Email

```
1. Verifique seu email
2. Clique no link de confirmação
3. Volte ao Cloudflare
```

---

## 🌐 PASSO 2: Adicionar Seu Domínio

### 2.1. Dashboard Inicial

Após login:

```
┌─────────────────────────────────────────┐
│  Welcome to Cloudflare                  │
│                                         │
│  Add a site to get started              │
│                                         │
│  [+ Add a Site]                        │
└─────────────────────────────────────────┘
```

Clique em **"+ Add a Site"**

### 2.2. Digite Seu Domínio

```
┌─────────────────────────────────────────┐
│  Enter your site                        │
│                                         │
│  Site: _________________________       │
│        rom.adv.br                      │
│                                         │
│  [Add Site]                            │
└─────────────────────────────────────────┘
```

**Digite:** `rom.adv.br` (sem http://, sem www)

Clique em **"Add Site"**

### 2.3. Escolher Plano

```
┌─────────────────────────────────────────┐
│  Select a plan                          │
│                                         │
│  ○ Free            $0/month            │
│    └─ CDN básico                       │
│    └─ SSL grátis                       │
│    └─ DDoS protection                  │
│    └─ Analytics                        │
│    ✓ RECOMENDADO PARA COMEÇAR         │
│                                         │
│  ○ Pro             $20/month           │
│  ○ Business        $200/month          │
│  ○ Enterprise      Custom              │
│                                         │
│  [Continue with Free]                   │
└─────────────────────────────────────────┘
```

**Escolha: FREE** (pode upgradar depois)

### 2.4. Scan de DNS

Cloudflare vai escanear seus DNS atuais:

```
┌─────────────────────────────────────────┐
│  Scanning DNS records...                │
│                                         │
│  Found 8 records                        │
│  ▰▰▰▰▰▰▰▰▰▰ 100%                       │
│                                         │
│  [Continue]                             │
└─────────────────────────────────────────┘
```

Aguarde ~30 segundos.

---

## 🔧 PASSO 3: Revisar DNS Records

### 3.1. Registros Encontrados

Cloudflare mostra os DNS existentes:

```
┌─────────────────────────────────────────────────────┐
│  DNS Records                                        │
│                                                     │
│  Type  Name    Content             Status          │
│  ───────────────────────────────────────────────  │
│  A     @       191.52.123.45       ✓ Imported    │
│  A     www     191.52.123.45       ✓ Imported    │
│  MX    @       mail.rom.adv.br     ✓ Imported    │
│  TXT   @       v=spf1...           ✓ Imported    │
│  ...                                                │
│                                                     │
│  [Continue]                                         │
└─────────────────────────────────────────────────────┘
```

**Ação:** Clique em **"Continue"** (não precisa mudar nada ainda)

---

## 🔑 PASSO 4: Alterar Nameservers

### 4.1. Instruções do Cloudflare

Cloudflare mostra os nameservers:

```
┌─────────────────────────────────────────────────────┐
│  Change your nameservers                            │
│                                                     │
│  Remove these nameservers from your registrar:     │
│  ✗ a.sec.dns.br                                    │
│  ✗ c.sec.dns.br                                    │
│                                                     │
│  Replace with Cloudflare nameservers:              │
│  ✓ amber.ns.cloudflare.com                        │
│  ✓ hugo.ns.cloudflare.com                         │
│                                                     │
│  [Copy]  nameservers                               │
│                                                     │
│  Instructions for common registrars:                │
│  [Registro.br] [GoDaddy] [Hostinger] [Other]      │
└─────────────────────────────────────────────────────┘
```

**IMPORTANTE:** Anote estes nameservers! Você vai usar no Registro.br.

### 4.2. Alterar no Registro.br

#### 4.2.1. Acessar Registro.br

```
URL: https://registro.br
Login com sua conta
```

#### 4.2.2. Selecionar Domínio

```
┌─────────────────────────────────────────┐
│  Meus Domínios                          │
│                                         │
│  ✓ rom.adv.br                          │
│    Status: Ativo                        │
│    Expira: 12/12/2025                  │
│                                         │
│    [Gerenciar]                         │
└─────────────────────────────────────────┘
```

Clique em **"Gerenciar"** no seu domínio.

#### 4.2.3. Alterar DNS

```
┌─────────────────────────────────────────┐
│  rom.adv.br - Gerenciamento             │
│                                         │
│  Opções:                                │
│  □ Renovar domínio                     │
│  □ Alterar dados                       │
│  ☑ Alterar servidores DNS              │  ← ESTE!
│  □ DNSSEC                              │
└─────────────────────────────────────────┘
```

Clique em **"Alterar servidores DNS"**

#### 4.2.4. Inserir Nameservers Cloudflare

```
┌─────────────────────────────────────────┐
│  Servidores DNS                         │
│                                         │
│  DNS 1: _________________________      │
│         amber.ns.cloudflare.com        │
│                                         │
│  DNS 2: _________________________      │
│         hugo.ns.cloudflare.com         │
│                                         │
│  [Salvar Alterações]                   │
└─────────────────────────────────────────┘
```

1. **Remova** os DNS antigos (a.sec.dns.br, c.sec.dns.br)
2. **Insira** os nameservers do Cloudflare
3. Clique em **"Salvar Alterações"**

#### 4.2.5. Confirmar

Registro.br mostra:

```
✓ Servidores DNS alterados com sucesso!

Os novos servidores DNS podem levar até 48 horas
para propagar pela internet.
```

### 4.3. Voltar ao Cloudflare

```
┌─────────────────────────────────────────┐
│  Nameservers updated?                   │
│                                         │
│  ○ I have changed my nameservers       │
│  ○ Not yet, remind me later            │
│                                         │
│  [Done, check nameservers]             │
└─────────────────────────────────────────┘
```

Selecione **"I have changed my nameservers"**
Clique em **"Done, check nameservers"**

---

## ⏳ PASSO 5: Aguardar Propagação

### 5.1. Verificação Automática

```
┌─────────────────────────────────────────┐
│  Checking nameservers...                │
│                                         │
│  This may take up to 48 hours          │
│  Typically completes in 2-6 hours      │
│                                         │
│  Status: Pending ⏳                     │
│                                         │
│  We'll email you when it's ready       │
└─────────────────────────────────────────┘
```

**Você receberá email quando ativar!**

### 5.2. Verificar Manualmente

```bash
# Linux/Mac - Terminal
dig NS rom.adv.br

# Deve mostrar:
# rom.adv.br. IN NS amber.ns.cloudflare.com
# rom.adv.br. IN NS hugo.ns.cloudflare.com

# Windows - CMD
nslookup -type=NS rom.adv.br

# Online
https://dnschecker.org
```

---

## 🎨 PASSO 6: Configurar DNS Records

Após nameservers propagarem (~2-6 horas), configure DNS:

### 6.1. Acessar DNS Settings

```
Dashboard Cloudflare → rom.adv.br → DNS → Records
```

### 6.2. Adicionar CNAME para Subdomínio

```
┌─────────────────────────────────────────────────────┐
│  DNS Records                                        │
│                                                     │
│  [+ Add record]                                     │
│                                                     │
│  Type: [CNAME ▼]                                   │
│  Name: [agente____________________]                │
│  Target: [rom-agent.onrender.com___]               │
│  Proxy status: ☑ Proxied (nuvem laranja)          │
│  TTL: [Auto ▼]                                     │
│                                                     │
│  [Save]                                            │
└─────────────────────────────────────────────────────┘
```

**Valores:**
- **Type:** CNAME
- **Name:** `agente` (cria agente.rom.adv.br)
- **Target:** `rom-agent.onrender.com` (sua URL do Render)
- **Proxy:** ✅ ATIVADO (nuvem laranja)
- **TTL:** Auto

Clique em **"Save"**

### 6.3. Resultado

Você verá:

```
┌─────────────────────────────────────────────────────┐
│  DNS Records                                        │
│                                                     │
│  Type    Name     Content                Proxy     │
│  ──────────────────────────────────────────────── │
│  CNAME   agente   rom-agent.onrender.com  🟠      │
│  A       @        191.52.123.45           🟠      │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

🟠 = Proxied (protegido pelo Cloudflare)
⚪ = DNS only (direto)

---

## 🔒 PASSO 7: Configurar SSL/TLS

### 7.1. Acessar SSL Settings

```
Dashboard → rom.adv.br → SSL/TLS
```

### 7.2. Escolher Modo SSL

```
┌─────────────────────────────────────────┐
│  SSL/TLS encryption mode                │
│                                         │
│  ○ Off (not secure)                    │
│  ○ Flexible                             │
│  ● Full                    ← ESCOLHA!  │
│  ○ Full (strict)                       │
│                                         │
│  [Save]                                │
└─────────────────────────────────────────┘
```

**Escolha: Full**

**Por quê?**
- Off: Sem HTTPS (nunca use!)
- Flexible: HTTP entre Cloudflare-Servidor (inseguro)
- **Full:** HTTPS fim a fim (Render tem SSL)
- Full (strict): Requer certificado válido

### 7.3. Always Use HTTPS

```
Dashboard → SSL/TLS → Edge Certificates
```

Ative:

```
☑ Always Use HTTPS
  Redirect all requests to HTTPS
```

### 7.4. Automatic HTTPS Rewrites

```
☑ Automatic HTTPS Rewrites
  Fix mixed content warnings
```

---

## ⚡ PASSO 8: Otimizações

### 8.1. Speed → Optimization

```
┌─────────────────────────────────────────┐
│  Auto Minify                            │
│  ☑ JavaScript                          │
│  ☑ CSS                                 │
│  ☑ HTML                                │
│                                         │
│  Brotli                                 │
│  ☑ Enable                              │
│                                         │
│  Rocket Loader™                        │
│  ☑ Enable (improve JS performance)    │
└─────────────────────────────────────────┘
```

### 8.2. Caching

```
Dashboard → Caching → Configuration

Caching Level: Standard
Browser Cache TTL: 4 hours
```

### 8.3. Security

```
Dashboard → Security → Settings

Security Level: Medium
Challenge Passage: 30 minutes

☑ Browser Integrity Check
☑ Privacy Pass Support
☑ IP Geolocation
```

---

## 🧪 PASSO 9: Testar Configuração

### 9.1. Verificar DNS

```bash
# Testar CNAME
dig agente.rom.adv.br

# Deve retornar:
# agente.rom.adv.br. 300 IN CNAME rom-agent.onrender.com
```

### 9.2. Testar HTTPS

```bash
# Linux/Mac
curl -I https://agente.rom.adv.br

# Deve retornar:
# HTTP/2 200
# server: cloudflare
```

### 9.3. Teste no Navegador

1. Abra: `https://agente.rom.adv.br`
2. Deve carregar o ROM Agent
3. Verifique cadeado verde 🔒
4. Clique no cadeado → Certificado válido

### 9.4. SSL Labs Test

```
URL: https://www.ssllabs.com/ssltest/

Digite: agente.rom.adv.br

Score esperado: A ou A+
```

---

## 📊 PASSO 10: Analytics e Monitoramento

### 10.1. Analytics

```
Dashboard → rom.adv.br → Analytics → Traffic
```

Você verá:
- Requests por segundo
- Bandwidth usado
- Países dos visitantes
- Ameaças bloqueadas

### 10.2. Alerts

Configure notificações:

```
Dashboard → Notifications

☑ SSL/TLS Certificate Expiring
☑ DDoS Attack Detected
☑ Origin Errors (5xx)
```

### 10.3. Speed Insights

```
Dashboard → Speed → Performance
```

Métricas:
- Time to First Byte (TTFB)
- First Contentful Paint
- Largest Contentful Paint
- Cumulative Layout Shift

---

## 🔐 PASSO 11: Segurança Adicional

### 11.1. Firewall Rules (Opcional)

```
Dashboard → Security → WAF

Create Firewall Rule:

If: Country is NOT in Brazil
Then: JS Challenge

[Save and Deploy]
```

### 11.2. Rate Limiting

```
Dashboard → Security → WAF → Rate limiting rules

Create rule:
- 100 requests per 10 minutes per IP
- Block for 1 hour if exceeded
```

### 11.3. Page Rules (Otimizar Performance)

```
Dashboard → Rules → Page Rules

Rule 1: Cache Everything
URL: agente.rom.adv.br/img/*
Settings:
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month

Rule 2: Bypass Cache for API
URL: agente.rom.adv.br/api/*
Settings:
- Cache Level: Bypass
```

---

## 🆘 TROUBLESHOOTING

### Nameservers não ativam

```
Problema: "Pending nameserver update"

Soluções:
1. Aguarde mais tempo (até 48h)
2. Verifique se alterou corretamente no Registro.br
3. Teste: dig NS rom.adv.br
4. Contato Cloudflare Support
```

### DNS não resolve

```
Problema: Site não carrega

Soluções:
1. Verificar propagação: https://dnschecker.org
2. Limpar cache DNS local:
   - Windows: ipconfig /flushdns
   - Mac: sudo dscacheutil -flushcache
   - Linux: sudo systemd-resolve --flush-caches
3. Teste em modo anônimo do navegador
4. Aguarde propagação (2-6h)
```

### Erro 522

```
Problema: Cloudflare error 522 (Connection timed out)

Causas:
- Servidor Render offline
- Firewall bloqueando Cloudflare
- Porta incorreta

Soluções:
1. Verificar se Render está online
2. Checar logs do Render
3. Modo "DNS only" temporariamente
```

### Mixed Content Warning

```
Problema: Recursos HTTP em página HTTPS

Solução:
- SSL/TLS → Edge Certificates
- ☑ Automatic HTTPS Rewrites
```

### Certificado inválido

```
Problema: SSL error ou certificado não confiável

Solução:
- SSL mode: Full (não Flexible)
- Aguardar geração (até 24h)
- Verificar se Render tem SSL ativo
```

---

## 📝 CHECKLIST FINAL

- [ ] Conta Cloudflare criada
- [ ] Domínio adicionado ao Cloudflare
- [ ] Nameservers alterados no Registro.br
- [ ] Nameservers propagados (2-6h)
- [ ] DNS CNAME configurado
  - [ ] Type: CNAME
  - [ ] Name: agente
  - [ ] Target: rom-agent.onrender.com
  - [ ] Proxy: Ativado (🟠)
- [ ] SSL/TLS configurado
  - [ ] Modo: Full
  - [ ] Always HTTPS: Ativado
  - [ ] Auto HTTPS Rewrites: Ativado
- [ ] Otimizações ativadas
- [ ] Segurança configurada
- [ ] Site testado: https://agente.rom.adv.br
- [ ] Cadeado verde (🔒) funcionando
- [ ] SSL Labs score A/A+

---

## 🎉 PRONTO!

Seu domínio está configurado com:

✅ Cloudflare CDN (mais rápido)
✅ SSL/HTTPS automático
✅ Proteção DDoS
✅ Firewall WAF
✅ Analytics
✅ Cache otimizado

**URL final:** https://agente.rom.adv.br

**Tempo de propagação:** 2-6 horas (até 48h)

**Próximos passos:**
1. Aguardar propagação DNS
2. Testar site
3. Configurar analytics
4. Compartilhar com usuários!

---

**Configuração concluída! Seu site está protegido e otimizado! 🛡️⚡**
