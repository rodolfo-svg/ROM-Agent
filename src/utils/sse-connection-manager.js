/**
 * SSE Connection Manager
 * Gerenciador centralizado de conexoes Server-Sent Events
 *
 * Features:
 * - Chunk buffering (256-512 bytes) para otimizacao de rede
 * - Heartbeat seguro com verificacao de conexao
 * - TTL automatico (5min) com cleanup
 * - Prevencao de race conditions
 * - Metricas de latencia com circular buffer
 *
 * @version 1.0.0
 * @since WS5 - SSE Streaming Optimization
 */

import { EventEmitter } from 'events';

/**
 * Circular Buffer para metricas de latencia
 * Mantém apenas os últimos N entries para evitar memory leaks
 */
class CircularBuffer {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.buffer = new Array(maxSize);
    this.head = 0;
    this.count = 0;
  }

  push(value) {
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.maxSize;
    if (this.count < this.maxSize) {
      this.count++;
    }
  }

  getAll() {
    if (this.count < this.maxSize) {
      return this.buffer.slice(0, this.count);
    }
    // Buffer cheio - retornar em ordem cronologica
    return [
      ...this.buffer.slice(this.head),
      ...this.buffer.slice(0, this.head)
    ];
  }

  getStats() {
    const values = this.getAll().filter(v => v !== undefined);
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      p50: sorted[Math.floor(values.length * 0.5)],
      p95: sorted[Math.floor(values.length * 0.95)],
      p99: sorted[Math.floor(values.length * 0.99)]
    };
  }

  clear() {
    this.buffer = new Array(this.maxSize);
    this.head = 0;
    this.count = 0;
  }
}

/**
 * SSE Connection Manager
 * Gerencia conexoes SSE com otimizacoes de performance
 */
