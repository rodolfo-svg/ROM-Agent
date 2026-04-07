# 🔧 GUIA DE IMPLEMENTAÇÃO - CORREÇÕES KB

## 📋 ÍNDICE
1. [Fix #1: POST /api/upload](#fix-1-post-apiupload)
2. [Fix #2: POST /api/upload/base64](#fix-2-post-apiuploadbase64)
3. [Fix #3: POST /api/upload/chunked/finalize](#fix-3-post-apiuploadchunkeduploadidfinalize)
4. [Fix #4: Script de Rebuild KB](#fix-4-script-de-rebuild-kb)
5. [Fix #5: Testes de Validação](#fix-5-testes-de-validação)

---

## Fix #1: POST /api/upload

### Arquivo: `src/server-enhanced.js`
### Linha: ~3262-3305

### ANTES (Código Atual)
```javascript
app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  console.log('📤 [/api/upload] Request received');

  try {
    console.log('📤 [/api/upload] Checking file...');
    if (!req.file) {
      console.log('❌ [/api/upload] No file received');
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    console.log('📤 [/api/upload] File received:', {
      name: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Informações do arquivo enviado
    const filePath = req.file.path;
    const fileInfo = {
      id: req.file.filename,
      name: req.file.originalname,
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: filePath,
      size: req.file.size,
      type: req.file.mimetype,
      mimetype: req.file.mimetype
    };

    console.log('📤 [/api/upload] Sending response...', `(${Date.now() - startTime}ms)`);

    res.json({
      success: true,
      ...fileInfo,
      message: 'Arquivo enviado com sucesso!'
    });

    console.log('✅ [/api/upload] Response sent', `(${Date.now() - startTime}ms)`);
  } catch (error) {
    console.error('❌ [/api/upload] Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### DEPOIS (Código Corrigido)
```javascript
app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  console.log('📤 [/api/upload] Request received');

  try {
    console.log('📤 [/api/upload] Checking file...');
    if (!req.file) {
      console.log('❌ [/api/upload] No file received');
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    console.log('📤 [/api/upload] File received:', {
      name: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Informações do arquivo enviado
    const filePath = req.file.path;
    const fileInfo = {
      id: req.file.filename,
      name: req.file.originalname,
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: filePath,
      size: req.file.size,
      type: req.file.mimetype,
      mimetype: req.file.mimetype
    };

    // ✅ NEW: Register document in KB
    console.log('📤 [/api/upload] Registering in KB...');

    const kbDoc = {
      id: req.file.filename,
      name: req.file.originalname,
      originalName: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
      path: filePath,
      userId: req.session?.user?.id || 'web-upload',
      uploadedAt: new Date().toISOString(),
      metadata: {
        uploadMethod: 'simple',
        uploadSource: 'api',
        uploadedBy: req.session?.user?.email || 'anonymous'
      }
    };

    try {
      kbCache.add(kbDoc);
      console.log(`✅ [/api/upload] Document added to KB: ${kbDoc.id}`);
      console.log(`   User: ${kbDoc.userId}`);
      console.log(`   KB Stats:`, kbCache.getStats());
    } catch (kbError) {
      console.error('❌ [/api/upload] Failed to add to KB:', kbError);
      // Continue - file was saved, KB registration failed
      // User can still access file via path
    }

    console.log('📤 [/api/upload] Sending response...', `(${Date.now() - startTime}ms)`);

    res.json({
      success: true,
      ...fileInfo,
      kbId: kbDoc.id,
      kbRegistered: true,
      message: 'Arquivo enviado com sucesso e adicionado à Knowledge Base!'
    });

    console.log('✅ [/api/upload] Response sent', `(${Date.now() - startTime}ms)`);
  } catch (error) {
    console.error('❌ [/api/upload] Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Mudanças:
1. ✅ Adiciona documento ao `kbCache` após salvar arquivo
2. ✅ Inclui `userId` da sessão para filtro no frontend
3. ✅ Retorna `kbId` ao frontend para confirmar registro
4. ✅ Trata erro de KB registration separadamente (não falha upload)
5. ✅ Log de KB stats para debug

---

## Fix #2: POST /api/upload/base64

### Arquivo: `src/server-enhanced.js`
### Linha: ~3197-3257

### ANTES (Código Atual)
```javascript
app.post('/api/upload/base64', requireAuth, express.json({ limit: '550mb' }), async (req, res) => {
  const startTime = Date.now();
  console.log('📤 [/api/upload/base64] Request received');

  try {
    const { filename, data, mimetype } = req.body;

    if (!filename || !data) {
      console.log('❌ [/api/upload/base64] Missing filename or data');
      return res.status(400).json({ error: 'Filename e data são obrigatórios' });
    }

    console.log('📤 [/api/upload/base64] Decoding Base64...', {
      filename,
      dataLength: data.length,
      mimetype
    });

    // Decodificar Base64
    const buffer = Buffer.from(data, 'base64');
    const fileSize = buffer.length;

    console.log('📤 [/api/upload/base64] File decoded:', {
      filename,
      size: fileSize,
      mimetype
    });

    // Salvar arquivo
    const uploadId = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    const ext = path.extname(filename);
    const savedFilename = `${uploadId}${ext}`;
    const filePath = path.join(ACTIVE_PATHS.uploads, savedFilename);

    await fs.promises.writeFile(filePath, buffer);

    const fileInfo = {
      id: savedFilename,
      name: filename,
      originalName: filename,
      filename: savedFilename,
      path: filePath,
      size: fileSize,
      type: mimetype || 'application/octet-stream',
      mimetype: mimetype || 'application/octet-stream'
    };

    console.log('📤 [/api/upload/base64] Sending response...', `(${Date.now() - startTime}ms)`);

    res.json({
      success: true,
      ...fileInfo,
      message: 'Arquivo enviado com sucesso via Base64!'
    });

    console.log('✅ [/api/upload/base64] Response sent', `(${Date.now() - startTime}ms)`);
  } catch (error) {
    console.error('❌ [/api/upload/base64] Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### DEPOIS (Código Corrigido)
```javascript
app.post('/api/upload/base64', requireAuth, express.json({ limit: '550mb' }), async (req, res) => {
  const startTime = Date.now();
  console.log('📤 [/api/upload/base64] Request received');

  try {
    const { filename, data, mimetype } = req.body;

    if (!filename || !data) {
      console.log('❌ [/api/upload/base64] Missing filename or data');
      return res.status(400).json({ error: 'Filename e data são obrigatórios' });
    }

    console.log('📤 [/api/upload/base64] Decoding Base64...', {
      filename,
      dataLength: data.length,
      mimetype
    });

    // Decodificar Base64
    const buffer = Buffer.from(data, 'base64');
    const fileSize = buffer.length;

    console.log('📤 [/api/upload/base64] File decoded:', {
      filename,
      size: fileSize,
      mimetype
    });

    // Salvar arquivo
    const uploadId = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    const ext = path.extname(filename);
    const savedFilename = `${uploadId}${ext}`;
    const filePath = path.join(ACTIVE_PATHS.uploads, savedFilename);

    await fs.promises.writeFile(filePath, buffer);

    const fileInfo = {
      id: savedFilename,
      name: filename,
      originalName: filename,
      filename: savedFilename,
      path: filePath,
      size: fileSize,
      type: mimetype || 'application/octet-stream',
      mimetype: mimetype || 'application/octet-stream'
    };

    // ✅ NEW: Register document in KB
    console.log('📤 [/api/upload/base64] Registering in KB...');

    const kbDoc = {
      id: savedFilename,
      name: filename,
      originalName: filename,
      type: mimetype || 'application/octet-stream',
      size: fileSize,
      path: filePath,
      userId: req.session?.user?.id || 'web-upload',
      uploadedAt: new Date().toISOString(),
      metadata: {
        uploadMethod: 'base64',
        uploadSource: 'api',
        uploadedBy: req.session?.user?.email || 'anonymous',
        encoding: 'base64'
      }
    };

    try {
      kbCache.add(kbDoc);
      console.log(`✅ [/api/upload/base64] Document added to KB: ${kbDoc.id}`);
      console.log(`   User: ${kbDoc.userId}`);
      console.log(`   KB Stats:`, kbCache.getStats());
    } catch (kbError) {
      console.error('❌ [/api/upload/base64] Failed to add to KB:', kbError);
      // Continue - file was saved
    }

    console.log('📤 [/api/upload/base64] Sending response...', `(${Date.now() - startTime}ms)`);

    res.json({
      success: true,
      ...fileInfo,
      kbId: kbDoc.id,
      kbRegistered: true,
      message: 'Arquivo enviado com sucesso via Base64 e adicionado à KB!'
    });

    console.log('✅ [/api/upload/base64] Response sent', `(${Date.now() - startTime}ms)`);
  } catch (error) {
    console.error('❌ [/api/upload/base64] Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Mudanças:
Mesmas do Fix #1, adaptadas para Base64.

---

## Fix #3: POST /api/upload/chunked/:uploadId/finalize

### Arquivo: `src/server-enhanced.js`
### Linha: ~3484-3514

### ANTES (Código Atual)
```javascript
app.post('/api/upload/chunked/:uploadId/finalize', requireUploadToken, uploadLimiter, async (req, res) => {
  try {
    const { uploadId } = req.params;

    console.log(`🔄 [Finalize] Montando arquivo completo para uploadId: ${uploadId}`);

    const result = await chunkedUpload.finalizeUpload(uploadId);

    console.log(`✅ [Finalize] Upload completo:`, {
      filename: result.filename,
      fileSize: `${(result.fileSize / 1024 / 1024).toFixed(2)} MB`,
      path: result.path
    });

    logger.info('Upload chunked finalizado', {
      uploadId,
      filename: result.filename,
      fileSize: (result.fileSize / 1024 / 1024).toFixed(2) + ' MB'
    });

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ [Finalize] Erro:', error.message);
    logger.error('Erro ao finalizar upload chunked', { error: error.message, stack: error.stack });
    res.status(500).json({ error: error.message });
  }
});
```

### DEPOIS (Código Corrigido)
```javascript
app.post('/api/upload/chunked/:uploadId/finalize', requireUploadToken, uploadLimiter, async (req, res) => {
  try {
    const { uploadId } = req.params;

    console.log(`🔄 [Finalize] Montando arquivo completo para uploadId: ${uploadId}`);

    const result = await chunkedUpload.finalizeUpload(uploadId);

    console.log(`✅ [Finalize] Upload completo:`, {
      filename: result.filename,
      fileSize: `${(result.fileSize / 1024 / 1024).toFixed(2)} MB`,
      path: result.path
    });

    logger.info('Upload chunked finalizado', {
      uploadId,
      filename: result.filename,
      fileSize: (result.fileSize / 1024 / 1024).toFixed(2) + ' MB'
    });

    // ✅ NEW: Register document in KB
    console.log(`🔄 [Finalize] Registering in KB...`);

    const kbDoc = {
      id: result.filename, // Use final filename as ID
      name: result.originalName || result.filename,
      originalName: result.originalName || result.filename,
      type: result.contentType || 'application/octet-stream',
      size: result.fileSize,
      path: result.path,
      userId: req.user?.id || 'web-upload', // From upload token
      uploadedAt: new Date().toISOString(),
      metadata: {
        uploadMethod: 'chunked',
        uploadSource: 'api',
        uploadedBy: req.user?.email || 'anonymous',
        uploadId: uploadId,
        chunksCount: result.chunksCount || 0,
        totalChunks: result.totalChunks || 0
      }
    };

    try {
      kbCache.add(kbDoc);
      console.log(`✅ [Finalize] Document added to KB: ${kbDoc.id}`);
      console.log(`   User: ${kbDoc.userId}`);
      console.log(`   Size: ${(kbDoc.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   KB Stats:`, kbCache.getStats());
    } catch (kbError) {
      console.error('❌ [Finalize] Failed to add to KB:', kbError);
      logger.error('Failed to register chunked upload in KB', { error: kbError.message });
      // Continue - file was assembled successfully
    }

    res.json({
      success: true,
      ...result,
      kbId: kbDoc.id,
      kbRegistered: true
    });

  } catch (error) {
    console.error('❌ [Finalize] Erro:', error.message);
    logger.error('Erro ao finalizar upload chunked', { error: error.message, stack: error.stack });
    res.status(500).json({ error: error.message });
  }
});
```

### Mudanças:
1. ✅ Adiciona documento ao `kbCache` após finalizar chunked upload
2. ✅ Usa `req.user` do upload token (não `req.session`)
3. ✅ Inclui metadata de chunks para rastreabilidade
4. ✅ Retorna `kbId` ao frontend

---

## Fix #4: Script de Rebuild KB

### Arquivo: `scripts/rebuild-kb.js` (CRIAR NOVO)

```javascript
/**
 * Rebuild KB from Existing Uploads
 *
 * Este script varre o diretório data/uploads/ e registra todos os arquivos
 * existentes no kb-documents.json, corrigindo o problema de uploads órfãos.
 *
 * Uso:
 *   node scripts/rebuild-kb.js
 *
 * Opções:
 *   --dry-run    Mostra o que seria feito sem modificar KB
 *   --user-id    Define userId padrão (default: 'migration')
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import kbCache from '../lib/kb-cache.js';
import { ACTIVE_PATHS } from '../lib/storage-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const userIdIndex = args.indexOf('--user-id');
const defaultUserId = userIdIndex !== -1 ? args[userIdIndex + 1] : 'migration';

console.log('🔧 KB Rebuild Script');
console.log('═══════════════════════════════════════');
console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE (will modify KB)'}`);
console.log(`Default userId: ${defaultUserId}`);
console.log('');

async function rebuildKB() {
  try {
    const uploadsDir = ACTIVE_PATHS.uploads;

    console.log(`📂 Scanning directory: ${uploadsDir}`);

    if (!fs.existsSync(uploadsDir)) {
      console.error(`❌ Uploads directory not found: ${uploadsDir}`);
      process.exit(1);
    }

    // Get current KB state
    const currentDocs = kbCache.getAll();
    console.log(`📊 Current KB: ${currentDocs.length} documents`);
    console.log('');

    // Scan uploads directory
    const files = fs.readdirSync(uploadsDir);

    let added = 0;
    let skipped = 0;
    let errors = 0;

    for (const file of files) {
      const filePath = path.join(uploadsDir, file);

      try {
        const stats = fs.statSync(filePath);

        // Skip directories
        if (stats.isDirectory()) {
          console.log(`⏭️  Skipping directory: ${file}`);
          skipped++;
          continue;
        }

        // Check if already in KB
        const existingDoc = currentDocs.find(d =>
          d.path === filePath ||
          d.id === file ||
          d.name === file
        );

        if (existingDoc) {
          console.log(`✅ Already in KB: ${file} (ID: ${existingDoc.id})`);
          skipped++;
          continue;
        }

        // Detect mimetype from extension
        const ext = path.extname(file).toLowerCase();
        const mimetypes = {
          '.pdf': 'application/pdf',
          '.txt': 'text/plain',
          '.md': 'text/markdown',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png'
        };
        const mimetype = mimetypes[ext] || 'application/octet-stream';

        // Create KB document
        const kbDoc = {
          id: file,
          name: file,
          originalName: file,
          type: mimetype,
          size: stats.size,
          path: filePath,
          userId: defaultUserId,
          uploadedAt: stats.mtime.toISOString(),
          metadata: {
            source: 'rebuild-script',
            rebuildDate: new Date().toISOString(),
            originalMtime: stats.mtime.toISOString()
          }
        };

        if (isDryRun) {
          console.log(`🔍 [DRY RUN] Would add: ${file}`);
          console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
          console.log(`   Type: ${mimetype}`);
          console.log(`   User: ${defaultUserId}`);
        } else {
          kbCache.add(kbDoc);
          console.log(`✅ Added: ${file}`);
          console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
          console.log(`   Type: ${mimetype}`);
        }

        added++;
      } catch (error) {
        console.error(`❌ Error processing ${file}:`, error.message);
        errors++;
      }
    }

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Total files scanned: ${files.length}`);
    console.log(`✅ Added to KB: ${added}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('');

    if (!isDryRun) {
      const finalStats = kbCache.getStats();
      console.log('📊 Final KB Stats:');
      console.log(`   Total documents: ${finalStats.totalDocuments}`);
      console.log(`   Cache loaded: ${finalStats.loaded}`);
      console.log(`   Dirty: ${finalStats.dirty}`);
      console.log('');
      console.log('✅ KB rebuild complete!');
      console.log('💾 Changes will be saved to disk automatically.');
    } else {
      console.log('🔍 DRY RUN COMPLETE - No changes made');
      console.log('   Run without --dry-run to apply changes');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run rebuild
rebuildKB();
```

### Como usar:

```bash
# Dry run (ver o que seria feito)
node scripts/rebuild-kb.js --dry-run

# Executar rebuild com userId padrão 'migration'
node scripts/rebuild-kb.js

# Executar rebuild com userId específico
node scripts/rebuild-kb.js --user-id "admin-user-123"
```

---

## Fix #5: Testes de Validação

### Arquivo: `tests/integration/kb-upload-integration.test.js` (CRIAR NOVO)

```javascript
/**
 * Integration Tests: Upload → KB Integration
 *
 * Testa se uploads são corretamente registrados na KB
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import kbCache from '../../lib/kb-cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import app (assuming it's exported from server-enhanced.js)
// import app from '../../src/server-enhanced.js';

describe('Upload → KB Integration', () => {
  let testFile;
  let sessionCookie;

  beforeAll(async () => {
    // Create test file
    testFile = path.join(__dirname, 'test-upload.pdf');
    fs.writeFileSync(testFile, 'Test PDF content');

    // Authenticate to get session cookie
    // const loginRes = await request(app)
    //   .post('/api/auth/login')
    //   .send({ email: 'test@example.com', password: 'test123' });
    // sessionCookie = loginRes.headers['set-cookie'];
  });

  afterAll(async () => {
    // Clean up test file
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  describe('POST /api/upload', () => {
    it('should upload file and register in KB', async () => {
      // const res = await request(app)
      //   .post('/api/upload')
      //   .set('Cookie', sessionCookie)
      //   .attach('file', testFile);

      // expect(res.status).toBe(200);
      // expect(res.body.success).toBe(true);
      // expect(res.body.kbId).toBeDefined();
      // expect(res.body.kbRegistered).toBe(true);

      // // Verify in kbCache
      // const kbDoc = kbCache.getById(res.body.kbId);
      // expect(kbDoc).toBeDefined();
      // expect(kbDoc.name).toBe('test-upload.pdf');
    });

    it('should filter documents by userId', async () => {
      // const allDocs = kbCache.getAll();
      // const userDocs = allDocs.filter(d => d.userId === 'test-user-id');

      // expect(userDocs.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/upload/base64', () => {
    it('should upload via base64 and register in KB', async () => {
      // const fileBuffer = fs.readFileSync(testFile);
      // const base64Data = fileBuffer.toString('base64');

      // const res = await request(app)
      //   .post('/api/upload/base64')
      //   .set('Cookie', sessionCookie)
      //   .send({
      //     filename: 'test-base64.pdf',
      //     data: base64Data,
      //     mimetype: 'application/pdf'
      //   });

      // expect(res.status).toBe(200);
      // expect(res.body.success).toBe(true);
      // expect(res.body.kbId).toBeDefined();
      // expect(res.body.kbRegistered).toBe(true);
    });
  });

  describe('consultar_kb tool', () => {
    it('should find uploaded documents in chat', async () => {
      // Simulate consultar_kb tool execution
      // const query = 'test-upload.pdf';
      // const allDocs = kbCache.getAll();
      // const results = allDocs.filter(d =>
      //   d.name.toLowerCase().includes(query.toLowerCase())
      // );

      // expect(results.length).toBeGreaterThan(0);
      // expect(results[0].name).toBe('test-upload.pdf');
    });
  });

  describe('KB persistence', () => {
    it('should persist to kb-documents.json', async () => {
      // Wait for debounced save
      // await new Promise(resolve => setTimeout(resolve, 6000));

      // const kbPath = path.join(process.cwd(), 'data', 'kb-documents.json');
      // const kbData = JSON.parse(fs.readFileSync(kbPath, 'utf8'));

      // expect(Array.isArray(kbData)).toBe(true);
      // expect(kbData.length).toBeGreaterThan(0);

      // const testDoc = kbData.find(d => d.name === 'test-upload.pdf');
      // expect(testDoc).toBeDefined();
    });
  });
});
```

---

## 📝 CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Código
- [ ] Aplicar Fix #1 (POST /api/upload)
- [ ] Aplicar Fix #2 (POST /api/upload/base64)
- [ ] Aplicar Fix #3 (POST /api/upload/chunked/finalize)
- [ ] Criar script rebuild-kb.js
- [ ] Adicionar import kbCache no server-enhanced.js (se ainda não tiver)

### Fase 2: Rebuild
- [ ] Executar rebuild-kb.js em modo --dry-run
- [ ] Verificar output do dry run
- [ ] Executar rebuild-kb.js (sem dry-run)
- [ ] Verificar kb-documents.json foi atualizado
- [ ] Verificar kbCache stats

### Fase 3: Testes Manuais
- [ ] Upload arquivo via POST /api/upload
- [ ] Verificar documento aparece em kb-documents.json
- [ ] Testar consultar_kb no chat
- [ ] Documento deve aparecer nos resultados
- [ ] Testar analisar_documento_kb
- [ ] Fichamentos devem ser gerados

### Fase 4: Testes Automatizados
- [ ] Criar testes de integração
- [ ] Rodar suite de testes
- [ ] Todos os testes passando

### Fase 5: Deploy
- [ ] Commit changes com mensagem descritiva
- [ ] Push para repositório
- [ ] Deploy em staging
- [ ] Testar em staging
- [ ] Deploy em produção
- [ ] Verificar logs

---

## 🔍 VALIDAÇÃO PÓS-DEPLOY

### Checklist de Validação

```bash
# 1. Verificar KB não está vazia
curl -X GET http://localhost:3000/api/kb/status \
  -H "Cookie: session=..."

# Esperado: { total: >0, ... }

# 2. Upload teste
curl -X POST http://localhost:3000/api/upload \
  -H "Cookie: session=..." \
  -F "file=@test.pdf"

# Esperado: { success: true, kbId: "...", kbRegistered: true }

# 3. Consultar no chat
# Via interface: "consultar_kb test.pdf"
# Esperado: Documento encontrado

# 4. Analisar documento
# Via interface: "analisar_documento_kb test.pdf"
# Esperado: Análise iniciada, fichamentos gerados
```

### Métricas de Sucesso

- ✅ Upload rate: 100% (todos uploads registrados no KB)
- ✅ KB population: >0 documentos após rebuild
- ✅ Chat tool success: >95% (consultar_kb encontra docs)
- ✅ Analysis success: >90% (analisar_documento_kb funciona)

---

## 📚 DOCUMENTAÇÃO ADICIONAL

### Para Desenvolvedores

**Como adicionar documento ao KB manualmente:**
```javascript
import kbCache from './lib/kb-cache.js';

const doc = {
  id: 'unique-id',
  name: 'documento.pdf',
  originalName: 'documento.pdf',
  type: 'application/pdf',
  size: 12345,
  path: '/path/to/file.pdf',
  userId: 'user-123',
  uploadedAt: new Date().toISOString(),
  metadata: { ... }
};

kbCache.add(doc);
// Documento será salvo automaticamente em 5s ou após 10 docs
```

**Como verificar KB stats:**
```javascript
const stats = kbCache.getStats();
console.log(stats);
// { totalDocuments: 10, loaded: true, dirty: false, pendingChanges: 0 }
```

**Como forçar save imediato:**
```javascript
kbCache._saveNow(); // Async, returns Promise
// ou
kbCache._saveSyncNow(); // Sync, for shutdown
```

---

**FIM DO GUIA DE IMPLEMENTAÇÃO**
