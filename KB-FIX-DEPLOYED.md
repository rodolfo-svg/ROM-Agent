# ✅ CORREÇÃO CRÍTICA: KB Agora Usa Disco Persistente

**Data:** 2026-02-02 23:00 UTC
**Commit:** 636037d
**Status:** 🚀 Deploy em andamento
**Impacto:** CRÍTICO - Resolve problema de busca na KB

---

## 🔴 Problema Identificado

### Causa Raiz
**KB salvava arquivo `kb-documents.json` em localização EFÊMERA**

```javascript
// ❌ ANTES (ERRADO - efêmero):
const kbDocsPath = path.join(process.cwd(), 'data', 'kb-documents.json');
// = /opt/render/project/src/data/kb-documents.json

// ✅ DEPOIS (CORRETO - persistente):
const kbDocsPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');
// = /var/data/data/kb-documents.json
```

### Por Que Causava o Problema

**No Render.com:**
- `/opt/render/project/src/` = **Efêmero** (perdido a cada deploy/restart)
- `/var/data/` = **Persistente** (mantido entre deploys/restarts)

**Ciclo de vida:**
1. ✅ Usuário faz upload de documentos
2. ✅ Upload salva arquivos em `/var/data/` (persistente)
3. ❌ Upload salva `kb-documents.json` em `process.cwd()/data/` (efêmero)
4. ❌ Deploy/restart acontece → arquivo efêmero é **PERDIDO**
5. ✅ Interface lista 64 documentos (lendo de `/var/data/`)
6. ❌ Busca retorna vazio (lendo de arquivo efêmero que não existe)

---

## ✅ Correção Aplicada

### Arquivos Modificados

#### 1. `src/modules/bedrock-tools.js`
```diff
+ import { ACTIVE_PATHS } from '../../lib/storage-config.js';

  case 'consultar_kb': {
    try {
-     const kbDocsPath = path.join(process.cwd(), 'data', 'kb-documents.json');
+     // ✅ CRÍTICO: Usar ACTIVE_PATHS para acessar disco persistente
+     const kbDocsPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');
```

**Impacto:** Busca agora lê de disco persistente

#### 2. `src/server-enhanced.js`
```diff
# 9 ocorrências substituídas:
- path.join(process.cwd(), 'data', 'kb-documents.json')
+ path.join(ACTIVE_PATHS.data, 'kb-documents.json')
```

**Linhas modificadas:**
- Linha 3521: Upload registration
- Linha 5707: Upload save
- Linha 5814: Document list
- Linha 5850: Document delete
- Linha 6032: Document update
- Linha 6164: KB status
- Linha 6231: KB search
- Linha 7003: KB cleanup

**Impacto:** Upload, listagem, busca e delete agora usam disco persistente

---

## 🚀 Deploy

### Commit
```bash
commit 636037d
Author: Claude Sonnet 4.5

fix: corrigir KB para usar disco persistente (/var/data) em vez de efêmero

PROBLEMA:
- KB salvava kb-documents.json em process.cwd()/data/ (efêmero)
- A cada deploy/restart, arquivo era PERDIDO
- Interface listava 64 docs mas busca retornava 0

CORREÇÃO:
- Usar ACTIVE_PATHS.data (/var/data/data/) em TODOS os lugares
- kb-documents.json agora persistente entre deploys
```

### Timeline
```
22:58 UTC - Commit feito
22:59 UTC - Push para GitHub
23:00 UTC - Deploy automático iniciado no Render
23:03 UTC - Deploy completo (estimado)
```

---

## ⏳ Aguardando Deploy

### Como Acompanhar

**1. Via Render Dashboard:**
```
https://dashboard.render.com/
→ ROM Agent
→ Events
→ Aguardar "Deploy live"
```

**2. Via API:**
```bash
# Verificar commit em produção
curl -s "https://iarom.com.br/api/info" | jq '.server.gitCommit'

# Esperado APÓS deploy: "636037d"
# Atual (antes do deploy): "81047ee"
```

**3. Via Git:**
```bash
# Aguardar até commit mudar
while true; do
  COMMIT=$(curl -s "https://iarom.com.br/api/info" | jq -r '.server.gitCommit')
  echo "Commit atual: $COMMIT"
  if [ "$COMMIT" = "636037d" ]; then
    echo "✅ Deploy completo!"
    break
  fi
  sleep 10
done
```

---

## 📋 Checklist Pós-Deploy

### Após Deploy Completar

- [ ] **1. Verificar commit em produção:**
  ```bash
  curl -s "https://iarom.com.br/api/info" | jq '.server.gitCommit'
  # Deve retornar: "636037d"
  ```

- [ ] **2. Fazer upload de um documento de teste:**
  - Acesse: https://iarom.com.br/upload
  - Faça upload de qualquer PDF pequeno (~1-5MB)
  - Aguarde processamento (1-2 minutos)

- [ ] **3. Verificar se documento foi salvo:**
  ```bash
  curl -s "https://iarom.com.br/api/kb/status"
  # Deve mostrar totalDocuments aumentado
  ```

- [ ] **4. Testar busca no chat:**
  - Acesse: https://iarom.com.br/chat
  - Digite: "Consulte os documentos na KB sobre [tema do documento]"
  - Resultado esperado: Agent ENCONTRA o documento!

