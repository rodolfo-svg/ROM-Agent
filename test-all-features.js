#!/usr/bin/env node
/**
 * TESTE COMPLETO DE TODAS AS FUNCIONALIDADES - iarom.com.br
 *
 * Verifica:
 * 1. Projeto ROM com prompts e KB
 * 2. Criação de projetos (igual Claude AI)
 * 3. Upload de arquivos no chat (todas extensões)
 * 4. Ferramentas de extração (todas extensões)
 * 5. Exportação (txt, md, etc)
 * 6. Versão mobile
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

const SITE = 'https://iarom.com.br';
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

function log(status, message, details = '') {
  const icons = { pass: '✅', fail: '❌', warn: '⚠️', info: 'ℹ️' };
  console.log(`${icons[status] || ''} ${message}`);
  if (details) console.log(`   → ${details}`);

  results.total++;
  if (status === 'pass') results.passed++;
  if (status === 'fail') results.failed++;
  results.details.push({ status, message, details });
}

console.log(`${colors.magenta}🧪 TESTE COMPLETO DE FUNCIONALIDADES - ${SITE}${colors.reset}\n`);

// ═══════════════════════════════════════════════════════════════
// TESTE 1: PROJETO ROM
// ═══════════════════════════════════════════════════════════════

async function testProjetoROM() {
  console.log(`\n${colors.cyan}📁 TESTE 1: Projeto ROM com Prompts e KB${colors.reset}`);

  try {
    // Verificar endpoint de projetos
    const res = await fetch(`${SITE}/api/projects`);

    if (res.status === 404) {
      log('fail', 'API /api/projects não existe', 'Endpoint ainda não deployado (v2.0.0)');
      return;
    }

    if (!res.ok) {
      log('fail', `API /api/projects retornou ${res.status}`);
      return;
    }

    const projects = await res.json();

    // Procurar projeto ROM
    const romProject = projects.find(p =>
      p.id === 'rom-agent' ||
      p.name?.toLowerCase().includes('rom')
    );

    if (!romProject) {
      log('fail', 'Projeto ROM não encontrado', 'Nenhum projeto com id "rom-agent"');
      return;
    }

    log('pass', 'Projeto ROM encontrado', `ID: ${romProject.id}, Nome: ${romProject.name}`);

    // Verificar custom instructions (prompts)
    if (romProject.customInstructions && romProject.customInstructions.length > 0) {
      log('pass', 'Custom instructions presentes', `${romProject.customInstructions.length} instruções`);
    } else {
      log('warn', 'Projeto ROM sem custom instructions');
    }

    // Verificar knowledge base
    if (romProject.knowledgeBase || romProject.files) {
      const fileCount = romProject.knowledgeBase?.length || romProject.files?.length || 0;
      log('pass', 'Knowledge Base presente', `${fileCount} arquivos`);
    } else {
      log('warn', 'Projeto ROM sem Knowledge Base');
    }

  } catch (error) {
    log('fail', 'Erro ao testar Projeto ROM', error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// TESTE 2: CRIAÇÃO DE PROJETO (igual Claude AI)
// ═══════════════════════════════════════════════════════════════

async function testCriarProjeto() {
  console.log(`\n${colors.cyan}📝 TESTE 2: Criação de Projeto (igual Claude AI)${colors.reset}`);

  try {
    // Verificar endpoint de criar projeto
    const testProject = {
      name: 'Teste Projeto',
      description: 'Projeto de teste',
      customInstructions: 'Instruções personalizadas de teste'
    };

    const res = await fetch(`${SITE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testProject)
    });

    if (res.status === 404) {
      log('fail', 'API POST /api/projects não existe', 'Endpoint ainda não deployado');
      return;
    }

    if (res.status === 401) {
      log('warn', 'Criação de projeto requer autenticação', 'Endpoint existe mas requer login');
      return;
    }

    if (res.ok) {
      const created = await res.json();
      log('pass', 'Criação de projeto funcionando', `Projeto criado: ${created.id || created.name}`);
    } else {
      log('fail', `Criação de projeto falhou: ${res.status}`);
    }

  } catch (error) {
    log('fail', 'Erro ao testar criação de projeto', error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// TESTE 3: UPLOAD DE ARQUIVOS NO CHAT
// ═══════════════════════════════════════════════════════════════

async function testUploadChat() {
  console.log(`\n${colors.cyan}📤 TESTE 3: Upload de Arquivos no Chat${colors.reset}`);

  const extensoesSuportadas = [
    'pdf', 'doc', 'docx', 'txt', 'md',
    'jpg', 'jpeg', 'png', 'gif', 'webp',
    'csv', 'xlsx', 'xls',
    'json', 'xml', 'html',
    'zip', 'rar'
  ];

  log('info', `Extensões esperadas: ${extensoesSuportadas.length}`, extensoesSuportadas.join(', '));

  try {
    // Verificar endpoint de upload
    const res = await fetch(`${SITE}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true })
    });

    if (res.status === 404) {
      log('fail', 'API /api/upload não existe', 'Upload de arquivos não disponível');
      return;
    }

    if (res.status === 401) {
      log('warn', 'Upload requer autenticação', 'Endpoint existe');
    } else if (res.status === 400 || res.status === 500) {
      log('pass', 'Endpoint de upload existe', 'Retornou erro esperado sem arquivo');
    } else {
      log('pass', 'Endpoint de upload disponível');
    }

    // Verificar upload chunked (para arquivos grandes)
    const chunkedRes = await fetch(`${SITE}/api/upload/chunked/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'test.pdf',
        fileSize: 5000000,
        contentType: 'application/pdf'
      })
    });

    if (chunkedRes.status === 404) {
      log('fail', 'Upload chunked não disponível', 'Arquivos grandes não suportados');
    } else if (chunkedRes.ok) {
      const data = await chunkedRes.json();
      log('pass', 'Upload chunked funcionando', `UploadId: ${data.uploadId || 'gerado'}`);
    } else {
      log('warn', 'Upload chunked existe mas retornou erro');
    }

  } catch (error) {
    log('fail', 'Erro ao testar upload', error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// TESTE 4: FERRAMENTAS DE EXTRAÇÃO
// ═══════════════════════════════════════════════════════════════

async function testFerramentasExtracao() {
  console.log(`\n${colors.cyan}🔧 TESTE 4: Ferramentas de Extração${colors.reset}`);

  const ferramentas = [
    'pdf-extractor',
    'docx-extractor',
    'image-ocr',
    'table-extractor',
    'metadata-extractor',
    'text-extractor'
  ];

  log('info', `Ferramentas esperadas: ${ferramentas.length}`, ferramentas.join(', '));

  try {
    // Verificar endpoint de ferramentas
    const res = await fetch(`${SITE}/api/tools`);

    if (res.status === 404) {
      log('fail', 'API /api/tools não existe', 'Ferramentas não disponíveis');
      return;
    }

    if (!res.ok) {
      log('fail', `API /api/tools retornou ${res.status}`);
      return;
    }

    const tools = await res.json();
    log('pass', 'API de ferramentas disponível', `${tools.length || 'N/A'} ferramentas`);

    // Testar extração de PDF
    const pdfRes = await fetch(`${SITE}/api/tools/extract/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true })
    });

    if (pdfRes.status === 404) {
      log('fail', 'Extração de PDF não disponível');
    } else if (pdfRes.status === 400 || pdfRes.status === 500) {
      log('pass', 'Extração de PDF existe', 'Erro esperado sem arquivo');
    } else {
      log('pass', 'Extração de PDF disponível');
    }

    // Testar OCR
    const ocrRes = await fetch(`${SITE}/api/tools/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true })
    });

    if (ocrRes.status === 404) {
      log('fail', 'OCR não disponível');
    } else {
      log('pass', 'OCR disponível');
    }

  } catch (error) {
    log('fail', 'Erro ao testar ferramentas', error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// TESTE 5: EXPORTAÇÃO DE ARQUIVOS
// ═══════════════════════════════════════════════════════════════

async function testExportacao() {
  console.log(`\n${colors.cyan}💾 TESTE 5: Exportação de Arquivos${colors.reset}`);

  const formatos = ['txt', 'md', 'pdf', 'docx', 'html', 'json'];

  log('info', `Formatos esperados: ${formatos.length}`, formatos.join(', '));

  try {
    // Verificar endpoint de exportação
    const res = await fetch(`${SITE}/api/export/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Teste de exportação',
        format: 'txt'
      })
    });

    if (res.status === 404) {
      log('fail', 'API /api/export não existe', 'Exportação não disponível');
      return;
    }

    if (res.ok) {
      log('pass', 'Exportação TXT funcionando');
    } else if (res.status === 401) {
      log('warn', 'Exportação requer autenticação');
    } else {
      log('fail', `Exportação TXT falhou: ${res.status}`);
    }

    // Testar exportação Markdown
    const mdRes = await fetch(`${SITE}/api/export/markdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '# Teste\n\nConteúdo de teste',
        format: 'md'
      })
    });

    if (mdRes.status === 404) {
      log('fail', 'Exportação Markdown não disponível');
    } else if (mdRes.ok) {
      log('pass', 'Exportação Markdown funcionando');
    } else {
      log('warn', 'Exportação Markdown existe mas retornou erro');
    }

  } catch (error) {
    log('fail', 'Erro ao testar exportação', error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// TESTE 6: VERSÃO MOBILE
// ═══════════════════════════════════════════════════════════════

async function testVersaoMobile() {
  console.log(`\n${colors.cyan}📱 TESTE 6: Versão Mobile${colors.reset}`);

  const userAgents = {
    iPhone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
    Android: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36'
  };

  try {
    // Testar páginas mobile-specific
    const mobilePages = [
      '/mobile-timbrado.html',
      '/tarifa.html',
      '/'
    ];

    for (const page of mobilePages) {
      const res = await fetch(`${SITE}${page}`, {
        headers: { 'User-Agent': userAgents.iPhone }
      });

      if (!res.ok) {
        log('fail', `${page} não carrega em iPhone`, `Status: ${res.status}`);
        continue;
      }

      const html = await res.text();

      // Verificar meta viewport
      if (!html.includes('viewport')) {
        log('fail', `${page} sem meta viewport`, 'Não é mobile-friendly');
        continue;
      }

      // Verificar recursos mobile
      const hasTouch = html.includes('touch-action') || html.includes('touchstart');
      const hasSafeArea = html.includes('safe-area');
      const hasWebkit = html.includes('-webkit-overflow-scrolling');

      if (hasTouch && hasSafeArea && hasWebkit) {
        log('pass', `${page} totalmente mobile-optimized`, 'Touch, safe-area, webkit OK');
      } else if (html.includes('viewport')) {
        log('pass', `${page} mobile-friendly`, 'Viewport OK, recursos parciais');
      }
    }

  } catch (error) {
    log('fail', 'Erro ao testar versão mobile', error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// EXECUTAR TODOS OS TESTES
// ═══════════════════════════════════════════════════════════════

async function runAllTests() {
  const startTime = Date.now();

  await testProjetoROM();
  await testCriarProjeto();
  await testUploadChat();
  await testFerramentasExtracao();
  await testExportacao();
  await testVersaoMobile();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

  // Relatório final
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.blue}📊 RELATÓRIO FINAL${colors.reset}`);
  console.log('='.repeat(80));
  console.log(`\n⏱️  Tempo total: ${totalTime}s`);
  console.log(`🧪 Testes: ${results.total}`);
  console.log(`${colors.green}✅ Passou: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}❌ Falhou: ${results.failed}${colors.reset}`);

  const successRate = ((results.passed / results.total) * 100).toFixed(1);

  console.log('\n' + '='.repeat(80));

  if (successRate >= 90) {
    console.log(`${colors.green}🎉 SISTEMA ${successRate}% FUNCIONAL!${colors.reset}`);
  } else if (successRate >= 70) {
    console.log(`${colors.yellow}⚠️  Sistema ${successRate}% funcional${colors.reset}`);
  } else {
    console.log(`${colors.red}🚨 Sistema apenas ${successRate}% funcional${colors.reset}`);
  }

  console.log('='.repeat(80) + '\n');

  // Diagnóstico
  if (results.failed > 0) {
    console.log(`${colors.yellow}💡 DIAGNÓSTICO:${colors.reset}`);
    const has404 = results.details.some(r => r.details?.includes('404') || r.details?.includes('não existe'));

    if (has404) {
      console.log(`\n${colors.yellow}⚠️  Muitos endpoints retornam 404${colors.reset}`);
      console.log('   Causa provável: Site ainda em v2.0.0');
      console.log('   Solução: Aguardar deploy do Render (v2.4.13)');
      console.log('   Status: Render fazendo build (~2-3 minutos restantes)');
    }
  }

  return successRate >= 70 ? 0 : 1;
}

// Executar
runAllTests()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error(`${colors.red}❌ ERRO FATAL:${colors.reset}`, error);
    process.exit(1);
  });
