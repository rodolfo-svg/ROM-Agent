# Arquitetura Atual do Sistema de Upload - ROM Agent

**Versao:** v4.0.2
**Data:** 2026-04-02
**Status:** Producao Ativa

## Sumario Executivo

O sistema de upload do ROM Agent implementa uma arquitetura hibrida que suporta tanto uploads normais (arquivos pequenos) quanto uploads chunked (arquivos grandes). A solucao resolve problemas criticos de autenticacao cross-origin entre frontend (iarom.com.br) e backend (rom-agent-ia.onrender.com) usando tokens JWT temporarios.

### Caracteristicas Principais

- **Upload Normal:** Arquivos < 80MB total via FormData
- **Upload Chunked:** Arquivos > 80MB via chunks de 40MB
- **Autenticacao Cross-Origin:** Tokens JWT com validade de 1 hora
- **Persistencia de Sessoes:** Sessoes salvas em disco (/var/data) que sobrevivem a restarts
- **Timeout Extenso:** 30 minutos para uploads lentos
- **Rate Limiting Adaptado:** 60 req/min, 500 req/hora

---

## 1. Fluxo Completo de Upload

### 1.1 Diagrama do Fluxo

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (iarom.com.br)                                         │
│                                                                 │
│ 1. Usuario seleciona arquivos                                  │
│    VolumeUploader.tsx detecta: totalSize > 80MB?               │
│                                                                 │
│    ┌─────────────────────┬─────────────────────┐               │
│    │ totalSize < 80MB    │ totalSize > 80MB    │               │
│    │ Upload Normal       │ Upload Chunked      │               │
│    └─────────────────────┴─────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ UPLOAD CHUNKED FLOW                                             │
│                                                                 │
│ FASE 0: Obter Token JWT                                        │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ GET /api/upload/get-upload-token                        │   │
│ │ Headers: Cookie (session)                               │   │
│ │ Response: { token: "jwt...", expiresIn: "1h" }         │   │
│ └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│ FASE 1: Upload de Cada Arquivo                                │
│                                                                 │
│ Para cada arquivo:                                             │
│                                                                 │
│ 1.1 Iniciar Sessao                                             │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ POST https://rom-agent-ia.onrender.com/                │   │
│ │      api/upload/chunked/init                            │   │
│ │ Headers: Authorization: Bearer {uploadToken}            │   │
│ │ Body: { filename, fileSize, contentType }               │   │
│ │ Response: { uploadId, totalChunks, chunkSize: 40MB }   │   │
│ └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│ 1.2 Upload de Chunks                                           │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ Para chunkIndex = 0 até totalChunks-1:                 │   │
│ │                                                         │   │
│ │ POST https://rom-agent-ia.onrender.com/                │   │
│ │      api/upload/chunked/{uploadId}/chunk/{chunkIndex}  │   │
│ │ Headers: Authorization: Bearer {uploadToken}            │   │
│ │ Body: Binary data (40MB max)                           │   │
│ │ Response: { progress: "75.0%", complete: false }       │   │
│ └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│ 1.3 Finalizar Upload                                           │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ POST https://rom-agent-ia.onrender.com/                │   │
│ │      api/upload/chunked/{uploadId}/finalize             │   │
│ │ Headers: Authorization: Bearer {uploadToken}            │   │
│ │ Response: { success: true, path: "/var/data/..." }     │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ FASE 2: Mesclar Volumes (se aplicavel)                         │
│                                                                 │
│ POST /api/kb/merge-volumes/from-paths                          │
│ Headers: Cookie (session normal)                               │
│ Body: { paths: [...uploadedPaths], processName }               │
│ Response: { success: true, mergedDocument: {...} }             │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Deteccao Automatica do Modo

O frontend decide automaticamente qual fluxo usar:

```typescript
// VolumeUploader.tsx (linhas 62-67)
const totalSize = files.reduce((acc, f) => acc + f.file.size, 0)
const hasLargeFile = files.some(f => f.file.size > 50 * 1024 * 1024)
const CHUNKED_THRESHOLD = 80 * 1024 * 1024 // 80MB

if (hasLargeFile || totalSize > CHUNKED_THRESHOLD) {
  // Usar CHUNKED UPLOAD
} else {
  // Usar UPLOAD NORMAL
}
```

