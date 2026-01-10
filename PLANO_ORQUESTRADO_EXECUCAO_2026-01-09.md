# PLANO ORQUESTRADO DE EXECUÇÃO - IAROM v2.8.0 → v2.9.0
**Data Criação**: 2026-01-09  
**Duração Estimada**: 30 dias (4 semanas)  
**Agentes**: 12 especializados  
**Estratégia**: Execução paralela + zero downtime + auditoria automática  

---

## ÍNDICE

1. [Visão Geral](#1-visão-geral)
2. [Agentes Especializados](#2-agentes-especializados-12-total)
3. [Grupos de Execução](#3-grupos-de-execução)
4. [Ordem de Execução e Dependências](#4-ordem-de-execução-e-dependências)
5. [Estratégia de Commits (Sem Conflitos)](#5-estratégia-de-commits-sem-conflitos)
6. [Estratégia de Deploy (Zero Downtime)](#6-estratégia-de-deploy-zero-downtime)
7. [Feature Flags e Rollback](#7-feature-flags-e-rollback)
8. [Auditoria Final Automatizada](#8-auditoria-final-automatizada)
9. [Monitoring e Alertas](#9-monitoring-e-alertas)
10. [Cronograma Detalhado](#10-cronograma-detalhado-30-dias)
11. [Checklist de Execução](#11-checklist-de-execução)

---

## 1. VISÃO GERAL

### Objetivos

**Prioridade Máxima** (conforme solicitação do usuário):
1. ✅ Chat usability (velocidade, typing indicators)
2. ✅ Buscas (Google Search, JusBrasil, DataJud)
3. ✅ SSE streaming (performance)
4. ✅ Edição de prompts (admin)
5. ✅ Extração de documentos e KB integration
6. ✅ Auditoria final

**Melhorias Adicionais**:
7. ✅ PWA mobile (installability)
8. ✅ Git staging/production sync
9. ✅ Segurança (auth, credentials)
10. ✅ Performance geral

### Métricas de Sucesso

| Categoria | Baseline | Target | Melhoria |
|-----------|----------|--------|----------|
| SSE Streaming | 24-30s | <10s | **-75%** |
| TTFT | 800ms | <300ms | **-63%** |
| Custo/mês | $35.19 | <$15 | **-57%** |
| Apresentação correta | 30% | >70% | **+133%** |
| PWA installability | 0% | 100% | **+100%** |
| Routes protegidas | 0/58 | 58/58 | **100%** |

### Princípios de Execução

1. ✅ **Paralelização máxima** - Executar agentes simultaneamente quando não há dependências
2. ✅ **Zero conflitos de commits** - Cada agente trabalha em arquivos independentes ou sequencialmente
3. ✅ **Zero downtime** - Feature flags + rolling update + blue-green deployment
4. ✅ **Rollback < 5 minutos** - Environment variables + instant restart
5. ✅ **Auditoria automática** - Validação contínua de qualidade, performance, segurança

---

## 2. AGENTES ESPECIALIZADOS (12 Total)

### GRUPO A - Optimizations Core (5 agentes - PARALELO)

#### **Agente 1: Prompt Optimizer**
**Responsabilidade**: Implementar sistema modular de prompts optimizados  
**Prioridade**: P0 (CRITICAL)  
**Duração**: 2-3 dias  
**Arquivos**:
- `src/lib/prompt-builder.js` (NOVO - 200 linhas)
- `src/modules/optimized-prompts.js` (NOVO - 300 linhas)
- `src/server-enhanced.js` (modificar buildSystemPrompt)
- `.env` (adicionar PROMPTS_VERSION)

**Tarefas**:
- [ ] Criar PromptBuilder class (modular, conditional loading)
- [ ] Implementar OPTIMIZED_SYSTEM_PROMPT (1.750 chars, -79%)
- [ ] Implementar TOOL_SPECIFIC_INSTRUCTIONS (4.200 chars, conditional)
- [ ] Implementar ABNT_FORMATTING_RULES (4.100 chars, conditional)
- [ ] Feature flag PROMPTS_VERSION (original/optimized)
- [ ] Unit tests (10+ casos)
- [ ] A/B testing setup (10% traffic initial)

**Ganho Esperado**: -76% tokens, -75% TTFT, -61% custo

---

#### **Agente 2: PWA Icons Generator**
**Responsabilidade**: Gerar icons PNG e fix manifest/service-worker  
**Prioridade**: P0 (CRITICAL - bloqueia Android install)  
**Duração**: 1 dia  
**Arquivos**:
- `frontend/public/icons/icon-192x192.png` (NOVO)
- `frontend/public/icons/icon-512x512.png` (NOVO)
- `frontend/public/icons/icon-180x180.png` (NOVO - Apple)
- `frontend/public/manifest.json` (atualizar refs)
- `frontend/public/service-worker.js` (atualizar precache)

**Tarefas**:
- [ ] Generate PNG from SVG (ImageMagick/Sharp)
  ```bash
  convert icon-512x512.svg -resize 192x192 icon-192x192.png
  convert icon-512x512.svg -resize 512x512 icon-512x512.png
  convert icon-512x512.svg -resize 180x180 icon-180x180.png
  ```
- [ ] Update manifest.json (icons refs)
- [ ] Update service-worker.js precache list
- [ ] Test installability (Android Chrome, iOS Safari)
- [ ] Lighthouse PWA audit (score > 90)

**Ganho Esperado**: +100% Android installability

---

#### **Agente 3: Prompt Cache Implementation**
**Responsabilidade**: Cache system prompts em memória  
**Prioridade**: P0 (CRITICAL - overhead)  
**Duração**: 1 dia  
**Arquivos**:
- `src/server-enhanced.js` (buildSystemPrompt + getAgent)
- `src/lib/prompt-cache.js` (NOVO - 100 linhas)

**Tarefas**:
- [ ] Implementar cache em memória (Map)
  ```javascript
  let CACHED_SYSTEM_PROMPT = null;
  export function buildSystemPrompt(forceReload = false) {
    if (CACHED_SYSTEM_PROMPT && !forceReload) return CACHED_SYSTEM_PROMPT;
    // Build prompt
    CACHED_SYSTEM_PROMPT = prompt;
    return CACHED_SYSTEM_PROMPT;
  }
  ```
- [ ] Carregar custom-instructions.json no startup (assíncrono)
- [ ] Unificar com romProjectService (single source)
- [ ] Invalidation strategy (file watcher ou manual)
- [ ] Performance benchmarks (antes/depois)

**Ganho Esperado**: -90% overhead (20ms → 2ms)

---

#### **Agente 4: Tool Names Fix**
**Responsabilidade**: Fix conflitos tool names e descriptions  
**Prioridade**: P0 (CRITICAL - confusão Claude)  
**Duração**: 1 dia  
**Arquivos**:
- `data/rom-project/prompts/gerais/master-rom.json` (linhas 56, 279)
- `src/server-enhanced.js` (buildSystemPrompt linhas 1095-1112)

**Tarefas**:
- [ ] Fix `web_search` → `pesquisar_jurisprudencia` (master-rom.json)
- [ ] Remove `pesquisar_jusbrasil` de todos os prompts (tool disabled)
- [ ] Document DataJud como "quando configurado" (não "100% oficial")
- [ ] Remove duplicação tool descriptions (system prompt vs BEDROCK_TOOLS)
- [ ] Update timeout expectation (< 1s → < 20s realista)
- [ ] Validation tests (tool name resolution)

**Ganho Esperado**: -80% tool name confusion, -25% wrong tool calls

---

#### **Agente 5: MAX_TOOL_LOOPS Reducer**
**Responsabilidade**: Reduzir loops para forçar apresentação rápida  
**Prioridade**: P0 (CRITICAL - velocidade SSE)  
**Duração**: 4 horas  
**Arquivos**:
- `src/modules/bedrock.js` (linha 604)

**Tarefas**:
- [ ] Change `MAX_TOOL_LOOPS` from 5 → 2
  ```javascript
  const MAX_TOOL_LOOPS = 2; // 1 busca + 1 apresentação IMEDIATA
  ```
- [ ] Validar que apresentação funciona (não quebra flow)
- [ ] Benchmark streaming time (antes/depois)
- [ ] Edge cases testing (zero results, timeout, error)
- [ ] Monitoring setup (loop count metrics)

**Ganho Esperado**: -75% latency SSE (24-30s → 6-8s)

---

### GRUPO B - Auth & Security (2 agentes - SEQUENCIAL)

#### **Agente 6: Frontend Auth**
**Responsabilidade**: Substituir fetch() direto por apiFetch() com CSRF  
**Prioridade**: P1 (HIGH - segurança)  
**Duração**: 1 dia  
**Arquivos**:
- `frontend/src/stores/authStore.ts` (6 occurrences de fetch direto)
- `frontend/src/services/api.ts` (apiFetch já existe, usar sempre)

**Tarefas**:
- [ ] Replace todas as 6 calls de fetch() → apiFetch()
- [ ] Ensure CSRF token handling (já implementado em apiFetch)
- [ ] Fix CSRF path mismatch (/api/csrf-token vs /api/auth/csrf-token)
- [ ] Test login/logout flow
- [ ] Test protected routes (401 handling)

**Ganho Esperado**: +segurança frontend, CSRF protection

**⚠️ DEVE SER EXECUTADO ANTES DO AGENTE 7** (frontend → backend)

---

#### **Agente 7: Backend Auth**
**Responsabilidade**: Proteger 58 routes com requireAuth middleware  
**Prioridade**: P1 (HIGH - segurança)  
**Duração**: 1-2 dias  
**Arquivos**:
- `src/server-enhanced.js` (58 routes)
- `src/middleware/auth.js` (requireAuth já existe)

**Tarefas**:
- [ ] Add requireAuth middleware to 58 public routes:
  - `/api/chat` (linha 1327)
  - `/api/upload` (linha 2173)
  - `/api/rom-project/*` (várias)
  - `/api/prompts` (linha 2651)
  - etc. (lista completa em DIAGNOSTICO_FORENSE)
- [ ] Maintain public routes (login, register, health)
- [ ] Feature flag ENABLE_AUTH_MIDDLEWARE (gradual rollout)
- [ ] Test 401 responses
- [ ] Integration tests (authenticated vs unauthenticated)

**Ganho Esperado**: 58/58 routes protegidas

**⚠️ DEVE SER EXECUTADO APÓS AGENTE 6** (frontend pronto para 401)

---

### GRUPO C - Mobile & Deploy (2 agentes - PARALELO)

#### **Agente 8: PWA Mobile Enhancements**
**Responsabilidade**: Code-split, SSE reconnection, UX mobile  
**Prioridade**: P1 (HIGH - mobile UX)  
**Duração**: 2-3 dias  
**Arquivos**:
- `frontend/src/pages/ArtifactPanel.tsx` (code-split)
- `frontend/src/services/api.ts` (SSE reconnection)
- `frontend/src/App.tsx` (beforeinstallprompt)
- `frontend/tailwind.config.js` (safe-area plugin)

**Tarefas**:
- [ ] **Code-split ArtifactPanel**:
  ```typescript
  const ArtifactPanel = lazy(() => import('./ArtifactPanel'))
  ```
  - Reduzir bundle de 682KB
  - Lazy load docx.js, file-saver
  
- [ ] **SSE Reconnection Logic**:
  ```typescript
  // Exponential backoff
  let retries = 0;
  const maxRetries = 5;
  const baseDelay = 1000;
  
  async function connectWithRetry() {
    try {
      await streamChat(...)
    } catch (error) {
      if (retries < maxRetries) {
        const delay = baseDelay * Math.pow(2, retries);
        await sleep(delay);
        retries++;
        return connectWithRetry();
      }
    }
  }
  
  // visibilitychange pause/resume
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseStream();
    } else {
      resumeStream();
    }
  });
  ```
  
- [ ] **beforeinstallprompt Handler**:
  ```typescript
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });
  ```
  
- [ ] **Fix Tailwind Classes**:
  ```javascript
  // tailwind.config.js
  module.exports = {
    plugins: [
      plugin(function({ addUtilities }) {
        addUtilities({
          '.pb-safe': {
            'padding-bottom': 'env(safe-area-inset-bottom)'
          }
        })
      })
    ]
  }
  ```

**Ganho Esperado**: -25% bundle size, +reliability mobile, +install awareness

---

#### **Agente 9: Git Sync & Deploy**
**Responsabilidade**: Sync staging/main/production + deploy strategy  
**Prioridade**: P1 (HIGH - hygiene)  
**Duração**: 1 dia  
**Arquivos**:
- `.git/` (merge operations)
- `.gitignore` (add backups/)
- Render.com deployment configs

**Tarefas**:
- [ ] **Clean staging**:
  ```bash
  git checkout staging
  git rm -r backups/  # 150 files, 50MB
  echo "backups/" >> .gitignore
  git commit -m "chore: remove backups from git"
  ```
  
- [ ] **Revoke exposed credentials** (URGENTE):
  ```bash
  # AWS
  aws iam delete-access-key --access-key-id AKIA***REVOGADO***
  # Regenerate GITHUB_TOKEN
  # Change JUSBRASIL_SENHA
  ```
  
- [ ] **Merge staging → main**:
  ```bash
  git checkout main
  git merge staging --no-ff -m "merge: staging improvements"
  # 0 conflicts expected
  ```
  
- [ ] **Update production**:
  ```bash
  git checkout production
  git merge main --ff-only
  git tag v2.9.0
  git push origin production --tags
  ```
  
- [ ] **Render.com auto-deploy** (triggered by push)

**Ganho Esperado**: +deploy hygiene, +security (credentials revoked)

---

### GRUPO D - Validation & Audit (3 agentes - SEQUENCIAL)

#### **Agente 10: System Prompt Testing**
**Responsabilidade**: A/B testing gradual (10% → 100%)  
**Prioridade**: P1 (HIGH - validação)  
**Duração**: 14-21 dias (gradual rollout)  
**Arquivos**:
- `.env` (PROMPTS_VERSION, TRAFFIC_PERCENTAGE)
- Monitoring dashboards

**Tarefas**:
- [ ] **Week 1: 10% traffic** (intensivo monitoring)
  ```bash
  PROMPTS_VERSION=optimized
  TRAFFIC_PERCENTAGE=10
  ```
  - Metrics: TTFT, token cost, accuracy, error rate
  - Manual testing: 20+ conversações
  - User feedback collection
  
- [ ] **Week 2: 25% traffic** (daily monitoring)
  ```bash
  TRAFFIC_PERCENTAGE=25
  ```
  - Validate metrics improvement vs baseline
  - Check for edge cases
  
- [ ] **Week 3: 50% traffic** (validation at scale)
  ```bash
  TRAFFIC_PERCENTAGE=50
  ```
  - Statistical significance (n > 1000 requests)
  - Performance benchmarks
  
- [ ] **Week 4: 100% traffic** (full rollout)
  ```bash
  TRAFFIC_PERCENTAGE=100
  ```
  - Final validation
  - Remove feature flag (cleanup)

**Rollback Trigger**: Error rate > 5%, TTFT > 2x baseline, user complaints > 10/hour

**Ganho Esperado**: Validated 79% token reduction, 75% TTFT improvement

---

#### **Agente 11: Integration Testing**
**Responsabilidade**: Test all flows end-to-end  
**Prioridade**: P1 (HIGH - quality)  
**Duração**: 2-3 dias  
**Arquivos**:
- `tests/integration/` (NOVO - 500+ linhas)
- `tests/performance/` (NOVO - benchmarks)

**Tarefas**:
- [ ] **Chat Flow** (10+ casos):
  - Chat simples (texto)
  - Chat com jurisprudência (Google Search)
  - Chat com KB (documento uploadado)
  - Chat com múltiplas ferramentas
  - Chat com timeout/error
  
- [ ] **Upload + KB** (5+ doc types):
  - PDF processo judicial
  - DOCX petição
  - TXT anotações
  - ZIP múltiplos arquivos
  - Edge: arquivo corrompido
  
- [ ] **Jurisprudence Search**:
  - Google Search (tribunais variados)
  - DataJud (mockado - validar mensagem)
  - JusBrasil disabled (validar erro claro)
  - Timeout handling
  - Empty results
  
- [ ] **ABNT Formatting**:
  - Validar ementa completa (não truncada)
  - Validar links clicáveis (#D4AF37)
  - Validar formato "Disponível em: <URL>. Acesso em: DD mês AAAA"
  - Validar precedentes (STF, STJ, TRF, TJ)
  
- [ ] **Performance Benchmarks**:
  - TTFT < 300ms (base prompt)
  - buildSystemPrompt() < 5ms
  - SSE streaming < 10s
  - PWA Lighthouse > 90
  
- [ ] **Mobile Testing** (devices reais):
  - Android Chrome: PWA installability
  - iOS Safari: PWA installability
  - SSE reconnection (4G → WiFi switch)
  - Offline fallback
  - Touch targets > 44px

**Ganho Esperado**: Confidence HIGH, risco LOW

---

#### **Agente 12: Final Audit**
**Responsabilidade**: Security, performance, quality validation completa  
**Prioridade**: P0 (CRITICAL - final gate)  
**Duração**: 1-2 dias  
**Arquivos**:
- `AUDITORIA_FINAL_v2.9.0.md` (NOVO - relatório)
- Security scan reports
- Performance reports

**Tarefas**:
- [ ] **Security Scan**:
  - [ ] 58/58 routes protegidas (requireAuth)
  - [ ] CSRF tokens validados
  - [ ] .env não no git (credentials revoked)
  - [ ] CSP sem unsafe-inline
  - [ ] Dependency vulnerabilities (npm audit)
  - [ ] SQL injection tests (KB, search)
  
- [ ] **Performance Metrics** (vs baseline):
  - [ ] TTFT: 800ms → <300ms ✅
  - [ ] SSE streaming: 24-30s → <10s ✅
  - [ ] buildSystemPrompt(): 20ms → <5ms ✅
  - [ ] Token cost: $35.19 → <$15 ✅
  - [ ] PWA Lighthouse: 75 → >90 ✅
  
- [ ] **Quality Validation**:
  - [ ] Apresentação correta: 30% → >70% ✅
  - [ ] ABNT formatting: 40% → >90% ✅
  - [ ] Wrong tool calls: 40% → <20% ✅
  - [ ] PWA installability: 0% → 100% ✅
  
- [ ] **Error Log Analysis**:
  - [ ] No EADDRINUSE crashes (cluster mode)
  - [ ] No timeout spikes (SSE)
  - [ ] No auth failures (requireAuth)
  
- [ ] **Generate Final Report**:
  ```markdown
  # AUDITORIA FINAL - IAROM v2.9.0
  
  ## Métricas Atingidas
  [Table with baseline vs target vs actual]
  
  ## Security Validation
  [Checklist completo]
  
  ## Performance Benchmarks
  [Charts, graphs]
  
  ## Quality Assurance
  [Test results, coverage]
  
  ## Recommendations
  [Next steps, backlog]
  ```

**Ganho Esperado**: ✅ GO/NO-GO decision for v2.9.0 release

---

## 3. GRUPOS DE EXECUÇÃO

### Estrutura de Grupos

```
┌─────────────────────────────────────────────────────────┐
│ GRUPO A - Optimizations Core (PARALELO)                │
│ Agentes: 1, 2, 3, 4, 5                                  │
│ Duração: 3 dias (máximo do grupo)                       │
│ Arquivos: Independentes (zero conflitos)                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ GRUPO B - Auth & Security (SEQUENCIAL)                 │
│ Agente 6 → Agente 7                                     │
│ Duração: 2-3 dias (somados)                             │
│ Dependência: Frontend ANTES de Backend                  │
└─────────────────────────────────────────────────────────┘
                          ↓ (parallel with B)
┌─────────────────────────────────────────────────────────┐
│ GRUPO C - Mobile & Deploy (PARALELO)                   │
│ Agentes: 8, 9                                           │
│ Duração: 2-3 dias (máximo do grupo)                     │
│ Arquivos: Independentes                                 │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ GRUPO D - Validation & Audit (SEQUENCIAL)              │
│ Agente 10 → Agente 11 → Agente 12                      │
│ Duração: 14-21 dias (A/B testing gradual)               │
│ Dependência: 10 (testing) → 11 (integration) → 12 (audit) │
└─────────────────────────────────────────────────────────┘
```

---

## 4. ORDEM DE EXECUÇÃO E DEPENDÊNCIAS

### Grafo de Dependências

```
           START
             │
    ┌────────┼────────┐
    │        │        │
    ▼        ▼        ▼
  Ag1      Ag2      Ag3     } GRUPO A
    │        │        │     } (PARALELO)
    │        │        │
    ▼        ▼        ▼
  Ag4      Ag5
    │        │
    └────┬───┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  Ag6  →    Ag7       } GRUPO B (SEQUENCIAL: 6 → 7)
    │         │
    └────┬────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  Ag8       Ag9       } GRUPO C (PARALELO)
    │         │
    └────┬────┘
         │
         ▼
       Ag10           } GRUPO D
         │            } (SEQUENCIAL: 10 → 11 → 12)
         ▼
       Ag11
         │
         ▼
       Ag12
         │
         ▼
        END
```

### Matriz de Dependências

| Agente | Depende de | Bloqueia | Arquivos Modificados |
|--------|-----------|----------|---------------------|
| Ag1 | - | - | `src/lib/prompt-builder.js` (novo), `src/modules/optimized-prompts.js` (novo), `src/server-enhanced.js` |
| Ag2 | - | - | `frontend/public/icons/*.png` (novo), `frontend/public/manifest.json`, `frontend/public/service-worker.js` |
| Ag3 | - | - | `src/server-enhanced.js`, `src/lib/prompt-cache.js` (novo) |
| Ag4 | - | - | `data/rom-project/prompts/gerais/master-rom.json`, `src/server-enhanced.js` |
| Ag5 | - | - | `src/modules/bedrock.js` |
| Ag6 | Ag1-5 (GRUPO A) | Ag7 | `frontend/src/stores/authStore.ts`, `frontend/src/services/api.ts` |
| Ag7 | Ag6 | - | `src/server-enhanced.js`, `src/middleware/auth.js` |
| Ag8 | Ag1-5 (GRUPO A) | - | `frontend/src/pages/ArtifactPanel.tsx`, `frontend/src/services/api.ts`, `frontend/src/App.tsx`, `frontend/tailwind.config.js` |
| Ag9 | Ag1-5 (GRUPO A) | - | `.git/`, `.gitignore`, Render configs |
| Ag10 | Ag1-9 (todos anteriores) | Ag11 | `.env`, monitoring |
| Ag11 | Ag10 | Ag12 | `tests/integration/`, `tests/performance/` |
| Ag12 | Ag11 | - | `AUDITORIA_FINAL_v2.9.0.md` |

### Conflitos de Arquivos

**Arquivo com Múltiplos Agentes**: `src/server-enhanced.js`
- Agente 1: Modifica buildSystemPrompt()
- Agente 3: Modifica buildSystemPrompt() + getAgent()
- Agente 4: Modifica buildSystemPrompt()
- Agente 7: Adiciona requireAuth em routes

**Solução**:
- Agentes 1, 3, 4 executam em PARALELO (GRUPO A)
- MERGE de Ag1, Ag3, Ag4 ANTES de iniciar Ag7
- Ag7 executa SEQUENCIALMENTE após GRUPO A

**Arquivo**: `frontend/src/services/api.ts`
- Agente 6: Modifica apiFetch() usage
- Agente 8: Adiciona SSE reconnection logic

**Solução**:
- Ag6 executa em GRUPO B
- Ag8 executa em GRUPO C (PARALELO com GRUPO B)
- Sections diferentes do arquivo (apiFetch vs streamChat)
- Risco de conflito: LOW

---

## 5. ESTRATÉGIA DE COMMITS (SEM CONFLITOS)

### Branch Strategy

```
main (production)
  │
  ├─ feature/prompt-optimization (Agente 1)
  ├─ feature/pwa-icons (Agente 2)
  ├─ feature/prompt-cache (Agente 3)
  ├─ feature/tool-names-fix (Agente 4)
  ├─ feature/max-loops-reducer (Agente 5)
  │
  └─ merge → main (após GRUPO A)
       │
       ├─ feature/frontend-auth (Agente 6)
       │    └─ merge → main
       │         │
       │         └─ feature/backend-auth (Agente 7)
       │              └─ merge → main
       │
       ├─ feature/pwa-mobile-enhancements (Agente 8)
       ├─ feature/git-sync-deploy (Agente 9)
       │
       └─ merge → main (após GRUPO C)
            │
            └─ release/v2.9.0 (após Agente 10, 11, 12)
```

### Commit Message Convention

```
<type>(<scope>): <subject>

Types:
- feat: Nova funcionalidade
- fix: Bug fix
- perf: Performance improvement
- refactor: Code refactor
- test: Testes
- chore: Manutenção

Scopes:
- prompts: System prompts
- pwa: PWA/mobile
- auth: Authentication
- search: Jurisprudence search
- sse: SSE streaming
- git: Git operations

Examples:
feat(prompts): implement modular prompt builder with 79% reduction
feat(pwa): generate PNG icons for Android installability
perf(prompts): cache buildSystemPrompt in memory (-90% overhead)
fix(prompts): align tool names web_search → pesquisar_jurisprudencia
perf(sse): reduce MAX_TOOL_LOOPS 5 → 2 (-75% latency)
feat(auth): add requireAuth middleware to 58 routes
feat(pwa): implement SSE reconnection with exponential backoff
chore(git): sync staging → main → production
test(integration): add 20+ integration tests for chat/search/KB
docs(audit): generate final audit report v2.9.0
```

### Merge Strategy

**GRUPO A → main**:
```bash
# Após Ag1, Ag2, Ag3, Ag4, Ag5 completos
git checkout main
git merge feature/prompt-optimization --no-ff
git merge feature/pwa-icons --no-ff
git merge feature/prompt-cache --no-ff
git merge feature/tool-names-fix --no-ff
git merge feature/max-loops-reducer --no-ff
git push origin main
```

**GRUPO B → main** (SEQUENCIAL):
```bash
# Ag6 primeiro
git merge feature/frontend-auth --no-ff
git push origin main

# Ag7 depois (depende de Ag6)
git merge feature/backend-auth --no-ff
git push origin main
```

**GRUPO C → main** (PARALELO):
```bash
git merge feature/pwa-mobile-enhancements --no-ff
git merge feature/git-sync-deploy --no-ff
git push origin main
```

**Release**:
```bash
# Após Ag10, Ag11, Ag12 (validation completa)
git checkout -b release/v2.9.0
git tag v2.9.0
git push origin release/v2.9.0 --tags
```

---

## 6. ESTRATÉGIA DE DEPLOY (ZERO DOWNTIME)

### Rolling Update com Feature Flags

**Configuração**:
```bash
# .env
PROMPTS_VERSION=optimized         # ou 'original' (rollback)
ENABLE_AUTH_MIDDLEWARE=true       # ou 'false' (gradual)
PWA_ENHANCED=true                 # PWA melhorias
TRAFFIC_PERCENTAGE=10             # A/B testing (10, 25, 50, 100)
```

**Load Balancer Strategy** (Render.com):
```
                  User Requests
                        │
                        ▼
                   Load Balancer
                    /       \
                   /         \
              Instance 1   Instance 2
            (old version) (new version)
                  │            │
                  └────┬───────┘
                       │
                  Database (PostgreSQL)
```

**Health Check Endpoint**:
```javascript
// src/server-enhanced.js
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    version: process.env.npm_package_version,
    prompts: process.env.PROMPTS_VERSION,
    timestamp: new Date().toISOString(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      prompts: CACHED_SYSTEM_PROMPT !== null,
      auth: process.env.ENABLE_AUTH_MIDDLEWARE === 'true'
    }
  };
  
  const allHealthy = Object.values(health.checks).every(v => v === true);
  res.status(allHealthy ? 200 : 503).json(health);
});
```

### Blue-Green Deployment

**Setup**:
```yaml
# render.yaml
services:
  - type: web
    name: rom-agent-blue
    branch: main
    envVars:
      - key: DEPLOYMENT_COLOR
        value: blue
    
  - type: web
    name: rom-agent-green
    branch: release/v2.9.0
    envVars:
      - key: DEPLOYMENT_COLOR
        value: green
```

**Traffic Switch**:
```
Phase 1: 100% Blue (current production)
  ┌─────────────────────┐
  │ Blue: 100% traffic  │ ← All users
  │ Green: 0% traffic   │
  └─────────────────────┘

Phase 2: 10% Green (initial test)
  ┌─────────────────────┐
  │ Blue: 90% traffic   │ ← Most users
  │ Green: 10% traffic  │ ← Test users
  └─────────────────────┘

Phase 3: 50% Green (validation)
  ┌─────────────────────┐
  │ Blue: 50% traffic   │
  │ Green: 50% traffic  │
  └─────────────────────┘

Phase 4: 100% Green (full rollout)
  ┌─────────────────────┐
  │ Blue: 0% traffic    │
  │ Green: 100% traffic │ ← All users
  └─────────────────────┘

Rollback (if needed): Instant switch back to Blue
```

### Gradual Rollout Timeline

| Week | Traffic % | Monitoring | Rollback Trigger |
|------|-----------|------------|------------------|
| 1 | 10% | Intensivo (1h intervals) | Error rate > 5%, TTFT > 2x, complaints > 5/hour |
| 2 | 25% | Daily | Error rate > 3%, TTFT > 1.5x, complaints > 10/hour |
| 3 | 50% | Daily | Error rate > 2%, TTFT > 1.2x, complaints > 15/hour |
| 4+ | 100% | Weekly | Error rate > 1%, TTFT > baseline |

---

## 7. FEATURE FLAGS E ROLLBACK

### Feature Flags Configuration

**Implementation**:
```javascript
// src/lib/feature-flags.js
export class FeatureFlags {
  constructor() {
    this.flags = {
      PROMPTS_VERSION: process.env.PROMPTS_VERSION || 'original',
      ENABLE_AUTH_MIDDLEWARE: process.env.ENABLE_AUTH_MIDDLEWARE === 'true',
      PWA_ENHANCED: process.env.PWA_ENHANCED === 'true',
      TRAFFIC_PERCENTAGE: parseInt(process.env.TRAFFIC_PERCENTAGE || '0')
    };
  }
  
  isEnabled(flag) {
    return this.flags[flag] === true || this.flags[flag] === 'optimized';
  }
  
  getTrafficPercentage() {
    return this.flags.TRAFFIC_PERCENTAGE;
  }
  
  shouldUseOptimizedPrompts(userId) {
    if (this.flags.PROMPTS_VERSION === 'original') return false;
    if (this.flags.PROMPTS_VERSION === 'optimized' && this.flags.TRAFFIC_PERCENTAGE === 100) return true;
    
    // A/B testing: hash user ID to deterministic bucket
    const hash = hashCode(userId);
    const bucket = hash % 100;
    return bucket < this.flags.TRAFFIC_PERCENTAGE;
  }
}
```

**Usage**:
```javascript
// src/server-enhanced.js
import { FeatureFlags } from './lib/feature-flags.js';
const flags = new FeatureFlags();

function buildSystemPrompt(userId) {
  if (flags.shouldUseOptimizedPrompts(userId)) {
    return PromptBuilder.build({ optimized: true });
  }
  return buildSystemPromptOriginal();
}

// Auth middleware
if (flags.isEnabled('ENABLE_AUTH_MIDDLEWARE')) {
  app.use('/api/*', requireAuth);
}
```

### Rollback Procedures

#### **Rollback Nivel 1: Feature Flag (< 1 minuto)**
```bash
# Se detectar problema IMEDIATO
# Render.com Dashboard → Environment Variables
PROMPTS_VERSION=original
# Click "Save" → Auto-redeploy

# Ou via CLI
render env:set PROMPTS_VERSION=original --service rom-agent
# Restart automático
```

#### **Rollback Nivel 2: Git Revert (< 5 minutos)**
```bash
# Se feature flag não resolver
git revert HEAD~3..HEAD  # Reverte últimos 3 commits
git push origin main --force-with-lease

# Render.com auto-deploy triggered
# Ou manual: Render Dashboard → Manual Deploy → main branch
```

#### **Rollback Nivel 3: Blue-Green Switch (< 10 segundos)**
```bash
# Se blue-green deployment ativo
# Render Dashboard → Services → Traffic Split
# Blue: 100%, Green: 0%
# Instant switch
```

#### **Rollback Nivel 4: Full Restore (< 30 minutos)**
```bash
# Pior caso: restore backup completo
git checkout v2.8.0  # Última versão estável
git push origin main --force

# Restore database backup (se necessário)
pg_restore -d rom_agent latest_backup.dump

# Render redeploy
```

---

## 8. AUDITORIA FINAL AUTOMATIZADA

### Automation Script

**audit-final.sh**:
```bash
#!/bin/bash

echo "🔍 AUDITORIA FINAL - IAROM v2.9.0"
echo "================================="

# 1. Security Scan
echo "\n🔒 SECURITY SCAN"
echo "---------------"
npm audit --production
npm audit --audit-level=high

# Check protected routes
UNPROTECTED=$(grep -r "app\.(get|post|put|delete)" src/server-enhanced.js | grep -v "requireAuth" | wc -l)
if [ $UNPROTECTED -gt 5 ]; then  # Expect ≤5 public routes (login, register, health)
  echo "❌ FAIL: $UNPROTECTED unprotected routes found"
  exit 1
else
  echo "✅ PASS: Protected routes OK"
fi

# Check .env not in git
if git ls-files | grep -q "\.env$"; then
  echo "❌ FAIL: .env in git"
  exit 1
else
  echo "✅ PASS: .env not in git"
fi

# 2. Performance Benchmarks
echo "\n⚡ PERFORMANCE BENCHMARKS"
echo "------------------------"
node tests/performance/benchmark-ttft.js  # Expect < 300ms
node tests/performance/benchmark-sse.js   # Expect < 10s
node tests/performance/benchmark-prompts.js  # Expect < 5ms

# 3. Quality Validation
echo "\n✅ QUALITY VALIDATION"
echo "---------------------"
npm test -- --coverage --coverageThreshold='{"global":{"lines":70}}'

# Integration tests
node tests/integration/chat-flow.test.js
node tests/integration/search-flow.test.js
node tests/integration/kb-flow.test.js

# ABNT formatting validation
node tests/integration/abnt-formatting.test.js

# 4. PWA Audit
echo "\n📱 PWA AUDIT"
echo "-----------"
lighthouse https://iarom.com.br --preset=perf --chrome-flags="--headless" --output=json --output-path=./lighthouse-report.json
PWA_SCORE=$(jq '.categories.pwa.score * 100' lighthouse-report.json)
if [ $PWA_SCORE -lt 90 ]; then
  echo "❌ FAIL: PWA score $PWA_SCORE < 90"
  exit 1
else
  echo "✅ PASS: PWA score $PWA_SCORE"
fi

# 5. Error Log Analysis
echo "\n📊 ERROR LOG ANALYSIS"
echo "---------------------"
ERROR_COUNT=$(tail -n 1000 logs/error.log | wc -l)
if [ $ERROR_COUNT -gt 50 ]; then  # Expect < 50 errors in last 1000 lines
  echo "⚠️  WARNING: $ERROR_COUNT recent errors"
else
  echo "✅ PASS: Error count acceptable"
fi

# 6. Generate Final Report
echo "\n📄 GENERATING FINAL REPORT"
echo "--------------------------"
node scripts/generate-audit-report.js

echo "\n✅ AUDITORIA COMPLETA"
echo "Relatório: AUDITORIA_FINAL_v2.9.0.md"
```

### Automated Checks (CI/CD)

**GitHub Actions Workflow**:
```yaml
# .github/workflows/audit.yml
name: Final Audit

on:
  push:
    branches: [ release/* ]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '25'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Security audit
        run: npm audit --audit-level=high
      
      - name: Run tests
        run: npm test -- --coverage
      
      - name: Performance benchmarks
        run: npm run benchmark
      
      - name: PWA audit
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: https://iarom.com.br
          budgetPath: ./lighthouse-budget.json
          uploadArtifacts: true
      
      - name: Generate report
        run: bash audit-final.sh
      
      - name: Upload report
        uses: actions/upload-artifact@v3
        with:
          name: audit-report
          path: AUDITORIA_FINAL_v2.9.0.md
```

---

## 9. MONITORING E ALERTAS

### Metrics Collection

**Prometheus Metrics**:
```javascript
// src/lib/metrics.js
import client from 'prom-client';

export const metrics = {
  // Performance
  ttft: new client.Histogram({
    name: 'ttft_seconds',
    help: 'Time to first token',
    buckets: [0.1, 0.3, 0.5, 1, 2, 5]
  }),
  
  sseStreamingTime: new client.Histogram({
    name: 'sse_streaming_seconds',
    help: 'Total SSE streaming time',
    buckets: [5, 10, 15, 20, 30, 60]
  }),
  
  promptBuildTime: new client.Histogram({
    name: 'prompt_build_milliseconds',
    help: 'buildSystemPrompt execution time',
    buckets: [1, 2, 5, 10, 20, 50]
  }),
  
  // Costs
  tokensUsed: new client.Counter({
    name: 'tokens_used_total',
    help: 'Total tokens used (input + output)',
    labelNames: ['model', 'prompt_version']
  }),
  
  // Quality
  presentationCorrect: new client.Counter({
    name: 'presentation_correct_total',
    help: 'Presentations correct on first try',
    labelNames: ['prompt_version']
  }),
  
  toolCallsWrong: new client.Counter({
    name: 'tool_calls_wrong_total',
    help: 'Wrong tool calls',
    labelNames: ['expected_tool', 'actual_tool']
  }),
  
  // Errors
  errors: new client.Counter({
    name: 'errors_total',
    help: 'Total errors',
    labelNames: ['type', 'route']
  })
};
```

**Usage**:
```javascript
// src/server-enhanced.js
import { metrics } from './lib/metrics.js';

app.post('/api/chat', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Build prompt
    const promptStart = Date.now();
    const systemPrompt = buildSystemPrompt(req.session.userId);
    metrics.promptBuildTime.observe(Date.now() - promptStart);
    
    // Stream chat
    await streamChat(...);
    
    // Record TTFT
    metrics.ttft.observe((Date.now() - startTime) / 1000);
    
    // Record tokens
    metrics.tokensUsed.inc({
      model: 'claude-sonnet-4.5',
      prompt_version: process.env.PROMPTS_VERSION
    }, totalTokens);
    
  } catch (error) {
    metrics.errors.inc({ type: error.name, route: '/api/chat' });
    throw error;
  }
});
```

### Alert Rules

**Prometheus Alertmanager**:
```yaml
# alertmanager.yml
groups:
  - name: iarom_alerts
    interval: 1m
    rules:
      # Performance degradation
      - alert: TTFTHigh
        expr: histogram_quantile(0.95, ttft_seconds_bucket) > 0.8
        for: 5m
        annotations:
          summary: "TTFT p95 > 800ms (target: 300ms)"
        
      - alert: SSEStreamingSlow
        expr: histogram_quantile(0.95, sse_streaming_seconds_bucket) > 15
        for: 5m
        annotations:
          summary: "SSE streaming p95 > 15s (target: 10s)"
      
      # Error rate spike
      - alert: ErrorRateHigh
        expr: rate(errors_total[5m]) > 0.05
        for: 5m
        annotations:
          summary: "Error rate > 5%"
      
      # Cost spike
      - alert: TokenUsageHigh
        expr: rate(tokens_used_total[1h]) > 1000000
        for: 1h
        annotations:
          summary: "Token usage > 1M/hour (cost spike)"
      
      # Quality degradation
      - alert: PresentationCorrectLow
        expr: rate(presentation_correct_total[15m]) < 0.7
        for: 15m
        annotations:
          summary: "Presentation correct < 70%"
```

### Dashboards

**Grafana Dashboard**:
```json
{
  "dashboard": {
    "title": "IAROM v2.9.0 Monitoring",
    "panels": [
      {
        "title": "TTFT (p50, p95, p99)",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, ttft_seconds_bucket)",
            "legendFormat": "p50"
          },
          {
            "expr": "histogram_quantile(0.95, ttft_seconds_bucket)",
            "legendFormat": "p95"
          },
          {
            "expr": "histogram_quantile(0.99, ttft_seconds_bucket)",
            "legendFormat": "p99"
          }
        ],
        "yaxis": { "label": "seconds", "max": 1 }
      },
      {
        "title": "SSE Streaming Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sse_streaming_seconds_bucket)"
          }
        ],
        "yaxis": { "label": "seconds", "max": 30 }
      },
      {
        "title": "Prompt Build Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, prompt_build_milliseconds_bucket)"
          }
        ],
        "yaxis": { "label": "milliseconds", "max": 20 }
      },
      {
        "title": "Token Usage by Version",
        "targets": [
          {
            "expr": "rate(tokens_used_total{prompt_version='optimized'}[1h])",
            "legendFormat": "optimized"
          },
          {
            "expr": "rate(tokens_used_total{prompt_version='original'}[1h])",
            "legendFormat": "original"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(errors_total[5m])"
          }
        ],
        "yaxis": { "label": "errors/sec" },
        "alert": { "threshold": 0.05 }
      }
    ]
  }
}
```

---

## 10. CRONOGRAMA DETALHADO (30 DIAS)

### Semana 1 (Dias 1-7): GRUPO A + Preparação

**Dia 1-2: Setup & Planning**
- [ ] Review completo deste plano
- [ ] Aprovação stakeholders
- [ ] Criar feature branches (12 branches)
- [ ] Setup monitoring (Prometheus, Grafana)
- [ ] Setup CI/CD (GitHub Actions)

**Dia 3-5: GRUPO A Execution (PARALELO)**
- [ ] **Agente 1**: Prompt Optimizer (2-3 dias)
  - Criar prompt-builder.js
  - Implementar optimized prompts
  - Feature flags
  - Unit tests
  
- [ ] **Agente 2**: PWA Icons (1 dia)
  - Generate PNGs
  - Update manifest/SW
  - Test installability
  
- [ ] **Agente 3**: Prompt Cache (1 dia)
  - Cache implementation
  - Startup loading
  - Benchmarks
  
- [ ] **Agente 4**: Tool Names Fix (1 dia)
  - Fix web_search → pesquisar_jurisprudencia
  - Remove pesquisar_jusbrasil
  - Update DataJud docs
  
- [ ] **Agente 5**: MAX_LOOPS Reducer (4 horas)
  - Change 5 → 2
  - Validation tests
  - Benchmarks

**Dia 6: GRUPO A Merge**
- [ ] Code review (4 horas)
- [ ] Merge all GRUPO A branches → main
- [ ] Deploy to staging
- [ ] Smoke tests

**Dia 7: GRUPO A Validation**
- [ ] Integration tests
- [ ] Performance validation
- [ ] Fix any issues found

---

### Semana 2 (Dias 8-14): GRUPO B + GRUPO C

**Dia 8-9: GRUPO B - Agente 6 (Frontend Auth)**
- [ ] Replace fetch() → apiFetch()
- [ ] Fix CSRF paths
- [ ] Test login/logout
- [ ] Code review
- [ ] Merge → main

**Dia 10-11: GRUPO B - Agente 7 (Backend Auth)**
⚠️ **Depende de Agente 6**
- [ ] Add requireAuth to 58 routes
- [ ] Feature flag setup
- [ ] Test 401 responses
- [ ] Code review
- [ ] Merge → main

**Dia 8-11: GRUPO C - Agente 8 (PWA Mobile) [PARALELO com GRUPO B]**
- [ ] Code-split ArtifactPanel
- [ ] SSE reconnection logic
- [ ] beforeinstallprompt handler
- [ ] Tailwind classes fix
- [ ] Mobile testing (Android, iOS)
- [ ] Code review
- [ ] Merge → main

**Dia 8-9: GRUPO C - Agente 9 (Git Sync) [PARALELO com GRUPO B]**
- [ ] Clean staging (remove backups)
- [ ] Revoke exposed credentials ⚠️
- [ ] Merge staging → main
- [ ] Update production
- [ ] Tag v2.9.0-rc1
- [ ] Render deploy

**Dia 12: GRUPO B+C Merge**
- [ ] Code review
- [ ] Merge all GRUPO C branches → main
- [ ] Deploy to staging
- [ ] Integration tests

**Dia 13-14: Buffer/Fix Issues**
- [ ] Fix any issues encontradas
- [ ] Additional testing
- [ ] Documentation updates
- [ ] Prepare for GRUPO D

---

### Semana 3-4 (Dias 15-30): GRUPO D - Validation & Rollout

**Dia 15-21: Agente 10 - A/B Testing (Week 1: 10%)**
- [ ] Deploy to production com feature flags
- [ ] PROMPTS_VERSION=optimized
- [ ] TRAFFIC_PERCENTAGE=10
- [ ] Intensive monitoring (1h intervals):
  - TTFT < 300ms?
  - SSE streaming < 10s?
  - Error rate < 5%?
  - User complaints < 5/hour?
- [ ] Daily standup com métricas
- [ ] Ajustes se necessário

**Dia 22-28: Agente 10 - A/B Testing (Week 2: 25%)**
- [ ] Increase TRAFFIC_PERCENTAGE=25
- [ ] Daily monitoring
- [ ] Validate improvements:
  - Token cost reduction confirmed?
  - Performance gains confirmed?
  - No quality degradation?

**Dia 29-30: Agente 11 - Integration Testing**
- [ ] Run full integration test suite:
  - Chat flow (10+ casos)
  - Upload + KB (5+ doc types)
  - Jurisprudence search
  - ABNT formatting
  - Mobile (Android, iOS)
- [ ] Performance benchmarks
- [ ] Generate test report

**Dia 30: Agente 12 - Final Audit**
- [ ] Security scan (npm audit, route protection, credentials)
- [ ] Performance metrics (TTFT, SSE, prompt build, costs)
- [ ] Quality validation (presentation correct, ABNT, tool calls)
- [ ] Error log analysis
- [ ] Generate AUDITORIA_FINAL_v2.9.0.md
- [ ] **GO/NO-GO decision**

---

### Semana 5+ (Opcional - Full Rollout)

**Dia 31-37: 50% Traffic**
- [ ] TRAFFIC_PERCENTAGE=50
- [ ] Validation at scale

**Dia 38-44: 100% Traffic**
- [ ] TRAFFIC_PERCENTAGE=100
- [ ] Full rollout
- [ ] Remove feature flags (cleanup)
- [ ] Tag v2.9.0 (final)
- [ ] Celebrate! 🎉

---

## 11. CHECKLIST DE EXECUÇÃO

### Pre-Execution Checklist

**Planning & Approval**
- [ ] Plano orquestrado reviewed (this document)
- [ ] Stakeholder approval obtained
- [ ] Team capacity confirmed (developers available)
- [ ] Timeline approved (30 days)
- [ ] Budget approved (if applicable)

**Infrastructure**
- [ ] Monitoring setup (Prometheus, Grafana)
- [ ] Alerting configured (Alertmanager, Slack)
- [ ] CI/CD pipeline ready (GitHub Actions)
- [ ] Staging environment ready
- [ ] Production environment ready
- [ ] Database backups configured (hourly)

**Git & Deploy**
- [ ] Git branches strategy defined
- [ ] Feature flags configured (.env template)
- [ ] Rollback procedures documented
- [ ] Blue-green deployment setup (if applicable)
- [ ] Health check endpoint tested

---

### GRUPO A Checklist (Dias 3-7)

**Agente 1: Prompt Optimizer**
- [ ] `src/lib/prompt-builder.js` created
- [ ] `src/modules/optimized-prompts.js` created
- [ ] OPTIMIZED_SYSTEM_PROMPT implemented (1.750 chars)
- [ ] TOOL_SPECIFIC_INSTRUCTIONS implemented (4.200 chars)
- [ ] ABNT_FORMATTING_RULES implemented (4.100 chars)
- [ ] Feature flag PROMPTS_VERSION added
- [ ] Unit tests written (10+ casos)
- [ ] Code reviewed
- [ ] Merged to main

**Agente 2: PWA Icons**
- [ ] icon-192x192.png generated
- [ ] icon-512x512.png generated
- [ ] icon-180x180.png generated (Apple)
- [ ] manifest.json updated
- [ ] service-worker.js precache updated
- [ ] Android installability tested
- [ ] iOS installability tested
- [ ] Lighthouse PWA audit (score > 90)
- [ ] Code reviewed
- [ ] Merged to main

**Agente 3: Prompt Cache**
- [ ] Cache em memória implemented
- [ ] Startup loading implemented
- [ ] Invalidation strategy defined
- [ ] Benchmark: buildSystemPrompt() < 5ms
- [ ] Code reviewed
- [ ] Merged to main

**Agente 4: Tool Names Fix**
- [ ] web_search → pesquisar_jurisprudencia fixed
- [ ] pesquisar_jusbrasil removed
- [ ] DataJud documented as "quando configurado"
- [ ] Tool description duplication removed
- [ ] Timeout expectation updated (< 20s)
- [ ] Code reviewed
- [ ] Merged to main

**Agente 5: MAX_LOOPS Reducer**
- [ ] MAX_TOOL_LOOPS changed from 5 → 2
- [ ] Validation tests passed
- [ ] Benchmark: SSE streaming < 10s
- [ ] Code reviewed
- [ ] Merged to main

**GRUPO A Integration**
- [ ] All 5 agents merged
- [ ] Deployed to staging
- [ ] Smoke tests passed
- [ ] Integration tests passed
- [ ] No conflicts detected
- [ ] Ready for GRUPO B

---

### GRUPO B Checklist (Dias 8-11)

**Agente 6: Frontend Auth**
- [ ] 6 fetch() replaced with apiFetch()
- [ ] CSRF token handling verified
- [ ] Login/logout flow tested
- [ ] 401 handling tested
- [ ] Code reviewed
- [ ] Merged to main
- [ ] Deployed to staging

**Agente 7: Backend Auth** (APÓS Agente 6)
- [ ] requireAuth middleware added to 58 routes
- [ ] Public routes maintained (login, register, health)
- [ ] Feature flag ENABLE_AUTH_MIDDLEWARE added
- [ ] 401 responses tested
- [ ] Integration tests passed
- [ ] Code reviewed
- [ ] Merged to main
- [ ] Deployed to staging

**GRUPO B Integration**
- [ ] Frontend + Backend auth working together
- [ ] No auth bypass found
- [ ] All protected routes require token
- [ ] Ready for GRUPO C

---

### GRUPO C Checklist (Dias 8-12)

**Agente 8: PWA Mobile**
- [ ] ArtifactPanel code-split (-682KB bundle)
- [ ] SSE reconnection logic implemented
- [ ] beforeinstallprompt handler implemented
- [ ] Tailwind pb-safe class defined
- [ ] Android testing passed
- [ ] iOS testing passed
- [ ] PWA Lighthouse > 90
- [ ] Code reviewed
- [ ] Merged to main

**Agente 9: Git Sync**
- [ ] Staging cleaned (backups removed)
- [ ] Exposed credentials revoked ⚠️
- [ ] Staging → main merged
- [ ] Main → production merged
- [ ] v2.9.0-rc1 tagged
- [ ] Render deploy successful
- [ ] No conflicts detected

**GRUPO C Integration**
- [ ] All mobile features working
- [ ] Git history clean
- [ ] Production updated
- [ ] Ready for GRUPO D

---

### GRUPO D Checklist (Dias 15-30)

**Agente 10: A/B Testing**
- [ ] **Week 1 (10% traffic)**:
  - [ ] TRAFFIC_PERCENTAGE=10 set
  - [ ] Monitoring intensive (1h intervals)
  - [ ] TTFT < 300ms confirmed
  - [ ] SSE streaming < 10s confirmed
  - [ ] Error rate < 5% confirmed
  - [ ] No rollback triggered
  
- [ ] **Week 2 (25% traffic)**:
  - [ ] TRAFFIC_PERCENTAGE=25 set
  - [ ] Daily monitoring
  - [ ] Token cost reduction confirmed
  - [ ] Performance gains confirmed
  - [ ] No quality degradation detected

**Agente 11: Integration Testing**
- [ ] Chat flow tested (10+ casos)
- [ ] Upload + KB tested (5+ doc types)
- [ ] Jurisprudence search tested
- [ ] ABNT formatting validated
- [ ] Mobile testing (Android, iOS)
- [ ] Performance benchmarks met:
  - [ ] TTFT < 300ms ✅
  - [ ] SSE streaming < 10s ✅
  - [ ] Prompt build < 5ms ✅
  - [ ] PWA Lighthouse > 90 ✅
- [ ] Test report generated

**Agente 12: Final Audit**
- [ ] **Security scan**:
  - [ ] npm audit passed
  - [ ] 58/58 routes protected
  - [ ] .env not in git
  - [ ] Credentials revoked
  - [ ] CSP without unsafe-inline
  
- [ ] **Performance metrics**:
  - [ ] TTFT: 800ms → <300ms ✅
  - [ ] SSE: 24-30s → <10s ✅
  - [ ] Prompt build: 20ms → <5ms ✅
  - [ ] Token cost: $35.19 → <$15 ✅
  
- [ ] **Quality validation**:
  - [ ] Apresentação correta: 30% → >70% ✅
  - [ ] ABNT formatting: 40% → >90% ✅
  - [ ] Wrong tool calls: 40% → <20% ✅
  - [ ] PWA installability: 0% → 100% ✅
  
- [ ] **Error log analysis**:
  - [ ] No EADDRINUSE crashes
  - [ ] No timeout spikes
  - [ ] No auth failures
  
- [ ] **Final report**:
  - [ ] AUDITORIA_FINAL_v2.9.0.md generated
  - [ ] All metrics documented
  - [ ] Recommendations provided
  - [ ] **GO/NO-GO decision: ________________**

---

### Post-Execution Checklist

**Rollout to 100%**
- [ ] TRAFFIC_PERCENTAGE=100 set
- [ ] Full production rollout
- [ ] Feature flags removed (cleanup)
- [ ] v2.9.0 tagged (final)
- [ ] Documentation updated
- [ ] Team training completed (if needed)

**Monitoring (First Week)**
- [ ] Daily metrics review
- [ ] No rollback triggered
- [ ] User feedback positive
- [ ] Performance stable
- [ ] Costs as expected

**Cleanup**
- [ ] Feature branches deleted
- [ ] Old code removed
- [ ] Documentation archived
- [ ] Lessons learned documented
- [ ] Next improvements backlog updated

**Celebration 🎉**
- [ ] Team retrospective
- [ ] Success metrics shared
- [ ] Stakeholder update
- [ ] User communication
- [ ] Plan v2.10.0 (next iteration)

---

## FIM DO PLANO ORQUESTRADO

**Status**: ✅ PRONTO PARA EXECUÇÃO  
**Aprovação Pendente**: Stakeholders  
**Data de Início**: TBD  
**Data de Conclusão Esperada**: +30 dias  

**Próximo Passo**: Review & Approval → Execute Dia 1-2 (Setup & Planning)

---

**Métricas de Sucesso Esperadas**:
- ⚡ -75% SSE streaming time (24-30s → 6-8s)
- 🚀 -63% TTFT (800ms → 300ms)
- 💰 -57% custo mensal ($35.19 → $15)
- 🎯 +133% apresentação correta (30% → 70%)
- 📱 +100% PWA installability (0% → 100%)
- 🔒 100% routes protegidas (0/58 → 58/58)

**ROI**: 40 horas implementação → $607/year savings + massive UX improvement

---
