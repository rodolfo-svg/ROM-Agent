# RELEASE v2.8.1 (BETA-RC1) — PLANO DE EXECUÇÃO

**Cliente:** Dr. Rodolfo Otávio Mota, OAB/GO 21.841
**Data:** 17/12/2025
**Versão:** 2.8.1 (BETA-RC1)
**Objetivo:** Estabilidade + UX Claude-like + 6 usuários + Anti-429 + Multi-Model + Mobile MVP

---

## ✅ 1. CONFIRMAÇÕES INICIAIS

### 1.1 Sistema "Antiansiedade" - IDENTIFICADO

**Nome real no código:**
```javascript
// lib/exhaustive-analysis-job.js
class ExhaustiveAnalysisJob extends EventEmitter {
  async execute() {
    this.emit('progress', { stage, current, total, percentage, message });
    this.emit('document-summarized', { docId, docName });
    this.emit('completed', { results });
    this.emit('failed', { error });
  }
}
```

**Status:** ✅ Implementado mas NÃO integrado ao chat Web/Mobile
**Ação necessária:** Integrar eventos com SSE/WebSocket + UI tempo real

---

### 1.2 Mapeamento de Perfis - CONFIRMADO E APLICADO

✅ **Criado:** `lib/model-profile-router.js` (580 linhas)

**Perfis oficiais:**
- ✅ PREMIUM (Opus 4.5 → fallbacks)
- ✅ PADRAO (Sonnet 4.5 → fallbacks)
- ✅ ECONOMICO (Nova Micro → fallbacks)
- ✅ CONTEXTO_LONGO (Sonnet 4.5 200k ctx)
- ✅ RAG (Cohere Command R+)
- ✅ VISAO (Pixtral Large)
- ✅ RACIOCINIO (DeepSeek R1)
- ✅ AUTO (detecção automática)

**Funcionalidades:**
- ✅ Circuit breaker por modelId
- ✅ Fallback automático
- ✅ Política por tipo de tarefa (texto/tabela/diagrama)
- ✅ REGRA HARD: entrega final = PREMIUM obrigatório
- ✅ Estatísticas e métricas

---

### 1.3 Status por Componente

| Componente | Status | Ação |
|------------|--------|------|
| **Anti-429** | ✅ Implementado | Validar com 6 usuários |
| **29 Modelos** | ✅ Testados 100% | Integrar com Router |
| **Model Router** | ✅ Criado | Integrar ao chat |
| **TaskStream/AntiAnsiedade** | ⚠️ Parcial | Integrar SSE + UI |
| **UX Claude-like** | ❌ Não existe | Criar do zero |
| **Mobile MVP** | ❌ Não existe | Criar do zero |
| **RBAC Usuários** | ⚠️ Parcial | Completar papéis |
| **Tarifas/Consumo** | ❌ Não existe | Criar módulo |
| **Exports Sidebar** | ⚠️ Parcial | Padronizar UI |

---

## 📋 2. PLANO DE EXECUÇÃO (ORDEM RECOMENDADA)

### FASE 1: FUNDAÇÃO (Semana 1)
**Objetivo:** Garantir base sólida sem regressão

#### 1.1 Integrar Model Router ao Sistema Existente
**Arquivo:** `src/modules/bedrock.js`
```javascript
import { modelRouter } from '../lib/model-profile-router.js';

export async function conversar(prompt, options = {}) {
  const { profile = 'AUTO', taskType, isDeliverable } = options;

  // Selecionar modelo via router
  const selection = await modelRouter.selectModel({
    profile,
    taskType,
    context: { userMessage: prompt, isDeliverable },
    forceQuality: options.forceQuality
  });

  const modelo = selection.modelId;

  // Continuar com lógica existente...
  // (COMPATÍVEL - não quebra híbrido atual)
}
```

**Aceite:**
- ✅ Chat funciona com profile='AUTO'
- ✅ Entrega final usa PREMIUM automaticamente
- ✅ Fallback automático em caso de falha
- ✅ Logs registram profile + modelId + fallback

---

#### 1.2 Ativar TaskStream/AntiAnsiedade por Padrão
**Arquivos:**
- `lib/exhaustive-job-manager.js` (já existe)
- `src/server-enhanced.js` (integrar SSE)

**Criar endpoint SSE:**
```javascript
// src/server-enhanced.js

app.get('/api/jobs/:jobId/stream', (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const job = exhaustiveJobManager.getJob(jobId);

  // Listeners
  job.on('progress', (data) => {
    res.write(`data: ${JSON.stringify({ type: 'progress', ...data })}\n\n`);
  });

  job.on('completed', (data) => {
    res.write(`data: ${JSON.stringify({ type: 'completed', ...data })}\n\n`);
    res.end();
  });

  job.on('failed', (data) => {
    res.write(`data: ${JSON.stringify({ type: 'failed', ...data })}\n\n`);
    res.end();
  });
});
```

