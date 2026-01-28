/**
 * Knowledge Base Manager
 * Sistema completo de gerenciamento de documentos por projeto
 */

class KnowledgeBase {
  constructor() {
    this.container = null;
    this.currentProject = null;
    this.projects = [];
    this.documents = [];
    this.uploadSystem = null;
    this.searchTimeout = null;
    this.sortBy = 'date';
    this.sortOrder = 'desc';
    this.filterType = 'all';
  }

  async init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('Container not found:', containerId);
      return;
    }

    // Carregar preferências do localStorage
    this.loadPreferences();

    // Carregar projetos
    await this.loadProjects();

    // Renderizar interface
    this.render();

    // Anexar eventos
    this.attachEvents();

    // Carregar documentos do projeto atual
    if (this.currentProject) {
      await this.loadDocuments(this.currentProject.id);
    }

    console.log('Knowledge Base initialized');
  }

  loadPreferences() {
    const prefs = localStorage.getItem('kb-preferences');
    if (prefs) {
      try {
        const data = JSON.parse(prefs);
        this.sortBy = data.sortBy || 'date';
        this.sortOrder = data.sortOrder || 'desc';
        this.filterType = data.filterType || 'all';
        this.currentProject = data.currentProject || null;
      } catch (e) {
        console.error('Error loading preferences:', e);
      }
    }
  }

  savePreferences() {
    const prefs = {
      sortBy: this.sortBy,
      sortOrder: this.sortOrder,
      filterType: this.filterType,
      currentProject: this.currentProject
    };
    localStorage.setItem('kb-preferences', JSON.stringify(prefs));
  }

  async loadProjects() {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to load projects');

      const data = await response.json();
      this.projects = data.projects || [];

      // Garantir que o projeto ROM Agent existe
      const romProject = this.projects.find(p => p.id === 'rom-agent' || p.name === 'Projeto ROM Agent');
      if (!romProject) {
        this.projects.unshift({
          id: 'rom-agent',
          name: 'Projeto ROM Agent',
          description: 'Projeto principal do sistema ROM Agent',
          created: new Date().toISOString(),
          documentCount: 0,
          totalSize: 0
        });
      }

      // Selecionar projeto atual ou primeiro da lista
      if (this.currentProject) {
        const found = this.projects.find(p => p.id === this.currentProject.id);
        if (found) {
          this.currentProject = found;
        } else {
          this.currentProject = this.projects[0];
        }
      } else {
        this.currentProject = this.projects[0];
      }

      return this.projects;
    } catch (error) {
      console.error('Error loading projects:', error);
      // Fallback para projeto ROM Agent
      this.projects = [{
        id: 'rom-agent',
        name: 'Projeto ROM Agent',
        description: 'Projeto principal do sistema ROM Agent',
        created: new Date().toISOString(),
        documentCount: 0,
        totalSize: 0
      }];
      this.currentProject = this.projects[0];
      return this.projects;
    }
  }

  async loadDocuments(projectId) {
    try {
      // ✨ CORRIGIDO: Usar endpoint correto /api/kb/documents
      const response = await fetch('/api/kb/documents');
      if (!response.ok) throw new Error('Failed to load documents');

      const data = await response.json();
      this.documents = data.documents || [];

      this.renderDocumentList();
      this.updateProjectStats();
      return this.documents;
    } catch (error) {
      console.error('Error loading documents:', error);
      this.documents = [];
      this.renderDocumentList();
      return [];
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="kb-container">
        <!-- Header: Seleção de Projeto -->
        <div class="kb-header">
          <div class="kb-project-selector">
            <label for="kb-project-select">Projeto:</label>
            <select id="kb-project-select" class="kb-select">
              ${this.projects.map(p => `
                <option value="${p.id}" ${this.currentProject?.id === p.id ? 'selected' : ''}>
                  ${p.name}
                </option>
              `).join('')}
            </select>
            <button id="kb-new-project-btn" class="kb-btn kb-btn-primary">
              + Novo Projeto
            </button>
          </div>
          <div class="kb-project-info">
            <div class="kb-project-name">${this.currentProject?.name || ''}</div>
            <div class="kb-project-desc">${this.currentProject?.description || ''}</div>
            <div class="kb-project-stats">
              <span id="kb-doc-count">0 documentos</span>
              <span class="kb-separator">•</span>
              <span id="kb-total-size">0 KB</span>
              <span class="kb-separator">•</span>
              <span>Criado em ${this.formatDate(this.currentProject?.created)}</span>
            </div>
          </div>
        </div>

        <!-- Upload Area -->
        <div class="kb-upload-section">
          <div class="kb-upload-area" id="kb-upload-area">
            <div class="kb-upload-icon">📁</div>
            <div class="kb-upload-text">
              <strong>Arraste documentos aqui</strong> ou clique para selecionar
            </div>
            <div class="kb-upload-hint">
              Tipos aceitos: PDF, DOC, DOCX, TXT, MD, PNG, JPG
            </div>
            <input type="file" id="kb-file-input" multiple accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg" style="display: none;">
          </div>
          <div id="kb-upload-progress" class="kb-upload-progress" style="display: none;">
            <div class="kb-progress-bar">
              <div id="kb-progress-fill" class="kb-progress-fill"></div>
            </div>
            <div id="kb-progress-text" class="kb-progress-text">Uploading...</div>
          </div>
        </div>

        <!-- Controles da Lista -->
        <div class="kb-controls">
          <div class="kb-search-box">
            <input type="text" id="kb-search-input" class="kb-search-input" placeholder="Buscar documentos...">
            <button id="kb-search-btn" class="kb-btn kb-btn-icon">🔍</button>
          </div>
          <div class="kb-filters">
            <select id="kb-filter-type" class="kb-select kb-select-sm">
              <option value="all">Todos os tipos</option>
              <option value="pdf">PDF</option>
              <option value="doc">DOC/DOCX</option>
              <option value="txt">TXT</option>
              <option value="md">Markdown</option>
              <option value="img">Imagens</option>
            </select>
            <select id="kb-sort-by" class="kb-select kb-select-sm">
              <option value="date">Data</option>
              <option value="name">Nome</option>
              <option value="size">Tamanho</option>
              <option value="type">Tipo</option>
            </select>
            <button id="kb-sort-order" class="kb-btn kb-btn-icon" title="Ordem">
              ${this.sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        <!-- Lista de Documentos -->
        <div class="kb-documents-section">
          <div id="kb-documents-list" class="kb-documents-list">
            <!-- Documentos serão renderizados aqui -->
          </div>
        </div>
      </div>

      <!-- Modal de Projeto -->
      <div id="kb-project-modal" class="kb-modal" style="display: none;">
        <div class="kb-modal-content">
          <div class="kb-modal-header">
            <h3 id="kb-modal-title">Novo Projeto</h3>
            <button class="kb-modal-close">&times;</button>
          </div>
          <div class="kb-modal-body">
            <div class="kb-form-group">
              <label for="kb-project-name">Nome do Projeto *</label>
              <input type="text" id="kb-project-name" class="kb-input" required>
            </div>
            <div class="kb-form-group">
              <label for="kb-project-description">Descrição</label>
              <textarea id="kb-project-description" class="kb-textarea" rows="3"></textarea>
            </div>
            <div class="kb-form-group">
              <label for="kb-project-client">Cliente/Parceiro</label>
              <input type="text" id="kb-project-client" class="kb-input">
            </div>
          </div>
          <div class="kb-modal-footer">
            <button id="kb-project-cancel" class="kb-btn kb-btn-secondary">Cancelar</button>
            <button id="kb-project-save" class="kb-btn kb-btn-primary">Salvar</button>
          </div>
        </div>
      </div>

      <!-- Modal de Preview -->
      <div id="kb-preview-modal" class="kb-modal" style="display: none;">
        <div class="kb-modal-content kb-modal-large">
          <div class="kb-modal-header">
            <h3 id="kb-preview-title">Preview</h3>
            <button class="kb-modal-close">&times;</button>
          </div>
          <div class="kb-modal-body">
            <div id="kb-preview-content" class="kb-preview-content">
              <!-- Preview content -->
            </div>
          </div>
        </div>
      </div>

      <style>
        .kb-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #f8f9fa;
          border-radius: 8px;
          overflow: hidden;
        }

        /* Header */
        .kb-header {
          background: white;
          padding: 20px;
          border-bottom: 2px solid #e9ecef;
          min-height: 15%;
        }

        .kb-project-selector {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 15px;
        }

        .kb-project-selector label {
          font-weight: 600;
          color: #495057;
        }

        .kb-select {
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
          background: white;
          cursor: pointer;
          min-width: 200px;
        }

        .kb-select-sm {
          padding: 6px 10px;
          font-size: 13px;
          min-width: 120px;
        }

        .kb-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .kb-btn-primary {
          background: #007bff;
          color: white;
        }

        .kb-btn-primary:hover {
          background: #0056b3;
        }

        .kb-btn-secondary {
          background: #6c757d;
          color: white;
        }

        .kb-btn-secondary:hover {
          background: #545b62;
        }

        .kb-btn-icon {
          padding: 6px 10px;
          background: #f8f9fa;
          border: 1px solid #ced4da;
        }

        .kb-btn-icon:hover {
          background: #e9ecef;
        }

        .kb-project-info {
          padding: 12px;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .kb-project-name {
          font-size: 18px;
          font-weight: 600;
          color: #212529;
          margin-bottom: 4px;
        }

        .kb-project-desc {
          font-size: 14px;
          color: #6c757d;
          margin-bottom: 8px;
        }

        .kb-project-stats {
          font-size: 13px;
          color: #868e96;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .kb-separator {
          color: #dee2e6;
        }

        /* Upload Section */
        .kb-upload-section {
          background: white;
          padding: 20px;
          border-bottom: 1px solid #e9ecef;
          min-height: 25%;
        }

        .kb-upload-area {
          border: 2px dashed #ced4da;
          border-radius: 8px;
          padding: 40px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s;
          background: #f8f9fa;
        }

        .kb-upload-area:hover {
          border-color: #007bff;
          background: #e7f3ff;
        }

        .kb-upload-area.dragging {
          border-color: #007bff;
          background: #cfe2ff;
        }

        .kb-upload-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .kb-upload-text {
          font-size: 16px;
          color: #495057;
          margin-bottom: 8px;
        }

        .kb-upload-hint {
          font-size: 13px;
          color: #868e96;
        }

        .kb-upload-progress {
          margin-top: 15px;
        }

        .kb-progress-bar {
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .kb-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #007bff, #0056b3);
          width: 0%;
          transition: width 0.3s;
        }

        .kb-progress-text {
          font-size: 13px;
          color: #6c757d;
          text-align: center;
        }

        /* Controls */
        .kb-controls {
          background: white;
          padding: 15px 20px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }

        .kb-search-box {
          display: flex;
          gap: 8px;
          flex: 1;
          max-width: 400px;
        }

        .kb-search-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
        }

        .kb-filters {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        /* Documents List */
        .kb-documents-section {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #f8f9fa;
        }

        .kb-documents-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .kb-document-card {
          background: white;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
        }

        .kb-document-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          transform: translateY(-2px);
        }

        .kb-document-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }

        .kb-document-icon {
          font-size: 32px;
          flex-shrink: 0;
        }

        .kb-document-info {
          flex: 1;
          min-width: 0;
        }

        .kb-document-name {
          font-weight: 600;
          color: #212529;
          font-size: 14px;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .kb-document-meta {
          font-size: 12px;
          color: #868e96;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .kb-document-actions {
          display: flex;
          gap: 8px;
          margin-top: auto;
          padding-top: 12px;
          border-top: 1px solid #e9ecef;
        }

        .kb-action-btn {
          flex: 1;
          padding: 6px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          background: white;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .kb-action-btn:hover {
          background: #f8f9fa;
          transform: scale(1.1);
        }

        .kb-empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #868e96;
        }

        .kb-empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .kb-empty-text {
          font-size: 16px;
          margin-bottom: 8px;
        }

        .kb-empty-hint {
          font-size: 14px;
          color: #adb5bd;
        }

        /* Modal */
        .kb-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }

        .kb-modal-content {
          background: white;
          border-radius: 8px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }

        .kb-modal-large {
          max-width: 900px;
        }

        .kb-modal-header {
          padding: 20px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .kb-modal-header h3 {
          margin: 0;
          font-size: 18px;
          color: #212529;
        }

        .kb-modal-close {
          background: none;
          border: none;
          font-size: 28px;
          color: #6c757d;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .kb-modal-close:hover {
          color: #212529;
        }

        .kb-modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }

        .kb-modal-footer {
          padding: 20px;
          border-top: 1px solid #e9ecef;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .kb-form-group {
          margin-bottom: 16px;
        }

        .kb-form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #495057;
          font-size: 14px;
        }

        .kb-input,
        .kb-textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
          font-family: inherit;
        }

        .kb-textarea {
          resize: vertical;
        }

        .kb-preview-content {
          max-height: 70vh;
          overflow-y: auto;
        }

        .kb-preview-content pre {
          background: #f8f9fa;
          padding: 16px;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 13px;
          line-height: 1.5;
        }

        .kb-preview-content img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .kb-documents-list {
            grid-template-columns: 1fr;
          }

          .kb-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .kb-search-box {
            max-width: 100%;
          }

          .kb-project-selector {
            flex-wrap: wrap;
          }
        }

        /* Scrollbar styling */
        .kb-documents-section::-webkit-scrollbar,
        .kb-modal-body::-webkit-scrollbar,
        .kb-preview-content::-webkit-scrollbar {
          width: 8px;
        }

        .kb-documents-section::-webkit-scrollbar-track,
        .kb-modal-body::-webkit-scrollbar-track,
        .kb-preview-content::-webkit-scrollbar-track {
          background: #f1f1f1;
        }

        .kb-documents-section::-webkit-scrollbar-thumb,
        .kb-modal-body::-webkit-scrollbar-thumb,
        .kb-preview-content::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 4px;
        }

        .kb-documents-section::-webkit-scrollbar-thumb:hover,
        .kb-modal-body::-webkit-scrollbar-thumb:hover,
        .kb-preview-content::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      </style>
    `;
  }

  attachEvents() {
    // Seleção de projeto
    const projectSelect = document.getElementById('kb-project-select');
    if (projectSelect) {
      projectSelect.addEventListener('change', (e) => {
        const projectId = e.target.value;
        const project = this.projects.find(p => p.id === projectId);
        if (project) {
          this.selectProject(project);
        }
      });
    }

    // Botão novo projeto
    const newProjectBtn = document.getElementById('kb-new-project-btn');
    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', () => {
        this.showProjectModal();
      });
    }

    // Upload area
    const uploadArea = document.getElementById('kb-upload-area');
    const fileInput = document.getElementById('kb-file-input');

    if (uploadArea && fileInput) {
      uploadArea.addEventListener('click', () => {
        fileInput.click();
      });

      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragging');
      });

      uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragging');
      });

      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragging');
        const files = Array.from(e.dataTransfer.files);
        this.handleFiles(files);
      });

      fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        this.handleFiles(files);
      });
    }

    // Search
    const searchInput = document.getElementById('kb-search-input');
    const searchBtn = document.getElementById('kb-search-btn');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.filterDocuments();
        }, 300);
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.filterDocuments();
      });
    }

    // Filters
    const filterType = document.getElementById('kb-filter-type');
    const sortBy = document.getElementById('kb-sort-by');
    const sortOrder = document.getElementById('kb-sort-order');

    if (filterType) {
      filterType.addEventListener('change', (e) => {
        this.filterType = e.target.value;
        this.savePreferences();
        this.filterDocuments();
      });
      filterType.value = this.filterType;
    }

    if (sortBy) {
      sortBy.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.savePreferences();
        this.sortDocuments();
      });
      sortBy.value = this.sortBy;
    }

    if (sortOrder) {
      sortOrder.addEventListener('click', () => {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        sortOrder.textContent = this.sortOrder === 'asc' ? '↑' : '↓';
        this.savePreferences();
        this.sortDocuments();
      });
    }

    // Modal events
    this.attachModalEvents();
  }

  attachModalEvents() {
    // Project modal
    const projectModal = document.getElementById('kb-project-modal');
    const projectSaveBtn = document.getElementById('kb-project-save');
    const projectCancelBtn = document.getElementById('kb-project-cancel');

    if (projectModal) {
      const closeBtn = projectModal.querySelector('.kb-modal-close');

      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this.hideProjectModal();
        });
      }

      if (projectCancelBtn) {
        projectCancelBtn.addEventListener('click', () => {
          this.hideProjectModal();
        });
      }

      if (projectSaveBtn) {
        projectSaveBtn.addEventListener('click', () => {
          this.saveProject();
        });
      }

      projectModal.addEventListener('click', (e) => {
        if (e.target === projectModal) {
          this.hideProjectModal();
        }
      });
    }

    // Preview modal
    const previewModal = document.getElementById('kb-preview-modal');
    if (previewModal) {
      const closeBtn = previewModal.querySelector('.kb-modal-close');

      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this.hidePreviewModal();
        });
      }

      previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) {
          this.hidePreviewModal();
        }
      });
    }
  }

  async handleFiles(files) {
    if (!this.currentProject) {
      alert('Por favor, selecione um projeto primeiro');
      return;
    }

    const validFiles = files.filter(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      return ['pdf', 'doc', 'docx', 'txt', 'md', 'png', 'jpg', 'jpeg'].includes(ext);
    });

    if (validFiles.length === 0) {
      alert('Nenhum arquivo válido selecionado');
      return;
    }

    for (const file of validFiles) {
      await this.uploadToProject(file, this.currentProject.id);
    }

    // Recarregar documentos
    await this.loadDocuments(this.currentProject.id);
  }

  async uploadToProject(file, projectId) {
    const progressDiv = document.getElementById('kb-upload-progress');
    const progressFill = document.getElementById('kb-progress-fill');
    const progressText = document.getElementById('kb-progress-text');

    try {
      progressDiv.style.display = 'block';
      progressText.textContent = `Uploading ${file.name}...`;
      progressFill.style.width = '0%';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('project', projectId);

      const xhr = new XMLHttpRequest();

      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            progressFill.style.width = percent + '%';
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            progressFill.style.width = '100%';
            progressText.textContent = `${file.name} uploaded successfully!`;
            setTimeout(() => {
              progressDiv.style.display = 'none';
            }, 2000);
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });
    } catch (error) {
      console.error('Upload error:', error);
      progressText.textContent = `Error uploading ${file.name}`;
      setTimeout(() => {
        progressDiv.style.display = 'none';
      }, 3000);
      throw error;
    }
  }

  async selectProject(project) {
    this.currentProject = project;
    this.savePreferences();

    // Atualizar UI
    const projectNameEl = this.container.querySelector('.kb-project-name');
    const projectDescEl = this.container.querySelector('.kb-project-desc');

    if (projectNameEl) projectNameEl.textContent = project.name;
    if (projectDescEl) projectDescEl.textContent = project.description || '';

    // Carregar documentos do projeto
    await this.loadDocuments(project.id);
  }

  async createProject(data) {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to create project');

      const result = await response.json();
      const newProject = result.project;

      // Adicionar à lista
      this.projects.push(newProject);

      // Atualizar select
      const projectSelect = document.getElementById('kb-project-select');
      if (projectSelect) {
        const option = document.createElement('option');
        option.value = newProject.id;
        option.textContent = newProject.name;
        projectSelect.appendChild(option);
        projectSelect.value = newProject.id;
      }

      // Selecionar automaticamente
      await this.selectProject(newProject);

      return newProject;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  async deleteDocument(docId) {
    if (!confirm('Tem certeza que deseja remover este documento?')) {
      return;
    }

    try {
      // ✨ CORRIGIDO: Usar endpoint correto /api/kb/documents/:id
      const response = await fetch(`/api/kb/documents/${docId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete document');

      // Remover da lista
      this.documents = this.documents.filter(d => d.id !== docId);
      this.renderDocumentList();
      this.updateProjectStats();

      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Erro ao remover documento');
      return false;
    }
  }

  async searchInDocuments(query, projectId = null) {
    try {
      const url = projectId
        ? `/api/search?q=${encodeURIComponent(query)}&project=${projectId}`
        : `/api/search?q=${encodeURIComponent(query)}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  filterDocuments() {
    const searchInput = document.getElementById('kb-search-input');
    const query = searchInput ? searchInput.value.toLowerCase() : '';

    let filtered = [...this.documents];

    // Filtrar por tipo
    if (this.filterType !== 'all') {
      filtered = filtered.filter(doc => {
        const type = this.getDocumentType(doc.name);
        if (this.filterType === 'img') {
          return ['png', 'jpg', 'jpeg'].includes(type);
        }
        if (this.filterType === 'doc') {
          return ['doc', 'docx'].includes(type);
        }
        return type === this.filterType;
      });
    }

    // Filtrar por busca
    if (query) {
      filtered = filtered.filter(doc => {
        return doc.name.toLowerCase().includes(query) ||
               (doc.content && doc.content.toLowerCase().includes(query));
      });
    }

    this.renderDocumentList(filtered);
  }

  sortDocuments() {
    this.filterDocuments();
  }

  renderDocumentList(documents = null) {
    const listContainer = document.getElementById('kb-documents-list');
    if (!listContainer) return;

    const docs = documents || this.documents;

    // Ordenar
    const sorted = [...docs].sort((a, b) => {
      let valueA, valueB;

      switch (this.sortBy) {
        case 'name':
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
          break;
        case 'size':
          valueA = a.size || 0;
          valueB = b.size || 0;
          break;
        case 'type':
          valueA = this.getDocumentType(a.name);
          valueB = this.getDocumentType(b.name);
          break;
        case 'date':
        default:
          valueA = new Date(a.created || a.uploaded || 0);
          valueB = new Date(b.created || b.uploaded || 0);
          break;
      }

      if (valueA < valueB) return this.sortOrder === 'asc' ? -1 : 1;
      if (valueA > valueB) return this.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    if (sorted.length === 0) {
      listContainer.innerHTML = `
        <div class="kb-empty-state">
          <div class="kb-empty-icon">📭</div>
          <div class="kb-empty-text">Nenhum documento encontrado</div>
          <div class="kb-empty-hint">Arraste arquivos para fazer upload</div>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = sorted.map(doc => this.renderDocumentCard(doc)).join('');

    // Anexar eventos aos cards
    sorted.forEach(doc => {
      const card = listContainer.querySelector(`[data-doc-id="${doc.id}"]`);
      if (!card) return;

      // Preview
      const previewBtn = card.querySelector('.kb-preview-btn');
      if (previewBtn) {
        previewBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showPreview(doc);
        });
      }

      // Download
      const downloadBtn = card.querySelector('.kb-download-btn');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.downloadDocument(doc);
        });
      }

      // Copy
      const copyBtn = card.querySelector('.kb-copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.copyDocumentContent(doc);
        });
      }

      // Delete
      const deleteBtn = card.querySelector('.kb-delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteDocument(doc.id);
        });
      }
    });
  }

  renderDocumentCard(doc) {
    const type = this.getDocumentType(doc.name);
    const icon = this.getFileIcon(type);
    const size = this.formatFileSize(doc.size || 0);
    const date = this.formatDate(doc.created || doc.uploaded);

    return `
      <div class="kb-document-card" data-doc-id="${doc.id}">
        <div class="kb-document-header">
          <div class="kb-document-icon">${icon}</div>
          <div class="kb-document-info">
            <div class="kb-document-name" title="${doc.name}">${doc.name}</div>
            <div class="kb-document-meta">
              <span>${type.toUpperCase()} • ${size}</span>
              <span>${date}</span>
            </div>
          </div>
        </div>
        <div class="kb-document-actions">
          <button class="kb-action-btn kb-preview-btn" title="Visualizar">👁️</button>
          <button class="kb-action-btn kb-download-btn" title="Download">⬇️</button>
          ${['txt', 'md'].includes(type) ? '<button class="kb-action-btn kb-copy-btn" title="Copiar conteúdo">📋</button>' : ''}
          <button class="kb-action-btn kb-delete-btn" title="Remover">🗑️</button>
        </div>
      </div>
    `;
  }

  updateProjectStats() {
    const docCountEl = document.getElementById('kb-doc-count');
    const totalSizeEl = document.getElementById('kb-total-size');

    if (docCountEl) {
      const count = this.documents.length;
      docCountEl.textContent = `${count} documento${count !== 1 ? 's' : ''}`;
    }

    if (totalSizeEl) {
      const totalSize = this.documents.reduce((sum, doc) => sum + (doc.size || 0), 0);
      totalSizeEl.textContent = this.formatFileSize(totalSize);
    }
  }

  showProjectModal(projectData = null) {
    const modal = document.getElementById('kb-project-modal');
    const title = document.getElementById('kb-modal-title');
    const nameInput = document.getElementById('kb-project-name');
    const descInput = document.getElementById('kb-project-description');
    const clientInput = document.getElementById('kb-project-client');

    if (!modal) return;

    if (projectData) {
      title.textContent = 'Editar Projeto';
      nameInput.value = projectData.name || '';
      descInput.value = projectData.description || '';
      clientInput.value = projectData.client || '';
    } else {
      title.textContent = 'Novo Projeto';
      nameInput.value = '';
      descInput.value = '';
      clientInput.value = '';
    }

    modal.style.display = 'flex';
    nameInput.focus();
  }

  hideProjectModal() {
    const modal = document.getElementById('kb-project-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  async saveProject() {
    const nameInput = document.getElementById('kb-project-name');
    const descInput = document.getElementById('kb-project-description');
    const clientInput = document.getElementById('kb-project-client');

    const name = nameInput.value.trim();
    if (!name) {
      alert('Nome do projeto é obrigatório');
      nameInput.focus();
      return;
    }

    const projectData = {
      name,
      description: descInput.value.trim(),
      client: clientInput.value.trim()
    };

    try {
      await this.createProject(projectData);
      this.hideProjectModal();
    } catch (error) {
      alert('Erro ao criar projeto');
    }
  }

  async showPreview(doc) {
    const modal = document.getElementById('kb-preview-modal');
    const title = document.getElementById('kb-preview-title');
    const content = document.getElementById('kb-preview-content');

    if (!modal) return;

    title.textContent = doc.name;

    const type = this.getDocumentType(doc.name);

    if (['png', 'jpg', 'jpeg'].includes(type)) {
      content.innerHTML = `<img src="${doc.url || doc.path}" alt="${doc.name}">`;
    } else if (['txt', 'md'].includes(type)) {
      try {
        const response = await fetch(doc.url || doc.path);
        const text = await response.text();
        content.innerHTML = `<pre>${this.escapeHtml(text)}</pre>`;
      } catch (error) {
        content.innerHTML = '<p>Erro ao carregar conteúdo</p>';
      }
    } else if (type === 'pdf') {
      content.innerHTML = `<iframe src="${doc.url || doc.path}" style="width: 100%; height: 600px; border: none;"></iframe>`;
    } else {
      content.innerHTML = '<p>Preview não disponível para este tipo de arquivo</p>';
    }

    modal.style.display = 'flex';
  }

  hidePreviewModal() {
    const modal = document.getElementById('kb-preview-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  downloadDocument(doc) {
    const a = document.createElement('a');
    a.href = doc.url || doc.path;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async copyDocumentContent(doc) {
    const type = this.getDocumentType(doc.name);
    if (!['txt', 'md'].includes(type)) {
      alert('Copiar conteúdo só está disponível para arquivos de texto');
      return;
    }

    try {
      const response = await fetch(doc.url || doc.path);
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      alert('Conteúdo copiado para a área de transferência!');
    } catch (error) {
      console.error('Error copying content:', error);
      alert('Erro ao copiar conteúdo');
    }
  }

  getDocumentType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return ext;
  }

  getFileIcon(fileType) {
    const icons = {
      'pdf': '📕',
      'doc': '📘',
      'docx': '📘',
      'txt': '📄',
      'md': '📝',
      'png': '🖼️',
      'jpg': '🖼️',
      'jpeg': '🖼️'
    };
    return icons[fileType] || '📄';
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export singleton instance
export const knowledgeBase = new KnowledgeBase();

// Export class for custom instances
export { KnowledgeBase };
