# 📚 LIÇÕES APRENDIDAS - ROM AGENT IA

> **IMPORTANTE:** Este documento DEVE ser consultado antes de cada commit e deploy para evitar regressões.

**Última atualização:** 04/04/2026 18:28

---

## 🎯 OBJETIVO DESTE DOCUMENTO

Documentar TODOS os erros cometidos, soluções encontradas e armadilhas evitadas durante o desenvolvimento do ROM Agent IA. Este é um histórico vivo que deve ser consultado obrigatoriamente antes de:

1. ✅ Fazer qualquer commit
2. ✅ Executar qualquer deploy
3. ✅ Modificar código crítico
4. ✅ Adicionar novas features

---

## 🚨 ERROS CRÍTICOS E SUAS SOLUÇÕES

### 1. NEVER: Gerar UPLOAD_TOKEN_SECRET diferente por worker

**❌ ERRO COMETIDO:**
- Cada worker Node.js gerava seu próprio `UPLOAD_TOKEN_SECRET`
- JWTs assinados em um worker não podiam ser validados em outro
- Uploads falhavam aleatoriamente dependendo de qual worker processava

**✅ SOLUÇÃO:**
```javascript
// ❌ NUNCA FAZER:
const UPLOAD_TOKEN_SECRET = crypto.randomBytes(32).toString('hex');

// ✅ SEMPRE FAZER:
const UPLOAD_TOKEN_SECRET = process.env.UPLOAD_TOKEN_SECRET || 'fallback-secret';
```

**📋 VALIDAÇÃO:**
- Garantir que `UPLOAD_TOKEN_SECRET` está nas variáveis de ambiente do Render
- Nunca gerar secrets dinamicamente em tempo de execução quando há múltiplos workers

**📅 Data do erro:** Identificado em 02/04/2026
**🔗 Commit da correção:** `ca537f3`

---

### 2. NEVER: Assumir que formato de JSON nunca muda

**❌ ERRO COMETIDO:**
- `kb-cache.js` assumia que `kb-documents.json` sempre seria array `[]`
- Em produção, arquivo tinha formato `{documents: []}`
- `this.cache.length` retornava `undefined`
- Logs mostravam "undefined documentos carregados"

**✅ SOLUÇÃO:**
```javascript
// ❌ NUNCA FAZER:
this.cache = JSON.parse(data);
console.log(`${this.cache.length} documentos`); // Quebra se data = {documents:[]}

// ✅ SEMPRE FAZER:
const parsed = JSON.parse(data);
if (Array.isArray(parsed)) {
  this.cache = parsed;
} else if (parsed && Array.isArray(parsed.documents)) {
  this.cache = parsed.documents; // Compatibilidade com formato legado
  console.log('⚠️ Convertendo formato legado');
} else {
  this.cache = [];
}
console.log(`${this.cache.length} documentos`);
```

**📋 VALIDAÇÃO:**
- Sempre suportar múltiplos formatos de dados legados
- Nunca assumir estrutura fixa sem validação
- Adicionar logs de conversão para detectar formatos inesperados

**📅 Data do erro:** Identificado em 04/04/2026
**🔗 Commit da correção:** `58cfadd`

---

### 3. NEVER: Retornar 302 redirect para API JSON

**❌ ERRO COMETIDO:**
- Middleware de auth retornava `302 redirect` para TODAS as rotas não autenticadas
- Frontend fazia polling em `/api/extraction-jobs/:id` esperando JSON
- Quando session expirava, recebia 302 redirect para `/login.html`
- `fetch()` seguia o redirect mas tipo de conteúdo era HTML
- Frontend interpretava como "erro 502"

**✅ SOLUÇÃO:**
```javascript
// ❌ NUNCA FAZER:
if (!req.isAuthenticated()) {
  return res.redirect('/login.html'); // Ruim para API routes
}

// ✅ SEMPRE FAZER:
if (!req.isAuthenticated()) {
  // Rotas /api/* SEMPRE retornam JSON
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({
      error: 'Não autenticado',
      message: 'Você precisa fazer login'
    });
  }
  // Rotas HTML podem fazer redirect
  return res.redirect('/login.html');
}
```

