# 🔍 DEBUG: DATABASE_URL não está conectando em Produção

**Data:** 2025-12-27
**Problema:** PostgreSQL configurado 10x mas não conecta

## ✅ O que sabemos que está CORRETO:

1. **Staging funciona** → PostgreSQL conectado (13ms)
2. **URL está correta** → `postgresql://rom_agent_user:faPSk0YSNlhyPfBYpri2RcK9XdRbaE8L@dpg-d5819bhr0fns73dmfsv0-a/rom_agent`
3. **Código está deployado** → commit c3b58fed em produção
4. **Login funciona** → HTTP 302 → /login.html

## ❌ O que está FALTANDO:

PostgreSQL não conecta em produção

## 🎯 CHECKLIST RENDER DASHBOARD (conferir NOVAMENTE):

### Passo 1: Confirmar o serviço correto
- [ ] Está no serviço de **PRODUÇÃO** (não staging)
- [ ] Nome do serviço: `iarom` ou similar (aquele que usa iarom.com.br)

### Passo 2: Verificar Environment Variables
- [ ] Ir em: **Environment** → **Environment Variables**
- [ ] Procurar por: `DATABASE_URL`
- [ ] Se NÃO EXISTE: Criar nova variável
- [ ] Se EXISTE: Verificar valor

### Passo 3: Verificar DUAS variáveis obrigatórias

**Variável 1 - DATABASE_URL:**
```
Key: DATABASE_URL
Value: postgresql://rom_agent_user:faPSk0YSNlhyPfBYpri2RcK9XdRbaE8L@dpg-d5819bhr0fns73dmfsv0-a/rom_agent
```

**Variável 2 - NODE_ENV (CRÍTICO!):**
```
Key: NODE_ENV
Value: production
```

**⚠️ ATENÇÃO:**
- ❌ Se NODE_ENV não estiver configurado, SSL não será habilitado
- ❌ PostgreSQL no Render EXIGE SSL
- ❌ Sem NODE_ENV=production, a conexão SEMPRE falhará
- ✅ AMBAS as variáveis são OBRIGATÓRIAS

### Passo 4: Forçar Redeploy
Após salvar DATABASE_URL:
1. Clicar em **Save Changes**
2. Render mostrará "Deploying..."
3. Aguardar 2-3 minutos
4. Ver se logs mostram "Building..."

### Passo 5: Verificar Logs
Ir em **Logs** e procurar por:
- `[PG]` - logs do PostgreSQL
- `Connected to PostgreSQL` - sucesso
- `Error connecting` - erro de conexão
- `DATABASE_URL` - menções à variável

## 🔧 POSSÍVEIS CAUSAS:

### 1. Render não está fazendo auto-deploy
**Solução:** Manual deploy
- Ir em: **Manual Deploy** → **Deploy latest commit**

### 2. Variável tem espaços/caracteres invisíveis
**Solução:** Deletar e recriar
- Deletar DATABASE_URL
- Criar novamente copiando URL deste documento

### 3. Nome da variável está errado
**Solução:** Deve ser exatamente `DATABASE_URL`
- Não pode ser: `DB_URL`, `POSTGRES_URL`, etc.

### 4. Branch errado deployado
**Solução:** Verificar branch
- Confirmar que está deployando branch **main**
- Não **staging** ou outra

## 📋 URL COMPLETA (copiar daqui):
```
postgresql://rom_agent_user:faPSk0YSNlhyPfBYpri2RcK9XdRbaE8L@dpg-d5819bhr0fns73dmfsv0-a/rom_agent
```

## 🔍 Como saber se funcionou:

Após configurar e aguardar ~2 minutos:
```bash
curl -s "https://iarom.com.br/health" | grep -o '"postgres":{[^}]*}'
```

**Resultado esperado:**
```json
"postgres":{"available":true,"latency":2}
```

**Se ainda mostra false:**
- Render NÃO fez redeploy OU
- DATABASE_URL não foi salva corretamente

## 💡 ÚLTIMA TENTATIVA:

Se nada funcionar:
1. **Screenshot** da página Environment Variables do Render
2. **Screenshot** dos Logs mostrando o deploy
3. Enviar para análise

---

**Monitoramento live rodando:**
```bash
# Verificando a cada 10 segundos automaticamente
```
