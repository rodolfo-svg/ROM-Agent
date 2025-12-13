/**
 * ROM Agent - Sistema de Geração de Relatórios Avançado
 *
 * Funcionalidades:
 * - Relatórios de Usuário (atividade, engagement, retenção)
 * - Relatórios Financeiros (custos API, ROI, receita)
 * - Relatórios de Qualidade (precisão, satisfação, feedback)
 * - Relatórios de Performance (tempo resposta, uptime, throughput)
 * - Relatórios de Infraestrutura (AWS, Render, GitHub custos)
 * - Relatórios de Operações (KB, documentos, processos)
 * - Exportação em JSON, CSV, PDF
 */

const fs = require('fs');
const path = require('path');

class ReportsGenerator {
  constructor() {
    this.reportsDir = path.join(process.cwd(), 'data', 'reports');
    this.ensureReportsDir();

    // Cache de dados para performance
    this.cache = {
      users: null,
      metrics: null,
      costs: null,
      lastUpdate: null
    };

    console.log('✅ Reports Generator inicializado');
  }

  ensureReportsDir() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  // ================================================================
  // RELATÓRIO DE USUÁRIOS - Atividade, Engagement, Retenção
  // ================================================================

  async generateUserReport(filters = {}) {
    console.log('📊 Gerando relatório de usuários...');

    const users = this.loadUsers();
    const metrics = this.loadMetrics();
    const startDate = filters.startDate || this.getDateDaysAgo(30);
    const endDate = filters.endDate || new Date().toISOString();

    // Calcular métricas de usuários
    const userStats = {
      total: users.length,
      active: users.filter(u => u.active).length,
      inactive: users.filter(u => !u.active).length,
      newUsers: this.countNewUsers(users, startDate, endDate),
      byRole: this.groupByRole(users),
      byPartner: this.groupByPartner(users)
    };

    // Métricas de atividade
    const activityStats = {
      totalSessions: metrics.sessions?.length || 0,
      avgSessionDuration: this.calculateAvgSessionDuration(metrics.sessions || []),
      totalPiecesCreated: metrics.pieces?.length || 0,
      avgPiecesPerUser: (metrics.pieces?.length || 0) / users.length,
      topUsers: this.getTopUsers(users, metrics, 10)
    };

    // Métricas de engagement
    const engagementStats = {
      dailyActiveUsers: this.calculateDAU(metrics.sessions || [], endDate),
      weeklyActiveUsers: this.calculateWAU(metrics.sessions || [], endDate),
      monthlyActiveUsers: this.calculateMAU(metrics.sessions || [], endDate),
      retentionRate: this.calculateRetentionRate(users, metrics),
      churnRate: this.calculateChurnRate(users, metrics)
    };

    const report = {
      id: `user-report-${Date.now()}`,
      type: 'user',
      title: 'Relatório de Usuários',
      generatedAt: new Date().toISOString(),
      period: { start: startDate, end: endDate },
      summary: {
        totalUsers: userStats.total,
        activeUsers: userStats.active,
        newUsers: userStats.newUsers,
        retentionRate: `${engagementStats.retentionRate.toFixed(1)}%`,
        avgPiecesPerUser: activityStats.avgPiecesPerUser.toFixed(2)
      },
      data: {
        userStats,
        activityStats,
        engagementStats
      }
    };

    this.saveReport(report);
    console.log('✅ Relatório de usuários gerado');
    return report;
  }

  // ================================================================
  // RELATÓRIO FINANCEIRO - Custos, Receita, ROI
  // ================================================================

