#!/usr/bin/env node
import 'dotenv/config';

async function test() {
  console.log('🧪 Testando SCRAPING de URL real do TJGO...\n');

  // Decisão real do TJGO (formato esperado pelo scraper)
  const decision = {
    url: 'https://www.tjgo.jus.br/images/docs/CCS/itbiempresa.pdf',
    tribunal: 'TJGO',
    titulo: 'Voto ITBI sobre empresa',
    ementa: 'A base de cálculo do imposto é o valor venal dos bens...'
  };

  console.log(`URL: ${decision.url}\n`);

  const scraperModule = await import('./src/services/jurisprudence-scraper-service.js');
  const scraper = scraperModule.default;

  try {
    console.log('Tentando extrair ementa do PDF...\n');
    const result = await scraper.scrapeEmenta(decision);

    console.log('Tipo do retorno:', typeof result);
    console.log('É string?', typeof result === 'string');
    console.log('É objeto?', typeof result === 'object');

    if (typeof result === 'object') {
      console.log('\n📦 Objeto retornado:');
      console.log('  - scraped:', result.scraped);
      console.log('  - ementaCompleta exists:', !!result.ementaCompleta);
      console.log('  - ementaCompleta length:', result.ementaCompleta?.length);
      console.log('  - scrapingError:', result.scrapingError);
      console.log('  - Keys:', Object.keys(result).join(', '));
    }

    const ementa = result?.ementaCompleta || result?.text || result?.ementa;

    if (ementa && ementa.length > 500) {
      console.log('\n✅ SUCESSO: Ementa extraída!');
      console.log(`Tamanho: ${ementa.length} caracteres`);
      console.log(`Preview (500 chars):\n${ementa.substring(0, 500)}...\n`);
    } else if (ementa) {
      console.log(`\n⚠️ Ementa curta: ${ementa.length} chars`);
      console.log(`Conteúdo: ${ementa}`);
    } else {
      console.log('\n❌ FALHA: Nenhuma ementa extraída');
    }
  } catch (error) {
    console.log(`❌ ERRO: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
  }
}

test().catch(console.error);
