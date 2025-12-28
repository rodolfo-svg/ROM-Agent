# ⚠️ CONFIGURAÇÃO OBRIGATÓRIA: DATABASE_URL para Produção

**Data do merge:** 2025-12-27
**Commit em produção:** `c3b58fed`
**Status:** ⏳ AGUARDANDO CONFIGURAÇÃO NO RENDER

---

## 🚨 AÇÃO NECESSÁRIA

**Staging e Produção DEVEM usar o MESMO banco de dados PostgreSQL!**

### Configurar no Render Dashboard

1. Acesse: https://dashboard.render.com/
2. Selecione o serviço de **produção** (main / iarom.com.br)
3. Vá em **Environment** → **Environment Variables**
4. Adicione **DUAS variáveis obrigatórias**:

```
Key: DATABASE_URL
Value: postgresql://rom_agent_user:faPSk0YSNlhyPfBYpri2RcK9XdRbaE8L@dpg-d5819bhr0fns73dmfsv0-a/rom_agent

Key: NODE_ENV
Value: production
```

**⚠️ IMPORTANTE:** Ambas as variáveis são obrigatórias!
- `DATABASE_URL`: URL do PostgreSQL
- `NODE_ENV`: Habilita SSL (obrigatório para PostgreSQL no Render)

5. Clique em **Save Changes**
6. Render fará redeploy automático (~2-3 min)

---

## 📌 IMPORTANTE

### Por que staging e produção compartilham o mesmo banco?

1. **Usuários únicos:** Mesmos usuários em ambos ambientes
2. **Sessões compartilhadas:** Login funciona em ambos
3. **Dados consistentes:** Não há duplicação
4. **Custo otimizado:** Um único banco PostgreSQL

### Consequências se NÃO configurar

- ❌ PostgreSQL indisponível em produção
- ❌ Sessões efêmeras (perdem-se em redeploy)
- ❌ MemoryStore ao invés de PostgreSQL SessionStore
- ❌ Autenticação não funcional

---

## ✅ Verificação Pós-Deploy

Após configurar e aguardar o redeploy:

```bash
# Verificar se produção está com PostgreSQL conectado
curl -s "https://iarom.com.br/health" | python3 -c "
import json, sys
j = json.load(sys.stdin)
print('Status:', j.get('status'))
print('PostgreSQL:', j.get('database',{}).get('postgres',{}).get('available'))
print('Latência:', j.get('database',{}).get('postgres',{}).get('latency'), 'ms')
"

# Verificar redirecionamento para login
curl -I "https://iarom.com.br/" | grep -E "HTTP|location"
```

**Resultado esperado:**
```
Status: healthy
PostgreSQL: True
Latência: 2-15 ms

HTTP/2 302
location: /login.html
```

---

## 🔐 Credenciais do Banco (MESMO para staging e produção)

**URL INTERNA (para uso no Render):**
```
postgresql://rom_agent_user:faPSk0YSNlhyPfBYpri2RcK9XdRbaE8L@dpg-d5819bhr0fns73dmfsv0-a/rom_agent
```

**Usuário de teste:**
- Email: teste@iarom.com.br
- Senha: senha123
- Role: admin

---

## 📋 Checklist de Deploy

- [x] Código mergeado (staging → main)
- [x] Push para main realizado
- [x] Render auto-deploy disparado
- [ ] **DATABASE_URL configurada no Render (produção)** ⚠️ PENDENTE
- [ ] Deploy completado (~2-3 min)
- [ ] Verificação: https://iarom.com.br/health
- [ ] Teste: Login com teste@iarom.com.br

---

## 🔗 Documentação Completa

Ver: `docs/CHECKPOINT_AUTH_DATABASE.md`
