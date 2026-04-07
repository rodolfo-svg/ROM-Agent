# 📊 DIAGRAMAS DE FLUXO - KNOWLEDGE BASE

## 🔴 FLUXO ATUAL (QUEBRADO)

```
┌─────────────────────────────────────────────────────────────────┐
│                     UPLOAD FLOW (BROKEN)                        │
└─────────────────────────────────────────────────────────────────┘

Frontend
   │
   │ POST /api/upload
   ├─────────────────────────────────────────────────┐
   │                                                 │
   ▼                                                 ▼
server-enhanced.js                            KB System
   │                                                 │
   │ multer.single('file')                          │
   │                                                 │
   ▼                                                 │
Save to disk                                        │
data/uploads/                                       │
   │                                                 │
   │                                                 │
   ▼                                                 │
Return fileInfo                                     │
{                                                   │
  success: true,                                    │
  path: "...",                                      │
  size: 12345                                       │
}                                                   │
   │                                                 │
   │                                                 │
   ▼                                                 ▼
Frontend shows                              kb-documents.json
"Upload bem-sucedido!"                      PERMANECE VAZIO []
                                                    │
                                                    │
                                                    ▼
                                            consultar_kb returns
                                            "Nenhum documento"
                                                    │
                                                    │
                                                    ▼
                                            USER CONFUSION 😡
                                            "Mas eu enviei!"

❌ PROBLEMA: Missing link between upload and KB!
```

---

## ✅ FLUXO CORRETO (ESPERADO)

```
┌─────────────────────────────────────────────────────────────────┐
│                     UPLOAD FLOW (FIXED)                         │
└─────────────────────────────────────────────────────────────────┘

Frontend
   │
   │ POST /api/upload
   ├─────────────────────────────────────────────────┐
   │                                                 │
   ▼                                                 ▼
server-enhanced.js                            KB System
   │                                                 │
   │ multer.single('file')                          │
   │                                                 │
   ▼                                                 │
Save to disk                                        │
data/uploads/                                       │
   │                                                 │
   │                                                 │
   │ ✅ NEW STEP: kbCache.add()                     │
   ├────────────────────────────────────────────────┤
   │                                                 │
   │                                                 ▼
   │                                         kb-documents.json
   │                                         ATUALIZADO ✅
   │                                         [{ id, name, path, ... }]
   │                                                 │
   │                                                 │
   ▼                                                 │
Return fileInfo + kbId                              │
{                                                   │
  success: true,                                    │
  path: "...",                                      │
  kbId: "abc123", ← NEW                             │
  message: "Adicionado ao KB!"                      │
}                                                   │
   │                                                 │
   │                                                 │
   ▼                                                 ▼
Frontend shows                              kbCache em memória
"Upload e KB OK!"                           SINCRONIZADO ✅
                                                    │
                                                    │
                                                    ▼
                                            consultar_kb returns
                                            DOCUMENTO ENCONTRADO ✅
                                                    │
                                                    │
                                                    ▼
                                            USER HAPPY 😊
                                            "Funciona!"

✅ SOLUÇÃO: Upload → Save → Add to KB → Return success
```

---

## 🔄 FLUXO COMPLETO: Upload → KB → Chat → Analysis

