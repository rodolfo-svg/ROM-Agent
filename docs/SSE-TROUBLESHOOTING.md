# Troubleshooting: Server-Sent Events (SSE) no ROM Agent

## Problema Original

### Sintomas:
```log
[SSE] Conexão estabelecida com sucesso
[SSE] Erro na conexão: Event {type: "error", ...}
[SSE] ReadyState: 0
[SSE] Timeout (5s), fazendo fallback para polling
```

**ReadyState: 0** = `EventSource.CONNECTING` - Conexão nunca é estabelecida.

---

## Causa Raiz

### **CORS configurado incorretamente**

**Antes (❌ ERRADO):**
```javascript
// server-enhanced.js linha 299
app.use(cors()); // Configuração padrão
```

**Configuração padrão do cors():**
- ❌ Não permite `credentials: true`
- ❌ Não envia `Access-Control-Allow-Credentials` header
- ❌ EventSource com `withCredentials: true` falha

### **Por que SSE precisa de credentials?**

O frontend usa:
```javascript
const eventSource = new EventSource(url, {
  withCredentials: true  // ← Envia cookies de sessão
});
```

**Cookies são necessários para:**
- Autenticação do usuário (session cookie)
- CSRF token
- Identificar qual usuário está fazendo upload

---

## Solução Implementada

### **CORS configurado corretamente**

**Depois (✅ CORRETO):**
```javascript
// server-enhanced.js linha 299-316
app.use(cors({
  origin: [
    'https://iarom.com.br',
    'https://www.iarom.com.br',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,  // ✅ CRÍTICO: Permite cookies em SSE
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  exposedHeaders: ['Content-Type', 'Cache-Control', 'Connection']
}));
```

### **Mudanças críticas:**
1. ✅ `credentials: true` - Permite envio de cookies
2. ✅ `origin: [...]` - Lista explícita de origens permitidas (não pode ser "*" com credentials)
3. ✅ `exposedHeaders` - Headers SSE expostos ao frontend

---

## Como SSE Funciona no ROM Agent

### **Fluxo Completo:**

```
1. UPLOAD CHUNKED (Frontend)
   └─> POST /api/upload/chunked/init
   └─> POST /api/upload/chunked/:id/chunk/0
   └─> POST /api/upload/chunked/:id/chunk/1
   └─> ...
   └─> POST /api/upload/chunked/:id/finalize
       └─> POST /api/kb/process-uploaded

2. PROCESSAMENTO (Backend)
   └─> progressEmitter.startSession(uploadId)
   └─> Extração de texto (PDF → TXT)
   └─> progressEmitter.updateSession(uploadId, percent, stage)
   └─> Armazenamento no banco (PostgreSQL)
   └─> progressEmitter.completeSession(uploadId, result)

3. SSE STREAMING (Real-time)
   └─> EventSource conecta: GET /api/upload-progress/:uploadId/progress
   └─> Backend envia eventos:
       event: info
       data: {"percent": 20, "stage": "Extraindo página 5/25"}

       event: info
       data: {"percent": 100, "stage": "Concluído"}

       event: session-complete
       data: {"documentos": [...], "totalProcessados": 1}

4. FALLBACK POLLING (Se SSE falhar)
   └─> Frontend faz polling: GET /api/upload-progress/:uploadId/status
   └─> Backend retorna snapshot atual: {percent, stage, completed}
```

---

## Headers SSE Necessários

### **Backend deve enviar:**

```javascript
// Endpoint: /api/upload-progress/:uploadId/progress

// 1. Headers SSE
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache, no-transform');
res.setHeader('Connection', 'keep-alive');

// 2. Headers para proxies (Render, Cloudflare, Nginx)
res.setHeader('X-Accel-Buffering', 'no'); // Nginx no Render
res.setHeader('X-Content-Type-Options', 'nosniff'); // Cloudflare

// 3. Flush imediato de headers
res.flushHeaders();

// 4. CORS (já configurado globalmente)
res.setHeader('Access-Control-Allow-Origin', origin);
res.setHeader('Access-Control-Allow-Credentials', 'true');
```

---

## Testando SSE

### **1. Via Frontend (Produção)**
- Fazer upload de arquivo >80 MB
- Observar logs do navegador (Console)
- **Sucesso:** Não deve ver `[SSE] Erro na conexão`
- **Sucesso:** Deve ver mensagens de progresso em tempo real

### **2. Via curl (Manual)**

```bash
# Test SSE endpoint
curl -N -H "Accept: text/event-stream" \
  -H "Cookie: connect.sid=COPIAR_DO_NAVEGADOR" \
  https://iarom.com.br/api/upload-progress/upload_123/progress

# Deve retornar:
# event: info
# data: {"percent": 0, "stage": "Aguardando..."}
```

### **3. Via Browser DevTools**

```javascript
// Console do navegador
const es = new EventSource(
  'https://iarom.com.br/api/upload-progress/upload_123/progress',
  { withCredentials: true }
);

es.onopen = () => console.log('✅ SSE Conectado');
es.onerror = (e) => console.error('❌ SSE Erro:', e);
es.onmessage = (e) => console.log('📨 SSE Mensagem:', e.data);
```

---

## Troubleshooting

### **Erro: ReadyState 0 (CONNECTING)**

**Causa:** CORS não permite credentials
**Solução:** Verificar configuração do `cors()` em server-enhanced.js

### **Erro: ReadyState 2 (CLOSED)**

**Causa:** Conexão estabelecida mas fechou imediatamente
**Solução:**
- Verificar se backend está enviando headers corretos
- Verificar logs do servidor para erros

### **Erro: 401 Unauthorized**

**Causa:** Cookie de sessão não está sendo enviado
**Solução:**
- Verificar `credentials: true` no EventSource
- Verificar `credentials: true` no CORS
- Verificar se cookie `connect.sid` existe

### **Erro: Buffering (delay de 30-60s)**

**Causa:** Proxy (Render/Cloudflare) está fazendo buffer do SSE
**Solução:**
- Adicionar `X-Accel-Buffering: no` (Nginx)
- Adicionar `X-Content-Type-Options: nosniff` (Cloudflare)
- Chamar `res.flushHeaders()` imediatamente

---

## Monitoramento de SSE

### **Métricas Importantes:**

1. **Taxa de Sucesso SSE:** Meta >95%
   - Monitorar quantos uploads usam SSE vs polling
   - Logs: `[SSE] Cliente conectou` vs `[SSE] Timeout, fallback para polling`

2. **Tempo de Conexão:** Meta <2s
   - Tempo entre `new EventSource()` e primeiro evento recebido

3. **Taxa de Desconexão:** Meta <5%
   - Conexões que caem durante o upload
   - Logs: `[SSE] Erro na conexão`

### **Alertas Recomendados:**

```javascript
// Se SSE falha em >10% dos uploads
if (sseFailureRate > 0.10) {
  alert('CRÍTICO: SSE falhando em produção - verificar CORS e proxy');
}

// Se tempo de primeira mensagem >5s
if (sseFirstMessageDelay > 5000) {
  alert('AVISO: SSE lento - possível buffering de proxy');
}
```

---

## Referências

- [MDN: Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [MDN: EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [CORS with credentials](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#requests_with_credentials)
- [Render: SSE and WebSockets](https://render.com/docs/websockets)

---

**Última atualização:** 2026-02-03
**Versão ROM Agent:** 4.0.9+
**Status:** ✅ SSE funcionando com CORS corrigido