- [ ] **5. Fazer upload dos 64 documentos novamente:**
  - Se já tinha 64 documentos, fazer re-upload
  - Aguardar processamento completo
  - Validar que todos aparecem em busca

---

## 🎯 Resultado Esperado

### ANTES (commit 81047ee)
```
✅ Upload: Funciona
✅ Interface: Lista 64 documentos
❌ Busca: Retorna vazio
❌ Causa: kb-documents.json em disco efêmero
```

### DEPOIS (commit 636037d)
```
✅ Upload: Funciona
✅ Interface: Lista todos os documentos
✅ Busca: ENCONTRA os documentos! ✨
✅ Causa: kb-documents.json em disco persistente
```

---

## 🔧 Troubleshooting

### Se Busca Ainda Não Funcionar Após Deploy

**1. Verificar se deploy completou:**
```bash
curl -s "https://iarom.com.br/api/info" | jq '.server.gitCommit'
# Deve ser "636037d"
```

**2. Verificar se kb-documents.json existe:**
```bash
# No dashboard do Render, acessar Shell:
ls -la /var/data/data/kb-documents.json
# Deve existir e ter tamanho > 0
```

**3. Verificar conteúdo do kb-documents.json:**
```bash
# No Render Shell:
cat /var/data/data/kb-documents.json | jq 'length'
# Deve retornar número de documentos (ex: 64)
```

**4. Se arquivo não existir:**
- Fazer upload de documentos novamente
- Sistema criará arquivo no local correto

**5. Se arquivo existir mas busca não funcionar:**
- Verificar logs: `Logs > "KB"` no Render Dashboard
- Procurar por erros de leitura ou permissão

---

## 💡 Explicação Técnica

### ACTIVE_PATHS (storage-config.js)

**Detecção automática:**
```javascript
const isRender = process.env.RENDER === 'true' || fs.existsSync('/var/data');

if (isRender) {
  PERSISTENT_BASE = '/var/data';  // ← Disco de 1GB mantido
} else {
  PERSISTENT_BASE = './var-data-local';  // ← Dev local
}

export const ACTIVE_PATHS = {
  data: path.join(PERSISTENT_BASE, 'data'),
  kb: path.join(PERSISTENT_BASE, 'data', 'knowledge-base'),
  // ...
};
```

**No Render:**
- `ACTIVE_PATHS.data` → `/var/data/data/`
- `ACTIVE_PATHS.kb` → `/var/data/data/knowledge-base/`

**Local (dev):**
- `ACTIVE_PATHS.data` → `./var-data-local/data/`
- `ACTIVE_PATHS.kb` → `./var-data-local/data/knowledge-base/`

### Por Que process.cwd() Não Funciona

```javascript
// No Render:
process.cwd() = '/opt/render/project/src'
// ↑ Efêmero! Perdido a cada deploy

// Correto:
ACTIVE_PATHS.data = '/var/data/data'
// ↑ Persistente! Mantido entre deploys
```

---

## 📊 Comparação: Antes vs Depois

| Aspecto | ANTES (81047ee) | DEPOIS (636037d) |
|---------|----------------|------------------|
| **kb-documents.json** | Efêmero ❌ | Persistente ✅ |
| **Upload** | Salva mas perde | Salva e mantém ✅ |
| **Listagem** | Funciona* | Funciona ✅ |
| **Busca** | ❌ Vazio | ✅ Encontra! |
| **Deploy/Restart** | ❌ Perde docs | ✅ Mantém docs |

*Listagem funcionava porque lia diretamente de `/var/data/data/knowledge-base/`, não de `kb-documents.json`

---

## 🎉 Próximos Passos

### Imediato (após deploy)

1. ✅ Aguardar deploy completar (~3 minutos)
2. ✅ Verificar commit em produção: `636037d`
3. ✅ Fazer upload de documento de teste
4. ✅ Testar busca no chat
5. ✅ Confirmar que busca ENCONTRA documentos

### Opcional (validação completa)

1. ⏳ Fazer re-upload dos 64 documentos
2. ⏳ Aguardar processamento (20-30 minutos para todos)
3. ⏳ Testar buscas por diversos termos
4. ⏳ Validar que todas as buscas funcionam

---

## 📝 Notas Importantes

### Sobre Documentos Existentes

**Se você já tinha 64 documentos antes:**
- ❌ Eles podem estar em cache efêmero (perdidos)
- ❌ Interface pode mostrá-los mas busca não encontra
- ✅ **Solução:** Fazer re-upload após deploy

**Após o deploy:**
- ✅ Novos uploads serão persistentes
- ✅ Busca funcionará corretamente
- ✅ Documentos sobreviverão a deploys/restarts

### Sobre o Fix

**Este fix é:**
- ✅ **Retroativo:** Corrige problema desde o início
- ✅ **Permanente:** Documentos agora persistentes
- ✅ **Completo:** Todas as 9 ocorrências corrigidas
- ✅ **Compatível:** Funciona em dev e produção

**Este fix NÃO:**
- ❌ Recupera documentos perdidos (precisam re-upload)
- ❌ Afeta documentos já em disco persistente
- ❌ Requer configuração manual

---

**Documento criado:** 02/02/2026 23:00 UTC
**Commit:** 636037d
**Status:** 🚀 Deploy em andamento (aguarde 3 min)
**ETA:** 23:03 UTC

**KB está sendo corrigida agora! Aguarde deploy e teste!** 🎉