**UI Web (placeholder até Phase 2):**
```html
<!-- public/index.html (temporário) -->
<div id="task-progress" style="display: none;">
  <div class="progress-bar">
    <span id="progress-stage">Iniciando...</span>
    <span id="progress-pct">0%</span>
  </div>
  <div id="progress-message"></div>
</div>

<script>
const eventSource = new EventSource(`/api/jobs/${jobId}/stream`);
eventSource.onmessage = (e) => {
  const data = JSON.parse(e.data);
  document.getElementById('task-progress').style.display = 'block';
  document.getElementById('progress-stage').textContent = data.stage;
  document.getElementById('progress-pct').textContent = data.percentage + '%';
  document.getElementById('progress-message').textContent = data.message;
};
</script>
```

**Aceite:**
- ✅ Toda execução longa emite eventos SSE
- ✅ UI (mesmo placeholder) mostra progresso em tempo real
- ✅ Nenhuma tarefa fica "silenciosa"

---

#### 1.3 Módulo de Tarifas/Consumo
**Criar:** `lib/consumption-tracker.js`

```javascript
/**
 * CONSUMPTION TRACKER
 * Rastreia consumo por execução/projeto/usuário
 */

class ConsumptionTracker {
  constructor() {
    this.executions = new Map(); // executionId → summary
  }

  startExecution(executionId, { userId, projectId, profile }) {
    this.executions.set(executionId, {
      executionId,
      userId,
      projectId,
      profile,
      startedAt: Date.now(),
      steps: [],
      tools: [],
      models: [],
      fallbacks: 0,
      totalDuration: 0
    });
  }

  recordStep(executionId, step) {
    const exec = this.executions.get(executionId);
    if (!exec) return;

    exec.steps.push({
      name: step.name,
      modelId: step.modelId,
      profile: step.profile,
      duration: step.duration,
      isFallback: step.isFallback,
      timestamp: Date.now()
    });

    if (step.isFallback) exec.fallbacks++;
    if (!exec.models.includes(step.modelId)) {
      exec.models.push(step.modelId);
    }
  }

  recordTool(executionId, tool) {
    const exec = this.executions.get(executionId);
    if (!exec) return;

    exec.tools.push({
      name: tool.name,
      duration: tool.duration,
      timestamp: Date.now()
    });
  }

  endExecution(executionId) {
    const exec = this.executions.get(executionId);
    if (!exec) return null;

    exec.completedAt = Date.now();
    exec.totalDuration = exec.completedAt - exec.startedAt;

    // Calcular custo estimado (faixas)
    exec.estimatedCost = this.calculateEstimatedCost(exec);

    return this.getSummary(executionId);
  }

  getSummary(executionId) {
    const exec = this.executions.get(executionId);
    if (!exec) return null;

    return {
      executionId: exec.executionId,
      userId: exec.userId,
      projectId: exec.projectId,
      profile: exec.profile,
      duration: exec.totalDuration,
      steps: exec.steps.length,
      tools: exec.tools.map(t => t.name),
      models: exec.models,
      fallbacks: exec.fallbacks,
      estimatedCost: exec.estimatedCost,
      breakdown: {
        byModel: this.groupByModel(exec.steps),
        byTool: this.groupByTool(exec.tools)
      }
    };
  }

  calculateEstimatedCost(exec) {
    // Faixas: baixo / médio / alto / muito-alto
    const modelCosts = {
      'anthropic.claude-opus-4-5-20251101-v1:0': 'muito-alto',
      'anthropic.claude-sonnet-4-5-20250929-v1:0': 'alto',
      'amazon.nova-micro-v1:0': 'baixo',
      'cohere.command-r-v1:0': 'baixo'
    };

    const costs = exec.steps.map(s => modelCosts[s.modelId] || 'médio');
    const highest = costs.includes('muito-alto') ? 'muito-alto' :
                    costs.includes('alto') ? 'alto' :
                    costs.includes('médio') ? 'médio' : 'baixo';

    return highest;
  }

  groupByModel(steps) {
    const grouped = {};
    steps.forEach(s => {
      if (!grouped[s.modelId]) {
        grouped[s.modelId] = { count: 0, totalDuration: 0 };
      }
      grouped[s.modelId].count++;
      grouped[s.modelId].totalDuration += s.duration;
    });
    return grouped;
  }

  groupByTool(tools) {
    const grouped = {};
    tools.forEach(t => {
      if (!grouped[t.name]) {
        grouped[t.name] = { count: 0, totalDuration: 0 };
      }
      grouped[t.name].count++;
      grouped[t.name].totalDuration += t.duration;
    });
    return grouped;
  }
}

export const consumptionTracker = new ConsumptionTracker();
export default consumptionTracker;
```

