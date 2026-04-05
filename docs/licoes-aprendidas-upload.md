# 🎓 LIÇÕES APRENDIDAS - SISTEMA DE UPLOAD
**Criado:** 02/04/2026
**Contexto:** Problemas críticos identificados no desenvolvimento do sistema de upload
**Impacto:** Sistema funcional quebrado, múltiplos deploys sem validação adequada
**Objetivo:** Documentar MÁXIMAS INVIOLÁVEIS para prevenir reincidência

---

## ⚠️ RESUMO EXECUTIVO DOS ERROS CRÍTICOS

### 5 Falhas Fundamentais Identificadas

1. **Deploy no serviço errado** - Código enviado para serviço incorreto sem verificação
2. **CSP (Content Security Policy) ignorado** - Fetch cross-origin bloqueado por política de segurança
3. **Ausência de testes E2E** - Sistema declarado "pronto" sem teste end-to-end completo
4. **Falta de estratégia de rollback** - Continuou modificando código quebrado ao invés de reverter
5. **Sistema funcional quebrado** - Alterações desnecessárias quebraram funcionalidade existente

### Impacto no Projeto
- 🔥 **20+ commits** tentando corrigir problemas evitáveis
- ⏱️ **Horas perdidas** debugando ao invés de desenvolver features
- 😓 **Frustração** do usuário e perda de confiança
- 🚨 **Instabilidade** em produção com múltiplos deploys falhados

---

## 📜 MÁXIMAS INVIOLÁVEIS

> **Regras que NUNCA devem ser violadas, sob NENHUMA circunstância**

### 🔐 MÁXIMA #1: CSP É LEI, NÃO SUGESTÃO
```
NUNCA ignore Content Security Policy.
SEMPRE verifique CSP ANTES de implementar fetch cross-origin.
```

**Rationale:**
- CSP bloqueia requisições não autorizadas **silenciosamente** no browser
- Erros aparecem apenas no DevTools Console
- Backend recebe 0 requisições (parece "down" mas está funcionando)

**Checklist Obrigatório:**
- [ ] Inspecionar `meta[http-equiv="Content-Security-Policy"]` no HTML
- [ ] Verificar diretivas `connect-src`, `script-src`, `img-src`
- [ ] Testar fetch no DevTools Console ANTES de implementar
- [ ] Adicionar domínios necessários ao CSP se cross-origin

**Exemplo de Erro Evitável:**
```javascript
// ❌ ERRADO - Assumir que fetch vai funcionar
fetch('https://outro-dominio.com/api/upload')

// ✅ CERTO - Verificar CSP primeiro
// 1. Inspecionar CSP no DevTools
// 2. Confirmar 'https://outro-dominio.com' está em connect-src
// 3. SE NÃO ESTIVER: Atualizar CSP ou usar mesmo domínio
```

---

### 🎯 MÁXIMA #2: CONFIRME O SERVIÇO CORRETO
```
NUNCA faça deploy sem confirmar QUAL serviço serve QUAL domínio.
SEMPRE verifique mapeamento domínio → serviço ANTES de modificar código.
```

**Rationale:**
- Múltiplos serviços no Render podem servir diferentes domínios
- `iarom.com.br` ≠ `rom-agent-ia.onrender.com`
- Deploy no serviço errado = código correto no lugar errado

**Checklist Obrigatório:**
- [ ] Listar TODOS os serviços: `gh api /user/repos`
- [ ] Mapear domínios: `curl -I https://dominio.com` (verificar `X-Render-Service`)
- [ ] Confirmar qual serviço modificar ANTES de fazer alterações
- [ ] Documentar mapeamento em `DOCS/deploy-mapping.md`

**Tabela de Verificação:**
| Domínio | Serviço Render | Repositório | Branch |
|---------|---------------|-------------|---------|
| iarom.com.br | `rom-agent` | ROM-Agent | main |
| rom-agent-ia.onrender.com | `rom-agent-backend` | ROM-Agent | backend |
| frontend.iarom.com.br | `rom-agent-frontend` | ROM-Agent | frontend |

---

### 🧪 MÁXIMA #3: E2E É OBRIGATÓRIO, NÃO OPCIONAL
```
NUNCA declare funcionalidade "pronta" sem teste end-to-end COMPLETO.
SEMPRE teste fluxo COMPLETO (frontend → backend → response) ANTES de commit.
```

**Rationale:**
- Código unitário funciona ≠ Sistema integrado funciona
- Upload tem MUITAS camadas: UI → CSP → CORS → Auth → Middleware → Storage
- Cada camada pode falhar silenciosamente

