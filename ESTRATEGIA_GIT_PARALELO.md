# ESTRATÉGIA GIT PARA EXECUÇÃO PARALELA
## Prevenção de Conflitos em Correções Multi-Terminal

---

## 🎯 PROBLEMA

Quando múltiplos terminais editam arquivos simultaneamente, pode ocorrer:
- **Conflitos de merge** ao tentar commitar
- **Perda de trabalho** se um terminal sobrescrever alterações de outro
- **Estado inconsistente** do repositório

---

## ✅ SOLUÇÃO: BRANCHES ISOLADOS + MERGE COORDENADO

### Estratégia

Cada terminal trabalha em **seu próprio branch** isolado, e ao final o orquestrador faz um **merge coordenado e sequencial**.

---

## 📋 IMPLEMENTAÇÃO

### Fase 1: Preparação (Orquestrador)

```bash
# 1. Criar branch main de trabalho
git checkout -b orchestration/main-$(date +%Y%m%d-%H%M%S)

# 2. Criar branches para cada terminal
git checkout -b orchestration/terminal-security
git checkout -b orchestration/terminal-scrapers
git checkout -b orchestration/terminal-frontend
git checkout -b orchestration/terminal-refactor

# 3. Voltar para branch principal
git checkout orchestration/main-*
```

### Fase 2: Execução Paralela (Cada Terminal)

**Terminal 2 (Segurança)**:
```bash
git checkout orchestration/terminal-security

# Trabalhar apenas nos arquivos de segurança
- src/server-enhanced.js (adicionar auth nos endpoints)
- src/middlewares/auth.js (criar middleware)
- src/middlewares/rate-limiter.js (criar)
- .env (atualizar variáveis)

# Commitar apenas quando terminar
git add src/middlewares/*
git commit -m "feat(security): Add authentication middleware"

git add src/server-enhanced.js
git commit -m "feat(security): Protect 40+ vulnerable routes"

# Marcar como concluído
touch $LOGS_DIR/terminal2-done.flag
```

**Terminal 3 (Scrapers)**:
```bash
git checkout orchestration/terminal-scrapers

# Trabalhar apenas nos arquivos de scrapers
- python-scrapers/* (copiar do Desktop)
- src/services/python-bridge.js (criar)
- src/services/datajud-service.js (implementar API real)
- lib/jusbrasil-client.js (resolver anti-bot)

# Commitar por componente
git add python-scrapers/
git commit -m "feat(scrapers): Add Python scrapers from Desktop"

git add src/services/python-bridge.js
git commit -m "feat(scrapers): Create Node.js → Python bridge"

git add src/services/datajud-service.js
git commit -m "feat(api): Implement real DataJud API"

git add lib/jusbrasil-client.js
git commit -m "fix(scraper): Resolve JusBrasil anti-bot blocking"

# Marcar como concluído
touch $LOGS_DIR/terminal3-done.flag
```

**Terminal 4 (Frontend)**:
```bash
git checkout orchestration/terminal-frontend

# Trabalhar apenas nos arquivos de frontend
- frontend/src/* (verificar/reconstruir)
- frontend/package.json
- public/* (rebuild)

# Commitar
git add frontend/
git commit -m "fix(frontend): Rebuild/verify frontend components"

# Marcar como concluído
touch $LOGS_DIR/terminal4-done.flag
```

**Terminal 5 (Refatoração)**:
```bash
git checkout orchestration/terminal-refactor

# Trabalhar apenas em refatorações que não conflitam
- src/utils/* (código duplicado)
- tests/* (adicionar testes)
- scripts/* (scripts de automação)
- docs/* (documentação)

# Commitar
git add src/utils/
git commit -m "refactor(utils): Remove duplicate code"

git add tests/
git commit -m "test: Add automated tests"

# Marcar como concluído
touch $LOGS_DIR/terminal5-done.flag
```

### Fase 3: Merge Coordenado (Orquestrador)

**Após todos os terminais concluírem**:

```bash
# Aguardar todas as flags de conclusão
while [ ! -f "$LOGS_DIR/terminal2-done.flag" ] || \
      [ ! -f "$LOGS_DIR/terminal3-done.flag" ] || \
      [ ! -f "$LOGS_DIR/terminal4-done.flag" ] || \
      [ ! -f "$LOGS_DIR/terminal5-done.flag" ]; do
  sleep 5
done

# Merge sequencial (ordem de prioridade)
git checkout orchestration/main-*

# 1. Merge Terminal 2 (Segurança - PRIORIDADE MÁXIMA)
log "Mergeando correções de segurança..."
git merge orchestration/terminal-security --no-ff -m "chore: Merge security fixes"
check_exit_status "Merge security"

# 2. Merge Terminal 3 (Scrapers)
log "Mergeando scrapers..."
git merge orchestration/terminal-scrapers --no-ff -m "chore: Merge scraper implementations"
check_exit_status "Merge scrapers"

# 3. Merge Terminal 4 (Frontend)
log "Mergeando frontend..."
git merge orchestration/terminal-frontend --no-ff -m "chore: Merge frontend fixes"
check_exit_status "Merge frontend"

# 4. Merge Terminal 5 (Refatoração)
log "Mergeando refatorações..."
git merge orchestration/terminal-refactor --no-ff -m "chore: Merge refactoring"
check_exit_status "Merge refactor"

# 5. Verificar se há conflitos
if git status | grep -q "Unmerged paths"; then
  error "CONFLITOS DETECTADOS!"
  log "Conflitos precisam ser resolvidos manualmente"
  log "Execute: git status para ver arquivos em conflito"
  exit 1
fi

log "✓ Merge concluído sem conflitos"
```

### Fase 4: Validação e Finalização

```bash
# Executar testes para garantir que tudo funciona
log "Executando testes..."
npm test
check_exit_status "Tests"

# Build do frontend
log "Building frontend..."
cd frontend && npm run build
check_exit_status "Frontend build"

# Executar linter
log "Executando linter..."
npm run lint
check_exit_status "Linter"

# Se tudo passou, fazer commit final
git add -A
git commit -m "chore: Final integration after orchestration

All terminals completed successfully:
- Terminal 2: Security fixes (40+ routes protected)
- Terminal 3: Scrapers implementation (10 scrapers)
- Terminal 4: Frontend rebuild
- Terminal 5: Refactoring and optimization

Tests: ✓ Passing
Build: ✓ Successful
Lint: ✓ Clean
"

log "✓ Integração concluída e validada"
```

---

## 🔒 SISTEMA DE LOCK DE ARQUIVOS

Para casos onde arquivos podem ser editados por múltiplos terminais, usar **file locks**:

### Implementação

```bash
#!/bin/bash
# scripts/file-lock.sh

LOCK_DIR="$LOGS_DIR/locks"
mkdir -p "$LOCK_DIR"

# Função para adquirir lock
acquire_lock() {
  local file="$1"
  local terminal="$2"
  local lock_file="$LOCK_DIR/$(echo "$file" | tr '/' '_').lock"

  # Tentar criar lock (atomicamente)
  while ! mkdir "$lock_file" 2>/dev/null; do
    log "Aguardando lock para $file..."
    sleep 2
  done

  # Registrar quem tem o lock
  echo "$terminal" > "$lock_file/owner"
  log "✓ Lock adquirido para $file"
}

# Função para liberar lock
release_lock() {
  local file="$1"
  local lock_file="$LOCK_DIR/$(echo "$file" | tr '/' '_').lock"

  rm -rf "$lock_file"
  log "✓ Lock liberado para $file"
}
```

### Uso nos Terminais

```bash
source ./scripts/file-lock.sh

# Antes de editar arquivo compartilhado
acquire_lock "src/server-enhanced.js" "terminal-2"

# Editar arquivo
sed -i '' 's/TODO/DONE/' src/server-enhanced.js

# Commitar
git add src/server-enhanced.js
git commit -m "fix: Update file"

# Liberar lock
release_lock "src/server-enhanced.js"
```

---