---

## 2. Arquivos Criticos

### 2.1 Frontend

#### `/frontend/src/components/kb/VolumeUploader.tsx`

**Linhas Criticas:**

- **11:** `CHUNKED_UPLOAD_BASE_URL = 'https://rom-agent-ia.onrender.com'`
  - URL direta para backend (bypass Cloudflare/proxy)

- **65:** `CHUNKED_THRESHOLD = 80 * 1024 * 1024` (80MB)
  - Threshold para ativar chunked upload

- **72-82:** Obtencao de token JWT
  ```typescript
  const tokenResponse = await fetch('/api/upload/get-upload-token', {
    method: 'GET',
    credentials: 'include', // Usa session cookie normal
  })
  const { token: uploadToken } = await tokenResponse.json()
  ```

- **91:** `CHUNK_SIZE = 40 * 1024 * 1024` (40MB)
  - Tamanho de cada chunk

- **94-105:** Inicializacao chunked
- **121-132:** Upload de chunk individual
- **135-144:** Finalizacao do upload

### 2.2 Backend - Middleware

#### `/src/middleware/security-headers.js`

**Configuracao CSP Critica:**

```javascript
// Linha 10: connectSrc DEVE incluir backend direto
connectSrc: [
  "'self'",
  "https://static.cloudflareinsights.com",
  "https://rom-agent-ia.onrender.com"  // CRITICO para chunked upload
]
```

**Por que isso e necessario:**
- Frontend em `iarom.com.br` faz requests para `rom-agent-ia.onrender.com`
- CSP bloquearia sem esta excecao explicita
- Cloudflare nao pode ser usado como intermediario (limites HTTP/2)

#### `/src/middleware/upload-token.js`

**Geracao de Token JWT:**

```javascript
// Linhas 31-52
function generateUploadToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    purpose: 'chunked-upload',
    iat: Math.floor(Date.now() / 1000),
  }

  return jwt.sign(payload, UPLOAD_TOKEN_SECRET, {
    expiresIn: '1h',      // Token expira em 1 hora
    issuer: 'rom-agent-api',
    subject: user.id.toString(),
  })
}
```

**Validacao de Token:**

```javascript
// Linhas 58-124
function requireUploadToken(req, res, next) {
  // 1. Extrair token do header Authorization
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token ausente' })
  }

  const token = authHeader.substring(7) // Remove "Bearer "

  // 2. Verificar assinatura e expiracao
  const decoded = jwt.verify(token, UPLOAD_TOKEN_SECRET, {
    issuer: 'rom-agent-api',
  })

  // 3. Validar proposito
  if (decoded.purpose !== 'chunked-upload') {
    return res.status(403).json({ error: 'Token invalido' })
  }

  // 4. Anexar usuario ao request
  req.user = {
    id: decoded.userId,
    email: decoded.email,
  }

  next()
}
```

**Secret Management:**

```javascript
// Linhas 18-22
const UPLOAD_TOKEN_SECRET = process.env.UPLOAD_TOKEN_SECRET ||
  (process.env.SESSION_SECRET
    ? crypto.createHash('sha256')
        .update(process.env.SESSION_SECRET + '-upload')
        .digest('hex')
    : throw new Error('SESSION_SECRET required')
  )
```

### 2.3 Backend - Rotas

#### `/src/server-enhanced.js`

**Endpoint 1: Gerar Token (linhas 3322-3352)**

```javascript
app.get('/api/upload/get-upload-token', requireAuth, generalLimiter, (req, res) => {
  // requireAuth valida session cookie normal
  // Gera token JWT para uso em chunked upload
  const token = generateUploadToken(req.session.user)

  res.json({
    success: true,
    token,
    expiresIn: '1h',
    user: { id: req.session.user.id, email: req.session.user.email }
  })
})
```

**Endpoint 2: Iniciar Sessao Chunked (linhas 3364-3395)**

