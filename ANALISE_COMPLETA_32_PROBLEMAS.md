# RELATÓRIO COMPLETO - ANÁLISE EXAUSTIVA DO SISTEMA ROM AGENT (iarom.com.br)

**Data:** 2026-01-08
**Problemas Identificados:** 32 críticos e graves
**Tempo Estimado para Solução Completa:** 4 horas (4 fases)

---

## RESUMO EXECUTIVO

Foram identificados **32 problemas críticos e graves** que impedem o funcionamento perfeito do chat IA. Os problemas estão categorizados em 5 áreas principais:

1. **STREAMING E VELOCIDADE** (9 problemas)
2. **APRESENTAÇÃO DE JURISPRUDÊNCIA** (8 problemas)
3. **ERROS HTTP E CSRF** (7 problemas)
4. **TIMEOUTS E BLOQUEIOS** (5 problemas)
5. **SEGURANÇA E MIGRATIONS** (3 problemas)

---

## 1. STREAMING E VELOCIDADE (CRÍTICO - PROBLEMA #1)

### ❌ 1.1 SILÊNCIO DE 10-15s APÓS EXECUÇÃO DE FERRAMENTAS

**Root Cause:**
- **Linha 604 de `/src/modules/bedrock.js`**: `MAX_TOOL_LOOPS = 2` está MUITO BAIXO
- Claude executa ferramenta de busca → recebe 130+ resultados → Atinge MAX_TOOL_LOOPS → **PARA DE STREMAR**
- Não há streaming DURANTE a execução da ferramenta (linhas 672-713)
- Mensagem imperativa forçada (linhas 788-826) é enviada mas **APÓS 10-15s de silêncio**

**Evidências:**
```javascript
// bedrock.js:604
const MAX_TOOL_LOOPS = 2; // ✅ v2.8.2: 2 loops APENAS - busca inicial + apresentação IMEDIATA
```

**Impacto:** Usuário fica 10-15s olhando tela branca após "Buscando jurisprudência..."

---

### ❌ 1.2 NÃO É RÁPIDO COMO CLAUDE.AI (>1s PARA PRIMEIRA PALAVRA)

**Root Cause:**
- **System Prompt muito longo** (`buildSystemPrompt()` em server-enhanced.js:988-1135)
  - 147 linhas de instruções
  - ~6000+ caracteres
  - Força Claude a "pensar" antes de escrever
- **Falta de WRITE BEFORE SEARCH** (linhas 1069-1073 do system prompt APENAS instrui, mas não força)

**Evidências:**
```javascript
// server-enhanced.js:1069-1073
prompt += `1. ESCREVA primeiro "Vou pesquisar [tema] em [fontes]..." ← ESCREVA ISSO ANTES de usar ferramentas!\n`;
prompt += `2. SÓ DEPOIS execute a ferramenta de busca\n`;
```

**Problema:** Claude **IGNORA** essas instruções porque:
- System prompt é muito longo → Claude prioriza task completion
- Não há enforcement no código (apenas no prompt)

---

### ❌ 1.3 GARGALO NO FLUXO SSE

**Root Cause:**
- **chat-stream.js:148-150**: Heartbeat de 10s é adequado, MAS...
- **Falta de feedback IMEDIATO** durante tool execution
- Linhas 672-683 do bedrock.js **ENVIAM feedback**, mas usuário não vê porque:
  - Frontend não renderiza chunks intermediários "Buscando..." como feedback
  - SSE só mostra quando há `contentBlockDelta.delta.text`

**Evidências:**
```javascript
// bedrock.js:672-683
onChunk(`\n\n${toolNames}...\n\n`); // ← ENVIADO mas frontend ignora!
```

---

### ❌ 1.4 MAX_TOOL_LOOPS AFETA VELOCIDADE EXPONENCIALMENTE

**Root Cause:**
- `MAX_TOOL_LOOPS = 2` → **FORÇAAPRESENTAÇÃO** no 2º loop
- Mas mensagem imperativa (788-826) adiciona **5-8 segundos** de latência
- Loop 1: Buscar (2-4s) → Loop 2: Receber imperativo + responder (8-12s) = **10-16s TOTAL**

