# 🌐 CONFIGURAÇÃO DE DOMÍNIO CUSTOMIZADO - iarom.com.br

**Domínio**: iarom.com.br
**Registrador**: Registro.br
**Plataforma**: Render.com
**Data**: 13 de dezembro de 2024
**Status**: 📋 Guia de Configuração

---

## 🎯 RESUMO EXECUTIVO

Este documento contém o passo a passo completo para configurar o domínio **iarom.com.br** no Render.com, incluindo:
- Configuração no painel Render
- Configuração no Registro.br
- Certificado SSL automático (HTTPS)
- Redirecionamento www → não-www
- Validação e testes

**Tempo estimado**: 10-30 minutos (propagação DNS pode levar até 48h)

---

## 📋 PRÉ-REQUISITOS

- [x] Domínio iarom.com.br registrado no Registro.br
- [x] Acesso ao painel do Registro.br
- [x] Serviço ROM Agent rodando no Render.com
- [ ] Acesso ao dashboard do Render.com

---

## 🚀 PARTE 1: CONFIGURAÇÃO NO RENDER.COM

### Passo 1: Acessar o Dashboard do Render

1. Acesse: https://dashboard.render.com
2. Faça login com sua conta
3. Selecione o serviço **rom-agent** (ou nome similar)

### Passo 2: Adicionar Custom Domain

1. No menu lateral, clique em **Settings**
2. Role até a seção **Custom Domains**
3. Clique no botão **+ Add Custom Domain**

### Passo 3: Configurar o Domínio Principal

**Configuração Recomendada: Domínio Raiz (iarom.com.br)**

```
Custom Domain: iarom.com.br
```

**Importante**: O Render irá fornecer 2 tipos de DNS:

#### Opção A: CNAME Record (Recomendado se disponível)
```
Type: CNAME
Name: @ (ou deixe em branco)
Value: [será fornecido pelo Render, ex: rom-agent-xyz.onrender.com]
```

#### Opção B: A Records (Padrão para domínios raiz)
O Render fornecerá 2 endereços IP:
```
Type: A
Name: @ (ou deixe em branco)
Value: [IP1 fornecido pelo Render]

Type: A
Name: @ (ou deixe em branco)
Value: [IP2 fornecido pelo Render]
```

### Passo 4: Adicionar Subdomínio www (Opcional mas Recomendado)

Após adicionar iarom.com.br, adicione também:

```
Custom Domain: www.iarom.com.br
```

O Render fornecerá:
```
Type: CNAME
Name: www
Value: [mesmo valor do domínio principal]
```

### Passo 5: Anotar os Valores DNS

**IMPORTANTE**: Anote os valores exatos fornecidos pelo Render antes de prosseguir.

Exemplo do que você verá no Render:
```
Domain: iarom.com.br
Status: ⚠️ Waiting for DNS Configuration

DNS Records to Add:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type    Name    Value
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A       @       216.24.57.1
A       @       216.24.57.253
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🌐 PARTE 2: CONFIGURAÇÃO NO REGISTRO.BR

### Passo 1: Acessar o Painel do Registro.br

1. Acesse: https://registro.br
2. Faça login com seu CPF/CNPJ e senha
3. Clique em **Painel de Controle**
4. Selecione o domínio **iarom.com.br**

### Passo 2: Acessar a Configuração de DNS

1. No menu do domínio, clique em **DNS**
2. Você verá a lista atual de registros DNS
3. Clique em **Editar Zona**

### Passo 3: Remover Registros Antigos (Se Necessário)

**ATENÇÃO**: Antes de adicionar novos registros, remova qualquer registro A ou CNAME existente que aponte para @ (domínio raiz).

### Passo 4: Adicionar os Registros DNS do Render

#### Configuração para Domínio Raiz (iarom.com.br)

**Se o Render forneceu IPs (A Records)**:

```
Tipo: A
Nome: @ (ou deixe em branco para domínio raiz)
Conteúdo: [IP1 fornecido pelo Render, ex: 216.24.57.1]
TTL: 3600 (1 hora)

