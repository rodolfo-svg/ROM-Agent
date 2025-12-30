/**
 * ROM Agent - Sistema de Roteamento SPA
 * Sistema completo de roteamento client-side para Single Page Application
 * @version 2.7.0
 */

class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.viewContainer = null;
    this.currentComponent = null;
    this.beforeRouteChange = null;
    this.afterRouteChange = null;
    this.isNavigating = false;

    // Títulos das páginas
    this.pageTitles = {
      '/': 'ROM Agent - Chat Jurídico',
      '/chat': 'ROM Agent - Chat Jurídico',
      '/upload': 'ROM Agent - Upload de Documentos',
      '/jurisprudencia': 'ROM Agent - Busca de Jurisprudência',
      '/kb': 'ROM Agent - Base de Conhecimento',
      '/dashboard': 'ROM Agent - Dashboard',
      '/team': 'ROM Agent - Equipe',
      '/settings': 'ROM Agent - Configurações',
      '/search': 'ROM Agent - Busca Global',
      '/404': 'ROM Agent - Página Não Encontrada'
    };
  }

  /**
   * Inicializa o router
   * @param {string} containerId - ID do container onde as views serão renderizadas
   */
  init(containerId) {
    this.viewContainer = document.getElementById(containerId);

    if (!this.viewContainer) {
      console.error(`Container "${containerId}" não encontrado`);
      return;
    }

    // Registrar rotas padrão
    this.registerDefaultRoutes();

    // Listener para back/forward do navegador
    window.addEventListener('popstate', (e) => {
      const path = e.state?.path || window.location.pathname;
      this.handleRoute(path, { skipHistory: true });
    });

    // Interceptar cliques em links com data-route
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-route]');
      if (link) {
        e.preventDefault();
        const path = link.getAttribute('data-route') || link.getAttribute('href');
        this.navigate(path);
      }
    });

    // Interceptar cliques em links internos (href começando com /)
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="/"]');
      if (link && !link.hasAttribute('data-route') && !link.hasAttribute('target')) {
        e.preventDefault();
        const path = link.getAttribute('href');
        this.navigate(path);
      }
    });

    // Carregar rota inicial
    const initialPath = window.location.pathname;
    this.handleRoute(initialPath, { skipHistory: true, replace: true });

    console.log('Router inicializado');
  }

  /**
   * Registra rotas padrão do sistema
   */
  registerDefaultRoutes() {
    // Página inicial / Chat
    this.register('/', async (container) => {
      return await this.loadChatView(container);
    });

    this.register('/chat', async (container) => {
      return await this.loadChatView(container);
    });

    // Upload de documentos
    this.register('/upload', async (container) => {
      return await this.loadUploadView(container);
    });

    // Busca de Jurisprudência
    this.register('/jurisprudencia', async (container) => {
      return await this.loadJurisprudenciaView(container);
    });

    // Knowledge Base
    this.register('/kb', async (container) => {
      return await this.loadKnowledgeBaseView(container);
    });

    // Dashboard
    this.register('/dashboard', async (container) => {
      return await this.loadDashboardView(container);
    });

    // Equipe ROM
    this.register('/team', async (container) => {
      return await this.loadTeamView(container);
    });

    // Configurações
    this.register('/settings', async (container) => {
      return await this.loadSettingsView(container);
    });

    // Busca Global
    this.register('/search', async (container) => {
      return await this.loadSearchView(container);
    });

    // 404 - Página não encontrada
    this.register('/404', async (container) => {
      return await this.load404View(container);
    });
  }

  /**
   * Registra uma nova rota
   * @param {string} path - Caminho da rota
   * @param {Function} handler - Função handler da rota
   */
  register(path, handler) {
    this.routes.set(path, handler);
  }

  /**
   * Navega para uma rota
   * @param {string} path - Caminho da rota
   * @param {Object} options - Opções de navegação
   */
  async navigate(path, options = {}) {
    if (this.isNavigating) {
      console.log('Navegação em andamento, aguarde...');
      return;
    }

    // Prevenir navegação se beforeRouteChange retornar false
    if (this.beforeRouteChange) {
      const canNavigate = await this.beforeRouteChange(path, this.currentRoute);
      if (canNavigate === false) {
        return;
      }
    }

    // Atualizar URL
    if (!options.skipHistory) {
      if (options.replace) {
        history.replaceState({ path }, '', path);
      } else {
        history.pushState({ path }, '', path);
      }
    }

    // Renderizar rota
    await this.handleRoute(path, options);

    // Dispatch evento de mudança de rota
    window.dispatchEvent(new CustomEvent('routechange', {
      detail: {
        path,
        from: this.currentRoute,
        queryParams: this.getQueryParams()
      }
    }));

    // Callback após mudança de rota
    if (this.afterRouteChange) {
      this.afterRouteChange(path, this.currentRoute);
    }
  }

  /**
   * Processa uma rota
   * @param {string} path - Caminho da rota
   * @param {Object} options - Opções de processamento
   */
  async handleRoute(path, options = {}) {
    this.isNavigating = true;

    // Remover query params do path para matching
    const cleanPath = path.split('?')[0];

    // Buscar handler da rota
    let handler = this.routes.get(cleanPath);

    // Se não encontrou, tentar 404
    if (!handler) {
      handler = this.routes.get('/404');
      if (!options.skipHistory && !options.is404) {
        history.replaceState({ path: '/404' }, '', '/404');
      }
    }

    if (!handler) {
      console.error(`Rota não encontrada: ${cleanPath}`);
      this.isNavigating = false;
      return;
    }

    // Destruir componente anterior
    if (this.currentComponent && typeof this.currentComponent.destroy === 'function') {
      try {
        this.currentComponent.destroy();
      } catch (error) {
        console.error('Erro ao destruir componente anterior:', error);
      }
    }

    // Mostrar loading
    this.showLoading();

    // Executar handler
    try {
      this.currentComponent = await handler(this.viewContainer);
      this.currentRoute = cleanPath;

      // Atualizar título da página
      this.updatePageTitle(cleanPath);

      // Scroll para o topo
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
      console.error('Erro ao carregar rota:', error);
      this.showError(error);
    } finally {
      this.isNavigating = false;
    }
  }

  /**
   * Volta na navegação
   */
  back() {
    history.back();
  }

  /**
   * Avança na navegação
   */
  forward() {
    history.forward();
  }

  /**
   * Retorna a rota atual
   * @returns {string}
   */
  getCurrentRoute() {
    return this.currentRoute;
  }

  /**
   * Retorna os query parameters da URL atual
   * @returns {URLSearchParams}
   */
  getQueryParams() {
    return new URLSearchParams(window.location.search);
  }

  /**
   * Retorna um query parameter específico
   * @param {string} key - Chave do parâmetro
   * @returns {string|null}
   */
  getQueryParam(key) {
    return this.getQueryParams().get(key);
  }

  /**
   * Atualiza o título da página
   * @param {string} path - Caminho da rota
   */
  updatePageTitle(path) {
    const title = this.pageTitles[path] || 'ROM Agent';
    document.title = title;
  }

  /**
   * Registra callback antes de mudar de rota
   * @param {Function} callback - Função callback
   */
  onBeforeRouteChange(callback) {
    this.beforeRouteChange = callback;
  }

  /**
   * Registra callback após mudar de rota
   * @param {Function} callback - Função callback
   */
  onAfterRouteChange(callback) {
    this.afterRouteChange = callback;
  }

  /**
   * Mostra tela de loading
   */
  showLoading() {
    if (this.viewContainer) {
      this.viewContainer.innerHTML = `
        <div class="loading-container" style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          gap: 1rem;
        ">
          <div class="spinner" style="
            border: 4px solid rgba(0, 0, 0, 0.1);
            border-left-color: #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
          "></div>
          <p style="color: #666; font-size: 14px;">Carregando...</p>
        </div>
        <style>
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      `;
    }
  }

  /**
   * Mostra tela de erro
   * @param {Error} error - Objeto de erro
   */
  showError(error) {
    if (this.viewContainer) {
      this.viewContainer.innerHTML = `
        <div class="error-container" style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          gap: 1rem;
          padding: 2rem;
          text-align: center;
        ">
          <div style="font-size: 48px; color: #ef4444;">⚠️</div>
          <h2 style="color: #1f2937; margin: 0;">Erro ao carregar página</h2>
          <p style="color: #666; margin: 0;">${error.message || 'Ocorreu um erro desconhecido'}</p>
          <button onclick="router.navigate('/')" style="
            background: #667eea;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            margin-top: 1rem;
          ">
            Voltar ao início
          </button>
        </div>
      `;
    }
  }

  // ==================== VIEW LOADERS ====================

  /**
   * Carrega view do Chat
   */
  async loadChatView(container) {
    container.innerHTML = `
      <div class="chat-view">
        <div id="chat-interface"></div>
      </div>
    `;

    // Se existir o chat interface global, inicializar
    if (window.chatInterface && typeof window.chatInterface.init === 'function') {
      window.chatInterface.init();
    }

    return { destroy: () => {} };
  }

  /**
   * Carrega view de Upload
   */
  async loadUploadView(container) {
    container.innerHTML = `
      <div class="upload-view">
        <div class="upload-header" style="margin-bottom: 2rem;">
          <h1 style="color: #1f2937; margin: 0 0 0.5rem 0;">Upload de Documentos</h1>
          <p style="color: #666; margin: 0;">Faça upload de documentos jurídicos para análise</p>
        </div>
        <div id="upload-container"></div>
      </div>
    `;

    // Se existir o upload system, inicializar
    if (window.uploadSystem && typeof window.uploadSystem.init === 'function') {
      window.uploadSystem.init();
    }

    return { destroy: () => {} };
  }

  /**
   * Carrega view de Jurisprudência
   */
  async loadJurisprudenciaView(container) {
    container.innerHTML = `
      <div class="jurisprudencia-view">
        <div class="jurisprudencia-header" style="margin-bottom: 2rem;">
          <h1 style="color: #1f2937; margin: 0 0 0.5rem 0;">Busca de Jurisprudência</h1>
          <p style="color: #666; margin: 0;">Pesquise jurisprudências dos principais tribunais do Brasil</p>
        </div>
        <div id="jurisprudencia-container"></div>
      </div>
    `;

    // Se existir o painel de jurisprudência, inicializar
    if (window.jurisprudenciaPanel && typeof window.jurisprudenciaPanel.init === 'function') {
      window.jurisprudenciaPanel.init();
    }

    return { destroy: () => {} };
  }

  /**
   * Carrega view de Knowledge Base
   */
  async loadKnowledgeBaseView(container) {
    container.innerHTML = `
      <div class="kb-view">
        <div class="kb-header" style="margin-bottom: 2rem;">
          <h1 style="color: #1f2937; margin: 0 0 0.5rem 0;">Base de Conhecimento</h1>
          <p style="color: #666; margin: 0;">Gerencie documentos e conhecimento jurídico</p>
        </div>
        <div id="kb-container"></div>
      </div>
    `;

    // Se existir o knowledge base system, inicializar
    if (window.knowledgeBase && typeof window.knowledgeBase.init === 'function') {
      window.knowledgeBase.init();
    }

    return { destroy: () => {} };
  }

  /**
   * Carrega view de Dashboard
   */
  async loadDashboardView(container) {
    container.innerHTML = `
      <div class="dashboard-view">
        <div class="dashboard-header" style="margin-bottom: 2rem;">
          <h1 style="color: #1f2937; margin: 0 0 0.5rem 0;">Dashboard</h1>
          <p style="color: #666; margin: 0;">Métricas e estatísticas do sistema</p>
        </div>
        <div id="dashboard-container"></div>
      </div>
    `;

    // Se existir o dashboard system, inicializar
    if (window.dashboard && typeof window.dashboard.init === 'function') {
      window.dashboard.init();
    }

    return { destroy: () => {} };
  }

  /**
   * Carrega view de Equipe
   */
  async loadTeamView(container) {
    container.innerHTML = `
      <div class="team-view">
        <div class="team-header" style="margin-bottom: 2rem;">
          <h1 style="color: #1f2937; margin: 0 0 0.5rem 0;">Equipe ROM</h1>
          <p style="color: #666; margin: 0;">Gerencie usuários e permissões da equipe</p>
        </div>
        <div id="team-container">
          <div style="text-align: center; padding: 3rem; color: #666;">
            <p>Interface de gerenciamento de equipe em desenvolvimento</p>
            <button onclick="router.navigate('/')" style="
              background: #667eea;
              color: white;
              border: none;
              padding: 0.75rem 1.5rem;
              border-radius: 8px;
              cursor: pointer;
              margin-top: 1rem;
            ">Voltar ao Chat</button>
          </div>
        </div>
      </div>
    `;

    return { destroy: () => {} };
  }

  /**
   * Carrega view de Configurações
   */
  async loadSettingsView(container) {
    container.innerHTML = `
      <div class="settings-view">
        <div class="settings-header" style="margin-bottom: 2rem;">
          <h1 style="color: #1f2937; margin: 0 0 0.5rem 0;">Configurações</h1>
          <p style="color: #666; margin: 0;">Configure preferências do sistema</p>
        </div>
        <div id="settings-container" style="max-width: 800px;">
          <div class="settings-section" style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1rem;">
            <h3 style="margin: 0 0 1rem 0; color: #1f2937;">Aparência</h3>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div>
                <div style="font-weight: 500; color: #1f2937; margin-bottom: 0.25rem;">Tema</div>
                <div style="font-size: 14px; color: #666;">Escolha entre tema claro ou escuro</div>
              </div>
              <div id="theme-toggle-container"></div>
            </div>
          </div>

          <div class="settings-section" style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1rem;">
            <h3 style="margin: 0 0 1rem 0; color: #1f2937;">Notificações</h3>
            <div style="font-size: 14px; color: #666;">Configurações de notificações em desenvolvimento</div>
          </div>

          <div class="settings-section" style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h3 style="margin: 0 0 1rem 0; color: #1f2937;">Sobre</h3>
            <div style="font-size: 14px; color: #666;">
              <p style="margin: 0 0 0.5rem 0;"><strong>ROM Agent</strong></p>
              <p style="margin: 0 0 0.5rem 0;">Versão 2.7.0</p>
              <p style="margin: 0;">Assistente Jurídico Inteligente</p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Inicializar theme toggle se existir
    if (window.themeToggle && typeof window.themeToggle.init === 'function') {
      const toggleContainer = document.getElementById('theme-toggle-container');
      if (toggleContainer) {
        window.themeToggle.init(toggleContainer);
      }
    }

    return { destroy: () => {} };
  }

  /**
   * Carrega view de Busca Global
   */
  async loadSearchView(container) {
    const query = this.getQueryParam('q') || '';

    container.innerHTML = `
      <div class="search-view">
        <div class="search-header" style="margin-bottom: 2rem;">
          <h1 style="color: #1f2937; margin: 0 0 0.5rem 0;">Busca Global</h1>
          <p style="color: #666; margin: 0;">Busque em todo o sistema</p>
        </div>
        <div id="search-container">
          <div style="margin-bottom: 2rem;">
            <input
              type="text"
              id="global-search-input"
              placeholder="Digite sua busca..."
              value="${query}"
              style="
                width: 100%;
                padding: 1rem;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                font-size: 16px;
              "
            />
          </div>
          <div id="search-results" style="text-align: center; padding: 3rem; color: #666;">
            ${query ? 'Buscando...' : 'Digite algo para buscar'}
          </div>
        </div>
      </div>
    `;

    // Event listener para busca
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
      searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          const value = e.target.value.trim();
          if (value) {
            this.navigate(`/search?q=${encodeURIComponent(value)}`);
          }
        }
      });

      // Auto-focus
      searchInput.focus();
    }

    return { destroy: () => {} };
  }

  /**
   * Carrega view 404
   */
  async load404View(container) {
    container.innerHTML = `
      <div class="not-found-view" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 500px;
        text-align: center;
        padding: 2rem;
      ">
        <div style="font-size: 72px; margin-bottom: 1rem;">404</div>
        <h1 style="color: #1f2937; margin: 0 0 0.5rem 0;">Página não encontrada</h1>
        <p style="color: #666; margin: 0 0 2rem 0;">A página que você está procurando não existe.</p>
        <button onclick="router.navigate('/')" style="
          background: #667eea;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">
          Voltar ao início
        </button>
      </div>
    `;

    return { destroy: () => {} };
  }
}

// Criar instância global do router
export const router = new Router();
window.router = router;

// Log de inicialização
console.log('Router module loaded - v2.7.0');