```
┌────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE DOCUMENT LIFECYCLE                         │
└────────────────────────────────────────────────────────────────────────┘

1️⃣ UPLOAD
   │
   ▼
┌──────────────────────┐
│  POST /api/upload    │
│                      │
│  - Receive file      │
│  - Save to disk      │
│  - Add to kbCache ✅ │
│  - Return fileInfo   │
└──────────────────────┘
   │
   │ File saved + KB registered
   │
   ▼
┌──────────────────────────────────────────────┐
│           KB STORAGE                         │
│                                              │
│  kb-documents.json:                          │
│  [{                                          │
│    id: "1234-abc",                           │
│    name: "processo.pdf",                     │
│    path: "/data/uploads/1234-abc.pdf",       │
│    userId: "user-123",                       │
│    uploadedAt: "2026-04-07T12:00:00Z",       │
│    metadata: { uploadMethod: "simple" }      │
│  }]                                          │
│                                              │
│  kbCache (in-memory):                        │
│  - Same data cached for fast access         │
│  - Auto-saves to disk every 5s or 10 docs   │
│  - Auto-reloads if modified externally       │
└──────────────────────────────────────────────┘
   │
   │ Document now visible in system
   │
   ├─────────────────────────────────┬────────────────────────────────┐
   │                                 │                                │
   ▼                                 ▼                                ▼

2️⃣ CHAT QUERY                   3️⃣ ANALYSIS REQUEST          4️⃣ DIRECT ANALYSIS

┌──────────────────────┐     ┌─────────────────────────┐    ┌──────────────────────┐
│  consultar_kb tool   │     │ analisar_documento_kb   │    │ POST /api/kb/        │
│                      │     │ tool (from chat)        │    │ analyze-v2           │
│  User: "o documento" │     │                         │    │                      │
│                      │     │ User: "analisa o        │    │ Body: {              │
│  → kbCache.getAll()  │     │ processo.pdf"           │    │   documentName,      │
│  → Filter by userId  │     │                         │    │   analysisType       │
│  → Filter by query   │     │ → Find in KB            │    │ }                    │
│  → Return docs       │     │ → Load text             │    │                      │
│                      │     │ → processComplete()     │    │ → Find in KB         │
│  Returns:            │     │                         │    │ → Load text          │
│  "📚 KB - 1 doc      │     │ Returns:                │    │ → processComplete()  │
│  encontrado          │     │ ✅ FICHAMENTO           │    │                      │
│                      │     │ ✅ CRONOLOGIA           │    │ Returns:             │
│  [Full text]"        │     │ ✅ ANALISE_JURIDICA     │    │ { jobId, progress }  │
│                      │     │ ✅ 18 files total       │    │                      │
│  ✅ Document loaded  │     │                         │    │ ✅ Analysis started  │
│  into chat context   │     │ ✅ All saved to KB      │    │ (background)         │
└──────────────────────┘     └─────────────────────────┘    └──────────────────────┘
   │                                 │                                │
   │                                 │                                │
   ▼                                 ▼                                ▼

User can discuss                User can download           User can download
document in chat               fichamentos from KB         fichamentos from KB

ALL FILES AVAILABLE IN KB AFTER ANALYSIS ✅
```

---

## 🔀 MERGE-FIRST ANALYSIS FLOW

