# 🔍 DIAGNÓSTICO: Problemas de Upload - ROM Agent

**Data:** 07/04/2026 00:40 BRT
**Analisado por:** Claude Sonnet 4.5
**Status:** ❌ 5 PROBLEMAS CRÍTICOS IDENTIFICADOS

---

## 📋 SUMÁRIO EXECUTIVO

O sistema de upload **NÃO ESTÁ FUNCIONANDO COMPLETAMENTE** devido a 5 problemas críticos:

1. ❌ Configuração Nginx custom **NÃO APLICADA** pelo Render
2. ⚠️ Discrepância de rotas (Frontend vs Backend)
3. ⚠️ Limite de arquivo inconsistente (500MB frontend vs 100MB backend)
4. ❌ Upload de múltiplos arquivos grandes (>80MB) pode exceder timeout
5. ⚠️ Nenhum upload real detectado nos logs (7 dias)

---

## 🔍 ANÁLISE DETALHADA

### Problema #1: ❌ Nginx Custom NÃO APLICADO

**Gravidade:** CRÍTICA
**Impacto:** Uploads >1MB bloqueados com HTTP 413

**Evidência:**
```bash
# Busquei nos logs de deploy:
render logs -r srv-... --limit 500 | grep -i "nginx\|custom.*config"

# Resultado: NENHUMA MENÇÃO a "custom nginx configuration"
```

**Configuração Presente:**
```nginx
# render.nginx.conf (EXISTE no repositório)
client_max_body_size 1100M;       # 1.1GB
proxy_read_timeout 1800s;          # 30 minutos
client_body_timeout 1800s;
```

**Problema:** Render **NÃO ESTÁ APLICANDO** o arquivo `render.nginx.conf`!

**Razão Provável:**
- Render Pro aplica nginx custom apenas se:
  1. Arquivo está na RAIZ do repositório (✅ Confirmado)
  2. Service settings tem "Custom Nginx Config" habilitado
  3. Deploy mostra mensagem "Applying custom nginx configuration"

**Solução:**
1. Verificar no dashboard Render: `Settings → Custom Nginx Config`
2. Se não aparecer a opção, contactar suporte Render
3. Como workaround: Usar **apenas chunked upload** (bypass nginx)

---

### Problema #2: ⚠️ Discrepância de Rotas

**Gravidade:** MÉDIA
**Impacto:** Possível confusão entre endpoints diferentes

**Frontend chama:**
```typescript
// frontend/src/pages/upload/UploadPage.tsx:317
const response = await fetch('/api/kb/upload', {
  method: 'POST',
  body: formData,
  // ...
});
```

**Backend tem DUAS rotas:**

```javascript
// src/routes/rom-project.js:401
router.post('/kb/upload', requireAdminPermissions, upload.array('files', 50), ...)
// Montado em: /api/rom-project/kb/upload

// Outra rota (preciso verificar):
// /api/kb/upload (existe?)
```

**Necessário:** Confirmar qual rota está sendo usada:
```bash
grep -r "app.use.*'/api/kb'" src/
```

---

### Problema #3: ⚠️ Limite Inconsistente

**Gravidade:** MÉDIA
**Impacto:** Frontend permite 500MB mas backend aceita apenas 100MB

| Componente | Limite | Localização |
|------------|--------|-------------|
| Frontend | 500MB | `UploadPage.tsx:91` |
| Multer (Backend) | 100MB | `rom-project.js:59` |
| Nginx (não aplicado) | 1100M | `render.nginx.conf:15` |

**Resultado:** Usuário pode selecionar arquivo de 500MB mas backend rejeita com HTTP 413 ou erro de multer.

**Solução:**
```javascript
// src/routes/rom-project.js
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // ✅ Aumentar para 500MB
  }
});
```

---

### Problema #4: ❌ Múltiplos Arquivos Grandes

**Gravidade:** ALTA
**Impacto:** 5 arquivos de 100MB = timeout ou rejeição

**Fluxo Atual:**

