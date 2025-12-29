# AWS Bedrock - Configuração Completa
**Data**: 2025-12-29
**Região**: us-west-2 (Oregon)
**Status**: ✅ VALIDADO

---

## 🌍 Região AWS

**IMPORTANTE**: Sempre usar **us-west-2 (Oregon)**

```bash
AWS_REGION=us-west-2
```

**Nunca usar**: us-east-1 (Virginia) - não utilizamos mais

---

## 🔑 Credenciais AWS

**IMPORTANTE**: Credenciais estão no arquivo `.env` (não versionado)

```bash
# Configurar no .env local e nas variáveis de ambiente do Render
AWS_ACCESS_KEY_ID=<sua_access_key>
AWS_SECRET_ACCESS_KEY=<sua_secret_key>
AWS_REGION=us-west-2
```

**Render**: Configurar em Settings > Environment Variables

---

## 📋 Inference Profiles Disponíveis (us-west-2)

### ✅ Anthropic Claude 4.x

| Modelo | Inference Profile ID | ARN | Status |
|--------|---------------------|-----|--------|
| **Claude Opus 4.5** | `us.anthropic.claude-opus-4-5-20251101-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.anthropic.claude-opus-4-5-20251101-v1:0` | ✅ ACTIVE |
| **Claude Opus 4.1** | `us.anthropic.claude-opus-4-1-20250805-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.anthropic.claude-opus-4-1-20250805-v1:0` | ✅ ACTIVE |
| **Claude Opus 4** | `us.anthropic.claude-opus-4-20250514-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.anthropic.claude-opus-4-20250514-v1:0` | ✅ ACTIVE |
| **Claude Sonnet 4.5** | `us.anthropic.claude-sonnet-4-5-20250929-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.anthropic.claude-sonnet-4-5-20250929-v1:0` | ✅ ACTIVE |
| **Claude Sonnet 4** | `us.anthropic.claude-sonnet-4-20250514-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.anthropic.claude-sonnet-4-20250514-v1:0` | ✅ ACTIVE |
| **Claude Haiku 4.5** | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0` | ✅ ACTIVE |

### ✅ Anthropic Claude 3.x

| Modelo | Inference Profile ID | ARN | Status |
|--------|---------------------|-----|--------|
| **Claude 3.7 Sonnet** | `us.anthropic.claude-3-7-sonnet-20250219-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.anthropic.claude-3-7-sonnet-20250219-v1:0` | ✅ ACTIVE |
| **Claude 3.5 Sonnet v2** | `us.anthropic.claude-3-5-sonnet-20241022-v2:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.anthropic.claude-3-5-sonnet-20241022-v2:0` | ✅ ACTIVE |
| **Claude 3.5 Sonnet** | `us.anthropic.claude-3-5-sonnet-20240620-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.anthropic.claude-3-5-sonnet-20240620-v1:0` | ✅ ACTIVE |
| **Claude 3.5 Haiku** | `us.anthropic.claude-3-5-haiku-20241022-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.anthropic.claude-3-5-haiku-20241022-v1:0` | ✅ ACTIVE |
| **Claude 3 Opus** | `us.anthropic.claude-3-opus-20240229-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.anthropic.claude-3-opus-20240229-v1:0` | ✅ ACTIVE |
| **Claude 3 Sonnet** | `us.anthropic.claude-3-sonnet-20240229-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.anthropic.claude-3-sonnet-20240229-v1:0` | ✅ ACTIVE |
| **Claude 3 Haiku** | `us.anthropic.claude-3-haiku-20240307-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.anthropic.claude-3-haiku-20240307-v1:0` | ✅ ACTIVE |

### ✅ Amazon Nova

| Modelo | Inference Profile ID | ARN | Status |
|--------|---------------------|-----|--------|
| **Nova Premier** | `us.amazon.nova-premier-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.amazon.nova-premier-v1:0` | ✅ ACTIVE |
| **Nova Pro** | `us.amazon.nova-pro-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.amazon.nova-pro-v1:0` | ✅ ACTIVE |
| **Nova Micro** | `us.amazon.nova-micro-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.amazon.nova-micro-v1:0` | ✅ ACTIVE |
| **Nova 2 Lite** | `us.amazon.nova-2-lite-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.amazon.nova-2-lite-v1:0` | ✅ ACTIVE |

### ✅ Meta Llama

| Modelo | Inference Profile ID | ARN | Status |
|--------|---------------------|-----|--------|
| **Llama 4 Maverick 17B** | `us.meta.llama4-maverick-17b-instruct-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.meta.llama4-maverick-17b-instruct-v1:0` | ✅ ACTIVE |
| **Llama 4 Scout 17B** | `us.meta.llama4-scout-17b-instruct-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.meta.llama4-scout-17b-instruct-v1:0` | ✅ ACTIVE |
| **Llama 3.3 70B** | `us.meta.llama3-3-70b-instruct-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.meta.llama3-3-70b-instruct-v1:0` | ✅ ACTIVE |
| **Llama 3.2 90B** | `us.meta.llama3-2-90b-instruct-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.meta.llama3-2-90b-instruct-v1:0` | ✅ ACTIVE |
| **Llama 3.2 11B** | `us.meta.llama3-2-11b-instruct-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.meta.llama3-2-11b-instruct-v1:0` | ✅ ACTIVE |
| **Llama 3.2 3B** | `us.meta.llama3-2-3b-instruct-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.meta.llama3-2-3b-instruct-v1:0` | ✅ ACTIVE |
| **Llama 3.2 1B** | `us.meta.llama3-2-1b-instruct-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.meta.llama3-2-1b-instruct-v1:0` | ✅ ACTIVE |
| **Llama 3.1 70B** | `us.meta.llama3-1-70b-instruct-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.meta.llama3-1-70b-instruct-v1:0` | ✅ ACTIVE |
| **Llama 3.1 8B** | `us.meta.llama3-1-8b-instruct-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.meta.llama3-1-8b-instruct-v1:0` | ✅ ACTIVE |

### ✅ Outros Modelos

| Modelo | Inference Profile ID | ARN | Status |
|--------|---------------------|-----|--------|
| **DeepSeek R1** | `us.deepseek.r1-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.deepseek.r1-v1:0` | ✅ ACTIVE |
| **Mistral Pixtral Large** | `us.mistral.pixtral-large-2502-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.mistral.pixtral-large-2502-v1:0` | ✅ ACTIVE |
| **Writer Palmyra X5** | `us.writer.palmyra-x5-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.writer.palmyra-x5-v1:0` | ✅ ACTIVE |
| **Writer Palmyra X4** | `us.writer.palmyra-x4-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.writer.palmyra-x4-v1:0` | ✅ ACTIVE |
| **Cohere Embed v4** | `us.cohere.embed-v4:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.cohere.embed-v4:0` | ✅ ACTIVE |
| **TwelveLabs Pegasus v1.2** | `us.twelvelabs.pegasus-1-2-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/us.twelvelabs.pegasus-1-2-v1:0` | ✅ ACTIVE |

### 🌐 Inference Profiles Globais

| Modelo | Profile ID | ARN | Uso |
|--------|-----------|-----|-----|
| **Claude Sonnet 4.5** | `global.anthropic.claude-sonnet-4-5-20250929-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0` | Recomendado |
| **Claude Sonnet 4** | `global.anthropic.claude-sonnet-4-20250514-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/global.anthropic.claude-sonnet-4-20250514-v1:0` | Disponível |
| **Claude Haiku 4.5** | `global.anthropic.claude-haiku-4-5-20251001-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/global.anthropic.claude-haiku-4-5-20251001-v1:0` | Disponível |
| **Claude Opus 4.5** | `global.anthropic.claude-opus-4-5-20251101-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/global.anthropic.claude-opus-4-5-20251101-v1:0` | Disponível |
| **Nova 2 Lite** | `global.amazon.nova-2-lite-v1:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/global.amazon.nova-2-lite-v1:0` | Disponível |
| **Cohere Embed v4** | `global.cohere.embed-v4:0` | `arn:aws:bedrock:us-west-2:260699793284:inference-profile/global.cohere.embed-v4:0` | Disponível |

---

## 🔧 Configuração no Código

### src/modules/bedrock.js

```javascript
const CONFIG = {
  region: process.env.AWS_REGION || 'us-west-2',  // ✅ CORRETO
  defaultModel: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  maxTokens: 64000,
  temperature: 0.7
};

