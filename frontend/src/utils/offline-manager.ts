/**
 * ROM Agent - Offline Manager
 *
 * Gerencia cache offline com IndexedDB para:
 * - Armazenamento de conversas offline
 * - Fila de ações pendentes
 * - Sincronizacao automatica quando online
 *
 * @version 1.0.0
 */

// Types
export interface OfflineAction {
  id: string;
  type: 'message' | 'upload' | 'search' | 'document';
  data: Record<string, unknown>;
  timestamp: number;
  retryCount?: number;
  maxRetries?: number;
}

export interface CachedConversation {
  id: string;
  title: string;
  messages: CachedMessage[];
  createdAt: number;
  updatedAt: number;
  partnerId?: string;
}

export interface CachedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  pending?: boolean;
}

export interface OfflineStats {
  pendingActions: number;
  cachedConversations: number;
  lastSyncAt: number | null;
  dbSize: number;
}

// Database configuration
const DB_NAME = 'rom-agent-offline';
const DB_VERSION = 2;

// Store names
const STORES = {
  CONVERSATIONS: 'conversations',
  PENDING_ACTIONS: 'pending_actions',
  METADATA: 'metadata',
  DOCUMENTS: 'cached_documents',
} as const;

/**
 * OfflineManager - Gerencia armazenamento offline com IndexedDB
 */
export class OfflineManager {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private syncInProgress = false;
  private listeners: Set<(online: boolean) => void> = new Set();

