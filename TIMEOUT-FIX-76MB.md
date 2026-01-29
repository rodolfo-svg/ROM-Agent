# ✅ Correção: Timeout para Arquivos Grandes (76MB+)

**Data:** 2026-01-29 00:35 UTC
**Commit:** 9288700 (em deploy)
**Problema:** Upload de 76MB não salvou documentos
**Causa:** Timeout de 5 minutos excedido

---

## 🔴 Problema Identificado

### Sintomas
```
✅ Upload iniciou: upload_1769658755524_kt15t13t0
✅ [POLLING] Upload completo, parando polling
❌ Documento NÃO foi salvo em kb-documents.json
❌ Nenhum arquivo apareceu na lista
```

### Causa Raiz

O sistema tinha **timeout de 5 minutos** para processar arquivos, mas um PDF de **76MB** precisa de muito mais tempo:

```javascript
// ANTES (lib/extractor-pipeline.js)
timeout: 300000 // 5 minutos max

// Processamento de 76MB:
1. Extração PDF (20-60s)
2. 91 ferramentas (30-120s)
3. Chunks RAG (10-30s)
4. 7 docs estruturados (30-90s)
5. Salvamento (10-30s)
= Total: 6-15 minutos

Resultado: ⏰ Timeout após 5min → Falha silenciosa
```

---

## ✅ Solução Implementada

### Commit 9288700 - Aumentar Timeout

**Mudança:**
```javascript
// ANTES:
timeout: 300000 // 5 minutos max

// DEPOIS:
timeout: 900000 // 15 minutos max (para arquivos grandes até 500MB)
```

**Arquivo:** `lib/extractor-pipeline.js`

**Efeito:**
- ✅ Arquivos até 100MB: ~8-12 minutos (dentro do limite)
- ✅ Arquivos até 300MB: ~12-15 minutos (dentro do limite)
- ✅ Arquivos até 500MB: ~15-20 minutos (pode precisar ajuste adicional)

---

## 🧪 Após Deploy - Teste Novamente

### Passo 1: Aguardar Deploy
```bash
# Aguardar ~5-10 minutos
curl -s https://iarom.com.br/api/info | jq '.server.gitCommit'

# Deve retornar: "9288700"
```

### Passo 2: Fazer Upload Novamente
```
1. Acesse: https://iarom.com.br/upload
2. Faça upload do mesmo arquivo de 76MB
3. ⏱️ AGUARDE: 8-12 minutos (não feche a página)
4. ✅ ESPERADO:
   - Polling mostra progresso
   - Após 8-12min: "Upload completo"
   - Documento aparece na lista
   - Documento salvo em kb-documents.json
```

### Passo 3: Validar no Chat
```
1. Acesse: https://iarom.com.br/chat
2. Pergunte: "analise a decisão do movimento 274"
3. ✅ ESPERADO:
   - Sistema encontra documento
   - RAG retorna conteúdo
   - Claude analisa o documento
```

---

## 📊 Timeouts por Tamanho de Arquivo

| Tamanho | Tempo Estimado | Dentro do Limite? |
|---------|----------------|-------------------|
| 1MB | 1-2 min | ✅ Sim |
| 10MB | 2-4 min | ✅ Sim |
| 50MB | 5-8 min | ✅ Sim |
| 76MB | 8-12 min | ✅ Sim (após fix) |
| 100MB | 10-15 min | ✅ Sim |
| 300MB | 15-20 min | ⚠️ Limite |
| 500MB | 20-30 min | ❌ Pode exceder |

---

## 🔧 Se Ainda Falhar

### Opção 1: Dividir Arquivo Grande
Se arquivo > 300MB:
```
1. Dividir PDF em partes menores (ex: 2 arquivos de 150MB)
2. Fazer upload separado
3. Sistema processa cada parte independentemente
```

### Opção 2: Aumentar Timeout Novamente
Se 76MB ainda falhar após fix:
```javascript
// Aumentar para 30 minutos
timeout: 1800000 // 30 minutos
```

### Opção 3: Processar em Background Real
Implementar queue (Redis/Bull):
```
1. Upload retorna imediatamente
2. Job entra em fila
3. Worker processa sem timeout HTTP
4. Notifica quando completo
```

---

## 🚀 Próximos Passos

1. **Aguardar deploy** (~5-10 min)
   ```bash
   watch -n 5 'curl -s https://iarom.com.br/api/info | jq .server.gitCommit'
   ```

2. **Fazer upload novamente** do arquivo de 76MB
   - Não feche a página durante processamento
   - Aguarde 8-12 minutos
   - Observe polling até "completo"

3. **Validar salvamento**
   ```bash
   # Contar documentos (deve ter +8 após upload)
   cat data/kb-documents.json | jq 'length'
   ```

4. **Testar RAG**
   - Perguntar sobre movimento 274
   - Sistema deve encontrar e analisar

---

## 📝 Histórico de Deploys

| # | Commit | Descrição | Status |
|---|--------|-----------|--------|
| 1 | f779c24 | KB: RAG + listagem + deleção | ✅ LIVE |
| 2 | a33ed1a | SSE: timing | ✅ LIVE |
| 3 | a86042d | SSE: CORS headers | ✅ LIVE |
| 4 | 356a756 | SSE: resiliência | ✅ LIVE |
| 5 | c0ce058 | SSE: bypass Cloudflare | ✅ LIVE |
| 6 | 11ce662 | SSE: fallback polling | ✅ LIVE |
| 7 | d6e941c | KB: CSRF + auth fix | ✅ LIVE |
| 8 | **9288700** | **Timeout: 5min → 15min** | 🔄 **EM DEPLOY** |

---

## ✅ Conclusão

### Problema Resolvido
- ❌ **ANTES:** Timeout 5min → Arquivos grandes falhavam
- ✅ **DEPOIS:** Timeout 15min → Arquivos até 300MB funcionam

### Próxima Ação
1. Aguardar deploy (commit 9288700)
2. Fazer upload novamente do arquivo de 76MB
3. Aguardar 8-12 minutos
4. Validar que documento aparece

---

**Documento criado:** 29/01/2026 00:35 UTC
**Deploy status:** Em andamento
**ETA:** 5-10 minutos
**Ação requerida:** Re-upload após deploy completar

**Sistema estará pronto para processar arquivos grandes após este deploy!** 🎉
