#!/usr/bin/env node

/**
 * ROM Agent v2.0 - Sistema de Verificação de Versão
 *
 * Verifica:
 * - Versão atual do sistema
 * - Componentes instalados
 * - Integridade dos arquivos
 * - Disponibilidade de atualizações
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cores ANSI
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
  console.log('');
  log('═'.repeat(70), 'cyan');
  log(` ${title}`, 'bright');
  log('═'.repeat(70), 'cyan');
  console.log('');
}

// Banner
console.clear();
log('╔══════════════════════════════════════════════════════════════╗', 'cyan');
log('║         ROM AGENT v2.0 - VERIFICAÇÃO DE VERSÃO              ║', 'cyan');
log('╚══════════════════════════════════════════════════════════════╝', 'cyan');
console.log('');

// ============================================================================
// INFORMAÇÕES DO SISTEMA
// ============================================================================

header('INFORMAÇÕES DO SISTEMA');

// Ler package.json
const pkgPath = path.resolve('package.json');
let pkg;

try {
  pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  log(`✓ Nome: ${pkg.name}`, 'green');
  log(`✓ Versão: ${pkg.version}`, 'green');
  log(`✓ Descrição: ${pkg.description}`, 'blue');
} catch (error) {
  log(`✗ Erro ao ler package.json: ${error.message}`, 'red');
  process.exit(1);
}

console.log('');

// ============================================================================
// AMBIENTE
// ============================================================================

header('AMBIENTE DE EXECUÇÃO');

log(`SO: ${os.platform()} ${os.release()}`, 'blue');
log(`Arquitetura: ${os.arch()}`, 'blue');
log(`Node.js: ${process.version}`, 'blue');
log(`Diretório: ${process.cwd()}`, 'blue');

// Verificar versão mínima do Node.js
const nodeVersion = process.version.replace('v', '');
const [major] = nodeVersion.split('.').map(Number);

if (major < 18) {
  log('⚠ AVISO: Node.js 18+ recomendado', 'yellow');
} else {
  log('✓ Node.js versão OK', 'green');
}

console.log('');

// ============================================================================
// COMPONENTES PRINCIPAIS
// ============================================================================

header('COMPONENTES DO SISTEMA v2.0');

const components = [
  {
    name: 'Extrator de Entidades',
    path: 'src/services/entidades-extractor.js',
    version: '2.0.0',
    critical: true
  },
  {
    name: 'Análise Jurídica Profunda',
    path: 'src/services/analise-juridica-profunda.js',
    version: '2.0.0',
    critical: true
  },
  {
    name: 'Gerador 18 Ficheiros',
    path: 'src/services/gerador-18-ficheiros.js',
    version: '2.0.0',
    critical: true
  },
  {
    name: 'Document Extraction Service',
    path: 'src/services/document-extraction-service.js',
    version: '2.0.0',
    critical: true
  },
  {
    name: 'API REST v2',
    path: 'src/routes/extraction-v2.js',
    version: '2.0.0',
    critical: true
  },
  {
    name: 'Módulo de Extração',
    path: 'src/modules/extracao.js',
    version: '2.0.0',
    critical: true
  }
];

let missingComponents = 0;

components.forEach(component => {
  const exists = fs.existsSync(component.path);

  if (exists) {
    const content = fs.readFileSync(component.path, 'utf-8');
    const size = (content.length / 1024).toFixed(2);

    log(`✓ ${component.name}`, 'green');
    log(`  └─ Arquivo: ${component.path}`, 'blue');
    log(`  └─ Tamanho: ${size} KB`, 'blue');
    log(`  └─ Versão: ${component.version}`, 'blue');
  } else {
    log(`✗ ${component.name} NÃO ENCONTRADO`, 'red');
    log(`  └─ Esperado em: ${component.path}`, 'yellow');

    if (component.critical) {
      missingComponents++;
    }
  }

  console.log('');
});

if (missingComponents > 0) {
  log(`⚠ ${missingComponents} componente(s) crítico(s) ausente(s)`, 'yellow');
  console.log('');
}

// ============================================================================
// SCRIPTS DE INSTALAÇÃO
// ============================================================================

header('SCRIPTS DE INSTALAÇÃO MULTI-PLATAFORMA');

const setupScripts = [
  { name: 'Windows (PowerShell)', path: 'scripts/setup-extracao-v2.ps1', platform: 'win32' },
  { name: 'macOS (Bash)', path: 'scripts/setup-extracao-v2.sh', platform: 'darwin' },
  { name: 'Linux (Bash)', path: 'scripts/setup-extracao-v2-linux.sh', platform: 'linux' }
];

setupScripts.forEach(script => {
  const exists = fs.existsSync(script.path);
  const isCurrent = os.platform() === script.platform;

  if (exists) {
    log(`✓ ${script.name}`, 'green');

    if (isCurrent) {
      log(`  └─ ⭐ Script para plataforma atual`, 'cyan');
    }
  } else {
    log(`✗ ${script.name} não encontrado`, 'red');
  }
});

console.log('');

// ============================================================================
// DOCUMENTAÇÃO
// ============================================================================

header('DOCUMENTAÇÃO');

const docs = [
  { name: 'Manual Completo', path: 'EXTRACAO-V2-README.md' },
  { name: 'Implementação Técnica', path: 'IMPLEMENTACAO-COMPLETA.md' },
  { name: 'Instalação Multi-Plataforma', path: 'README-INSTALACAO-MULTIPLATAFORMA.md' },
  { name: 'Resumo Final', path: 'RESUMO-FINAL-COMPLETO.md' }
];

docs.forEach(doc => {
  const exists = fs.existsSync(doc.path);

  if (exists) {
    const content = fs.readFileSync(doc.path, 'utf-8');
    const lines = content.split('\n').length;
    const size = (content.length / 1024).toFixed(2);

    log(`✓ ${doc.name}`, 'green');
    log(`  └─ ${lines} linhas, ${size} KB`, 'blue');
  } else {
    log(`✗ ${doc.name} não encontrado`, 'red');
  }
});

console.log('');

// ============================================================================
// DEPENDÊNCIAS
// ============================================================================

header('DEPENDÊNCIAS PRINCIPAIS');

const criticalDeps = [
  '@aws-sdk/client-bedrock-runtime',
  'express',
  'multer',
  'mammoth',
  'pdf-parse'
];

if (pkg.dependencies) {
  criticalDeps.forEach(dep => {
    if (pkg.dependencies[dep]) {
      log(`✓ ${dep}: ${pkg.dependencies[dep]}`, 'green');
    } else {
      log(`✗ ${dep}: NÃO INSTALADO`, 'red');
    }
  });
} else {
  log('⚠ Nenhuma dependência encontrada', 'yellow');
}

console.log('');

// Verificar node_modules
if (fs.existsSync('node_modules')) {
  try {
    const nodeModules = fs.readdirSync('node_modules');
    log(`✓ node_modules: ${nodeModules.length} pacotes instalados`, 'green');
  } catch (error) {
    log(`⚠ Erro ao verificar node_modules: ${error.message}`, 'yellow');
  }
} else {
  log('✗ node_modules não encontrado - Execute: npm install', 'red');
}

console.log('');

// ============================================================================
// INTEGRIDADE DO SISTEMA
// ============================================================================

header('INTEGRIDADE DO SISTEMA');

let integrity = {
  total: 0,
  ok: 0,
  missing: 0
};

// Verificar arquivos críticos
const criticalFiles = [
  'src/services/entidades-extractor.js',
  'src/services/analise-juridica-profunda.js',
  'src/services/gerador-18-ficheiros.js',
  'src/services/document-extraction-service.js',
  'src/routes/extraction-v2.js',
  'src/modules/extracao.js',
  'scripts/setup-extracao-v2.sh',
  'scripts/setup-extracao-v2.ps1',
  'scripts/setup-extracao-v2-linux.sh',
  'scripts/test-extraction-v2.js',
  'scripts/criar-pacote-whatsapp.sh',
  'scripts/validar-sistema-completo.js',
  'package.json'
];

criticalFiles.forEach(file => {
  integrity.total++;

  if (fs.existsSync(file)) {
    integrity.ok++;
  } else {
    integrity.missing++;
  }
});

const integrityPercent = ((integrity.ok / integrity.total) * 100).toFixed(1);

log(`Total de arquivos críticos: ${integrity.total}`, 'blue');
log(`✓ Presentes: ${integrity.ok}`, 'green');

if (integrity.missing > 0) {
  log(`✗ Ausentes: ${integrity.missing}`, 'red');
}

log(`Integridade: ${integrityPercent}%`,
    integrityPercent === '100.0' ? 'green' : 'yellow');

console.log('');

// ============================================================================
// CONFIGURAÇÃO AWS
// ============================================================================

header('CONFIGURAÇÃO AWS BEDROCK');

const envPath = path.resolve('.env');

if (fs.existsSync(envPath)) {
  log('✓ Arquivo .env encontrado', 'green');

  const envContent = fs.readFileSync(envPath, 'utf-8');

  const hasAccessKey = envContent.includes('AWS_ACCESS_KEY_ID=') &&
                       !envContent.includes('AWS_ACCESS_KEY_ID=sua_chave');
  const hasSecretKey = envContent.includes('AWS_SECRET_ACCESS_KEY=') &&
                       !envContent.includes('AWS_SECRET_ACCESS_KEY=sua_chave');
  const hasRegion = envContent.includes('AWS_REGION=');

  if (hasAccessKey && hasSecretKey && hasRegion) {
    log('✓ Credenciais AWS configuradas', 'green');
  } else {
    log('⚠ Credenciais AWS incompletas', 'yellow');

    if (!hasAccessKey) log('  └─ AWS_ACCESS_KEY_ID não configurado', 'yellow');
    if (!hasSecretKey) log('  └─ AWS_SECRET_ACCESS_KEY não configurado', 'yellow');
    if (!hasRegion) log('  └─ AWS_REGION não configurado', 'yellow');
  }
} else {
  log('⚠ Arquivo .env não encontrado', 'yellow');
  log('  └─ Copie .env.example para .env e configure', 'blue');
}

console.log('');

// ============================================================================
// VERIFICAÇÃO DE ATUALIZAÇÃO
// ============================================================================

header('VERIFICAÇÃO DE ATUALIZAÇÃO');

const currentVersion = pkg.version;
const [versionMajor, versionMinor, versionPatch] = currentVersion.split('.').map(Number);

log(`Versão instalada: ${currentVersion}`, 'blue');
log(`Branch principal: v${versionMajor}.x`, 'blue');

// Verificar se o sistema está atualizado baseado nos componentes
const systemUpToDate = integrityPercent === '100.0' && integrity.missing === 0;

if (systemUpToDate) {
  log('✓ Sistema está completo e atualizado', 'green');
} else {
  log('⚠ Sistema possui componentes faltando', 'yellow');
  log('  └─ Execute o script de instalação para seu SO', 'blue');
}

console.log('');

// ============================================================================
// COMANDOS ÚTEIS
// ============================================================================

header('COMANDOS ÚTEIS');

console.log('Validar sistema completo:');
log('  npm run validate:system', 'cyan');
console.log('');

console.log('Testar extração v2.0:');
log('  npm run extract:v2 /caminho/documento.pdf', 'cyan');
console.log('');

console.log('Criar pacote para distribuição:');
log('  npm run package:whatsapp', 'cyan');
console.log('');

console.log('Executar setup (escolha seu SO):');
log('  npm run setup:windows  # Windows', 'cyan');
log('  npm run setup:mac      # macOS', 'cyan');
log('  npm run setup:linux    # Linux', 'cyan');
console.log('');

// ============================================================================
// RESUMO FINAL
// ============================================================================

header('RESUMO FINAL');

const status = {
  version: pkg.version,
  platform: os.platform(),
  nodeVersion: process.version,
  integrity: integrityPercent,
  componentsOk: integrity.ok,
  componentsMissing: integrity.missing,
  hasNodeModules: fs.existsSync('node_modules'),
  hasEnv: fs.existsSync('.env'),
  systemReady: systemUpToDate && fs.existsSync('node_modules') && fs.existsSync('.env')
};

if (status.systemReady) {
  log('╔════════════════════════════════════════════════════════════╗', 'green');
  log('║  ✓ SISTEMA PRONTO PARA USO                                ║', 'green');
  log('╚════════════════════════════════════════════════════════════╝', 'green');
} else {
  log('╔════════════════════════════════════════════════════════════╗', 'yellow');
  log('║  ⚠ SISTEMA REQUER CONFIGURAÇÃO                            ║', 'yellow');
  log('╚════════════════════════════════════════════════════════════╝', 'yellow');

  console.log('');
  log('Passos necessários:', 'bright');

  if (!status.hasNodeModules) {
    log('  1. Execute: npm install', 'yellow');
  }

  if (!status.hasEnv) {
    log('  2. Configure .env com credenciais AWS', 'yellow');
  }

  if (status.componentsMissing > 0) {
    log('  3. Execute o script de setup para seu SO', 'yellow');
  }
}

console.log('');

// Exit code
process.exit(status.systemReady ? 0 : 1);
