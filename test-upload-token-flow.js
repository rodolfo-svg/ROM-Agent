/**
 * Teste do fluxo completo de upload com tokens JWT
 * Simula exatamente o que o frontend faz
 */

const https = require('https');

const BACKEND_URL = 'https://rom-agent-ia.onrender.com';
const FRONTEND_URL = 'https://iarom.com.br';

console.log('🧪 TESTE: Fluxo de Upload com Tokens JWT\n');
console.log('════════════════════════════════════════\n');

// Passo 1: Tentar obter token SEM autenticação (deve falhar com 302 ou 401)
console.log('📍 PASSO 1: Obter token SEM autenticação');
console.log(`   GET ${FRONTEND_URL}/api/upload/get-upload-token\n`);

https.get(`${FRONTEND_URL}/api/upload/get-upload-token`, (res) => {
  console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
  console.log(`   Headers:`);
  console.log(`     - set-cookie: ${res.headers['set-cookie'] || 'nenhum'}`);
  console.log(`     - location: ${res.headers['location'] || 'nenhum'}`);

  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (data) {
      console.log(`   Body: ${data.substring(0, 200)}`);
    }

    console.log('\n════════════════════════════════════════\n');

    // Passo 2: Testar chunked init SEM token (deve falhar com 401)
    console.log('📍 PASSO 2: Iniciar chunked upload SEM token');
    console.log(`   POST ${BACKEND_URL}/api/upload/chunked/init\n`);

    const postData = JSON.stringify({
      filename: 'test.pdf',
      fileSize: 1024000,
      contentType: 'application/pdf'
    });

    const options = {
      hostname: 'rom-agent-ia.onrender.com',
      port: 443,
      path: '/api/upload/chunked/init',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length,
        'Origin': 'https://iarom.com.br'
      }
    };

    const req = https.request(options, (res2) => {
      console.log(`   Status: ${res2.statusCode} ${res2.statusMessage}`);

      let data2 = '';
      res2.on('data', chunk => data2 += chunk);
      res2.on('end', () => {
        try {
          const json = JSON.parse(data2);
          console.log(`   Response:`);
          console.log(`     ${JSON.stringify(json, null, 2).split('\n').map(l => `     ${l}`).join('\n')}`);
        } catch (e) {
          console.log(`   Body: ${data2}`);
        }

        console.log('\n════════════════════════════════════════\n');
        console.log('✅ Teste concluído!');
        console.log('\n💡 Próximo passo: Testar com token JWT válido');
        console.log('   (requer autenticação real com session cookie)\n');
      });
    });

    req.on('error', (e) => {
      console.error(`   ❌ Erro: ${e.message}`);
    });

    req.write(postData);
    req.end();
  });
}).on('error', (e) => {
  console.error(`   ❌ Erro: ${e.message}`);
});
