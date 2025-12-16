/**
 * ProgressSaver - Sistema completo de salvamento automático de progresso
 * Salva estado da aplicação em LocalStorage, IndexedDB e Backend API
 * @version 1.0.0
 */

class ProgressSaver {
  constructor() {
    this.isDirty = false;
    this.lastSave = null;
    this.autoSaveInterval = null;
    this.autoSaveIntervalMs = 30000; // 30 segundos
    this.maxChatHistory = 100; // Limitar histórico de chat
    this.version = '1.0';
    this.dbName = 'ROM_Agent_Progress';
    this.dbVersion = 1;
    this.db = null;
    this.isSaving = false;
    this.saveIndicator = null;
  }

  /**
   * Inicializar o sistema de salvamento
   */
  async init() {
    try {
      // Inicializar IndexedDB
      await this.initIndexedDB();

      // Criar indicador visual de salvamento
      this.createSaveIndicator();

      // Configurar auto-save
      this.startAutoSave();

      // Configurar event listeners
      this.setupEventListeners();

      // Carregar progresso salvo
      const savedProgress = await this.load();

      console.log('[ProgressSaver] Sistema inicializado', {
        lastSave: this.lastSave,
        hasSavedProgress: !!savedProgress
      });

      return savedProgress;
    } catch (error) {
      console.error('[ProgressSaver] Erro ao inicializar:', error);
      return null;
    }
  }