**Integrar ao chat:**
```javascript
// src/server-enhanced.js

import { consumptionTracker } from '../lib/consumption-tracker.js';

app.post('/api/chat', async (req, res) => {
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Iniciar rastreamento
  consumptionTracker.startExecution(executionId, {
    userId: req.session.userId,
    projectId: req.body.projectId,
    profile: req.body.profile || 'AUTO'
  });

  // ... processamento ...

  // Registrar steps
  consumptionTracker.recordStep(executionId, {
    name: 'chat-response',
    modelId: selection.modelId,
    profile: selection.profile,
    duration: Date.now() - startTime,
    isFallback: selection.isFallback
  });

  // Finalizar
  const summary = consumptionTracker.endExecution(executionId);

  res.json({
    response: responseText,
    consumption: summary  // Enviar no response
  });
});
```

**Aceite:**
- ✅ Toda execução gera resumo de consumo
- ✅ Histórico por projeto e usuário
- ✅ Breakdown por modelo e ferramenta
- ✅ Faixas de custo estimado

---

### FASE 2: UX CLAUDE-LIKE (Semana 2)

#### 2.1 Layout 3 Zonas
**Arquivo:** `public/index-v2.8.1.html` (novo)

**Estrutura:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>ROM Agent v2.8.1</title>
  <style>
    body {
      margin: 0;
      display: flex;
      height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
    }

    /* ZONA 1: SIDEBAR ESQUERDA (Projetos/Conversas) */
    .sidebar-left {
      width: 260px;
      background: #f7f7f8;
      border-right: 1px solid #e5e5e5;
      display: flex;
      flex-direction: column;
    }

    .sidebar-left-header {
      padding: 16px;
      border-bottom: 1px solid #e5e5e5;
    }

    .sidebar-left-content {
      flex: 1;
      overflow-y: auto;
    }

    /* ZONA 2: CENTRO (Chat) */
    .main-chat {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .chat-input-container {
      border-top: 1px solid #e5e5e5;
      padding: 16px;
    }

    /* ZONA 3: SIDEBAR DIREITA (Upload/Arquivos) */
    .sidebar-right {
      width: 300px;
      background: #f7f7f8;
      border-left: 1px solid #e5e5e5;
      display: flex;
      flex-direction: column;
    }

    .sidebar-right-tabs {
      display: flex;
      border-bottom: 1px solid #e5e5e5;
    }

    .sidebar-right-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    /* Progress bar (anti-ansiedade) */
    .task-progress {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
    }

    .progress-bar {
      background: #e5e5e5;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      margin: 8px 0;
    }

    .progress-bar-fill {
      background: #ffc107;
      height: 100%;
      transition: width 0.3s ease;
    }
  </style>
</head>
<body>
  <!-- ZONA 1: SIDEBAR ESQUERDA -->
  <div class="sidebar-left">
    <div class="sidebar-left-header">
      <button id="new-project-btn">+ Novo Projeto</button>
      <button id="new-chat-btn">+ Nova Conversa</button>
    </div>
    <div class="sidebar-left-content" id="projects-list">
      <!-- Lista de projetos/conversas -->
    </div>
  </div>

  <!-- ZONA 2: CENTRO (CHAT) -->
  <div class="main-chat">
    <!-- Progress bar (anti-ansiedade) -->
    <div id="task-progress" class="task-progress" style="display: none;">
      <div><strong id="progress-stage">Processando...</strong></div>
      <div class="progress-bar">
        <div id="progress-bar-fill" class="progress-bar-fill" style="width: 0%;"></div>
      </div>
      <div id="progress-message" style="font-size: 0.9em; color: #666;"></div>
    </div>

    <div class="chat-messages" id="chat-messages">
      <!-- Mensagens do chat -->
    </div>

    <div class="chat-input-container">
      <select id="profile-select">
        <option value="AUTO">Auto (recomendado)</option>
        <option value="ECONOMICO">Econômico</option>
        <option value="PADRAO">Padrão</option>
        <option value="PREMIUM">Premium</option>
      </select>
      <textarea id="chat-input" placeholder="Digite sua mensagem..."></textarea>
      <button id="send-btn">Enviar</button>
    </div>
  </div>

  <!-- ZONA 3: SIDEBAR DIREITA -->
  <div class="sidebar-right">
    <div class="sidebar-right-tabs">
      <button class="tab active" data-tab="upload">Upload</button>
      <button class="tab" data-tab="arquivos">Arquivos</button>
    </div>

    <div class="sidebar-right-content">
      <!-- Tab: Upload -->
      <div id="tab-upload" class="tab-content active">
        <input type="file" id="file-upload" multiple />
        <div id="upload-status"></div>
      </div>

      <!-- Tab: Arquivos -->
      <div id="tab-arquivos" class="tab-content" style="display: none;">
        <div id="arquivos-list">
          <!-- Lista de exports -->
        </div>
      </div>
    </div>
  </div>

  <script src="/js/app-v2.8.1.js"></script>
</body>
</html>
```

**Aceite:**
- ✅ Layout em 3 zonas sempre visível
- ✅ Chat no centro com input fixo
- ✅ Projetos/conversas à esquerda
- ✅ Upload/arquivos à direita
- ✅ Progress bar (anti-ansiedade) no topo do chat
- ✅ SPA (sem novas páginas para 80% do fluxo)

---

### FASE 3: MOBILE MVP (Semana 3)

#### 3.1 Progressive Web App (PWA)
**Criar:** `public/mobile-v2.8.1.html`

**Funcionalidades mínimas:**
- Login
- Lista de projetos
- Chat com streaming
- TaskStream/AntiAnsiedade
- Drawer "Arquivos" com exports
- Upload básico

**Stack recomendado:**
- PWA com Service Worker
- Responsivo mobile-first
- SSE para progresso em tempo real
- LocalStorage para cache básico

**Aceite:**
- ✅ Funciona em iPhone/iPad
- ✅ Chat com progresso em tempo real
- ✅ Exports acessíveis e baixáveis
- ✅ Sem 429 (mesma fila do Web)

---

### FASE 4: RBAC E SEGURANÇA (Semana 4)

#### 4.1 Papéis e Permissões
**Criar:** `lib/rbac.js`

**Papéis:**
- Admin: todos acessos
- Advogado: criar projetos, processar, exportar
- Assistente: visualizar, upload (sem delete KB basilar)

**RBAC invisível:**
- Botões proibidos não aparecem
- Endpoints validam permissão
- Logs auditam ações

**Aceite:**
- ✅ 3 papéis funcionando
- ✅ UI adapta-se ao papel
- ✅ Tentativa de acesso indevido falha
- ✅ Auditoria com trace_id

---

## 📊 3. TABELA DE ENTREGÁVEIS

| # | Entregável | Gate | Critério de Aceite | Evidência |
|---|------------|------|-------------------|-----------|
| 1 | Model Router integrado | 9 | Entrega final = PREMIUM; fallback automático | Logs com profile + modelId |
| 2 | TaskStream/AntiAnsiedade ativo | 4 | Toda tarefa longa mostra progresso | Print SSE em tempo real |
| 3 | Consumption Tracker | 6 | Resumo por execução/projeto/usuário | JSON de summary |
| 4 | UX Claude-like (3 zonas) | 5 | Layout fixo; 80% SPA | Print + gravação |
| 5 | Sidebar Outputs | 5 | Exports listados; download 1 clique | Print sidebar |
| 6 | Mobile MVP (PWA) | 7 | Chat + progresso + exports em iPhone | Print + gravação |
| 7 | RBAC invisível | 8 | 3 papéis; UI adapta; auditoria | Logs de tentativa indevida |
| 8 | Anti-429 validado | 3 | 6 usuários sem ver 429 | Logs de fila/backoff |
| 9 | Tabelas consistentes | 9 | 1 resumo executivo exportável | Export de tabela |
| 10 | Diagramas exportados | 9 | 1 fluxograma na sidebar | Export de diagrama |

---

## ✅ 4. CHECKLIST DE VALIDAÇÃO

### Gate 1: Infra
- [ ] `/api/info` OK sem secrets
- [ ] HTTPS configurado (se aplicável)
- [ ] CORS allowlist ativo

### Gate 2: Usuários
- [ ] Admin cria/edita/desativa usuários
- [ ] Ações auditadas com trace_id
- [ ] Usuário desativado não opera

### Gate 3: Anti-429
- [ ] Simulação 6 usuários não expõe 429
- [ ] Fila/status/entrega garantida
- [ ] Logs: bedrockQueue metrics

### Gate 4: TaskStream (Tempo Real)
- [ ] Toda tarefa longa exibe progresso
- [ ] SSE funciona (ou WebSocket/poll)
- [ ] Usuário nunca fica "no escuro"

### Gate 5: UX Claude-like
- [ ] Layout 3 zonas presente
- [ ] Upload fixo sidebar direita
- [ ] Outputs auto-listados
- [ ] 80% fluxo SPA

### Gate 6: Tarifas/Consumo
- [ ] Resumo de consumo por execução
- [ ] tools + alias/modelId + fallback
- [ ] Histórico por projeto/usuário

### Gate 7: Mobile MVP
- [ ] Chat + progresso em iPhone/iPad
- [ ] Exports acessíveis (drawer)
- [ ] Upload básico funciona
- [ ] Sem 429 (mesma fila)

### Gate 8: Segurança
- [ ] RBAC invisível
- [ ] Prompts não vazam
- [ ] Exports protegidos 1 clique
- [ ] Deleção real KB

### Gate 9: Multi-Model + Qualidade
- [ ] Entrega final = PREMIUM
- [ ] Tabelas consistentes
- [ ] Diagramas exportados
- [ ] Sem perda de qualidade

---

## 🚀 5. PRÓXIMOS PASSOS IMEDIATOS

### Hoje (17/12/2025):
1. ✅ Model Router criado (`lib/model-profile-router.js`)
2. ⏳ Criar `lib/consumption-tracker.js`
3. ⏳ Integrar Model Router ao `bedrock.js`
4. ⏳ Criar endpoint SSE `/api/jobs/:jobId/stream`

### Amanhã (18/12/2025):
5. ⏳ Layout Claude-like (`public/index-v2.8.1.html`)
6. ⏳ Sidebar Outputs com preview/download
7. ⏳ Validar com 1 usuário

### Semana 1 (19-25/12):
8. ⏳ Mobile MVP (PWA básico)
9. ⏳ RBAC com 3 papéis
10. ⏳ Testes finais + evidências

---

## 💡 6. RESPOSTA À PERGUNTA FINAL

> Há alguma ferramenta adicional que possa ser integrada nesta oportunidade?

### Recomendações de Integração (Baixo Risco):

#### 1. **Sentry** (Monitoramento de Erros)
**Benefício:** Rastreamento automático de erros em produção
**Risco:** Muito baixo
**Esforço:** 1-2 horas
**Integração:**
```javascript
import * as Sentry from "@sentry/node";
Sentry.init({ dsn: process.env.SENTRY_DSN });
```

#### 2. **Plausible Analytics** (Privacy-first)
**Benefício:** Métricas de uso sem cookies
**Risco:** Muito baixo
**Esforço:** 30 minutos
**Integração:**
```html
<script defer data-domain="rom.adv.br" src="https://plausible.io/js/script.js"></script>
```

#### 3. **Bull Queue** (Filas Redis - opcional)
**Benefício:** Persistência de fila (sobrevive restart)
**Risco:** Médio (requer Redis)
**Esforço:** 4-6 horas
**Quando:** Só se escalar >10 usuários

#### 4. **Swagger/OpenAPI** (Documentação API)
**Benefício:** Auto-documentação de endpoints
**Risco:** Muito baixo
**Esforço:** 2-3 horas
**Recomendado:** Sim (facilita manutenção)

### ✅ Recomendação Final:
Integrar **Sentry** (erros) + **Plausible** (analytics) nesta versão.
Deixar Bull Queue e Swagger para v2.9.0.

---

## 📝 7. RESUMO EXECUTIVO

### O Que Já Temos:
- ✅ Anti-429 completo (fila global + retry + backoff)
- ✅ 29 modelos testados (100% funcionando)
- ✅ Model Router com circuit breaker
- ✅ TaskStream/AntiAnsiedade (eventos programados)

### O Que Falta:
- ❌ Integrar Model Router ao chat
- ❌ Ativar TaskStream com SSE
- ❌ UX Claude-like (3 zonas)
- ❌ Mobile MVP (PWA)
- ❌ RBAC completo
- ❌ Módulo de consumo

### Tempo Estimado:
- **Fase 1 (Fundação):** 5-7 dias
- **Fase 2 (UX Web):** 5-7 dias
- **Fase 3 (Mobile):** 5-7 dias
- **Fase 4 (RBAC):** 3-5 dias

**TOTAL:** 3-4 semanas para v2.8.1 completa

### Risco:
- ✅ Baixo (base sólida já existe)
- ⚠️ Médio em UX (requer refatoração front)
- ✅ Baixo em Mobile (PWA simples)

---

**Plano aprovado para execução?**

Aguardo confirmação para iniciar Fase 1.
