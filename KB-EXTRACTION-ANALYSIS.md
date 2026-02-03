# Análise: Extração do KB e Leitura pelo Chat

**Data**: 2026-02-02
**Status**: ✅ Investigação Completa

---

## 📋 RESUMO EXECUTIVO

### Descoberta Principal
**OS ARQUIVOS DO KB ESTÃO SENDO CRIADOS, MAS NÃO ESTÃO SENDO LIDOS PELO CHAT**

A extração funciona perfeitamente e cria 101 arquivos estruturados no disco, mas **não existe mecanismo implementado para carregar esses arquivos no contexto do chat**.

---

## 🔍 EVIDÊNCIAS

### 1. Arquivos KB Existem e Estão Sendo Criados ✅

**Localização**: `data/knowledge-base/documents/`

**Quantidade**: 101 arquivos (verificado em 2026-02-02)

**Tipos de arquivos criados**:
- `.txt` - Texto completo extraído
- `.metadata.json` - Metadados do documento
- `_01_FICHAMENTO.md` - Fichamento estruturado
- `_02_INDICE_CRONOLOGICO.md` - Índice cronológico
- `_03_INDICE_POR_TIPO.md` - Índice por tipo de peça
- `_04_ENTIDADES.json` - Entidades identificadas
- `_05_ANALISE_PEDIDOS.md` - Análise de pedidos
- `_06_FATOS_RELEVANTES.md` - Fatos relevantes extraídos
- `_07_LEGISLACAO_CITADA.md` - Legislação citada

**Exemplo de arquivo**:
```
📄 1766034003590_test.txt (375 bytes)
📄 1766034003590_test.metadata.json (2.293 bytes)
📄 1766034003593_test_01_FICHAMENTO.md (968 bytes)
... (mais 7 arquivos processados)
```

**Módulo Responsável**: `src/modules/knowledgeBase.js`
- `uploadToKnowledgeBase()` - linhas 26-105
- Chamado por: `src/services/document-extraction-service.js` (linhas 559, 567)

---

### 2. Fluxo de Extração e Storage (FUNCIONANDO) ✅

```
1. Upload de Arquivo
   ↓
   POST /api/upload
   ↓
2. Extração de Texto
   ↓
   textract.js → extractTextFromPDF()
   ↓
3. Processamento Estruturado
   ↓
   document-extraction-service.js → extractGeneralDocuments()
   - Gera 7 documentos estruturados
   ↓
4. Upload para KB
   ↓
   knowledgeBase.js → uploadToKnowledgeBase()
   ↓
5. Salvar no Disco
   ↓
   data/knowledge-base/documents/
   - {timestamp}_{filename}.txt
   - {timestamp}_{filename}.metadata.json
   - {timestamp}_{filename}_{type}.md
```

**Status**: ✅ FUNCIONANDO - Arquivos sendo criados corretamente

---

### 3. Fluxo de Chat e Leitura do KB (NÃO IMPLEMENTADO) ❌

```
1. Usuário envia mensagem
   ↓
   POST /api/chat/stream
   {
     message: "Analise o processo XYZ",
     kbContext: ""  ← VAZIO!
   }
   ↓
2. Chat Stream Route
   ↓
   src/routes/chat-stream.js (linha 105)
   - Recebe kbContext do request body
   - kbContext = '' (vazio)
   ↓
3. Bedrock Streaming
   ↓
   src/modules/bedrock.js → conversarStream()
   - Linha 242: recebe kbContext = ''
   - Linha 276: finalPrompt = prompt + '\n\n' + kbContext
   - Como kbContext = '', não adiciona nada ao prompt
   ↓
4. Claude recebe prompt SEM contexto do KB
   ↓
   Resultado: Chat não tem acesso aos arquivos extraídos
```

**Status**: ❌ NÃO IMPLEMENTADO - kbContext sempre vazio

---

## 🔬 ANÁLISE TÉCNICA DETALHADA

### Código Relevante - Chat Stream

**src/routes/chat-stream.js** (linhas 92-108):
```javascript
router.post('/stream', async (req, res) => {
  const {
    message,
    modelo,
    systemPrompt,
    historico = [],
    kbContext = '',  // ← Vem vazio do frontend
    maxTokens,
    temperature
  } = req.body;

  // ...

  const resultado = await conversarStream(message, onChunk, {
    modelo: selectedModel,
    systemPrompt: finalSystemPrompt,
    historico: limitedHistory,
    kbContext,  // ← Passa vazio para bedrock.js
    maxTokens,
    temperature
  });
```

### Código Relevante - Bedrock Stream

