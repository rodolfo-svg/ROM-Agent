// ============================================================
// DIAGNÓSTICO DE LOGIN - ROM AGENT
// ============================================================
// Cole este código no Console do navegador (F12) para diagnosticar
// problemas de login
//
// COMO USAR:
// 1. Abra https://iarom.com.br em aba anônima
// 2. Pressione F12 para abrir Console
// 3. Cole este código inteiro e pressione Enter
// 4. Você verá logs detalhados do processo de login
// ============================================================

(async function diagnosticoLogin() {
  console.clear();
  console.log('%c═══════════════════════════════════════════', 'color: #d97706; font-weight: bold');
  console.log('%c DIAGNÓSTICO DE LOGIN - ROM AGENT', 'color: #d97706; font-weight: bold');
  console.log('%c═══════════════════════════════════════════', 'color: #d97706; font-weight: bold');
  console.log('');

  const results = {
    timestamp: new Date().toISOString(),
    checks: []
  };

  // ============================================================
  // 1. SERVICE WORKER
  // ============================================================
  console.log('%c[1/8] Verificando Service Worker...', 'color: #0ea5e9; font-weight: bold');

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();

    if (registrations.length === 0) {
      console.log('⚠️  Nenhum Service Worker registrado');
      results.checks.push({
        name: 'Service Worker',
        status: 'warning',
        message: 'Não registrado (esperado em modo dev)'
      });
    } else {
      registrations.forEach((reg, i) => {
        console.log(`✅ SW ${i + 1}: ${reg.scope}`);
        console.log(`   - Installing: ${reg.installing ? 'sim' : 'não'}`);
        console.log(`   - Waiting: ${reg.waiting ? 'sim' : 'não'}`);
        console.log(`   - Active: ${reg.active ? 'sim' : 'não'}`);

        if (reg.active) {
          console.log(`   - State: ${reg.active.state}`);
        }
      });

      results.checks.push({
        name: 'Service Worker',
        status: 'ok',
        count: registrations.length
      });
    }
  } else {
    console.log('❌ Service Worker não suportado neste navegador');
    results.checks.push({
      name: 'Service Worker',
      status: 'error',
      message: 'Não suportado'
    });
  }

  console.log('');

  // ============================================================
  // 2. BACKEND HEALTH
  // ============================================================
  console.log('%c[2/8] Verificando Backend Health...', 'color: #0ea5e9; font-weight: bold');

  try {
    const healthRes = await fetch('/health');
    const healthData = await healthRes.json();

    console.log('✅ Backend:', healthData.status);
    console.log('   - PostgreSQL:', healthData.database?.postgres?.available ? 'conectado' : 'desconectado');
    console.log('   - Redis:', healthData.database?.redis?.available ? 'conectado' : 'desconectado');

    results.checks.push({
      name: 'Backend Health',
      status: 'ok',
      data: healthData
    });
  } catch (err) {
    console.log('❌ Erro ao checar backend:', err.message);
    results.checks.push({
      name: 'Backend Health',
      status: 'error',
      error: err.message
    });
  }

  console.log('');

  // ============================================================
  // 3. CSRF TOKEN
  // ============================================================
  console.log('%c[3/8] Testando CSRF Token...', 'color: #0ea5e9; font-weight: bold');

  try {
    const csrfRes = await fetch('/api/auth/csrf-token', {
      credentials: 'include'
    });

    if (csrfRes.ok) {
      const csrfData = await csrfRes.json();
      console.log('✅ CSRF Token obtido:', csrfData.csrfToken?.substring(0, 20) + '...');

      results.checks.push({
        name: 'CSRF Token',
        status: 'ok',
        tokenLength: csrfData.csrfToken?.length
      });
    } else {
      console.log('❌ Falha ao obter CSRF token:', csrfRes.status);
      results.checks.push({
        name: 'CSRF Token',
        status: 'error',
        httpStatus: csrfRes.status
      });
    }
  } catch (err) {
    console.log('❌ Erro ao buscar CSRF token:', err.message);
    results.checks.push({
      name: 'CSRF Token',
      status: 'error',
      error: err.message
    });
  }

  console.log('');

  // ============================================================
  // 4. LOGIN ENDPOINT
  // ============================================================
  console.log('%c[4/8] Testando Login Endpoint...', 'color: #0ea5e9; font-weight: bold');

  try {
    const loginRes = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@test.com',
        password: 'wrongpassword'
      }),
      credentials: 'include'
    });

    const loginData = await loginRes.json();

    if (loginRes.status === 200 || loginRes.status === 401) {
      console.log('✅ Endpoint /api/auth/login responde');
      console.log('   - Status:', loginRes.status);
      console.log('   - Response:', loginData);

      results.checks.push({
        name: 'Login Endpoint',
        status: 'ok',
        httpStatus: loginRes.status,
        response: loginData
      });
    } else {
      console.log('⚠️  Status inesperado:', loginRes.status);
      results.checks.push({
        name: 'Login Endpoint',
        status: 'warning',
        httpStatus: loginRes.status
      });
    }
  } catch (err) {
    console.log('❌ Erro ao testar login endpoint:', err.message);
    results.checks.push({
      name: 'Login Endpoint',
      status: 'error',
      error: err.message
    });
  }

  console.log('');

  // ============================================================
  // 5. ZUSTAND STATE
  // ============================================================
  console.log('%c[5/8] Verificando Zustand Auth State...', 'color: #0ea5e9; font-weight: bold');

  try {
    const persistedAuth = localStorage.getItem('rom-auth');

    if (persistedAuth) {
      const authData = JSON.parse(persistedAuth);
      console.log('📦 Estado persistido encontrado:');
      console.log('   - Usuário:', authData.state?.user?.email || 'nenhum');
      console.log('   - isAuthenticated:', authData.state?.isAuthenticated);

      results.checks.push({
        name: 'Zustand State',
        status: 'ok',
        user: authData.state?.user?.email || null,
        isAuthenticated: authData.state?.isAuthenticated
      });
    } else {
      console.log('📭 Nenhum estado persistido (esperado em aba anônima)');
      results.checks.push({
        name: 'Zustand State',
        status: 'ok',
        message: 'Nenhum estado persistido'
      });
    }
  } catch (err) {
    console.log('❌ Erro ao ler estado:', err.message);
    results.checks.push({
      name: 'Zustand State',
      status: 'error',
      error: err.message
    });
  }

  console.log('');

  // ============================================================
  // 6. CONSOLE ERRORS
  // ============================================================
  console.log('%c[6/8] Verificando Erros no Console...', 'color: #0ea5e9; font-weight: bold');
  console.log('ℹ️  Verifique acima se há erros em vermelho');
  console.log('');

  // ============================================================
  // 7. NETWORK STATUS
  // ============================================================
  console.log('%c[7/8] Verificando Conectividade...', 'color: #0ea5e9; font-weight: bold');
  console.log('🌐 Online:', navigator.onLine ? 'SIM' : 'NÃO');

  results.checks.push({
    name: 'Network Status',
    status: navigator.onLine ? 'ok' : 'error',
    online: navigator.onLine
  });

  console.log('');

  // ============================================================
  // 8. COOKIES
  // ============================================================
  console.log('%c[8/8] Verificando Cookies...', 'color: #0ea5e9; font-weight: bold');

  const cookies = document.cookie.split(';').map(c => c.trim()).filter(c => c);

  if (cookies.length === 0) {
    console.log('🍪 Nenhum cookie presente (esperado em aba anônima)');
    results.checks.push({
      name: 'Cookies',
      status: 'ok',
      count: 0
    });
  } else {
    console.log(`🍪 ${cookies.length} cookie(s) encontrado(s):`);
    cookies.forEach(cookie => {
      const [name] = cookie.split('=');
      console.log(`   - ${name}`);
    });

    results.checks.push({
      name: 'Cookies',
      status: 'ok',
      count: cookies.length
    });
  }

  console.log('');
  console.log('%c═══════════════════════════════════════════', 'color: #10b981; font-weight: bold');
  console.log('%c DIAGNÓSTICO COMPLETO', 'color: #10b981; font-weight: bold');
  console.log('%c═══════════════════════════════════════════', 'color: #10b981; font-weight: bold');
  console.log('');

  // Summary
  const okCount = results.checks.filter(c => c.status === 'ok').length;
  const warningCount = results.checks.filter(c => c.status === 'warning').length;
  const errorCount = results.checks.filter(c => c.status === 'error').length;

  console.log(`✅ OK: ${okCount}`);
  console.log(`⚠️  Warning: ${warningCount}`);
  console.log(`❌ Error: ${errorCount}`);
  console.log('');

  if (errorCount === 0 && warningCount === 0) {
    console.log('%c🎉 SISTEMA FUNCIONANDO PERFEITAMENTE!', 'color: #10b981; font-weight: bold; font-size: 14px');
    console.log('');
    console.log('Se você ainda não consegue fazer login, tente:');
    console.log('1. Recarregar a página (Ctrl+Shift+R ou Cmd+Shift+R)');
    console.log('2. Limpar cache e cookies do site');
    console.log('3. Desabilitar extensões do navegador temporariamente');
    console.log('4. Tentar em outro navegador');
  } else {
    console.log('%c⚠️  PROBLEMAS DETECTADOS - veja detalhes acima', 'color: #ef4444; font-weight: bold; font-size: 14px');
  }

  console.log('');
  console.log('%cResultados completos:', 'color: #6b7280; font-weight: bold');
  console.log(results);
  console.log('');
  console.log('💾 Para salvar este diagnóstico, execute:');
  console.log('%ccopy(JSON.stringify(results, null, 2))', 'background: #1f2937; color: #fbbf24; padding: 4px 8px; border-radius: 4px; font-family: monospace');
  console.log('');

  return results;
})();
