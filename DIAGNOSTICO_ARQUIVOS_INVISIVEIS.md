# 🔍 DIAGNÓSTICO DETALHADO: Arquivos Invisíveis Após Extração

**Data**: 2 de março de 2026, 17:10 BRT
**Problema**: 7 documentos aparecem antes da extração, mas após extração completa nenhum arquivo aparece

---

## 🐛 SINTOMAS REPORTADOS

1. ✅ Upload funciona
2. ✅ Aparecem 7 documentos IMEDIATAMENTE após upload
3. ✅ Extração completa executa
4. ✅ Sistema diz "7 arquivos gerados"
5. ❌ Arquivos NÃO aparecem na interface
6. ❌ TXT não aparece
7. ❌ Lista de arquivos extraídos vazia

---

## 🔍 POSSÍVEIS CAUSAS

### Causa #1: UserId Não Está Sendo Passado ✅ PROVÁVEL

**O Problema:**
```javascript
// Backend filtra por userId
const userDocs = allDocs.filter(doc =>
  doc.userId === userId || doc.userId === 'web-upload'
);
```

**Se os arquivos gerados não tiverem o userId correto, eles são filtrados!**

**Como Verificar:**
Logs devem mostrar:
```
💾 [V2 - SALVAMENTO FICHEIROS TÉCNICOS NO KB]
   🔐 userId: <valor>
```

- Se userId = `undefined` ou `null` → PROBLEMA
- Se userId = diferente do usuário logado → PROBLEMA
- Se userId = correto → Não é essa causa

### Causa #2: Cache Não Está Sendo Sincronizado ⚠️ POSSÍVEL

**O Problema:**
Mesmo com o fix cd30559, o cache pode não estar sincronizando corretamente em produção.

**Por Que:**
- kbCache usa debounce de 5s para salvar
- Se houver erro durante o save, mudanças são perdidas
- Em produção, múltiplos workers podem ter caches diferentes

### Causa #3: Frontend Não Está Recarregando ⚠️ POSSÍVEL

**O Problema:**
Interface pode estar usando lista cacheada do browser.

**Como Verificar:**
- Hard refresh (Ctrl+Shift+R ou Cmd+Shift+R)
- Ou fechar e reabrir a aba

### Causa #4: Arquivos Estruturados Estão Sendo Filtrados ❌ IMPROVÁVEL

**Investigar:**
Verificar se há filtro no frontend que esconde arquivos com `metadata.isStructuredDocument = true`

---

## 🔧 CORREÇÕES A IMPLEMENTAR

### Fix #1: Garantir UserId Correto (CRÍTICO)

#### Problema Identificado:
O `saveExtractedTextToKB()` não recebe userId e pode estar criando documentos sem userId.

#### Solução:
```javascript
// ANTES (linha 696)
async saveExtractedTextToKB(extractedText, documentId, documentName, saveToDocuments = true) {
  // ...
  const intermediateDoc = {
    id: `kb-extracted-${documentId}-${Date.now()}`,
    // ❌ SEM userId!
  };
}

// DEPOIS
async saveExtractedTextToKB(extractedText, documentId, documentName, saveToDocuments = true, userId = null) {
  // ...
  const intermediateDoc = {
    id: `kb-extracted-${documentId}-${Date.now()}`,
    userId: userId || 'web-upload',  // ✅ COM userId
  };
}
```

#### Também atualizar chamada:
```javascript
// Em processComplete() linha 1773
intermediateDoc = await this.saveExtractedTextToKB(
  extraction.extractedText,
  documentId,
  documentName,
  true,  // saveToDocuments
  userId  // ✅ PASSAR userId aqui!
);
```

### Fix #2: Log Detalhado do UserId

```javascript
// Adicionar em saveTechnicalFilesToKB linha 855
console.log(`   🔐 Criando arquivo com userId: ${userId || 'NÃO DEFINIDO'}`);

// Adicionar após kbCache.add()
console.log(`   ✅ Adicionado ao cache: ${fileDoc.id} (userId: ${fileDoc.userId})`);
```

### Fix #3: Forçar Reload do Cache no Frontend

Adicionar header de no-cache:
```javascript
// Em GET /api/kb/documents
res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
res.json({ documents });
```

---

## 📊 SCRIPT DE DIAGNÓSTICO