```javascript
app.post('/api/upload/chunked/init', requireUploadToken, uploadLimiter, async (req, res) => {
  // requireUploadToken valida token JWT
  const { filename, fileSize, contentType } = req.body

  const result = await chunkedUpload.initSession(filename, fileSize, contentType)

  res.json({
    success: true,
    uploadId: result.uploadId,
    totalChunks: result.totalChunks,
    chunkSize: result.chunkSize, // 40MB
  })
})
```

**Endpoint 3: Upload de Chunk (linhas 3404-3474)**

```javascript
app.post('/api/upload/chunked/:uploadId/chunk/:chunkIndex', requireUploadToken, uploadLimiter, async (req, res) => {
  const { uploadId, chunkIndex } = req.params

  // Receber dados binarios via stream
  const chunks = []
  req.on('data', chunk => chunks.push(chunk))
  req.on('end', async () => {
    const chunkData = Buffer.concat(chunks)
    const result = await chunkedUpload.uploadChunk(uploadId, parseInt(chunkIndex), chunkData)

    res.json({
      success: true,
      progress: result.progress,
      complete: result.complete,
    })
  })
})
```

**Endpoint 4: Finalizar Upload (linhas 3482-3508)**

```javascript
app.post('/api/upload/chunked/:uploadId/finalize', requireUploadToken, uploadLimiter, async (req, res) => {
  const { uploadId } = req.params

  const result = await chunkedUpload.finalizeUpload(uploadId)

  res.json({
    success: true,
    filename: result.filename,
    fileSize: result.fileSize,
    path: result.path, // /var/data/upload/temp/{uploadId}_{filename}
  })
})
```

### 2.4 Backend - Logica de Chunked Upload

#### `/lib/chunked-upload.js`

**Configuracao de Diretorios (linhas 15-19):**

```javascript
const CHUNK_SIZE = 40 * 1024 * 1024 // 40MB por chunk
const UPLOAD_DIR = '/var/data/upload/chunks'    // Chunks individuais
const TEMP_DIR = '/var/data/upload/temp'        // Arquivo final montado
const SESSIONS_DIR = '/var/data/upload/sessions' // Sessoes persistentes (JSON)
```

**Persistencia de Sessoes:**

```javascript
// Salvar sessao no disco (sobrevive a restarts)
async saveSession(uploadId, sessionData) {
  const sessionPath = path.join(SESSIONS_DIR, `${uploadId}.json`)
  await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2))
}

// Carregar sessao do disco
async loadSession(uploadId) {
  const sessionPath = path.join(SESSIONS_DIR, `${uploadId}.json`)
  const data = await fs.readFile(sessionPath, 'utf-8')
  return JSON.parse(data)
}
```

**Montagem do Arquivo Final (linhas 161-244):**

```javascript
async finalizeUpload(uploadId) {
  const session = await this.loadSession(uploadId)

  // Verificar se todos os chunks foram enviados
  if (uploadedChunks.size !== session.totalChunks) {
    throw new Error(`Upload incompleto`)
  }

  const finalPath = path.join(TEMP_DIR, `${uploadId}_${session.filename}`)
  const writeStream = createWriteStream(finalPath)

  // Montar arquivo processando 1 chunk por vez (evita EMFILE)
  for (let i = 0; i < session.totalChunks; i++) {
    const chunkPath = path.join(UPLOAD_DIR, `${uploadId}_chunk_${i}`)
    const readStream = createReadStream(chunkPath)

    // Pipeline com backpressure automatico
    await pipeline(readStream, writeStream, { end: false })

    // Limpar chunk apos escrita
    await fs.unlink(chunkPath)
  }

  writeStream.end()

  // Validar tamanho do arquivo final
  const stats = await fs.stat(finalPath)
  if (stats.size !== session.fileSize) {
    throw new Error(`Tamanho nao corresponde`)
  }

  return { path: finalPath, filename: session.filename }
}
```

---

## 3. Configuracoes Importantes

### 3.1 Content Security Policy (CSP)

**Arquivo:** `/src/middleware/security-headers.js`

**Diretiva Critica:**

```javascript
connectSrc: [
  "'self'",                                   // Permite mesma origem
  "https://static.cloudflareinsights.com",    // Analytics Cloudflare
  "https://rom-agent-ia.onrender.com"         // CRITICO: Backend direto para chunked upload
]
```

