#!/usr/bin/env node
/**
 * Teste Completo - Todos os Modelos Premium
 * Região: us-west-2 (Oregon)
 */

import { conversar } from '../src/modules/bedrock.js';

const MODELOS_TESTE = [
  // Anthropic Claude Premium
  { id: 'anthropic.claude-opus-4-5-20251101-v1:0', nome: 'Claude Opus 4.5', categoria: 'Claude Premium' },
  { id: 'anthropic.claude-haiku-4-5-20251001-v1:0', nome: 'Claude Haiku 4.5', categoria: 'Claude Premium' },

  // Amazon Nova
  { id: 'amazon.nova-premier-v1:0', nome: 'Nova Premier', categoria: 'Amazon Nova' },
  { id: 'amazon.nova-pro-v1:0', nome: 'Nova Pro', categoria: 'Amazon Nova' },

  // DeepSeek (Reasoning)
  { id: 'deepseek.r1-v1:0', nome: 'DeepSeek R1', categoria: 'DeepSeek' },

  // Meta Llama
  { id: 'meta.llama4-maverick-17b-instruct-v1:0', nome: 'Llama 4 Maverick', categoria: 'Meta Llama 4' },
  { id: 'meta.llama3-3-70b-instruct-v1:0', nome: 'Llama 3.3 70B', categoria: 'Meta Llama 3' },
  { id: 'meta.llama3-1-70b-instruct-v1:0', nome: 'Llama 3.1 70B', categoria: 'Meta Llama 3' },

  // Mistral
  { id: 'mistral.pixtral-large-2502-v1:0', nome: 'Pixtral Large', categoria: 'Mistral' }
];

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 TESTE COMPLETO - MODELOS PREMIUM');
console.log('   Região: us-west-2 (Oregon)');
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
      return { sucesso: true, modelo: modelo.nome, duracao, categoria: modelo.categoria };
    } else {
      return { sucesso: false, modelo: modelo.nome, erro: resultado.erro, categoria: modelo.categoria };
    }
  } catch (erro) {
    return { sucesso: false, modelo: modelo.nome, erro: erro.message, categoria: modelo.categoria };
  }
}

async function executar() {
  const resultados = [];
  let categoriaAtual = '';

  for (let i = 0; i < MODELOS_TESTE.length; i++) {
    const modelo = MODELOS_TESTE[i];

    // Cabeçalho de categoria
    if (modelo.categoria !== categoriaAtual) {
      categoriaAtual = modelo.categoria;
      console.log(`\n📦 ${categoriaAtual}`);
      console.log('─'.repeat(65));
    }

    process.stdout.write(`[${i + 1}/${MODELOS_TESTE.length}] ${modelo.nome}... `);

    const resultado = await testarModelo(modelo);
    resultados.push(resultado);

    if (resultado.sucesso) {
      console.log(`✅ ${resultado.duracao}ms`);
    } else {
      const erroMsg = resultado.erro.includes('Too many') ? 'Rate limit' :
                     resultado.erro.includes('ValidationException') ? 'Modelo inválido' :
                     resultado.erro.substring(0, 40);
      console.log(`❌ ${erroMsg}`);
    }

    // Delay entre testes
    if (i < MODELOS_TESTE.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Resumo
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 RESULTADO FINAL');
  console.log('═══════════════════════════════════════════════════════════\n');

  const sucessos = resultados.filter(r => r.sucesso);
  const falhas = resultados.filter(r => !r.sucesso);

  console.log(`✅ Funcionando: ${sucessos.length}/${MODELOS_TESTE.length}`);
  console.log(`❌ Com problema: ${falhas.length}/${MODELOS_TESTE.length}\n`);

  // Agrupar por categoria
  const porCategoria = resultados.reduce((acc, r) => {
    if (!acc[r.categoria]) acc[r.categoria] = [];
    acc[r.categoria].push(r);
    return acc;
  }, {});

  for (const [categoria, mods] of Object.entries(porCategoria)) {
    const ok = mods.filter(m => m.sucesso).length;
    const total = mods.length;
    const emoji = ok === total ? '✅' : ok > 0 ? '⚠️' : '❌';
    console.log(`${emoji} ${categoria}: ${ok}/${total}`);

    if (ok < total) {
      mods.filter(m => !m.sucesso).forEach(m => {
        console.log(`   ❌ ${m.modelo}: ${m.erro}`);
      });
    }
  }

  console.log('');

  if (sucessos.length === MODELOS_TESTE.length) {
    console.log('🎉 TODOS OS MODELOS PREMIUM ESTÃO FUNCIONANDO!\n');
  } else if (sucessos.length > 0) {
    console.log(`✅ ${sucessos.length} de ${MODELOS_TESTE.length} modelos funcionando (${(sucessos.length/MODELOS_TESTE.length*100).toFixed(0)}%)\n`);
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  return resultados;
}

executar().catch(erro => {
  console.error('❌ Erro fatal:', erro.message);
  process.exit(1);
});