  /**
   * Inicializar IndexedDB
   */
  initIndexedDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('[ProgressSaver] IndexedDB não disponível');
        resolve(null);
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('[ProgressSaver] Erro ao abrir IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('[ProgressSaver] IndexedDB inicializado');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store para chat history
        if (!db.objectStoreNames.contains('chatHistory')) {
          const chatStore = db.createObjectStore('chatHistory', { keyPath: 'id', autoIncrement: true });
          chatStore.createIndex('timestamp', 'timestamp', { unique: false });
          chatStore.createIndex('projectId', 'projectId', { unique: false });
        }

        // Store para attachments
        if (!db.objectStoreNames.contains('attachments')) {
          const attachmentStore = db.createObjectStore('attachments', { keyPath: 'id' });
          attachmentStore.createIndex('messageId', 'messageId', { unique: false });
        }

        // Store para backups
        if (!db.objectStoreNames.contains('backups')) {
          const backupStore = db.createObjectStore('backups', { keyPath: 'timestamp' });
          backupStore.createIndex('type', 'type', { unique: false });
        }

        console.log('[ProgressSaver] IndexedDB schema criado');
      };
    });
  }

  /**
   * Criar indicador visual de salvamento
   */
  createSaveIndicator() {
    // Verificar se já existe
    if (document.getElementById('save-indicator')) {
      this.saveIndicator = document.getElementById('save-indicator');
      return;
    }

    const indicator = document.createElement('div');
    indicator.id = 'save-indicator';
    indicator.className = 'save-indicator';
    indicator.innerHTML = `
      <div class="save-indicator-content">
        <span class="save-status">Salvo</span>
        <span class="save-time"></span>
      </div>
    `;

    // Adicionar estilos
    const style = document.createElement('style');
    style.textContent = `
      .save-indicator {
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(40, 44, 52, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 8px 16px;
        font-size: 12px;
        color: #888;
        z-index: 9999;
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.3s ease;
        pointer-events: none;
        backdrop-filter: blur(10px);
      }

      .save-indicator.visible {
        opacity: 1;
        transform: translateY(0);
      }

      .save-indicator.saving {
        border-color: rgba(97, 175, 239, 0.5);
      }

      .save-indicator.saved {
        border-color: rgba(152, 195, 121, 0.5);
      }

      .save-indicator.error {
        border-color: rgba(224, 108, 117, 0.5);
      }

      .save-indicator-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .save-status {
        font-weight: 500;
      }

      .save-indicator.saving .save-status {
        color: #61afef;
      }

      .save-indicator.saving .save-status::after {
        content: '...';
        animation: dots 1.5s infinite;
      }

      .save-indicator.saved .save-status {
        color: #98c379;
      }

      .save-indicator.saved .save-status::after {
        content: ' ✓';
      }

      .save-indicator.error .save-status {
        color: #e06c75;
      }

      .save-indicator.error .save-status::after {
        content: ' ✗';
      }

      .save-time {
        font-size: 11px;
        opacity: 0.6;
      }

      @keyframes dots {
        0%, 20% { content: '.'; }
        40% { content: '..'; }
        60%, 100% { content: '...'; }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(indicator);
    this.saveIndicator = indicator;
  }

  /**
   * Mostrar indicador de salvamento
   */
  showSaveIndicator(status = 'saving') {
    if (!this.saveIndicator) return;

    this.saveIndicator.className = `save-indicator visible ${status}`;

    // Atualizar status
    const statusEl = this.saveIndicator.querySelector('.save-status');
    const timeEl = this.saveIndicator.querySelector('.save-time');

    if (status === 'saving') {
      statusEl.textContent = 'Salvando';
      timeEl.textContent = '';
    } else if (status === 'saved') {
      statusEl.textContent = 'Salvo';
      timeEl.textContent = this.getRelativeTime(this.lastSave);
    } else if (status === 'error') {
      statusEl.textContent = 'Erro ao salvar';
      timeEl.textContent = '';
    }

    // Ocultar após 3 segundos
    setTimeout(() => {
      if (this.saveIndicator.classList.contains(status)) {
        this.saveIndicator.classList.remove('visible');
      }
    }, 3000);
  }

  /**
   * Obter tempo relativo
   */
  getRelativeTime(timestamp) {
    if (!timestamp) return '';

    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'agora';
    if (minutes < 60) return `há ${minutes}m`;
    if (hours < 24) return `há ${hours}h`;
    return new Date(timestamp).toLocaleDateString();
  }

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    // Salvar ao trocar rota
    window.addEventListener('routechange', () => {
      this.markDirty();
      this.save();
    });

    // Salvar ao sair
    window.addEventListener('beforeunload', (e) => {
      if (this.isDirty) {
        this.save(true);
        // Opcional: avisar usuário sobre mudanças não salvas
        // e.preventDefault();
        // e.returnValue = '';
      }
    });

    // Salvar ao enviar mensagem no chat
    window.addEventListener('chat-message-sent', () => {
      this.markDirty();
    });

    // Salvar ao selecionar projeto
    window.addEventListener('project-changed', () => {
      this.markDirty();
    });

    // Salvar ao fazer upload
    window.addEventListener('file-uploaded', () => {
      this.markDirty();
    });

    // Salvar ao mudar tema ou preferências
    window.addEventListener('preferences-changed', () => {
      this.markDirty();
    });

    // Detectar mudanças no localStorage de outras abas
    window.addEventListener('storage', (e) => {
      if (e.key === 'rom_agent_progress') {
        console.log('[ProgressSaver] Progresso atualizado em outra aba');
        // Opcional: recarregar progresso
      }
    });
  }

  /**
   * Iniciar auto-save
   */
  startAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    this.autoSaveInterval = setInterval(() => {
      if (this.isDirty && !this.isSaving) {
        this.save();
      }
    }, this.autoSaveIntervalMs);

    console.log('[ProgressSaver] Auto-save ativado (30s)');
  }

  /**
   * Parar auto-save
   */
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Marcar como tendo mudanças não salvas
   */
  markDirty() {
    this.isDirty = true;
  }

  /**
   * Coletar dados para salvar
   */
  collectProgressData() {
    try {
      // Obter dados do estado global da aplicação
      const currentProject = window.state?.currentProject || null;
      const currentRoute = window.location.pathname || '/';
      const user = window.currentUser || null;

      // Obter preferências do localStorage
      const preferences = {
        theme: localStorage.getItem('theme') || 'dark',
        sidebarCollapsed: localStorage.getItem('sidebarCollapsed') === 'true',
        language: localStorage.getItem('language') || 'pt-BR',
        fontSize: localStorage.getItem('fontSize') || 'medium'
      };

      // Obter histórico de chat (limitar a 100 mensagens)
      const chatHistory = this.getChatHistory();

      // Obter estados de formulários
      const formStates = this.getFormStates();

      // Obter fila de uploads
      const uploadQueue = this.getUploadQueue();

      const progressData = {
        version: this.version,
        timestamp: new Date().toISOString(),
        timestampMs: Date.now(),
        user: user ? {
          id: user.id || user._id,
          name: user.name || user.username,
          email: user.email
        } : null,
        currentProject: currentProject ? {
          id: currentProject.id || currentProject._id,
          name: currentProject.name,
          description: currentProject.description
        } : null,
        currentRoute,
        preferences,
        chatHistory,
        formStates,
        uploadQueue,
        metadata: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          screenResolution: `${window.screen.width}x${window.screen.height}`
        }
      };

      return progressData;
    } catch (error) {
      console.error('[ProgressSaver] Erro ao coletar dados:', error);
      return null;
    }
  }

  /**
   * Obter histórico de chat
   */
  getChatHistory() {
    try {
      const chatContainer = document.querySelector('.chat-messages');
      if (!chatContainer) return [];

      const messages = Array.from(chatContainer.querySelectorAll('.chat-message'));
      const history = messages.slice(-this.maxChatHistory).map(msg => {
        const role = msg.classList.contains('user-message') ? 'user' : 'assistant';
        const content = msg.querySelector('.message-content')?.textContent || '';
        const timestamp = msg.dataset.timestamp || new Date().toISOString();

        return { role, content, timestamp };
      });

      return history;
    } catch (error) {
      console.error('[ProgressSaver] Erro ao obter chat history:', error);
      return [];
    }
  }

  /**
   * Obter estados de formulários
   */
  getFormStates() {
    const formStates = {};

    try {
      // Form de jurisprudência
      const jurisprudenciaForm = document.querySelector('#jurisprudencia-form');
      if (jurisprudenciaForm) {
        formStates.jurisprudencia = {
          termo: jurisprudenciaForm.querySelector('#search-term')?.value || '',
          tribunal: jurisprudenciaForm.querySelector('#tribunal')?.value || 'STF',
          dataInicio: jurisprudenciaForm.querySelector('#data-inicio')?.value || '',
          dataFim: jurisprudenciaForm.querySelector('#data-fim')?.value || ''
        };
      }

      // Form de KB
      const kbForm = document.querySelector('#kb-form');
      if (kbForm) {
        formStates.kb = {
          selectedProject: kbForm.querySelector('#kb-project')?.value || '',
          query: kbForm.querySelector('#kb-query')?.value || ''
        };
      }

      // Form de parceiro
      const partnerForm = document.querySelector('#partner-form');
      if (partnerForm) {
        formStates.partner = {
          name: partnerForm.querySelector('#partner-name')?.value || '',
          domain: partnerForm.querySelector('#partner-domain')?.value || ''
        };
      }
    } catch (error) {
      console.error('[ProgressSaver] Erro ao obter form states:', error);
    }

    return formStates;
  }

  /**
   * Obter fila de uploads
   */
  getUploadQueue() {
    try {
      const uploadQueue = JSON.parse(localStorage.getItem('uploadQueue') || '[]');
      return uploadQueue;
    } catch (error) {
      console.error('[ProgressSaver] Erro ao obter upload queue:', error);
      return [];
    }
  }

  /**
   * Salvar progresso
   */
  async save(force = false) {
    // Se não há mudanças e não é forçado, não salvar
    if (!this.isDirty && !force) {
      return;
    }

    // Se já está salvando, não salvar novamente
    if (this.isSaving) {
      console.log('[ProgressSaver] Já está salvando, aguarde...');
      return;
    }

    try {
      this.isSaving = true;
      this.showSaveIndicator('saving');

      // Coletar dados
      const progressData = this.collectProgressData();
      if (!progressData) {
        throw new Error('Falha ao coletar dados de progresso');
      }

      // Salvar em múltiplos locais
      const results = await Promise.allSettled([
        this.saveToLocalStorage(progressData),
        this.saveToIndexedDB(progressData),
        this.saveToBackend(progressData)
      ]);

      // Verificar resultados
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length === results.length) {
        throw new Error('Falha ao salvar em todos os destinos');
      }

      if (failures.length > 0) {
        console.warn('[ProgressSaver] Algumas salvamentos falharam:', failures);
      }

      // Atualizar estado
      this.isDirty = false;
      this.lastSave = Date.now();

      // Salvar timestamp do último save
      localStorage.setItem('rom_agent_last_save', this.lastSave.toString());

      this.showSaveIndicator('saved');
      console.log('[ProgressSaver] Progresso salvo com sucesso', {
        timestamp: new Date(this.lastSave).toISOString(),
        results
      });

    } catch (error) {
      console.error('[ProgressSaver] Erro ao salvar progresso:', error);
      this.showSaveIndicator('error');
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Salvar em LocalStorage
   */
  async saveToLocalStorage(data) {
    try {
      // Compactar dados se forem muito grandes
      const dataStr = JSON.stringify(data);
      const sizeKB = new Blob([dataStr]).size / 1024;

      if (sizeKB > 5000) {
        console.warn('[ProgressSaver] Dados muito grandes para localStorage:', sizeKB, 'KB');
        // Remover chat history para reduzir tamanho
        const compactData = { ...data, chatHistory: [] };
        localStorage.setItem('rom_agent_progress', JSON.stringify(compactData));
      } else {
        localStorage.setItem('rom_agent_progress', dataStr);
      }

      console.log('[ProgressSaver] Salvo em LocalStorage:', sizeKB.toFixed(2), 'KB');
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.error('[ProgressSaver] LocalStorage cheio, limpando dados antigos...');
        this.clearOldBackups();
        // Tentar novamente sem chat history
        const compactData = { ...data, chatHistory: [] };
        localStorage.setItem('rom_agent_progress', JSON.stringify(compactData));
      } else {
        throw error;
      }
    }
  }

  /**
   * Salvar em IndexedDB
   */
  async saveToIndexedDB(data) {
    if (!this.db) {
      console.warn('[ProgressSaver] IndexedDB não disponível');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['chatHistory', 'backups'], 'readwrite');

        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => {
          console.log('[ProgressSaver] Salvo em IndexedDB');
          resolve();
        };

        // Salvar chat history
        if (data.chatHistory && data.chatHistory.length > 0) {
          const chatStore = transaction.objectStore('chatHistory');

          // Limpar histórico antigo do projeto atual
          const projectId = data.currentProject?.id || 'default';
          const index = chatStore.index('projectId');
          const range = IDBKeyRange.only(projectId);
          const clearRequest = index.openCursor(range);

          clearRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            } else {
              // Adicionar novas mensagens
              data.chatHistory.forEach(msg => {
                chatStore.add({
                  ...msg,
                  projectId,
                  savedAt: Date.now()
                });
              });
            }
          };
        }

        // Salvar backup completo
        const backupStore = transaction.objectStore('backups');
        backupStore.add({
          ...data,
          type: 'auto',
          timestamp: Date.now()
        });

        // Limpar backups antigos (manter últimos 10)
        const backupIndex = backupStore.index('type');
        const backupRequest = backupIndex.openCursor(IDBKeyRange.only('auto'));
        const backups = [];

        backupRequest.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            backups.push(cursor.value);
            cursor.continue();
          } else {
            // Ordenar por timestamp e remover antigos
            backups.sort((a, b) => b.timestamp - a.timestamp);
            if (backups.length > 10) {
              backups.slice(10).forEach(backup => {
                backupStore.delete(backup.timestamp);
              });
            }
          }
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Salvar no backend
   */
  async saveToBackend(data) {
    try {
      // Verificar se está autenticado
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('[ProgressSaver] Não autenticado, pulando salvamento no backend');
        return;
      }

      // Enviar para API
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          progress: data,
          deviceId: this.getDeviceId()
        })
      });

      if (!response.ok) {
        throw new Error(`Backend retornou ${response.status}`);
      }

      const result = await response.json();
      console.log('[ProgressSaver] Salvo no backend:', result);

    } catch (error) {
      console.warn('[ProgressSaver] Erro ao salvar no backend (offline?):', error.message);
      // Não lançar erro para não bloquear salvamento local
    }
  }

  /**
   * Carregar progresso salvo
   */
  async load() {
    try {
      console.log('[ProgressSaver] Carregando progresso salvo...');

      // Tentar carregar de múltiplas fontes
      const results = await Promise.allSettled([
        this.loadFromLocalStorage(),
        this.loadFromIndexedDB(),
        this.loadFromBackend()
      ]);

      // Obter o mais recente
      const progressData = results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value)
        .sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0))[0];

      if (progressData) {
        // Verificar versão
        if (progressData.version !== this.version) {
          console.warn('[ProgressSaver] Versão diferente, migrando dados...');
          // TODO: Implementar migração de versões
        }

        // Atualizar lastSave
        this.lastSave = progressData.timestampMs || Date.now();
        this.isDirty = false;

        console.log('[ProgressSaver] Progresso carregado:', {
          timestamp: progressData.timestamp,
          source: progressData.source,
          project: progressData.currentProject?.name,
          route: progressData.currentRoute
        });

        return progressData;
      }

      console.log('[ProgressSaver] Nenhum progresso salvo encontrado');
      return null;

    } catch (error) {
      console.error('[ProgressSaver] Erro ao carregar progresso:', error);
      return null;
    }
  }

  /**
   * Carregar de LocalStorage
   */
  async loadFromLocalStorage() {
    try {
      const dataStr = localStorage.getItem('rom_agent_progress');
      if (!dataStr) return null;

      const data = JSON.parse(dataStr);
      data.source = 'localStorage';

      console.log('[ProgressSaver] Carregado de LocalStorage');
      return data;
    } catch (error) {
      console.error('[ProgressSaver] Erro ao carregar de LocalStorage:', error);
      return null;
    }
  }

  /**
   * Carregar de IndexedDB
   */
  async loadFromIndexedDB() {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['backups'], 'readonly');
        const store = transaction.objectStore('backups');
        const index = store.index('type');
        const request = index.openCursor(IDBKeyRange.only('auto'), 'prev');

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const data = cursor.value;
            data.source = 'indexedDB';
            console.log('[ProgressSaver] Carregado de IndexedDB');
            resolve(data);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Carregar do backend
   */
  async loadFromBackend() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;

      const response = await fetch('/api/progress', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Backend retornou ${response.status}`);
      }

      const result = await response.json();
      if (result.progress) {
        result.progress.source = 'backend';
        console.log('[ProgressSaver] Carregado do backend');
        return result.progress;
      }

      return null;

    } catch (error) {
      console.warn('[ProgressSaver] Erro ao carregar do backend:', error.message);
      return null;
    }
  }

  /**
   * Limpar todo progresso salvo
   */
  async clearProgress() {
    try {
      console.log('[ProgressSaver] Limpando todo progresso...');

      // Limpar localStorage
      localStorage.removeItem('rom_agent_progress');
      localStorage.removeItem('rom_agent_last_save');

      // Limpar IndexedDB
      if (this.db) {
        const transaction = this.db.transaction(['chatHistory', 'backups', 'attachments'], 'readwrite');
        transaction.objectStore('chatHistory').clear();
        transaction.objectStore('backups').clear();
        transaction.objectStore('attachments').clear();
      }

      // Limpar no backend
      const token = localStorage.getItem('token');
      if (token) {
        await fetch('/api/progress', {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }

      this.isDirty = false;
      this.lastSave = null;

      console.log('[ProgressSaver] Progresso limpo com sucesso');
    } catch (error) {
      console.error('[ProgressSaver] Erro ao limpar progresso:', error);
    }
  }

  /**
   * Limpar backups antigos
   */
  clearOldBackups() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('rom_agent_backup_')) {
          localStorage.removeItem(key);
        }
      });
      console.log('[ProgressSaver] Backups antigos limpos');
    } catch (error) {
      console.error('[ProgressSaver] Erro ao limpar backups:', error);
    }
  }

  /**
   * Obter timestamp do último salvamento
   */
  getLastSaveTime() {
    return this.lastSave;
  }

  /**
   * Obter ID único do dispositivo
   */
  getDeviceId() {
    let deviceId = localStorage.getItem('rom_agent_device_id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('rom_agent_device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * Exportar progresso para arquivo JSON
   */
  async exportProgress() {
    try {
      const progressData = this.collectProgressData();
      if (!progressData) {
        throw new Error('Nenhum dado para exportar');
      }

      const dataStr = JSON.stringify(progressData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `rom-agent-progress-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('[ProgressSaver] Progresso exportado com sucesso');
    } catch (error) {
      console.error('[ProgressSaver] Erro ao exportar progresso:', error);
      throw error;
    }
  }

  /**
   * Importar progresso de arquivo JSON
   */
  async importProgress(file) {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();

        reader.onload = async (e) => {
          try {
            const progressData = JSON.parse(e.target.result);

            // Validar dados
            if (!progressData.version || !progressData.timestamp) {
              throw new Error('Arquivo de progresso inválido');
            }

            // Detectar conflitos de versão
            if (progressData.version !== this.version) {
              console.warn('[ProgressSaver] Versão diferente detectada');
              // TODO: Implementar migração
            }

            // Salvar dados importados
            await Promise.all([
              this.saveToLocalStorage(progressData),
              this.saveToIndexedDB(progressData)
            ]);

            this.lastSave = progressData.timestampMs || Date.now();
            this.isDirty = false;

            console.log('[ProgressSaver] Progresso importado com sucesso');
            resolve(progressData);

          } catch (error) {
            reject(error);
          }
        };

        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Sincronizar com GitHub (opcional)
   */
  async syncToGithub() {
    try {
      const githubToken = localStorage.getItem('github_token');
      if (!githubToken) {
        console.log('[ProgressSaver] Token GitHub não configurado');
        return;
      }

      const progressData = this.collectProgressData();
      const dataStr = JSON.stringify(progressData, null, 2);

      // TODO: Implementar commit automático no GitHub
      // Usar GitHub API para criar/atualizar arquivo .rom-agent-progress.json
      console.log('[ProgressSaver] Sincronização GitHub não implementada ainda');

    } catch (error) {
      console.error('[ProgressSaver] Erro ao sincronizar com GitHub:', error);
    }
  }

  /**
   * Destruir instância
   */
  destroy() {
    this.stopAutoSave();

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    if (this.saveIndicator) {
      this.saveIndicator.remove();
      this.saveIndicator = null;
    }

    console.log('[ProgressSaver] Destruído');
  }
}

// Criar instância global
const progressSaver = new ProgressSaver();

// Exportar para uso em outros módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { progressSaver, ProgressSaver };
}

// Disponibilizar globalmente
window.progressSaver = progressSaver;

// Auto-inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    progressSaver.init();
  });
} else {
  progressSaver.init();
}