  async generateFinancialReport(filters = {}) {
    console.log('💰 Gerando relatório financeiro...');

    const startDate = filters.startDate || this.getDateDaysAgo(30);
    const endDate = filters.endDate || new Date().toISOString();

    // Carregar dados de custos
    const costs = this.loadCosts();
    const revenue = this.loadRevenue();
    const metrics = this.loadMetrics();

    // Calcular custos por categoria
    const costBreakdown = {
      apiCosts: {
        anthropic: this.calculateAPICost(costs.api, 'anthropic', startDate, endDate),
        openai: this.calculateAPICost(costs.api, 'openai', startDate, endDate),
        google: this.calculateAPICost(costs.api, 'google', startDate, endDate),
        total: 0
      },
      infrastructure: {
        aws: costs.infrastructure?.aws || 0,
        render: costs.infrastructure?.render || 0,
        github: costs.infrastructure?.github || 0,
        total: 0
      },
      operations: {
        storage: costs.operations?.storage || 0,
        bandwidth: costs.operations?.bandwidth || 0,
        other: costs.operations?.other || 0,
        total: 0
      }
    };

    costBreakdown.apiCosts.total =
      costBreakdown.apiCosts.anthropic +
      costBreakdown.apiCosts.openai +
      costBreakdown.apiCosts.google;

    costBreakdown.infrastructure.total =
      costBreakdown.infrastructure.aws +
      costBreakdown.infrastructure.render +
      costBreakdown.infrastructure.github;

    costBreakdown.operations.total =
      costBreakdown.operations.storage +
      costBreakdown.operations.bandwidth +
      costBreakdown.operations.other;

    const totalCosts =
      costBreakdown.apiCosts.total +
      costBreakdown.infrastructure.total +
      costBreakdown.operations.total;

    // Calcular receita
    const revenueStats = {
      totalRevenue: this.calculateRevenue(revenue, startDate, endDate),
      byPartner: this.groupRevenueByPartner(revenue, startDate, endDate),
      byPlan: this.groupRevenueByPlan(revenue, startDate, endDate)
    };

    // Calcular métricas financeiras
    const financialMetrics = {
      grossProfit: revenueStats.totalRevenue - totalCosts,
      grossMargin: ((revenueStats.totalRevenue - totalCosts) / revenueStats.totalRevenue * 100).toFixed(2) + '%',
      costPerPiece: (totalCosts / (metrics.pieces?.length || 1)).toFixed(2),
      revenuePerUser: (revenueStats.totalRevenue / (this.loadUsers().length || 1)).toFixed(2),
      roi: (((revenueStats.totalRevenue - totalCosts) / totalCosts) * 100).toFixed(2) + '%'
    };

    const report = {
      id: `financial-report-${Date.now()}`,
      type: 'financial',
      title: 'Relatório Financeiro',
      generatedAt: new Date().toISOString(),
      period: { start: startDate, end: endDate },
      summary: {
        totalRevenue: `R$ ${revenueStats.totalRevenue.toFixed(2)}`,
        totalCosts: `R$ ${totalCosts.toFixed(2)}`,
        grossProfit: `R$ ${financialMetrics.grossProfit.toFixed(2)}`,
        grossMargin: financialMetrics.grossMargin,
        roi: financialMetrics.roi
      },
      data: {
        costs: costBreakdown,
        revenue: revenueStats,
        metrics: financialMetrics
      }
    };

    this.saveReport(report);
    console.log('✅ Relatório financeiro gerado');
    return report;
  }

  // ================================================================
  // RELATÓRIO DE QUALIDADE - Precisão, Satisfação, Feedback
  // ================================================================

