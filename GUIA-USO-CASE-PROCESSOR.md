# 🚀 Guia de Uso - ROM Case Processor

## Sistema Completo de Extração + Processamento de Casos Jurídicos

**Status:** ✅ FUNCIONANDO EM PRODUÇÃO
**URL Base:** https://iarom.com.br

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [APIs Disponíveis](#apis-disponíveis)
3. [Como Usar](#como-usar)
4. [Exemplos Práticos](#exemplos-práticos)
5. [Monitoramento em Tempo Real](#monitoramento-em-tempo-real)

---

## 🎯 Visão Geral

### Arquitetura Layer Cake (5 Camadas)

```
LAYER 1: Extração Bruta (executada UMA vez)
   └── 33 ferramentas de limpeza de texto
   └── Custo: $0.00 (100% local)

LAYER 2: Índices e Metadados (cache persistente)
   └── Indexação cronológica, por tipo, entidades
   └── Cache automático

LAYER 3: Análises Especializadas (processamento paralelo)
   └── 8 workers paralelos
   └── Análise de partes, pedidos, fatos

LAYER 4: Jurisprudência Verificável (busca on-demand)
   └── Busca em tribunais
   └── Verificação de leading cases

LAYER 5: Redação Final (apenas quando solicitado)
   └── Geração de peças jurídicas
   └-- Aplicação de jurisprudência
```

### 🔧 Ferramentas de Extração (33 total)

1-11: **Normalização Básica**
- Unicode, caracteres de controle, quebras de linha
- Espaços múltiplos, aspas, reticências
- Pontuação, traços, hifenização

12-23: **Limpeza de Documentos**
- Cabeçalhos, rodapés, numeração de página
- Watermarks, marcadores de sigilo
- Códigos de barras, IDs de sistema

24-33: **Normalização Jurídica**
- CPF, CNPJ, OAB, telefones
- Números CNJ, datas, valores monetários
- Artigos de lei, parágrafos, incisos

### ⚙️ Processadores de Otimização (10 total)

1. Extração de Metadados
2. Identificação de Documentos
3. Compactação de Redundâncias
4. Segmentação Processual
5. Normalização de Estrutura
6. Enriquecimento de Contexto
7. Otimização de Espaço
8. Geração de Índice
9. Divisão em Chunks
10. Exportação Estruturada

---

## 🌐 APIs Disponíveis

### 1. POST /api/case-processor/process

Processar caso completo com 5 layers

**Endpoint:** `https://iarom.com.br/api/case-processor/process`

**Body:**
```json
{
  "casoId": "CASO_123",
  "documentPaths": [
    "/path/to/peticao_inicial.pdf",
    "/path/to/contestacao.pdf",
    "/path/to/sentenca.pdf"
  ],
  "indexLevel": "quick",
  "generateDocument": false,
  "documentType": "peticao-inicial"
}
```

**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `casoId` | string | ✅ Sim | ID único do caso |
| `documentPaths` | array | ✅ Sim | Caminhos dos PDFs a processar |
| `indexLevel` | string | ❌ Não | `quick` (3min), `medium` (15min), `full` |
| `generateDocument` | boolean | ❌ Não | Gerar peça jurídica final (Layer 5) |
| `documentType` | string | ❌ Não | Tipo de peça: `peticao-inicial`, `contestacao`, etc. |

**Resposta:**
```json
{
  "success": true,
  "casoId": "CASO_123",
  "layers": {
    "layer1": { "status": "completed", "documents": 3 },
    "layer2": { "status": "completed", "indexes": {...} },
    "layer3": { "status": "completed", "analyses": {...} },
    "layer4": { "status": "skipped" },
    "layer5": { "status": "skipped" }
  },
  "progressiveIndex": {
    "level": "quick",
    "totalDocuments": 3,
    "estimatedComplexity": "medium"
  },
  "processingTime": "2m 45s"
}
```

---

### 2. GET /api/case-processor/:casoId/stream

Stream de Server-Sent Events para acompanhar processamento em tempo real

**Endpoint:** `https://iarom.com.br/api/case-processor/CASO_123/stream`

**Como usar (JavaScript):**
```javascript
const eventSource = new EventSource(
  'https://iarom.com.br/api/case-processor/CASO_123/stream'
);

eventSource.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log(`[${update.type}] ${update.message}`);

  // Exibir na tela para o usuário
  updateProgress(update);
};

eventSource.addEventListener('complete', (event) => {
  const result = JSON.parse(event.data);
  console.log('✅ Processamento concluído!', result);
  eventSource.close();
});

eventSource.addEventListener('error', (event) => {
  const error = JSON.parse(event.data);
  console.error('❌ Erro:', error);
  eventSource.close();
});
```

**Updates recebidos:**
```json
{
  "type": "info",
  "message": "Iniciando Layer 1: Extração Bruta",
  "timestamp": "2025-12-16T05:45:00.000Z"
}

{
  "type": "progress",
  "message": "Extraindo documento 1/3: peticao_inicial.pdf",
  "progress": 33,
  "timestamp": "2025-12-16T05:45:15.000Z"
}

{
  "type": "success",
  "message": "Layer 1 concluída: 3 documentos extraídos",
  "timestamp": "2025-12-16T05:46:00.000Z"
}
```

---

### 3. GET /api/case-processor/:casoId/status

Obter status atual do processamento (polling fallback)

**Endpoint:** `https://iarom.com.br/api/case-processor/CASO_123/status`

**Resposta:**
```json
{
  "success": true,
  "casoId": "CASO_123",
  "status": "processing",
  "currentLayer": 2,
  "progress": 45,
  "startedAt": "2025-12-16T05:45:00.000Z",
  "elapsedTime": "1m 30s",
  "recentUpdates": [...]
}
```

---

### 4. GET /api/case-processor/:casoId/updates

Obter todos os updates de uma sessão

**Endpoint:** `https://iarom.com.br/api/case-processor/CASO_123/updates`

**Resposta:**
```json
{
  "success": true,
  "casoId": "CASO_123",
  "total": 25,
  "updates": [
    { "type": "info", "message": "...", "timestamp": "..." },
    { "type": "progress", "message": "...", "timestamp": "..." }
  ]
}
```

---

## 💡 Como Usar

### Fluxo Básico

1. **Upload de Documentos**
   ```bash
   # Fazer upload dos PDFs via /api/upload
   curl -X POST https://iarom.com.br/api/upload \
     -F "file=@peticao_inicial.pdf"
   ```

2. **Iniciar Processamento**
   ```bash
   curl -X POST https://iarom.com.br/api/case-processor/process \
     -H "Content-Type: application/json" \
     -d '{
       "casoId": "CASO_2024_001",
       "documentPaths": ["/upload/peticao_inicial.pdf"],
       "indexLevel": "quick"
     }'
   ```

3. **Acompanhar em Tempo Real**
   ```javascript
   const sse = new EventSource(
     'https://iarom.com.br/api/case-processor/CASO_2024_001/stream'
   );

   sse.onmessage = (e) => {
     const update = JSON.parse(e.data);
     showUpdate(update);
   };
   ```

---

## 🎬 Exemplos Práticos

### Exemplo 1: Processar Caso Rápido (Quick Index - 3 minutos)

```javascript
// 1. Iniciar processamento
const response = await fetch('https://iarom.com.br/api/case-processor/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    casoId: 'CASO_2024_001',
    documentPaths: [
      '/upload/peticao_inicial.pdf',
      '/upload/contestacao.pdf'
    ],
    indexLevel: 'quick'  // 3 minutos
  })
});

const result = await response.json();
console.log('Processamento iniciado:', result);

// 2. Acompanhar progresso
const sse = new EventSource(
  'https://iarom.com.br/api/case-processor/CASO_2024_001/stream'
);

sse.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log(`📊 ${update.message}`);
};
```

---

### Exemplo 2: Processar Caso Completo + Gerar Peça (Full - 25-45 minutos)

```javascript
const response = await fetch('https://iarom.com.br/api/case-processor/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    casoId: 'CASO_2024_002',
    documentPaths: [
      '/upload/peticao_inicial.pdf',
      '/upload/contestacao.pdf',
      '/upload/sentenca.pdf',
      '/upload/recursos.pdf'
    ],
    indexLevel: 'full',           // Processamento completo
    generateDocument: true,        // Gerar peça final (Layer 5)
    documentType: 'peticao-inicial'
  })
});

// Resultado incluirá a peça gerada em result.document
```

---

## 📡 Monitoramento em Tempo Real

### Interface de Feedback (HTML + JavaScript)

```html
<!DOCTYPE html>
<html>
<head>
    <title>ROM Case Processor - Monitor</title>
    <style>
        #progress { font-family: monospace; }
        .info { color: blue; }
        .success { color: green; }
        .error { color: red; }
        .warning { color: orange; }
    </style>
</head>
<body>
    <h1>Processamento de Caso</h1>
    <div id="progress"></div>

    <script>
        const casoId = 'CASO_2024_001';
        const progressDiv = document.getElementById('progress');

        const sse = new EventSource(
            `https://iarom.com.br/api/case-processor/${casoId}/stream`
        );

        sse.onmessage = (event) => {
            const update = JSON.parse(event.data);
            const line = document.createElement('div');
            line.className = update.type;
            line.textContent = `[${new Date().toLocaleTimeString()}] ${update.message}`;
            progressDiv.appendChild(line);

            // Auto-scroll
            progressDiv.scrollTop = progressDiv.scrollHeight;
        };

        sse.addEventListener('complete', (event) => {
            const result = JSON.parse(event.data);
            const line = document.createElement('div');
            line.className = 'success';
            line.textContent = `✅ CONCLUÍDO em ${result.totalTime}`;
            progressDiv.appendChild(line);
            sse.close();
        });
    </script>
</body>
</html>
```

---

## 🎯 Resumo

✅ **APIs disponíveis em produção:** https://iarom.com.br
✅ **Extração:** 33 ferramentas (custo $0.00)
✅ **Otimização:** 10 processadores
✅ **Arquitetura:** 5 layers com cache
✅ **Feedback:** Tempo real via SSE
✅ **Processamento:** Paralelo (8 workers)

**Próximos passos:**
1. Testar com documentos reais
2. Ajustar parâmetros conforme necessário
3. Monitorar performance e cache

---

© 2025 - ROM Agent Case Processor
Desenvolvido com Claude Code
