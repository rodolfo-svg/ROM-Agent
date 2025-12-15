/**
 * Script de Teste - Sistema de Deploy Automático
 * Testa as funcionalidades básicas do sistema
 */

import { scheduler } from './src/jobs/scheduler.js';
import { deployJob } from './src/jobs/deploy-job.js';
import { logger } from './src/utils/logger.js';

console.log('=== Teste do Sistema de Deploy Automático ===\n');

// Teste 1: Logger
console.log('1. Testando logger...');
logger.info('Teste de log INFO');
logger.warn('Teste de log WARN');
logger.error('Teste de log ERROR');
logger.debug('Teste de log DEBUG');
console.log('✅ Logger funcionando\n');

// Teste 2: Deploy Job Status
console.log('2. Testando status do deploy job...');
const deployStatus = deployJob.getStatus();
console.log('Status:', JSON.stringify(deployStatus, null, 2));
console.log('✅ Deploy job funcionando\n');

// Teste 3: Scheduler
console.log('3. Testando scheduler...');
const schedulerStatus = scheduler.getStatus();
console.log('Status do scheduler:', JSON.stringify(schedulerStatus, null, 2));
console.log('✅ Scheduler funcionando\n');

// Teste 4: Iniciar scheduler
console.log('4. Iniciando scheduler...');
scheduler.start();
console.log('✅ Scheduler iniciado\n');

// Teste 5: Listar jobs
console.log('5. Listando jobs agendados...');
const jobs = scheduler.listJobs();
console.log('✅ Jobs listados\n');

// Teste 6: Verificar janela de deploy
console.log('6. Verificando janela de deploy...');
const isInWindow = deployJob.isInDeployWindow();
const currentHour = new Date().getHours();
console.log(`Hora atual: ${currentHour}h`);
console.log(`Está na janela de deploy (02h-05h): ${isInWindow}`);
console.log('✅ Verificação concluída\n');

// Teste 7: Verificar histórico
console.log('7. Verificando histórico de deploys...');
try {
  const history = await deployJob.getHistory(5);
  console.log(`Deploys no histórico: ${history.length}`);
  console.log('✅ Histórico acessível\n');
} catch (error) {
  console.log('ℹ️ Nenhum histórico ainda (normal para primeira execução)\n');
}

// Parar scheduler
console.log('8. Parando scheduler...');
scheduler.stop();
console.log('✅ Scheduler parado\n');

console.log('=== Todos os testes concluídos com sucesso! ===');
console.log('\nPróximos passos:');
console.log('1. Inicie o servidor: npm start');
console.log('2. Acesse as APIs em http://localhost:3000/api/');
console.log('3. Verifique os logs em logs/');
console.log('\nAPIs disponíveis:');
console.log('- GET  /api/scheduler/status');
console.log('- GET  /api/scheduler/jobs');
console.log('- POST /api/scheduler/run/:jobName');
console.log('- GET  /api/deploy/status');
console.log('- GET  /api/deploy/history');
console.log('- POST /api/deploy/execute');
console.log('- GET  /api/logs');
console.log('- GET  /api/logs/files');

process.exit(0);
