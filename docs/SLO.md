# SLO (Service Level Objectives) - ROM Agent

**Versão**: v2.5.0-beta
**Data**: 2025-12-26
**Status**: ✅ Implementado

---

## 📊 Visão Geral

Este documento define os **Service Level Objectives (SLOs)** do ROM Agent - objetivos mensuráveis de qualidade de serviço que guiam decisões de arquitetura e operações.

**Baseado em**:
- [Google SRE Book - SLO](https://sre.google/sre-book/service-level-objectives/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

---

## 🎯 SLIs (Service Level Indicators)

### Latência

| Métrica | Target | Descrição |
|---------|--------|-----------|
| **p95 Latency** | ≤ 2s | 95% dos requests completam em até 2s |
| **p99 Latency** | ≤ 5s | 99% dos requests completam em até 5s |

### Disponibilidade

| Métrica | Target | Downtime Permitido |
|---------|--------|-------------------|
| **Availability** | 99.9% | ~43 min/mês ou ~8.7h/ano |

### Taxa de Erro

| Métrica | Target | Descrição |
|---------|--------|-----------|
| **Error Rate** | ≤ 1% | Máximo 1% de requests com 5xx |

---

## ⏱️ Timeouts por Categoria

### HTTP Routes

| Tipo | Timeout | Exemplos |
|------|---------|----------|
| **Fast** | 5s | `/health`, `/metrics`, `/api/info` |
| **Sync** | 30s | CRUD, queries, `/api/projects` |
| **Async** | 2min | `/api/chat`, `/api/generate` |
| **Long** | 5min | `/api/upload`, batch processing |

**Classificação Automática**: O middleware `timeout-handler.js` classifica rotas baseado no path usando regex.

### External Services

| Serviço | Timeout | Retries | Retry Delay |
|---------|---------|---------|-------------|
| **AWS Bedrock** | 60s | 3 | 1s |
| **DataJud** | 30s | 2 | 2s |
| **JusBrasil** | 20s | 2 | 1s |
| **AWS S3** | 45s | 3 | 500ms |

### Background Jobs

| Job | Timeout | Descrição |
|-----|---------|-----------|
| **Backup** | 10min | OneDrive backup completo |
| **KB Reindex** | 3min | Reindexação da Knowledge Base |
| **Metrics** | 10s | Coleta de métricas Prometheus |

### Database

| Operação | Timeout | Descrição |
|----------|---------|-----------|
| **Query** | 5s | SELECT, INSERT, UPDATE simples |
| **Complex Query** | 15s | JOINs, aggregations, full-text |
| **Transaction** | 10s | Transações ACID |

---

## 🔄 Circuit Breaker

**Configuração Global**:

```javascript
{
  failureThreshold: 5,      // Abre após 5 falhas consecutivas
  cooldownPeriod: 60s,      // Permanece aberto por 1min
  halfOpenTimeout: 30s      // Tenta recuperação por 30s
}
```

**Estados**:
1. **CLOSED** (normal): Requests passam normalmente
2. **OPEN** (falha): Rejeita requests imediatamente (fail-fast)
3. **HALF-OPEN** (teste): Permite alguns requests para testar recuperação

---

## 🚦 Rate Limiting

| Tipo | Window | Max Requests | Aplicação |
|------|--------|--------------|-----------|
| **Por IP** | 1min | 100 req | Proteção DDoS básica |
| **Por API Key** | 1min | 500 req | Usuários autenticados |
| **Endpoints Críticos** | 1min | 20 req | `/api/chat`, `/api/generate` |

---

## 📈 Monitoramento

### Métricas Coletadas

O sistema coleta automaticamente:

1. **http_request_duration_seconds** (histogram)
   - Labels: `method`, `route`, `status`
   - Usado para calcular p95/p99 latency

2. **http_requests_total** (counter)
   - Labels: `method`, `route`, `status`
   - Usado para calcular error rate

3. **slo_violations_total** (counter)
   - Labels: `type` (latency, timeout, error)
   - Conta violações de SLO

### Dashboards

**Grafana Queries**:

```promql
# p95 Latency por rota
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)
)

# Error Rate (últimos 5min)
sum(rate(http_requests_total{status=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))

# SLO Violations (últimas 24h)
sum(increase(slo_violations_total[24h])) by (type)
```

---

## 🔧 Configuração

### Arquivo: `src/config/slo.js`

Todas as configurações de timeout e SLO estão centralizadas neste arquivo.

**Exemplo de uso**:

```javascript
import { getTimeout, createTimeoutSignal } from './config/slo.js';

// Obter timeout
const timeout = getTimeout('external', 'bedrock');  // 60000

// Criar AbortSignal
const signal = createTimeoutSignal('http', 'async');  // 2min
fetch(url, { signal });
```

### Middleware

**Aplicar no servidor**:

```javascript
import timeoutHandler from './middleware/timeout-handler.js';

// Aplicar globalmente
app.use(timeoutHandler.timeout);
app.use(timeoutHandler.abortSignal);
app.use(timeoutHandler.sloMetrics);
```

---

## 🧪 Testes

### Validar Timeouts

```bash
# Testar timeout de rota rápida (5s)
time curl -fsS http://localhost:3000/api/info

# Testar timeout de rota async (120s)
time curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

### Validar Circuit Breaker

```bash
# Forçar 5 falhas consecutivas
for i in {1..5}; do
  curl -fsS http://localhost:3000/api/external/failing-service
done

# Próximo request deve retornar 503 (circuito aberto)
curl -fsS http://localhost:3000/api/external/failing-service
```

---

## 📋 Checklist de Deploy

Antes de deployar mudanças em SLO:

- [ ] Atualizar `src/config/slo.js` com novos valores
- [ ] Rodar testes locais: `npm test`
- [ ] Verificar métricas em staging por 24h
- [ ] Validar p95/p99 latency não degradou
- [ ] Validar error rate ≤ 1%
- [ ] Documentar mudanças neste arquivo
- [ ] Deploy para production

---

## 🔗 Referências

- **Configuração**: `src/config/slo.js`
- **Middleware**: `src/middleware/timeout-handler.js`
- **Testes**: `tests/slo.test.js` (a criar)
- **Métricas**: `/metrics` endpoint

---

**Última atualização**: 2025-12-26
**Responsável**: Dr. Rodolfo Otávio Mota
**Versão**: v2.5.0-beta
