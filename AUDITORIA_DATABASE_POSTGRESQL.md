# AUDITORIA COMPLETA - BANCO DE DADOS POSTGRESQL

**Data:** 2026-01-11
**Projeto:** ROM-Agent
**Versao:** v2.8.x
**Score Final:** 72/100

---

## SUMARIO EXECUTIVO

| Categoria | Score | Status |
|-----------|-------|--------|
| Migrations | 18/25 | ATENCAO |
| Schema Design | 22/25 | BOM |
| Queries | 15/25 | CRITICO |
| Connection Pooling | 12/15 | BOM |
| Backup & Recovery | 5/10 | CRITICO |
| **TOTAL** | **72/100** | **ATENCAO** |

---

## 1. MIGRATIONS

### 1.1 Arquivos Encontrados

```
/migrations/
  001_initial_schema.sql     - Schema inicial (users, sessions, conversations, messages, projects, documents, uploads, ai_operations, audit_log)
  002_security_enhancements.sql - Politicas de seguranca (password_history, ip_blacklist, password_reset_tokens)
  003_alter_conversations_id_to_varchar.sql - Conversao UUID -> VARCHAR
  004_fix_all_conversation_fks.sql - Correcao de FKs

/database/migrations/
  001_consolidated.sql       - Schema ANTIGO/DUPLICADO (conflito!)
```

### 1.2 Script Executor

**Arquivo:** `/Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/scripts/run-migrations.js`

**Pontos Positivos:**
- Tabela `schema_migrations` para controle de versoes
- Execucao sequencial ordenada por nome de arquivo
- Registro de duracao de cada migration
- Logging detalhado

**Problemas:**
- NAO usa transacoes - se falhar no meio, schema fica inconsistente
- NAO tem rollback automatico
- Conexao unica (Client) ao inves de Pool

### 1.3 Ordem de Execucao

A numeracao (001_, 002_, etc) garante ordem correta via `.sort()`.

### 1.4 Rollback Strategy

| Status | Descricao |
|--------|-----------|
| AUSENTE | Nao existem arquivos de rollback (*_down.sql) |
| AUSENTE | Nao ha script de rollback |
| AUSENTE | Migrations nao sao reversiveis |

**RISCO CRITICO:** Se uma migration falhar ou precisar ser revertida, nao ha mecanismo automatico.

### 1.5 Idempotencia (Pode rodar 2x?)

| Migration | Idempotente? | Razao |
|-----------|--------------|-------|
| 001_initial_schema.sql | SIM | `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` |
| 002_security_enhancements.sql | SIM | `ALTER TABLE ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS` |
| 003_alter_conversations_id_to_varchar.sql | SIM | Verificacoes `IF EXISTS` antes de cada operacao |
| 004_fix_all_conversation_fks.sql | SIM | Verificacoes dinamicas com `information_schema` |

**POSITIVO:** Todas as migrations sao idempotentes.

### 1.6 Destructive Operations

| Arquivo | Operacao | Risco |
|---------|----------|-------|
| 003_*.sql | `DROP INDEX IF EXISTS messages_conversation_id_idx` | BAIXO |
| 003_*.sql | `DROP INDEX IF EXISTS documents_conversation_id_idx` | BAIXO |
| 003_*.sql | `DROP INDEX IF EXISTS ai_operations_conversation_id_idx` | BAIXO |
| 004_*.sql | `DROP INDEX IF EXISTS` (dinamico) | BAIXO |

**Analise:** Apenas DROP INDEX (recriados em seguida). Nenhum DROP TABLE ou TRUNCATE.

---

## 2. SCHEMA DESIGN

### 2.1 Configuracao de Conexao

**Arquivo:** `/Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/src/config/database.js`

```javascript
{
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.POSTGRES_POOL_SIZE) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
}
```

**ALERTA SSL:** `rejectUnauthorized: false` desabilita verificacao de certificado SSL.

### 2.2 Tabelas Criadas

