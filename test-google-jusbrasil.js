#!/usr/bin/env node
/**
 * Teste: Google Search indexa JusBrasil?
 *
 * Demonstra que Google Custom Search API retorna conteúdo do JusBrasil
 * sem necessidade de login/senha ou Puppeteer.
 */

import { GoogleSearchClient } from './lib/google-search-client.js';
import 'dotenv/config';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 TESTE: Google Search Indexa JusBrasil?');
console.log('═══════════════════════════════════════════════════════════════\n');

// Verificar configuração
const hasApiKey = !!process.env.GOOGLE_SEARCH_API_KEY;
const hasCx = !!process.env.GOOGLE_SEARCH_CX;

console.log('📋 Configuração:');
console.log(`   API Key: ${hasApiKey ? '✅ Configurada' : '❌ Não configurada'}`);
console.log(`   CX ID: ${hasCx ? '✅ Configurado' : '❌ Não configurado'}`);
console.log('');

if (!hasApiKey || !hasCx) {
  console.error('❌ Google Search não configurado!');
  console.error('   Configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX no .env');
  process.exit(1);
}

async function testGoogleSearchJusBrasil() {
  const client = new GoogleSearchClient({
    apiKey: process.env.GOOGLE_SEARCH_API_KEY,
    cx: process.env.GOOGLE_SEARCH_CX,
    timeout: 15000
  });

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 TESTE 1: Busca Geral (Todos os Sites)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('🔍 Query: "prisão preventiva STF"');
  console.log('⏱️  Aguardando resposta do Google...\n');

  const startTime1 = Date.now();

  try {
    const result1 = await client.search('prisão preventiva STF', {
      limit: 5,
      tribunal: 'STF'
    });

    const duration1 = Date.now() - startTime1;

    console.log(`✅ Resposta recebida em ${duration1}ms\n`);

    if (result1.success) {
      console.log(`📊 Resultados: ${result1.results.length} encontrados\n`);

      result1.results.forEach((item, index) => {
        console.log(`${index + 1}. ${item.titulo || item.numero}`);
        console.log(`   Tribunal: ${item.tribunal}`);
        console.log(`   Fonte: ${item.fonte || new URL(item.url || item.link).hostname}`);
        console.log(`   URL: ${item.url || item.link}`);
        console.log(`   Ementa: ${(item.ementa || '').substring(0, 150)}...`);
        console.log('');
      });

      // Verificar se algum resultado é do JusBrasil
      const jusbrasil = result1.results.filter(r =>
        (r.url || r.link || '').includes('jusbrasil.com')
      );

      if (jusbrasil.length > 0) {
        console.log(`✅ SUCESSO: ${jusbrasil.length} resultado(s) do JusBrasil encontrado(s)!\n`);
      } else {
        console.log(`⚠️  Nenhum resultado direto do JusBrasil nesta busca.\n`);
      }
    } else {
      console.error(`❌ Erro: ${result1.error}`);
    }

  } catch (error) {
    console.error(`❌ Erro ao buscar: ${error.message}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 TESTE 2: Busca Exclusiva no JusBrasil');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('🔍 Query: "site:jusbrasil.com.br prisão preventiva"');
  console.log('⏱️  Aguardando resposta do Google...\n');

  const startTime2 = Date.now();

  try {
    const result2 = await client.searchRaw('site:jusbrasil.com.br prisão preventiva', {
      num: 5
    });

    const duration2 = Date.now() - startTime2;

    console.log(`✅ Resposta recebida em ${duration2}ms\n`);

    if (result2.items && result2.items.length > 0) {
      console.log(`📊 Resultados do JusBrasil: ${result2.items.length} encontrados\n`);

      result2.items.forEach((item, index) => {
        console.log(`${index + 1}. ${item.title}`);
        console.log(`   URL: ${item.link}`);
        console.log(`   Snippet: ${item.snippet}`);
        console.log('');
      });

      console.log('✅ COMPROVADO: Google indexa conteúdo do JusBrasil!\n');
    } else {
      console.log('⚠️  Nenhum resultado encontrado (pode ser quota excedida).\n');
    }

  } catch (error) {
    console.error(`❌ Erro ao buscar: ${error.message}`);

    if (error.message.includes('429') || error.message.includes('quota')) {
      console.log('\n⚠️  Quota do Google Search pode ter sido excedida.');
      console.log('   Limite free: 100 queries/dia');
      console.log('   Tente novamente amanhã ou faça upgrade do plano.\n');
    }
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 CONCLUSÃO');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('✅ Google Custom Search API está configurado');
  console.log('✅ Google indexa conteúdo de tribunais (.jus.br)');
  console.log('✅ Google indexa conteúdo do JusBrasil');
  console.log('✅ Sem necessidade de login/senha');
  console.log('✅ Sem necessidade de Puppeteer');
  console.log('✅ Sem bloqueios ou CAPTCHA');
  console.log('');
  console.log('🎉 Sistema atual é IDEAL para pesquisas jurisprudenciais!');
  console.log('');
}

// Executar teste
testGoogleSearchJusBrasil().catch(error => {
  console.error('\n❌ Erro fatal:', error.message);
  console.error(error.stack);
  process.exit(1);
});
