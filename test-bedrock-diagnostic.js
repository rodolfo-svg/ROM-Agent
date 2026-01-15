#!/usr/bin/env node
/**
 * Teste Diagnóstico - AWS Bedrock
 * Verifica se os modelos Claude estão acessíveis
 */

import axios from 'axios';

const PRODUCTION_URL = 'https://iarom.com.br';

async function testBedrockDiagnostic() {
  console.log('🔍 DIAGNÓSTICO AWS BEDROCK\n');
  console.log(`🌐 Servidor: ${PRODUCTION_URL}`);
  console.log(`📅 Data: ${new Date().toISOString()}\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    console.log('📡 Chamando /api/diagnostic/bedrock...\n');

    const response = await axios.get(`${PRODUCTION_URL}/api/diagnostic/bedrock`, {
      timeout: 30000
    });

    console.log(`✅ Status: ${response.status}\n`);

    if (response.data) {
      const data = response.data;

      console.log('📊 RESULTADOS:\n');
      console.log(`  Região AWS: ${data.region || 'N/A'}`);
      console.log(`  Credenciais AWS: ${data.credentials?.hasAccessKey ? '✅' : '❌'} Access Key`);
      console.log(`                   ${data.credentials?.hasSecretKey ? '✅' : '❌'} Secret Key\n`);

      if (data.models && Array.isArray(data.models)) {
        console.log(`🤖 MODELOS TESTADOS (${data.models.length}):\n`);

        let successCount = 0;
        let failCount = 0;

        data.models.forEach((model, i) => {
          const status = model.success ? '✅' : '❌';
          console.log(`  ${i + 1}. ${status} ${model.modelId}`);

          if (model.success) {
            successCount++;
            console.log(`     └─ Latência: ${model.latency}ms`);
            console.log(`     └─ Resposta: "${model.response?.substring(0, 50)}..."`);
          } else {
            failCount++;
            console.log(`     └─ Erro: ${model.error}`);
          }
          console.log('');
        });

        console.log('═══════════════════════════════════════════════════════');
        console.log(`📈 RESUMO: ${successCount} sucesso / ${failCount} falhas`);
        console.log('═══════════════════════════════════════════════════════\n');

        if (successCount === 0) {
          console.log('❌ PROBLEMA CRÍTICO: Nenhum modelo funcionando!');
          console.log('\n🔍 POSSÍVEIS CAUSAS:');
          console.log('  1. Credenciais AWS incorretas ou expiradas');
          console.log('  2. Região us-west-2 sem acesso aos modelos');
          console.log('  3. Model IDs incorretos');
          console.log('  4. Modelos não habilitados na conta AWS');
          console.log('\n💡 AÇÕES:');
          console.log('  1. Verificar AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY no Render');
          console.log('  2. Verificar se modelos Claude 4.x estão habilitados na console AWS');
          console.log('  3. Testar com modelo alternativo (Nova Lite)');
          process.exit(1);
        } else if (successCount < data.models.length) {
          console.log('⚠️  ALGUNS MODELOS COM PROBLEMA - Fallback funcionará parcialmente');
          process.exit(0);
        } else {
          console.log('🎉 TODOS OS MODELOS FUNCIONANDO PERFEITAMENTE!');
          process.exit(0);
        }
      }
    }

  } catch (error) {
    console.log('❌ ERRO AO CHAMAR DIAGNÓSTICO:\n');
    console.log(`  Status: ${error.response?.status || 'N/A'}`);
    console.log(`  Mensagem: ${error.message}`);

    if (error.response?.data) {
      console.log(`  Detalhes: ${JSON.stringify(error.response.data, null, 2)}`);
    }

    console.log('\n🔍 POSSÍVEIS CAUSAS:');
    console.log('  1. Endpoint /api/diagnostic/bedrock não existe');
    console.log('  2. Servidor ainda fazendo deploy');
    console.log('  3. Erro interno no servidor');

    console.log('\n💡 AÇÃO: Verificar logs do Render para mais detalhes');
    process.exit(2);
  }
}

testBedrockDiagnostic();
