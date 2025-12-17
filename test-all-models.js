#!/usr/bin/env node
/**
 * 🧪 TESTE COMPLETO DE TODOS OS MODELOS AWS BEDROCK
 *
 * Testa TODOS os 33+ modelos disponíveis no ROM Agent
 * Gera relatório completo com status, latência e erros
 */

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { config } from 'dotenv';

// Carregar variáveis de ambiente
config();

// Cliente Bedrock
const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// TODOS OS MODELOS DO ROM AGENT
const ALL_MODELS = {
  'Amazon Nova': {
    'amazon.nova-premier-v1:0': 'Nova Premier (Top Tier)',
    'amazon.nova-pro-v1:0': 'Nova Pro (Balanced)',
    'amazon.nova-lite-v1:0': 'Nova Lite (Fast)',
    'amazon.nova-micro-v1:0': 'Nova Micro (Ultra Fast)',
    'amazon.titan-text-express-v1': 'Titan Text Express'
  },
  'Anthropic Claude 4.x': {
    'anthropic.claude-opus-4-5-20251101-v1:0': 'Claude Opus 4.5 (Best)',
    'anthropic.claude-opus-4-20250514-v1:0': 'Claude Opus 4',
    'anthropic.claude-sonnet-4-5-20250929-v1:0': 'Claude Sonnet 4.5 (Default)',
    'anthropic.claude-sonnet-4-20250514-v1:0': 'Claude Sonnet 4',
    'anthropic.claude-haiku-4-5-20251001-v1:0': 'Claude Haiku 4.5'
  },
  'Anthropic Claude 3.x': {
    'anthropic.claude-3-5-sonnet-20241022-v2:0': 'Claude 3.5 Sonnet',
    'anthropic.claude-3-5-haiku-20241022-v1:0': 'Claude 3.5 Haiku',
    'anthropic.claude-3-opus-20240229-v1:0': 'Claude 3 Opus',
    'anthropic.claude-3-sonnet-20240229-v1:0': 'Claude 3 Sonnet',
    'anthropic.claude-3-haiku-20240307-v1:0': 'Claude 3 Haiku'
  },
  'Meta Llama 4.x': {
    'meta.llama4-scout-17b-instruct-v1:0': 'Llama 4 Scout 17B',
    'meta.llama4-maverick-17b-instruct-v1:0': 'Llama 4 Maverick 17B'
  },
  'Meta Llama 3.x': {
    'meta.llama3-3-70b-instruct-v1:0': 'Llama 3.3 70B',
    'meta.llama3-2-90b-instruct-v1:0': 'Llama 3.2 90B',
    'meta.llama3-2-11b-instruct-v1:0': 'Llama 3.2 11B',
    'meta.llama3-1-70b-instruct-v1:0': 'Llama 3.1 70B',
    'meta.llama3-1-8b-instruct-v1:0': 'Llama 3.1 8B'
  },
  'Mistral AI': {
    'mistral.mistral-large-3-675b-instruct': 'Mistral Large 3 (675B)',
    'mistral.pixtral-large-2502-v1:0': 'Pixtral Large (Multimodal)',
    'mistral.ministral-3-14b-instruct': 'Ministral 3 14B',
    'mistral.ministral-3-8b-instruct': 'Ministral 3 8B'
  },
  'DeepSeek': {
    'deepseek.r1-v1:0': 'DeepSeek R1 (Reasoning)'
  },
  'Cohere': {
    'cohere.command-r-plus-v1:0': 'Command R+ (RAG)',
    'cohere.command-r-v1:0': 'Command R'
  }
};

