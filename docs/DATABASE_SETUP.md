# Guia de Configuração de Banco de Dados - ROM Agent v2.6.0

## CRÍTICO: Por que precisamos de banco de dados?

**ATUALMENTE, TODOS OS DADOS SÃO PERDIDOS EM REDEPLOY!**

Sem banco de dados:
- Conversas com IA são perdidas
- Sessões de usuário expiram
- Documentos gerados desaparecem
- **INACEITÁVEL PARA PRODUÇÃO**

Este guia configura persistência real com PostgreSQL + Redis no Render.com.

---

## Arquitetura de Dados

```
┌─────────────────┐
│  ROM Agent App  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼────┐
│ PostgreSQL │  │  Redis  │
│ (Dados)    │  │(Sessões)│
└────────────┘  └─────────┘
```

### PostgreSQL (Banco principal)
- **Conversações**: Histórico completo de chats
- **Usuários**: Cadastros, autenticação
- **Documentos**: Peças jurídicas geradas
- **Projetos**: Cases e processos
- **Uploads**: Metadados de arquivos
- **Auditoria**: Logs de operações

### Redis (Cache + Sessões)
- **Sessões web**: Express sessions persistentes
- **Cache**: Resultados de busca, jurisprudência
- **Rate limiting**: Controle de requisições

---

## Passo 1: Provisionar PostgreSQL no Render

### 1.1 Criar PostgreSQL Database