## 📊 MATRIZ DE CONFLITOS

Mapeamento de quais terminais podem editar quais arquivos:

| Arquivo | Terminal 2 | Terminal 3 | Terminal 4 | Terminal 5 |
|---------|------------|------------|------------|------------|
| `src/server-enhanced.js` | ✅ Auth | ❌ | ❌ | ❌ |
| `src/services/datajud-service.js` | ❌ | ✅ API | ❌ | ❌ |
| `lib/jusbrasil-client.js` | ❌ | ✅ Scraper | ❌ | ❌ |
| `frontend/src/*` | ❌ | ❌ | ✅ UI | ❌ |
| `src/utils/*` | ❌ | ❌ | ❌ | ✅ Refactor |
| `tests/*` | ❌ | ❌ | ❌ | ✅ Tests |
| `.env` | ✅ Config | ❌ | ❌ | ❌ |
| `package.json` | 🔒 Lock | 🔒 Lock | 🔒 Lock | 🔒 Lock |

**Legenda**:
- ✅ Pode editar livremente
- ❌ Não deve editar
- 🔒 Requer lock

---

## 🚨 ESTRATÉGIA DE ROLLBACK

Se algo der errado durante o merge:

```bash
# Abortar merge em andamento
git merge --abort

# Voltar para estado anterior
git reset --hard HEAD

# Ou resetar para commit específico
git reset --hard <commit-hash>

# Restaurar do backup
cp -r "$BACKUP_DIR"/* ./
```

---

## ✅ CHECKLIST DE SEGURANÇA

Antes de iniciar:
- [ ] Código atual está commitado
- [ ] Backup foi criado
- [ ] Branches de trabalho foram criados
- [ ] Sistema de lock está funcionando

Durante execução:
- [ ] Cada terminal trabalha apenas em seus arquivos designados
- [ ] Commits são feitos incrementalmente
- [ ] Locks são adquiridos para arquivos compartilhados

Após conclusão:
- [ ] Todos os terminais finalizaram
- [ ] Merge foi bem-sucedido
- [ ] Testes passaram
- [ ] Build está OK

---

## 📝 EXEMPLO DE EXECUÇÃO SEGURA

```bash
# 1. Executar orquestrador com estratégia Git
./scripts/orchestrator.sh --git-strategy

# O orquestrador irá:
# - Criar branches isolados
# - Iniciar terminais (cada um em seu branch)
# - Monitorar conclusão
# - Fazer merge coordenado
# - Validar integração
# - Commitar resultado final

# 2. Se tudo passou, fazer push
git push origin orchestration/main-*

# 3. Criar Pull Request (se workflow de PR)
gh pr create --title "Orchestrated Fixes" --body "See AUDITORIA_FORENSE_COMPLETA_2026-01-08.md"
```

---

## 🎓 VANTAGENS DESTA ABORDAGEM

1. **Zero Conflitos**: Cada terminal trabalha isolado
2. **Rastreabilidade**: Histórico Git claro de quem fez o quê
3. **Rollback Fácil**: Pode desfazer merge de qualquer terminal
4. **Validação**: Testes após cada merge
5. **Paralelização**: Máxima velocidade sem riscos
6. **Segurança**: Backup automático antes de começar

---

## 🔄 FLUXO VISUAL

```
main
  │
  ├── orchestration/main-20260108-100000
  │     │
  │     ├── orchestration/terminal-security  ─────┐
  │     │   (auth middleware, rate limiting)      │
  │     │                                          │
  │     ├── orchestration/terminal-scrapers ─────┤
  │     │   (Python bridge, DataJud, JusBrasil)   ├──> MERGE COORDENADO
  │     │                                          │
  │     ├── orchestration/terminal-frontend ─────┤
  │     │   (TSX rebuild, UI fixes)               │
  │     │                                          │
  │     └── orchestration/terminal-refactor ─────┘
  │         (utils, tests, docs)
  │
  └── (merge final após validação)
```

---

**Criado em**: 2026-01-08
**Versão**: 1.0.0
**Status**: Pronto para implementação
