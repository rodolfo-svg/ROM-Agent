# Teste do Middleware KB Loader

## Status: ✅ Implementado

### Arquivos Criados/Modificados

1. **✅ CRIADO**: `src/middleware/kb-loader.js`
   - Middleware completo de 230 linhas
   - Detecta números de processo via regex CNJ
   - Busca automaticamente no KB via `searchKnowledgeBase()`
   - Carrega ficheiros estruturados (FICHAMENTO, CRONOLOGIA, etc.)
   - Formata contexto e injeta em `req.body.kbContext`

2. **✅ MODIFICADO**: `src/server-enhanced.js`
   - Linha 81: Importação do middleware
   - Linha 1631: Middleware adicionado em `/api/chat`
   - Linha 2384: Middleware adicionado em `/api/chat/stream`

---

## Como Testar

### Pré-requisitos

1. Certifique-se de que existe pelo menos um processo com ficheiros no KB:
```bash
ls -la data/knowledge-base/documents/ | grep -E "FICHAMENTO|CRONOLOGICO"
```

2. Verificar se há metadata com `structuredDocsInKB`:
```bash
cat data/knowledge-base/documents/*metadata.json | grep -A 5 structuredDocsInKB | head -20
```

### Teste 1: Chat Normal (Sem Processo)

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -d '{
    "message": "Olá, como você está?"
  }'
```

**Resultado Esperado**:
- Logs: "Nenhum processo detectado"
- Middleware passa sem fazer nada
- Chat funciona normalmente

### Teste 2: Chat com Número de Processo

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -d '{
    "message": "Me mostre a cronologia do processo 1234567-89.2024.8.13.0024"
  }'
```

**Resultado Esperado**:
```
Logs:
🔍 [KB Loader] Detectados 1 processo(s): [ '1234567-89.2024.8.13.0024' ]
✅ [KB Loader] Processo 1234567-89.2024.8.13.0024: 8 documento(s) encontrado(s)
   📄 Carregado: 01_FICHAMENTO.md
   📄 Carregado: 02_INDICE_CRONOLOGICO.md
   📄 Carregado: 03_INDICE_POR_TIPO.md
   📄 Carregado: 04_ENTIDADES.json
   📄 Carregado: 05_ANALISE_PEDIDOS.md
   📄 Carregado: 06_FATOS_RELEVANTES.md
   📄 Carregado: 07_LEGISLACAO_CITADA.md
✅ [KB Loader] 7 ficheiro(s) estruturado(s) carregado(s)
   Ficheiros disponíveis: {
     FICHAMENTO: true,
     CRONOLOGICO: true,
     TIPO: true,
     ENTIDADES: true,
     PEDIDOS: true,
     RELEVANTES: true,
     LEGISLACAO: true
   }
```

**Resposta do Chat**:
- Deve incluir informações da cronologia estruturada
- Deve mencionar datas e eventos específicos do índice cronológico
- Deve ser muito mais preciso e detalhado

### Teste 3: Streaming com Processo

```bash
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -d '{
    "message": "Analise os pedidos do processo 1234567-89.2024.8.13.0024",
    "model": "claude-sonnet-4.5"
  }'
```

**Resultado Esperado**:
- Mesmo comportamento do Teste 2
- Resposta em streaming SSE
- Análise detalhada dos pedidos extraídos

### Teste 4: Múltiplos Processos

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -d '{
    "message": "Compare os processos 1234567-89.2024.8.13.0024 e 7654321-10.2024.8.13.0100"
  }'
```

**Resultado Esperado**:
- Middleware detecta ambos os números
- Carrega ficheiros de ambos os processos
- Chat consegue comparar com contexto estruturado

---

## Verificação de Funcionamento

### 1. Verificar Logs do Servidor

```bash
# Iniciar servidor e monitorar logs
npm start | grep "KB Loader"
```

### 2. Verificar kbContext Está Sendo Injetado

Adicionar log temporário em `src/server-enhanced.js` após linha 2445:

```javascript
// Linha ~2450 (depois de parsing do request)
logger.info('🔍 DEBUG kbContext length:', req.body.kbContext?.length || 0);
```

**Se funcionar**:
- kbContext length > 0 quando processo é mencionado
- kbContext length = 0 quando processo NÃO é mencionado

### 3. Verificar Resposta do Chat

**Antes do middleware**:
```
User: "Me mostre a cronologia do processo X"
Chat: "Desculpe, não tenho informações sobre esse processo."
```

**Depois do middleware**:
```
User: "Me mostre a cronologia do processo X"
Chat: "Com base no índice cronológico do processo, aqui está a sequência de eventos:

