# 🔄 Migração de Conversas - JSON → PostgreSQL

## Problema

As conversas antigas estão salvas em `data/conversations.json` mas o dashboard busca do PostgreSQL. Por isso o sidebar aparece vazio.

## Solução

Executar script de migração que transfere todas as conversas do JSON para o PostgreSQL.

---

## 🚀 Como Executar (Produção - Render.com)

### Opção 1: Via Shell do Render

1. Acesse https://dashboard.render.com/
2. Selecione o serviço `rom-agent` (produção)
3. Clique em **"Shell"** no menu superior
4. Execute o comando:

```bash
node scripts/migrate-conversations-to-postgres.js
```

5. Aguarde a migração concluir (~30 segundos)
6. Verifique o resultado:
   - ✅ Conversas migradas: X
   - 💬 Mensagens inseridas: Y

### Opção 2: Via SSH

Se tiver acesso SSH configurado:

```bash
render ssh rom-agent
node scripts/migrate-conversations-to-postgres.js
```

---

## 📊 O que o Script Faz

1. ✅ Conecta ao PostgreSQL do Render
2. 📖 Lê todas as conversas de `data/conversations.json`
3. 🔍 Verifica quais já existem no PostgreSQL (evita duplicação)
4. ➕ Insere conversas novas na tabela `conversations`
5. 💬 Insere todas as mensagens na tabela `messages`
6. 📈 Mostra relatório final

## 🔒 Segurança

- ✅ Não sobrescreve conversas existentes
- ✅ Preserva timestamps originais
- ✅ Mantém estrutura de mensagens
- ✅ Não deleta o arquivo JSON (backup)

---

## 📋 Resultado Esperado

Após executar o script, você verá:

```
═══════════════════════════════════════════════════════════════
📊 RESULTADO DA MIGRAÇÃO
═══════════════════════════════════════════════════════════════

✅ Conversas migradas: 18
⏭️  Conversas puladas (já existiam): 0
💬 Mensagens inseridas: 45

📈 TOTAIS NO POSTGRESQL:
   Conversas: 18
   Mensagens: 45

🎉 Migração concluída com sucesso!
```

---

## ✅ Verificação

Após a migração:

1. Acesse https://iarom.com.br
2. Abra o **Dashboard**
3. Verifique o **Sidebar** à esquerda
4. Você deve ver todas as 18 conversas antigas
5. Clique em qualquer conversa para ver o histórico completo

---

## 🆘 Troubleshooting

### "Erro ao conectar ao PostgreSQL"

**Problema:** Variável `DATABASE_URL` não configurada

**Solução:**
1. Verifique se `DATABASE_URL` está nas variáveis de ambiente do Render
2. Em Settings → Environment, adicione:
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/rom_agent
   ```

### "Conversas já existem no PostgreSQL"

**Problema:** Script já foi executado antes

**Solução:**
- ✅ Isso é normal! O script detecta e pula conversas duplicadas
- Nenhuma ação necessária

### "Nenhuma conversa nova para migrar"

**Problema:** Todas as conversas já foram migradas

**Solução:**
- ✅ Migração já completa!
- Verifique o dashboard

---

## 📝 Notas Importantes

1. **Executar apenas UMA vez em produção**
   - O script é idempotente (pode rodar múltiplas vezes sem problemas)
   - Mas é recomendado executar apenas uma vez

2. **Backup automático**
   - O arquivo JSON original é preservado
   - Pode ser usado como backup se necessário

3. **Novas conversas**
   - Após a migração, todas as conversas novas são salvas automaticamente no PostgreSQL
   - Não é necessário executar o script novamente

---

## 🎯 Após a Migração

Todas as funcionalidades estarão ativas:

- ✅ Sidebar mostra conversas antigas e novas
- ✅ Histórico completo (perguntas + respostas)
- ✅ Títulos das conversas
- ✅ Timestamps corretos
- ✅ Busca por conversas
- ✅ Deletar conversas
- ✅ Renomear conversas

**Data:** 07/01/2026
**Versão:** 2.8.1
