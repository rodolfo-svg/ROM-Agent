# 📝 CHANGELOG - Correção Upload + Chat Integrado

**Data Início:** 2026-01-16
**Branch:** `feature/upload-integration-fix`
**Issue:** ISSUE-UPLOAD-INTEGRATION.md

---

## 🎯 Objetivo

Integrar upload de arquivos com **TODO O SISTEMA** para que a IA possa ler e analisar documentos enviados em:
- ✅ Chat (DashboardPage)
- ✅ Chat (ChatPage)
- ✅ Knowledge Base (UploadPage)
- ✅ Case Processor (CaseProcessorPage)
- ✅ Certidões (CertidoesPage)
- ✅ Qualquer outro ponto de upload

**SOLUÇÃO UNIFICADA** - Criar função centralizada `useFileUpload` para evitar duplicação.

---

## 📋 Checklist de Implementação

### FASE 1: PREPARAÇÃO ✅
- [x] Criar branch feature/upload-integration-fix
- [x] Criar ISSUE-UPLOAD-INTEGRATION.md
- [x] Criar CHANGELOG-UPLOAD-FIX.md
- [ ] Backup do código atual (tag git)

### FASE 2: BACKEND (Crítico - SSE Streaming)
- [ ] 2.1 - Modificar `/api/chat/stream` para receber `attachedFiles`
- [ ] 2.2 - Implementar extração de texto (PDF/DOCX)
- [ ] 2.3 - Adicionar contexto do arquivo ao prompt
- [ ] 2.4 - Testar extração isolada (sem frontend)
- [ ] 2.5 - Testar SSE streaming com arquivo

### FASE 3: FRONTEND - Solução Centralizada
- [ ] 3.0 - Criar hook `useFileUpload` centralizado
- [ ] 3.1 - Modificar DashboardPage.tsx para usar hook
- [ ] 3.2 - Modificar ChatPage.tsx para usar hook
- [ ] 3.3 - Modificar UploadPage.tsx para usar hook
- [ ] 3.4 - Modificar CaseProcessorPage.tsx para usar hook
- [ ] 3.5 - Modificar CertidoesPage.tsx para usar hook
- [ ] 3.6 - Modificar api.ts para enviar attachedFiles
- [ ] 3.7 - Atualizar tipos TypeScript
- [ ] 3.8 - Testar cada página de upload

### FASE 4: INTEGRAÇÃO E2E
- [ ] 4.1 - Teste: Upload PDF → Chat → IA responde com conteúdo
- [ ] 4.2 - Teste: Upload DOCX → Chat → IA responde com conteúdo
- [ ] 4.3 - Teste: Arquivo grande (>5MB)
- [ ] 4.4 - Teste: Arquivo sem texto (imagem)
- [ ] 4.5 - Validar histórico persiste

### FASE 5: DEPLOY
- [ ] 5.1 - Merge para main
- [ ] 5.2 - Deploy produção
- [ ] 5.3 - Teste em produção
- [ ] 5.4 - Monitorar logs

---

## 📦 Commits Planejados

Cada commit terá escopo específico para facilitar rollback:

```
1. chore: criar branch feature/upload-integration-fix
2. docs: adicionar ISSUE e CHANGELOG completo
3. feat(backend): criar função extractFileContent() unificada
4. feat(backend): adicionar suporte attachedFiles no /api/chat/stream
5. test(backend): testar extração isolada (PDF + DOCX)
6. feat(frontend): criar hook useFileUpload centralizado
7. feat(frontend): aplicar useFileUpload em DashboardPage
8. feat(frontend): aplicar useFileUpload em ChatPage
9. feat(frontend): aplicar useFileUpload em UploadPage
10. feat(frontend): aplicar useFileUpload em CaseProcessorPage
11. feat(frontend): aplicar useFileUpload em CertidoesPage
12. feat(frontend): atualizar api.ts com attachedFiles
13. feat(frontend): atualizar tipos TypeScript
14. test(e2e): testar DashboardPage upload + chat
15. test(e2e): testar ChatPage upload + chat
16. test(e2e): testar UploadPage (KB)
17. test(e2e): testar CaseProcessorPage
18. fix: ajustes pós-teste (se necessário)
19. docs: atualizar CHANGELOG com resultados
```

