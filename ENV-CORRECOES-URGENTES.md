# 🔴 CORREÇÕES URGENTES - Variáveis de Ambiente

## ⚠️ ERROS CRÍTICOS ENCONTRADOS:

### 1. ❌ ATAJUD_API_TOKEN (Erro de digitação)
```bash
# REMOVA esta linha:
ATAJUD_API_TOKEN="cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="

# Você já tem as corretas:
DATAJUD_API_KEY=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
```

---

### 2. 🔥 ANTHROPIC_API_KEY (MUITO GRAVE!)
```bash
# ❌ ERRADO - Você colocou AWS Access Key:
ANTHROPIC_API_KEY=AKIATZMXLE6CDPOMBE5E

# ✅ CORRETO - Deveria ser chave Anthropic (sk-ant-...):
ANTHROPIC_API_KEY=sk-ant-api03-...SUA_CHAVE_AQUI...
```

**⚠️ ATENÇÃO:** Você precisa:
1. Obter sua chave Anthropic real em: https://console.anthropic.com/settings/keys
2. A chave começa com `sk-ant-api03-`
3. **NÃO** use AWS Access Key aqui!

---

### 3. ⚠️ Aspas desnecessárias (remova):
```bash
# ❌ ERRADO (com aspas):
CNJ_DATAJUD_API_KEY="cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="
DATAJUD_API_KEY="cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="
DATAJUD_API_TOKEN="cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="
CSRF_SECRET="W4kr78m9IOBdS3CU0LM8rB8HEaUCOb483Vuec9LK4Ac="

# ✅ CORRETO (sem aspas):
CNJ_DATAJUD_API_KEY=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
DATAJUD_API_KEY=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
DATAJUD_API_TOKEN=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
CSRF_SECRET=W4kr78m9IOBdS3CU0LM8rB8HEaUCOb483Vuec9LK4Ac=
```

---

### 4. ⚠️ FALLBACK_CHAIN_JSON (Incompleto)
```bash
# ❌ ERRADO (truncado):
FALLBACK_CHAIN_JSON='["$NOVA_LITE_PROFILE_ARN","

# ✅ CORRETO:
FALLBACK_CHAIN_JSON=["us.anthropic.claude-sonnet-4-5-20250929-v1:0","us.anthropic.claude-haiku-4-5-20251001-v1:0"]
```

---

### 5. ⚠️ Profile ARNs incompletos (Opcional)
```bash
# ❌ ERRADO (com placeholder):
NOVA_LITE_PROFILE_ARN=arn:aws:bedrock:us-west-2:260699793284:inference-profile/<ID_DO_PROFILE_LITE>
NOVA_PRO_PROFILE_ARN=arn:aws:bedrock:us-west-2:260699793284:inference-profile/<ID_DO_PROFILE_PRO>
NOVA_MICRO_PROFILE_ARN=arn:aws:bedrock:us-west-2:
NOVA_PREMIER_PROFILE_ARN=arn:aws:bedrock:us-west-2

# ✅ CORRETO (comente se não tem os IDs reais):
# NOVA_LITE_PROFILE_ARN=
# NOVA_PRO_PROFILE_ARN=
# NOVA_MICRO_PROFILE_ARN=
# NOVA_PREMIER_PROFILE_ARN=
```

---

## ✅ VARIÁVEIS DATAJUD - CORRETAS!

Estas estão **PERFEITAS** (apenas remova as aspas):

```bash
CNJ_DATAJUD_API_KEY=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
DATAJUD_API_KEY=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
DATAJUD_API_TOKEN=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
DATAJUD_BASE_URL=https://api-publica.datajud.cnj.jus.br
DATAJUD_ENABLED=true
```

✅ **Chave DataJud**: Correta (é a pública oficial do CNJ)
✅ **Base URL**: Correta
✅ **Enabled**: true (correto)

---

## 📋 CHECKLIST DE CORREÇÕES:

- [ ] **1. REMOVER** `ATAJUD_API_TOKEN` (erro de digitação)
- [ ] **2. CORRIGIR** `ANTHROPIC_API_KEY` (colocar chave real sk-ant-...)
- [ ] **3. REMOVER** aspas de: CNJ_DATAJUD_API_KEY, DATAJUD_API_KEY, DATAJUD_API_TOKEN, CSRF_SECRET
- [ ] **4. CORRIGIR** `FALLBACK_CHAIN_JSON` (valor completo)
- [ ] **5. COMENTAR** Profile ARNs incompletos (opcional)
- [ ] **6. VERIFICAR** se ANTHROPIC_API_KEY funciona após correção

---

## 🚀 COMO APLICAR NO RENDER:

### Opção 1: Via Dashboard (Recomendado)

1. Acesse: https://dashboard.render.com
2. Selecione seu serviço ROM-Agent
3. Vá em: **Environment** tab
4. **REMOVA**: `ATAJUD_API_TOKEN`
5. **EDITE**:
   - `ANTHROPIC_API_KEY` → Coloque sua chave real (sk-ant-...)
   - `CNJ_DATAJUD_API_KEY` → Remova aspas
   - `DATAJUD_API_KEY` → Remova aspas
   - `DATAJUD_API_TOKEN` → Remova aspas
   - `CSRF_SECRET` → Remova aspas
   - `FALLBACK_CHAIN_JSON` → Corrija valor
6. Clique em **Save Changes**
7. Aguarde redeploy automático

### Opção 2: Via render.yaml (Avançado)

Edite `render.yaml` e adicione as variáveis corrigidas.

---

## 🔐 OBTER CHAVE ANTHROPIC:

Se você não tem uma chave Anthropic API:

1. Acesse: https://console.anthropic.com/
2. Faça login/cadastro
3. Vá em: **Settings** → **API Keys**
4. Clique em: **Create Key**
5. Copie a chave (começa com `sk-ant-api03-`)
6. Cole no Render em `ANTHROPIC_API_KEY`

**Preço:** $4/milhão tokens (Haiku) a $75/milhão (Opus)

---

## ⚠️ VARIÁVEIS FALTANDO (Opcional):

Você pode adicionar estas para melhor compatibilidade:

```bash
# API Version
API_VERSION=v2.8.0

# Bedrock Models (já tem AWS configurado)
BEDROCK_MODELS_ENABLED=true
BEDROCK_OPUS_MODEL=anthropic.claude-opus-4-5-20251101-v1:0
BEDROCK_SONNET_MODEL=anthropic.claude-sonnet-4-5-20250929-v1:0
BEDROCK_HAIKU_MODEL=anthropic.claude-haiku-4-5-20251001-v1:0

# CORS (se precisar)
CORS_ORIGIN=*
```

---

## 📁 ARQUIVO CORRIGIDO:

Criei o arquivo: `.env.render-corrected`

Use este arquivo como referência para corrigir suas variáveis no Render.

---

## 🧪 TESTAR DEPOIS DE CORRIGIR:

```bash
# 1. Health check geral
curl https://seu-app.onrender.com/api/health

# 2. Testar DataJud
curl https://seu-app.onrender.com/api/datajud/health

# 3. Testar chat (Anthropic)
curl -X POST https://seu-app.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"teste"}'
```

---

## 📞 PRECISA DE AJUDA?

1. Arquivo corrigido: `.env.render-corrected`
2. Este guia: `ENV-CORRECOES-URGENTES.md`
3. Documentação DataJud: `DATAJUD-QUICKSTART.md`

---

**Última atualização:** 2026-02-12
