/**
 * Parallel Initialization System (v2.7.1 Performance Optimized)
 *
 * Paraleliza inicializações de serviços para reduzir cold start
 * - Before: ~10-15s (sequential)
 * - After: ~3-5s (parallel)
 *
 * @module parallel-init
 */

import { logger } from './logger.js';

/**
 * Inicializa múltiplos serviços em paralelo
 * @param {Array} services - Array de objetos { name, service, initMethod, optional }
 * @returns {Promise<Object>} Resultados da inicialização
 */
export async function initializeServicesParallel(services) {
  const startTime = Date.now();

  logger.info(`🚀 Iniciando ${services.length} serviços em paralelo...`);

  // Criar promises para todas as inicializações
  const initPromises = services.map(async ({ name, service, initMethod = 'init', optional = false }) => {
    const serviceStartTime = Date.now();

    try {
      // Verificar se o serviço e método existem
      if (!service || typeof service[initMethod] !== 'function') {
        if (optional) {
          logger.warn(`⚠️  Serviço opcional ${name} não disponível ou sem método ${initMethod}`);
          return { name, success: false, optional: true, error: 'Service not available' };
        } else {
          throw new Error(`Serviço ${name} não tem método ${initMethod}`);
        }
      }

      // Inicializar com timeout de 10s
      const result = await Promise.race([
        service[initMethod](),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout na inicialização')), 10000)
        )
      ]);

      const duration = Date.now() - serviceStartTime;
      logger.info(`✅ ${name} inicializado em ${duration}ms`);

      return {
        name,
        success: true,
        duration,
        result
      };

    } catch (error) {
      const duration = Date.now() - serviceStartTime;

      if (optional) {
        logger.warn(`⚠️  Serviço opcional ${name} falhou: ${error.message}`);
        return {
          name,
          success: false,
          optional: true,
          duration,
          error: error.message
        };
      } else {
        logger.error(`❌ Erro ao inicializar ${name}:`, error);
        return {
          name,
          success: false,
          duration,
          error: error.message
        };
      }
    }
  });

  // Aguardar todas as inicializações
  const results = await Promise.all(initPromises);

  const totalDuration = Date.now() - startTime;
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success && !r.optional).length;
  const optionalFailed = results.filter(r => !r.success && r.optional).length;

  logger.info(`
╔════════════════════════════════════════════════════════════╗
║  Inicialização Paralela Completa                           ║
╠════════════════════════════════════════════════════════════╣
║  ✅ Sucesso: ${successful.toString().padEnd(43)} ║
║  ❌ Falhas críticas: ${failed.toString().padEnd(36)} ║
║  ⚠️  Falhas opcionais: ${optionalFailed.toString().padEnd(34)} ║
║  ⏱️  Tempo total: ${totalDuration}ms${' '.repeat(38 - totalDuration.toString().length)} ║
╚════════════════════════════════════════════════════════════╝
  `);

  return {
    totalDuration,
    successful,
    failed,
    optionalFailed,
    results,
    allSuccess: failed === 0
  };
}

/**
 * Inicializa serviços em grupos (para dependências)
 * @param {Array} groups - Array de arrays de serviços
 * @returns {Promise<Object>} Resultados da inicialização
 */
export async function initializeServicesInGroups(groups) {
  const startTime = Date.now();
  const allResults = [];

  logger.info(`🚀 Iniciando ${groups.length} grupos de serviços sequencialmente...`);

  for (let i = 0; i < groups.length; i++) {
    logger.info(`📦 Grupo ${i + 1}/${groups.length}: ${groups[i].length} serviços`);
    const groupResult = await initializeServicesParallel(groups[i]);
    allResults.push(groupResult);

    // Se houver falhas críticas, parar
    if (!groupResult.allSuccess) {
      logger.error(`❌ Grupo ${i + 1} teve falhas críticas. Abortando inicialização.`);
      break;
    }
  }

  const totalDuration = Date.now() - startTime;
  const totalSuccessful = allResults.reduce((sum, r) => sum + r.successful, 0);
  const totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);

  logger.info(`✅ Inicialização em grupos completa: ${totalSuccessful} serviços em ${totalDuration}ms`);

  return {
    totalDuration,
    totalSuccessful,
    totalFailed,
    groups: allResults,
    allSuccess: totalFailed === 0
  };
}

/**
 * Wrapper para compatibilidade com código existente
 */
export async function initializeService(name, service, initMethod = 'init', optional = false) {
  const result = await initializeServicesParallel([{ name, service, initMethod, optional }]);
  return result.results[0];
}

export default {
  initializeServicesParallel,
  initializeServicesInGroups,
  initializeService
};
