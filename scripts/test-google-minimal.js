import axios from 'axios';

const API_KEY = 'AIzaSyASQ6IzrLay4PVsPPhYPFXisTubiTq7ocI';
const CX = '31b4cc13a8560425b';

const tests = [
  { name: 'Query: "STF"', query: 'STF' },
  { name: 'Query: "brasil"', query: 'brasil' },
  { name: 'Query: "direito"', query: 'direito' },
  { name: 'STF site:stf.jus.br', query: 'STF site:stf.jus.br' },
  { name: 'Sem query (teste puro)', query: '' }
];

console.log('='.repeat(60));
console.log('TESTE MINIMALISTA - Google Custom Search API');
console.log('='.repeat(60));

for (const test of tests) {
  console.log(`\n[${test.name}]`);
  console.log(`Query: "${test.query}"`);

  try {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: API_KEY,
        cx: CX,
        q: test.query || 'test',
        num: 3
      },
      timeout: 10000
    });

    const totalResults = response.data.searchInformation?.totalResults || 0;
    const itemsCount = response.data.items?.length || 0;

    console.log(`  Total estimado: ${totalResults}`);
    console.log(`  Items retornados: ${itemsCount}`);

    if (response.data.items && response.data.items.length > 0) {
      console.log(`  ✓ Primeiro resultado: ${response.data.items[0].title}`);
      console.log(`    URL: ${response.data.items[0].link}`);
    } else {
      console.log(`  ⚠ Nenhum item retornado`);
    }
  } catch (error) {
    console.log(`  ✗ Erro: ${error.message}`);
    if (error.response?.data) {
      console.log('  Detalhe API:', JSON.stringify(error.response.data.error, null, 2));
    }
  }
}

console.log('\n' + '='.repeat(60));
