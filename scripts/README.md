# 🤖 Scripts de Automação - ROM Agent IA

Esta pasta contém scripts de automação para testes, monitoramento e validação do sistema.

---

## 📋 Índice de Scripts

### 1. `autonomous-test-fix-loop.sh`
**Loop autônomo de testes e correções**

Executa testes automaticamente, aplica correções se disponíveis, faz commit/deploy e repete até o sistema estar 100% operacional.

**Uso:**
```bash
./scripts/autonomous-test-fix-loop.sh
```

**O que faz:**
- ✅ Testa endpoint principal (200)
- ✅ Valida KB Cache (sem "undefined")
- ✅ Verifica CSP headers
- ✅ Testa ferramentas disponíveis
- 🔧 Aplica correções automáticas se disponível
- 📦 Faz commit e deploy automático
- 🔄 Repete até perfeição (max 10 iterações)

**Resultado esperado:**
```
🎉 SUCESSO TOTAL!
Sistema está 100% operacional
Iterações necessárias: 1
```

---

### 2. `continuous-monitor.sh`
**Monitor contínuo de logs em tempo real**

Monitora logs do serviço, filtra e categoriza mensagens importantes, salva alertas.

**Uso:**
```bash
# Executar em foreground (bloqueante)
./scripts/continuous-monitor.sh

# Executar em background
./scripts/continuous-monitor.sh &
echo $! > /tmp/rom-monitor.pid

# Parar monitor
kill $(cat /tmp/rom-monitor.pid)
```

**Categorias de logs:**
- 🔴 **ALERTA:** Erros críticos (error, failed, crash, exception, undefined documentos)
- ⚠️ **WARNING:** Avisos (warning, warn)
- 📚 **KB:** Atividades do Knowledge Base (kb cache, upload, extract)
- 💬 **CHAT:** Atividades do chat (chat, stream, consultar)
- 🐛 **DEBUG:** Logs de debug

**Arquivo de alertas:**
```bash
cat /tmp/rom-agent-alerts.log
```

---

### 3. `test-kb-end-to-end.sh`
**Teste end-to-end do Knowledge Base**

Valida todo o fluxo de KB: cache, formato, documentos, consultas do chat e persistência.

**Uso:**
```bash
./scripts/test-kb-end-to-end.sh
```

**Testes executados:**
1. ✅ KB Cache sem "undefined"
2. ✅ Formato de kb-documents.json
3. ✅ Contagem de documentos
4. ✅ Consultas do chat ao KB
5. ⚠️ Persistência após logout/login (manual)

**Resultado:**
```
✅ KB Cache OK - sem undefined
📊 Documentos no KB: X
```

---

### 4. `pre-commit-validation.sh`
**Validação de código antes de commit**

Valida código contra erros conhecidos documentados em `LESSONS-LEARNED.md`.

**Uso:**
```bash
# Manual
./scripts/pre-commit-validation.sh

# Como git hook (automático)
ln -s ../../scripts/pre-commit-validation.sh .git/hooks/pre-commit
```

**Validações executadas:**
1. ✅ Secrets não gerados dinamicamente
2. ⚠️ JSON.parse com validação
3. ✅ API routes retornam JSON (não redirect)
4. ✅ CSP inclui backend URL
5. ⚠️ Frontend dist/ limpo antes de build
6. ⚠️ Commit message tem Co-Authored-By
7. ✅ Arquivos críticos presentes
8. ⚠️ Consulta a LESSONS-LEARNED.md

**Resultado:**
- ✅ Sucesso: prossegue com commit
- ⚠️ Warnings: pede confirmação
- ❌ Erro: bloqueia commit

---

### 5. `generate-final-report.sh`
**Gerador de relatório final**

Gera relatório completo em Markdown com status do sistema, bugs corrigidos, automação criada e próximos passos.

**Uso:**
```bash
./scripts/generate-final-report.sh
```

**Saída:**
- Arquivo: `RELATORIO-FINAL-YYYYMMDD-HHMMSS.md`
- Conteúdo: Status atual, bugs corrigidos, commits, próximos passos

---

## 🚀 Workflow Recomendado

