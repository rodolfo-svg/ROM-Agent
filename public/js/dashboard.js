/**
 * ROM Agent Dashboard - Sistema de Métricas e Estatísticas
 * Versão: 2.7.0
 *
 * Dashboard completo com auto-refresh, gráficos e visualizações
 * de todas as métricas do sistema ROM Agent.
 */

class Dashboard {
  constructor() {
    this.container = null;
    this.refreshInterval = null;
    this.charts = {};
    this.refreshTime = 30000; // 30 segundos
    this.isInitialized = false;
    this.isRefreshing = false;
  }

  /**
   * Inicializa o dashboard
   * @param {string} containerId - ID do container HTML
   */
  async init(containerId) {
    try {
      this.container = document.getElementById(containerId);
      if (!this.container) {
        throw new Error(`Container '${containerId}' não encontrado`);
      }

      // Verifica se Chart.js está disponível
      await this.ensureChartJS();

      // Renderiza o dashboard inicial
      await this.render();

      // Inicia auto-refresh
      this.startAutoRefresh();

      this.isInitialized = true;
      console.log('Dashboard inicializado com sucesso');

    } catch (error) {
      console.error('Erro ao inicializar dashboard:', error);
      this.showError('Erro ao inicializar dashboard: ' + error.message);
    }
  }