| Tabela | Descricao | FK |
|--------|-----------|-----|
| `users` | Usuarios do sistema | - |
| `sessions` | Sessoes (express-session) | users(id) |
| `conversations` | Conversas do chat | users(id) |
| `messages` | Mensagens das conversas | conversations(id) |
| `projects` | Projetos | users(id) |
| `documents` | Documentos | projects(id), conversations(id), users(id) |
| `uploads` | Arquivos enviados | users(id) |
| `ai_operations` | Operacoes de IA | users(id), conversations(id) |
| `audit_log` | Log de auditoria | users(id) |
| `password_history` | Historico de senhas | users(id) |
| `ip_blacklist` | IPs bloqueados | - |
| `password_reset_tokens` | Tokens de reset | users(id) |
| `schema_migrations` | Controle de migrations | - |

### 2.3 Relacionamentos (FK + Constraints)

**Foreign Keys com ON DELETE:**

| Tabela | Coluna | Referencia | ON DELETE |
|--------|--------|------------|-----------|
| conversations | user_id | users(id) | CASCADE |
| messages | conversation_id | conversations(id) | CASCADE |
| projects | user_id | users(id) | CASCADE |
| documents | project_id | projects(id) | CASCADE |
| documents | conversation_id | conversations(id) | SET NULL |
| documents | user_id | users(id) | CASCADE |
| uploads | user_id | users(id) | CASCADE |
| ai_operations | user_id | users(id) | CASCADE |
| ai_operations | conversation_id | conversations(id) | SET NULL |
| audit_log | user_id | users(id) | SET NULL |
| password_history | user_id | users(id) | CASCADE |
| password_reset_tokens | user_id | users(id) | CASCADE |

**POSITIVO:** Todas FKs tem ON DELETE definido. Dados orfaos nao serao criados.

**CHECK Constraints:**

| Tabela | Coluna | Constraint |
|--------|--------|-----------|
| messages | role | `CHECK (role IN ('user', 'assistant', 'system'))` |

### 2.4 Indices

**Indices Criados:**

| Tabela | Indice | Colunas | Tipo |
|--------|--------|---------|------|
| users | users_email_idx | email | BTREE |
| users | users_role_idx | role | BTREE |
| users | users_account_locked_until_idx | account_locked_until | PARTIAL |
| sessions | sessions_expire_idx | expire | BTREE |
| sessions | sessions_user_id_idx | user_id | PARTIAL |
| sessions | sessions_expire_user_idx | expire, user_id | BTREE |
| conversations | conversations_user_id_idx | user_id | BTREE |
| conversations | conversations_created_at_idx | created_at DESC | BTREE |
| conversations | conversations_updated_at_idx | updated_at DESC | BTREE |
| conversations | conversations_archived_at_idx | archived_at | PARTIAL |
| conversations | conversations_deleted_at_idx | deleted_at | BTREE |
| messages | messages_conversation_id_idx | conversation_id | BTREE |
| messages | messages_created_at_idx | created_at ASC | BTREE |
| projects | projects_user_id_idx | user_id | BTREE |
| projects | projects_status_idx | status | BTREE |
| documents | documents_project_id_idx | project_id | BTREE |
| documents | documents_user_id_idx | user_id | BTREE |
| documents | documents_document_type_idx | document_type | BTREE |
| uploads | uploads_user_id_idx | user_id | BTREE |
| uploads | uploads_upload_status_idx | upload_status | BTREE |
| ai_operations | ai_operations_user_id_idx | user_id | BTREE |
| ai_operations | ai_operations_operation_type_idx | operation_type | BTREE |
| ai_operations | ai_operations_created_at_idx | created_at DESC | BTREE |
| audit_log | audit_log_user_id_idx | user_id | BTREE |
| audit_log | audit_log_action_idx | action | BTREE |
| audit_log | audit_log_created_at_idx | created_at DESC | BTREE |
| audit_log | audit_log_ip_address_idx | ip_address | BTREE |
| audit_log | audit_log_status_idx | status | BTREE |
| audit_log | audit_log_user_action_idx | user_id, action, created_at DESC | BTREE |
| password_history | password_history_user_id_idx | user_id | BTREE |
| password_history | password_history_created_at_idx | created_at DESC | BTREE |
| ip_blacklist | ip_blacklist_blocked_until_idx | blocked_until | BTREE |
| password_reset_tokens | password_reset_tokens_token_idx | token | BTREE |
| password_reset_tokens | password_reset_tokens_user_id_idx | user_id | BTREE |
| password_reset_tokens | password_reset_tokens_expires_at_idx | expires_at | BTREE |