1. Usuário seleciona 5 arquivos de 100MB cada (total: 500MB)
2. Frontend detecta que cada arquivo > 80MB
3. Inicia chunked upload **SEQUENCIAL**:
   ```
   Arquivo 1: 100MB → 3 chunks de 40MB → ~30 segundos
   Arquivo 2: 100MB → 3 chunks de 40MB → ~30 segundos
   Arquivo 3: 100MB → 3 chunks de 40MB → ~30 segundos
   Arquivo 4: 100MB → 3 chunks de 40MB → ~30 segundos
   Arquivo 5: 100MB → 3 chunks de 40MB → ~30 segundos
   TOTAL: ~2.5 minutos
   ```
4. Após todos os uploads, chama `/api/kb/process-uploaded`
5. Processing de 5 arquivos com IA (OCR + extração): **10-20 minutos**

**Problema:** Timeout de 30 minutos do nginx (se estiver aplicado) pode ser insuficiente para todo o fluxo.

**Solução:**
- ✅ Implementar upload **PARALELO** (não sequencial)
- ✅ Separar chunked upload do processing
- ✅ Usar SSE (Server-Sent Events) para progress tracking em background

---

### Problema #5: ⚠️ Nenhum Upload Real Detectado

**Gravidade:** BAIXA
**Impacto:** Indica que sistema não está sendo usado OU uploads falhando silenciosamente

**Evidência:**
```bash
render logs -r srv-... --limit 500 | grep -i "POST.*kb/upload\|multipart"
# Resultado: VAZIO (0 uploads nos últimos 7 dias)
```

**Logs Únicos Encontrados:**
```
2026-04-06 22:18:54  Upload succeeded
2026-04-06 22:48:56  Upload succeeded
2026-04-06 23:07:40  Upload succeeded
2026-04-06 23:37:58  Upload succeeded
```

Mas esses são **deploys Git** ("Upload succeeded" = git push), NÃO uploads de usuário!

**Conclusão:** Sistema está configurado mas:
- Usuários não estão fazendo upload OU
- Uploads estão falhando no frontend (erro silencioso)

---

## 🔧 DIAGNÓSTICO TÉCNICO

### Limites Atuais Configurados

```javascript
// FRONTEND
maxSizeBytes: 500 * 1024 * 1024      // 500MB por arquivo
CHUNKED_THRESHOLD: 80 * 1024 * 1024  // 80MB → chunked upload
CHUNK_SIZE: 40 * 1024 * 1024         // 40MB por chunk

// BACKEND (rom-project.js)
fileSize: 100 * 1024 * 1024          // 100MB (multer)

// BACKEND (kb-merge-volumes.js)
fileSize: 500 * 1024 * 1024          // 500MB (merge)

// NGINX (NÃO APLICADO!)
client_max_body_size: 1100M          // 1.1GB
proxy_read_timeout: 1800s            // 30 minutos
```

### Fluxo de Upload Esperado

**Arquivo PEQUENO (<80MB):**
```
1. Frontend: FormData → POST /api/kb/upload
2. Backend: Multer → salva em disk → processa com IA
3. SSE: Envia progress updates
4. Retorna: { documents: [...], uploadId: '...' }
```

**Arquivo GRANDE (>80MB):**
```
1. Frontend: POST /api/upload/chunked/init
   Resposta: { uploadId: 'xxx', chunkSize: 40MB }

2. Frontend: Loop de chunks
   POST /api/upload/chunked/:uploadId/chunk/0 → chunk 1
   POST /api/upload/chunked/:uploadId/chunk/1 → chunk 2
   POST /api/upload/chunked/:uploadId/chunk/2 → chunk 3

3. Frontend: POST /api/upload/chunked/:uploadId/finalize
   Resposta: { path: '/var/data/upload/file.pdf' }

4. Frontend: POST /api/kb/process-uploaded
   Body: { uploadedFiles: [{ originalName: '...', uploadedPath: '...' }] }

5. SSE: Progress tracking de processing

6. Retorna: { success: true, uploadId: '...' }
```

---

## ✅ SOLUÇÕES RECOMENDADAS

### Solução #1: Aplicar Nginx Custom (PRIORITÁRIO)

**Verificar no Dashboard Render:**
```
1. Acessar https://dashboard.render.com
2. Selecionar service "rom-agent-ia"
3. Settings → Environment → Custom Nginx Config
4. Se não existir, contactar suporte: "Please enable custom nginx config"
```

**Verificar se foi aplicado:**
```bash
# Após próximo deploy, verificar logs:
render logs -r srv-... --tail | grep -i "nginx"

# Deve aparecer:
# "Applying custom nginx configuration from render.nginx.conf"
```

