/**
 * ROM Agent - Sistema de Analytics e Relatórios COMPLETO
 *
 * Versão 3.0 - Com rastreamento de sessões, atividade, tempo de redação,
 * cruzamento de dados, exportação e análise por IA
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Arquivos de dados
const DATA_DIR = path.join(__dirname, '..', 'logs');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');
const PIECES_FILE = path.join(DATA_DIR, 'pieces_history.json');
const QUALITY_FILE = path.join(DATA_DIR, 'quality_metrics.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const ACTIVITY_FILE = path.join(DATA_DIR, 'activity.json');
const EXPORTS_DIR = path.join(DATA_DIR, 'exports');

// Garantir que os diretórios existem
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

// ============================================================
// ESTRUTURAS DE DADOS
// ============================================================

function getEmptyAnalytics() {
  return {
    version: '3.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    global: {
      totalPieces: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      totalCost: 0,
      totalTimeSaved: 0,
      totalDraftingTime: 0, // tempo total gasto redigindo
      avgPieceTime: 0,
      quality: {
        avgScore: 0,
        totalReviews: 0,
        approvalRate: 0,
        avgRevisionsNeeded: 0,
        clientSatisfaction: 0,
        piecesApproved: 0,
        piecesRejected: 0,
        piecesWithFeedback: 0
      }
    },

    users: {},
    pieceTypes: {},
    areas: {},
    clients: {},
    tribunals: {},
    daily: {},
    monthly: {}
  };
}

function getEmptyUserStats() {
  return {
    name: '',
    oab: '',
    email: '',
    createdAt: new Date().toISOString(),

    // Métricas de produção
    totalPieces: 0,
    totalTokensInput: 0,
    totalTokensOutput: 0,
    totalCost: 0,
    totalTimeSaved: 0,

    // Métricas de tempo e atividade
    activity: {
      totalSessions: 0,
      totalActiveTime: 0,      // minutos ativos
      totalIdleTime: 0,        // minutos ociosos
      totalDraftingTime: 0,    // minutos redigindo
      avgSessionDuration: 0,   // duração média de sessão
      avgPieceDraftingTime: 0, // tempo médio por peça
      longestSession: 0,
      shortestSession: 0,
      lastLogin: null,
      lastActivity: null,
      loginsByHour: {},        // distribuição de logins por hora
      loginsByWeekday: {},     // distribuição por dia da semana
      peakProductivityHour: null,
      avgPiecesPerSession: 0,
      focusScore: 0            // % tempo ativo vs total
    },

    // Métricas de qualidade
    quality: {
      avgScore: 0,
      totalScores: 0,
      sumScores: 0,
      approvalRate: 0,
      piecesApproved: 0,
      piecesRejected: 0,
      piecesRevised: 0,
      avgRevisionsNeeded: 0,
      totalRevisions: 0,
      clientFeedbacks: 0,
      avgClientSatisfaction: 0,
      sumClientSatisfaction: 0,
      excellentPieces: 0,
      goodPieces: 0,
      regularPieces: 0,
      needsImprovement: 0,
      errorTypes: {},         // tipos de erro mais comuns
      strengthAreas: [],      // áreas fortes
      improvementAreas: []    // áreas a melhorar
    },

    // Métricas de performance calculadas por IA
    aiAnalysis: {
      lastAnalyzed: null,
      dedicationScore: 0,      // 0-100
      excellenceScore: 0,      // 0-100
      consistencyScore: 0,     // 0-100
      efficiencyScore: 0,      // 0-100
      overallPerformance: 0,   // 0-100
      trend: 'stable',         // improving, stable, declining
      recommendations: [],
      strengths: [],
      weaknesses: [],
      performanceLevel: ''     // Excelente, Bom, Regular, etc
    },

    piecesByType: {},
    piecesByArea: {},
    piecesByTier: {},
    piecesByClient: {},
    piecesByTribunal: {},
    piecesByStatus: {},
    daily: {},
    monthly: {},
    sessions: []               // IDs das sessões
  };
}

function getEmptySessions() {
  return {
    sessions: [],
    activeSessions: {}
  };
}

function getEmptyActivity() {
  return {
    events: [],
    draftingSessions: {}
  };
}

function getEmptyQualityMetrics() {
  return {
    version: '1.0',
    evaluations: [],
    feedbacks: []
  };
}

// ============================================================
// FUNÇÕES DE CARREGAMENTO/SALVAMENTO
// ============================================================

function loadAnalytics() {
  try {
    if (fs.existsSync(ANALYTICS_FILE)) {
      const data = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
      if (!data.global.quality) {
        data.global.quality = getEmptyAnalytics().global.quality;
      }
      return data;
    }
  } catch (e) {
    console.error('Erro ao carregar analytics:', e.message);
  }
  return getEmptyAnalytics();
}

function saveAnalytics(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2));
}

function loadPiecesHistory() {
  try {
    if (fs.existsSync(PIECES_FILE)) {
      return JSON.parse(fs.readFileSync(PIECES_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Erro ao carregar histórico:', e.message);
  }
  return { pieces: [] };
}

function savePiecesHistory(data) {
  fs.writeFileSync(PIECES_FILE, JSON.stringify(data, null, 2));
}

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Erro ao carregar sessões:', e.message);
  }
  return getEmptySessions();
}

function saveSessions(data) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
}

function loadActivity() {
  try {
    if (fs.existsSync(ACTIVITY_FILE)) {
      return JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Erro ao carregar atividade:', e.message);
  }
  return getEmptyActivity();
}

function saveActivity(data) {
  fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(data, null, 2));
}

function loadQualityMetrics() {
  try {
    if (fs.existsSync(QUALITY_FILE)) {
      return JSON.parse(fs.readFileSync(QUALITY_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Erro ao carregar métricas de qualidade:', e.message);
  }
  return getEmptyQualityMetrics();
}

function saveQualityMetrics(data) {
  fs.writeFileSync(QUALITY_FILE, JSON.stringify(data, null, 2));
}

// ============================================================
// RASTREAMENTO DE SESSÕES
// ============================================================

/**
 * Inicia uma sessão de login
 */
export function iniciarSessao(userId, userData = {}) {
  const sessions = loadSessions();
  const analytics = loadAnalytics();

  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();
  const hour = now.getHours();
  const weekday = now.toLocaleDateString('pt-BR', { weekday: 'long' });

  const session = {
    id: sessionId,
    userId,
    userName: userData.name || userId,
    startTime: now.toISOString(),
    endTime: null,
    duration: 0,           // minutos
    activeTime: 0,         // minutos ativos
    idleTime: 0,           // minutos ociosos
    piecesCreated: 0,
    piecesIds: [],
    activities: [],
    breaks: [],            // pausas
    status: 'active'
  };

  sessions.sessions.push(session);
  sessions.activeSessions[userId] = sessionId;
  saveSessions(sessions);

  // Atualizar estatísticas do usuário
  if (!analytics.users[userId]) {
    analytics.users[userId] = getEmptyUserStats();
    analytics.users[userId].name = userData.name;
    analytics.users[userId].oab = userData.oab;
    analytics.users[userId].email = userData.email;
  }

  const user = analytics.users[userId];
  if (!user.activity) user.activity = getEmptyUserStats().activity;

  user.activity.totalSessions++;
  user.activity.lastLogin = now.toISOString();

  // Distribuição por hora
  if (!user.activity.loginsByHour[hour]) {
    user.activity.loginsByHour[hour] = 0;
  }
  user.activity.loginsByHour[hour]++;

  // Distribuição por dia da semana
  if (!user.activity.loginsByWeekday[weekday]) {
    user.activity.loginsByWeekday[weekday] = 0;
  }
  user.activity.loginsByWeekday[weekday]++;

  if (!user.sessions) user.sessions = [];
  user.sessions.push(sessionId);

  saveAnalytics(analytics);

  return { sessionId, success: true };
}

/**
 * Encerra uma sessão
 */
export function encerrarSessao(userId) {
  const sessions = loadSessions();
  const analytics = loadAnalytics();

  const sessionId = sessions.activeSessions[userId];
  if (!sessionId) {
    return { success: false, error: 'Nenhuma sessão ativa encontrada' };
  }

  const session = sessions.sessions.find(s => s.id === sessionId);
  if (!session) {
    return { success: false, error: 'Sessão não encontrada' };
  }

  const now = new Date();
  const startTime = new Date(session.startTime);
  const duration = Math.round((now - startTime) / 60000); // em minutos

  session.endTime = now.toISOString();
  session.duration = duration;
  session.status = 'completed';

  // Calcular tempo ativo vs ocioso
  session.activeTime = session.activities.reduce((acc, act) => {
    if (act.type === 'active') {
      return acc + (act.duration || 0);
    }
    return acc;
  }, 0);
  session.idleTime = duration - session.activeTime;

  delete sessions.activeSessions[userId];
  saveSessions(sessions);

  // Atualizar estatísticas do usuário
  const user = analytics.users[userId];
  if (user && user.activity) {
    user.activity.totalActiveTime += session.activeTime;
    user.activity.totalIdleTime += session.idleTime;
    user.activity.lastActivity = now.toISOString();

    // Calcular média de duração
    const allUserSessions = sessions.sessions.filter(s => s.userId === userId && s.status === 'completed');
    const totalDuration = allUserSessions.reduce((acc, s) => acc + s.duration, 0);
    user.activity.avgSessionDuration = allUserSessions.length > 0
      ? Math.round(totalDuration / allUserSessions.length)
      : 0;

    // Maior e menor sessão
    const durations = allUserSessions.map(s => s.duration);
    if (durations.length > 0) {
      user.activity.longestSession = Math.max(...durations);
      user.activity.shortestSession = Math.min(...durations);
    }

    // Peças por sessão
    const totalPiecesInSessions = allUserSessions.reduce((acc, s) => acc + s.piecesCreated, 0);
    user.activity.avgPiecesPerSession = allUserSessions.length > 0
      ? (totalPiecesInSessions / allUserSessions.length).toFixed(1)
      : 0;

    // Focus score (tempo ativo / tempo total)
    const totalTime = user.activity.totalActiveTime + user.activity.totalIdleTime;
    user.activity.focusScore = totalTime > 0
      ? Math.round((user.activity.totalActiveTime / totalTime) * 100)
      : 0;

    saveAnalytics(analytics);
  }

  return { sessionId, duration, success: true };
}

/**
 * Registra atividade durante sessão
 */
