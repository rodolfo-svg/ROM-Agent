# 🚀 INSTRUÇÕES DE DEPLOY - ROM Agent v2.8.1-BETA

**Data:** 17/12/2025
**Commits:** 3e204bb2 + 42246ab7 + 41bc4a3f
**Status:** ✅ PRONTO PARA DEPLOY
**Ambiente:** Render (produção) ou staging

---

## 📋 CHECKLIST PRÉ-DEPLOY

- [x] ✅ Desmock do job exaustivo concluído
- [x] ✅ Fallback de modelo implementado
- [x] ✅ Teste de sanidade aprovado (Bedrock REAL confirmado)
- [x] ✅ Correções críticas aplicadas (KB 50k chars, tokens 32k/200k)
- [x] ✅ Sistema anti-429 completo (fila, queue, async jobs)
- [ ] 🔄 Push para branch main/production
- [ ] 🔄 Deploy no Render
- [ ] 🔄 Validação em produção com processo Castilho

---

## 1️⃣ RESUMO DAS MUDANÇAS

### **Commit 3e204bb2 - Desmock de Jobs Exaustivos**
```
fix: Desmock exhaustive jobs - integrate real Bedrock

- Replace 3 mock locations with real conversar() calls
- Use model profiles: PADRAO for summarization, PREMIUM for final delivery
- Add comprehensive logging: modelId, fallback, trace_id
- Implement automatic fallback on 429/timeout (3 attempts with exponential backoff)
```

**Arquivos modificados:**
- `lib/exhaustive-analysis-job.js` (+106 linhas, -28 linhas)

**Mudanças principais:**
1. **summarizeDocument()** - Agora usa Bedrock REAL com profile PADRAO (16k tokens)
2. **consolidateByTheme()** - Agora usa Bedrock REAL com profile PADRAO (24k tokens)
3. **generateExecutiveSummary()** - Agora usa Bedrock REAL com profile PREMIUM (32k tokens)
4. **executeWithFallback()** - Nova função com retry automático em caso de 429/timeout

**Evidência de funcionamento:**
```
✅ Document summarization: Petição Inicial - Teste completed {
  jobId: 'test_job_1765946425249',
  modelId: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
  profile: 'PADRAO',
  isFallback: false,
  traceId: 'trace_test_1765946425249',
  attempt: 1
}
```

### **Commit 42246ab7 - Correções Críticas KB + Tokens**
```
fix(critical): Correção urgente - KB retornando apenas 500 chars + limite tokens 8k

PROBLEMA 1: consultar_kb retornava apenas 500 caracteres
SOLUÇÃO: Aumentado para 50.000 caracteres (100x)

PROBLEMA 2: Limite de tokens 8192 (muito baixo)
SOLUÇÃO: Aumentado para 32.768 output, 200.000 input
```

**Arquivos modificados:**
- `src/modules/bedrock-tools.js`
- `src/modules/bedrock.js`

### **Commit 41bc4a3f - Sistema Anti-429 Completo**
```
feat(anti-429): PLANO ANTI-429 COMPLETO - Sistema de Fila e Jobs Assíncronos

- Global queue manager com rate limiting inteligente
- Jobs assíncronos para análise exaustiva (MAP-REDUCE)
- Event-driven progress tracking (SSE)
- Circuit breaker + fallback automático
```

**Novos arquivos:**
- `lib/bedrock-queue-manager.js` (481 linhas)
- `lib/exhaustive-analysis-job.js` (800+ linhas)
- `lib/exhaustive-job-manager.js` (275 linhas)

---

## 2️⃣ PUSH PARA REPOSITÓRIO

### **Opção A - Branch main (recomendado se produção usa main):**

```bash
# Verificar branch atual
git branch

# Se não estiver em main, mudar para main
git checkout main

# Fazer merge das mudanças (se necessário)
# git merge develop  # se suas mudanças estão em develop

# Push para repositório remoto
git push origin main

# Verificar que push foi bem-sucedido
git log origin/main --oneline -5
```