**Indices Ausentes Recomendados:**

| Tabela | Colunas | Justificativa |
|--------|---------|---------------|
| audit_log | entity_type, entity_id | Queries por entidade |
| messages | role | Filtrar mensagens por tipo |
| documents | conversation_id | Query em /conversations/:id busca docs |

### 2.5 Normalizacao

| Forma Normal | Status | Observacoes |
|--------------|--------|-------------|
| 1NF | OK | Todas colunas atomicas |
| 2NF | OK | Todas dependencias da PK completa |
| 3NF | OK | Sem dependencias transitivas |

**Uso de JSONB:**
- `users.metadata`
- `conversations.metadata`
- `messages.metadata`
- `projects.metadata`
- `documents.metadata`
- `uploads.metadata`
- `ai_operations.metadata`
- `audit_log.details`
- `sessions.sess`

**Avaliacao:** JSONB usado para dados flexiveis/extensiveis. Aceitavel para metadados nao estruturados.

### 2.6 Tipos de Dados

| Coluna | Tipo Atual | Recomendacao |
|--------|-----------|--------------|
| conversations.id | VARCHAR(255) | OK (compatibilidade com IDs legados) |
| users.id | UUID | OK |
| messages.content | TEXT | OK |
| *.created_at | TIMESTAMPTZ | OK (timezone-aware) |
| ip_blacklist.ip_address | INET | EXCELENTE (tipo nativo para IPs) |
| *.file_size | INTEGER | BIGINT (arquivos > 2GB) |

### 2.7 Default Values

| Tabela | Coluna | Default |
|--------|--------|---------|
| users | role | 'user' |
| users | created_at | NOW() |
| users | metadata | '{}'::jsonb |
| users | failed_login_attempts | 0 |
| users | force_password_change | FALSE |
| conversations | title | 'Nova Conversa' |
| conversations | mode | 'juridico' |
| documents | version | 1 |
| uploads | upload_status | 'pending' |
| audit_log | status | 'success' |

### 2.8 NOT NULL Constraints

**Colunas NAO NULAS adequadamente:**
- users.email
- messages.conversation_id
- messages.role
- messages.content
- documents.title
- uploads.original_filename
- uploads.stored_filename
- uploads.file_path
- ip_blacklist.blocked_until
- password_reset_tokens.user_id
- password_reset_tokens.token
- password_reset_tokens.expires_at

**Colunas que DEVERIAM ser NOT NULL:**
- users.name (permite null atualmente)
- audit_log.action (ja e NOT NULL - OK)

---

## 3. QUERIES

### 3.1 Prepared Statements (SQL Injection)

**Status:** SEGURO

Todas as queries usam parametros ($1, $2, etc):

