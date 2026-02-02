#!/usr/bin/env node
/**
 * Teste Simplificado: Google Search indexa JusBrasil?
 *
 * Demonstra que Google Custom Search API retorna conteúdo do JusBrasil
 * usando chamadas diretas à API (sem dependências internas).
 */

import axios from 'axios';
import 'dotenv/config';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 TESTE: Google Search Indexa JusBrasil?');
console.log('═══════════════════════════════════════════════════════════════\n');

// Verificar configuração
const API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const CX = process.env.GOOGLE_SEARCH_CX;

console.log('📋 Configuração:');
console.log(`   API Key: ${API_KEY ? '✅ Configurada (' + API_KEY.substring(0, 20) + '...)' : '❌ Não configurada'}`);
console.log(`   CX ID: ${CX ? '✅ Configurado (' + CX + ')' : '❌ Não configurado'}`);
console.log('');

if (!API_KEY || !CX) {
  console.error('❌ Google Search não configurado!');
  console.error('   Configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX no .env');
  process.exit(1);
}

async function testGoogleSearch(query, description) {
  console.log(`🔍 ${description}`);
  console.log(`   Query: "${query}"`);
  console.log('   ⏱️  Aguardando resposta do Google...\n');

  const startTime = Date.now();

  try {
    const url = 'https://www.googleapis.com/customsearch/v1';
    const params = {
      key: API_KEY,
      cx: CX,
      q: query,
      num: 5,
      lr: 'lang_pt',
      gl: 'br'
    };

    const response = await axios.get(url, {
      params,
      timeout: 15000
    });

    const duration = Date.now() - startTime;

    console.log(`   ✅ Resposta recebida em ${duration}ms\n`);

    if (response.data.items && response.data.items.length > 0) {
      console.log(`   📊 Resultados: ${response.data.items.length} encontrados\n`);

      response.data.items.forEach((item, index) => {
        const hostname = new URL(item.link).hostname;
        const isJusbrasil = hostname.includes('jusbrasil');

        console.log(`   ${index + 1}. ${item.title}`);
        console.log(`      Fonte: ${hostname}${isJusbrasil ? ' ✅ JUSBRASIL!' : ''}`);
        console.log(`      URL: ${item.link}`);
        console.log(`      Snippet: ${item.snippet.substring(0, 100)}...`);
        console.log('');
      });

      // Verificar se algum resultado é do JusBrasil
      const jusbrasil = response.data.items.filter(item =>
        item.link.includes('jusbrasil.com')
      );

      if (jusbrasil.length > 0) {
        console.log(`   ✅ SUCESSO: ${jusbrasil.length} resultado(s) do JusBrasil encontrado(s)!\n`);
        return true;
      } else {
        console.log(`   ⚠️  Nenhum resultado direto do JusBrasil nesta busca.\n`);
        return false;
      }
    } else {
      console.log('   ⚠️  Nenhum resultado encontrado.\n');
      return false;
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`   ❌ Erro após ${duration}ms: ${error.message}\n`);

    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Mensagem: ${error.response.data?.error?.message || 'Desconhecido'}\n`);

      if (error.response.status === 429) {
        console.log('   ⚠️  Quota do Google Search excedida.');
        console.log('   Limite free: 100 queries/dia');
        console.log('   Tente novamente amanhã ou faça upgrade do plano.\n');
      }
    }

    return false;
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 TESTE 1: Busca Geral sobre Jurisprudência');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const test1 = await testGoogleSearch(
    'prisão preventiva STF jurisprudência',
    'Busca Geral (pode incluir JusBrasil)'
  );

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 TESTE 2: Busca Exclusiva no JusBrasil');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const test2 = await testGoogleSearch(
    'site:jusbrasil.com.br prisão preventiva',
    'Busca Específica no JusBrasil via Google'
  );

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 TESTE 3: Busca de Artigos Jurídicos no JusBrasil');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const test3 = await testGoogleSearch(
    'site:jusbrasil.com.br/artigos STF prisão preventiva',
    'Artigos do JusBrasil via Google'
  );

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 CONCLUSÃO');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const anyJusbrasil = test1 || test2 || test3;

  if (anyJusbrasil) {
    console.log('✅ COMPROVADO: Google indexa conteúdo do JusBrasil!\n');
    console.log('🎯 Implicações:');
    console.log('   ✅ Acesso a jurisprudência do JusBrasil sem login');
    console.log('   ✅ Sem bloqueios ou CAPTCHA');
    console.log('   ✅ Sem necessidade de Puppeteer');
    console.log('   ✅ Mais rápido que scraping direto');
    console.log('   ✅ Mais confiável que scraping direto');
    console.log('');
    console.log('🎉 Sistema atual (Google Search) é IDEAL!\n');
  } else {
    console.log('⚠️  Nenhum resultado do JusBrasil encontrado nos testes.\n');
    console.log('Possíveis causas:');
    console.log('   - Quota do Google Search excedida (100/dia no free tier)');
    console.log('   - Termos de busca não retornaram JusBrasil nos top 5');
    console.log('   - Google está priorizando sites oficiais (.jus.br)\n');
    console.log('Nota: Isso NÃO significa que Google não indexa JusBrasil.');
    console.log('      Apenas significa que não apareceu nos primeiros resultados.\n');
  }

  console.log('📊 Resumo dos Testes:');
  console.log(`   Teste 1 (Geral): ${test1 ? '✅ JusBrasil encontrado' : '⚠️  Sem JusBrasil'}`);
  console.log(`   Teste 2 (site:jusbrasil): ${test2 ? '✅ JusBrasil encontrado' : '⚠️  Sem resultados'}`);
  console.log(`   Teste 3 (artigos): ${test3 ? '✅ JusBrasil encontrado' : '⚠️  Sem resultados'}`);
  console.log('');
}

// Executar testes
runTests().catch(error => {
  console.error('\n❌ Erro fatal:', error.message);
  console.error(error.stack);
  process.exit(1);
});