**Checklist Obrigatório (Upload):**
- [ ] **Frontend:** Selecionar arquivo no UI
- [ ] **DevTools Network:** Confirmar request enviado (status 200)
- [ ] **DevTools Console:** Confirmar SEM erros CSP/CORS
- [ ] **Backend Logs:** Confirmar recebimento do arquivo
- [ ] **Database:** Confirmar registro criado (se aplicável)
- [ ] **Storage:** Confirmar arquivo salvo em disco
- [ ] **Response:** Confirmar UI mostra sucesso

**Exemplo de Script E2E:**
```bash
#!/bin/bash
# test-upload-e2e.sh - Teste COMPLETO de upload

echo "1. Iniciando servidor local..."
npm run dev &
SERVER_PID=$!
sleep 5

echo "2. Abrindo browser no DevTools..."
open -a "Google Chrome" --args --auto-open-devtools-for-tabs http://localhost:3000/upload

echo "3. AÇÃO MANUAL NECESSÁRIA:"
echo "   - Selecione arquivo de teste"
echo "   - Clique em 'Upload'"
echo "   - Verifique DevTools Console (0 erros)"
echo "   - Verifique DevTools Network (status 200)"

read -p "Upload completou com sucesso? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ TESTE FALHOU - NÃO FAÇA COMMIT"
  kill $SERVER_PID
  exit 1
fi

echo "✅ Teste E2E passou! Safe to commit."
kill $SERVER_PID
```

---

### ⏮️ MÁXIMA #4: ROLLBACK NO PRIMEIRO ERRO
```
NUNCA continue modificando código quebrado.
SEMPRE faça rollback ao último commit funcional NO PRIMEIRO ERRO.
```

**Rationale:**
- Modificar código quebrado = adicionar complexidade
- Cada novo commit dificulta identificar causa raiz
- Rollback limpa o estado mental e permite recomeçar

**Checklist Obrigatório:**
- [ ] **Primeiro erro em produção:**
  ```bash
  git revert HEAD  # Desfazer último commit
  git push origin main --force-with-lease
  ```
- [ ] **Múltiplos commits ruins:**
  ```bash
  git log --oneline -10  # Identificar último commit BOM
  git reset --hard <commit-bom>
  git push origin main --force-with-lease
  ```
- [ ] **Confirmar rollback funcionou:**
  ```bash
  curl https://iarom.com.br/api/health  # Deve retornar 200
  ```
- [ ] **Debugar localmente ANTES de tentar fix:**
  - Replicar ambiente de produção
  - Reproduzir erro localmente
  - Testar fix localmente
  - E2E completo
  - **ENTÃO** fazer novo deploy

**Linha do Tempo de Decisão:**
```
Erro detectado → 0-5min: Avaliar gravidade
              → 5-10min: SE crítico → Rollback imediato
              → 10min+: Debug local, NÃO em produção
```

---

### 🛡️ MÁXIMA #5: NÃO QUEBRE O QUE FUNCIONA
```
NUNCA modifique sistema funcional sem EVIDÊNCIA de problema.
SEMPRE pergunte: "Isso resolve um problema REAL ou estou assumindo?"
```

**Rationale:**
- "Se não está quebrado, não conserte"
- Otimização prematura é raiz de todo mal
- Cada mudança introduz risco de regressão

**Checklist de Decisão:**
```
ANTES de modificar código funcional, responda:

1. Existe EVIDÊNCIA de problema? (logs de erro, issue reportado)
   ❌ NÃO → PARE. Não modifique.
   ✅ SIM → Continue.

2. O problema afeta usuários REAIS AGORA?
   ❌ NÃO → Adicione ao backlog (não é urgente).
   ✅ SIM → Continue.

3. Você TESTOU a solução localmente end-to-end?
   ❌ NÃO → TESTE PRIMEIRO.
   ✅ SIM → Continue.

4. Existe rollback plan SE der errado?
   ❌ NÃO → Crie plano de rollback.
   ✅ SIM → OK para implementar.
```

**Exemplo de Decisão Correta:**
```javascript
// ❌ ERRADO - "Melhorar" código que funciona
// Usuário: "Upload funciona bem"
// Dev: "Mas posso otimizar com streams!"
// Resultado: Sistema quebrado

// ✅ CERTO - Só modificar se há problema
// Usuário: "Upload de 100MB trava"
// Dev: "Evidência clara de problema. Vou implementar chunking."
// Resultado: Problema resolvido
```

---

## ✅ CHECKLIST PRÉ-DEPLOY (OBRIGATÓRIO)

> **Copie e cole este checklist em CADA PR relacionado a deploy**

