# 🌐 Configuração do Domínio iarom.com.br

## 📋 Checklist de Configuração

- [ ] 1. Adicionar domínio customizado no Render
- [ ] 2. Configurar DNS no Registro.br
- [ ] 3. Aguardar propagação (1-48h)
- [ ] 4. Verificar certificado SSL
- [ ] 5. Testar acesso

---

## 🚀 Passo 1: Render Dashboard

### Acessar:
https://dashboard.render.com/

### Passos no Render:

1. **Selecione seu serviço web**:
   - Procure por "ROM-Agent" ou "rom-agent-ia"
   - Clique para abrir

2. **Vá para "Settings"** (menu lateral esquerdo)

3. **Role até "Custom Domains"**

4. **Clique em "+ Add Custom Domain"**

5. **Digite**: `iarom.com.br`

6. **Clique "Save"**

7. **O Render vai mostrar os registros DNS necessários**

### O Render vai fornecer algo assim:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para iarom.com.br:

Opção 1 - CNAME (RECOMENDADO):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TIPO:  CNAME
NOME:  @ (ou deixe vazio para root)
VALOR: rom-agent-ia.onrender.com
TTL:   3600

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Opção 2 - A Record (se CNAME não funcionar):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TIPO:  A
NOME:  @
VALOR: [IP fornecido pelo Render]
TTL:   3600

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para www.iarom.com.br:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TIPO:  CNAME
NOME:  www
VALOR: rom-agent-ia.onrender.com
TTL:   3600
```

**⚠️ IMPORTANTE**: Anote os valores EXATOS que o Render fornecer!

---

## 🌐 Passo 2: Configurar DNS no Registro.br

### Acessar Painel do Registro.br:
https://registro.br/

1. **Faça login** com suas credenciais

2. **Selecione o domínio**: `iarom.com.br`

3. **Vá em "DNS" ou "Servidores DNS"**

4. **Se estiver usando DNS do Registro.br**:
   - Clique em "Editar Zona"
   - Adicione os registros fornecidos pelo Render

5. **Se estiver usando Cloudflare ou outro DNS**:
   - Acesse o painel do seu provedor DNS
   - Adicione os registros lá

### Configuração DNS Recomendada:

```dns
# Root domain (iarom.com.br)
@     3600  IN  CNAME  rom-agent-ia.onrender.com.

# www subdomain
www   3600  IN  CNAME  rom-agent-ia.onrender.com.

# (OPCIONAL) Redirecionar www para root
# Ou configurar ambos apontando para o Render
```

### Se o Registro.br não aceitar CNAME no root (@):

Use **ALIAS** ou **ANAME** se disponível, ou configure um **A Record** com o IP fornecido pelo Render.

---

## ⏱️ Passo 3: Aguardar Propagação DNS

### Tempo de propagação:
- **Mínimo**: 1-2 horas
- **Máximo**: 48 horas
- **Média**: 6-12 horas

### Verificar propagação:

**Método 1 - DNS Checker Online**:
https://dnschecker.org
- Digite: iarom.com.br
- Veja se aparece o CNAME ou IP do Render

**Método 2 - Terminal (Mac/Linux)**:
```bash
# Verificar CNAME
dig iarom.com.br CNAME +short

# Verificar A record
dig iarom.com.br A +short

# Verificar www
dig www.iarom.com.br CNAME +short
```

**Método 3 - nslookup (Windows/Mac/Linux)**:
```bash
nslookup iarom.com.br
nslookup www.iarom.com.br
```

---

## 🔒 Passo 4: Certificado SSL (Automático)

**O Render configura SSL automaticamente!**

### Após DNS propagar:

1. Volte ao Render Dashboard
2. Na seção "Custom Domains", você verá:
   ```
   iarom.com.br
   Status: ✅ Active
   SSL: ✅ Verified
   ```

3. **Aguarde 5-15 minutos** após DNS propagar
4. O Render emite certificado Let's Encrypt automaticamente

---

## ✅ Passo 5: Testar Acesso

### URLs para testar:

```
✅ https://iarom.com.br
✅ https://www.iarom.com.br
✅ https://iarom.com.br/version.json (verificar versão)
✅ https://iarom.com.br/api/info (verificar API)
```

### Teste no navegador:

1. **Limpe cache** do navegador:
   - Chrome/Edge: `Ctrl + Shift + Delete`
   - Safari: `Cmd + Option + E`

2. **Force Refresh**:
   - `Ctrl + F5` (Windows)
   - `Cmd + Shift + R` (Mac)

3. **Modo anônimo/privado** (recomendado para primeiro teste)

---

## 🔧 Troubleshooting

### Problema: "DNS_PROBE_FINISHED_NXDOMAIN"
**Solução**: DNS ainda não propagou. Aguarde mais tempo.

### Problema: "NET::ERR_CERT_COMMON_NAME_INVALID"
**Solução**: SSL ainda não foi emitido. Aguarde 15 min e force refresh.

### Problema: "Este site não pode ser acessado"
**Solução**:
1. Verifique se DNS está correto no Registro.br
2. Confirme que CNAME aponta para `rom-agent-ia.onrender.com`
3. Aguarde propagação completa

### Problema: Página não carrega (fica em branco)
**Solução**:
1. Verifique se Render está "Active" (não em sleep)
2. Acesse primeiro via https://rom-agent-ia.onrender.com para "acordar"
3. Depois acesse via iarom.com.br

---

## 📊 Verificação Pós-Configuração

### Checklist Final:

```bash
✅ DNS propagado (use dnschecker.org)
✅ SSL ativo (cadeado verde no navegador)
✅ https://iarom.com.br carrega
✅ https://www.iarom.com.br carrega
✅ Redirecionamento HTTP → HTTPS funciona
✅ API endpoints respondem (/api/info, /api/kb/statistics)
```

---

## 🎯 Configuração Ideal (Resumo)

### No Registro.br:
```dns
iarom.com.br.    IN  CNAME  rom-agent-ia.onrender.com.
www              IN  CNAME  rom-agent-ia.onrender.com.
```

### No Render:
```
Custom Domains:
- iarom.com.br (Primary)
- www.iarom.com.br (Alias)

SSL: Auto (Let's Encrypt)
Status: Active
```

---

## 📞 Suporte

### Se precisar de ajuda:

**Render Support**:
- Docs: https://render.com/docs/custom-domains
- Support: https://render.com/support

**Registro.br**:
- Suporte: https://registro.br/suporte/
- FAQ DNS: https://registro.br/faq/

---

## 🚀 Após Configuração Completa

### Atualize variáveis de ambiente no Render (se necessário):

```env
# Em Settings > Environment
DOMAIN=iarom.com.br
BASE_URL=https://iarom.com.br
```

### Teste final completo:

```bash
# Verificar versão
curl https://iarom.com.br/version.json

# Verificar API
curl https://iarom.com.br/api/info

# Verificar KB
curl https://iarom.com.br/api/kb/statistics
```

---

## ✅ Pronto!

Seu ROM Agent estará acessível em:

🌐 **https://iarom.com.br**

Com:
- ✅ SSL/HTTPS automático
- ✅ Performance otimizada
- ✅ Domínio profissional
- ✅ Todos os sistemas ativos

**Tempo total estimado**: 2-6 horas (devido propagação DNS)
