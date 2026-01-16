# DEPLOY IMEDIATO - ROM Agent v2.8.0

## COMANDO UNICO PARA DEPLOY

```bash
cd /Users/rodolfootaviopereiradamotaoliveira/ROM-Agent && ./scripts/deploy-upload-integration.sh
```

---

## ORDEM DE COMMITS/APLICACOES

```
1. [BACKUP]      Snapshot automatico pre-deploy
2. [MIGRATIONS]  001_initial_schema.sql
                 002_security_enhancements.sql
                 005_performance_indexes.sql
                 006_query_optimization.sql
3. [BACKEND]     npm ci + validacao sintaxe
4. [FRONTEND]    npm ci + npm run build
5. [GIT]         Commit + Tag v2.8.0 + Push
6. [RENDER]      Auto-deploy (~3-5 min)
7. [VALIDATE]    Health checks + Smoke tests
```

---

## SMOKE TESTS (curl)

```bash
# Health Check
curl -s https://iarom.com.br/api/health

# Homepage
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://iarom.com.br/

# API Info
curl -s https://iarom.com.br/api/info

# Auth Test (deve retornar 401)
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST https://iarom.com.br/api/chat

# Latencia
curl -s -o /dev/null -w "Tempo: %{time_total}s\n" https://iarom.com.br/api/health

# Script completo
./scripts/smoke-tests-production.sh
```

---

## METRICAS A MONITORAR

| Metrica | OK | Alerta | Critico |
|---------|-----|--------|---------|
| Response Time (p95) | <200ms | <500ms | >1s |
| Error Rate | <0.1% | <1% | >5% |
| CPU | <50% | <70% | >90% |
| Memory | <70% | <85% | >95% |

---

## CRITERIOS DE SUCESSO

- [ ] Health check 200 em <5s
- [ ] Homepage carrega
- [ ] Login funciona
- [ ] Zero erros 5xx em 15min
- [ ] Latencia <500ms

---

## LINKS

- Producao: https://iarom.com.br
- GitHub: https://github.com/rodolfo-svg/ROM-Agent
- Render: https://dashboard.render.com

---

*Deploy Definitivo - Sem Rollback*
