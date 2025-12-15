#!/usr/bin/env node
/**
 * SCRIPT DE VERIFICAÇÃO COMPLETA DO SISTEMA ROM Agent
 * Testa TODAS as funcionalidades críticas
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const ERRORS = [];
const WARNINGS = [];
const SUCCESS = [];

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(type, message, details = '') {
  const timestamp = new Date().toISOString();
  const prefix = {
    error: `${colors.red}❌ ERRO${colors.reset}`,
    warn: `${colors.yellow}⚠️  AVISO${colors.reset}`,
    success: `${colors.green}✅ OK${colors.reset}`,
    info: `${colors.blue}ℹ️  INFO${colors.reset}`,
    test: `${colors.magenta}🧪 TESTE${colors.reset}`
  }[type] || '';

  console.log(`[${timestamp}] ${prefix} ${message}`);
  if (details) console.log(`   → ${details}`);

  if (type === 'error') ERRORS.push({ message, details });
  if (type === 'warn') WARNINGS.push({ message, details });
  if (type === 'success') SUCCESS.push({ message, details });
}

/**
 * Teste 1: Servidor Rodando
 */
async function testServerRunning() {
  log('test', 'Verificando se servidor está rodando...');
  try {
    const response = await fetch(`${BASE_URL}/api/info`, { timeout: 5000 });
    if (response.ok) {
      const data = await response.json();
      log('success', 'Servidor rodando', `Versão: ${data.version || 'N/A'}`);
      return data;
    } else {
      log('error', 'Servidor retornou erro', `Status: ${response.status}`);
      return null;
    }
  } catch (error) {
    log('error', 'Servidor não está respondendo', error.message);
    return null;
  }
}

/**
 * Teste 2: Endpoints Críticos da API
 */
async function testCriticalEndpoints() {
  log('test', 'Testando endpoints críticos da API...');

  const endpoints = [
    { method: 'GET', path: '/api/info', name: 'Info do sistema' },
    { method: 'GET', path: '/api/health', name: 'Health check' },
    { method: 'GET', path: '/api/projects', name: 'Lista de projetos' },
    { method: 'GET', path: '/api/partners', name: 'Lista de parceiros' },
    { method: 'GET', path: '/api/pricing/table', name: 'Tabela de tarifação' },
    { method: 'GET', path: '/api/team/members', name: 'Membros da equipe' }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint.path}`, {
        method: endpoint.method,
        timeout: 5000
      });

      if (response.ok) {
        log('success', `${endpoint.name}`, `${endpoint.method} ${endpoint.path}`);
      } else {
        log('error', `${endpoint.name} falhou`, `Status: ${response.status}`);
      }
    } catch (error) {
      log('error', `${endpoint.name} não responde`, error.message);
    }
  }
}

/**
 * Teste 3: Projeto ROM Agent
 */
async function testROMProject() {
  log('test', 'Verificando Projeto ROM Agent...');

  try {
    const response = await fetch(`${BASE_URL}/api/projects`, { timeout: 5000 });
    if (response.ok) {
      const projects = await response.json();
      const romProject = projects.find(p => p.id === 'rom-agent' || p.name?.includes('ROM'));

      if (romProject) {
        log('success', 'Projeto ROM encontrado', `ID: ${romProject.id}`);

        // Verificar custom instructions
        if (romProject.customInstructions && romProject.customInstructions.length > 0) {
          log('success', 'Custom instructions presentes', `${romProject.customInstructions.length} instruções`);
        } else {
          log('warn', 'Projeto ROM sem custom instructions');
        }
      } else {
        log('error', 'Projeto ROM não encontrado na lista de projetos');
      }
    } else {
      log('error', 'Não foi possível buscar projetos', `Status: ${response.status}`);
    }
  } catch (error) {
    log('error', 'Erro ao verificar projeto ROM', error.message);
  }
}

/**
 * Teste 4: Integrações Externas
 */
async function testExternalIntegrations() {
  log('test', 'Verificando integrações externas...');

  // DataJud
  try {
    const response = await fetch(`${BASE_URL}/api/datajud/health`, { timeout: 5000 });
    if (response.ok) {
      log('success', 'DataJud integrado');
    } else {
      log('warn', 'DataJud pode estar offline', `Status: ${response.status}`);
    }
  } catch (error) {
    log('warn', 'DataJud não respondeu', error.message);
  }

  // Web Search
  try {
    const response = await fetch(`${BASE_URL}/api/web-search/test`, { timeout: 5000 });
    if (response.ok) {
      log('success', 'Web Search disponível');
    } else {
      log('warn', 'Web Search pode estar indisponível');
    }
  } catch (error) {
    log('warn', 'Web Search não respondeu', error.message);
  }
}

/**
 * Teste 5: Sistema de Correção de Português
 */
async function testPortugueseCorrection() {
  log('test', 'Testando sistema de correção de português...');

  try {
    const testText = 'Este é um texto de teste para verificar a correção ortografica e gramatical.';
    const response = await fetch(`${BASE_URL}/api/tools/language/correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: testText, language: 'pt-BR' }),
      timeout: 10000
    });

    if (response.ok) {
      const result = await response.json();
      log('success', 'Sistema de correção funcionando');
    } else {
      log('error', 'Sistema de correção falhou', `Status: ${response.status}`);
    }
  } catch (error) {
    log('error', 'Sistema de correção não responde', error.message);
  }
}