Tipo: A
Nome: @ (ou deixe em branco para domínio raiz)
Conteúdo: [IP2 fornecido pelo Render, ex: 216.24.57.253]
TTL: 3600 (1 hora)
```

**Se o Render forneceu CNAME**:

```
Tipo: CNAME
Nome: @ (ou deixe em branco)
Conteúdo: [valor fornecido pelo Render, ex: rom-agent-xyz.onrender.com]
TTL: 3600
```

#### Configuração para www.iarom.com.br

```
Tipo: CNAME
Nome: www
Conteúdo: iarom.com.br (ou valor fornecido pelo Render)
TTL: 3600
```

### Passo 5: Salvar as Alterações

1. Revise todos os registros cuidadosamente
2. Clique em **Salvar** ou **Aplicar Alterações**
3. Confirme a operação

### Passo 6: Aguardar Propagação DNS

**Tempo de Propagação**:
- Mínimo: 10-30 minutos
- Máximo: 48 horas
- Média: 2-6 horas

**Dica**: O Registro.br costuma ter propagação rápida (< 1 hora).

---

## 🔒 PARTE 3: CERTIFICADO SSL (HTTPS) - AUTOMÁTICO

### O Render Configura SSL Automaticamente

Assim que o DNS estiver propagado:

1. O Render detectará automaticamente a configuração correta
2. Solicitará um certificado SSL gratuito da Let's Encrypt
3. Instalará o certificado (processo leva 5-10 minutos)
4. Ativará HTTPS automaticamente

### Status no Render

Você verá a progressão:

```
⚠️ Waiting for DNS Configuration
   ↓ (após propagação DNS)
🔄 Requesting SSL Certificate
   ↓ (após alguns minutos)
✅ Active (HTTPS enabled)
```

### Redirecionamento HTTP → HTTPS

O Render configura automaticamente:
- http://iarom.com.br → https://iarom.com.br ✅
- http://www.iarom.com.br → https://www.iarom.com.br ✅

---

## 🧪 PARTE 4: VALIDAÇÃO E TESTES

### Teste 1: Verificar Propagação DNS

**No Terminal (Mac/Linux)**:
```bash
# Verificar registro A
dig iarom.com.br A

# Verificar CNAME do www
dig www.iarom.com.br CNAME

# Verificar propagação global
nslookup iarom.com.br
```

**Online**:
- https://dnschecker.org
- Digite: iarom.com.br
- Verifique se os IPs do Render aparecem em todos os servidores

### Teste 2: Acessar o Site

Após propagação, acesse:

1. **http://iarom.com.br**
   - Deve redirecionar para https://iarom.com.br
   - Deve mostrar o ROM Agent

2. **https://iarom.com.br**
   - Deve mostrar o cadeado verde 🔒
   - Deve carregar o ROM Agent normalmente

3. **www.iarom.com.br**
   - Deve redirecionar para https://iarom.com.br (ou https://www.iarom.com.br)

### Teste 3: Verificar Certificado SSL

1. Acesse: https://iarom.com.br
2. Clique no cadeado 🔒 ao lado da URL
3. Verifique:
   - Certificado válido
   - Emitido por: Let's Encrypt
   - Válido por: 90 dias (renovação automática)

### Teste 4: Verificar APIs

```bash
# Teste de info
curl https://iarom.com.br/api/info

# Teste de projetos
curl https://iarom.com.br/api/projects/list

# Teste de KB stats
curl https://iarom.com.br/api/kb/stats
```

---

## 🔧 CONFIGURAÇÕES ADICIONAIS (OPCIONAL)

### Redirecionamento www → não-www

Se você prefere que www.iarom.com.br redirecione para iarom.com.br:

**No Registro.br**:
```
Tipo: CNAME
Nome: www
Conteúdo: iarom.com.br
TTL: 3600
```

O Render detectará e aplicará o redirecionamento automaticamente.

### Subdomínios Adicionais (Exemplo)

Se no futuro quiser criar subdomínios como:
- api.iarom.com.br
- dashboard.iarom.com.br
- docs.iarom.com.br

**No Render**: Adicione cada subdomínio em Custom Domains

**No Registro.br**: Adicione registros CNAME:
```
Tipo: CNAME
Nome: api
Conteúdo: [valor fornecido pelo Render]
TTL: 3600
```

---

## 📊 EXEMPLO COMPLETO DE ZONA DNS

Assim ficará sua zona DNS no Registro.br após configuração completa:

```
; Zona DNS para iarom.com.br
$TTL 3600

; Domínio raiz - aponta para Render
@       IN  A       216.24.57.1
@       IN  A       216.24.57.253

; Subdomínio www - aponta para Render
www     IN  CNAME   iarom.com.br.

; Registros MX (email) - manter se você usa email @iarom.com.br
@       IN  MX  10  mail.iarom.com.br.

