# 🧹 GUIA: Como Limpar Completamente o Knowledge Base

## 🎯 Quando usar este guia

Use quando:
- ✅ Documentos deletados ainda aparecem nos resultados
- ✅ Quer começar do ZERO com KB limpo
- ✅ Há ficheiros órfãos ou inconsistências
- ✅ KB está com problemas de sincronização

---

## ⚙️ OPÇÃO 1: Limpeza via Script (RECOMENDADO)

### Localmente (Mac):

```bash
cd /Users/rodolfootaviopereiradamotaoliveira/ROM-Agent

# Executar script (pedirá confirmação)
node scripts/clean-kb-completely.js

# OU modo automático (sem confirmação)
node scripts/clean-kb-completely.js --confirm
```

### Em Produção (Render Shell):

```bash
cd /opt/render/project/src

# Executar script com confirmação
node scripts/clean-kb-completely.js --confirm
```

### O que o script faz:

1. ✅ **Cria backup automático** em `data/.backup-kb/backup-{timestamp}/`
2. ✅ **Deleta**:
   - `data/kb-documents.json` (lista principal)
   - `data/knowledge-base/documents/` (ficheiros estruturados)
   - `data/extracted-texts/` (cache de extrações)
   - `KB/documents/` (sistema antigo, se existir)
3. ✅ **Recria estrutura**:
   - Diretórios vazios
   - `kb-documents.json` com array vazio `[]`
4. ✅ **Mostra estatísticas**:
   - Arquivos deletados
   - Espaço liberado
   - Localização do backup

---

## ⚙️ OPÇÃO 2: Limpeza Manual (Render Shell)

Se o script não funcionar, faça manualmente:

### 1. Fazer Backup (IMPORTANTE!)

```bash
cd /opt/render/project/src

# Criar diretório de backup
mkdir -p data/.backup-kb/manual-$(date +%Y%m%d-%H%M%S)

# Backup kb-documents.json
cp data/kb-documents.json data/.backup-kb/manual-$(date +%Y%m%d-%H%M%S)/

# Backup ficheiros estruturados (se houver)
tar -czf data/.backup-kb/manual-$(date +%Y%m%d-%H%M%S)/kb-documents.tar.gz \
  data/knowledge-base/documents/ 2>/dev/null || true
```

### 2. Deletar Tudo

```bash
# Deletar lista principal
rm -f data/kb-documents.json

# Deletar ficheiros estruturados
rm -rf data/knowledge-base/documents/*

# Deletar textos extraídos
rm -rf data/extracted-texts/*

# Deletar sistema antigo (se existir)
rm -rf KB/documents/*
```

### 3. Recriar Estrutura

```bash
# Recriar diretórios
mkdir -p data/knowledge-base/documents
mkdir -p data/extracted-texts

# Recriar kb-documents.json vazio
echo "[]" > data/kb-documents.json

# Verificar permissões
chmod 755 data/knowledge-base/documents
chmod 644 data/kb-documents.json
```

### 4. Verificar Limpeza

```bash
# Deve retornar 0
ls -1 data/knowledge-base/documents/ | wc -l

# Deve retornar 0
ls -1 data/extracted-texts/ | wc -l

# Deve retornar "[]"
cat data/kb-documents.json
```

---

## ⚙️ OPÇÃO 3: Deletar via Frontend (Individual)

Se você só quer deletar **alguns documentos** (não todos):

### 1. Acessar KB Tab

```
1. Ir para: https://iarom.com.br
2. Fazer login
3. Clicar na aba "Knowledge Base"
```

### 2. Deletar Documentos

```
Para cada documento na lista:
1. Clicar no botão "Deletar" (🗑️) ao lado direito
2. Confirmar a deleção
3. Aguardar mensagem de sucesso
```

### ✅ O que é deletado automaticamente:

Após a correção (commit b907bdb), o endpoint DELETE agora remove:
- ✅ Documento principal do `kb-documents.json`
- ✅ Ficheiros estruturados (01_FICHAMENTO.md, 02_ANALISE_JURIDICA.md, etc.)
- ✅ Metadata dos ficheiros (.metadata.json)
- ✅ Textos extraídos (cache)
- ✅ Sistema antigo (se houver)

---

## 🧪 VERIFICAR SE LIMPEZA FUNCIONOU

### Via Frontend:

```
1. Atualizar página (F5)
2. Ir para aba "Knowledge Base"
3. Lista deve estar vazia
4. Testar no chat: "liste documentos do KB"
   → Resposta esperada: "Nenhum documento encontrado"
```

### Via Logs (Render Shell):

```bash
# Verificar kb-documents.json
cat data/kb-documents.json
# Deve retornar: []

# Contar ficheiros estruturados
ls -1 data/knowledge-base/documents/ | wc -l
# Deve retornar: 0

# Contar textos extraídos
ls -1 data/extracted-texts/ | wc -l
# Deve retornar: 0
```

### Via API (cURL):

```bash
curl -X GET https://iarom.com.br/api/kb/documents \
  -H "Cookie: connect.sid={seu-cookie}" | jq .

# Resposta esperada:
# {
#   "success": true,
#   "documents": []
# }
```

---

## 📊 ESTATÍSTICAS ANTES/DEPOIS

