#!/usr/bin/env node
/**
 * 🔍 Análise de Modelos Habilitados no AWS Bedrock
 * Região: us-west-2 (Oregon)
 *
 * Lista TODOS os modelos que você habilitou e compara com as recomendações
 */

import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';

// Cliente Bedrock Management
const client = new BedrockClient({
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Modelos recomendados para o ROM Agent
const MODELOS_RECOMENDADOS = {
  essenciais: [
    'amazon.nova-pro-v1:0',
    'anthropic.claude-sonnet-4-5-20250929-v1:0',
    'deepseek.r1-v1:0',
    'anthropic.claude-3-5-sonnet-20241022-v2:0', // Multimodal
    'anthropic.claude-opus-4-5-20251101-v1:0',
    'anthropic.claude-haiku-4-5-20251001-v1:0'
  ],
  recomendados: [
    'amazon.nova-premier-v1:0',
    'meta.llama3-3-70b-instruct-v1:0',
    'meta.llama4-maverick-17b-instruct-v1:0'
  ],
  extras: [
    'anthropic.claude-sonnet-4-20250514-v1:0',
    'anthropic.claude-opus-4-20250514-v1:0',
    'meta.llama4-scout-17b-instruct-v1:0',
    'mistral.mistral-large-3-675b-instruct',
    'cohere.command-r-plus-v1:0',
    'cohere.command-r-v1:0'
  ]
};

// Casos de uso por modelo
const CASOS_DE_USO = {
  'amazon.nova-pro-v1:0': 'Chat geral, análises rápidas',
  'amazon.nova-premier-v1:0': 'Casos VIP, máxima qualidade Amazon',
  'amazon.nova-lite-v1:0': 'Triagem básica (não recomendado)',

  'anthropic.claude-sonnet-4-5-20250929-v1:0': 'Análises profundas, RAG otimizado',
  'anthropic.claude-opus-4-5-20251101-v1:0': 'Máxima qualidade, multimodal premium',
  'anthropic.claude-haiku-4-5-20251001-v1:0': 'Resumos rápidos, triagem',
  'anthropic.claude-3-5-sonnet-20241022-v2:0': 'Multimodal (imagens), custo-benefício',

  'deepseek.r1-v1:0': 'Raciocínio exposto, fundamentação complexa',

  'meta.llama3-3-70b-instruct-v1:0': 'Long context barato, RAG alternativo',
  'meta.llama4-maverick-17b-instruct-v1:0': 'Segunda opinião, validação',
  'meta.llama4-scout-17b-instruct-v1:0': 'Análises alternativas',

  'mistral.mistral-large-3-675b-instruct': 'Casos multilíngues',
  'cohere.command-r-plus-v1:0': 'RAG especializado',
  'cohere.command-r-v1:0': 'RAG custo-benefício'
};

async function listarModelosHabilitados() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 ANÁLISE DE MODELOS AWS BEDROCK - Região: us-west-2');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const command = new ListFoundationModelsCommand({});
    const response = await client.send(command);

    // Organizar por provedor
    const porProvedor = {};
    const habilitados = [];
    const todos = [];

    response.modelSummaries.forEach(model => {
      const provedor = model.providerName;
      if (!porProvedor[provedor]) {
        porProvedor[provedor] = [];
      }

      const modelInfo = {
        id: model.modelId,
        nome: model.modelName,
        provedor: model.providerName,
        streaming: model.responseStreamingSupported,
        input: model.inputModalities || [],
        output: model.outputModalities || []
      };

      porProvedor[provedor].push(modelInfo);
      todos.push(modelInfo);

      // Assumindo que todos listados estão habilitados
      // (ListFoundationModels só retorna modelos com acesso)
      habilitados.push(model.modelId);
    });

    // Análise de cobertura
    console.log('📊 RESUMO GERAL:\n');
    console.log(`   Total de modelos habilitados: ${habilitados.length}`);
    console.log(`   Provedores disponíveis: ${Object.keys(porProvedor).length}\n`);

    // Listar por provedor
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 MODELOS POR PROVEDOR:');
    console.log('═══════════════════════════════════════════════════════════\n');

    for (const [provedor, modelos] of Object.entries(porProvedor)) {
      console.log(`\n🏢 ${provedor.toUpperCase()} (${modelos.length} modelos):`);
      console.log('─────────────────────────────────────────────────────────\n');

      modelos.forEach(model => {
        const isEssencial = MODELOS_RECOMENDADOS.essenciais.includes(model.id);
        const isRecomendado = MODELOS_RECOMENDADOS.recomendados.includes(model.id);
        const casoDeUso = CASOS_DE_USO[model.id];

        let badge = '';
        if (isEssencial) badge = '⭐ ESSENCIAL';
        else if (isRecomendado) badge = '🎯 RECOMENDADO';

        const multimodal = model.input.includes('IMAGE') ? '📸 MULTIMODAL' : '';

        console.log(`   ${badge ? badge + ' ' : ''}${multimodal ? multimodal + ' ' : ''}${model.nome}`);
        console.log(`   ID: ${model.id}`);
        if (casoDeUso) {
          console.log(`   💡 Uso: ${casoDeUso}`);
        }
        console.log(`   Input: ${model.input.join(', ')}`);
        console.log(`   Output: ${model.output.join(', ')}`);
        console.log(`   Streaming: ${model.streaming ? '✅' : '❌'}`);
        console.log('');
      });
    }

    // Análise de recomendações
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎯 ANÁLISE DAS RECOMENDAÇÕES:');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('ESSENCIAIS (6 modelos):');
    MODELOS_RECOMENDADOS.essenciais.forEach(modelId => {
      const tem = habilitados.includes(modelId);
      console.log(`   ${tem ? '✅' : '❌'} ${modelId}`);
      if (!tem) {
        console.log(`      💡 ${CASOS_DE_USO[modelId] || 'Modelo recomendado'}`);
      }
    });

    console.log('\nRECOMENDADOS (3 modelos):');
    MODELOS_RECOMENDADOS.recomendados.forEach(modelId => {
      const tem = habilitados.includes(modelId);
      console.log(`   ${tem ? '✅' : '❌'} ${modelId}`);
      if (!tem) {
        console.log(`      💡 ${CASOS_DE_USO[modelId] || 'Modelo recomendado'}`);
      }
    });

    // Estatísticas finais
    const essenciaisHabilitados = MODELOS_RECOMENDADOS.essenciais.filter(m => habilitados.includes(m)).length;
    const recomendadosHabilitados = MODELOS_RECOMENDADOS.recomendados.filter(m => habilitados.includes(m)).length;

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📈 ESTATÍSTICAS:');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`   Essenciais habilitados: ${essenciaisHabilitados}/6`);
    console.log(`   Recomendados habilitados: ${recomendadosHabilitados}/3`);
    console.log(`   Total recomendados: ${essenciaisHabilitados + recomendadosHabilitados}/9\n`);

    // Recomendações finais
    const faltamEssenciais = MODELOS_RECOMENDADOS.essenciais.filter(m => !habilitados.includes(m));
    const faltamRecomendados = MODELOS_RECOMENDADOS.recomendados.filter(m => !habilitados.includes(m));

    if (faltamEssenciais.length > 0 || faltamRecomendados.length > 0) {
      console.log('⚠️  RECOMENDAÇÕES:\n');

      if (faltamEssenciais.length > 0) {
        console.log('   🔴 FALTAM MODELOS ESSENCIAIS:');
        faltamEssenciais.forEach(modelId => {
          console.log(`      • ${modelId}`);
          console.log(`        ${CASOS_DE_USO[modelId]}`);
        });
        console.log('');
      }

      if (faltamRecomendados.length > 0) {
        console.log('   🟡 FALTAM MODELOS RECOMENDADOS:');
        faltamRecomendados.forEach(modelId => {
          console.log(`      • ${modelId}`);
          console.log(`        ${CASOS_DE_USO[modelId]}`);
        });
        console.log('');
      }

      console.log('   💡 Para habilitar, acesse:');
      console.log('   https://us-west-2.console.aws.amazon.com/bedrock/home?region=us-west-2#/modelaccess\n');
    } else {
      console.log('🎉 PERFEITO! Todos os modelos recomendados estão habilitados!\n');
    }

    // Modelos extras encontrados
    const extras = habilitados.filter(m =>
      !MODELOS_RECOMENDADOS.essenciais.includes(m) &&
      !MODELOS_RECOMENDADOS.recomendados.includes(m)
    );

    if (extras.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('➕ MODELOS EXTRAS HABILITADOS:');
      console.log('═══════════════════════════════════════════════════════════\n');

      extras.forEach(modelId => {
        const model = todos.find(m => m.id === modelId);
        if (model) {
          console.log(`   ✅ ${model.nome} (${modelId})`);
        }
      });
      console.log('');
    }

    // Gerar lista final para implementação
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 MODELOS DISPONÍVEIS PARA INTELLIGENT SELECTOR:');
    console.log('═══════════════════════════════════════════════════════════\n');

    const implementaveis = MODELOS_RECOMENDADOS.essenciais
      .concat(MODELOS_RECOMENDADOS.recomendados)
      .filter(m => habilitados.includes(m));

    console.log(`   Total de modelos para usar: ${implementaveis.length}\n`);
    implementaveis.forEach(modelId => {
      console.log(`   ✅ ${modelId}`);
      console.log(`      ${CASOS_DE_USO[modelId]}`);
    });

    console.log('\n═══════════════════════════════════════════════════════════\n');

    return {
      habilitados,
      implementaveis,
      faltamEssenciais,
      faltamRecomendados
    };

  } catch (error) {
    console.error('❌ ERRO ao listar modelos:');
    console.error(`   ${error.name}: ${error.message}\n`);

    if (error.name === 'UnrecognizedClientException') {
      console.error('   💡 Verifique suas credenciais AWS (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)');
    } else if (error.name === 'AccessDeniedException') {
      console.error('   💡 Sua IAM role precisa de permissão "bedrock:ListFoundationModels"');
    }

    process.exit(1);
  }
}

// Verificar credenciais
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('❌ ERRO: Variáveis de ambiente AWS não configuradas!\n');
  console.error('Configure antes de executar:');
  console.error('export AWS_ACCESS_KEY_ID="sua-access-key"');
  console.error('export AWS_SECRET_ACCESS_KEY="sua-secret-key"');
  console.error('export AWS_REGION="us-west-2"\n');
  process.exit(1);
}

// Executar análise
listarModelosHabilitados().catch(error => {
  console.error('💥 Erro fatal durante análise:');
  console.error(error);
  process.exit(1);
});
