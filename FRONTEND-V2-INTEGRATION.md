# ROM Agent v2.0 - Guia de Integração Frontend

## Visão Geral

Este documento explica como integrar a API de Extração v2.0 com o frontend React/TypeScript existente.

---

## API v2.0 Endpoints

### Base URL
```
http://localhost:3000/api/extraction/v2
```

### Endpoints Disponíveis

#### 1. POST `/extract`
Extrai documento e gera os 18 ficheiros.

**Request**:
```typescript
const formData = new FormData();
formData.append('file', fileBlob, 'documento.pdf');
formData.append('async', 'true'); // Opcional: processamento assíncrono
formData.append('outputFolderName', 'Caso_XYZ'); // Opcional
formData.append('projectName', 'Projeto'); // Opcional
formData.append('uploadToKB', 'false'); // Opcional

const response = await fetch('/api/extraction/v2/extract', {
  method: 'POST',
  body: formData,
  credentials: 'include'
});

const data = await response.json();
```

**Response (Assíncrono)**:
```json
{
  "success": true,
  "jobId": "job_1234567890",
  "message": "Extração iniciada",
  "statusUrl": "/api/extraction/v2/status/job_1234567890"
}
```

**Response (Síncrono)**:
```json
{
  "success": true,
  "result": {
    "pastaBase": "/path/to/ROM-Extractions-v2/Documento",
    "arquivosGerados": 18,
    "estrutura": { ... },
    "estatisticas": {
      "duracao": "45s",
      "custoTotal": "$0.23",
      "entidadesEncontradas": 42
    }
  }
}
```

#### 2. GET `/status/:jobId`
Verifica o status de um job assíncrono.

**Request**:
```typescript
const response = await fetch(`/api/extraction/v2/status/${jobId}`, {
  credentials: 'include'
});

const data = await response.json();
```

**Response**:
```json
{
  "success": true,
  "status": "processing",
  "progress": 45,
  "message": "Gerando análise jurídica profunda..."
}
```

Estados possíveis: `pending`, `processing`, `completed`, `failed`

#### 3. GET `/result/:jobId`
Obtém o resultado de um job completado.

**Request**:
```typescript
const response = await fetch(`/api/extraction/v2/result/${jobId}`, {
  credentials: 'include'
});

const data = await response.json();
```

**Response**:
```json
{
  "success": true,
  "result": {
    "pastaBase": "/path/to/output",
    "arquivosGerados": 18,
    "estrutura": { ... },
    "estatisticas": { ... }
  }
}
```

#### 4. GET `/jobs`
Lista todos os jobs do usuário.

**Response**:
```json
{
  "success": true,
  "jobs": [
    {
      "jobId": "job_123",
      "status": "completed",
      "fileName": "documento.pdf",
      "createdAt": "2026-02-09T10:30:00Z"
    }
  ]
}
```

#### 5. DELETE `/job/:jobId`
Remove um job da memória.

---

## Integração com Componentes Existentes

### 1. Adicionar ao `ExtractionProgressBar.tsx`

Atualizar para suportar v2:

```typescript
// Em ExtractionProgressBar.tsx

const fetchJobStatus = useCallback(async () => {
  try {
    // Tentar v2 primeiro
    const v2Response = await fetch(`/api/extraction/v2/status/${jobId}`, {
      credentials: 'include'
    });

    if (v2Response.ok) {
      const data = await v2Response.json();

      if (data.success) {
        setJob({
          id: jobId,
          status: data.status,
          progress: data.progress,
          documentName: data.fileName || 'Documento',
          // ... outros campos
        });

        if (data.status === 'completed') {
          // Buscar resultado completo
          const resultResponse = await fetch(`/api/extraction/v2/result/${jobId}`);
          const resultData = await resultResponse.json();
          onComplete?.(resultData.result);
        }

        return;
      }
    }

    // Fallback para API antiga
    const oldResponse = await fetch(`/api/extraction-jobs/${jobId}`, {
      credentials: 'include'
    });
    // ... código existente
  } catch (err) {
    // ... error handling
  }
}, [jobId]);
```

### 2. Criar Hook Customizado para v2