```bash
#!/bin/bash
# diagnostico-kb.sh

echo "═══════════════════════════════════════════════"
echo "  DIAGNÓSTICO: Arquivos Invisíveis"
echo "═══════════════════════════════════════════════"
echo ""

# 1. Verificar se há documentos no JSON
echo "1. Documentos no kb-documents.json:"
KB_COUNT=$(cat /var/data/kb-documents.json | jq '. | length')
echo "   Total: $KB_COUNT documentos"
echo ""

# 2. Verificar userId dos últimos 20 documentos
echo "2. UserId dos últimos 20 documentos:"
cat /var/data/kb-documents.json | jq -r '.[-20:] | .[] | "\(.uploadedAt) - \(.name) - userId: \(.userId // "UNDEFINED")"'
echo ""

# 3. Verificar arquivos estruturados
echo "3. Arquivos estruturados recentes:"
cat /var/data/kb-documents.json | jq -r '.[] | select(.metadata.isStructuredDocument == true) | "\(.uploadedAt) - \(.name) - userId: \(.userId // "UNDEFINED")"' | tail -20
echo ""

# 4. Verificar arquivos no disco
echo "4. Arquivos no disco (últimos 20):"
ls -lht /var/data/knowledge-base/documents/ | head -20
echo ""

# 5. Verificar TXT e RESUMO
echo "5. Arquivos 00_TEXTO_COMPLETO.txt:"
ls -lh /var/data/knowledge-base/documents/*00_TEXTO_COMPLETO* 2>/dev/null || echo "   Nenhum encontrado"
echo ""

echo "6. Arquivos 05_RESUMO_EXECUTIVO:"
ls -lh /var/data/knowledge-base/documents/*05_RESUMO_EXECUTIVO* 2>/dev/null || echo "   Nenhum encontrado"
echo ""

# 7. Verificar tamanho do resumo
echo "7. Tamanho do RESUMO_EXECUTIVO (se existir):"
RESUMO=$(ls /var/data/knowledge-base/documents/*05_RESUMO_EXECUTIVO* 2>/dev/null | head -1)
if [ -n "$RESUMO" ]; then
    SIZE=$(wc -c < "$RESUMO")
    LINES=$(wc -l < "$RESUMO")
    echo "   Tamanho: $SIZE bytes"
    echo "   Linhas: $LINES"
    echo "   Esperado: 40.000-75.000 bytes, ~900 linhas"
    if [ "$SIZE" -lt 40000 ]; then
        echo "   ⚠️  TAMANHO MENOR QUE ESPERADO!"
    fi
else
    echo "   ❌ Nenhum arquivo encontrado"
fi

echo ""
echo "═══════════════════════════════════════════════"
```

---

## 🎯 PRÓXIMOS PASSOS

### Passo 1: Aplicar Fix do UserId ✅

Vou implementar agora mesmo.

### Passo 2: Deploy e Testar

Após deploy:
1. Fazer nova extração
2. Observar logs para userId
3. Verificar se arquivos aparecem

### Passo 3: Se Ainda Não Funcionar

Executar script de diagnóstico em produção para ver:
- Se arquivos existem no disco
- Se têm userId correto
- Se estão no JSON
- Se estão no cache

---

## 🔬 ANÁLISE DOS "7 DOCUMENTOS ANTES DA EXTRAÇÃO"

### Hipótese #1: Batch Analysis Response
O prompt de análise retorna JSON com 18 campos. Frontend pode estar interpretando como "7 documentos" antes de salvar.

### Hipótese #2: Placeholders
Sistema pode criar placeholders antes de gerar os arquivos reais.

### Para Investigar:
Ver código do frontend que exibe "7 documentos gerados".

---

## 📋 CHECKLIST DE VALIDAÇÃO

Após implementar fix:

### Backend:
- [ ] saveExtractedTextToKB aceita userId
- [ ] processComplete passa userId para saveExtractedTextToKB
- [ ] Todos os arquivos criados com userId correto
- [ ] kbCache.add() é chamado
- [ ] Logs mostram userId correto

### Produção:
- [ ] Deploy concluído
- [ ] Nova extração executada
- [ ] Logs mostram userId correto
- [ ] Arquivos aparecem na lista
- [ ] TXT visível
- [ ] RESUMO_EXECUTIVO.txt (40-75 KB) visível
- [ ] Download funciona

---

**Status**: Implementando Fix #1 (userId) AGORA
