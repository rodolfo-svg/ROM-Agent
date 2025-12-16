# Sistema de Feedback em Tempo Real

Sistema de atualização linha a linha durante processamentos longos, similar ao Claude.ai

## 🎯 Objetivo

Evitar ansiedade do usuário durante processos que podem levar 25-45 minutos, mostrando o progresso em tempo real de cada etapa do processamento das 5 layers.

## 🏗️ Arquitetura

### 1. **Progress Emitter** (`utils/progress-emitter.js`)
- Singleton que gerencia sessões de progresso
- Emite events usando EventEmitter do Node.js
- Mantém histórico de updates por caso

### 2. **SSE Routes** (`routes/case-processor-sse.js`)
- Endpoint `GET /api/case-processor/:casoId/stream` para Server-Sent Events
- Endpoint `GET /api/case-processor/:casoId/status` para polling (fallback)
- Endpoint `GET /api/case-processor/:casoId/updates` para histórico completo

### 3. **Integration** (no rom-case-processor-service.js)
- Chama progressEmitter em cada etapa do processamento
- Emite updates sobre layers, steps, results, erros

## 📡 Como Funciona

### Backend

```javascript
import progressEmitter from '../utils/progress-emitter.js';

// Iniciar sessão
progressEmitter.startSession(casoId, {
  totalDocuments: 5,
  indexLevel: 'quick'
});

// Marcar início de layer
progressEmitter.startLayer(casoId, 1, 'Extração Bruta');

// Adicionar steps
progressEmitter.addStep(casoId, 'Lendo documento 1/5', 'processing');
progressEmitter.addStep(casoId, 'Documento 1 extraído com sucesso', 'success');

// Adicionar resultados/métricas
progressEmitter.addResult(casoId, 'Páginas processadas', '145');
progressEmitter.addResult(casoId, 'Palavras extraídas', '35.782');

// Completar layer
progressEmitter.completeLayer(casoId, 1, {
  documentsProcessed: 5,
  totalPages: 145
});

// Finalizar sessão
progressEmitter.completeSession(casoId, {
  totalDocuments: 5,
  totalPages: 145,
  totalWords: 35782,
  cacheHitRate: '60%'
});
```

### Frontend (SSE - Server-Sent Events)

```javascript
// Conectar ao stream
const eventSource = new EventSource(`/api/case-processor/${casoId}/stream`);

// Escutar updates
eventSource.onmessage = (event) => {
  const update = JSON.parse(event.data);

  // update.type: 'system', 'layer', 'step', 'success', 'warning', 'error', 'result', 'info'
  // update.message: Mensagem formatada
  // update.timestamp: ISO timestamp
  // update.elapsed: Tempo desde início em ms

  appendToLog(update);
};

// Escutar conclusão
eventSource.addEventListener('complete', (event) => {
  const data = JSON.parse(event.data);
  console.log('Processamento concluído!', data.totalTime);
  eventSource.close();
});

// Escutar erros
eventSource.addEventListener('error', (event) => {
  const data = JSON.parse(event.data);
  console.error('Erro no processamento:', data.error);
  eventSource.close();
});
```

### Frontend (Polling Fallback)

```javascript
// Se SSE não for suportado, fazer polling
async function pollStatus() {
  const response = await fetch(`/api/case-processor/${casoId}/status`);
  const data = await response.json();

  if (data.status === 'completed' || data.status === 'failed') {
    clearInterval(pollingInterval);
  }

  updateUI(data.recentUpdates);
}

const pollingInterval = setInterval(pollStatus, 2000); // A cada 2 segundos
```

## 🎨 Exemplo de Output Visual

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 INICIANDO PROCESSAMENTO DO CASO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ LAYER 1: Extração Bruta ━━━

⏳ Extraindo documentos em paralelo...
✅ Cache hit: contrato.pdf
📄 Extraindo: sentenca.pdf
✅ Documento extraído: sentenca.pdf
   Páginas: 45
   Palavras: 12.345

✅ Layer 1 concluída
   Total de documentos: 5
   Total de páginas: 145
   Tempo: 8s

━━━ LAYER 2: Índices e Metadados ━━━

