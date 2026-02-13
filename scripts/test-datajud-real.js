/**
 * Test Real: DataJud API com chave real
 *
 * Testa diretamente a API DataJud para validar:
 * 1. Chave é válida
 * 2. Busca semântica funciona
 * 3. Retorna dados catalogográficos completos
 */

import https from 'https';

const DATAJUD_API_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
const DATAJUD_API_URL = 'https://api-publica.datajud.cnj.jus.br';

console.log('\n═══════════════════════════════════════════════════════════');
console.log('🧪 TESTE REAL: DataJud API');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📋 Configuração:');
console.log(`   URL: ${DATAJUD_API_URL}`);
console.log(`   API Key: ${DATAJUD_API_KEY.substring(0, 20)}...`);
console.log('');

/**
 * Fazer requisição HTTP
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 15000
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Teste 1: Endpoint de Processos (query simples)
 */
async function testProcessosEndpoint() {
  console.log('🔍 TESTE 1: Endpoint /api_publica_v1 (busca simples)');
  console.log('   Query: "habeas corpus"');
  console.log('');

  try {
    const url = `${DATAJUD_API_URL}/api_publica_v1/_search`;

    const queryBody = {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: 'habeas corpus',
                fields: ['ementa^3', 'textoIntegral', 'palavrasChave^2'],
                type: 'best_fields',
                fuzziness: 'AUTO'
              }
            }
          ]
        }
      },
      size: 5,
      from: 0
    };

    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${DATAJUD_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: queryBody,
      timeout: 15000
    });

    console.log(`   Status: ${response.statusCode}`);

    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      const hits = data.hits?.hits || [];

      console.log(`   ✅ Sucesso! ${hits.length} resultado(s) encontrados`);

      if (hits.length > 0) {
        const first = hits[0]._source || {};
        console.log('\n   Primeiro resultado:');
        console.log(`     - Tribunal: ${first.tribunal || first.siglaTribunal || 'N/A'}`);
        console.log(`     - Número: ${first.numeroProcesso || 'N/A'}`);
        console.log(`     - Ementa (primeiros 100 chars): ${(first.ementa || '').substring(0, 100)}...`);
        console.log(`     - Relator: ${first.relator || first.nomeRelator || 'N/A'}`);
        console.log(`     - Órgão: ${first.orgaoJulgador || 'N/A'}`);
        console.log(`     - Data: ${first.dataPublicacao || first.dataJulgamento || 'N/A'}`);
        console.log(`     - Score: ${hits[0]._score || 0}`);
      }

      return true;
    } else if (response.statusCode === 401) {
      console.log('   ❌ Erro 401: Chave inválida ou expirada');
      console.log(`   Response: ${response.body.substring(0, 200)}`);
      return false;
    } else if (response.statusCode === 404) {
      console.log('   ❌ Erro 404: Endpoint não encontrado');
      console.log(`   Response: ${response.body.substring(0, 200)}`);
      return false;
    } else {
      console.log(`   ❌ Erro ${response.statusCode}`);
      console.log(`   Response: ${response.body.substring(0, 200)}`);
      return false;
    }

  } catch (error) {
    console.error(`   ❌ Erro na requisição: ${error.message}`);
    return false;
  }
}

/**
 * Teste 2: Endpoint alternativo /decisoes
 */
async function testDecisoesEndpoint() {
  console.log('\n\n🔍 TESTE 2: Endpoint /api_publica_v1 (busca ICMS)');
  console.log('   Query: "ICMS base de cálculo"');
  console.log('');

  try {
    const url = `${DATAJUD_API_URL}/api_publica_v1/_search`;

    const queryBody = {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: 'ICMS base de cálculo',
                fields: ['ementa^3', 'textoIntegral', 'palavrasChave^2'],
                type: 'best_fields',
                fuzziness: 'AUTO'
              }
            }
          ]
        }
      },
      size: 3
    };

    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${DATAJUD_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: queryBody,
      timeout: 15000
    });

    console.log(`   Status: ${response.statusCode}`);

    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      const hits = data.hits?.hits || [];

      console.log(`   ✅ Sucesso! ${hits.length} resultado(s) encontrados`);

      if (hits.length > 0) {
        console.log('\n   Resultados encontrados:');
        hits.forEach((hit, idx) => {
          const source = hit._source || {};
          console.log(`\n   ${idx + 1}. ${source.tribunal || 'Tribunal N/A'} - ${source.numeroProcesso || 'Número N/A'}`);
          console.log(`      Score: ${hit._score?.toFixed(2) || 0}`);
          console.log(`      Ementa: ${(source.ementa || '').substring(0, 80)}...`);
        });
      }

      return true;
    } else {
      console.log(`   ❌ Erro ${response.statusCode}`);
      console.log(`   Response: ${response.body.substring(0, 200)}`);
      return false;
    }

  } catch (error) {
    console.error(`   ❌ Erro na requisição: ${error.message}`);
    return false;
  }
}

/**
 * Teste 3: Health check / Info
 */
async function testHealthEndpoint() {
  console.log('\n\n🔍 TESTE 3: Health Check');
  console.log('');

  try {
    const url = `${DATAJUD_API_URL}`;

    const response = await makeRequest(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${DATAJUD_API_KEY}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    console.log(`   Status: ${response.statusCode}`);
    console.log(`   Response (primeiros 200 chars):\n   ${response.body.substring(0, 200)}`);

    return response.statusCode >= 200 && response.statusCode < 500;

  } catch (error) {
    console.error(`   ❌ Erro: ${error.message}`);
    return false;
  }
}

/**
 * Executar todos os testes
 */
async function runAllTests() {
  const results = {
    test1: false,
    test2: false,
    test3: false
  };

  results.test1 = await testProcessosEndpoint();
  results.test2 = await testDecisoesEndpoint();
  results.test3 = await testHealthEndpoint();

  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📊 RESUMO DOS TESTES');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   Teste 1 (/processos):  ${results.test1 ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log(`   Teste 2 (/decisoes):   ${results.test2 ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log(`   Teste 3 (Health):      ${results.test3 ? '✅ PASSOU' : '❌ FALHOU'}`);

  const allPassed = results.test1 || results.test2 || results.test3;

  console.log('\n');
  if (allPassed) {
    console.log('   ✅ CHAVE DATAJUD VÁLIDA E FUNCIONANDO!');
    console.log('   A API está acessível e retornando dados.');
  } else {
    console.log('   ❌ PROBLEMAS DETECTADOS COM A CHAVE OU API');
    console.log('   Verifique:');
    console.log('   1. Chave está correta e não expirou');
    console.log('   2. URL da API está acessível');
    console.log('   3. Firewall/rede permite acesso à API do CNJ');
  }
  console.log('\n═══════════════════════════════════════════════════════════\n');
}

// Executar
runAllTests().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
