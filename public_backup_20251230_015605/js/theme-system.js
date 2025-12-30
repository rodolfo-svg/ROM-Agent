/**
 * ROM Agent - Sistema de Temas (Light/Dark/Auto)
 * Gerencia alternância entre temas com persistência e detecção automática
 */

class ThemeSystem {
  constructor() {
    this.currentTheme = 'auto';
    this.systemPreference = null;
    this.themeToggle = null;
    this.mediaQuery = null;
    this.STORAGE_KEY = 'rom-theme-preference';
    this.THEMES = ['light', 'dark', 'auto'];
  }

  /**
   * Inicializa o sistema de temas
   */
  init() {
    this.injectStyles();
    this.detectSystemPreference();
    this.loadSavedTheme();
    this.applyTheme();
    this.createToggle();
    this.attachEvents();
    this.setupSystemListener();

    console.log('[ThemeSystem] Initialized:', {
      currentTheme: this.currentTheme,
      effectiveTheme: this.getEffectiveTheme(),
      systemPreference: this.systemPreference
    });
  }

  /**
   * Injeta os estilos CSS necessários
   */
  injectStyles() {
    const styleId = 'theme-system-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* CSS Variables - Light Theme (Default) */
      :root {
        --bg-primary: #ffffff;
        --bg-secondary: #f5f5f5;
        --bg-tertiary: #e0e0e0;
        --text-primary: #1a1a1a;
        --text-secondary: #666666;
        --text-tertiary: #999999;
        --border-color: #e0e0e0;
        --shadow: rgba(0, 0, 0, 0.1);
        --accent: #667eea;
        --accent-hover: #5568d3;
      }

      /* Dark Theme Variables */
      [data-theme="dark"] {
        --bg-primary: #1a1a1a;
        --bg-secondary: #2d2d2d;
        --bg-tertiary: #3d3d3d;
        --text-primary: #f5f5f5;
        --text-secondary: #cccccc;
        --text-tertiary: #999999;
        --border-color: #3d3d3d;
        --shadow: rgba(0, 0, 0, 0.5);
        --accent: #7c92f5;
        --accent-hover: #8fa3f7;
      }

      /* Smooth Transitions */
      *,
      *::before,
      *::after {
        transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
      }

      /* Theme Toggle Component */
      .theme-toggle {
        position: relative;
        display: inline-block;
        margin-left: 16px;
      }

      .theme-btn {
        position: relative;
        width: 64px;
        height: 32px;
        background: var(--bg-tertiary);
        border: 2px solid var(--border-color);
        border-radius: 16px;
        cursor: pointer;
        overflow: hidden;
        transition: background-color 0.3s ease, border-color 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 6px;
      }

      .theme-btn:hover {
        background: var(--accent);
        border-color: var(--accent-hover);
      }

      .theme-btn:active {
        transform: scale(0.95);
      }

      .theme-btn:focus {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      .theme-icon {
        font-size: 16px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.3s ease, opacity 0.3s ease;
        user-select: none;
      }

      .theme-icon.sun {
        transform: translateX(0);
        opacity: 1;
      }

      .theme-icon.moon {
        transform: translateX(0);
        opacity: 0.5;
      }

      /* Dark theme icon states */
      [data-theme="dark"] .theme-icon.sun {
        transform: translateX(-8px);
        opacity: 0.5;
      }

      [data-theme="dark"] .theme-icon.moon {
        transform: translateX(8px);
        opacity: 1;
      }

      /* Theme Slider */
      .theme-btn::before {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 24px;
        height: 24px;
        background: var(--accent);
        border-radius: 50%;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 2px 4px var(--shadow);
        z-index: 1;
      }

      [data-theme="dark"] .theme-btn::before {
        transform: translateX(32px);
        background: var(--accent-hover);
      }

      /* Theme Dropdown (optional) */
      .theme-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 8px;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        box-shadow: 0 4px 12px var(--shadow);
        display: none;
        min-width: 120px;
        z-index: 1000;
      }

      .theme-dropdown.active {
        display: block;
      }

      .theme-option {
        padding: 10px 16px;
        cursor: pointer;
        color: var(--text-primary);
        transition: background-color 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .theme-option:hover {
        background: var(--bg-secondary);
      }

      .theme-option:first-child {
        border-radius: 8px 8px 0 0;
      }

      .theme-option:last-child {
        border-radius: 0 0 8px 8px;
      }

      .theme-option.active {
        background: var(--accent);
        color: white;
      }

      .theme-option.active::after {
        content: '✓';
        margin-left: 8px;
      }

      /* Keyboard Shortcut Hint */
      .theme-toggle[data-hint]::after {
        content: attr(data-hint);
        position: absolute;
        top: -30px;
        right: 0;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        color: var(--text-secondary);
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }

      .theme-toggle:hover[data-hint]::after {
        opacity: 1;
      }

      /* Reduce motion for accessibility */
      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          transition-duration: 0.01ms !important;
          animation-duration: 0.01ms !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Detecta a preferência de tema do sistema
   */
  detectSystemPreference() {
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemPreference = this.mediaQuery.matches ? 'dark' : 'light';
  }

  /**
   * Carrega o tema salvo do localStorage
   */
  loadSavedTheme() {
    const savedTheme = localStorage.getItem(this.STORAGE_KEY);

    if (savedTheme && this.THEMES.includes(savedTheme)) {
      this.currentTheme = savedTheme;
    } else {
      this.currentTheme = 'auto';
    }
  }

  /**
   * Define um novo tema
   * @param {string} theme - 'light', 'dark', ou 'auto'
   */
  setTheme(theme) {
    if (!this.THEMES.includes(theme)) {
      console.warn('[ThemeSystem] Invalid theme:', theme);
      return;
    }

    this.currentTheme = theme;
    localStorage.setItem(this.STORAGE_KEY, theme);
    this.applyTheme();

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('themechange', {
      detail: {
        theme: this.currentTheme,
        effectiveTheme: this.getEffectiveTheme()
      }
    }));

    console.log('[ThemeSystem] Theme changed:', {
      currentTheme: this.currentTheme,
      effectiveTheme: this.getEffectiveTheme()
    });
  }

  /**
   * Retorna o tema atual
   * @returns {string} - 'light', 'dark', ou 'auto'
   */
  getTheme() {
    return this.currentTheme;
  }

  /**
   * Retorna o tema efetivo (resolve 'auto' para light/dark)
   * @returns {string} - 'light' ou 'dark'
   */
  getEffectiveTheme() {
    if (this.currentTheme === 'auto') {
      return this.systemPreference || 'light';
    }
    return this.currentTheme;
  }

  /**
   * Aplica o tema atual à página
   */
  applyTheme() {
    const effectiveTheme = this.getEffectiveTheme();
    const html = document.documentElement;
    const body = document.body;

    // Apply to both html and body for maximum compatibility
    html.setAttribute('data-theme', effectiveTheme);
    body.setAttribute('data-theme', effectiveTheme);

    // Update toggle button if it exists
    this.updateToggleUI();
  }

  /**
   * Alterna entre light e dark
   */
  toggle() {
    const effectiveTheme = this.getEffectiveTheme();
    const newTheme = effectiveTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * Cria o componente de toggle no header
   */
  createToggle() {
    // Remove existing toggle if any
    const existing = document.querySelector('.theme-toggle');
    if (existing) {
      existing.remove();
    }

    // Create toggle container
    const toggle = document.createElement('div');
    toggle.className = 'theme-toggle';
    toggle.setAttribute('data-hint', 'Ctrl+Shift+L');

    // Create toggle button
    const button = document.createElement('button');
    button.className = 'theme-btn';
    button.setAttribute('aria-label', 'Toggle theme');
    button.setAttribute('title', 'Toggle theme (Ctrl+Shift+L)');

    // Create icons
    const sunIcon = document.createElement('span');
    sunIcon.className = 'theme-icon sun';
    sunIcon.textContent = '☀️';

    const moonIcon = document.createElement('span');
    moonIcon.className = 'theme-icon moon';
    moonIcon.textContent = '🌙';

    button.appendChild(sunIcon);
    button.appendChild(moonIcon);

    // Create dropdown (optional)
    const dropdown = this.createDropdown();

    toggle.appendChild(button);
    toggle.appendChild(dropdown);

    // Try to insert into header
    const header = document.querySelector('header') ||
                   document.querySelector('.header') ||
                   document.querySelector('nav');

    if (header) {
      header.appendChild(toggle);
    } else {
      // Fallback: insert at top of body
      document.body.insertBefore(toggle, document.body.firstChild);
    }

    this.themeToggle = toggle;
  }

  /**
   * Cria o dropdown de seleção de tema
   * @returns {HTMLElement}
   */
  createDropdown() {
    const dropdown = document.createElement('div');
    dropdown.className = 'theme-dropdown';

    const options = [
      { value: 'light', label: 'Light', icon: '☀️' },
      { value: 'dark', label: 'Dark', icon: '🌙' },
      { value: 'auto', label: 'Auto', icon: '⚙️' }
    ];

    options.forEach(opt => {
      const option = document.createElement('div');
      option.className = 'theme-option';
      option.textContent = `${opt.icon} ${opt.label}`;
      option.dataset.theme = opt.value;

      if (opt.value === this.currentTheme) {
        option.classList.add('active');
      }

      option.addEventListener('click', () => {
        this.setTheme(opt.value);
        dropdown.classList.remove('active');
        this.updateDropdownUI();
      });

      dropdown.appendChild(option);
    });

    return dropdown;
  }

  /**
   * Atualiza a UI do toggle
   */
  updateToggleUI() {
    if (!this.themeToggle) return;

    const dropdown = this.themeToggle.querySelector('.theme-dropdown');
    if (dropdown) {
      this.updateDropdownUI();
    }
  }

  /**
   * Atualiza a UI do dropdown
   */
  updateDropdownUI() {
    if (!this.themeToggle) return;

    const options = this.themeToggle.querySelectorAll('.theme-option');
    options.forEach(option => {
      if (option.dataset.theme === this.currentTheme) {
        option.classList.add('active');
      } else {
        option.classList.remove('active');
      }
    });
  }

  /**
   * Anexa event listeners
   */
  attachEvents() {
    // Toggle button click
    if (this.themeToggle) {
      const button = this.themeToggle.querySelector('.theme-btn');
      const dropdown = this.themeToggle.querySelector('.theme-dropdown');

      // Left click = toggle
      button.addEventListener('click', (e) => {
        if (e.shiftKey) {
          // Shift+click = open dropdown
          dropdown.classList.toggle('active');
        } else {
          // Regular click = toggle
          this.toggle();
          dropdown.classList.remove('active');
        }
      });

      // Right click = open dropdown
      button.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        dropdown.classList.toggle('active');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!this.themeToggle.contains(e.target)) {
          dropdown.classList.remove('active');
        }
      });
    }

    // Keyboard shortcut: Ctrl+Shift+L
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * Configura listener para mudanças no tema do sistema
   */
  setupSystemListener() {
    if (!this.mediaQuery) return;

    this.mediaQuery.addEventListener('change', (e) => {
      this.systemPreference = e.matches ? 'dark' : 'light';

      console.log('[ThemeSystem] System preference changed:', this.systemPreference);

      // Only apply if current theme is 'auto'
      if (this.currentTheme === 'auto') {
        this.applyTheme();
      }
    });
  }

  /**
   * Destroi o sistema de temas (cleanup)
   */
  destroy() {
    if (this.themeToggle) {
      this.themeToggle.remove();
      this.themeToggle = null;
    }

    const style = document.getElementById('theme-system-styles');
    if (style) {
      style.remove();
    }

    console.log('[ThemeSystem] Destroyed');
  }
}

// Create and export singleton instance
const themeSystem = new ThemeSystem();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    themeSystem.init();
  });
} else {
  // DOM already loaded
  themeSystem.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { themeSystem, ThemeSystem };
}

// Export for ES6 modules
if (typeof window !== 'undefined') {
  window.ThemeSystem = ThemeSystem;
  window.themeSystem = themeSystem;
}
