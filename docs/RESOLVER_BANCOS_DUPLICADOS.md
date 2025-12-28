# 🔧 RESOLVER: Dois Bancos PostgreSQL Duplicados

**Data:** 2025-12-27
**Problema descoberto:** Existem DOIS bancos no Render Dashboard
**Status:** 🔴 CAUSANDO CONFUSÃO - Precisa resolver

---

## 🎯 PROBLEMA IDENTIFICADO

Você descobriu que existem **2 bancos PostgreSQL** no Render:

1. ❓ **sceap-v5-db** (possível typo de "scape"?)
2. ❓ **seca-v5-db**

**Ambos têm a mesma variável de ambiente `DATABASE_URL`**, causando:
- ❌ Confusão sobre qual banco usar
- ❌ Produção pode estar apontando para banco errado
- ❌ Staging pode estar em um, produção em outro
- ❌ Dados fragmentados entre dois bancos

---

## 📋 PASSO 1: Identificar Qual Banco é o Correto

### Verificar ambos os bancos no Render Dashboard:

1. **Ir para:** https://dashboard.render.com/ → **Databases** (sidebar esquerda)

2. **Para CADA banco, anotar:**

#### Banco 1: `sceap-v5-db`
```
□ ID do banco: dpg-_______________
□ Internal URL: postgresql://_______________
□ Criado em: _______________
□ Região: _______________
□ Plan: Starter / Standard
□ Status: Available / Suspended
```

#### Banco 2: `seca-v5-db`
```
□ ID do banco: dpg-_______________
□ Internal URL: postgresql://_______________
□ Criado em: _______________
□ Região: _______________
□ Plan: Starter / Standard
□ Status: Available / Suspended
```

---

## 🔍 PASSO 2: Identificar Qual Tem Dados

Vamos verificar qual banco tem as **tabelas e dados** que criamos:

### Testar Banco 1: `sceap-v5-db`

```bash
# Copie a Internal URL do banco 1 e teste:
node -e "
import('pg').then(async ({ default: pg }) => {
  const client = new pg.Client({
    connectionString: 'COLAR_URL_DO_BANCO_1_AQUI',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ BANCO 1 (sceap-v5-db) - Conectado!');

    // Listar tabelas
    const tables = await client.query(\`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    \`);

    console.log('📋 Tabelas encontradas:', tables.rows.length);
    tables.rows.forEach(row => console.log('  -', row.table_name));

    // Contar usuários
    const users = await client.query('SELECT COUNT(*) FROM users');
    console.log('👥 Total de usuários:', users.rows[0].count);

    await client.end();
  } catch (error) {
    console.error('❌ Erro ao conectar:', error.message);
  }
});
"
```

### Testar Banco 2: `seca-v5-db`

```bash
# Copie a Internal URL do banco 2 e teste:
node -e "
import('pg').then(async ({ default: pg }) => {
  const client = new pg.Client({
    connectionString: 'COLAR_URL_DO_BANCO_2_AQUI',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ BANCO 2 (seca-v5-db) - Conectado!');

    // Listar tabelas
    const tables = await client.query(\`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    \`);

    console.log('📋 Tabelas encontradas:', tables.rows.length);
    tables.rows.forEach(row => console.log('  -', row.table_name));

    // Contar usuários
    const users = await client.query('SELECT COUNT(*) FROM users');
    console.log('👥 Total de usuários:', users.rows[0].count);

    await client.end();
  } catch (error) {
    console.error('❌ Erro ao conectar:', error.message);
  }
});
"
```

---

## 🎯 PASSO 3: Decidir Qual Usar

### Cenário A: Um banco tem dados, outro está vazio

**Solução:**
1. ✅ **MANTER:** Banco que tem tabelas + usuários
2. ❌ **DELETAR:** Banco vazio
3. ✅ **CONFIGURAR:** Staging E Produção apontam para o banco com dados

### Cenário B: Ambos têm dados

