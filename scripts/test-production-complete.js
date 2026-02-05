#!/usr/bin/env node
/**
 * Teste Completo em Produção - DataJud + Google Search
 * Testa via interface web com login real
 */

import axios from 'axios';
import { setTimeout } from 'timers/promises';

const PROD_URL = 'https://iarom.com.br';
const credentials = {
  email: 'rodolfo@rom.adv.br',
  password: 'Mota@2323'
};

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 TESTE COMPLETO EM PRODUÇÃO - DataJud + Google Search');
console.log('═══════════════════════════════════════════════════════════\n');

async function testProduction() {
  try {
    // ============================================================
    // 1. OBTER CSRF TOKEN
    // ============================================================
    console.log('1️⃣  Obtendo CSRF token...');
    const csrfResponse = await axios.get(`${PROD_URL}/api/auth/csrf-token`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const csrfToken = csrfResponse.data.csrfToken;
    const cookies = csrfResponse.headers['set-cookie']?.join('; ') || '';

    console.log('   ✅ CSRF token obtido\n');

    // ============================================================
    // 2. FAZER LOGIN
    // ============================================================
    console.log('2️⃣  Fazendo login...');
    const loginResponse = await axios.post(`${PROD_URL}/api/auth/login`, credentials, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
        'X-CSRF-Token': csrfToken
      }
    });

    const loginData = loginResponse.data;
    const sessionCookies = loginResponse.headers['set-cookie']?.join('; ') || cookies;

    console.log(`   ✅ Login bem-sucedido: ${loginData.user.email}`);
    console.log(`   👤 Role: ${loginData.user.role}`);
    console.log(`   🏢 Partner: ${loginData.user.partnerId || 'N/A'}\n`);

    // ============================================================
    // 3. ENVIAR MENSAGEM DE TESTE
    // ============================================================
    console.log('3️⃣  Enviando mensagem de teste para o chat...');
    console.log('   Mensagem: "Pesquise jurisprudência sobre LGPD no STJ com limite de 3 resultados"\n');

    const chatPayload = {
      message: 'Pesquise jurisprudência sobre LGPD no STJ com limite de 3 resultados',
      model: 'amazon.nova-pro-v1:0',
      systemPrompt: 'Você é um assistente jurídico especializado. Use as ferramentas disponíveis.'
    };

    console.log('   ⏳ Aguardando resposta (pode levar 15-30 segundos)...\n');

    // Configurar timeout maior para SSE stream
    const chatResponse = await axios.post(`${PROD_URL}/api/chat`, chatPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookies,
        'X-CSRF-Token': csrfToken,
        'Accept': 'text/event-stream'
      },
      responseType: 'stream',
      timeout: 60000 // 60 segundos
    });

    // ============================================================
    // 4. LER STREAM SSE
    // ============================================================
    console.log('4️⃣  Lendo resposta do stream...\n');

    let fullResponse = '';
    let toolUsed = false;
    let toolName = '';
    let googleSearchDetected = false;
    let datajudDetected = false;
    let resultsCount = 0;
    let chunks = 0;

    return new Promise((resolve, reject) => {
      chatResponse.data.on('data', (chunk) => {
        chunks++;
        const chunkStr = chunk.toString();
        fullResponse += chunkStr;

        // Detectar uso de ferramentas
        if (chunkStr.includes('pesquisar_jurisprudencia')) {
          toolUsed = true;
          toolName = 'pesquisar_jurisprudencia';
        }
        if (chunkStr.includes('Google Search') || chunkStr.includes('google-search')) {
          googleSearchDetected = true;
        }
        if (chunkStr.includes('DataJud') || chunkStr.includes('datajud')) {
          datajudDetected = true;
        }
        if (chunkStr.includes('resultados encontrados') || chunkStr.includes('Total de resultados')) {
          const match = chunkStr.match(/(\d+)\s+resultados?/);
          if (match) resultsCount = parseInt(match[1]);
        }

        // Mostrar progresso a cada 10 chunks
        if (chunks % 10 === 0) {
          process.stdout.write('.');
        }
      });

      chatResponse.data.on('end', () => {
        console.log('\n\n   ✅ Stream finalizado\n');

        // ============================================================
        // 5. ANALISAR RESPOSTA
        // ============================================================
        console.log('═══════════════════════════════════════════════════════════');
        console.log('📊 ANÁLISE DA RESPOSTA');
        console.log('═══════════════════════════════════════════════════════════\n');

        console.log('📈 Estatísticas:');
        console.log(`   - Total de chunks recebidos: ${chunks}`);
        console.log(`   - Tamanho da resposta: ${Math.round(fullResponse.length / 1024)} KB`);
        console.log(`   - Caracteres totais: ${fullResponse.length}\n`);

        console.log('🔧 Ferramentas:');
        console.log(`   - Ferramenta usada: ${toolUsed ? '✅ SIM' : '❌ NÃO'}`);
        if (toolUsed) {
          console.log(`   - Nome da ferramenta: ${toolName}`);
        }
        console.log();

        console.log('🔍 Fontes de Dados:');
        console.log(`   - Google Search detectado: ${googleSearchDetected ? '✅ SIM' : '❌ NÃO'}`);
        console.log(`   - DataJud CNJ detectado: ${datajudDetected ? '✅ SIM' : '❌ NÃO'}`);
        console.log();

        console.log('📄 Resultados:');
        console.log(`   - Resultados encontrados: ${resultsCount > 0 ? `✅ ${resultsCount}` : '⚠️ Não detectado'}`);
        console.log();

        // ============================================================
        // 6. SALVAR RESPOSTA COMPLETA
        // ============================================================
        const fs = require('fs');
        const outputPath = '/tmp/chat-response-production.txt';
        fs.writeFileSync(outputPath, fullResponse);
        console.log(`💾 Resposta completa salva em: ${outputPath}\n`);

        // ============================================================
        // 7. MOSTRAR AMOSTRA DA RESPOSTA
        // ============================================================
        console.log('═══════════════════════════════════════════════════════════');
        console.log('📝 AMOSTRA DA RESPOSTA (primeiros 1500 caracteres)');
        console.log('═══════════════════════════════════════════════════════════\n');

        const sample = fullResponse.substring(0, 1500);
        console.log(sample);
        if (fullResponse.length > 1500) {
          console.log('\n[... resposta truncada ...]');
          console.log(`\n(Total: ${fullResponse.length} caracteres - veja arquivo completo em ${outputPath})`);
        }

        // ============================================================
        // 8. DIAGNÓSTICO FINAL
        // ============================================================
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🎯 DIAGNÓSTICO FINAL');
        console.log('═══════════════════════════════════════════════════════════\n');

        if (toolUsed && (googleSearchDetected || datajudDetected) && resultsCount > 0) {
          console.log('✅ ✅ ✅ SUCESSO TOTAL! ✅ ✅ ✅\n');
          console.log('Todas as verificações passaram:');
          console.log('   ✅ Ferramenta pesquisar_jurisprudencia foi usada');
          console.log(`   ✅ Fonte de dados foi usada (${googleSearchDetected ? 'Google Search' : ''}${googleSearchDetected && datajudDetected ? ' + ' : ''}${datajudDetected ? 'DataJud' : ''})`);
          console.log(`   ✅ ${resultsCount} resultado(s) encontrado(s)`);
          console.log('\n🎉 DataJud e/ou Google Search estão FUNCIONANDO CORRETAMENTE!\n');
        } else {
          console.log('⚠️ RESULTADO PARCIAL\n');

          if (!toolUsed) {
            console.log('❌ Ferramenta não foi usada');
            console.log('   Possível causa: IA não entendeu a solicitação');
            console.log('   Solução: Tente reformular a pergunta\n');
          }

          if (!googleSearchDetected && !datajudDetected) {
            console.log('⚠️ Nenhuma fonte de dados detectada na resposta');
            console.log('   Possível causa: Resposta ainda não contém resultados');
            console.log('   Solução: Verifique o arquivo completo em /tmp/chat-response-production.txt\n');
          }

          if (resultsCount === 0) {
            console.log('⚠️ Nenhum resultado detectado');
            console.log('   Possível causa: Query não retornou resultados ou parsing falhou');
            console.log('   Solução: Verifique o arquivo completo\n');
          }
        }

        console.log('═══════════════════════════════════════════════════════════');
        console.log('Teste concluído');
        console.log('═══════════════════════════════════════════════════════════\n');

        resolve({
          success: toolUsed && (googleSearchDetected || datajudDetected),
          toolUsed,
          googleSearchDetected,
          datajudDetected,
          resultsCount,
          chunks,
          responseLength: fullResponse.length
        });
      });

      chatResponse.data.on('error', (error) => {
        console.error('\n❌ ERRO ao ler stream:', error.message);
        reject(error);
      });
    });

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    throw error;
  }
}

testProduction()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Teste falhou:', error.message);
    process.exit(1);
  });
