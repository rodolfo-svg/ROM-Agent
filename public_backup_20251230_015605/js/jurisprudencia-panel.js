/**
 * Painel de Jurisprudência - Interface completa para busca e visualização
 * @module JurisprudenciaPanel
 */

class JurisprudenciaPanel {
  constructor() {
    this.container = null;
    this.searchHistory = [];
    this.currentResults = null;
    this.tribunals = [];
    this.currentPage = 1;
    this.resultsPerPage = 10;

    // Cores dos badges por tribunal
    this.tribunalColors = {
      'STF': '#003366',
      'STJ': '#006633',
      'TRF1': '#0066CC',
      'TRF2': '#0066CC',
      'TRF3': '#0066CC',
      'TRF4': '#0066CC',
      'TRF5': '#0066CC',
      'TRF6': '#0066CC',
      'TST': '#990000',
      'TSE': '#663399',
      'STM': '#336699',
      'default': '#CC6600'
    };
  }

  /**
   * Inicializa o painel
   * @param {string} containerId - ID do container onde o painel será renderizado
   */
  async init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container ${containerId} não encontrado`);
      return;
    }

    await this.loadTribunals();
    this.render();
    this.attachEvents();
    this.loadSearchHistory();
  }

  /**
   * Carrega lista de tribunais da API
   */
  async loadTribunals() {
    try {
      const response = await fetch('/api/jurisprudencia/tribunais');
      if (!response.ok) {
        throw new Error('Erro ao carregar tribunais');
      }
      const data = await response.json();
      this.tribunals = data.tribunais || [];
    } catch (error) {
      console.error('Erro ao carregar tribunais:', error);
      // Fallback com tribunais principais
      this.tribunals = [
        { codigo: 'STF', nome: 'Supremo Tribunal Federal', tipo: 'Superior' },
        { codigo: 'STJ', nome: 'Superior Tribunal de Justiça', tipo: 'Superior' },
        { codigo: 'TST', nome: 'Tribunal Superior do Trabalho', tipo: 'Superior' },
        { codigo: 'TSE', nome: 'Tribunal Superior Eleitoral', tipo: 'Superior' },
        { codigo: 'STM', nome: 'Superior Tribunal Militar', tipo: 'Superior' },
        { codigo: 'TRF1', nome: 'Tribunal Regional Federal da 1ª Região', tipo: 'Regional' },
        { codigo: 'TRF2', nome: 'Tribunal Regional Federal da 2ª Região', tipo: 'Regional' },
        { codigo: 'TRF3', nome: 'Tribunal Regional Federal da 3ª Região', tipo: 'Regional' },
        { codigo: 'TRF4', nome: 'Tribunal Regional Federal da 4ª Região', tipo: 'Regional' },
        { codigo: 'TRF5', nome: 'Tribunal Regional Federal da 5ª Região', tipo: 'Regional' },
        { codigo: 'TRF6', nome: 'Tribunal Regional Federal da 6ª Região', tipo: 'Regional' }
      ];
    }
  }

  /**
   * Renderiza a interface do painel
   */
  render() {
    const html = `
      <div class="jurisprudencia-panel">
        <div class="panel-header">
          <h2>Busca de Jurisprudência</h2>
          <p class="subtitle">Consulte decisões de diversos tribunais brasileiros</p>
        </div>

        <div class="panel-body">
          <!-- Coluna de Busca -->
          <div class="search-column">
            <div class="search-card">
              <h3>Busca por Palavra-chave</h3>

              <div class="form-group">
                <label for="search-term">Termo de busca</label>
                <input
                  type="text"
                  id="search-term"
                  class="form-control"
                  placeholder="Ex: dano moral, usucapião..."
                />
              </div>

              <div class="form-group">
                <label for="tribunal-select">Tribunal</label>
                <select id="tribunal-select" class="form-control">
                  <option value="">Todos os tribunais</option>
                  ${this.renderTribunalOptions()}
                </select>
              </div>

              <div class="form-group">
                <label>Fontes de dados</label>
                <div class="checkbox-group">
                  <label class="checkbox-label">
                    <input type="checkbox" id="fonte-datajud" value="datajud" checked />
                    <span>DataJud</span>
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" id="fonte-jusbrasil" value="jusbrasil" checked />
                    <span>JusBrasil</span>
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" id="fonte-websearch" value="websearch" checked />
                    <span>Web Search</span>
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" id="fonte-todas" value="todas" />
                    <span>Todas</span>
                  </label>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="data-inicio">Data início</label>
                  <input type="date" id="data-inicio" class="form-control" />
                </div>
                <div class="form-group">
                  <label for="data-fim">Data fim</label>
                  <input type="date" id="data-fim" class="form-control" />
                </div>
              </div>

