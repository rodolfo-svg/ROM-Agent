# Correção do kb-documents.json Corrompido no Render

## Problema
Arquivo `kb-documents.json` no Render está corrompido:
- Tamanho: ~1.5MB (10x maior que deveria)
- Erro: `Unexpected non-whitespace character at position 1487946 (line 4363)`
- Todas as operações de KB estão falhando com erro 500

## Causa
Múltiplos uploads/writes concorrentes corromperam o JSON.

## Solução

### Passo 1: Acessar Shell do Render

```bash
# Via Render Dashboard:
# 1. Vá em https://dashboard.render.com
# 2. Selecione o serviço "rom-agent-ia"
# 3. Clique em "Shell" (no menu superior)
```

### Passo 2: Fazer Backup do Arquivo Corrompido

```bash
# No shell do Render:
cd /opt/render/project/src
cp /var/data/kb-documents.json /var/data/kb-documents.json.CORRUPTED.backup
ls -lh /var/data/kb-documents.json*
```

### Passo 3: Tentar Reparar o JSON

```bash
# Verificar primeiros 1000 chars
head -c 1000 /var/data/kb-documents.json

# Verificar últimos 1000 chars
tail -c 1000 /var/data/kb-documents.json

# Tentar encontrar onde está o erro (linha 4363)
sed -n '4360,4370p' /var/data/kb-documents.json
```

### Passo 4A: Se Irreparável - Usar JSON Local

```bash
# No seu Mac, fazer upload do JSON limpo:
scp ~/ROM-Agent/data/kb-documents.json render-user@render-host:/var/data/

# OU via código:
# Criar endpoint temporário POST /api/admin/restore-kb
# Body: { json: "..." }
```

### Passo 4B: OU Recriar JSON Vazio

```bash
# No shell do Render:
echo '[]' > /var/data/kb-documents.json
chown render:render /var/data/kb-documents.json
chmod 644 /var/data/kb-documents.json
```

### Passo 5: Reiniciar Serviço

```bash
# No Render Dashboard:
# Manual Deploy > Clear build cache & deploy
```

---

## Solução Temporária: Endpoint de Emergência

Criar rota que NÃO depende do kb-documents.json:

### Código a Adicionar em `src/server-enhanced.js`

```javascript
// Endpoint de emergência - listar arquivos diretos do filesystem
app.get('/api/kb/files-emergency', requireAuth, (req, res) => {
  try {
    const uploadsDir = path.join(ACTIVE_PATHS.data, 'uploads');
    const files = fs.readdirSync(uploadsDir)
      .filter(f => f.endsWith('.pdf'))
      .map(f => {
        const stats = fs.statSync(path.join(uploadsDir, f));
        return {
          name: f,
          size: stats.size,
          path: path.join(uploadsDir, f),
          modifiedAt: stats.mtime
        };
      });

    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Análise V2 de emergência - sem validar KB
app.post('/api/kb/analyze-v2-emergency', requireAuth, async (req, res) => {
  try {
    const { fileName, analysisType = 'complete', model = 'sonnet' } = req.body;

    const filePath = path.join(ACTIVE_PATHS.data, 'uploads', fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    // Processar diretamente, sem verificar kb-documents.json
    const { documentProcessorV2 } = await import('../lib/document-processor-v2.js');
    const processor = new documentProcessorV2();

    // Ler PDF
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);

    // Processar
    const result = await processor.processDocument(
      pdfData.text,
      fileName,
      fileName,
      analysisType,
      model
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});
```

---

## Teste Rápido

Depois de aplicar qualquer solução, teste:

```javascript
fetch('/api/kb/documents')
  .then(res => res.json())
  .then(data => console.log('Docs:', data.documents?.length || 0))
```

Se retornar sem erro 500, está corrigido!