---

## 🗺️ Mapeamento Completo do Sistema de Upload

### Pontos de Upload Identificados

| # | Página | Arquivo | Endpoint Usado | Integração com IA |
|---|--------|---------|----------------|-------------------|
| 1 | Dashboard (Chat) | `DashboardPage.tsx` | `/api/upload` → `/api/chat/stream` | ❌ Quebrado |
| 2 | Chat Dedicado | `ChatPage.tsx` | `/api/upload` → `/api/chat/stream` | ❌ Quebrado |
| 3 | Knowledge Base | `UploadPage.tsx` | `/api/upload-documents` | ❓ Verificar |
| 4 | Case Processor | `CaseProcessorPage.tsx` | `/api/case-processor/upload` | ❓ Verificar |
| 5 | Certidões | `CertidoesPage.tsx` | `/api/certidoes/upload` | ❓ Verificar |
| 6 | Upload Chunked | (qualquer) | `/api/upload/chunked/*` | ❓ Verificar |

### Estratégia de Correção Unificada

**Criar Hook Centralizado:**
```typescript
// frontend/src/hooks/useFileUpload.ts (NOVO)
export function useFileUpload() {
  const uploadAndAttach = async (file: File) => {
    // 1. Upload para /api/upload
    const uploadResult = await uploadFile(file);

    // 2. Retornar fileInfo para anexar ao chat
    return {
      path: uploadResult.file.path,
      filename: uploadResult.file.filename,
      originalName: uploadResult.file.originalName,
      mimetype: uploadResult.file.mimetype
    };
  };

  return { uploadAndAttach };
}
```

**Todas as páginas usarão este hook!**

### Endpoints de Backend a Corrigir

| # | Endpoint | Arquivo | Precisa Extração? |
|---|----------|---------|-------------------|
| 1 | `/api/chat/stream` | `server-enhanced.js:2132` | ✅ SIM |
| 2 | `/api/upload` | `server-enhanced.js:2222` | ⚠️ Já salva, mas não extrai |
| 3 | `/api/upload-documents` | `server-enhanced.js:2540` | ❓ Verificar |
| 4 | `/api/case-processor/*` | `routes/case-processor.js` | ✅ SIM (já existe?) |
| 5 | `/api/certidoes/*` | `routes/certidoes.js` | ❓ Verificar |

**Solução Backend Unificada:**
Criar função `extractFileContent(filePath, mimetype)` que pode ser reutilizada em TODOS os endpoints!

---

## 🔍 Detalhamento das Mudanças

### MUDANÇA 1: Backend - `/api/chat/stream` recebe attachedFiles

**Arquivo:** `src/server-enhanced.js`
**Linha:** 2132-2211
**Commit:** `feat(backend): adicionar suporte attachedFiles no /api/chat/stream`

**ANTES:**
```javascript
const {
  message,
  model = 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  conversationId,
  messages = []
} = req.body;
```

**DEPOIS:**
```javascript
const {
  message,
  model = 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  conversationId,
  messages = [],
  attachedFiles = []  // ✅ NOVO
} = req.body;
```

**Impacto:** Baixo - apenas adiciona parâmetro opcional
**Risco:** Baixo - backward compatible
**Rollback:** Remover linha

---

### MUDANÇA 2: Backend - Extração de texto PDF

**Arquivo:** `src/server-enhanced.js`
**Linha:** ~2163 (após history)
**Commit:** `feat(backend): implementar extração de PDF no chat stream`

