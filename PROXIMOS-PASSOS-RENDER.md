# 🚀 PRÓXIMOS PASSOS NO RENDER - Configuração Final

## ✅ O QUE JÁ ESTÁ PRONTO

- ✅ Código v2.8.0 no GitHub
- ✅ render.yaml configurado com domínio
- ✅ Auto-deploy ativado
- ✅ Sistema de tarifação completo
- ✅ Upload chunked (arquivos gigantes)
- ✅ Interface mobile de timbrado
- ✅ 113+ APIs funcionando

## ⚠️ O QUE FALTA FAZER (NO DASHBOARD DO RENDER)

### 1️⃣ ADICIONAR VARIÁVEIS DE AMBIENTE (CRÍTICO!)

Sem essas variáveis, o site vai dar erro de credenciais.

**Como fazer:**
1. Ir em: https://dashboard.render.com
2. Selecionar seu serviço "ROM Agent" (ou nome do seu app)
3. Ir em: **Environment** (menu lateral)
4. Clicar em: **Add Environment Variable**

**Variáveis para adicionar:**

```
AWS_ACCESS_KEY_ID
Valor: (copiar do seu arquivo .env local)

AWS_SECRET_ACCESS_KEY
Valor: (copiar do seu arquivo .env local)

AWS_REGION
Valor: us-east-1

CNJ_DATAJUD_API_KEY
Valor: (copiar do seu arquivo .env local)

NODE_ENV
Valor: production

PORT
Valor: 10000
```

**IMPORTANTE:** Depois de adicionar, o Render vai fazer um **redeploy automático**.

---

### 2️⃣ CONFIGURAR DOMÍNIO iarom.com.br

**No Render:**

1. Ir em: **Settings** → **Custom Domains**
2. Clicar em: **Add Custom Domain**
3. Digitar: `iarom.com.br`
4. Clicar em: **Verify**
5. Render vai fornecer um IP ou CNAME

**Copiar o valor fornecido** (exemplo: `76.76.21.21` ou similar)

**No Registro.br:**

1. Login em: https://registro.br
2. Ir em: **Meus Domínios** → **iarom.com.br**
3. Clicar em: **Editar Zona**
4. Adicionar registros:

```
Tipo: A
Nome: @
Valor: (IP fornecido pelo Render)
TTL: 3600

Tipo: CNAME
Nome: www
Valor: iarom.com.br
TTL: 3600
```

5. Salvar

**Aguardar**: 2-48 horas para DNS propagar

**Testar propagação:**
```bash
dig iarom.com.br
curl https://iarom.com.br/api/info
```

---

### 3️⃣ VERIFICAR DEPLOY AUTOMÁTICO

Depois que você adicionou as variáveis, o Render começou um novo deploy.

**Acompanhar:**

1. Dashboard do Render → **Logs**
2. Ver mensagens em tempo real
3. Aguardar mensagem: "Live at: https://..."

**Se der erro:**
- Verificar se TODAS as variáveis foram adicionadas
- Verificar se os valores estão corretos (sem espaços extras)
- Reiniciar manualmente: **Manual Deploy** → **Deploy latest commit**

---

## 🎯 CHECKLIST RÁPIDO

```
RENDER DASHBOARD:
- [ ] Abrir https://dashboard.render.com
- [ ] Selecionar serviço ROM Agent
- [ ] Environment → Add Environment Variable
- [ ] Adicionar: AWS_ACCESS_KEY_ID (do .env)
- [ ] Adicionar: AWS_SECRET_ACCESS_KEY (do .env)
- [ ] Adicionar: AWS_REGION=us-east-1
- [ ] Adicionar: CNJ_DATAJUD_API_KEY (do .env)
- [ ] Adicionar: NODE_ENV=production
- [ ] Adicionar: PORT=10000
- [ ] Aguardar redeploy automático (~2-3 min)
- [ ] Verificar Logs (deve mostrar "Live at...")

DOMÍNIO:
- [ ] Settings → Custom Domains
- [ ] Add Custom Domain: iarom.com.br
- [ ] Copiar IP/CNAME fornecido
- [ ] Ir no Registro.br
- [ ] Editar Zona DNS
- [ ] Adicionar registro A (@) apontando para IP
- [ ] Adicionar registro CNAME (www) apontando para iarom.com.br
- [ ] Salvar
- [ ] Aguardar 24-48h para propagação

TESTE FINAL:
- [ ] Testar URL Render: https://[seu-app].onrender.com/api/info
- [ ] Deve retornar JSON com "aws": {"configured": true}
- [ ] Testar chat: https://[seu-app].onrender.com
- [ ] Testar tarifação: https://[seu-app].onrender.com/tarifa.html
- [ ] Após DNS propagar: https://iarom.com.br/api/info
```

---

## 📊 TESTANDO NOVAS FUNCIONALIDADES

### API de Tarifação

```bash
# Tabela de preços
curl https://[seu-app].onrender.com/api/pricing/table

# Estimativa de petição inicial
curl https://[seu-app].onrender.com/api/pricing/estimate/peticao-inicial?model=sonnet

# Cálculo personalizado
curl -X POST https://[seu-app].onrender.com/api/pricing/calculate \
  -H "Content-Type: application/json" \
  -d '{"operation":"recurso-especial","model":"opus"}'
```

