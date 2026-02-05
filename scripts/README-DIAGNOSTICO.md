# 🔍 Scripts de Diagnóstico - Render Deploy

Este diretório contém scripts para diagnosticar problemas de deploy no Render.

---

## 📋 Scripts Disponíveis

### 1. `test-render-deployment.js` - Teste Completo do Deploy

Executa 16 testes automatizados no serviço Render:
- Conectividade básica (DNS, HTTP, SSL)
- Endpoints críticos (API, frontend)
- Performance e timeouts
- Headers e status do Render
- Diagnóstico automático com recomendações

**Uso:**

```bash
# Testar Render (produção)
node scripts/test-render-deployment.js

# Testar localhost
node scripts/test-render-deployment.js --local

# Testar URL customizada
node scripts/test-render-deployment.js --url https://seu-dominio.com
```

**Saída:**
- ✅/❌ Status de cada teste
- 📊 Relatório com taxa de sucesso
- 🔍 Diagnóstico automático com causas prováveis
- 📋 Próximos passos recomendados

**Exemplo de Output:**

```
╔══════════════════════════════════════════════════════════════╗
║  🔍 DIAGNÓSTICO COMPLETO DE DEPLOY - RENDER                 ║
╚══════════════════════════════════════════════════════════════╝

🎯 Target: https://rom-agent.onrender.com

──────────────────────────────────────────────────────────────
📋 TESTE 1: CONECTIVIDADE BÁSICA
──────────────────────────────────────────────────────────────

✅ 1.1 DNS Resolution                                 [PASS]
✅ 1.2 HTTP/HTTPS Connection                          [PASS]
❌ 1.3 Response Headers                               [FAIL]
   x-render-routing: no-server

...

📊 RELATÓRIO FINAL
Total de Testes:    16
✅ Passaram:        7
❌ Falharam:        9
Taxa de Sucesso:    43.8%

🔍 DIAGNÓSTICO AUTOMÁTICO
❌ CRÍTICO: Render retornando "no-server"
```

---

### 2. `analyze-render-logs.js` - Analisador de Logs

Analisa logs copiados do Render Dashboard e identifica problemas automaticamente:
- 🚨 Erros críticos (crashes, OOM, módulos não encontrados)
- ⚠️ Avisos (deprecations, promises não tratadas)
- 💾 Eventos de database/migrations
- 🚀 Eventos de startup (servidor iniciado, workers)
- 📋 Últimas 10 linhas
- 🔍 Diagnóstico automático

**Uso:**

```bash
# Método 1: Colar logs (modo interativo)
node scripts/analyze-render-logs.js
# Cole os logs e pressione Ctrl+D

# Método 2: Arquivo
node scripts/analyze-render-logs.js logs.txt

# Método 3: Pipe
cat logs.txt | node scripts/analyze-render-logs.js
```

**Padrões Detectados:**

| Tipo | Exemplos |
|------|----------|
| **Erros Críticos** | `Error:`, `TypeError:`, `Cannot find module`, `Out of memory`, `Exited with code 1` |
| **Database** | `DATABASE_URL não configurado`, `Conectando ao PostgreSQL`, `Migrations concluídas` |
| **Startup** | `Servidor iniciado na porta 3000`, `Worker 12345 iniciado` |
| **Avisos** | `Warning`, `Deprecated`, `UnhandledPromiseRejection` |

**Exemplo de Output:**

```
╔══════════════════════════════════════════════════════════════╗
║  🚨 ERROS CRÍTICOS ENCONTRADOS                              ║
╚══════════════════════════════════════════════════════════════╝

❌ 1. MÓDULO NÃO ENCONTRADO
   Linha 45: Error: Cannot find module 'xyz'

❌ 2. PROCESSO TERMINOU
   Linha 67: Exited with code 1

─────────────────────────────────────────────────────────────
🔍 DIAGNÓSTICO AUTOMÁTICO
─────────────────────────────────────────────────────────────

❌ PROBLEMA: MÓDULO NÃO ENCONTRADO

O código está tentando importar um módulo que não existe.

SOLUÇÕES:
  1. Verificar package.json (npm install localmente)
  2. Verificar imports no código (path correto?)
  3. Limpar build cache do Render e rebuildar
```