**📋 VALIDAÇÃO:**
- Toda rota `/api/*` DEVE retornar JSON, nunca HTML ou redirect
- Frontend deve enviar header `Accept: application/json`
- Testar expiry de session durante operações longas

**📅 Data do erro:** Identificado em 04/04/2026
**🔗 Commit da correção:** `8a7b7af`

---

### 4. NEVER: Esquecer backend URL no CSP

**❌ ERRO COMETIDO:**
- CSP `connect-src` tinha apenas `'self'` e cloudflare
- Frontend em `/` tentava fazer request para backend em `rom-agent-ia.onrender.com`
- Navegador bloqueava com erro de CSP
- Upload chunked falhava com "Failed to fetch"

**✅ SOLUÇÃO:**
```javascript
// ❌ NUNCA FAZER:
connectSrc: ["'self'", "https://static.cloudflareinsights.com"]

// ✅ SEMPRE FAZER:
connectSrc: [
  "'self'",
  "https://static.cloudflareinsights.com",
  "https://rom-agent-ia.onrender.com" // Backend URL
]
```

**📋 VALIDAÇÃO:**
- Sempre incluir TODOS os endpoints que frontend vai chamar
- Testar CSP em diferentes browsers (Chrome DevTools mostra violations)
- Validar headers com: `curl -I https://url | grep content-security-policy`

**📅 Data do erro:** Identificado em 04/04/2026
**🔗 Commit da correção:** `ee6e865`

---

### 5. NEVER: Usar `req.accepts('html')` sem check adicional para APIs

**❌ ERRO COMETIDO:**
- Middleware de auth usava `req.accepts('html')` para decidir se redireciona ou retorna JSON
- `req.accepts('html')` retorna `true` para `Accept: */*` (padrão de curl e alguns clients)
- Mesmo com check `if (req.path.startsWith('/api/'))` antes, rotas API retornavam 302
- Diagnósticos via curl falhavam: `/api/kb/documents` retornava 302 ao invés de 401 JSON

**✅ SOLUÇÃO:**
```javascript
// ❌ NUNCA FAZER:
if (req.path.startsWith('/api/')) {
  return res.status(401).json({...});
}
if (req.accepts('html')) {  // Problema: true para Accept: */*
  return res.redirect('/login.html');
}

// ✅ SEMPRE FAZER:
if (req.path.startsWith('/api/')) {
  return res.status(401).json({...});
}
// Apenas redirecionar se Accept header PREFERE HTML sobre JSON
const acceptHeader = req.get('Accept') || '';
const prefersHtml = acceptHeader.includes('text/html') && !acceptHeader.includes('application/json');
if (prefersHtml) {
  return res.redirect('/login.html');
}
// Fallback para JSON
return res.status(401).json({...});
```

**📋 VALIDAÇÃO:**
- Testar com `curl` sem headers: deve retornar 401 JSON, não 302
- Testar com `curl -H "Accept: text/html"`: pode retornar 302
- Testar com `curl -H "Accept: application/json"`: deve retornar 401 JSON
- Scripts de diagnóstico devem funcionar sem adicionar headers

**📅 Data do erro:** Identificado em 04/04/2026 23:06
**🔗 Commit da correção:** a553da8
**📝 Observação:** Bug descoberto durante validação exaustiva do fluxo Upload → Chat

---

### 6. NEVER: Permitir upload sem autenticação (userId divergence)

**❌ ERRO COMETIDO:**
- Upload permitido sem login criava documentos com `userId = 'web-upload'`
- Chat sem login buscava com `userId = 'anonymous'`
- Filtro `allDocs.filter(doc => doc.userId === userId)` retornava zero docs
- Chat não conseguia acessar documentos que foram uploaded sem login