**Solução:**
1. 🔍 Verificar qual Staging está usando (ele funciona!)
2. ✅ **MANTER:** Mesmo banco que Staging usa
3. ❌ **DELETAR:** Outro banco (ou migrar dados se necessário)

### Cenário C: Ambos estão vazios

**Solução:**
1. 🗑️ **DELETAR AMBOS**
2. 🆕 **CRIAR NOVO** com nome claro: `rom-agent-db`
3. ✅ **CONFIGURAR:** Staging E Produção usam o novo

---

## 🔧 PASSO 4: Verificar Qual Staging Está Usando

Para saber qual banco Staging está conectado:

```bash
# Ver variável configurada no Render
# Ir em: Render Dashboard → Staging Service → Environment

# Ou testar qual URL staging está usando:
curl -s "https://staging.iarom.com.br/health" | python3 -c "
import json, sys
j = json.load(sys.stdin)
print('PostgreSQL:', j.get('database',{}).get('postgres',{}).get('available'))
print('Latência:', j.get('database',{}).get('postgres',{}).get('latency'))
"
```

**Se staging conecta (True, 12ms)** → Staging está usando o banco correto!

**Ir no Render Dashboard → Staging → Environment** e ver qual `DATABASE_URL` está configurada.

**A URL configurada lá** → É o banco correto que produção também deve usar!

---

## ✅ PASSO 5: Configurar Produção Corretamente

Depois de identificar o banco correto:

1. **Render Dashboard → Produção (iarom.com.br) → Environment**
2. **Deletar** `DATABASE_URL` atual (se existir)
3. **Adicionar** nova `DATABASE_URL`:
   ```
   Key: DATABASE_URL
   Value: [MESMA URL QUE STAGING USA]
   ```
4. **Adicionar** `NODE_ENV`:
   ```
   Key: NODE_ENV
   Value: production
   ```
5. **Save Changes** → Aguardar redeploy (2-3 min)

---

## 🗑️ PASSO 6: Deletar Banco Duplicado

Após confirmar qual banco é correto:

1. **Render Dashboard → Databases**
2. **Clicar** no banco ERRADO (não usado)
3. **Settings** (aba superior) → **Delete Database**
4. **Confirmar** digitando o nome do banco

⚠️ **CUIDADO:** Só delete depois de confirmar que:
- ✅ Staging funciona com o banco correto
- ✅ Produção está configurada para usar o mesmo
- ✅ Não há dados importantes no banco a deletar

---

## 📊 RESUMO EXECUTIVO

### O que aconteceu:
- Você criou/tem 2 bancos PostgreSQL no Render
- Nomes similares: `sceap-v5-db` e `seca-v5-db`
- Causou confusão sobre qual usar
- Possivelmente staging usa um, produção tenta usar outro (ou nenhum)

### Como resolver:
1. ✅ Identificar qual banco tem dados (testes acima)
2. ✅ Verificar qual staging usa (está funcionando)
3. ✅ Configurar produção para usar o MESMO
4. ✅ Deletar banco duplicado/vazio

### Resultado esperado:
- ✅ Um único banco PostgreSQL
- ✅ Staging E Produção usando o mesmo
- ✅ Produção conecta com sucesso
- ✅ PostgreSQL: True, Latência: 2-15ms

---

## 💡 PRÓXIMOS PASSOS IMEDIATOS

**Agora, você precisa:**

1. **Copiar as URLs de ambos os bancos** (Render Dashboard → Databases)
2. **Rodar os testes acima** para ver qual tem tabelas/usuários
3. **Verificar qual Staging usa** (Render → Staging → Environment → DATABASE_URL)
4. **Me informar qual é o banco correto**
5. **Configurar produção** com a URL certa
6. **Deletar o duplicado**

**Qual das duas URLs você quer que eu use para configurar produção?**
- URL do `sceap-v5-db`?
- URL do `seca-v5-db`?
- Ou quer que eu ajude a descobrir qual é o correto?