### **Opção B - Branch production (se existir branch separado):**

```bash
# Verificar se existe branch production
git branch -a | grep production

# Criar ou mudar para production
git checkout -b production || git checkout production

# Fazer merge de main
git merge main

# Push
git push origin production
```

### **Verificar push:**

```bash
# Último commit deve ser 3e204bb2
git log --oneline -1

# Saída esperada:
# 3e204bb2 fix: Desmock exhaustive jobs - integrate real Bedrock
```

---

## 3️⃣ DEPLOY NO RENDER

### **Se Render faz auto-deploy:**

1. Acesse: https://dashboard.render.com
2. Localize serviço "ROM-Agent" (ou nome configurado)
3. Aguarde auto-deploy iniciar (geralmente 30-60 segundos após push)
4. Acompanhe logs durante deploy

### **Se Render requer deploy manual:**

1. Acesse: https://dashboard.render.com
2. Selecione serviço "ROM-Agent"
3. Clique em "Manual Deploy" > "Deploy latest commit"
4. Aguarde build completar (5-10 minutos)

### **Verificar deploy:**

```bash
# Teste de health check (substitua URL)
curl https://rom-agent.onrender.com/api/health

# Saída esperada:
# {"status":"ok","uptime":123,"version":"2.8.1-BETA"}
```

---

## 4️⃣ VALIDAÇÃO EM PRODUÇÃO

### **Teste 1: Chat normal (rápido - 2 min)**

1. Acesse interface web
2. Envie mensagem simples: "Olá, como você está?"
3. ✅ Deve responder normalmente

### **Teste 2: Consulta KB (médio - 5 min)**

1. Envie: "Consulte o KB sobre o processo Castilho"
2. ✅ Deve retornar conteúdo REAL (não apenas metadados)
3. ✅ Texto deve ter > 500 caracteres
4. ✅ Sem erro de limite de tokens

### **Teste 3: Análise Exaustiva (longo - 10-30 min)**

**Envie exatamente:**
```
com base no processo do Castilho, analisando todos os arquivos do kb exaustivamente,
máxime o processo na integralidade, focando na ultima decisão, faça o resumo executivo
para redigirmos os embargos de declaração
```

**Resultado esperado:**

```
🔍 **Análise Exaustiva Iniciada**

Detectei que você solicitou análise da **INTEGRALIDADE** do processo.
Devido à complexidade e volume de informações, isso será processado como **JOB ASSÍNCRONO**.

📊 **Status**: Em processamento
⏱️ **Estimativa**: 15-30 minutos
🔗 **Acompanhe**: /api/jobs/{jobId}/status
🆔 **Job ID**: `exhaustive_xxxxxxxxxxxx`

**O que está sendo feito:**
1. ✅ Inventariando todos os documentos do projeto
2. 📝 Analisando cada documento detalhadamente
3. 🔗 Consolidando informações por tema jurídico
4. 📊 Gerando resumo executivo + tabelas estruturadas
5. 💾 Preparando export completo (JSON + Markdown)

**Você será notificado quando concluir.**
```

---

## 5️⃣ ACOMPANHAMENTO DO JOB

### **Via API REST:**

```bash
# Substituir {jobId} pelo ID retornado
curl https://rom-agent.onrender.com/api/jobs/{jobId}/status

# Exemplo de resposta (em processamento):
{
  "jobId": "exhaustive_1765946425249",
  "status": "processing",
  "progress": 45,
  "stage": "Consolidando análises por tema",
  "documentsProcessed": 12,
  "totalDocuments": 27
}

# Exemplo de resposta (concluído):
{
  "jobId": "exhaustive_1765946425249",
  "status": "completed",
  "progress": 100,
  "results": {
    "summary": "...",
    "tables": [...],
    "citations": [...]
  },
  "exportUrl": "/exports/exhaustive_1765946425249/analise-exaustiva-2025-12-17T15-30-00.json"
}
```

### **Via SSE (real-time):**

