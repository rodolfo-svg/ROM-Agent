/**
 * 🔍 SCRIPT DE DIAGNÓSTICO DE UPLOAD
 *
 * Execute este script no console do navegador em iarom.com.br
 * para investigar por que o upload está travado em chunk 1/2
 */

(function() {
  console.log('🔍 INICIANDO DIAGNÓSTICO DE UPLOAD');
  console.log('=====================================\n');

  // 1. VERIFICAR ESTADO DO UPLOAD NO LOCALSTORAGE/SESSIONSTORAGE
  console.log('📦 1. ESTADO DE ARMAZENAMENTO');
  console.log('─────────────────────────────────');

  const localStorage_keys = Object.keys(localStorage);
  const sessionStorage_keys = Object.keys(sessionStorage);

  console.log(`LocalStorage (${localStorage_keys.length} items):`);
  localStorage_keys.forEach(key => {
    if (key.toLowerCase().includes('upload') || key.toLowerCase().includes('chunk') || key.toLowerCase().includes('file')) {
      console.log(`  ✓ ${key}:`, localStorage.getItem(key));
    }
  });

  console.log(`\nSessionStorage (${sessionStorage_keys.length} items):`);
  sessionStorage_keys.forEach(key => {
    if (key.toLowerCase().includes('upload') || key.toLowerCase().includes('chunk') || key.toLowerCase().includes('file')) {
      console.log(`  ✓ ${key}:`, sessionStorage.getItem(key));
    }
  });

  // 2. VERIFICAR REQUISIÇÕES DE REDE ATIVAS
  console.log('\n🌐 2. REQUISIÇÕES DE REDE');
  console.log('─────────────────────────────────');

  if (window.performance && window.performance.getEntries) {
    const resources = window.performance.getEntriesByType('resource');
    const uploadRequests = resources.filter(r =>
      r.name.includes('/upload') ||
      r.name.includes('/chunk') ||
      r.name.includes('/api/documents')
    );

    console.log(`Total de requisições de upload: ${uploadRequests.length}`);
    uploadRequests.slice(-5).forEach(req => {
      console.log(`  ${req.name}`);
      console.log(`    Duração: ${req.duration.toFixed(2)}ms`);
      console.log(`    Tamanho: ${(req.transferSize / 1024).toFixed(2)} KB`);
    });
  }

  // 3. VERIFICAR CONEXÕES WEBSOCKET/SOCKET.IO
  console.log('\n🔌 3. CONEXÕES WEBSOCKET');
  console.log('─────────────────────────────────');

  if (typeof io !== 'undefined' && io.Socket) {
    console.log('Socket.IO detectado');
    // Tentar acessar instâncias globais de socket
    if (window.socket) {
      console.log('  Socket global encontrado:', window.socket);
      console.log('  Conectado:', window.socket.connected);
      console.log('  ID:', window.socket.id);
    }
  } else {
    console.log('❌ Socket.IO não detectado');
  }

  // 4. VERIFICAR FETCH/XMLHTTPREQUEST PENDENTES
  console.log('\n⏳ 4. REQUISIÇÕES PENDENTES');
  console.log('─────────────────────────────────');

  // Interceptar fetch temporariamente para ver requisições ativas
  const originalFetch = window.fetch;
  let activeFetches = [];

  window.fetch = function(...args) {
    const fetchId = Date.now();
    activeFetches.push({ id: fetchId, url: args[0], start: new Date() });

    return originalFetch.apply(this, args).finally(() => {
      activeFetches = activeFetches.filter(f => f.id !== fetchId);
    });
  };

  console.log('Fetch interceptor instalado. Aguarde 2 segundos...');

  setTimeout(() => {
    console.log(`Requisições ativas: ${activeFetches.length}`);
    activeFetches.forEach(f => {
      console.log(`  ${f.url} (${Date.now() - f.start.getTime()}ms)`);
    });

    // Restaurar fetch original
    window.fetch = originalFetch;
  }, 2000);

  // 5. VERIFICAR ERROS DE JAVASCRIPT
  console.log('\n❌ 5. ERROS DE JAVASCRIPT');
  console.log('─────────────────────────────────');

  const errors = [];
  const originalError = window.onerror;

  window.onerror = function(msg, url, line, col, error) {
    errors.push({ msg, url, line, col, error });
    if (originalError) {
      return originalError.apply(this, arguments);
    }
  };

  console.log('Listener de erros instalado. Tente fazer upload novamente.');
  console.log('Para ver erros capturados, execute: window.uploadDebugErrors');
  window.uploadDebugErrors = errors;

  // 6. VERIFICAR ESTADO DE UPLOAD NO REACT/VUE
  console.log('\n⚛️ 6. ESTADO DO COMPONENTE DE UPLOAD');
  console.log('─────────────────────────────────');

  // Tentar encontrar elementos relacionados a upload
  const uploadElements = document.querySelectorAll('[class*="upload"], [id*="upload"], [data-upload]');
  console.log(`Elementos de upload encontrados: ${uploadElements.length}`);

  uploadElements.forEach((el, i) => {
    console.log(`  Elemento ${i + 1}:`, el.className || el.id);
    // Tentar acessar propriedades React
    const reactKey = Object.keys(el).find(key => key.startsWith('__react'));
    if (reactKey) {
      console.log('    Props React:', el[reactKey]);
    }
  });

  // 7. VERIFICAR CONSOLE LOGS ANTERIORES
  console.log('\n📝 7. LOGS RECENTES');
  console.log('─────────────────────────────────');
  console.log('Verifique a aba Console para logs começando com:');
  console.log('  - 📦 [VolumeUploader]');
  console.log('  - 📤 Chunk');
  console.log('  - UploadPage');
  console.log('  - Extraction');

  // 8. FUNÇÃO AUXILIAR PARA FORÇAR RETRY
  console.log('\n🔄 8. FUNÇÕES DE CONTROLE');
  console.log('─────────────────────────────────');

  window.forceUploadRetry = function() {
    console.log('🔄 Tentando forçar retry do upload...');

    // Procurar botões de retry/upload
    const buttons = Array.from(document.querySelectorAll('button'));
    const uploadButton = buttons.find(b =>
      b.textContent.includes('Upload') ||
      b.textContent.includes('Tentar') ||
      b.textContent.includes('Retry')
    );

    if (uploadButton) {
      console.log('✓ Botão encontrado, clicando...');
      uploadButton.click();
    } else {
      console.log('❌ Nenhum botão de upload/retry encontrado');
    }
  };

  window.clearUploadState = function() {
    console.log('🗑️ Limpando estado de upload...');

    // Limpar localStorage/sessionStorage relacionados
    [...localStorage_keys, ...sessionStorage_keys].forEach(key => {
      if (key.toLowerCase().includes('upload') || key.toLowerCase().includes('chunk')) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
        console.log(`  ✓ Removido: ${key}`);
      }
    });

    console.log('✅ Estado limpo. Recarregue a página.');
  };

  // 9. VERIFICAR NETWORK TAB PROGRAMATICAMENTE
  console.log('\n🌐 9. REQUISIÇÕES HTTP RECENTES');
  console.log('─────────────────────────────────');

  if (window.performance) {
    const entries = window.performance.getEntriesByType('resource');
    const recent = entries.slice(-10);

    console.log('Últimas 10 requisições:');
    recent.forEach(entry => {
      const status = entry.responseStatus || '?';
      const duration = entry.duration.toFixed(0);
      const size = entry.transferSize ? `${(entry.transferSize / 1024).toFixed(1)}KB` : '?';

      console.log(`  [${status}] ${duration}ms ${size} - ${entry.name.split('?')[0]}`);
    });
  }

  // 10. RESUMO E PRÓXIMOS PASSOS
  console.log('\n✅ DIAGNÓSTICO COMPLETO!');
  console.log('=====================================');
  console.log('\n📋 FUNÇÕES DISPONÍVEIS:');
  console.log('  - window.forceUploadRetry() - Tenta forçar retry do upload');
  console.log('  - window.clearUploadState() - Limpa estado e cache de upload');
  console.log('  - window.uploadDebugErrors - Array de erros capturados');
  console.log('\n🔍 PRÓXIMOS PASSOS:');
  console.log('  1. Abra a aba Network e filtre por "upload" ou "chunk"');
  console.log('  2. Verifique se há requisições em estado "pending"');
  console.log('  3. Verifique se há requisições com status 4xx/5xx');
  console.log('  4. Procure por logs começando com 📦 ou 📤 no console');
  console.log('  5. Se necessário, execute window.clearUploadState() e recarregue');

})();