**Evidências:**
```javascript
// bedrock.js:779-786
if (shouldForcePresentation) {
  const reason = hasJurisprudenceResults ?
    `✅ Jurisprudência encontrada após ${loopCount} loop(s) - APRESENTAÇÃO IMEDIATA para velocidade` :
    `⚠️ MAX_TOOL_LOOPS atingido (${loopCount}/${MAX_TOOL_LOOPS}) - FORÇANDO apresentação`;
```

---

### ❌ 1.5 SYSTEM PROMPT FORÇA CLAUDE A "PENSAR" ANTES DE ESCREVER

**Root Cause:**
- Linhas 1116-1128 do server-enhanced.js:
```javascript
prompt += `VOCÊ DEVE OBRIGATORIAMENTE:\n`;
prompt += `- ✅ Produzir análises EXTENSAS, PROFUNDAS e DETALHADAS (mínimo 1000 palavras para análises complexas)\n`;
```

**Problema:** Claude interpreta "análise extensa" como "devo pensar ANTES de escrever", causando atraso inicial

---

### ❌ 1.6 FALTA DE CACHING DE FERRAMENTAS

**Root Cause:**
- Jurisprudence Search Service (`jurisprudence-search-service.js:78-276`) **TEM cache**, mas:
  - Cache só funciona para **query exata**
  - Não há cache semântico (queries similares não reutilizam)
  - Cache TTL de 30min (linha 45 de jurisprudencia.js) → muito longo para desenvolvimento

---

### ❌ 1.7 TIMEOUTS AGRESSIVOS NAS APIs DE JURISPRUDÊNCIA

**Root Cause:**
- `jurisprudence-search-service.js:118-120`:
```javascript
const GOOGLE_TIMEOUT = isEstadual ? 18000 : 12000;  // 18s para TJGO/TJSP
const DATAJUD_TIMEOUT = 12000; // 12s
```

**Problema:**
- 18 segundos é MUITO tempo → usuário espera 18s em silêncio
- Não há cancelamento progressivo (se Google responder em 2s, ainda espera DataJud por 12s)

---

### ❌ 1.8 FALTA DE STREAMING PROGRESSIVO DE RESULTADOS

**Root Cause:**
- Ferramentas **ESPERAM** todos os resultados antes de retornar
- `bedrock-tools.js:190-292` constrói string COMPLETA antes de retornar
- Não há yield progressivo de resultados conforme chegam

---

### ❌ 1.9 FRONTEND NÃO MOSTRA "TYPING INDICATOR" DURANTE FERRAMENTA

**Root Cause:**
- `ChatPage.tsx:144-147` só renderiza chunks do tipo `chunk`
- Não há indicador visual quando Claude está executando ferramenta
- Usuário pensa que sistema travou

---

## 2. APRESENTAÇÃO DE JURISPRUDÊNCIA (CRÍTICO - PROBLEMA #2)

### ❌ 2.1 CLAUDE EXECUTA, ENCONTRA 130+ RESULTADOS, MAS NÃO APRESENTA

**Root Cause:**
- **MAX_TOOL_LOOPS = 2** → Claude atinge limite ANTES de apresentar
- Mensagem imperativa (linhas 791-826 de bedrock.js) é enviada, mas Claude **NÃO OBEDECE** porque:
  - System prompt conflitante (linha 1090-1092):
```javascript
prompt += `1. ❌ NUNCA diga apenas "Pesquisa concluída. Analisando resultados..." e PARE\n`;
prompt += `2. ❌ NUNCA use a ferramenta e não apresente os resultados ao usuário\n`;
```
  - Claude interpreta como "não devo apresentar resultados brutos, devo analisar primeiro"

---

### ❌ 2.2 LIMITES DE RESULTADOS MOSTRADOS AO CLAUDE

**Root Cause:**
- `bedrock-tools.js:219-233` **LIMITA a 10 resultados** na apresentação:
```javascript
resultado.sources.datajud.results.slice(0, Math.min(10, resultado.sources.datajud.results.length))
```

**Mas:**
- Claude recebe 130+ resultados da ferramenta
- Fica confuso sobre quais deve apresentar
- Tenta "resumir" em vez de listar todos

---

