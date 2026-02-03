# Análise Refinada: Extração KB e Acesso aos Ficheiros

**Data**: 2026-02-02
**Status**: ✅ Análise Completa e Corrigida

---

## 📋 RESUMO EXECUTIVO

### Descoberta Principal (CORRIGIDA)

O sistema possui **DOIS FLUXOS DISTINTOS**:

1. **✅ FUNCIONANDO**: Extração de arquivos anexados e adição ao contexto do chat
2. **⚠️ PARCIALMENTE IMPLEMENTADO**: Criação de ficheiros estruturados no KB, mas sem acesso posterior

---

## 🔄 FLUXO 1: Anexação de Arquivos → Chat (FUNCIONANDO) ✅

### Como Funciona Atualmente

```
1. Usuário anexa PDF no chat
   ↓
2. Frontend envia attachedFiles: [{id, name, path, type}]
   ↓
3. POST /api/chat (server-enhanced.js, linha 2513)
   ↓
4. Extração em paralelo (Promise.allSettled)
   - extractDocument(file.path)
   - Usa textract ou outros métodos
   ↓
5. Construção do contexto (linha 2600-2615)
   - extractedContext = '\n\n# DOCUMENTOS ANEXADOS\n' + content
   ↓
6. Concatenação ao prompt (linha 2659)
   - finalMessage = extractedContext + message + kbContext
   ↓
7. Chat recebe contexto completo com PDF extraído
   ✅ FUNCIONANDO
```

**Código Relevante** (`src/server-enhanced.js`, linhas 2513-2659):

```javascript
if (attachedFiles && Array.isArray(attachedFiles) && attachedFiles.length > 0) {
  // Processar arquivos em paralelo
  const extractionPromises = attachedFiles.map(async (file, index) => {
    // Extrair documento
    const result = await extractDocument(file.path);

    return {
      success: true,
      fileName: file.name,
      content: result.text,
      charCount: result.text?.length || 0
    };
  });

  // Aguardar extrações
  const results = await Promise.allSettled(extractionPromises);

  // Construir contexto
  if (successfulExtractions.length > 0) {
    const contextParts = successfulExtractions.map(ext => {
      return `\n\n---\n📄 **Arquivo: ${ext.fileName}**\n---\n\n${ext.content}`;
    });

    extractedContext = '\n\n# DOCUMENTOS ANEXADOS\n' + contextParts.join('\n');
  }
}

// Construir prompt final
const finalMessage = extractedContext + '\n\n' + message + (kbContext || '');
```

**Resultado**: Chat TEM acesso ao conteúdo bruto extraído do PDF ✅

---

## 🔄 FLUXO 2: Criação de Ficheiros Estruturados no KB (PARCIAL) ⚠️

### O Que Está Sendo Criado

Quando um documento é processado, o sistema cria **7 ficheiros estruturados**:

1. `01_FICHAMENTO.md` - Fichamento jurídico completo
2. `02_INDICE_CRONOLOGICO.md` - Índice cronológico de eventos
3. `03_INDICE_POR_TIPO.md` - Índice por tipo de peça
4. `04_ENTIDADES.json` - Entidades identificadas (partes, advogados, etc.)
5. `05_ANALISE_PEDIDOS.md` - Análise dos pedidos
6. `06_FATOS_RELEVANTES.md` - Fatos relevantes extraídos
7. `07_LEGISLACAO_CITADA.md` - Legislação citada no documento

**Localização**: `data/knowledge-base/documents/`

**Verificado**: 101 arquivos existem no diretório ✅

**Exemplo de Fichamento**:
```bash
$ cat data/knowledge-base/documents/1766034003593_test_01_FICHAMENTO.md
# FICHAMENTO JURÍDICO

## Identificação
- Processo: 1234567-89.2024.8.13.0024
- Tipo: Petição Inicial
- Autor: João Silva
- Réu: Maria Santos

## Resumo
Ação de indenização por danos morais...

## Pedidos
1. Condenação do réu ao pagamento de R$ 50.000,00
2. Custas e honorários advocatícios

## Fundamentação Legal
- Art. 927, CC
- Art. 186, CC
```

### O Que NÃO Está Funcionando

**❌ Esses ficheiros NÃO são carregados automaticamente no contexto do chat**

Quando o usuário pergunta sobre o processo posteriormente (em nova conversa), o chat **NÃO acessa** os ficheiros estruturados salvos no KB.