```typescript
// src/hooks/useExtractionV2.ts

import { useState, useCallback } from 'react';

interface ExtractionV2Options {
  async?: boolean;
  outputFolderName?: string;
  projectName?: string;
  uploadToKB?: boolean;
}

export function useExtractionV2() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractDocument = useCallback(async (
    file: File,
    options: ExtractionV2Options = {}
  ) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      if (options.async) formData.append('async', 'true');
      if (options.outputFolderName) {
        formData.append('outputFolderName', options.outputFolderName);
      }
      if (options.projectName) {
        formData.append('projectName', options.projectName);
      }
      if (options.uploadToKB !== undefined) {
        formData.append('uploadToKB', String(options.uploadToKB));
      }

      const response = await fetch('/api/extraction/v2/extract', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro na extração');
      }

      if (options.async) {
        setJobId(data.jobId);
      }

      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkStatus = useCallback(async (id: string) => {
    const response = await fetch(`/api/extraction/v2/status/${id}`, {
      credentials: 'include'
    });
    return response.json();
  }, []);

  const getResult = useCallback(async (id: string) => {
    const response = await fetch(`/api/extraction/v2/result/${id}`, {
      credentials: 'include'
    });
    return response.json();
  }, []);

  return {
    extractDocument,
    checkStatus,
    getResult,
    jobId,
    loading,
    error
  };
}
```

### 3. Criar Componente de Upload para v2

```typescript
// src/components/extraction/ExtractionV2Uploader.tsx

import React, { useState } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { useExtractionV2 } from '@/hooks/useExtractionV2';
import { ExtractionProgressBar } from './ExtractionProgressBar';

export function ExtractionV2Uploader() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { extractDocument, jobId, loading, error } = useExtractionV2();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleExtract = async () => {
    if (!selectedFile) return;

    await extractDocument(selectedFile, {
      async: true, // Usar modo assíncrono
      outputFolderName: selectedFile.name.replace(/\.[^.]+$/, ''),
      projectName: 'ROM-v2'
    });
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-stone-300 rounded-lg p-8 text-center">
        <input
          type="file"
          id="file-upload-v2"
          className="hidden"
          accept=".pdf,.doc,.docx"
          onChange={handleFileSelect}
        />

        <label
          htmlFor="file-upload-v2"
          className="cursor-pointer flex flex-col items-center gap-2"
        >
          {selectedFile ? (
            <>
              <FileText className="w-12 h-12 text-blue-500" />
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-stone-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-stone-400" />
              <p className="text-sm text-stone-600">
                Clique para selecionar um documento
              </p>
              <p className="text-xs text-stone-500">
                PDF, DOC, DOCX (até 50MB)
              </p>
            </>
          )}
        </label>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {error}
        </div>
      )}

      {selectedFile && !jobId && (
        <Button
          onClick={handleExtract}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Iniciando extração...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 mr-2" />
              Extrair com v2.0 (18 Ficheiros)
            </>
          )}
        </Button>
      )}

      {jobId && (
        <ExtractionProgressBar
          jobId={jobId}
          onComplete={(result) => {
            console.log('Extração v2 completa:', result);
            alert(`Extração concluída!\n\nArquivos gerados: ${result.arquivosGerados}\nCusto: ${result.estatisticas?.custoTotal || 'N/A'}`);
          }}
          onError={(err) => {
            console.error('Erro na extração:', err);
          }}
        />
      )}
    </div>
  );
}
```

### 4. Adicionar à Página Existente

```typescript
// Em CaseProcessorPage.tsx ou página apropriada

import { ExtractionV2Uploader } from '@/components/extraction/ExtractionV2Uploader';

// No componente:
<div>
  <h2 className="text-xl font-semibold mb-4">
    Extração v2.0 - 18 Ficheiros Completos
  </h2>

  <ExtractionV2Uploader />
</div>
```

---

## Estrutura dos 18 Ficheiros Gerados

Quando a extração v2 é completada, os seguintes arquivos são gerados:

```
ROM-Extractions-v2/[DOCUMENTO]/
│
├── 01_NUCLEO/
│   ├── 01_texto_completo_original.txt
│   └── 02_texto_normalizado.txt
│
├── 02_RESUMOS/
│   ├── 03_resumo_executivo.md
│   ├── 04_resumo_ultra_curto.md
│   └── 05_pontos_criticos.md
│
├── 03_ANALISES/
│   ├── 06_analise_completa.md
│   ├── 07_analise_juridica.json
│   └── 08_analise_temporal.md
│
├── 04_ENTIDADES/
│   ├── 09_entidades.json
│   ├── 10_partes_envolvidas.json
│   ├── 11_valores_monetarios.json
│   └── 12_datas_importantes.json
│
├── 05_JURIDICO/
│   ├── 13_citacoes_legais.json
│   ├── 14_classificacao_documental.json
│   └── 15_analise_risco.md
│
└── 06_METADADOS/
    ├── 16_metadata_completo.json
    ├── 17_estatisticas_processamento.json
    └── 18_indice_navegacao.md
```

