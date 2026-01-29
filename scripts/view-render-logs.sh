#!/bin/bash

# ══════════════════════════════════════════════════════════════
# ROM Agent - Visualizar Logs do Render
# ══════════════════════════════════════════════════════════════

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

APP_URL="https://iarom.com.br"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  ROM AGENT - LOGS EM TEMPO REAL${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# 1. System Info
echo -e "${CYAN}[1] Informações do Sistema${NC}"
echo "─────────────────────────────────────────────────────────────"
INFO=$(curl -s "$APP_URL/api/info" 2>/dev/null)

if [ -n "$INFO" ]; then
    echo "$INFO" | jq '{
        nome: .nome,
        versao: .versao,
        commit: .server.gitCommit,
        status: .health.status,
        uptime: .health.uptime,
        bedrock: .bedrock.status,
        memory: {
            heapUsed: .memory.heapUsed,
            heapTotal: .memory.heapTotal
        }
    }'
else
    echo -e "${YELLOW}⚠ Não foi possível obter informações do sistema${NC}"
fi
echo ""

# 2. Feature Flags Status (se disponível em metrics)
echo -e "${CYAN}[2] Feature Flags Status${NC}"
echo "─────────────────────────────────────────────────────────────"
echo -e "${YELLOW}Para ver feature flags carregadas:${NC}"
echo "  1. Acesse: https://dashboard.render.com"
echo "  2. Services → rom-agent → Logs"
echo "  3. Procure por: [FeatureFlags] Loaded:"
echo ""

# 3. Métricas Prometheus
echo -e "${CYAN}[3] Métricas Recentes${NC}"
echo "─────────────────────────────────────────────────────────────"
METRICS=$(curl -s "$APP_URL/metrics" 2>/dev/null)

if [ -n "$METRICS" ]; then
    echo "HTTP Requests:"
    echo "$METRICS" | grep "http_requests_total" | head -5
    echo ""
    
    echo "Bedrock Requests:"
    echo "$METRICS" | grep "bedrock_requests_total" | head -3
    echo ""
    
    echo "Circuit Breaker:"
    echo "$METRICS" | grep "circuit_breaker" | head -3
    echo ""
    
    echo "Cache:"
    echo "$METRICS" | grep -E "cache_hit|cache_miss" | head -3 || echo "  (Cache metrics não encontradas - feature não ativada)"
else
    echo -e "${YELLOW}⚠ Métricas não disponíveis${NC}"
fi
echo ""

# 4. Como acessar logs completos
echo -e "${CYAN}[4] Logs Completos (Render Dashboard)${NC}"
echo "─────────────────────────────────────────────────────────────"
echo -e "${GREEN}Para ver logs em tempo real:${NC}"
echo ""
echo "  1. Acesse: ${CYAN}https://dashboard.render.com${NC}"
echo "  2. Navegue: Services → ${YELLOW}rom-agent${NC} → Logs"
echo "  3. Logs aparecem em tempo real"
echo ""
echo -e "${GREEN}Filtros úteis:${NC}"
echo "  • Procurar por 'ERROR' - Ver erros"
echo "  • Procurar por 'WARN' - Ver avisos"
echo "  • Procurar por '[FeatureFlags]' - Ver flags carregadas"
echo "  • Procurar por '[CACHE]' - Ver operações de cache"
echo "  • Procurar por '[ProxyPool]' - Ver rotação de proxies"
echo "  • Procurar por '[Retry]' - Ver tentativas de retry"
echo ""

# 5. Healthcheck
echo -e "${CYAN}[5] Status Atual${NC}"
echo "─────────────────────────────────────────────────────────────"

HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/api/info")
if [ "$HEALTH" = "200" ]; then
    echo -e "${GREEN}✓ Sistema está HEALTHY (HTTP 200)${NC}"
else
    echo -e "${YELLOW}⚠ Sistema retornou HTTP $HEALTH${NC}"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Para logs detalhados:${NC} Acesse https://dashboard.render.com"
echo -e "${CYAN}Para métricas completas:${NC} curl https://iarom.com.br/metrics"
echo ""
