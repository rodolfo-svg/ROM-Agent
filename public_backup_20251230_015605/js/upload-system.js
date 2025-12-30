class UploadSystem {
  constructor(containerSelector = '#upload-container') {
    this.container = document.querySelector(containerSelector);
    this.uploadEndpoint = '/api/upload';
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    this.allowedTypes = {
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'text/plain': '.txt',
      'image/png': '.png',
      'image/jpeg': '.jpg'
    };
    this.uploadedFiles = [];
    this.init();
  }

  init() {
    this.render();
    this.attachEventListeners();
  }

  render() {
    this.container.innerHTML = `
      <div class="upload-system">
        <div class="upload-area">
          <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <p class="upload-text">Arraste arquivos ou clique para selecionar</p>
          <input type="file" id="file-input" multiple hidden accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg">
        </div>

        <div class="files-container">
          <div id="files-list" class="files-list"></div>
        </div>
      </div>
    `;

    this.addStyles();
  }

  addStyles() {
    const styleId = 'upload-system-styles';
    if (document.getElementById(styleId)) return;

    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
      .upload-system {
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-width: 600px;
        margin: 0 auto;
      }

      .upload-area {
        border: 2px dashed #cbd5e0;
        border-radius: 8px;
        padding: 40px 20px;
        text-align: center;
        cursor: pointer;
        transition: all 0.3s ease;
        background-color: #f7fafc;
      }

      .upload-area:hover {
        border-color: #4299e1;
        background-color: #ebf8ff;
      }

      .upload-area.drag-over {
        border-color: #3182ce;
        background-color: #bee3f8;
        box-shadow: 0 0 10px rgba(49, 130, 206, 0.1);
      }

      .upload-icon {
        width: 48px;
        height: 48px;
        color: #4299e1;
        margin-bottom: 12px;
      }

      .upload-text {
        margin: 0;
        color: #4a5568;
        font-size: 14px;
        font-weight: 500;
      }

      .files-container {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .files-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .file-item {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: #f7fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        transition: all 0.3s ease;
      }

      .file-item:hover {
        background: #edf2f7;
        border-color: #cbd5e0;
      }

      .file-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .file-info {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
      }

      .file-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      .file-details {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        min-width: 0;
      }

      .file-name {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #2d3748;
        word-break: break-word;
      }

      .file-size {
        margin: 0;
        font-size: 12px;
        color: #718096;
      }

      .file-status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
      }

      .status-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 600;
      }

      .status-pending {
        background: #fef3c7;
        color: #b45309;
      }

      .status-uploading {
        background: #dbeafe;
        color: #1e40af;
      }

      .status-success {
        background: #dcfce7;
        color: #166534;
      }

      .status-error {
        background: #fee2e2;
        color: #991b1b;
      }

      .progress-container {
        width: 100%;
      }

      .progress-bar {
        width: 100%;
        height: 4px;
        background: #e2e8f0;
        border-radius: 2px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #4299e1, #3182ce);
        transition: width 0.3s ease;
      }

      .progress-text {
        font-size: 11px;
        color: #718096;
        margin-top: 4px;
      }

      .remove-btn {
        padding: 4px 8px;
        background: #fed7d7;
        color: #c53030;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        transition: all 0.3s ease;
        flex-shrink: 0;
      }

      .remove-btn:hover {
        background: #fc8181;
        color: white;
      }

      .remove-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .preview-container {
        margin-top: 8px;
      }

      .preview-image {
        max-width: 100%;
        max-height: 200px;
        border-radius: 4px;
        object-fit: cover;
      }

      .preview-doc {
        padding: 12px;
        background: white;
        border: 1px solid #cbd5e0;
        border-radius: 4px;
        font-size: 12px;
        color: #718096;
        max-height: 150px;
        overflow: auto;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid #cbd5e0;
        border-top-color: #4299e1;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        flex-shrink: 0;
      }
    `;

    document.head.appendChild(styles);
  }

  attachEventListeners() {
    const uploadArea = this.container.querySelector('.upload-area');
    const fileInput = this.container.querySelector('#file-input');

    // Click to select
    uploadArea.addEventListener('click', () => fileInput.click());

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      this.handleFiles(e.dataTransfer.files);
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
    });
  }

  handleFiles(files) {
    for (const file of files) {
      if (this.validateFile(file)) {
        this.addFileToList(file);
        this.uploadFile(file);
      }
    }
  }

  validateFile(file) {
    // Check type
    if (!this.allowedTypes[file.type]) {
      this.showError(`Tipo de arquivo não permitido: ${file.name}`);
      return false;
    }

    // Check size
    if (file.size > this.maxFileSize) {
      this.showError(`Arquivo muito grande: ${file.name} (máx 50MB)`);
      return false;
    }

    return true;
  }

  addFileToList(file) {
    const fileId = `file-${Date.now()}-${Math.random()}`;
    const fileItem = {
      id: fileId,
      file: file,
      progress: 0,
      status: 'pending',
      uploadedUrl: null
    };

    this.uploadedFiles.push(fileItem);
    this.renderFileItem(fileItem);
  }

  renderFileItem(fileItem) {
    const filesList = this.container.querySelector('#files-list');
    let itemElement = document.getElementById(fileItem.id);

    if (!itemElement) {
      itemElement = document.createElement('div');
      itemElement.id = fileItem.id;
      filesList.appendChild(itemElement);
    }

    const fileIcon = this.getFileIcon(fileItem.file.type);
    const fileSize = this.formatFileSize(fileItem.file.size);
    const statusClass = `status-${fileItem.status}`;

    let previewHTML = '';
    if (fileItem.file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = itemElement.querySelector('.preview-image');
        if (preview) {
          preview.src = e.target.result;
        }
      };
      reader.readAsDataURL(fileItem.file);
      previewHTML = '<img class="preview-image" style="display:none" alt="preview">';
    }

    itemElement.innerHTML = `
      <div class="file-item">
        <div class="file-header">
          <div class="file-info">
            ${fileIcon}
            <div class="file-details">
              <p class="file-name">${this.escapeHtml(fileItem.file.name)}</p>
              <p class="file-size">${fileSize}</p>
            </div>
          </div>
          <button class="remove-btn" data-file-id="${fileItem.id}" ${fileItem.status === 'uploading' ? 'disabled' : ''}>×</button>
        </div>

        <div class="file-status">
          ${fileItem.status === 'uploading' ? '<div class="spinner"></div>' : ''}
          <span class="status-badge ${statusClass}">${this.getStatusText(fileItem.status)}</span>
          ${fileItem.status === 'uploading' ? `<span>${fileItem.progress}%</span>` : ''}
        </div>

        ${fileItem.status === 'uploading' ? `
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${fileItem.progress}%"></div>
            </div>
            <p class="progress-text">${fileItem.progress}% enviado</p>
          </div>
        ` : ''}

        <div class="preview-container">
          ${previewHTML}
        </div>
      </div>
    `;

    // Attach remove button listener
    const removeBtn = itemElement.querySelector('.remove-btn');
    removeBtn.addEventListener('click', () => this.removeFile(fileItem.id));
  }

  uploadFile(file) {
    const fileItem = this.uploadedFiles.find(f => f.file === file);
    if (!fileItem) return;

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    // Progress event
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100);
        fileItem.progress = progress;
        fileItem.status = 'uploading';
        this.renderFileItem(fileItem);
      }
    });

    // Complete event
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          fileItem.status = 'success';
          fileItem.uploadedUrl = response.url || response.path;
          fileItem.progress = 100;
        } catch (e) {
          fileItem.status = 'error';
          console.error('Erro ao fazer parse da resposta:', e);
        }
      } else {
        fileItem.status = 'error';
      }
      this.renderFileItem(fileItem);
    });

    // Error event
    xhr.addEventListener('error', () => {
      fileItem.status = 'error';
      this.renderFileItem(fileItem);
    });

    // Abort event
    xhr.addEventListener('abort', () => {
      fileItem.status = 'pending';
      this.renderFileItem(fileItem);
    });

    fileItem.xhr = xhr;
    xhr.open('POST', this.uploadEndpoint);
    xhr.send(formData);
  }

  removeFile(fileId) {
    const index = this.uploadedFiles.findIndex(f => f.id === fileId);
    if (index !== -1) {
      const fileItem = this.uploadedFiles[index];

      // Abort ongoing upload
      if (fileItem.xhr) {
        fileItem.xhr.abort();
      }

      // Remove from array
      this.uploadedFiles.splice(index, 1);

      // Remove from DOM
      const element = document.getElementById(fileId);
      if (element) {
        element.remove();
      }
    }
  }

  getFileIcon(mimeType) {
    let iconSVG = '';

    if (mimeType === 'application/pdf') {
      iconSVG = '<svg class="file-icon" viewBox="0 0 24 24" fill="#dc2626"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="8" font-weight="bold">PDF</text></svg>';
    } else if (mimeType.includes('document') || mimeType.includes('word')) {
      iconSVG = '<svg class="file-icon" viewBox="0 0 24 24" fill="#2563eb"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M8 16h8M8 12h8M8 8h4" stroke="white" stroke-width="1" fill="none"/></svg>';
    } else if (mimeType === 'text/plain') {
      iconSVG = '<svg class="file-icon" viewBox="0 0 24 24" fill="#6366f1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="8" y1="8" x2="16" y2="8" stroke="white" stroke-width="1"/><line x1="8" y1="12" x2="16" y2="12" stroke="white" stroke-width="1"/><line x1="8" y1="16" x2="14" y2="16" stroke="white" stroke-width="1"/></svg>';
    } else if (mimeType.startsWith('image/')) {
      iconSVG = '<svg class="file-icon" viewBox="0 0 24 24" fill="#f59e0b"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5" fill="white"/><path d="M3 16l5-5 4 4 8-8" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
    } else {
      iconSVG = '<svg class="file-icon" viewBox="0 0 24 24" fill="#9ca3af"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>';
    }

    return iconSVG;
  }

  getStatusText(status) {
    const statusMap = {
      'pending': 'Aguardando',
      'uploading': 'Enviando',
      'success': 'Enviado',
      'error': 'Erro'
    };
    return statusMap[status] || status;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showError(message) {
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
      padding: 12px;
      margin-bottom: 12px;
      background: #fee2e2;
      color: #991b1b;
      border-radius: 6px;
      border-left: 4px solid #dc2626;
      font-size: 14px;
    `;
    alertDiv.textContent = message;
    this.container.insertBefore(alertDiv, this.container.firstChild);

    setTimeout(() => alertDiv.remove(), 5000);
  }

  getUploadedFiles() {
    return this.uploadedFiles.filter(f => f.status === 'success');
  }

  clearSuccessfulUploads() {
    this.uploadedFiles = this.uploadedFiles.filter(f => f.status !== 'success');
    this.render();
    this.attachEventListeners();
  }

  reset() {
    this.uploadedFiles = [];
    this.render();
    this.attachEventListeners();
  }
}

// Auto-initialize if container exists
document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('#upload-container');
  if (container && !window.uploadSystem) {
    window.uploadSystem = new UploadSystem('#upload-container');
  }
});