**✅ SOLUÇÃO:**
```javascript
// ❌ NUNCA FAZER:
app.post('/api/upload-documents', upload.array('files', 20), async (req, res) => {
  // ... aceita upload sem autenticação
  userId: req.session?.user?.id || 'web-upload'  // Problema!
});

// ✅ SEMPRE FAZER:
app.post('/api/upload-documents', requireAuth, upload.array('files', 20), async (req, res) => {
  // requireAuth garante req.session.user.id existe
  userId: req.session.user.id  // Sempre ID válido
});
```

**📋 VALIDAÇÃO:**
- Todas rotas de upload devem ter `requireAuth`:
  - `/api/upload-documents`
  - `/api/upload`
  - `/api/upload/base64`
- Rotas chunked já usam `requireUploadToken`
- userId em documentos do KB sempre será ID real de usuário
- Chat sempre encontrará documentos do mesmo usuário

**📅 Data do erro:** Identificado em 04/04/2026 23:00
**🔗 Commit da correção:** 74dfbbe
**📝 Observação:** Bug CRÍTICO descoberto em investigação forense completa do fluxo Upload → KB → Chat

---

### 7. NEVER: Checar apenas `req.path` em middlewares de rotas montadas

**❌ ERRO COMETIDO:**
- Middleware `requireAuth` verificava `req.path.startsWith('/api/')` para decidir se retorna JSON ou redirect
- Quando router é montado com `app.use('/api', router)`, o `req.path` DENTRO do router NÃO inclui o prefixo `/api`
- Exemplo: `/api/extraction-jobs/123` tem `req.path = '/extraction-jobs/123'` (sem `/api`)
- Check `req.path.startsWith('/api/')` retornava `false`, causando redirect 302 em vez de 401 JSON
- Frontend fazia polling em `/api/extraction-jobs/:id`, recebia 302 redirect → erro 502

**✅ SOLUÇÃO:**
```javascript
// ❌ NUNCA FAZER:
if (req.path.startsWith('/api/')) {
  return res.status(401).json({...});
}
// Falha quando router é montado com app.use('/api', router)

// ✅ SEMPRE FAZER:
const isApiRoute = req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/');
if (isApiRoute) {
  return res.status(401).json({...});
}
// req.originalUrl sempre contém o path completo, incluindo prefixos de routers montados
```

**📋 VALIDAÇÃO:**
- Sempre usar `req.originalUrl` quando precisar do path completo
- `req.path` pode ser diferente quando router é montado com prefixo
- Testar endpoints de routers montados: `curl /api/extraction-jobs/123` deve retornar 401 JSON, não 302
- Verificar logs de frontend: não deve reportar "502 Bad Gateway" para endpoints autenticados

**📅 Data do erro:** Identificado em 05/04/2026 00:09
**🔗 Commit da correção:** (em andamento)
**📝 Observação:** Bug causava "502 errors" falsos em polling de status de extração. Cliente reportou erro durante upload ativo.

---

## ✅ CHECKLIST PRÉ-DEPLOY

Use este checklist ANTES de cada deploy:

### Segurança
- [ ] CSP inclui todas as URLs necessárias (backend, CDNs, analytics)
- [ ] Secrets NÃO são gerados dinamicamente (usar env vars)
- [ ] API routes retornam JSON 401, não 302 redirect
- [ ] Headers CORS estão corretos

### Autenticação
- [ ] Session handling funcionando
- [ ] JWT secrets são compartilhados entre workers
- [ ] Timeout de session é apropriado para operações longas
- [ ] Frontend detecta e trata session expirada

### Upload de Arquivos
- [ ] Chunked upload testado com arquivo > 100MB
- [ ] JWT authentication funcionando
- [ ] Mesclagem de chunks testada
- [ ] Cleanup de arquivos temporários

### KB (Knowledge Base)
- [ ] kb-cache.js suporta múltiplos formatos JSON
- [ ] Logs não mostram "undefined documentos"
- [ ] Chat consegue acessar documentos uploaded
- [ ] Documentos persistem após logout/login

### Frontend
- [ ] Dist limpo antes de build (`rm -rf frontend/dist`)
- [ ] Bundle verificado (não tem código antigo)
- [ ] Tratamento de erro 401/302 implementado
- [ ] Polling respeita timeout de session

