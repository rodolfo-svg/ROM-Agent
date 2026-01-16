# ROM Agent - Estrategia de Deploy UNICO e DEFINITIVO

## Versao: 2.8.0 | Data: 2026-01-16

---

## 1. ANALISE DE DEPENDENCIAS ENTRE MUDANCAS

### Ordem de Dependencias (Grafo)

```
[Migrations SQL]
       |
       v
[Backend Services] --> [Middleware] --> [Routes/APIs]
       |                    |
       v                    v
[Frontend Build] -------> [Static Assets]
       |
       v
[Deploy Render] --> [Health Checks] --> [Producao Live]
```

### Dependencias Criticas

| Componente | Depende De | Impacto |
|------------|-----------|---------|
| `001_initial_schema.sql` | PostgreSQL | Todas as tabelas |
| `002_security_enhancements.sql` | 001 | Auth, Sessoes |
| `005_performance_indexes.sql` | 001, 002 | Performance |
| `006_query_optimization.sql` | 001-005 | Views, Functions |
| Backend Services | Migrations | Operacao |
| Frontend | Backend APIs | UI |
| Health Checks | Tudo acima | Validacao |

---

## 2. ORDEM CORRETA DE APLICACAO

### Commits/Aplicacoes (Numerados)

```
ORDEM DE DEPLOY:

1. [PRE-DEPLOY] Backup completo
   - Codigo fonte
   - Estado do git
   - Snapshot do banco (se possivel)

2. [DATABASE] Migrations em ordem:
   a) 001_initial_schema.sql
   b) 002_security_enhancements.sql
   c) 005_performance_indexes.sql
   d) 006_query_optimization.sql

3. [BACKEND] Dependencias e build:
   a) npm ci (instalacao limpa)
   b) Validacao de sintaxe

4. [FRONTEND] Build de producao:
   a) npm ci
   b) npm run build
   c) Verificar dist/index.html

5. [GIT] Commit e push:
   a) git add -A
   b) git commit (mensagem estruturada)
   c) git tag v2.8.0
   d) git push origin main --tags

6. [RENDER] Deploy automatico:
   a) Render detecta push
   b) Build inicia (~3 min)
   c) Deploy completo (~2 min)

7. [VALIDACAO] Health checks:
   a) /api/health
   b) Smoke tests
   c) Monitoramento inicial
```

---

## 3. VALIDACOES PRE-DEPLOY

### Checklist Automatico (executado pelo script)

- [ ] Node.js >= 20.x instalado
- [ ] Branch correta (main/master)
- [ ] package.json existe e valido
- [ ] Sintaxe JavaScript sem erros
- [ ] Migrations SQL presentes
- [ ] Variaveis de ambiente configuradas:
  - [ ] DATABASE_URL
  - [ ] SESSION_SECRET
  - [ ] ANTHROPIC_API_KEY (opcional)
  - [ ] AWS_ACCESS_KEY_ID (opcional)
  - [ ] AWS_SECRET_ACCESS_KEY (opcional)
  - [ ] AWS_REGION (opcional)
  - [ ] CNJ_DATAJUD_API_KEY (opcional)

### Checklist Manual Pre-Deploy

- [ ] Todas as features foram testadas localmente
- [ ] Nenhum console.log de debug em producao
- [ ] Secrets nao estao hardcoded
- [ ] .env nao sera commitado (.gitignore OK)
- [ ] Render Dashboard acessivel
- [ ] Credenciais AWS validas (se usando Bedrock)

---

## 4. SMOKE TESTS POS-DEPLOY

### Comandos curl para Validacao

```bash
# =====================================================
# SMOKE TESTS - EXECUTAR APOS DEPLOY
# =====================================================

PROD_URL="https://iarom.com.br"

# 1. Health Check Principal
echo "1. Health Check:"
curl -s "${PROD_URL}/api/health" | jq

# 2. Info da API
echo "2. API Info:"
curl -s "${PROD_URL}/api/info" | jq

# 3. Homepage (deve retornar 200)
echo "3. Homepage:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" "${PROD_URL}/"

# 4. Login Page (200 ou redirect)
echo "4. Login:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" "${PROD_URL}/login"

# 5. API sem Auth (deve retornar 401/403)
echo "5. API Auth Test:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST "${PROD_URL}/api/chat"

# 6. Static Assets
echo "6. Assets:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" "${PROD_URL}/assets/"

# 7. Metrics (se habilitado)
echo "7. Metrics:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" "${PROD_URL}/metrics"

# 8. SSL/TLS Verificacao
echo "8. SSL:"
curl -sI "${PROD_URL}" | head -3

# 9. Response Time
echo "9. Latencia:"
curl -s -o /dev/null -w "Tempo total: %{time_total}s\n" "${PROD_URL}/api/health"

# 10. Headers de Seguranca
echo "10. Security Headers:"
curl -sI "${PROD_URL}" | grep -i "strict\|x-frame\|x-content"

# =====================================================
# TESTE COMPLETO DE CHAT (requer autenticacao)
# =====================================================

# Obter token (substituir email/senha)
TOKEN=$(curl -s -X POST "${PROD_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@iarom.com.br","password":"SENHA"}' | jq -r '.token')

# Testar chat
curl -s -X POST "${PROD_URL}/api/chat" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"message":"Ola, teste de deploy"}' | jq

# =====================================================
```