**Por que `rom-agent-ia.onrender.com` deve estar aqui:**

1. Frontend em `iarom.com.br` (via Cloudflare Pages)
2. Backend em `rom-agent-ia.onrender.com` (Render)
3. CSP default bloquearia requests cross-origin
4. Cloudflare nao pode intermediar (limites HTTP/2 para uploads grandes)
5. Solucao: permitir explicitamente backend direto no CSP

### 3.2 Servicos Render

**Arquivo:** `/render.yaml`

#### Servico de Producao

```yaml
services:
  - type: web
    name: rom-agent
    branch: main                    # Deploy automatico do branch main
    plan: pro                        # 4GB RAM

    domains:
      - iarom.com.br
      - www.iarom.com.br

    envVars:
      - key: WEB_CONCURRENCY
        value: 4                     # 4 workers × 800MB = 3.2GB

      - key: MAX_BODY_SIZE
        value: 1100mb                # Suporta arquivos ate 1GB

      - key: MAX_FILE_SIZE
        value: 1000mb

      - key: REQUEST_TIMEOUT
        value: 1800000               # 30 minutos (30 × 60 × 1000ms)

      - key: RATE_LIMIT_PER_MINUTE
        value: 60                    # ~4 uploads de 500MB simultaneos

      - key: RATE_LIMIT_PER_HOUR
        value: 500                   # ~30 uploads de 500MB por hora

    disk:
      mountPath: /var/data
      sizeGB: 100                    # 100GB para multiplos uploads
```

#### Servico de Staging

```yaml
  - type: web
    name: rom-agent-staging
    branch: staging                  # Deploy automatico do branch staging
    plan: standard                   # 2GB RAM

    envVars:
      - key: DATABASE_SCHEMA
        value: staging               # Schema separado no mesmo DB
```

**Importante:** Ambos os servicos usam o mesmo banco PostgreSQL, mas schemas diferentes.

### 3.3 Chunk Size e Timeouts

**Chunk Size:** 40MB
- Definido em: `VolumeUploader.tsx` (linha 91) e `chunked-upload.js` (linha 15)
- Razao: Otimizado para Render (evita timeout de 30s por request)
- Trade-off: Chunks menores = mais requests, mas menos chance de timeout

**Timeout de Request:** 30 minutos (1.800.000ms)
- Definido em: `render.yaml` (linha 139)
- Permite uploads lentos de arquivos ate 1GB
- Calculo: 1GB / 40MB = 25 chunks × ~1min/chunk = ~25min total

**Timeout de Upload Token:** 1 hora
- Definido em: `upload-token.js` (linha 24)
- Permite uploads de multiplos arquivos grandes sem re-autenticacao
- Usuario pode fazer pausas entre uploads

### 3.4 Rate Limiting

**Configuracao Atual:**

```yaml
RATE_LIMIT_PER_MINUTE: 60    # 60 requests/minuto
RATE_LIMIT_PER_HOUR: 500     # 500 requests/hora
```

**Calculo para Uploads Grandes:**

- Arquivo de 500MB = 500MB / 40MB = 13 chunks
- 13 chunks + 1 init + 1 finalize = **15 requests por upload**
- 60 req/min permite **4 uploads simultaneos de 500MB**
- 500 req/hora permite **~30 uploads de 500MB por hora**

**Por que nao aumentar mais:**
- Protecao contra ataques DDoS
- Limite de disco: 100GB / 500MB = 200 uploads simultaneos (irreal)
- Limite de RAM: 4GB / worker com 4 workers
- Taxa atual ja e generosa para uso legitimo

---

## 4. Endpoints Completos

### 4.1 GET /api/upload/get-upload-token

**Autenticacao:** `requireAuth` (session cookie)
**Rate Limiting:** `generalLimiter`
**Proposito:** Gerar token JWT para autenticacao cross-origin

**Request:**
```http
GET /api/upload/get-upload-token HTTP/1.1
Host: iarom.com.br
Cookie: connect.sid=s%3A...
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "1h",
  "user": {
    "id": 123,
    "email": "user@example.com"
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Usuário não autenticado",
  "message": "Faça login antes de solicitar um token de upload"
}
```

