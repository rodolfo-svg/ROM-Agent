import dotenv from 'dotenv';
import https from 'https';
import axios from 'axios';

dotenv.config();

console.log('\\n════════════════════════════════════════════════');
console.log('🧪 ROM AGENT - TESTE DE CONEXÕES');
console.log('════════════════════════════════════════════════\\n');

// Teste DataJud
console.log('🔍 Testando DataJud (CNJ)...');
const apiKey = process.env.DATAJUD_API_KEY || process.env.CNJ_DATAJUD_API_KEY;

if (apiKey) {
  console.log('✅ API Key encontrada');

  const testQuery = JSON.stringify({
    query: { match: { numeroProcesso: "00012345620201234567" }},
    size: 1
  });

  const options = {
    hostname: 'api-publica.datajud.cnj.jus.br',
    port: 443,
    path: '/api_publica_v1/_search',
    method: 'POST',
    headers: {
      'Authorization': 'APIKey ' + apiKey,
      'Content-Type': 'application/json',
      'Content-Length': testQuery.length
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('   Status: ' + res.statusCode);
      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log('   ✅ DataJud: FUNCIONAL\\n');
      } else if (res.statusCode === 401) {
        console.log('   ❌ DataJud: API Key inválida\\n');
      } else {
        console.log('   ⚠️ DataJud: Status inesperado\\n');
      }
      testarJusbrasil();
    });
  });

  req.on('error', (error) => {
    console.log('   ❌ DataJud: Erro - ' + error.message + '\\n');
    testarJusbrasil();
  });

  req.write(testQuery);
  req.end();
} else {
  console.log('❌ API Key não configurada\\n');
  testarJusbrasil();
}

// Teste Jusbrasil
async function testarJusbrasil() {
  console.log('🔍 Testando Jusbrasil...');

  try {
    const response = await axios.get('https://www.jusbrasil.com.br/jurisprudencia/busca?q=teste', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 10000,
      validateStatus: () => true
    });

    console.log('   Status: ' + response.status);
    if (response.status === 200) {
      if (response.data.includes('jurisprudencia')) {
        console.log('   ✅ Jusbrasil: FUNCIONAL\\n');
      } else {
        console.log('   ⚠️ Jusbrasil: Possível bloqueio\\n');
      }
    } else {
      console.log('   ❌ Jusbrasil: COM PROBLEMAS\\n');
    }
  } catch (error) {
    console.log('   ❌ Jusbrasil: ' + error.message + '\\n');
  }

  testarSTF();
}

// Teste STF
async function testarSTF() {
  console.log('🔍 Testando STF...');

  try {
    const response = await axios.post(
      'https://jurisprudencia.stf.jus.br/api/search/pesquisar',
      { query: 'teste', base: 'ACOR', page: 0, pageSize: 1 },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
        validateStatus: () => true
      }
    );

    console.log('   Status: ' + response.status);
    if (response.status === 200) {
      console.log('   ✅ STF: FUNCIONAL\\n');
    } else {
      console.log('   ❌ STF: COM PROBLEMAS\\n');
    }
  } catch (error) {
    console.log('   ❌ STF: ' + error.message + '\\n');
  }

  testarSTJ();
}

// Teste STJ
async function testarSTJ() {
  console.log('🔍 Testando STJ...');

  try {
    const url = 'https://scon.stj.jus.br/SCON/pesquisar.jsp?livre=teste&b=ACOR&p=true&l=1&i=1';
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000,
      validateStatus: () => true
    });

    console.log('   Status: ' + response.status);
    if (response.status === 200) {
      console.log('   ✅ STJ: FUNCIONAL\\n');
    } else {
      console.log('   ❌ STJ: COM PROBLEMAS\\n');
    }
  } catch (error) {
    console.log('   ❌ STJ: ' + error.message + '\\n');
  }

  console.log('════════════════════════════════════════════════');
  console.log('✅ TESTES CONCLUÍDOS');
  console.log('════════════════════════════════════════════════\\n');
  process.exit(0);
}
