#!/usr/bin/env node

/**
 * Script de Teste - Busca de Jurisprudência TJGO
 *
 * Valida as correções implementadas:
 * - Timeouts funcionando
 * - Google Search priorizando TJGO
 * - Logging detalhado
 * - JusBrasil não travando o sistema
 */

import jurisprudenceSearchService from '../src/services/jurisprudence-search-service.js';

async function testTJGO() {
  console.log('='.repeat(80));
  console.log('🧪 TESTE: Busca de Jurisprudência TJGO');
  console.log('='.repeat(80));
  console.log('');

  // Inicializar serviço
  console.log('📦 Inicializando serviço de busca...');
  await jurisprudenceSearchService.init();
  console.log('');

  // Mostrar configuração
  const stats = jurisprudenceSearchService.getStats();
  console.log('⚙️  Configuração:');
  console.log(`   DataJud: ${stats.sources.datajud.enabled ? '✅ Habilitado' : '❌ Desabilitado'} ${stats.sources.datajud.configured ? '(configurado)' : '(não configurado)'}`);
  console.log(`   Google Search: ${stats.sources.websearch.enabled ? '✅ Habilitado' : '❌ Desabilitado'}`);
  console.log(`   JusBrasil: ${stats.sources.jusbrasil.enabled ? '✅ Habilitado' : '❌ Desabilitado'} ${stats.sources.jusbrasil.status}`);
  console.log('');

  // Teste 1: Busca genérica no TJGO
  console.log('─'.repeat(80));
  console.log('📋 TESTE 1: Busca genérica no TJGO');
  console.log('─'.repeat(80));

  const startTime1 = Date.now();
  const result1 = await jurisprudenceSearchService.searchAll(
    'responsabilidade civil médica erro diagnóstico',
    {
      limit: 5,
      tribunal: 'TJGO',
      enableCache: false
    }
  );
  const duration1 = Date.now() - startTime1;

  console.log('');
  console.log('📊 Resultados:');
  console.log(`   ⏱️  Tempo total: ${duration1}ms`);
  console.log(`   📈 Resultados encontrados: ${result1.totalResults}`);
  console.log(`   🎯 Tribunais: ${result1.summary.tribunaisEncontrados.join(', ')}`);
  console.log('');
  console.log('   🔍 Fontes:');

  Object.entries(result1.sources).forEach(([source, data]) => {
    const icon = data.success ? '✅' : '❌';
    const status = data.success
      ? `${data.count} resultado(s)`
      : `${data.error}${data.isTimeout ? ' (TIMEOUT)' : ''}${data.isBlocked ? ' (BLOQUEADO)' : ''}`;
    console.log(`      ${icon} ${source}: ${status}`);
  });

  // Validações
  console.log('');
  console.log('✓ Validações:');

  if (duration1 < 30000) {
    console.log('   ✅ Tempo < 30s (não travou)');
  } else {
    console.log('   ❌ FALHOU: Tempo > 30s (sistema travou)');
  }

  if (result1.performance) {
    console.log(`   ✅ Métricas de performance coletadas (${result1.performance.successfulSources}/${result1.performance.sourcesUsed} fontes)`);
  }

  const hasGoogleResults = result1.sources.websearch?.success && result1.sources.websearch.count > 0;
  if (hasGoogleResults) {
    console.log('   ✅ Google Search retornou resultados');
  } else if (result1.sources.websearch?.isTimeout) {
    console.log('   ⚠️  Google Search timeout (verifique API key)');
  } else {
    console.log('   ⚠️  Google Search não configurado ou sem resultados');
  }

  const jusbrasil = result1.sources.jusbrasil;
  if (jusbrasil) {
    if (jusbrasil.isTimeout) {
      console.log('   ✅ JusBrasil timeout detectado corretamente (não travou sistema)');
    } else if (jusbrasil.success) {
      console.log('   ✅ JusBrasil retornou resultados');
    } else {
      console.log(`   ⚠️  JusBrasil falhou: ${jusbrasil.error}`);
    }
  }

  console.log('');

  // Teste 2: Busca específica com termo do TJGO
  console.log('─'.repeat(80));
  console.log('📋 TESTE 2: Termo específico do TJGO');
  console.log('─'.repeat(80));

  const startTime2 = Date.now();
  const result2 = await jurisprudenceSearchService.searchAll(
    'IPVA veículo roubado exoneração Goiás',
    {
      limit: 5,
      tribunal: 'TJGO',
      enableCache: false
    }
  );
  const duration2 = Date.now() - startTime2;

  console.log('');
  console.log('📊 Resultados:');
  console.log(`   ⏱️  Tempo total: ${duration2}ms`);
  console.log(`   📈 Resultados: ${result2.totalResults}`);

  if (result2.totalResults > 0) {
    console.log('');
    console.log('   📄 Primeiros resultados:');
    result2.allResults.slice(0, 3).forEach((r, i) => {
      console.log(`      ${i + 1}. [${r.tribunal}] ${r.numero}`);
      console.log(`         ${r.ementa.substring(0, 100)}...`);
      console.log(`         Fonte: ${r.source}`);
    });
  }

  console.log('');

  // Resumo final
  console.log('='.repeat(80));
  console.log('📝 RESUMO DOS TESTES');
  console.log('='.repeat(80));
  console.log('');

  const totalTime = duration1 + duration2;
  const avgTime = totalTime / 2;

  console.log(`⏱️  Tempo Médio: ${avgTime.toFixed(0)}ms`);
  console.log(`📊 Total de Resultados: ${result1.totalResults + result2.totalResults}`);

  console.log('');
  console.log('🎯 Status das Correções:');

  if (avgTime < 15000) {
    console.log('   ✅ EXCELENTE: Tempo médio < 15s');
  } else if (avgTime < 30000) {
    console.log('   ✅ BOM: Tempo médio < 30s (não trava mais)');
  } else {
    console.log('   ❌ PROBLEMA: Ainda está travando (> 30s)');
  }

  const allSourcesTracked = result1.sources && Object.keys(result1.sources).length > 0;
  console.log(`   ${allSourcesTracked ? '✅' : '❌'} Logging detalhado: ${allSourcesTracked ? 'Funcionando' : 'Faltando'}`);

  const hasPerformanceMetrics = result1.performance && result2.performance;
  console.log(`   ${hasPerformanceMetrics ? '✅' : '❌'} Métricas de performance: ${hasPerformanceMetrics ? 'Coletadas' : 'Faltando'}`);

  const googleWorking = hasGoogleResults;
  console.log(`   ${googleWorking ? '✅' : '⚠️ '} Google Search: ${googleWorking ? 'Funcionando' : 'Não configurado ou falhando'}`);

  const jusbrasulNotBlocking = duration1 < 30000 && duration2 < 30000;
  console.log(`   ${jusbrasulNotBlocking ? '✅' : '❌'} JusBrasil: ${jusbrasulNotBlocking ? 'Não está travando' : 'Ainda travando'}`);

  console.log('');

  if (!googleWorking) {
    console.log('⚠️  RECOMENDAÇÃO:');
    console.log('   Configure Google Search API para melhor performance:');
    console.log('   1. Acesse: https://console.cloud.google.com/apis/credentials');
    console.log('   2. Crie API Key e habilite Custom Search API');
    console.log('   3. Configure: https://programmablesearchengine.google.com/');
    console.log('   4. Adicione ao .env:');
    console.log('      GOOGLE_SEARCH_API_KEY=sua_api_key');
    console.log('      GOOGLE_SEARCH_CX=seu_custom_search_id');
    console.log('');
  }

  if (result1.sources.jusbrasil?.isTimeout || result2.sources.jusbrasil?.isTimeout) {
    console.log('⚠️  JusBrasil está com timeout frequente.');
    console.log('   Considere desabilitar no .env: JUSBRASIL_ENABLED=false');
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('✅ Testes concluídos!');
  console.log('='.repeat(80));
}

// Executar testes
testTJGO().catch(error => {
  console.error('');
  console.error('❌ ERRO FATAL:', error.message);
  console.error(error.stack);
  process.exit(1);
});
