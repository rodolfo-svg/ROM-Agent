# 🧪 Teste Manual do KB em Produção

**Data:** 2026-02-02 23:45 UTC
**Objetivo:** Validar que KB está funcionando corretamente em produção

---

## ✅ PRÉ-REQUISITOS

Antes de testar, verifique:

```bash
# 1. Commit correto em produção
curl -s "https://iarom.com.br/api/info" | jq '.server.gitCommit'
# Esperado: "d19e07f" ✅

# 2. KB usando disco persistente
curl -s "https://iarom.com.br/api/kb/status" | jq '.kbPath'
# Esperado: "/var/data/data/knowledge-base" ✅
```

---

## 🧪 TESTE 1: Verificar Documentos no Frontend

### Passo 1: Fazer Login
1. Acesse: https://iarom.com.br/login
2. Faça login com suas credenciais
3. Aguarde redirect para dashboard

### Passo 2: Acessar KB Upload
1. Acesse: https://iarom.com.br/upload
2. Você verá a interface de upload
3. Abaixo, deve aparecer lista de documentos existentes

### Resultado Esperado
```
📚 Documentos na Knowledge Base

┌─────────────────────────────────────────────────────────┐
│ documento1.pdf                                          │
│ Tamanho: 1.5 MB | Upload: 02/02/2026                   │
│ [Download] [Delete]                                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ documento2.pdf                                          │
│ Tamanho: 2.3 MB | Upload: 02/02/2026                   │
│ [Download] [Delete]                                     │
└─────────────────────────────────────────────────────────┘

Total: 2 documentos
```

### ✅ Validação
- [ ] Lista aparece (não está vazia)
- [ ] Número de documentos corresponde ao status da API
- [ ] Cada documento mostra nome, tamanho e data

---

## 🧪 TESTE 2: Testar Busca no Chat

### Passo 1: Abrir Nova Conversa
1. Acesse: https://iarom.com.br/chat
2. Clique em "Nova Conversa" ou abra aba anônima
3. Faça login novamente (se necessário)

### Passo 2: Fazer Pergunta Sobre KB
Digite uma das seguintes perguntas:

**Opção A - Busca Específica:**
```
Consulte os documentos na KB sobre execução fiscal e me diga o que encontra sobre prescrição.
```

**Opção B - Listar Documentos:**
```
Quais documentos eu tenho na Knowledge Base? Liste todos.
```

**Opção C - Busca por Termo:**
```
Busque na KB documentos que falem sobre "movimento 274"
```

### Resultado Esperado

**Agent ROM deve:**
1. ✅ Invocar ferramenta `consultar_kb`
2. ✅ Mostrar mensagem: "📚 Consultando documentos..."
3. ✅ Retornar lista de documentos encontrados
4. ✅ Citar trechos específicos dos documentos
5. ❌ NÃO retornar "Nenhum documento encontrado"

**Exemplo de resposta esperada:**
```
📚 Consultei os documentos na Knowledge Base sobre "execução fiscal".

Encontrei 2 documentos relevantes:

1. **execucao-fiscal-completa.pdf**
   - Upload: 02/02/2026
   - Tamanho: 76 MB

   Sobre prescrição:
   "A prescrição intercorrente em execução fiscal ocorre quando..."
   [trecho do documento]

2. **analise-prescricao.pdf**
   - Upload: 02/02/2026
   - Tamanho: 5 MB

   "Conforme o art. 174 do CTN, o prazo prescricional..."
   [trecho do documento]

Análise:
[análise detalhada baseada nos documentos]
```

### ✅ Validação
- [ ] Agent invocou `consultar_kb` (aparece na UI)
- [ ] Retornou documentos (não vazio)
- [ ] Citou nome dos arquivos
- [ ] Mostrou trechos dos documentos
- [ ] Resposta coerente com conteúdo real

---

## 🧪 TESTE 3: Verificar Console do Navegador

### Passo 1: Abrir DevTools
1. Pressione F12 (ou Cmd+Option+I no Mac)
2. Vá para aba "Console"
3. Limpe o console (ícone 🚫)

### Passo 2: Fazer Nova Pergunta sobre KB
Digite no chat:
```
Consulte a KB e me diga quantos documentos tenho
```

### Resultado Esperado no Console