              <div class="button-group">
                <button id="btn-search" class="btn btn-primary">
                  <span class="btn-text">Buscar</span>
                  <span class="spinner" style="display: none;"></span>
                </button>
                <button id="btn-clear" class="btn btn-secondary">Limpar</button>
              </div>
            </div>

            <div class="search-card">
              <h3>Busca por Número de Processo</h3>

              <div class="form-group">
                <label for="processo-numero">Número CNJ</label>
                <input
                  type="text"
                  id="processo-numero"
                  class="form-control"
                  placeholder="0000000-00.0000.0.00.0000"
                  maxlength="25"
                />
                <small class="form-hint">Formato: NNNNNNN-DD.AAAA.J.TR.OOOO</small>
                <div id="processo-validation" class="validation-message"></div>
              </div>

              <div id="processo-details" class="processo-details" style="display: none;">
                <h4>Componentes do Processo</h4>
                <ul id="processo-components"></ul>
              </div>

              <button id="btn-consultar-processo" class="btn btn-primary" disabled>
                <span class="btn-text">Consultar Processo</span>
                <span class="spinner" style="display: none;"></span>
              </button>
            </div>

            <div class="search-card">
              <h3>Histórico de Buscas</h3>
              <div id="search-history" class="search-history">
                <p class="empty-state">Nenhuma busca realizada ainda</p>
              </div>
            </div>
          </div>

