#!/usr/bin/env node
/**
 * Script de Teste DIRETO - Google Custom Search API
 *
 * Testa a API do Google diretamente sem depender do .env
 *
 * Uso:
 *   node scripts/test-google-search-direct.js API_KEY CX_ID
 *   node scripts/test-google-search-direct.js API_KEY CX_ID "termo de busca"
 *
 * Exemplo:
 *   node scripts/test-google-search-direct.js AIzaSy... 012345:abc "ITBI imunidade"
 */

import axios from 'axios';

const RESET = '\x1b[0m';
const BRIGHT = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';

async function testGoogleSearchDirect() {
  console.log(`${BRIGHT}${BLUE}
╔════════════════════════════════════════════════════════════════╗
║      TESTE DIRETO - GOOGLE CUSTOM SEARCH API                   ║
║               IAROM v2.7.4                                     ║
╚════════════════════════════════════════════════════════════════╝
${RESET}`);

  // Parse argumentos
  const apiKey = process.argv[2];
  const cx = process.argv[3];
  const query = process.argv[4] || "ITBI integralização capital social";

  if (!apiKey || !cx) {
    console.log(`${RED}${BRIGHT}ERRO:${RESET} Credenciais não fornecidas!\n`);
    console.log(`${BRIGHT}Uso:${RESET}`);
    console.log(`  node scripts/test-google-search-direct.js API_KEY CX_ID ["termo de busca"]\n`);
    console.log(`${BRIGHT}Exemplo:${RESET}`);
    console.log(`  node scripts/test-google-search-direct.js AIzaSy... 012345:abc "ITBI imunidade"\n`);
    console.log(`${BRIGHT}Obter credenciais:${RESET}`);
    console.log(`  1. API Key: https://console.cloud.google.com/apis/credentials`);
    console.log(`  2. CX ID: https://programmablesearchengine.google.com/\n`);
    process.exit(1);
  }

  // Mostrar configuração
  console.log(`\n${BRIGHT}[1/4] Configuração${RESET}`);
  console.log(`─────────────────────────────────────`);
  console.log(`API Key: ${apiKey.substring(0, 20)}...`);
  console.log(`CX ID:   ${cx.substring(0, 20)}...`);
  console.log(`Query:   ${CYAN}"${query}"${RESET}`);

  // Teste 1: Busca básica (sem site:)
  console.log(`\n${BRIGHT}[2/4] Teste 1 - Busca Básica (sem filtros)${RESET}`);
  console.log(`─────────────────────────────────────`);

  const searchQuery1 = `jurisprudência ${query}`;
  console.log(`Query enviada: ${CYAN}"${searchQuery1}"${RESET}`);

  let result1;
  const start1 = Date.now();

  try {
    const response1 = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: apiKey,
        cx: cx,
        q: searchQuery1,
        num: 10,
        lr: 'lang_pt',
        safe: 'off'
      },
      timeout: 15000
    });

    result1 = response1.data;
    const elapsed1 = Date.now() - start1;

    console.log(`${GREEN}✓ Sucesso${RESET} (${elapsed1}ms)`);
    console.log(`Total estimado: ${result1.searchInformation?.totalResults || 0}`);
    console.log(`Resultados:     ${result1.items?.length || 0}`);
    console.log(`Tempo Google:   ${result1.searchInformation?.searchTime || 0}s`);

    if (result1.items && result1.items.length > 0) {
      console.log(`\nPrimeiros 3 resultados:`);
      result1.items.slice(0, 3).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.title}`);
        console.log(`     ${CYAN}${item.link}${RESET}`);
      });
    }
  } catch (error) {
    const elapsed1 = Date.now() - start1;
    console.log(`${RED}✗ Erro${RESET} (${elapsed1}ms)`);
    console.log(`Mensagem: ${error.message}`);

    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Erro API:`, JSON.stringify(error.response.data, null, 2));

      if (error.response.status === 429) {
        console.log(`\n${YELLOW}⚠️  QUOTA EXCEDIDA${RESET}`);
        console.log(`Limite: 100 queries/dia (free tier)`);
        console.log(`Solução: Aguarde até meia-noite ou ative faturamento`);
      } else if (error.response.status === 403 || error.response.status === 401) {
        console.log(`\n${RED}⚠️  CREDENCIAIS INVÁLIDAS${RESET}`);
        console.log(`Verifique:`);
        console.log(`  • API Key está correta?`);
        console.log(`  • Custom Search API está habilitada?`);
        console.log(`  • CX ID está correto?`);
      }
    }
  }

  // Teste 2: Busca com site:jus.br
  console.log(`\n${BRIGHT}[3/4] Teste 2 - Busca com site:jus.br${RESET}`);
  console.log(`─────────────────────────────────────`);

  const searchQuery2 = `jurisprudência ${query} site:jus.br`;
  console.log(`Query enviada: ${CYAN}"${searchQuery2}"${RESET}`);

  let result2;
  const start2 = Date.now();

  try {
    const response2 = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: apiKey,
        cx: cx,
        q: searchQuery2,
        num: 10,
        lr: 'lang_pt',
        safe: 'off'
      },
      timeout: 15000
    });

    result2 = response2.data;
    const elapsed2 = Date.now() - start2;

    console.log(`${GREEN}✓ Sucesso${RESET} (${elapsed2}ms)`);
    console.log(`Total estimado: ${result2.searchInformation?.totalResults || 0}`);
    console.log(`Resultados:     ${result2.items?.length || 0}`);

    if (result2.items && result2.items.length > 0) {
      console.log(`\nPrimeiros 3 resultados:`);
      result2.items.slice(0, 3).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.title}`);
        console.log(`     ${CYAN}${item.link}${RESET}`);
      });
    }
  } catch (error) {
    const elapsed2 = Date.now() - start2;
    console.log(`${RED}✗ Erro${RESET} (${elapsed2}ms)`);
    console.log(`Mensagem: ${error.message}`);
  }

  // Teste 3: Busca com múltiplos sites (query restritiva)
  console.log(`\n${BRIGHT}[4/4] Teste 3 - Busca Restritiva (múltiplos site:)${RESET}`);
  console.log(`─────────────────────────────────────`);

  const sites = ['stf.jus.br', 'stj.jus.br', 'tst.jus.br'];
  const siteOperator = sites.map(s => `site:${s}`).join(' OR ');
  const searchQuery3 = `jurisprudência ${query} (${siteOperator})`;
  console.log(`Query enviada: ${CYAN}"${searchQuery3}"${RESET}`);

  let result3;
  const start3 = Date.now();

  try {
    const response3 = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: apiKey,
        cx: cx,
        q: searchQuery3,
        num: 10,
        lr: 'lang_pt',
        safe: 'off'
      },
      timeout: 15000
    });

    result3 = response3.data;
    const elapsed3 = Date.now() - start3;

    console.log(`${GREEN}✓ Sucesso${RESET} (${elapsed3}ms)`);
    console.log(`Total estimado: ${result3.searchInformation?.totalResults || 0}`);
    console.log(`Resultados:     ${result3.items?.length || 0}`);

    if (result3.items && result3.items.length > 0) {
      console.log(`\nPrimeiros 3 resultados:`);
      result3.items.slice(0, 3).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.title}`);
        console.log(`     ${CYAN}${item.link}${RESET}`);
      });
    }
  } catch (error) {
    const elapsed3 = Date.now() - start3;
    console.log(`${RED}✗ Erro${RESET} (${elapsed3}ms)`);
    console.log(`Mensagem: ${error.message}`);
  }

  // Resumo final
  console.log(`\n${BRIGHT}${GREEN}
╔════════════════════════════════════════════════════════════════╗
║                  RESUMO DOS TESTES                             ║
╚════════════════════════════════════════════════════════════════╝
${RESET}`);

  const tests = [
    { name: 'Busca básica', result: result1 },
    { name: 'Com site:jus.br', result: result2 },
    { name: 'Sites específicos', result: result3 }
  ];

  tests.forEach((test, i) => {
    const status = test.result?.items?.length > 0 ? `${GREEN}✓ ${test.result.items.length} resultados${RESET}` :
                   test.result ? `${YELLOW}⚠ 0 resultados${RESET}` : `${RED}✗ Erro${RESET}`;
    console.log(`  ${i + 1}. ${test.name.padEnd(20)} ${status}`);
  });

  console.log(`\n${BRIGHT}Conclusão:${RESET}`);

  const anySuccess = tests.some(t => t.result?.items?.length > 0);

  if (anySuccess) {
    console.log(`${GREEN}✓ Google Search API está funcionando!${RESET}`);
    console.log(`\nA busca restritiva (múltiplos site:) pode retornar menos resultados.`);
    console.log(`O sistema de fallback do IAROM resolve isso automaticamente.\n`);
  } else {
    console.log(`${YELLOW}⚠️  Todos os testes retornaram 0 resultados${RESET}`);
    console.log(`\nPossíveis causas:`);
    console.log(`  • Custom Search Engine configurado para sites muito específicos`);
    console.log(`  • Termo de busca muito raro`);
    console.log(`  • Quota da API excedida`);
    console.log(`\nSolução:`);
    console.log(`  1. Teste com outros termos: "STF tributário"`);
    console.log(`  2. Verifique configuração do Custom Search Engine`);
    console.log(`  3. Confira quota em: https://console.cloud.google.com/\n`);
  }
}

// Executar teste
testGoogleSearchDirect().catch(error => {
  console.error(`\n${RED}${BRIGHT}ERRO FATAL:${RESET}`, error);
  process.exit(1);
});
