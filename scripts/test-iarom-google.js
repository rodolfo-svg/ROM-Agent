#!/usr/bin/env node
/**
 * Teste do Google Search Client com VALIDAÇÃO ESTRITA
 * Usando o código real do IAROM (lib/google-search-client.js)
 */

import { GoogleSearchClient } from '../lib/google-search-client.js';

const RESET = '\x1b[0m';
const BRIGHT = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';

async function testIAROMGoogle() {
  console.log(`${BRIGHT}${BLUE}
╔════════════════════════════════════════════════════════════════╗
║     TESTE IAROM - Google Search com VALIDAÇÃO ESTRITA          ║
║                      v2.7.5                                    ║
╚════════════════════════════════════════════════════════════════╝
${RESET}`);

  const API_KEY = process.argv[2] || 'AIzaSyASQ6IzrLay4PVsPPhYPFXisTubiTq7ocI';
  const CX = process.argv[3] || 'f14c0d3793b7346c0';
  const QUERY = process.argv[4] || 'ITBI integralização capital social';

  console.log(`\n${BRIGHT}[1/4] Configuração${RESET}`);
  console.log(`─────────────────────────────────────`);
  console.log(`API Key: ${API_KEY.substring(0, 20)}...`);
  console.log(`CX ID:   ${CX}`);
  console.log(`Query:   ${CYAN}"${QUERY}"${RESET}`);

  const client = new GoogleSearchClient({
    apiKey: API_KEY,
    cx: CX
  });

  console.log(`\n${BRIGHT}[2/4] Teste com Validação Estrita${RESET}`);
  console.log(`─────────────────────────────────────`);
  console.log(`🔒 Apenas URLs .jus.br serão aceitas`);
  console.log(`⚠️ Resultados não-oficiais serão rejeitados\n`);

  const startTime = Date.now();

  try {
    const result = await client.search(QUERY, { limit: 10, tribunal: null });
    const elapsed = Date.now() - startTime;

    console.log(`\n${BRIGHT}[3/4] Resultado${RESET}`);
    console.log(`─────────────────────────────────────`);
    console.log(`Sucesso:        ${result.success ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`}`);
    console.log(`Resultados:     ${result.results.length}`);
    console.log(`Total:          ${result.total}`);
    console.log(`Tempo:          ${elapsed}ms`);
    console.log(`Fallback usado: ${result.usedFallback ? `${YELLOW}Sim${RESET}` : 'Não'}`);

    if (result.results.length > 0) {
      console.log(`\n${BRIGHT}[4/4] Primeiros 5 Resultados (TODOS VALIDADOS)${RESET}`);
      console.log(`─────────────────────────────────────`);

      result.results.slice(0, 5).forEach((item, i) => {
        console.log(`\n${BRIGHT}${i + 1}. ${item.tribunal} - ${item.tipo}${RESET}`);
        console.log(`   ✓ Verificado: ${item.verified ? `${GREEN}SIM${RESET}` : `${RED}NÃO${RESET}`}`);
        console.log(`   Título: ${item.titulo}`);
        console.log(`   URL: ${CYAN}${item.url}${RESET}`);

        // Validar que URL é .jus.br
        if (!item.url.includes('.jus.br')) {
          console.log(`   ${RED}⚠️ ERRO: URL não é .jus.br!${RESET}`);
        } else {
          console.log(`   ${GREEN}🔒 Seguro: .jus.br confirmado${RESET}`);
        }

        console.log(`   Ementa: ${item.ementa.substring(0, 100)}...`);
        console.log(`   Relevância: ${item.relevancia}`);
      });

      if (result.results.length > 5) {
        console.log(`\n   ... e mais ${result.results.length - 5} resultados`);
      }

      // Validação final
      console.log(`\n${BRIGHT}${GREEN}
╔════════════════════════════════════════════════════════════════╗
║                 VALIDAÇÃO DE SEGURANÇA                         ║
╚════════════════════════════════════════════════════════════════╝
${RESET}`);

      const allVerified = result.results.every(r => r.verified);
      const allJusBr = result.results.every(r => r.url.includes('.jus.br'));

      console.log(`\nTotal de resultados: ${result.results.length}`);
      console.log(`Todos verificados:   ${allVerified ? `${GREEN}✓ SIM${RESET}` : `${RED}✗ NÃO${RESET}`}`);
      console.log(`Todos .jus.br:       ${allJusBr ? `${GREEN}✓ SIM${RESET}` : `${RED}✗ NÃO${RESET}`}`);

      if (allVerified && allJusBr) {
        console.log(`\n${GREEN}${BRIGHT}✓✓✓ SEGURANÇA VALIDADA - Nenhum resultado suspeito!${RESET}\n`);
      } else {
        console.log(`\n${RED}${BRIGHT}✗✗✗ FALHA DE SEGURANÇA - Resultados não-oficiais encontrados!${RESET}\n`);
      }

    } else {
      console.log(`\n${YELLOW}⚠️ Nenhum resultado retornado${RESET}`);
      console.log(`\nPossíveis causas:`);
      console.log(`  • Termo muito específico`);
      console.log(`  • Todos os resultados foram rejeitados (não .jus.br)`);
      console.log(`  • Verificar logs acima\n`);
    }

  } catch (error) {
    console.log(`\n${RED}${BRIGHT}ERRO:${RESET} ${error.message}`);
    console.log(`Stack:`, error.stack);
  }
}

testIAROMGoogle().catch(console.error);
