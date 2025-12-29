#!/usr/bin/env node
/**
 * Validação Rápida - Modelos Principais AWS Bedrock
 * Região: us-west-2 (Oregon)
 */

import { conversar } from '../src/modules/bedrock.js';

const MODELOS_PRINCIPAIS = [
  { id: 'anthropic.claude-sonnet-4-5-20250929-v1:0', nome: 'Claude Sonnet 4.5 (Principal)' },
  { id: 'anthropic.claude-opus-4-5-20251101-v1:0', nome: 'Claude Opus 4.5' },
  { id: 'amazon.nova-premier-v1:0', nome: 'Nova Premier' },
  { id: 'anthropic.claude-haiku-4-5-20251001-v1:0', nome: 'Claude Haiku 4.5' }
];

console.log('═══════════════════════════════════════════════════════════');
console.log('🔍 VALIDAÇÃO RÁPIDA - AWS BEDROCK (us-west-2)');
console.log('═══════════════════════════════════════════════════════════\n');

async function testarModelo(modelo) {
  try {
    const inicio = Date.now();

    const resultado = await conversar('Responda apenas: OK', {
      modelo: modelo.id,
      maxTokens: 10,
      temperature: 0,
      enableTools: false
    });

    const duracao = Date.now() - inicio;

    if (resultado.sucesso) {
      console.log(`✅ ${modelo.nome}: ${duracao}ms`);
      return { sucesso: true, modelo: modelo.nome, duracao };
    } else {
      console.log(`❌ ${modelo.nome}: ${resultado.erro}`);
      return { sucesso: false, modelo: modelo.nome, erro: resultado.erro };
    }
  } catch (erro) {
    console.log(`❌ ${modelo.nome}: ${erro.message}`);
    return { sucesso: false, modelo: modelo.nome, erro: erro.message };
  }
}

async function executar() {
  const resultados = [];

  for (const modelo of MODELOS_PRINCIPAIS) {
    const resultado = await testarModelo(modelo);
    resultados.push(resultado);

    // Pequeno delay entre testes
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 RESULTADO');
  console.log('═══════════════════════════════════════════════════════════\n');

  const sucessos = resultados.filter(r => r.sucesso);
  const falhas = resultados.filter(r => !r.sucesso);

  console.log(`✅ Funcionando: ${sucessos.length}/${MODELOS_PRINCIPAIS.length}`);
  console.log(`❌ Com problema: ${falhas.length}/${MODELOS_PRINCIPAIS.length}\n`);

  if (sucessos.length === MODELOS_PRINCIPAIS.length) {
    console.log('🎉 TODOS OS MODELOS PRINCIPAIS ESTÃO FUNCIONANDO!\n');
    console.log('✅ Configuração AWS Bedrock (us-west-2): VALIDADA');
    console.log('✅ Inference Profiles: FUNCIONANDO');
    console.log('✅ Credenciais: VÁLIDAS\n');
  } else if (falhas.length > 0) {
    console.log('⚠️  ALGUNS MODELOS COM PROBLEMA:\n');
    falhas.forEach(f => {
      console.log(`   ❌ ${f.modelo}: ${f.erro}`);
    });
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(falhas.length > 0 ? 1 : 0);
}

executar().catch(erro => {
  console.error('❌ Erro fatal:', erro.message);
  process.exit(1);
});
