/**
 * ROM Agent - Sidebar Manager
 * Gerencia a navegação e visualização da sidebar de ferramentas
 */

const sidebar = {
  // Configuração dos itens da sidebar
  items: [
    // Grupo Principal
    { id: 'chat', icon: '💬', label: 'Chat', route: '/', group: 'main' },
    { id: 'upload', icon: '📄', label: 'Upload de Documentos', route: '/upload', group: 'main' },

    // Grupo Pesquisa e Conhecimento
    { id: 'jurisprudencia', icon: '⚖️', label: 'Jurisprudência', route: '/jurisprudencia', group: 'knowledge' },
    { id: 'knowledge-base', icon: '📚', label: 'Knowledge Base', route: '/knowledge-base', group: 'knowledge' },
    { id: 'search', icon: '🔍', label: 'Buscar', route: '/search', group: 'knowledge' },

    // Grupo Gerenciamento
    { id: 'dashboard', icon: '📊', label: 'Dashboard', route: '/dashboard', group: 'management' },
    { id: 'team', icon: '👥', label: 'Equipe ROM', route: '/team', group: 'management' },
    { id: 'settings', icon: '⚙️', label: 'Configurações', route: '/settings', group: 'management' }
  ],

  // Estado atual
  state: {
    activeItem: 'chat',
    isOpen: true,
    currentRoute: '/'
  },

  // Versão do sistema
  version: '2.7.0',

  /**
   * Inicializa a sidebar
   */
  init() {
    this.createSidebarHTML();
    this.attachEventListeners();
    this.setActive('chat');
    this.loadStoredState();
  },

  /**
   * Cria a estrutura HTML da sidebar
   */
  createSidebarHTML() {
    const sidebarContainer = document.createElement('aside');
    sidebarContainer.id = 'sidebar';
    sidebarContainer.className = 'sidebar';
    sidebarContainer.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-title">
          <span class="sidebar-logo">🤖</span>
          <span class="sidebar-brand">ROM Agent</span>
        </div>
        <button class="sidebar-toggle" id="sidebarToggle" title="Recolher/Expandir">
          <span class="toggle-icon">⟨</span>
        </button>
      </div>

      <nav class="sidebar-nav">
        <!-- Grupo Principal -->
        <div class="sidebar-group">
          <div class="sidebar-group-items">
            ${this.renderGroupItems('main')}
          </div>
        </div>

        <!-- Separador -->
        <div class="sidebar-divider"></div>

        <!-- Grupo Pesquisa e Conhecimento -->
        <div class="sidebar-group">
          <div class="sidebar-group-label">Pesquisa & Conhecimento</div>
          <div class="sidebar-group-items">
            ${this.renderGroupItems('knowledge')}
          </div>
        </div>

        <!-- Separador -->
        <div class="sidebar-divider"></div>

        <!-- Grupo Gerenciamento -->
        <div class="sidebar-group">
          <div class="sidebar-group-label">Gerenciamento</div>
          <div class="sidebar-group-items">
            ${this.renderGroupItems('management')}
          </div>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-footer-content">
          <div class="system-info">
            <span class="version-label">v${this.version}</span>
          </div>
          <div class="user-info">
            <div class="user-avatar">👤</div>
            <div class="user-details">
              <div class="user-name" id="userName">Usuário</div>
              <div class="user-status">Online</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Injetar na página
    const body = document.body;
    if (body.firstChild) {
      body.insertBefore(sidebarContainer, body.firstChild);
    } else {
      body.appendChild(sidebarContainer);
    }

    // Adicionar CSS
    this.injectStyles();
  },

  /**
   * Renderiza itens de um grupo específico
   */
  renderGroupItems(group) {
    return this.items
      .filter(item => item.group === group)
      .map(item => `
        <a class="sidebar-item"
           id="sidebar-${item.id}"
           href="javascript:void(0)"
           data-id="${item.id}"
           data-route="${item.route}"
           title="${item.label}">
          <span class="sidebar-item-icon">${item.icon}</span>
          <span class="sidebar-item-label">${item.label}</span>
          <span class="sidebar-item-indicator"></span>
        </a>
      `)
      .join('');
  },

  /**
   * Anexa event listeners aos elementos da sidebar
   */
  attachEventListeners() {
    // Itens da sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const id = item.dataset.id;
        const route = item.dataset.route;
        this.handleItemClick(id, route);
      });

      // Hover effect
      item.addEventListener('mouseenter', () => {
        item.classList.add('hover');
      });

      item.addEventListener('mouseleave', () => {
        item.classList.remove('hover');
      });
    });

    // Botão de toggle
    const toggleBtn = document.getElementById('sidebarToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleSidebar());
    }
  },

  /**
   * Manipula o clique em um item da sidebar
   */
  handleItemClick(id, route) {
    this.setActive(id);
    this.navigate(route);
    this.logNavigation(id, route);
  },

  /**
   * Define o item ativo
   */
  setActive(id) {
    // Remover classe ativa de todos os itens
    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.classList.remove('active');
    });

    // Adicionar classe ativa ao item selecionado
    const activeItem = document.getElementById(`sidebar-${id}`);
    if (activeItem) {
      activeItem.classList.add('active');
      this.state.activeItem = id;
      this.saveState();
    }
  },

  /**
   * Navega para uma rota
   */
  navigate(route) {
    this.state.currentRoute = route;

    // Emitir evento de navegação
    const event = new CustomEvent('sidebarNavigate', {
      detail: { route, itemId: this.state.activeItem }
    });
    document.dispatchEvent(event);

    // Atualizar URL (sem reload)
    if (window.history.pushState) {
      window.history.pushState({ route }, '', route);
    }
  },

  /**
   * Alterna a visibilidade da sidebar
   */
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');

    this.state.isOpen = !this.state.isOpen;
    sidebar.classList.toggle('collapsed');

    if (toggleBtn) {
      toggleBtn.innerHTML = this.state.isOpen
        ? '<span class="toggle-icon">⟨</span>'
        : '<span class="toggle-icon">⟩</span>';
    }

    this.saveState();
  },

  /**
   * Registra navegação no console
   */
  logNavigation(itemId, route) {
    const item = this.items.find(i => i.id === itemId);
    if (item) {
      console.log(`[Sidebar] Navegando para: ${item.label} (${route})`);
    }
  },

  /**
   * Salva o estado da sidebar no localStorage
   */
  saveState() {
    try {
      localStorage.setItem('sidebarState', JSON.stringify({
        activeItem: this.state.activeItem,
        isOpen: this.state.isOpen,
        currentRoute: this.state.currentRoute
      }));
    } catch (e) {
      console.warn('Não foi possível salvar o estado da sidebar:', e);
    }
  },

  /**
   * Carrega o estado salvo da sidebar
   */
  loadStoredState() {
    try {
      const stored = localStorage.getItem('sidebarState');
      if (stored) {
        const state = JSON.parse(stored);
        if (state.activeItem) {
          this.setActive(state.activeItem);
        }
        if (!state.isOpen) {
          this.toggleSidebar();
        }
      }
    } catch (e) {
      console.warn('Não foi possível carregar o estado da sidebar:', e);
    }
  },

  /**
   * Atualiza o nome do usuário exibido
   */
  setUserName(name) {
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
      userNameElement.textContent = name;
    }
  },

  /**
   * Injeta os estilos CSS da sidebar
   */
  injectStyles() {
    if (document.getElementById('sidebar-styles')) {
      return; // Estilos já foram injetados
    }

    const style = document.createElement('style');
    style.id = 'sidebar-styles';
    style.textContent = `
      /* Sidebar Container */
      .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        width: 280px;
        height: 100vh;
        background: linear-gradient(135deg, #1a1f3a 0%, #16213e 100%);
        color: #e0e0e0;
        display: flex;
        flex-direction: column;
        z-index: 1000;
        box-shadow: 2px 0 15px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
        overflow-y: auto;
        overflow-x: hidden;
      }

      .sidebar.collapsed {
        width: 80px;
      }

      /* Header */
      .sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        flex-shrink: 0;
      }

      .sidebar.collapsed .sidebar-header {
        padding: 20px 10px;
      }

      .sidebar-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
        font-size: 18px;
        color: #ffffff;
      }

      .sidebar.collapsed .sidebar-title {
        gap: 0;
      }

      .sidebar.collapsed .sidebar-brand {
        display: none;
      }

      .sidebar-logo {
        font-size: 24px;
      }

      /* Toggle Button */
      .sidebar-toggle {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #e0e0e0;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        font-size: 16px;
      }

      .sidebar-toggle:hover {
        background: rgba(255, 255, 255, 0.2);
        color: #ffffff;
      }

      .toggle-icon {
        display: inline-block;
        transition: transform 0.3s ease;
      }

      /* Navigation */
      .sidebar-nav {
        flex: 1;
        padding: 20px 0;
        overflow-y: auto;
      }

      .sidebar-nav::-webkit-scrollbar {
        width: 4px;
      }

      .sidebar-nav::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
      }

      .sidebar-nav::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }

      .sidebar-nav::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      /* Group */
      .sidebar-group {
        padding: 10px 0;
      }

      .sidebar-group-label {
        padding: 8px 20px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.5);
        letter-spacing: 1px;
        user-select: none;
      }

      .sidebar.collapsed .sidebar-group-label {
        display: none;
      }

      .sidebar-group-items {
        display: flex;
        flex-direction: column;
      }

      /* Divider */
      .sidebar-divider {
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
        margin: 10px 0;
      }

      /* Sidebar Items */
      .sidebar-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 15px;
        color: #b0b0b0;
        text-decoration: none;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
        cursor: pointer;
        margin: 4px 8px;
        border-radius: 8px;
      }

      .sidebar.collapsed .sidebar-item {
        justify-content: center;
        padding: 12px 10px;
        margin: 4px 6px;
      }

      .sidebar-item::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.05);
        opacity: 0;
        transition: opacity 0.3s ease;
        z-index: -1;
      }

      .sidebar-item:hover {
        color: #ffffff;
        background: rgba(79, 172, 254, 0.15);
        transform: translateX(4px);
      }

      .sidebar.collapsed .sidebar-item:hover {
        transform: none;
        background: rgba(79, 172, 254, 0.2);
      }

      .sidebar-item.active {
        color: #4facfe;
        background: rgba(79, 172, 254, 0.25);
        font-weight: 600;
      }

      .sidebar.collapsed .sidebar-item.active {
        background: rgba(79, 172, 254, 0.35);
      }

      .sidebar-item.active::after {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4px;
        background: linear-gradient(180deg, #4facfe, #00f2fe);
        border-radius: 0 2px 2px 0;
      }

      .sidebar.collapsed .sidebar-item.active::after {
        display: none;
      }

      /* Item Icon */
      .sidebar-item-icon {
        font-size: 18px;
        min-width: 20px;
        text-align: center;
        flex-shrink: 0;
      }

      /* Item Label */
      .sidebar-item-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 14px;
      }

      .sidebar.collapsed .sidebar-item-label {
        display: none;
      }

      /* Item Indicator */
      .sidebar-item-indicator {
        margin-left: auto;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        opacity: 0;
        transition: all 0.3s ease;
      }

      .sidebar.collapsed .sidebar-item-indicator {
        display: none;
      }

      .sidebar-item:hover .sidebar-item-indicator {
        opacity: 1;
      }

      .sidebar-item.active .sidebar-item-indicator {
        opacity: 1;
        background: #4facfe;
      }

      /* Footer */
      .sidebar-footer {
        padding: 15px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        flex-shrink: 0;
        background: rgba(0, 0, 0, 0.2);
      }

      .sidebar.collapsed .sidebar-footer {
        padding: 10px;
      }

      .sidebar-footer-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .system-info {
        text-align: center;
      }

      .version-label {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
        font-weight: 500;
      }

      .user-info {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      .sidebar.collapsed .user-info {
        justify-content: center;
        padding: 8px 4px;
      }

      .user-info:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .user-avatar {
        font-size: 20px;
        min-width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(79, 172, 254, 0.2);
        border: 1px solid rgba(79, 172, 254, 0.5);
      }

      .user-details {
        flex: 1;
      }

      .sidebar.collapsed .user-details {
        display: none;
      }

      .user-name {
        font-size: 13px;
        font-weight: 600;
        color: #ffffff;
      }

      .user-status {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
      }

      /* Responsivo */
      @media (max-width: 768px) {
        .sidebar {
          width: 70px;
        }

        .sidebar.collapsed {
          width: 70px;
        }

        .sidebar-header {
          flex-direction: column;
          gap: 10px;
          padding: 15px 10px;
        }

        .sidebar-title {
          width: 100%;
          justify-content: center;
        }

        .sidebar-brand {
          display: none !important;
        }

        .sidebar-toggle {
          width: 100%;
        }

        .sidebar-item-label,
        .sidebar-item-indicator,
        .sidebar-group-label,
        .user-details,
        .version-label {
          display: none;
        }

        .sidebar-item {
          justify-content: center;
          padding: 12px;
          margin: 4px;
        }

        .sidebar-footer {
          padding: 10px;
        }
      }

      /* Animações */
      @keyframes slideIn {
        from {
          transform: translateX(-100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      .sidebar {
        animation: slideIn 0.3s ease;
      }

      /* Scrollbar customizado */
      .sidebar::-webkit-scrollbar {
        width: 6px;
      }

      .sidebar::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
      }

      .sidebar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
      }

      .sidebar::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      /* Ajuste do body para sidebar fixa */
      body {
        margin-left: 280px;
        transition: margin-left 0.3s ease;
      }

      body.sidebar-collapsed {
        margin-left: 80px;
      }

      /* Mobile */
      @media (max-width: 768px) {
        body {
          margin-left: 70px;
        }

        body.sidebar-collapsed {
          margin-left: 70px;
        }
      }
    `;

    document.head.appendChild(style);
  },

  /**
   * Retorna o item ativo atual
   */
  getActiveItem() {
    return this.items.find(item => item.id === this.state.activeItem);
  },

  /**
   * Retorna o estado atual
   */
  getState() {
    return { ...this.state };
  }
};

// Inicializar sidebar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => sidebar.init());
} else {
  sidebar.init();
}

// Exportar para uso global
window.sidebar = sidebar;
