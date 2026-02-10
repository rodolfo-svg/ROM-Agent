/**
 * Test Script: DataJud Intelligent Fallback
 *
 * Testa:
 * 1. Google Search executa primeiro
 * 2. Se ementas < 500 chars → ativa DataJud
 * 3. Extração de vigência e dados catalogográficos
 */

import jurisprudenceSearchService from '../src/services/jurisprudence-search-service.js';
import { logger } from '../src/utils/logger.js';

async function testDataJudFallback() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🧪 TESTE: Fallback Inteligente DataJud');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Inicializar serviço
    await jurisprudenceSearchService.init();

    console.log('📊 Configuração Atual:');
    console.log(`   - DataJud Enabled: ${process.env.DATAJUD_ENABLED}`);
    console.log(`   - DataJud API Key: ${process.env.DATAJUD_API_KEY ? '✅ Configurada' : '❌ Não configurada'}`);
    console.log(`   - Google Search API: ${process.env.GOOGLE_SEARCH_API_KEY ? '✅ Configurada' : '❌ Não configurada'}`);
    console.log('');

    // TESTE 1: Busca que deve usar apenas Google Search (ementas completas)
    console.log('🔍 TESTE 1: Busca com Google Search (deve encontrar ementas completas)');
    console.log('   Termo: "habeas corpus prisão preventiva STF"');
    console.log('');

    const result1 = await jurisprudenceSearchService.searchAll('habeas corpus prisão preventiva STF', {
      limit: 5,
      tribunal: 'STF',
      enableCache: false
    });

    console.log('\n📋 RESULTADO TESTE 1:');
    console.log(`   - Total de resultados: ${result1.totalResults}`);
    console.log(`   - Fontes usadas: ${Object.keys(result1.sources).join(', ')}`);
    console.log(`   - Usou fallback DataJud? ${result1.performance?.usedDataJudFallback ? '✅ SIM' : '❌ NÃO'}`);

    if (result1.allResults?.length > 0) {
      const firstResult = result1.allResults[0];
      console.log(`\n   Primeiro resultado:`);
      console.log(`   - Tribunal: ${firstResult.tribunal}`);
      console.log(`   - Número: ${firstResult.numero || 'N/A'}`);
      console.log(`   - Ementa length: ${firstResult.ementa?.length || 0} chars`);
      console.log(`   - Ementa completa length: ${firstResult.ementaCompleta?.length || 0} chars`);
      console.log(`   - Vigência: ${firstResult.analise?.vigencia?.status || 'N/A'}`);
    }

    // TESTE 2: Busca específica em tribunal estadual (pode acionar fallback)
    console.log('\n\n🔍 TESTE 2: Busca em tribunal estadual (pode acionar DataJud)');
    console.log('   Termo: "ICMS base de cálculo"');
    console.log('   Tribunal: TJGO');
    console.log('');

    const result2 = await jurisprudenceSearchService.searchAll('ICMS base de cálculo', {
      limit: 5,
      tribunal: 'TJGO',
      enableCache: false
    });

    console.log('\n📋 RESULTADO TESTE 2:');
    console.log(`   - Total de resultados: ${result2.totalResults}`);
    console.log(`   - Fontes usadas: ${Object.keys(result2.sources).join(', ')}`);
    console.log(`   - Usou fallback DataJud? ${result2.performance?.usedDataJudFallback ? '✅ SIM' : '❌ NÃO'}`);

    if (result2.allResults?.length > 0) {
      const firstResult = result2.allResults[0];
      console.log(`\n   Primeiro resultado:`);
      console.log(`   - Tribunal: ${firstResult.tribunal}`);
      console.log(`   - Source: ${firstResult.source}`);
      console.log(`   - Ementa length: ${firstResult.ementa?.length || 0} chars`);
      console.log(`   - Dados catalogográficos:`);
      console.log(`     - Relator: ${firstResult.relator || 'N/A'}`);
      console.log(`     - Órgão: ${firstResult.orgaoJulgador || 'N/A'}`);
      console.log(`     - Data: ${firstResult.data || 'N/A'}`);
      console.log(`     - Classe: ${firstResult.classe || 'N/A'}`);

      if (firstResult.analise) {
        console.log(`\n   Análise Bedrock:`);
        console.log(`     - Tese/Ratio: ${firstResult.analise.teseJuridica?.substring(0, 100) || 'N/A'}...`);
        console.log(`     - Vigência: ${firstResult.analise.vigencia?.status || 'N/A'}`);
        if (firstResult.analise.vigencia?.observacao) {
          console.log(`     - Obs. Vigência: ${firstResult.analise.vigencia.observacao}`);
        }
      }
    }

    // TESTE 3: Forçar condição de fallback (busca genérica)
    console.log('\n\n🔍 TESTE 3: Busca genérica (maior chance de fallback)');
    console.log('   Termo: "indenização dano moral"');
    console.log('');

    const result3 = await jurisprudenceSearchService.searchAll('indenização dano moral', {
      limit: 3,
      enableCache: false
    });

    console.log('\n📋 RESULTADO TESTE 3:');
    console.log(`   - Total de resultados: ${result3.totalResults}`);
    console.log(`   - Fontes usadas: ${Object.keys(result3.sources).join(', ')}`);
    console.log(`   - Usou fallback DataJud? ${result3.performance?.usedDataJudFallback ? '✅ SIM' : '❌ NÃO'}`);

    // Estatísticas gerais
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 ESTATÍSTICAS GERAIS');
    console.log('═══════════════════════════════════════════════════════════');

    const allResults = [...result1.allResults, ...result2.allResults, ...result3.allResults];
    const withCompleteEmentas = allResults.filter(r => (r.ementaCompleta?.length || 0) > 500).length;
    const withVigencia = allResults.filter(r => r.analise?.vigencia).length;
    const withCatalogData = allResults.filter(r => r.relator || r.orgaoJulgador).length;

    console.log(`   Total de resultados: ${allResults.length}`);
    console.log(`   Com ementa completa (>500 chars): ${withCompleteEmentas} (${((withCompleteEmentas/allResults.length)*100).toFixed(1)}%)`);
    console.log(`   Com vigência extraída: ${withVigencia} (${((withVigencia/allResults.length)*100).toFixed(1)}%)`);
    console.log(`   Com dados catalogográficos: ${withCatalogData} (${((withCatalogData/allResults.length)*100).toFixed(1)}%)`);

    console.log('\n✅ Teste concluído com sucesso!\n');

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Executar teste
testDataJudFallback();
