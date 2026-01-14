#!/usr/bin/env node
/**
 * Debug Jurisprudência em Produção
 *
 * Simula exatamente a chamada que o Bedrock faz via tool use
 */

import 'dotenv/config';
import { executeTool } from './src/modules/bedrock-tools.js';

async function debugProduction() {
  console.log('🔍 DEBUG: Simulando chamada de jurisprudência em produção\n');
  console.log('═'.repeat(80));

  try {
    console.log('\n📡 Executando tool: pesquisar_jurisprudencia');
    console.log('   Termo: "habeas corpus violação domicílio"');
    console.log('   Tribunal: TJGO');
    console.log('   Limite: 2\n');

    const startTime = Date.now();

    const result = await executeTool('pesquisar_jurisprudencia', {
      termo: 'habeas corpus violação domicílio',
      tribunal: 'TJGO',
      limite: 2
    });

    const duration = Date.now() - startTime;

    console.log('═'.repeat(80));
    console.log(`\n✅ Resultado obtido em ${duration}ms\n`);

    console.log('TIPO DE RESULTADO:', typeof result);

    // Extrair conteúdo do resultado
    const content = result?.content || JSON.stringify(result);
    console.log('TAMANHO:', content.length || 0, 'bytes\n');

    console.log('═'.repeat(80));
    console.log('\n📄 PREVIEW DO RESULTADO (primeiros 2000 chars):\n');
    console.log(content.substring(0, 2000) || 'VAZIO');
    console.log('\n...');

    // Análise crítica
    console.log('\n' + '═'.repeat(80));
    console.log('🔬 ANÁLISE CRÍTICA:\n');

    const hasEmentaCompleta = content.includes('Ementa Completa') || content.includes('ementaCompleta');
    const hasTese = content.includes('Tese Central') || content.includes('teseJuridica');
    const hasFundamentos = content.includes('Fundamentos Legais') || content.includes('fundamentosLegais');
    const hasAnalise = content.includes('Análise Semântica') || content.includes('DIFERENCIAL ROM AGENT');
    const hasGenericWarning = content.includes('apenas títulos') || content.includes('sem ementa específica');

    console.log(`✅ Tem "Ementa completa": ${hasEmentaCompleta ? 'SIM' : 'NÃO'}`);
    console.log(`✅ Tem "Tese jurídica": ${hasTese ? 'SIM' : 'NÃO'}`);
    console.log(`✅ Tem "Fundamentos": ${hasFundamentos ? 'SIM' : 'NÃO'}`);
    console.log(`✅ Tem "Análise semântica": ${hasAnalise ? 'SIM' : 'NÃO'}`);
    console.log(`❌ Tem aviso genérico: ${hasGenericWarning ? 'SIM (PROBLEMA!)' : 'NÃO'}`);

    console.log('\n' + '═'.repeat(80));

    if (hasEmentaCompleta && hasTese && hasFundamentos) {
      console.log('🎉 PIPELINE FUNCIONANDO - Ementas completas + análise semântica!');
      process.exit(0);
    } else if (hasGenericWarning) {
      console.log('❌ PROBLEMA: Retornando apenas títulos genéricos');
      console.log('   Pipeline de enrichment NÃO está sendo executado!');
      console.log('\n🔍 POSSÍVEIS CAUSAS:');
      console.log('   1. enrichWithCompleteEmentas() falhando silenciosamente');
      console.log('   2. Import dinâmico de scraper/analyzer falhando');
      console.log('   3. Dependências não instaladas no Render');
      console.log('   4. Erro capturado mas não logado');
      process.exit(1);
    } else {
      console.log('⚠️  RESULTADO INCONCLUSIVO - Verificar formato');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n' + '═'.repeat(80));
    console.error('❌ ERRO NA EXECUÇÃO:\n');
    console.error(error);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.error('\n' + '═'.repeat(80));
    process.exit(1);
  }
}

debugProduction();
