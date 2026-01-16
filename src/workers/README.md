# Worker Threads para Extração Isolada

Sistema de Worker Threads isolados para extração segura de documentos PDF/DOCX.

## Problema Resolvido

PDFs corrompidos ou malformados podem crashar o processo Node.js principal, derrubando todo o servidor. Este sistema isola a extração em Worker Threads separados, garantindo que:

- PDFs corrompidos não crasham o servidor
- Processos travados são terminados automaticamente
- O servidor se recupera de falhas
- Métricas detalhadas são coletadas

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    Processo Principal                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              ExtractWorkerWrapper                     │   │
│  │  - API simplificada                                   │   │
│  │  - Validação de entrada                               │   │
│  │  - Cache de resultados                                │   │
│  │  - Fallback síncrono                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   WorkerPool                          │   │
│  │  - Gerenciamento de workers                           │   │
│  │  - Balanceamento de carga                             │   │
│  │  - Retry automático                                   │   │
│  │  - Health checks                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │ Message Passing
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │ Worker 1 │      │ Worker 2 │      │ Worker N │
    │ (isolado)│      │ (isolado)│      │ (isolado)│
    └──────────┘      └──────────┘      └──────────┘
        │                 │                 │
        ▼                 ▼                 ▼
    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │ pdf-parse│      │ pdf-parse│      │ pdf-parse│
    │ mammoth  │      │ mammoth  │      │ mammoth  │
    └──────────┘      └──────────┘      └──────────┘
```

## Arquivos

- `extract-worker.js` - Worker Thread isolado que faz a extração
- `worker-pool.js` - Gerenciador de pool de workers
- `extract-worker-wrapper.js` - Interface de alto nível
- `index.js` - Exportações centralizadas
- `__tests__/extract-worker.test.js` - Testes de crash e resiliência

## Uso Básico

### Extração Simples

```javascript
import { extractFile } from './workers/index.js';

// Extrair um arquivo
const result = await extractFile('/path/to/document.pdf');

console.log(result.text);
console.log(result.pages);
console.log(result.processingTime);
```

### Extração em Batch

```javascript
import { extractFiles } from './workers/index.js';

const files = [
  '/path/to/doc1.pdf',
  '/path/to/doc2.docx',
  '/path/to/doc3.txt'
];

const results = await extractFiles(files, { concurrency: 4 });

console.log(`Sucesso: ${results.successful}/${results.total}`);
```

### Uso com Wrapper Completo

```javascript
import { getExtractWrapper } from './workers/index.js';

// Obter instância do wrapper
const wrapper = await getExtractWrapper({
  poolSize: 4,
  maxFileSizeMB: 100,
  useWorkers: true,
  useFallback: true
});

// Extrair com opções
const result = await wrapper.extract('/path/to/doc.pdf', {
  timeout: 60000,
  maxRetries: 3
});

// Verificar saúde
const health = await wrapper.healthCheck();
console.log(health.status);

// Obter métricas
const metrics = wrapper.getMetrics();
console.log(metrics.successRate);
```

## Integração com server-enhanced.js

### 1. Importar o módulo

```javascript
// No topo do arquivo
import { getExtractWrapper, shutdownWorkers } from './workers/index.js';
```

### 2. Inicializar no startup

```javascript
// Durante inicialização do servidor
let extractWrapper;

async function initializeServer() {
  // ... outras inicializações ...

  // Inicializar extração isolada
  extractWrapper = await getExtractWrapper({
    poolSize: 4,
    taskTimeout: 120000,
    maxRetries: 3,
    useFallback: true,
    enableMetrics: true
  });

  console.log('✅ Worker Threads de extração inicializados');
}
```

### 3. Usar na rota de upload

```javascript
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const filePath = req.file.path;

    // Extração isolada e segura
    const result = await extractWrapper.extract(filePath, {
      timeout: 60000
    });

    if (!result.success) {
      return res.status(400).json({
        error: 'Falha na extração',
        warnings: result.warnings,
        errors: result.errors
      });
    }

    res.json({
      success: true,
      text: result.text,
      pages: result.pages,
      processingTime: result.processingTime
    });

  } catch (error) {
    // Mesmo com PDF corrompido, o servidor não crashou
    logger.error('Erro na extração', { error: error.message });

    res.status(500).json({
      error: 'Erro ao processar arquivo',
      message: error.message,
      code: error.code
    });
  }
});
```

### 4. Endpoint de health check

```javascript
app.get('/api/workers/health', async (req, res) => {
  const health = await extractWrapper.healthCheck();
  res.json(health);
});