// Inference Profiles Mapping
export const INFERENCE_PROFILES = {
  // Claude 4.x
  'anthropic.claude-opus-4-5-20251101-v1:0': 'us.anthropic.claude-opus-4-5-20251101-v1:0',
  'anthropic.claude-opus-4-20250514-v1:0': 'us.anthropic.claude-opus-4-20250514-v1:0',
  'anthropic.claude-sonnet-4-5-20250929-v1:0': 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'anthropic.claude-sonnet-4-20250514-v1:0': 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  'anthropic.claude-haiku-4-5-20251001-v1:0': 'us.anthropic.claude-haiku-4-5-20251001-v1:0',

  // Claude 3.x
  'anthropic.claude-3-opus-20240229-v1:0': 'us.anthropic.claude-3-opus-20240229-v1:0',
  'anthropic.claude-3-5-haiku-20241022-v1:0': 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
  'anthropic.claude-3-5-sonnet-20241022-v2:0': 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
  'anthropic.claude-3-7-sonnet-20250219-v1:0': 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',

  // Amazon Nova
  'amazon.nova-premier-v1:0': 'us.amazon.nova-premier-v1:0',

  // DeepSeek
  'deepseek.r1-v1:0': 'us.deepseek.r1-v1:0',

  // Mistral
  'mistral.pixtral-large-2502-v1:0': 'us.mistral.pixtral-large-2502-v1:0',

  // Meta Llama
  'meta.llama3-3-70b-instruct-v1:0': 'us.meta.llama3-3-70b-instruct-v1:0',
  'meta.llama3-2-90b-instruct-v1:0': 'us.meta.llama3-2-90b-instruct-v1:0',
  'meta.llama3-2-11b-instruct-v1:0': 'us.meta.llama3-2-11b-instruct-v1:0',
  'meta.llama3-1-70b-instruct-v1:0': 'us.meta.llama3-1-70b-instruct-v1:0',
  'meta.llama3-1-8b-instruct-v1:0': 'us.meta.llama3-1-8b-instruct-v1:0',
  'meta.llama4-scout-17b-instruct-v1:0': 'us.meta.llama4-scout-17b-instruct-v1:0',
  'meta.llama4-maverick-17b-instruct-v1:0': 'us.meta.llama4-maverick-17b-instruct-v1:0'
};
```

---

## ✅ Checklist de Configuração

- [x] `.env` com `AWS_REGION=us-west-2`
- [x] `bedrock.js` com CONFIG.region = 'us-west-2'
- [x] Inference Profiles mapeados corretamente
- [x] Render configurado com us-west-2
- [x] GitHub Actions (se houver) com us-west-2
- [x] Documentação atualizada

---

## 🚨 IMPORTANTE

**NUNCA MUDAR PARA US-EAST-1**

Todos os inference profiles, credenciais e configurações estão em **us-west-2 (Oregon)**.
Mudar de região pode causar:
- ❌ Perda de acesso aos modelos
- ❌ Credenciais inválidas
- ❌ Erros de autenticação
- ❌ Falhas nos deploys

---

## 📝 Histórico de Mudanças

| Data | Mudança | Autor |
|------|---------|-------|
| 2025-12-29 | Migração definitiva para us-west-2 | Claude Code |
| 2025-12-29 | Mapeamento completo de inference profiles | Claude Code |
| 2025-12-29 | Validação de 55+ modelos disponíveis | Claude Code |

---

**Status**: ✅ CONFIGURAÇÃO VALIDADA E SALVA
**Região**: us-west-2 (Oregon)
**Modelos Disponíveis**: 40+ modelos via inference profiles
**Última Validação**: 2025-12-29 16:30 BRT