```javascript
// CORRETO - Exemplo de auth.js
await pool.query(
  'SELECT id FROM users WHERE email = $1',
  [email.toLowerCase().trim()]
);

// CORRETO - Exemplo de conversations.js
await pool.query(
  `SELECT id, title, created_at, updated_at
   FROM conversations
   WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
  [id, userId]
);
```

### 3.2 SQL Injection Potencial (ALERTA)

**Arquivos com interpolacao de string em SQL:**

| Arquivo | Linha | Codigo | Risco |
|---------|-------|--------|-------|
| database.js | 63 | `` `SET search_path TO ${schema}, public` `` | MEDIO* |
| database.js | 75-76 | `` `CREATE SCHEMA IF NOT EXISTS ${schema}` `` | MEDIO* |
| brute-force-service.js | 271 | `` `INTERVAL '${this.config.ipFailureWindowMinutes} minutes'` `` | BAIXO** |
| audit-service.js | 252, 271, 303 | `` `INTERVAL '${minutes} minutes'` `` | BAIXO** |

*Schema vem de variavel de ambiente (DATABASE_SCHEMA) - controlado pelo admin
**Valores sao inteiros validados internamente - nao vem de input do usuario

### 3.3 SELECT * (Anti-pattern)

**Encontrado:**

| Arquivo | Linha | Query |
|---------|-------|-------|
| scripts/force-migrations.js | 194 | `SELECT * FROM schema_migrations ORDER BY executed_at` |

**Impacto:** BAIXO - script de desenvolvimento, nao producao.

### 3.4 N+1 Query Problem

**Status:** NAO DETECTADO em rotas principais

As queries usam JOINs apropriados:

```sql
-- conversations.js - Lista com contagem
SELECT
  c.id, c.title, c.created_at, c.updated_at,
  COUNT(m.id) as message_count,
  MAX(m.created_at) as last_message_at
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
WHERE c.user_id = $1 AND c.deleted_at IS NULL
GROUP BY c.id
ORDER BY c.updated_at DESC
LIMIT 100
```

### 3.5 Paginacao

| Rota | LIMIT | OFFSET | Status |
|------|-------|--------|--------|
| GET /api/conversations | 100 | Nao | PARCIAL |
| GET /api/conversations/admin/all | 500 | Nao | ALERTA |
| getConversationMessages | Configuravel | Configuravel | OK |
| listUserConversations | Configuravel | Configuravel | OK |
| getAuditLog | 100 default | Configuravel | OK |

**Problema:** LIMIT fixo sem parametro de paginacao na API.

### 3.6 Cartesian Products (JOINs sem ON)

**Status:** NAO ENCONTRADO

Todos os JOINs tem clausula ON.

### 3.7 Subqueries vs JOINs

**Encontrado em password-policy-service.js:**

```sql
DELETE FROM password_history
WHERE user_id = $1
AND id NOT IN (
  SELECT id FROM password_history
  WHERE user_id = $1
  ORDER BY created_at DESC
  LIMIT $2
)
```

**Avaliacao:** Aceitavel. Subquery correlacionada para manter historico.

### 3.8 Queries Problematicas Especificas

| Arquivo | Problema | Recomendacao |
|---------|----------|--------------|
| audit-service.js linha 192 | `ORDER BY ${orderBy} ${order}` | Validar orderBy contra whitelist |
| brute-force-service.js | INTERVAL com interpolacao | OK (valor interno) |

---

## 4. CONNECTION POOLING

### 4.1 Configuracao Atual

```javascript
{
  max: parseInt(process.env.POSTGRES_POOL_SIZE) || 20,
  idleTimeoutMillis: 30000,        // 30 segundos
  connectionTimeoutMillis: 5000     // 5 segundos
}
```

### 4.2 Analise

| Parametro | Valor | Recomendacao |
|-----------|-------|--------------|
| max (pool size) | 20 | OK para Render Free (max 97 conexoes) |
| idleTimeoutMillis | 30000 | OK |
| connectionTimeoutMillis | 5000 | OK |
| min | Nao definido | Adicionar min: 2 |
| statement_timeout | Nao definido | Adicionar para queries longas |

### 4.3 Connection Leaks

**Analise dos arquivos:**

| Arquivo | Status | Observacao |
|---------|--------|-----------|
| database.js | OK | Pool gerenciado, closeDatabaseConnections() existe |
| run-migrations.js | OK | `finally { await client.end() }` |
| conversations.js | OK | Usa getPostgresPool() (retorna pool, nao client) |
| auth.js | OK | Usa getPostgresPool() |
| users.js | OK | Usa getPostgresPool() |

**Funcao safeQuery():**
```javascript
export async function safeQuery(sql, params = []) {
  const pool = getPostgresPool();
  if (!pool) {
    return { rows: [], fallback: true };
  }
  try {
    const result = await pool.query(sql, params);
    return result;
  } catch (error) {
    // Error handling
    return { rows: [], error, fallback: true };
  }
}
```

**POSITIVO:** Pool.query() libera conexao automaticamente.

### 4.4 Graceful Shutdown

```javascript
export async function closeDatabaseConnections() {
  const promises = [];
  if (pgPool) {
    promises.push(
      pgPool.end().then(() => {
        logger.info('PostgreSQL pool fechado');
        pgPool = null;
      })
    );
  }
  // Redis handling...
  await Promise.all(promises);
}
```

**POSITIVO:** Implementado corretamente.

---

## 5. BACKUP & RECOVERY

### 5.1 Script de Backup

**Arquivo:** `/Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/scripts/backup-database.sh`

```bash
#!/bin/bash
BACKUP_DIR="$HOME/ROM-Agent-Backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="${POSTGRES_DB:-rom_agent}"
DB_USER="${POSTGRES_USER:-postgres}"