**CÓDIGO NOVO:**
```javascript
// ✅ NOVO: Processar arquivos anexados
let fileContext = '';
if (attachedFiles && attachedFiles.length > 0) {
  const { extractTextFromPDF, extractTextFromDOCX } = await import('./services/document-extraction-service.js');
  const path = await import('path');

  for (const file of attachedFiles) {
    const fullPath = path.join(process.cwd(), file.path);

    try {
      let text = '';

      // PDF
      if (file.mimetype === 'application/pdf') {
        console.log(`📄 Extraindo PDF: ${file.originalName}`);
        text = await extractTextFromPDF(fullPath);
        console.log(`✅ PDF extraído: ${text.length} caracteres`);
      }

      // DOCX
      else if (file.mimetype.includes('word') ||
               file.mimetype.includes('document') ||
               file.originalName.endsWith('.docx')) {
        console.log(`📝 Extraindo DOCX: ${file.originalName}`);
        text = await extractTextFromDOCX(fullPath);
        console.log(`✅ DOCX extraído: ${text.length} caracteres`);
      }

      if (text) {
        fileContext += `\n\n=== Documento: ${file.originalName} ===\n${text.substring(0, 50000)}\n===\n`;
      }
    } catch (err) {
      console.error(`❌ Erro ao extrair ${file.originalName}:`, err);
      fileContext += `\n\n[Erro ao extrair conteúdo de ${file.originalName}: ${err.message}]`;
    }
  }
}
```

**Impacto:** Médio - adiciona processamento síncrono
**Risco:** Médio - pode aumentar latência (limite 50k chars)
**Rollback:** Comentar bloco inteiro
**Monitorar:** Tempo de extração, tamanho do contexto

---

### MUDANÇA 3: Backend - Adicionar contexto ao prompt

**Arquivo:** `src/server-enhanced.js`
**Linha:** ~2173 (antes de conversarStream)
**Commit:** Mesmo commit da MUDANÇA 2

**ANTES:**
```javascript
await conversarStream(
  message,  // ❌ Sem contexto do arquivo
  (chunk) => {
```

**DEPOIS:**
```javascript
// ✅ Adicionar contexto do arquivo à mensagem
const messageWithContext = fileContext
  ? `${message}\n${fileContext}`
  : message;

console.log(`🌊 Streaming com contexto: ${messageWithContext.length} caracteres`);

await conversarStream(
  messageWithContext,  // ✅ COM contexto do arquivo
  (chunk) => {
```

**Impacto:** Alto - muda input do Bedrock
**Risco:** Médio - pode alterar comportamento da IA
**Rollback:** Usar `message` direto
**Validar:** IA lê arquivo corretamente

---

### MUDANÇA 4: Frontend - Guardar fileInfo após upload

**Arquivo:** `frontend/src/pages/dashboard/DashboardPage.tsx`
**Linha:** 101-106
**Commit:** `feat(frontend): guardar fileInfo após upload em DashboardPage`

**ANTES:**
```typescript
const uploadResult = await uploadResponse.json()
console.log('✅ Upload success:', uploadResult)

const fileName = files[0].name
content = content ? `${content}\n\n📎 Arquivo: ${fileName}` : `📎 Arquivo: ${fileName}`
// ❌ uploadResult descartado!
```

**DEPOIS:**
```typescript
const uploadResult = await uploadResponse.json()
console.log('✅ Upload success:', uploadResult)

// ✅ Guardar info do arquivo
const attachedFile = {
  path: uploadResult.file.path,
  filename: uploadResult.file.filename,
  originalName: uploadResult.file.originalName,
  mimetype: uploadResult.file.mimetype
}

console.log('📎 Arquivo anexado:', attachedFile)

const fileName = files[0].name
content = content ? `${content}\n\n📎 Arquivo: ${fileName}` : `📎 Arquivo: ${fileName}`
```

**Impacto:** Baixo - apenas cria variável
**Risco:** Baixo - não afeta fluxo existente
**Rollback:** Remover variável attachedFile

---

### MUDANÇA 5: Frontend - Enviar attachedFiles ao backend

**Arquivo:** `frontend/src/pages/dashboard/DashboardPage.tsx`
**Linha:** ~140 (dentro de handleSend, antes do loop chatStreamWithRetry)
**Commit:** Mesmo commit da MUDANÇA 4

**ANTES:**
```typescript
for await (const chunk of chatStreamWithRetry(content, {
  conversationId: convId,
  messages: historyForApi
})) {
```

**DEPOIS:**
```typescript
for await (const chunk of chatStreamWithRetry(content, {
  conversationId: convId,
  messages: historyForApi,
  attachedFiles: attachedFile ? [attachedFile] : undefined  // ✅ NOVO
})) {
```

**Impacto:** Médio - envia dados para backend
**Risco:** Baixo - backend ignora se não implementado
**Rollback:** Remover linha

---

