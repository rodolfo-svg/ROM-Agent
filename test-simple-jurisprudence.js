#!/usr/bin/env node
import 'dotenv/config';
import jurisprudenceService from './src/services/jurisprudence-search-service.js';

async function test() {
  console.log('Testando...\n');

  const results = await jurisprudenceService.searchAll('habeas corpus violação domicílio', {
    tribunal: 'TJGO',
    limit: 2
  });

  console.log('\n✅ Enriched:', results.enriched);
  console.log('Total results:', results.allResults?.length);

  if (results.sources?.websearch?.results) {
    console.log('\n📊 WEBSEARCH RESULTS:\n');
    results.sources.websearch.results.forEach((item, idx) => {
      console.log(`[${idx+1}] ${item.titulo}`);
      console.log(`    URL: ${item.url || item.link}`);
      console.log(`    Ementa completa? ${item.ementaCompleta ? item.ementaCompleta.length + ' chars' : 'NÃO'}`);
      console.log(`    Scraped? ${item.scraped ? 'SIM' : 'NÃO'}`);
      console.log(`    Analyzed? ${item.analise ? 'SIM' : 'NÃO'}`);
      if (item.analise?.teseJuridica) {
        console.log(`    Tese: ${item.analise.teseJuridica.substring(0, 100)}...`);
      }
      if (item.scrapingError) {
        console.log(`    ❌ Erro scraping: ${item.scrapingError}`);
      }
      if (item.snippet) {
        console.log(`    Snippet original: ${item.snippet.substring(0, 100)}...`);
      }
      console.log('');
    });
  }
}

test().catch(console.error);