---

## 🔬 ANÁLISE TÉCNICA: Por Que os Ficheiros Não São Acessados?

### 1. Ficheiros São Criados Apenas Durante Upload Inicial

**Código**: `src/services/document-extraction-service.js` (linhas 559-572)

```javascript
// Upload do documento completo JSON
await uploadToKnowledgeBase({
  projectName,
  fileName: `${folderName}-completo.json`,
  content: JSON.stringify(documentoCompleto, null, 2),
  type: 'document-extraction'
});

// Upload do documento completo TXT
await uploadToKnowledgeBase({
  projectName,
  fileName: `${folderName}-completo.txt`,
  content: documentoCompleto.fullText,
  type: 'document-extraction-text'
});
```

**Quando Isso Acontece?**
- Durante o processamento do Case Processor
- Apenas se `uploadToKB = true` for passado
- **NÃO acontece durante upload via chat normal**

### 2. searchKnowledgeBase() Existe Mas Não É Chamada

**Código**: `src/modules/knowledgeBase.js` (linhas 115-164)

```javascript
export async function searchKnowledgeBase(options) {
  const { projectName, processNumber, type } = options;

  // Listar arquivos de metadados
  const files = await fs.readdir(projectDir);
  const metadataFiles = files.filter(f => f.endsWith('.metadata.json'));

  const results = [];

  for (const metaFile of metadataFiles) {
    const metadata = JSON.parse(await fs.readFile(metaPath, 'utf-8'));

    // Filtrar por critérios
    if (processNumber && metadata.processNumber !== processNumber) continue;
    if (type && metadata.type !== type) continue;

    // Ler conteúdo do documento
    const content = await fs.readFile(docPath, 'utf-8');
    results.push({ ...metadata, content });
  }

  return results;
}
```

**Problema**: Esta função NUNCA é chamada pelo chat! ❌

**Busca Realizada**:
```bash
grep -r "searchKnowledgeBase" src/
# Resultado: Apenas a definição da função, nenhuma chamada
```

### 3. Fluxo de Chat Não Integra com KB

**Quando usuário pergunta**: "Me fale sobre o processo 1234567-89.2024.8.13.0024"

**O que acontece**:
1. Chat recebe mensagem
2. NÃO busca no KB
3. NÃO carrega fichamento/índices
4. Responde SEM contexto estruturado
5. Resposta genérica ou "não tenho informações"

**O que DEVERIA acontecer**:
1. Chat recebe mensagem
2. Detecta número do processo
3. **Busca no KB**: `searchKnowledgeBase({ processNumber })`
4. **Carrega ficheiros estruturados**
5. Responde COM contexto: fichamento, cronologia, pedidos, etc.

---

## 📊 DIFERENÇA ENTRE OS DOIS FLUXOS

### Fluxo 1: Anexação em Tempo Real ✅

**Quando**: Usuário anexa arquivo E envia mensagem simultaneamente

**O que vai para o chat**:
- ✅ Texto bruto extraído do PDF (via textract)
- ❌ Fichamento estruturado
- ❌ Índice cronológico
- ❌ Análise de pedidos
- ❌ Entidades identificadas

**Limite**: Apenas a extração RAW, sem processamento estruturado

### Fluxo 2: Ficheiros Estruturados no KB ⚠️

**Quando**: Documento é processado via Case Processor

**O que é salvo no KB**:
- ✅ Texto completo
- ✅ Fichamento estruturado
- ✅ Índice cronológico
- ✅ Análise de pedidos
- ✅ Entidades identificadas
- ✅ Legislação citada
- ✅ Fatos relevantes

**Problema**: Estes ficheiros **NÃO são carregados** em conversas posteriores ❌

---

## 🚨 GAP CRÍTICO IDENTIFICADO

### O Que Falta

**Integração: KB → Chat em Conversas Posteriores**

Cenário atual:
```
Dia 1:
1. Usuário faz upload do processo.pdf
2. Sistema extrae e SALVA 7 ficheiros estruturados no KB ✅
3. Chat usa apenas extração bruta ✅

Dia 2:
1. Usuário pergunta: "Me mostre a cronologia do processo X"
2. Chat NÃO acessa os ficheiros do KB ❌
3. Chat responde sem contexto estruturado ❌
```

**Resultado**: Os ficheiros estruturados existem no disco mas ficam "mortos" - nunca são utilizados ❌

---

## 🔧 SOLUÇÃO PROPOSTA