### MUDANÇA 6: Frontend - Atualizar tipos api.ts

**Arquivo:** `frontend/src/services/api.ts`
**Linha:** ~192-200
**Commit:** `feat(frontend): adicionar attachedFiles ao chatStream`

**ANTES:**
```typescript
export async function* chatStream(
  message: string,
  options: {
    conversationId?: string
    model?: string
    messages?: Array<{ role: string; content: string }>
    signal?: AbortSignal
  } = {}
): AsyncGenerator<StreamChunk> {
  const { conversationId, model, messages = [], signal } = options
```

**DEPOIS:**
```typescript
export async function* chatStream(
  message: string,
  options: {
    conversationId?: string
    model?: string
    messages?: Array<{ role: string; content: string }>
    attachedFiles?: Array<{  // ✅ NOVO
      path: string
      filename: string
      originalName: string
      mimetype: string
    }>
    signal?: AbortSignal
  } = {}
): AsyncGenerator<StreamChunk> {
  const { conversationId, model, messages = [], attachedFiles, signal } = options
```

**Impacto:** Baixo - apenas tipo TypeScript
**Risco:** Muito baixo - compile-time only
**Rollback:** Remover tipo

---

### MUDANÇA 7: Frontend - Enviar attachedFiles no fetch

**Arquivo:** `frontend/src/services/api.ts`
**Linha:** ~216-227
**Commit:** Mesmo commit da MUDANÇA 6

**ANTES:**
```typescript
const res = await fetch(`${API_BASE}/chat/stream`, {
  method: 'POST',
  credentials: 'include',
  headers,
  body: JSON.stringify({
    message,
    conversationId,
    model,
    messages,
    stream: true,
  }),
  signal,
})
```

**DEPOIS:**
```typescript
const res = await fetch(`${API_BASE}/chat/stream`, {
  method: 'POST',
  credentials: 'include',
  headers,
  body: JSON.stringify({
    message,
    conversationId,
    model,
    messages,
    attachedFiles,  // ✅ NOVO
    stream: true,
  }),
  signal,
})
```

**Impacto:** Médio - envia payload para backend
**Risco:** Baixo - backend ignora se não lê
**Rollback:** Remover linha

---

## 🧪 Testes por Fase

### TESTE BACKEND ISOLADO (sem frontend)

```bash
# Criar arquivo de teste
echo "Este é um documento de teste para extração." > /tmp/test.txt

# Converter para PDF (se tiver pandoc)
# ou usar PDF existente

# Testar endpoint diretamente
curl -X POST https://iarom.com.br/api/chat/stream \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=..." \
  -d '{
    "message": "Resuma este documento",
    "attachedFiles": [{
      "path": "uploads/xxx.pdf",
      "filename": "xxx.pdf",
      "originalName": "contrato.pdf",
      "mimetype": "application/pdf"
    }]
  }'
```

### TESTE FRONTEND (após implementação)

1. Login → Dashboard
2. Anexar PDF
3. Escrever: "Analise este contrato e liste os pontos principais"
4. Enviar
5. **Validar:** IA menciona conteúdo específico do PDF (não genérico)

---

## 📊 Métricas de Sucesso

- [ ] Upload + Chat funciona end-to-end
- [ ] IA lê e analisa conteúdo do arquivo
- [ ] Arquivo aparece no histórico da conversa
- [ ] SSE streaming funciona sem erros
- [ ] Latência aceitável (<10s para PDFs <5MB)
- [ ] Logs mostram extração bem-sucedida

---

## 🚨 Rollback Plan

**Se algo der errado:**

```bash
# Rollback completo
git reset --hard HEAD~N  # N = número de commits

# Rollback parcial (apenas backend)
git revert <commit-hash-backend>

# Rollback parcial (apenas frontend)
git revert <commit-hash-frontend>
```

**Commits serão atômicos para facilitar rollback seletivo!**

---

## 📝 Log de Execução

### 2026-01-16 22:xx - Início
- Branch criada: feature/upload-integration-fix
- Documentação preparada
- **STATUS:** Aguardando aprovação para implementar

### [Próximas entradas serão adicionadas durante implementação]

---

**Última atualização:** 2026-01-16 22:45
**Status:** 🟡 Aguardando implementação