export function registrarAtividade(userId, atividade) {
  const sessions = loadSessions();
  const activity = loadActivity();

  const sessionId = sessions.activeSessions[userId];
  const session = sessionId ? sessions.sessions.find(s => s.id === sessionId) : null;

  const evento = {
    id: `evt_${Date.now()}`,
    userId,
    sessionId,
    timestamp: new Date().toISOString(),
    type: atividade.type,  // 'active', 'idle', 'drafting', 'reviewing', 'break'
    description: atividade.description,
    duration: atividade.duration || 0,
    metadata: atividade.metadata || {}
  };

  activity.events.push(evento);

  if (session) {
    session.activities.push(evento);
    saveSessions(sessions);
  }

  saveActivity(activity);

  return { eventId: evento.id, success: true };
}

// ============================================================
// RASTREAMENTO DE TEMPO DE REDAÇÃO
// ============================================================

/**
 * Inicia o cronômetro de redação de uma peça
 */
export function iniciarRedacao(userId, pieceData) {
  const activity = loadActivity();

  const draftingId = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const drafting = {
    id: draftingId,
    userId,
    pieceType: pieceData.pieceType,
    pieceTitle: pieceData.pieceTitle,
    client: pieceData.client,
    startTime: new Date().toISOString(),
    endTime: null,
    totalTime: 0,          // minutos totais
    activeTime: 0,         // minutos ativos
    pauseTime: 0,          // minutos em pausa
    pauses: [],            // {start, end, duration, reason}
    status: 'drafting',
    events: []
  };

  activity.draftingSessions[draftingId] = drafting;
  saveActivity(activity);

  return { draftingId, success: true };
}

/**
 * Pausa a redação
 */
export function pausarRedacao(draftingId, reason = '') {
  const activity = loadActivity();
  const drafting = activity.draftingSessions[draftingId];

  if (!drafting) {
    return { success: false, error: 'Sessão de redação não encontrada' };
  }

  if (drafting.status !== 'drafting') {
    return { success: false, error: 'Redação não está ativa' };
  }

  const pause = {
    start: new Date().toISOString(),
    end: null,
    duration: 0,
    reason
  };

  drafting.pauses.push(pause);
  drafting.status = 'paused';
  drafting.events.push({
    type: 'pause',
    timestamp: pause.start,
    reason
  });

  saveActivity(activity);

  return { success: true };
}

/**
 * Retoma a redação
 */
export function retomarRedacao(draftingId) {
  const activity = loadActivity();
  const drafting = activity.draftingSessions[draftingId];

  if (!drafting) {
    return { success: false, error: 'Sessão de redação não encontrada' };
  }

  if (drafting.status !== 'paused') {
    return { success: false, error: 'Redação não está pausada' };
  }

  const lastPause = drafting.pauses[drafting.pauses.length - 1];
  if (lastPause && !lastPause.end) {
    const now = new Date();
    lastPause.end = now.toISOString();
    lastPause.duration = Math.round((now - new Date(lastPause.start)) / 60000);
    drafting.pauseTime += lastPause.duration;
  }

  drafting.status = 'drafting';
  drafting.events.push({
    type: 'resume',
    timestamp: new Date().toISOString()
  });

  saveActivity(activity);

  return { success: true };
}

/**
 * Finaliza a redação e registra o tempo
 */
export function finalizarRedacao(draftingId) {
  const activity = loadActivity();
  const analytics = loadAnalytics();
  const drafting = activity.draftingSessions[draftingId];

  if (!drafting) {
    return { success: false, error: 'Sessão de redação não encontrada' };
  }

  // Encerrar pausas pendentes
  const lastPause = drafting.pauses[drafting.pauses.length - 1];
  if (lastPause && !lastPause.end) {
    const now = new Date();
    lastPause.end = now.toISOString();
    lastPause.duration = Math.round((now - new Date(lastPause.start)) / 60000);
    drafting.pauseTime += lastPause.duration;
  }

  const now = new Date();
  const startTime = new Date(drafting.startTime);
  drafting.endTime = now.toISOString();
  drafting.totalTime = Math.round((now - startTime) / 60000);
  drafting.activeTime = drafting.totalTime - drafting.pauseTime;
  drafting.status = 'completed';

  saveActivity(activity);

  // Atualizar estatísticas do usuário
  const user = analytics.users[drafting.userId];
  if (user) {
    if (!user.activity) user.activity = getEmptyUserStats().activity;
    user.activity.totalDraftingTime += drafting.activeTime;

    // Calcular média de tempo por peça
    const completedDrafts = Object.values(activity.draftingSessions)
      .filter(d => d.userId === drafting.userId && d.status === 'completed');
    const totalDraftTime = completedDrafts.reduce((acc, d) => acc + d.activeTime, 0);
    user.activity.avgPieceDraftingTime = completedDrafts.length > 0
      ? Math.round(totalDraftTime / completedDrafts.length)
      : 0;

    saveAnalytics(analytics);
  }

  return {
    draftingId,
    totalTime: drafting.totalTime,
    activeTime: drafting.activeTime,
    pauseTime: drafting.pauseTime,
    pauses: drafting.pauses.length,
    success: true
  };
}

// ============================================================
// REGISTRO DE PEÇAS (atualizado)
// ============================================================

/**
 * Registra uma peça gerada
 */