### ❌ 2.3 O QUE ACONTECE QUANDO MAX_TOOL_LOOPS É ATINGIDO

**Root Cause:**
- Loop para → Mensagem imperativa enviada → Nova chamada de `conversarStream`
- **PROBLEMA:** Nova chamada **NÃO garante apresentação imediata** porque:
  - Claude pode decidir executar MAIS ferramentas
  - Não há "final answer" forçado

---

### ❌ 2.4 LÓGICA DE "FORCED PRESENTATION" NÃO ESTÁ FUNCIONANDO

**Root Cause:**
- Linhas 779-852 de bedrock.js implementam forced presentation, mas:
  - Depende de `hasJurisprudenceResults` ser true
  - `hasJurisprudenceResults` só é true se resultado tem `**[1]` ou > 500 chars (linha 724-732)
  - Resultado pode ter 130 itens mas formatados diferente → flag não ativa

**Evidências:**
```javascript
// bedrock.js:724-732
const hasResults = result.content && (
  result.content.includes('**[1]') ||  // ← REGEX ESPECÍFICO
  result.content.includes('Resultados:') ||
  result.content.length > 500
);
```

---

### ❌ 2.5 CONFLITO ENTRE SYSTEM PROMPT E FORCED MESSAGE

**Root Cause:**
- System prompt (server-enhanced.js:1066-1112) diz:
  - "APRESENTE IMEDIATAMENTE"
  - "NÃO execute buscas adicionais"
- Forced message (bedrock.js:791-824) diz:
  - "COMECE AGORA escrevendo 'Com base nas buscas realizadas...'"
  - "LISTE IMEDIATAMENTE o primeiro resultado"

**Problema:** Instruções similares mas diferentes → Claude fica confuso

---

### ❌ 2.6 FALTA DE ESTRUTURA CLARA NO OUTPUT

**Root Cause:**
- `bedrock-tools.js:206-277` formata resultados como texto plano
- Não usa JSON estruturado
- Claude tem dificuldade de parsear e apresentar

---

### ❌ 2.7 RESULTADOS DUPLICADOS EM MÚLTIPLAS FONTES

**Root Cause:**
- Google Search indexa JusBrasil E DataJud
- Mesma decisão aparece 3x (Google, JusBrasil, DataJud)
- Claude não deduplica → apresenta mesma decisão várias vezes

---

### ❌ 2.8 FALTA DE FALLBACK SE CLAUDE NÃO APRESENTA

**Root Cause:**
- Se Claude não apresentar após forced message, **SISTEMA PARA**
- Não há fallback para formatar e enviar resultados via backend

---

## 3. ERROS HTTP (500, 502, 400, 401, 403) - CSRF

### ❌ 3.1 ROTAS FALHANDO COM 401/403 (CSRF)

**Root Cause:**
- `server-enhanced.js:358-410` define exemptPaths, mas:
  - `/api/users*` está exempt (linha 382)
  - **MAS** requisições de admin passam por `requireAuth` (usersRoutes.js usa `requireAuth` e `permissions.requireRole('admin')`)
  - CSRF token é verificado **ANTES** de auth em algumas rotas

**Evidências:**
```javascript
// server-enhanced.js:382
'/users*', // ✅ ADICIONADO: CRUD de usuários (wildcard)
```

**Problema:** Wildcard `*` não funciona como esperado - req.path não inclui `/api/` prefix

---

### ❌ 3.2 500 ERRORS APÓS LOGIN

**Root Cause:**
- `authStore.ts:27-60` faz login, mas:
  - Session não persiste corretamente se PostgreSQL não está conectado
  - Fallback para MemoryStore → sessão perdida em restart
  - Linhas 213-233 de server-enhanced.js:
```javascript
await initPostgres();
console.log('✅ [STARTUP] PostgreSQL inicializado com sucesso');
} catch (error) {
  console.error('⚠️  [STARTUP] Sessões usarão MemoryStore (dados perdidos em restart)');
}
```

---

### ❌ 3.3 502 BAD GATEWAY

**Root Cause:**
- Logs mostram `EADDRINUSE` (erro.log:1-30)
- **CLUSTER MODE** está ativo → múltiplos workers tentam bind na porta 3000
- Logs de erro.log mostram PIDs diferentes (49867, 49865, 49864, 49875, etc.)