```javascript
// Você deve ver logs similares a:
[KB] Consultando documentos: "quantos documentos tenho"
[KB] 3 documento(s) encontrado(s)
[Tool Use] Executando: consultar_kb
✅ [KB] Retornando documentos...
```

### ✅ Validação
- [ ] Vê logs de `[KB]` no console
- [ ] Nenhum erro vermelho relacionado a KB
- [ ] Logs indicam documentos encontrados (> 0)

---

## 🧪 TESTE 4: Testar Via API (Curl)

### Passo 1: Obter Cookie de Sessão

**No navegador (após login):**
1. Abra DevTools (F12)
2. Vá para aba "Application" (Chrome) ou "Storage" (Firefox)
3. Expanda "Cookies" > "https://iarom.com.br"
4. Copie o valor de `connect.sid`

**Exemplo:**
```
s%3A9X7k2...abc123
```

### Passo 2: Testar Listagem de Documentos

```bash
# Substitua <SEU_COOKIE> pelo valor copiado
curl -s "https://iarom.com.br/api/kb/documents" \
  -H "Cookie: connect.sid=<SEU_COOKIE>" | jq '.'
```

**Resultado esperado:**
```json
{
  "documents": [
    {
      "id": "1234567890",
      "name": "documento.pdf",
      "type": "application/pdf",
      "size": 8368,
      "uploadedAt": "2026-02-02T20:00:00.000Z",
      "textLength": 5000,
      "metadata": { ... }
    }
  ]
}
```

### ✅ Validação
- [ ] Retorna array de documents
- [ ] Array não está vazio
- [ ] Cada documento tem: id, name, size, uploadedAt

---

## 🧪 TESTE 5: Comparar Frontend vs API

### Objetivo
Verificar que frontend e API retornam os MESMOS documentos.

### Passo 1: Contar Documentos no Frontend
1. Acesse: https://iarom.com.br/upload
2. Conte quantos documentos aparecem listados
3. Anote o número: **N documentos**

### Passo 2: Verificar Status da API
```bash
curl -s "https://iarom.com.br/api/kb/status" | jq '.totalDocuments'
```

### Passo 3: Listar via API
```bash
curl -s "https://iarom.com.br/api/kb/documents" \
  -H "Cookie: connect.sid=<SEU_COOKIE>" | jq '.documents | length'
```

### ✅ Validação
- [ ] Número no frontend = totalDocuments da API
- [ ] Número no frontend = length do array de documents
- [ ] Nomes dos arquivos são os mesmos em frontend e API

**Exemplo:**
```
Frontend: 3 documentos
API status: totalDocuments = 3 ✅
API documents: length = 3 ✅
Nomes: documento1.pdf, documento2.pdf, documento3.pdf ✅
```

---

## 🧪 TESTE 6: Verificar Persistência Após Deploy

### Objetivo
Garantir que documentos sobrevivem a deploys.

### Passo 1: Anotar Documentos Atuais
```bash
# Antes do deploy
curl -s "https://iarom.com.br/api/kb/status" | jq '{docs: .totalDocuments, path: .kbPath}'
```

**Anote:**
- Total de documentos: ___
- Caminho: ___

### Passo 2: Forçar Deploy
```bash
# No repositório local
git commit --allow-empty -m "test: forçar deploy para testar persistência KB"
git push origin main
```

### Passo 3: Aguardar Deploy Completar
```bash
# Monitorar (aguarda ~2-3 min)
while true; do
  curl -s "https://iarom.com.br/api/info" 2>&1 | grep gitCommit
  sleep 10
done
```

### Passo 4: Verificar Documentos Após Deploy
```bash
# Depois do deploy
curl -s "https://iarom.com.br/api/kb/status" | jq '{docs: .totalDocuments, path: .kbPath}'
```

### ✅ Validação
- [ ] Mesmo número de documentos (antes = depois)
- [ ] Caminho ainda é `/var/data/data/knowledge-base`
- [ ] Frontend ainda lista os mesmos documentos
- [ ] Chat ainda encontra documentos

---

## 🧪 TESTE 7: Fazer Upload e Buscar Imediatamente

### Objetivo
Testar ciclo completo: upload → processar → buscar.

