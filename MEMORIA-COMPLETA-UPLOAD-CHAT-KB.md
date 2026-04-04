# 🧠 MEMÓRIA COMPLETA: UPLOAD & KB → CHAT

> **CRÍTICO:** Este documento contém TODA a memória técnica do fluxo Upload → Extração → KB → Chat.
> **OBRIGATÓRIO:** Consultar antes de modificar QUALQUER código relacionado a upload, KB ou chat.

**Última atualização:** 04/04/2026 19:15h
**Objetivo:** Evitar rollback, retrocesso e GARANTIR que upload & KB fiquem plenamente executáveis com extração lida pela conversa-chat

---

## 🎯 PROBLEMA HISTÓRICO PRINCIPAL

### Descrição do Usuário:
> "até quinta estavamos ao menos conseguindo subir e extrair o bqsico dos arquivos e que o probelmas maior era o chat nao acessar onde estava sendo salvos os arquivos extraidos que estavam na pasta global e que quando logavamos novamente perdia o acesso e ele deve ficar na pasta do diretorio permanente onde o chat busca"

### Resumo:
1. ✅ Upload de arquivos (221MB+) FUNCIONA
2. ✅ Extração de PDFs FUNCIONA
3. ❌ **Chat NÃO consegue acessar os documentos extraídos**
4. ❌ **Acesso é PERDIDO após logout/login**

---

## 📊 FLUXO COMPLETO MAPEADO

### 1. UPLOAD (Onde os arquivos são salvos)

**Arquivo:** `src/server-enhanced.js` (linhas 3820-3919)

**Caminho do upload:**
```javascript
const kbPath = path.join(ACTIVE_PATHS.data, 'knowledge-base', 'documents', `${file.filename}.txt`);
```

**Onde ACTIVE_PATHS.data aponta:**
- **Produção (Render):** `/var/data/data`
- **Local:** `<projeto>/var-data-local/data`

**userId salvo:**
```javascript
// Linha 3858
userId: req.session?.user?.id || 'web-upload'
```

**⚠️ PROBLEMA CRÍTICO #1:**
Se usuário faz upload SEM estar logado → `userId = 'web-upload'`
Se usuário depois faz login → `userId = id_do_usuário`
**RESULTADO:** Chat não encontra documentos porque filtra por userId diferente!

---

### 2. KB DOCUMENTS REGISTRY (kb-documents.json)

**Localização:**
```javascript
const kbDocsPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');
// Produção: /var/data/data/kb-documents.json
```

**Estrutura do documento:**
```json
{
  "id": "kb-1234567890-abc123",
  "name": "arquivo.pdf",
  "type": "application/pdf",
  "size": 221200000,
  "path": "/var/data/data/knowledge-base/documents/arquivo.txt",
  "userId": "web-upload",  // ← CRÍTICO!
  "userName": "Web Upload",
  "uploadedAt": "2026-04-04T19:00:00.000Z",
  "extractedText": "...",
  "textLength": 50000,
  "metadata": {
    "toolsUsed": [...],
    "structuredDocuments": 7,
    "wordCount": 10000
  }
}
```

**⚠️ PROBLEMA CRÍTICO #2:**
O formato PODE ser:
- `[]` (correto - array direto)
- `{documents: []}` (legado - objeto com propriedade documents)

**FIX:** Commit `58cfadd` corrigiu kb-cache.js para suportar ambos formatos.

---

### 3. CHAT CONSULTA KB (Como o chat busca documentos)

**Arquivo:** `src/modules/bedrock-tools.js` (linhas 756-900)

**Função:** `consultar_kb`

**Como busca:**
```javascript
// Linha 772: Caminho do arquivo
const kbDocsPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');

// Linha 780: Lê todos documentos
allDocs = JSON.parse(data);

// Linha 800-804: FILTRO POR USERID
const userId = context.userId;
const userDocs = userId ? allDocs.filter(doc => doc.userId === userId) : allDocs;
```

**⚠️ PROBLEMA CRÍTICO #3:**
O chat SEMPRE filtra por `context.userId`!

Se:
- Upload foi feito com `userId = 'web-upload'`
- Chat é aberto com `userId = 'id_real_do_usuario'`

**RESULTADO:** `userDocs.length = 0` → "Nenhum documento encontrado"

---

### 4. ORIGEM DO context.userId NO CHAT

**Arquivo:** `src/routes/chat-stream.js` (linha 129)

```javascript
const userId = req.session?.user?.id || req.body.userId || 'anonymous';
```

**Arquivo:** `src/routes/chat-stream.js` (linha 520)

```javascript
userId: userId  // Passado para bedrock.js
```

**Arquivo:** `src/modules/bedrock.js` (linha 499, 1280)

