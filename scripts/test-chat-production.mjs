import axios from 'axios';
import fs from 'fs';

const PROD_URL = 'https://iarom.com.br';

console.log('🧪 Teste Simples - Capturando resposta do chat\n');

async function test() {
  // 1. CSRF
  const csrf = await axios.get(`${PROD_URL}/api/auth/csrf-token`);
  const csrfToken = csrf.data.csrfToken;
  const cookies = csrf.headers['set-cookie']?.join('; ') || '';

  // 2. Login
  const login = await axios.post(`${PROD_URL}/api/auth/login`, {
    email: 'rodolfo@rom.adv.br',
    password: 'Mota@2323'
  }, {
    headers: { 'Cookie': cookies, 'X-CSRF-Token': csrfToken }
  });

  const sessionCookies = login.headers['set-cookie']?.join('; ') || cookies;
  console.log('✅ Login OK\n');

  // 3. Chat
  console.log('Enviando: "Pesquise jurisprudência sobre LGPD no STJ com limite de 3 resultados"\n');

  const chat = await axios.post(`${PROD_URL}/api/chat`, {
    message: 'Pesquise jurisprudência sobre LGPD no STJ com limite de 3 resultados',
    model: 'amazon.nova-pro-v1:0'
  }, {
    headers: {
      'Cookie': sessionCookies,
      'X-CSRF-Token': csrfToken,
      'Accept': 'text/event-stream'
    },
    responseType: 'stream',
    timeout: 60000
  });

  let fullResponse = '';

  return new Promise((resolve) => {
    chat.data.on('data', (chunk) => {
      fullResponse += chunk.toString();
      process.stdout.write('.');
    });

    chat.data.on('end', () => {
      console.log('\n\n═══ RESPOSTA COMPLETA ═══\n');
      console.log(fullResponse);
      console.log('\n═══ FIM DA RESPOSTA ═══\n');

      // Salvar em arquivo
      fs.writeFileSync('/tmp/chat-response.txt', fullResponse);
      console.log('💾 Salvo em /tmp/chat-response.txt\n');

      // Análise
      const hasToolUse = fullResponse.includes('pesquisar_jurisprudencia');
      const hasGoogle = fullResponse.includes('Google Search') || fullResponse.includes('google-search');
      const hasDatajud = fullResponse.includes('DataJud') || fullResponse.includes('datajud');

      console.log('📊 Análise:');
      console.log('   Ferramenta usada:', hasToolUse ? '✅ SIM' : '❌ NÃO');
      console.log('   Google Search:', hasGoogle ? '✅' : '❌');
      console.log('   DataJud:', hasDatajud ? '✅' : '❌');
      console.log('   Tamanho:', fullResponse.length, 'chars');

      resolve();
    });
  });
}

test().catch(e => console.error('Erro:', e.message));
