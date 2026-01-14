# PLANO DE INTEGRAÇÃO COMPLETO - ROM-AGENT
## Sistema de 86 Ferramentas Operacionais
### Data: 2026-01-10

---

## VISÃO EXECUTIVA

**Status Atual**: 49/86 ferramentas operacionais (57%)
**Meta**: 86/86 ferramentas operacionais (100%)
**Tempo Estimado**: 4-6 horas com execução paralela
**Agentes Paralelos**: 8 agentes Opus trabalhando simultaneamente

---

## 1. RESULTADO DA AUDITORIA

### Estatísticas Gerais

| Status | Quantidade | Percentual |
|--------|-----------|-----------|
| ✅ Funcional | 49 | 57% |
| 🔌 Requer Configuração | 12 | 14% |
| ❌ Não Funcional | 5 | 6% |
| 🚧 Implementação Pendente | 20 | 23% |

### Componentes Críticos

#### ✅ JÁ OPERACIONAIS
- Pipeline de extração (33 ferramentas locais)
- Upload de arquivos até **500 MB** ✓
- Streaming SSE ✓
- Rate limiting ✓
- Autenticação ✓
- OCR completo (Tesseract + Sharp)
- 11 Skills Claude
- Sistema de chunked upload (5MB/chunk)

#### 🔌 REQUEREM CONFIGURAÇÃO (API Keys)
1. AWS Bedrock (17 funções avançadas)
2. Google Custom Search API
3. DataJud CNJ
4. Certidões CNJ/DJEN

#### ❌ NÃO FUNCIONAIS (Bloqueios)
1. JusBrasil (100% bloqueado anti-bot)

#### 🚧 NÃO IMPLEMENTADOS (Tribunais)
1. PROJUDI (TJGO)
2. ESAJ (TJSP)
3. PJe (Justiça Federal)
4. ePROC (TRFs)

---

## 2. ARQUITETURA DO SISTEMA DE INTEGRAÇÃO

### 2.1 Orquestrador Central

```javascript
// orchestrator-master.js
class IntegrationOrchestrator {
  constructor() {
    this.agents = [];
    this.progressTracker = new ProgressTracker();
    this.sseServer = new SSEServer();
    this.totalTasks = 86;
    this.completedTasks = 0;
  }

  async execute() {
    // 8 agentes paralelos trabalhando simultaneamente
    const agents = [
      new ConfigAgent('aws-bedrock'),      // Agente 1
      new ConfigAgent('google-search'),    // Agente 2
      new ConfigAgent('datajud'),          // Agente 3
      new ScraperAgent('projudi'),         // Agente 4
      new ScraperAgent('esaj'),            // Agente 5
      new ScraperAgent('pje'),             // Agente 6
      new ScraperAgent('eproc'),           // Agente 7
      new MonitorAgent('progress-sse')     // Agente 8
    ];

    // Execução paralela
    await Promise.all(agents.map(a => a.execute()));
  }

  updateProgress(agentId, task, status) {
    this.completedTasks++;
    const percentage = (this.completedTasks / this.totalTasks) * 100;

    // Broadcast via SSE
    this.sseServer.broadcast({
      agentId,
      task,
      status,
      percentage,
      timestamp: new Date().toISOString()
    });
  }
}
```

### 2.2 Sistema de Progress Tracking com SSE

```javascript
// progress-sse-server.js
class SSEProgressServer {
  constructor() {
    this.clients = [];
    this.tasks = [];
  }

  // Endpoint SSE para frontend
  handleConnection(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    this.clients.push(res);

    req.on('close', () => {
      this.clients = this.clients.filter(c => c !== res);
    });
  }

  broadcast(data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    this.clients.forEach(client => {
      client.write(message);
    });
  }

  updateTask(agentId, taskName, status, percentage) {
    this.broadcast({
      type: 'task-update',
      agentId,
      taskName,
      status, // 'pending', 'in_progress', 'completed', 'error'
      percentage,
      timestamp: Date.now()
    });
  }
}
```

### 2.3 Dashboard Frontend com Gráfico Real-Time

