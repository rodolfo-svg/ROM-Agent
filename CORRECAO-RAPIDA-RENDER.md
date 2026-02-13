# 🔥 CORREÇÃO RÁPIDA - Render.com

## ⚡ Solução Mais Rápida: Use APENAS AWS Bedrock

Você **NÃO precisa** de Anthropic API Key porque já tem AWS Bedrock configurado!

---

## 📋 PASSOS NO RENDER.COM:

### 1. Acesse seu Dashboard
```
https://dashboard.render.com
```

### 2. Selecione o serviço ROM-Agent
- Clique no serviço na lista

### 3. Vá na aba "Environment"
- Menu lateral → **Environment**

### 4. FAÇA ESTAS CORREÇÕES:

#### ❌ DELETE estas variáveis:
- `ATAJUD_API_TOKEN` (erro de digitação)
- `ANTHROPIC_API_KEY` (está com valor errado)

#### ✏️ EDIT estas variáveis (remover aspas):

```bash
# Antes (com aspas):
CNJ_DATAJUD_API_KEY="cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="
DATAJUD_API_KEY="cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="
DATAJUD_API_TOKEN="cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="
CSRF_SECRET="W4kr78m9IOBdS3CU0LM8rB8HEaUCOb483Vuec9LK4Ac="
FALLBACK_CHAIN_JSON='["$NOVA_LITE_PROFILE_ARN","

# Depois (sem aspas):
CNJ_DATAJUD_API_KEY=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
DATAJUD_API_KEY=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
DATAJUD_API_TOKEN=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
CSRF_SECRET=W4kr78m9IOBdS3CU0LM8rB8HEaUCOb483Vuec9LK4Ac=
FALLBACK_CHAIN_JSON=["us.anthropic.claude-sonnet-4-5-20250929-v1:0","us.anthropic.claude-haiku-4-5-20251001-v1:0"]
```

#### ✅ CONFIRME que estas estão corretas:
```bash
AWS_ACCESS_KEY_ID=AKIA****************
AWS_SECRET_ACCESS_KEY=************************************
AWS_REGION=us-west-2
```

### 5. Clique em "Save Changes"
- Aguarde o redeploy automático (2-5 minutos)

---

## 🧪 TESTAR DEPOIS:

### 1. Health Check Geral
```bash
curl https://seu-app.onrender.com/api/health
```

### 2. Testar DataJud
```bash
curl https://seu-app.onrender.com/api/datajud/health
```

### 3. Interface DataJud
```
https://seu-app.onrender.com/datajud-test.html
```

---

## 📸 VISUAL - Como Fazer no Render:

```
Dashboard Render
    ↓
[Seu Serviço ROM-Agent]
    ↓
[Environment] ← Clique aqui
    ↓
Procure: ATAJUD_API_TOKEN
    ↓
[...] → Delete ← Clique aqui
    ↓
Procure: ANTHROPIC_API_KEY
    ↓
[...] → Delete ← Clique aqui
    ↓
Procure: CNJ_DATAJUD_API_KEY
    ↓
[Edit] ← Clique e remova aspas
    ↓
[Repita para outras vars com aspas]
    ↓
[Save Changes] ← Clique aqui
    ↓
Aguarde redeploy (barra azul)
    ↓
✅ PRONTO!
```

---

## ⚠️ IMPORTANTE:

### AWS Bedrock é suficiente!
- ✅ Você já tem AWS configurado
- ✅ Mesmos modelos Claude (Opus, Sonnet, Haiku)
- ✅ Funciona perfeitamente
- ✅ Geralmente mais barato que Anthropic API
- ✅ Sem necessidade de segunda chave

### ROM Agent usa automaticamente:
1. **Anthropic API** (se configurado)
2. **AWS Bedrock** (se Anthropic falhar ou não configurado) ← **Você usa este**
3. **Fallback chain** (outros modelos)

---

## 📋 CHECKLIST FINAL:

- [ ] Deletei `ATAJUD_API_TOKEN`
- [ ] Deletei `ANTHROPIC_API_KEY` (com valor errado)
- [ ] Removi aspas de `CNJ_DATAJUD_API_KEY`
- [ ] Removi aspas de `DATAJUD_API_KEY`
- [ ] Removi aspas de `DATAJUD_API_TOKEN`
- [ ] Removi aspas de `CSRF_SECRET`
- [ ] Corrigi `FALLBACK_CHAIN_JSON`
- [ ] Confirmei que AWS keys estão corretas
- [ ] Cliquei em "Save Changes"
- [ ] Aguardei redeploy
- [ ] Testei: `/api/health`
- [ ] Testei: `/api/datajud/health`
- [ ] Testei: `/datajud-test.html`

---

## 🎯 RESULTADO ESPERADO:

Depois das correções:
- ✅ ROM Agent usa AWS Bedrock automaticamente
- ✅ DataJud funciona com os 38 tribunais
- ✅ Nenhum erro de variável
- ✅ Sistema 100% operacional

---

## 💡 SE QUISER Anthropic API no futuro:

1. Acesse: https://console.anthropic.com/settings/keys
2. Crie uma chave: `sk-ant-api03-...`
3. Adicione no Render: `ANTHROPIC_API_KEY=sk-ant-api03-...`

**Mas não é necessário agora!** AWS Bedrock é suficiente.

---

**Tempo estimado:** 5 minutos
**Dificuldade:** ⭐ Fácil

Pronto! 🚀