**src/modules/bedrock.js** (linhas 240-276):
```javascript
export async function conversarStream(userMessage, onChunk, options = {}) {
  const {
    modelo = CONFIG.defaultModel,
    systemPrompt = 'Você é um assistente jurídico...',
    historico = [],
    kbContext = '',  // ← NOVO: contexto do KB (mas vem vazio)
    maxTokens,
    temperature = CONFIG.temperature,
    enableTools = false
  } = options;

  // ...

  // 🔥 CONCATENAR KB CONTEXT DEPOIS DO TRUNCAMENTO
  const finalPrompt = kbContext ? prompt + '\n\n' + kbContext : prompt;
  //                  ↑ kbContext = '', então finalPrompt = prompt (sem KB)
```

### Frontend - NÃO Envia KB Context

**Busca realizada**:
```bash
grep -r "kbContext\|knowledgeBase\|loadKB\|getKB" frontend/src
# Resultado: NO FILES FOUND
```

**Conclusão**: O frontend NÃO tem código para:
1. Buscar arquivos do KB
2. Carregar contexto do KB
3. Enviar kbContext no request

---

## 🚨 PROBLEMA IDENTIFICADO

### Gap Crítico: Falta Integração KB → Chat

**O que EXISTE**:
1. ✅ Sistema de extração funcionando
2. ✅ Arquivos sendo salvos no disco (101 arquivos)
3. ✅ Metadados estruturados
4. ✅ Múltiplos formatos de documentos processados
5. ✅ Parâmetro `kbContext` implementado em chat-stream e bedrock

**O que NÃO EXISTE**:
1. ❌ Mecanismo para buscar arquivos do KB
2. ❌ Lógica para carregar contexto relevante
3. ❌ Filtro/busca por processo, data, tipo
4. ❌ Injeção do KB context no prompt
5. ❌ UI no frontend para selecionar documentos do KB

---

## 📊 DOIS SISTEMAS KB IDENTIFICADOS

### Sistema 1: knowledge-base/documents/ (ATIVO)

**Módulo**: `src/modules/knowledgeBase.js`
**Diretório**: `data/knowledge-base/documents/`
**Status**: ✅ FUNCIONANDO - Arquivos sendo criados

**Funções disponíveis**:
- `uploadToKnowledgeBase(options)` - Upload de arquivos
- `searchKnowledgeBase(options)` - Buscar documentos (NÃO USADA!)
- `deleteFromKnowledgeBase(documentId)` - Deletar documento
- `getKnowledgeBaseStats(projectName)` - Estatísticas

**IMPORTANTE**: `searchKnowledgeBase()` EXISTE mas NÃO é chamada pelo chat!

### Sistema 2: rom-project/kb/uploads/ (CONFIGURADO, NÃO ATIVO)

**Módulo**: `src/routes/rom-project.js`
**Diretório**: `data/rom-project/kb/uploads/`
**Status**: ⚠️ CONFIGURADO mas diretório não existe

**Configuração multer**:
```javascript
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const kbPath = path.join(__dirname, '../../data/rom-project/kb/uploads');
    cb(null, kbPath);
  }
});
```

**Service method**:
```javascript
async addToKnowledgeBase(projectName, files, category) {
  // TODO: Implementar registro de arquivos no KB
  console.log(`Arquivos adicionados ao KB...`);
  return { success: true, files };
}
```

Status: ❌ TODO stub - não implementado

---

## 🔧 O QUE PRECISA SER IMPLEMENTADO

### Opção 1: Implementação Manual (Contexto Explícito)

**Fluxo**:
1. Usuário seleciona documentos do KB na UI
2. Frontend carrega conteúdo via API
3. Frontend envia `kbContext` preenchido no request
4. Chat usa o contexto fornecido

**Vantagens**:
- Controle total do usuário
- Não sobrecarrega contexto desnecessariamente

**Desvantagens**:
- Requer UI adicional
- Usuário precisa saber quais docs são relevantes

### Opção 2: Implementação Automática (Busca Inteligente)

**Fluxo**:
1. Usuário envia mensagem
2. Backend detecta menção a processo/caso
3. Backend busca automaticamente no KB via `searchKnowledgeBase()`
4. Backend carrega contexto relevante
5. Backend injeta kbContext no prompt
6. Chat tem contexto automaticamente

**Vantagens**:
- Transparente para o usuário
- Contexto sempre relevante

**Desvantagens**:
- Lógica de busca inteligente necessária
- Pode aumentar latência

### Opção 3: Híbrida (Automática + Manual)