### 📋 FASE 1: PREPARAÇÃO (Antes de escrever código)

#### 1.1 Mapeamento de Infraestrutura
- [ ] Listar TODOS os serviços ativos no Render
- [ ] Mapear domínios → serviços (tabela documentada)
- [ ] Identificar QUAL serviço será modificado
- [ ] Confirmar branch correto (main/staging/feature)

#### 1.2 Análise de Requisitos
- [ ] Problema claramente definido com EVIDÊNCIA (logs, screenshots)
- [ ] Solução proposta validada com usuário/stakeholder
- [ ] Alternativas consideradas (por que esta solução?)
- [ ] Riscos identificados (o que pode quebrar?)

#### 1.3 Plano de Rollback
- [ ] Identificar último commit funcional: `git log --oneline -10`
- [ ] Documentar comando de rollback: `git revert <hash>`
- [ ] Confirmar backup de dados (se aplicável)
- [ ] Definir SLA de rollback (ex: "5min se erro crítico")

---

### 🔬 FASE 2: DESENVOLVIMENTO (Durante implementação)

#### 2.1 Validação de Segurança
- [ ] **CSP:** Verificar políticas em `<meta http-equiv="Content-Security-Policy">`
- [ ] **CORS:** Confirmar headers permitidos no backend
- [ ] **Auth:** Validar middleware de autenticação
- [ ] **Rate Limiting:** Verificar se endpoint tem proteção

#### 2.2 Testes Locais (Ambiente de Dev)
- [ ] Servidor local iniciado: `npm run dev`
- [ ] DevTools aberto (Console + Network + Application)
- [ ] **Teste Unitário:** Função isolada funciona
- [ ] **Teste de Integração:** Múltiplos componentes funcionam juntos
- [ ] **Teste E2E:** Fluxo completo frontend → backend → response

#### 2.3 Verificação de CSP/CORS (SE cross-origin)
- [ ] DevTools Console: **0 erros** relacionados a CSP
- [ ] DevTools Network: Request atinge servidor (não bloqueado)
- [ ] Response headers: `Access-Control-Allow-Origin` correto
- [ ] CSP atualizado se necessário (commit separado)

---

### 🚀 FASE 3: DEPLOY (Antes de push)

#### 3.1 Pre-Commit Checklist
- [ ] Todos os testes E2E passaram localmente
- [ ] Logs de debug removidos (ou em modo DEBUG=false)
- [ ] Variáveis de ambiente documentadas (se novas)
- [ ] Breaking changes documentados no CHANGELOG

#### 3.2 Commit Estruturado
```bash
# Formato obrigatório:
git commit -m "type(scope): description

PROBLEMA:
- [Evidência do problema]

SOLUÇÃO:
- [O que foi implementado]

TESTES:
- [x] E2E completo passou
- [x] CSP verificado (se cross-origin)
- [x] Rollback plan documentado

ROLLBACK (se necessário):
git revert <este-commit-hash>"
```

#### 3.3 Deploy Staging (SE disponível)
- [ ] Deploy para staging PRIMEIRO
- [ ] Smoke tests em staging (30min mínimo)
- [ ] Monitorar logs de erro
- [ ] Validar com usuário-teste

#### 3.4 Deploy Produção
- [ ] Tag de versão criada: `git tag v2.X.Y`
- [ ] Push com força: `git push origin main --tags`
- [ ] Monitorar deploy no Render Dashboard
- [ ] Aguardar build completo (NÃO assumir sucesso antes)

---

### 🔍 FASE 4: VALIDAÇÃO PÓS-DEPLOY (Obrigatório)

#### 4.1 Health Checks (Primeiros 5min)
```bash
# Executar IMEDIATAMENTE após deploy
curl -I https://iarom.com.br/api/health
# Esperado: HTTP/2 200

curl https://iarom.com.br/api/info | jq .version
# Esperado: nova versão (v2.X.Y)
```

#### 4.2 Smoke Tests (Primeiros 15min)
- [ ] **Login:** Autenticação funciona
- [ ] **Homepage:** Carrega sem erros
- [ ] **Feature Nova:** Funcionalidade implementada funciona
- [ ] **Features Antigas:** Nada quebrou (testes de regressão)

#### 4.3 Monitoramento de Logs (Primeiros 30min)
```bash
# Render Dashboard → Logs → Filtrar por ERROR
# Procurar por:
# - Erros de runtime (crashes)
# - Timeouts (requests lentos)
# - Erros de autenticação
# - Erros de database
```

