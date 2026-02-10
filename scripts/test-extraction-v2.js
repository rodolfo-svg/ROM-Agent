#!/usr/bin/env node

/**
 * ROM Agent - Script de Teste da Extração v2.0
 *
 * Testa o pipeline completo de 18 ficheiros
 *
 * Uso:
 *   node scripts/test-extraction-v2.js <caminho-arquivo.pdf> [nome-pasta-output]
 *
 * Exemplo:
 *   node scripts/test-extraction-v2.js ./docs/peticao.pdf Peticao_Teste_2026
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { extractDocumentWithFullAnalysis } from '../src/services/document-extraction-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI colors para terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logBox(title, content, color = 'cyan') {
  const width = 70;
  console.log(`${colors[color]}${'═'.repeat(width)}${colors.reset}`);
  console.log(`${colors[color]}║ ${colors.bright}${title.padEnd(width - 4)}${colors.reset}${colors[color]} ║${colors.reset}`);
  console.log(`${colors[color]}${'═'.repeat(width)}${colors.reset}`);

  if (content) {
    content.split('\n').forEach(line => {
      console.log(`${colors[color]}║${colors.reset} ${line.padEnd(width - 2)} ${colors[color]}║${colors.reset}`);
    });
    console.log(`${colors[color]}${'═'.repeat(width)}${colors.reset}`);
  }
}

async function verificarArquivo(filePath) {
  try {
    const stats = await fs.stat(filePath);

    if (!stats.isFile()) {
      throw new Error('Caminho não é um arquivo');
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!['.pdf', '.txt', '.doc', '.docx'].includes(ext)) {
      throw new Error(`Extensão ${ext} não suportada. Use .pdf, .txt, .doc ou .docx`);
    }

    return {
      tamanho: stats.size,
      tamanhoMB: (stats.size / (1024 * 1024)).toFixed(2),
      extensao: ext
    };
  } catch (error) {
    throw new Error(`Erro ao verificar arquivo: ${error.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  // Banner
  logBox('ROM AGENT v2.0 - TESTE DE EXTRAÇÃO', '', 'cyan');
  console.log();

  // Validar argumentos
  if (args.length === 0) {
    log('❌ Erro: Caminho do arquivo não fornecido\n', 'red');
    log('Uso:', 'yellow');
    log('  node scripts/test-extraction-v2.js <caminho-arquivo.pdf> [nome-pasta-output]\n', 'yellow');
    log('Exemplo:', 'yellow');
    log('  node scripts/test-extraction-v2.js ./docs/peticao.pdf Peticao_Teste', 'yellow');
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);
  const outputFolderName = args[1] || `Teste_${Date.now()}`;

  // Verificar arquivo
  log('📁 Verificando arquivo...', 'blue');
  try {
    const fileInfo = await verificarArquivo(filePath);
    log(`   ✅ Arquivo válido: ${path.basename(filePath)}`, 'green');
    log(`   📏 Tamanho: ${fileInfo.tamanhoMB} MB`, 'cyan');
    log(`   📄 Tipo: ${fileInfo.extensao}`, 'cyan');
    console.log();
  } catch (error) {
    log(`   ❌ ${error.message}`, 'red');
    process.exit(1);
  }

  // Informações de configuração
  logBox('CONFIGURAÇÃO', `Arquivo: ${path.basename(filePath)}\nPasta de saída: ${outputFolderName}\nModelo extração: Haiku (barato)\nModelo análise: Sonnet (premium)`, 'yellow');
  console.log();

  // Confirmar execução
  log('🚀 Iniciando extração com pipeline de 18 ficheiros...', 'bright');
  console.log();

  const inicioTempo = Date.now();

  try {
    // Executar extração
    const resultado = await extractDocumentWithFullAnalysis({
      filePath,
      outputFolderName,
      projectName: 'Teste_ROM_Agent',
      uploadToKB: false,
      useHaikuForExtraction: true,
      useSonnetForAnalysis: true
    });

    const duracaoTotal = Math.round((Date.now() - inicioTempo) / 1000);

    console.log();
    logBox('✅ EXTRAÇÃO CONCLUÍDA COM SUCESSO!', '', 'green');
    console.log();

    // Estatísticas
    log('📊 ESTATÍSTICAS:', 'cyan');
    log(`   • Arquivos gerados: ${resultado.totalArquivos}`, 'green');
    log(`   • Tempo total: ${duracaoTotal}s (${Math.floor(duracaoTotal / 60)}min ${duracaoTotal % 60}s)`, 'green');
    log(`   • Pasta: ${resultado.pastaBase}`, 'cyan');
    console.log();

    // Metadados
    if (resultado.metadata) {
      log('📈 DETALHES:', 'cyan');
      log(`   • Texto original: ${resultado.metadata.texto.tamanhoOriginal.toLocaleString()} caracteres`, 'cyan');
      log(`   • Texto normalizado: ${resultado.metadata.texto.tamanhoNormalizado.toLocaleString()} caracteres`, 'cyan');
      log(`   • Redução: ${resultado.metadata.texto.reducaoPercentual}`, 'cyan');
      log(`   • Total de entidades: ${resultado.metadata.entidades.totalEntidades}`, 'cyan');
      log(`   • Valores monetários: ${resultado.metadata.entidades.totalValores}`, 'cyan');
      log(`   • Datas identificadas: ${resultado.metadata.entidades.totalDatas}`, 'cyan');
      log(`   • Leis citadas: ${resultado.metadata.entidades.totalLeis}`, 'cyan');
      console.log();
    }

    // Arquivos principais
    log('📂 ARQUIVOS PRINCIPAIS:', 'yellow');
    log(`   1. ${colors.bright}18_indice_navegacao.md${colors.reset} - START HERE (índice completo)`, 'yellow');
    log(`   2. ${colors.bright}03_resumo_executivo.md${colors.reset} - Resumo completo`, 'yellow');
    log(`   3. ${colors.bright}05_pontos_criticos.md${colors.reset} - Alertas e riscos`, 'yellow');
    log(`   4. ${colors.bright}06_analise_completa.md${colors.reset} - Análise jurídica profunda`, 'yellow');
    log(`   5. ${colors.bright}15_analise_risco.md${colors.reset} - Recomendações estratégicas`, 'yellow');
    console.log();

    // Custos estimados
    if (resultado.metadata?.custos) {
      log('💰 CUSTOS:', 'yellow');
      log(`   • Total: $${resultado.metadata.custos.total.toFixed(4)}`, 'yellow');
      console.log();
    }

    // Próximos passos
    logBox('🎯 PRÓXIMOS PASSOS', `1. Abra o índice: ${resultado.pastaBase}/06_METADADOS/18_indice_navegacao.md\n2. Leia o resumo: ${resultado.pastaBase}/02_RESUMOS/03_resumo_executivo.md\n3. Revise os alertas: ${resultado.pastaBase}/02_RESUMOS/05_pontos_criticos.md`, 'green');
    console.log();

    // Comando para abrir a pasta
    log('💡 Dica: Para abrir a pasta de resultados, execute:', 'blue');
    log(`   open "${resultado.pastaBase}"`, 'cyan');
    console.log();

    process.exit(0);

  } catch (error) {
    console.log();
    logBox('❌ ERRO NA EXTRAÇÃO', '', 'red');
    console.log();

    log(`Erro: ${error.message}`, 'red');

    if (error.stack) {
      console.log();
      log('Stack trace:', 'yellow');
      console.log(error.stack);
    }

    console.log();
    log('💡 Dicas de troubleshooting:', 'yellow');
    log('   1. Verifique se o arquivo existe e é válido', 'yellow');
    log('   2. Verifique as credenciais AWS (Bedrock)', 'yellow');
    log('   3. Verifique os logs em logs/extraction.log', 'yellow');
    log('   4. Consulte EXTRACAO-V2-README.md para mais informações', 'yellow');
    console.log();

    process.exit(1);
  }
}

// Executar
main();
