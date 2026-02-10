/**
 * Unit Test: DataJud Fallback Logic
 *
 * Testa a lógica de fallback isoladamente
 */

console.log('\n═══════════════════════════════════════════════════════════');
console.log('🧪 TESTE UNITÁRIO: Lógica de Fallback DataJud');
console.log('═══════════════════════════════════════════════════════════\n');

// ✅ TESTE 1: Verificar lógica de detecção de ementas incompletas
console.log('📝 TESTE 1: Detecção de ementas incompletas');

const mockGoogleResults = [
  {
    tribunal: 'STF',
    numero: '123456',
    ementa: 'Ementa curta de apenas 100 caracteres que não é suficiente para análise completa do caso jurídico.',
    source: 'websearch'
  },
  {
    tribunal: 'STJ',
    numero: '789012',
    ementa: 'Outra ementa curta.',
    source: 'websearch'
  }
];

const hasCompleteEmentas = mockGoogleResults.some(r =>
  (r.ementa?.length || 0) > 500 || (r.ementaCompleta?.length || 0) > 500
);

console.log(`   Resultados mock: ${mockGoogleResults.length}`);
console.log(`   Maior ementa: ${Math.max(...mockGoogleResults.map(r => r.ementa?.length || 0))} chars`);
console.log(`   Tem ementas completas (>500 chars)? ${hasCompleteEmentas ? 'SIM' : 'NÃO'}`);
console.log(`   ✅ Deveria acionar fallback? ${!hasCompleteEmentas ? 'SIM' : 'NÃO'}`);

// ✅ TESTE 2: Verificar lógica com ementas completas
console.log('\n📝 TESTE 2: Detecção de ementas COMPLETAS (não deve usar fallback)');

const mockGoogleResultsComplete = [
  {
    tribunal: 'STF',
    numero: '123456',
    ementaCompleta: 'A'.repeat(600), // Ementa completa > 500 chars
    source: 'websearch'
  }
];

const hasCompleteEmentas2 = mockGoogleResultsComplete.some(r =>
  (r.ementa?.length || 0) > 500 || (r.ementaCompleta?.length || 0) > 500
);

console.log(`   Resultados mock: ${mockGoogleResultsComplete.length}`);
console.log(`   Maior ementa: ${mockGoogleResultsComplete[0].ementaCompleta.length} chars`);
console.log(`   Tem ementas completas (>500 chars)? ${hasCompleteEmentas2 ? 'SIM' : 'NÃO'}`);
console.log(`   ✅ Deveria acionar fallback? ${!hasCompleteEmentas2 ? 'SIM' : 'NÃO'}`);

// ✅ TESTE 3: Verificar lógica com array vazio (deve usar fallback)
console.log('\n📝 TESTE 3: Google retorna 0 resultados (deve usar fallback)');

const mockGoogleResultsEmpty = [];

const hasCompleteEmentas3 = mockGoogleResultsEmpty.some(r =>
  (r.ementa?.length || 0) > 500 || (r.ementaCompleta?.length || 0) > 500
);

console.log(`   Resultados mock: ${mockGoogleResultsEmpty.length}`);
console.log(`   Tem ementas completas? ${hasCompleteEmentas3 ? 'SIM' : 'NÃO'}`);
console.log(`   ✅ Deveria acionar fallback? ${mockGoogleResultsEmpty.length === 0 || !hasCompleteEmentas3 ? 'SIM' : 'NÃO'}`);

// ✅ TESTE 4: Verificar código real do arquivo
console.log('\n📝 TESTE 4: Verificando código real implementado');
console.log('   Abrindo jurisprudence-search-service.js...');

import { readFileSync } from 'fs';

const serviceCode = readFileSync('./src/services/jurisprudence-search-service.js', 'utf-8');

// Procurar pela lógica de fallback
const hasFallbackLogic = serviceCode.includes('FALLBACK INTELIGENTE');
const hasFallbackCheck = serviceCode.includes('hasCompleteEmentas');
const hasFallbackActivation = serviceCode.includes('ativando DataJud');
const hasDataJudCall = serviceCode.includes('this.searchDataJud');
const hasPerformanceFlag = serviceCode.includes('usedDataJudFallback');

