# ROM-AGENT - Configuração Claude Code

**Projeto:** ROM Agent - Sistema IA Jurídico
**Site:** https://iarom.com.br
**GitHub:** rodolfo-svg/ROM-Agent
**Deploy:** Render.com

---

## 🔄 INICIALIZAÇÃO AUTOMÁTICA

Quando iniciar trabalho neste projeto, **SEMPRE**:

### 1. VERIFICAR CONEXÕES

```bash
# GitHub
gh auth status

# Git local
git status
git branch

# Render CLI
render whoami
render services list

# Site online
curl -I https://iarom.com.br
```

**Esperado:**
- ✅ GitHub: autenticado como rodolfo-svg
- ✅ Git: sem conflitos, branch visível
- ✅ Render: autenticado e serviço "iarom" listado
- ✅ Site: HTTP 200 OK

---

### 2. AMBIENTE DO PROJETO

**Diretório:** `~/Desktop/ROM-Agent`

**Estrutura esperada:**
- `/src` - Código fonte backend
- `/frontend` - Frontend React
- `/lib` - Bibliotecas e módulos
- `/KB` - Knowledge Base
- `/scripts` - Scripts de automação
- `/public` - Assets públicos
- `package.json` - Dependências Node.js
- `.env` - Variáveis de ambiente (NÃO commitar)

**Verificações:**
```bash
# Node modules instalado?
ls node_modules/ > /dev/null && echo "✅ Instalado" || echo "❌ Executar: npm install"

# .env existe?
ls .env > /dev/null && echo "✅ Configurado" || echo "⚠️ Criar .env"

# Último commit
git log -1 --oneline

# Branch atual
git branch --show-current
```

---

### 3. VARIÁVEIS DE AMBIENTE NECESSÁRIAS

**Arquivo:** `.env` (local, não versionar)

**Obrigatórias:**
```env
# APIs IA
ANTHROPIC_API_KEY=sk-ant-...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1

# Banco de dados
DATABASE_URL=postgres://...

# Render
RENDER_API_KEY=...

# Aplicação
NODE_ENV=production
PORT=10000
```

**Verificar se existem:**
```bash
grep -q "ANTHROPIC_API_KEY" .env && echo "✅ Claude API" || echo "❌ Falta ANTHROPIC_API_KEY"
grep -q "DATABASE_URL" .env && echo "✅ Database" || echo "❌ Falta DATABASE_URL"
```

---

### 4. SERVIÇOS RENDER

**URL do serviço:** https://iarom.com.br
**Nome do serviço:** `iarom` (ou similar)

**Comandos úteis:**
```bash
# Listar serviços
render services list

# Ver logs em tempo real
render logs -f

# Status do último deploy
render deploys list --limit 1

# Fazer deploy manual
git push origin main  # Trigger automático
# OU
render deploy
```

---

### 5. WORKFLOW GIT RECOMENDADO

**Branches:**
- `main` - Produção (auto-deploy no Render)
- `dev` - Desenvolvimento
- `feature/nome-feature` - Funcionalidades
- `fix/nome-bug` - Correções

**Comandos padrão:**
```bash
# Criar branch de feature
git checkout -b feature/nova-funcionalidade

# Commitar alterações
git add .
git commit -m "feat: descrição da mudança"

# Push e criar PR
git push -u origin feature/nova-funcionalidade
gh pr create --fill

# Merge para main (via PR aprovado)
gh pr merge --squash
```

---

### 6. COMANDOS NPM DISPONÍVEIS

```json
"scripts": {
  "start": "node index.js",
  "dev": "nodemon index.js",
  "test": "jest",
  "build": "npm run build:frontend",
  "deploy": "render deploy"
}
```

**Uso:**
```bash
# Desenvolvimento local
npm run dev

# Produção local
npm start

# Testes
npm test

# Build frontend
npm run build
```

---

### 7. ESTRUTURA DE PROMPTS JURÍDICOS

**Localização:** `/03_PROMPTS_ESPECIFICOS/`

**Tipos:**
- Criminais (12 prompts)
- Cíveis (22 prompts)
- Trabalhistas (7 prompts)
- Petições Iniciais (8 prompts)
- Contratos (17 prompts)
- Revisão/Análise (8 prompts)

**Status atual:** 74/83 prompts refatorados (89%)

**Padrão de nomenclatura:**
- `PROMPT_HABEAS_CORPUS_CRIMINAL_V3.0.txt`
- `PROMPT_APELACAO_CIVEL_V3.0.txt`
- etc.

---

### 8. KNOWLEDGE BASE (KB)

**Diretório:** `/KB/`

**Conteúdo:**
- Legislação completa
- Jurisprudência
- Modelos de peças
- Documentação técnica

**Comandos:**
```bash
# Limpar cache KB
node scripts/clear-kb-cache.js

# Reindexar documentos
node scripts/reindex-kb.js
```

---

### 9. CHECKLIST PRÉ-TRABALHO

Antes de começar qualquer tarefa:

- [ ] GitHub autenticado (`gh auth status`)
- [ ] Git sem conflitos (`git status`)
- [ ] Branch correto (`git branch --show-current`)
- [ ] Render CLI autenticado (`render whoami`)
- [ ] Site online (`curl -I https://iarom.com.br`)
- [ ] Node modules instalado (`ls node_modules/`)
- [ ] .env configurado (`ls .env`)
- [ ] Último commit conhecido (`git log -1`)

---

### 10. TROUBLESHOOTING COMUM

**Problema: "Cannot find module"**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Problema: "Port already in use"**
```bash
lsof -ti:10000 | xargs kill -9
```

**Problema: "Database connection failed"**
```bash
# Verificar DATABASE_URL no .env
# Verificar se Postgres está rodando
```

**Problema: "Git push rejected"**
```bash
git pull --rebase origin main
git push
```

**Problema: "Render deploy failed"**
```bash
render logs -f  # Ver logs de erro
# Verificar .env no Render Dashboard
```

---

### 11. RESUMO DE INICIALIZAÇÃO

**Ao iniciar sessão, execute:**

```bash
# 1. Entrar no projeto
cd ~/Desktop/ROM-Agent

# 2. Verificar git
git status
git pull

# 3. Verificar GitHub
gh auth status

# 4. Verificar Render
render whoami
render services list

# 5. Verificar site
curl -I https://iarom.com.br

# 6. Confirmar ambiente
ls .env node_modules/ && echo "✅ Pronto" || echo "❌ Executar npm install"
```

**Ou simplesmente peça ao Claude Code:**

> "Inicialize o ambiente ROM-Agent conforme .claude/CLAUDE.md"

---

## 🎯 PROMPT RÁPIDO PARA CLAUDE

**Cole isto no início de cada sessão:**

```
Estou no projeto ROM-Agent. Por favor:

1. Verifique conexões (GitHub, Render, site iarom.com.br)
2. Confirme status do repositório (branch, commits pendentes)
3. Verifique ambiente (.env, node_modules)
4. Me dê um resumo de status

Depois aguarde instruções.
```

---

## 📚 DOCUMENTAÇÃO ADICIONAL

**README principal:** `/README.md`
**Fase 2 completa:** `/FASE_2_RELATORIO_CONSOLIDADO_COMPLETO.md`
**Lições aprendidas:** `/LESSONS-LEARNED.md`
**Checklist deploy:** `/PRE-DEPLOY-CHECKLIST.md`

---

**Última atualização:** 23/04/2026
**Versão:** ROM V3.0
**Claude Code:** v2.1.1