### Testes
- [ ] Executar `./scripts/autonomous-test-fix-loop.sh`
- [ ] Executar `./scripts/test-kb-end-to-end.sh`
- [ ] Verificar logs: `render logs -r srv-... --tail`
- [ ] Testar manualmente upload + extração + chat

---

## 🔍 ARMADILHAS CONHECIDAS

### Armadilha #1: Deploy com Dist Antigo

**Problema:**
- `npm run build` não limpa `dist/` automaticamente
- Código antigo pode permanecer no bundle
- Deploy sobe com código misturado (novo + antigo)

**Solução:**
```bash
# SEMPRE fazer antes de build:
rm -rf frontend/dist
npm run build
```

**Automação:**
Adicionar ao `package.json`:
```json
{
  "scripts": {
    "prebuild": "rm -rf frontend/dist",
    "build": "vite build"
  }
}
```

---

### Armadilha #2: Logs Antigos em Testes

**Problema:**
- `render logs` retorna logs de DIAS atrás
- Testes podem passar/falhar baseado em logs antigos
- Falsos positivos/negativos

**Solução:**
```bash
# ❌ NUNCA:
render logs -r srv-xxx --text "KB Cache" | tail -5

# ✅ SEMPRE:
TODAY=$(date +%Y-%m-%d)
render logs -r srv-xxx --text "KB Cache" | grep "$TODAY" | tail -5
```

---

### Armadilha #3: Múltiplos Workers Diferentes Estados

**Problema:**
- 4 workers Node.js podem estar em estados diferentes
- Worker 1 tem código novo, worker 2-4 têm código antigo
- Behavior inconsistente

**Solução:**
- Aguardar 2-3 minutos após deploy
- Validar logs de TODOS workers
- Forçar restart: `render services restart srv-xxx`

---

### Armadilha #4: Formato de JSON Legado

**Problema:**
- Produção pode ter JSON em formatos antigos
- Código novo assume formato novo
- Quebra ao fazer parse

**Solução:**
```javascript
// SEMPRE suportar formatos legados:
const parsed = JSON.parse(data);
if (isNewFormat(parsed)) {
  return parseNew(parsed);
} else if (isLegacyFormat(parsed)) {
  console.log('⚠️ Legacy format detected, converting...');
  return convertLegacy(parsed);
} else {
  console.error('Unknown format, using default');
  return getDefault();
}
```

---

## 📊 HISTÓRICO DE REGRESSÕES

### Regressão #1: Perda de Upload Functionality

**Data:** ~01-03/04/2026
**O que aconteceu:**
- Tínhamos upload de 221MB funcionando
- Após alguns deploys, parou de funcionar
- Usuário reportou: "antes pelo menos mesclava e subia o arquivo"

**Causa Raiz:**
- Deploy sem limpar dist/
- CSP modificado sem incluir backend URL
- UPLOAD_TOKEN_SECRET diferente por worker

**Lição:**
- NUNCA deploy sem executar checklist completo
- SEMPRE testar upload após deploy
- VALIDAR que funcionalidades antigas continuam funcionando

---

### Regressão #2: Chat Não Acessa KB

**Data:** Desde quinta ~28/03/2026
**O que aconteceu:**
- Upload e extração funcionavam
- Documentos apareciam em "Upload & KB"
- Mas chat não conseguia acessá-los
- Após logout/login, acesso era perdido

**Causa Raiz:**
- Arquivos salvos em pasta temporária/global
- Não persistiam em diretório permanente
- kb-cache.js com bug "undefined documentos"
- Chat não buscava no lugar certo

**Status Atual:**
- ✅ kb-cache.js corrigido
- ⚠️ Persistência de arquivos ainda precisa validação manual

**Lição:**
- SEMPRE testar fluxo completo: upload → logout → login → chat
- VALIDAR persistência de dados
- NUNCA assumir que "funcionou uma vez" = "sempre funcionará"

---

