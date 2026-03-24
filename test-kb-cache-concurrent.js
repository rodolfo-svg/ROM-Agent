/**
 * Test script para validar correção de race condition no KB Cache
 * Simula múltiplos workers escrevendo simultaneamente
 */

import { KBDocumentsCache } from './lib/kb-cache.js';
import fs from 'fs';
import path from 'path';

console.log('🧪 Teste de Race Condition no KB Cache\n');

// Criar diretório de teste temporário
const testDir = path.join(process.cwd(), 'test-kb-cache-temp');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Criar múltiplas instâncias simulando workers diferentes
const numWorkers = 4;
const docsPerWorker = 10;
const caches = [];

console.log(`📊 Configuração do teste:`);
console.log(`   Workers: ${numWorkers}`);
console.log(`   Documentos por worker: ${docsPerWorker}`);
console.log(`   Total de documentos: ${numWorkers * docsPerWorker}\n`);

// Criar instâncias de cache para cada "worker"
for (let i = 0; i < numWorkers; i++) {
  const cache = new KBDocumentsCache();
  // Override do caminho do arquivo para usar diretório de teste
  cache.kbDocsPath = path.join(testDir, 'kb-documents.json');
  cache.cache = []; // Limpar cache
  cache.loaded = true;
  caches.push(cache);
}

// Função para simular um worker adicionando documentos
async function workerSimulation(workerId, cache) {
  console.log(`🔵 Worker ${workerId} iniciado (PID simulado: ${process.pid + workerId})`);

  for (let i = 0; i < docsPerWorker; i++) {
    const doc = {
      id: `kb-worker${workerId}-doc${i}`,
      name: `Document ${i} from Worker ${workerId}`,
      type: 'application/pdf',
      size: Math.floor(Math.random() * 1000000),
      uploadedAt: new Date().toISOString(),
      textLength: Math.floor(Math.random() * 10000),
      userId: `user-${workerId}`,
      path: `/fake/path/doc-${workerId}-${i}.pdf`,
      metadata: { worker: workerId, docIndex: i }
    };

    cache.add(doc);

    // Aguardar um pouco aleatório entre 10-50ms
    await new Promise(resolve => setTimeout(resolve, Math.random() * 40 + 10));
  }

  // Forçar salvamento final
  await cache._saveNow();

  console.log(`✅ Worker ${workerId} concluído`);
}

// Executar todos os workers em paralelo
async function runTest() {
  console.log('🚀 Iniciando workers em paralelo...\n');

  const startTime = Date.now();

  // Executar todos os workers simultaneamente
  const promises = caches.map((cache, index) => workerSimulation(index, cache));

  await Promise.all(promises);

  const duration = Date.now() - startTime;

  console.log(`\n⏱️ Todos os workers concluídos em ${duration}ms\n`);

  // Validar resultado
  console.log('🔍 Validando resultado...\n');

  // Ler arquivo final
  const kbPath = path.join(testDir, 'kb-documents.json');

  if (!fs.existsSync(kbPath)) {
    console.error('❌ FALHOU: Arquivo kb-documents.json não foi criado');
    return false;
  }

  try {
    const fileContent = fs.readFileSync(kbPath, 'utf8');
    const documents = JSON.parse(fileContent);

    console.log(`📊 Resultado:`);
    console.log(`   Documentos esperados: ${numWorkers * docsPerWorker}`);
    console.log(`   Documentos salvos: ${documents.length}`);

    // Verificar se todos os documentos estão presentes
    const expectedIds = new Set();
    for (let worker = 0; worker < numWorkers; worker++) {
      for (let doc = 0; doc < docsPerWorker; doc++) {
        expectedIds.add(`kb-worker${worker}-doc${doc}`);
      }
    }

    const actualIds = new Set(documents.map(d => d.id));
    const missing = [...expectedIds].filter(id => !actualIds.has(id));
    const extra = [...actualIds].filter(id => !expectedIds.has(id));

    if (missing.length > 0) {
      console.error(`   ❌ Documentos faltando: ${missing.length}`);
      console.error(`      IDs: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`);
    }

    if (extra.length > 0) {
      console.error(`   ⚠️ Documentos extras: ${extra.length}`);
    }

    // Verificar integridade do JSON (formatação)
    const isFormatted = fileContent.includes('\n') && fileContent.includes('  ');
    console.log(`   JSON formatado: ${isFormatted ? '✅ Sim' : '❌ Não'}`);

    // Verificar se há lock file remanescente
    const lockPath = kbPath + '.lock';
    const hasLock = fs.existsSync(lockPath);
    console.log(`   Lock file removido: ${hasLock ? '❌ Não (problema!)' : '✅ Sim'}`);

    const success = documents.length === numWorkers * docsPerWorker &&
                   missing.length === 0 &&
                   !hasLock;

    if (success) {
      console.log(`\n✅ TESTE PASSOU: Todos os documentos salvos corretamente sem corrupção!`);
    } else {
      console.log(`\n❌ TESTE FALHOU: Problemas detectados na concorrência`);
    }

    return success;

  } catch (error) {
    console.error(`\n❌ TESTE FALHOU: JSON corrompido ou inválido`);
    console.error(`   Erro: ${error.message}`);

    // Mostrar primeiros 500 caracteres do arquivo para debug
    try {
      const content = fs.readFileSync(kbPath, 'utf8');
      console.error(`\n   Primeiros 500 caracteres:\n   ${content.substring(0, 500)}`);
    } catch (e) {
      // Ignorar
    }

    return false;
  }
}

// Executar teste e limpar
runTest()
  .then(success => {
    // Limpar diretório de teste
    console.log(`\n🧹 Limpando diretório de teste...`);
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
      console.log(`✅ Limpeza concluída`);
    } catch (e) {
      console.error(`⚠️ Erro ao limpar: ${e.message}`);
    }

    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(`\n💥 Erro inesperado: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
