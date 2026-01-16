# 🐛 ISSUE: Upload de Arquivos não Integrado com Chat

## Problema Atual

**Upload funciona MAS arquivos não são enviados ao agente IA:**

1. ✅ Upload para `/api/upload` → arquivo salvo no servidor
2. ❌ Chat para `/api/chat/stream` → recebe APENAS texto "📎 Arquivo: nome.pdf"
3. ❌ Bedrock (IA) vê texto mas **NÃO TEM ACESSO ao conteúdo do arquivo**

## Fluxo Atual (Quebrado)

```
[Frontend: DashboardPage.tsx]
1. Usuário seleciona arquivo
2. POST /api/upload → uploadResult = { success: true, file: {path, name, ...} }
3. Adiciona APENAS nome ao conteúdo: content += "📎 Arquivo: nome.pdf"
4. POST /api/chat/stream { message: "Analise este documento\n📎 Arquivo: nome.pdf" }
                                                              ↑
                                                    SEM fileInfo/fileId!

[Backend: server-enhanced.js linha 2132]
5. Recebe apenas `message` (texto)
6. Envia para Bedrock sem contexto do arquivo
7. Bedrock responde sem ler o arquivo ❌
```

## Fluxo Esperado (Correto)

```
[Frontend]
1. Upload arquivo → uploadResult
2. Guardar uploadResult.file.path ou file.id
3. POST /api/chat/stream {
     message: "Analise este documento",
     attachedFiles: [{ path: "uploads/xxx.pdf", name: "contrato.pdf" }]
   }

[Backend]
4. Recebe `attachedFiles`
5. Para cada arquivo:
   a. Extrair texto (PDF/DOCX) usando document-extraction-service.js
   b. Adicionar ao contexto: "Documento 'contrato.pdf':\n[conteúdo extraído]"
6. Enviar para Bedrock com contexto completo
7. Bedrock responde analisando o arquivo ✅
```

## Arquivos a Modificar

### 1. Frontend - `frontend/src/pages/dashboard/DashboardPage.tsx`

**Linha 77-116:** Modificar lógica de upload

```typescript
// ANTES (linha 102)
const uploadResult = await uploadResponse.json()
console.log('✅ Upload success:', uploadResult)

const fileName = files[0].name
content = content ? `${content}\n\n📎 Arquivo: ${fileName}` : `📎 Arquivo: ${fileName}`
// ❌ uploadResult é DESCARTADO!

// DEPOIS (proposta)
const uploadResult = await uploadResponse.json()
console.log('✅ Upload success:', uploadResult)

// Guardar informação do arquivo para enviar com a mensagem
const attachedFile = {
  path: uploadResult.file.path,       // Path no servidor
  filename: uploadResult.file.filename, // Nome único
  originalName: uploadResult.file.originalName,
  mimetype: uploadResult.file.mimetype
}

// Adicionar ao conteúdo E ao payload
const fileName = files[0].name
content = content ? `${content}\n\n📎 Arquivo: ${fileName}` : `📎 Arquivo: ${fileName}`
```

**Linha ~140:** Modificar chamada do chat stream

```typescript
// ANTES
for await (const chunk of chatStreamWithRetry(content, {
  conversationId: convId,
  messages: historyForApi
})) {
  // ...
}

// DEPOIS
for await (const chunk of chatStreamWithRetry(content, {
  conversationId: convId,
  messages: historyForApi,
  attachedFiles: attachedFile ? [attachedFile] : undefined  // ✅ Adicionar
})) {
  // ...
}
```

### 2. Frontend - `frontend/src/services/api.ts`

**Linha ~200:** Modificar chatStream para aceitar attachedFiles

```typescript
export async function* chatStream(
  message: string,
  options: {
    conversationId?: string
    model?: string
    messages?: Array<{ role: string; content: string }>
    attachedFiles?: Array<{path: string, originalName: string, mimetype: string}>  // ✅ Adicionar
    signal?: AbortSignal
  } = {}
): AsyncGenerator<StreamChunk> {
  const { conversationId, model, messages = [], attachedFiles, signal } = options

  // ...

  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({
      message,
      conversationId,
      model,
      messages,
      attachedFiles  // ✅ Enviar para backend
    }),
    signal,
  })
```

### 3. Backend - `src/server-enhanced.js`

**Linha 2132-2211:** Modificar `/api/chat/stream` para processar arquivos

```javascript
app.post('/api/chat/stream', async (req, res) => {
  try {
    const {
      message,
      model = 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
      conversationId,
      messages = [],
      attachedFiles = []  // ✅ Adicionar
    } = req.body;

    const sessionId = conversationId || req.session.id;

    let history = [];
    if (messages && messages.length > 0) {
      history = messages
        .filter(m => m.role && m.content)
        .map(m => ({
          role: m.role,
          content: m.content
        }));
    } else {
      history = getHistory(sessionId);
    }

    // ✅ NOVO: Processar arquivos anexados
    let fileContext = '';
    if (attachedFiles && attachedFiles.length > 0) {
      const { extractTextFromPDF, extractTextFromDOCX } = await import('./services/document-extraction-service.js');

      for (const file of attachedFiles) {
        const fullPath = path.join(process.cwd(), file.path);

        try {
          let text = '';
          if (file.mimetype === 'application/pdf') {
            text = await extractTextFromPDF(fullPath);
          } else if (file.mimetype.includes('word') || file.mimetype.includes('document')) {
            text = await extractTextFromDOCX(fullPath);
          }

          if (text) {
            fileContext += `\n\n=== Documento: ${file.originalName} ===\n${text}\n===\n`;
          }
        } catch (err) {
          console.error(`Erro ao extrair ${file.originalName}:`, err);
          fileContext += `\n\n[Erro ao extrair conteúdo de ${file.originalName}]`;
        }
      }
    }

    // ✅ Adicionar contexto do arquivo à mensagem do usuário
    const messageWithContext = fileContext
      ? `${message}\n${fileContext}`
      : message;

    // Configurar SSE
    res.setHeader('Content-Type', 'text/event-stream');
    // ... resto do código

    await conversarStream(
      messageWithContext,  // ✅ Mensagem COM conteúdo do arquivo
      (chunk) => {
        textoCompleto += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      },
      {
        modelo: model,
        historico: history.slice(-30),
        maxTokens: 4096,
        temperature: 0.7
      }
    );

    // ... resto do código
```

## Serviços Existentes

- ✅ `/src/services/document-extraction-service.js` - já tem funções de extração
- ✅ `/src/services/extraction-service.js` - serviço de extração geral
- ✅ `/src/modules/documentos.js` - módulo de documentos

## Testes Necessários

1. Upload PDF → Enviar mensagem → Verificar se IA leu conteúdo
2. Upload DOCX → Enviar mensagem → Verificar se IA leu conteúdo
3. Upload múltiplos arquivos (se suportado)
4. Arquivo grande (verificar timeout)

## Impacto

- **Frontend**: 2 arquivos (DashboardPage.tsx, api.ts)
- **Backend**: 1 arquivo (server-enhanced.js)
- **Estimativa**: 1-2 horas de implementação + testes

## Próximos Passos

1. Implementar mudanças no backend primeiro (mais crítico)
2. Implementar mudanças no frontend
3. Testar end-to-end
4. Deploy

---

**Prioridade**: ALTA
**Afeta**: Upload, Chat, Experiência do usuário