#### 4.4 Critérios de Rollback
**ROLLBACK IMEDIATO SE:**
- [ ] Health check falha (HTTP 500/503)
- [ ] Taxa de erros > 5% (verificar logs)
- [ ] Latência P95 > 2x baseline
- [ ] Funcionalidade crítica quebrada (login, pagamento, etc)

**Comando de Rollback:**
```bash
git revert HEAD
git push origin main --force-with-lease

# OU (se múltiplos commits ruins)
git reset --hard <ultimo-commit-bom>
git push origin main --force-with-lease

# Monitorar recuperação
watch -n 5 'curl -s https://iarom.com.br/api/health'
```

---

## 🚫 ANTI-PADRÕES (O QUE NÃO FAZER)

### ❌ ANTI-PADRÃO #1: "Deploy Esperançoso"
**Sintoma:**
```javascript
// "Deve funcionar em produção, não testei mas parece certo"
git commit -m "fix upload (untested)"
git push origin main
// 🤞 Espera que dê certo
```

**Por que é ruim:**
- Produção ≠ Ambiente de teste
- Variáveis de ambiente diferentes
- CSP/CORS configurados diferente
- Usuários reais afetados por bugs

**Solução:**
- SEMPRE teste localmente ANTES
- Use ambiente staging se disponível
- Teste E2E completo (não apenas unitário)

---

### ❌ ANTI-PADRÃO #2: "Debug em Produção"
**Sintoma:**
```javascript
// Adicionar console.logs em produção para debugar
console.log('DEBUG: upload chegou aqui?', req.body)
git commit -m "add debug logs"
git push origin main
// Fazer 10 commits só com logs
```

**Por que é ruim:**
- Poluí histórico do git
- Logs sensíveis podem vazar dados
- Não resolve problema, só observa

**Solução:**
- Replicar problema LOCALMENTE
- Debugar em ambiente de dev
- Fix testado localmente
- Deploy UMA VEZ com solução

---

### ❌ ANTI-PADRÃO #3: "Ignorar CSP/CORS"
**Sintoma:**
```javascript
// "Fetch não funciona, deve ser bug do browser"
fetch('https://api.example.com/upload')
  .catch(err => console.error('Browser bugado:', err))
// Não verifica DevTools Console
// Não verifica CSP
```

**Por que é ruim:**
- CSP bloqueia silenciosamente
- Browser está CORRETO, código está errado
- Perde tempo debugando lugar errado

**Solução:**
- SEMPRE abrir DevTools Console ANTES de fetch
- Verificar CSP: `document.querySelector('meta[http-equiv="Content-Security-Policy"]')`
- Entender políticas de segurança (não lutar contra elas)

---

### ❌ ANTI-PADRÃO #4: "Shotgun Debugging"
**Sintoma:**
```bash
# Tentar múltiplas soluções ao mesmo tempo
git commit -m "fix upload + cors + csp + auth"
# 5 mudanças em 1 commit
# Não sabe qual fix funcionou (ou se funcionou)
```

**Por que é ruim:**
- Impossível identificar causa raiz
- Se quebrar, não sabe qual mudança causou
- Dificulta rollback (reverter tudo ou nada?)

**Solução:**
- **1 problema = 1 commit**
- Testar cada fix isoladamente
- Commit quando validado
- Se múltiplos problemas, criar branch feature

---

### ❌ ANTI-PADRÃO #5: "Otimização Prematura"
**Sintoma:**
```javascript
// Upload funciona com FormData simples
// Dev: "Vou otimizar com chunking + streams + workers!"
// Resultado: Sistema quebrado, 0 ganho de performance
```

**Por que é ruim:**
- Adiciona complexidade desnecessária
- Introduz bugs em sistema funcional
- "Premature optimization is the root of all evil" - Knuth

**Solução:**
- **Meça ANTES de otimizar** (baseline de performance)
- **Otimize APENAS** gargalos comprovados
- **Valide** que otimização melhorou (A/B test)

---

### ❌ ANTI-PADRÃO #6: "Copy-Paste Sem Entender"
**Sintoma:**
```javascript
// Copiar código do StackOverflow sem ler
// "Esse cara disse que funciona, deve funcionar"
const upload = async (file) => {
  // 50 linhas de código copiado
  // Não entende o que faz
  // Não adaptou ao contexto do projeto
}
```

**Por que é ruim:**
- Código pode não se aplicar ao seu caso
- Introduz dependências desnecessárias
- Quebra padrões do projeto

**Solução:**
- **Entenda** cada linha antes de adicionar
- **Adapte** ao contexto do projeto
- **Teste** isoladamente
- **Documente** por que aquela solução

---

### ❌ ANTI-PADRÃO #7: "Commit Message Inútil"
**Sintoma:**
```bash
git commit -m "fix"
git commit -m "update"
git commit -m "asdf"
git commit -m "hopefully this works"
```