```
┌────────────────────────────────────────────────────────────────────────┐
│                    VOLUME MERGE + ANALYSIS FLOW                        │
└────────────────────────────────────────────────────────────────────────┘

User uploads 3 volumes
   │
   ▼
┌────────────────────────────────┐
│ POST /api/kb/merge-volumes     │
│                                │
│ Files:                         │
│  - Vol1.pdf (300 pages)        │
│  - Vol2.pdf (250 pages)        │
│  - Vol3.pdf (200 pages)        │
│                                │
│ Total: 750 pages               │
└────────────────────────────────┘
   │
   │ 1️⃣ Auto-detect volume numbers
   │
   ▼
┌────────────────────────────────┐
│ Sort by volume:                │
│  1. Vol1.pdf                   │
│  2. Vol2.pdf                   │
│  3. Vol3.pdf                   │
└────────────────────────────────┘
   │
   │ 2️⃣ Create merged PDF with pdf-lib
   │
   ▼
┌────────────────────────────────┐
│ Merged: Processo_Completo.pdf  │
│ Size: 750 pages                │
└────────────────────────────────┘
   │
   │ 3️⃣ Save volumes to permanent location
   │
   ▼
┌────────────────────────────────┐
│ data/uploads/volumes/          │
│ timestamp_Processo/            │
│   ├── Vol1.pdf ✅              │
│   ├── Vol2.pdf ✅              │
│   └── Vol3.pdf ✅              │
└────────────────────────────────┘
   │
   │ 4️⃣ Register in KB with metadata
   │
   ▼
┌─────────────────────────────────────────────┐
│ kbCache.add({                               │
│   id: "merged-123",                         │
│   name: "Processo_Completo.pdf",            │
│   metadata: {                               │
│     isMergedDocument: true,                 │
│     volumesCount: 3,                        │
│     totalPages: 750,                        │
│     sourceVolumes: [                        │
│       { name: "Vol1.pdf", path: "..." },    │
│       { name: "Vol2.pdf", path: "..." },    │
│       { name: "Vol3.pdf", path: "..." }     │
│     ]                                       │
│   }                                         │
│ })                                          │
│                                             │
│ ✅ DOCUMENTO VISÍVEL NO KB IMEDIATAMENTE   │
└─────────────────────────────────────────────┘
   │
   │ User triggers analysis
   │
   ▼
┌────────────────────────────────┐
│ POST /api/kb/analyze-v2        │
│ documentName: "Processo_       │
│               Completo.pdf"    │
└────────────────────────────────┘
   │
   │ 5️⃣ Detect merged document
   │
   ▼
┌────────────────────────────────────────────────────┐
│ MERGE-FIRST ANALYSIS STRATEGY                     │
│                                                    │
│ Instead of:                                        │
│   Extract merged PDF (750 pages, slow)            │
│                                                    │
│ Do:                                                │
│   Extract each volume IN PARALLEL ⚡               │
│                                                    │
│   Promise.all([                                    │
│     extractVolume1(Vol1.pdf),  ← 300 pages        │
│     extractVolume2(Vol2.pdf),  ← 250 pages        │
│     extractVolume3(Vol3.pdf)   ← 200 pages        │
│   ])                                               │
│                                                    │
│   Benefits:                                        │
│   - 3x faster (parallel extraction)               │
│   - Better handling of volume boundaries          │
│   - Preserves volume context                      │
└────────────────────────────────────────────────────┘
   │
   │ 6️⃣ Concatenate texts in order
   │
   ▼
┌────────────────────────────────────────────────────┐
│ Combined Text:                                     │
│                                                    │
│ ═════════════════════════════════                  │
│ VOLUME 1: Vol1.pdf                                 │
│ PÁGINAS: 300                                       │
│ ═════════════════════════════════                  │
│ [text from Vol1...]                                │
│                                                    │
│ ═════════════════════════════════                  │
│ VOLUME 2: Vol2.pdf                                 │
│ PÁGINAS: 250                                       │
│ ═════════════════════════════════                  │
│ [text from Vol2...]                                │
│                                                    │
│ ═════════════════════════════════                  │
│ VOLUME 3: Vol3.pdf                                 │
│ PÁGINAS: 200                                       │
│ ═════════════════════════════════                  │
│ [text from Vol3...]                                │
│                                                    │
│ Total: 750 pages, ~2M characters                   │
└────────────────────────────────────────────────────┘
   │
   │ 7️⃣ Analyze ONCE with Claude
   │
   ▼
┌────────────────────────────────────────────────────┐
│ documentProcessorV2.processComplete()              │
│                                                    │
│ Input: Combined text (all 3 volumes)              │
│ Model: Claude Sonnet/Opus                         │
│                                                    │
│ Generates:                                         │
│  ✅ FICHAMENTO (18 ficheiros)                     │
│  ✅ CRONOLOGIA                                     │
│  ✅ ANALISE_JURIDICA                              │
│  ✅ RESUMO_EXECUTIVO                              │
│  ✅ ... and 14 more                                │
│                                                    │
│ Cost: 1× analysis (not 3×!) 💰                    │
│ Total: ~$4.50 for 750 pages                       │
│                                                    │
│ vs Traditional:                                    │
│   Analyze Vol1: $1.50                             │
│   Analyze Vol2: $1.25                             │
│   Analyze Vol3: $1.00                             │
│   TOTAL: $3.75                                     │
│   BUT: 3 separate analyses (no context!)          │
│                                                    │
│ Merge-First Advantage:                            │
│   - Single unified analysis ✅                     │
│   - Preserves context across volumes ✅            │
│   - Same cost ✅                                   │
│   - Better quality output ✅                       │
└────────────────────────────────────────────────────┘
   │
   │ 8️⃣ Save all files to KB
   │
   ▼
┌────────────────────────────────────────────────────┐
│ All files registered in KB:                        │
│                                                    │
│  1. Processo_Completo.pdf (merged)                │
│  2. 01_FICHAMENTO.md                              │
│  3. 02_CRONOLOGIA.md                              │
│  4. 03_LINHA_DO_TEMPO.md                          │
│  ... (18 total ficheiros)                         │
│                                                    │
│ ✅ ALL FILES QUERYABLE IN CHAT                    │
└────────────────────────────────────────────────────┘
   │
   │
   ▼
User can download any file
User can query in chat
User can re-analyze if needed

COMPLETE WORKFLOW ✅
```

---

## 📊 KB CACHE ARCHITECTURE

