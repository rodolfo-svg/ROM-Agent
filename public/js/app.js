/**
 * ROM-Agent - Aplicação Principal
 * Ponto de entrada que orquestra todos os módulos do sistema
 */

import { sidebar } from './sidebar.js';
import { api } from './api-client.js';
import { uploadSystem } from './upload-system.js';
import { dashboard } from './dashboard.js';
import { jurisprudenciaPanel } from './jurisprudencia-panel.js';
import { knowledgeBase } from './knowledge-base.js';
import { themeSystem } from './theme-system.js';
import { router } from './router.js';

/**
 * Estado Global da Aplicação
 */
const state = {
  user: null,
  currentProject: null,
  projects: [],
  theme: 'auto',
  initialized: false
};

/**
 * Classe Principal da Aplicação
 */
class App {
  constructor() {
    this.initialized = false;
    this.currentView = null;
    this.viewComponents = new Map();
  }

  /**
   * Inicializa a aplicação
   */
  async init() {
    if (this.initialized) {
      console.warn('App já está inicializada');
      return;
    }

    try {
      this.showSplashScreen();

      // 1. Inicializar tema (primeiro para evitar flash)
      await this.initTheme();

      // 2. Inicializar router
      await this.initRouter();

      // 3. Inicializar sidebar
      await this.initSidebar();

      // 4. Registrar todas as rotas
      this.registerRoutes();

      // 5. Carregar dados iniciais
      await this.loadUserData();

      // 6. Event listeners globais
      this.setupEventListeners();

      // 7. Remover splash screen e iniciar roteamento
      this.hideSplashScreen();
      router.start();

      this.initialized = true;
      state.initialized = true;

      console.log('ROM-Agent inicializado com sucesso');
    } catch (error) {
      this.handleError(error);
      this.hideSplashScreen();
    }
  }

