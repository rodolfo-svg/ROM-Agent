# 🔍 REVISÃO CRÍTICA - Upload Integration Fix

**Data:** 2026-01-16
**Branch:** feature/upload-integration-fix
**Revisor:** Rodolfo (usuário)
**Status:** 🟡 AGUARDANDO APROVAÇÃO

---

## ⚠️ PONTOS CRÍTICOS QUE PRECISAM DE SUA APROVAÇÃO EXPLÍCITA

### 🔴 CRÍTICO 1: Modificar SSE Streaming (server-enhanced.js)

**O QUE VAI MUDAR:**
```javascript
// LINHA 2173 - ANTES (código atual):
await conversarStream(
  message,  // ← Apenas texto da mensagem
  (chunk) => { res.write(...) },
  { modelo, historico, maxTokens, temperature }
);

// DEPOIS (proposta):
await conversarStream(
  messageWithContext,  // ← Mensagem + conteúdo do arquivo extraído
  (chunk) => { res.write(...) },
  { modelo, historico, maxTokens, temperature }
);
```

**RISCO:**
- ⚠️ **ALTO** - Mudança no input do Bedrock pode afetar TODAS as conversas
- ⚠️ Pode aumentar latência (extração de PDF/DOCX é síncrona)
- ⚠️ Pode estourar limite de tokens se arquivo for muito grande

**MITIGAÇÕES PROPOSTAS:**
1. ✅ Limitar conteúdo extraído a 50.000 caracteres
2. ✅ Timeout de 10s para extração (não bloquear forever)
3. ✅ Se extração falhar → continuar com texto original (graceful degradation)
4. ✅ Log detalhado para debug
5. ✅ Commit atômico (fácil reverter)

**QUESTÕES PARA VOCÊ:**
- [ ] **APROVADO?** Mudar input do Bedrock adicionando conteúdo do arquivo?
- [ ] Limite de 50k chars está OK? (Ou prefere menor/maior?)
- [ ] Timeout de 10s está OK?
- [ ] Quer teste em staging ANTES de produção?

---

### 🟡 CRÍTICO 2: Criar Hook Centralizado (useFileUpload)

**O QUE VAI CRIAR:**
```typescript
// frontend/src/hooks/useFileUpload.ts (ARQUIVO NOVO)
export function useFileUpload() {
  const uploadAndAttach = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'x-csrf-token': await getCsrfToken()
      },
      body: formData
    });

    const result = await response.json();

    return {
      path: result.file.path,
      filename: result.file.filename,
      originalName: result.file.originalName,
      mimetype: result.file.mimetype
    };
  };

  return { uploadAndAttach };
}
```

**RISCO:**
- ⚠️ **MÉDIO** - Se hook tiver bug, afeta 5 páginas simultaneamente
- ⚠️ Mudança em DashboardPage, ChatPage, UploadPage, CaseProcessorPage, CertidoesPage

**MITIGAÇÕES PROPOSTAS:**
1. ✅ Testar hook isoladamente ANTES de aplicar nas páginas
2. ✅ Aplicar uma página por vez (6 commits separados)
3. ✅ Cada página testada antes de próxima
4. ✅ Manter código antigo comentado (rollback fácil)

**QUESTÕES PARA VOCÊ:**
- [ ] **APROVADO?** Criar hook centralizado em vez de duplicar código?
- [ ] Prefere testar em UMA página primeiro e depois expandir?
- [ ] Quer revisão do hook antes de aplicar nas páginas?

---

### 🟡 CRÍTICO 3: Modificar 5 Páginas de Upload

**PÁGINAS QUE SERÃO MODIFICADAS:**

| # | Página | Linhas Afetadas | Risco |
|---|--------|----------------|-------|
| 1 | DashboardPage.tsx | ~77-116, ~140 | Alto (chat principal) |
| 2 | ChatPage.tsx | Similar | Alto (chat dedicado) |
| 3 | UploadPage.tsx | Verificar | Médio (KB) |
| 4 | CaseProcessorPage.tsx | Verificar | Médio (extração) |
| 5 | CertidoesPage.tsx | Verificar | Baixo (certidões) |