**Fluxo**:
1. Backend tenta buscar automaticamente (processo mencionado?)
2. Se encontrar, carrega automaticamente
3. Se não encontrar, UI permite seleção manual
4. Usuário pode adicionar/remover documentos

**Vantagens**:
- Melhor UX
- Flexibilidade máxima

**Desvantagens**:
- Mais complexo de implementar

---

## 📝 EXEMPLO DE IMPLEMENTAÇÃO (Opção 2 - Automática)

### Passo 1: Criar Middleware de KB Loading

**src/middleware/kb-loader.js** (CRIAR):
```javascript
import { searchKnowledgeBase } from '../modules/knowledgeBase.js';
import { manageMultiDocumentContext, formatContextForPrompt } from '../utils/context-manager.js';

export async function loadKBContext(req, res, next) {
  const { message, conversationId } = req.body;

  try {
    // Detectar número de processo na mensagem
    const processoMatch = message.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);

    if (processoMatch) {
      const processNumber = processoMatch[0];

      // Buscar documentos relacionados
      const documents = await searchKnowledgeBase({
        projectName: req.user?.partnerId || 'ROM',
        processNumber
      });

      if (documents.length > 0) {
        // Gerenciar contexto com budget de tokens
        const managedContext = manageMultiDocumentContext(
          documents,
          message,
          req.body.model || 'claude-sonnet-4.5'
        );

        // Formatar para prompt
        const kbContext = formatContextForPrompt(managedContext);

        // Adicionar ao request
        req.body.kbContext = kbContext;

        console.log(`✅ KB Context loaded: ${documents.length} docs, ${managedContext.stats.totalTokens} tokens`);
      }
    }

    next();
  } catch (error) {
    console.error('❌ Erro ao carregar KB context:', error);
    next(); // Continuar mesmo se falhar
  }
}
```

### Passo 2: Integrar no Chat Stream

**src/routes/chat-stream.js** (MODIFICAR linha ~92):
```javascript
import { loadKBContext } from '../middleware/kb-loader.js';

// Aplicar middleware ANTES do handler
router.post('/stream', loadKBContext, async (req, res) => {
  // ... resto do código permanece igual
  // req.body.kbContext agora está preenchido se houver docs relevantes
```

### Passo 3: Testar

```bash
# Enviar mensagem mencionando processo
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Analise o processo 1234567-89.2024.8.13.0024 e me diga o status",
    "model": "claude-sonnet-4.5"
  }'

# Logs esperados:
# ✅ KB Context loaded: 8 docs, 15234 tokens
# [PromptBuilder] KB context: 15234 tokens
# [Bedrock] Final prompt: 18500 tokens
```

---

## ⚙️ TESTES DE VALIDAÇÃO

### Teste 1: Verificar Arquivos KB Existem
```bash
ls -la data/knowledge-base/documents/ | wc -l
# Esperado: ~101 linhas (arquivos + diretório)
```
✅ **PASSOU**: 101 arquivos encontrados

### Teste 2: Verificar Metadata
```bash
cat data/knowledge-base/documents/1766034003590_test.metadata.json
```
✅ **PASSOU**: Metadata válido com estrutura correta

### Teste 3: Verificar searchKnowledgeBase() Funciona
```javascript
import { searchKnowledgeBase } from './src/modules/knowledgeBase.js';

const results = await searchKnowledgeBase({
  projectName: 'ROM',
  type: 'document-extraction'
});

console.log(`Encontrados: ${results.length} documentos`);
```
⚠️ **NÃO TESTADO** (função existe mas nunca foi chamada)

### Teste 4: Verificar kbContext Chega Vazio
```javascript
// Em src/routes/chat-stream.js, adicionar log temporário:
console.log('[DEBUG] kbContext recebido:', kbContext?.length || 0);
```
✅ **CONFIRMADO**: kbContext = '' (0 caracteres)

---

## 📚 ARQUIVOS RELEVANTES

### Backend - KB Storage
- `src/modules/knowledgeBase.js` - Módulo principal KB (248 linhas)
- `src/services/document-extraction-service.js` - Extração e upload (623 linhas)
- `src/routes/rom-project.js` - Rotas ROM Project (579 linhas)
- `src/utils/context-manager.js` - Gerenciamento de contexto (430 linhas)

### Backend - Chat Integration
- `src/routes/chat-stream.js` - Streaming SSE (400+ linhas)
- `src/modules/bedrock.js` - AWS Bedrock integration (1500+ linhas)
- `src/server-enhanced.js` - buildSystemPrompt (1300+ linhas)