---

## 5. METRICAS A MONITORAR

### Metricas Criticas (Primeiros 30 minutos)

| Metrica | Threshold OK | Threshold Alerta | Threshold Critico |
|---------|--------------|------------------|-------------------|
| Response Time (p95) | < 200ms | < 500ms | > 1000ms |
| Error Rate | < 0.1% | < 1% | > 5% |
| CPU Usage | < 50% | < 70% | > 90% |
| Memory Usage | < 70% | < 85% | > 95% |
| DB Connections | < 80% | < 90% | > 95% |
| Request Rate | Baseline +/- 20% | +/- 50% | +/- 100% |

### Endpoints de Monitoramento

```bash
# Prometheus Metrics (se habilitado)
curl -s https://iarom.com.br/metrics

# Health Check Detalhado
curl -s https://iarom.com.br/api/health | jq

# Database Health
curl -s https://iarom.com.br/api/health/db | jq

# Redis Health (se usando)
curl -s https://iarom.com.br/api/health/redis | jq
```

### Logs a Observar

1. **Render Logs**: https://dashboard.render.com -> Service -> Logs
2. **Application Logs**: Erros 5xx, warnings
3. **Database Logs**: Slow queries, connection errors
4. **Audit Logs**: Tentativas de login, acoes administrativas

---

## 6. CRITERIOS DE SUCESSO

### Deploy Considerado BEM-SUCEDIDO se:

- [ ] Health check retorna 200 em < 5 segundos
- [ ] Homepage carrega completamente
- [ ] Login/registro funcionam
- [ ] Chat com IA responde (se API keys configuradas)
- [ ] Nenhum erro 5xx nos primeiros 15 minutos
- [ ] Latencia p95 < 500ms
- [ ] Zero downtime durante deploy

### Indicadores de Problema

- [ ] Health check falha apos 5 minutos
- [ ] Erros 500 em endpoints principais
- [ ] Database connection errors
- [ ] Memory leak (crescimento constante)
- [ ] Timeout em operacoes simples

---

## 7. CHECKLIST DE APROVACAO

### Antes de Executar o Deploy

| Item | Responsavel | Status |
|------|-------------|--------|
| Codigo revisado e testado | Dev | [ ] |
| Migrations validadas | DBA/Dev | [ ] |
| Variaveis de ambiente no Render | DevOps | [ ] |
| Backup realizado | Automatico | [ ] |
| Janela de deploy comunicada | PM | [ ] |
| Equipe de suporte avisada | Suporte | [ ] |

### Apos Deploy

| Item | Responsavel | Status |
|------|-------------|--------|
| Health checks passando | Automatico | [ ] |
| Smoke tests OK | Automatico | [ ] |
| Login testado manualmente | QA | [ ] |
| Chat testado | QA | [ ] |
| Monitoramento ativo | DevOps | [ ] |
| Stakeholders notificados | PM | [ ] |

---

## 8. COMANDO DE DEPLOY

### Execucao do Deploy Completo

```bash
# Navegue para o diretorio do projeto
cd /Users/rodolfootaviopereiradamotaoliveira/ROM-Agent

# Execute o script de deploy definitivo
./scripts/deploy-upload-integration.sh

# Ou com variaveis customizadas
PRODUCTION_URL="https://iarom.com.br" \
GITHUB_REPO="rodolfo-svg/ROM-Agent" \
./scripts/deploy-upload-integration.sh
```

### Verificacao Pos-Deploy

```bash
# Teste rapido
curl -s https://iarom.com.br/api/health

# Teste completo
node test-production-site.js
```

---

## 9. ROLLBACK (SE ABSOLUTAMENTE NECESSARIO)

> **NOTA**: Este deploy e planejado para ser DEFINITIVO sem rollback.
> Use apenas em emergencia critica.

```bash
# APENAS EM EMERGENCIA
# Reverter para commit anterior
git revert HEAD --no-commit
git commit -m "emergency: rollback deploy v2.8.0"
git push origin main

# Restaurar migrations (cuidado - pode perder dados)
# Contatar DBA antes de executar
```

---

## 10. CONTATOS DE EMERGENCIA

| Funcao | Contato | Quando Acionar |
|--------|---------|----------------|
| DevOps | - | Problemas de infra |
| DBA | - | Problemas de banco |
| Dev Lead | - | Bugs criticos |
| PM | - | Comunicacao stakeholders |

---

## HISTORICO DE DEPLOY

| Data | Versao | Status | Duracao | Notas |
|------|--------|--------|---------|-------|
| 2026-01-16 | v2.8.0 | PENDENTE | - | Deploy definitivo com upload integration |

---

*Documento gerado automaticamente em 2026-01-16*
*ROM Agent - Redator de Obras Magistrais*
