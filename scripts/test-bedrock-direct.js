#!/usr/bin/env node

/**
 * Teste direto do AWS Bedrock
 * Verifica exatamente qual erro está ocorrendo
 */

import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const region = process.env.AWS_REGION || 'us-west-2';
const modelId = 'anthropic.claude-sonnet-4-5-20250929-v1:0';

console.log('=== Teste Direto AWS Bedrock ===\n');
console.log(`Região: ${region}`);
console.log(`Modelo: ${modelId}`);
console.log(`AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ configurada' : '❌ não configurada'}`);
console.log(`AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ configurada' : '❌ não configurada'}`);
console.log(`AWS_REGION: ${process.env.AWS_REGION || '❌ não configurada (usando fallback)'}`);
console.log('');

async function testBedrock() {
  try {
    console.log('Criando cliente Bedrock...');
    const client = new BedrockRuntimeClient({ region });

    console.log('Criando comando Converse...');
    const command = new ConverseCommand({
      modelId,
      messages: [
        {
          role: "user",
          content: [{ text: "Responda apenas: OK" }],
        },
      ],
      inferenceConfig: {
        maxTokens: 10,
        temperature: 0.1,
      },
    });

    console.log('Enviando request ao Bedrock...\n');
    const response = await client.send(command);

    console.log('✅ SUCESSO! Bedrock respondeu:');
    console.log(JSON.stringify(response, null, 2));

    const text = response.output?.message?.content?.[0]?.text;
    if (text) {
      console.log('\n📝 Resposta do modelo:', text);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ ERRO ao chamar Bedrock:\n');
    console.error('Tipo:', error.name);
    console.error('Mensagem:', error.message);

    if (error.$metadata) {
      console.error('\nMetadata da AWS:');
      console.error('  HTTP Status:', error.$metadata.httpStatusCode);
      console.error('  Request ID:', error.$metadata.requestId);
    }

    if (error.Code) {
      console.error('\nCódigo do erro:', error.Code);
    }

    console.error('\nStack trace completo:');
    console.error(error.stack);

    // Análise do erro
    console.error('\n📊 Análise do Erro:\n');

    if (error.name === 'AccessDeniedException') {
      console.error('🔐 Problema de PERMISSÃO IAM');
      console.error('   - O usuário/role AWS não tem permissão para invocar o modelo');
      console.error('   - Verificar IAM policy: bedrock:InvokeModel');
      console.error('   - Resource ARN esperado: arn:aws:bedrock:us-west-2::foundation-model/' + modelId);
    } else if (error.name === 'ResourceNotFoundException') {
      console.error('🔍 Modelo NÃO ENCONTRADO');
      console.error('   - O modelo pode não estar disponível na região ' + region);
      console.error('   - Ou o Model ID está incorreto');
    } else if (error.name === 'ValidationException') {
      console.error('⚠️  Erro de VALIDAÇÃO');
      console.error('   - Parâmetros da requisição estão incorretos');
    } else if (error.name === 'ThrottlingException') {
      console.error('🚦 LIMITE DE TAXA (Throttling)');
      console.error('   - Muitas requisições em pouco tempo');
      console.error('   - Verificar cotas do AWS Bedrock');
    } else if (error.name === 'CredentialsProviderError' || error.message?.includes('credentials')) {
      console.error('🔑 Problema de CREDENCIAIS');
      console.error('   - AWS_ACCESS_KEY_ID ou AWS_SECRET_ACCESS_KEY inválidas');
      console.error('   - Ou credenciais expiradas');
    } else if (error.name === 'ModelNotReadyException') {
      console.error('⏳ Modelo NÃO ESTÁ PRONTO');
      console.error('   - O modelo pode estar sendo provisionado');
      console.error('   - Ou não foi habilitado na conta');
    } else {
      console.error('❓ Erro desconhecido - ver stack trace acima');
    }

    process.exit(1);
  }
}

testBedrock();
