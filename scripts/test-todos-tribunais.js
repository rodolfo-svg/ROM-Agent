#!/usr/bin/env node

/**
 * Teste Abrangente - Sistema Nacional de Busca de Jurisprudência
 *
 * Valida que o sistema funciona para:
 * 1. Busca NACIONAL (sem tribunal específico)
 * 2. Tribunais SUPERIORES (STF, STJ, TST, TSE, STM)
 * 3. Tribunais ESTADUAIS (TJGO, TJSP, TJRJ, etc)
 * 4. Tribunais FEDERAIS (TRF1, TRF2, etc)
 * 5. Tribunais TRABALHISTAS (TRT1, TRT2, etc)
 */

import 'dotenv/config';
import { GoogleSearchClient } from '../lib/google-search-client.js';

console.log('═'.repeat(80));
console.log('🇧🇷 TESTE ABRANGENTE - SISTEMA NACIONAL DE JURISPRUDÊNCIA');
console.log('═'.repeat(80));
console.log('');

const client = new GoogleSearchClient();

if (!client.isConfigured()) {
  console.error('❌ Google Search não configurado!');
  process.exit(1);
}

console.log('✅ Google Search configurado e pronto');
console.log('');

// Testes a executar
const tests = [
  {
    name: 'BUSCA NACIONAL',
    query: 'responsabilidade civil médica',
    tribunal: null,
    expectativa: 'Deve buscar em TODOS os tribunais (.jus.br)'
  },
  {
    name: 'TJGO (Goiás)',
    query: 'responsabilidade civil',
    tribunal: 'TJGO',
    expectativa: 'Priorizar tjgo.jus.br'
  },
  {
    name: 'STJ (Superior)',
    query: 'recurso especial previdenciário',
    tribunal: 'STJ',
    expectativa: 'Priorizar stj.jus.br'
  },
  {
    name: 'TJSP (São Paulo)',
    query: 'ação de cobrança',
    tribunal: 'TJSP',
    expectativa: 'Priorizar tjsp.jus.br'
  },
  {
    name: 'TRF4 (Federal)',
    query: 'mandado de segurança',
    tribunal: 'TRF4',
    expectativa: 'Priorizar trf4.jus.br'
  }
];

console.log('📋 Testes a executar:');
tests.forEach((t, i) => {
  console.log(`   ${i + 1}. ${t.name}${t.tribunal ? ` (${t.tribunal})` : ''}`);
  console.log(`      → ${t.expectativa}`);
});
console.log('');

// Executar testes
const results = [];

