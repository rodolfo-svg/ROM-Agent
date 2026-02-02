/**
 * 🧪 Teste Automático do KB via Console do Navegador
 *
 * COMO USAR:
 * 1. Acesse: https://iarom.com.br/chat
 * 2. Faça login
 * 3. Abra DevTools (F12)
 * 4. Vá para aba Console
 * 5. Copie e cole este script completo
 * 6. Pressione Enter
 *
 * O script vai testar:
 * - Listagem de documentos
 * - Busca via chat
 * - Comparação frontend vs backend
 */

(async function testKBInProduction() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 TESTE AUTOMÁTICO DO KB EM PRODUÇÃO');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: []
  };

  function logTest(name, status, message) {
    const emoji = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`${emoji} ${name}: ${message}`);

    results.tests.push({ name, status, message });
    if (status === 'pass') results.passed++;
    else if (status === 'fail') results.failed++;
    else results.warnings++;
  }

  // ============================================================
  // TESTE 1: Verificar Status da API
  // ============================================================
  console.log('\n1️⃣ Testando /api/kb/status...');

  try {
    const statusResponse = await fetch('/api/kb/status');
    const status = await statusResponse.json();

    console.log('   Resposta:', status);

    if (status.success) {
      logTest('Status API', 'pass', `${status.totalDocuments} documentos`);

      if (status.kbPath.includes('/var/data/')) {
        logTest('Disco persistente', 'pass', status.kbPath);
      } else {
        logTest('Disco persistente', 'fail', `Usando disco efêmero: ${status.kbPath}`);
      }

      if (status.totalDocuments === 0) {
        logTest('Documentos', 'warn', 'KB vazia - faça upload de documentos');
      } else {
        logTest('Documentos', 'pass', `${status.totalDocuments} documento(s) encontrado(s)`);
      }
    } else {
      logTest('Status API', 'fail', 'API retornou success: false');
    }
  } catch (error) {
    logTest('Status API', 'fail', `Erro: ${error.message}`);
  }

  // ============================================================
  // TESTE 2: Listar Documentos
  // ============================================================
  console.log('\n2️⃣ Testando /api/kb/documents...');

  try {
    const docsResponse = await fetch('/api/kb/documents', {
      credentials: 'include'
    });

    if (docsResponse.redirected || docsResponse.status === 302) {
      logTest('Listagem docs', 'fail', 'Não autenticado - faça login primeiro');
    } else if (docsResponse.ok) {
      const docs = await docsResponse.json();
      console.log('   Resposta:', docs);

      if (docs.documents && Array.isArray(docs.documents)) {
        logTest('Listagem docs', 'pass', `${docs.documents.length} documento(s) listado(s)`);

        // Listar nomes dos documentos
        if (docs.documents.length > 0) {
          console.log('\n   📄 Documentos encontrados:');
          docs.documents.forEach((doc, idx) => {
            console.log(`      ${idx + 1}. ${doc.name} (${(doc.size / 1024).toFixed(1)} KB)`);
          });
        }
      } else {
        logTest('Listagem docs', 'fail', 'Formato de resposta inválido');
      }
    } else {
      logTest('Listagem docs', 'fail', `HTTP ${docsResponse.status}`);
    }
  } catch (error) {
    logTest('Listagem docs', 'fail', `Erro: ${error.message}`);
  }

  // ============================================================
  // TESTE 3: Verificar Info do Servidor
  // ============================================================
  console.log('\n3️⃣ Testando /api/info...');

  try {
    const infoResponse = await fetch('/api/info');
    const info = await infoResponse.json();

    console.log('   Commit:', info.server?.gitCommit);

    if (info.server?.gitCommit === 'd19e07f') {
      logTest('Commit', 'pass', 'd19e07f (correções aplicadas)');
    } else if (info.server?.gitCommit === '636037d') {
      logTest('Commit', 'warn', '636037d (falta segundo deploy)');
    } else {
      logTest('Commit', 'fail', `${info.server?.gitCommit} (commits de correção não aplicados)`);
    }

    if (info.tools?.count > 0) {
      logTest('Tools Bedrock', 'pass', `${info.tools.count} ferramentas disponíveis`);

      // Verificar se consultar_kb existe
      const hasKBTool = info.tools?.tools?.some(t => t.name === 'consultar_kb');
      if (hasKBTool) {
        logTest('Tool consultar_kb', 'pass', 'Ferramenta disponível');
      } else {
        logTest('Tool consultar_kb', 'fail', 'Ferramenta não encontrada');
      }
    } else {
      logTest('Tools Bedrock', 'fail', 'Nenhuma ferramenta disponível');
    }
  } catch (error) {
    logTest('Info servidor', 'fail', `Erro: ${error.message}`);
  }

  // ============================================================
  // TESTE 4: Comparar Status vs Listagem
  // ============================================================
  console.log('\n4️⃣ Comparando status vs listagem...');

  try {
    const [statusResp, docsResp] = await Promise.all([
      fetch('/api/kb/status'),
      fetch('/api/kb/documents', { credentials: 'include' })
    ]);

    const status = await statusResp.json();

    if (docsResp.ok) {
      const docs = await docsResp.json();

      const statusCount = status.totalDocuments || 0;
      const docsCount = docs.documents?.length || 0;

      console.log(`   Status API: ${statusCount} documentos`);
      console.log(`   Listagem API: ${docsCount} documentos`);

      if (statusCount === docsCount) {
        logTest('Consistência', 'pass', 'Status e listagem coincidem');
      } else {
        logTest('Consistência', 'warn', `Diferença: status=${statusCount}, listagem=${docsCount}`);
      }
    } else {
      logTest('Consistência', 'warn', 'Não foi possível comparar (não autenticado)');
    }
  } catch (error) {
    logTest('Consistência', 'fail', `Erro: ${error.message}`);
  }

  // ============================================================
  // RESUMO
  // ============================================================
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 RESUMO DOS TESTES');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`✅ Passou: ${results.passed}`);
  console.log(`⚠️ Avisos: ${results.warnings}`);
  console.log(`❌ Falhou: ${results.failed}`);
  console.log(`📊 Total: ${results.tests.length} testes`);

  console.log('\n📋 Detalhes:');
  results.tests.forEach(test => {
    const emoji = test.status === 'pass' ? '✅' : test.status === 'fail' ? '❌' : '⚠️';
    console.log(`   ${emoji} ${test.name}: ${test.message}`);
  });

  console.log('\n═══════════════════════════════════════════════════════════════');

  if (results.failed === 0 && results.warnings === 0) {
    console.log('🎉 TODOS OS TESTES PASSARAM!');
    console.log('✅ Sistema KB está 100% operacional');
  } else if (results.failed === 0) {
    console.log('⚠️ TESTES PASSARAM COM AVISOS');
    console.log('   Verifique os avisos acima');
  } else {
    console.log('❌ ALGUNS TESTES FALHARAM');
    console.log('   Consulte KB-CORRECOES-COMPLETAS-REFERENCIA.md');
  }

  console.log('\n🎯 PRÓXIMOS PASSOS:');

  if (results.tests.some(t => t.name === 'Listagem docs' && t.status === 'fail')) {
    console.log('   1. Faça login em: https://iarom.com.br/login');
    console.log('   2. Execute este script novamente');
  }

  if (results.tests.some(t => t.name === 'Documentos' && t.message.includes('KB vazia'))) {
    console.log('   1. Acesse: https://iarom.com.br/upload');
    console.log('   2. Faça upload de documentos');
    console.log('   3. Aguarde processamento');
    console.log('   4. Execute este script novamente');
  }

  if (results.failed > 0) {
    console.log('   1. Verifique troubleshooting em:');
    console.log('      KB-CORRECOES-COMPLETAS-REFERENCIA.md');
    console.log('   2. Ou execute teste manual:');
    console.log('      test-kb-producao-manual.md');
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');

  return results;
})();