mkdir -p "$BACKUP_DIR"

if command -v pg_dump &> /dev/null; then
  pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_DIR/postgres_${DATE}.sql.gz"
else
  echo "pg_dump nao encontrado"
fi

# Limpar backups > 7 dias
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
```

### 5.2 Analise

| Item | Status | Observacao |
|------|--------|-----------|
| Backup automatico | PARCIAL | Script existe mas sem CRON |
| Backup comprimido | SIM | gzip |
| Retencao | 7 dias | Insuficiente para producao |
| Backup offsite | NAO | Apenas local |
| Backup criptografado | NAO | Sem gpg ou similar |
| Teste de restore | NAO | Sem script de teste |

### 5.3 Point-in-Time Recovery (PITR)

**Status:** NAO CONFIGURADO

Nao ha configuracao de WAL archiving para PITR.

### 5.4 Replicacao

**Status:** NAO CONFIGURADO

Nao ha configuracao de replica/standby.

---

## 6. RENDER DATABASE

### 6.1 Configuracao no render.yaml

```yaml
- key: DATABASE_URL
  value: postgresql://rom_agent_user:faPSk0YSNlhyPfBYpri2RcK9XdRbaE8L@dpg-d5819bhr0fns73dmfsv0-a/rom_agent
```

**ALERTA CRITICO:** Senha do banco hardcoded no render.yaml!

### 6.2 Tipo de Database

| Aspecto | Valor | Analise |
|---------|-------|---------|
| Host | dpg-d5819bhr0fns73dmfsv0-a | Internal (dentro do Render) |
| Porta | 5432 (default) | OK |
| SSL | Nao forcado | Deveria forcar em producao |
| Plano | Free | Limitacoes abaixo |

### 6.3 Limitacoes do Free Tier

| Limitacao | Valor | Status Atual |
|-----------|-------|--------------|
| Storage | 1 GB | MONITORAR |
| Conexoes | 97 | Pool de 20 - OK |
| Retencao | 90 dias | RISCO: Dados deletados apos 90 dias de inatividade |
| Backups | Manual apenas | CRITICO |
| CPU/RAM | Limitado | OK para baixo trafego |

### 6.4 Recomendacoes Render

1. **Migrar para Render Starter ($7/mes):**
   - 1 GB storage garantido
   - Backups diarios automaticos
   - Sem limite de 90 dias

2. **Mover credenciais para Secrets:**
   ```yaml
   - key: DATABASE_URL
     sync: false  # Configurar no dashboard
   ```

3. **Usar Internal Database URL:**
   - Ja esta usando (dpg-...-a = internal)
   - Evita exposicao publica

---

## 7. PROBLEMAS CRITICOS

### P1. Senha do Banco no render.yaml (CRITICO)

**Local:** `/Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/render.yaml` linha 97

**Problema:** Credencial hardcoded em arquivo versionado.

**Solucao:**
```yaml
- key: DATABASE_URL
  sync: false  # Configurar via Render Dashboard
