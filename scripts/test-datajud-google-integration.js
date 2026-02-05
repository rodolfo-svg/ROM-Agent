#!/usr/bin/env node
/**
 * Script de Teste - DataJud + Google Search Integration
 * Testa se as ferramentas estão funcionando adequadamente
 */

import 'dotenv/config';
import { GoogleSearchClient } from '../lib/google-search-client.js';
import datajudService from '../src/services/datajud-service.js';

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 TESTE DE INTEGRAÇÃO - DataJud + Google Search');
console.log('═══════════════════════════════════════════════════════════\n');

// ============================================================
// 1. VERIFICAR CONFIGURAÇÃO DAS ENVs
// ============================================================

console.log('📋 1. VERIFICANDO VARIÁVEIS DE AMBIENTE\n');

const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
const googleCx = process.env.GOOGLE_SEARCH_CX;
const googleEnabled = process.env.GOOGLE_SEARCH_ENABLED;

const datajudKey = process.env.DATAJUD_API_KEY || process.env.CNJ_DATAJUD_API_KEY || process.env.DATAJUD_API_TOKEN;
const datajudEnabled = process.env.DATAJUD_ENABLED;
const datajudBaseUrl = process.env.DATAJUD_BASE_URL;

console.log('Google Search:');
console.log(`  API Key: ${googleApiKey ? '✅ Configurada (' + googleApiKey.substring(0, 10) + '...)' : '❌ NÃO CONFIGURADA'}`);
console.log(`  CX: ${googleCx ? '✅ Configurado (' + googleCx + ')' : '❌ NÃO CONFIGURADO'}`);
console.log(`  Enabled: ${googleEnabled === 'true' ? '✅ Habilitado' : '⚠️ Desabilitado ou não configurado'}`);

console.log('\nDataJud CNJ:');
console.log(`  API Key: ${datajudKey ? '✅ Configurada (' + datajudKey.substring(0, 20) + '...)' : '❌ NÃO CONFIGURADA'}`);
console.log(`  Enabled: ${datajudEnabled === 'true' ? '✅ Habilitado' : '⚠️ Desabilitado ou não configurado'}`);
console.log(`  Base URL: ${datajudBaseUrl || '❌ NÃO CONFIGURADA'}`);

console.log('\n───────────────────────────────────────────────────────────\n');

// ============================================================
// 2. TESTAR GOOGLE SEARCH
// ============================================================

console.log('🔍 2. TESTANDO GOOGLE SEARCH\n');

const googleClient = new GoogleSearchClient({
  apiKey: googleApiKey,
  cx: googleCx
});

if (!googleClient.isConfigured()) {
  console.log('❌ Google Search NÃO CONFIGURADO');
  console.log('   Configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX no Render\n');
} else {
  console.log('✅ Google Search client configurado');
  console.log('   Testando busca de jurisprudência...\n');

  try {
    const resultado = await googleClient.search('LGPD proteção de dados', {
      limit: 3,
      tribunal: 'STJ'
    });

    if (resultado.success) {
      console.log(`✅ GOOGLE SEARCH FUNCIONANDO`);
      console.log(`   Total de resultados: ${resultado.total}`);
      console.log(`   Query: ${resultado.query}`);

      if (resultado.results && resultado.results.length > 0) {
        console.log(`\n   Primeiros resultados:`);
        resultado.results.slice(0, 2).forEach((r, i) => {
          console.log(`   ${i+1}. ${r.titulo}`);
          console.log(`      Tribunal: ${r.tribunal}`);
          console.log(`      URL: ${r.url}`);
        });
      }
    } else {
      console.log(`❌ GOOGLE SEARCH FALHOU`);
      console.log(`   Erro: ${resultado.error}`);

      if (resultado.quotaExceeded) {
        console.log('   ⚠️ QUOTA EXCEDIDA - Verifique limites da API no Google Cloud Console');
      }
      if (resultado.authError) {
        console.log('   ⚠️ ERRO DE AUTENTICAÇÃO - Verifique se API Key está correta');
      }
    }
  } catch (error) {
    console.log(`❌ ERRO NO TESTE DO GOOGLE SEARCH`);
    console.log(`   ${error.message}`);
  }
}

