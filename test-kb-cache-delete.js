/**
 * Test script para validar que deletes não são revertidos
 * Simula o cenário: Worker 1 deleta, Worker 2 adiciona novo doc
 */

import { KBDocumentsCache } from './lib/kb-cache.js';
import fs from 'fs';
import path from 'path';

console.log('🧪 Teste de Delete - Documentos Não Devem Voltar\n');

// Criar diretório de teste temporário
const testDir = path.join(process.cwd(), 'test-kb-delete-temp');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

const kbPath = path.join(testDir, 'kb-documents.json');

// CENÁRIO:
// 1. Cache inicial tem [A, B, C]
// 2. Worker 1 deleta C → [A, B]
// 3. Worker 2 (cache antigo [A, B, C]) adiciona D
// 4. Worker 2 salva → deve resultar em [A, B, D] (SEM C!)

async function runTest() {
  console.log('📋 CENÁRIO:');
  console.log('  1. Estado inicial: [A, B, C]');
  console.log('  2. Worker 1 deleta C → [A, B]');
  console.log('  3. Worker 2 (cache antigo) adiciona D');
  console.log('  4. Worker 2 salva → deve ser [A, B, D] (SEM C!)\n');

  // === SETUP INICIAL ===
  console.log('⚙️ Setup inicial...');

  const initialDocs = [
    { id: 'doc-A', name: 'Document A', uploadedAt: new Date().toISOString() },
    { id: 'doc-B', name: 'Document B', uploadedAt: new Date().toISOString() },
    { id: 'doc-C', name: 'Document C (será deletado)', uploadedAt: new Date().toISOString() }
  ];

  // Salvar estado inicial no disco
  fs.writeFileSync(kbPath, JSON.stringify(initialDocs, null, 2), 'utf8');
  console.log('✅ Estado inicial salvo: [A, B, C]\n');

  // === WORKER 1: DELETE C ===
  console.log('🔵 Worker 1: Deletando documento C...');

  const worker1 = new KBDocumentsCache();
  worker1.kbDocsPath = kbPath;
  worker1.cache = [...initialDocs]; // Cache inicial
  worker1.loaded = true;
  worker1.lastFileModTime = fs.statSync(kbPath).mtimeMs;

  // Deletar C
  await worker1.remove('doc-C', true); // immediate=true para salvar agora

  console.log(`✅ Worker 1 salvou: ${worker1.cache.length} documentos`);
  console.log(`   Cache Worker 1: ${worker1.cache.map(d => d.id).join(', ')}\n`);

  // Aguardar um pouco para garantir timestamp diferente
  await new Promise(resolve => setTimeout(resolve, 100));

  // === WORKER 2: CACHE ANTIGO + ADICIONAR D ===
  console.log('🔵 Worker 2: Cache antigo [A, B, C] + adicionar D...');

  const worker2 = new KBDocumentsCache();
  worker2.kbDocsPath = kbPath;
  worker2.cache = [...initialDocs]; // Cache ANTIGO (ainda tem C!)
  worker2.loaded = true;
  worker2.lastFileModTime = initialDocs[0] ? new Date(initialDocs[0].uploadedAt).getTime() : 0; // Timestamp ANTIGO

  console.log(`   Cache Worker 2 (antes de adicionar D): ${worker2.cache.map(d => d.id).join(', ')}`);

  // Adicionar documento D
  const docD = { id: 'doc-D', name: 'Document D (novo)', uploadedAt: new Date().toISOString() };
  worker2.add(docD);

  // Forçar salvamento
  await worker2._saveNow();

  console.log(`✅ Worker 2 salvou: ${worker2.cache.length} documentos`);
  console.log(`   Cache Worker 2 (depois de salvar): ${worker2.cache.map(d => d.id).join(', ')}\n`);

  // === VALIDAÇÃO ===
  console.log('🔍 Validando resultado final...\n');

  const finalDocs = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
  const finalIds = finalDocs.map(d => d.id).sort();

  console.log('📊 Resultado:');
  console.log(`   Documentos no disco: ${finalIds.join(', ')}`);
  console.log(`   Total: ${finalIds.length} documentos\n`);

  // Verificar
  const hasA = finalIds.includes('doc-A');
  const hasB = finalIds.includes('doc-B');
  const hasC = finalIds.includes('doc-C');
  const hasD = finalIds.includes('doc-D');

  console.log('✅ Validações:');
  console.log(`   ${hasA ? '✅' : '❌'} Documento A presente`);
  console.log(`   ${hasB ? '✅' : '❌'} Documento B presente`);
  console.log(`   ${!hasC ? '✅' : '❌'} Documento C AUSENTE (foi deletado)`);
  console.log(`   ${hasD ? '✅' : '❌'} Documento D presente (foi adicionado)\n`);

  const success = hasA && hasB && !hasC && hasD && finalIds.length === 3;

  if (success) {
    console.log('✅ TESTE PASSOU: Delete foi respeitado, C não voltou!');
    return true;
  } else {
    console.log('❌ TESTE FALHOU: Delete não foi respeitado');
    if (hasC) {
      console.log('   🐛 BUG: Documento C (deletado) foi restaurado!');
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