  /**
   * Inicializa o banco de dados IndexedDB
   */
  async init(): Promise<void> {
    if (this.isInitialized && this.db) {
      return;
    }

    // Check for IndexedDB support
    if (!('indexedDB' in window)) {
      console.warn('[OfflineManager] IndexedDB nao suportado');
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[OfflineManager] Erro ao abrir banco:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('[OfflineManager] Banco inicializado');

        // Setup online/offline listeners
        this.setupNetworkListeners();

        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Conversations store
        if (!db.objectStoreNames.contains(STORES.CONVERSATIONS)) {
          const convStore = db.createObjectStore(STORES.CONVERSATIONS, { keyPath: 'id' });
          convStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          convStore.createIndex('partnerId', 'partnerId', { unique: false });
        }

        // Pending actions store
        if (!db.objectStoreNames.contains(STORES.PENDING_ACTIONS)) {
          const actionsStore = db.createObjectStore(STORES.PENDING_ACTIONS, {
            keyPath: 'id',
            autoIncrement: false
          });
          actionsStore.createIndex('timestamp', 'timestamp', { unique: false });
          actionsStore.createIndex('type', 'type', { unique: false });
        }

        // Metadata store (for sync status, settings)
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
        }

        // Cached documents store
        if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
          const docsStore = db.createObjectStore(STORES.DOCUMENTS, { keyPath: 'id' });
          docsStore.createIndex('name', 'name', { unique: false });
        }
      };
    });
  }

  /**
   * Setup network event listeners
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('[OfflineManager] Conexao restaurada');
      this.notifyListeners(true);
      this.syncWhenOnline();
    });

    window.addEventListener('offline', () => {
      console.log('[OfflineManager] Conexao perdida');
      this.notifyListeners(false);
    });
  }

  /**
   * Add network status listener
   */
  addNetworkListener(callback: (online: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of network status change
   */
  private notifyListeners(online: boolean): void {
    this.listeners.forEach(callback => callback(online));
  }

  /**
   * Adiciona uma acao a fila offline
   */
  async queueAction(action: Omit<OfflineAction, 'id' | 'timestamp'>): Promise<string> {
    if (!this.db) {
      throw new Error('OfflineManager nao inicializado');
    }

    const fullAction: OfflineAction = {
      ...action,
      id: this.generateId(),
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PENDING_ACTIONS], 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_ACTIONS);
      const request = store.add(fullAction);

      request.onsuccess = () => {
        console.log('[OfflineManager] Acao enfileirada:', fullAction.type);
        resolve(fullAction.id);
      };

      request.onerror = () => {
        console.error('[OfflineManager] Erro ao enfileirar acao:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Obtem todas as acoes pendentes
   */
  async getPendingActions(): Promise<OfflineAction[]> {
    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PENDING_ACTIONS], 'readonly');
      const store = transaction.objectStore(STORES.PENDING_ACTIONS);
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Remove uma acao da fila
   */
  async removeAction(actionId: string): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PENDING_ACTIONS], 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_ACTIONS);
      const request = store.delete(actionId);

      request.onsuccess = () => {
        console.log('[OfflineManager] Acao removida:', actionId);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Atualiza retry count de uma acao
   */
  async updateActionRetry(actionId: string): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PENDING_ACTIONS], 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_ACTIONS);
      const getRequest = store.get(actionId);

      getRequest.onsuccess = () => {
        const action = getRequest.result as OfflineAction | undefined;
        if (action) {
          action.retryCount = (action.retryCount || 0) + 1;
          store.put(action);
          resolve();
        } else {
          resolve();
        }
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  }

  /**
   * Sincroniza acoes pendentes quando online
   */
  async syncWhenOnline(): Promise<{ success: number; failed: number }> {
    if (!navigator.onLine) {
      console.log('[OfflineManager] Offline - sync adiado');
      return { success: 0, failed: 0 };
    }

    if (this.syncInProgress) {
      console.log('[OfflineManager] Sync ja em andamento');
      return { success: 0, failed: 0 };
    }

    this.syncInProgress = true;
    let success = 0;
    let failed = 0;

    try {
      const actions = await this.getPendingActions();
      console.log(`[OfflineManager] Sincronizando ${actions.length} acoes...`);

      for (const action of actions) {
        try {
          await this.executeAction(action);
          await this.removeAction(action.id);
          success++;
        } catch (err) {
          console.error('[OfflineManager] Sync falhou para acao:', action.id, err);

          // Increment retry count
          await this.updateActionRetry(action.id);

          // Remove if max retries exceeded
          if ((action.retryCount || 0) >= (action.maxRetries || 3)) {
            console.warn('[OfflineManager] Max retries atingido, removendo:', action.id);
            await this.removeAction(action.id);
          }

          failed++;
        }
      }

      // Update last sync timestamp
      await this.setMetadata('lastSyncAt', Date.now());

    } finally {
      this.syncInProgress = false;
    }

    console.log(`[OfflineManager] Sync completo: ${success} sucesso, ${failed} falhas`);
    return { success, failed };
  }

  /**
   * Executa uma acao pendente
   */
  private async executeAction(action: OfflineAction): Promise<void> {
    const { type, data } = action;

    switch (type) {
      case 'message':
        await this.syncMessage(data);
        break;
      case 'upload':
        await this.syncUpload(data);
        break;
      case 'search':
        await this.syncSearch(data);
        break;
      case 'document':
        await this.syncDocument(data);
        break;
      default:
        console.warn('[OfflineManager] Tipo de acao desconhecido:', type);
    }
  }

  /**
   * Sync message to server
   */
  private async syncMessage(data: Record<string, unknown>): Promise<void> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }

  /**
   * Sync upload to server
   */
  private async syncUpload(data: Record<string, unknown>): Promise<void> {
    const formData = new FormData();

    if (data.file instanceof Blob) {
      formData.append('file', data.file, data.filename as string || 'document');
    }

    if (data.partnerId) {
      formData.append('partner_id', data.partnerId as string);
    }

    const response = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }

  /**
   * Sync search to server
   */
  private async syncSearch(data: Record<string, unknown>): Promise<void> {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }

  /**
   * Sync document to server
   */
  private async syncDocument(data: Record<string, unknown>): Promise<void> {
    const response = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }

  // ===== CONVERSATION CACHING =====

  /**
   * Salva uma conversa no cache
   */
  async cacheConversation(conversation: CachedConversation): Promise<void> {
    if (!this.db) {
      return;
    }

    conversation.updatedAt = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CONVERSATIONS], 'readwrite');
      const store = transaction.objectStore(STORES.CONVERSATIONS);
      const request = store.put(conversation);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Obtem uma conversa do cache
   */
  async getConversation(id: string): Promise<CachedConversation | null> {
    if (!this.db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CONVERSATIONS], 'readonly');
      const store = transaction.objectStore(STORES.CONVERSATIONS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Lista todas as conversas do cache
   */
  async getAllConversations(): Promise<CachedConversation[]> {
    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CONVERSATIONS], 'readonly');
      const store = transaction.objectStore(STORES.CONVERSATIONS);
      const index = store.index('updatedAt');
      const request = index.getAll();

      request.onsuccess = () => {
        // Sort by updatedAt descending
        const conversations = request.result || [];
        conversations.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(conversations);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove uma conversa do cache
   */
  async removeConversation(id: string): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CONVERSATIONS], 'readwrite');
      const store = transaction.objectStore(STORES.CONVERSATIONS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Adiciona uma mensagem a uma conversa existente
   */
  async addMessageToConversation(
    conversationId: string,
    message: CachedMessage
  ): Promise<void> {
    const conversation = await this.getConversation(conversationId);

    if (conversation) {
      conversation.messages.push(message);
      await this.cacheConversation(conversation);
    }
  }

  // ===== METADATA =====

  /**
   * Set metadata value
   */
  async setMetadata(key: string, value: unknown): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.METADATA], 'readwrite');
      const store = transaction.objectStore(STORES.METADATA);
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get metadata value
   */
  async getMetadata<T>(key: string): Promise<T | null> {
    if (!this.db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.METADATA], 'readonly');
      const store = transaction.objectStore(STORES.METADATA);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ===== STATS & UTILITIES =====

  /**
   * Obtem estatisticas do cache
   */
  async getStats(): Promise<OfflineStats> {
    const [pendingActions, conversations, lastSyncAt] = await Promise.all([
      this.getPendingActions(),
      this.getAllConversations(),
      this.getMetadata<number>('lastSyncAt'),
    ]);

    // Estimate DB size
    let dbSize = 0;
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        dbSize = estimate.usage || 0;
      }
    } catch {
      // Ignore
    }

    return {
      pendingActions: pendingActions.length,
      cachedConversations: conversations.length,
      lastSyncAt,
      dbSize,
    };
  }

  /**
   * Limpa todo o cache offline
   */
  async clearAll(): Promise<void> {
    if (!this.db) {
      return;
    }

    const storeNames = [STORES.CONVERSATIONS, STORES.PENDING_ACTIONS, STORES.METADATA, STORES.DOCUMENTS];

    for (const storeName of storeNames) {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    console.log('[OfflineManager] Cache limpo');
  }

  /**
   * Fecha a conexao com o banco
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  /**
   * Gera ID unico
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Verifica se esta online
   */
  isOnline(): boolean {
    return navigator.onLine;
  }
}

// Singleton instance
let offlineManagerInstance: OfflineManager | null = null;

/**
 * Get singleton instance of OfflineManager
 */
export function getOfflineManager(): OfflineManager {
  if (!offlineManagerInstance) {
    offlineManagerInstance = new OfflineManager();
  }
  return offlineManagerInstance;
}

/**
 * Initialize offline manager (call once at app start)
 */
export async function initOfflineManager(): Promise<OfflineManager> {
  const manager = getOfflineManager();
  await manager.init();
  return manager;
}

export default OfflineManager;