**Por que é ruim:**
- Impossível entender histórico
- Dificulta code review
- Sem contexto para rollback

**Solução:**
```bash
# Template obrigatório:
git commit -m "type(scope): description

PROBLEMA:
[Evidência clara do problema]

SOLUÇÃO:
[O que foi implementado e por que]

TESTES:
[Testes realizados]

ROLLBACK:
git revert <hash>"
```

---

## 📚 CASOS DE ESTUDO REAIS

### 📖 Caso 1: CSP Bloqueando Upload (Commits f135c2e, ee6e865)

#### Contexto
Sistema de upload chunked tentava enviar arquivos para `rom-agent-ia.onrender.com`, mas CSP bloqueava.

#### Erro
```
Refused to connect to 'https://rom-agent-ia.onrender.com'
because it violates the following Content Security Policy directive:
"connect-src 'self'"
```

#### Root Cause
- CSP configurado com `connect-src 'self'` (apenas mesmo domínio)
- Frontend tentava fetch cross-origin sem permissão
- DevTools Console mostrava erro, mas não foi verificado ANTES

#### Solução Correta
```javascript
// ANTES (bloqueado pelo CSP)
const response = await fetch('https://rom-agent-ia.onrender.com/api/upload/chunk')

// DEPOIS (permitido pelo CSP)
// Opção 1: Atualizar CSP
<meta http-equiv="Content-Security-Policy"
      content="connect-src 'self' https://rom-agent-ia.onrender.com">

// Opção 2: Usar mesmo domínio (proxy reverso)
const response = await fetch('/api/upload/chunk') // proxy para backend
```

#### Lições
1. ✅ Verificar CSP ANTES de implementar fetch
2. ✅ Abrir DevTools Console em TODOS os testes
3. ✅ Entender políticas de segurança (CSP é proteção, não bug)

---

### 📖 Caso 2: Service Worker Causando "Failed to Fetch" (Commit ec4a5c2)

#### Contexto
Upload falhava com erro genérico "Failed to fetch", mesmo com CSP correto.

#### Erro
```javascript
POST /api/upload/chunk net::ERR_FAILED
```

#### Root Cause
- Service Worker antigo interceptava requisições
- Cache desatualizado retornava 404
- Frontend não desregistrava SW ao atualizar

#### Solução
```javascript
// frontend/src/main.tsx
// Desregistrar TODOS os Service Workers antigos
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister()
      console.log('SW antigo removido:', registration.scope)
    })
  })
}
```

#### Lições
1. ✅ Service Workers são PERSISTENTES (não resetam com F5)
2. ✅ SEMPRE desregistrar SWs ao fazer breaking changes
3. ✅ DevTools → Application → Service Workers (verificar status)

---

### 📖 Caso 3: Deploy no Serviço Errado (Múltiplos Commits)

#### Contexto
Código de upload commitado no serviço `rom-agent-frontend`, mas domínio `iarom.com.br` era servido por `rom-agent-backend`.

#### Erro
```bash
# Deploy bem-sucedido, mas código não aparece em produção
curl https://iarom.com.br/api/upload/chunk
# 404 Not Found (endpoint não existe)
```

#### Root Cause
- Desenvolvedor assumiu que `main` branch = produção
- Não verificou mapeamento domínio → serviço
- Deploy foi para serviço errado

#### Solução
```bash
# Mapear serviços ANTES de modificar
curl -I https://iarom.com.br
# X-Render-Service: rom-agent-backend

# Confirmar branch correto
git remote -v
# origin git@github.com:user/ROM-Agent-backend.git

# Deploy no serviço correto
git checkout backend
git merge feature/upload
git push origin backend
```

#### Lições
1. ✅ Documentar mapeamento domínio → serviço → branch
2. ✅ SEMPRE verificar antes de push
3. ✅ Criar `DOCS/deploy-mapping.md` com tabela de referência

---

## 🎯 TEMPLATE DE PR (Obrigatório para Deploys)

