# QUICK START - DEPLOY IAROM V5.0

**Para quem tem pressa:** Execute estes comandos e pronto.

---

## OPÇÃO 1: SCRIPT AUTOMÁTICO (RECOMENDADO)

### Um único comando:

```bash
cd ~/ROM-Agent && bash scripts/deploy-iarom-v5.sh
```

**Tempo:** 10-15 minutos
**Interação:** Você confirma 3x (deleções, commit, push)

---

## OPÇÃO 2: COMANDOS MANUAIS (CONTROLE TOTAL)

### 1. Preparação (2 min)

```bash
cd ~/ROM-Agent
git status
mkdir -p data/knowledge-base/{modules,master} docs/iarom/relatorios
```

### 2. Cópia de arquivos (5 min)

```bash
# Prompts específicos
cp ~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/03_PROMPTS_ESPECIFICOS/*/*.txt \
   data/prompts/global/

# Módulos
cp ~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/02_MODULOS/*.txt \
   data/knowledge-base/modules/

# Master prompts
cp ~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/01_PROMPT_MASTER/IAROM_*.txt \
   data/knowledge-base/master/

# Custom Instructions
cp ~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/01_PROMPT_MASTER/CUSTOM_INSTRUCTIONS_V5.0.txt \
   data/custom-instructions/

# Documentação
cp ~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/05_DOCUMENTACAO/*.md docs/iarom/
cp ~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/04_RELATORIOS/*.md docs/iarom/relatorios/
```

### 3. Git (5 min)

```bash
git add -u data/prompts/global/  # Remove antigos
git add data/ docs/              # Adiciona novos
git commit -m "feat: Add IAROM v5.0 refactored prompts and modules

- Remove 77 old V5.0 prompts with decorative elements
- Add 92 refactored specific prompts (clean, modular)
- Add 8 IAROM modules (core, validation, transcription, etc)
- Add 2 master prompts and orchestrator
- Add Custom Instructions V5.0
- Add comprehensive IAROM documentation

System ready for autonomous agent deployment.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

git push origin main
```

### 4. Validação (10 min)

```bash
# Aguardar deploy
sleep 60

# Testar API
curl https://iarom.com.br/health
curl https://iarom.com.br/api/prompts | jq '.prompts | length'
```

---

## VALIDAÇÃO RÁPIDA

### Checklist mínimo:

```bash
# ✅ Prompts copiados?
ls data/prompts/global/*.txt | wc -l
# Esperado: 92+

# ✅ Módulos copiados?
ls data/knowledge-base/modules/*.txt | wc -l
# Esperado: 8

# ✅ Commit feito?
git log --oneline -1
# Deve aparecer "feat: Add IAROM v5.0..."

# ✅ Push feito?
git status
# Deve estar "up to date with origin/main"

# ✅ Deploy OK?
curl https://iarom.com.br/health
# Deve retornar: {"status":"ok"}
```

---

## SE ALGO DER ERRADO

### Rollback Git:

```bash
git revert HEAD
git push origin main
```

### Rollback Render:

Acessar: https://dashboard.render.com/web/srv-d4ueaf2li9vc73d3rj00
Clicar em: Deploys > Rollback to previous deploy

---

## PRÓXIMOS PASSOS

```bash
# Criar tag de versão
git tag -a v5.0.0 -m "IAROM V5.0 - Refactored prompts"
git push origin v5.0.0

# Monitorar logs
# https://dashboard.render.com/web/srv-d4ueaf2li9vc73d3rj00/logs
```

---

## DOCUMENTAÇÃO COMPLETA

- **Plano detalhado:** `PLANO_DEPLOY_IAROM_V5.md`
- **Resumo executivo:** `DEPLOY_V5_RESUMO_EXECUTIVO.md`
- **Checklist:** `CHECKLIST_DEPLOY_V5.md`

---

**Tempo total:** 15-30 minutos
**Risco:** BAIXO
**Impacto:** ALTO (qualidade dos prompts)

**Pronto para executar!**