```typescript
// frontend/src/components/IntegrationDashboard.tsx
import React, { useEffect, useState } from 'react';
import { Chart } from 'react-chartjs-2';

interface Task {
  agentId: string;
  taskName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  percentage: number;
  timestamp: number;
}

export const IntegrationDashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [globalProgress, setGlobalProgress] = useState(0);
  const [activeAgents, setActiveAgents] = useState<string[]>([]);

  useEffect(() => {
    const eventSource = new EventSource('/api/integration/progress-stream');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'task-update') {
        setTasks(prev => {
          const newTasks = [...prev];
          const existingIndex = newTasks.findIndex(
            t => t.agentId === data.agentId && t.taskName === data.taskName
          );

          if (existingIndex >= 0) {
            newTasks[existingIndex] = data;
          } else {
            newTasks.push(data);
          }

          return newTasks;
        });

        setGlobalProgress(data.percentage);

        // Atualizar agentes ativos
        if (data.status === 'in_progress') {
          setActiveAgents(prev =>
            prev.includes(data.agentId) ? prev : [...prev, data.agentId]
          );
        }
      }
    };

    return () => eventSource.close();
  }, []);

  const chartData = {
    labels: tasks.map(t => t.taskName),
    datasets: [{
      label: 'Progresso',
      data: tasks.map(t => t.percentage),
      backgroundColor: tasks.map(t =>
        t.status === 'completed' ? 'rgba(75, 192, 192, 0.6)' :
        t.status === 'in_progress' ? 'rgba(54, 162, 235, 0.6)' :
        t.status === 'error' ? 'rgba(255, 99, 132, 0.6)' :
        'rgba(201, 203, 207, 0.6)'
      )
    }]
  };

  return (
    <div className="integration-dashboard">
      <h1>Integração de 86 Ferramentas</h1>

      {/* Progresso Global */}
      <div className="global-progress">
        <h2>Progresso Global: {globalProgress.toFixed(1)}%</h2>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${globalProgress}%` }}
          />
        </div>
      </div>

      {/* Agentes Ativos */}
      <div className="active-agents">
        <h3>Agentes Ativos ({activeAgents.length})</h3>
        <div className="agents-grid">
          {activeAgents.map(agentId => (
            <div key={agentId} className="agent-card">
              <div className="agent-icon">🤖</div>
              <div className="agent-name">{agentId}</div>
              <div className="agent-status">Trabalhando...</div>
            </div>
          ))}
        </div>
      </div>

      {/* Gráfico de Progresso */}
      <div className="progress-chart">
        <h3>Progresso por Tarefa</h3>
        <Chart type="bar" data={chartData} />
      </div>

      {/* Lista de Tarefas em Tempo Real */}
      <div className="tasks-list">
        <h3>Tarefas (Total: {tasks.length})</h3>
        {tasks.map((task, idx) => (
          <div
            key={`${task.agentId}-${task.taskName}`}
            className={`task-item status-${task.status}`}
          >
            <div className="task-agent">{task.agentId}</div>
            <div className="task-name">{task.taskName}</div>
            <div className="task-progress">{task.percentage.toFixed(0)}%</div>
            <div className="task-status">
              {task.status === 'completed' ? '✅' :
               task.status === 'in_progress' ? '🔄' :
               task.status === 'error' ? '❌' : '⏳'}
            </div>
            <div className="task-time">
              {new Date(task.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## 3. PLANO DE EXECUÇÃO - 8 AGENTES PARALELOS

### AGENTE 1: AWS Bedrock Configuration (Opus)
**Responsabilidade**: Configurar todas as 17 funções do Bedrock

**Tarefas** (17 subtarefas):
1. Validar credenciais AWS
2. Testar conexão com Bedrock
3. Configurar modelos:
   - Claude Opus 4.5
   - Claude Sonnet 4.5
   - Claude Haiku 4.5
   - Amazon Titan Text
   - Amazon Titan Embeddings
4. Testar embeddings
5. Testar geração de texto
6. Testar análise de imagens
7. Testar conversão de áudio
8. Testar processamento de vídeo
9. Configurar rate limits
10. Criar health checks
11. Implementar fallbacks
12. Adicionar retry logic
13. Configurar logs
14. Testar pipeline completo
15. Documentar APIs
16. Criar testes unitários
17. Validar em produção

**Arquivos**:
- `src/modules/bedrock.js`
- `src/modules/bedrockAvancado.js`
- `lib/bedrock-queue-manager.js`

### AGENTE 2: Google Search Configuration (Opus)
**Responsabilidade**: Configurar Google Custom Search API

**Tarefas** (8 subtarefas):
1. Criar projeto no Google Cloud Console
2. Ativar Custom Search API
3. Gerar API Key
4. Criar Search Engine (CX)
5. Adicionar ao .env
6. Testar busca de jurisprudência
7. Testar busca de doutrina
8. Validar resultados

**Arquivos**:
- `lib/google-search-client.js`
- `src/services/jurisprudence-search-service.js`

### AGENTE 3: DataJud CNJ Configuration (Opus)
**Responsabilidade**: Configurar DataJud e Certidões CNJ

**Tarefas** (12 subtarefas):
1. Obter API Key DataJud
2. Configurar autenticação
3. Implementar `/processos/buscar`
4. Implementar `/processos/{id}`
5. Implementar `/certidoes/emitir`
6. Implementar `/certidoes/validar`
7. Configurar CNJ_USUARIO e CNJ_SENHA
8. Testar emissão de certidão
9. Testar validação de certidão
10. Implementar cache de certidões
11. Adicionar rate limiting específico
12. Documentar endpoints

**Arquivos**:
- `python-scrapers/datajud_cnj.py`
- `python-scrapers/cnj_certidoes_api.py`
- `src/services/datajud-service.js`

### AGENTE 4: PROJUDI Scraper (Opus)
**Responsabilidade**: Implementar scraper completo do PROJUDI (TJGO)

**Tarefas** (15 subtarefas):
1. Análise da estrutura do site PROJUDI
2. Implementar login automatizado
3. Implementar busca de processos
4. Implementar extração de metadados
5. Implementar download de documentos
6. Implementar superação de CAPTCHA (se houver)
7. Implementar detecção de processo ativo/arquivado
8. Implementar retry com backoff
9. Adicionar logs detalhados
10. Criar testes unitários
11. Criar testes de integração
12. Implementar cache de sessão
13. Adicionar proxy rotation (opcional)
14. Documentar API
15. Validar em produção

**Novo Arquivo**:
- `python-scrapers/projudi_scraper.py`

### AGENTE 5: ESAJ Scraper (Opus)
**Responsabilidade**: Implementar scraper completo do ESAJ (TJSP)

**Tarefas** (15 subtarefas):
1. Análise da estrutura do ESAJ
2. Implementar busca por número de processo
3. Implementar busca por CPF/CNPJ
4. Implementar extração 1º grau
5. Implementar extração 2º grau
6. Implementar download de documentos
7. Implementar andamentos processuais
8. Implementar detecção de segredo de justiça
9. Implementar superação de CAPTCHA
10. Adicionar rate limiting
11. Criar testes
12. Implementar cache
13. Adicionar logs
14. Documentar
15. Validar

**Novo Arquivo**:
- `python-scrapers/esaj_scraper.py`

### AGENTE 6: PJe Scraper (Opus)
**Responsabilidade**: Implementar scraper do PJe (Justiça Federal)

**Tarefas** (15 subtarefas):
1. Análise dos portais PJe
2. Implementar login certificado digital
3. Implementar busca unificada
4. Implementar extração por tribunal
5. Implementar download de autos digitais
6. Implementar timeline processual
7. Implementar detecção de intimações
8. Adicionar suporte a múltiplos tribunais
9. Implementar retry logic
10. Criar testes
11. Adicionar logs
12. Implementar cache
13. Documentar API
14. Validar TRF1-5
15. Produção

**Novo Arquivo**:
- `python-scrapers/pje_scraper.py`

### AGENTE 7: ePROC Scraper (Opus)
**Responsabilidade**: Implementar scraper do ePROC (TRFs antigos)

**Tarefas** (12 subtarefas):
1. Análise estrutura ePROC
2. Implementar busca de processos
3. Implementar extração de dados
4. Implementar download de documentos
5. Adicionar detecção de status
6. Implementar retry
7. Criar testes
8. Adicionar logs
9. Documentar
10. Validar TRFs
11. Cache
12. Produção

**Novo Arquivo**:
- `python-scrapers/eproc_scraper.py`

### AGENTE 8: Monitor & Progress Tracker (Opus)
**Responsabilidade**: Sistema de monitoramento e progresso em tempo real

**Tarefas** (12 subtarefas):
1. Criar servidor SSE
2. Implementar progress tracking
3. Criar dashboard frontend
4. Implementar gráficos Chart.js
5. Adicionar notificações real-time
6. Implementar logs agregados
7. Criar health check de agentes
8. Implementar restart automático
9. Adicionar métricas de performance
10. Criar relatório final
11. Documentar sistema
12. Deploy dashboard

**Novos Arquivos**:
- `src/services/integration-orchestrator.js`
- `src/services/progress-sse-server.js`
- `frontend/src/components/IntegrationDashboard.tsx`
- `frontend/src/pages/IntegrationPage.tsx`

---

## 4. ENDPOINTS SSE PARA PROGRESSO

### Backend Endpoint

```javascript
// src/routes/integration.js
const express = require('express');
const router = express.Router();
const SSEProgressServer = require('../services/progress-sse-server');

const sseServer = new SSEProgressServer();

// Endpoint de streaming SSE
router.get('/progress-stream', (req, res) => {
  sseServer.handleConnection(req, res);
});

// Endpoint para obter status atual
router.get('/status', async (req, res) => {
  const status = await orchestrator.getStatus();
  res.json(status);
});

// Endpoint para iniciar integração
router.post('/start', async (req, res) => {
  const { agents } = req.body;
  orchestrator.start(agents);
  res.json({ message: 'Integration started' });
});

module.exports = router;
```

### Frontend Service

```typescript
// frontend/src/services/integration.ts
export class IntegrationService {
  private eventSource: EventSource | null = null;

  subscribeToProgress(
    onUpdate: (data: ProgressUpdate) => void,
    onError?: (error: Error) => void
  ) {
    this.eventSource = new EventSource('/api/integration/progress-stream');

    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onUpdate(data);
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      if (onError) onError(new Error('Connection lost'));
    };
  }

  unsubscribe() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  async startIntegration(agents: string[]) {
    const response = await fetch('/api/integration/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agents })
    });
    return response.json();
  }

  async getStatus() {
    const response = await fetch('/api/integration/status');
    return response.json();
  }
}
```

---

## 5. UPLOAD DE ARQUIVOS ATÉ 500 MB

### Status Atual
✅ **JÁ IMPLEMENTADO E FUNCIONAL**

- Backend Python: `MAX_FILE_SIZE = 500 * 1024 * 1024` (api_auth.py:32)
- Chunked Upload: 5 MB por chunk (lib/chunked-upload.js)
- Streaming: Sim

### Melhorias Opcionais

```javascript
// frontend/src/components/FileUploader.tsx
import React, { useState } from 'react';

export const ChunkedFileUploader: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

  const uploadFile = async (file: File) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = generateUploadId();

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append('chunk', chunk);
      formData.append('uploadId', uploadId);
      formData.append('chunkIndex', i.toString());
      formData.append('totalChunks', totalChunks.toString());

      await fetch('/api/upload/chunk', {
        method: 'POST',
        body: formData
      });

      const percentage = ((i + 1) / totalChunks) * 100;
      setProgress(percentage);
    }

    // Finalizar upload
    await fetch('/api/upload/finalize', {
      method: 'POST',
      body: JSON.stringify({ uploadId })
    });
  };

  return (
    <div>
      <input type="file" onChange={(e) => uploadFile(e.target.files[0])} />
      <div className="progress-bar">
        <div style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};
```

---

## 6. CRONOGRAMA DE EXECUÇÃO

### Fase 1: Preparação (30 min)
- Criar estrutura de agentes
- Configurar orquestrador
- Implementar servidor SSE
- Criar dashboard frontend

### Fase 2: Execução Paralela (3-4 horas)
**Todos os 8 agentes executam simultaneamente**

| Agente | Tempo Estimado | Tarefas |
|--------|---------------|---------|
| Agente 1 (AWS) | 2h | 17 tarefas |
| Agente 2 (Google) | 1h | 8 tarefas |
| Agente 3 (DataJud) | 1.5h | 12 tarefas |
| Agente 4 (PROJUDI) | 3h | 15 tarefas |
| Agente 5 (ESAJ) | 3h | 15 tarefas |
| Agente 6 (PJe) | 3h | 15 tarefas |
| Agente 7 (ePROC) | 2.5h | 12 tarefas |
| Agente 8 (Monitor) | 2h | 12 tarefas |

**Tempo Total com Paralelização**: ~3-4 horas
*(vs 18+ horas sequencial)*

### Fase 3: Validação (1 hora)
- Testar todas as 86 ferramentas
- Validar integração completa
- Gerar relatório final
- Deploy em produção

### Fase 4: Documentação (30 min)
- Atualizar documentação
- Criar guias de uso
- Documentar APIs

**TEMPO TOTAL: 4-6 HORAS**

---

## 7. ESTRUTURA DE ARQUIVOS NOVOS

```
ROM-Agent/
├── src/
│   ├── services/
│   │   ├── integration-orchestrator.js       ← NOVO
│   │   ├── progress-sse-server.js           ← NOVO
│   │   └── agents/                          ← NOVO DIR
│   │       ├── config-agent.js
│   │       ├── scraper-agent.js
│   │       └── monitor-agent.js
│   └── routes/
│       └── integration.js                   ← NOVO
├── frontend/src/
│   ├── pages/
│   │   └── IntegrationPage.tsx              ← NOVO
│   ├── components/
│   │   └── IntegrationDashboard.tsx         ← NOVO
│   └── services/
│       └── integration.ts                   ← NOVO
├── python-scrapers/
│   ├── projudi_scraper.py                   ← NOVO
│   ├── esaj_scraper.py                      ← NOVO
│   ├── pje_scraper.py                       ← NOVO
│   └── eproc_scraper.py                     ← NOVO
└── scripts/
    ├── run-integration.sh                   ← NOVO
    └── validate-integration.sh              ← NOVO
```

---

## 8. COMANDO DE EXECUÇÃO

```bash
# Executar integração completa com 8 agentes paralelos
./scripts/run-integration.sh --agents=all --model=opus --streaming=true

# Ou executar agentes específicos
./scripts/run-integration.sh --agents="aws,google,datajud" --model=opus

# Monitorar progresso
curl http://localhost:3000/api/integration/progress-stream
```

---

## 9. MÉTRICAS DE SUCESSO

### KPIs Principais
- ✅ 86/86 ferramentas operacionais (100%)
- ✅ Upload de 500 MB funcional
- ✅ Streaming SSE implementado
- ✅ Dashboard em tempo real
- ✅ 8 agentes paralelos executando
- ✅ Tempo < 6 horas

### Métricas Secundárias
- Taxa de erro < 1%
- Tempo médio de resposta API < 500ms
- Cobertura de testes > 80%
- Documentação completa
- Zero downtime

---

## 10. PRÓXIMOS PASSOS

### Aprovação do Plano
- [ ] Revisar plano completo
- [ ] Aprovar arquitetura
- [ ] Aprovar cronograma

### Execução
- [ ] Criar estrutura de agentes
- [ ] Implementar orquestrador
- [ ] Implementar SSE server
- [ ] Criar dashboard
- [ ] Executar 8 agentes em paralelo
- [ ] Validar resultados
- [ ] Deploy produção

---

**Plano criado em**: 2026-01-10
**Autor**: Claude Opus 4.5
**Status**: Aguardando aprovação para execução autônoma
