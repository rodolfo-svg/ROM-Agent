# 🚨 CORREÇÃO URGENTE - KB NÃO FUNCIONA

**Data:** 17/12/2025
**Problema:** Sistema não consegue ler documentos do KB adequadamente
**Impacto:** CRÍTICO - ROM Agent inoperante

---

## 🔍 PROBLEMAS IDENTIFICADOS

### 1. `consultar_kb` retorna apenas 500 caracteres
**Arquivo:** `src/modules/bedrock-tools.js:427`

**Código atual (ERRADO):**
```javascript
// Extrair trecho relevante (primeiros 500 caracteres)
if (doc.extractedText) {
  const trecho = doc.extractedText.substring(0, 500).trim();
  respostaFormatada += `\nTrecho:\n${trecho}...\n`;
}
```

**Problema:**
- Retorna APENAS 500 caracteres do documento
- Processo Castilho tem centenas de páginas
- IA recebe informação insuficiente

**Correção necessária:**
- Retornar texto completo (ou pelo menos primeiros 50.000 caracteres)
- OU usar chunks semânticos com embeddings
- OU acionar job exaustivo automaticamente

---

### 2. Limite de tokens = 8192 (MUITO BAIXO)
**Erro relatado:**
```
❌ The maximum tokens you requested exceeds the model limit of 8192
```

**Problema:**
- Modelo atual: possivelmente Claude 3 Haiku (8k limit)
- Deveria: Claude Sonnet 4.5 (200k contexto)

**Onde verificar:**
1. `src/modules/bedrock.js:30` - CONFIG.defaultModel
2. `src/modules/bedrock.js:31` - CONFIG.maxTokens

**Correção necessária:**
```javascript
const CONFIG = {
  defaultModel: 'anthropic.claude-sonnet-4-5-20250929-v1:0',  // ✅ 200k contexto
  maxTokens: 16384,  // ✅ Output (pode aumentar para 131k se necessário)
  maxContextTokens: 200000  // ✅ Input
};
```

---

### 3. Detecção exaustiva NÃO ativa no chat
**Arquivo:** `src/server-enhanced.js:1003`

**Status:** Código existe mas NÃO está sendo executado

**Verificar:**
```javascript
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  // ❓ DETECÇÃO AUTOMÁTICA ESTÁ ATIVA?
  const isExhaustive = exhaustiveJobManager.isExhaustiveRequest(message);

  if (isExhaustive) {
    // Criar job...
  }
});
```

**Se NÃO estiver ativa:**
- Pedido do usuário: "analisando todos os arquivos do kb exaustivamente, máxime o processo na integralidade"
- Resposta esperada: Job assíncrono criado
- Resposta atual: Chat normal (que falha por limite de tokens)

---

## ✅ PLANO DE CORREÇÃO (ORDEM DE EXECUÇÃO)

### CORREÇÃO 1: Aumentar retorno do `consultar_kb` ⚡ URGENTE
**Tempo:** 5 minutos

**Opção A - Rápida (aumentar limite):**
```javascript
// bedrock-tools.js:427
// ANTES:
const trecho = doc.extractedText.substring(0, 500).trim();

// DEPOIS:
const trecho = doc.extractedText.substring(0, 50000).trim();  // 50k caracteres
```

**Opção B - Correta (chunks com busca semântica):**
```javascript
// Buscar chunks relevantes via embedding
const chunks = await buscarChunksRelevantes(query, doc.id, limite=10);
const textoCompleto = chunks.map(c => c.text).join('\n\n');
respostaFormatada += `\nConteúdo relevante:\n${textoCompleto}\n`;
```

**Opção C - Ideal (job exaustivo automático):**
```javascript
// Se documento > 10k caracteres, acionar job
if (doc.textLength > 10000) {
  return {
    success: true,
    triggerExhaustive: true,
    message: 'Documento extenso - iniciando análise exaustiva...'
  };
}
```

**Recomendação:** Opção A (rápida) + Opção C (ideal) combinadas

---

### CORREÇÃO 2: Ajustar limites de tokens ⚡ URGENTE
**Tempo:** 2 minutos

**Arquivo:** `src/modules/bedrock.js:28-35`

**Mudanças:**
```javascript
const CONFIG = {
  region: process.env.AWS_REGION || 'us-east-1',
  defaultModel: 'anthropic.claude-sonnet-4-5-20250929-v1:0',  // ✅ Já correto
  maxTokens: 32768,  // ✅ AUMENTAR de 16k para 32k
  temperature: 0.7,
  autoModelSelection: true,
  maxContextTokens: 200000  // ✅ Já correto
};
```