```markdown
## 📋 PR Checklist (Upload Feature)

### Informações Básicas
- **Tipo:** [Feature/Bugfix/Hotfix]
- **Escopo:** Upload System
- **Versão:** v2.X.Y
- **Issue:** #123

---

### ✅ FASE 1: PREPARAÇÃO
- [ ] Mapeamento de serviços confirmado (qual serviço será modificado)
- [ ] Problema definido com EVIDÊNCIA (logs/screenshots anexados)
- [ ] Plano de rollback documentado (comando pronto)
- [ ] Último commit funcional identificado: `<hash>`

---

### ✅ FASE 2: DESENVOLVIMENTO
- [ ] Testes unitários passaram (100% coverage)
- [ ] Testes de integração passaram
- [ ] **Teste E2E COMPLETO realizado** (screenshot anexado)
- [ ] CSP verificado (se cross-origin) - 0 erros no DevTools Console
- [ ] CORS configurado (se cross-origin) - headers corretos

---

### ✅ FASE 3: VALIDAÇÃO LOCAL
- [ ] DevTools Console: **0 erros** (screenshot anexado)
- [ ] DevTools Network: Status 200 (screenshot anexado)
- [ ] Backend logs: Requisição recebida (logs anexados)
- [ ] Storage: Arquivo salvo corretamente

---

### ✅ FASE 4: DEPLOY
- [ ] Commit message estruturado (problema/solução/testes)
- [ ] Tag de versão criada: `v2.X.Y`
- [ ] Deploy staging realizado (se disponível)
- [ ] Smoke tests em staging (30min mínimo)

---

### ✅ FASE 5: PÓS-DEPLOY (Validação em Produção)
- [ ] Health check: `curl https://iarom.com.br/api/health` → 200
- [ ] Smoke tests passaram (login, homepage, feature)
- [ ] Logs monitorados (30min) - 0 erros críticos
- [ ] Latência P95 < 2s (baseline mantido)

---

### 📸 EVIDÊNCIAS (Obrigatório)

#### Teste E2E Local
[Screenshot: Upload completo com sucesso]

#### DevTools Console (0 Erros)
[Screenshot: Console limpo]

#### DevTools Network (Status 200)
[Screenshot: Request/Response]

#### Backend Logs
```
[2026-04-02 10:30:45] POST /api/upload/chunk - 200 OK
[2026-04-02 10:30:46] File saved: /var/data/upload/chunks/abc123.chunk
```

---

### 🔄 PLANO DE ROLLBACK

**SE HOUVER PROBLEMA:**
```bash
# Comando de rollback (copiar/colar)
git revert <este-commit-hash>
git push origin main --force-with-lease

# Monitorar recuperação
watch -n 5 'curl -s https://iarom.com.br/api/health'
```

**Último commit funcional:** `<hash-do-commit-bom>`

**SLA de rollback:** 5min (se erro crítico)

---

### 📊 MÉTRICAS

| Métrica | Antes | Depois | Delta |
|---------|-------|--------|-------|
| Upload < 10MB | 2.5s | 1.8s | -28% ⬇️ |
| Upload > 50MB | TIMEOUT | 8.5s | ✅ Funciona |
| Taxa de erro | 0% | 0% | 0% ✅ |

---

### 🤔 REVISÃO CRÍTICA

**1. Este PR viola alguma MÁXIMA INVIOLÁVEL?**
- [ ] NÃO - Safe to merge

**2. Sistema funcional foi modificado sem necessidade?**
- [ ] NÃO - Mudanças justificadas

**3. Existe plano B se rollback não funcionar?**
- [ ] SIM - Documentado abaixo

**Plano B:** Restaurar backup de `/var/data` (criado pré-deploy)
```

---

## 🔧 FERRAMENTAS E SCRIPTS ÚTEIS

### Script 1: Verificador de CSP Automático

```bash
#!/bin/bash
# check-csp.sh - Verifica se fetch será bloqueado pelo CSP

URL="https://iarom.com.br"
TARGET_DOMAIN="rom-agent-ia.onrender.com"

echo "🔍 Verificando CSP de ${URL}..."

# Extrair CSP do HTML
CSP=$(curl -s "$URL" | grep -o 'content="[^"]*"' | grep 'Content-Security-Policy' | cut -d'"' -f2)

echo "📋 CSP Atual:"
echo "$CSP" | tr ';' '\n'

# Verificar connect-src
CONNECT_SRC=$(echo "$CSP" | grep -o "connect-src [^;]*")

echo ""
echo "🌐 connect-src:"
echo "$CONNECT_SRC"

if echo "$CONNECT_SRC" | grep -q "$TARGET_DOMAIN"; then
  echo "✅ $TARGET_DOMAIN está PERMITIDO"
  exit 0
else
  echo "❌ $TARGET_DOMAIN está BLOQUEADO"
  echo ""
  echo "💡 Solução:"
  echo "   Adicionar '$TARGET_DOMAIN' ao connect-src"
  exit 1
fi
```

**Uso:**
```bash
chmod +x check-csp.sh
./check-csp.sh
```

---

### Script 2: Teste E2E Automatizado de Upload

```bash
#!/bin/bash
# test-upload-e2e.sh - Teste completo de upload

