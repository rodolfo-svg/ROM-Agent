#!/usr/bin/env node
/**
 * 🔍 Script de Teste de Modelos AWS Bedrock (CORRETO)
 * Usa a API Converse (como o BedrockAgent do projeto)
 */

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

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
 * Testa um modelo específico do Bedrock usando API Converse
 */
async function testModel(modelId, description) {
  console.log(`📡 Testando: ${description}`);
  console.log(`   Model ID: ${modelId}`);

  try {
    const command = new ConverseCommand({
      modelId,
      messages: [
        {
          role: 'user',
          content: [{ text: 'Responda apenas "OK"' }]
        }
      ],
      inferenceConfig: {
        maxTokens: 10,
        temperature: 0.1
      }
    });

    const startTime = Date.now();
    const response = await client.send(command);
    const duration = Date.now() - startTime;

    const resposta = response.output.message.content[0].text;

    console.log(`   ✅ SUCESSO! (${duration}ms)`);
    console.log(`   Resposta: ${resposta}`);
    console.log(`   Tokens: ${response.usage.inputTokens} in / ${response.usage.outputTokens} out`);
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
    } else if (error.name === 'ServiceQuotaExceededException') {
      console.log(`   🔍 DIAGNÓSTICO: Quota de uso excedida ou modelo não habilitado`);
      console.log(`   💡 SOLUÇÃO: Verificar se modelo está habilitado no Bedrock Console`);
    } else {
      console.log(`   🔍 DIAGNÓSTICO: Erro desconhecido - ${error.name}`);
    }

    console.log('');
    return { success: false, modelId, error: error.message, errorType: error.name };
  }
}

/**
 * Executa todos os testes
 */
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TESTE DE MODELOS AWS BEDROCK - ROM Agent (API Converse)');
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

  // Teste 3: Claude Sonnet 4.5 (correto model ID)
  results.push(await testModel(
    'anthropic.claude-sonnet-4-5-20250929-v1:0',
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
      : `${result.errorType}: ${result.error.substring(0, 40)}...`;
    console.log(`${status} ${result.modelId}`);
    console.log(`   ${detail}`);
  });

  console.log('');

  // Análise e recomendações
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎯 ANÁLISE:');
  console.log('═══════════════════════════════════════════════════════════');

  if (failed > 0) {
    console.log('');

    // Caso Nova Pro falhe
    if (!results[1].success) {
      console.log('⚠️  NOVA PRO FALHOU - Este é o problema do 502!');
      console.log(`   Erro: ${results[1].errorType}`);
      console.log(`   Msg: ${results[1].error}`);
      console.log('');

      if (results[1].errorType === 'AccessDeniedException') {
        console.log('   📋 SOLUÇÃO:');
        console.log('   1. Acesse AWS IAM Console');
        console.log('   2. Encontre a policy da sua role/user');
        console.log('   3. Adicione permissão para Nova Pro:');
        console.log('      "Resource": "arn:aws:bedrock:*::foundation-model/amazon.nova-pro-v1:0"');
      } else if (results[1].errorType === 'ServiceQuotaExceededException') {
        console.log('   📋 SOLUÇÃO:');
        console.log('   1. Acesse AWS Bedrock Console');
        console.log('   2. Menu: Model access');
        console.log('   3. Habilite "Amazon Nova Pro"');
        console.log('   4. Aguarde aprovação (pode levar alguns minutos)');
      } else if (results[1].errorType === 'ResourceNotFoundException') {
        console.log('   📋 SOLUÇÃO:');
        console.log('   1. Troque AWS_REGION para "us-east-1"');
        console.log('   2. Nova Pro só está disponível em regiões específicas');
      }
    }

    // Caso todos falhem
    if (results.every(r => !r.success)) {
      console.log('⚠️  TODOS OS MODELOS FALHARAM!');
      console.log('   → Problema com credenciais AWS ou região');
      console.log('   → Verifique AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY');
      console.log('   → Verifique se modelos estão habilitados no Bedrock');
      console.log('');
    }
  } else {
    console.log('');
    console.log('🎉 TODOS OS MODELOS FUNCIONANDO LOCALMENTE!');
    console.log('');
    console.log('   Isso significa que:');
    console.log('   ✅ Credenciais AWS estão corretas');
    console.log('   ✅ Modelos estão disponíveis na região');
    console.log('   ✅ Permissões IAM estão OK');
    console.log('');
    console.log('   🤔 Se ainda há 502 no Render:');
    console.log('   → Problema é com ENV vars no Render');
    console.log('   → Verifique se AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
    console.log('     estão configuradas CORRETAMENTE no Render Dashboard');
    console.log('   → Nova Pro pode não estar habilitado na conta do Render');
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