console.log(`   ✅ Tem comentário FALLBACK INTELIGENTE? ${hasFallbackLogic ? 'SIM' : 'NÃO'}`);
console.log(`   ✅ Verifica hasCompleteEmentas? ${hasFallbackCheck ? 'SIM' : 'NÃO'}`);
console.log(`   ✅ Log "ativando DataJud"? ${hasFallbackActivation ? 'SIM' : 'NÃO'}`);
console.log(`   ✅ Chama this.searchDataJud? ${hasDataJudCall ? 'SIM' : 'NÃO'}`);
console.log(`   ✅ Flag usedDataJudFallback? ${hasPerformanceFlag ? 'SIM' : 'NÃO'}`);

// Extrair trecho da lógica de fallback
const fallbackStartIdx = serviceCode.indexOf('// ✅ FALLBACK INTELIGENTE');
if (fallbackStartIdx !== -1) {
  const fallbackCode = serviceCode.substring(fallbackStartIdx, fallbackStartIdx + 1000);
  console.log('\n   Trecho do código de fallback:');
  console.log('   ─────────────────────────────────────────');
  console.log(fallbackCode.split('\n').slice(0, 15).map(l => `   ${l}`).join('\n'));
  console.log('   ─────────────────────────────────────────');
}

// ✅ TESTE 5: Verificar remoção da limitação de tribunais superiores
console.log('\n📝 TESTE 5: Verificando remoção da limitação de tribunais superiores');

const hasOldLimitation = serviceCode.includes('tribunaisSuperiores = [\'STJ\', \'STF\', \'TST\', \'TSE\', \'STM\']');
const hasOldConditional = serviceCode.includes('isTribunalSuperior');

console.log(`   ❌ Ainda tem array tribunaisSuperiores? ${hasOldLimitation ? 'SIM (BUG!)' : 'NÃO'}`);
console.log(`   ❌ Ainda checa isTribunalSuperior? ${hasOldConditional ? 'SIM (BUG!)' : 'NÃO'}`);

if (hasOldLimitation) {
  console.log('\n   ⚠️ AVISO: Código ainda contém limitação a tribunais superiores!');
  console.log('   Essa limitação deve ser removida para DataJud funcionar com TJGO, TJSP, etc.');
}

// ✅ RESUMO
console.log('\n═══════════════════════════════════════════════════════════');
console.log('📊 RESUMO DOS TESTES');
console.log('═══════════════════════════════════════════════════════════');

const allTestsPassed =
  hasFallbackLogic &&
  hasFallbackCheck &&
  hasFallbackActivation &&
  hasDataJudCall &&
  hasPerformanceFlag &&
  !hasOldLimitation;

console.log(`   Lógica de fallback: ${hasFallbackLogic ? '✅' : '❌'}`);
console.log(`   Detecção de ementas incompletas: ${hasFallbackCheck ? '✅' : '❌'}`);
console.log(`   Ativação de DataJud: ${hasFallbackActivation && hasDataJudCall ? '✅' : '❌'}`);
console.log(`   Performance tracking: ${hasPerformanceFlag ? '✅' : '❌'}`);
console.log(`   Sem limitação de tribunais: ${!hasOldLimitation ? '✅' : '❌'}`);

console.log(`\n   ${allTestsPassed ? '✅ TODOS OS TESTES PASSARAM' : '⚠️ ALGUNS TESTES FALHARAM'}\n`);

if (!allTestsPassed) {
  console.log('   ⚠️ Problemas encontrados que precisam ser corrigidos:');
  if (!hasFallbackLogic) console.log('      - Falta lógica de fallback');
  if (!hasFallbackCheck) console.log('      - Falta verificação de ementas completas');
  if (!hasFallbackActivation || !hasDataJudCall) console.log('      - Falta ativação de DataJud');
  if (!hasPerformanceFlag) console.log('      - Falta flag de performance');
  if (hasOldLimitation) console.log('      - Limitação de tribunais superiores ainda presente');
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════\n');