### 4.2 POST /api/upload/chunked/init

**Autenticacao:** `requireUploadToken` (Bearer token)
**Rate Limiting:** `uploadLimiter`
**Proposito:** Iniciar sessao de upload chunked

**Request:**
```http
POST /api/upload/chunked/init HTTP/1.1
Host: rom-agent-ia.onrender.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "filename": "processo_vol1.pdf",
  "fileSize": 157286400,
  "contentType": "application/pdf"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "uploadId": "a1b2c3d4e5f6g7h8i9j0",
  "totalChunks": 4,
  "chunkSize": 41943040
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Token de upload ausente ou inválido",
  "message": "Use o endpoint /api/upload/get-upload-token para obter um token válido"
}
```

### 4.3 POST /api/upload/chunked/:uploadId/chunk/:chunkIndex

**Autenticacao:** `requireUploadToken` (Bearer token)
**Rate Limiting:** `uploadLimiter`
**Proposito:** Upload de um chunk individual

**Request:**
```http
POST /api/upload/chunked/a1b2c3d4e5f6g7h8i9j0/chunk/0 HTTP/1.1
Host: rom-agent-ia.onrender.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/octet-stream

[Binary data - 40MB max]
```

**Response (200 OK):**
```json
{
  "success": true,
  "uploadId": "a1b2c3d4e5f6g7h8i9j0",
  "chunkIndex": 0,
  "totalChunks": 4,
  "uploadedChunks": 1,
  "progress": "25.00",
  "complete": false
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Sessão de upload não encontrada - verifique se o /init foi executado"
}
```

### 4.4 POST /api/upload/chunked/:uploadId/finalize

**Autenticacao:** `requireUploadToken` (Bearer token)
**Rate Limiting:** `uploadLimiter`
**Proposito:** Finalizar upload e montar arquivo completo

**Request:**
```http
POST /api/upload/chunked/a1b2c3d4e5f6g7h8i9j0/finalize HTTP/1.1
Host: rom-agent-ia.onrender.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "uploadId": "a1b2c3d4e5f6g7h8i9j0",
  "filename": "processo_vol1.pdf",
  "contentType": "application/pdf",
  "fileSize": 157286400,
  "path": "/var/data/upload/temp/a1b2c3d4e5f6g7h8i9j0_processo_vol1.pdf",
  "filePath": "/var/data/upload/temp/a1b2c3d4e5f6g7h8i9j0_processo_vol1.pdf"
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Upload incompleto: 3/4 chunks"
}
```

---

## 5. Seguranca e Autenticacao

### 5.1 Fluxo de Autenticacao

```
┌────────────────────────────────────────────────────────────────┐
│ USUARIO FAZ LOGIN                                              │
│ POST /api/auth/login                                           │
│ Response: Set-Cookie: connect.sid=...                          │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│ SESSAO ARMAZENADA NO POSTGRESQL                                │
│ Tabela: sessions                                               │
│ { sid, sess: { user: { id, email, ... } }, expire }          │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│ FRONTEND SOLICITA TOKEN JWT                                    │
│ GET /api/upload/get-upload-token                               │
│ Headers: Cookie: connect.sid=...                               │
│                                                                 │
│ Backend valida sessao (requireAuth)                            │
│ Backend gera token JWT assinado                                │
│ Response: { token: "jwt..." }                                  │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│ FRONTEND USA TOKEN JWT PARA CHUNKED UPLOAD                     │
│ POST /api/upload/chunked/init                                  │
│ Headers: Authorization: Bearer {token}                         │
│                                                                 │
│ Backend valida token JWT (requireUploadToken)                  │
│ Backend verifica assinatura, expiracao, proposito              │
│ Backend anexa user ao request: req.user = { id, email }       │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 Por que Dois Metodos de Autenticacao?

**Session Cookie (`connect.sid`):**
- Usado para navegacao normal no site
- Armazenado no PostgreSQL (compartilhado entre workers)
- Funciona bem dentro do mesmo dominio
- **NAO funciona cross-origin** (iarom.com.br → rom-agent-ia.onrender.com)

**JWT Token (`Bearer {token}`):**
- Gerado sob demanda para uploads chunked
- Auto-contido (nao precisa de banco)
- **Funciona cross-origin** (header Authorization)
- Validade curta (1 hora) para seguranca
- Proposito especifico (`chunked-upload`)

### 5.3 Validacao de Token JWT

**Verificacoes Realizadas:**

1. **Formato:** Header deve ser `Authorization: Bearer {token}`
2. **Assinatura:** Token deve ser assinado com `UPLOAD_TOKEN_SECRET`
3. **Expiracao:** Token nao pode estar expirado (`exp` claim)
4. **Issuer:** Token deve ter `issuer: "rom-agent-api"`
5. **Proposito:** Token deve ter `purpose: "chunked-upload"`
6. **Subject:** Token deve ter `sub` igual ao user.id

**Codigo:**

```javascript
const decoded = jwt.verify(token, UPLOAD_TOKEN_SECRET, {
  issuer: 'rom-agent-api',
})