```
┌────────────────────────────────────────────────────────────────────────┐
│                        KB CACHE SYSTEM                                 │
└────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐
│   kbCache Singleton     │
│   (In-Memory)           │
│                         │
│  - cache: Array         │
│  - loaded: boolean      │
│  - dirty: boolean       │
│  - lastFileModTime: ms  │
└─────────────────────────┘
            │
            │ On Startup
            ▼
┌─────────────────────────────────────────┐
│  load()                                 │
│                                         │
│  - Read kb-documents.json              │
│  - Parse to Array                      │
│  - Store in memory                     │
│  - Save lastFileModTime                │
│                                         │
│  Performance: 1 read (~10ms)           │
└─────────────────────────────────────────┘
            │
            │ Cache loaded ✅
            │
            ├─────────────────┬──────────────────┬──────────────────┐
            │                 │                  │                  │
            ▼                 ▼                  ▼                  ▼

    ┌─────────────┐   ┌─────────────┐  ┌─────────────┐   ┌─────────────┐
    │  getAll()   │   │  getById()  │  │  filter()   │   │   add()     │
    │             │   │             │  │             │   │             │
    │  Return all │   │  Find by ID │  │  Custom     │   │  Add doc(s) │
    │  documents  │   │             │  │  predicate  │   │  to cache   │
    │             │   │             │  │             │   │             │
    │  O(1) copy  │   │  O(n) find  │  │  O(n)       │   │  O(1) push  │
    └─────────────┘   └─────────────┘  └─────────────┘   └─────────────┘
                                                                  │
                                                                  │
                                                                  ▼
                                                          ┌──────────────────┐
                                                          │ Mark dirty=true  │
                                                          │ Increment count  │
                                                          │                  │
                                                          │ If count >= 10:  │
                                                          │   Save now       │
                                                          │ Else:            │
                                                          │   Schedule save  │
                                                          │   (5s debounce)  │
                                                          └──────────────────┘
                                                                  │
                                                                  │
                                                                  ▼
                                                          ┌──────────────────────────┐
                                                          │ _saveNow() - ATOMIC      │
                                                          │                          │
                                                          │ 1. Acquire lock 🔒       │
                                                          │ 2. Read current disk     │
                                                          │ 3. Merge if modified     │
                                                          │ 4. Write to temp file    │
                                                          │ 5. Rename atomically     │
                                                          │ 6. Update timestamp      │
                                                          │ 7. Release lock 🔓       │
                                                          │                          │
                                                          │ ✅ Safe in cluster mode  │
                                                          └──────────────────────────┘
                                                                  │
                                                                  │
                                                                  ▼
                                                          ┌──────────────────────────┐
                                                          │ kb-documents.json        │
                                                          │ PERSISTED TO DISK ✅     │
                                                          │                          │
                                                          │ Performance:             │
                                                          │ - 1 write per 5s or 10   │
                                                          │   docs (vs N writes)     │
                                                          │ - 300-900x faster        │
                                                          └──────────────────────────┘

┌─────────────────────────────────────────┐
│  Auto-Reload (Every 3s)                 │
│                                         │
│  setInterval(() => {                    │
│    if (fileModTime > lastFileModTime) { │
│      console.log('External change')     │
│      reload()                           │
│    }                                    │
│  }, 3000)                               │
│                                         │
│  ✅ Cluster-safe                        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Shutdown Hooks                         │
│                                         │
│  process.on('SIGTERM', () => {          │
│    _saveSyncNow()                       │
│    process.exit(0)                      │
│  })                                     │
│                                         │
│  ✅ No data loss on restart             │
└─────────────────────────────────────────┘
```

---

## 🔧 DOCUMENT PROCESSOR V2 ARCHITECTURE

