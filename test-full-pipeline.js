#!/usr/bin/env node
import 'dotenv/config';
import jurisprudenceService from './src/services/jurisprudence-search-service.js';

async function test() {
  console.log('🧪 Testando PIPELINE COMPLETO: Google → Scraping → Análise\n');

  const results = await jurisprudenceService.searchAll('ITBI base de cálculo', {
    tribunal: 'TJGO',
    limit: 2
  });

  console.log('\n📊 RESULTADOS:\n');
  console.log(`Enriched: ${results.enriched}`);
  console.log(`Total: ${results.allResults?.length}\n`);

  if (results.sources?.websearch?.results) {
    results.sources.websearch.results.forEach((item, idx) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[${idx+1}] ${item.titulo}`);
      console.log(`URL: ${item.url || item.link}`);
      console.log(`Tribunal: ${item.tribunal}`);

      if (item.ementaCompleta) {
        console.log(`✅ Ementa: ${item.ementaCompleta.length} caracteres`);
        console.log(`Preview: ${item.ementaCompleta.substring(0, 200)}...`);
      } else {
        console.log(`❌ Ementa: NÃO (apenas snippet ${item.snippet?.length || 0} chars)`);
      }

      if (item.scraped) {
        console.log(`✅ Scraped: SIM`);
      } else {
        console.log(`❌ Scraped: NÃO`);
      }

      if (item.analise?.teseJuridica) {
        console.log(`✅ Análise: SIM`);
        console.log(`Tese: ${item.analise.teseJuridica.substring(0, 100)}...`);
        console.log(`Relevância: ${item.analise.relevanciaParaCaso}/100`);
      } else {
        console.log(`❌ Análise: NÃO`);
      }

      if (item.scrapingError) {
        console.log(`⚠️  Erro scraping: ${item.scrapingError}`);
      }
      console.log('');
    });
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📝 RESUMO:');
  const withEmenta = results.sources?.websearch?.results?.filter(r => r.ementaCompleta).length || 0;
  const withAnalise = results.sources?.websearch?.results?.filter(r => r.analise).length || 0;
  console.log(`Ementas completas: ${withEmenta}/${results.sources?.websearch?.results?.length || 0}`);
  console.log(`Com análise: ${withAnalise}/${results.sources?.websearch?.results?.length || 0}`);
}

test().catch(console.error);
