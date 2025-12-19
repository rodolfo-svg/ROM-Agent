# Rollback - ROM Agent (Render)

## 1) Fail-safe imediato (sem trocar commit)
No Render Dashboard > Environment:
- ENABLE_BOTTLENECK=false
- ENABLE_CIRCUIT_BREAKER=false
- ENABLE_RETRY=true (opcional)
- ENABLE_METRICS=true (opcional)

Salvar -> redeploy automático.

## 2) Rollback por deploy de commit/tag anterior
Render Dashboard > Deploys:
- escolher deploy anterior (ou redeploy do commit anterior)
OU
- fazer checkout da tag localmente e push para branch staging.

## 3) Validação pós-rollback
- GET /api/info -> confirmar uptime/versão
- GET /metrics -> confirmar endpoint responde
- POST /api/chat -> verificar resposta esperada (400 se message ausente)