console.log('\n───────────────────────────────────────────────────────────\n');

// ============================================================
// 3. TESTAR DATAJUD
// ============================================================

console.log('🏛️ 3. TESTANDO DATAJUD CNJ\n');

if (!datajudKey) {
  console.log('❌ DataJud NÃO CONFIGURADO');
  console.log('   Configure DATAJUD_API_KEY no Render\n');
} else {
  console.log('✅ DataJud API Key configurada');
  console.log('   Testando busca de decisões...\n');

  try {
    const resultado = await datajudService.buscarDecisoes({
      termo: 'LGPD',
      tribunal: 'STJ',
      limit: 3
    });

    if (resultado.erro) {
      console.log(`❌ DATAJUD FALHOU`);
      console.log(`   Erro: ${resultado.mensagem}`);

      if (resultado.fallbackUsed) {
        console.log('   ℹ️ Fallback para Google Search foi usado');
        console.log(`   Total de resultados (via fallback): ${resultado.totalEncontrado}`);
      }
    } else {
      console.log(`✅ DATAJUD FUNCIONANDO`);
      console.log(`   Fonte: ${resultado.fonte}`);
      console.log(`   Total de resultados: ${resultado.totalEncontrado}`);

      if (resultado.decisoes && resultado.decisoes.length > 0) {
        console.log(`\n   Primeiras decisões:`);
        resultado.decisoes.slice(0, 2).forEach((d, i) => {
          console.log(`   ${i+1}. ${d.numero || 'S/N'}`);
          console.log(`      Tribunal: ${d.tribunal}`);
          console.log(`      Ementa: ${d.ementa ? d.ementa.substring(0, 100) + '...' : 'N/A'}`);
        });
      }

      if (resultado.fallbackUsed) {
        console.log('\n   ⚠️ NOTA: DataJud API falhou, mas fallback Google Search funcionou');
      }
    }
  } catch (error) {
    console.log(`❌ ERRO NO TESTE DO DATAJUD`);
    console.log(`   ${error.message}`);
  }
}

console.log('\n───────────────────────────────────────────────────────────\n');

// ============================================================
// 4. RESUMO E DIAGNÓSTICO
// ============================================================

console.log('📊 4. RESUMO E DIAGNÓSTICO\n');

const googleOk = googleClient.isConfigured();
const datajudOk = !!datajudKey;

if (googleOk && datajudOk) {
  console.log('✅ CONFIGURAÇÃO COMPLETA');
  console.log('   Ambos os serviços estão configurados.');
  console.log('   Se houver problemas, verifique:');
  console.log('   1. Quotas da API do Google (100 buscas/dia no plano free)');
  console.log('   2. Validade do token DataJud');
  console.log('   3. Firewall/Network do Render bloqueando APIs externas');
} else if (googleOk && !datajudOk) {
  console.log('⚠️ CONFIGURAÇÃO PARCIAL');
  console.log('   ✅ Google Search configurado');
  console.log('   ❌ DataJud NÃO configurado');
  console.log('\n   AÇÃO: Configure DATAJUD_API_KEY no Render');
  console.log('   Como obter: https://datajud-wiki.cnj.jus.br/');
} else if (!googleOk && datajudOk) {
  console.log('⚠️ CONFIGURAÇÃO PARCIAL');
  console.log('   ❌ Google Search NÃO configurado');
  console.log('   ✅ DataJud configurado');
  console.log('\n   AÇÃO: Configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX no Render');
  console.log('   Como obter:');
  console.log('   1. https://console.cloud.google.com/apis/credentials (API Key)');
  console.log('   2. https://programmablesearchengine.google.com/ (CX)');
} else {
  console.log('❌ CONFIGURAÇÃO INCOMPLETA');
  console.log('   Nenhum dos serviços está configurado.');
  console.log('\n   AÇÃO IMEDIATA: Configure as ENVs no Render:');
  console.log('   - GOOGLE_SEARCH_API_KEY');
  console.log('   - GOOGLE_SEARCH_CX');
  console.log('   - DATAJUD_API_KEY');
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('Teste concluído');
console.log('═══════════════════════════════════════════════════════════\n');

process.exit(0);