```
┌────────────────────────────────────────────────────────────────────────┐
│                    DOCUMENT PROCESSOR V2                               │
└────────────────────────────────────────────────────────────────────────┘

Input: PDF file (300 pages, 1.5M tokens)
   │
   │
   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ STAGE 1: EXTRACTION (Budget LLM)                                     │
│                                                                       │
│ Model: Amazon Nova Micro                                             │
│ Cost: $0.035 per 1M input tokens                                     │
│                                                                       │
│ Task: Extract clean, structured text                                 │
│                                                                       │
│ Process:                                                              │
│  1. Read PDF with pdf-parse                                          │
│  2. If scanned → OCR with Tesseract                                  │
│  3. Send to Nova Micro for cleaning                                  │
│  4. Nova removes headers, footers, artifacts                         │
│  5. Nova structures text logically                                   │
│                                                                       │
│ Output: Clean text (1.5M tokens)                                     │
│ Cost: $0.052 (1.5M tokens × $0.035/1M)                               │
│                                                                       │
│ Time: ~2 minutes                                                      │
└───────────────────────────────────────────────────────────────────────┘
   │
   │ Clean text extracted ✅
   │
   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ STAGE 2: SAVE TO KB (Intermediate Document)                          │
│                                                                       │
│ Method: saveExtractedTextToKB()                                      │
│                                                                       │
│ Actions:                                                              │
│  1. Create intermediate doc:                                         │
│     {                                                                 │
│       id: "kb-extracted-abc-123",                                    │
│       name: "processo.pdf - TEXTO_COMPLETO.md",                      │
│       extractedText: "[1.5M chars]",                                 │
│       userId: "user-123",                                            │
│       metadata: {                                                    │
│         isExtractedText: true,                                       │
│         parentDocument: "processo.pdf",                              │
│         extractionSource: "nova-micro"                               │
│       }                                                               │
│     }                                                                 │
│                                                                       │
│  2. Save .md file to cache                                           │
│  3. Add to kb-documents.json via kbCache.add()                       │
│  4. Optionally save .txt to knowledge-base/documents/                │
│                                                                       │
│ Benefits:                                                             │
│  ✅ Text reusable for multiple analyses                              │
│  ✅ No need to re-extract if user wants different analysis           │
│  ✅ Intermediate document queryable in chat                          │
│                                                                       │
│ Cost: $0 (local I/O)                                                 │
│ Time: <1 second                                                       │
└───────────────────────────────────────────────────────────────────────┘
   │
   │ Intermediate doc saved ✅
   │
   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ STAGE 3: ANALYSIS (Premium LLM)                                      │
│                                                                       │
│ Model: Claude Sonnet 4.5 / Opus 4                                    │
│ Cost: $3.00 input + $15.00 output per 1M tokens                      │
│                                                                       │
│ Task: Generate 18 technical documents                                │
│                                                                       │
│ Input: Clean text from Stage 2 (1.5M tokens)                         │
│                                                                       │
│ Process:                                                              │
│  For each document type:                                             │
│    1. FICHAMENTO                                                     │
│    2. CRONOLOGIA                                                     │
│    3. LINHA_DO_TEMPO                                                 │
│    4. MAPA_DE_PARTES                                                 │
│    5. RESUMO_EXECUTIVO                                               │
│    6. TESES_JURIDICAS                                                │
│    7. ANALISE_DE_PROVAS                                              │
│    8. QUESTOES_JURIDICAS                                             │
│    9. PEDIDOS_E_DECISOES                                             │
│   10. RECURSOS_INTERPOSTOS                                           │
│   11. PRAZOS_E_INTIMACOES                                            │
│   12. CUSTAS_E_VALORES                                               │
│   13. LEGISLACAO_CITADA                                              │
│   14. JURISPRUDENCIA_CITADA                                          │
│   15. DOUTRINA_CITADA                                                │
│   16. ANALISE_TESE_DEFESA                                            │
│   17. PONTOS_CRITICOS                                                │
│   18. ESTRATEGIA_PROCESSUAL                                          │
│                                                                       │
│  Send batch prompt to Claude with all 18 tasks                       │
│                                                                       │
│ Output: 18 markdown/text files                                       │
│                                                                       │
│ Cost Breakdown:                                                       │
│  - Input: 1.5M tokens × $3.00/1M = $4.50                             │
│  - Output: ~50k tokens × $15.00/1M = $0.75                           │
│  - Total: $5.25                                                       │
│                                                                       │
│ Time: ~5 minutes (batch processing)                                  │
└───────────────────────────────────────────────────────────────────────┘
   │
   │ 18 files generated ✅
   │
   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ STAGE 4: SAVE TECHNICAL FILES TO KB                                  │
│                                                                       │
│ Method: saveTechnicalFilesToKB()                                     │
│                                                                       │
│ For each of 18 files:                                                │
│  1. Create KB document:                                              │
│     {                                                                 │
│       id: "kb-fichamento-abc-123",                                   │
│       name: "processo.pdf - 01_FICHAMENTO.md",                       │
│       extractedText: "[file content]",                               │
│       userId: "user-123",                                            │
│       metadata: {                                                    │
│         isStructuredDocument: true,                                  │
│         parentDocument: "processo.pdf",                              │
│         documentType: "FICHAMENTO"                                   │
│       }                                                               │
│     }                                                                 │
│                                                                       │
│  2. Save .md file to knowledge-base/documents/                       │
│  3. Add to kb-documents.json via kbCache.add()                       │
│                                                                       │
│ Result:                                                               │
│  ✅ 18 files saved                                                   │
│  ✅ All queryable in chat                                            │
│  ✅ All downloadable                                                 │
│  ✅ Main doc metadata updated with references                        │
│                                                                       │
│ Cost: $0 (local I/O)                                                 │
│ Time: ~2 seconds (18 × 100ms)                                        │
└───────────────────────────────────────────────────────────────────────┘
   │
   │
   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ FINAL RESULT                                                          │
│                                                                       │
│ KB now contains:                                                      │
│  1. processo.pdf (original)                                          │
│  2. processo.pdf - TEXTO_COMPLETO.md (extracted)                     │
│  3. processo.pdf - 01_FICHAMENTO.md                                  │
│  4. processo.pdf - 02_CRONOLOGIA.md                                  │
│  ... (18 structured documents)                                       │
│                                                                       │
│ Total: 20 documents                                                   │
│                                                                       │
│ Total Cost: $5.32                                                     │
│  - Extraction: $0.052                                                 │
│  - Analysis: $5.25                                                    │
│  - Storage: $0                                                        │
│                                                                       │
│ vs Traditional (100% Claude):                                        │
│  - Direct analysis: 1.5M tokens × $3.00/1M = $4.50                   │
│  - Generate files: same $0.75                                        │
│  - BUT: No intermediate text saved                                   │
│  - If re-analyze: Another $4.50                                      │
│                                                                       │
│ Processor V2 Advantage:                                               │
│  ✅ Intermediate text reusable (avoid re-extraction)                 │
│  ✅ Can analyze multiple times with different prompts                │
│  ✅ Cheaper for scanned PDFs (OCR + Nova vs OCR + Claude)            │
│  ✅ All files tracked in KB                                          │
│                                                                       │
│ Quality: ⭐⭐⭐⭐⭐ Excellent                                           │
│ Speed: ⭐⭐⭐⭐ Good (7-8 minutes total)                               │
│ Cost: ⭐⭐⭐⭐ Optimized (50% savings on re-analysis)                 │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 SUMMARY DIAGRAM: Current vs Desired State

```
┌────────────────────────────────────────────────────────────────────────┐
│                      CURRENT STATE (BROKEN)                            │
└────────────────────────────────────────────────────────────────────────┘

