/**
 * ROM Agent - Servidor Multi-Core com Clustering
 * Usa todos os processadores disponíveis para máxima performance
 */

import cluster from 'cluster';
import os from 'os';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Número de CPUs disponíveis
const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ██████╗  ██████╗ ███╗   ███╗                              ║
║   ██╔══██╗██╔═══██╗████╗ ████║                              ║
║   ██████╔╝██║   ██║██╔████╔██║                              ║
║   ██╔══██╗██║   ██║██║╚██╔╝██║                              ║
║   ██║  ██║╚██████╔╝██║ ╚═╝ ██║                              ║
║   ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝                              ║
║                                                              ║
║   🚀 SERVIDOR MULTI-CORE INICIANDO                          ║
║   Processadores Disponíveis: ${numCPUs.toString().padEnd(2)}                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  console.log(`\n🔄 Criando ${numCPUs} workers (um por CPU)...\n`);

  // Criar um worker para cada CPU
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    console.log(`✅ Worker ${worker.process.pid} iniciado (CPU ${i + 1}/${numCPUs})`);
  }

  // Contador de workers online
  let workersOnline = 0;

  // Quando um worker fica online
  cluster.on('online', (worker) => {
    workersOnline++;
    if (workersOnline === numCPUs) {
      console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
      console.log(`║  🎉 TODOS OS ${numCPUs} WORKERS ESTÃO ONLINE!                        ║`);
      console.log(`║  🚀 Servidor rodando com MÁXIMA PERFORMANCE                  ║`);
      console.log(`║  📊 Balanceamento de carga automático ativo                  ║`);
      console.log(`║  💪 Usando 100% dos recursos do processador                  ║`);
      console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
    }
  });

  // Se um worker morrer, criar um novo
  cluster.on('exit', (worker, code, signal) => {
    console.log(`\n⚠️  Worker ${worker.process.pid} morreu (code: ${code}, signal: ${signal})`);
    console.log(`🔄 Criando novo worker para substituir...`);

    const newWorker = cluster.fork();
    console.log(`✅ Novo worker ${newWorker.process.pid} criado\n`);
  });

  // Estatísticas a cada 60 segundos
  setInterval(() => {
    const workers = Object.values(cluster.workers);
    console.log(`\n📊 Estatísticas do Cluster:`);
    console.log(`   Workers ativos: ${workers.length}`);
    console.log(`   CPUs em uso: ${numCPUs}`);
    console.log(`   Uptime: ${Math.floor(process.uptime())}s\n`);
  }, 60000);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\n⚠️  SIGTERM recebido. Desligando workers gracefully...\n');

    for (const id in cluster.workers) {
      console.log(`🛑 Desligando worker ${cluster.workers[id].process.pid}...`);
      cluster.workers[id].kill();
    }
  });

  process.on('SIGINT', () => {
    console.log('\n⚠️  SIGINT recebido. Desligando workers gracefully...\n');

    for (const id in cluster.workers) {
      console.log(`🛑 Desligando worker ${cluster.workers[id].process.pid}...`);
      cluster.workers[id].kill();
    }

    process.exit(0);
  });

} else {
  // Worker process - importa e executa o servidor MELHORADO
  const serverPath = path.join(__dirname, 'server-enhanced.js');

  // Importa dinamicamente o servidor
  import(serverPath).then(() => {
    console.log(`[Worker ${process.pid}] ✅ Servidor ENHANCED iniciado e pronto para receber requisições`);
  }).catch(error => {
    console.error(`[Worker ${process.pid}] ❌ Erro ao iniciar:`, error);
    process.exit(1);
  });
}
