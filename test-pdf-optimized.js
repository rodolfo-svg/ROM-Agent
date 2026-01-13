#!/usr/bin/env node
import 'dotenv/config';

async function test() {
  console.log('🧪 Testando PDF extraction OTIMIZADO (pdf-parse)...\n');

  const decision = {
    url: 'https://www.tjgo.jus.br/images/docs/CCS/itbiempresa.pdf',
    tribunal: 'TJGO',
    titulo: 'Voto ITBI sobre empresa',
    ementa: 'A base de cálculo do imposto é o valor venal dos bens...'
  };

  console.log(`URL: ${decision.url}\n`);

  const scraperModule = await import('./src/services/jurisprudence-scraper-service.js');
  const scraper = scraperModule.default;

  console.log('📊 Memória ANTES:');
  const memBefore = process.memoryUsage();
  console.log(`  RSS: ${(memBefore.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  HeapUsed: ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)} MB\n`);

  try {
    console.log('Extraindo ementa com pdf-parse...\n');
    const startTime = Date.now();

    const result = await scraper.scrapeEmenta(decision);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('📊 Memória DEPOIS:');
    const memAfter = process.memoryUsage();
    console.log(`  RSS: ${(memAfter.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  HeapUsed: ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Delta: +${((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(2)} MB\n`);

    console.log('⏱️  Tempo:', duration, 'segundos\n');

    if (result.scraped && result.ementaCompleta) {
      console.log('✅ SUCESSO!');
      console.log(`  - Scraped: ${result.scraped}`);
      console.log(`  - Tamanho: ${result.ementaCompleta.length} chars`);
      console.log(`  - Preview: ${result.ementaCompleta.substring(0, 200)}...`);
    } else {
      console.log('❌ FALHA:', result.scrapingError || 'Ementa não extraída');
    }
  } catch (error) {
    console.log(`❌ ERRO: ${error.message}`);
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    console.log('\n🗑️  Garbage collection forçada');
  }
}

test().catch(console.error);
