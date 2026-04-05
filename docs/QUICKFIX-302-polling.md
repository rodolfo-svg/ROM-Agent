# QUICK FIX: 302 Redirect no Polling

**Status:** READY TO APPLY
**Tempo estimado:** 5 minutos
**Impacto:** Fix crítico para UX de extraction polling

---

## PROBLEMA

Usuário faz upload de 221MB → Job criado → Frontend mostra "erro 502"

**Causa Real:** Frontend recebe HTTP 302 (redirect para login) quando sessão expira durante polling.

---

## FIX RÁPIDO (2 arquivos)

### 1. Frontend: ExtractionProgressBar.tsx

**Arquivo:** `/Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/frontend/src/components/extraction/ExtractionProgressBar.tsx`

**Linha 40-70:** Substituir função `fetchJobStatus` por:

```typescript
const fetchJobStatus = useCallback(async () => {
  try {
    const response = await fetch(`/api/extraction-jobs/${jobId}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json'  // ✅ NOVO
      }
    })

    // ✅ NOVO: Detectar sessão expirada
    if (response.status === 302 || response.redirected || response.status === 401) {
      console.warn('⚠️ Sessão expirada - redirecionando para login')
      setError('Sessão expirada. Você será redirecionado para fazer login novamente.')
      onError?.('Sessão expirada')

      setTimeout(() => {
        window.location.href = '/login'
      }, 3000)
      return
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    if (data.success && data.job) {
      setJob(data.job)

      if (data.job.status === 'completed') {
        onComplete?.(data.job)
      }

      if (data.job.status === 'failed') {
        const errorMsg = data.job.error || 'Extraction failed'
        setError(errorMsg)
        onError?.(errorMsg)
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Error fetching job status'
    console.error('❌ Erro ao buscar status do job:', errorMsg)
    setError(errorMsg)
    onError?.(errorMsg)
  }
}, [jobId, onComplete, onError])
```

---

### 2. Backend: auth.js Middleware

**Arquivo:** `/Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/src/middleware/auth.js`

**Linha 12-35:** Substituir função `requireAuth` por:

```javascript
export function requireAuth(req, res, next) {
  // Verificar se usuário está autenticado
  if (req.session && req.session.user && req.session.user.id) {
    return next();
  }

  logger.debug('Acesso negado - usuário não autenticado', {
    path: req.path,
    ip: req.ip
  });

  // ✅ NOVO: Rotas /api/* sempre retornam JSON (401)
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({
      error: 'Não autenticado',
      message: 'Você precisa fazer login para acessar este recurso'
    });
  }

  // Se for requisição HTML (páginas), redirecionar para login
  if (req.accepts('html')) {
    return res.redirect('/login.html');
  }

  // Fallback para JSON
  return res.status(401).json({
    error: 'Não autenticado',
    message: 'Você precisa fazer login para acessar este recurso'
  });
}
```

---

## TESTE

```bash
# 1. Login
curl -c cookies.txt -X POST https://rom-agent-ia.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# 2. Polling SEM cookie (simula sessão expirada)
curl -i https://rom-agent-ia.onrender.com/api/extraction-jobs/54d35307-c18f-47b3-b0df-6f3e7cc81754

# ANTES:
# HTTP/2 302
# location: /login.html

# DEPOIS:
# HTTP/2 401
# {"error":"Não autenticado","message":"..."}
```

---

## DEPLOY

```bash
# 1. Aplicar mudanças
cd /Users/rodolfootaviopereiradamotaoliveira/ROM-Agent

# 2. Build frontend
cd frontend
npm run build

# 3. Commit
cd ..
git add .
git commit -m "fix: handle 302 redirect in extraction polling"

# 4. Deploy
git push origin main  # Render auto-deploy
```

---

## RESULTADO ESPERADO

**ANTES:**
```
❌ UI mostra: "HTTP 302" ou "erro 502"
❌ Usuário confuso
❌ Job continua rodando mas UI não atualiza
```

**DEPOIS:**
```
✅ UI mostra: "Sessão expirada. Redirecionando..."
✅ Redireciona para /login após 3s
✅ Usuário entende o que aconteceu
```

---

## DOCUMENTAÇÃO COMPLETA

Ver: `/Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/DOCS/fix-302-extraction-polling.md`

---

**Criado:** 2026-04-02 18:30 BRT
**Autor:** Claude Code