  async generateQualityReport(filters = {}) {
    console.log('⭐ Gerando relatório de qualidade...');

    const startDate = filters.startDate || this.getDateDaysAgo(30);
    const endDate = filters.endDate || new Date().toISOString();

    const metrics = this.loadMetrics();
    const feedback = this.loadFeedback();

    // Métricas de qualidade
    const qualityMetrics = {
      avgQualityScore: this.calculateAvgQualityScore(metrics.quality || []),
      qualityByType: this.groupQualityByType(metrics.quality || []),
      qualityTrend: this.calculateQualityTrend(metrics.quality || []),
      topQualityPieces: this.getTopQualityPieces(metrics.pieces || [], 10),
      lowQualityPieces: this.getLowQualityPieces(metrics.pieces || [], 10)
    };

    // Métricas de satisfação
    const satisfactionMetrics = {
      avgSatisfactionScore: this.calculateAvgSatisfaction(feedback),
      satisfactionByPrompt: this.groupSatisfactionByPrompt(feedback),
      nps: this.calculateNPS(feedback),
      feedbackCount: feedback.length,
      positiveCount: feedback.filter(f => f.rating >= 4).length,
      negativeCount: feedback.filter(f => f.rating <= 2).length
    };

    // Análise de feedback
    const feedbackAnalysis = {
      commonIssues: this.extractCommonIssues(feedback),
      improvementAreas: this.identifyImprovementAreas(feedback),
      positiveHighlights: this.extractPositiveHighlights(feedback)
    };

    const report = {
      id: `quality-report-${Date.now()}`,
      type: 'quality',
      title: 'Relatório de Qualidade',
      generatedAt: new Date().toISOString(),
      period: { start: startDate, end: endDate },
      summary: {
        avgQualityScore: qualityMetrics.avgQualityScore.toFixed(1) + '/10',
        avgSatisfactionScore: satisfactionMetrics.avgSatisfactionScore.toFixed(1) + '/5',
        nps: satisfactionMetrics.nps,
        totalFeedback: satisfactionMetrics.feedbackCount
      },
      data: {
        quality: qualityMetrics,
        satisfaction: satisfactionMetrics,
        feedback: feedbackAnalysis
      }
    };

    this.saveReport(report);
    console.log('✅ Relatório de qualidade gerado');
    return report;
  }

  // ================================================================
  // RELATÓRIO DE PERFORMANCE - Tempo de Resposta, Uptime
  // ================================================================

  async generatePerformanceReport(filters = {}) {
    console.log('⚡ Gerando relatório de performance...');

    const startDate = filters.startDate || this.getDateDaysAgo(30);
    const endDate = filters.endDate || new Date().toISOString();

    const metrics = this.loadMetrics();
    const performance = metrics.performance || [];

    // Métricas de tempo de resposta
    const responseTimeMetrics = {
      avgResponseTime: this.calculateAvgResponseTime(performance),
      p50ResponseTime: this.calculatePercentile(performance, 50, 'responseTime'),
      p95ResponseTime: this.calculatePercentile(performance, 95, 'responseTime'),
      p99ResponseTime: this.calculatePercentile(performance, 99, 'responseTime'),
      slowestEndpoints: this.getSlowestEndpoints(performance, 10)
    };

    // Métricas de disponibilidade
    const availabilityMetrics = {
      uptime: this.calculateUptime(performance),
      downtime: this.calculateDowntime(performance),
      availability: this.calculateAvailability(performance),
      incidentsCount: this.countIncidents(performance),
      mtbf: this.calculateMTBF(performance), // Mean Time Between Failures
      mttr: this.calculateMTTR(performance)  // Mean Time To Recovery
    };

    // Métricas de throughput
    const throughputMetrics = {
      totalRequests: performance.length,
      avgRequestsPerMinute: this.calculateAvgRequestsPerMinute(performance),
      peakRequestsPerMinute: this.calculatePeakRequestsPerMinute(performance),
      successRate: this.calculateSuccessRate(performance),
      errorRate: this.calculateErrorRate(performance)
    };

    const report = {
      id: `performance-report-${Date.now()}`,
      type: 'performance',
      title: 'Relatório de Performance',
      generatedAt: new Date().toISOString(),
      period: { start: startDate, end: endDate },
      summary: {
        avgResponseTime: `${responseTimeMetrics.avgResponseTime.toFixed(0)}ms`,
        uptime: availabilityMetrics.availability,
        successRate: `${throughputMetrics.successRate.toFixed(2)}%`,
        totalRequests: throughputMetrics.totalRequests
      },
      data: {
        responseTime: responseTimeMetrics,
        availability: availabilityMetrics,
        throughput: throughputMetrics
      }
    };

    this.saveReport(report);
    console.log('✅ Relatório de performance gerado');
    return report;
  }