  /**
   * Mostra splash screen durante carregamento
   */
  showSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      splash.style.display = 'flex';
    } else {
      // Criar splash screen dinamicamente se não existir
      const splashElement = document.createElement('div');
      splashElement.id = 'splash-screen';
      splashElement.className = 'splash-screen';
      splashElement.innerHTML = `
        <div class="splash-content">
          <div class="splash-logo">ROM</div>
          <div class="splash-text">Carregando...</div>
          <div class="splash-spinner"></div>
        </div>
      `;
      document.body.appendChild(splashElement);
    }
  }

  /**
   * Remove splash screen
   */
  hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => {
        splash.style.display = 'none';
      }, 300);
    }
  }

  /**
   * Inicializa o sistema de temas
   */
  async initTheme() {
    themeSystem.init();
    state.theme = themeSystem.getCurrentTheme();
  }

  /**
   * Inicializa o router
   */
  async initRouter() {
    // Router já está instanciado, não precisa fazer nada
    console.log('Router inicializado');
  }

  /**
   * Inicializa a sidebar
   */
  async initSidebar() {
    const sidebarElement = document.getElementById('sidebar');
    if (!sidebarElement) {
      console.warn('Elemento sidebar não encontrado');
      return;
    }

    sidebar.init('sidebar');
    console.log('Sidebar inicializada');
  }

  /**
   * Registra todas as rotas da aplicação
   */
  registerRoutes() {
    const container = document.getElementById('app-content') || document.getElementById('main-content');

    if (!container) {
      console.error('Container principal não encontrado');
      return;
    }

    // Rota: Chat (padrão)
    router.addRoute('/', () => this.chatHandler(container));
    router.addRoute('/chat', () => this.chatHandler(container));

    // Rota: Dashboard
    router.addRoute('/dashboard', () => this.dashboardHandler(container));

    // Rota: Jurisprudência
    router.addRoute('/jurisprudencia', () => this.jurisprudenciaHandler(container));

    // Rota: Base de Conhecimento
    router.addRoute('/kb', () => this.kbHandler(container));

    // Rota: Upload
    router.addRoute('/upload', () => this.uploadHandler(container));

    // Rota: Equipe
    router.addRoute('/team', () => this.teamHandler(container));

    // Rota: Configurações
    router.addRoute('/settings', () => this.settingsHandler(container));

    // Rota: Projetos
    router.addRoute('/projects', () => this.projectsHandler(container));

    console.log('Rotas registradas:', router.routes.size);
  }

  /**
   * Handler: Chat
   */
  async chatHandler(container) {
    try {
      container.innerHTML = `
        <div id="chat-area" class="view-chat">
          <div class="chat-header">
            <h2>Chat ROM-Agent</h2>
            <div class="chat-actions">
              <select id="project-selector" class="project-selector">
                <option value="">Selecione um projeto...</option>
              </select>
              <button id="new-chat-btn" class="btn btn-primary">
                <i class="icon-plus"></i> Nova Conversa
              </button>
            </div>
          </div>
          <div class="chat-container">
            <div id="chat-messages" class="chat-messages"></div>
            <div class="chat-input-container">
              <textarea id="chat-input" placeholder="Digite sua mensagem..." rows="3"></textarea>
              <button id="send-btn" class="btn btn-send">
                <i class="icon-send"></i> Enviar
              </button>
            </div>
          </div>
        </div>
      `;

      // Inicializar chat (implementação básica)
      this.initChatView();

      return { name: 'chat' };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Inicializa a view de chat
   */
  initChatView() {
    const projectSelector = document.getElementById('project-selector');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const newChatBtn = document.getElementById('new-chat-btn');

    // Preencher projetos
    if (projectSelector && state.projects.length > 0) {
      state.projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        projectSelector.appendChild(option);
      });

      // Selecionar projeto atual
      if (state.currentProject) {
        projectSelector.value = state.currentProject.id;
      }

      projectSelector.addEventListener('change', (e) => {
        const projectId = e.target.value;
        if (projectId) {
          state.currentProject = state.projects.find(p => p.id === projectId);
        } else {
          state.currentProject = null;
        }
      });
    }

    // Handler de envio
    const sendMessage = async () => {
      const message = chatInput.value.trim();
      if (!message) return;

      const messagesContainer = document.getElementById('chat-messages');

      // Adicionar mensagem do usuário
      const userMsg = document.createElement('div');
      userMsg.className = 'chat-message user-message';
      userMsg.textContent = message;
      messagesContainer.appendChild(userMsg);

      chatInput.value = '';
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      try {
        // Enviar para API (implementação básica)
        const response = await api.sendMessage({
          message,
          projectId: state.currentProject?.id
        });

        // Adicionar resposta
        const assistantMsg = document.createElement('div');
        assistantMsg.className = 'chat-message assistant-message';
        assistantMsg.textContent = response.message || 'Sem resposta';
        messagesContainer.appendChild(assistantMsg);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        const errorMsg = document.createElement('div');
        errorMsg.className = 'chat-message error-message';
        errorMsg.textContent = 'Erro ao processar mensagem';
        messagesContainer.appendChild(errorMsg);
      }
    };

    if (sendBtn) {
      sendBtn.addEventListener('click', sendMessage);
    }

    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => {
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
          messagesContainer.innerHTML = '';
        }
      });
    }
  }

  /**
   * Handler: Dashboard
   */
  async dashboardHandler(container) {
    try {
      container.innerHTML = `<div id="dashboard-container" class="view-dashboard"></div>`;
      await dashboard.init('dashboard-container');
      this.currentView = dashboard;
      return dashboard;
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Handler: Jurisprudência
   */
  async jurisprudenciaHandler(container) {
    try {
      container.innerHTML = `<div id="jurisprudencia-container" class="view-jurisprudencia"></div>`;
      await jurisprudenciaPanel.init('jurisprudencia-container');
      this.currentView = jurisprudenciaPanel;
      return jurisprudenciaPanel;
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Handler: Base de Conhecimento
   */
  async kbHandler(container) {
    try {
      container.innerHTML = `<div id="kb-container" class="view-kb"></div>`;
      await knowledgeBase.init('kb-container');
      this.currentView = knowledgeBase;
      return knowledgeBase;
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Handler: Upload
   */
  async uploadHandler(container) {
    try {
      container.innerHTML = `<div id="upload-container" class="view-upload"></div>`;
      uploadSystem.init('upload-container');
      this.currentView = uploadSystem;
      return uploadSystem;
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Handler: Equipe
   */
  async teamHandler(container) {
    try {
      container.innerHTML = `
        <div id="team-container" class="view-team">
          <div class="team-header">
            <h2>Equipe ROM</h2>
            <button id="add-user-btn" class="btn btn-primary">
              <i class="icon-plus"></i> Adicionar Usuário
            </button>
          </div>
          <div id="team-list" class="team-list">
            <div class="loading">Carregando equipe...</div>
          </div>
        </div>
      `;

      // Carregar usuários
      const users = await api.getUsers();
      const teamList = document.getElementById('team-list');

      if (users && users.length > 0) {
        teamList.innerHTML = users.map(user => `
          <div class="team-card">
            <div class="team-avatar">
              ${user.name.charAt(0).toUpperCase()}
            </div>
            <div class="team-info">
              <div class="team-name">${user.name}</div>
              <div class="team-email">${user.email}</div>
              <div class="team-role">${user.role || 'Membro'}</div>
            </div>
            <div class="team-actions">
              <button class="btn btn-small" data-user-id="${user.id}">Editar</button>
              <button class="btn btn-small btn-danger" data-user-id="${user.id}">Remover</button>
            </div>
          </div>
        `).join('');
      } else {
        teamList.innerHTML = '<div class="empty-state">Nenhum usuário encontrado</div>';
      }

      // Event listener para adicionar usuário
      const addUserBtn = document.getElementById('add-user-btn');
      if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
          // TODO: Implementar modal de adicionar usuário
          alert('Funcionalidade de adicionar usuário em desenvolvimento');
        });
      }

      return { name: 'team', users };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Handler: Configurações
   */
  async settingsHandler(container) {
    try {
      const currentTheme = themeSystem.getCurrentTheme();

      container.innerHTML = `
        <div id="settings-container" class="view-settings">
          <div class="settings-header">
            <h2>Configurações</h2>
          </div>
          <div class="settings-content">
            <div class="settings-section">
              <h3>Aparência</h3>
              <div class="setting-item">
                <label for="theme-select">Tema</label>
                <select id="theme-select" class="theme-select">
                  <option value="auto" ${currentTheme === 'auto' ? 'selected' : ''}>Automático</option>
                  <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Claro</option>
                  <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Escuro</option>
                </select>
              </div>
            </div>

            <div class="settings-section">
              <h3>Usuário</h3>
              <div class="setting-item">
                <label>Nome</label>
                <input type="text" value="${state.user?.name || 'Usuário'}" class="setting-input">
              </div>
              <div class="setting-item">
                <label>Email</label>
                <input type="email" value="${state.user?.email || 'usuario@rom.com'}" class="setting-input">
              </div>
            </div>

            <div class="settings-section">
              <h3>Notificações</h3>
              <div class="setting-item">
                <label class="setting-checkbox">
                  <input type="checkbox" checked>
                  <span>Notificações do sistema</span>
                </label>
              </div>
              <div class="setting-item">
                <label class="setting-checkbox">
                  <input type="checkbox" checked>
                  <span>Notificações por email</span>
                </label>
              </div>
            </div>

            <div class="settings-section">
              <h3>Sobre</h3>
              <div class="setting-item">
                <p><strong>ROM-Agent</strong></p>
                <p>Versão: 2.7.0</p>
                <p>Sistema de IA para advocacia</p>
              </div>
            </div>

            <div class="settings-actions">
              <button id="save-settings-btn" class="btn btn-primary">Salvar Configurações</button>
            </div>
          </div>
        </div>
      `;

      // Event listener para mudança de tema
      const themeSelect = document.getElementById('theme-select');
      if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
          const newTheme = e.target.value;
          themeSystem.setTheme(newTheme);
          state.theme = newTheme;
        });
      }

      // Event listener para salvar configurações
      const saveBtn = document.getElementById('save-settings-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          // TODO: Implementar salvamento de configurações
          alert('Configurações salvas com sucesso!');
        });
      }

      return { name: 'settings' };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Handler: Projetos
   */
  async projectsHandler(container) {
    try {
      container.innerHTML = `
        <div id="projects-container" class="view-projects">
          <div class="projects-header">
            <h2>Projetos</h2>
            <button id="new-project-btn" class="btn btn-primary">
              <i class="icon-plus"></i> Novo Projeto
            </button>
          </div>
          <div id="projects-list" class="projects-list">
            <div class="loading">Carregando projetos...</div>
          </div>
        </div>
      `;

      // Carregar projetos
      const projects = await api.getProjects();
      const projectsList = document.getElementById('projects-list');

      if (projects && projects.length > 0) {
        state.projects = projects;
        projectsList.innerHTML = projects.map(project => `
          <div class="project-card" data-project-id="${project.id}">
            <div class="project-icon">
              <i class="icon-folder"></i>
            </div>
            <div class="project-info">
              <div class="project-name">${project.name}</div>
              <div class="project-description">${project.description || 'Sem descrição'}</div>
              <div class="project-meta">
                <span>Criado em: ${new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <div class="project-actions">
              <button class="btn btn-small">Abrir</button>
            </div>
          </div>
        `).join('');

        // Event listener para abrir projeto
        projectsList.querySelectorAll('.project-card').forEach(card => {
          card.addEventListener('click', (e) => {
            if (!e.target.closest('.project-actions')) {
              const projectId = card.dataset.projectId;
              state.currentProject = projects.find(p => p.id === projectId);
              router.navigate('/chat');
            }
          });
        });
      } else {
        projectsList.innerHTML = `
          <div class="empty-state">
            <i class="icon-folder-open"></i>
            <p>Nenhum projeto encontrado</p>
            <button id="create-first-project" class="btn btn-primary">Criar Primeiro Projeto</button>
          </div>
        `;
      }

      // Event listener para novo projeto
      const newProjectBtn = document.getElementById('new-project-btn');
      if (newProjectBtn) {
        newProjectBtn.addEventListener('click', () => {
          // TODO: Implementar modal de criar projeto
          alert('Funcionalidade de criar projeto em desenvolvimento');
        });
      }

      return { name: 'projects', projects };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Carrega dados do usuário e iniciais
   */
  async loadUserData() {
    try {
      // Carregar dados do usuário (mock)
      state.user = {
        id: '1',
        name: 'Usuário ROM',
        email: 'usuario@rom.com',
        role: 'admin'
      };

      // Carregar projetos
      try {
        const projects = await api.getProjects();
        if (projects && Array.isArray(projects)) {
          state.projects = projects;

          // Definir projeto atual (primeiro da lista se existir)
          if (projects.length > 0 && !state.currentProject) {
            state.currentProject = projects[0];
          }
        }
      } catch (error) {
        console.warn('Erro ao carregar projetos:', error);
        state.projects = [];
      }

      console.log('Dados do usuário carregados:', state.user);
      console.log('Projetos carregados:', state.projects.length);
    } catch (error) {
      console.warn('Erro ao carregar dados do usuário:', error);
      // Continuar mesmo com erro - dados mockados
    }
  }

  /**
   * Configura event listeners globais
   */
  setupEventListeners() {
    // Integração Sidebar ↔ Router
    window.addEventListener('sidebar-navigate', (e) => {
      const route = e.detail.route;
      console.log('Navegando para:', route);
      router.navigate(route);
    });

    // Quando rota mudar, atualizar sidebar
    window.addEventListener('routechange', (e) => {
      const routeToId = {
        '/': 'chat',
        '/chat': 'chat',
        '/dashboard': 'dashboard',
        '/jurisprudencia': 'jurisprudencia',
        '/kb': 'kb',
        '/upload': 'upload',
        '/team': 'equipe',
        '/settings': 'config',
        '/projects': 'projetos'
      };

      const itemId = routeToId[e.detail.path];
      if (itemId) {
        sidebar.setActive(itemId);
      }

      console.log('Rota alterada:', e.detail.path);
    });

    // Listener para mudanças de tema
    window.addEventListener('themechange', (e) => {
      state.theme = e.detail.theme;
      console.log('Tema alterado para:', e.detail.theme);
    });

    // Listener para erros não capturados
    window.addEventListener('error', (e) => {
      console.error('Erro não capturado:', e.error);
      this.handleError(e.error);
    });

    // Listener para rejeições de Promise não capturadas
    window.addEventListener('unhandledrejection', (e) => {
      console.error('Promise rejeitada não capturada:', e.reason);
      this.handleError(e.reason);
    });

    console.log('Event listeners globais configurados');
  }

  /**
   * Tratamento global de erros
   */
  handleError(error) {
    console.error('Erro na aplicação:', error);

    // Mostrar notificação de erro (implementação básica)
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
      const errorElement = document.createElement('div');
      errorElement.className = 'error-notification';
      errorElement.innerHTML = `
        <div class="error-content">
          <i class="icon-alert"></i>
          <span>${error.message || 'Ocorreu um erro inesperado'}</span>
          <button class="error-close">&times;</button>
        </div>
      `;

      errorContainer.appendChild(errorElement);

      // Auto-remover após 5 segundos
      setTimeout(() => {
        errorElement.remove();
      }, 5000);

      // Fechar manualmente
      const closeBtn = errorElement.querySelector('.error-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          errorElement.remove();
        });
      }
    }
  }

  /**
   * Retorna o estado atual da aplicação
   */
  getState() {
    return { ...state };
  }

  /**
   * Atualiza o estado da aplicação
   */
  setState(updates) {
    Object.assign(state, updates);
  }

  /**
   * Destroi a aplicação e limpa recursos
   */
  destroy() {
    // Limpar event listeners
    window.removeEventListener('sidebar-navigate', this.setupEventListeners);
    window.removeEventListener('routechange', this.setupEventListeners);
    window.removeEventListener('themechange', this.setupEventListeners);

    // Destruir componentes
    if (this.currentView && typeof this.currentView.destroy === 'function') {
      this.currentView.destroy();
    }

    this.initialized = false;
    state.initialized = false;

    console.log('Aplicação destruída');
  }
}

// Criar instância da aplicação
const app = new App();

// Auto-inicialização quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

// Exportar para uso externo
export default app;
window.app = app;