  /**
   * Garante que Chart.js está carregado
   */
  async ensureChartJS() {
    if (typeof Chart !== 'undefined') {
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Falha ao carregar Chart.js'));
      document.head.appendChild(script);
    });
  }

  /**
   * Busca todas as métricas do sistema
   */
  async fetchMetrics() {
    try {
      const [systemInfo, jurisprudenciaStats, projects, users, schedulerStatus] = await Promise.allSettled([
        api.get('/api/info'),
        api.get('/api/jurisprudencia/stats').catch(() => ({ searches: 0, tribunals: [], sources: [] })),
        api.get('/api/projects').catch(() => []),
        api.get('/api/users').catch(() => []),
        api.get('/api/scheduler/status').catch(() => ({ jobs: [], active: 0 }))
      ]);

      // Processa uploads (mockado - adaptar conforme API real)
      const uploads = {
        total: 0,
        totalSize: 0,
        types: {}
      };

      return {
        system: systemInfo.status === 'fulfilled' ? systemInfo.value : {},
        jurisprudencia: jurisprudenciaStats.status === 'fulfilled' ? jurisprudenciaStats.value : { searches: 0, tribunals: [], sources: [] },
        projects: projects.status === 'fulfilled' ? projects.value : [],
        users: users.status === 'fulfilled' ? users.value : [],
        scheduler: schedulerStatus.status === 'fulfilled' ? schedulerStatus.value : { jobs: [], active: 0 },
        uploads
      };

    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
      throw error;
    }
  }

  /**
   * Renderiza o dashboard completo
   */
  async render() {
    try {
      // Mostra loading
      this.container.innerHTML = '<div class="dashboard-loading">Carregando métricas...</div>';

      // Busca métricas
      const metrics = await this.fetchMetrics();

      // Cria HTML do dashboard
      const html = `
        <div class="dashboard-header">
          <h2>Dashboard ROM Agent</h2>
          <div class="dashboard-controls">
            <span class="last-update">Atualizado: ${new Date().toLocaleTimeString()}</span>
            <button class="btn-refresh" onclick="dashboard.refresh()">Atualizar</button>
          </div>
        </div>

        <div class="dashboard-grid">
          ${this.renderSystemCard(metrics.system)}
          ${this.renderJurisprudenciaCard(metrics.jurisprudencia)}
          ${this.renderProjectsCard(metrics.projects)}
          ${this.renderUsersCard(metrics.users)}
          ${this.renderUploadsCard(metrics.uploads)}
          ${this.renderSchedulerCard(metrics.scheduler)}
        </div>

        <div class="dashboard-charts">
          ${this.renderChartsSection(metrics)}
        </div>

        <div class="dashboard-tables">
          ${this.renderTablesSection(metrics)}
        </div>
      `;

      this.container.innerHTML = html;

      // Renderiza gráficos
      await this.renderCharts(metrics);

      // Aplica animações
      this.applyAnimations();

    } catch (error) {
      console.error('Erro ao renderizar dashboard:', error);
      this.showError('Erro ao renderizar dashboard: ' + error.message);
    }
  }

  /**
   * Renderiza card de informações do sistema
   */
  renderSystemCard(system) {
    const uptime = system.uptime ? this.formatUptime(system.uptime) : 'N/A';
    const version = system.version || '2.7.0';
    const environment = system.environment || 'production';
    const status = system.status || 'online';
    const statusClass = status === 'online' ? 'status-green' : 'status-red';

    return `
      <div class="dashboard-card fade-in">
        <div class="card-header">
          <h3>Sistema</h3>
          <span class="card-icon">&#128187;</span>
        </div>
        <div class="card-body">
          <div class="metric-item">
            <span class="metric-label">Versão:</span>
            <span class="metric-value">${version}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Uptime:</span>
            <span class="metric-value">${uptime}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Ambiente:</span>
            <span class="metric-value">${environment}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Status:</span>
            <span class="metric-value ${statusClass}">${status}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza card de jurisprudência
   */
  renderJurisprudenciaCard(jurisprudencia) {
    const totalSearches = jurisprudencia.searches || 0;
    const totalTribunals = jurisprudencia.tribunals?.length || 0;
    const totalSources = jurisprudencia.sources?.length || 0;
    const topTribunal = jurisprudencia.tribunals?.[0]?.name || 'N/A';

    return `
      <div class="dashboard-card fade-in">
        <div class="card-header">
          <h3>Jurisprudência</h3>
          <span class="card-icon">&#9878;</span>
        </div>
        <div class="card-body">
          <div class="metric-big">
            <div class="metric-number">${totalSearches}</div>
            <div class="metric-label">Total de Buscas</div>
          </div>
          <div class="metric-item">
            <span class="metric-label">Tribunais:</span>
            <span class="metric-value">${totalTribunals}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Fontes:</span>
            <span class="metric-value">${totalSources}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Top Tribunal:</span>
            <span class="metric-value">${topTribunal}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza card de projetos
   */
  renderProjectsCard(projects) {
    const total = projects.length || 0;
    const active = projects.filter(p => p.status === 'active').length || 0;
    const totalDocs = projects.reduce((sum, p) => sum + (p.documents?.length || 0), 0);
    const avgDocs = total > 0 ? Math.round(totalDocs / total) : 0;

    return `
      <div class="dashboard-card fade-in">
        <div class="card-header">
          <h3>Projetos</h3>
          <span class="card-icon">&#128194;</span>
        </div>
        <div class="card-body">
          <div class="metric-big">
            <div class="metric-number">${total}</div>
            <div class="metric-label">Total de Projetos</div>
          </div>
          <div class="metric-item">
            <span class="metric-label">Ativos:</span>
            <span class="metric-value status-green">${active}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Documentos:</span>
            <span class="metric-value">${totalDocs}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Média/Projeto:</span>
            <span class="metric-value">${avgDocs}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza card de usuários
   */
  renderUsersCard(users) {
    const total = users.length || 0;
    const active = users.filter(u => u.status === 'active').length || 0;
    const admins = users.filter(u => u.role === 'admin').length || 0;
    const members = users.filter(u => u.role === 'member').length || 0;

    return `
      <div class="dashboard-card fade-in">
        <div class="card-header">
          <h3>Equipe</h3>
          <span class="card-icon">&#128101;</span>
        </div>
        <div class="card-body">
          <div class="metric-big">
            <div class="metric-number">${total}</div>
            <div class="metric-label">Total de Usuários</div>
          </div>
          <div class="metric-item">
            <span class="metric-label">Ativos:</span>
            <span class="metric-value status-green">${active}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Admins:</span>
            <span class="metric-value">${admins}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Membros:</span>
            <span class="metric-value">${members}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza card de uploads
   */
  renderUploadsCard(uploads) {
    const total = uploads.total || 0;
    const totalSize = this.formatBytes(uploads.totalSize || 0);
    const typesCount = Object.keys(uploads.types || {}).length;

    return `
      <div class="dashboard-card fade-in">
        <div class="card-header">
          <h3>Uploads</h3>
          <span class="card-icon">&#128190;</span>
        </div>
        <div class="card-body">
          <div class="metric-big">
            <div class="metric-number">${total}</div>
            <div class="metric-label">Total de Arquivos</div>
          </div>
          <div class="metric-item">
            <span class="metric-label">Tamanho Total:</span>
            <span class="metric-value">${totalSize}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Tipos:</span>
            <span class="metric-value">${typesCount}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza card do scheduler
   */
  renderSchedulerCard(scheduler) {
    const totalJobs = scheduler.jobs?.length || 0;
    const activeJobs = scheduler.active || 0;
    const nextJob = scheduler.jobs?.[0]?.nextRun || 'N/A';
    const statusClass = activeJobs > 0 ? 'status-green' : 'status-yellow';

    return `
      <div class="dashboard-card fade-in">
        <div class="card-header">
          <h3>Scheduler</h3>
          <span class="card-icon">&#9200;</span>
        </div>
        <div class="card-body">
          <div class="metric-big">
            <div class="metric-number ${statusClass}">${activeJobs}</div>
            <div class="metric-label">Jobs Ativos</div>
          </div>
          <div class="metric-item">
            <span class="metric-label">Total Jobs:</span>
            <span class="metric-value">${totalJobs}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Próxima Execução:</span>
            <span class="metric-value">${nextJob}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza seção de gráficos
   */
  renderChartsSection(metrics) {
    return `
      <div class="charts-container">
        <div class="chart-card fade-in">
          <h3>Distribuição por Tribunal</h3>
          <canvas id="chart-tribunals"></canvas>
        </div>
        <div class="chart-card fade-in">
          <h3>Projetos por Status</h3>
          <canvas id="chart-projects"></canvas>
        </div>
        <div class="chart-card fade-in">
          <h3>Usuários por Role</h3>
          <canvas id="chart-users"></canvas>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza seção de tabelas
   */
  renderTablesSection(metrics) {
    return `
      <div class="tables-container">
        ${this.renderTopTribunalsTable(metrics.jurisprudencia)}
        ${this.renderTopProjectsTable(metrics.projects)}
      </div>
    `;
  }

  /**
   * Renderiza tabela de top tribunais
   */
  renderTopTribunalsTable(jurisprudencia) {
    const tribunals = (jurisprudencia.tribunals || []).slice(0, 5);

    if (tribunals.length === 0) {
      return `
        <div class="table-card fade-in">
          <h3>Top 5 Tribunais</h3>
          <p class="no-data">Nenhum dado disponível</p>
        </div>
      `;
    }

    const rows = tribunals.map((t, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${t.name || 'N/A'}</td>
        <td>${t.searches || 0}</td>
      </tr>
    `).join('');

    return `
      <div class="table-card fade-in">
        <h3>Top 5 Tribunais</h3>
        <table class="dashboard-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Tribunal</th>
              <th>Buscas</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Renderiza tabela de top projetos
   */
  renderTopProjectsTable(projects) {
    const topProjects = projects
      .sort((a, b) => (b.documents?.length || 0) - (a.documents?.length || 0))
      .slice(0, 5);

    if (topProjects.length === 0) {
      return `
        <div class="table-card fade-in">
          <h3>Top 5 Projetos</h3>
          <p class="no-data">Nenhum dado disponível</p>
        </div>
      `;
    }

    const rows = topProjects.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${p.name || 'N/A'}</td>
        <td>${p.documents?.length || 0}</td>
        <td><span class="status-badge ${p.status === 'active' ? 'status-green' : 'status-yellow'}">${p.status || 'N/A'}</span></td>
      </tr>
    `).join('');

    return `
      <div class="table-card fade-in">
        <h3>Top 5 Projetos</h3>
        <table class="dashboard-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Projeto</th>
              <th>Docs</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Renderiza os gráficos usando Chart.js
   */
  async renderCharts(metrics) {
    // Destrói gráficos anteriores
    Object.values(this.charts).forEach(chart => chart.destroy());
    this.charts = {};

    // Gráfico de Tribunais
    await this.renderTribunalsChart(metrics.jurisprudencia);

    // Gráfico de Projetos
    await this.renderProjectsChart(metrics.projects);

    // Gráfico de Usuários
    await this.renderUsersChart(metrics.users);
  }

  /**
   * Renderiza gráfico de tribunais
   */
  async renderTribunalsChart(jurisprudencia) {
    const canvas = document.getElementById('chart-tribunals');
    if (!canvas) return;

    const tribunals = (jurisprudencia.tribunals || []).slice(0, 5);

    if (tribunals.length === 0) {
      canvas.parentElement.innerHTML = '<p class="no-data">Nenhum dado disponível</p>';
      return;
    }

    const ctx = canvas.getContext('2d');
    this.charts.tribunals = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: tribunals.map(t => t.name),
        datasets: [{
          data: tribunals.map(t => t.searches || 0),
          backgroundColor: [
            '#3498db',
            '#2ecc71',
            '#f39c12',
            '#e74c3c',
            '#9b59b6'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  /**
   * Renderiza gráfico de projetos
   */
  async renderProjectsChart(projects) {
    const canvas = document.getElementById('chart-projects');
    if (!canvas) return;

    const active = projects.filter(p => p.status === 'active').length;
    const inactive = projects.filter(p => p.status !== 'active').length;

    if (active === 0 && inactive === 0) {
      canvas.parentElement.innerHTML = '<p class="no-data">Nenhum dado disponível</p>';
      return;
    }

    const ctx = canvas.getContext('2d');
    this.charts.projects = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Ativos', 'Inativos'],
        datasets: [{
          data: [active, inactive],
          backgroundColor: ['#2ecc71', '#95a5a6']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  /**
   * Renderiza gráfico de usuários
   */
  async renderUsersChart(users) {
    const canvas = document.getElementById('chart-users');
    if (!canvas) return;

    const admins = users.filter(u => u.role === 'admin').length;
    const members = users.filter(u => u.role === 'member').length;
    const others = users.filter(u => u.role !== 'admin' && u.role !== 'member').length;

    if (admins === 0 && members === 0 && others === 0) {
      canvas.parentElement.innerHTML = '<p class="no-data">Nenhum dado disponível</p>';
      return;
    }

    const ctx = canvas.getContext('2d');
    this.charts.users = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Admins', 'Membros', 'Outros'],
        datasets: [{
          label: 'Quantidade',
          data: [admins, members, others],
          backgroundColor: ['#3498db', '#2ecc71', '#95a5a6']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  /**
   * Inicia auto-refresh
   */
  startAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(() => {
      this.refresh();
    }, this.refreshTime);

    console.log(`Auto-refresh ativado (${this.refreshTime / 1000}s)`);
  }

  /**
   * Para auto-refresh
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('Auto-refresh desativado');
    }
  }

  /**
   * Atualiza o dashboard
   */
  async refresh() {
    if (this.isRefreshing) {
      console.log('Refresh já em andamento, ignorando...');
      return;
    }

    try {
      this.isRefreshing = true;
      console.log('Atualizando dashboard...');

      await this.render();

      console.log('Dashboard atualizado com sucesso');

    } catch (error) {
      console.error('Erro ao atualizar dashboard:', error);
      this.showError('Erro ao atualizar: ' + error.message);
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Aplica animações de fade-in
   */
  applyAnimations() {
    const elements = this.container.querySelectorAll('.fade-in');
    elements.forEach((el, index) => {
      setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, index * 50);
    });
  }

  /**
   * Mostra mensagem de erro
   */
  showError(message) {
    const errorHtml = `
      <div class="dashboard-error">
        <span class="error-icon">&#9888;</span>
        <p>${message}</p>
        <button onclick="dashboard.refresh()">Tentar Novamente</button>
      </div>
    `;

    if (this.container) {
      this.container.innerHTML = errorHtml;
    }
  }

  /**
   * Destrói o dashboard
   */
  destroy() {
    try {
      // Para auto-refresh
      this.stopAutoRefresh();

      // Destrói gráficos
      Object.values(this.charts).forEach(chart => {
        try {
          chart.destroy();
        } catch (e) {
          console.warn('Erro ao destruir gráfico:', e);
        }
      });
      this.charts = {};

      // Limpa container
      if (this.container) {
        this.container.innerHTML = '';
      }

      this.isInitialized = false;
      console.log('Dashboard destruído com sucesso');

    } catch (error) {
      console.error('Erro ao destruir dashboard:', error);
    }
  }

  /**
   * Formata uptime em formato legível
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(' ') || '0m';
  }

  /**
   * Formata bytes em formato legível
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Define intervalo de refresh customizado
   */
  setRefreshInterval(milliseconds) {
    if (milliseconds < 5000) {
      console.warn('Intervalo mínimo de refresh é 5 segundos');
      milliseconds = 5000;
    }

    this.refreshTime = milliseconds;

    if (this.refreshInterval) {
      this.stopAutoRefresh();
      this.startAutoRefresh();
    }

    console.log(`Intervalo de refresh alterado para ${milliseconds / 1000}s`);
  }

  /**
   * Retorna status do dashboard
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      refreshing: this.isRefreshing,
      refreshInterval: this.refreshTime,
      chartsCount: Object.keys(this.charts).length,
      autoRefreshActive: this.refreshInterval !== null
    };
  }
}

// CSS inline para o dashboard
const dashboardStyles = `
<style>
  .dashboard-loading {
    text-align: center;
    padding: 60px 20px;
    font-size: 18px;
    color: #666;
  }

  .dashboard-error {
    text-align: center;
    padding: 60px 20px;
    color: #e74c3c;
  }

  .dashboard-error .error-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 20px;
  }

  .dashboard-error button {
    margin-top: 20px;
    padding: 10px 20px;
    background: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding-bottom: 15px;
    border-bottom: 2px solid #eee;
  }

  .dashboard-header h2 {
    margin: 0;
    color: #2c3e50;
  }

  .dashboard-controls {
    display: flex;
    gap: 15px;
    align-items: center;
  }

  .last-update {
    color: #666;
    font-size: 14px;
  }

  .btn-refresh {
    padding: 8px 16px;
    background: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.3s;
  }

  .btn-refresh:hover {
    background: #2980b9;
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
  }

  .dashboard-card {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transition: all 0.3s;
    opacity: 0;
    transform: translateY(20px);
  }

  .dashboard-card:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    transform: translateY(-2px);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eee;
  }

  .card-header h3 {
    margin: 0;
    color: #2c3e50;
    font-size: 18px;
  }

  .card-icon {
    font-size: 24px;
    opacity: 0.6;
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .metric-big {
    text-align: center;
    margin-bottom: 10px;
  }

  .metric-number {
    font-size: 48px;
    font-weight: bold;
    color: #3498db;
    line-height: 1;
  }

  .metric-big .metric-label {
    display: block;
    font-size: 14px;
    color: #666;
    margin-top: 5px;
  }

  .metric-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #f5f5f5;
  }

  .metric-item:last-child {
    border-bottom: none;
  }

  .metric-label {
    color: #666;
    font-size: 14px;
  }

  .metric-value {
    font-weight: 600;
    color: #2c3e50;
    font-size: 14px;
  }

  .status-green {
    color: #2ecc71 !important;
  }

  .status-yellow {
    color: #f39c12 !important;
  }

  .status-red {
    color: #e74c3c !important;
  }

  .status-badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-badge.status-green {
    background: #d4edda;
    color: #155724 !important;
  }

  .status-badge.status-yellow {
    background: #fff3cd;
    color: #856404 !important;
  }

  .charts-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
  }

  .chart-card {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    opacity: 0;
    transform: translateY(20px);
  }

  .chart-card h3 {
    margin: 0 0 20px 0;
    color: #2c3e50;
    font-size: 16px;
  }

  .chart-card canvas {
    max-height: 300px;
  }

  .tables-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 20px;
  }

  .table-card {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    opacity: 0;
    transform: translateY(20px);
  }

  .table-card h3 {
    margin: 0 0 15px 0;
    color: #2c3e50;
    font-size: 16px;
  }

  .dashboard-table {
    width: 100%;
    border-collapse: collapse;
  }

  .dashboard-table th,
  .dashboard-table td {
    padding: 10px;
    text-align: left;
    border-bottom: 1px solid #eee;
  }

  .dashboard-table th {
    background: #f8f9fa;
    font-weight: 600;
    color: #2c3e50;
    font-size: 14px;
  }

  .dashboard-table td {
    color: #666;
    font-size: 14px;
  }

  .dashboard-table tr:hover {
    background: #f8f9fa;
  }

  .no-data {
    text-align: center;
    color: #999;
    padding: 20px;
    font-style: italic;
  }

  .fade-in {
    transition: opacity 0.5s, transform 0.5s;
  }

  @media (max-width: 768px) {
    .dashboard-grid {
      grid-template-columns: 1fr;
    }

    .charts-container {
      grid-template-columns: 1fr;
    }

    .tables-container {
      grid-template-columns: 1fr;
    }

    .dashboard-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }

    .dashboard-controls {
      width: 100%;
      justify-content: space-between;
    }
  }
</style>
`;

// Injeta estilos no documento
if (typeof document !== 'undefined' && !document.getElementById('dashboard-styles')) {
  const styleElement = document.createElement('div');
  styleElement.id = 'dashboard-styles';
  styleElement.innerHTML = dashboardStyles;
  document.head.appendChild(styleElement.firstElementChild);
}

// Exporta instância singleton
const dashboard = new Dashboard();

// Expõe globalmente para uso em HTML
if (typeof window !== 'undefined') {
  window.dashboard = dashboard;
  window.Dashboard = Dashboard;
}

// Exporta para módulos ES6
export default dashboard;
export { Dashboard };
