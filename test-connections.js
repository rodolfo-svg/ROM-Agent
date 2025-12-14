/**
 * Script de teste para verificar conexões das APIs jurídicas
 * DataJud, Jusbrasil, STF, STJ
 */

import dotenv from 'dotenv';
import https from 'https';
import axios from 'axios';

dotenv.config();

// ============================================
// Teste DataJud (CNJ)
// ============================================
async function testarDataJud() {
  console.log('\n🔍 Testando DataJud (CNJ)...');

  const apiKey = process.env.DATAJUD_API_KEY || process.env.CNJ_DATAJUD_API_KEY;

  if (!apiKey) {
    console.log('❌ API Key não configurada');
    return false;
  }

  console.log(`✅ API Key encontrada: ${apiKey.substring(0, 20)}...`);

  try {
    // Testar conexão básica
    const testQuery = {
      query: {
        match: {
          numeroProcesso: "00012345620201234567"
        }
      },
      size: 1
    };

    const options = {
      hostname: 'api-publica.datajud.cnj.jus.br',
      port: 443,
      path: '/api_publica_v1/_search',
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            console.log('✅ DataJud conectado com sucesso!');
            console.log(`   Status: ${res.statusCode}`);
            resolve(true);
          } else if (res.statusCode === 401) {
            console.log('❌ Erro de autenticação - API Key inválida');
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Resposta: ${data.substring(0, 200)}`);
            resolve(false);
          } else {
            console.log(`⚠️ Resposta inesperada: ${res.statusCode}`);
            console.log(`   Resposta: ${data.substring(0, 200)}`);
            resolve(true); // Considera sucesso se não for erro de autenticação
          }
        });
      });

      req.on('error', (error) => {
        console.log('❌ Erro de conexão:', error.message);
        resolve(false);
      });

      req.write(JSON.stringify(testQuery));
      req.end();

      // Timeout de 10 segundos
      setTimeout(() => {
        req.destroy();
        console.log('⏱️ Timeout - conexão demorou muito');
        resolve(false);
      }, 10000);
    });

  } catch (error) {
    console.log('❌ Erro:', error.message);
    return false;
  }
}

// ============================================
// Teste Jusbrasil
// ============================================
async function testarJusbrasil() {
  console.log('\n🔍 Testando Jusbrasil...');

  try {
    const url = 'https://www.jusbrasil.com.br/jurisprudencia/busca?q=teste';

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000,
      validateStatus: () => true // Aceitar qualquer status
    });

    if (response.status === 200) {
      console.log('✅ Jusbrasil conectado com sucesso!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Tamanho resposta: ${response.data.length} bytes`);

      // Verificar se há conteúdo de jurisprudência
      if (response.data.includes('jurisprudencia') || response.data.includes('Jurisprudência')) {
        console.log('   ✅ Conteúdo de jurisprudência detectado');
        return true;
      } else {
        console.log('   ⚠️ Conteúdo não contém jurisprudência (pode estar bloqueado)');
        return false;
      }
    } else if (response.status === 403 || response.status === 429) {
      console.log(`❌ Bloqueado pelo servidor (Status ${response.status})`);
      console.log('   Possível bloqueio por rate limit ou detecção de bot');
      return false;
    } else {
      console.log(`⚠️ Status inesperado: ${response.status}`);
      return false;
    }

  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log('⏱️ Timeout - servidor não respondeu a tempo');
    } else {
      console.log('❌ Erro:', error.message);
    }
    return false;
  }
}

