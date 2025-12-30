#!/usr/bin/env node
/**
 * TESTE DE MODELOS BEDROCK
 * Verifica quais modelos estão disponíveis e testa uma chamada simples
 */

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';
import dotenv from 'dotenv';

dotenv.config();

const region = process.env.AWS_REGION || 'us-west-2';

async function testBedrockModels() {
  console.log('═'.repeat(70));
  console.log('🔍 TESTE DE MODELOS AWS BEDROCK');
  console.log('═'.repeat(70));
  console.log('');

  // 1. Verificar credenciais
  console.log('1️⃣  CREDENCIAIS AWS');
  console.log('─'.repeat(70));
  console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '✅ Configurado' : '❌ Ausente');
  console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '✅ Configurado' : '❌ Ausente');
  console.log('AWS_REGION:', region);
  console.log('');

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.log('❌ Credenciais AWS não configuradas!');
    process.exit(1);
  }

  const client = new BedrockClient({ region });

  try {
    // 2. Listar modelos disponíveis
    console.log('2️⃣  MODELOS DISPONÍVEIS');
    console.log('─'.repeat(70));

    const command = new ListFoundationModelsCommand({
      byProvider: 'Anthropic'
    });

    const response = await client.send(command);
    const models = response.modelSummaries || [];

    console.log(`Total de modelos Anthropic: ${models.length}`);
    console.log('');

    if (models.length === 0) {
      console.log('⚠️  Nenhum modelo Anthropic encontrado!');
      console.log('   Isso pode significar:');
      console.log('   1. Região incorreta (us-west-2 pode não ter Claude)');
      console.log('   2. Modelos não habilitados na conta AWS');
      console.log('   3. Permissões insuficientes');
      console.log('');
    } else {
      models.slice(0, 10).forEach((model, idx) => {
        console.log(`${idx + 1}. ${model.modelId}`);
        console.log(`   Nome: ${model.modelName}`);
        console.log(`   Status: ${model.modelLifecycle?.status || 'N/A'}`);
        console.log('');
      });
    }

    // 3. Testar chamada ao modelo
    console.log('3️⃣  TESTE DE CHAMADA');
    console.log('─'.repeat(70));

    const testModels = [
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'anthropic.claude-3-5-haiku-20241022-v1:0',
      'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
      'global.anthropic.claude-sonnet-4-5-20250929-v1:0'
    ];

    for (const modelId of testModels) {
      console.log(`Testando: ${modelId}...`);

      try {
        const runtime = new BedrockRuntimeClient({ region });
        const converseCommand = new ConverseCommand({
          modelId,
          messages: [{
            role: 'user',
            content: [{ text: 'Responda apenas: OK' }]
          }],
          inferenceConfig: {
            maxTokens: 10,
            temperature: 0
          }
        });

        const result = await runtime.send(converseCommand);
        const response = result.output?.message?.content?.[0]?.text || 'Sem resposta';

        console.log(`   ✅ Sucesso! Resposta: "${response}"`);
        console.log('');
        break; // Se funcionou, não precisa testar outros
      } catch (error) {
        console.log(`   ❌ Falhou: ${error.message}`);
        if (error.name === 'AccessDeniedException') {
          console.log(`   💡 Modelo não habilitado na conta AWS`);
        } else if (error.name === 'ResourceNotFoundException') {
          console.log(`   💡 Modelo não existe nesta região`);
        }
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.error('');
    console.error('Stack:', error.stack);
    process.exit(1);
  }

  console.log('═'.repeat(70));
}

testBedrockModels().catch(console.error);
