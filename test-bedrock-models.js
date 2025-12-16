#!/usr/bin/env node
/**
 * 🔍 Script de Teste de Modelos AWS Bedrock
 *
 * Testa acesso aos modelos:
 * - amazon.nova-lite-v1:0 (atual, funciona)
 * - amazon.nova-pro-v1:0 (causa 502)
 * - anthropic.claude-sonnet-4-5-20251022-v2:0 (para análises complexas)
 *
 * Uso: node test-bedrock-models.js
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

// Configuração do cliente
const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

console.log('🔧 Configuração AWS:');
console.log(`   Region: ${process.env.AWS_REGION || 'us-east-1'}`);
console.log(`   Access Key: ${process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...' : '❌ NÃO CONFIGURADA'}`);
console.log(`   Secret Key: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Configurada' : '❌ NÃO CONFIGURADA'}`);
console.log('');

/**
 * Testa um modelo específico do Bedrock
 */
async function testModel(modelId, description) {
  console.log(`📡 Testando: ${description}`);
  console.log(`   Model ID: ${modelId}`);

  try {
    const body = JSON.stringify({
      prompt: '\n\nHuman: Responda apenas "OK"\n\nAssistant:',
      max_tokens: 10,
      temperature: 0.1
    });

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body
    });

    const startTime = Date.now();
    const response = await client.send(command);
    const duration = Date.now() - startTime;

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    console.log(`   ✅ SUCESSO! (${duration}ms)`);
    console.log(`   Resposta: ${JSON.stringify(responseBody).substring(0, 100)}...`);
    console.log('');

    return { success: true, modelId, duration };

  } catch (error) {
    console.log(`   ❌ ERRO: ${error.name}`);
    console.log(`   Mensagem: ${error.message}`);

    // Diagnóstico específico do erro
    if (error.name === 'AccessDeniedException') {
      console.log(`   🔍 DIAGNÓSTICO: Sem permissão IAM para este modelo`);
      console.log(`   💡 SOLUÇÃO: Adicionar "bedrock:InvokeModel" na policy IAM para ${modelId}`);
    } else if (error.name === 'ValidationException') {
      console.log(`   🔍 DIAGNÓSTICO: Modelo não encontrado ou nome inválido`);
      console.log(`   💡 SOLUÇÃO: Verificar se modelo está disponível na região ${process.env.AWS_REGION || 'us-east-1'}`);
    } else if (error.name === 'ResourceNotFoundException') {
      console.log(`   🔍 DIAGNÓSTICO: Modelo não disponível nesta região`);
      console.log(`   💡 SOLUÇÃO: Trocar AWS_REGION para us-east-1 ou us-west-2`);
    } else if (error.name === 'UnrecognizedClientException') {
      console.log(`   🔍 DIAGNÓSTICO: Credenciais AWS inválidas`);
      console.log(`   💡 SOLUÇÃO: Verificar AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY`);
    } else if (error.name === 'ThrottlingException') {
      console.log(`   🔍 DIAGNÓSTICO: Limite de rate limit atingido`);
      console.log(`   💡 SOLUÇÃO: Aguardar alguns segundos e tentar novamente`);
    } else {
      console.log(`   🔍 DIAGNÓSTICO: Erro desconhecido`);
      console.log(`   💡 Stack trace completo:`);
      console.log(error);
    }

    console.log('');
    return { success: false, modelId, error: error.message };
  }
}

/**
 * Executa todos os testes
 */
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TESTE DE MODELOS AWS BEDROCK - ROM Agent');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  const results = [];

  // Teste 1: Nova Lite (atual, deve funcionar)
  results.push(await testModel(
    'amazon.nova-lite-v1:0',
    'Amazon Nova Lite (ATUAL - deve funcionar)'
  ));

  // Teste 2: Nova Pro (causa 502)
  results.push(await testModel(
    'amazon.nova-pro-v1:0',
    'Amazon Nova Pro (TARGET - causa 502 no Render)'
  ));

  // Teste 3: Claude Sonnet (para análises complexas)
  results.push(await testModel(
    'anthropic.claude-sonnet-4-5-20251022-v2:0',
    'Claude Sonnet 4.5 (para análises complexas)'
  ));

  // Resumo final
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 RESUMO DOS TESTES:');
  console.log('═══════════════════════════════════════════════════════════');

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✅ Sucessos: ${successful}/${results.length}`);
  console.log(`❌ Falhas: ${failed}/${results.length}`);
  console.log('');

  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const detail = result.success
      ? `${result.duration}ms`
      : result.error.substring(0, 50) + '...';
    console.log(`${status} ${result.modelId}: ${detail}`);
  });

  console.log('');

  // Recomendações
  if (failed > 0) {
    console.log('🎯 PRÓXIMOS PASSOS:');
    console.log('');

    if (!results[1].success) {
      console.log('⚠️  Nova Pro falhou - Este é o problema do 502!');
      console.log('   1. Copie o erro acima e envie para mim');
      console.log('   2. Vou ajudar a corrigir as permissões/região');
      console.log('');
    }

    if (results.every(r => !r.success)) {
      console.log('⚠️  TODOS os modelos falharam!');
      console.log('   → Problema com credenciais AWS ou região');
      console.log('   → Verifique AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY');
      console.log('');
    }
  } else {
    console.log('🎉 TODOS OS MODELOS FUNCIONANDO!');
    console.log('   → Problema NÃO é com AWS/IAM');
    console.log('   → Problema pode ser específico do Render');
    console.log('   → Vamos verificar logs do Render');
    console.log('');
  }
}

// Verificar se credenciais estão configuradas
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('❌ ERRO: Variáveis de ambiente AWS não configuradas!');
  console.error('');
  console.error('Configure antes de executar:');
  console.error('export AWS_ACCESS_KEY_ID="sua-access-key"');
  console.error('export AWS_SECRET_ACCESS_KEY="sua-secret-key"');
  console.error('export AWS_REGION="us-east-1"');
  console.error('');
  process.exit(1);
}

// Executar testes
runAllTests().catch(error => {
  console.error('💥 Erro fatal durante os testes:');
  console.error(error);
  process.exit(1);
});