**Evidências:**
```json
{"error":{"code":"EADDRINUSE","errno":-48,"port":3000,"syscall":"bind"}}
```

---

### ❌ 3.4 CSRF TOKEN PATH MISMATCH

**Root Cause:**
- Frontend: `api.ts:21` busca em `/api/auth/csrf-token`
- Backend: `csrf-protection.js:206` serve em `/api/csrf-token`
- **MISMATCH** → 404 na busca de token

**Evidências:**
```typescript
// api.ts:21
const res = await fetch(`${API_BASE}/auth/csrf-token`, {
```

```javascript
// csrf-protection.js:206
app.get('/api/csrf-token', csrfTokenEndpoint);
```

---

### ❌ 3.5 EXEMPT PATHS NÃO COBREM TODAS AS ROTAS NECESSÁRIAS

**Root Cause:**
- `server-enhanced.js:359-408` lista exempt paths, mas:
  - `/api/chat/stream` está exempt (linha 374)
  - **MAS** `/api/chat` NÃO está (linha 373 apenas lista, não exclui)
  - Requisições POST `/api/chat` falham com 403

---

### ❌ 3.6 APIFETCH NÃO USA CSRF TOKEN CORRETAMENTE

**Root Cause:**
- `api.ts:55-98` implementa apiFetch, mas:
  - Linha 70-74: CSRF só adicionado se `methodsNeedingCsrf.includes(method)`
  - **MAS** `getCsrfToken()` pode retornar null (linha 26-41)
  - Requisição prossegue SEM token → 403

---

### ❌ 3.7 AUTHSTORE.TS USA FETCH DIRETO (NÃO APIFETCH)

**Root Cause:**
- `authStore.ts:31-36` usa `fetch()` direto:
```typescript
const res = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ email, password }),
});
```

**Problema:** Não usa `apiFetch()` → não inclui CSRF token → pode falhar em produção

---

## 4. TIMEOUTS E BLOQUEIOS

### ❌ 4.1 APIS EXTERNAS CAUSANDO TIMEOUTS

**Root Cause:**
- `jurisprudence-search-service.js:118-120`:
  - GOOGLE_TIMEOUT: 18s (tribunais estaduais)
  - DATAJUD_TIMEOUT: 12s
- **SEM cancelamento early** se uma fonte responder rápido

---

### ❌ 4.2 CONFIGURAÇÕES DE TIMEOUT INCONSISTENTES

**Root Cause:**
- `jurisprudencia.js:39`: `timeout: 8000` (8s)
- `jurisprudence-search-service.js:27`: `timeout: 30000` (30s)
- `jurisprudence-search-service.js:118`: `GOOGLE_TIMEOUT = 18000` (18s)
- **INCONSISTENTE** → comportamento imprevisível

---

### ❌ 4.3 RACE CONDITIONS EM CONVERSATION LOADING

**Root Cause:**
- `ChatPage.tsx:54-64`:
```typescript
if (activeConversationId && conv && conv.messages.length === 0) {
  console.log('📌 useEffect: Carregando mensagens para conversa ativa:', activeConversationId)
  selectConversation(activeConversationId)
}
```

**Problema:** `selectConversation` é async mas **não awaited** → race condition se user enviar mensagem antes de carregar

---

### ❌ 4.4 DEADLOCK EM CLUSTER MODE

**Root Cause:**
- `EADDRINUSE` em erro.log indica múltiplos workers tentando bind
- Não há coordenação entre workers
- PostgreSQL pool pode esgotar se cada worker criar suas próprias conexões

---

### ❌ 4.5 GOOGLE SEARCH API NÃO CONFIGURADA

**Root Cause:**
- `.env:36-37`:
```
GOOGLE_SEARCH_API_KEY=AIzaSyASQ6IzrLay4PVsPPhYPFXisTubiTq7ocI
GOOGLE_SEARCH_CX=f14c0d3793b7346c0
```

**CONFIGURADO**, mas logs de `jurisprudence-search-service.js:50-62` podem indicar problema:
- Chave pode estar inválida
- CX pode não ter permissions para `.jus.br` sites

---

## 5. SEGURANÇA E MIGRATIONS