### Passo 1: Fazer Upload de Arquivo de Teste
1. Acesse: https://iarom.com.br/upload
2. Selecione um PDF pequeno (~1-5MB)
3. Faça upload
4. Aguarde processamento (1-2 minutos)
5. Verifique que arquivo aparece listado

### Passo 2: Abrir Nova Conversa
1. Acesse: https://iarom.com.br/chat
2. Abra nova conversa (ou limpe a atual)

### Passo 3: Buscar Arquivo Recém-Uploadado
Digite:
```
Consulte os documentos na KB. Há algum documento chamado [nome do arquivo que você fez upload]?
```

### ✅ Validação
- [ ] Agent encontra o arquivo
- [ ] Retorna informações corretas (nome, data)
- [ ] Consegue citar trechos do conteúdo
- [ ] Não diz "Nenhum documento encontrado"

---

## 📊 RESULTADO FINAL DOS TESTES

Preencha após executar todos os testes:

| Teste | Status | Observações |
|-------|--------|-------------|
| 1. Frontend lista docs | ⬜ | |
| 2. Chat acessa KB | ⬜ | |
| 3. Console sem erros | ⬜ | |
| 4. API retorna docs | ⬜ | |
| 5. Frontend = API | ⬜ | |
| 6. Persistência OK | ⬜ | |
| 7. Upload + busca OK | ⬜ | |

**Status:**
- ✅ = Passou
- ⚠️ = Passou com ressalvas
- ❌ = Falhou

---

## 🔧 SE ALGUM TESTE FALHAR

### Teste 1 Falhou (Frontend não lista)
```bash
# Verificar que commit está correto
curl -s "https://iarom.com.br/api/info" | jq '.server.gitCommit'
# Deve ser: "d19e07f"

# Verificar que kb-documents.json existe
# (requer acesso SSH ao Render)
ls -la /var/data/data/kb-documents.json
```

**Solução:** Fazer re-upload dos documentos

---

### Teste 2 Falhou (Chat não encontra)
```bash
# Verificar que bedrock-tools.js está usando ACTIVE_PATHS
git show d19e07f:src/modules/bedrock-tools.js | grep "ACTIVE_PATHS.data"

# Deve ter: path.join(ACTIVE_PATHS.data, 'kb-documents.json')
```

**Solução:** Verificar logs do Render para erros

---

### Teste 3 Falhou (Erros no console)
Copie os erros do console e procure por:
- "kb-documents.json" → Problema de path
- "permission denied" → Problema de permissões
- "not found" → Arquivo não existe

**Solução:** Consultar `KB-CORRECOES-COMPLETAS-REFERENCIA.md`

---

### Teste 5 Falhou (Frontend ≠ API)
Isso indica que frontend e API estão lendo de lugares diferentes.

```bash
# Verificar que TODOS os endpoints usam ACTIVE_PATHS
git log --oneline | grep -i "active_paths"

# Deve incluir commits:
# d19e07f: 3 endpoints adicionais
# 636037d: bedrock-tools + 9 ocorrências
```

**Solução:** Verificar que ambos os commits foram aplicados

---

## 📝 RELATÓRIO DE TESTES (Template)

Preencha após concluir:

```
Data: ___________
Hora: ___________
Testado por: ___________

AMBIENTE:
- URL: https://iarom.com.br
- Commit: ___________
- KB Path: ___________

TESTES EXECUTADOS:
- [ ] Teste 1: Frontend
- [ ] Teste 2: Chat
- [ ] Teste 3: Console
- [ ] Teste 4: API
- [ ] Teste 5: Comparação
- [ ] Teste 6: Persistência
- [ ] Teste 7: Upload

RESULTADOS:
✅ Passou: ___/7
⚠️ Parcial: ___/7
❌ Falhou: ___/7

PROBLEMAS ENCONTRADOS:
1. ___________
2. ___________

OBSERVAÇÕES:
___________

CONCLUSÃO:
[ ] Sistema 100% operacional
[ ] Sistema operacional com ressalvas
[ ] Sistema com problemas críticos
```

---

**Documento criado:** 02/02/2026 23:45 UTC
**Válido para:** Commit d19e07f ou superior
**Tempo estimado:** 15-20 minutos

**Execute estes testes e reporte os resultados!** ✅