### Antes da Limpeza:

```bash
# Quantos documentos?
cat data/kb-documents.json | jq 'length'

# Quantos ficheiros estruturados?
ls -1 data/knowledge-base/documents/ | wc -l

# Quanto espaço ocupado?
du -sh data/knowledge-base/documents/
du -sh data/extracted-texts/
```

### Depois da Limpeza:

```bash
# Deve ser 0
cat data/kb-documents.json | jq 'length'

# Deve ser 0
ls -1 data/knowledge-base/documents/ | wc -l

# Deve ser ~0 KB
du -sh data/knowledge-base/documents/
du -sh data/extracted-texts/
```

---

## 🔄 COMEÇAR DO ZERO (Após Limpeza)

### 1. Aguardar Deploy

```
Render.com → ROM-Agent → Aguardar "Live" (verde)
Commits: 36cc4a5, b907bdb
```

### 2. Fazer Upload do Alessandro Ribeiro

```
1. iarom.com.br → KB Tab
2. Upload "Report01770235205448.pdf"
3. Aguardar conversão PDF → TXT (~30s)
4. Status: "✅ Uploaded successfully"
```

### 3. Análise Completa (V2)

```
1. Clicar em "Analisar" (🧠) ao lado do documento
2. Configurar:
   - Tipo: "Complete"
   - Modelo: "Sonnet"
3. Iniciar Análise
4. Aguardar 3-4 minutos (barra de progresso)
5. Status: "✅ Completed"
```

### 4. Verificar Ficheiros Salvos

```bash
# Via Render Shell
ls -lh data/knowledge-base/documents/ | grep -E "FICHAMENTO|ANALISE|CRONOLOGIA|RESUMO"

# Deve mostrar 4 ficheiros:
# 01_FICHAMENTO.md (~45KB)
# 02_ANALISE_JURIDICA.md (~52KB)
# 03_CRONOLOGIA.md (~38KB)
# 04_RESUMO_EXECUTIVO.md (~15KB)
```

### 5. Testar no Chat

```
Mensagem no chat:
"acesse o processo do alessandro ribeiro no KB e liste os empréstimos mencionados"

Resultado esperado:
Claude cita detalhes específicos dos ficheiros (movimento 1 e 14, valores R$ 450 e R$ 550, etc.)
```

---

## ⚠️ PROBLEMAS COMUNS

### Problema: "Permission denied" ao deletar

**Solução:**
```bash
# Render Shell
cd /opt/render/project/src
sudo rm -rf data/knowledge-base/documents/*
```

### Problema: Script não executa

**Solução:**
```bash
# Dar permissão de execução
chmod +x scripts/clean-kb-completely.js

# Executar com node
node scripts/clean-kb-completely.js --confirm
```

### Problema: Documentos ainda aparecem após delete via frontend

**Causa:** Backend não deletava ficheiros estruturados (bug corrigido em b907bdb)

**Solução:**
1. Aguardar deploy do commit b907bdb
2. Usar script de limpeza completa: `node scripts/clean-kb-completely.js --confirm`
3. OU deletar manualmente via Render Shell

### Problema: "kb-documents.json não é um array válido"

**Solução:**
```bash
# Recriar arquivo
echo "[]" > data/kb-documents.json

# Verificar
cat data/kb-documents.json
```

### Problema: Middleware KB Loader ainda carrega ficheiros antigos

**Causa:** Cache do sistema ou ficheiros órfãos

**Solução:**
```bash
# Limpar cache do servidor (Render)
# Dashboard → Settings → Manual Deploy → Clear Build Cache

# OU reiniciar servidor
# Dashboard → Manual Deploy → Deploy Latest Commit
```

---

## 📞 SUPORTE

### Logs em Tempo Real:

```bash
# Render Shell
cd /opt/render/project/src
tail -f logs/combined.log | grep -i "kb\|delete"
```

### Verificar Endpoint de Delete:

```bash
# Testar endpoint
curl -X DELETE https://iarom.com.br/api/kb/documents/{document-id} \
  -H "Cookie: connect.sid={seu-cookie}" \
  -H "Content-Type: application/json"
```

### Inspecionar Backup:

```bash
# Listar backups disponíveis
ls -lh data/.backup-kb/

# Ver conteúdo de um backup
cat data/.backup-kb/backup-2026-02-05T23-45-00/kb-documents.json
```

---

## 🎯 RESUMO

| Método | Quando Usar | Tempo | Reversível |
|--------|-------------|-------|------------|
| **Script (Opção 1)** | Limpeza completa automática | 5s | Sim (backup automático) |
| **Manual (Opção 2)** | Script não funciona | 2 min | Sim (se fizer backup) |
| **Frontend (Opção 3)** | Deletar poucos documentos | Variável | Não |

**Recomendação:** Use o **script** (Opção 1) para limpeza completa. É mais rápido, seguro (backup automático) e garante que tudo seja deletado.

---

**Versão:** 1.0
**Data:** 2026-02-05
**Commits relacionados:** 36cc4a5, b907bdb
**Arquivos:**
- `scripts/clean-kb-completely.js` (script de limpeza)
- `src/server-enhanced.js` (endpoint DELETE melhorado)