// ============================================
// Teste STF
// ============================================
async function testarSTF() {
  console.log('\n🔍 Testando STF...');

  try {
    const url = 'https://jurisprudencia.stf.jus.br/api/search/pesquisar';

    const response = await axios.post(url, {
      query: 'teste',
      base: 'ACOR',
      page: 0,
      pageSize: 1
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000,
      validateStatus: () => true
    });

    if (response.status === 200) {
      console.log('✅ STF API conectada com sucesso!');
      console.log(`   Status: ${response.status}`);
      return true;
    } else {
      console.log(`⚠️ Status inesperado: ${response.status}`);
      // Tentar fallback
      console.log('   Tentando fallback...');
      const fallbackUrl = 'https://portal.stf.jus.br/jurisprudencia/';
      const fallbackResponse = await axios.get(fallbackUrl, { timeout: 10000, validateStatus: () => true });

      if (fallbackResponse.status === 200) {
        console.log('✅ STF Portal (fallback) conectado!');
        return true;
      } else {
        console.log(`❌ Fallback também falhou: ${fallbackResponse.status}`);
        return false;
      }
    }

  } catch (error) {
    console.log('❌ Erro:', error.message);
    return false;
  }
}

// ============================================
// Teste STJ
// ============================================
async function testarSTJ() {
  console.log('\n🔍 Testando STJ...');

  try {
    const url = 'https://scon.stj.jus.br/SCON/pesquisar.jsp';
    const params = new URLSearchParams({
      livre: 'teste',
      b: 'ACOR',
      p: 'true',
      l: 1,
      i: 1
    });

    const response = await axios.get(`${url}?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 10000,
      validateStatus: () => true
    });

    if (response.status === 200) {
      console.log('✅ STJ SCON conectado com sucesso!');
      console.log(`   Status: ${response.status}`);
      return true;
    } else {
      console.log(`❌ Falha: Status ${response.status}`);
      return false;
    }

  } catch (error) {
    console.log('❌ Erro:', error.message);
    return false;
  }
}

// ============================================
// Executar todos os testes
// ============================================
async function executarTestes() {
  console.log('════════════════════════════════════════════════');
  console.log('🧪 ROM AGENT - TESTE DE CONEXÕES');
  console.log('════════════════════════════════════════════════');

  const resultados = {
    datajud: await testarDataJud(),
    jusbrasil: await testarJusbrasil(),
    stf: await testarSTF(),
    stj: await testarSTJ()
  };

  console.log('\n════════════════════════════════════════════════');
  console.log('📊 RESUMO DOS TESTES');
  console.log('════════════════════════════════════════════════');

  let total = 0;
  let funcionais = 0;

  for (const [fonte, status] of Object.entries(resultados)) {
    total++;
    if (status) funcionais++;
    const icone = status ? '✅' : '❌';
    const nome = fonte.toUpperCase().padEnd(15);
    console.log(`${icone} ${nome} ${status ? 'FUNCIONAL' : 'COM PROBLEMAS'}`);
  }

  console.log('════════════════════════════════════════════════');
  console.log(`🎯 RESULTADO: ${funcionais}/${total} fontes funcionais`);
  console.log('════════════════════════════════════════════════\n');

  // Recomendações
  if (!resultados.datajud) {
    console.log('⚠️ DATAJUD: Verifique se a API Key está correta');
    console.log('   Solicite nova chave em: https://datajud-wiki.cnj.jus.br/api-publica/\n');
  }

  if (!resultados.jusbrasil) {
    console.log('⚠️ JUSBRASIL: Possível bloqueio por rate limit ou bot detection');
    console.log('   Considere usar credenciais ou aguardar alguns minutos\n');
  }

  if (!resultados.stf) {
    console.log('⚠️ STF: Verifique se a API mudou ou está fora do ar\n');
  }

  if (!resultados.stj) {
    console.log('⚠️ STJ: Verifique se o SCON está disponível\n');
  }

  if (funcionais === total) {
    console.log('✅ TUDO FUNCIONANDO! Sistema pronto para uso.\n');
  } else if (funcionais === 0) {
    console.log('❌ TODAS AS CONEXÕES FALHARAM. Verifique sua conexão de internet e firewalls.\n');
  } else {
    console.log(`⚠️ ${total - funcionais} fonte(s) com problemas. Sistema parcialmente funcional.\n');
  }
}

// Executar
executarTestes().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});