          <!-- Coluna de Resultados -->
          <div class="results-column">
            <div id="results-container" class="results-container">
              <div class="empty-state-large">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <h3>Nenhuma busca realizada</h3>
                <p>Preencha os campos ao lado e clique em "Buscar" para encontrar jurisprudências</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.addStyles();
  }

  /**
   * Renderiza as opções de tribunais agrupadas por tipo
   */
  renderTribunalOptions() {
    const grouped = this.tribunals.reduce((acc, tribunal) => {
      const tipo = tribunal.tipo || 'Outros';
      if (!acc[tipo]) acc[tipo] = [];
      acc[tipo].push(tribunal);
      return acc;
    }, {});

    let html = '';
    const order = ['Superior', 'Regional', 'Estadual', 'Outros'];

    order.forEach(tipo => {
      if (grouped[tipo]) {
        html += `<optgroup label="${tipo === 'Superior' ? 'Tribunais Superiores' :
                                     tipo === 'Regional' ? 'Tribunais Regionais' :
                                     tipo === 'Estadual' ? 'Tribunais Estaduais' : tipo}">`;
        grouped[tipo].forEach(tribunal => {
          html += `<option value="${tribunal.codigo}">${tribunal.codigo} - ${tribunal.nome}</option>`;
        });
        html += '</optgroup>';
      }
    });

    return html;
  }

  /**
   * Anexa event listeners
   */
  attachEvents() {
    // Botão de busca
    const btnSearch = document.getElementById('btn-search');
    btnSearch.addEventListener('click', () => this.handleSearch());

    // Botão limpar
    const btnClear = document.getElementById('btn-clear');
    btnClear.addEventListener('click', () => this.handleClear());

    // Enter no campo de busca
    const searchTerm = document.getElementById('search-term');
    searchTerm.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleSearch();
    });

    // Validação de número de processo
    const processoNumero = document.getElementById('processo-numero');
    processoNumero.addEventListener('input', (e) => this.handleProcessoInput(e));
    processoNumero.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !document.getElementById('btn-consultar-processo').disabled) {
        this.handleConsultarProcesso();
      }
    });

    // Botão consultar processo
    const btnConsultarProcesso = document.getElementById('btn-consultar-processo');
    btnConsultarProcesso.addEventListener('click', () => this.handleConsultarProcesso());

    // Checkbox "Todas as fontes"
    const fonteTodas = document.getElementById('fonte-todas');
    fonteTodas.addEventListener('change', (e) => {
      const checkboxes = ['fonte-datajud', 'fonte-jusbrasil', 'fonte-websearch'];
      checkboxes.forEach(id => {
        document.getElementById(id).checked = e.target.checked;
      });
    });

    // Outros checkboxes
    ['fonte-datajud', 'fonte-jusbrasil', 'fonte-websearch'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        const allChecked = ['fonte-datajud', 'fonte-jusbrasil', 'fonte-websearch']
          .every(checkId => document.getElementById(checkId).checked);
        document.getElementById('fonte-todas').checked = allChecked;
      });
    });
  }

  /**
   * Manipula input do número de processo
   */
  handleProcessoInput(e) {
    const input = e.target;
    let value = input.value.replace(/[^\d]/g, '');

    // Formata o número: NNNNNNN-DD.AAAA.J.TR.OOOO
    if (value.length > 0) {
      let formatted = value.substring(0, 7);
      if (value.length > 7) formatted += '-' + value.substring(7, 9);
      if (value.length > 9) formatted += '.' + value.substring(9, 13);
      if (value.length > 13) formatted += '.' + value.substring(13, 14);
      if (value.length > 14) formatted += '.' + value.substring(14, 16);
      if (value.length > 16) formatted += '.' + value.substring(16, 20);

      input.value = formatted;
    }

    this.validateProcessNumber(input.value);
  }

  /**
   * Valida número de processo CNJ
   * @param {string} numero - Número do processo
   * @returns {Object|null} Objeto com componentes do processo ou null se inválido
   */
  validateProcessNumber(numero) {
    const validationDiv = document.getElementById('processo-validation');
    const detailsDiv = document.getElementById('processo-details');
    const componentsUl = document.getElementById('processo-components');
    const btnConsultar = document.getElementById('btn-consultar-processo');

    // Remove formatação para validar
    const cleanNumero = numero.replace(/[^\d]/g, '');

    if (cleanNumero.length === 0) {
      validationDiv.innerHTML = '';
      validationDiv.className = 'validation-message';
      detailsDiv.style.display = 'none';
      btnConsultar.disabled = true;
      return null;
    }

    if (cleanNumero.length !== 20) {
      validationDiv.innerHTML = '<span class="error">Número incompleto (deve ter 20 dígitos)</span>';
      validationDiv.className = 'validation-message error';
      detailsDiv.style.display = 'none';
      btnConsultar.disabled = true;
      return null;
    }

    // Valida dígito verificador
    const digits = cleanNumero.substring(0, 7) + cleanNumero.substring(9);
    const dv = parseInt(cleanNumero.substring(7, 9));
    const remainder = parseInt(digits) % 97;
    const calculatedDV = 98 - remainder;

    if (dv !== calculatedDV) {
      validationDiv.innerHTML = '<span class="error">Dígito verificador inválido</span>';
      validationDiv.className = 'validation-message error';
      detailsDiv.style.display = 'none';
      btnConsultar.disabled = true;
      return null;
    }

    // Extrai componentes
    const components = {
      sequencial: cleanNumero.substring(0, 7),
      dv: cleanNumero.substring(7, 9),
      ano: cleanNumero.substring(9, 13),
      segmento: cleanNumero.substring(13, 14),
      tribunal: cleanNumero.substring(14, 16),
      origem: cleanNumero.substring(16, 20)
    };

    const segmentos = {
      '1': 'Supremo Tribunal Federal',
      '2': 'Conselho Nacional de Justiça',
      '3': 'Superior Tribunal de Justiça',
      '4': 'Justiça Federal',
      '5': 'Justiça do Trabalho',
      '6': 'Justiça Eleitoral',
      '7': 'Justiça Militar da União',
      '8': 'Justiça Estadual',
      '9': 'Justiça Militar Estadual'
    };

    validationDiv.innerHTML = '<span class="success">Número válido!</span>';
    validationDiv.className = 'validation-message success';

    componentsUl.innerHTML = `
      <li><strong>Sequencial:</strong> ${components.sequencial}</li>
      <li><strong>Dígito Verificador:</strong> ${components.dv}</li>
      <li><strong>Ano:</strong> ${components.ano}</li>
      <li><strong>Segmento:</strong> ${segmentos[components.segmento] || 'Desconhecido'}</li>
      <li><strong>Tribunal:</strong> ${components.tribunal}</li>
      <li><strong>Origem:</strong> ${components.origem}</li>
    `;

    detailsDiv.style.display = 'block';
    btnConsultar.disabled = false;

    return components;
  }

  /**
   * Manipula busca por palavra-chave
   */
  async handleSearch() {
    const searchTerm = document.getElementById('search-term').value.trim();

    if (!searchTerm) {
      this.showError('Por favor, informe um termo de busca');
      return;
    }

    const params = {
      termo: searchTerm,
      tribunal: document.getElementById('tribunal-select').value,
      fontes: this.getSelectedFontes(),
      dataInicio: document.getElementById('data-inicio').value,
      dataFim: document.getElementById('data-fim').value
    };

    await this.search(params);
  }

  /**
   * Manipula consulta de processo específico
   */
  async handleConsultarProcesso() {
    const numero = document.getElementById('processo-numero').value;
    const cleanNumero = numero.replace(/[^\d]/g, '');

    if (cleanNumero.length !== 20) {
      this.showError('Número de processo inválido');
      return;
    }

    await this.consultarProcesso(cleanNumero);
  }

  /**
   * Limpa o formulário
   */
  handleClear() {
    document.getElementById('search-term').value = '';
    document.getElementById('tribunal-select').value = '';
    document.getElementById('data-inicio').value = '';
    document.getElementById('data-fim').value = '';

    ['fonte-datajud', 'fonte-jusbrasil', 'fonte-websearch'].forEach(id => {
      document.getElementById(id).checked = true;
    });
    document.getElementById('fonte-todas').checked = false;
  }

  /**
   * Obtém fontes selecionadas
   */
  getSelectedFontes() {
    const fontes = [];
    if (document.getElementById('fonte-datajud').checked) fontes.push('datajud');
    if (document.getElementById('fonte-jusbrasil').checked) fontes.push('jusbrasil');
    if (document.getElementById('fonte-websearch').checked) fontes.push('websearch');
    return fontes;
  }

  /**
   * Realiza busca na API
   */
  async search(params) {
    const btnSearch = document.getElementById('btn-search');
    const btnText = btnSearch.querySelector('.btn-text');
    const spinner = btnSearch.querySelector('.spinner');

    try {
      // Mostra loading
      btnSearch.disabled = true;
      btnText.textContent = 'Buscando...';
      spinner.style.display = 'inline-block';
      this.showLoading();

      // Monta query string
      const queryParams = new URLSearchParams();
      queryParams.append('termo', params.termo);
      if (params.tribunal) queryParams.append('tribunal', params.tribunal);
      if (params.fontes.length > 0) queryParams.append('fontes', params.fontes.join(','));
      if (params.dataInicio) queryParams.append('dataInicio', params.dataInicio);
      if (params.dataFim) queryParams.append('dataFim', params.dataFim);

      const response = await fetch(`/api/jurisprudencia/buscar?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error('Erro na busca');
      }

      const data = await response.json();
      this.currentResults = data;
      this.currentPage = 1;

      this.renderResults(data);
      this.saveSearchHistory({
        termo: params.termo,
        tribunal: params.tribunal,
        timestamp: new Date().toISOString(),
        resultados: data.total || 0
      });

    } catch (error) {
      console.error('Erro na busca:', error);
      this.showError('Erro ao realizar busca. Tente novamente.');
    } finally {
      btnSearch.disabled = false;
      btnText.textContent = 'Buscar';
      spinner.style.display = 'none';
    }
  }

  /**
   * Consulta processo específico
   */
  async consultarProcesso(numero) {
    const btnConsultar = document.getElementById('btn-consultar-processo');
    const btnText = btnConsultar.querySelector('.btn-text');
    const spinner = btnConsultar.querySelector('.spinner');

    try {
      btnConsultar.disabled = true;
      btnText.textContent = 'Consultando...';
      spinner.style.display = 'inline-block';
      this.showLoading();

      const response = await fetch(`/api/jurisprudencia/processo/${numero}`);

      if (!response.ok) {
        throw new Error('Erro na consulta');
      }

      const data = await response.json();
      this.currentResults = { processo: data };
      this.renderProcessoResult(data);

    } catch (error) {
      console.error('Erro na consulta:', error);
      this.showError('Erro ao consultar processo. Tente novamente.');
    } finally {
      btnConsultar.disabled = false;
      btnText.textContent = 'Consultar Processo';
      spinner.style.display = 'none';
    }
  }

  /**
   * Mostra loading
   */
  showLoading() {
    const container = document.getElementById('results-container');
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner-large"></div>
        <p>Buscando jurisprudências...</p>
      </div>
    `;
  }

  /**
   * Mostra erro
   */
  showError(message) {
    const container = document.getElementById('results-container');
    container.innerHTML = `
      <div class="error-state">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3>Erro</h3>
        <p>${message}</p>
      </div>
    `;
  }

  /**
   * Renderiza resultados de busca
   */
  renderResults(data) {
    const container = document.getElementById('results-container');

    if (!data.resultados || data.resultados.length === 0) {
      container.innerHTML = `
        <div class="empty-state-large">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <h3>Nenhum resultado encontrado</h3>
          <p>Tente ajustar os filtros ou usar outros termos de busca</p>
        </div>
      `;
      return;
    }

    // Agrupa por fonte
    const grouped = data.resultados.reduce((acc, item) => {
      const fonte = item.fonte || 'Outros';
      if (!acc[fonte]) acc[fonte] = [];
      acc[fonte].push(item);
      return acc;
    }, {});

    let html = `
      <div class="results-header">
        <h3>Resultados da busca</h3>
        <span class="results-count">${data.total || data.resultados.length} resultado(s) encontrado(s)</span>
      </div>
    `;

    Object.keys(grouped).forEach(fonte => {
      html += `
        <div class="source-group">
          <h4 class="source-title">${this.formatFonteName(fonte)} (${grouped[fonte].length})</h4>
          <div class="results-list">
            ${grouped[fonte].map((item, index) => this.renderResultCard(item, index)).join('')}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    this.attachResultEvents();
  }

  /**
   * Renderiza resultado de processo específico
   */
  renderProcessoResult(data) {
    const container = document.getElementById('results-container');

    let html = `
      <div class="results-header">
        <h3>Dados do Processo</h3>
      </div>
      <div class="processo-result">
        <div class="result-card">
          <div class="result-header">
            ${this.renderTribunalBadge(data.tribunal)}
            <span class="result-date">${this.formatDate(data.dataAjuizamento)}</span>
          </div>
          <div class="result-body">
            <h4>Processo: ${data.numero}</h4>
            ${data.classe ? `<p><strong>Classe:</strong> ${data.classe}</p>` : ''}
            ${data.assunto ? `<p><strong>Assunto:</strong> ${data.assunto}</p>` : ''}
            ${data.partes ? `<p><strong>Partes:</strong> ${data.partes}</p>` : ''}
            ${data.status ? `<p><strong>Status:</strong> ${data.status}</p>` : ''}
            ${data.movimentacoes ? `
              <div class="movimentacoes">
                <h5>Últimas Movimentações:</h5>
                <ul>
                  ${data.movimentacoes.slice(0, 5).map(mov => `
                    <li>
                      <strong>${this.formatDate(mov.data)}:</strong> ${mov.descricao}
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
          <div class="result-footer">
            <button class="btn-copy" data-text="${JSON.stringify(data).replace(/"/g, '&quot;')}">
              Copiar
            </button>
            ${data.link ? `<a href="${data.link}" target="_blank" class="btn-link">Ver original</a>` : ''}
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.attachResultEvents();
  }

  /**
   * Renderiza card de resultado
   */
  renderResultCard(item, index) {
    return `
      <div class="result-card" data-index="${index}">
        <div class="result-header">
          ${this.renderTribunalBadge(item.tribunal)}
          <span class="result-date">${this.formatDate(item.data)}</span>
        </div>
        <div class="result-body">
          ${item.titulo ? `<h4>${item.titulo}</h4>` : ''}
          <p class="result-ementa">${this.truncateText(item.ementa || item.descricao || item.texto, 300)}</p>
          ${item.numero ? `<p class="result-numero"><strong>Processo:</strong> ${item.numero}</p>` : ''}
        </div>
        <div class="result-footer">
          <button class="btn-copy" data-text="${this.escapeHtml(item.ementa || item.descricao || item.texto)}">
            Copiar
          </button>
          ${item.link ? `<a href="${item.link}" target="_blank" class="btn-link">Ver original</a>` : ''}
          <button class="btn-expand" data-index="${index}">Ver mais</button>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza badge de tribunal
   */
  renderTribunalBadge(tribunal) {
    if (!tribunal) return '';

    const codigo = tribunal.toUpperCase();
    const color = this.tribunalColors[codigo] || this.tribunalColors.default;

    return `<span class="tribunal-badge" style="background-color: ${color}">${codigo}</span>`;
  }

  /**
   * Formata nome da fonte
   */
  formatFonteName(fonte) {
    const names = {
      'datajud': 'DataJud',
      'jusbrasil': 'JusBrasil',
      'websearch': 'Web Search',
      'api': 'API',
      'scraping': 'Web Scraping'
    };
    return names[fonte.toLowerCase()] || fonte;
  }

  /**
   * Formata data
   */
  formatDate(dateString) {
    if (!dateString) return '';

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR');
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Trunca texto
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Escapa HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Anexa eventos aos resultados
   */
  attachResultEvents() {
    // Botões de copiar
    document.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const text = e.target.getAttribute('data-text');
        this.copyToClipboard(text, e.target);
      });
    });

    // Botões de expandir
    document.querySelectorAll('.btn-expand').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = e.target.getAttribute('data-index');
        this.expandResult(index);
      });
    });
  }

  /**
   * Expande resultado completo
   */
  expandResult(index) {
    if (!this.currentResults || !this.currentResults.resultados) return;

    const item = this.currentResults.resultados[index];
    if (!item) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Detalhes do Resultado</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          ${this.renderTribunalBadge(item.tribunal)}
          ${item.titulo ? `<h4>${item.titulo}</h4>` : ''}
          ${item.numero ? `<p><strong>Processo:</strong> ${item.numero}</p>` : ''}
          ${item.data ? `<p><strong>Data:</strong> ${this.formatDate(item.data)}</p>` : ''}
          <div class="ementa-completa">
            <h5>Ementa/Conteúdo:</h5>
            <p>${item.ementa || item.descricao || item.texto}</p>
          </div>
          ${item.link ? `<p><strong>Link:</strong> <a href="${item.link}" target="_blank">${item.link}</a></p>` : ''}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-close">Fechar</button>
          <button class="btn btn-primary" onclick="jurisprudenciaPanel.copyToClipboard('${this.escapeHtml(item.ementa || item.descricao || item.texto)}', this)">
            Copiar Texto
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners para fechar
    modal.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        document.body.removeChild(modal);
      });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  /**
   * Copia texto para clipboard
   */
  copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
      const originalText = button.textContent;
      button.textContent = 'Copiado!';
      button.classList.add('copied');

      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
      }, 2000);
    }).catch(err => {
      console.error('Erro ao copiar:', err);
      alert('Erro ao copiar texto');
    });
  }

  /**
   * Salva busca no histórico
   */
  saveSearchHistory(search) {
    this.searchHistory.unshift(search);
    this.searchHistory = this.searchHistory.slice(0, 10); // Mantém apenas as 10 últimas

    try {
      localStorage.setItem('jurisprudencia-history', JSON.stringify(this.searchHistory));
      this.renderSearchHistory();
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }
  }

  /**
   * Carrega histórico do localStorage
   */
  loadSearchHistory() {
    try {
      const stored = localStorage.getItem('jurisprudencia-history');
      if (stored) {
        this.searchHistory = JSON.parse(stored);
        this.renderSearchHistory();
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  }

  /**
   * Renderiza histórico de buscas
   */
  renderSearchHistory() {
    const container = document.getElementById('search-history');

    if (this.searchHistory.length === 0) {
      container.innerHTML = '<p class="empty-state">Nenhuma busca realizada ainda</p>';
      return;
    }

    const html = this.searchHistory.map(item => `
      <div class="history-item" data-termo="${item.termo}" data-tribunal="${item.tribunal || ''}">
        <div class="history-content">
          <strong>${item.termo}</strong>
          ${item.tribunal ? `<span class="history-tribunal">${item.tribunal}</span>` : ''}
          <span class="history-count">${item.resultados} resultado(s)</span>
        </div>
        <div class="history-meta">
          <small>${this.formatRelativeTime(item.timestamp)}</small>
        </div>
      </div>
    `).join('');

    container.innerHTML = html;

    // Event listeners para re-executar buscas
    container.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        const termo = item.getAttribute('data-termo');
        const tribunal = item.getAttribute('data-tribunal');

        document.getElementById('search-term').value = termo;
        document.getElementById('tribunal-select').value = tribunal;
        this.handleSearch();
      });
    });
  }

  /**
   * Formata timestamp relativo
   */
  formatRelativeTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;

    return date.toLocaleDateString('pt-BR');
  }

  /**
   * Adiciona estilos CSS
   */
  addStyles() {
    if (document.getElementById('jurisprudencia-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'jurisprudencia-panel-styles';
    style.textContent = `
      .jurisprudencia-panel {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        max-width: 1600px;
        margin: 0 auto;
        padding: 20px;
      }

      .panel-header {
        margin-bottom: 30px;
      }

      .panel-header h2 {
        margin: 0 0 10px 0;
        font-size: 28px;
        color: #2c3e50;
      }

      .panel-header .subtitle {
        margin: 0;
        color: #7f8c8d;
        font-size: 14px;
      }

      .panel-body {
        display: grid;
        grid-template-columns: 380px 1fr;
        gap: 30px;
      }

      .search-column {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .search-card {
        background: white;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }

      .search-card h3 {
        margin: 0 0 20px 0;
        font-size: 18px;
        color: #2c3e50;
        border-bottom: 2px solid #3498db;
        padding-bottom: 10px;
      }

      .form-group {
        margin-bottom: 15px;
      }

      .form-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
        color: #34495e;
        font-size: 14px;
      }

      .form-control {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #dfe6e9;
        border-radius: 4px;
        font-size: 14px;
        transition: border-color 0.3s;
      }

      .form-control:focus {
        outline: none;
        border-color: #3498db;
      }

      .form-hint {
        display: block;
        margin-top: 5px;
        font-size: 12px;
        color: #95a5a6;
      }

      .checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 14px;
      }

      .checkbox-label input[type="checkbox"] {
        cursor: pointer;
      }

      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
      }

      .button-group {
        display: flex;
        gap: 10px;
        margin-top: 20px;
      }

      .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .btn-primary {
        background: #3498db;
        color: white;
        flex: 1;
      }

      .btn-primary:hover:not(:disabled) {
        background: #2980b9;
      }

      .btn-primary:disabled {
        background: #95a5a6;
        cursor: not-allowed;
      }

      .btn-secondary {
        background: #ecf0f1;
        color: #2c3e50;
      }

      .btn-secondary:hover {
        background: #dfe6e9;
      }

      .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .validation-message {
        margin-top: 8px;
        font-size: 13px;
      }

      .validation-message.error {
        color: #e74c3c;
      }

      .validation-message.success {
        color: #27ae60;
      }

      .processo-details {
        margin-top: 15px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 4px;
      }

      .processo-details h4 {
        margin: 0 0 10px 0;
        font-size: 14px;
        color: #2c3e50;
      }

      .processo-details ul {
        margin: 0;
        padding-left: 20px;
      }

      .processo-details li {
        margin-bottom: 5px;
        font-size: 13px;
        color: #34495e;
      }

      .search-history {
        max-height: 400px;
        overflow-y: auto;
      }

      .history-item {
        padding: 12px;
        border-bottom: 1px solid #ecf0f1;
        cursor: pointer;
        transition: background 0.3s;
      }

      .history-item:hover {
        background: #f8f9fa;
      }

      .history-item:last-child {
        border-bottom: none;
      }

      .history-content {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-bottom: 5px;
      }

      .history-tribunal {
        font-size: 12px;
        color: #7f8c8d;
      }

      .history-count {
        font-size: 12px;
        color: #95a5a6;
      }

      .history-meta small {
        font-size: 11px;
        color: #bdc3c7;
      }

      .results-column {
        min-height: 600px;
      }

      .results-container {
        background: white;
        border-radius: 8px;
        padding: 30px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        min-height: 600px;
      }

      .empty-state,
      .empty-state-large {
        text-align: center;
        color: #95a5a6;
        padding: 60px 20px;
      }

      .empty-state-large svg,
      .loading-state svg,
      .error-state svg {
        opacity: 0.3;
        margin-bottom: 20px;
      }

      .empty-state-large h3,
      .loading-state h3,
      .error-state h3 {
        margin: 0 0 10px 0;
        color: #7f8c8d;
      }

      .empty-state-large p,
      .loading-state p,
      .error-state p {
        margin: 0;
        color: #95a5a6;
      }

      .loading-state {
        text-align: center;
        padding: 80px 20px;
      }

      .spinner-large {
        width: 60px;
        height: 60px;
        border: 4px solid #ecf0f1;
        border-top-color: #3498db;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 20px;
      }

      .error-state {
        text-align: center;
        padding: 60px 20px;
      }

      .error-state svg {
        stroke: #e74c3c;
      }

      .error-state h3 {
        color: #e74c3c;
      }

      .results-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 25px;
        padding-bottom: 15px;
        border-bottom: 2px solid #ecf0f1;
      }

      .results-header h3 {
        margin: 0;
        font-size: 20px;
        color: #2c3e50;
      }

      .results-count {
        font-size: 14px;
        color: #7f8c8d;
      }

      .source-group {
        margin-bottom: 30px;
      }

      .source-title {
        margin: 0 0 15px 0;
        font-size: 16px;
        color: #34495e;
        padding-left: 10px;
        border-left: 3px solid #3498db;
      }

      .results-list {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }

      .result-card {
        background: #f8f9fa;
        border: 1px solid #ecf0f1;
        border-radius: 6px;
        padding: 20px;
        transition: all 0.3s;
      }

      .result-card:hover {
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        border-color: #3498db;
      }

      .result-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }

      .tribunal-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 4px;
        color: white;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
      }

      .result-date {
        font-size: 13px;
        color: #7f8c8d;
      }

      .result-body {
        margin-bottom: 15px;
      }

      .result-body h4 {
        margin: 0 0 10px 0;
        font-size: 16px;
        color: #2c3e50;
      }

      .result-ementa {
        margin: 0 0 10px 0;
        font-size: 14px;
        line-height: 1.6;
        color: #34495e;
      }

      .result-numero {
        margin: 0;
        font-size: 13px;
        color: #7f8c8d;
      }

      .result-footer {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      .btn-copy,
      .btn-link,
      .btn-expand {
        padding: 6px 14px;
        border: 1px solid #dfe6e9;
        border-radius: 4px;
        font-size: 13px;
        background: white;
        color: #2c3e50;
        cursor: pointer;
        transition: all 0.3s;
        text-decoration: none;
      }

      .btn-copy:hover,
      .btn-link:hover,
      .btn-expand:hover {
        background: #3498db;
        color: white;
        border-color: #3498db;
      }

      .btn-copy.copied {
        background: #27ae60;
        color: white;
        border-color: #27ae60;
      }

      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .modal-content {
        background: white;
        border-radius: 8px;
        max-width: 800px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        animation: slideUp 0.3s;
      }

      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 30px;
        border-bottom: 1px solid #ecf0f1;
      }

      .modal-header h3 {
        margin: 0;
        font-size: 20px;
        color: #2c3e50;
      }

      .modal-close {
        background: none;
        border: none;
        font-size: 28px;
        color: #95a5a6;
        cursor: pointer;
        line-height: 1;
        padding: 0;
        width: 30px;
        height: 30px;
      }

      .modal-close:hover {
        color: #2c3e50;
      }

      .modal-body {
        padding: 30px;
      }

      .ementa-completa {
        margin-top: 20px;
        padding: 20px;
        background: #f8f9fa;
        border-radius: 4px;
      }

      .ementa-completa h5 {
        margin: 0 0 15px 0;
        font-size: 14px;
        color: #2c3e50;
        text-transform: uppercase;
      }

      .ementa-completa p {
        margin: 0;
        line-height: 1.8;
        color: #34495e;
      }

      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 20px 30px;
        border-top: 1px solid #ecf0f1;
      }

      .movimentacoes {
        margin-top: 20px;
      }

      .movimentacoes h5 {
        margin: 0 0 10px 0;
        font-size: 14px;
        color: #2c3e50;
      }

      .movimentacoes ul {
        margin: 0;
        padding-left: 20px;
      }

      .movimentacoes li {
        margin-bottom: 8px;
        font-size: 13px;
        line-height: 1.6;
        color: #34495e;
      }

      /* Responsive */
      @media (max-width: 1024px) {
        .panel-body {
          grid-template-columns: 1fr;
        }

        .search-column {
          order: 2;
        }

        .results-column {
          order: 1;
        }
      }

      @media (max-width: 768px) {
        .form-row {
          grid-template-columns: 1fr;
        }

        .button-group {
          flex-direction: column;
        }

        .result-footer {
          flex-direction: column;
        }

        .btn-copy,
        .btn-link,
        .btn-expand {
          width: 100%;
        }
      }
    `;

    document.head.appendChild(style);
  }
}

// Exporta instância global
export const jurisprudenciaPanel = new JurisprudenciaPanel();

// Para uso direto no HTML sem módulos
if (typeof window !== 'undefined') {
  window.jurisprudenciaPanel = jurisprudenciaPanel;
}