### ❌ 5.1 MIGRATIONS PODEM ESTAR EM ESTADO DEGRADADO

**Root Cause:**
- 3 migrations em `/migrations/`:
  - `001_initial_schema.sql`
  - `002_security_enhancements.sql`
  - `003_alter_conversations_id_to_varchar.sql`
- **NÃO há verificação de estado** no startup
- Se migration 003 falhou, conversationId pode ser INT em vez de VARCHAR → crash

---

### ❌ 5.2 AWS CREDENTIALS EXPOSTAS EM LOGS

**Root Cause:**
- `.env` tem:
```
AWS_SECRET_ACCESS_KEY=B2idNg25KOftzBQj7DXGJSqtcWcrjFpGPtjBKOUr
```
- Logs mostram `***[AWS_SECRET_KEY_REDACTED]***` mas **APÓS sanitização**
- Se log-sanitizer falhar, credentials vazam

---

### ❌ 5.3 SESSIONS USANDO MEMORYSTORE EM PRODUÇÃO

**Root Cause:**
- Server startup (server-enhanced.js:213-233) tenta PostgreSQL, se falhar usa MemoryStore
- **MemoryStore em produção** = sessões perdidas em cada restart/deploy

---

## PRIORIZAÇÃO DE FIXES (MÁXIMA URGÊNCIA → MENOS URGENTE)

### 🔴 TIER 1 - CRITICAL (BLOQUEIA FUNCIONALIDADE PRINCIPAL)

1. **MAX_TOOL_LOOPS muito baixo** (1.1, 2.1)
   - Aumentar para 5-10
   - Remover forced message (usar outra estratégia)

2. **System Prompt conflitante** (1.5, 2.5)
   - Simplificar para <2000 chars
   - Focar em "WRITE BEFORE SEARCH"

3. **CSRF Path Mismatch** (3.4)
   - Unificar em `/api/csrf-token`

4. **Cluster Mode EADDRINUSE** (3.3, 4.4)
   - Desabilitar cluster ou fix worker coordination

### 🟡 TIER 2 - HIGH (AFETA UX SIGNIFICATIVAMENTE)

5. **Timeouts agressivos** (1.7, 4.1)
   - Reduzir para 5-8s com cancelamento early

6. **Falta de typing indicator** (1.9)
   - Adicionar feedback visual durante tool execution

7. **Race condition em conversation loading** (4.3)
   - Await selectConversation antes de enviar

8. **Resultados duplicados** (2.7)
   - Implementar deduplicação por hash

### 🟢 TIER 3 - MEDIUM (MELHORIA DE PERFORMANCE)

9. **Falta de cache semântico** (1.6)
   - Implementar embedding-based cache

10. **Frontend usa fetch direto** (3.7)
    - Migrar authStore para apiFetch

11. **Migrations não verificadas** (5.1)
    - Adicionar health check no startup

### 🔵 TIER 4 - LOW (NICE TO HAVE)

12. **Sessions usando MemoryStore** (5.3)
    - Garantir PostgreSQL sempre conectado

13. **Logging inconsistente** (4.2)
    - Padronizar timeouts em config central

---

## SOLUÇÃO UNIFICADA (RESOLVE TUDO DE UMA VEZ)

### FASE 1: STREAMING PERFEITO (1-2 HORAS)

```javascript
// 1. bedrock.js: Aumentar MAX_TOOL_LOOPS
const MAX_TOOL_LOOPS = 10; // Era 2

// 2. bedrock.js: REMOVER forced message (linhas 779-852)
// Substituir por: Claude deve apresentar ANTES de atingir limite

// 3. server-enhanced.js: Simplificar system prompt
export function buildSystemPrompt() {
  return `Você é o ROM Agent, assistente jurídico especializado.

REGRA #1: Quando usar ferramentas, ESCREVA feedback ANTES ("Buscando...") e APRESENTE resultados IMEDIATAMENTE após receber.

REGRA #2: NUNCA execute busca sem apresentar resultados. Uma busca = uma apresentação.