---

## Componente de Visualização de Resultados

```typescript
// src/components/extraction/ExtractionV2Results.tsx

import React from 'react';
import { FileText, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui';

interface ExtractionResult {
  pastaBase: string;
  arquivosGerados: number;
  estrutura: Record<string, string[]>;
  estatisticas: {
    duracao: string;
    custoTotal: string;
    entidadesEncontradas: number;
  };
}

export function ExtractionV2Results({ result }: { result: ExtractionResult }) {
  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold text-green-800 mb-2">
          ✓ Extração Concluída com Sucesso
        </h3>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-stone-600">Arquivos Gerados</p>
            <p className="font-semibold text-green-800">{result.arquivosGerados}</p>
          </div>
          <div>
            <p className="text-stone-600">Duração</p>
            <p className="font-semibold text-green-800">{result.estatisticas.duracao}</p>
          </div>
          <div>
            <p className="text-stone-600">Custo</p>
            <p className="font-semibold text-green-800">{result.estatisticas.custoTotal}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-sm text-stone-700">Estrutura Gerada:</h4>

        {Object.entries(result.estrutura).map(([categoria, arquivos]) => (
          <details key={categoria} className="border rounded p-3">
            <summary className="cursor-pointer font-medium text-sm">
              {categoria} ({arquivos.length} arquivos)
            </summary>
            <ul className="mt-2 space-y-1 ml-4">
              {arquivos.map((arquivo, idx) => (
                <li key={idx} className="text-xs text-stone-600 flex items-center gap-2">
                  <FileText className="w-3 h-3" />
                  {arquivo}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm">
          <Eye className="w-4 h-4 mr-2" />
          Ver Pasta
        </Button>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Baixar Tudo (ZIP)
        </Button>
      </div>
    </div>
  );
}
```

---

## Migrações e Compatibilidade

### Manter Compatibilidade com API Antiga

Se você precisa suportar tanto a API antiga quanto a v2:

```typescript
// src/utils/extraction-api.ts

export type ExtractionVersion = 'v1' | 'v2';

export async function extractDocument(
  file: File,
  version: ExtractionVersion = 'v2',
  options: any = {}
) {
  if (version === 'v2') {
    // Usar API v2
    return extractV2(file, options);
  } else {
    // Usar API antiga
    return extractV1(file, options);
  }
}

async function extractV2(file: File, options: any) {
  const formData = new FormData();
  formData.append('file', file);
  // ... lógica v2
}

async function extractV1(file: File, options: any) {
  // ... lógica antiga
}
```

---

## Testes

### Teste Manual via cURL

```bash
# Upload síncrono
curl -X POST http://localhost:3000/api/extraction/v2/extract \
  -F "file=@documento.pdf" \
  -F "async=false"

# Upload assíncrono
curl -X POST http://localhost:3000/api/extraction/v2/extract \
  -F "file=@documento.pdf" \
  -F "async=true"

# Verificar status
curl http://localhost:3000/api/extraction/v2/status/job_123

# Obter resultado
curl http://localhost:3000/api/extraction/v2/result/job_123
```

### Teste via Script Node.js

```bash
npm run extract:v2 /path/to/document.pdf
```

---

## Benefícios da v2.0

Ao integrar a API v2.0, o frontend ganha:

1. **18 ficheiros estruturados** vs 6-8 da v1
2. **Análise jurídica profunda** com IA (Claude Sonnet)
3. **Extração completa de entidades** (CPF, CNPJ, OAB, processos, valores, datas, leis)
4. **Resumos executivos** em múltiplos níveis
5. **Análise de risco** com recomendações
6. **Custo 50% menor** que v1 (otimização Haiku/Sonnet)
7. **9.5x mais informação útil**
8. **Preservação do texto original**

---

## Próximos Passos

1. ✅ Criar hook `useExtractionV2`
2. ✅ Criar componente `ExtractionV2Uploader`
3. ✅ Atualizar `ExtractionProgressBar` para suportar v2
4. ✅ Criar componente `ExtractionV2Results`
5. ⏳ Adicionar à página de extração
6. ⏳ Testar em produção
7. ⏳ Deprecar API v1 (opcional)

---

**ROM Agent v2.0** - Sistema Multi-Plataforma de Extração com Análise Profunda
© 2026 - Todos os direitos reservados