1. 18/12/2024 - Petição inicial distribuída
2. 20/12/2024 - Despacho inicial
3. 05/01/2025 - Citação do réu
..."
```

---

## Troubleshooting

### Problema 1: Logs "Nenhum documento encontrado no KB"

**Causa**: metadata.json não tem campo `structuredDocsInKB`

**Solução**: Verificar estrutura do metadata:
```bash
cat data/knowledge-base/documents/*metadata.json | jq '.structuredDocsInKB'
```

Se estiver vazio/null, o upload não criou os ficheiros estruturados.

### Problema 2: Erro "Cannot read property 'structuredDocsInKB' of undefined"

**Causa**: searchKnowledgeBase() retornando docs sem metadata

**Solução**: Adicionar validação no middleware (já está implementada):
```javascript
if (doc.structuredDocsInKB && Array.isArray(doc.structuredDocsInKB))
```

### Problema 3: Ficheiros não sendo carregados

**Causa**: Paths dos ficheiros podem estar incorretos

**Solução**: Verificar paths no metadata:
```bash
cat data/knowledge-base/documents/*metadata.json | jq '.structuredDocsInKB[].path' | head -5
```

Paths devem ser absolutos e acessíveis.

### Problema 4: Middleware não está sendo chamado

**Causa**: Importação ou sintaxe incorreta

**Verificar**:
```bash
# Verificar sintaxe
node --check src/middleware/kb-loader.js

# Verificar importação
node -e "import('./src/middleware/kb-loader.js').then(m => console.log('OK:', Object.keys(m)))"
```

---

## Monitoramento em Produção

### Métricas Sugeridas

1. **KB Hits**: Quantas vezes o middleware carregou ficheiros
2. **Processos Únicos**: Quantos processos diferentes foram acessados
3. **Ficheiros Carregados**: Total de ficheiros carregados
4. **Tempo de Loading**: Latência do middleware

### Logs Importantes

```javascript
// No middleware, adicionar:
const loadTime = Date.now() - startTime;
logger.info(`⏱️ [KB Loader] Loading time: ${loadTime}ms`, {
  processCount: processNumbers.length,
  filesLoaded: allStructuredFiles.length,
  totalChars: allStructuredFiles.reduce((sum, f) => sum + f.content.length, 0)
});
```

---

## Próximos Passos (Opcional)

### Melhorias Futuras

1. **Cache de Ficheiros**
   - Cachear ficheiros carregados recentemente
   - Reduzir leitura de disco repetida
   - TTL de 5-10 minutos

2. **Busca Semântica**
   - Além de número de processo, buscar por palavras-chave
   - "ação de indenização" → carrega processos similares
   - Usar embeddings para relevância

3. **Seleção Inteligente de Ficheiros**
   - Se usuário pergunta sobre cronologia, carregar APENAS INDICE_CRONOLOGICO
   - Se pergunta sobre pedidos, carregar APENAS ANALISE_PEDIDOS
   - Reduzir tokens e custo

4. **UI de Feedback**
   - Mostrar ao usuário quando ficheiros são carregados
   - "📚 Carregados 7 ficheiros do processo X"
   - Transparência sobre fonte das informações

5. **Analytics**
   - Dashboard de uso do KB
   - Processos mais acessados
   - Ficheiros mais úteis
   - Tempo médio de carregamento

---

## Checklist de Validação

- [ ] Arquivo `src/middleware/kb-loader.js` criado
- [ ] Import adicionado em `src/server-enhanced.js`
- [ ] Middleware adicionado em `/api/chat`
- [ ] Middleware adicionado em `/api/chat/stream`
- [ ] Sintaxe verificada (sem erros)
- [ ] Servidor reiniciado
- [ ] Teste 1 realizado (sem processo)
- [ ] Teste 2 realizado (com processo)
- [ ] Logs confirmam carregamento de ficheiros
- [ ] Chat responde com informações estruturadas
- [ ] Performance aceitável (<500ms para loading)

---

**Data**: 2026-02-02
**Status**: ✅ Implementação Completa
**Próximo Passo**: Testar em desenvolvimento com processo real