**ESTRATÉGIA:**
1. DashboardPage primeiro (commit isolado)
2. Testar E2E: upload + chat
3. Se OK → ChatPage (commit isolado)
4. Testar E2E: upload + chat
5. Se OK → continuar com outras 3 páginas

**QUESTÕES PARA VOCÊ:**
- [ ] **APROVADO?** Modificar 5 páginas em sequência?
- [ ] Prefere começar por qual? (DashboardPage é a mais usada)
- [ ] Quer deploy intermediário após cada página funcionar?

---

### 🟢 CRÍTICO 4: Extração de Conteúdo (Backend)

**FUNÇÃO PROPOSTA:**
```javascript
// src/utils/extractFileContent.js (ARQUIVO NOVO)
async function extractFileContent(filePath, mimetype) {
  const MAX_CHARS = 50000;
  const TIMEOUT_MS = 10000;

  try {
    let text = '';

    // PDF
    if (mimetype === 'application/pdf') {
      const { extractTextFromPDF } = await import('./services/document-extraction-service.js');
      text = await Promise.race([
        extractTextFromPDF(filePath),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
        )
      ]);
    }

    // DOCX
    else if (mimetype.includes('word') || mimetype.includes('document')) {
      const { extractTextFromDOCX } = await import('./services/document-extraction-service.js');
      text = await Promise.race([
        extractTextFromDOCX(filePath),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
        )
      ]);
    }

    // TXT
    else if (mimetype === 'text/plain') {
      const fs = await import('fs/promises');
      text = await fs.readFile(filePath, 'utf-8');
    }

    // Limitar tamanho
    if (text.length > MAX_CHARS) {
      text = text.substring(0, MAX_CHARS) + '\n\n[... conteúdo truncado ...]';
    }

    return text;

  } catch (error) {
    console.error(`Erro ao extrair ${filePath}:`, error);
    return `[Erro ao extrair conteúdo: ${error.message}]`;
  }
}
```

**SERVIÇOS EXISTENTES USADOS:**
- ✅ `document-extraction-service.js::extractTextFromPDF` (já existe)
- ✅ `document-extraction-service.js::extractTextFromDOCX` (já existe)

**QUESTÕES PARA VOCÊ:**
- [ ] **APROVADO?** Usar serviços existentes?
- [ ] Timeout de 10s está OK? (PDFs grandes podem demorar)
- [ ] Limite de 50k caracteres está OK?
- [ ] Aceita truncamento ou prefere rejeitar arquivo grande?

---

### 🔵 CRÍTICO 5: Tipos TypeScript (api.ts)

**O QUE VAI MUDAR:**
```typescript
// ANTES - api.ts linha ~192
export async function* chatStream(
  message: string,
  options: {
    conversationId?: string
    model?: string
    messages?: Array<{ role: string; content: string }>
    signal?: AbortSignal
  } = {}
)

// DEPOIS - api.ts linha ~192
export async function* chatStream(
  message: string,
  options: {
    conversationId?: string
    model?: string
    messages?: Array<{ role: string; content: string }>
    attachedFiles?: Array<{      // ← NOVO
      path: string
      filename: string
      originalName: string
      mimetype: string
    }>
    signal?: AbortSignal
  } = {}
)
```

**RISCO:**
- ⚠️ **BAIXO** - TypeScript compile-time only
- ✅ Backward compatible (optional parameter)

**QUESTÕES PARA VOCÊ:**
- [ ] **APROVADO?** Adicionar tipo opcional?

---

## 📊 RESUMO DE RISCOS