```

### P2. Sem Rollback Strategy (ALTO)

**Problema:** Migrations nao tem arquivos de rollback.

**Solucao:** Criar arquivos `001_down.sql`, `002_down.sql`, etc.

### P3. Interpolacao de INTERVAL em SQL (MEDIO)

**Locais:**
- brute-force-service.js:271
- audit-service.js:252, 271, 303

**Problema:** Embora valores sejam internos, interpolacao em SQL e anti-pattern.

**Solucao:**
```javascript
// Usar parametro com casting
await this.pool.query(
  `SELECT COUNT(*) as count
   FROM audit_log
   WHERE action = 'login'
     AND status = 'failure'
     AND ip_address = $1
     AND created_at > NOW() - ($2 || ' minutes')::INTERVAL`,
  [ipAddress, this.config.ipFailureWindowMinutes]
);
```

### P4. SSL rejectUnauthorized: false (MEDIO)

**Local:** `/Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/src/config/database.js` linha 32

**Problema:** Desabilita verificacao de certificado SSL.

**Solucao:** Em producao, usar certificado CA do Render.

### P5. Backup Insuficiente (ALTO)

**Problema:**
- Retencao de apenas 7 dias
- Sem backup offsite
- Sem CRON configurado
- Free tier Render nao tem backup automatico

---

## 8. RECOMENDACOES

### Prioridade ALTA

1. **Remover credencial do render.yaml** - Mover para Environment Secrets
2. **Implementar rollback strategy** - Criar scripts de down migration
3. **Configurar backup automatico** - CRON + upload para S3/GCS
4. **Migrar para Render Starter** - Evitar perda de dados apos 90 dias

### Prioridade MEDIA

5. **Adicionar transacoes em run-migrations.js** - Wrap em BEGIN/COMMIT
6. **Criar indices ausentes** - entity_type+entity_id em audit_log
7. **Implementar paginacao real** - Parametros page/pageSize nas APIs
8. **Corrigir interpolacao INTERVAL** - Usar parametros

### Prioridade BAIXA

9. **Adicionar min ao pool** - `min: 2` para conexoes pre-aquecidas
10. **Adicionar statement_timeout** - Evitar queries travadas
11. **Documentar schema** - ERD diagram

---

## 9. SCHEMA OVERVIEW

```
                                    +----------------+
                                    |     users      |
                                    +----------------+
                                    | id (UUID PK)   |
                                    | email          |
                                    | password_hash  |
                                    | name           |
                                    | role           |
                                    +-------+--------+
                                            |
            +---------------+---------------+---------------+---------------+
            |               |               |               |               |
            v               v               v               v               v
    +-------------+  +-------------+  +-------------+  +-------------+  +-------------+
    | sessions    |  |conversations|  |   projects  |  |   uploads   |  | audit_log   |
    +-------------+  +-------------+  +-------------+  +-------------+  +-------------+
    | sid (PK)    |  | id (PK)     |  | id (PK)     |  | id (PK)     |  | id (PK)     |
    | user_id FK  |  | user_id FK  |  | user_id FK  |  | user_id FK  |  | user_id FK  |
    +------+------+  +------+------+  +------+------+  +-------------+  +-------------+
                            |               |
                            v               v
                     +-------------+  +-------------+
                     |  messages   |  |  documents  |
                     +-------------+  +-------------+
                     | id (PK)     |  | id (PK)     |
                     | conv_id FK  |  | project FK  |
                     +-------------+  | conv_id FK  |
                                      | user_id FK  |
                                      +-------------+

    +------------------+    +------------------+    +----------------------+
    | password_history |    |   ip_blacklist   |    | password_reset_tokens|
    +------------------+    +------------------+    +----------------------+
    | id (PK)          |    | ip_address (PK)  |    | id (PK)              |
    | user_id FK       |    | blocked_until    |    | user_id FK           |
    +------------------+    +------------------+    | token                |
                                                    +----------------------+
```

---

## 10. CONCLUSAO

O banco de dados do ROM-Agent possui uma arquitetura solida com:

**Pontos Fortes:**
- Schema bem normalizado (3NF)
- Migrations idempotentes
- Indices adequados para queries principais
- Connection pooling configurado
- Prepared statements (sem SQL injection)
- Soft delete implementado
- Audit logging completo

**Pontos de Atencao:**
- Credencial exposta no render.yaml
- Ausencia de rollback strategy
- Backup insuficiente para producao
- Free tier do Render com limitacoes

**Score Final: 72/100**

O sistema esta funcional para MVP/Beta, mas requer ajustes antes de uso em producao com dados criticos.