set -e

echo "🧪 TESTE E2E - SISTEMA DE UPLOAD"
echo "================================="
echo ""

# 1. Criar arquivo de teste
TEST_FILE="test-upload-$(date +%s).txt"
echo "Arquivo de teste gerado em $(date)" > "$TEST_FILE"
echo "✅ Arquivo de teste criado: $TEST_FILE ($(stat -f%z "$TEST_FILE") bytes)"

# 2. Iniciar servidor (se não estiver rodando)
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  echo "⚠️  Servidor não está rodando. Iniciando..."
  npm run dev &
  SERVER_PID=$!
  sleep 5
else
  echo "✅ Servidor já está rodando"
fi

# 3. Verificar CSP
echo ""
echo "🔍 Verificando CSP..."
./check-csp.sh || {
  echo "❌ CSP bloqueará upload!"
  exit 1
}

# 4. Teste de upload via curl
echo ""
echo "📤 Testando upload via curl..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: multipart/form-data" \
  -F "file=@$TEST_FILE" \
  http://localhost:3000/api/upload)

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Upload bem-sucedido (HTTP $HTTP_CODE)"
  echo "📄 Response: $BODY"
else
  echo "❌ Upload falhou (HTTP $HTTP_CODE)"
  echo "📄 Response: $BODY"
  exit 1
fi

# 5. Verificar arquivo no storage
echo ""
echo "💾 Verificando arquivo no storage..."
UPLOAD_DIR="./archive/temp-files/upload"
if [ -d "$UPLOAD_DIR" ] && [ "$(ls -A "$UPLOAD_DIR" 2>/dev/null)" ]; then
  echo "✅ Arquivo salvo no storage:"
  ls -lh "$UPLOAD_DIR" | tail -5
else
  echo "❌ Arquivo NÃO encontrado no storage!"
  exit 1
fi