// Inference Profiles (conversão automática)
const INFERENCE_PROFILES = {
  'meta.llama3-3-70b-instruct-v1:0': 'us.meta.llama3-3-70b-instruct-v1:0',
  'meta.llama3-2-90b-instruct-v1:0': 'us.meta.llama3-2-90b-instruct-v1:0',
  'meta.llama3-2-11b-instruct-v1:0': 'us.meta.llama3-2-11b-instruct-v1:0',
  'meta.llama3-1-70b-instruct-v1:0': 'us.meta.llama3-1-70b-instruct-v1:0',
  'meta.llama3-1-8b-instruct-v1:0': 'us.meta.llama3-1-8b-instruct-v1:0',
  'meta.llama4-scout-17b-instruct-v1:0': 'us.meta.llama4-scout-17b-instruct-v1:0',
  'meta.llama4-maverick-17b-instruct-v1:0': 'us.meta.llama4-maverick-17b-instruct-v1:0',
  'anthropic.claude-3-opus-20240229-v1:0': 'us.anthropic.claude-3-opus-20240229-v1:0',
  'anthropic.claude-3-5-haiku-20241022-v1:0': 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
  'anthropic.claude-3-5-sonnet-20241022-v2:0': 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
  'anthropic.claude-sonnet-4-20250514-v1:0': 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  'anthropic.claude-sonnet-4-5-20250929-v1:0': 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'
};

/**
 * Testa um modelo específico
 */
async function testModel(modelId, description) {
  const displayName = `${description} (${modelId})`;

  try {
    // Usar inference profile se necessário
    const finalModelId = INFERENCE_PROFILES[modelId] || modelId;

    const startTime = Date.now();

    const command = new ConverseCommand({
      modelId: finalModelId,
      messages: [{
        role: 'user',
        content: [{ text: 'Responda apenas: OK' }]
      }],
      inferenceConfig: {
        maxTokens: 10,
        temperature: 0.1
      }
    });

    const response = await client.send(command);
    const duration = Date.now() - startTime;

    const responseText = response.output?.message?.content?.[0]?.text || 'N/A';

    return {
      success: true,
      modelId,
      finalModelId,
      description,
      duration,
      responseText: responseText.substring(0, 50),
      inputTokens: response.usage?.inputTokens || 0,
      outputTokens: response.usage?.outputTokens || 0
    };

  } catch (error) {
    return {
      success: false,
      modelId,
      description,
      error: error.name,
      errorMessage: error.message,
      errorCode: error.$metadata?.httpStatusCode
    };
  }
}