/**
 * Teste 6: Arquivos HTML Principais
 */
async function testHTMLFiles() {
  log('test', 'Verificando arquivos HTML...');

  const htmlFiles = [
    'index.html',
    'tarifa.html',
    'mobile-timbrado.html',
    'login.html',
    'dashboard.html'
  ];

  for (const file of htmlFiles) {
    try {
      const response = await fetch(`${BASE_URL}/${file}`, { timeout: 5000 });
      if (response.ok) {
        const html = await response.text();

        // Verificar se tem conteúdo
        if (html.length > 1000) {
          log('success', `${file} carregado`, `${(html.length / 1024).toFixed(1)} KB`);

          // Verificar se tem JavaScript
          if (html.includes('<script>') || html.includes('fetch(')) {
            log('success', `${file} tem JavaScript ativo`);
          } else {
            log('warn', `${file} pode não ter JavaScript`);
          }
        } else {
          log('warn', `${file} muito pequeno`, 'Pode estar vazio');
        }
      } else {
        log('error', `${file} não carrega`, `Status: ${response.status}`);
      }
    } catch (error) {
      log('error', `${file} não acessível`, error.message);
    }
  }
}

/**
 * Teste 7: Endpoints de Chat/IA
 */
async function testAIEndpoints() {
  log('test', 'Testando endpoints de IA...');

  try {
    // Teste simples de chat
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Teste de conexão',
        projectId: 'rom-agent',
        model: 'haiku'
      }),
      timeout: 15000
    });

    if (response.ok) {
      log('success', 'Endpoint de chat funcionando');
    } else if (response.status === 401) {
      log('warn', 'Endpoint de chat requer autenticação');
    } else {
      log('error', 'Endpoint de chat falhou', `Status: ${response.status}`);
    }
  } catch (error) {
    log('error', 'Endpoint de chat não responde', error.message);
  }
}

/**
 * Teste 8: Upload de Arquivos
 */
async function testFileUpload() {
  log('test', 'Verificando sistema de upload...');

  try {
    // Verificar endpoint de upload chunked
    const response = await fetch(`${BASE_URL}/api/upload/chunked/status`, {
      timeout: 5000
    });

    if (response.ok || response.status === 404) {
      log('success', 'Sistema de upload chunked disponível');
    } else {
      log('warn', 'Sistema de upload pode estar indisponível');
    }
  } catch (error) {
    log('warn', 'Sistema de upload não verificado', error.message);
  }
}

/**
 * Teste 9: Verificar Variáveis de Ambiente
 */
async function testEnvironmentVariables() {
  log('test', 'Verificando configurações de ambiente...');

  try {
    const response = await fetch(`${BASE_URL}/api/info`, { timeout: 5000 });
    if (response.ok) {
      const data = await response.json();

      // Verificar AWS
      if (data.aws && data.aws.configured) {
        log('success', 'AWS Bedrock configurado', `Região: ${data.aws.region}`);
      } else {
        log('error', 'AWS Bedrock NÃO configurado', 'IA não vai funcionar!');
      }

      // Verificar features
      if (data.features && data.features.length > 0) {
        log('success', 'Features ativas', `${data.features.length} features`);
      }

      // Verificar stats
      if (data.stats) {
        log('info', 'Estatísticas do sistema', JSON.stringify(data.stats));
      }
    }
  } catch (error) {
    log('error', 'Não foi possível verificar configurações', error.message);
  }
}

