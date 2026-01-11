/**
 * Progress SSE Server
 * Servidor de Server-Sent Events para streaming de progresso em tempo real
 *
 * Features v2.0.0:
 * - Heartbeat seguro com verificacao de conexao
 * - TTL para conexoes (5min)
 * - Cleanup automatico de conexoes mortas
 * - Metricas de conexoes
 *
 * @version 2.0.0
 * @since WS5 - SSE Streaming Optimization
 */

import express from 'express';
import cors from 'cors';
import path from 'path';

// Configuracoes
const HEARTBEAT_INTERVAL = 15000; // 15 segundos
const CONNECTION_TTL = 5 * 60 * 1000; // 5 minutos
const CLEANUP_INTERVAL = 60000; // 1 minuto

class ProgressSSEServer {
  constructor(port = 3001) {
    this.app = express();
    this.port = port;
    this.clients = [];
    this.tasks = [];
    this.globalProgress = 0;
    this.activeAgents = new Set();

    // Metricas
    this.metrics = {
      totalConnections: 0,
      heartbeatsSent: 0,
      heartbeatsFailed: 0,
      connectionsTimedOut: 0
    };

    this.setupMiddleware();
    this.setupRoutes();
    this._startCleanupTimer();
  }

  /**
   * Inicia timer de cleanup periodico
   */
  _startCleanupTimer() {
    this._cleanupTimer = setInterval(() => {
      this._cleanupDeadConnections();
    }, CLEANUP_INTERVAL);

    if (this._cleanupTimer.unref) {
      this._cleanupTimer.unref();
    }
  }

  /**
   * Remove conexoes mortas
   */
  _cleanupDeadConnections() {
    const now = Date.now();
    const initialCount = this.clients.length;

    this.clients = this.clients.filter(client => {
      // Verificar se conexao ainda esta viva
      if (client.res.writableEnded || client.res.destroyed) {
        this._cleanupClient(client);
        return false;
      }

      // Verificar TTL
      if (now - client.createdAt > CONNECTION_TTL) {
        console.log(`[ProgressSSE] Connection ${client.id} TTL expired`);
        this._cleanupClient(client);
        this.metrics.connectionsTimedOut++;
        return false;
      }

      return true;
    });

    const removed = initialCount - this.clients.length;
    if (removed > 0) {
      console.log(`[ProgressSSE] Cleanup: ${removed} dead connections removed`);
    }
  }

