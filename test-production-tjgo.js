#!/usr/bin/env node
/**
 * Teste em Produção - Jurisprudência TJGO
 * Valida: queries Google, scraping, ementas completas
 */

import axios from 'axios';

const PRODUCTION_URL = 'https://iarom.com.br';
const TEST_QUERIES = [
  'usucapião extraordinário TJGO',
  'ITBI base de cálculo TJGO',
  'desapropriação indireta TJGO'
];

async function testJurisprudenceAPI(query) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🧪 TESTE: "${query}"`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${PRODUCTION_URL}/api/chat`,
      {
        message: `Pesquise jurisprudência: ${query}`,
        conversationId: `test-${Date.now()}`
      },
      {
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ROM-Agent-Test/1.0'
        }
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`⏱️  Tempo de resposta: ${duration}s`);
    console.log(`📊 Status: ${response.status}`);

    if (response.data) {
      const text = response.data.response || response.data.message || JSON.stringify(response.data);

      // Análise da resposta
      console.log('\n📋 ANÁLISE DA RESPOSTA:\n');

      // Verificar se há ementas completas
      const ementaCompletas = (text.match(/Ementa Completa/gi) || []).length;
      const ementaLength = text.length;

      console.log(`  ✓ Ementas Completas encontradas: ${ementaCompletas}`);
      console.log(`  ✓ Tamanho total da resposta: ${ementaLength} chars`);

      // Verificar menções ao TJGO
      const tjgoMentions = (text.match(/TJGO|Tribunal de Justiça de Goiás/gi) || []).length;
      console.log(`  ✓ Menções a TJGO: ${tjgoMentions}`);

      // Verificar se há snippets genéricos (sinal de problema)
      const hasGenericSnippets = text.includes('Com base nas buscas realizadas');
      console.log(`  ${hasGenericSnippets ? '❌' : '✓'} Resumo genérico: ${hasGenericSnippets ? 'SIM (PROBLEMA)' : 'NÃO (OK)'}`);

      // Verificar URLs de tribunais
      const tjgoUrls = (text.match(/tjgo\.jus\.br/gi) || []).length;
      console.log(`  ✓ URLs do TJGO: ${tjgoUrls}`);

      // Extrair trechos de ementas se houver
      const ementaSections = text.match(/Ementa:[\s\S]{0,300}/gi) || [];
      if (ementaSections.length > 0) {
        console.log('\n📝 PREVIEW DAS EMENTAS:\n');
        ementaSections.slice(0, 2).forEach((section, i) => {
          console.log(`  ${i + 1}. ${section.replace(/\n/g, ' ').substring(0, 200)}...`);
        });
      }

      // Verificar sinais de scraping bem-sucedido
      const scrapedIndicators = [
        text.includes('scraped: true'),
        text.includes('ementaCompleta'),
        ementaLength > 5000
      ];
      const scrapingSuccess = scrapedIndicators.filter(Boolean).length;
      console.log(`\n🔍 INDICADORES DE SCRAPING: ${scrapingSuccess}/3`);

      // Resultado final
      console.log('\n═══════════════════════════════════════════════════════');
      if (ementaCompletas >= 3 && tjgoMentions >= 3 && !hasGenericSnippets) {
        console.log('✅ TESTE PASSOU - Ementas completas do TJGO encontradas');
      } else if (ementaCompletas >= 1) {
        console.log('⚠️  TESTE PARCIAL - Algumas ementas encontradas, mas pode melhorar');
      } else {
        console.log('❌ TESTE FALHOU - Não há ementas completas do TJGO');
      }
      console.log('═══════════════════════════════════════════════════════');

      return {
        success: ementaCompletas >= 3,
        ementasCount: ementaCompletas,
        tjgoMentions,
        duration: parseFloat(duration)
      };
    }

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`❌ ERRO após ${duration}s:`);
    console.log(`  Status: ${error.response?.status || 'N/A'}`);
    console.log(`  Mensagem: ${error.message}`);

    if (error.response?.data) {
      console.log(`  Detalhes: ${JSON.stringify(error.response.data).substring(0, 300)}`);
    }

    return {
      success: false,
      error: error.message,
      duration: parseFloat(duration)
    };
  }
}

async function runAllTests() {
  console.log('🚀 INICIANDO TESTES DE PRODUÇÃO - TJGO JURISPRUDÊNCIA');
  console.log(`🌐 Servidor: ${PRODUCTION_URL}`);
  console.log(`📅 Data: ${new Date().toISOString()}`);

  const results = [];

  for (const query of TEST_QUERIES) {
    const result = await testJurisprudenceAPI(query);
    results.push({ query, ...result });

    // Aguardar 5s entre testes para não sobrecarregar
    if (TEST_QUERIES.indexOf(query) < TEST_QUERIES.length - 1) {
      console.log('\n⏳ Aguardando 5s antes do próximo teste...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Resumo final
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║           RESUMO DOS TESTES DE PRODUÇÃO              ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  const successful = results.filter(r => r.success).length;
  const avgDuration = (results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length).toFixed(2);
  const totalEmentas = results.reduce((sum, r) => sum + (r.ementasCount || 0), 0);

  console.log(`✅ Testes bem-sucedidos: ${successful}/${results.length}`);
  console.log(`⏱️  Tempo médio de resposta: ${avgDuration}s`);
  console.log(`📊 Total de ementas encontradas: ${totalEmentas}`);

  console.log('\n📋 DETALHES POR TESTE:\n');
  results.forEach((r, i) => {
    const status = r.success ? '✅' : (r.ementasCount > 0 ? '⚠️ ' : '❌');
    console.log(`  ${i + 1}. ${status} "${r.query}"`);
    console.log(`     - Ementas: ${r.ementasCount || 0}`);
    console.log(`     - TJGO menções: ${r.tjgoMentions || 0}`);
    console.log(`     - Duração: ${r.duration || 0}s`);
  });

  console.log('\n');

  if (successful === results.length) {
    console.log('🎉 TODOS OS TESTES PASSARAM! Sistema funcionando perfeitamente.');
    process.exit(0);
  } else if (successful > 0) {
    console.log('⚠️  TESTES PARCIAIS - Alguns testes falharam. Verificar logs do Render.');
    process.exit(1);
  } else {
    console.log('❌ TODOS OS TESTES FALHARAM - Sistema não está funcionando corretamente.');
    process.exit(2);
  }
}

// Executar testes
runAllTests().catch(error => {
  console.error('💥 ERRO FATAL:', error);
  process.exit(3);
});