| Mudança | Risco | Reversível? | Teste Necessário |
|---------|-------|-------------|------------------|
| SSE Streaming (backend) | 🔴 Alto | ✅ Sim (1 commit) | ✅ E2E obrigatório |
| Hook useFileUpload | 🟡 Médio | ✅ Sim (1 commit) | ✅ Unitário + E2E |
| DashboardPage | 🔴 Alto | ✅ Sim (1 commit) | ✅ E2E obrigatório |
| ChatPage | 🔴 Alto | ✅ Sim (1 commit) | ✅ E2E obrigatório |
| UploadPage | 🟡 Médio | ✅ Sim (1 commit) | ✅ E2E |
| CaseProcessorPage | 🟡 Médio | ✅ Sim (1 commit) | ✅ E2E |
| CertidoesPage | 🟢 Baixo | ✅ Sim (1 commit) | ⚠️ Opcional |
| extractFileContent | 🟢 Baixo | ✅ Sim (1 commit) | ✅ Unitário |
| Tipos TypeScript | 🟢 Baixo | ✅ Sim (1 commit) | ⚠️ Compile-time |

**TOTAL:** 9 mudanças, TODAS reversíveis com 1 commit

---

## 🛡️ ESTRATÉGIA DE PROTEÇÃO

### 1. Commits Atômicos (OBRIGATÓRIO)
✅ Cada mudança = 1 commit isolado
✅ Rollback: `git revert <commit-hash>`
✅ Não usar `git reset` (preserva história)

### 2. Testes Progressivos (OBRIGATÓRIO)
```
Commit 1 → Teste 1 → ✅ OK? → Commit 2
                   → ❌ ERRO? → Rollback + Fix
```

### 3. Deploy Staged (RECOMENDADO)
```
1. Implementar backend → Deploy staging → Testar
2. Se OK → Implementar frontend → Deploy staging → Testar
3. Se OK → Deploy produção
```

### 4. Monitoramento (OBRIGATÓRIO)
```
- Logs de extração: console.log cada arquivo processado
- Métricas: tempo de extração, tamanho do contexto
- Alertas: se latência > 15s ou erro rate > 5%
```

### 5. Rollback Plan (PRÉ-DEFINIDO)
```bash
# Rollback TOTAL
git revert HEAD~9..HEAD  # Reverter 9 commits

# Rollback PARCIAL (apenas backend)
git revert <commit-backend>

# Rollback PARCIAL (apenas DashboardPage)
git revert <commit-dashboard>
```

---

## ✅ CHECKLIST DE APROVAÇÃO

Por favor, marque cada item:

### Backend
- [ ] APROVADO: Modificar SSE streaming em server-enhanced.js
- [ ] APROVADO: Criar função extractFileContent() unificada
- [ ] APROVADO: Limite de 50k caracteres para arquivos
- [ ] APROVADO: Timeout de 10s para extração
- [ ] APROVADO: Graceful degradation (continua se extração falhar)

### Frontend
- [ ] APROVADO: Criar hook useFileUpload centralizado
- [ ] APROVADO: Modificar DashboardPage.tsx
- [ ] APROVADO: Modificar ChatPage.tsx
- [ ] APROVADO: Modificar UploadPage.tsx
- [ ] APROVADO: Modificar CaseProcessorPage.tsx
- [ ] APROVADO: Modificar CertidoesPage.tsx
- [ ] APROVADO: Atualizar tipos TypeScript em api.ts

### Estratégia
- [ ] APROVADO: Commits atômicos (1 mudança = 1 commit)
- [ ] APROVADO: Testes E2E obrigatórios antes de próximo commit
- [ ] APROVADO: Deploy em staging antes de produção
- [ ] APROVADO: Monitoramento de logs e métricas
- [ ] APROVADO: Rollback plan pré-definido

### Alterações aos Valores Padrão
- [ ] Mudar limite de 50k chars? Para quanto? __________
- [ ] Mudar timeout de 10s? Para quanto? __________
- [ ] Alguma modificação adicional? __________

---

## 🚦 DECISÃO FINAL

Marque UMA opção:

- [ ] ✅ **APROVADO PARA IMPLEMENTAÇÃO** - Pode prosseguir conforme planejado
- [ ] ⚠️ **APROVADO COM RESSALVAS** - Implementar mas com as seguintes mudanças:
  ```
  [Descreva mudanças aqui]
  ```
- [ ] ❌ **NÃO APROVADO** - Precisa replanejar porque:
  ```
  [Descreva motivos aqui]
  ```

---

**Data da Revisão:** __________
**Assinatura (nome):** __________
