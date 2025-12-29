#!/usr/bin/env node
/**
 * Lista Inference Profiles disponíveis na conta AWS Bedrock
 */

import { BedrockClient, ListInferenceProfilesCommand } from '@aws-sdk/client-bedrock';

const REGIONS = ['us-east-1', 'us-west-2'];

async function listInferenceProfiles(region) {
  console.log(`\n🔍 Verificando região: ${region}`);
  console.log('='.repeat(80));

  const client = new BedrockClient({ region });

  try {
    const command = new ListInferenceProfilesCommand({});
    const response = await client.send(command);

    if (!response.inferenceProfileSummaries || response.inferenceProfileSummaries.length === 0) {
      console.log(`❌ Nenhum inference profile encontrado em ${region}`);
      return [];
    }

    console.log(`✅ Encontrados ${response.inferenceProfileSummaries.length} inference profiles em ${region}\n`);

    const profiles = [];

    for (const profile of response.inferenceProfileSummaries) {
      const info = {
        id: profile.inferenceProfileId,
        name: profile.inferenceProfileName,
        arn: profile.inferenceProfileArn,
        status: profile.status,
        type: profile.type,
        models: profile.models || []
      };

      profiles.push(info);

      console.log(`📌 ${info.name}`);
      console.log(`   ID:     ${info.id}`);
      console.log(`   ARN:    ${info.arn}`);
      console.log(`   Status: ${info.status}`);
      console.log(`   Type:   ${info.type}`);

      if (info.models && info.models.length > 0) {
        console.log(`   Models: ${info.models.map(m => m.modelId || m).join(', ')}`);
      }
      console.log('');
    }

    return profiles;

  } catch (error) {
    console.error(`❌ Erro ao listar profiles em ${region}:`, error.message);
    return [];
  }
}

async function main() {
  console.log('🚀 ROM Agent - Listagem de Inference Profiles AWS Bedrock');
  console.log('='.repeat(80));

  const allProfiles = {};

  for (const region of REGIONS) {
    const profiles = await listInferenceProfiles(region);
    allProfiles[region] = profiles;
  }

  console.log('\n📊 RESUMO POR REGIÃO');
  console.log('='.repeat(80));

  for (const [region, profiles] of Object.entries(allProfiles)) {
    console.log(`\n${region}: ${profiles.length} profiles`);

    // Filtrar por modelos importantes
    const claudeOpus45 = profiles.filter(p =>
      p.id.includes('claude-opus-4-5') || p.name?.includes('Opus 4.5')
    );
    const claudeHaiku45 = profiles.filter(p =>
      p.id.includes('claude-haiku-4-5') || p.name?.includes('Haiku 4.5')
    );
    const novaPremier = profiles.filter(p =>
      p.id.includes('nova-premier') || p.name?.includes('Nova Premier')
    );
    const deepseek = profiles.filter(p =>
      p.id.includes('deepseek') || p.name?.includes('DeepSeek')
    );

    if (claudeOpus45.length > 0) {
      console.log(`   ✅ Claude Opus 4.5: ${claudeOpus45[0].id}`);
    } else {
      console.log(`   ❌ Claude Opus 4.5: NÃO ENCONTRADO`);
    }

    if (claudeHaiku45.length > 0) {
      console.log(`   ✅ Claude Haiku 4.5: ${claudeHaiku45[0].id}`);
    } else {
      console.log(`   ❌ Claude Haiku 4.5: NÃO ENCONTRADO`);
    }

    if (novaPremier.length > 0) {
      console.log(`   ✅ Nova Premier: ${novaPremier[0].id}`);
    } else {
      console.log(`   ❌ Nova Premier: NÃO ENCONTRADO`);
    }

    if (deepseek.length > 0) {
      console.log(`   ✅ DeepSeek R1: ${deepseek[0].id}`);
    } else {
      console.log(`   ❌ DeepSeek R1: NÃO ENCONTRADO`);
    }
  }

  console.log('\n✅ Scan completo!');
}

main().catch(console.error);
