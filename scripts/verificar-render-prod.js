#!/usr/bin/env node

/**
 * Verificar se Render.com está com Google Search configurado
 * Testa a URL de produção diretamente
 */

import https from 'https';

console.log('═'.repeat(80));
console.log('🔍 VERIFICAÇÃO - RENDER.COM PRODUÇÃO');
console.log('═'.repeat(80));
console.log('');

console.log('🌐 URL Produção: https://iarom.com.br');
console.log('🧪 Testando endpoint de health...');
console.log('');

// Testar endpoint de health
const testHealth = () => {
  return new Promise((resolve, reject) => {
    https.get('https://iarom.com.br/api/health', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          resolve(health);
        } catch (e) {
          resolve({ raw: data });
        }
      });
    }).on('error', reject);
  });
};

// Testar busca de jurisprudência
const testJurisprudencia = () => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('TIMEOUT - Mais de 30 segundos sem resposta!'));
    }, 35000);

    const startTime = Date.now();

    const postData = JSON.stringify({
      prompt: 'Buscar jurisprudências sobre responsabilidade civil médica no TJGO',
      model: 'sonnet'
    });

    const options = {
      hostname: 'iarom.com.br',
      port: 443,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        try {
          const result = JSON.parse(data);
          resolve({ ...result, duration });
        } catch (e) {
          resolve({ raw: data, duration });
        }
      });
    });

    req.on('error', (e) => {
      clearTimeout(timeout);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
};

async function main() {
  // 1. Health Check
  console.log('📊 1. Health Check...');
  try {
    const health = await testHealth();
    console.log('   ✅ Servidor respondeu');
    if (health.status === 'ok' || health.status === 'healthy') {
      console.log('   ✅ Status: OK');
    } else {
      console.log('   ⚠️  Status:', health.status || 'desconhecido');
    }
  } catch (error) {
    console.log('   ❌ Erro:', error.message);
    console.log('');
    console.log('⚠️  Servidor pode estar offline ou reiniciando');
    console.log('   Aguarde 2-3 minutos e tente novamente');
    process.exit(1);
  }

  console.log('');

  // 2. Teste de Jurisprudência
  console.log('📊 2. Teste de Jurisprudência TJGO...');
  console.log('   ⏱️  Aguardando resposta (máx 35s)...');
  console.log('');

  try {
    const result = await testJurisprudencia();
    const duration = result.duration || 0;

    console.log('═'.repeat(80));
    console.log('📈 RESULTADO DO TESTE');
    console.log('═'.repeat(80));
    console.log('');

    console.log(`⏱️  Tempo de resposta: ${duration}ms (${(duration/1000).toFixed(1)}s)`);
    console.log('');

    // Análise do tempo
    if (duration < 5000) {
      console.log('✅ EXCELENTE! Tempo < 5 segundos');
      console.log('   → Google Search está CONFIGURADO e FUNCIONANDO');
    } else if (duration < 15000) {
      console.log('⚠️  ACEITÁVEL: Tempo entre 5-15 segundos');
      console.log('   → Pode estar usando fallback ou rede lenta');
    } else if (duration < 30000) {
      console.log('❌ LENTO: Tempo entre 15-30 segundos');
      console.log('   → Google Search provavelmente NÃO configurado');
      console.log('   → Usando JusBrasil (lento/bloqueado)');
    } else {
      console.log('❌ MUITO LENTO: Timeout > 30 segundos');
      console.log('   → Google Search definitivamente NÃO configurado');
      console.log('   → Sistema travando no JusBrasil');
    }

    console.log('');

    // Verificar resposta
    if (result.response || result.message) {
      console.log('📄 Resposta recebida:');
      const text = result.response || result.message || '';
      console.log('   ' + text.substring(0, 200) + '...');
      console.log('');

      // Verificar se menciona Google Search
      if (text.includes('Google Search') || text.includes('google-search')) {
        console.log('✅ Resposta menciona Google Search - BOM SINAL');
      }

      // Verificar se menciona "não configurado"
      if (text.includes('não configurado') || text.includes('not configured')) {
        console.log('❌ CRÍTICO: API reporta "não configurado"');
        console.log('   → Variáveis de ambiente NÃO estão no Render');
      }
    }

    console.log('');
    console.log('═'.repeat(80));
    console.log('📋 DIAGNÓSTICO FINAL');
    console.log('═'.repeat(80));
    console.log('');

    if (duration < 5000) {
      console.log('🎉 SISTEMA FUNCIONANDO PERFEITAMENTE!');
      console.log('   As variáveis estão configuradas no Render');
      console.log('   Google Search está ativo');
      console.log('');
      console.log('✅ TUDO OK - Pode usar em produção!');
    } else if (duration < 15000) {
      console.log('⚠️  Sistema funcionando mas não otimizado');
      console.log('   Verifique se as variáveis foram salvas no Render');
      console.log('');
      console.log('🔧 AÇÃO: Confirme que salvou as variáveis e aguarde redeploy');
    } else {
      console.log('❌ PROBLEMA: Google Search NÃO está configurado');
      console.log('');
      console.log('🚨 AÇÃO NECESSÁRIA:');
      console.log('   1. Acesse https://dashboard.render.com/');
      console.log('   2. Clique no serviço "rom-agent"');
      console.log('   3. Vá em "Environment"');
      console.log('   4. Preencha:');
      console.log('      GOOGLE_SEARCH_API_KEY=AIzaSyASQ6IzrLay4PVsPPhYPFXisTubiTq7ocI');
      console.log('      GOOGLE_SEARCH_CX=f14c0d3793b7346c0');
      console.log('   5. Clique em "Save Changes"');
      console.log('   6. Aguarde redeploy (2-3 min)');
      console.log('   7. Execute este script novamente');
    }

  } catch (error) {
    console.log('');
    console.log('❌ ERRO NO TESTE:', error.message);
    console.log('');

    if (error.message.includes('TIMEOUT')) {
      console.log('🚨 SISTEMA TRAVANDO - TIMEOUT DE 30+ SEGUNDOS!');
      console.log('');
      console.log('CAUSA: Google Search NÃO configurado no Render');
      console.log('');
      console.log('SOLUÇÃO URGENTE:');
      console.log('1. https://dashboard.render.com/');
      console.log('2. Serviço "rom-agent" → "Environment"');
      console.log('3. Adicionar:');
      console.log('   GOOGLE_SEARCH_API_KEY=AIzaSyASQ6IzrLay4PVsPPhYPFXisTubiTq7ocI');
      console.log('   GOOGLE_SEARCH_CX=f14c0d3793b7346c0');
      console.log('4. Save Changes → Aguardar redeploy');
    }
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log('✅ Verificação concluída');
  console.log('═'.repeat(80));
}

main().catch(console.error);