# 6. Cleanup
rm -f "$TEST_FILE"
[ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true

echo ""
echo "========================================="
echo "✅ TODOS OS TESTES PASSARAM!"
echo "========================================="
echo ""
echo "Safe to commit e fazer deploy."
```

**Uso:**
```bash
chmod +x test-upload-e2e.sh
./test-upload-e2e.sh
```

---

### Script 3: Mapeador de Serviços Render

```bash
#!/bin/bash
# map-render-services.sh - Mapeia domínios → serviços

echo "🗺️  MAPEAMENTO DE SERVIÇOS RENDER"
echo "=================================="
echo ""

DOMAINS=(
  "iarom.com.br"
  "www.iarom.com.br"
  "rom-agent-ia.onrender.com"
)

echo "| Domínio | Status | Service | Deploy |"
echo "|---------|--------|---------|--------|"

for DOMAIN in "${DOMAINS[@]}"; do
  # Testar HTTPS
  if HEADERS=$(curl -sI "https://$DOMAIN" 2>/dev/null); then
    HTTP_CODE=$(echo "$HEADERS" | grep "HTTP" | awk '{print $2}')
    SERVICE=$(echo "$HEADERS" | grep -i "X-Render-Service" | cut -d: -f2 | tr -d ' \r')
    DEPLOY=$(echo "$HEADERS" | grep -i "X-Render-Deploy" | cut -d: -f2 | tr -d ' \r')

    [ -z "$SERVICE" ] && SERVICE="N/A"
    [ -z "$DEPLOY" ] && DEPLOY="N/A"

    echo "| $DOMAIN | $HTTP_CODE | $SERVICE | ${DEPLOY:0:8} |"
  else
    echo "| $DOMAIN | ❌ DOWN | - | - |"
  fi
done

echo ""
echo "💡 Use esta tabela para confirmar qual serviço modificar"
```

**Uso:**
```bash
chmod +x map-render-services.sh
./map-render-services.sh
```

---

## 📖 REFERÊNCIAS E LEITURA ADICIONAL

### Documentação Oficial
- [Content Security Policy (CSP) - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Cross-Origin Resource Sharing (CORS) - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Service Workers - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Render Deploy Hooks](https://render.com/docs/deploy-hooks)

### Artigos Técnicos
- [Why CSP Matters](https://web.dev/csp/)
- [Debugging CORS](https://developer.chrome.com/docs/extensions/mv3/cors/)
- [The Art of the Rollback](https://increment.com/reliability/rollback-strategies/)

### Livros Recomendados
- *"Release It!" - Michael Nygard* (Capítulo sobre Circuit Breakers e Rollbacks)
- *"The Phoenix Project" - Gene Kim* (DevOps culture)
- *"Site Reliability Engineering" - Google* (SRE practices)

---

## 🎓 TREINAMENTO E CERTIFICAÇÃO

### Checklist de Competências

**Antes de fazer deploy solo, o desenvolvedor DEVE:**

#### Nível 1: Fundamentos
- [ ] Entender CSP (o que é, por que existe, como configurar)
- [ ] Entender CORS (preflight, headers, credentials)
- [ ] Saber abrir DevTools (Console, Network, Application)
- [ ] Conhecer git básico (commit, push, revert, reset)

#### Nível 2: Debugging
- [ ] Replicar problemas localmente ANTES de modificar produção
- [ ] Ler logs de backend (identificar erros críticos)
- [ ] Interpretar stack traces (encontrar linha exata do erro)
- [ ] Usar breakpoints (DevTools Debugger)

#### Nível 3: Testes
- [ ] Escrever teste unitário (Jest/Mocha)
- [ ] Escrever teste de integração (API calls)
- [ ] Executar teste E2E manual (fluxo completo)
- [ ] Interpretar coverage reports (identificar gaps)

#### Nível 4: Deploy
- [ ] Criar plano de rollback ANTES de deploy
- [ ] Executar checklist pré-deploy (100% das etapas)
- [ ] Monitorar logs pós-deploy (30min mínimo)
- [ ] Executar rollback sob pressão (< 5min)

### Certificação Interna

**Para obter certificação de "Deploy Autônomo":**

1. **Prova Teórica (80% mínimo)**
   - 20 questões sobre CSP, CORS, testes, rollback
   - 1 hora de duração

2. **Prova Prática (100% de acertos)**
   - Implementar feature de upload
   - Passar por ALL checklist etapas
   - Deploy em staging
   - Simular erro e executar rollback

3. **Code Review**
   - Revisar 5 PRs de outros desenvolvedores
   - Identificar violações de MÁXIMAS
   - Sugerir melhorias

---

## 🔄 PROCESSO DE MELHORIA CONTÍNUA

### Retrospectiva Trimestral

**A cada 3 meses, revisar:**

1. **Métricas de Deploy**
   - Taxa de sucesso (meta: > 95%)
   - Tempo médio de deploy (meta: < 10min)
   - Número de rollbacks (meta: < 5%)
   - Tempo de recuperação (meta: < 5min)

2. **Violações de MÁXIMAS**
   - Quantas vezes cada MÁXIMA foi violada?
   - Qual MÁXIMA é mais violada? (reforçar treinamento)
   - Novos anti-padrões identificados?

3. **Atualização do Documento**
   - Adicionar novos casos de estudo
   - Atualizar checklists com aprendizados
   - Remover práticas obsoletas

### Template de Retrospectiva

```markdown
## Retrospectiva de Deploy - Q1 2026

### Estatísticas
- Deploys realizados: 47
- Deploys bem-sucedidos: 45 (95.7%)
- Rollbacks executados: 2 (4.3%)
- Tempo médio de deploy: 8.5min
- Tempo médio de rollback: 3.2min

### Violações de MÁXIMAS
| MÁXIMA | Violações | Impacto |
|--------|-----------|---------|
| #1 (CSP) | 3 | 2 rollbacks |
| #3 (E2E) | 5 | 1 rollback |
| #4 (Rollback) | 1 | 4h de downtime |

### Lições Aprendidas
1. [Nova lição]
2. [Nova lição]

### Ações
- [ ] Adicionar verificação automática de CSP no CI/CD
- [ ] Tornar E2E obrigatório (bloquear merge sem evidência)
- [ ] Criar script de rollback one-click
```

---

## ✅ CONCLUSÃO

Este documento deve ser:

1. **Revisado** antes de CADA deploy
2. **Atualizado** após CADA incidente
3. **Compartilhado** com TODOS os desenvolvedores
4. **Aplicado** sem exceções

### Resumo das MÁXIMAS (Para Memorização)

1. 🔐 **CSP É LEI** - Verifique ANTES de fetch cross-origin
2. 🎯 **CONFIRME O SERVIÇO** - Saiba qual serviço serve qual domínio
3. 🧪 **E2E É OBRIGATÓRIO** - Teste fluxo completo ANTES de commit
4. ⏮️ **ROLLBACK NO PRIMEIRO ERRO** - Não modifique código quebrado
5. 🛡️ **NÃO QUEBRE O QUE FUNCIONA** - Evidência ANTES de modificar

---

**Última atualização:** 02/04/2026
**Próxima revisão:** 02/07/2026 (trimestral)
**Mantenedor:** Time de Arquitetura ROM-Agent
**Versão:** 1.0.0
