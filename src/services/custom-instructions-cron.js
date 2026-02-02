import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { customInstructionsAnalyzer } from '../../lib/custom-instructions-analyzer.js';
import { customInstructionsManager } from '../../lib/custom-instructions-manager.js';
import { ACTIVE_PATHS } from '../../lib/storage-config.js';

/**
 * Cron Job para Análise Periódica de Custom Instructions
 *
 * FUNCIONALIDADES:
 * - Executa análise automática em intervalos configuráveis (semanal/mensal)
 * - Coleta métricas de uso
 * - Gera sugestões de melhoria via IA
 * - Salva sugestões para aprovação manual
 * - Notifica admin (futuramente)
 *
 * CONFIGURAÇÃO:
 * - Frequência definida em custom-instructions.json de cada parceiro
 * - Horário fixo: Segunda-feira 02:00 (semanal) ou Dia 1 às 02:00 (mensal)
 * - Baixa carga no servidor (horário de baixo uso)
 */

let cronJobs = {};

/**
 * Inicia cron job de análise periódica para Custom Instructions
 *
 * Comportamento:
 * - Verifica configuração de cada parceiro
 * - Agenda análise conforme frequência configurada
 * - Executa análise e salva sugestões
 */
export function startCustomInstructionsCron() {
  console.log('[Custom Instructions Cron] Iniciando serviço de análise periódica...');

  // Carrega lista de parceiros
  const partnersDir = path.join(ACTIVE_PATHS.data, 'custom-instructions');

  if (!fs.existsSync(partnersDir)) {
    console.log('[Custom Instructions Cron] Nenhum parceiro encontrado, criando padrão...');
    // Cria Custom Instructions padrão para ROM
    customInstructionsManager.createDefault('rom');
  }

  // Lê todos os parceiros
  const partners = fs.existsSync(partnersDir)
    ? fs.readdirSync(partnersDir).filter(f => {
        const fullPath = path.join(partnersDir, f);
        return fs.statSync(fullPath).isDirectory();
      })
    : ['rom'];

  console.log(`[Custom Instructions Cron] Encontrados ${partners.length} parceiro(s): ${partners.join(', ')}`);

  // Agenda análise para cada parceiro
  partners.forEach(partnerId => {
    try {
      const data = customInstructionsManager.load(partnerId);

      if (!data.aiSuggestions.enabled) {
        console.log(`[Custom Instructions Cron] Auto-análise desabilitada para ${partnerId}`);
        return;
      }

      const frequency = data.aiSuggestions.frequency;

      // Semanal: toda segunda-feira às 02:00
      // Mensal: primeiro dia do mês às 02:00
      const schedule = frequency === 'weekly'
        ? '0 2 * * 1'  // Segunda-feira 02:00
        : '0 2 1 * *'; // Dia 1 às 02:00

      // Agenda cron job
      const job = cron.schedule(schedule, async () => {
        await runAnalysis(partnerId);
      });

      cronJobs[partnerId] = job;

      console.log(`[Custom Instructions Cron] ✅ Agendado para ${partnerId}: ${frequency} (${schedule})`);
    } catch (error) {
      console.error(`[Custom Instructions Cron] ❌ Erro ao agendar ${partnerId}:`, error);
    }
  });

  console.log(`[Custom Instructions Cron] ${Object.keys(cronJobs).length} cron job(s) ativo(s)`);
}

/**
 * Executa análise de Custom Instructions para um parceiro
 * @param {string} partnerId - ID do parceiro
 */
async function runAnalysis(partnerId) {
  console.log(`[Custom Instructions Cron] ═══════════════════════════════════════`);
  console.log(`[Custom Instructions Cron] Iniciando análise automática: ${partnerId}`);
  console.log(`[Custom Instructions Cron] Data: ${new Date().toLocaleString('pt-BR')}`);
  console.log(`[Custom Instructions Cron] ═══════════════════════════════════════`);

  try {
    // Gera sugestões
    const suggestionsData = await customInstructionsAnalyzer.generateSuggestions(partnerId);

    // Salva sugestões pendentes
    await customInstructionsAnalyzer.saveSuggestions(suggestionsData, partnerId);

    console.log(`[Custom Instructions Cron] ✅ Análise concluída para ${partnerId}`);
    console.log(`[Custom Instructions Cron] 📊 ${suggestionsData.suggestions.length} sugestões geradas`);

    // Log de sugestões de alta prioridade
    const highPriority = suggestionsData.suggestions.filter(s => s.priority === 'high');
    if (highPriority.length > 0) {
      console.log(`[Custom Instructions Cron] ⚠️  ${highPriority.length} sugestão(ões) de ALTA prioridade`);
      highPriority.forEach(s => {
        console.log(`[Custom Instructions Cron]    - ${s.problem}`);
      });
    }

    // TODO: Implementar notificação para admin
    // await notifyAdmin(partnerId, suggestionsData);

    console.log(`[Custom Instructions Cron] ═══════════════════════════════════════\n`);
  } catch (error) {
    console.error(`[Custom Instructions Cron] ❌ Erro na análise de ${partnerId}:`, error);
    console.error(error.stack);
  }
}

/**
 * Para todos os cron jobs ativos
 */
export function stopCustomInstructionsCron() {
  console.log('[Custom Instructions Cron] Parando todos os cron jobs...');

  Object.keys(cronJobs).forEach(partnerId => {
    cronJobs[partnerId].stop();
    console.log(`[Custom Instructions Cron] ✅ Parado: ${partnerId}`);
  });

  cronJobs = {};
  console.log('[Custom Instructions Cron] Todos os cron jobs foram parados');
}

/**
 * Força execução imediata de análise (útil para testes)
 * @param {string} partnerId - ID do parceiro (opcional, default: todos)
 */
export async function triggerAnalysisNow(partnerId = null) {
  console.log('[Custom Instructions Cron] Executando análise manual...');

  if (partnerId) {
    // Análise de um parceiro específico
    await runAnalysis(partnerId);
  } else {
    // Análise de todos os parceiros
    const partnersDir = path.join(ACTIVE_PATHS.data, 'custom-instructions');

    if (!fs.existsSync(partnersDir)) {
      console.log('[Custom Instructions Cron] Nenhum parceiro encontrado');
      return;
    }

    const partners = fs.readdirSync(partnersDir).filter(f => {
      const fullPath = path.join(partnersDir, f);
      return fs.statSync(fullPath).isDirectory();
    });

    for (const pid of partners) {
      await runAnalysis(pid);
    }
  }
}

/**
 * Retorna status dos cron jobs ativos
 * @returns {object} Status dos cron jobs
 */
export function getCronStatus() {
  const status = {};

  Object.keys(cronJobs).forEach(partnerId => {
    const data = customInstructionsManager.load(partnerId);
    status[partnerId] = {
      enabled: data.aiSuggestions.enabled,
      frequency: data.aiSuggestions.frequency,
      lastAnalysis: data.aiSuggestions.lastAnalysis,
      isRunning: cronJobs[partnerId] ? true : false
    };
  });

  return {
    totalJobs: Object.keys(cronJobs).length,
    jobs: status,
    serverTime: new Date().toISOString()
  };
}

export default {
  startCustomInstructionsCron,
  stopCustomInstructionsCron,
  triggerAnalysisNow,
  getCronStatus
};
