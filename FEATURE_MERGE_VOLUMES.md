# 📚 FEATURE: Merge de Volumes de Processos

## 🎯 Problema

Processos com múltiplos volumes (Vol1.pdf, Vol2.pdf, Vol3.pdf) geram:
- ❌ Análises duplicadas/triplicadas
- ❌ Custo multiplicado ($2.80 × N volumes)
- ❌ Ficheiros fragmentados (FICHAMENTO_Vol1, Vol2, Vol3)
- ❌ Chat confuso (qual volume carregar?)

## ✅ Solução Proposta

### Frontend: Multi-Upload com Opção "Mesclar Volumes"

```
┌────────────────────────────────────────────────────┐
│  Upload de Documentos                              │
├────────────────────────────────────────────────────┤
│  Arraste PDFs aqui ou clique para selecionar      │
│                                                    │
│  ☑️ Detectar e mesclar volumes automaticamente     │
│                                                    │
│  Arquivos selecionados:                            │
│  📄 Alessandro_Vol1.pdf (200 páginas, 15 MB)      │
│  📄 Alessandro_Vol2.pdf (180 páginas, 13 MB)      │
│  📄 Alessandro_Vol3.pdf (150 páginas, 11 MB)      │
│                                                    │
│  🔍 Volumes detectados: Alessandro (3 volumes)     │
│                                                    │
│  [Cancelar]  [Upload Separado]  [Mesclar e Upload]│
└────────────────────────────────────────────────────┘
```

---

## 🔧 Implementação Técnica

### Backend: Endpoint para Merge

**Arquivo:** `src/routes/kb-merge-volumes.js` (NOVO)

```javascript
import express from 'express';
import PDFMerger from 'pdf-merger-js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const upload = multer({ dest: '/tmp/pdf-merge/' });

/**
 * POST /api/kb/merge-volumes
 * Mescla múltiplos PDFs em um único documento
 *
 * Body: FormData
 * - files[]: Array de PDFs
 * - processName: Nome do processo (ex: "Alessandro Ribeiro")
 * - processNumber: Número CNJ (opcional)
 */
router.post('/merge-volumes', upload.array('files'), async (req, res) => {
  try {
    const files = req.files;
    const { processName, processNumber } = req.body;

    if (!files || files.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'É necessário pelo menos 2 arquivos para mesclar'
      });
    }

    console.log(`🔀 [Merge] Mesclando ${files.length} volumes de ${processName}`);

    // Ordenar arquivos por nome (Vol1, Vol2, Vol3)
    const sortedFiles = files.sort((a, b) => {
      const aVol = extractVolumeNumber(a.originalname);
      const bVol = extractVolumeNumber(b.originalname);
      return aVol - bVol;
    });

    // Criar merger
    const merger = new PDFMerger();

    for (const file of sortedFiles) {
      await merger.add(file.path);
      console.log(`   ✅ Adicionado: ${file.originalname}`);
    }

    // Gerar nome do arquivo final
    const timestamp = Date.now();
    const safeName = processName.replace(/[^a-zA-Z0-9]/g, '_');
    const outputFilename = `${timestamp}_${safeName}_Completo.pdf`;
    const outputPath = path.join('/tmp/pdf-merge/', outputFilename);

    // Salvar PDF mesclado
    await merger.save(outputPath);

    const stats = fs.statSync(outputPath);
    console.log(`   ✅ PDF mesclado: ${outputPath} (${formatBytes(stats.size)})`);

    // Deletar arquivos temporários
    for (const file of sortedFiles) {
      fs.unlinkSync(file.path);
    }

    // Retornar arquivo ou fazer upload automático
    res.json({
      success: true,
      mergedFile: {
        filename: outputFilename,
        path: outputPath,
        size: stats.size,
        volumesCount: files.length,
        processName,
        processNumber
      },
      message: `${files.length} volumes mesclados com sucesso`
    });

  } catch (error) {
    console.error('❌ [Merge] Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Extrai número do volume do nome do arquivo
 * Ex: "Alessandro_Vol2.pdf" → 2
 */
function extractVolumeNumber(filename) {
  const match = filename.match(/vol[ume]*[\s_-]*(\d+)/i);
  return match ? parseInt(match[1]) : 0;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export default router;
```