### Implementar Middleware de KB Loading

**Objetivo**: Carregar automaticamente ficheiros estruturados quando processo é mencionado

**Implementação**: `src/middleware/kb-loader.js` (NOVO)

```javascript
import { searchKnowledgeBase } from '../modules/knowledgeBase.js';
import { manageMultiDocumentContext, formatContextForPrompt } from '../utils/context-manager.js';
import fs from 'fs/promises';
import path from 'path';

export async function loadStructuredFilesFromKB(req, res, next) {
  const { message } = req.body;

  try {
    // Detectar número de processo
    const processoMatch = message.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);

    if (processoMatch) {
      const processNumber = processoMatch[0];
      const partnerId = req.user?.partnerId || 'ROM';

      console.log(`🔍 [KB] Detectado processo ${processNumber}, buscando ficheiros...`);

      // Buscar documentos no KB
      const kbDocs = await searchKnowledgeBase({
        projectName: partnerId,
        processNumber
      });

      if (kbDocs.length > 0) {
        console.log(`✅ [KB] Encontrados ${kbDocs.length} documentos`);

        // Carregar ficheiros estruturados do metadata
        const structuredFiles = [];

        for (const doc of kbDocs) {
          // Verificar se há ficheiros estruturados
          if (doc.metadata?.structuredDocsInKB) {
            for (const structFile of doc.metadata.structuredDocsInKB) {
              try {
                const content = await fs.readFile(structFile.path, 'utf-8');
                structuredFiles.push({
                  name: structFile.name,
                  type: structFile.type,
                  content
                });
              } catch (err) {
                console.warn(`⚠️ [KB] Não foi possível ler ${structFile.name}:`, err.message);
              }
            }
          }
        }

        // Se encontrou ficheiros estruturados, adicionar ao contexto
        if (structuredFiles.length > 0) {
          const kbContext = formatStructuredFilesContext(structuredFiles, processNumber);

          // Adicionar ao request
          req.body.kbContext = (req.body.kbContext || '') + '\n\n' + kbContext;

          console.log(`✅ [KB] ${structuredFiles.length} ficheiros estruturados carregados`);
          console.log(`   - FICHAMENTO: ${structuredFiles.find(f => f.name.includes('FICHAMENTO')) ? 'Sim' : 'Não'}`);
          console.log(`   - CRONOLOGIA: ${structuredFiles.find(f => f.name.includes('CRONOLOGICO')) ? 'Sim' : 'Não'}`);
          console.log(`   - PEDIDOS: ${structuredFiles.find(f => f.name.includes('PEDIDOS')) ? 'Sim' : 'Não'}`);
        }
      }
    }

    next();
  } catch (error) {
    console.error('❌ [KB] Erro ao carregar ficheiros:', error);
    next(); // Continuar mesmo se falhar
  }
}

function formatStructuredFilesContext(files, processNumber) {
  let context = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  context += `📚 FICHEIROS ESTRUTURADOS DO KB - Processo ${processNumber}\n`;
  context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const order = ['FICHAMENTO', 'CRONOLOGICO', 'TIPO', 'ENTIDADES', 'PEDIDOS', 'RELEVANTES', 'LEGISLACAO'];

  // Ordenar ficheiros pela sequência lógica
  const sortedFiles = files.sort((a, b) => {
    const aIndex = order.findIndex(o => a.name.toUpperCase().includes(o));
    const bIndex = order.findIndex(o => b.name.toUpperCase().includes(o));
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  sortedFiles.forEach((file, i) => {
    context += `\n### 📄 ${i + 1}. ${file.name}\n\n`;
    context += `${file.content}\n\n`;
    context += `---\n\n`;
  });

  context += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  context += `✅ Total de ficheiros carregados: ${files.length}\n`;
  context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  return context;
}
```

### Integração no Chat

**Modificar**: `src/server-enhanced.js` (linha ~2400)

```javascript
import { loadStructuredFilesFromKB } from './middleware/kb-loader.js';

// Adicionar ANTES do handler de chat
app.post('/chat', requireAuth, loadStructuredFilesFromKB, async (req, res) => {
  // ... resto do código permanece igual
  // req.body.kbContext agora contém ficheiros estruturados se houver
});
```

---

## ✅ VALIDAÇÃO DA SOLUÇÃO

### Teste 1: Upload e Criação de Ficheiros

```bash
# Fazer upload de processo.pdf
curl -X POST http://localhost:3000/api/upload \
  -F "file=@processo.pdf" \
  -F "processNumber=1234567-89.2024.8.13.0024"

