/**
 * Reports Integrated System - BETA-2
 * Sistema integrado de relatórios combinando:
 * - Analytics (uso, qualidade, tempo)
 * - Tracing (rastreabilidade)
 * - Paradigmas (peças exemplares)
 *
 * Relatórios disponíveis:
 * - Uso geral do sistema
 * - Qualidade de peças produzidas
 * - Tempo de login e atividade
 * - Ferramentas mais utilizadas
 * - Dashboard executivo
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import tracing from './tracing.js';
import featureFlags from './feature-flags.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ReportsIntegrated {
  constructor() {
    this.analyticsPath = path.join(process.cwd(), 'logs', 'analytics.json');
    this.tracesDir = path.join(process.cwd(), 'logs', 'traces');
    this.reportsDir = path.join(process.cwd(), 'logs', 'reports');
  }

  /**
   * Inicializa o sistema de relatórios
   */
  async initialize() {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
      console.log('✅ Sistema de relatórios inicializado');
    } catch (error) {
      console.error('❌ Erro ao inicializar relatórios:', error);
    }
  }

  /**
   * Carrega analytics do arquivo
   */
  async loadAnalytics() {
    try {
      const data = await fs.readFile(this.analyticsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return this.getEmptyAnalytics();
    }
  }

  /**
   * Retorna estrutura vazia de analytics
   */
  getEmptyAnalytics() {
    return {
      global: {
        totalPieces: 0,
        totalTokensInput: 0,
        totalTokensOutput: 0,
        totalCost: 0,
        totalTimeSaved: 0,
        totalDraftingTime: 0,
        quality: {
          avgScore: 0,
          approvalRate: 0,
          piecesApproved: 0,
          piecesRejected: 0
        }
      },
      users: {},
      pieceTypes: {},
      areas: {},
      daily: {},
      monthly: {}
    };
  }

  /**
   * Carrega traces de um período
   * @param {Date} startDate - Data inicial
   * @param {Date} endDate - Data final
   */
  async loadTraces(startDate, endDate) {
    try {
      const files = await fs.readdir(this.tracesDir);
      const traces = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.tracesDir, file);
        const data = await fs.readFile(filePath, 'utf8');
        const trace = JSON.parse(data);

        const traceDate = new Date(trace.startedAt);
        if (traceDate >= startDate && traceDate <= endDate) {
          traces.push(trace);
        }
      }

      return traces;
    } catch (error) {
      console.error('❌ Erro ao carregar traces:', error);
      return [];
    }
  }

  /**
   * Relatório de Uso Geral
   * @param {Object} params - Parâmetros do relatório
   * @returns {Object} - Relatório de uso
   */
  async getUsageReport(params = {}) {
    const analytics = await this.loadAnalytics();

    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias atrás
      endDate = new Date(),
      userId = null,
      groupBy = 'day' // 'day', 'week', 'month'
    } = params;

    const report = {
      generatedAt: new Date().toISOString(),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      summary: {
        totalPieces: analytics.global.totalPieces || 0,
        totalUsers: Object.keys(analytics.users || {}).length,
        avgPiecesPerUser: 0,
        totalTokens: (analytics.global.totalTokensInput || 0) + (analytics.global.totalTokensOutput || 0),
        totalCost: analytics.global.totalCost || 0,
        totalTimeSaved: analytics.global.totalTimeSaved || 0,
        totalDraftingTime: analytics.global.totalDraftingTime || 0
      },
      byPieceType: analytics.pieceTypes || {},
      byArea: analytics.areas || {},
      timeline: this.generateTimeline(analytics, groupBy, startDate, endDate),
      topUsers: this.getTopUsers(analytics.users || {}, 10)
    };

    // Calcular média de peças por usuário
    if (report.summary.totalUsers > 0) {
      report.summary.avgPiecesPerUser = Math.round(
        report.summary.totalPieces / report.summary.totalUsers
      );
    }

    return report;
  }

  /**
   * Relatório de Qualidade
   * @param {Object} params - Parâmetros do relatório
   */
  async getQualityReport(params = {}) {
    const analytics = await this.loadAnalytics();

    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        avgQualityScore: analytics.global.quality?.avgScore || 0,
        approvalRate: analytics.global.quality?.approvalRate || 0,
        totalReviews: analytics.global.quality?.totalReviews || 0,
        piecesApproved: analytics.global.quality?.piecesApproved || 0,
        piecesRejected: analytics.global.quality?.piecesRejected || 0,
        avgRevisionsNeeded: analytics.global.quality?.avgRevisionsNeeded || 0
      },
      byPieceType: this.getQualityByCategory(analytics.pieceTypes || {}),
      byArea: this.getQualityByCategory(analytics.areas || {}),
      qualityTrends: await this.getQualityTrends(analytics)
    };

    return report;
  }

  /**
   * Relatório de Tempo e Atividade
   * @param {Object} params - Parâmetros do relatório
   */
  async getTimeReport(params = {}) {
    const analytics = await this.loadAnalytics();
    const { userId = null } = params;

    const users = userId
      ? { [userId]: analytics.users[userId] }
      : analytics.users || {};

    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalActiveTime: 0, // minutos
        totalDraftingTime: analytics.global.totalDraftingTime || 0,
        avgSessionDuration: 0,
        avgPieceDraftingTime: 0,
        totalSessions: 0
      },
      byUser: {},
      loginPatterns: {
        byHour: {},
        byWeekday: {},
        peakHours: []
      }
    };

    // Agregar dados de todos os usuários
    let totalActiveTime = 0;
    let totalSessions = 0;
    let totalSessionDuration = 0;

    Object.entries(users).forEach(([uid, user]) => {
      if (!user.activity) return;

      totalActiveTime += user.activity.totalActiveTime || 0;
      totalSessions += user.activity.totalSessions || 0;
      totalSessionDuration += (user.activity.avgSessionDuration || 0) * (user.activity.totalSessions || 0);

      // Dados por usuário
      report.byUser[uid] = {
        name: user.name,
        totalActiveTime: user.activity.totalActiveTime || 0,
        totalDraftingTime: user.activity.totalDraftingTime || 0,
        avgSessionDuration: user.activity.avgSessionDuration || 0,
        avgPieceDraftingTime: user.activity.avgPieceDraftingTime || 0,
        totalSessions: user.activity.totalSessions || 0,
        lastLogin: user.activity.lastLogin,
        peakProductivityHour: user.activity.peakProductivityHour
      };

      // Agregar padrões de login
      if (user.activity.loginsByHour) {
        Object.entries(user.activity.loginsByHour).forEach(([hour, count]) => {
          report.loginPatterns.byHour[hour] = (report.loginPatterns.byHour[hour] || 0) + count;
        });
      }

      if (user.activity.loginsByWeekday) {
        Object.entries(user.activity.loginsByWeekday).forEach(([day, count]) => {
          report.loginPatterns.byWeekday[day] = (report.loginPatterns.byWeekday[day] || 0) + count;
        });
      }
    });

    // Calcular médias globais
    report.summary.totalActiveTime = totalActiveTime;
    report.summary.totalSessions = totalSessions;
    report.summary.avgSessionDuration = totalSessions > 0
      ? Math.round(totalSessionDuration / totalSessions)
      : 0;
    report.summary.avgPieceDraftingTime = analytics.global.totalPieces > 0
      ? Math.round(analytics.global.totalDraftingTime / analytics.global.totalPieces)
      : 0;

    // Identificar horários de pico
    const hourEntries = Object.entries(report.loginPatterns.byHour)
      .sort((a, b) => b[1] - a[1]);
    report.loginPatterns.peakHours = hourEntries.slice(0, 3).map(([hour, count]) => ({
      hour: parseInt(hour),
      logins: count
    }));

    return report;
  }

  /**
   * Relatório de Ferramentas Utilizadas
   */
  async getToolsReport(params = {}) {
    const { startDate, endDate } = params;

    const traces = startDate && endDate
      ? await this.loadTraces(new Date(startDate), new Date(endDate))
      : [];

    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalTraces: traces.length,
        avgDuration: 0,
        successRate: 0
      },
      layers: {
        layer1: { count: 0, avgDuration: 0, successRate: 0 },
        layer2: { count: 0, avgDuration: 0, successRate: 0 },
        layer3: { count: 0, avgDuration: 0, successRate: 0 },
        layer4: { count: 0, avgDuration: 0, successRate: 0 },
        layer45: { count: 0, avgDuration: 0, successRate: 0 },
        layer5: { count: 0, avgDuration: 0, successRate: 0 }
      },
      tools: {},
      errors: []
    };

    if (traces.length === 0) {
      return report;
    }

    let totalDuration = 0;
    let successCount = 0;

    traces.forEach(trace => {
      // Duração total
      if (trace.duration) {
        totalDuration += trace.duration;
      }

      // Taxa de sucesso
      if (trace.status === 'completed') {
        successCount++;
      }

      // Estatísticas por layer
      (trace.layers || []).forEach(layer => {
        const layerKey = `layer${layer.layerNumber}`;
        if (!report.layers[layerKey]) return;

        report.layers[layerKey].count++;

        if (layer.duration) {
          report.layers[layerKey].avgDuration =
            ((report.layers[layerKey].avgDuration * (report.layers[layerKey].count - 1)) + layer.duration) /
            report.layers[layerKey].count;
        }

        if (layer.status === 'completed') {
          report.layers[layerKey].successRate =
            ((report.layers[layerKey].successRate * (report.layers[layerKey].count - 1)) + 100) /
            report.layers[layerKey].count;
        }
      });

      // Erros
      if (trace.status === 'failed' || trace.status === 'error') {
        report.errors.push({
          traceId: trace.traceId,
          error: trace.error?.message || 'Unknown error',
          timestamp: trace.failedAt || trace.endedAt
        });
      }
    });

    // Médias globais
    report.summary.avgDuration = totalDuration / traces.length;
    report.summary.successRate = (successCount / traces.length) * 100;

    return report;
  }

  /**
   * Dashboard Executivo (resumo de todos os relatórios)
   */
  async getExecutiveDashboard(params = {}) {
    const [usage, quality, time, tools] = await Promise.all([
      this.getUsageReport(params),
      this.getQualityReport(params),
      this.getTimeReport(params),
      this.getToolsReport(params)
    ]);

    return {
      generatedAt: new Date().toISOString(),
      period: usage.period,
      usage: {
        totalPieces: usage.summary.totalPieces,
        totalUsers: usage.summary.totalUsers,
        avgPiecesPerUser: usage.summary.avgPiecesPerUser,
        totalCost: usage.summary.totalCost
      },
      quality: {
        avgScore: quality.summary.avgQualityScore,
        approvalRate: quality.summary.approvalRate,
        piecesApproved: quality.summary.piecesApproved,
        piecesRejected: quality.summary.piecesRejected
      },
      time: {
        totalActiveTime: time.summary.totalActiveTime,
        avgSessionDuration: time.summary.avgSessionDuration,
        avgPieceDraftingTime: time.summary.avgPieceDraftingTime,
        peakHours: time.loginPatterns.peakHours
      },
      tools: {
        totalTraces: tools.summary.totalTraces,
        avgDuration: tools.summary.avgDuration,
        successRate: tools.summary.successRate
      },
      topUsers: usage.topUsers,
      topPieceTypes: this.getTopItems(usage.byPieceType, 5)
    };
  }

  /**
   * Helpers
   */

  generateTimeline(analytics, groupBy, startDate, endDate) {
    // Simplificado - retorna dados diários se disponível
    return analytics.daily || {};
  }

  getTopUsers(users, limit = 10) {
    return Object.entries(users)
      .map(([userId, user]) => ({
        userId,
        name: user.name,
        totalPieces: user.totalPieces || 0,
        totalCost: user.totalCost || 0
      }))
      .sort((a, b) => b.totalPieces - a.totalPieces)
      .slice(0, limit);
  }

  getQualityByCategory(categories) {
    const result = {};
    Object.entries(categories).forEach(([category, data]) => {
      if (data.quality) {
        result[category] = {
          avgScore: data.quality.avgScore || 0,
          approvalRate: data.quality.approvalRate || 0
        };
      }
    });
    return result;
  }

  async getQualityTrends(analytics) {
    // Simplificado - retornar dados mensais se disponível
    return analytics.monthly || {};
  }

  getTopItems(items, limit = 5) {
    return Object.entries(items)
      .map(([key, value]) => ({
        name: key,
        count: value.totalPieces || value.count || 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Exporta relatório em JSON
   */
  async exportJSON(report, filename) {
    const filePath = path.join(this.reportsDir, `${filename}.json`);
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf8');
    return filePath;
  }

  /**
   * Exporta relatório em formato de texto
   */
  async exportText(report, filename) {
    const filePath = path.join(this.reportsDir, `${filename}.txt`);
    const text = this.formatReportAsText(report);
    await fs.writeFile(filePath, text, 'utf8');
    return filePath;
  }

  formatReportAsText(report) {
    let text = '';
    text += '═══════════════════════════════════════\n';
    text += `RELATÓRIO GERADO EM: ${report.generatedAt}\n`;
    text += '═══════════════════════════════════════\n\n';

    // Formatar recursivamente
    const formatObject = (obj, indent = 0) => {
      let result = '';
      const spaces = '  '.repeat(indent);

      Object.entries(obj).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result += `${spaces}${key}:\n`;
          result += formatObject(value, indent + 1);
        } else if (Array.isArray(value)) {
          result += `${spaces}${key}: [${value.length} items]\n`;
        } else {
          result += `${spaces}${key}: ${value}\n`;
        }
      });

      return result;
    };

    text += formatObject(report);
    return text;
  }
}

// Exportar instância singleton
const reportsIntegrated = new ReportsIntegrated();

export default reportsIntegrated;