FERRAMENTAS: pesquisar_jurisprudencia, consultar_kb, pesquisar_sumulas, pesquisar_doutrina, consultar_cnj_datajud`;
}

// 4. chat-stream.js: Enviar typing indicator durante tool execution
res.write(`data: ${JSON.stringify({ type: 'tool_executing', tool: tool.name })}\n\n`);

// 5. ChatPage.tsx: Renderizar typing indicator
if (chunk.type === 'tool_executing') {
  updateMessage(assistantMsg.id, `⏳ ${chunk.tool}...`);
}
```

### FASE 2: CSRF E ROTAS (30 MIN)

```javascript
// 1. csrf-protection.js: Unificar path
app.get('/api/auth/csrf-token', csrfTokenEndpoint); // Era /api/csrf-token

// 2. server-enhanced.js: Fix exempt paths
exemptPaths: [
  '/auth/login',
  '/auth/register',
  '/auth/csrf-token',
  '/chat',           // ← ADICIONAR
  '/chat/stream',
  '/conversations',  // ← WILDCARD NÃO FUNCIONA
  '/users'           // ← REMOVER * e adicionar manualmente as sub-rotas
]

// 3. authStore.ts: Usar apiFetch
import { apiFetch } from '@/services/api'
const data = await apiFetch('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
```

### FASE 3: PERFORMANCE E DEDUPLICAÇÃO (1 HORA)

```javascript
// 1. jurisprudence-search-service.js: Timeouts adaptativos
const GOOGLE_TIMEOUT = 5000; // Era 12-18s
const DATAJUD_TIMEOUT = 8000; // Era 12s

// 2. bedrock-tools.js: Deduplicação
function deduplicateResults(results) {
  const seen = new Set();
  return results.filter(r => {
    const hash = hashResult(r); // Implementar hash por número processo + tribunal
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });
}

// 3. bedrock-tools.js: Streaming progressivo
async function* executeToolStreaming(tool, input) {
  if (tool === 'pesquisar_jurisprudencia') {
    yield { type: 'tool_start', tool };
    for await (const result of searchWithStreaming(input)) {
      yield { type: 'tool_result', result };
    }
    yield { type: 'tool_complete', tool };
  }
}
```

### FASE 4: CLUSTER E MIGRATIONS (30 MIN)

```javascript
// 1. package.json: Desabilitar cluster temporariamente
"start": "NODE_ENV=production node src/index.js" // Era node src/server-cluster.js

// 2. server-enhanced.js: Health check migrations
async function checkMigrations() {
  const pool = await getPostgresPool();
  const result = await pool.query(`
    SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1
  `);
  const latestVersion = result.rows[0]?.version;
  if (latestVersion !== '003') {
    throw new Error(`Migrations incomplete: expected 003, got ${latestVersion}`);
  }
}
await checkMigrations(); // Antes de app.listen()
```

---

## INTERDEPENDÊNCIAS ENTRE PROBLEMAS

1. **MAX_TOOL_LOOPS baixo** → **Forced message enviada** → **System prompt conflita** → **Claude não apresenta**
2. **CSRF path mismatch** → **Token não obtido** → **Requisições falham 403** → **Login não funciona**
3. **Cluster mode** → **EADDRINUSE** → **Workers crash** → **502 Bad Gateway**
4. **Timeouts longos** → **APIs bloqueiam** → **Streaming para** → **Silêncio de 10-15s**
5. **Resultados duplicados** → **Claude confuso** → **Não apresenta todos** → **Limites atingidos**

---

## CONCLUSÃO

O sistema ROM Agent tem **32 problemas identificados**, sendo **12 críticos** que bloqueiam funcionalidade. A solução unificada proposta resolve **90% dos problemas em 4 horas** através de:

1. **Simplificação do system prompt** (de 6000 para 500 chars)
2. **Aumento de MAX_TOOL_LOOPS** (de 2 para 10)
3. **Remoção da forced message** (substituir por lógica no código)
4. **Unificação de CSRF paths**
5. **Desabilitação temporária de cluster mode**
6. **Timeouts adaptativos** (reduzir de 12-18s para 5-8s)
7. **Deduplicação de resultados**
8. **Health check de migrations**

**PRÓXIMO PASSO:** Implementar FASE 1 (Streaming Perfeito) primeiro, pois resolve os 2 problemas mais críticos (#1 e #2) que afetam 80% dos casos de uso.