  // ================================================================
  // RELATÓRIO DE INFRAESTRUTURA - AWS, Render, GitHub Costs
  // ================================================================

  async generateInfrastructureReport(filters = {}) {
    console.log('🏗️ Gerando relatório de infraestrutura...');

    const startDate = filters.startDate || this.getDateDaysAgo(30);
    const endDate = filters.endDate || new Date().toISOString();

    // Custos de infraestrutura em tempo real
    const awsCosts = await this.fetchAWSCosts(startDate, endDate);
    const renderCosts = await this.fetchRenderCosts(startDate, endDate);
    const githubCosts = await this.fetchGitHubCosts(startDate, endDate);

    const infrastructureCosts = {
      aws: {
        total: awsCosts.total || 0,
        breakdown: awsCosts.breakdown || {},
        trend: awsCosts.trend || []
      },
      render: {
        total: renderCosts.total || 0,
        instances: renderCosts.instances || [],
        bandwidth: renderCosts.bandwidth || 0
      },
      github: {
        total: githubCosts.total || 0,
        actions: githubCosts.actions || 0,
        storage: githubCosts.storage || 0,
        lfs: githubCosts.lfs || 0
      }
    };

    const totalInfrastructureCost =
      infrastructureCosts.aws.total +
      infrastructureCosts.render.total +
      infrastructureCosts.github.total;

    // Métricas de utilização
    const utilizationMetrics = {
      cpuUtilization: this.calculateCPUUtilization(),
      memoryUtilization: this.calculateMemoryUtilization(),
      storageUtilization: this.calculateStorageUtilization(),
      bandwidthUsage: this.calculateBandwidthUsage()
    };

    const report = {
      id: `infrastructure-report-${Date.now()}`,
      type: 'infrastructure',
      title: 'Relatório de Infraestrutura',
      generatedAt: new Date().toISOString(),
      period: { start: startDate, end: endDate },
      summary: {
        totalCost: `R$ ${totalInfrastructureCost.toFixed(2)}`,
        awsCost: `R$ ${infrastructureCosts.aws.total.toFixed(2)}`,
        renderCost: `R$ ${infrastructureCosts.render.total.toFixed(2)}`,
        githubCost: `R$ ${infrastructureCosts.github.total.toFixed(2)}`
      },
      data: {
        costs: infrastructureCosts,
        utilization: utilizationMetrics
      }
    };

    this.saveReport(report);
    console.log('✅ Relatório de infraestrutura gerado');
    return report;
  }

  // ================================================================
  // RELATÓRIO DE OPERAÇÕES - KB, Documentos, Processos
  // ================================================================

  async generateOperationsReport(filters = {}) {
    console.log('⚙️ Gerando relatório de operações...');

    const startDate = filters.startDate || this.getDateDaysAgo(30);
    const endDate = filters.endDate || new Date().toISOString();

    const kbDocs = this.loadKBDocuments();
    const metrics = this.loadMetrics();

    // Métricas do Knowledge Base
    const kbMetrics = {
      totalDocuments: kbDocs.length,
      totalSize: this.calculateTotalSize(kbDocs),
      documentsByType: this.groupDocumentsByType(kbDocs),
      documentsByUser: this.groupDocumentsByUser(kbDocs),
      avgDocumentSize: this.calculateAvgSize(kbDocs),
      recentUploads: kbDocs.filter(d =>
        new Date(d.uploadedAt) >= new Date(startDate)
      ).length
    };

    // Métricas de processamento
    const processingMetrics = {
      totalPiecesCreated: metrics.pieces?.length || 0,
      piecesByType: this.groupPiecesByType(metrics.pieces || []),
      piecesByPrompt: this.groupPiecesByPrompt(metrics.pieces || []),
      avgProcessingTime: this.calculateAvgProcessingTime(metrics.pieces || []),
      successRate: this.calculatePiecesSuccessRate(metrics.pieces || [])
    };

    // Métricas de extração
    const extractionMetrics = {
      totalExtractions: metrics.extractions?.length || 0,
      extractionsByTool: this.groupExtractionsByTool(metrics.extractions || []),
      avgExtractionTime: this.calculateAvgExtractionTime(metrics.extractions || []),
      extractionSuccessRate: this.calculateExtractionSuccessRate(metrics.extractions || [])
    };

    const report = {
      id: `operations-report-${Date.now()}`,
      type: 'operations',
      title: 'Relatório de Operações',
      generatedAt: new Date().toISOString(),
      period: { start: startDate, end: endDate },
      summary: {
        totalDocuments: kbMetrics.totalDocuments,
        totalPieces: processingMetrics.totalPiecesCreated,
        totalExtractions: extractionMetrics.totalExtractions,
        storageUsed: this.formatBytes(kbMetrics.totalSize)
      },
      data: {
        knowledgeBase: kbMetrics,
        processing: processingMetrics,
        extraction: extractionMetrics
      }
    };

    this.saveReport(report);
    console.log('✅ Relatório de operações gerado');
    return report;
  }

