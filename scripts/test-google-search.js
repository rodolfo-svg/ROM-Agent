#!/usr/bin/env node
/**
 * Script de Teste - Google Custom Search API
 *
 * Testa o sistema de busca de jurisprudência com fallback inteligente
 *
 * Uso:
 *   node scripts/test-google-search.js
 *   node scripts/test-google-search.js "ITBI integralização capital social"
 */

import 'dotenv/config';
import { GoogleSearchClient } from '../lib/google-search-client.js';

const RESET = '\x1b[0m';
const BRIGHT = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';

async function testGoogleSearch() {
  console.log(`${BRIGHT}${BLUE}
╔════════════════════════════════════════════════════════════════╗
║           TESTE - GOOGLE CUSTOM SEARCH API                     ║
║                  IAROM v2.7.4                                  ║
╚════════════════════════════════════════════════════════════════╝
${RESET}`);

  // 1. Verificar configuração
  console.log(`\n${BRIGHT}[1/5] Verificando Configuração${RESET}`);
  console.log(`─────────────────────────────────────`);

  const client = new GoogleSearchClient();
  const isConfigured = client.isConfigured();

  console.log(`API Key: ${client.apiKey ? `${GREEN}✓${RESET} ${client.apiKey.substring(0, 20)}...` : `${RED}✗ Não configurada${RESET}`}`);
  console.log(`CX ID:   ${client.cx ? `${GREEN}✓${RESET} ${client.cx.substring(0, 20)}...` : `${RED}✗ Não configurado${RESET}`}`);
  console.log(`Status:  ${isConfigured ? `${GREEN}✓ CONFIGURADO${RESET}` : `${RED}✗ NÃO CONFIGURADO${RESET}`}`);

  if (!isConfigured) {
    console.log(`\n${RED}${BRIGHT}ERRO:${RESET} Google Search não configurado!`);
    console.log(`\nConfigure as variáveis no .env:`);
    console.log(`  GOOGLE_SEARCH_API_KEY=sua-api-key`);
    console.log(`  GOOGLE_SEARCH_CX=seu-cx-id`);
    console.log(`\nGuia completo: docs/GOOGLE-SEARCH-SETUP.md\n`);
    process.exit(1);
  }

  // 2. Preparar query de teste
  const testQuery = process.argv[2] || "ITBI integralização capital social imunidade";

  console.log(`\n${BRIGHT}[2/5] Preparando Busca de Teste${RESET}`);
  console.log(`─────────────────────────────────────`);
  console.log(`Query: ${CYAN}"${testQuery}"${RESET}`);
  console.log(`Limite: 10 resultados`);
  console.log(`Tribunal: Todos`);

  // 3. Executar busca
  console.log(`\n${BRIGHT}[3/5] Executando Busca${RESET}`);
  console.log(`─────────────────────────────────────`);

  const startTime = Date.now();
  let result;

  try {
    result = await client.search(testQuery, { limit: 10, tribunal: null });
  } catch (error) {
    console.log(`${RED}${BRIGHT}ERRO:${RESET} ${error.message}`);
    console.log(`\nStack trace:`, error.stack);
    process.exit(1);
  }

  const elapsedTime = Date.now() - startTime;

  // 4. Analisar resultado
  console.log(`\n${BRIGHT}[4/5] Analisando Resultado${RESET}`);
  console.log(`─────────────────────────────────────`);

  console.log(`Sucesso:         ${result.success ? `${GREEN}✓ SIM${RESET}` : `${RED}✗ NÃO${RESET}`}`);
  console.log(`Resultados:      ${result.results?.length || 0}`);
  console.log(`Total estimado:  ${result.total || 0}`);
  console.log(`Tempo:           ${elapsedTime}ms`);
  console.log(`Tempo Google:    ${result.searchTime ? `${(result.searchTime * 1000).toFixed(0)}ms` : 'N/A'}`);

  if (result.fallbackLevel) {
    console.log(`Fallback usado:  ${YELLOW}Nível ${result.fallbackLevel}${RESET}`);
  }

  if (result.error) {
    console.log(`Erro:            ${RED}${result.error}${RESET}`);
  }

  if (result.quotaExceeded) {
    console.log(`${YELLOW}⚠️  QUOTA EXCEDIDA${RESET} - Aguarde antes de nova tentativa`);
  }

  if (result.authError) {
    console.log(`${RED}⚠️  ERRO DE AUTENTICAÇÃO${RESET} - Verifique API_KEY e CX`);
  }

  // 5. Mostrar resultados
  if (result.results && result.results.length > 0) {
    console.log(`\n${BRIGHT}[5/5] Resultados Encontrados${RESET}`);
    console.log(`─────────────────────────────────────`);

    result.results.slice(0, 5).forEach((item, index) => {
      console.log(`\n${BRIGHT}${index + 1}. ${item.tribunal || 'Web'} - ${item.tipo}${RESET}`);
      console.log(`   Título: ${item.titulo}`);
      console.log(`   URL: ${CYAN}${item.url}${RESET}`);
      console.log(`   Ementa: ${item.ementa.substring(0, 150)}...`);
      if (item.numero && item.numero !== 'N/A') {
        console.log(`   Processo: ${item.numero}`);
      }
      if (item.relator) {
        console.log(`   Relator: ${item.relator}`);
      }
      console.log(`   Relevância: ${item.relevancia === 'high' ? `${GREEN}Alta${RESET}` : item.relevancia === 'medium' ? `${YELLOW}Média${RESET}` : 'Baixa'}`);
    });

    if (result.results.length > 5) {
      console.log(`\n   ... e mais ${result.results.length - 5} resultados`);
    }
  } else {
    console.log(`\n${BRIGHT}[5/5] Nenhum Resultado${RESET}`);
    console.log(`─────────────────────────────────────`);
    console.log(`${YELLOW}⚠️  A busca não retornou resultados${RESET}`);

    if (result.fallbackLevel === 3) {
      console.log(`\nTodos os 3 níveis de fallback foram testados:`);
      console.log(`  1. Sites específicos (.jus.br individuais)`);
      console.log(`  2. Site genérico (site:jus.br)`);
      console.log(`  3. Busca geral (sem filtros)`);
      console.log(`\nPossíveis causas:`);
      console.log(`  • Termo muito específico/raro`);
      console.log(`  • Custom Search Engine mal configurado`);
      console.log(`  • Quota da API excedida`);
    }
  }

  // Resumo final
  console.log(`\n${BRIGHT}${GREEN}
╔════════════════════════════════════════════════════════════════╗
║                     TESTE CONCLUÍDO                            ║
╚════════════════════════════════════════════════════════════════╝
${RESET}`);

  console.log(`\n${BRIGHT}Resumo:${RESET}`);
  console.log(`  Status: ${result.success ? `${GREEN}✓ Sucesso${RESET}` : `${RED}✗ Falha${RESET}`}`);
  console.log(`  Resultados: ${result.results?.length || 0}`);
  console.log(`  Tempo total: ${elapsedTime}ms`);

  if (result.success && result.results.length > 0) {
    console.log(`\n${GREEN}✓ Google Search API está funcionando corretamente!${RESET}\n`);
    process.exit(0);
  } else if (result.success && result.results.length === 0) {
    console.log(`\n${YELLOW}⚠️  API funcionando mas 0 resultados. Teste com outros termos.${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`\n${RED}✗ Problemas detectados. Verifique logs acima.${RESET}\n`);
    process.exit(1);
  }
}

// Executar teste
testGoogleSearch().catch(error => {
  console.error(`\n${RED}${BRIGHT}ERRO FATAL:${RESET}`, error);
  process.exit(1);
});