### Upload Chunked (arquivos gigantes)

```bash
# 1. Iniciar sessão
curl -X POST https://[seu-app].onrender.com/api/upload/chunked/init \
  -H "Content-Type: application/json" \
  -d '{"filename":"arquivo-grande.pdf","fileSize":500000000,"contentType":"application/pdf"}'

# Retorna: {"uploadId":"...","totalChunks":100,"chunkSize":5242880}

# 2. Upload de chunks (fazer em loop para todos os chunks)
curl -X POST https://[seu-app].onrender.com/api/upload/chunked/[uploadId]/chunk/0 \
  --data-binary @chunk0.bin

# 3. Finalizar
curl -X POST https://[seu-app].onrender.com/api/upload/chunked/[uploadId]/finalize
```

### Interface Web

```
Tarifação: https://[seu-app].onrender.com/tarifa.html
Timbrado Mobile: https://[seu-app].onrender.com/mobile-timbrado.html
Chat Principal: https://[seu-app].onrender.com
```

---

## 🔧 TROUBLESHOOTING

### ❌ "Could not load credentials from any providers"

**Causa:** Variáveis AWS não configuradas no Render

**Solução:**
1. Dashboard Render → Environment
2. Adicionar AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY
3. Aguardar redeploy

### ❌ "Module not found"

**Causa:** Deploy falhou ou dependências não instaladas

**Solução:**
1. Render Dashboard → Manual Deploy
2. Deploy latest commit
3. Ver logs para identificar erro

### ❌ Domínio não funciona

**Causa:** DNS não propagou ou configuração incorreta

**Solução:**
1. Testar: `dig iarom.com.br`
2. Verificar se aponta para IP do Render
3. Aguardar até 48h
4. Se não resolver: Verificar registros no Registro.br

### ❌ Site muito lento

**Causa:** Plan free do Render hiberna após inatividade

**Solução:**
1. Upgrade para plan Starter ($7/mês)
2. Ou: Configurar health check para manter ativo

---

## 🎉 RESULTADO ESPERADO

Após completar todos os passos:

✅ **GitHub**: Código v2.8.0 sincronizado
✅ **Render**: Deploy automático funcionando
✅ **AWS Bedrock**: Conectado e funcionando
✅ **APIs**: 113+ endpoints ativos
✅ **Tarifação**: Cálculo completo de custos
✅ **Upload**: Suporte a arquivos gigantes (GB+)
✅ **Mobile**: Interface responsiva
✅ **Domínio**: iarom.com.br ativo (após DNS)

**Fluxo Automático Funcionando:**
```
Você → git push
↓
GitHub (código salvo)
↓
Render (deploy automático)
↓
AWS Bedrock (IA conectada)
↓
iarom.com.br (site ativo)
↓
Usuários (acesso via web/mobile)
```

---

## 📞 URLs IMPORTANTES

| Serviço | URL |
|---------|-----|
| **GitHub Repo** | https://github.com/rodolfo-svg/ROM-Agent |
| **Render Dashboard** | https://dashboard.render.com |
| **Registro.br** | https://registro.br |
| **App Render** | https://[seu-app].onrender.com |
| **Domínio Final** | https://iarom.com.br (após DNS) |
| **Calculadora** | https://iarom.com.br/tarifa.html |
| **Mobile Timbrado** | https://iarom.com.br/mobile-timbrado.html |

---

## 💡 DICAS PROFISSIONAIS

1. **Monitorar Logs**: Deixe a aba de Logs do Render aberta durante o primeiro deploy
2. **Testar Gradualmente**: Primeiro teste no Render, depois configure domínio
3. **Backup de .env**: Guarde uma cópia segura das credenciais
4. **Upgrade de Plan**: Plan Free hiberna. Starter ($7/mês) é mais confiável
5. **Health Check**: Configure `/api/info` como health check endpoint
6. **SSL Automático**: Render configura SSL gratuito automaticamente
7. **Custom 404**: Crie uma página 404.html personalizada
8. **Analytics**: Integre Google Analytics ou similar

---

## ⏱️ TEMPO ESTIMADO

| Tarefa | Tempo |
|--------|-------|
| Adicionar variáveis no Render | 5 minutos |
| Aguardar redeploy | 2-3 minutos |
| Configurar domínio no Render | 2 minutos |
| Configurar DNS no Registro.br | 3 minutos |
| **Aguardar propagação DNS** | **2-48 horas** |
| Testes finais | 10 minutos |
| **TOTAL (excluindo DNS)** | **~20 minutos** |

---

## 🎯 PRÓXIMO PASSO IMEDIATO

**AGORA**:
1. Abra: https://dashboard.render.com
2. Vá em: Environment
3. Adicione as 6 variáveis (copie do .env local)
4. Aguarde o redeploy
5. Teste: https://[seu-app].onrender.com/api/info

**Deve retornar**:
```json
{
  "success": true,
  "version": "2.8.0",
  "aws": {
    "configured": true,
    "region": "us-east-1"
  },
  "features": [...],
  "stats": {...}
}
```

Se retornar isso → **TUDO FUNCIONANDO!** ✅

---

**Data**: 15/12/2025
**Versão**: v2.8.0
**Status**: Aguardando configuração no Render Dashboard
