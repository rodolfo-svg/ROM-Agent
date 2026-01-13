#!/usr/bin/env node
import 'dotenv/config';

async function test() {
  console.log('🧪 Testando query TJGO com correção...\n');

  const { GoogleSearchClient } = await import('./lib/google-search-client.js');
  const googleClient = new GoogleSearchClient();

  const query = 'ITBI base de cálculo';
  const tribunal = 'TJGO';

  console.log(`Query: ${query}`);
  console.log(`Tribunal: ${tribunal}\n`);

  const results = await googleClient.search(query, { num: 3, tribunal });

  console.log(`\n✅ Total: ${results.results?.length || 0} resultados`);
  console.log(`Query executada: ${results.query}\n`);

  if (results.results && results.results.length > 0) {
    results.results.forEach((item, idx) => {
      console.log(`[${idx+1}] ${item.titulo}`);
      console.log(`    URL: ${item.url}`);
      console.log(`    Tipo: ${item.tipo}`);
      console.log('');
    });
    console.log('✅ SUCESSO: Retornou URLs de decisões');
  } else {
    console.log('❌ FALHA: Nenhum resultado');
  }
}

test().catch(console.error);
