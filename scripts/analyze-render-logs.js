#!/usr/bin/env node
/**
 * ANALISADOR DE LOGS DO RENDER
 *
 * Analisa logs copiados do Render Dashboard e identifica problemas
 *
 * Uso:
 *   node scripts/analyze-render-logs.js < logs.txt
 *   cat logs.txt | node scripts/analyze-render-logs.js
 *   node scripts/analyze-render-logs.js logs.txt
 */

import fs from 'fs';
import readline from 'readline';

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║                                                              ║');
console.log('║  🔍 ANALISADOR DE LOGS DO RENDER                            ║');
console.log('║                                                              ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

// ═══════════════════════════════════════════════════════════════════════
// PADRÕES DE PROBLEMAS
// ═══════════════════════════════════════════════════════════════════════

const patterns = {
  critical: [
    { regex: /Error:\s+(.+)/i, type: 'ERRO GERAL', severity: 'CRÍTICO' },
    { regex: /TypeError:\s+(.+)/i, type: 'ERRO DE TIPO', severity: 'CRÍTICO' },
    { regex: /ReferenceError:\s+(.+)/i, type: 'REFERÊNCIA INVÁLIDA', severity: 'CRÍTICO' },
    { regex: /SyntaxError:\s+(.+)/i, type: 'ERRO DE SINTAXE', severity: 'CRÍTICO' },
    { regex: /Cannot find module\s+['"](.+)['"]/i, type: 'MÓDULO NÃO ENCONTRADO', severity: 'CRÍTICO' },
    { regex: /MODULE_NOT_FOUND/i, type: 'MÓDULO NÃO ENCONTRADO', severity: 'CRÍTICO' },
    { regex: /ECONNREFUSED/i, type: 'CONEXÃO RECUSADA', severity: 'CRÍTICO' },
    { regex: /ETIMEDOUT/i, type: 'TIMEOUT DE CONEXÃO', severity: 'CRÍTICO' },
    { regex: /Exited with code (\d+)/i, type: 'PROCESSO TERMINOU', severity: 'CRÍTICO' },
    { regex: /JavaScript heap out of memory/i, type: 'OUT OF MEMORY (OOM)', severity: 'CRÍTICO' },
    { regex: /FATAL ERROR/i, type: 'ERRO FATAL', severity: 'CRÍTICO' },
    { regex: /Killed/i, type: 'PROCESSO MATADO (SIGKILL)', severity: 'CRÍTICO' }
  ],
  warnings: [
    { regex: /warn(?:ing)?:?\s+(.+)/i, type: 'AVISO', severity: 'AVISO' },
    { regex: /deprecated/i, type: 'DEPENDÊNCIA DEPRECIADA', severity: 'AVISO' },
    { regex: /MaxListenersExceededWarning/i, type: 'LISTENERS EXCEDIDOS', severity: 'AVISO' },
    { regex: /UnhandledPromiseRejectionWarning/i, type: 'PROMISE NÃO TRATADA', severity: 'AVISO' }
  ],
  success: [
    { regex: /✅|✓|success/i, type: 'SUCESSO', severity: 'INFO' },
    { regex: /Servidor iniciado na porta (\d+)/i, type: 'SERVIDOR INICIADO', severity: 'INFO' },
    { regex: /Worker (\d+) iniciado/i, type: 'WORKER CRIADO', severity: 'INFO' },
    { regex: /Database (já |)inicializado/i, type: 'DATABASE OK', severity: 'INFO' },
    { regex: /MIGRAÇÕES CONCLUÍDAS/i, type: 'MIGRATIONS OK', severity: 'INFO' }
  ],
  database: [
    { regex: /DATABASE_URL não (está )?configurad[oa]/i, type: 'DATABASE_URL AUSENTE', severity: 'CRÍTICO' },
    { regex: /Conectando ao PostgreSQL/i, type: 'CONECTANDO DB', severity: 'INFO' },
    { regex: /Conectado ao PostgreSQL/i, type: 'DB CONECTADO', severity: 'INFO' },
    { regex: /Executando migrations/i, type: 'EXECUTANDO MIGRATIONS', severity: 'INFO' },
    { regex: /connection.*refused/i, type: 'DB INACESSÍVEL', severity: 'CRÍTICO' },
    { regex: /password authentication failed/i, type: 'SENHA DB INCORRETA', severity: 'CRÍTICO' }
  ],
  startup: [
    { regex: /npm start/i, type: 'COMANDO START', severity: 'INFO' },
    { regex: /node.*server/i, type: 'INICIANDO NODE', severity: 'INFO' },
    { regex: /listening on/i, type: 'LISTEN INICIADO', severity: 'INFO' },
    { regex: /ready/i, type: 'PRONTO', severity: 'INFO' }
  ]
};

// ═══════════════════════════════════════════════════════════════════════
// ANÁLISE
// ═══════════════════════════════════════════════════════════════════════

const results = {
  totalLines: 0,
  critical: [],
  warnings: [],
  info: [],
  database: [],
  startup: [],
  lastLines: [],
  unknownErrors: []
};

async function analyzeLine(line, lineNumber) {
  results.totalLines++;

  // Guardar últimas 10 linhas
  results.lastLines.push({ lineNumber, text: line });
  if (results.lastLines.length > 10) {
    results.lastLines.shift();
  }

  // Testar contra todos os padrões
  let matched = false;

  for (const [category, patternList] of Object.entries(patterns)) {
    for (const pattern of patternList) {
      const match = line.match(pattern.regex);
      if (match) {
        matched = true;
        const finding = {
          lineNumber,
          category,
          type: pattern.type,
          severity: pattern.severity,
          text: line.trim(),
          match: match[1] || match[0]
        };

        if (pattern.severity === 'CRÍTICO') {
          results.critical.push(finding);
        } else if (pattern.severity === 'AVISO') {
          results.warnings.push(finding);
        } else if (category === 'database') {
          results.database.push(finding);
        } else if (category === 'startup') {
          results.startup.push(finding);
        } else {
          results.info.push(finding);
        }
      }
    }
  }

  // Se tem palavra "error" mas não matchou nenhum padrão
  if (!matched && /error/i.test(line) && line.length > 10) {
    results.unknownErrors.push({ lineNumber, text: line.trim() });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// LEITURA DE INPUT
// ═══════════════════════════════════════════════════════════════════════

async function readInput() {
  let input;

  // Verificar se tem arquivo como argumento
  if (process.argv[2] && fs.existsSync(process.argv[2])) {
    console.log(`📄 Lendo arquivo: ${process.argv[2]}`);
    console.log('');
    input = fs.createReadStream(process.argv[2]);
  }
  // Verificar se tem input via pipe
  else if (!process.stdin.isTTY) {
    console.log('📄 Lendo de stdin (pipe)...');
    console.log('');
    input = process.stdin;
  }
  // Modo interativo
  else {
    console.log('📄 Cole os logs do Render abaixo e pressione Ctrl+D quando terminar:');
    console.log('   (ou use: node scripts/analyze-render-logs.js logs.txt)');
    console.log('');
    input = process.stdin;
  }

  const rl = readline.createInterface({
    input,
    crlfDelay: Infinity
  });

  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber++;
    await analyzeLine(line, lineNumber);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

await readInput();

console.log('═'.repeat(70));
console.log('📊 ANÁLISE COMPLETA');
console.log('═'.repeat(70));
console.log('');
console.log(`Total de linhas analisadas: ${results.totalLines}`);
console.log('');

// ───────────────────────────────────────────────────────────────────────
// ERROS CRÍTICOS
// ───────────────────────────────────────────────────────────────────────

if (results.critical.length > 0) {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🚨 ERROS CRÍTICOS ENCONTRADOS                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  results.critical.forEach((finding, index) => {
    console.log(`❌ ${index + 1}. ${finding.type}`);
    console.log(`   Linha ${finding.lineNumber}: ${finding.text}`);
    console.log('');
  });
}

// ───────────────────────────────────────────────────────────────────────
// AVISOS
// ───────────────────────────────────────────────────────────────────────

if (results.warnings.length > 0) {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ⚠️  AVISOS                                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  results.warnings.forEach((finding, index) => {
    console.log(`⚠️  ${index + 1}. ${finding.type}`);
    console.log(`   Linha ${finding.lineNumber}: ${finding.text}`);
    console.log('');
  });
}

// ───────────────────────────────────────────────────────────────────────
// DATABASE
// ───────────────────────────────────────────────────────────────────────

if (results.database.length > 0) {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  💾 DATABASE & MIGRATIONS                                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  results.database.forEach((finding, index) => {
    const icon = finding.severity === 'CRÍTICO' ? '❌' : 'ℹ️';
    console.log(`${icon} ${finding.type}`);
    console.log(`   Linha ${finding.lineNumber}: ${finding.text}`);
    console.log('');
  });
}

// ───────────────────────────────────────────────────────────────────────
// STARTUP
// ───────────────────────────────────────────────────────────────────────

if (results.startup.length > 0) {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 STARTUP                                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  results.startup.forEach((finding, index) => {
    console.log(`✅ ${finding.type}`);
    console.log(`   Linha ${finding.lineNumber}: ${finding.text}`);
    console.log('');
  });
}

// ───────────────────────────────────────────────────────────────────────
// ERROS DESCONHECIDOS
// ───────────────────────────────────────────────────────────────────────

if (results.unknownErrors.length > 0) {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ❓ POSSÍVEIS ERROS NÃO IDENTIFICADOS                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  results.unknownErrors.slice(0, 5).forEach((finding, index) => {
    console.log(`❓ ${index + 1}. Linha ${finding.lineNumber}:`);
    console.log(`   ${finding.text}`);
    console.log('');
  });

  if (results.unknownErrors.length > 5) {
    console.log(`   ... e mais ${results.unknownErrors.length - 5} linhas com "error"`);
    console.log('');
  }
}

// ───────────────────────────────────────────────────────────────────────
// ÚLTIMAS LINHAS
// ───────────────────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  📋 ÚLTIMAS 10 LINHAS DO LOG                                ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

results.lastLines.forEach(line => {
  console.log(`${String(line.lineNumber).padStart(4)}: ${line.text}`);
});
console.log('');

// ───────────────────────────────────────────────────────────────────────
// DIAGNÓSTICO AUTOMÁTICO
// ───────────────────────────────────────────────────────────────────────

console.log('═'.repeat(70));
console.log('🔍 DIAGNÓSTICO AUTOMÁTICO');
console.log('═'.repeat(70));
console.log('');

// Análise de padrões
const hasOOM = results.critical.some(f => f.type.includes('OUT OF MEMORY'));
const hasModuleNotFound = results.critical.some(f => f.type.includes('MÓDULO'));
const hasDBError = results.database.some(f => f.severity === 'CRÍTICO');
const hasProcessExit = results.critical.some(f => f.type.includes('PROCESSO'));
const hasServerStart = results.startup.some(f => f.type === 'SERVIDOR INICIADO');
const hasWorkerStart = results.startup.some(f => f.type === 'WORKER CRIADO');
const hasMigrations = results.database.some(f => f.type === 'MIGRATIONS OK');

if (results.critical.length === 0 && hasServerStart && hasWorkerStart) {
  console.log('✅ SERVIDOR APARENTEMENTE ESTÁ FUNCIONANDO NORMALMENTE');
  console.log('');
  console.log('   - Servidor iniciado com sucesso');
  console.log('   - Workers criados');
  if (hasMigrations) {
    console.log('   - Migrations executadas');
  }
  console.log('');
  console.log('Se o serviço ainda não está respondendo, pode ser:');
  console.log('  1. Health check customizado do Render falhando');
  console.log('  2. Problema de rede/firewall');
  console.log('  3. Logs desatualizados (verificar timestamp)');
  console.log('');
} else if (hasOOM) {
  console.log('❌ PROBLEMA: OUT OF MEMORY (OOM)');
  console.log('');
  console.log('O servidor está ficando sem memória RAM.');
  console.log('');
  console.log('SOLUÇÕES:');
  console.log('  1. Upgrade do plano Render (Starter: 2GB RAM)');
  console.log('  2. Reduzir número de workers (ajustar MAX_WORKERS_RENDER)');
  console.log('  3. Otimizar carregamento no startup');
  console.log('  4. Adicionar --max-old-space-size=1536 no Node');
  console.log('');
} else if (hasModuleNotFound) {
  console.log('❌ PROBLEMA: MÓDULO NÃO ENCONTRADO');
  console.log('');
  console.log('O código está tentando importar um módulo que não existe.');
  console.log('');
  console.log('SOLUÇÕES:');
  console.log('  1. Verificar package.json (npm install localmente)');
  console.log('  2. Verificar imports no código (path correto?)');
  console.log('  3. Limpar build cache do Render e rebuildar');
  console.log('');
} else if (hasDBError) {
  console.log('❌ PROBLEMA: ERRO DE DATABASE');
  console.log('');
  console.log('Não conseguiu conectar ou executar operações no PostgreSQL.');
  console.log('');
  console.log('SOLUÇÕES:');
  console.log('  1. Verificar DATABASE_URL nas env vars do Render');
  console.log('  2. Confirmar que PostgreSQL está rodando');
  console.log('  3. Verificar credenciais/senha');
  console.log('  4. Verificar firewall/whitelist de IPs');
  console.log('');
} else if (hasProcessExit) {
  console.log('❌ PROBLEMA: PROCESSO TERMINOU INESPERADAMENTE');
  console.log('');
  console.log('O servidor iniciou mas crashou logo depois.');
  console.log('');
  console.log('Revisar os erros críticos acima para identificar a causa.');
  console.log('');
} else if (!hasServerStart && !hasWorkerStart) {
  console.log('❌ PROBLEMA: SERVIDOR NÃO INICIOU');
  console.log('');
  console.log('Não há evidência de que o servidor tenha iniciado com sucesso.');
  console.log('');
  console.log('Possíveis causas:');
  console.log('  1. Crash antes de iniciar listen()');
  console.log('  2. Travado em migrations (última linha?)');
  console.log('  3. Import de módulo falhou');
  console.log('  4. Erro de sintaxe no código');
  console.log('');
  console.log('Verificar a última linha do log acima.');
  console.log('');
} else {
  console.log('⚠️  SITUAÇÃO INCONCLUSIVA');
  console.log('');
  console.log('Revisar:');
  console.log('  - Erros críticos listados acima');
  console.log('  - Últimas linhas do log');
  console.log('  - Se há mensagens incompletas (truncadas)');
  console.log('');
}

// ───────────────────────────────────────────────────────────────────────
// RESUMO
// ───────────────────────────────────────────────────────────────────────

console.log('═'.repeat(70));
console.log('📊 RESUMO');
console.log('═'.repeat(70));
console.log('');
console.log(`❌ Erros críticos:     ${results.critical.length}`);
console.log(`⚠️  Avisos:             ${results.warnings.length}`);
console.log(`💾 Eventos database:   ${results.database.length}`);
console.log(`🚀 Eventos startup:    ${results.startup.length}`);
console.log(`❓ Erros desconhecidos: ${results.unknownErrors.length}`);
console.log('');

if (results.critical.length > 0) {
  console.log('🔴 STATUS: CRÍTICO - Revisar erros acima');
} else if (results.warnings.length > 0) {
  console.log('🟡 STATUS: AVISOS - Pode estar funcionando');
} else if (hasServerStart) {
  console.log('🟢 STATUS: OK - Servidor parece estar funcionando');
} else {
  console.log('⚪ STATUS: INCONCLUSIVO - Precisamos de mais logs');
}

console.log('');
console.log('═'.repeat(70));
console.log('');
