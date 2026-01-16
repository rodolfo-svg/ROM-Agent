// ============================================================
// TESTE DE LOGIN DIRETO - ROM AGENT
// ============================================================
// Cole este código no Console (F12) para testar login passo a passo
// ============================================================

(async function testeLogin() {
  console.clear();
  console.log('%c🔍 TESTE DE LOGIN - DETALHADO', 'color: #0ea5e9; font-weight: bold; font-size: 16px');
  console.log('');

  const email = 'test@test.com';
  const password = 'testpassword';

  try {
    // PASSO 1: Buscar CSRF Token
    console.log('%c[1/4] Buscando CSRF token...', 'color: #6b7280; font-weight: bold');

    const csrfRes = await fetch('/api/auth/csrf-token', {
      credentials: 'include'
    });

    console.log('   - Status:', csrfRes.status);

    if (!csrfRes.ok) {
      console.error('❌ Falha ao buscar CSRF token!');
      return;
    }

    const csrfData = await csrfRes.json();
    const csrfToken = csrfData.csrfToken;

    console.log('   ✅ CSRF token:', csrfToken?.substring(0, 20) + '...');
    console.log('');

    // PASSO 2: Enviar requisição de login
    console.log('%c[2/4] Enviando requisição de login...', 'color: #6b7280; font-weight: bold');
    console.log('   - Email:', email);
    console.log('   - Headers: Content-Type, x-csrf-token');
    console.log('');

    const loginStartTime = Date.now();

    const loginRes = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });

    const loginDuration = Date.now() - loginStartTime;

    console.log('   ✅ Resposta recebida em', loginDuration, 'ms');
    console.log('   - Status:', loginRes.status);
    console.log('');

    // PASSO 3: Processar resposta
    console.log('%c[3/4] Processando resposta...', 'color: #6b7280; font-weight: bold');

    const loginData = await loginRes.json();

    console.log('   - Success:', loginData.success);
    console.log('   - Error:', loginData.error || 'nenhum');
    console.log('   - Data:', loginData.data);
    console.log('');

    // PASSO 4: Verificar sessão
    console.log('%c[4/4] Verificando sessão criada...', 'color: #6b7280; font-weight: bold');

    const meRes = await fetch('/api/auth/me', {
      credentials: 'include'
    });

    const meData = await meRes.json();

    console.log('   - Authenticated:', meData.authenticated);
    console.log('   - User:', meData.user?.email || 'nenhum');
    console.log('');

    // RESUMO
    console.log('%c════════════════════════════════════', 'color: #10b981; font-weight: bold');
    console.log('%c RESUMO', 'color: #10b981; font-weight: bold');
    console.log('%c════════════════════════════════════', 'color: #10b981; font-weight: bold');

    if (loginData.success && meData.authenticated) {
      console.log('%c✅ LOGIN FUNCIONOU PERFEITAMENTE!', 'color: #10b981; font-weight: bold; font-size: 14px');
      console.log('');
      console.log('O problema está no FRONTEND (React/Zustand), não no backend.');
      console.log('');
      console.log('📋 Próximo passo: verificar authStore.ts');
    } else if (loginData.success === false) {
      console.log('%c❌ CREDENCIAIS INVÁLIDAS', 'color: #ef4444; font-weight: bold; font-size: 14px');
      console.log('');
      console.log('Erro:', loginData.error);
      console.log('');
      console.log('📋 Próximo passo: usar credenciais corretas');
    } else {
      console.log('%c⚠️  LOGIN RETORNOU MAS SESSÃO NÃO CRIADA', 'color: #f59e0b; font-weight: bold; font-size: 14px');
      console.log('');
      console.log('📋 Próximo passo: verificar backend session management');
    }

    console.log('');
    console.log('📊 Dados completos:');
    console.log({
      csrf: { ok: !!csrfToken },
      login: loginData,
      session: meData,
      duration: loginDuration + 'ms'
    });

  } catch (error) {
    console.error('%c❌ ERRO DURANTE TESTE:', 'color: #ef4444; font-weight: bold; font-size: 14px');
    console.error(error);
    console.error('');
    console.error('Stack trace:', error.stack);
  }
})();