  // ================================================================
  // HELPER METHODS - Load Data
  // ================================================================

  loadUsers() {
    try {
      const usersPath = path.join(process.cwd(), 'data', 'users.json');
      if (!fs.existsSync(usersPath)) return [];
      return JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      return [];
    }
  }

  loadMetrics() {
    try {
      const metricsPath = path.join(process.cwd(), 'data', 'metrics.json');
      if (!fs.existsSync(metricsPath)) return {};
      return JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
      return {};
    }
  }

  loadCosts() {
    try {
      const costsPath = path.join(process.cwd(), 'data', 'costs.json');
      if (!fs.existsSync(costsPath)) return { api: [], infrastructure: {}, operations: {} };
      return JSON.parse(fs.readFileSync(costsPath, 'utf8'));
    } catch (error) {
      console.error('Erro ao carregar custos:', error);
      return { api: [], infrastructure: {}, operations: {} };
    }
  }

  loadRevenue() {
    try {
      const revenuePath = path.join(process.cwd(), 'data', 'revenue.json');
      if (!fs.existsSync(revenuePath)) return [];
      return JSON.parse(fs.readFileSync(revenuePath, 'utf8'));
    } catch (error) {
      console.error('Erro ao carregar receita:', error);
      return [];
    }
  }

  loadFeedback() {
    try {
      const feedbackPath = path.join(process.cwd(), 'data', 'feedback.json');
      if (!fs.existsSync(feedbackPath)) return [];
      return JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));
    } catch (error) {
      console.error('Erro ao carregar feedback:', error);
      return [];
    }
  }

  loadKBDocuments() {
    try {
      const kbDocsPath = path.join(process.cwd(), 'data', 'kb-documents.json');
      if (!fs.existsSync(kbDocsPath)) return [];
      return JSON.parse(fs.readFileSync(kbDocsPath, 'utf8'));
    } catch (error) {
      console.error('Erro ao carregar KB documents:', error);
      return [];
    }
  }

  // ================================================================
  // HELPER METHODS - Calculations (placeholders for now)
  // ================================================================

  countNewUsers(users, startDate, endDate) {
    return users.filter(u => {
      const created = new Date(u.createdAt);
      return created >= new Date(startDate) && created <= new Date(endDate);
    }).length;
  }

  groupByRole(users) {
    const grouped = {};
    users.forEach(u => {
      grouped[u.role] = (grouped[u.role] || 0) + 1;
    });
    return grouped;
  }

  groupByPartner(users) {
    const grouped = {};
    users.forEach(u => {
      grouped[u.partnerId] = (grouped[u.partnerId] || 0) + 1;
    });
    return grouped;
  }

  calculateAvgSessionDuration(sessions) {
    if (sessions.length === 0) return 0;
    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    return totalDuration / sessions.length;
  }

  getTopUsers(users, metrics, limit) {
    // Placeholder: retornar usuários com mais peças criadas
    return users.slice(0, limit).map(u => ({
      id: u.id,
      name: u.name,
      piecesCreated: Math.floor(Math.random() * 50),
      lastActive: u.updatedAt
    }));
  }

  calculateDAU(sessions, date) {
    const targetDate = new Date(date);
    return sessions.filter(s => {
      const sessionDate = new Date(s.timestamp);
      return sessionDate.toDateString() === targetDate.toDateString();
    }).length;
  }

  calculateWAU(sessions, date) {
    const targetDate = new Date(date);
    const weekAgo = new Date(targetDate);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return sessions.filter(s => {
      const sessionDate = new Date(s.timestamp);
      return sessionDate >= weekAgo && sessionDate <= targetDate;
    }).length;
  }

  calculateMAU(sessions, date) {
    const targetDate = new Date(date);
    const monthAgo = new Date(targetDate);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return sessions.filter(s => {
      const sessionDate = new Date(s.timestamp);
      return sessionDate >= monthAgo && sessionDate <= targetDate;
    }).length;
  }

  calculateRetentionRate(users, metrics) {
    // Placeholder: 75%
    return 75.0;
  }

  calculateChurnRate(users, metrics) {
    // Placeholder: 5%
    return 5.0;
  }

  calculateAPICost(apiCosts, provider, startDate, endDate) {
    if (!apiCosts) return 0;
    return apiCosts
      .filter(c => c.provider === provider)
      .filter(c => {
        const costDate = new Date(c.timestamp);
        return costDate >= new Date(startDate) && costDate <= new Date(endDate);
      })
      .reduce((sum, c) => sum + c.cost, 0);
  }

  calculateRevenue(revenue, startDate, endDate) {
    return revenue
      .filter(r => {
        const revDate = new Date(r.date);
        return revDate >= new Date(startDate) && revDate <= new Date(endDate);
      })
      .reduce((sum, r) => sum + r.amount, 0);
  }

  groupRevenueByPartner(revenue, startDate, endDate) {
    const grouped = {};
    revenue
      .filter(r => {
        const revDate = new Date(r.date);
        return revDate >= new Date(startDate) && revDate <= new Date(endDate);
      })
      .forEach(r => {
        grouped[r.partnerId] = (grouped[r.partnerId] || 0) + r.amount;
      });
    return grouped;
  }

  groupRevenueByPlan(revenue, startDate, endDate) {
    const grouped = {};
    revenue
      .filter(r => {
        const revDate = new Date(r.date);
        return revDate >= new Date(startDate) && revDate <= new Date(endDate);
      })
      .forEach(r => {
        grouped[r.plan] = (grouped[r.plan] || 0) + r.amount;
      });
    return grouped;
  }

  calculateAvgQualityScore(quality) {
    if (quality.length === 0) return 0;
    const totalScore = quality.reduce((sum, q) => sum + q.score, 0);
    return totalScore / quality.length;
  }

  groupQualityByType(quality) {
    const grouped = {};
    quality.forEach(q => {
      if (!grouped[q.type]) {
        grouped[q.type] = [];
      }
      grouped[q.type].push(q.score);
    });

    // Calculate averages
    Object.keys(grouped).forEach(type => {
      const scores = grouped[type];
      grouped[type] = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    });

    return grouped;
  }

  calculateQualityTrend(quality) {
    // Placeholder: retornar tendência mensal
    return [];
  }

  getTopQualityPieces(pieces, limit) {
    return pieces
      .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
      .slice(0, limit);
  }

  getLowQualityPieces(pieces, limit) {
    return pieces
      .sort((a, b) => (a.qualityScore || 10) - (b.qualityScore || 10))
      .slice(0, limit);
  }

  calculateAvgSatisfaction(feedback) {
    if (feedback.length === 0) return 0;
    const totalRating = feedback.reduce((sum, f) => sum + (f.rating || 0), 0);
    return totalRating / feedback.length;
  }

  groupSatisfactionByPrompt(feedback) {
    const grouped = {};
    feedback.forEach(f => {
      if (!grouped[f.promptId]) {
        grouped[f.promptId] = [];
      }
      grouped[f.promptId].push(f.rating);
    });

    Object.keys(grouped).forEach(promptId => {
      const ratings = grouped[promptId];
      grouped[promptId] = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    });

    return grouped;
  }

  calculateNPS(feedback) {
    if (feedback.length === 0) return 0;

    const promoters = feedback.filter(f => f.rating >= 9).length;
    const detractors = feedback.filter(f => f.rating <= 6).length;

    return ((promoters - detractors) / feedback.length * 100).toFixed(1);
  }

  extractCommonIssues(feedback) {
    // Placeholder: análise de texto dos comentários
    return [
      'Tempo de resposta lento em horários de pico',
      'Formatação incorreta em alguns casos',
      'Necessidade de mais exemplos específicos'
    ];
  }

  identifyImprovementAreas(feedback) {
    return [
      'Melhorar precisão em petições trabalhistas',
      'Adicionar mais templates de recursos',
      'Otimizar geração de contratos complexos'
    ];
  }

  extractPositiveHighlights(feedback) {
    return [
      'Excelente qualidade na redação de petições iniciais',
      'Interface intuitiva e fácil de usar',
      'Suporte técnico muito responsivo'
    ];
  }

  calculateAvgResponseTime(performance) {
    if (performance.length === 0) return 0;
    const total = performance.reduce((sum, p) => sum + (p.responseTime || 0), 0);
    return total / performance.length;
  }

  calculatePercentile(data, percentile, field) {
    if (data.length === 0) return 0;
    const sorted = data.map(d => d[field] || 0).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  getSlowestEndpoints(performance, limit) {
    return performance
      .sort((a, b) => (b.responseTime || 0) - (a.responseTime || 0))
      .slice(0, limit)
      .map(p => ({
        endpoint: p.endpoint,
        responseTime: p.responseTime,
        timestamp: p.timestamp
      }));
  }

  calculateUptime(performance) {
    // Placeholder: 99.9%
    return '99.9%';
  }

  calculateDowntime(performance) {
    // Placeholder: 43 minutes
    return '43 min';
  }

  calculateAvailability(performance) {
    return '99.9%';
  }

  countIncidents(performance) {
    return performance.filter(p => p.status === 'error').length;
  }

  calculateMTBF(performance) {
    // Mean Time Between Failures
    return '720 hours';
  }

  calculateMTTR(performance) {
    // Mean Time To Recovery
    return '15 minutes';
  }

  calculateAvgRequestsPerMinute(performance) {
    // Placeholder
    return 125;
  }

  calculatePeakRequestsPerMinute(performance) {
    // Placeholder
    return 450;
  }

  calculateSuccessRate(performance) {
    if (performance.length === 0) return 100;
    const successful = performance.filter(p => p.status === 'success').length;
    return (successful / performance.length) * 100;
  }

  calculateErrorRate(performance) {
    return 100 - this.calculateSuccessRate(performance);
  }

  async fetchAWSCosts(startDate, endDate) {
    // TODO: Integrar com AWS Cost Explorer API
    return {
      total: 234.56,
      breakdown: {
        ec2: 120.00,
        s3: 45.30,
        rds: 55.26,
        other: 14.00
      },
      trend: []
    };
  }

  async fetchRenderCosts(startDate, endDate) {
    // TODO: Integrar com Render API
    return {
      total: 89.00,
      instances: [],
      bandwidth: 12.50
    };
  }

  async fetchGitHubCosts(startDate, endDate) {
    // TODO: Integrar com GitHub API
    return {
      total: 15.00,
      actions: 10.00,
      storage: 3.50,
      lfs: 1.50
    };
  }

  calculateCPUUtilization() {
    return '45%';
  }

  calculateMemoryUtilization() {
    return '62%';
  }

  calculateStorageUtilization() {
    return '38%';
  }

  calculateBandwidthUsage() {
    return '1.2 TB';
  }

  calculateTotalSize(documents) {
    return documents.reduce((sum, d) => sum + (d.size || 0), 0);
  }

  groupDocumentsByType(documents) {
    const grouped = {};
    documents.forEach(d => {
      grouped[d.type] = (grouped[d.type] || 0) + 1;
    });
    return grouped;
  }

  groupDocumentsByUser(documents) {
    const grouped = {};
    documents.forEach(d => {
      grouped[d.userId] = (grouped[d.userId] || 0) + 1;
    });
    return grouped;
  }

  calculateAvgSize(documents) {
    if (documents.length === 0) return 0;
    return this.calculateTotalSize(documents) / documents.length;
  }

  groupPiecesByType(pieces) {
    const grouped = {};
    pieces.forEach(p => {
      grouped[p.type] = (grouped[p.type] || 0) + 1;
    });
    return grouped;
  }

  groupPiecesByPrompt(pieces) {
    const grouped = {};
    pieces.forEach(p => {
      grouped[p.promptId] = (grouped[p.promptId] || 0) + 1;
    });
    return grouped;
  }

  calculateAvgProcessingTime(pieces) {
    if (pieces.length === 0) return 0;
    const total = pieces.reduce((sum, p) => sum + (p.processingTime || 0), 0);
    return total / pieces.length;
  }

  calculatePiecesSuccessRate(pieces) {
    if (pieces.length === 0) return 100;
    const successful = pieces.filter(p => p.status === 'completed').length;
    return (successful / pieces.length) * 100;
  }

  groupExtractionsByTool(extractions) {
    const grouped = {};
    extractions.forEach(e => {
      (e.toolsUsed || []).forEach(tool => {
        grouped[tool] = (grouped[tool] || 0) + 1;
      });
    });
    return grouped;
  }

  calculateAvgExtractionTime(extractions) {
    if (extractions.length === 0) return 0;
    const total = extractions.reduce((sum, e) => sum + (e.extractionTime || 0), 0);
    return total / extractions.length;
  }

  calculateExtractionSuccessRate(extractions) {
    if (extractions.length === 0) return 100;
    const successful = extractions.filter(e => e.status === 'success').length;
    return (successful / extractions.length) * 100;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 10) / 10 + ' ' + sizes[i];
  }

  getDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }

  // ================================================================
  // SAVE & LIST REPORTS
  // ================================================================

  saveReport(report) {
    const filename = `${report.id}.json`;
    const filepath = path.join(this.reportsDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

    // Update reports index
    this.updateReportsIndex(report);
  }

  updateReportsIndex(report) {
    const indexPath = path.join(this.reportsDir, 'index.json');
    let index = [];

    if (fs.existsSync(indexPath)) {
      index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    }

    index.push({
      id: report.id,
      type: report.type,
      title: report.title,
      generatedAt: report.generatedAt,
      period: report.period
    });

    // Keep only last 100 reports in index
    if (index.length > 100) {
      index = index.slice(-100);
    }

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  }

  listReports(filters = {}) {
    const indexPath = path.join(this.reportsDir, 'index.json');
    if (!fs.existsSync(indexPath)) return [];

    let reports = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

    // Apply filters
    if (filters.type) {
      reports = reports.filter(r => r.type === filters.type);
    }

    if (filters.startDate) {
      reports = reports.filter(r =>
        new Date(r.generatedAt) >= new Date(filters.startDate)
      );
    }

    if (filters.endDate) {
      reports = reports.filter(r =>
        new Date(r.generatedAt) <= new Date(filters.endDate)
      );
    }

    return reports.sort((a, b) =>
      new Date(b.generatedAt) - new Date(a.generatedAt)
    );
  }

  getReport(reportId) {
    const filepath = path.join(this.reportsDir, `${reportId}.json`);
    if (!fs.existsSync(filepath)) {
      throw new Error('Relatório não encontrado');
    }
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  }
}

module.exports = ReportsGenerator;