; Outros registros conforme necessário
```

---

## ⚠️ TROUBLESHOOTING - PROBLEMAS COMUNS

### Problema 1: DNS não propaga após 2 horas

**Solução**:
1. Verifique se salvou as alterações no Registro.br
2. Limpe cache DNS local:
   ```bash
   # Mac
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

   # Windows
   ipconfig /flushdns

   # Linux
   sudo systemd-resolve --flush-caches
   ```
3. Teste em navegador anônimo ou outro dispositivo

### Problema 2: Certificado SSL não é emitido

**Causa Comum**: DNS ainda propagando ou configuração incorreta

**Solução**:
1. Aguarde mais tempo (até 48h)
2. Verifique se os IPs/CNAME estão corretos
3. No Render, remova e adicione o domínio novamente
4. Verifique se não há CAA records bloqueando Let's Encrypt

### Problema 3: "Este site não pode fornecer uma conexão segura"

**Causa**: Certificado ainda não foi emitido ou expirou

**Solução**:
1. Aguarde alguns minutos
2. Force renovação removendo e adicionando domínio no Render
3. Verifique logs no Render para erros

### Problema 4: Site carrega mas API retorna erro

**Causa**: CORS ou configuração de ambiente

**Solução**:
1. Verifique variáveis de ambiente no Render
2. Adicione domínio na configuração CORS se necessário
3. Verifique logs do servidor

---

## 📝 CHECKLIST DE CONFIGURAÇÃO

### Antes de Começar
- [ ] Tenho acesso ao painel do Registro.br
- [ ] Tenho acesso ao dashboard do Render.com
- [ ] Anotei os valores DNS fornecidos pelo Render

### No Render.com
- [ ] Adicionei iarom.com.br em Custom Domains
- [ ] Adicionei www.iarom.com.br em Custom Domains
- [ ] Anotei os valores DNS fornecidos (IPs ou CNAME)

### No Registro.br
- [ ] Acessei a configuração de DNS
- [ ] Removi registros antigos conflitantes
- [ ] Adicionei registros A ou CNAME para @ (raiz)
- [ ] Adicionei CNAME para www
- [ ] Salvei as alterações

### Validação
- [ ] Aguardei propagação DNS (mínimo 30 min)
- [ ] Testei http://iarom.com.br (deve redirecionar HTTPS)
- [ ] Testei https://iarom.com.br (deve carregar com SSL)
- [ ] Testei www.iarom.com.br
- [ ] Verifiquei certificado SSL (cadeado verde)
- [ ] Testei APIs funcionando

---

## 🔐 SEGURANÇA

### Certificado SSL

**Let's Encrypt (Render)**:
- ✅ Gratuito
- ✅ Renovação automática (a cada 60 dias)
- ✅ Suportado por todos os navegadores
- ✅ Criptografia TLS 1.2/1.3

**Nenhuma ação manual necessária para renovação!**

### HSTS (HTTP Strict Transport Security)

O Render habilita HSTS automaticamente após SSL estar ativo:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Isso força HTTPS em todos os acessos futuros.

### Firewall e DDoS Protection

O Render inclui:
- ✅ Proteção DDoS básica
- ✅ Rate limiting
- ✅ Firewall de aplicação web (WAF básico)

---

## 📞 SUPORTE

### Render.com
- Dashboard: https://dashboard.render.com
- Docs: https://render.com/docs/custom-domains
- Suporte: https://render.com/support

### Registro.br
- Painel: https://registro.br
- FAQ: https://registro.br/faq
- Suporte: suporte@registro.br
- Telefone: 0800 887 0140

---

## 🎉 RESULTADO ESPERADO

Após configuração completa e propagação DNS:

### URLs Funcionais
```
✅ https://iarom.com.br
   → Carrega ROM Agent
   → Certificado SSL válido
   → Redirecionamento automático de HTTP

✅ https://www.iarom.com.br
   → Redireciona para https://iarom.com.br
   → Ou carrega diretamente (dependendo da configuração)

✅ APIs disponíveis:
   → https://iarom.com.br/api/info
   → https://iarom.com.br/api/projects/list
   → https://iarom.com.br/api/kb/stats
```

### Performance
```
🚀 Tempo de carregamento: < 2 segundos
🔒 SSL Handshake: < 100ms
🌐 Global CDN: Edge locations
📊 Uptime: 99.9%
```

---

## 📅 PRÓXIMOS PASSOS APÓS CONFIGURAÇÃO

1. **Atualizar Links**
   - Atualize links antigos para https://iarom.com.br
   - Configure redirecionamento do domínio antigo (se houver)

2. **SEO**
   - Adicione sitemap.xml
   - Configure Google Search Console
   - Adicione Google Analytics

3. **Monitoramento**
   - Configure alertas no Render
   - Monitore certificado SSL (renovação automática)
   - Configure uptime monitoring

4. **Marketing**
   - Atualize redes sociais com novo domínio
   - Atualize materiais de marketing
   - Configure emails @iarom.com.br (se necessário)

---

**🌐 Domínio iarom.com.br configurado com sucesso!**

**Data**: 13 de dezembro de 2024
**Status**: 📋 Aguardando configuração manual no Render e Registro.br
**Tempo Estimado**: 10-30 minutos + propagação DNS

---

## 📖 REFERÊNCIAS

- [Render Custom Domains Guide](https://render.com/docs/custom-domains)
- [Registro.br DNS Configuration](https://registro.br/tecnologia/dns.html)
- [Let's Encrypt](https://letsencrypt.org)
- [DNS Checker](https://dnschecker.org)
