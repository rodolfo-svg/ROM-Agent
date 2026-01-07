# Diagnóstico PostgreSQL - Histórico de Conversas

## Problema
Histórico de conversas não está persistindo. IA não lembra de mensagens anteriores.

## Verificações Necessárias

### 1. DATABASE_URL está correto?

**No Render Dashboard:**
1. Acesse: https://dashboard.render.com/
2. Vá em: Services → rom-agent → Environment
3. Verifique se `DATABASE_URL` existe e está correto
4. Compare com o valor em `render.yaml` (linha 87-88)

**Se DATABASE_URL estiver diferente:**
- O valor no Render Dashboard sobrescreve o `render.yaml`
- Use o valor correto do dashboard

### 2. PostgreSQL Database existe?

**No Render Dashboard:**
1. Vá em: Databases (menu lateral)
2. Procure por: `rom_agent` ou similar
3. Verifique status: **Running**

**Se não existir:**
- Criar novo: New → PostgreSQL
- Nome: `rom-agent-db`
- Conectar ao serviço `rom-agent`
- DATABASE_URL será gerado automaticamente

### 3. Migrations rodaram?

**Logs do Build (procure por):**
```
🗄️ Executando migrations do banco de dados...
📦 EXECUTANDO MIGRAÇÕES DE BANCO DE DADOS
✅ DATABASE_URL configurado
✅ Conectado ao PostgreSQL
✅ 004_conversations.sql - concluída
✅ 005_add_deleted_at_to_conversations.sql - concluída
```

**Se não aparecer:**
- Migrations não rodaram
- Verificar se `npm run db:migrate` está no buildCommand

### 4. Tabelas existem no banco?

**Via Render Dashboard:**
1. Databases → rom_agent → PSQL Console (Shell)
2. Execute:
```sql
\dt
```

**Deve listar:**
```
 public | conversations          | table | rom_agent_user
 public | conversation_messages  | table | rom_agent_user
 public | schema_migrations      | table | rom_agent_user
 public | users                  | table | rom_agent_user
```

**Se tabelas não existirem:**
- Migrations falharam ou não rodaram
- Rodar manualmente: `npm run db:migrate`

### 5. Mensagens sendo salvas?

**Via PSQL Console:**
```sql
SELECT COUNT(*) FROM conversations;
SELECT COUNT(*) FROM conversation_messages;
```

**Deve retornar > 0 se usuário já conversou**

**Se retornar 0:**
- Mensagens não estão sendo salvas
- Verificar logs do servidor para erros em `/api/conversations/:id/messages`

## Soluções Possíveis

### Solução A: DATABASE_URL inválido
```yaml
# render.yaml - REMOVER valor hardcoded
- key: DATABASE_URL
  # value: postgresql://...  # ❌ REMOVER
  sync: false  # ✅ Usar valor do dashboard
```

### Solução B: PostgreSQL não existe
1. Criar PostgreSQL database no Render
2. Conectar ao serviço
3. Redeploy

### Solução C: Migrations não rodaram
```bash
# Rodar manualmente via SSH ou local
DATABASE_URL="postgresql://..." npm run db:migrate
```

### Solução D: Código com erro
Verificar:
- `src/routes/conversations.js` - POST /messages
- `src/config/database.js` - initPostgres()
- Frontend: chatStore.ts - saveMessageToAPI()

## Teste Rápido

**Abrir DevTools Console no navegador:**
```javascript
// Criar conversa
fetch('/api/conversations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Test' }),
  credentials: 'include'
}).then(r => r.json()).then(console.log)

// Ver conversas
fetch('/api/conversations', {
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

Se retornar erro 503: PostgreSQL não conectado
Se retornar erro 401: Não autenticado
Se retornar success: PostgreSQL funcionando!