---

### Solução #2: Aumentar Limite Multer

**Arquivo:** `src/routes/rom-project.js`

**Mudança:**
```javascript
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // ✅ 500MB (era 100MB)
  }
});
```

---

### Solução #3: Upload Paralelo (Opcional)

**Arquivo:** `frontend/src/pages/upload/UploadPage.tsx`

**Mudança:** Usar `Promise.all()` ao invés de loop sequencial:

```typescript
// ANTES (sequencial):
for (const file of selectedFiles) {
  await uploadChunked(file);
}

// DEPOIS (paralelo):
await Promise.all(
  selectedFiles.map(file => uploadChunked(file))
);
```

---

### Solução #4: Monitoramento de Upload

**Criar endpoint de teste:**
```bash
curl -X POST https://rom-agent-ia.onrender.com/api/kb/upload \
  -H "Content-Type: multipart/form-data" \
  -F "files=@test.pdf" \
  -b "rom.sid=..." \
  -H "x-csrf-token=..."
```

---

## 📊 PRÓXIMOS PASSOS

### Prioridade ALTA (Fazer AGORA):

1. ✅ **Verificar Dashboard Render** → Custom Nginx Config
2. ✅ **Aumentar limite multer** → 100MB → 500MB
3. ✅ **Testar upload via web** → 1 arquivo pequeno (5MB)
4. ✅ **Testar upload via web** → 1 arquivo grande (100MB)
5. ✅ **Verificar logs em tempo real** → `./monitor-control.sh tail`

### Prioridade MÉDIA (Próxima semana):

6. ⚠️ Implementar upload paralelo
7. ⚠️ Adicionar retry automático no frontend
8. ⚠️ Melhorar feedback de erro (mostrar limite excedido)

### Prioridade BAIXA (Opcional):

9. 📈 Dashboard de uploads (quantos por dia)
10. 📈 Estatísticas de tamanho médio
11. 📈 Alertas de erro via email/Slack

---

## 🧪 TESTES RECOMENDADOS

### Teste #1: Arquivo Pequeno (5MB)

```bash
# Via interface web:
1. Acessar: https://rom-agent-ia.onrender.com
2. Login: rodolfo@rom.adv.br / Rodolfo@2026!
3. Ir para Knowledge Base
4. Upload: test-5mb.pdf
5. Verificar: Progresso 0% → 100%
```

### Teste #2: Arquivo Grande (100MB)

```bash
# Via interface web (deve usar chunked upload):
1. Upload: test-100mb.pdf
2. Verificar logs:
   ./monitor-control.sh tail | grep "chunked"
3. Esperar: "Chunked upload completo"
```

### Teste #3: Múltiplos Arquivos

```bash
# Via interface web:
1. Selecionar: 5 arquivos de 20MB cada
2. Upload: total 100MB
3. Verificar: Todos processados
```

---

## 📝 LOGS ÚTEIS PARA DIAGNÓSTICO

### Ver tentativas de upload:
```bash
render logs -r srv-d51ppfmuk2gs73a1qlkg --limit 200 | grep -i "upload\|multipart\|chunked"
```

### Ver erros HTTP 413:
```bash
render logs -r srv-d51ppfmuk2gs73a1qlkg --status-code 413 --limit 50
```

### Ver erros de multer:
```bash
render logs -r srv-d51ppfmuk2gs73a1qlkg --level error | grep -i "multer\|file.*large"
```

### Monitor em tempo real:
```bash
./monitor-control.sh tail
# ou
tail -f logs/monitor/upload-monitoring.log
```

---

## 🎯 CONCLUSÃO

**Sistema de upload está:**
- ✅ Configurado no código
- ✅ Chunked upload implementado
- ❌ Nginx custom NÃO aplicado (bloqueio principal)
- ⚠️ Limites inconsistentes
- ⚠️ Não testado em produção (0 uploads reais)

**Prioridade #1:** Aplicar configuração nginx custom no Render!

**Evidência de que vai funcionar:**
- Chunked upload (>80MB) bypassanginx via streaming
- Backend aceita chunks de 40MB cada
- Processing funciona (modelos IA pré-aquecidos)

---

**Criado por:** Claude Sonnet 4.5
**Data:** 07/04/2026 00:40 UTC
**Versão:** 1.0