  /**
   * Limpa recursos de um cliente
   */
  _cleanupClient(client) {
    if (client.heartbeat) {
      clearInterval(client.heartbeat);
    }
    try {
      if (!client.res.writableEnded) {
        client.res.end();
      }
    } catch (e) {
      // Ignorar erros ao fechar
    }
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  setupRoutes() {
    // Endpoint SSE para streaming de progresso
    this.app.get('/api/integration/progress-stream', (req, res) => {
      this.handleSSEConnection(req, res);
    });

    // Endpoint para obter status atual
    this.app.get('/api/integration/status', (req, res) => {
      res.json({
        globalProgress: this.globalProgress,
        tasks: this.tasks,
        activeAgents: Array.from(this.activeAgents),
        timestamp: new Date().toISOString()
      });
    });

    // Endpoint para atualizar progresso (usado pelos agentes)
    this.app.post('/api/integration/update', (req, res) => {
      const { agentId, taskName, status, percentage } = req.body;

      this.updateTask(agentId, taskName, status, percentage);

      res.json({ success: true });
    });

    // Endpoint para adicionar agente ativo
    this.app.post('/api/integration/agent-start', (req, res) => {
      const { agentId } = req.body;
      this.activeAgents.add(agentId);

      this.broadcast({
        type: 'agent-start',
        agentId,
        timestamp: Date.now()
      });

      res.json({ success: true });
    });

    // Endpoint para remover agente ativo
    this.app.post('/api/integration/agent-complete', (req, res) => {
      const { agentId } = req.body;
      this.activeAgents.delete(agentId);

      this.broadcast({
        type: 'agent-complete',
        agentId,
        timestamp: Date.now()
      });

      res.json({ success: true });
    });

    // Health check com metricas
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        clients: this.clients.length,
        tasks: this.tasks.length,
        activeAgents: this.activeAgents.size,
        metrics: this.metrics,
        timestamp: Date.now()
      });
    });
  }

  handleSSEConnection(req, res) {
    // Configurar headers SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no' // Nginx bypass
    });

    // Enviar comentario inicial para manter conexao aberta
    res.write(':ok\n\n');

    // Adicionar cliente com metadata
    const clientId = Date.now();
    const client = {
      id: clientId,
      res,
      createdAt: Date.now(),
      lastHeartbeat: Date.now(),
      heartbeat: null
    };

    this.clients.push(client);
    this.metrics.totalConnections++;

    console.log(`[ProgressSSE] Cliente conectado: ${clientId} (total: ${this.clients.length})`);

    // Enviar estado atual imediatamente
    this.sendToClient(client, {
      type: 'initial-state',
      globalProgress: this.globalProgress,
      tasks: this.tasks,
      activeAgents: Array.from(this.activeAgents),
      timestamp: Date.now()
    });

    // Manter conexao aberta com heartbeat SEGURO
    client.heartbeat = setInterval(() => {
      // Verificar se conexao ainda esta viva antes de escrever
      if (res.writableEnded || res.destroyed || res.socket?.destroyed) {
        console.log(`[ProgressSSE] Connection ${clientId} detected as closed during heartbeat`);
        this._removeClient(clientId);
        return;
      }

      try {
        res.write(`:heartbeat ${Date.now()}\n\n`);
        client.lastHeartbeat = Date.now();
        this.metrics.heartbeatsSent++;
      } catch (error) {
        console.error(`[ProgressSSE] Heartbeat failed for ${clientId}:`, error.message);
        this.metrics.heartbeatsFailed++;
        this._removeClient(clientId);
      }
    }, HEARTBEAT_INTERVAL);

    // Remover cliente quando desconectar
    req.on('close', () => {
      this._removeClient(clientId);
      console.log(`[ProgressSSE] Cliente desconectado: ${clientId} (restantes: ${this.clients.length})`);
    });
  }

  /**
   * Remove cliente e limpa recursos
   */
  _removeClient(clientId) {
    const client = this.clients.find(c => c.id === clientId);
    if (client) {
      this._cleanupClient(client);
    }
    this.clients = this.clients.filter(c => c.id !== clientId);
  }

  sendToClient(client, data) {
    // Verificar se conexao ainda esta viva antes de escrever
    if (client.res.writableEnded || client.res.destroyed) {
      return false;
    }

    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      client.res.write(message);
      return true;
    } catch (error) {
      console.error(`[ProgressSSE] Erro ao enviar para cliente ${client.id}:`, error.message);
      return false;
    }
  }

  broadcast(data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    let sent = 0;
    const deadClients = [];

    this.clients.forEach(client => {
      // Verificar se conexao ainda esta viva
      if (client.res.writableEnded || client.res.destroyed) {
        deadClients.push(client.id);
        return;
      }

      try {
        client.res.write(message);
        sent++;
      } catch (error) {
        console.error(`[ProgressSSE] Erro ao broadcast para cliente ${client.id}:`, error.message);
        deadClients.push(client.id);
      }
    });

    // Limpar conexoes mortas detectadas durante broadcast
    if (deadClients.length > 0) {
      deadClients.forEach(id => this._removeClient(id));
    }

    console.log(`[ProgressSSE] Broadcast enviado para ${sent}/${this.clients.length} clientes:`, data.type);
  }

  updateTask(agentId, taskName, status, percentage) {
    // Encontrar ou criar tarefa
    const existingIndex = this.tasks.findIndex(
      t => t.agentId === agentId && t.taskName === taskName
    );

    const task = {
      agentId,
      taskName,
      status, // 'pending', 'in_progress', 'completed', 'error'
      percentage,
      timestamp: Date.now()
    };

    if (existingIndex >= 0) {
      this.tasks[existingIndex] = task;
    } else {
      this.tasks.push(task);
    }

    // Atualizar progresso global
    const completedTasks = this.tasks.filter(t => t.status === 'completed').length;
    this.globalProgress = (completedTasks / this.tasks.length) * 100;

    // Broadcast atualização
    this.broadcast({
      type: 'task-update',
      ...task,
      globalProgress: this.globalProgress
    });
  }

  start() {
    this.server = this.app.listen(this.port, () => {
      console.log(`\n✅ Progress SSE Server rodando na porta ${this.port}`);
      console.log(`   - SSE Stream: http://localhost:${this.port}/api/integration/progress-stream`);
      console.log(`   - Status: http://localhost:${this.port}/api/integration/status`);
      console.log(`   - Health: http://localhost:${this.port}/health\n`);
    });

    return this.server;
  }

  stop() {
    // Parar cleanup timer
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
    }

    // Fechar todas as conexoes
    this.clients.forEach(client => {
      this._cleanupClient(client);
    });
    this.clients = [];

    if (this.server) {
      this.server.close();
      console.log('[ProgressSSE] Server parado');
    }
  }

  /**
   * Obtem metricas do servidor
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeConnections: this.clients.length,
      activeTasks: this.tasks.length,
      activeAgents: this.activeAgents.size,
      timestamp: Date.now()
    };
  }
}

// CLI Execution
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const port = process.env.SSE_PORT || 3001;
  const server = new ProgressSSEServer(port);

  server.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Encerrando servidor SSE...');
    server.stop();
    process.exit(0);
  });

  // Exemplo de simulação de progresso (para testes)
  if (process.env.SIMULATE === 'true') {
    console.log('🧪 Modo de simulação ativado\n');

    const agents = ['aws-bedrock', 'google-search', 'datajud'];
    let taskCounter = 0;

    const simulate = () => {
      const agentId = agents[Math.floor(Math.random() * agents.length)];
      const taskName = `Tarefa ${taskCounter++}`;
      const status = ['in_progress', 'completed'][Math.floor(Math.random() * 2)];
      const percentage = Math.floor(Math.random() * 100);

      server.updateTask(agentId, taskName, status, percentage);

      if (taskCounter < 50) {
        setTimeout(simulate, 2000);
      }
    };

    // Iniciar agentes
    agents.forEach(agentId => {
      server.activeAgents.add(agentId);
      server.broadcast({ type: 'agent-start', agentId });
    });

    setTimeout(simulate, 3000);
  }
}

export default ProgressSSEServer;