```javascript
const result = await executeTool(name, input, { userId });
```

---

## 🔍 MATRIZ DE PROBLEMAS IDENTIFICADOS

| Cenário | Upload userId | Chat userId | Resultado | Status |
|---------|---------------|-------------|-----------|--------|
| 1. Upload COM login → Chat COM login (mesmo user) | `id_123` | `id_123` | ✅ FUNCIONA | OK |
| 2. Upload SEM login → Chat SEM login | `web-upload` | `anonymous` | ❌ NÃO ENCONTRA | BUG #1 |
| 3. Upload SEM login → Chat COM login | `web-upload` | `id_123` | ❌ NÃO ENCONTRA | BUG #2 |
| 4. Upload COM login → Logout → Login → Chat | `id_123` | `id_123` | ✅ DEVERIA FUNCIONAR | Testar |
| 5. Upload COM login UserA → Chat COM login UserB | `id_A` | `id_B` | ❌ NÃO ENCONTRA | Comportamento correto (privacidade) |

---

## ✅ SOLUÇÕES IMPLEMENTADAS

### Fix #1: KB Cache suporta formato legado (Commit 58cfadd)

**Problema:** kb-documents.json em produção tinha formato `{documents: []}`

**Solução:** `lib/kb-cache.js` linhas 66-79
```javascript
const parsed = JSON.parse(data);

if (Array.isArray(parsed)) {
  this.cache = parsed;  // Formato correto
} else if (parsed && Array.isArray(parsed.documents)) {
  this.cache = parsed.documents;  // Formato legado convertido
  console.log('⚠️ KB Cache: Convertendo formato legado {documents:[]} para []');
} else {
  this.cache = [];  // Formato desconhecido
}
```

**Validação:** ✅ Logs mostram "X documentos" ao invés de "undefined documentos"

---

### Fix #2: CSP headers incluem backend URL (Commit ee6e865)

**Problema:** Upload chunked bloqueado por CSP

**Solução:** `src/middleware/security-headers.js`
```javascript
connectSrc: [
  "'self'",
  "https://static.cloudflareinsights.com",
  "https://rom-agent-ia.onrender.com"  // Backend adicionado
]
```

**Validação:** ✅ Upload de 221MB funciona sem "Failed to fetch"

---

### Fix #3: API routes retornam 401 JSON (Commit 8a7b7af)

**Problema:** Polling de extração recebia 302 redirect interpretado como "erro 502"

**Solução:** `src/middleware/auth.js`
```javascript
if (!req.isAuthenticated()) {
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({
      error: 'Não autenticado',
      message: 'Você precisa fazer login'
    });
  }
  return res.redirect('/login.html');
}
```

**Validação:** ✅ Frontend detecta sessão expirada corretamente

---

## ❌ PROBLEMAS AINDA NÃO RESOLVIDOS

### BUG #1: userId divergente entre upload e chat

**Situação:**
- Usuário faz upload SEM login → `userId = 'web-upload'`
- Usuário abre chat SEM login → `userId = 'anonymous'`
- Chat filtra documentos por 'anonymous'
- Documentos estão salvos com 'web-upload'
- **RESULTADO:** Zero documentos encontrados

**Impacto:** CRÍTICO

**Soluções Possíveis:**

#### Opção A: Forçar login antes de upload ✅ RECOMENDADO
```javascript
// Em server-enhanced.js, antes do upload
if (!req.session?.user?.id) {
  return res.status(401).json({
    error: 'Login necessário',
    message: 'Faça login antes de fazer upload de documentos'
  });
}
```

**Prós:**
- Garante userId consistente
- Mais seguro
- Simples de implementar

**Contras:**
- Usuários anônimos não podem fazer upload

#### Opção B: Chat não filtrar por userId se userId for 'anonymous' ou 'web-upload'
```javascript
// Em bedrock-tools.js linha 804
const userDocs = (userId && userId !== 'anonymous' && userId !== 'web-upload')
  ? allDocs.filter(doc => doc.userId === userId)
  : allDocs;  // Mostrar TODOS se usuário não logado
```

**Prós:**
- Funciona para usuários anônimos
- Upload já existe continua funcionando

**Contras:**
- RISCO DE SEGURANÇA: usuário vê documentos de TODOS
- Não recomendado para produção

#### Opção C: Migrar documentos 'web-upload' para userId real após login ✅ IDEAL
```javascript
// Criar endpoint /api/migrate-anonymous-docs
app.post('/api/migrate-anonymous-docs', async (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  // Buscar docs com userId 'web-upload' ou 'anonymous'
  const anonymousDocs = kbCache.filter(doc =>
    doc.userId === 'web-upload' || doc.userId === 'anonymous'
  );

  // Atualizar userId para o usuário real
  for (const doc of anonymousDocs) {
    kbCache.update(doc.id, { userId, userName: req.session.user.name });
  }

  return res.json({ migrated: anonymousDocs.length });
});
```