if (decoded.purpose !== 'chunked-upload') {
  return res.status(403).json({ error: 'Token inválido' })
}

req.user = {
  id: decoded.userId,
  email: decoded.email,
}
```

---

## 6. Tratamento de Erros

### 6.1 Erros Comuns e Solucoes

#### Token Expirado (401)

**Erro:**
```json
{
  "success": false,
  "error": "Token expirado",
  "message": "Por favor, obtenha um novo token de upload"
}
```

**Solucao:**
- Frontend deve detectar erro 401
- Re-executar `GET /api/upload/get-upload-token`
- Retomar upload com novo token

#### Sessao Nao Encontrada (404)

**Erro:**
```json
{
  "success": false,
  "error": "Sessão de upload não encontrada - verifique se o /init foi executado"
}
```

**Causa Possivel:**
- Upload iniciado mas sessao expirou (> 24h)
- Worker reiniciou mas sessao nao estava persistida (bug corrigido)
- uploadId invalido

**Solucao:**
- Re-executar `/init` para criar nova sessao
- Verificar logs do backend para detalhes

#### Upload Incompleto (400)

**Erro:**
```json
{
  "success": false,
  "error": "Upload incompleto: 3/4 chunks"
}
```

**Causa:**
- `/finalize` chamado antes de todos os chunks serem enviados

**Solucao:**
- Verificar resposta de cada `/chunk` para confirmar progresso
- Re-enviar chunks faltantes
- Chamar `/finalize` apenas quando `complete: true`

#### Tamanho Nao Corresponde (500)

**Erro:**
```json
{
  "success": false,
  "error": "Tamanho do arquivo não corresponde: esperado 157286400, obtido 157200000"
}
```

**Causa:**
- Chunks corrompidos durante transmissao
- Chunk duplicado ou faltante

**Solucao:**
- Re-enviar todos os chunks
- Verificar integridade dos chunks no frontend

### 6.2 Deploy em Andamento (502/504)

**Frontend trata especialmente:**

```typescript
// VolumeUploader.tsx (linhas 168-175)
if (mergeResponse.status === 502 || mergeResponse.status === 504) {
  throw new Error(
    'Servidor está processando ou em manutenção.\n\n' +
    '⏳ Deploy pode estar em andamento.\n' +
    '🔄 Aguarde 2-3 minutos e tente novamente.\n\n' +
    'Os arquivos já foram enviados com sucesso,\n' +
    'basta clicar em "Mesclar" novamente.'
  )
}
```

**Importante:** Arquivos ja foram enviados. Usuario pode clicar "Mesclar" novamente apos deploy.

---

## 7. Performance e Otimizacoes

### 7.1 Uso de Streams

**Problema:** Carregar arquivo de 500MB na memoria = crash

**Solucao:** Processar chunks usando streams

```javascript
// chunked-upload.js (linhas 186-202)
for (let i = 0; i < session.totalChunks; i++) {
  const chunkPath = path.join(UPLOAD_DIR, `${uploadId}_chunk_${i}`)
  const readStream = createReadStream(chunkPath)

  // Pipeline com backpressure automatico
  // Nao carrega tudo na memoria
  await pipeline(readStream, writeStream, { end: false })

  // Limpar chunk apos escrita (libera disco)
  await fs.unlink(chunkPath)
}
```

**Beneficios:**
- Memoria constante (~100MB) independente do tamanho do arquivo
- Backpressure automatico (pausar leitura se escrita lenta)
- Previne EMFILE (too many open files)

### 7.2 Persistencia de Sessoes

**Problema:** Worker reinicia → sessoes perdidas → usuario tem que re-enviar tudo

**Solucao:** Salvar sessoes em disco (`/var/data/upload/sessions`)

```javascript
// Salvar sessao
async saveSession(uploadId, sessionData) {
  const sessionPath = path.join(SESSIONS_DIR, `${uploadId}.json`)
  await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2))
}