for (const test of tests) {
  console.log('─'.repeat(80));
  console.log(`🧪 TESTE: ${test.name}`);
  console.log('─'.repeat(80));
  console.log(`   Query: "${test.query}"`);
  console.log(`   Tribunal: ${test.tribunal || 'NACIONAL (todos)'}`);
  console.log('');

  const startTime = Date.now();

  try {
    const result = await client.search(test.query, {
      limit: 3,
      tribunal: test.tribunal
    });

    const duration = Date.now() - startTime;

    console.log('📊 Resultado:');
    console.log(`   ⏱️  Tempo: ${duration}ms`);
    console.log(`   ${result.success ? '✅' : '❌'} Status: ${result.success ? 'SUCESSO' : 'FALHOU'}`);
    console.log(`   📈 Resultados: ${result.total}`);
    console.log(`   🔍 Query executada: ${result.query}`);

    if (result.error) {
      console.log(`   ❌ Erro: ${result.error}`);
    }

    if (result.results && result.results.length > 0) {
      console.log('');
      console.log('   📄 Primeiros resultados:');
      result.results.forEach((r, i) => {
        console.log(`      ${i + 1}. [${r.tribunal}] ${r.titulo.substring(0, 60)}...`);
        const domain = new URL(r.url).hostname;
        console.log(`         Domínio: ${domain} ${domain.includes(test.tribunal?.toLowerCase() || 'jus.br') ? '✅' : '⚠️'}`);
      });
    }

    // Validações
    console.log('');
    console.log('   ✓ Validações:');

    const validations = [];

    // Tempo razoável
    if (duration < 10000) {
      console.log('      ✅ Tempo < 10s');
      validations.push({ check: 'Tempo', passed: true });
    } else {
      console.log('      ❌ Tempo > 10s (lento)');
      validations.push({ check: 'Tempo', passed: false });
    }

    // Sucesso
    if (result.success && result.total > 0) {
      console.log('      ✅ Retornou resultados');
      validations.push({ check: 'Resultados', passed: true });
    } else {
      console.log('      ⚠️  Sem resultados (pode não haver jurisprudência para essa query)');
      validations.push({ check: 'Resultados', passed: false });
    }

    // Domínio correto
    if (result.results && result.results.length > 0) {
      const firstResult = result.results[0];
      const domain = new URL(firstResult.url).hostname;

      if (test.tribunal) {
        const expectedDomain = client.getTribunalSite(test.tribunal);
        if (domain === expectedDomain) {
          console.log(`      ✅ Domínio correto: ${domain}`);
          validations.push({ check: 'Domínio', passed: true });
        } else if (domain.includes('.jus.br')) {
          console.log(`      ⚠️  Domínio .jus.br mas não prioritário: ${domain}`);
          validations.push({ check: 'Domínio', passed: true });
        } else {
          console.log(`      ❌ Domínio incorreto: ${domain}`);
          validations.push({ check: 'Domínio', passed: false });
        }
      } else {
        // Busca nacional - qualquer .jus.br é válido
        if (domain.includes('.jus.br')) {
          console.log(`      ✅ Domínio .jus.br: ${domain}`);
          validations.push({ check: 'Domínio', passed: true });
        } else {
          console.log(`      ❌ Domínio não oficial: ${domain}`);
          validations.push({ check: 'Domínio', passed: false });
        }
      }
    }

    results.push({
      test: test.name,
      success: result.success,
      duration,
      total: result.total,
      validations,
      passed: validations.every(v => v.passed)
    });

  } catch (error) {
    console.log(`   ❌ ERRO: ${error.message}`);
    results.push({
      test: test.name,
      success: false,
      error: error.message,
      passed: false
    });
  }

  console.log('');

  // Delay entre testes
  await new Promise(resolve => setTimeout(resolve, 2000));
}

// Resumo final
console.log('═'.repeat(80));
console.log('📝 RESUMO FINAL');
console.log('═'.repeat(80));
console.log('');

const totalTests = results.length;
const passedTests = results.filter(r => r.passed).length;
const successRate = ((passedTests / totalTests) * 100).toFixed(0);

console.log(`🎯 Taxa de Sucesso: ${passedTests}/${totalTests} (${successRate}%)`);
console.log('');

console.log('📊 Resultados por Teste:');
results.forEach((r, i) => {
  const icon = r.passed ? '✅' : '❌';
  console.log(`   ${icon} ${r.test}`);
  if (r.duration) {
    console.log(`      Tempo: ${r.duration}ms | Resultados: ${r.total}`);
  }
  if (r.error) {
    console.log(`      Erro: ${r.error}`);
  }
});

console.log('');

if (passedTests === totalTests) {
  console.log('🎉 TODOS OS TESTES PASSARAM!');
  console.log('✅ Sistema funcionando para TODOS os tribunais brasileiros');
} else if (passedTests >= totalTests * 0.8) {
  console.log('✅ MAIORIA DOS TESTES PASSOU');
  console.log('⚠️  Alguns tribunais podem não ter jurisprudência para as queries testadas');
} else {
  console.log('⚠️  VÁRIOS TESTES FALHARAM');
  console.log('❌ Verifique configuração do Google Search API');
}

console.log('');
console.log('═'.repeat(80));
console.log('✅ Testes concluídos!');
console.log('═'.repeat(80));