---

### Frontend: Componente de Upload com Merge

**Arquivo:** `frontend/src/components/kb/VolumeUploader.tsx` (NOVO)

```typescript
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileUp, Layers } from 'lucide-react';

interface VolumeFile {
  file: File;
  volumeNumber: number;
  pages?: number;
}

export function VolumeUploader() {
  const [files, setFiles] = useState<VolumeFile[]>([]);
  const [autoDetect, setAutoDetect] = useState(true);
  const [merging, setMerging] = useState(false);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files);

    // Detectar volumes automaticamente
    const volumeFiles = selectedFiles.map(file => ({
      file,
      volumeNumber: extractVolumeNumber(file.name)
    }));

    // Ordenar por volume
    volumeFiles.sort((a, b) => a.volumeNumber - b.volumeNumber);

    setFiles(volumeFiles);
  };

  const handleMergeAndUpload = async () => {
    setMerging(true);

    try {
      const formData = new FormData();
      files.forEach(({ file }) => {
        formData.append('files', file);
      });
      formData.append('processName', 'Alessandro Ribeiro');

      const response = await fetch('/api/kb/merge-volumes', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const result = await response.json();

      if (result.success) {
        // Agora fazer upload do PDF mesclado
        alert(`✅ ${files.length} volumes mesclados! Fazendo upload...`);

        // TODO: Upload do arquivo mesclado para KB
      }

    } catch (error) {
      console.error('Erro ao mesclar:', error);
      alert('Erro ao mesclar volumes');
    } finally {
      setMerging(false);
    }
  };

  const extractVolumeNumber = (filename: string) => {
    const match = filename.match(/vol[ume]*[\s_-]*(\d+)/i);
    return match ? parseInt(match[1]) : 0;
  };

  const detectsVolumes = files.length > 1 &&
    files.every(f => f.volumeNumber > 0);

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-stone-300 rounded-lg p-8 text-center">
        <input
          type="file"
          multiple
          accept=".pdf"
          onChange={handleFilesSelected}
          className="hidden"
          id="volume-upload"
        />

        <label htmlFor="volume-upload" className="cursor-pointer">
          <FileUp className="w-12 h-12 mx-auto text-stone-400 mb-2" />
          <p className="text-stone-600">
            Arraste PDFs aqui ou clique para selecionar
          </p>
        </label>
      </div>

      {files.length > 0 && (
        <>
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Arquivos Selecionados:</h3>
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-stone-500">Vol {f.volumeNumber}:</span>
                <span className="text-stone-800">{f.file.name}</span>
                <span className="text-stone-400">
                  ({(f.file.size / 1024 / 1024).toFixed(1)} MB)
                </span>
              </div>
            ))}
          </div>

          {detectsVolumes && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <p className="text-sm text-blue-800">
                  🔍 Detectados {files.length} volumes em sequência
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {/* Upload separado */}}
            >
              Upload Separado
            </Button>

            {detectsVolumes && (
              <Button
                onClick={handleMergeAndUpload}
                disabled={merging}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Layers className="w-4 h-4 mr-2" />
                {merging ? 'Mesclando...' : `Mesclar ${files.length} Volumes e Upload`}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

---

## 🎯 Como Funcionará

### Fluxo Completo:

```
1. Usuário seleciona 3 PDFs:
   - Alessandro_Vol1.pdf
   - Alessandro_Vol2.pdf
   - Alessandro_Vol3.pdf

2. Sistema detecta automaticamente:
   "🔍 Detectados 3 volumes em sequência"

3. Opções apresentadas:
   [Upload Separado]  ou  [Mesclar 3 Volumes e Upload]