// Carregar sessao (sobrevive a restarts)
async loadSession(uploadId) {
  const sessionPath = path.join(SESSIONS_DIR, `${uploadId}.json`)
  const data = await fs.readFile(sessionPath, 'utf-8')
  return JSON.parse(data)
}
```

**Beneficios:**
- Uploads grandes podem continuar apos restart
- Deploy nao interrompe uploads em andamento
- Sessoes limpas automaticamente apos 24h

### 7.3 Limpeza Automatica

```javascript
// chunked-upload.js (linhas 303-324)
async cleanOldSessions() {
  const now = Date.now()
  const maxAge = 24 * 60 * 60 * 1000 // 24 horas

  const files = await fs.readdir(SESSIONS_DIR)

  for (const file of files) {
    const uploadId = file.replace('.json', '')
    const session = await this.loadSession(uploadId)

    if (session && now - session.createdAt > maxAge) {
      console.log(`🧹 Limpando sessão antiga: ${uploadId}`)
      await this.cancelUpload(uploadId) // Remove chunks + sessao
    }
  }
}
```

**Chamado:** Periodicamente ou manualmente

---

## 8. Monitoramento e Logs

### 8.1 Logs do Frontend

**VolumeUploader.tsx:**

```javascript
console.log('[VolumeUploader] Arquivos grandes detectados (150.2 MB), usando CHUNKED UPLOAD')
console.log('🎫 [VolumeUploader v4.0.2] Obtendo token de upload...')
console.log('✅ [VolumeUploader] Token de upload obtido')
console.log('📦 [VolumeUploader] Uploading: processo_vol1.pdf (150.00 MB)')
console.log('   📤 Chunk 1/4')
console.log('   📤 Chunk 2/4')
console.log('   📤 Chunk 3/4')
console.log('   📤 Chunk 4/4')
console.log('   ✅ Upload completo: processo_vol1.pdf')
console.log('[VolumeUploader] Mesclando 2 volumes...')
```

### 8.2 Logs do Backend

**upload-token.js:**

```javascript
console.log('🎫 [UploadToken] Token gerado para user@example.com (válido por 1h)')
console.log('✅ [UploadToken] Token válido para user@example.com')
console.warn('⚠️ [UploadToken] Token expirado')
```

**chunked-upload.js:**

```javascript
console.log('📤 Nova sessão de upload: a1b2c3d4e5f6g7h8i9j0')
console.log('   Arquivo: processo_vol1.pdf (150.00 MB)')
console.log('   Total de chunks: 4')
console.log('   💾 Sessão salva em disco (sobrevive a restarts)')
console.log('   Chunk 1/4 recebido (25.0%)')
console.log('✅ Montando arquivo completo: processo_vol1.pdf')
console.log('   Total chunks: 4 (~150.00 MB)')
console.log('   Montado 4/4 chunks (100.0%)')
console.log('✅ Arquivo montado com sucesso: 150.00 MB')
```

### 8.3 Metricas Importantes

**Monitorar:**

- Taxa de sucesso de `/finalize` (deve ser > 95%)
- Tempo medio de upload por MB
- Numero de sessoes ativas
- Uso de disco (`/var/data/upload`)
- Erros 401 (tokens expirados)
- Erros 404 (sessoes perdidas)

**Comandos Uteis:**

```bash
# Ver sessoes ativas
ls -lh /var/data/upload/sessions/

