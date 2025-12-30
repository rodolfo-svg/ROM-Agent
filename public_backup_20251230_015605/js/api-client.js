/**
 * ROM Agent API Client
 * Cliente centralizado para comunicação com o backend
 */

class ROMApiClient {
  constructor(baseURL = '') {
    this.baseURL = baseURL || window.location.origin;
    this.timeout = 30000; // 30 segundos
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 segundo
    this.loadingStates = new Map();
  }

  /**
   * Método genérico para requisições com retry logic e error handling
   * @param {string} endpoint - Endpoint da API
   * @param {object} options - Opções da requisição
   * @returns {Promise}
   */
  async _fetch(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      headers = {},
      timeout = this.timeout,
      retries = this.maxRetries,
      isRetry = false,
    } = options;

    const url = `${this.baseURL}${endpoint}`;
    const key = `${method} ${endpoint}`;

    // Atualizar loading state
    if (!isRetry) {
      this.setLoading(key, true);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchOptions = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        signal: controller.signal,
      };

      if (body) {
        if (body instanceof FormData) {
          delete fetchOptions.headers['Content-Type'];
          fetchOptions.body = body;
        } else {
          fetchOptions.body = JSON.stringify(body);
        }
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // Tratamento de erros HTTP
      if (!response.ok) {
        const errorData = await this._parseResponse(response);
        const error = new Error(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`
        );
        error.status = response.status;
        error.data = errorData;

        // Retry em erros de servidor (5xx) ou de timeout (408)
        if (
          (response.status >= 500 || response.status === 408) &&
          retries > 0
        ) {
          console.warn(
            `Retry ${this.maxRetries - retries + 1}/${this.maxRetries} para ${key}`
          );
          await this._delay(this.retryDelay);
          return this._fetch(endpoint, { ...options, retries: retries - 1, isRetry: true });
        }

        throw error;
      }

      const data = await this._parseResponse(response);
      this.setLoading(key, false);

      return {
        success: true,
        data,
        status: response.status,
      };
    } catch (error) {
      this.setLoading(key, false);

      // Tratamento específico para diferentes tipos de erro
      if (error.name === 'AbortError') {
        throw new Error('Requisição expirou. Tente novamente.');
      }

      if (error instanceof TypeError) {
        throw new Error('Erro de conexão. Verifique sua internet.');
      }

      throw error;
    }
  }

  /**
   * Parse response respeitando Content-Type
   * @private
   */
  async _parseResponse(response) {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      return response.json();
    }

    if (contentType?.includes('text/')) {
      return response.text();
    }

    return response.blob();
  }

  /**
   * Delay para retry logic
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Atualizar estado de loading
   * @param {string} key - Chave do estado
   * @param {boolean} state - Estado de loading
   */
  setLoading(key, state) {
    this.loadingStates.set(key, state);
    // Disparar evento customizado
    window.dispatchEvent(
      new CustomEvent('rom-api-loading-change', {
        detail: { key, loading: state },
      })
    );
  }

  /**
   * Verificar se uma requisição está carregando
   * @param {string} key - Chave do estado
   * @returns {boolean}
   */
  isLoading(key) {
    return this.loadingStates.get(key) || false;
  }

  /**
   * Obter todos os estados de loading
   * @returns {object}
   */
  getLoadingStates() {
    return Object.fromEntries(this.loadingStates);
  }

  // ==================== CHAT ENDPOINTS ====================

  /**
   * POST /api/chat
   * Enviar mensagem para o chat
   * @param {string} message - Mensagem do usuário
   * @param {object} options - Opções adicionais
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async chat(message, options = {}) {
    const body = {
      message,
      ...options,
    };

    return this._fetch('/api/chat', {
      method: 'POST',
      body,
    });
  }

  /**
   * POST /api/clear
   * Limpar histórico de chat
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async clearChat() {
    return this._fetch('/api/clear', {
      method: 'POST',
    });
  }

  // ==================== PROMPTS ENDPOINTS ====================

  /**
   * GET /api/prompts
   * Listar todos os prompts disponíveis
   * @param {object} params - Parâmetros de query
   * @returns {Promise<{success: boolean, data: array}>}
   */
  async getPrompts(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/api/prompts?${queryString}` : '/api/prompts';

    return this._fetch(endpoint, {
      method: 'GET',
    });
  }

  /**
   * POST /api/prompts
   * Criar novo prompt
   * @param {object} prompt - Dados do prompt
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async createPrompt(prompt) {
    return this._fetch('/api/prompts', {
      method: 'POST',
      body: prompt,
    });
  }

  /**
   * GET /api/prompts/:id
   * Obter prompt específico
   * @param {string} id - ID do prompt
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async getPrompt(id) {
    return this._fetch(`/api/prompts/${id}`, {
      method: 'GET',
    });
  }

  /**
   * PUT /api/prompts/:id
   * Atualizar prompt
   * @param {string} id - ID do prompt
   * @param {object} prompt - Dados atualizados
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async updatePrompt(id, prompt) {
    return this._fetch(`/api/prompts/${id}`, {
      method: 'PUT',
      body: prompt,
    });
  }

  /**
   * DELETE /api/prompts/:id
   * Deletar prompt
   * @param {string} id - ID do prompt
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async deletePrompt(id) {
    return this._fetch(`/api/prompts/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== SYSTEM ENDPOINTS ====================

  /**
   * GET /api/info
   * Obter informações do sistema
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async getSystemInfo() {
    return this._fetch('/api/info', {
      method: 'GET',
    });
  }

  /**
   * GET /api/status
   * Obter status geral do sistema
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async getSystemStatus() {
    return this._fetch('/api/status', {
      method: 'GET',
    });
  }

  // ==================== UPLOAD ENDPOINTS ====================

  /**
   * POST /api/upload
   * Upload de arquivo com progress tracking
   * @param {File|Blob} file - Arquivo para upload
   * @param {function} onProgress - Callback para progresso
   * @param {object} options - Opções adicionais
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async uploadFile(file, onProgress = null, options = {}) {
    const formData = new FormData();
    formData.append('file', file);

    // Adicionar campos extras se fornecidos
    Object.entries(options).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', event => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress({
              loaded: event.loaded,
              total: event.total,
              percentage: percentComplete,
            });
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve({
              success: true,
              data: response,
              status: xhr.status,
            });
          } catch (error) {
            reject(new Error('Erro ao parsear resposta do servidor'));
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            const error = new Error(
              errorData.message || `HTTP ${xhr.status}`
            );
            error.status = xhr.status;
            error.data = errorData;
            reject(error);
          } catch {
            reject(new Error(`HTTP ${xhr.status}: Upload falhou`));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Erro de conexão durante o upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelado'));
      });

      this.setLoading('POST /api/upload', true);
      xhr.open('POST', `${this.baseURL}/api/upload`);
      xhr.send(formData);
    }).finally(() => {
      this.setLoading('POST /api/upload', false);
    });
  }

  // ==================== JURISPRUDÊNCIA ENDPOINTS ====================

  /**
   * GET /api/jurisprudencia/buscar
   * Buscar jurisprudência
   * @param {object} params - Parâmetros de busca
   * @param {string} params.q - Query de busca
   * @param {string} params.tribunal - Tribunal (opcional)
   * @param {string} params.ano - Ano (opcional)
   * @param {number} params.limit - Limite de resultados
   * @param {number} params.offset - Offset para paginação
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async searchJurisprudence(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/api/jurisprudencia/buscar?${queryString}`;

    return this._fetch(endpoint, {
      method: 'GET',
    });
  }

  /**
   * GET /api/jurisprudencia/tribunais
   * Listar todos os tribunais
   * @returns {Promise<{success: boolean, data: array}>}
   */
  async getJurisprudenceCourts() {
    return this._fetch('/api/jurisprudencia/tribunais', {
      method: 'GET',
    });
  }

  /**
   * GET /api/jurisprudencia/:id
   * Obter detalhes de jurisprudência
   * @param {string} id - ID da jurisprudência
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async getJurisprudenceDetail(id) {
    return this._fetch(`/api/jurisprudencia/${id}`, {
      method: 'GET',
    });
  }

  /**
   * POST /api/jurisprudencia
   * Adicionar nova jurisprudência
   * @param {object} data - Dados da jurisprudência
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async createJurisprudence(data) {
    return this._fetch('/api/jurisprudencia', {
      method: 'POST',
      body: data,
    });
  }

  // ==================== PROJECTS ENDPOINTS ====================

  /**
   * GET /api/projects
   * Listar todos os projetos
   * @param {object} params - Parâmetros de query
   * @returns {Promise<{success: boolean, data: array}>}
   */
  async getProjects(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/api/projects?${queryString}` : '/api/projects';

    return this._fetch(endpoint, {
      method: 'GET',
    });
  }

  /**
   * POST /api/projects
   * Criar novo projeto
   * @param {object} project - Dados do projeto
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async createProject(project) {
    return this._fetch('/api/projects', {
      method: 'POST',
      body: project,
    });
  }

  /**
   * GET /api/projects/:id
   * Obter projeto específico
   * @param {string} id - ID do projeto
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async getProject(id) {
    return this._fetch(`/api/projects/${id}`, {
      method: 'GET',
    });
  }

  /**
   * PUT /api/projects/:id
   * Atualizar projeto
   * @param {string} id - ID do projeto
   * @param {object} project - Dados atualizados
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async updateProject(id, project) {
    return this._fetch(`/api/projects/${id}`, {
      method: 'PUT',
      body: project,
    });
  }

  /**
   * DELETE /api/projects/:id
   * Deletar projeto
   * @param {string} id - ID do projeto
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async deleteProject(id) {
    return this._fetch(`/api/projects/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * POST /api/projects/:id/archive
   * Arquivar projeto
   * @param {string} id - ID do projeto
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async archiveProject(id) {
    return this._fetch(`/api/projects/${id}/archive`, {
      method: 'POST',
    });
  }

  // ==================== SCHEDULER ENDPOINTS ====================

  /**
   * GET /api/scheduler/status
   * Obter status do scheduler
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async getSchedulerStatus() {
    return this._fetch('/api/scheduler/status', {
      method: 'GET',
    });
  }

  /**
   * POST /api/scheduler/pause
   * Pausar scheduler
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async pauseScheduler() {
    return this._fetch('/api/scheduler/pause', {
      method: 'POST',
    });
  }

  /**
   * POST /api/scheduler/resume
   * Retomar scheduler
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async resumeScheduler() {
    return this._fetch('/api/scheduler/resume', {
      method: 'POST',
    });
  }

  /**
   * POST /api/scheduler/trigger/:jobId
   * Disparar job manualmente
   * @param {string} jobId - ID do job
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async triggerSchedulerJob(jobId) {
    return this._fetch(`/api/scheduler/trigger/${jobId}`, {
      method: 'POST',
    });
  }

  // ==================== USER/TEAM ENDPOINTS ====================

  /**
   * GET /api/users
   * Listar usuários
   * @param {object} params - Parâmetros de query
   * @returns {Promise<{success: boolean, data: array}>}
   */
  async getUsers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/api/users?${queryString}` : '/api/users';

    return this._fetch(endpoint, {
      method: 'GET',
    });
  }

  /**
   * POST /api/users
   * Criar novo usuário
   * @param {object} user - Dados do usuário
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async createUser(user) {
    return this._fetch('/api/users', {
      method: 'POST',
      body: user,
    });
  }

  /**
   * PUT /api/users/:id
   * Atualizar usuário
   * @param {string} id - ID do usuário
   * @param {object} user - Dados atualizados
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async updateUser(id, user) {
    return this._fetch(`/api/users/${id}`, {
      method: 'PUT',
      body: user,
    });
  }

  /**
   * DELETE /api/users/:id
   * Deletar usuário
   * @param {string} id - ID do usuário
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async deleteUser(id) {
    return this._fetch(`/api/users/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * GET /api/teams
   * Listar equipes
   * @param {object} params - Parâmetros de query
   * @returns {Promise<{success: boolean, data: array}>}
   */
  async getTeams(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/api/teams?${queryString}` : '/api/teams';

    return this._fetch(endpoint, {
      method: 'GET',
    });
  }

  /**
   * POST /api/teams
   * Criar nova equipe
   * @param {object} team - Dados da equipe
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async createTeam(team) {
    return this._fetch('/api/teams', {
      method: 'POST',
      body: team,
    });
  }

  /**
   * PUT /api/teams/:id
   * Atualizar equipe
   * @param {string} id - ID da equipe
   * @param {object} team - Dados atualizados
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async updateTeam(id, team) {
    return this._fetch(`/api/teams/${id}`, {
      method: 'PUT',
      body: team,
    });
  }

  /**
   * DELETE /api/teams/:id
   * Deletar equipe
   * @param {string} id - ID da equipe
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async deleteTeam(id) {
    return this._fetch(`/api/teams/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== PARTNER/TIMBRADO ENDPOINTS ====================

  /**
   * POST /api/partners/upload-timbrado
   * Upload de timbrado para parceiro
   * @param {File} file - Arquivo de timbrado
   * @param {object} options - Opções adicionais
   * @param {function} onProgress - Callback para progresso
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async uploadPartnerTimbrado(file, options = {}, onProgress = null) {
    return this.uploadFile(file, onProgress, {
      endpoint: 'partners/timbrado',
      ...options,
    });
  }

  /**
   * GET /api/partners/:id/timbrado
   * Obter timbrado do parceiro
   * @param {string} id - ID do parceiro
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async getPartnerTimbrado(id) {
    return this._fetch(`/api/partners/${id}/timbrado`, {
      method: 'GET',
    });
  }

  /**
   * DELETE /api/partners/:id/timbrado
   * Deletar timbrado do parceiro
   * @param {string} id - ID do parceiro
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async deletePartnerTimbrado(id) {
    return this._fetch(`/api/partners/${id}/timbrado`, {
      method: 'DELETE',
    });
  }

  // ==================== CUSTOM INSTRUCTIONS ENDPOINTS ====================

  /**
   * GET /api/custom-instructions/:partnerId
   * Obter custom instructions do parceiro
   * @param {string} partnerId - ID do parceiro
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async getCustomInstructions(partnerId) {
    return this._fetch(`/api/custom-instructions/${partnerId}`, {
      method: 'GET',
    });
  }

  /**
   * PUT /api/custom-instructions/:partnerId
   * Atualizar custom instructions
   * @param {string} partnerId - ID do parceiro
   * @param {object} instructions - Dados das instruções
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async updateCustomInstructions(partnerId, instructions) {
    return this._fetch(`/api/custom-instructions/${partnerId}`, {
      method: 'PUT',
      body: instructions,
    });
  }

  /**
   * DELETE /api/custom-instructions/:partnerId
   * Deletar custom instructions
   * @param {string} partnerId - ID do parceiro
   * @returns {Promise<{success: boolean, data: object}>}
   */
  async deleteCustomInstructions(partnerId) {
    return this._fetch(`/api/custom-instructions/${partnerId}`, {
      method: 'DELETE',
    });
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Criar abort controller com timeout automático
   * @param {number} ms - Timeout em milissegundos
   * @returns {AbortController}
   */
  createAbortController(ms = this.timeout) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller;
  }

  /**
   * Verificar se há erro de autenticação
   * @param {Error} error - Erro capturado
   * @returns {boolean}
   */
  isAuthError(error) {
    return error.status === 401 || error.status === 403;
  }

  /**
   * Verificar se é erro de validação
   * @param {Error} error - Erro capturado
   * @returns {boolean}
   */
  isValidationError(error) {
    return error.status === 400 || error.status === 422;
  }

  /**
   * Verificar se é erro de servidor
   * @param {Error} error - Erro capturado
   * @returns {boolean}
   */
  isServerError(error) {
    return error.status >= 500;
  }

  /**
   * Clear all loading states
   */
  clearLoadingStates() {
    this.loadingStates.clear();
  }
}

/**
 * Instância única global do cliente API
 */
const api = new ROMApiClient();

/**
 * Exportar para uso em módulos
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ROMApiClient, api };
}

// Também exportar para acesso global no browser
if (typeof window !== 'undefined') {
  window.ROMApiClient = ROMApiClient;
  window.api = api;
}