/**
 * Aguarda N ms
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executa todos os testes
 */
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 TESTE COMPLETO DE MODELOS AWS BEDROCK - ROM AGENT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`📍 Region: ${process.env.AWS_REGION || 'us-east-1'}`);
  console.log(`🔑 Access Key: ${process.env.AWS_ACCESS_KEY_ID?.substring(0, 8)}...`);
  console.log('');

  const results = [];
  let totalModels = 0;

  // Contar total
  for (const category in ALL_MODELS) {
    totalModels += Object.keys(ALL_MODELS[category]).length;
  }

  console.log(`📊 Total de modelos a testar: ${totalModels}`);
  console.log('⏱️  Delay entre testes: 2s (evitar throttling)');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  let currentModel = 0;

  for (const [category, models] of Object.entries(ALL_MODELS)) {
    console.log(`\n📦 ${category.toUpperCase()}`);
    console.log('─'.repeat(65));

    for (const [modelId, description] of Object.entries(models)) {
      currentModel++;
      const progress = `[${currentModel}/${totalModels}]`;

      process.stdout.write(`${progress} ${description}... `);

      const result = await testModel(modelId, description);
      results.push(result);

      if (result.success) {
        console.log(`✅ ${result.duration}ms (${result.inputTokens}in/${result.outputTokens}out)`);
      } else {
        const errorMsg = result.error === 'AccessDeniedException' ? 'No IAM permission' :
                        result.error === 'ValidationException' ? 'Invalid model' :
                        result.error === 'ResourceNotFoundException' ? 'Not available' :
                        result.error === 'ThrottlingException' ? 'Rate limit' :
                        result.errorCode === 502 ? '502 Bad Gateway' :
                        result.error;
        console.log(`❌ ${errorMsg}`);
      }

      // Delay entre requests (evitar throttling)
      if (currentModel < totalModels) {
        await sleep(2000);
      }
    }
  }

  // Resumo final
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 RESUMO FINAL');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Sucessos: ${successful.length}/${totalModels} (${(successful.length/totalModels*100).toFixed(1)}%)`);
  console.log(`❌ Falhas: ${failed.length}/${totalModels} (${(failed.length/totalModels*100).toFixed(1)}%)`);
  console.log('');

  // Estatísticas de latência
  if (successful.length > 0) {
    const durations = successful.map(r => r.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    console.log('⚡ LATÊNCIA (Modelos que funcionaram):');
    console.log(`   Média: ${avgDuration.toFixed(0)}ms`);
    console.log(`   Mínima: ${minDuration}ms`);
    console.log(`   Máxima: ${maxDuration}ms`);
    console.log('');
  }

  // Modelos que funcionaram (ordenados por velocidade)
  if (successful.length > 0) {
    console.log('🏆 TOP 10 MAIS RÁPIDOS:');
    successful
      .sort((a, b) => a.duration - b.duration)
      .slice(0, 10)
      .forEach((r, i) => {
        console.log(`   ${i+1}. ${r.description}: ${r.duration}ms`);
      });
    console.log('');
  }

  // Erros por tipo
  if (failed.length > 0) {
    console.log('⚠️  FALHAS POR TIPO:');
    const errorTypes = {};
    failed.forEach(r => {
      const errorType = r.error || 'Unknown';
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    });

    for (const [error, count] of Object.entries(errorTypes).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${error}: ${count} modelo(s)`);
    }
    console.log('');

    console.log('❌ MODELOS QUE FALHARAM:');
    failed.forEach(r => {
      const reason = r.error === 'AccessDeniedException' ? 'sem permissão IAM' :
                    r.error === 'ValidationException' ? 'modelo inválido/não encontrado' :
                    r.error === 'ResourceNotFoundException' ? 'não disponível nesta região' :
                    r.error === 'ThrottlingException' ? 'rate limit atingido' :
                    r.errorCode === 502 ? '502 Bad Gateway' :
                    r.errorMessage;
      console.log(`   • ${r.description}: ${reason}`);
    });
    console.log('');
  }

  // Salvar relatório
  const report = {
    timestamp: new Date().toISOString(),
    region: process.env.AWS_REGION || 'us-east-1',
    totalModels,
    successful: successful.length,
    failed: failed.length,
    successRate: (successful.length / totalModels * 100).toFixed(1) + '%',
    results: results.map(r => ({
      modelId: r.modelId,
      description: r.description,
      success: r.success,
      duration: r.duration,
      error: r.error,
      errorMessage: r.errorMessage
    }))
  };

  const fs = await import('fs');
  fs.writeFileSync(
    'test-models-report.json',
    JSON.stringify(report, null, 2)
  );

  console.log('💾 Relatório salvo: test-models-report.json');
  console.log('');

  // Recomendações
  console.log('💡 RECOMENDAÇÕES:');
  console.log('');

  if (successful.length >= totalModels * 0.8) {
    console.log('   ✅ Excelente! Mais de 80% dos modelos funcionando');
    console.log('   → Seus modelos mais rápidos estão listados acima');
  } else if (successful.length >= totalModels * 0.5) {
    console.log('   ⚠️  Alguns modelos não estão funcionando');
    console.log('   → Verifique permissões IAM para os modelos que falharam');
  } else {
    console.log('   ❌ Maioria dos modelos falhando');
    console.log('   → Problema com credenciais AWS ou região');
    console.log('   → Verifique AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY e AWS_REGION');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
}

// Verificar credenciais
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('❌ ERRO: Variáveis de ambiente AWS não configuradas!');
  console.error('');
  console.error('Configure:');
  console.error('export AWS_ACCESS_KEY_ID="sua-key"');
  console.error('export AWS_SECRET_ACCESS_KEY="sua-secret"');
  console.error('export AWS_REGION="us-east-1"');
  process.exit(1);
}

// Executar
runAllTests().catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});
