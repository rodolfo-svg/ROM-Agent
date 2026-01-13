#!/usr/bin/env node
/**
 * Teste do Pipeline Completo de Jurisprudência
 *
 * Testa: Google Search → Scraping → Análise Semântica
 */

import 'dotenv/config';
import jurisprudenceSearchService from './src/services/jurisprudence-search-service.js';

async function testPipeline() {
  console.log('🧪 TESTE DO PIPELINE DE JURISPRUDÊNCIA\n');
  console.log('Objetivo: Validar scraping + análise semântica');
  console.log('Query: "habeas corpus violação domicílio"\n');
  console.log('═'.repeat(80));

  try {
    const startTime = Date.now();

    // Busca com limite de 2 resultados para teste rápido
    const results = await jurisprudenceSearchService.searchAll(
      'habeas corpus violação domicílio',
      {
        tribunal: 'TJGO',
        limit: 2
      }
    );

    const duration = Date.now() - startTime;

    console.log('\n' + '═'.repeat(80));
    console.log('✅ RESULTADO DO TESTE\n');

    console.log(`⏱️  Duração total: ${duration}ms`);
    console.log(`📊 Total de resultados: ${results.totalResults || 0}`);
    console.log(`🔬 Enriquecimento: ${results.enriched ? '✅ ATIVO' : '❌ INATIVO'}`);
    const sources = typeof results.sources === 'object' ? Object.keys(results.sources) : (results.sources || []);
    console.log(`📁 Fontes: ${Array.isArray(sources) ? sources.join(', ') : 'Nenhuma'}`);

    if (results.allResults && results.allResults.length > 0) {
      console.log('\n' + '─'.repeat(80));
      console.log('🔍 ANÁLISE DO PRIMEIRO RESULTADO:\n');

      const first = results.allResults[0];

      console.log(`Tribunal: ${first.tribunal || 'N/A'}`);
      console.log(`Título: ${first.titulo?.substring(0, 100) || 'N/A'}...`);
      console.log(`URL: ${first.url?.substring(0, 80) || 'N/A'}`);

      console.log('\n📝 EMENTA:');
      if (first.ementaCompleta) {
        console.log(`   Tamanho: ${first.ementaCompleta.length} chars`);
        console.log(`   Preview: ${first.ementaCompleta.substring(0, 200)}...`);
        console.log(`   ✅ Scraping: ${first.scraped ? 'SUCESSO' : 'FALHOU'}`);
        if (first.scraped) {
          console.log(`   📥 Cache: ${first.fromCache ? 'HIT' : 'MISS'}`);
        }
      } else {
        console.log('   ❌ Ementa não disponível (apenas snippet)');
      }

      console.log('\n🧠 ANÁLISE SEMÂNTICA:');
      if (first.analise) {
        console.log(`   ✅ Análise: SUCESSO`);
        console.log(`   Tese: ${first.analise.teseJuridica?.substring(0, 150) || 'N/A'}...`);
        console.log(`   Resultado: ${first.analise.resultado || 'N/A'}`);
        console.log(`   Fundamentos: ${first.analise.fundamentosLegais?.length || 0} identificados`);
        console.log(`   Súmulas: ${first.analise.sumulas?.length || 0} identificadas`);
        console.log(`   Precedentes: ${first.analise.precedentes?.length || 0} identificados`);
        console.log(`   Relevância: ${first.analise.relevanciaParaCaso || 0}/100`);

        if (first.analise.fundamentosLegais?.length > 0) {
          console.log(`\n   📚 Fundamentos Legais:`);
          first.analise.fundamentosLegais.slice(0, 5).forEach(f => {
            console.log(`      - ${f}`);
          });
        }

        if (first.analise.sumulas?.length > 0) {
          console.log(`\n   ⚖️  Súmulas:`);
          first.analise.sumulas.slice(0, 3).forEach(s => {
            console.log(`      - ${s}`);
          });
        }
      } else {
        console.log(`   ❌ Análise: ${first.analyzeError || 'FALHOU'}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('🎯 DIFERENCIAL ROM AGENT vs MERCADO:\n');
    console.log('❌ Mercado: Apenas títulos + snippets de 200 chars');
    console.log('✅ ROM Agent: Ementas COMPLETAS + análise jurídica automática');
    console.log('   - Tese extraída automaticamente');
    console.log('   - Fundamentos legais identificados');
    console.log('   - Súmulas e precedentes mapeados');
    console.log('   - Relevância calculada para o caso');
    console.log('   - Resumo executivo gerado\n');

    console.log('═'.repeat(80));

    // Validações
    const first = results.allResults?.[0];
    const validations = {
      'Busca retornou resultados': results.totalResults > 0,
      'Enriquecimento ativo': results.enriched === true,
      'Primeiro resultado tem ementa completa': first?.ementaCompleta?.length > 500,
      'Scraping funcionou': first?.scraped === true,
      'Análise semântica funcionou': first?.analise?.teseJuridica?.length > 0,
      'Fundamentos extraídos': first?.analise?.fundamentosLegais?.length > 0
    };

    console.log('\n✅ VALIDAÇÕES:\n');
    let allPassed = true;
    for (const [check, passed] of Object.entries(validations)) {
      const status = passed ? '✅' : '❌';
      console.log(`${status} ${check}`);
      if (!passed) allPassed = false;
    }

    console.log('\n' + '═'.repeat(80));
    if (allPassed) {
      console.log('🎉 PIPELINE COMPLETO FUNCIONANDO PERFEITAMENTE!\n');
      process.exit(0);
    } else {
      console.log('⚠️  PIPELINE PARCIALMENTE FUNCIONAL - Verificar falhas acima\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n' + '═'.repeat(80));
    console.error('❌ ERRO NO TESTE:\n');
    console.error(error);
    console.error('\n' + '═'.repeat(80));
    process.exit(1);
  }
}

// Executar teste
testPipeline();
