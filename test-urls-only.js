#!/usr/bin/env node
import 'dotenv/config';

async function test() {
  console.log('Testando URLs retornadas pelo Google Search...\n');

  const { GoogleSearchClient } = await import('./lib/google-search-client.js');
  const googleClient = new GoogleSearchClient();

  const query = 'ITBI base de cálculo';
  const tribunal = 'TJGO';
  console.log(`Query: ${query}`);
  console.log(`Tribunal: ${tribunal}\n`);

  const results = await googleClient.search(query, { num: 5, tribunal });

  console.log(`✅ Total: ${results.items?.length || 0} resultados\n`);

  if (results.items) {
    results.items.forEach((item, idx) => {
      console.log(`[${idx+1}] ${item.title}`);
      console.log(`    URL: ${item.link}`);
      console.log(`    Snippet: ${item.snippet?.substring(0, 100)}...`);
      console.log('');
    });
  } else {
    console.log('❌ Nenhum resultado retornado');
    console.log('Response:', JSON.stringify(results, null, 2));
  }
}

test().catch(console.error);