**Prós:**
- Melhor UX (permite upload antes de login)
- Seguro após migração
- Preserva privacidade

**Contras:**
- Mais complexo de implementar
- Precisa ser chamado no primeiro login

---

### BUG #2: Persistência após logout/login

**Situação:**
- Usuário faz upload COM login
- Documentos salvos em `/var/data/data/kb-documents.json`
- Usuário faz logout
- Usuário faz login novamente
- **ESPERADO:** Documentos continuam acessíveis
- **REAL:** Precisa validar

**Status:** ⚠️ PRECISA TESTE MANUAL

**Validação Necessária:**
1. Login → Upload documento → Logout → Login → Abrir chat → Consultar documento
2. Verificar logs: `render logs -r srv-... --text "KB DEBUG"`
3. Confirmar que userId permanece igual

---

## 🧪 SCRIPT DE DIAGNÓSTICO

Criei script para diagnosticar problemas de userId:

**Arquivo:** `scripts/diagnose-upload-chat-kb.sh`

```bash
#!/bin/bash
# Diagnosticar problemas de Upload → KB → Chat

SERVICE_ID="srv-d51ppfmuk2gs73a1qlkg"

echo "🔍 DIAGNÓSTICO: Upload → KB → Chat"
echo "===================================="
echo ""

# 1. Verificar kb-documents.json via logs
echo "📋 1. Verificando documentos no KB..."
render logs -r "$SERVICE_ID" --text "KB Cache" | grep "$(date +%Y-%m-%d)" | tail -5

echo ""

# 2. Verificar logs de upload
echo "📤 2. Últimos uploads..."
render logs -r "$SERVICE_ID" --text "KB Registry" | tail -10

echo ""

# 3. Verificar logs de consulta do chat
echo "💬 3. Consultas do chat ao KB..."
render logs -r "$SERVICE_ID" --text "KB DEBUG" | tail -20

echo ""

# 4. Verificar userId nos logs
echo "👤 4. UserIds detectados..."
render logs -r "$SERVICE_ID" 2>&1 | grep -E "userId.*:" | tail -10
```

---

## 📝 CHECKLIST DE VALIDAÇÃO END-TO-END

### Cenário 1: Upload COM login → Chat COM login (mesmo usuário)

- [ ] 1.1. Fazer login no sistema
- [ ] 1.2. Ir em "Upload & KB"
- [ ] 1.3. Fazer upload de PDF pequeno (< 1MB)
- [ ] 1.4. Aguardar extração completar
- [ ] 1.5. Verificar que documento aparece em "Upload & KB"
- [ ] 1.6. Abrir chat
- [ ] 1.7. Perguntar algo relacionado ao documento
- [ ] 1.8. Verificar que chat encontra e usa o documento
- [ ] 1.9. Verificar logs: `render logs -r srv-... --text "KB DEBUG"`
- [ ] 1.10. Confirmar que userId é o mesmo em upload e chat

**Resultado Esperado:** ✅ Chat encontra documento

---

### Cenário 2: Upload COM login → Logout → Login → Chat

- [ ] 2.1. Fazer login no sistema
- [ ] 2.2. Fazer upload de documento
- [ ] 2.3. Verificar que documento aparece em "Upload & KB"
- [ ] 2.4. Fazer LOGOUT
- [ ] 2.5. Fazer LOGIN novamente (mesmo usuário)
- [ ] 2.6. Verificar que documento AINDA aparece em "Upload & KB"
- [ ] 2.7. Abrir chat
- [ ] 2.8. Perguntar algo relacionado ao documento
- [ ] 2.9. Verificar que chat encontra e usa o documento
- [ ] 2.10. Verificar logs para confirmar persistência

**Resultado Esperado:** ✅ Documento persiste após logout/login

---

### Cenário 3: Upload SEM login → Chat SEM login

- [ ] 3.1. Abrir sistema SEM fazer login
- [ ] 3.2. Tentar fazer upload
- [ ] 3.3. **SE permitir:** Verificar userId nos logs
- [ ] 3.4. Abrir chat SEM login
- [ ] 3.5. Tentar consultar documento
- [ ] 3.6. Verificar se encontra ou não

**Resultado Atual:** ❌ Provavelmente NÃO encontra (userId divergente)
**Resultado Desejado:** ⚠️ Definir comportamento esperado

---

## 🚀 PRÓXIMAS AÇÕES RECOMENDADAS