## 🎯 PRÓXIMAS AÇÕES OBRIGATÓRIAS

Antes de considerar o sistema "pronto":

1. [ ] **Validação de Persistência**
   - Upload documento
   - Logout e Login
   - Verificar que documento AINDA está lá
   - Chat consegue acessar

2. [ ] **Migração de kb-documents.json**
   - Converter de `{documents:[]}` para `[]`
   - Evitar log de "convertendo formato legado"

3. [ ] **Testes E2E Automatizados**
   - Playwright/Puppeteer
   - Upload → Extração → Chat → Logout → Login → Chat
   - Executar em CI/CD antes de cada deploy

4. [ ] **Monitoramento em Produção**
   - Sentry para error tracking
   - Logs estruturados (JSON)
   - Alertas para "undefined", "erro 502", "failed to fetch"

---

## 📖 DOCUMENTOS RELACIONADOS

- `RELATORIO-FINAL-*.md` - Relatório detalhado de cada sessão
- `scripts/autonomous-test-fix-loop.sh` - Testes automatizados
- `scripts/test-kb-end-to-end.sh` - Validação end-to-end
- `scripts/continuous-monitor.sh` - Monitor de logs em tempo real

---

## 🔗 RECURSOS ÚTEIS

### Comandos Essenciais

```bash
# Ver logs em tempo real
render logs -r srv-d51ppfmuk2gs73a1qlkg --tail

# Ver últimos deploys
render deploys list srv-d51ppfmuk2gs73a1qlkg

# Forçar restart
render services restart srv-d51ppfmuk2gs73a1qlkg

# Executar testes
./scripts/autonomous-test-fix-loop.sh
./scripts/test-kb-end-to-end.sh

# Monitor contínuo
./scripts/continuous-monitor.sh &
```

### Debug de Problemas

```bash
# KB Cache mostrando undefined?
render logs -r srv-xxx --text "KB Cache" | grep "$(date +%Y-%m-%d)"

# Upload falhando?
render logs -r srv-xxx --text "chunked" | tail -50

# Chat não encontra documentos?
render logs -r srv-xxx --text "KB DEBUG" | tail -50

# CSP blocking?
curl -I https://rom-agent-ia.onrender.com/ | grep content-security-policy
```

---

## ⚠️ AVISOS IMPORTANTES

### ⛔ NUNCA FAÇA ISSO:

1. ❌ Deploy sem executar checklist
2. ❌ Commit sem testar localmente
3. ❌ Modificar security-headers.js sem validar CSP
4. ❌ Mudar formato de JSON sem backward compatibility
5. ❌ Gerar secrets dinamicamente com múltiplos workers
6. ❌ Build frontend sem limpar dist/
7. ❌ Assumir que deploy funcionou sem validar logs

### ✅ SEMPRE FAÇA ISSO:

1. ✅ Consultar este documento antes de commit/deploy
2. ✅ Executar testes automatizados
3. ✅ Validar logs após deploy
4. ✅ Testar upload completo (pequeno, médio, grande)
5. ✅ Testar persistência (logout/login)
6. ✅ Verificar que funcionalidades antigas ainda funcionam
7. ✅ Documentar novos erros encontrados AQUI

---

## 📝 TEMPLATE PARA NOVOS ERROS

Quando encontrar um novo erro, adicione aqui seguindo este formato:

```markdown
### X. NEVER: [Descrição curta do erro]

**❌ ERRO COMETIDO:**
- [O que foi feito de errado]
- [Consequências observadas]

**✅ SOLUÇÃO:**
```[language]
// ❌ NUNCA FAZER:
[código errado]

// ✅ SEMPRE FAZER:
[código correto]
```

**📋 VALIDAÇÃO:**
- [Como validar que o problema está resolvido]
- [Testes necessários]

**📅 Data do erro:** [DD/MM/YYYY]
**🔗 Commit da correção:** `[hash]`
```

---

**Mantenha este documento atualizado.**
**Sua experiência de debug pode poupar HORAS de trabalho futuro.**

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
