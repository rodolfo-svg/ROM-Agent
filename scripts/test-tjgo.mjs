import axios from 'axios';
import fs from 'fs';

const PROD_URL = 'https://iarom.com.br';

console.log('🧪 TESTE ESPECÍFICO - TJGO (Tribunal de Justiça de Goiás)\n');

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

  // 3. Chat - TESTAR TJGO
  console.log('📋 TESTE 1: Busca de Súmula 63 do TJGO');
  console.log('Enviando: "Pesquise Súmula 63 do TJGO sobre juros de mora"\n');

  const chat1 = await axios.post(`${PROD_URL}/api/chat`, {
    message: 'Pesquise Súmula 63 do TJGO sobre juros de mora',
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

  let response1 = '';

  await new Promise((resolve) => {
    chat1.data.on('data', (chunk) => {
      response1 += chunk.toString();
      process.stdout.write('.');
    });

    chat1.data.on('end', () => {
      console.log('\n\n═══ RESPOSTA TESTE 1 (Súmula TJGO) ═══\n');
      console.log(response1.substring(0, 2000)); // Primeiros 2000 chars
      if (response1.length > 2000) {
        console.log('\n[... resposta truncada ...]\n');
      }

      // Análise
      const hasTJGO = response1.includes('TJGO') || response1.includes('Goiás');
      const hasSumula = response1.includes('Súmula') || response1.includes('sumula');
      const hasError = response1.includes('erro') || response1.includes('não') || response1.includes('impossível');

      console.log('\n📊 Análise Teste 1:');
      console.log('   TJGO mencionado:', hasTJGO ? '✅' : '❌');
      console.log('   Súmula mencionada:', hasSumula ? '✅' : '❌');
      console.log('   Erro detectado:', hasError ? '⚠️ SIM' : '✅ NÃO');
      console.log('   Tamanho:', response1.length, 'chars\n');

      resolve();
    });
  });

  // 4. TESTE 2: Busca genérica em TJGO
  console.log('─────────────────────────────────────────');
  console.log('📋 TESTE 2: Busca genérica no TJGO');
  console.log('Enviando: "Busque jurisprudência sobre dano moral no TJGO com limite de 2 resultados"\n');

  const chat2 = await axios.post(`${PROD_URL}/api/chat`, {
    message: 'Busque jurisprudência sobre dano moral no TJGO com limite de 2 resultados',
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

  let response2 = '';

  await new Promise((resolve) => {
    chat2.data.on('data', (chunk) => {
      response2 += chunk.toString();
      process.stdout.write('.');
    });

    chat2.data.on('end', () => {
      console.log('\n\n═══ RESPOSTA TESTE 2 (Jurisprudência TJGO) ═══\n');
      console.log(response2.substring(0, 2000));
      if (response2.length > 2000) {
        console.log('\n[... resposta truncada ...]\n');
      }

      // Análise
      const hasTJGO = response2.includes('TJGO') || response2.includes('Goiás');
      const hasJuris = response2.includes('jurisprudência') || response2.includes('acórdão');
      const hasResults = response2.includes('resultado') || response2.includes('Resultado');

      console.log('\n📊 Análise Teste 2:');
      console.log('   TJGO mencionado:', hasTJGO ? '✅' : '❌');
      console.log('   Jurisprudência:', hasJuris ? '✅' : '❌');
      console.log('   Resultados:', hasResults ? '✅' : '❌');
      console.log('   Tamanho:', response2.length, 'chars\n');

      // Salvar ambas respostas
      fs.writeFileSync('/tmp/tjgo-test-1-sumula.txt', response1);
      fs.writeFileSync('/tmp/tjgo-test-2-juris.txt', response2);

      console.log('💾 Respostas salvas:');
      console.log('   - /tmp/tjgo-test-1-sumula.txt');
      console.log('   - /tmp/tjgo-test-2-juris.txt\n');

      resolve();
    });
  });

  console.log('═══════════════════════════════════════════');
  console.log('✅ TESTES CONCLUÍDOS');
  console.log('═══════════════════════════════════════════\n');
}

test().catch(e => console.error('Erro:', e.message));