### Prioridade CRÍTICA:

1. **Testar Cenário 1 manualmente** ✅
   - Login → Upload → Chat
   - Validar se funciona 100%

2. **Testar Cenário 2 manualmente** ✅
   - Login → Upload → Logout → Login → Chat
   - Validar persistência

3. **Decidir comportamento para usuários não logados** ⚠️
   - Bloquear upload sem login? (Opção A)
   - Migrar documentos após login? (Opção C)
   - Permitir acesso global? (Opção B - NÃO recomendado)

4. **Implementar solução escolhida** ⚠️
   - Criar PR com fix
   - Testar exaustivamente
   - Documentar aqui o resultado

5. **Criar testes automatizados** ⚠️
   - E2E test: Upload → Chat
   - E2E test: Logout → Login → Chat

---

## 📁 ARQUIVOS CRÍTICOS

### Leitura Obrigatória:

1. **`src/server-enhanced.js`** (linhas 3820-3919)
   - Onde uploads são salvos
   - Onde userId é definido

2. **`src/modules/bedrock-tools.js`** (linhas 756-900)
   - Como chat consulta KB
   - Como filtra por userId

3. **`src/routes/chat-stream.js`** (linhas 129, 520)
   - Como userId é passado para bedrock

4. **`lib/kb-cache.js`** (linhas 66-79)
   - Fix do formato legado
   - Como cache é carregado

5. **`lib/storage-config.js`** (linhas 1-328)
   - Onde ACTIVE_PATHS aponta
   - Diferença produção vs local

---

## 🔧 COMANDOS DE DEBUG

### Ver documentos no KB:
```bash
render logs -r srv-d51ppfmuk2gs73a1qlkg --text "KB Cache"
```

### Ver uploads recentes:
```bash
render logs -r srv-d51ppfmuk2gs73a1qlkg --text "KB Registry"
```

### Ver consultas do chat:
```bash
render logs -r srv-d51ppfmuk2gs73a1qlkg --text "KB DEBUG"
```

### Ver userIds nos logs:
```bash
render logs -r srv-d51ppfmuk2gs73a1qlkg 2>&1 | grep -E "userId"
```

### Ver conteúdo de kb-documents.json (se acessível):
```bash
# Via logs de inicialização
render logs -r srv-d51ppfmuk2gs73a1qlkg | grep "documentos carregados"
```

---

## ⚠️ AVISOS CRÍTICOS

### 1. NUNCA modificar kb-cache.js sem ler este documento

O kb-cache.js foi corrigido para suportar formato legado. Qualquer modificação pode quebrar a compatibilidade.

### 2. NUNCA alterar filtro de userId sem validar impacto

O filtro por userId em bedrock-tools.js é CRÍTICO para privacidade. Remover ou alterar pode expor documentos de outros usuários.

### 3. SEMPRE testar logout/login após mudanças em auth

Qualquer mudança em autenticação pode afetar persistência de documentos.

### 4. SEMPRE verificar ACTIVE_PATHS antes de salvar arquivos

Salvar fora de `/var/data` em produção = perda de dados no próximo restart.

---

## 📊 HISTÓRICO DE MUDANÇAS

| Data | Commit | Descrição | Impacto |
|------|--------|-----------|---------|
| 04/04 | `58cfadd` | fix(kb-cache): Suportar formato legado | ✅ Resolve "undefined documentos" |
| 04/04 | `ee6e865` | fix(csp): Backend URL no CSP | ✅ Upload chunked funciona |
| 04/04 | `8a7b7af` | fix(auth): API 401 JSON não 302 | ✅ Polling extração correto |
| 04/04 | `0fbe6cf` | docs: Documentação completa | ✅ Memória preservada |
| 04/04 | `8ec9217` | test: Validação CLI + API | ✅ Testes passando 100% |
| 04/04 | `3316d14` | docs: Relatório final sessão | ✅ Histórico completo |
| 04/04 | `PENDENTE` | fix: userId divergente upload/chat | ⚠️ CRÍTICO - precisa implementar |

---

## ✅ CONCLUSÃO

Este documento contém **TODA** a memória técnica do fluxo Upload → KB → Chat.

**Estado Atual:**
- ✅ Upload funcionando (221MB+)
- ✅ Extração funcionando
- ✅ KB Cache corrigido (sem "undefined")
- ⚠️ Chat → KB com problema de userId divergente
- ⚠️ Persistência precisa validação manual

**Próximo Passo:**
1. Testar manualmente Cenário 1 e 2
2. Decidir solução para userId divergente
3. Implementar solução
4. Validar exaustivamente

---

**Este documento DEVE ser atualizado sempre que houver mudanças no fluxo Upload/KB/Chat.**

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
