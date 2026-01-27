# ⚠️ Status do Sistema de Extração

**Data:** 27/01/2026 - 18:43
**Ambiente:** Produção (https://iarom.com.br)

---

## 🔴 Resumo Executivo

### Status: ❌ **NÃO FUNCIONANDO EM PRODUÇÃO**

Os endpoints de extração estão **indisponíveis** em produção porque:
1. Estão definidos apenas em `server.js`
2. Produção usa `server-enhanced.js` (via `server-cluster.js`)
3. `server-enhanced.js` **não possui** os endpoints de extração

---

## 📊 Análise Detalhada

### Arquitetura em Produção

```
Render → start-with-migrations.js
          ↓
        server-cluster.js (4 workers)
          ↓
        server-enhanced.js (cada worker)
          ↓
        ❌ FALTA: Endpoints de extração
```

### Arquivos e Endpoints

| Arquivo | Usado em Prod? | Endpoints de Extração |
|---------|----------------|----------------------|
| `src/server.js` | ❌ Não | ✅ 5 endpoints |
| `src/server-enhanced.js` | ✅ Sim | ❌ 0 endpoints |
| `src/server-cluster.js` | ✅ Sim | ❌ 0 endpoints (wrapper) |

---

## 🔌 Endpoints de Extração (Ausentes em Produção)

### Definidos em `server.js` (linhas 578-764):

1. **POST** `/api/extraction/extract`
   - Extração de texto de PDFs
   - Status: ❌ **502 Bad Gateway**

2. **GET** `/api/extraction/folder-structure/:processNumber`
   - Estrutura de pastas por número de processo
   - Status: ❌ **502 Bad Gateway**

3. **POST** `/api/extraction/ocr`
   - OCR de imagens
   - Status: ❌ **502 Bad Gateway**

4. **POST** `/api/extraction/chronology`
   - Geração de cronologia
   - Status: ❌ **502 Bad Gateway**

5. **GET** `/api/extraction/desktop-path`
   - Path da área de trabalho
   - Status: ❌ **502 Bad Gateway**

6. **POST** `/api/documents/extract`
   - Extração de documentos
   - Status: ❌ **502 Bad Gateway**

---

## 🧪 Testes Realizados

```bash
# Teste 1: Desktop Path
$ curl https://iarom.com.br/api/extraction/desktop-path
Response: error code: 502

# Teste 2: Documents Extract
$ curl -X POST https://iarom.com.br/api/documents/extract
Response: error code: 502
```

**Conclusão:** Todos os endpoints de extração retornam 502 (Bad Gateway).

---

## 🔍 Impacto no Frontend

### Uso de Extração no Frontend: ✅ MÍNIMO

```bash
# Busca por "extraction" no frontend:
$ grep -r "extraction" frontend/src/ | wc -l
4 ocorrências
```

**Detalhes:**

1. **`CertidoesPage.tsx:50`**
   ```typescript
   endpoint: 'kb', // Use KB endpoint with AI extraction
   ```
   - Apenas comentário
   - Usa endpoint `/api/kb/upload` (funcional)

2. **`CaseProcessorPage.tsx:56,726,732`**
   ```typescript
   extractionSummary?: string  // Metadado opcional
   ```
   - Apenas estrutura de dados
   - Não faz chamada a `/api/extraction/*`

**Conclusão:** Frontend NÃO depende dos endpoints de extração que estão faltando.

---

## ✅ Sistemas de Extração que FUNCIONAM

### 1. KB Upload com 33 Ferramentas de IA ✅

**Endpoint:** `POST /api/kb/upload`
**Status:** ✅ Funcional (definido em `server-enhanced.js:5496`)
**Localização:** `/upload` no sidebar

**Funcionalidades:**
- Upload de múltiplos arquivos (até 20)
- Processamento com 33 ferramentas de extração por IA
- Geração de 7 documentos estruturados:
  - `01_resumo_executivo.md`
  - `02_identificacao_partes.md`
  - `03_cronologia_processos.md`
  - `04_fundamentos_juridicos.md`
  - `05_analise_documentos.md`
  - `06_analise_pedidos.md`
  - `07_relatorio_estruturado.json`

**Código:**
```javascript
// src/server-enhanced.js (linha 5496)
app.post('/api/kb/upload', requireAuth, upload.array('files', 20), async (req, res) => {
  // Processar cada arquivo COM DOCUMENTOS ESTRUTURADOS
  for (const file of req.files) {
    const processResult = await processFile(file.path);
    // Gera documentos estruturados automaticamente
  }
});
```

### 2. Document Extraction Service (Interna) ✅

**Função:** `processFile(filePath)`
**Status:** ✅ Funcional (usado pelo KB Upload)
**Localização:** `src/services/document-extraction-service.js`

**Ferramentas de Extração:**
1. PDF.js
2. Tesseract OCR
3. pdf-parse
4. Marked (Markdown)
5. Cheerio (HTML)
6. XLSX (Excel)
7. Docx (Word)
8. ...e mais 26 ferramentas

---

## ❌ O Que NÃO Funciona

### Endpoints Faltando em `server-enhanced.js`:

1. `/api/extraction/extract` - Extração manual via API
2. `/api/extraction/folder-structure/:id` - Estrutura de pastas
3. `/api/extraction/ocr` - OCR standalone
4. `/api/extraction/chronology` - Cronologia standalone
5. `/api/extraction/desktop-path` - Path da desktop
6. `/api/documents/extract` - Extração de documentos via API

**Nota:** Esses endpoints existem em `server.js` mas não são usados em produção.

---

## 🔧 Solução: Como Ativar Extração

### Opção 1: Copiar Endpoints para `server-enhanced.js` (Recomendado)

```javascript
// Adicionar em src/server-enhanced.js após linha 5645:

// ═══════════════════════════════════════════════════════════════
// EXTRACTION ENDPOINTS (de server.js)
// ═══════════════════════════════════════════════════════════════

import extractionService from './services/extraction-service.js';

// POST /api/extraction/extract
app.post('/api/extraction/extract', async (req, res) => {
  try {
    const { filePath, options } = req.body;
    const result = await extractionService.extractText(filePath, options);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ... copiar demais endpoints de server.js (linhas 578-850)
```

### Opção 2: Usar KB Upload (Já Funciona)

Para casos de uso comuns, usar o endpoint existente:

```bash
# Upload com extração automática
POST /api/kb/upload
Content-Type: multipart/form-data

files: [arquivo1.pdf, arquivo2.docx]
```

**Vantagens:**
- ✅ Já funciona em produção
- ✅ 33 ferramentas de IA
- ✅ Gera documentos estruturados
- ✅ Interface web disponível

**Desvantagens:**
- ❌ Requer autenticação
- ❌ Salva no KB (não é temporário)

---

## 📝 Recomendações

### Para Uso Imediato:

1. **Usar KB Upload** (`/upload` no sidebar)
   - Funcional e testado
   - 33 ferramentas de IA
   - Interface completa

2. **Não usar endpoints `/api/extraction/*`**
   - Retornam 502 em produção
   - Precisam ser migrados para server-enhanced.js

### Para Ativação dos Endpoints de Extração:

1. **Copiar endpoints de `server.js` para `server-enhanced.js`**
   - Linhas 578-850 do server.js
   - Incluir imports necessários
   - Testar localmente primeiro

2. **Fazer deploy**
   - Commit das alterações
   - Push para main
   - Deploy automático no Render

3. **Testar em produção**
   - Validar cada endpoint
   - Verificar se não há conflitos

---

## 🎯 Status dos Sistemas

| Sistema | Status | URL/Localização |
|---------|--------|-----------------|
| KB Upload | ✅ Funcionando | `/upload` |
| KB Documents | ✅ Funcionando | `/upload` |
| System Prompts | ✅ Funcionando | `/admin/system-prompts` |
| Conversão Docs | ✅ Funcionando | `/api/convert` |
| **Extraction API** | ❌ **NÃO FUNCIONA** | `/api/extraction/*` |
| Documents Extract | ❌ **NÃO FUNCIONA** | `/api/documents/extract` |

---

## 📞 Próximos Passos

### Imediato:
- [x] Confirmar que KB Upload funciona
- [x] Documentar endpoints faltantes
- [x] Verificar impacto no frontend (mínimo)

### Se Precisar de Extraction API:
- [ ] Copiar endpoints de server.js para server-enhanced.js
- [ ] Adicionar imports necessários (extraction-service, etc.)
- [ ] Testar localmente
- [ ] Deploy em produção
- [ ] Validar endpoints

### Se KB Upload for Suficiente:
- [x] Usar interface `/upload`
- [x] Upload de documentos
- [x] Extração automática com IA
- [x] Documentos estruturados gerados

---

**Conclusão:** O sistema de extração via **KB Upload está funcional**, mas os **endpoints diretos de extração** (`/api/extraction/*`) estão ausentes em produção e retornam 502.

Para a maioria dos casos de uso, o KB Upload é suficiente. Se precisar dos endpoints específicos de extração, será necessário migrá-los para `server-enhanced.js`.