4. Se escolher "Mesclar":
   - Backend usa pdf-merger-js
   - Cria: Alessandro_Completo.pdf (530 páginas)
   - Faz upload automático
   - 1 análise apenas

5. Resultado:
   ✅ FICHAMENTO unificado (530 páginas)
   ✅ CRONOLOGIA completa
   ✅ Chat carrega tudo de uma vez
   ✅ Custo: $2.80 (vs $8.40)
```

---

## 📦 Dependências Necessárias

### Backend:
```bash
npm install pdf-merger-js
```

### Frontend:
```bash
# Já tem: react, lucide-react
```

---

## 🚀 Implementação Progressiva

### Fase 1 (Agora): Manual
✅ Usuário mescla PDFs externamente (ilovepdf.com)
✅ Upload do PDF mesclado

### Fase 2 (Futura): Semi-automática
🟡 Detectar volumes pelo nome
🟡 Oferecer opção "Mesclar"
🟡 Merge no backend

### Fase 3 (Avançada): Automática
⚪ Detectar volumes pelo conteúdo
⚪ Merge automático se detectar padrão
⚪ Configuração por usuário (sempre mesclar/perguntar/nunca)

---

## 💰 Comparação de Custos

| Cenário | Método | Análises | Custo | Ficheiros |
|---------|--------|----------|-------|-----------|
| **3 Volumes Separados** | Upload individual | 3 × V2 | $8.40 | 12 arquivos (4×3) |
| **3 Volumes Mesclados** | ilovepdf.com + Upload | 1 × V2 | $2.80 | 4 arquivos |
| **Sistema com Merge** | Feature nativa | 1 × V2 | $2.80 | 4 arquivos |

**Economia:** 70% ($8.40 → $2.80)

---

## 🎓 Casos de Uso

### Caso 1: Processo com 2 volumes
```
Vol1.pdf (250 páginas) + Vol2.pdf (280 páginas)
= Completo.pdf (530 páginas)
= 1 análise ($2.80)
```

### Caso 2: Processo com 4 volumes
```
Vol1 (150p) + Vol2 (160p) + Vol3 (140p) + Vol4 (170p)
= Completo.pdf (620 páginas)
= 1 análise ($3.20)
vs 4 análises ($11.20) - Economia de $8.00
```

### Caso 3: Autos principais + Apensos
```
Principal.pdf (300p) + Apenso1.pdf (100p) + Apenso2.pdf (80p)
= Completo.pdf (480 páginas)
= 1 CRONOLOGIA unificada (mostra eventos de todos os apensos)
```

---

## ⚠️ Limitações Técnicas

### Tamanho Máximo:
- **Upload:** 500 MB (Render limit)
- **Análise:** Ilimitado (com chunking V2)

### Ordem dos Volumes:
- Detecção automática: "Vol1", "Vol2", "Volume 1", "v1", etc.
- Se nomenclatura diferente: perguntar ordem ao usuário

### Tempo de Merge:
- 2 volumes (400 páginas): ~5 segundos
- 5 volumes (1000 páginas): ~15 segundos

---

## 🔮 Melhorias Futuras

1. **Preview antes do merge:** Mostrar primeiras páginas de cada volume
2. **Reordenar volumes:** Drag & drop para ajustar ordem
3. **Detecção inteligente:** Analisar conteúdo para detectar volumes (OCR)
4. **Bookmark automático:** Inserir marcadores PDF (Vol1, Vol2, etc.)
5. **Split de PDF:** Reverso - dividir PDF grande em volumes

---

## ✅ Recomendação AGORA

**Por enquanto, use a Solução 1 (Manual):**
1. Ir em https://www.ilovepdf.com/pt/unir_pdf
2. Upload dos 3 volumes
3. Baixar PDF mesclado
4. Upload no ROM Agent
5. 1 análise única

**Posso implementar a Solução 2 (Sistema com Merge) se você quiser!**

Quer que eu implemente agora? 🚀