```javascript
// No navegador
const eventSource = new EventSource('/api/jobs/{jobId}/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Progress:', data.progress, data.stage);
};
```

---

## 6️⃣ DOWNLOAD DO EXPORT

### **Localização dos arquivos:**

```
./exports/{projectId}/analise-exaustiva-{timestamp}.json
./exports/{projectId}/analise-exaustiva-{timestamp}.md
```

### **Via API:**

```bash
# Listar exports disponíveis
curl https://rom-agent.onrender.com/api/exports

# Download do export
curl https://rom-agent.onrender.com/api/exports/{jobId} --output resultado.json
```

### **Estrutura do export JSON:**

```json
{
  "jobId": "exhaustive_1765946425249",
  "projectId": "castilho-processo",
  "traceId": "trace_1765946425249",
  "startedAt": 1765946425249,
  "completedAt": 1765948225249,
  "duration": 1800000,
  "results": {
    "inventory": [...],
    "summaries": [...],
    "consolidation": {
      "themes": {...},
      "lastDecision": {...},
      "timeline": [...]
    },
    "executiveSummary": {
      "sections": [...],
      "tables": [...],
      "citations": [...]
    }
  }
}
```

---

## 7️⃣ LOGS E EVIDÊNCIAS

### **Verificar logs no Render:**

1. Acesse Dashboard > ROM-Agent > Logs
2. Procure por:

```
📝 Document summarized {
  jobId: '...',
  document: '...',
  modelId: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
  profile: 'PADRAO',
  isFallback: false,
  traceId: 'trace_...',
  attempt: 1
}
```

3. ✅ Deve mostrar `modelId` real (não mock)
4. ✅ Deve mostrar `traceId` para rastreabilidade
5. ✅ `isFallback: false` indica modelo primário usado

### **Em caso de fallback (429/timeout):**

```
⚠️ Document summarization failed (attempt 1/3) {
  jobId: '...',
  error: 'ThrottlingException: Too many requests',
  is429: true,
  isTimeout: false,
  traceId: 'trace_...'
}

⏳ Waiting 2000ms before retry...

✅ Document summarization completed {
  jobId: '...',
  modelId: 'amazon.nova-pro-v1:0',  // ← MODELO FALLBACK
  profile: 'PADRAO',
  isFallback: true,  // ← INDICA FALLBACK
  traceId: 'trace_...',
  attempt: 2  // ← SEGUNDA TENTATIVA
}
```

---

## 8️⃣ TROUBLESHOOTING

### **Problema: Job não inicia**

**Sintomas:**
- Mensagem "analisando exaustivamente" não cria job
- Resposta é chat normal (sem job assíncrono)

**Verificar:**
1. Keywords detectadas? (exaustivamente, integralidade, etc.)
2. Logs mostram: `🚀 Pedido EXAUSTIVO detectado`?
3. Se não, verificar `exhaustiveJobManager.isExhaustiveRequest()` em `server-enhanced.js:1003`

**Solução:**
```bash
# Verificar código de detecção
grep -A 20 "isExhaustiveRequest" src/server-enhanced.js
```

### **Problema: Erro 429 visível ao usuário**

**Sintomas:**
- Mensagem de erro "Too many requests" aparece no chat

**Verificar:**
1. Fallback automático está ativo?
2. Logs mostram tentativas de retry?
3. Queue manager está funcionando?

**Solução:**
```bash
# Verificar queue manager
grep "bedrockQueue.enqueue" lib/exhaustive-analysis-job.js

# Deve mostrar 3 localizações (MAP, REDUCE, EXECUTIVE)
```

### **Problema: Export vazio ou com dados mock**

**Sintomas:**
- Export contém `keyPoints: []` (vazio)
- Texto contém "MOCK" ou "Análise de..."

**Verificar:**
1. Commit 3e204bb2 foi deployado?
2. Logs mostram `modelId` real?