app.get('/api/workers/metrics', async (req, res) => {
  const metrics = extractWrapper.getMetrics();
  res.json(metrics);
});
```

### 5. Shutdown gracioso

```javascript
process.on('SIGTERM', async () => {
  console.log('Encerrando servidor...');

  // Encerrar workers
  await shutdownWorkers();

  // ... encerrar outras conexões ...

  process.exit(0);
});
```

## Configurações

### Pool de Workers

| Opção | Padrão | Descrição |
|-------|--------|-----------|
| `poolSize` | CPUs/2 (2-8) | Número de workers |
| `taskTimeout` | 120000 | Timeout por tarefa (ms) |
| `maxRetries` | 3 | Tentativas em caso de falha |
| `healthCheckInterval` | 30000 | Intervalo de health check (ms) |
| `gracefulShutdownTimeout` | 5000 | Timeout de shutdown (ms) |
| `maxQueueSize` | 1000 | Tamanho máximo da fila |

### Wrapper

| Opção | Padrão | Descrição |
|-------|--------|-----------|
| `useWorkers` | true | Usar workers isolados |
| `useFallback` | true | Fallback síncrono se workers falharem |
| `maxFileSizeMB` | 100 | Tamanho máximo de arquivo |
| `enableLogging` | true | Ativar logs |
| `enableMetrics` | true | Coletar métricas |

## Métricas Disponíveis

```javascript
const metrics = wrapper.getMetrics();

// Pool
metrics.totalExtractions     // Total de extrações
metrics.successfulExtractions // Extrações bem-sucedidas
metrics.failedExtractions    // Extrações com falha
metrics.fallbackUsed         // Vezes que fallback foi usado
metrics.successRate          // Taxa de sucesso (%)
metrics.averageProcessingTimeMs // Tempo médio de processamento

// Erros recentes
metrics.recentErrors         // Últimos 10 erros
```

## Eventos

O wrapper emite eventos para monitoramento:

```javascript
wrapper.on('log', (logEntry) => {
  // { level, message, data, timestamp }
});

wrapper.on('workerError', (errorData) => {
  // Erro em um worker
});

wrapper.on('workerExit', (exitData) => {
  // Worker encerrado
});

wrapper.on('healthCheck', (results) => {
  // Resultado do health check
});
```

## Testes

```bash
# Rodar testes
npm test src/workers/__tests__/extract-worker.test.js

# Testes com verbose
npm test -- --verbose src/workers/__tests__/extract-worker.test.js
```

### Tipos de Teste

1. **Crash Safety**: PDFs corrompidos não crasham o servidor
2. **Timeout**: Tarefas travadas são terminadas
3. **Retry**: Retry automático funciona
4. **Fallback**: Fallback síncrono funciona
5. **Métricas**: Métricas são coletadas corretamente
6. **Batch**: Processamento paralelo funciona
7. **Stress**: Múltiplos PDFs corrompidos em sequência

## Troubleshooting

### Worker não inicializa

```
Erro: Timeout aguardando worker inicializar
```

Verifique se as dependências estão instaladas:
```bash
npm install pdf-parse mammoth
```

### Timeout em extração

```
Erro: Timeout: tarefa não completou em 120000ms
```

Aumente o timeout ou verifique se o PDF não está muito grande:
```javascript
await wrapper.extract(file, { timeout: 300000 }); // 5 minutos
```

### Pool não responde

```
Erro: Pool está em processo de shutdown
```

Verifique se o servidor não está encerrando:
```javascript
const health = await wrapper.healthCheck();
console.log(health.status);
```

## Referências

- [Node.js Worker Threads Documentation](https://nodejs.org/api/worker_threads.html)
- [Best Practices for Worker Threads](https://last9.io/blog/understanding-worker-threads-in-node-js/)
- [node-worker-threads-pool](https://github.com/SUCHMOKUO/node-worker-threads-pool)
