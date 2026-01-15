#!/usr/bin/env node
/**
 * Teste Local - Validar Model IDs Bedrock
 * Testa se os modelos respondem com credenciais locais
 */

import 'dotenv/config';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const region = process.env.AWS_REGION || 'us-west-2';

console.log('🔍 TESTE LOCAL AWS BEDROCK\n');
console.log(`📍 Região: ${region}`);
console.log(`🔑 AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Configurado' : '❌ NÃO configurado'}`);
console.log(`🔐 AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Configurado' : '❌ NÃO configurado'}\n`);

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.log('❌ Credenciais AWS não configuradas no .env');
  process.exit(1);
}

const modelsToTest = [
  { id: 'anthropic.claude-sonnet-4-5-20250929-v1:0', name: 'Claude Sonnet 4.5 (ID direto)' },
  { id: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0', name: 'Claude Sonnet 4.5 (inference profile)' },
  { id: 'anthropic.claude-haiku-4-5-20251001-v1:0', name: 'Claude Haiku 4.5 (ID direto)' },
  { id: 'amazon.nova-lite-v1:0', name: 'Amazon Nova Lite (ID direto)' },
  { id: 'us.amazon.nova-lite-v1:0', name: 'Amazon Nova Lite (inference profile)' }
];

async function testModel(modelId, modelName) {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🤖 Testando: ${modelName}`);
  console.log(`   ID: ${modelId}\n`);

  const client = new BedrockRuntimeClient({ region });

  try {
    const startTime = Date.now();

    const command = new ConverseCommand({
      modelId,
      messages: [
        {
          role: 'user',
          content: [{ text: 'Responda apenas: OK' }]
        }
      ],
      inferenceConfig: {
        maxTokens: 10
      }
    });

    const response = await client.send(command);
    const latency = Date.now() - startTime;

    const output = response.output?.message?.content?.[0]?.text || 'N/A';

    console.log(`✅ SUCESSO em ${latency}ms`);
    console.log(`   Resposta: "${output}"`);
    console.log(`   Stop Reason: ${response.stopReason}`);
    console.log(`   Tokens: ${response.usage?.inputTokens || 0} input, ${response.usage?.outputTokens || 0} output\n`);

    return { success: true, latency, modelId };

  } catch (error) {
    console.log(`❌ FALHOU`);
    console.log(`   Erro: ${error.name}`);
    console.log(`   Mensagem: ${error.message}`);

    if (error.$metadata) {
      console.log(`   HTTP Status: ${error.$metadata.httpStatusCode}`);
      console.log(`   Request ID: ${error.$metadata.requestId}`);
    }

    console.log('');

    return { success: false, error: error.message, modelId };
  }
}

async function runTests() {
  const results = [];

  for (const model of modelsToTest) {
    const result = await testModel(model.id, model.name);
    results.push(result);

    // Aguardar 1s entre testes para não sobrecarregar
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 RESUMO DOS TESTES\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Sucessos: ${successful.length}/${results.length}`);
  console.log(`❌ Falhas: ${failed.length}/${results.length}\n`);

  if (successful.length > 0) {
    console.log('🎉 MODELOS FUNCIONANDO:');
    successful.forEach(r => console.log(`  ✓ ${r.modelId}`));
    console.log('');
  }

  if (failed.length > 0) {
    console.log('⚠️  MODELOS COM PROBLEMA:');
    failed.forEach(r => console.log(`  ✗ ${r.modelId} - ${r.error?.substring(0, 60)}`));
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════');

  if (successful.length === 0) {
    console.log('\n❌ NENHUM MODELO FUNCIONOU - Verificar credenciais AWS e habilitação de modelos');
    process.exit(1);
  } else if (failed.length > 0) {
    console.log('\n⚠️  ALGUNS MODELOS FALHARAM - Usar apenas os que funcionaram');
    console.log(`\n💡 RECOMENDAÇÃO: Usar ${successful[0].modelId} como padrão`);
    process.exit(0);
  } else {
    console.log('\n🎉 TODOS OS MODELOS FUNCIONANDO PERFEITAMENTE!');
    process.exit(0);
  }
}

runTests().catch(error => {
  console.error('💥 ERRO FATAL:', error);
  process.exit(2);
});