# Verificar criação de ficheiros
ls -la data/knowledge-base/documents/ | grep 1234567

# Esperado:
# - {timestamp}_processo.txt
# - {timestamp}_processo.metadata.json
# - {timestamp}_processo_01_FICHAMENTO.md
# - {timestamp}_processo_02_INDICE_CRONOLOGICO.md
# ... (mais 5 ficheiros)
```

✅ **PASSOU**: Ficheiros sendo criados corretamente

### Teste 2: Busca Manual no KB

```javascript
import { searchKnowledgeBase } from './src/modules/knowledgeBase.js';

const results = await searchKnowledgeBase({
  projectName: 'ROM',
  processNumber: '1234567-89.2024.8.13.0024'
});

console.log(`Encontrados: ${results.length} documentos`);
console.log(`Metadata:`, results[0]?.metadata);
```

⚠️ **AGUARDANDO IMPLEMENTAÇÃO**: Precisa testar após criar middleware

### Teste 3: Chat com Ficheiros Carregados

```bash
# Enviar mensagem mencionando processo
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Me mostre a cronologia do processo 1234567-89.2024.8.13.0024"
  }'

# Logs esperados:
# 🔍 [KB] Detectado processo 1234567-89.2024.8.13.0024
# ✅ [KB] Encontrados 8 documentos
# ✅ [KB] 7 ficheiros estruturados carregados
#    - FICHAMENTO: Sim
#    - CRONOLOGIA: Sim
#    - PEDIDOS: Sim

# Resposta esperada:
# "Com base no fichamento e cronologia do processo, aqui está o histórico:
#
# ## Cronologia do Processo 1234567-89.2024.8.13.0024
#
# 1. **18/12/2024** - Petição inicial distribuída
# 2. **20/12/2024** - Despacho inicial
# 3. **05/01/2025** - Citação do réu
# ..."
```

⚠️ **AGUARDANDO IMPLEMENTAÇÃO**

---

## 📈 BENEFÍCIOS DA IMPLEMENTAÇÃO

### Antes (Situação Atual)

```
Usuário: "Me mostre a cronologia do processo X"

Chat:
❌ Não tem acesso à cronologia estruturada
❌ Responde de forma genérica
❌ Usuário precisa reanexar o arquivo
```

### Depois (Com Middleware KB)

```
Usuário: "Me mostre a cronologia do processo X"

Chat:
✅ Detecta número do processo
✅ Busca automaticamente no KB
✅ Carrega INDICE_CRONOLOGICO.md
✅ Responde com cronologia estruturada completa
✅ Usuário recebe resposta precisa instantaneamente
```

### Impacto

- **UX**: Melhoria dramática - não precisa reanexar arquivos
- **Performance**: Reutilização de ficheiros já processados
- **Custo**: Zero - ficheiros locais, sem custos de IA
- **Precisão**: Máxima - usa fichamento estruturado, não RAW
- **Memória**: Chat "lembra" de processos anteriores

---

## 📚 RESUMO FINAL

### O Que ESTÁ Funcionando ✅

1. **Extração de anexos em tempo real**
   - Arquivos PDF anexados são extraídos
   - Conteúdo bruto vai para o contexto do chat
   - Chat consegue analisar o processo DURANTE o upload

2. **Criação de ficheiros estruturados**
   - 7 ficheiros estruturados são criados
   - Salvos em `data/knowledge-base/documents/`
   - Metadata inclui paths dos ficheiros

### O Que NÃO Está Funcionando ❌

1. **Acesso aos ficheiros estruturados em conversas posteriores**
   - Ficheiros existem no disco
   - MAS chat não os acessa automaticamente
   - Quando usuário pergunta sobre processo antigo, chat não "lembra"

### Solução ✅

**Implementar middleware `loadStructuredFilesFromKB`** que:
1. Detecta menção a processo na mensagem
2. Busca ficheiros no KB via `searchKnowledgeBase()`
3. Carrega FICHAMENTO, CRONOLOGIA, PEDIDOS, etc.
4. Adiciona ao kbContext automaticamente
5. Chat responde com contexto estruturado completo

---

**Última Atualização**: 2026-02-02
**Investigado por**: Claude Code
**Status**: ✅ Análise Completa - Middleware Proposto