---

## 🚀 Workflow Recomendado

### Quando o Serviço Está DOWN:

```bash
# PASSO 1: Executar teste de conectividade
node scripts/test-render-deployment.js

# PASSO 2: Se detectar "no-server", obter logs do Render:
# → Dashboard → Logs → Copiar últimas 50-100 linhas → Salvar em logs.txt

# PASSO 3: Analisar logs
node scripts/analyze-render-logs.js logs.txt

# PASSO 4: Baseado no diagnóstico, aplicar fix ou rollback
```

---

## 📊 Interpretando Resultados

### `test-render-deployment.js`

| Status | Significado |
|--------|-------------|
| `✅ PASS` | Teste passou - componente funcional |
| `❌ FAIL` | Teste falhou - problema identificado |
| `x-render-routing: no-server` | **CRÍTICO** - Servidor não está respondendo |
| Taxa < 50% | Serviço está DOWN ou com problemas graves |
| Taxa > 80% | Serviço funcional, possíveis avisos |

### `analyze-render-logs.js`

| Diagnóstico | Ação Recomendada |
|-------------|------------------|
| **OUT OF MEMORY** | Upgrade plano Render ou reduzir workers |
| **MÓDULO NÃO ENCONTRADO** | Verificar package.json e imports |
| **ERRO DE DATABASE** | Verificar DATABASE_URL e conexão |
| **PROCESSO TERMINOU** | Revisar erros críticos nos logs |
| **SERVIDOR NÃO INICIOU** | Verificar última linha do log (travamento?) |

---

## 🔧 Troubleshooting

### Problema: "Cannot find module"

```bash
# Verificar se módulo está no package.json
cat package.json | grep "module-name"

# Instalar localmente para testar
npm install

# Verificar import
grep -r "import.*module-name" src/
```

### Problema: "x-render-routing: no-server"

```bash
# 1. Obter logs de runtime (não deploy logs!)
# 2. Analisar com script:
node scripts/analyze-render-logs.js logs.txt

# 3. Se inconclusivo, fazer rollback temporário:
# Dashboard → Events → Deploy anterior estável → Redeploy
```

### Problema: Timeouts

```bash
# Verificar métricas de memória
# Dashboard → Metrics → Memory Usage

# Se > 90%, considerar:
# - Upgrade de plano
# - Reduzir workers em src/server-cluster.js
```

---

## 📂 Arquivos Relacionados

- `DIAGNÓSTICO-RENDER.md` - Documentação completa do diagnóstico atual
- `test-render-deployment.js` - Script de testes automatizados
- `analyze-render-logs.js` - Analisador de logs
- `start-with-migrations.js` - Script de startup do Render

---

## 💡 Dicas

1. **Sempre obtenha logs de RUNTIME, não logs de DEPLOY**
   - Deploy logs: mostram npm install, build, etc.
   - Runtime logs: mostram o que acontece quando servidor roda

2. **Teste localmente primeiro**
   ```bash
   npm run db:migrate
   npm start
   node scripts/test-render-deployment.js --local
   ```

3. **Use Render Metrics para verificar memória**
   - Dashboard → Metrics → Memory
   - Se > 90%, é OOM (Out of Memory)

4. **Em caso de dúvida, faça rollback temporário**
   - Volte para commit estável
   - Investigue problema localmente
   - Aplique fix e redeploy

---

## 🆘 Suporte

- **Render Status:** https://status.render.com/
- **Render Docs:** https://render.com/docs
- **Dashboard:** https://dashboard.render.com/

---

**Última Atualização:** 04/02/2026