### Antes de Começar a Trabalhar
```bash
# 1. Consultar documentação
cat LESSONS-LEARNED.md

# 2. Ver relatório mais recente
ls -lt RELATORIO-FINAL-*.md | head -1 | xargs cat

# 3. Verificar status atual
./scripts/test-kb-end-to-end.sh
```

### Durante o Desenvolvimento
```bash
# Monitor contínuo em background
./scripts/continuous-monitor.sh &

# Fazer mudanças no código...

# Validar antes de commit
./scripts/pre-commit-validation.sh
```

### Antes de Deploy
```bash
# 1. Executar checklist
cat PRE-DEPLOY-CHECKLIST.md

# 2. Testes automatizados
./scripts/autonomous-test-fix-loop.sh

# 3. Se passou, fazer deploy
git push origin staging
```

### Após Deploy
```bash
# 1. Aguardar 2-3 minutos

# 2. Validar deploy
./scripts/autonomous-test-fix-loop.sh

# 3. Verificar alertas
cat /tmp/rom-agent-alerts.log

# 4. Gerar relatório
./scripts/generate-final-report.sh
```

---

## 📚 Documentação Relacionada

| Documento | Propósito |
|-----------|-----------|
| `LESSONS-LEARNED.md` | Histórico de TODOS os erros e soluções (CONSULTA OBRIGATÓRIA) |
| `PRE-DEPLOY-CHECKLIST.md` | Checklist manual antes de deploy |
| `RELATORIO-FINAL-*.md` | Relatórios gerados de cada sessão |
| `scripts/README.md` | Este arquivo - guia dos scripts |

---

## 🔧 Configuração de Git Hooks

Para validação automática antes de cada commit:

```bash
# Criar symlink para git hook
cd /Users/rodolfootaviopereiradamotaoliveira/ROM-Agent
ln -sf ../../scripts/pre-commit-validation.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Testar
git commit -m "test" --allow-empty
# Deve executar validação automaticamente
```

---

## 🐛 Troubleshooting

### Script não executa
```bash
# Dar permissão de execução
chmod +x scripts/*.sh
```

### Monitor não para
```bash
# Encontrar PID
ps aux | grep continuous-monitor

# Matar processo
kill <PID>

# Ou usar arquivo de PID
kill $(cat /tmp/rom-monitor.pid)
```

### Testes falhando
```bash
# Ver logs completos
render logs -r srv-d51ppfmuk2gs73a1qlkg --tail -n 100

# Verificar deploy atual
render deploys list srv-d51ppfmuk2gs73a1qlkg | head -3

# Forçar restart
render services restart srv-d51ppfmuk2gs73a1qlkg
```

---

## 📊 Variáveis de Ambiente

Scripts usam estas variáveis (hardcoded, pode ser parametrizado):

| Variável | Valor | Uso |
|----------|-------|-----|
| `SERVICE_ID` | `srv-d51ppfmuk2gs73a1qlkg` | ID do serviço no Render |
| `BRANCH` | `staging` | Branch de deploy |
| `BASE_URL` | `https://rom-agent-ia.onrender.com` | URL do serviço |
| `MAX_ITERATIONS` | `10` | Máximo de iterações do autonomous loop |

Para customizar, edite as primeiras linhas de cada script.

---

## ⚠️ Avisos Importantes

1. **SEMPRE consulte `LESSONS-LEARNED.md` antes de commit/deploy**
2. **SEMPRE execute testes antes de deploy**
3. **NUNCA pule o checklist pré-deploy**
4. **SEMPRE documente novos erros em `LESSONS-LEARNED.md`**

---

## 🤝 Contribuindo

Ao adicionar novo script:

1. Criar script em `scripts/`
2. Dar permissão de execução: `chmod +x scripts/novo-script.sh`
3. Adicionar documentação neste README
4. Adicionar ao workflow recomendado se aplicável
5. Testar exaustivamente
6. Documentar em `LESSONS-LEARNED.md` se previne algum erro

---

**Criado por:** Claude Sonnet 4.5
**Data:** 04/04/2026
**Versão:** 1.0

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
