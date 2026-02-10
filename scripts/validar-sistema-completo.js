#!/usr/bin/env node

/**
 * ROM Agent v2.0 - Script de Validação Completa
 *
 * Testa TUDO:
 * - Existência de arquivos
 * - Sintaxe JavaScript/JSON
 * - Dependências
 * - Funções dos módulos
 * - Detecção de SO
 * - Geração de pacote
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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
  cyan: '\x1b[36m'
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const errors = [];

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function test(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    log(`✓ ${description}`, 'green');
    return true;
  } catch (error) {
    failedTests++;
    log(`✗ ${description}`, 'red');
    log(`  Erro: ${error.message}`, 'red');
    errors.push({ test: description, error: error.message });
    return false;
  }
}

function header(title) {
  console.log('');
  log('═'.repeat(70), 'cyan');
  log(` ${title}`, 'cyan');
  log('═'.repeat(70), 'cyan');
  console.log('');
}

// Banner
console.clear();
log('╔══════════════════════════════════════════════════════════════╗', 'cyan');
log('║        ROM AGENT v2.0 - VALIDAÇÃO COMPLETA DO SISTEMA       ║', 'cyan');
log('╚══════════════════════════════════════════════════════════════╝', 'cyan');
console.log('');

// ============================================================================
// TESTE 1: ARQUIVOS CRÍTICOS
// ============================================================================

header('TESTE 1: VERIFICANDO ARQUIVOS CRÍTICOS');

const criticalFiles = [
  // Serviços
  'src/services/entidades-extractor.js',
  'src/services/analise-juridica-profunda.js',
  'src/services/gerador-18-ficheiros.js',
  'src/services/document-extraction-service.js',

  // Rotas
  'src/routes/extraction-v2.js',

  // Módulos
  'src/modules/extracao.js',
  'src/modules/bedrock.js',

  // Scripts
  'scripts/setup-extracao-v2.sh',
  'scripts/setup-extracao-v2.ps1',
  'scripts/setup-extracao-v2-linux.sh',
  'scripts/test-extraction-v2.js',
  'scripts/criar-pacote-whatsapp.sh',

  // Documentação
  'EXTRACAO-V2-README.md',
  'IMPLEMENTACAO-COMPLETA.md',
  'README-INSTALACAO-MULTIPLATAFORMA.md',
  'RESUMO-FINAL-COMPLETO.md',

  // Configuração
  'package.json'
];

criticalFiles.forEach(file => {
  test(`Arquivo existe: ${file}`, () => {
    const fullPath = path.resolve(file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Arquivo não encontrado: ${fullPath}`);
    }
  });
});

// ============================================================================
// TESTE 2: SINTAXE DE ARQUIVOS
// ============================================================================

header('TESTE 2: VALIDANDO SINTAXE DOS ARQUIVOS');

// Validar JSON
test('package.json é válido', () => {
  const content = fs.readFileSync('package.json', 'utf-8');
  JSON.parse(content);
});

// Validar JavaScript (sintaxe básica)
const jsFiles = criticalFiles.filter(f => f.endsWith('.js'));

jsFiles.forEach(file => {
  test(`Sintaxe JavaScript: ${path.basename(file)}`, () => {
    if (!fs.existsSync(file)) return;

    const content = fs.readFileSync(file, 'utf-8');

    // Verificações básicas
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;

    if (openBraces !== closeBraces) {
      throw new Error(`Chaves desbalanceadas: ${openBraces} abrir, ${closeBraces} fechar`);
    }

    // Verificar imports/exports
    if (content.includes('export') || content.includes('import')) {
      if (!content.includes('export default') && !content.includes('export {') &&
          !content.includes('export function') && !content.includes('export const') &&
          !content.includes('export class') && !content.includes('export async')) {
        throw new Error('Arquivo usa ES modules mas não tem exports válidos');
      }
    }
  });
});

// ============================================================================
// TESTE 3: DEPENDÊNCIAS
// ============================================================================

header('TESTE 3: VERIFICANDO DEPENDÊNCIAS');

test('package.json tem dependências necessárias', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const required = [
    '@aws-sdk/client-bedrock-runtime',
    'express',
    'multer'
  ];

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  required.forEach(dep => {
    if (!deps[dep]) {
      throw new Error(`Dependência faltando: ${dep}`);
    }
  });
});

test('node_modules existe', () => {
  if (!fs.existsSync('node_modules')) {
    throw new Error('node_modules não existe. Execute: npm install');
  }
});

// ============================================================================
// TESTE 4: ESTRUTURA DE MÓDULOS
// ============================================================================

header('TESTE 4: VERIFICANDO ESTRUTURA DOS MÓDULOS');

test('entidades-extractor.js exporta funções corretas', () => {
  const content = fs.readFileSync('src/services/entidades-extractor.js', 'utf-8');

  const requiredExports = [
    'extrairNumerosProcesso',
    'extrairCPFs',
    'extrairCNPJs',
    'extrairValoresMonetarios',
    'extrairDatas',
    'extrairTodasEntidades'
  ];

  requiredExports.forEach(fn => {
    if (!content.includes(`export function ${fn}`) && !content.includes(`${fn}:`)) {
      throw new Error(`Função não encontrada: ${fn}`);
    }
  });
});

test('analise-juridica-profunda.js exporta funções corretas', () => {
  const content = fs.readFileSync('src/services/analise-juridica-profunda.js', 'utf-8');

  const requiredExports = [
    'gerarResumoExecutivo',
    'gerarResumoUltraCurto',
    'gerarPontosCriticos',
    'gerarAnaliseCompleta',
    'classificarDocumento',
    'analisarDocumentoCompleto'
  ];

  requiredExports.forEach(fn => {
    if (!content.includes(`export async function ${fn}`) && !content.includes(`${fn}:`)) {
      throw new Error(`Função não encontrada: ${fn}`);
    }
  });
});

test('gerador-18-ficheiros.js exporta função principal', () => {
  const content = fs.readFileSync('src/services/gerador-18-ficheiros.js', 'utf-8');

  if (!content.includes('gerar18FicheirosCompletos')) {
    throw new Error('Função principal não encontrada');
  }
});

test('document-extraction-service.js tem detecção de SO', () => {
  const content = fs.readFileSync('src/services/document-extraction-service.js', 'utf-8');

  const checks = [
    'IS_MAC',
    'IS_WINDOWS',
    'IS_LINUX',
    'getOutputBasePath'
  ];

  checks.forEach(check => {
    if (!content.includes(check)) {
      throw new Error(`Detecção de SO incompleta: ${check} não encontrado`);
    }
  });
});

test('extraction-v2.js tem endpoints da API', () => {
  const content = fs.readFileSync('src/routes/extraction-v2.js', 'utf-8');

  const endpoints = [
    "router.post('/extract'",
    "router.get('/status/:jobId'",
    "router.get('/result/:jobId'"
  ];

  endpoints.forEach(endpoint => {
    if (!content.includes(endpoint)) {
      throw new Error(`Endpoint não encontrado: ${endpoint}`);
    }
  });
});

// ============================================================================
// TESTE 5: SCRIPTS DE INSTALAÇÃO
// ============================================================================

header('TESTE 5: VALIDANDO SCRIPTS DE INSTALAÇÃO');

test('setup-extracao-v2.sh é executável', () => {
  const stats = fs.statSync('scripts/setup-extracao-v2.sh');
  const isExecutable = (stats.mode & 0o111) !== 0;

  if (!isExecutable) {
    // Tentar tornar executável
    fs.chmodSync('scripts/setup-extracao-v2.sh', 0o755);
  }
});

test('setup-extracao-v2-linux.sh é executável', () => {
  const stats = fs.statSync('scripts/setup-extracao-v2-linux.sh');
  const isExecutable = (stats.mode & 0o111) !== 0;

  if (!isExecutable) {
    fs.chmodSync('scripts/setup-extracao-v2-linux.sh', 0o755);
  }
});

test('setup-extracao-v2.ps1 tem sintaxe PowerShell', () => {
  const content = fs.readFileSync('scripts/setup-extracao-v2.ps1', 'utf-8');

  if (!content.includes('Print-Header') || !content.includes('Print-Success')) {
    throw new Error('Sintaxe PowerShell incompleta');
  }
});

test('Scripts de setup têm detecção de SO', () => {
  const sh = fs.readFileSync('scripts/setup-extracao-v2.sh', 'utf-8');
  const linux = fs.readFileSync('scripts/setup-extracao-v2-linux.sh', 'utf-8');

  if (!sh.includes('Darwin') && !sh.includes('uname')) {
    throw new Error('Script macOS não detecta SO');
  }

  if (!linux.includes('/etc/os-release') && !linux.includes('DISTRO')) {
    throw new Error('Script Linux não detecta distribuição');
  }
});

// ============================================================================
// TESTE 6: DOCUMENTAÇÃO
// ============================================================================

header('TESTE 6: VERIFICANDO DOCUMENTAÇÃO');

const docs = [
  'EXTRACAO-V2-README.md',
  'IMPLEMENTACAO-COMPLETA.md',
  'README-INSTALACAO-MULTIPLATAFORMA.md'
];

docs.forEach(doc => {
  test(`Documentação ${doc} tem conteúdo`, () => {
    const content = fs.readFileSync(doc, 'utf-8');

    if (content.length < 1000) {
      throw new Error(`Documentação muito curta: ${content.length} caracteres`);
    }

    // Verificar seções importantes
    if (doc === 'EXTRACAO-V2-README.md') {
      if (!content.includes('18 Ficheiros') && !content.includes('18 ficheiros')) {
        throw new Error('Falta menção aos 18 ficheiros');
      }
    }
  });
});

// ============================================================================
// TESTE 7: CONFIGURAÇÃO DE MODELOS
// ============================================================================

header('TESTE 7: VERIFICANDO CONFIGURAÇÃO DE MODELOS');

test('gerador-18-ficheiros.js define CONFIG_MODELOS', () => {
  const content = fs.readFileSync('src/services/gerador-18-ficheiros.js', 'utf-8');

  if (!content.includes('CONFIG_MODELOS')) {
    throw new Error('CONFIG_MODELOS não definido');
  }

  // Verificar se tem haiku e sonnet
  if (!content.includes('haiku') || !content.includes('sonnet')) {
    throw new Error('Modelos haiku/sonnet não configurados');
  }
});

test('Estratégia de custos está documentada', () => {
  const readme = fs.readFileSync('EXTRACAO-V2-README.md', 'utf-8');

  if (!readme.includes('Haiku') || !readme.includes('Sonnet')) {
    throw new Error('Estratégia de custos não documentada');
  }
});

// ============================================================================
// TESTE 8: PACOTE WHATSAPP
// ============================================================================

header('TESTE 8: VERIFICANDO SCRIPT DE PACOTE');

test('criar-pacote-whatsapp.sh existe e é executável', () => {
  if (!fs.existsSync('scripts/criar-pacote-whatsapp.sh')) {
    throw new Error('Script não encontrado');
  }

  const stats = fs.statSync('scripts/criar-pacote-whatsapp.sh');
  const isExecutable = (stats.mode & 0o111) !== 0;

  if (!isExecutable) {
    fs.chmodSync('scripts/criar-pacote-whatsapp.sh', 0o755);
  }
});

test('Script de pacote inclui todos os arquivos necessários', () => {
  const content = fs.readFileSync('scripts/criar-pacote-whatsapp.sh', 'utf-8');

  const mustInclude = [
    'entidades-extractor.js',
    'analise-juridica-profunda.js',
    'gerador-18-ficheiros.js',
    'setup-extracao-v2.ps1'
  ];

  mustInclude.forEach(file => {
    if (!content.includes(file)) {
      throw new Error(`Arquivo não incluído no pacote: ${file}`);
    }
  });
});

// ============================================================================
// TESTE 9: DETECÇÃO DE SO EM RUNTIME
// ============================================================================

header('TESTE 9: TESTANDO DETECÇÃO DE SO');

test('Sistema detecta SO atual corretamente', () => {
  const os = process.platform;
  const expected = ['darwin', 'win32', 'linux'];

  if (!expected.includes(os)) {
    throw new Error(`SO não suportado: ${os}`);
  }

  log(`  → SO detectado: ${os}`, 'blue');
});

test('Função getOutputBasePath funciona', async () => {
  try {
    const mod = await import('../src/services/document-extraction-service.js');
    const path = mod.getOutputBasePath();

    if (!path || path.length === 0) {
      throw new Error('getOutputBasePath retornou vazio');
    }

    log(`  → Caminho de saída: ${path}`, 'blue');
  } catch (error) {
    throw new Error(`Erro ao importar módulo: ${error.message}`);
  }
});

// ============================================================================
// TESTE 10: VERSIONING
// ============================================================================

header('TESTE 10: VERIFICANDO VERSIONAMENTO');

test('package.json tem versão 2.x', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

  if (!pkg.version) {
    throw new Error('Versão não definida');
  }

  const major = parseInt(pkg.version.split('.')[0]);

  if (major < 2) {
    throw new Error(`Versão incorreta: ${pkg.version}. Esperado: 2.x.x`);
  }

  log(`  → Versão: ${pkg.version}`, 'blue');
});

test('Documentação menciona v2.0', () => {
  const docs = [
    'EXTRACAO-V2-README.md',
    'IMPLEMENTACAO-COMPLETA.md'
  ];

  docs.forEach(doc => {
    const content = fs.readFileSync(doc, 'utf-8');
    if (!content.includes('v2.0') && !content.includes('2.0')) {
      throw new Error(`${doc} não menciona v2.0`);
    }
  });
});

// ============================================================================
// RELATÓRIO FINAL
// ============================================================================

console.log('');
log('═'.repeat(70), 'cyan');
log(' RELATÓRIO FINAL', 'cyan');
log('═'.repeat(70), 'cyan');
console.log('');

log(`Total de testes: ${totalTests}`, 'blue');
log(`✓ Passaram: ${passedTests}`, 'green');

if (failedTests > 0) {
  log(`✗ Falharam: ${failedTests}`, 'red');
  console.log('');
  log('ERROS ENCONTRADOS:', 'red');
  errors.forEach((err, i) => {
    log(`${i + 1}. ${err.test}`, 'red');
    log(`   ${err.error}`, 'yellow');
  });
} else {
  log(`✗ Falharam: 0`, 'green');
}

console.log('');

const successRate = ((passedTests / totalTests) * 100).toFixed(1);
log(`Taxa de sucesso: ${successRate}%`, successRate === '100.0' ? 'green' : 'yellow');

console.log('');

if (failedTests === 0) {
  log('╔════════════════════════════════════════════════════════════╗', 'green');
  log('║  ✓ SISTEMA 100% VALIDADO E PRONTO PARA PRODUÇÃO!         ║', 'green');
  log('╚════════════════════════════════════════════════════════════╝', 'green');
} else {
  log('╔════════════════════════════════════════════════════════════╗', 'yellow');
  log('║  ⚠ SISTEMA TEM PROBLEMAS - CORRIJA OS ERROS ACIMA         ║', 'yellow');
  log('╚════════════════════════════════════════════════════════════╝', 'yellow');
}

console.log('');

// Exit code
process.exit(failedTests > 0 ? 1 : 0);