**Validar também:**
```javascript
// bedrock.js - na função conversar()
inferenceConfig: {
  maxTokens: options.maxTokens || CONFIG.maxTokens,  // Deve ser 32k
  temperature: options.temperature || CONFIG.temperature
}
```

---

### CORREÇÃO 3: Ativar detecção exaustiva no chat ⚡ URGENTE
**Tempo:** 10 minutos

**Arquivo:** `src/server-enhanced.js:1003`

**Verificar se código existe:**
```bash
grep -n "isExhaustiveRequest" src/server-enhanced.js
```

**Se NÃO existir, adicionar:**
```javascript
app.post('/api/chat', async (req, res) => {
  const { message, metadata = {}, projectId = null } = req.body;
  const conversationId = req.session.conversationId;

  // 🔍 DETECÇÃO AUTOMÁTICA DE MODO EXAUSTIVO
  const isExhaustive = exhaustiveJobManager.isExhaustiveRequest(message);

  if (isExhaustive) {
    console.info('🚀 Pedido EXAUSTIVO detectado', { message: message.substring(0, 100) });

    const job = await exhaustiveJobManager.createJob({
      projectId: projectId || 'default',
      userId: req.session.userId || 'anonymous',
      traceId: req.headers['x-trace-id'] || `trace_${Date.now()}`,
      request: message,
      metadata: { conversationId, sessionId: req.session.id }
    });

    const exhaustiveResponse = `🔍 **Análise Exaustiva Iniciada**

Detectei que você solicitou análise da **INTEGRALIDADE** do processo.
Devido à complexidade e volume de informações, isso será processado como **JOB ASSÍNCRONO**.

📊 **Status**: Em processamento
⏱️ **Estimativa**: ${job.estimatedTime}
🔗 **Acompanhe**: ${job.trackingUrl}
🆔 **Job ID**: \`${job.jobId}\`

**O que está sendo feito:**
1. ✅ Inventariando todos os documentos do projeto
2. 📝 Analisando cada documento detalhadamente
3. 🔗 Consolidando informações por tema jurídico
4. 📊 Gerando resumo executivo + tabelas estruturadas
5. 💾 Preparando export completo (JSON + Markdown)

**Você será notificado quando concluir.**
Enquanto isso, pode continuar usando o sistema normalmente.`;

    conversationsManager.addMessage(conversationId, {
      role: 'assistant',
      content: exhaustiveResponse
    });

    return res.json({
      response: exhaustiveResponse,
      conversationId,
      exhaustiveJob: {
        jobId: job.jobId,
        status: job.status,
        trackingUrl: job.trackingUrl
      }
    });
  }

  // Processamento normal continua...
});
```

---

## 🧪 TESTE DE VALIDAÇÃO

Após correções, testar com:

```
"com base no processo do Castilho, analisando todos os arquivos do kb exaustivamente,
máxime o processo na integralidade, focando na ultima decisão, faça o resumo executivo
para redigirmos os embargos de declaração"
```

**Resultado esperado:**
1. ✅ Detecção de pedido exaustivo
2. ✅ Job assíncrono criado
3. ✅ Resposta imediata com jobId
4. ✅ Processamento em background
5. ✅ Export completo gerado

**Resultado atual (ERRADO):**
1. ❌ Chat normal
2. ❌ consultar_kb retorna 500 caracteres
3. ❌ Erro de limite de tokens (8192)

---

## 📊 PRIORIZAÇÃO

| # | Correção | Impacto | Esforço | Prioridade |
|---|----------|---------|---------|------------|
| 1 | Aumentar retorno KB | CRÍTICO | 5min | 🔥 AGORA |
| 2 | Ajustar limites tokens | CRÍTICO | 2min | 🔥 AGORA |
| 3 | Ativar detecção exaustiva | CRÍTICO | 10min | 🔥 AGORA |

**Tempo total:** 17 minutos

---

## ✅ CHECKLIST DE EXECUÇÃO

- [ ] CORREÇÃO 1: Aumentar substring(0, 500) → substring(0, 50000)
- [ ] CORREÇÃO 2: maxTokens 16k → 32k em CONFIG
- [ ] CORREÇÃO 3: Verificar/adicionar isExhaustiveRequest no /api/chat
- [ ] TESTE: Fazer pedido do Castilho novamente
- [ ] VALIDAR: Job criado + export gerado

---

**EXECUTAR AGORA - SISTEMA INOPERANTE SEM ESSAS CORREÇÕES**