**Solução:**
```bash
# Verificar versão deployada
git log origin/main --oneline -1

# Deve mostrar: 3e204bb2 fix: Desmock exhaustive jobs
```

### **Problema: Limite de tokens (ainda)**

**Sintomas:**
- Erro: "exceeds model limit of 8192"

**Verificar:**
1. Commit 42246ab7 foi deployado?
2. CONFIG em `bedrock.js` mostra 32768 / 200000?

**Solução:**
```bash
# Verificar CONFIG
grep -A 5 "const CONFIG" src/modules/bedrock.js

# Deve mostrar:
# maxTokens: 32768
# maxContextTokens: 200000
```

---

## 9️⃣ RESPOSTA PARA O USUÁRIO

Após deploy bem-sucedido, forneça:

### **(i) Branch/ambiente:**
- **Branch:** main (ou production)
- **Ambiente:** Render (produção)
- **URL:** https://rom-agent.onrender.com (ou URL configurada)

### **(ii) Commit SHA:**
- **Principal:** `3e204bb2` - Desmock exhaustive jobs
- **Crítico 1:** `42246ab7` - KB 50k chars + tokens 32k/200k
- **Crítico 2:** `41bc4a3f` - Sistema anti-429

### **(iii) Como testar Castilho:**

**Passo 1 - Enviar pedido:**
```
com base no processo do Castilho, analisando todos os arquivos do kb exaustivamente,
máxime o processo na integralidade, focando na ultima decisão, faça o resumo executivo
para redigirmos os embargos de declaração
```

**Passo 2 - Anotar Job ID:**
```
Job ID: exhaustive_xxxxxxxxxxxx
```

**Passo 3 - Acompanhar status:**
```
GET /api/jobs/{jobId}/status

Ou via SSE:
/api/jobs/{jobId}/stream
```

**Passo 4 - Download do export:**
```
Quando status = 'completed':

JSON: /api/exports/{jobId}
Markdown: /exports/{projectId}/analise-exaustiva-{timestamp}.md

Ou acessar diretamente via filesystem (se Render persistence volume configurado):
./exports/castilho-processo/analise-exaustiva-*.json
```

---

## 🎯 CRITÉRIOS DE SUCESSO

| # | Critério | Validação | Status |
|---|----------|-----------|--------|
| 1 | Job exaustivo detectado automaticamente | Resposta menciona "JOB ASSÍNCRONO" | ⏳ Testar |
| 2 | Bedrock REAL chamado (não mock) | Logs mostram `modelId: anthropic.claude-sonnet-*` | ⏳ Testar |
| 3 | Trace ID registrado | Logs incluem `traceId: trace_*` | ⏳ Testar |
| 4 | Profile correto usado | PADRAO para análise, PREMIUM para resumo final | ⏳ Testar |
| 5 | Fallback funciona | Se 429, logs mostram retry + fallback model | ⏳ Testar |
| 6 | Export gerado com conteúdo REAL | JSON contém texto > 1000 chars, keyPoints populado | ⏳ Testar |
| 7 | Sem erro de tokens | Nenhum erro "exceeds model limit" | ⏳ Testar |
| 8 | KB retorna conteúdo completo | Resposta > 500 caracteres | ⏳ Testar |

---

## ✅ CHECKLIST FINAL

Antes de liberar para os 6 usuários BETA:

- [ ] Push realizado
- [ ] Deploy concluído no Render
- [ ] Health check retorna 200 OK
- [ ] Chat normal funcionando
- [ ] Consulta KB retorna > 500 chars
- [ ] Job exaustivo é criado automaticamente
- [ ] Logs mostram modelId REAL (não mock)
- [ ] Logs mostram trace_id
- [ ] Export gerado contém conteúdo REAL
- [ ] Nenhum erro de limite de tokens
- [ ] Fallback testado (opcional - forçar 429 em teste)

---

**Deploy preparado por:** Claude Code
**Data:** 17/12/2025
**Versão:** v2.8.1-BETA-RC1
**Status:** ✅ PRONTO PARA PRODUÇÃO