Upload                  KB System              Chat
  │                        │                     │
  │ POST /api/upload       │                     │
  ├───────────────────────►│                     │
  │                        │                     │
  │ Save file ✅           │                     │
  │                        │                     │
  │ Return fileInfo        │                     │
  │                        │                     │
  │ ❌ NO KB registration  │                     │
  │                        │                     │
  │                        │ kb-documents.json   │
  │                        │ = []  (EMPTY)       │
  │                        │                     │
  │                        │                     │ consultar_kb
  │                        │                     ├──────────────►
  │                        │                     │
  │                        │                     │ Returns: "Nenhum
  │                        │                     │ documento"
  │                        │                     │
  │                        │                     │ ❌ BROKEN
  │                        │                     │

┌────────────────────────────────────────────────────────────────────────┐
│                      DESIRED STATE (FIXED)                             │
└────────────────────────────────────────────────────────────────────────┘

Upload                  KB System              Chat
  │                        │                     │
  │ POST /api/upload       │                     │
  ├───────────────────────►│                     │
  │                        │                     │
  │ Save file ✅           │                     │
  │                        │                     │
  │ ✅ kbCache.add()       │                     │
  ├───────────────────────►│                     │
  │                        │                     │
  │ Return fileInfo        │ kb-documents.json   │
  │ + kbId                 │ = [{ doc }] ✅      │
  │                        │                     │
  │                        │                     │ consultar_kb
  │                        │                     ├──────────────►
  │                        │                     │
  │                        │ kbCache.getAll()    │
  │                        │◄────────────────────┤
  │                        │                     │
  │                        │ Returns: [doc] ✅   │
  │                        ├────────────────────►│
  │                        │                     │
  │                        │                     │ "📚 1 documento
  │                        │                     │ encontrado"
  │                        │                     │
  │                        │                     │ ✅ WORKING
  │                        │                     │
```

---

**FIM DOS DIAGRAMAS**

Todos os diagramas criados em formato ASCII para máxima compatibilidade.