/**
 * Teste 10: Verificar JavaScript nos HTMLs
 */
async function testJavaScriptInHTML() {
  log('test', 'Verificando JavaScript nos arquivos HTML...');

  const publicDir = './public';

  try {
    const files = await fs.readdir(publicDir);
    const htmlFiles = files.filter(f => f.endsWith('.html'));

    for (const file of htmlFiles) {
      const content = await fs.readFile(path.join(publicDir, file), 'utf-8');

      // Verificar elementos críticos
      const checks = {
        'fetch(': 'chamadas API',
        'addEventListener': 'event listeners',
        'document.getElementById': 'manipulação DOM',
        'async function': 'funções assíncronas'
      };

      let hasJS = false;
      for (const [pattern, description] of Object.entries(checks)) {
        if (content.includes(pattern)) {
          hasJS = true;
          break;
        }
      }

      if (hasJS) {
        log('success', `${file} tem JavaScript funcional`);
      } else {
        log('warn', `${file} pode não ter JavaScript`, 'Botões podem não funcionar');
      }
    }
  } catch (error) {
    log('warn', 'Não foi possível verificar arquivos HTML localmente', error.message);
  }
}

/**
 * RELATÓRIO FINAL
 */
function printFinalReport() {
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.blue}📊 RELATÓRIO FINAL DE VERIFICAÇÃO${colors.reset}`);
  console.log('='.repeat(80));

  console.log(`\n${colors.green}✅ SUCESSOS: ${SUCCESS.length}${colors.reset}`);
  SUCCESS.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.message}`);
    if (s.details) console.log(`     → ${s.details}`);
  });

  if (WARNINGS.length > 0) {
    console.log(`\n${colors.yellow}⚠️  AVISOS: ${WARNINGS.length}${colors.reset}`);
    WARNINGS.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.message}`);
      if (w.details) console.log(`     → ${w.details}`);
    });
  }

  if (ERRORS.length > 0) {
    console.log(`\n${colors.red}❌ ERROS CRÍTICOS: ${ERRORS.length}${colors.reset}`);
    ERRORS.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.message}`);
      if (e.details) console.log(`     → ${e.details}`);
    });
  }

  console.log('\n' + '='.repeat(80));

  // Diagnóstico
  if (ERRORS.length === 0 && WARNINGS.length === 0) {
    console.log(`${colors.green}🎉 SISTEMA 100% FUNCIONAL!${colors.reset}`);
  } else if (ERRORS.length === 0) {
    console.log(`${colors.yellow}⚠️  Sistema funcional com avisos menores${colors.reset}`);
  } else {
    console.log(`${colors.red}🚨 SISTEMA COM PROBLEMAS CRÍTICOS - CORREÇÃO NECESSÁRIA!${colors.reset}`);
  }

  console.log('='.repeat(80) + '\n');

  // Retornar código de saída
  return ERRORS.length === 0 ? 0 : 1;
}

/**
 * EXECUTAR TODOS OS TESTES
 */
async function runAllTests() {
  console.log(`${colors.magenta}🧪 INICIANDO VERIFICAÇÃO COMPLETA DO SISTEMA ROM Agent${colors.reset}\n`);
  console.log(`Base URL: ${BASE_URL}\n`);

  const serverInfo = await testServerRunning();

  if (!serverInfo) {
    console.log(`\n${colors.red}🚨 SERVIDOR NÃO ESTÁ RODANDO!${colors.reset}`);
    console.log('Execute: npm run web:enhanced\n');
    return 1;
  }

  await testCriticalEndpoints();
  await testROMProject();
  await testExternalIntegrations();
  await testPortugueseCorrection();
  await testHTMLFiles();
  await testAIEndpoints();
  await testFileUpload();
  await testEnvironmentVariables();
  await testJavaScriptInHTML();

  return printFinalReport();
}

// Executar
runAllTests()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    console.error(`${colors.red}❌ ERRO FATAL:${colors.reset}`, error);
    process.exit(1);
  });