export function registrarPeca(params) {
  const {
    userId,
    userName,
    userOab,
    userEmail,
    pieceType,
    pieceTitle,
    area,
    tier,
    client,
    clientId,
    processNumber,
    tribunal,
    model,
    inputTokens,
    outputTokens,
    cost,
    timeSavedMinutes = 60,
    status = 'gerada',
    draftingId = null,      // ID da sessão de redação
    draftingTime = null,    // tempo de redação em minutos
    qualityScore = null,
    revisionsCount = 0,
    approved = null,
    clientSatisfaction = null,
    feedbackNotes = '',
    errorTypes = [],
    metadata = {}
  } = params;

  const analytics = loadAnalytics();
  const history = loadPiecesHistory();
  const sessions = loadSessions();
  const activity = loadActivity();

  const today = new Date().toISOString().split('T')[0];
  const month = today.substring(0, 7);
  const pieceId = `piece_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Obter dados de redação se disponíveis
  let actualDraftingTime = draftingTime;
  if (draftingId && activity.draftingSessions[draftingId]) {
    const drafting = activity.draftingSessions[draftingId];
    actualDraftingTime = drafting.activeTime || drafting.totalTime;
  }

  const pieceRecord = {
    id: pieceId,
    userId,
    userName,
    pieceType,
    pieceTitle,
    area,
    tier,
    client,
    clientId,
    processNumber,
    tribunal,
    model,
    inputTokens,
    outputTokens,
    cost,
    timeSavedMinutes,
    status,
    draftingId,
    draftingTime: actualDraftingTime,
    quality: {
      score: qualityScore,
      revisionsCount,
      approved,
      clientSatisfaction,
      feedbackNotes,
      errorTypes,
      evaluatedAt: qualityScore !== null ? new Date().toISOString() : null
    },
    metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  history.pieces.push(pieceRecord);
  savePiecesHistory(history);

  // Atualizar analytics globais
  analytics.global.totalPieces++;
  analytics.global.totalTokensInput += inputTokens;
  analytics.global.totalTokensOutput += outputTokens;
  analytics.global.totalCost += cost;
  analytics.global.totalTimeSaved += timeSavedMinutes;
  if (actualDraftingTime) {
    analytics.global.totalDraftingTime += actualDraftingTime;
  }

  // Atualizar por usuário
  if (!analytics.users[userId]) {
    analytics.users[userId] = getEmptyUserStats();
    analytics.users[userId].name = userName;
    analytics.users[userId].oab = userOab;
    analytics.users[userId].email = userEmail;
  }
  const user = analytics.users[userId];
  user.totalPieces++;
  user.totalTokensInput += inputTokens;
  user.totalTokensOutput += outputTokens;
  user.totalCost += cost;
  user.totalTimeSaved += timeSavedMinutes;

  if (!user.activity) user.activity = getEmptyUserStats().activity;
  if (actualDraftingTime) {
    user.activity.totalDraftingTime += actualDraftingTime;
  }

  if (!user.quality) user.quality = getEmptyUserStats().quality;

  // Atualizar sessão ativa
  const sessionId = sessions.activeSessions[userId];
  if (sessionId) {
    const session = sessions.sessions.find(s => s.id === sessionId);
    if (session) {
      session.piecesCreated++;
      session.piecesIds.push(pieceId);
      saveSessions(sessions);
    }
  }

  // Por tipo de peça (usuário)
  if (!user.piecesByType[pieceType]) {
    user.piecesByType[pieceType] = {
      count: 0, cost: 0, tokens: 0, avgScore: 0, totalScore: 0, scored: 0,
      avgDraftingTime: 0, totalDraftingTime: 0
    };
  }
  user.piecesByType[pieceType].count++;
  user.piecesByType[pieceType].cost += cost;
  user.piecesByType[pieceType].tokens += inputTokens + outputTokens;
  if (actualDraftingTime) {
    user.piecesByType[pieceType].totalDraftingTime += actualDraftingTime;
    user.piecesByType[pieceType].avgDraftingTime =
      user.piecesByType[pieceType].totalDraftingTime / user.piecesByType[pieceType].count;
  }

  // Por área (usuário)
  if (area) {
    if (!user.piecesByArea[area]) {
      user.piecesByArea[area] = { count: 0, cost: 0, avgScore: 0, totalScore: 0, scored: 0 };
    }
    user.piecesByArea[area].count++;
    user.piecesByArea[area].cost += cost;
  }

  // Por tier (usuário)
  if (!user.piecesByTier[tier]) {
    user.piecesByTier[tier] = { count: 0, cost: 0 };
  }
  user.piecesByTier[tier].count++;
  user.piecesByTier[tier].cost += cost;

  // Por cliente (usuário)
  if (client) {
    if (!user.piecesByClient[client]) {
      user.piecesByClient[client] = { count: 0, cost: 0, pieces: [], avgScore: 0, totalScore: 0, scored: 0 };
    }
    user.piecesByClient[client].count++;
    user.piecesByClient[client].cost += cost;
    user.piecesByClient[client].pieces.push(pieceId);
  }

  // Por tribunal
  if (tribunal) {
    if (!user.piecesByTribunal) user.piecesByTribunal = {};
    if (!user.piecesByTribunal[tribunal]) {
      user.piecesByTribunal[tribunal] = { count: 0, cost: 0, avgScore: 0, totalScore: 0, scored: 0 };
    }
    user.piecesByTribunal[tribunal].count++;
    user.piecesByTribunal[tribunal].cost += cost;
  }

  // Por status
  if (!user.piecesByStatus) user.piecesByStatus = {};
  if (!user.piecesByStatus[status]) {
    user.piecesByStatus[status] = { count: 0 };
  }
  user.piecesByStatus[status].count++;

  // Diário (usuário)
  if (!user.daily[today]) {
    user.daily[today] = { count: 0, cost: 0, tokens: 0, avgScore: 0, totalScore: 0, scored: 0, draftingTime: 0 };
  }
  user.daily[today].count++;
  user.daily[today].cost += cost;
  user.daily[today].tokens += inputTokens + outputTokens;
  if (actualDraftingTime) user.daily[today].draftingTime += actualDraftingTime;

  // Mensal (usuário)
  if (!user.monthly[month]) {
    user.monthly[month] = { count: 0, cost: 0, tokens: 0, timeSaved: 0, avgScore: 0, totalScore: 0, scored: 0, draftingTime: 0 };
  }
  user.monthly[month].count++;
  user.monthly[month].cost += cost;
  user.monthly[month].tokens += inputTokens + outputTokens;
  user.monthly[month].timeSaved += timeSavedMinutes;
  if (actualDraftingTime) user.monthly[month].draftingTime += actualDraftingTime;

  // Global por tipo de peça
  if (!analytics.pieceTypes[pieceType]) {
    analytics.pieceTypes[pieceType] = {
      count: 0, cost: 0, avgTokens: 0, totalTokens: 0,
      avgScore: 0, totalScore: 0, scored: 0,
      approvalRate: 0, approved: 0, rejected: 0,
      avgDraftingTime: 0, totalDraftingTime: 0
    };
  }
  analytics.pieceTypes[pieceType].count++;
  analytics.pieceTypes[pieceType].cost += cost;
  analytics.pieceTypes[pieceType].totalTokens += inputTokens + outputTokens;
  analytics.pieceTypes[pieceType].avgTokens =
    analytics.pieceTypes[pieceType].totalTokens / analytics.pieceTypes[pieceType].count;
  if (actualDraftingTime) {
    analytics.pieceTypes[pieceType].totalDraftingTime += actualDraftingTime;
    analytics.pieceTypes[pieceType].avgDraftingTime =
      analytics.pieceTypes[pieceType].totalDraftingTime / analytics.pieceTypes[pieceType].count;
  }

  // Global por área
  if (area) {
    if (!analytics.areas[area]) {
      analytics.areas[area] = { count: 0, cost: 0, avgScore: 0, totalScore: 0, scored: 0 };
    }
    analytics.areas[area].count++;
    analytics.areas[area].cost += cost;
  }

  // Global por cliente
  if (client) {
    if (!analytics.clients[client]) {
      analytics.clients[client] = { id: clientId, count: 0, cost: 0, users: [], avgSatisfaction: 0, totalSatisfaction: 0, feedbacks: 0 };
    }
    analytics.clients[client].count++;
    analytics.clients[client].cost += cost;
    if (!analytics.clients[client].users.includes(userId)) {
      analytics.clients[client].users.push(userId);
    }
  }

  // Por tribunal (global)
  if (tribunal) {
    if (!analytics.tribunals) analytics.tribunals = {};
    if (!analytics.tribunals[tribunal]) {
      analytics.tribunals[tribunal] = { count: 0, cost: 0, avgScore: 0, totalScore: 0, scored: 0 };
    }
    analytics.tribunals[tribunal].count++;
    analytics.tribunals[tribunal].cost += cost;
  }

  // Diário (global)
  if (!analytics.daily[today]) {
    analytics.daily[today] = { count: 0, cost: 0, users: [], avgScore: 0, totalScore: 0, scored: 0, draftingTime: 0 };
  }
  analytics.daily[today].count++;
  analytics.daily[today].cost += cost;
  if (!analytics.daily[today].users.includes(userId)) {
    analytics.daily[today].users.push(userId);
  }
  if (actualDraftingTime) analytics.daily[today].draftingTime += actualDraftingTime;

  // Mensal (global)
  if (!analytics.monthly[month]) {
    analytics.monthly[month] = { count: 0, cost: 0, users: [], timeSaved: 0, avgScore: 0, totalScore: 0, scored: 0, draftingTime: 0 };
  }
  analytics.monthly[month].count++;
  analytics.monthly[month].cost += cost;
  analytics.monthly[month].timeSaved += timeSavedMinutes;
  if (!analytics.monthly[month].users.includes(userId)) {
    analytics.monthly[month].users.push(userId);
  }
  if (actualDraftingTime) analytics.monthly[month].draftingTime += actualDraftingTime;

  saveAnalytics(analytics);

  return { pieceId, success: true };
}

/**
 * Avalia qualidade de uma peça
 */
export function avaliarPeca(pieceId, avaliacao) {
  const {
    score,
    approved,
    revisionsNeeded,
    clientSatisfaction,
    feedbackNotes,
    errorTypes = [],
    evaluatedBy
  } = avaliacao;

  const history = loadPiecesHistory();
  const analytics = loadAnalytics();
  const qualityMetrics = loadQualityMetrics();

  const piece = history.pieces.find(p => p.id === pieceId);
  if (!piece) {
    return { success: false, error: 'Peça não encontrada' };
  }

  piece.quality = {
    ...piece.quality,
    score,
    approved,
    revisionsCount: revisionsNeeded || piece.quality?.revisionsCount || 0,
    clientSatisfaction,
    feedbackNotes,
    errorTypes,
    evaluatedBy,
    evaluatedAt: new Date().toISOString()
  };
  piece.updatedAt = new Date().toISOString();
  if (approved === true) piece.status = 'aprovada';
  if (approved === false) piece.status = 'rejeitada';

  savePiecesHistory(history);

  qualityMetrics.evaluations.push({
    pieceId,
    pieceType: piece.pieceType,
    userId: piece.userId,
    score,
    approved,
    revisionsNeeded,
    clientSatisfaction,
    errorTypes,
    evaluatedBy,
    evaluatedAt: new Date().toISOString()
  });
  saveQualityMetrics(qualityMetrics);

  // Atualizar analytics do usuário
  const user = analytics.users[piece.userId];
  if (user) {
    if (!user.quality) user.quality = getEmptyUserStats().quality;

    if (score !== null && score !== undefined) {
      user.quality.totalScores++;
      user.quality.sumScores += score;
      user.quality.avgScore = user.quality.sumScores / user.quality.totalScores;

      if (score >= 9) user.quality.excellentPieces++;
      else if (score >= 7) user.quality.goodPieces++;
      else if (score >= 5) user.quality.regularPieces++;
      else user.quality.needsImprovement++;

      if (user.piecesByType[piece.pieceType]) {
        user.piecesByType[piece.pieceType].scored++;
        user.piecesByType[piece.pieceType].totalScore += score;
        user.piecesByType[piece.pieceType].avgScore =
          user.piecesByType[piece.pieceType].totalScore / user.piecesByType[piece.pieceType].scored;
      }
    }

    if (approved === true) {
      user.quality.piecesApproved++;
    } else if (approved === false) {
      user.quality.piecesRejected++;
    }

    const totalJudged = user.quality.piecesApproved + user.quality.piecesRejected;
    if (totalJudged > 0) {
      user.quality.approvalRate = (user.quality.piecesApproved / totalJudged) * 100;
    }

    if (revisionsNeeded !== null && revisionsNeeded !== undefined) {
      user.quality.piecesRevised++;
      user.quality.totalRevisions += revisionsNeeded;
      user.quality.avgRevisionsNeeded = user.quality.totalRevisions / user.quality.piecesRevised;
    }

    if (clientSatisfaction !== null && clientSatisfaction !== undefined) {
      user.quality.clientFeedbacks++;
      user.quality.sumClientSatisfaction += clientSatisfaction;
      user.quality.avgClientSatisfaction = user.quality.sumClientSatisfaction / user.quality.clientFeedbacks;
    }

    // Rastrear tipos de erro
    if (errorTypes && errorTypes.length > 0) {
      if (!user.quality.errorTypes) user.quality.errorTypes = {};
      for (const err of errorTypes) {
        if (!user.quality.errorTypes[err]) user.quality.errorTypes[err] = 0;
        user.quality.errorTypes[err]++;
      }
    }
  }

  // Atualizar analytics globais
  if (score !== null && score !== undefined) {
    analytics.global.quality.totalReviews++;
    const totalScore = (analytics.global.quality.avgScore * (analytics.global.quality.totalReviews - 1)) + score;
    analytics.global.quality.avgScore = totalScore / analytics.global.quality.totalReviews;

    if (analytics.pieceTypes[piece.pieceType]) {
      analytics.pieceTypes[piece.pieceType].scored++;
      analytics.pieceTypes[piece.pieceType].totalScore += score;
      analytics.pieceTypes[piece.pieceType].avgScore =
        analytics.pieceTypes[piece.pieceType].totalScore / analytics.pieceTypes[piece.pieceType].scored;
    }

    if (piece.area && analytics.areas[piece.area]) {
      analytics.areas[piece.area].scored++;
      analytics.areas[piece.area].totalScore += score;
      analytics.areas[piece.area].avgScore =
        analytics.areas[piece.area].totalScore / analytics.areas[piece.area].scored;
    }
  }

  if (approved === true) {
    analytics.global.quality.piecesApproved++;
    if (analytics.pieceTypes[piece.pieceType]) {
      analytics.pieceTypes[piece.pieceType].approved++;
    }
  } else if (approved === false) {
    analytics.global.quality.piecesRejected++;
    if (analytics.pieceTypes[piece.pieceType]) {
      analytics.pieceTypes[piece.pieceType].rejected++;
    }
  }

  const totalGlobal = analytics.global.quality.piecesApproved + analytics.global.quality.piecesRejected;
  if (totalGlobal > 0) {
    analytics.global.quality.approvalRate = (analytics.global.quality.piecesApproved / totalGlobal) * 100;
  }

  for (const [type, stats] of Object.entries(analytics.pieceTypes)) {
    const total = (stats.approved || 0) + (stats.rejected || 0);
    if (total > 0) {
      stats.approvalRate = ((stats.approved || 0) / total) * 100;
    }
  }

  if (clientSatisfaction !== null && clientSatisfaction !== undefined) {
    analytics.global.quality.piecesWithFeedback++;
    const totalSat = (analytics.global.quality.clientSatisfaction * (analytics.global.quality.piecesWithFeedback - 1)) + clientSatisfaction;
    analytics.global.quality.clientSatisfaction = totalSat / analytics.global.quality.piecesWithFeedback;

    if (piece.client && analytics.clients[piece.client]) {
      analytics.clients[piece.client].feedbacks++;
      analytics.clients[piece.client].totalSatisfaction += clientSatisfaction;
      analytics.clients[piece.client].avgSatisfaction =
        analytics.clients[piece.client].totalSatisfaction / analytics.clients[piece.client].feedbacks;
    }
  }

  saveAnalytics(analytics);

  return { success: true };
}

// ============================================================
// ANÁLISE POR IA - PERFORMANCE E DEDICAÇÃO
// ============================================================

/**
 * Analisa performance de um usuário usando métricas cruzadas
 */
export function analisarPerformanceIA(userId) {
  const analytics = loadAnalytics();
  const history = loadPiecesHistory();
  const sessions = loadSessions();
  const activity = loadActivity();

  const user = analytics.users[userId];
  if (!user) {
    return { success: false, error: 'Usuário não encontrado' };
  }

  const userPieces = history.pieces.filter(p => p.userId === userId);
  const userSessions = sessions.sessions.filter(s => s.userId === userId);
  const userDrafts = Object.values(activity.draftingSessions || {}).filter(d => d.userId === userId);

  // === CÁLCULO DE SCORES ===

  // 1. DEDICAÇÃO (baseado em tempo e consistência de uso)
  let dedicationScore = 0;
  if (user.activity) {
    const a = user.activity;
    // Fator de sessões regulares
    const sessionsPerMonth = a.totalSessions / Math.max(1, Object.keys(user.monthly || {}).length);
    const sessionFactor = Math.min(1, sessionsPerMonth / 20) * 30; // até 30 pts

    // Fator de tempo ativo
    const focusFactor = (a.focusScore || 0) * 0.3; // até 30 pts

    // Fator de consistência (desvio padrão baixo = mais consistente)
    const dailyCounts = Object.values(user.daily || {}).map(d => d.count);
    const avgDaily = dailyCounts.reduce((a, b) => a + b, 0) / Math.max(1, dailyCounts.length);
    const variance = dailyCounts.reduce((sum, v) => sum + Math.pow(v - avgDaily, 2), 0) / Math.max(1, dailyCounts.length);
    const stdDev = Math.sqrt(variance);
    const consistencyFactor = Math.max(0, 20 - stdDev * 2); // até 20 pts

    // Fator de atividade recente
    const lastActivity = a.lastActivity ? new Date(a.lastActivity) : new Date(0);
    const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
    const recencyFactor = Math.max(0, 20 - daysSinceActivity * 2); // até 20 pts

    dedicationScore = Math.round(sessionFactor + focusFactor + consistencyFactor + recencyFactor);
  }

  // 2. EXCELÊNCIA (baseado em qualidade)
  let excellenceScore = 0;
  if (user.quality && user.quality.totalScores > 0) {
    const q = user.quality;
    // Nota média (até 50 pts)
    const scoreFactor = (q.avgScore / 10) * 50;

    // Taxa de aprovação (até 30 pts)
    const approvalFactor = (q.approvalRate / 100) * 30;

    // Peças excelentes vs total (até 20 pts)
    const excellentRatio = q.excellentPieces / Math.max(1, q.totalScores);
    const excellentFactor = excellentRatio * 20;

    excellenceScore = Math.round(scoreFactor + approvalFactor + excellentFactor);
  }

  // 3. CONSISTÊNCIA (baseado em regularidade de produção)
  let consistencyScore = 0;
  const monthlyProductions = Object.values(user.monthly || {}).map(m => m.count);
  if (monthlyProductions.length > 0) {
    const avgMonthly = monthlyProductions.reduce((a, b) => a + b, 0) / monthlyProductions.length;
    const monthlyVariance = monthlyProductions.reduce((sum, v) => sum + Math.pow(v - avgMonthly, 2), 0) / monthlyProductions.length;
    const monthlyStdDev = Math.sqrt(monthlyVariance);
    const cv = avgMonthly > 0 ? monthlyStdDev / avgMonthly : 1; // coeficiente de variação

    // Quanto menor o CV, mais consistente
    consistencyScore = Math.round(Math.max(0, 100 - cv * 100));
  }

  // 4. EFICIÊNCIA (custo-benefício e tempo)
  let efficiencyScore = 0;
  if (user.totalPieces > 0) {
    // Custo por peça vs média geral
    const userAvgCost = user.totalCost / user.totalPieces;
    const globalAvgCost = analytics.global.totalPieces > 0
      ? analytics.global.totalCost / analytics.global.totalPieces
      : userAvgCost;
    const costEfficiency = Math.min(1, globalAvgCost / Math.max(0.001, userAvgCost)); // até 1

    // Tempo de redação vs tempo economizado
    const draftingEfficiency = user.activity && user.activity.avgPieceDraftingTime > 0
      ? Math.min(1, (user.totalTimeSaved / user.totalPieces) / user.activity.avgPieceDraftingTime)
      : 0.5;

    // Revisões necessárias (menos = melhor)
    const revisionEfficiency = user.quality && user.quality.avgRevisionsNeeded !== null
      ? Math.max(0, 1 - user.quality.avgRevisionsNeeded / 3)
      : 0.5;

    efficiencyScore = Math.round((costEfficiency * 40) + (draftingEfficiency * 30) + (revisionEfficiency * 30));
  }

  // 5. PERFORMANCE GERAL
  const overallPerformance = Math.round(
    (dedicationScore * 0.25) +
    (excellenceScore * 0.35) +
    (consistencyScore * 0.20) +
    (efficiencyScore * 0.20)
  );

  // 6. TENDÊNCIA
  let trend = 'stable';
  const recentMonths = Object.entries(user.monthly || {}).slice(-3);
  if (recentMonths.length >= 2) {
    const recentScores = recentMonths.map(([_, m]) => m.scored > 0 ? m.totalScore / m.scored : 0);
    const firstHalf = recentScores.slice(0, Math.ceil(recentScores.length / 2));
    const secondHalf = recentScores.slice(Math.ceil(recentScores.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / Math.max(1, firstHalf.length);
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / Math.max(1, secondHalf.length);

    if (secondAvg > firstAvg * 1.1) trend = 'improving';
    else if (secondAvg < firstAvg * 0.9) trend = 'declining';
  }

  // 7. PONTOS FORTES E FRACOS
  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  if (dedicationScore >= 70) strengths.push('Alta dedicação e regularidade');
  else if (dedicationScore < 50) {
    weaknesses.push('Baixa frequência de uso');
    recommendations.push('Estabelecer rotina diária de uso da ferramenta');
  }

  if (excellenceScore >= 70) strengths.push('Excelente qualidade de produção');
  else if (excellenceScore < 50) {
    weaknesses.push('Qualidade das peças precisa melhorar');
    recommendations.push('Revisar peças com mais atenção antes de submeter');
  }

  if (consistencyScore >= 70) strengths.push('Produção consistente');
  else if (consistencyScore < 50) {
    weaknesses.push('Produção irregular');
    recommendations.push('Manter ritmo de produção mais constante');
  }

  if (efficiencyScore >= 70) strengths.push('Alta eficiência operacional');
  else if (efficiencyScore < 50) {
    weaknesses.push('Eficiência pode ser melhorada');
    recommendations.push('Otimizar uso de modelos mais baratos quando possível');
  }

  // Analisar tipos de erro comuns
  if (user.quality && user.quality.errorTypes) {
    const topErrors = Object.entries(user.quality.errorTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    for (const [errorType, count] of topErrors) {
      weaknesses.push(`Erros frequentes de ${errorType}`);
      if (errorType === 'fundamentacao') {
        recommendations.push('Aprofundar pesquisa jurisprudencial antes de redigir');
      } else if (errorType === 'formatacao') {
        recommendations.push('Usar templates padronizados');
      } else if (errorType === 'citacao') {
        recommendations.push('Verificar fontes e citações com mais rigor');
      }
    }
  }

  // Áreas fortes e fracas
  const areaScores = Object.entries(user.piecesByArea || {})
    .filter(([_, stats]) => stats.scored > 0)
    .map(([area, stats]) => ({ area, score: stats.avgScore }))
    .sort((a, b) => b.score - a.score);

  const strengthAreas = areaScores.filter(a => a.score >= 8).map(a => a.area);
  const improvementAreas = areaScores.filter(a => a.score < 7).map(a => a.area);

  // Nível de performance
  let performanceLevel = '';
  if (overallPerformance >= 85) performanceLevel = 'Excepcional';
  else if (overallPerformance >= 70) performanceLevel = 'Excelente';
  else if (overallPerformance >= 55) performanceLevel = 'Bom';
  else if (overallPerformance >= 40) performanceLevel = 'Regular';
  else performanceLevel = 'Precisa Desenvolvimento';

  // Atualizar dados do usuário
  if (!user.aiAnalysis) user.aiAnalysis = getEmptyUserStats().aiAnalysis;
  user.aiAnalysis = {
    lastAnalyzed: new Date().toISOString(),
    dedicationScore,
    excellenceScore,
    consistencyScore,
    efficiencyScore,
    overallPerformance,
    trend,
    recommendations,
    strengths,
    weaknesses,
    strengthAreas,
    improvementAreas,
    performanceLevel
  };

  saveAnalytics(analytics);

  return {
    userId,
    userName: user.name,
    analysis: user.aiAnalysis,
    success: true
  };
}

/**
 * Gera relatório cruzado completo
 */
export function relatorioCruzado(userId = null) {
  const analytics = loadAnalytics();
  const history = loadPiecesHistory();
  const sessions = loadSessions();
  const activity = loadActivity();

  const users = userId ? { [userId]: analytics.users[userId] } : analytics.users;

  let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║           ROM AGENT - RELATÓRIO CRUZADO DE PERFORMANCE                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
`;

  for (const [uid, user] of Object.entries(users)) {
    if (!user) continue;

    // Executar análise de IA
    const analysis = analisarPerformanceIA(uid);
    const ai = user.aiAnalysis || {};
    const a = user.activity || {};
    const q = user.quality || {};

    report += `
════════════════════════════════════════════════════════════════════════════════
ADVOGADO: ${user.name || uid} ${user.oab ? '(OAB: ' + user.oab + ')' : ''}
════════════════════════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ SCORES DE PERFORMANCE (Análise por IA)                                      │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  Dedicação:       ${String(ai.dedicationScore || 0).padStart(3)}/100  ${'█'.repeat(Math.floor((ai.dedicationScore || 0) / 5))}${'░'.repeat(20 - Math.floor((ai.dedicationScore || 0) / 5))}  │
  │  Excelência:      ${String(ai.excellenceScore || 0).padStart(3)}/100  ${'█'.repeat(Math.floor((ai.excellenceScore || 0) / 5))}${'░'.repeat(20 - Math.floor((ai.excellenceScore || 0) / 5))}  │
  │  Consistência:    ${String(ai.consistencyScore || 0).padStart(3)}/100  ${'█'.repeat(Math.floor((ai.consistencyScore || 0) / 5))}${'░'.repeat(20 - Math.floor((ai.consistencyScore || 0) / 5))}  │
  │  Eficiência:      ${String(ai.efficiencyScore || 0).padStart(3)}/100  ${'█'.repeat(Math.floor((ai.efficiencyScore || 0) / 5))}${'░'.repeat(20 - Math.floor((ai.efficiencyScore || 0) / 5))}  │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  PERFORMANCE GERAL: ${String(ai.overallPerformance || 0).padStart(3)}/100 - ${ai.performanceLevel || 'N/A'}                         │
  │  Tendência: ${ai.trend === 'improving' ? '📈 Melhorando' : ai.trend === 'declining' ? '📉 Declinando' : '➡️ Estável'}                                                    │
  └─────────────────────────────────────────────────────────────────────────────┘

  MÉTRICAS DE ATIVIDADE E TEMPO
  ───────────────────────────────────────────────────────────────────────────────
  Total de Sessões:           ${a.totalSessions || 0}
  Tempo Total Ativo:          ${Math.round((a.totalActiveTime || 0) / 60)} horas
  Tempo Total em Redação:     ${Math.round((a.totalDraftingTime || 0) / 60)} horas
  Duração Média de Sessão:    ${a.avgSessionDuration || 0} minutos
  Tempo Médio por Peça:       ${a.avgPieceDraftingTime || 0} minutos
  Peças por Sessão:           ${a.avgPiecesPerSession || 0}
  Focus Score:                ${a.focusScore || 0}%
  Último Login:               ${a.lastLogin ? a.lastLogin.split('T')[0] : 'N/A'}

  MÉTRICAS DE QUALIDADE
  ───────────────────────────────────────────────────────────────────────────────
  Nota Média:                 ${q.avgScore ? q.avgScore.toFixed(1) + '/10' : 'N/A'}
  Taxa de Aprovação:          ${q.approvalRate ? q.approvalRate.toFixed(1) + '%' : 'N/A'}
  Revisões Médias:            ${q.avgRevisionsNeeded ? q.avgRevisionsNeeded.toFixed(1) : 'N/A'}
  Satisfação do Cliente:      ${q.avgClientSatisfaction ? q.avgClientSatisfaction.toFixed(1) + '/10' : 'N/A'}

  DISTRIBUIÇÃO DE QUALIDADE
  ───────────────────────────────────────────────────────────────────────────────
  Excelentes (9-10):          ${q.excellentPieces || 0} peças
  Boas (7-8.9):               ${q.goodPieces || 0} peças
  Regulares (5-6.9):          ${q.regularPieces || 0} peças
  Precisam Melhorar (<5):     ${q.needsImprovement || 0} peças

  MÉTRICAS DE PRODUÇÃO
  ───────────────────────────────────────────────────────────────────────────────
  Total de Peças:             ${user.totalPieces}
  Custo Total:                $${user.totalCost.toFixed(2)}
  Tempo Economizado:          ${Math.round(user.totalTimeSaved / 60)} horas

  PONTOS FORTES
  ───────────────────────────────────────────────────────────────────────────────`;

    for (const strength of (ai.strengths || [])) {
      report += `
  ✓ ${strength}`;
    }

    if (ai.strengthAreas && ai.strengthAreas.length > 0) {
      report += `
  ✓ Áreas fortes: ${ai.strengthAreas.join(', ')}`;
    }

    report += `

  PONTOS A MELHORAR
  ───────────────────────────────────────────────────────────────────────────────`;

    for (const weakness of (ai.weaknesses || [])) {
      report += `
  ✗ ${weakness}`;
    }

    if (ai.improvementAreas && ai.improvementAreas.length > 0) {
      report += `
  ✗ Áreas a desenvolver: ${ai.improvementAreas.join(', ')}`;
    }

    report += `

  RECOMENDAÇÕES
  ───────────────────────────────────────────────────────────────────────────────`;

    for (const rec of (ai.recommendations || [])) {
      report += `
  → ${rec}`;
    }

    // Distribuição de logins por hora
    if (a.loginsByHour && Object.keys(a.loginsByHour).length > 0) {
      report += `

  DISTRIBUIÇÃO DE ATIVIDADE POR HORA
  ───────────────────────────────────────────────────────────────────────────────`;

      const maxLogins = Math.max(...Object.values(a.loginsByHour));
      for (let h = 6; h <= 22; h++) {
        const count = a.loginsByHour[h] || 0;
        const bar = '█'.repeat(Math.round((count / Math.max(1, maxLogins)) * 20));
        report += `
  ${String(h).padStart(2)}h: ${bar} (${count})`;
      }
    }
  }

  return report;
}