1. Acesse [https://dashboard.render.com/](https://dashboard.render.com/)
2. Clique em **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `rom-agent-db` (ou outro nome)
   - **Database**: `rom_agent`
   - **User**: `rom_agent_user`
   - **Region**: **Mesma região do Web Service** (importante para latência!)
   - **PostgreSQL Version**: `16` (ou mais recente)
   - **Plan**:
     - **Starter ($7/mês)**: 256MB RAM, 1GB storage - OK para testes/staging
     - **Standard ($20/mês)**: 1GB RAM, 10GB storage - **RECOMENDADO para produção**

4. Clique em **"Create Database"**

5. **Aguarde 2-3 minutos** até o status ficar **"Available"**

### 1.2 Obter URL de Conexão

Na página do database, copie:

- **Internal Database URL**: `postgres://rom_agent_user:xxxxx@dpg-xxxxx/rom_agent`

**IMPORTANTE**: Use a **Internal URL** (não a External) para conexões do Web Service no Render.

---

## Passo 2: Provisionar Redis no Render

### 2.1 Criar Redis Instance

1. No Render Dashboard, clique em **"New +"** → **"Redis"**
2. Configure:
   - **Name**: `rom-agent-redis`
   - **Region**: **Mesma região do Web Service e PostgreSQL!**
   - **Plan**:
     - **Starter ($7/mês)**: 256MB - OK para testes/staging
     - **Standard ($20/mês)**: 1GB - **RECOMENDADO para produção**
   - **Maxmemory Policy**: `allkeys-lru` (remove chaves antigas automaticamente)

3. Clique em **"Create Redis"**

4. **Aguarde 2-3 minutos** até o status ficar **"Available"**

### 2.2 Obter URL de Conexão

Na página do Redis, copie:

- **Internal Redis URL**: `redis://red-xxxxx:6379`

---

## Passo 3: Configurar Variáveis de Ambiente

### 3.1 No Web Service (Staging)

1. Acesse o Web Service **"rom-agent-ia-staging"**
2. Vá em **"Environment"**
3. Adicione/atualize:

```bash
# PostgreSQL
DATABASE_URL=postgres://rom_agent_user:SENHA_AQUI@dpg-xxxxx-internal/rom_agent

# Redis
REDIS_URL=redis://red-xxxxx:6379
```

**DICA**: Clique em **"Generate Secret"** no Render para criar senha segura para `SESSION_SECRET`:

```bash
SESSION_SECRET=valor_gerado_automaticamente_aqui
```

4. Clique em **"Save Changes"** → Render fará redeploy automático

### 3.2 No Web Service (Produção)

**Repita os mesmos passos** para o serviço de produção `rom-agent-ia`.

**ATENÇÃO**: Use os **mesmos** PostgreSQL e Redis? Ou separar?

**Recomendação**:
- **Compartilhar** PostgreSQL e Redis entre staging/produção **SE**:
  - Você quer testar com dados reais
  - Custo é preocupação

- **Separar** databases (criar 2 PostgreSQL + 2 Redis) **SE**:
  - Produção não pode ter dados de teste
  - Budget permite (~$54/mês total ao invés de ~$27/mês)

Para **separar** (recomendado para produção séria):
1. Crie `rom-agent-db-prod` (PostgreSQL separado)
2. Crie `rom-agent-redis-prod` (Redis separado)
3. Configure URLs diferentes em cada Web Service

---

## Passo 4: Executar Migrations (Criar Tabelas)

### 4.1 Via Render Shell (Recomendado)

1. Acesse o Web Service no Render Dashboard
2. Vá em **"Shell"** (canto superior direito)
3. Execute:

```bash
# Conectar ao PostgreSQL e executar schema
node -e "
import pg from 'pg';
import fs from 'fs';

const client = new pg.Client(process.env.DATABASE_URL);
await client.connect();

const schema = fs.readFileSync('./database/migrations/001_initial_schema.sql', 'utf-8');
await client.query(schema);

console.log('✅ Schema criado com sucesso!');
await client.end();
"
```

**Alternativa mais simples** (se o comando acima falhar):

```bash
# Instalar psql (cliente PostgreSQL)
apt-get update && apt-get install -y postgresql-client

# Executar migration
psql $DATABASE_URL -f ./database/migrations/001_initial_schema.sql
```

### 4.2 Via Cliente PostgreSQL Local

Se preferir rodar do seu computador:

```bash
# Copiar External Database URL do Render
export DATABASE_URL="postgres://user:pass@dpg-xxxxx-a.oregon-postgres.render.com/rom_agent"

# Executar migration
psql $DATABASE_URL -f ./database/migrations/001_initial_schema.sql
```

### 4.3 Verificar Sucesso

Conecte ao database e verifique tabelas:

```bash
psql $DATABASE_URL

# No prompt psql:
\dt    # Listar tabelas

# Deve mostrar:
# users, sessions, conversations, messages, projects, documents, uploads, ai_operations, audit_log
```

---

## Passo 5: Validar Integração

### 5.1 Verificar Logs do Deploy

Após redeploy, verifique os logs:

```
✅ PostgreSQL conectado { latency: '25ms' }
✅ Redis conectado { latency: '5ms' }
✅ Sessões configuradas com PostgreSQL (persistentes)
```

**Se aparecer**:

```
⚠️  PostgreSQL INDISPONÍVEL - dados serão perdidos em redeploy!
⚠️  Redis INDISPONÍVEL - sessões serão efêmeras!
```

→ **DATABASE_URL ou REDIS_URL estão incorretas!** Revise as variáveis de ambiente.

### 5.2 Testar Persistência de Sessão

1. Acesse `https://staging.iarom.com.br/`
2. Faça login (se tiver auth) ou inicie uma conversa
3. Abra DevTools → Application → Cookies
4. Copie o valor do cookie `rom.sid`
5. **Force um redeploy** no Render (sem alterar código)
6. Após redeploy, acesse novamente
7. **A sessão deve estar mantida!** (mesmo cookie, mesma conversa)

Se a sessão foi perdida → sessões ainda estão em memória (DATABASE_URL incorreta).

### 5.3 Testar Persistência de Conversações

```bash
# Endpoint de teste (adicionar em server-enhanced.js se quiser):
curl https://staging.iarom.com.br/health/database

# Resposta esperada:
{
  "postgres": { "available": true, "latency": 23 },
  "redis": { "available": true, "latency": 5 }
}
```

---

## Passo 6: Monitoramento e Manutenção

### 6.1 Monitorar Uso de Disco (PostgreSQL)

PostgreSQL Starter tem apenas **1GB de storage**. Monitore:

```sql
-- Tamanho do database
SELECT pg_database_size('rom_agent') / 1024 / 1024 AS size_mb;

-- Tamanho de cada tabela
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;
```

**Se passar de 80%**: Upgrade para Standard ($20/mês, 10GB) ou limpar dados antigos.

### 6.2 Limpar Dados Antigos

```sql
-- Deletar conversas arquivadas há mais de 90 dias
DELETE FROM conversations WHERE archived_at < NOW() - INTERVAL '90 days';

-- Deletar logs de AI operations com mais de 30 dias
DELETE FROM ai_operations WHERE created_at < NOW() - INTERVAL '30 days';

-- Limpar sessões expiradas (connect-pg-simple faz automaticamente)
DELETE FROM sessions WHERE expire < NOW();
```

### 6.3 Backup Automático

Render faz backup automático do PostgreSQL:
- **Starter**: Backups diários, retenção de 7 dias
- **Standard**: Backups diários, retenção de 30 dias

Para **backup manual**:

```bash
# Dump completo do database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restaurar de backup
psql $DATABASE_URL < backup_20250127.sql
```

---

## Passo 7: Migração de Dados Existentes (Opcional)

**Se você já tem dados em memória/arquivos** que quer importar:

### 7.1 Exportar Conversas do MemoryStore

Se conversações estavam em `conversationsManager` (em memória):

```javascript
// Criar script: scripts/export-conversations.js
import conversationsManager from '../lib/conversations-manager.js';
import { createConversation, addMessage } from '../src/repositories/conversation-repository.js';

// Exportar todas as conversas
const conversations = conversationsManager.getAllConversations();

for (const conv of conversations) {
  // Criar conversação no PostgreSQL
  const dbConv = await createConversation({
    userId: conv.userId || null,
    title: conv.title,
    mode: conv.mode,
    model: conv.model
  });

  // Inserir mensagens
  for (const msg of conv.messages) {
    await addMessage({
      conversationId: dbConv.id,
      role: msg.role,
      content: msg.content,
      model: msg.model,
      tokensInput: msg.tokensInput,
      tokensOutput: msg.tokensOutput
    });
  }
}

console.log(`Migradas ${conversations.length} conversas`);
```

Execute:

```bash
node scripts/export-conversations.js
```

---

## Troubleshooting

### Erro: "ECONNREFUSED"

```
Error: connect ECONNREFUSED
```

**Causa**: DATABASE_URL ou REDIS_URL incorretas.

**Solução**:
1. Verifique que você copiou a **Internal URL** (não External)
2. Confira que a região do database é a mesma do Web Service
3. Tente fazer ping: `pg_isready -d $DATABASE_URL`

### Erro: "relation does not exist"

```
ERROR:  relation "users" does not exist
```

**Causa**: Migrations não foram executadas.

**Solução**: Execute o Passo 4 novamente.

### Erro: "too many clients"

```
ERROR:  sorry, too many clients already
```

**Causa**: Pool de conexões esgotado (Starter permite apenas 20 conexões).

**Solução**:
1. Ajuste `POSTGRES_POOL_SIZE=10` (menor)
2. Ou upgrade para Standard (permite 100 conexões)

### Sessões ainda são efêmeras

```
⚠️  Sessões configuradas com MemoryStore (temporárias)
```

**Causa**: PostgreSQL não está conectado no momento da inicialização de sessões.

**Solução**:
1. Verifique `DATABASE_URL` está correta
2. Confira logs: `PostgreSQL conectado` deve aparecer ANTES de `Sessões configuradas`

---

## Custos Estimados (Render.com)

| Recurso | Starter | Standard | Recomendação |
|---------|---------|----------|-------------|
| **PostgreSQL** | $7/mês (256MB, 1GB storage) | $20/mês (1GB, 10GB storage) | Standard para produção |
| **Redis** | $7/mês (256MB) | $20/mês (1GB) | Starter OK inicialmente |
| **Web Service** | Grátis (750h/mês) | $7/mês | Pago para produção |
| **TOTAL (Staging)** | ~$14/mês | ~$47/mês | - |
| **TOTAL (Prod separado)** | ~$28/mês | ~$94/mês | - |

**Dica de economia**: Compartilhe PostgreSQL/Redis entre staging e produção inicialmente (economia de $14/mês).

---

## Próximos Passos

Após banco configurado:

1. **Atualizar código** para usar repositórios:
   ```javascript
   // Antes:
   conversationsManager.addConversation(conv);

   // Depois:
   import { createConversation } from './repositories/conversation-repository.js';
   await createConversation(conv);
   ```

2. **Implementar autenticação real** (atualmente sem auth)

3. **Configurar S3** para arquivos grandes (PDFs, DOCX):
   - Render tem disco efêmero
   - Uploads > 100MB devem ir para S3

4. **Monitorar métricas** de database:
   - Latência de queries
   - Uso de conexões
   - Tamanho do banco

---

## Referências

- [Render PostgreSQL Docs](https://render.com/docs/databases)
- [Render Redis Docs](https://render.com/docs/redis)
- [connect-pg-simple (Session Store)](https://github.com/voxpelli/node-connect-pg-simple)
- [node-postgres (pg)](https://node-postgres.com/)

---

**PRÓXIMO DEPLOY**: v2.6.0 - Database Persistence