⏳ Criando índice progressivo (quick)...
✅ Índice rápido gerado
   Seções identificadas: 12
   Tópicos principais: 8

✅ Layer 2 concluída
   Tempo acumulado: 15s

━━━ LAYER 3: Análises Especializadas ━━━

⏳ Processando em paralelo...
✅ Qualificação das partes
✅ Cronologia dos fatos
✅ Análise de provas
✅ Teses jurídicas identificadas
✅ Pedidos consolidados

✅ Layer 3 concluída
   Tempo: 22s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 PROCESSAMENTO CONCLUÍDO COM SUCESSO!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 Documentos processados: 5
📑 Páginas analisadas: 145
📝 Palavras extraídas: 35.782
💾 Taxa de cache hit: 60%

⏱️  Tempo total: 3min 42s
```

## 🚀 Uso Prático

### No endpoint de processamento:

```javascript
router.post('/process', async (req, res) => {
  const { casoId, documentPaths } = req.body;

  // Responder imediatamente (processamento em background)
  res.json({
    success: true,
    casoId,
    message: 'Processamento iniciado',
    streamUrl: `/api/case-processor/${casoId}/stream`
  });

  // Processar em background
  processarCasoComFeedback(casoId, documentPaths).catch(error => {
    progressEmitter.failSession(casoId, error);
  });
});

async function processarCasoComFeedback(casoId, documentPaths) {
  progressEmitter.startSession(casoId, { totalDocuments: documentPaths.length });

  try {
    // Layer 1
    progressEmitter.startLayer(casoId, 1, 'Extração Bruta');
    const extracted = await extractDocuments(casoId, documentPaths);
    progressEmitter.completeLayer(casoId, 1);

    // Layer 2
    progressEmitter.startLayer(casoId, 2, 'Índices e Metadados');
    const indexed = await createIndex(casoId, extracted);
    progressEmitter.completeLayer(casoId, 2);

    // ... mais layers

    progressEmitter.completeSession(casoId, {
      totalDocuments: documentPaths.length
    });
  } catch (error) {
    progressEmitter.failSession(casoId, error);
    throw error;
  }
}
```

## 🎨 Tipos de Updates

| Tipo | Icon | Uso |
|------|------|-----|
| `system` | `━━━` | Separadores, títulos de seção |
| `layer` | `📦` | Início/fim de layers |
| `step` | `⏳/✅/❌` | Etapas individuais |
| `info` | `   ` | Informações contextuais |
| `success` | `✅` | Sucesso em operação |
| `warning` | `⚠️ ` | Avisos não-críticos |
| `error` | `❌` | Erros |
| `result` | `   ` | Métricas e resultados |

## 💡 Best Practices

1. **Iniciar sessão cedo**: Logo após começar o processamento
2. **Updates frequentes**: Mostrar progresso a cada 2-5 segundos
3. **Mensagens claras**: Usar verbos de ação ("Extraindo", "Analisando")
4. **Métricas úteis**: Mostrar números que fazem sentido para o usuário
5. **Tratamento de erros**: Sempre chamar `failSession()` em caso de erro
6. **Cleanup**: Limpar sessões antigas periodicamente

## 🔧 Configuração no Servidor

Adicionar as rotas SSE no servidor principal:

```javascript
import caseProcessorSSE from './routes/case-processor-sse.js';

app.use('/api/case-processor', caseProcessorSSE);
```

## 📊 Monitoramento

```javascript
// Obter todas as sessões ativas
const sessions = progressEmitter.sessions;

// Obter status de uma sessão
const status = progressEmitter.getSessionStatus(casoId);

// Limpar sessão antiga
progressEmitter.clearSession(casoId);
```

## 🎯 Benefícios

1. **UX melhor**: Usuário vê o que está acontecendo
2. **Menos ansiedade**: Sabe que o sistema está trabalhando
3. **Transparência**: Entende quanto tempo falta
4. **Debug facilitado**: Logs estruturados ajudam a identificar gargalos
5. **Confiança**: Sistema parece mais profissional e responsivo

## 🔗 Integração com Interface

Ver arquivo HTML de exemplo em: `/examples/realtime-feedback.html`
