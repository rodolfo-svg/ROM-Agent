#!/usr/bin/env node
/**
 * 🧪 TESTE DE MODELOS - USANDO FUNÇÃO CORRETA DO MÓDULO
 *
 * Este teste usa a função conversar() do bedrock.js
 * que automaticamente aplica os inference profiles
 */

import { conversar } from './src/modules/bedrock.js';

// Apenas os 7 modelos que falharam
const FAILED_MODELS = {
  'Amazon': {
    'amazon.nova-premier-v1:0': 'Nova Premier (Top Tier)'
  },
  'Claude 4.x': {
    'anthropic.claude-opus-4-5-20251101-v1:0': 'Claude Opus 4.5 (Best)',
    'anthropic.claude-opus-4-20250514-v1:0': 'Claude Opus 4',
    'anthropic.claude-haiku-4-5-20251001-v1:0': 'Claude Haiku 4.5'
  },
  'Claude 3.x': {
    'anthropic.claude-3-opus-20240229-v1:0': 'Claude 3 Opus'
  },
  'Mistral': {
    'mistral.pixtral-large-2502-v1:0': 'Pixtral Large (Multimodal)'
  },
  'DeepSeek': {
    'deepseek.r1-v1:0': 'DeepSeek R1 (Reasoning)'
  }
};

async function testModel(modelId, description) {
  try {
    const startTime = Date.now();

    const result = await conversar('Responda apenas: OK', {
      modelo: modelId,
      maxTokens: 10,
      temperature: 0.1
    });

    const duration = Date.now() - startTime;

    return {
      success: true,
      modelId,
      description,
      duration,
      response: result.content?.[0]?.text?.substring(0, 50) || 'N/A'
    };

  } catch (error) {
    return {
      success: false,
      modelId,
      description,
      error: error.name,
      errorMessage: error.message
    };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 RETESTE DOS 7 MODELOS QUE FALHARAM');
  console.log('   Usando função conversar() com inference profiles');
  console.log('═══════════════════════════════════════════════════════════\n');

  const results = [];
  let currentModel = 0;
  const totalModels = 7;

  for (const [category, models] of Object.entries(FAILED_MODELS)) {
    console.log(`\n📦 ${category}`);
    console.log('─'.repeat(65));

    for (const [modelId, description] of Object.entries(models)) {
      currentModel++;
      const progress = `[${currentModel}/${totalModels}]`;

      process.stdout.write(`${progress} ${description}... `);

      const result = await testModel(modelId, description);
      results.push(result);

      if (result.success) {
        console.log(`✅ ${result.duration}ms`);
      } else {
        const errorMsg = result.error === 'ThrottlingException' ? 'Rate limit (retry em 5s)' :
                        result.error === 'ValidationException' ? 'Modelo inválido' :
                        result.errorCode === 502 ? '502 Bad Gateway' :
                        result.error;
        console.log(`❌ ${errorMsg}`);
      }

      // Delay entre requests
      if (currentModel < totalModels) {
        await sleep(3000); // 3s entre cada
      }
    }
  }

  // Resumo
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 RESULTADO FINAL');
  console.log('═══════════════════════════════════════════════════════════\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Agora funcionam: ${successful.length}/${totalModels}`);
  console.log(`❌ Ainda falham: ${failed.length}/${totalModels}\n`);

  if (successful.length > 0) {
    console.log('🎉 MODELOS CORRIGIDOS:');
    successful.forEach(r => {
      console.log(`   ✅ ${r.description}: ${r.duration}ms`);
    });
    console.log('');
  }

  if (failed.length > 0) {
    console.log('⚠️  AINDA COM PROBLEMA:');
    failed.forEach(r => {
      console.log(`   ❌ ${r.description}: ${r.error}`);
      if (r.errorMessage) {
        console.log(`      ${r.errorMessage.substring(0, 80)}`);
      }
    });
    console.log('');
  }

  // Conclusão
  if (successful.length === totalModels) {
    console.log('🎉 SUCESSO TOTAL! Todos os 7 modelos agora funcionam!');
  } else if (successful.length > 0) {
    console.log(`✅ Corrigimos ${successful.length} de ${totalModels} modelos`);
    console.log(`   Taxa de correção: ${(successful.length/totalModels*100).toFixed(1)}%`);
  } else {
    console.log('❌ Nenhum modelo foi corrigido');
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');

  return results;
}

runTests().catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});