### Frontend - Chat UI
- `frontend/src/services/api.ts` - API client (300+ linhas)
- (Nenhum arquivo relacionado a KB encontrado)

---

## 🎯 RECOMENDAÇÕES

### Curto Prazo (Implementação Rápida)

1. **Criar middleware loadKBContext** conforme exemplo acima
2. **Integrar no chat-stream.js** antes do handler
3. **Testar com processo real** que tenha documentos no KB
4. **Validar que contexto está sendo injetado** no prompt

**Tempo estimado**: 2-4 horas

### Médio Prazo (UX Melhorada)

1. **Criar endpoint GET /api/kb/search** para busca manual
2. **Adicionar UI no frontend** para selecionar documentos
3. **Implementar preview de documentos** do KB
4. **Adicionar filtros** (data, tipo, processo, autor)

**Tempo estimado**: 1-2 dias

### Longo Prazo (Sistema Completo)

1. **Implementar busca semântica** com embeddings
2. **Adicionar ranking de relevância** baseado em conteúdo
3. **Cache inteligente** de contextos frequentes
4. **Analytics de uso** do KB
5. **Auto-indexação** de novos documentos

**Tempo estimado**: 1-2 semanas

---

## 🔐 SEGURANÇA

### Controle de Acesso

**CRÍTICO**: Verificar permissões antes de carregar KB context

```javascript
// Em kb-loader.js
export async function loadKBContext(req, res, next) {
  // Verificar se usuário tem acesso ao projeto
  const userPartnerId = req.user?.partnerId;

  const documents = await searchKnowledgeBase({
    projectName: userPartnerId  // ← Filtrar por parceiro do usuário
  });

  // ...
}
```

**Regras**:
- master_admin: Acesso a todos os KBs
- partner_admin: Acesso apenas ao KB do próprio escritório
- user: Acesso apenas ao KB do próprio escritório (read-only?)

---

## 📈 MÉTRICAS PROPOSTAS

### Monitoramento de KB Usage

```javascript
// Adicionar em metrics-collector
export const kbMetrics = {
  documentsLoaded: 0,
  tokensLoaded: 0,
  queriesWithKB: 0,
  averageDocsPerQuery: 0
};

// Registrar quando KB é carregado
metricsCollector.recordKBUsage({
  documentsCount: documents.length,
  tokensUsed: managedContext.stats.totalTokens,
  processNumber,
  userId: req.user.id
});
```

---

## 🔄 FLUXO COMPLETO APÓS IMPLEMENTAÇÃO

```
┌─────────────────────────────────────────────────────────────┐
│                     FLUXO ATUALIZADO                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Usuário: "Analise o processo 1234567-89.2024..."       │
│     ↓                                                        │
│  2. POST /api/chat/stream                                   │
│     ↓                                                        │
│  3. ✅ NOVO: Middleware loadKBContext                       │
│     - Detecta número do processo                            │
│     - Busca no KB: searchKnowledgeBase()                    │
│     - Encontra 8 documentos relevantes                      │
│     - Gerencia contexto: manageMultiDocumentContext()       │
│     - Formata para prompt: formatContextForPrompt()         │
│     - Injeta em req.body.kbContext                          │
│     ↓                                                        │
│  4. Chat Stream Handler                                     │
│     - Recebe kbContext preenchido                           │
│     - Passa para conversarStream()                          │
│     ↓                                                        │
│  5. Bedrock conversarStream()                               │
│     - Concatena: finalPrompt = prompt + '\n\n' + kbContext  │
│     - Envia para Claude com contexto do KB                  │
│     ↓                                                        │
│  6. Claude analisa com contexto completo                    │
│     - Tem acesso aos 8 documentos do processo               │
│     - FICHAMENTO, CRONOLOGIA, ENTIDADES, etc.               │
│     - Resposta informada e precisa                          │
│     ↓                                                        │
│  7. Streaming de resposta para o usuário                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ CONCLUSÃO

### Status Atual
- ✅ **Extração**: FUNCIONANDO - 101 arquivos criados
- ❌ **Leitura**: NÃO IMPLEMENTADA - arquivos não são lidos

### Gap Identificado
**Falta implementar o carregamento dos arquivos KB no contexto do chat**

### Solução Proposta
**Middleware loadKBContext** que:
1. Detecta processo mencionado
2. Busca documentos no KB
3. Carrega contexto relevante
4. Injeta no prompt automaticamente

### Próximo Passo
Implementar middleware conforme exemplo acima e testar com processo real.

---

**Última Atualização**: 2026-02-02
**Investigado por**: Claude Code
**Status**: ✅ Análise Completa - Pronto para Implementação