export class SSEConnectionManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuracoes
    this.heartbeatInterval = options.heartbeatInterval || 10000; // 10s
    this.connectionTTL = options.connectionTTL || 5 * 60 * 1000; // 5min
    this.chunkBufferSize = options.chunkBufferSize || 512; // bytes
    this.minChunkSize = options.minChunkSize || 256; // bytes minimo para flush
    this.cleanupInterval = options.cleanupInterval || 60000; // 1min
    this.maxLatencyEntries = options.maxLatencyEntries || 1000;

    // Estado
    this.connections = new Map();
    this.chunkBuffers = new Map();
    this.latencyBuffer = new CircularBuffer(this.maxLatencyEntries);

    // Metricas
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      totalChunks: 0,
      totalBytes: 0,
      heartbeatsSent: 0,
      heartbeatsFailed: 0,
      connectionsTimedOut: 0,
      connectionsClosedByClient: 0,
      bufferFlushes: 0
    };

    // Iniciar cleanup periodico
    this._startCleanupTimer();

    console.log('[SSEConnectionManager] Initialized with config:', {
      heartbeatInterval: this.heartbeatInterval,
      connectionTTL: this.connectionTTL,
      chunkBufferSize: this.chunkBufferSize,
      maxLatencyEntries: this.maxLatencyEntries
    });
  }

  /**
   * Adiciona nova conexao SSE
   * @param {string} id - ID unico da conexao
   * @param {Response} res - Response object do Express
   * @param {object} metadata - Metadata adicional
   * @returns {object} Connection object
   */
  addConnection(id, res, metadata = {}) {
    // Remover conexao existente com mesmo ID
    if (this.connections.has(id)) {
      this.removeConnection(id);
    }

    const connection = {
      id,
      res,
      active: true,
      createdAt: Date.now(),
      lastHeartbeat: Date.now(),
      lastWrite: Date.now(),
      metadata,
      bytesWritten: 0,
      chunksWritten: 0,
      heartbeatInterval: null,
      ttlTimeout: null
    };

    // Configurar headers SSE se ainda nao configurados
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Nginx bypass
      res.flushHeaders();
    }

    // Configurar heartbeat seguro
    connection.heartbeatInterval = setInterval(() => {
      this._sendHeartbeat(id);
    }, this.heartbeatInterval);

    // Configurar TTL timeout
    connection.ttlTimeout = setTimeout(() => {
      console.log(`[SSEConnectionManager] Connection ${id} TTL expired (${this.connectionTTL}ms)`);
      this.metrics.connectionsTimedOut++;
      this.removeConnection(id);
    }, this.connectionTTL);

    // Armazenar conexao
    this.connections.set(id, connection);
    this.chunkBuffers.set(id, '');

    // Atualizar metricas
    this.metrics.totalConnections++;
    this.metrics.activeConnections = this.connections.size;

    this.emit('connection:added', { id, metadata });

    console.log(`[SSEConnectionManager] Connection added: ${id} (active: ${this.connections.size})`);

    return connection;
  }

  /**
   * Escreve chunk com buffering otimizado
   * @param {string} id - ID da conexao
   * @param {string|object} data - Dados para enviar
   * @param {object} options - Opcoes de escrita
   * @returns {boolean} Sucesso da escrita
   */
  writeChunk(id, data, options = {}) {
    const connection = this.connections.get(id);
    if (!connection || !connection.active) {
      return false;
    }

    const { forceFlush = false, eventType = null } = options;

    // Serializar dados se necessario
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);

    // Obter buffer atual
    let buffer = this.chunkBuffers.get(id) || '';
    buffer += serialized;

    // Verificar se deve fazer flush
    const shouldFlush = forceFlush ||
                        buffer.length >= this.chunkBufferSize ||
                        eventType !== null; // Eventos nomeados sempre flush imediato

    if (shouldFlush && buffer.length >= this.minChunkSize || forceFlush) {
      return this._flush(id, buffer, eventType);
    } else if (shouldFlush) {
      // Buffer muito pequeno mas flush forcado
      return this._flush(id, buffer, eventType);
    } else {
      // Manter no buffer
      this.chunkBuffers.set(id, buffer);
      return true;
    }
  }

  /**
   * Escreve evento SSE formatado
   * @param {string} id - ID da conexao
   * @param {string} eventType - Tipo do evento (ex: 'chunk', 'complete', 'error')
   * @param {object} data - Dados do evento
   * @returns {boolean} Sucesso da escrita
   */
  writeEvent(id, eventType, data) {
    const connection = this.connections.get(id);
    if (!connection || !connection.active) {
      return false;
    }

    try {
      const { res } = connection;

      // Verificar se conexao ainda esta aberta
      if (res.writableEnded || res.destroyed) {
        this.removeConnection(id);
        return false;
      }

      // Formatar evento SSE
      let message = '';
      if (eventType) {
        message += `event: ${eventType}\n`;
      }
      message += `data: ${JSON.stringify(data)}\n\n`;

      res.write(message);

      // Atualizar metricas
      connection.lastWrite = Date.now();
      connection.bytesWritten += message.length;
      connection.chunksWritten++;
      this.metrics.totalChunks++;
      this.metrics.totalBytes += message.length;

      return true;
    } catch (error) {
      console.error(`[SSEConnectionManager] Write error for ${id}:`, error.message);
      this.removeConnection(id);
      return false;
    }
  }

  /**
   * Flush interno do buffer
   */
  _flush(id, data, eventType = null) {
    const connection = this.connections.get(id);
    if (!connection) return false;

    try {
      const { res } = connection;

      // Verificar se conexao ainda esta aberta
      if (res.writableEnded || res.destroyed) {
        this.removeConnection(id);
        return false;
      }

      // Formatar mensagem SSE
      let message = '';
      if (eventType) {
        message += `event: ${eventType}\n`;
      }
      message += `data: ${JSON.stringify({ content: data })}\n\n`;

      res.write(message);

      // Limpar buffer
      this.chunkBuffers.set(id, '');

      // Atualizar metricas
      connection.lastWrite = Date.now();
      connection.bytesWritten += message.length;
      connection.chunksWritten++;
      this.metrics.totalChunks++;
      this.metrics.totalBytes += message.length;
      this.metrics.bufferFlushes++;

      return true;
    } catch (error) {
      console.error(`[SSEConnectionManager] Flush error for ${id}:`, error.message);
      this.removeConnection(id);
      return false;
    }
  }

  /**
   * Envia heartbeat seguro
   */
  _sendHeartbeat(id) {
    const connection = this.connections.get(id);
    if (!connection || !connection.active) {
      return;
    }

    const { res } = connection;

    // Verificacao completa antes de escrever
    if (res.writableEnded || res.destroyed || res.socket?.destroyed) {
      console.log(`[SSEConnectionManager] Connection ${id} detected as closed during heartbeat`);
      this.removeConnection(id);
      return;
    }

    try {
      res.write(`:heartbeat ${Date.now()}\n\n`);
      connection.lastHeartbeat = Date.now();
      this.metrics.heartbeatsSent++;
    } catch (error) {
      console.error(`[SSEConnectionManager] Heartbeat failed for ${id}:`, error.message);
      this.metrics.heartbeatsFailed++;
      this.removeConnection(id);
    }
  }

  /**
   * Registra latencia para metricas
   * @param {number} latencyMs - Latencia em milisegundos
   */
  recordLatency(latencyMs) {
    this.latencyBuffer.push(latencyMs);
  }

  /**
   * Obtem estatisticas de latencia
   */
  getLatencyStats() {
    return this.latencyBuffer.getStats();
  }

  /**
   * Remove conexao e limpa recursos
   * @param {string} id - ID da conexao
   */
  removeConnection(id) {
    const connection = this.connections.get(id);
    if (!connection) return;

    // Limpar timers
    if (connection.heartbeatInterval) {
      clearInterval(connection.heartbeatInterval);
    }
    if (connection.ttlTimeout) {
      clearTimeout(connection.ttlTimeout);
    }

    // Flush buffer restante
    const remainingBuffer = this.chunkBuffers.get(id);
    if (remainingBuffer && remainingBuffer.length > 0) {
      try {
        this._flush(id, remainingBuffer);
      } catch (e) {
        // Ignorar erros no flush final
      }
    }

    // Limpar buffers
    this.chunkBuffers.delete(id);

    // Marcar como inativo antes de deletar
    connection.active = false;

    // Tentar fechar response gracefully
    try {
      if (!connection.res.writableEnded) {
        connection.res.end();
      }
    } catch (e) {
      // Ignorar erros ao fechar
    }

    // Remover da lista
    this.connections.delete(id);

    // Atualizar metricas
    this.metrics.activeConnections = this.connections.size;

    this.emit('connection:removed', { id, connection });

    console.log(`[SSEConnectionManager] Connection removed: ${id} (active: ${this.connections.size})`);
  }

  /**
   * Obtem conexao por ID
   * @param {string} id - ID da conexao
   * @returns {object|null} Connection object ou null
   */
  getConnection(id) {
    return this.connections.get(id) || null;
  }

  /**
   * Verifica se conexao esta ativa
   * @param {string} id - ID da conexao
   * @returns {boolean}
   */
  isActive(id) {
    const conn = this.connections.get(id);
    if (!conn) return false;
    return conn.active && !conn.res.writableEnded && !conn.res.destroyed;
  }

  /**
   * Renova TTL de uma conexao
   * @param {string} id - ID da conexao
   */
  renewTTL(id) {
    const connection = this.connections.get(id);
    if (!connection) return;

    // Cancelar timeout atual
    if (connection.ttlTimeout) {
      clearTimeout(connection.ttlTimeout);
    }

    // Criar novo timeout
    connection.ttlTimeout = setTimeout(() => {
      console.log(`[SSEConnectionManager] Connection ${id} TTL expired after renewal`);
      this.metrics.connectionsTimedOut++;
      this.removeConnection(id);
    }, this.connectionTTL);
  }

  /**
   * Inicia timer de cleanup periodico
   */
  _startCleanupTimer() {
    this._cleanupTimer = setInterval(() => {
      this._cleanup();
    }, this.cleanupInterval);

    // Nao bloquear shutdown do processo
    if (this._cleanupTimer.unref) {
      this._cleanupTimer.unref();
    }
  }

  /**
   * Cleanup de conexoes mortas
   */
  _cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, connection] of this.connections.entries()) {
      // Verificar se conexao esta morta
      const isDead = connection.res.writableEnded ||
                     connection.res.destroyed ||
                     connection.res.socket?.destroyed ||
                     !connection.active;

      // Verificar timeout de atividade (sem escrita por 2x heartbeat interval)
      const activityTimeout = now - connection.lastWrite > (this.heartbeatInterval * 2);

      if (isDead || activityTimeout) {
        this.removeConnection(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[SSEConnectionManager] Cleanup removed ${cleaned} dead connections`);
    }
  }

  /**
   * Obtem metricas do manager
   */
  getMetrics() {
    return {
      ...this.metrics,
      latencyStats: this.getLatencyStats(),
      activeConnections: this.connections.size,
      timestamp: Date.now()
    };
  }

  /**
   * Broadcast para todas as conexoes
   * @param {string} eventType - Tipo do evento
   * @param {object} data - Dados para enviar
   */
  broadcast(eventType, data) {
    let sent = 0;
    for (const [id] of this.connections) {
      if (this.writeEvent(id, eventType, data)) {
        sent++;
      }
    }
    return sent;
  }

  /**
   * Fecha todas as conexoes
   */
  closeAll() {
    for (const [id] of this.connections) {
      this.removeConnection(id);
    }
    console.log('[SSEConnectionManager] All connections closed');
  }

  /**
   * Destroy manager e libera recursos
   */
  destroy() {
    // Parar cleanup timer
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
    }

    // Fechar todas conexoes
    this.closeAll();

    // Limpar buffers
    this.chunkBuffers.clear();
    this.latencyBuffer.clear();

    console.log('[SSEConnectionManager] Manager destroyed');
  }
}

// Singleton instance
let instance = null;

/**
 * Obtem instancia singleton do SSEConnectionManager
 * @param {object} options - Opcoes de configuracao (apenas na primeira chamada)
 * @returns {SSEConnectionManager}
 */
export function getSSEConnectionManager(options = {}) {
  if (!instance) {
    instance = new SSEConnectionManager(options);
  }
  return instance;
}

/**
 * Reseta instancia singleton (para testes)
 */
export function resetSSEConnectionManager() {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}

export default SSEConnectionManager;