// ============================================================
// EXPORTAÇÃO
// ============================================================

/**
 * Exporta dados para JSON
 */
export function exportarJSON(tipo = 'completo', userId = null) {
  const analytics = loadAnalytics();
  const history = loadPiecesHistory();
  const sessions = loadSessions();
  const activity = loadActivity();
  const qualityMetrics = loadQualityMetrics();

  let data = {};
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let filename = '';

  switch (tipo) {
    case 'completo':
      data = { analytics, history, sessions, activity, qualityMetrics };
      filename = `rom-agent-export-completo-${timestamp}.json`;
      break;
    case 'usuario':
      if (!userId) return { success: false, error: 'userId necessário' };
      data = {
        user: analytics.users[userId],
        pieces: history.pieces.filter(p => p.userId === userId),
        sessions: sessions.sessions.filter(s => s.userId === userId),
        drafts: Object.values(activity.draftingSessions || {}).filter(d => d.userId === userId)
      };
      filename = `rom-agent-export-${userId}-${timestamp}.json`;
      break;
    case 'qualidade':
      data = {
        global: analytics.global.quality,
        byUser: Object.fromEntries(
          Object.entries(analytics.users).map(([id, u]) => [id, u.quality])
        ),
        byPieceType: Object.fromEntries(
          Object.entries(analytics.pieceTypes).map(([type, stats]) => [
            type,
            { avgScore: stats.avgScore, approvalRate: stats.approvalRate }
          ])
        ),
        evaluations: qualityMetrics.evaluations
      };
      filename = `rom-agent-export-qualidade-${timestamp}.json`;
      break;
    case 'producao':
      data = {
        global: {
          totalPieces: analytics.global.totalPieces,
          totalCost: analytics.global.totalCost,
          totalTimeSaved: analytics.global.totalTimeSaved
        },
        byUser: Object.fromEntries(
          Object.entries(analytics.users).map(([id, u]) => [id, {
            name: u.name,
            totalPieces: u.totalPieces,
            totalCost: u.totalCost
          }])
        ),
        monthly: analytics.monthly,
        daily: analytics.daily
      };
      filename = `rom-agent-export-producao-${timestamp}.json`;
      break;
    default:
      return { success: false, error: 'Tipo de exportação inválido' };
  }

  const filepath = path.join(EXPORTS_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

  return { success: true, filepath, filename };
}

/**
 * Exporta dados para CSV
 */
export function exportarCSV(tipo = 'pecas', userId = null) {
  const history = loadPiecesHistory();
  const analytics = loadAnalytics();

  let csv = '';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let filename = '';

  switch (tipo) {
    case 'pecas':
      csv = 'ID,Data,Usuário,Tipo,Título,Área,Cliente,Tribunal,Processo,Custo,Nota,Status,Tempo Redação\n';
      let pieces = history.pieces;
      if (userId) pieces = pieces.filter(p => p.userId === userId);

      for (const p of pieces) {
        csv += `"${p.id}","${p.createdAt.split('T')[0]}","${p.userName || p.userId}","${p.pieceType}","${(p.pieceTitle || '').replace(/"/g, '""')}","${p.area || ''}","${p.client || ''}","${p.tribunal || ''}","${p.processNumber || ''}","${p.cost.toFixed(4)}","${p.quality?.score || ''}","${p.status}","${p.draftingTime || ''}"\n`;
      }
      filename = userId ? `pecas-${userId}-${timestamp}.csv` : `pecas-${timestamp}.csv`;
      break;

    case 'usuarios':
      csv = 'ID,Nome,OAB,Email,Total Peças,Custo Total,Tempo Economizado,Nota Média,Taxa Aprovação,Focus Score,Sessions\n';
      for (const [id, u] of Object.entries(analytics.users)) {
        const q = u.quality || {};
        const a = u.activity || {};
        csv += `"${id}","${u.name}","${u.oab}","${u.email}","${u.totalPieces}","${u.totalCost.toFixed(4)}","${Math.round(u.totalTimeSaved / 60)}","${q.avgScore ? q.avgScore.toFixed(1) : ''}","${q.approvalRate ? q.approvalRate.toFixed(1) : ''}","${a.focusScore || ''}","${a.totalSessions || 0}"\n`;
      }
      filename = `usuarios-${timestamp}.csv`;
      break;

    case 'mensal':
      csv = 'Mês,Peças,Custo,Usuários,Tempo Economizado,Tempo Redação\n';
      for (const [month, stats] of Object.entries(analytics.monthly || {})) {
        csv += `"${month}","${stats.count}","${stats.cost.toFixed(4)}","${stats.users?.length || 0}","${Math.round(stats.timeSaved / 60)}","${stats.draftingTime || 0}"\n`;
      }
      filename = `mensal-${timestamp}.csv`;
      break;

    default:
      return { success: false, error: 'Tipo de CSV inválido' };
  }

  const filepath = path.join(EXPORTS_DIR, filename);
  fs.writeFileSync(filepath, csv);

  return { success: true, filepath, filename };
}

/**
 * Gera relatório em formato texto para exportação/impressão
 */
export function gerarRelatorioTexto(tipo = 'completo', userId = null) {
  let report = '';

  switch (tipo) {
    case 'completo':
      report += dashboard();
      report += '\n\n' + relatorioUtilizacao();
      report += '\n\n' + relatorioProdutividade();
      report += '\n\n' + relatorioQualidade();
      report += '\n\n' + relatorioCustos();
      break;
    case 'cruzado':
      report = relatorioCruzado(userId);
      break;
    case 'usuario':
      if (!userId) return { success: false, error: 'userId necessário' };
      report = relatorioCruzado(userId);
      break;
    default:
      return { success: false, error: 'Tipo inválido' };
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `relatorio-${tipo}-${timestamp}.txt`;
  const filepath = path.join(EXPORTS_DIR, filename);
  fs.writeFileSync(filepath, report);

  return { success: true, filepath, filename, content: report };
}

// ============================================================
// RELATÓRIOS (mantidos e atualizados)
// ============================================================

export function relatorioUtilizacao() {
  const analytics = loadAnalytics();
  const g = analytics.global;
  const q = g.quality || {};

  let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ROM AGENT - RELATÓRIO DE UTILIZAÇÃO                        ║
╚══════════════════════════════════════════════════════════════════════════════╝

Período: ${analytics.createdAt.split('T')[0]} até ${new Date().toISOString().split('T')[0]}

════════════════════════════════════════════════════════════════════════════════
RESUMO GERAL
════════════════════════════════════════════════════════════════════════════════
  Total de Peças Geradas:    ${g.totalPieces.toLocaleString()}
  Total de Tokens (Input):   ${g.totalTokensInput.toLocaleString()}
  Total de Tokens (Output):  ${g.totalTokensOutput.toLocaleString()}
  Custo Total:               $${g.totalCost.toFixed(2)}
  Tempo Economizado:         ${Math.round(g.totalTimeSaved / 60)} horas
  Tempo em Redação:          ${Math.round((g.totalDraftingTime || 0) / 60)} horas
  Usuários Ativos:           ${Object.keys(analytics.users).length}

════════════════════════════════════════════════════════════════════════════════
MÉTRICAS DE QUALIDADE GLOBAL
════════════════════════════════════════════════════════════════════════════════
  Nota Média das Peças:      ${q.avgScore ? q.avgScore.toFixed(1) + '/10' : 'N/A'}
  Taxa de Aprovação:         ${q.approvalRate ? q.approvalRate.toFixed(1) + '%' : 'N/A'}
  Peças Aprovadas:           ${q.piecesApproved || 0}
  Peças Rejeitadas:          ${q.piecesRejected || 0}
  Satisfação do Cliente:     ${q.clientSatisfaction ? q.clientSatisfaction.toFixed(1) + '/10' : 'N/A'}

════════════════════════════════════════════════════════════════════════════════
USUÁRIOS/ADVOGADOS
════════════════════════════════════════════════════════════════════════════════`;

  const sortedUsers = Object.entries(analytics.users)
    .sort((a, b) => b[1].totalPieces - a[1].totalPieces);

  for (const [userId, user] of sortedUsers) {
    const uq = user.quality || {};
    const ua = user.activity || {};
    const scoreStr = uq.avgScore ? ` | Nota: ${uq.avgScore.toFixed(1)}` : '';
    const focusStr = ua.focusScore ? ` | Focus: ${ua.focusScore}%` : '';
    report += `
  ${user.name || userId} ${user.oab ? '(OAB: ' + user.oab + ')' : ''}
    Peças: ${user.totalPieces} | Custo: $${user.totalCost.toFixed(2)} | Tempo: ${Math.round(user.totalTimeSaved / 60)}h${scoreStr}${focusStr}`;
  }

  report += `

════════════════════════════════════════════════════════════════════════════════
ÚLTIMOS 7 DIAS
════════════════════════════════════════════════════════════════════════════════`;

  const days = Object.entries(analytics.daily || {}).slice(-7);
  for (const [date, stats] of days) {
    const scoreStr = stats.scored > 0 ? ` | Nota: ${(stats.totalScore / stats.scored).toFixed(1)}` : '';
    const draftStr = stats.draftingTime ? ` | Redação: ${stats.draftingTime}min` : '';
    report += `
  ${date}: ${stats.count} peças | $${stats.cost.toFixed(2)} | ${stats.users.length} usuários${scoreStr}${draftStr}`;
  }

  return report;
}

export function relatorioProdutividade(userId = null) {
  const analytics = loadAnalytics();

  let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║         ROM AGENT - RELATÓRIO DE PRODUTIVIDADE E QUALIDADE v3.0              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`;

  const users = userId
    ? { [userId]: analytics.users[userId] }
    : analytics.users;

  for (const [uid, user] of Object.entries(users)) {
    if (!user) continue;

    const avgCostPerPiece = user.totalPieces > 0 ? user.totalCost / user.totalPieces : 0;
    const avgTimeSaved = user.totalPieces > 0 ? user.totalTimeSaved / user.totalPieces : 0;
    const q = user.quality || {};
    const a = user.activity || {};

    report += `
════════════════════════════════════════════════════════════════════════════════
ADVOGADO: ${user.name || uid} ${user.oab ? '(OAB: ' + user.oab + ')' : ''}
════════════════════════════════════════════════════════════════════════════════

  MÉTRICAS DE PRODUÇÃO
  ───────────────────────────────────────────────────────────────────────────────
  Total de Peças:             ${user.totalPieces}
  Custo Total:                $${user.totalCost.toFixed(2)}
  Custo Médio por Peça:       $${avgCostPerPiece.toFixed(4)}
  Tempo Total Economizado:    ${Math.round(user.totalTimeSaved / 60)} horas
  Tempo Médio Economizado:    ${Math.round(avgTimeSaved)} minutos/peça

  MÉTRICAS DE TEMPO E ATIVIDADE
  ───────────────────────────────────────────────────────────────────────────────
  Total de Sessões:           ${a.totalSessions || 0}
  Tempo Ativo Total:          ${Math.round((a.totalActiveTime || 0) / 60)} horas
  Tempo em Redação:           ${Math.round((a.totalDraftingTime || 0) / 60)} horas
  Duração Média de Sessão:    ${a.avgSessionDuration || 0} minutos
  Tempo Médio por Peça:       ${a.avgPieceDraftingTime || 0} minutos
  Focus Score:                ${a.focusScore || 0}%
  Peças por Sessão:           ${a.avgPiecesPerSession || 0}

  MÉTRICAS DE QUALIDADE
  ───────────────────────────────────────────────────────────────────────────────
  Nota Média:                 ${q.avgScore ? q.avgScore.toFixed(1) + '/10' : 'N/A'}
  Taxa de Aprovação:          ${q.approvalRate ? q.approvalRate.toFixed(1) + '%' : 'N/A'}
  Peças Aprovadas:            ${q.piecesApproved || 0}
  Peças Rejeitadas:           ${q.piecesRejected || 0}
  Revisões Médias:            ${q.avgRevisionsNeeded ? q.avgRevisionsNeeded.toFixed(1) : 'N/A'}
  Satisfação Cliente:         ${q.avgClientSatisfaction ? q.avgClientSatisfaction.toFixed(1) + '/10' : 'N/A'}

  CLASSIFICAÇÃO DAS PEÇAS
  ───────────────────────────────────────────────────────────────────────────────
  Excelentes (9-10):          ${q.excellentPieces || 0}
  Boas (7-8.9):               ${q.goodPieces || 0}
  Regulares (5-6.9):          ${q.regularPieces || 0}
  Precisam Melhorar (<5):     ${q.needsImprovement || 0}

  POR TIPO DE PEÇA
  ───────────────────────────────────────────────────────────────────────────────`;

    const sortedTypes = Object.entries(user.piecesByType || {})
      .sort((a, b) => b[1].count - a[1].count);

    for (const [type, stats] of sortedTypes.slice(0, 10)) {
      const scoreStr = stats.scored > 0 ? ` | Nota: ${stats.avgScore.toFixed(1)}` : '';
      const timeStr = stats.avgDraftingTime ? ` | ~${Math.round(stats.avgDraftingTime)}min` : '';
      report += `
    ${type}: ${stats.count} peças | $${stats.cost.toFixed(2)}${scoreStr}${timeStr}`;
    }

    report += `

  POR ÁREA DO DIREITO
  ───────────────────────────────────────────────────────────────────────────────`;

    for (const [area, stats] of Object.entries(user.piecesByArea || {})) {
      const scoreStr = stats.scored > 0 ? ` | Nota: ${stats.avgScore.toFixed(1)}` : '';
      report += `
    ${area}: ${stats.count} peças | $${stats.cost.toFixed(2)}${scoreStr}`;
    }

    report += `

  PRODUÇÃO MENSAL
  ───────────────────────────────────────────────────────────────────────────────`;

    const months = Object.entries(user.monthly || {}).slice(-6);
    for (const [month, stats] of months) {
      const scoreStr = stats.scored > 0 ? ` | Nota: ${(stats.totalScore / stats.scored).toFixed(1)}` : '';
      const draftStr = stats.draftingTime ? ` | Redação: ${Math.round(stats.draftingTime / 60)}h` : '';
      report += `
    ${month}: ${stats.count} peças | $${stats.cost.toFixed(2)} | ${Math.round(stats.timeSaved / 60)}h econ.${scoreStr}${draftStr}`;
    }
  }

  return report;
}

export function relatorioQualidade() {
  const analytics = loadAnalytics();
  const qualityMetrics = loadQualityMetrics();
  const g = analytics.global;
  const q = g.quality || {};

  let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ROM AGENT - RELATÓRIO DE QUALIDADE v3.0                    ║
╚══════════════════════════════════════════════════════════════════════════════╝

════════════════════════════════════════════════════════════════════════════════
VISÃO GERAL DE QUALIDADE
════════════════════════════════════════════════════════════════════════════════
  Total de Peças Avaliadas:  ${q.totalReviews || 0} de ${g.totalPieces}
  Nota Média Global:         ${q.avgScore ? q.avgScore.toFixed(2) + '/10' : 'N/A'}
  Taxa de Aprovação:         ${q.approvalRate ? q.approvalRate.toFixed(1) + '%' : 'N/A'}
  Satisfação do Cliente:     ${q.clientSatisfaction ? q.clientSatisfaction.toFixed(2) + '/10' : 'N/A'}

  APROVAÇÕES
  ───────────────────────────────────────────────────────────────────────────────
  Peças Aprovadas:           ${q.piecesApproved || 0}
  Peças Rejeitadas:          ${q.piecesRejected || 0}
  Aguardando Avaliação:      ${g.totalPieces - (q.piecesApproved || 0) - (q.piecesRejected || 0)}

════════════════════════════════════════════════════════════════════════════════
QUALIDADE POR TIPO DE PEÇA
════════════════════════════════════════════════════════════════════════════════`;

  const sortedTypes = Object.entries(analytics.pieceTypes || {})
    .filter(([, stats]) => stats.scored > 0)
    .sort((a, b) => b[1].avgScore - a[1].avgScore);

  for (const [type, stats] of sortedTypes) {
    const approvalStr = stats.approved + stats.rejected > 0
      ? ` | Aprovação: ${stats.approvalRate.toFixed(0)}%`
      : '';
    const timeStr = stats.avgDraftingTime ? ` | ~${Math.round(stats.avgDraftingTime)}min` : '';
    report += `
  ${type}
    Nota: ${stats.avgScore.toFixed(1)}/10 (${stats.scored} avaliadas)${approvalStr}${timeStr}`;
  }

  report += `

════════════════════════════════════════════════════════════════════════════════
RANKING DE ADVOGADOS POR QUALIDADE
════════════════════════════════════════════════════════════════════════════════`;

  const sortedUsers = Object.entries(analytics.users)
    .filter(([, user]) => user.quality && user.quality.totalScores > 0)
    .sort((a, b) => b[1].quality.avgScore - a[1].quality.avgScore);

  let rank = 1;
  for (const [userId, user] of sortedUsers) {
    const uq = user.quality;
    const ai = user.aiAnalysis || {};
    report += `
  ${rank}. ${user.name || userId}
     Nota: ${uq.avgScore.toFixed(1)}/10 | Aprovação: ${uq.approvalRate.toFixed(0)}% | ${user.totalPieces} peças
     Performance IA: ${ai.overallPerformance || 'N/A'}/100 (${ai.performanceLevel || 'Não analisado'})`;
    rank++;
  }

  report += `

════════════════════════════════════════════════════════════════════════════════
ÚLTIMAS 10 AVALIAÇÕES
════════════════════════════════════════════════════════════════════════════════`;

  const lastEvals = (qualityMetrics.evaluations || []).slice(-10).reverse();
  for (const eval_ of lastEvals) {
    const date = eval_.evaluatedAt ? eval_.evaluatedAt.split('T')[0] : 'N/A';
    const statusStr = eval_.approved === true ? '✓ Aprovada' : eval_.approved === false ? '✗ Rejeitada' : 'Pendente';
    report += `
  [${date}] ${eval_.pieceType} - Nota: ${eval_.score.toFixed(1)}/10 - ${statusStr}`;
  }

  return report;
}

export function relatorioTiposPecas() {
  const analytics = loadAnalytics();

  let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ROM AGENT - RELATÓRIO DE TIPOS DE PEÇAS                    ║
╚══════════════════════════════════════════════════════════════════════════════╝

════════════════════════════════════════════════════════════════════════════════
RANKING POR QUANTIDADE
════════════════════════════════════════════════════════════════════════════════`;

  const sortedByCount = Object.entries(analytics.pieceTypes || {})
    .sort((a, b) => b[1].count - a[1].count);

  let rank = 1;
  for (const [type, stats] of sortedByCount) {
    const avgTokens = Math.round(stats.avgTokens);
    const scoreStr = stats.scored > 0 ? ` | Nota: ${stats.avgScore.toFixed(1)}` : '';
    const approvalStr = (stats.approved || 0) + (stats.rejected || 0) > 0
      ? ` | Aprov: ${stats.approvalRate.toFixed(0)}%`
      : '';
    const timeStr = stats.avgDraftingTime ? ` | ~${Math.round(stats.avgDraftingTime)}min` : '';
    report += `
  ${rank}. ${type}
     Qtd: ${stats.count} | Custo: $${stats.cost.toFixed(2)} | Tokens: ${avgTokens.toLocaleString()}${scoreStr}${approvalStr}${timeStr}`;
    rank++;
  }

  return report;
}

export function relatorioCustos(periodo = 'all') {
  const analytics = loadAnalytics();
  const g = analytics.global;

  let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ROM AGENT - RELATÓRIO DE CUSTOS                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

════════════════════════════════════════════════════════════════════════════════
CUSTOS TOTAIS
════════════════════════════════════════════════════════════════════════════════
  Custo Total com IA:       $${g.totalCost.toFixed(2)}
  Total de Peças:           ${g.totalPieces}
  Custo Médio por Peça:     $${(g.totalPieces > 0 ? g.totalCost / g.totalPieces : 0).toFixed(4)}
  Tokens Processados:       ${(g.totalTokensInput + g.totalTokensOutput).toLocaleString()}

  EFICIÊNCIA
  ───────────────────────────────────────────────────────────────────────────────
  Tempo Economizado:        ${Math.round(g.totalTimeSaved / 60)} horas
  Tempo em Redação:         ${Math.round((g.totalDraftingTime || 0) / 60)} horas
  Valor/Hora Economizado:   $${(g.totalTimeSaved > 0 ? (g.totalCost / (g.totalTimeSaved / 60)).toFixed(2) : 0)}/hora

════════════════════════════════════════════════════════════════════════════════
CUSTO POR ADVOGADO
════════════════════════════════════════════════════════════════════════════════`;

  const sortedUsers = Object.entries(analytics.users)
    .sort((a, b) => b[1].totalCost - a[1].totalCost);

  for (const [userId, user] of sortedUsers) {
    const percent = g.totalCost > 0 ? ((user.totalCost / g.totalCost) * 100).toFixed(1) : 0;
    const avgCost = user.totalPieces > 0 ? user.totalCost / user.totalPieces : 0;
    const draftTime = user.activity?.totalDraftingTime || 0;
    report += `
  ${user.name || userId}
    Total: $${user.totalCost.toFixed(2)} (${percent}%) | ${user.totalPieces} peças | Média: $${avgCost.toFixed(4)}/peça
    Redação: ${Math.round(draftTime / 60)}h | Economia: ${Math.round(user.totalTimeSaved / 60)}h`;
  }

  report += `

════════════════════════════════════════════════════════════════════════════════
CUSTO MENSAL
════════════════════════════════════════════════════════════════════════════════`;

  const months = Object.entries(analytics.monthly || {}).slice(-12);
  for (const [month, stats] of months) {
    const avgPerPiece = stats.count > 0 ? stats.cost / stats.count : 0;
    report += `
  ${month}: $${stats.cost.toFixed(2)} | ${stats.count} peças | Média: $${avgPerPiece.toFixed(4)}/peça | ${Math.round(stats.timeSaved / 60)}h econ.`;
  }

  return report;
}

export function relatorioPecasGeradas(filtros = {}) {
  const history = loadPiecesHistory();
  const { userId, pieceType, status, client, approved, minScore, maxScore, limit = 50 } = filtros;

  let pieces = history.pieces || [];

  if (userId) pieces = pieces.filter(p => p.userId === userId);
  if (pieceType) pieces = pieces.filter(p => p.pieceType === pieceType);
  if (status) pieces = pieces.filter(p => p.status === status);
  if (client) pieces = pieces.filter(p => p.client === client);
  if (approved !== undefined) pieces = pieces.filter(p => p.quality?.approved === approved);
  if (minScore !== undefined) pieces = pieces.filter(p => p.quality?.score >= minScore);
  if (maxScore !== undefined) pieces = pieces.filter(p => p.quality?.score <= maxScore);

  pieces = pieces.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  pieces = pieces.slice(0, limit);

  let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ROM AGENT - HISTÓRICO DE PEÇAS GERADAS                     ║
╚══════════════════════════════════════════════════════════════════════════════╝

Total no histórico: ${history.pieces.length} peças
Exibindo: ${pieces.length} peças (filtradas/mais recentes)

════════════════════════════════════════════════════════════════════════════════
PEÇAS
════════════════════════════════════════════════════════════════════════════════`;

  for (const piece of pieces) {
    const date = piece.createdAt.split('T')[0];
    const time = piece.createdAt.split('T')[1].substring(0, 5);
    const q = piece.quality || {};
    const scoreStr = q.score !== null && q.score !== undefined ? `Nota: ${q.score.toFixed(1)}/10` : 'Não avaliada';
    const statusStr = q.approved === true ? '✓ Aprovada' : q.approved === false ? '✗ Rejeitada' : piece.status;
    const draftStr = piece.draftingTime ? ` | Redação: ${piece.draftingTime}min` : '';

    report += `
  [${date} ${time}] ${piece.pieceType}
    Título: ${piece.pieceTitle || 'N/A'}
    Advogado: ${piece.userName || piece.userId}
    Cliente: ${piece.client || 'N/A'} | Tribunal: ${piece.tribunal || 'N/A'}
    Status: ${statusStr} | ${scoreStr}${draftStr}
    Custo: $${piece.cost.toFixed(4)} | Revisões: ${q.revisionsCount || 0}
`;
  }

  return report;
}

export function dashboard() {
  const analytics = loadAnalytics();
  const g = analytics.global;
  const q = g.quality || {};
  const today = new Date().toISOString().split('T')[0];
  const todayStats = analytics.daily[today] || { count: 0, cost: 0 };

  const scoreDisplay = q.avgScore ? q.avgScore.toFixed(1) : 'N/A';
  const approvalDisplay = q.approvalRate ? q.approvalRate.toFixed(0) + '%' : 'N/A';
  const satisfactionDisplay = q.clientSatisfaction ? q.clientSatisfaction.toFixed(1) : 'N/A';

  let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ROM AGENT - DASHBOARD v3.0                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
  │   PEÇAS TOTAIS      │  │   CUSTO TOTAL       │  │  TEMPO ECONOMIZADO  │
  │                     │  │                     │  │                     │
  │   ${String(g.totalPieces).padStart(8)}        │  │   $${g.totalCost.toFixed(2).padStart(10)}      │  │   ${String(Math.round(g.totalTimeSaved / 60)).padStart(6)} horas    │
  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘

  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
  │   NOTA MÉDIA        │  │   TAXA APROVAÇÃO    │  │  SATISFAÇÃO CLIENTE │
  │                     │  │                     │  │                     │
  │   ${String(scoreDisplay).padStart(8)}/10     │  │   ${String(approvalDisplay).padStart(8)}        │  │   ${String(satisfactionDisplay).padStart(8)}/10     │
  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘

  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
  │   HOJE              │  │   USUÁRIOS ATIVOS   │  │  TEMPO REDAÇÃO      │
  │                     │  │                     │  │                     │
  │   ${String(todayStats.count).padStart(8)} peças  │  │   ${String(Object.keys(analytics.users).length).padStart(8)}        │  │   ${String(Math.round((g.totalDraftingTime || 0) / 60)).padStart(6)} horas    │
  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘

════════════════════════════════════════════════════════════════════════════════
TOP 5 ADVOGADOS (por performance IA)
════════════════════════════════════════════════════════════════════════════════`;

  // Analisar todos os usuários primeiro
  for (const userId of Object.keys(analytics.users)) {
    analisarPerformanceIA(userId);
  }

  const reloadedAnalytics = loadAnalytics();
  const topUsers = Object.entries(reloadedAnalytics.users)
    .filter(([, u]) => u.aiAnalysis && u.aiAnalysis.overallPerformance > 0)
    .sort((a, b) => (b[1].aiAnalysis?.overallPerformance || 0) - (a[1].aiAnalysis?.overallPerformance || 0))
    .slice(0, 5);

  for (const [userId, user] of topUsers) {
    const ai = user.aiAnalysis || {};
    const trendIcon = ai.trend === 'improving' ? '📈' : ai.trend === 'declining' ? '📉' : '➡️';
    report += `
  ${user.name || userId}: ${ai.overallPerformance}/100 (${ai.performanceLevel}) ${trendIcon}
    Peças: ${user.totalPieces} | Nota: ${user.quality?.avgScore?.toFixed(1) || 'N/A'}/10`;
  }

  if (topUsers.length === 0) {
    const fallbackUsers = Object.entries(reloadedAnalytics.users)
      .sort((a, b) => b[1].totalPieces - a[1].totalPieces)
      .slice(0, 5);

    for (const [userId, user] of fallbackUsers) {
      const uq = user.quality || {};
      const scoreStr = uq.avgScore ? ` | Nota: ${uq.avgScore.toFixed(1)}` : '';
      report += `
  ${user.name || userId}: ${user.totalPieces} peças | $${user.totalCost.toFixed(2)}${scoreStr}`;
    }
  }

  report += `

════════════════════════════════════════════════════════════════════════════════
TOP 5 TIPOS DE PEÇA
════════════════════════════════════════════════════════════════════════════════`;

  const topTypes = Object.entries(reloadedAnalytics.pieceTypes || {})
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  for (const [type, stats] of topTypes) {
    const scoreStr = stats.scored > 0 ? ` | Nota: ${stats.avgScore.toFixed(1)}` : '';
    const timeStr = stats.avgDraftingTime ? ` | ~${Math.round(stats.avgDraftingTime)}min` : '';
    report += `
  ${type}: ${stats.count} peças${scoreStr}${timeStr}`;
  }

  return report;
}

// ============================================================
// EXPORTS E CLI
// ============================================================

export default {
  // Sessões
  iniciarSessao,
  encerrarSessao,
  registrarAtividade,

  // Redação
  iniciarRedacao,
  pausarRedacao,
  retomarRedacao,
  finalizarRedacao,

  // Peças
  registrarPeca,
  avaliarPeca,

  // Análise IA
  analisarPerformanceIA,
  relatorioCruzado,

  // Relatórios
  relatorioUtilizacao,
  relatorioProdutividade,
  relatorioQualidade,
  relatorioTiposPecas,
  relatorioCustos,
  relatorioPecasGeradas,
  dashboard,

  // Exportação
  exportarJSON,
  exportarCSV,
  gerarRelatorioTexto,

  // Dados
  loadAnalytics,
  loadPiecesHistory,
  loadSessions,
  loadActivity,
  loadQualityMetrics
};

// CLI
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'dashboard') {
    console.log(dashboard());
  } else if (cmd === 'utilizacao') {
    console.log(relatorioUtilizacao());
  } else if (cmd === 'produtividade') {
    console.log(relatorioProdutividade(args[1]));
  } else if (cmd === 'qualidade') {
    console.log(relatorioQualidade());
  } else if (cmd === 'tipos') {
    console.log(relatorioTiposPecas());
  } else if (cmd === 'custos') {
    console.log(relatorioCustos());
  } else if (cmd === 'pecas') {
    console.log(relatorioPecasGeradas({ limit: parseInt(args[1]) || 20 }));
  } else if (cmd === 'cruzado') {
    console.log(relatorioCruzado(args[1]));
  } else if (cmd === 'analise') {
    if (!args[1]) {
      console.log('Uso: node lib/analytics.js analise <userId>');
    } else {
      const result = analisarPerformanceIA(args[1]);
      console.log(JSON.stringify(result, null, 2));
    }
  } else if (cmd === 'export') {
    const tipo = args[1] || 'completo';
    const userId = args[2];
    const result = exportarJSON(tipo, userId);
    console.log(result.success ? `Exportado: ${result.filepath}` : `Erro: ${result.error}`);
  } else if (cmd === 'csv') {
    const tipo = args[1] || 'pecas';
    const userId = args[2];
    const result = exportarCSV(tipo, userId);
    console.log(result.success ? `CSV exportado: ${result.filepath}` : `Erro: ${result.error}`);
  } else if (cmd === 'reset') {
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(getEmptyAnalytics(), null, 2));
    fs.writeFileSync(PIECES_FILE, JSON.stringify({ pieces: [] }, null, 2));
    fs.writeFileSync(QUALITY_FILE, JSON.stringify(getEmptyQualityMetrics(), null, 2));
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(getEmptySessions(), null, 2));
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(getEmptyActivity(), null, 2));
    console.log('Todos os dados resetados!');
  } else if (cmd === 'test') {
    // Reset primeiro
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(getEmptyAnalytics(), null, 2));
    fs.writeFileSync(PIECES_FILE, JSON.stringify({ pieces: [] }, null, 2));
    fs.writeFileSync(QUALITY_FILE, JSON.stringify(getEmptyQualityMetrics(), null, 2));
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(getEmptySessions(), null, 2));
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(getEmptyActivity(), null, 2));

    const advogados = [
      { id: 'rodolfo', name: 'Dr. Rodolfo Otávio', oab: 'GO 21.841', email: 'rodolfo@rom.adv.br' },
      { id: 'maria', name: 'Dra. Maria Silva', oab: 'GO 12.345', email: 'maria@rom.adv.br' },
      { id: 'joao', name: 'Dr. João Santos', oab: 'GO 54.321', email: 'joao@rom.adv.br' }
    ];

    const pecas = [
      { type: 'recurso_especial', area: 'criminal', tier: 'TIER_4_ULTRA', cost: 0.75, tokens: 15000, tribunal: 'STJ', avgTime: 45 },
      { type: 'apelação', area: 'civel_geral', tier: 'TIER_3_PREMIUM', cost: 0.15, tokens: 8000, tribunal: 'TJGO', avgTime: 35 },
      { type: 'peticao_inicial', area: 'consumidor', tier: 'TIER_2_STANDARD', cost: 0.05, tokens: 4000, tribunal: 'TJGO', avgTime: 25 },
      { type: 'notificacao_extrajudicial', area: 'civel_geral', tier: 'TIER_1_FAST', cost: 0.01, tokens: 1000, tribunal: null, avgTime: 10 },
      { type: 'contestacao', area: 'trabalhista', tier: 'TIER_2_STANDARD', cost: 0.06, tokens: 5000, tribunal: 'TRT18', avgTime: 30 },
      { type: 'mandado_seguranca', area: 'tributario', tier: 'TIER_3_PREMIUM', cost: 0.20, tokens: 10000, tribunal: 'TJGO', avgTime: 40 },
      { type: 'habeas_corpus_liminar', area: 'criminal', tier: 'TIER_4_ULTRA', cost: 0.80, tokens: 12000, tribunal: 'STF', avgTime: 50 }
    ];

    const clientes = ['João da Silva', 'Empresa ABC Ltda', 'Maria Oliveira', 'Tech Solutions SA'];
    const errorTypes = ['formatacao', 'fundamentacao', 'citacao', 'ortografia', 'legislacao_desatualizada'];

    // Simular sessões e atividades para cada advogado
    for (const adv of advogados) {
      // Criar algumas sessões
      const numSessions = 5 + Math.floor(Math.random() * 10);
      for (let s = 0; s < numSessions; s++) {
        iniciarSessao(adv.id, adv);

        // Registrar algumas atividades
        const numActivities = 3 + Math.floor(Math.random() * 5);
        for (let act = 0; act < numActivities; act++) {
          registrarAtividade(adv.id, {
            type: Math.random() > 0.3 ? 'active' : 'idle',
            description: 'Trabalhando em peça',
            duration: 10 + Math.floor(Math.random() * 30)
          });
        }

        encerrarSessao(adv.id);
      }
    }

    // Gerar 30 peças de teste com tempo de redação
    for (let i = 0; i < 30; i++) {
      const adv = advogados[Math.floor(Math.random() * advogados.length)];
      const peca = pecas[Math.floor(Math.random() * pecas.length)];
      const cliente = clientes[Math.floor(Math.random() * clientes.length)];

      // Simular tempo de redação
      const draftingTime = Math.floor(peca.avgTime * (0.7 + Math.random() * 0.6));

      const result = registrarPeca({
        userId: adv.id,
        userName: adv.name,
        userOab: adv.oab,
        userEmail: adv.email,
        pieceType: peca.type,
        pieceTitle: `${peca.type.replace(/_/g, ' ')} - ${cliente}`,
        area: peca.area,
        tier: peca.tier,
        client: cliente,
        tribunal: peca.tribunal,
        processNumber: `0000${Math.floor(Math.random() * 9999)}-${Math.floor(Math.random() * 99)}.2024.8.09.0001`,
        model: peca.tier === 'TIER_4_ULTRA' ? 'claude-opus' : peca.tier === 'TIER_3_PREMIUM' ? 'claude-sonnet' : 'nova-pro',
        inputTokens: Math.floor(peca.tokens * 0.6),
        outputTokens: Math.floor(peca.tokens * 0.4),
        cost: peca.cost * (0.8 + Math.random() * 0.4),
        timeSavedMinutes: Math.floor(30 + Math.random() * 120),
        draftingTime: draftingTime,
        status: 'gerada'
      });

      // Avaliar 70% das peças
      if (Math.random() < 0.7) {
        const score = 5 + Math.random() * 5;
        const approved = score >= 6.5;
        const revisionsNeeded = Math.floor(Math.random() * 3);
        const clientSatisfaction = approved ? 6 + Math.random() * 4 : 3 + Math.random() * 4;
        const errors = Math.random() < 0.3 ? [errorTypes[Math.floor(Math.random() * errorTypes.length)]] : [];

        avaliarPeca(result.pieceId, {
          score,
          approved,
          revisionsNeeded,
          clientSatisfaction,
          errorTypes: errors,
          evaluatedBy: 'supervisor'
        });
      }
    }

    console.log('30 peças de teste + sessões + atividades registradas!\n');
    console.log(dashboard());
  } else {
    console.log(`
ROM Agent - Sistema de Analytics v3.0 (Completo)

════════════════════════════════════════════════════════════════════════════════
RELATÓRIOS
════════════════════════════════════════════════════════════════════════════════
  node lib/analytics.js dashboard           - Dashboard resumido
  node lib/analytics.js utilizacao          - Relatório de utilização
  node lib/analytics.js produtividade [id]  - Produtividade por advogado
  node lib/analytics.js qualidade           - Relatório de qualidade
  node lib/analytics.js tipos               - Tipos de peças
  node lib/analytics.js custos              - Relatório de custos
  node lib/analytics.js pecas [N]           - Últimas N peças geradas
  node lib/analytics.js cruzado [id]        - Relatório cruzado completo

════════════════════════════════════════════════════════════════════════════════
ANÁLISE POR IA
════════════════════════════════════════════════════════════════════════════════
  node lib/analytics.js analise <userId>    - Análise de performance por IA

════════════════════════════════════════════════════════════════════════════════
EXPORTAÇÃO
════════════════════════════════════════════════════════════════════════════════
  node lib/analytics.js export [tipo] [id]  - Exportar JSON (completo/usuario/qualidade/producao)
  node lib/analytics.js csv [tipo] [id]     - Exportar CSV (pecas/usuarios/mensal)

════════════════════════════════════════════════════════════════════════════════
OUTROS
════════════════════════════════════════════════════════════════════════════════
  node lib/analytics.js reset               - Resetar todos os dados
  node lib/analytics.js test                - Gerar dados de teste
`);
  }
}