# Ver chunks em upload
ls -lh /var/data/upload/chunks/

# Uso de disco
df -h /var/data

# Logs recentes
tail -n 100 /var/log/render.log | grep -E '\[UploadToken\]|\[ChunkedUpload\]'
```

---

## 9. Troubleshooting

### 9.1 CSP Bloqueando Requests

**Sintoma:** Erro no console do browser:
```
Refused to connect to 'https://rom-agent-ia.onrender.com'
because it violates the Content Security Policy directive "connect-src 'self'"
```

**Causa:** `rom-agent-ia.onrender.com` nao esta em `connectSrc`

**Solucao:** Verificar `/src/middleware/security-headers.js` linha 10

### 9.2 Token Invalido Apos Deploy

**Sintoma:** Erro 401 apos deploy

**Causa:** `UPLOAD_TOKEN_SECRET` mudou (se deriva de `SESSION_SECRET`)

**Solucao:**
1. Definir `UPLOAD_TOKEN_SECRET` fixo no Render
2. Ou frontend re-obtem token apos 401

### 9.3 Chunks Faltando Apos Restart

**Sintoma:** Erro "Upload incompleto" apos restart do worker

**Causa:** Chunks nao foram salvos em `/var/data` (bug corrigido)

**Solucao:** Verificar que `UPLOAD_DIR` aponta para `/var/data/upload/chunks`

### 9.4 EMFILE (Too Many Open Files)

**Sintoma:** Erro ao finalizar upload grande

**Causa:** Tentou abrir todos os chunks simultaneamente

**Solucao:** Ja corrigido - processa 1 chunk por vez com `for` loop sequencial

---

## 10. Proximos Passos e Melhorias

### 10.1 Curto Prazo (Prioridade Alta)

- [ ] **Progresso em Tempo Real:** WebSocket/SSE para mostrar progresso ao usuario
- [ ] **Resumable Uploads:** Permitir retomar upload apos interrupcao
- [ ] **Validacao de Hash:** MD5/SHA256 para validar integridade dos chunks
- [ ] **Compressao:** Comprimir chunks antes de enviar (gzip)

### 10.2 Medio Prazo (Prioridade Media)

- [ ] **Upload Paralelo:** Enviar multiplos chunks simultaneamente (HTTP/2)
- [ ] **Pre-signed URLs:** Usar S3 pre-signed URLs para upload direto
- [ ] **Metricas:** Dashboard com taxa de sucesso, tempo medio, etc.
- [ ] **Auto-retry:** Retry automatico de chunks falhados

### 10.3 Longo Prazo (Prioridade Baixa)

- [ ] **P2P Transfer:** WebRTC para transfer direto entre usuarios
- [ ] **CDN Upload:** Upload para CDN (Cloudflare R2, Bunny, etc.)
- [ ] **Deduplicate:** Detectar e deduplicate chunks identicos
- [ ] **Encryption:** Criptografar chunks em repouso

---

## Changelog

### v4.0.2 (2026-04-02)
- Autenticacao cross-origin via JWT tokens
- Persistencia de sessoes em disco
- Suporte a arquivos ate 1GB
- CSP ajustado para permitir backend direto

### v4.0.1 (2026-03-15)
- Chunked upload com 40MB por chunk
- Rate limiting adaptado
- Timeout de 30 minutos

### v4.0.0 (2026-03-01)
- Arquitetura hibrida (normal + chunked)
- Deteccao automatica baseada em tamanho
- Upload direto para backend (bypass Cloudflare)

---

## Contato e Suporte

**Equipe:** ROM Agent Dev Team
**Repositorio:** /Users/rodolfootaviopereiradamotaoliveira/ROM-Agent
**Producao:** https://iarom.com.br
**Staging:** https://rom-agent-staging.onrender.com

**Para reportar issues:**
1. Verificar logs do frontend (Console do Browser)
2. Verificar logs do backend (Render Dashboard)
3. Incluir `uploadId` e timestamp do erro
4. Descrever tamanho do arquivo e numero de chunks

---

**Fim da Documentacao**
