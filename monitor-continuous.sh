#!/bin/bash

# Monitor Contínuo ROM Agent
# Data: 07/04/2026
# Mantém monitoramento 24/7 em background

SERVICE_ID="srv-d51ppfmuk2gs73a1qlkg"
LOG_DIR="/Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/logs/monitor"
DATE_FORMAT=$(date '+%Y-%m-%d')

# Criar diretório de logs se não existir
mkdir -p "$LOG_DIR"

# Arquivo de status
STATUS_FILE="$LOG_DIR/monitor-status.txt"
PID_FILE="$LOG_DIR/monitor.pid"

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         MONITOR CONTÍNUO ROM AGENT - INICIANDO            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📊 Service ID:${NC} $SERVICE_ID"
echo -e "${GREEN}📁 Log Directory:${NC} $LOG_DIR"
echo -e "${GREEN}📅 Data:${NC} $(date)"
echo ""

# Função para escrever status
write_status() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$STATUS_FILE"
    echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} $1"
}

# Salvar PID
echo $$ > "$PID_FILE"
write_status "Monitor iniciado com PID $$"

# Função de cleanup ao sair
cleanup() {
    write_status "Monitor sendo encerrado..."
    rm -f "$PID_FILE"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Contador de iterações
iteration=0

write_status "✅ Monitor ativo - Ctrl+C para parar"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Loop infinito de monitoramento
while true; do
    iteration=$((iteration + 1))

    # Arquivos de log com timestamp
    TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
    REQUEST_LOG="$LOG_DIR/requests-${DATE_FORMAT}.log"
    APP_LOG="$LOG_DIR/application-${DATE_FORMAT}.log"
    ERROR_LOG="$LOG_DIR/errors-${DATE_FORMAT}.log"
    SUMMARY_LOG="$LOG_DIR/summary-${DATE_FORMAT}.log"

    echo -e "${BLUE}[Iteração #$iteration - $(date '+%H:%M:%S')]${NC}"

    # 1. Capturar requests HTTP (últimos 100)
    echo -e "  ${YELLOW}→${NC} Capturando HTTP requests..."
    render logs -r "$SERVICE_ID" --type request --limit 100 --output text >> "$REQUEST_LOG" 2>&1

    # 2. Capturar logs de aplicação (últimos 50)
    echo -e "  ${YELLOW}→${NC} Capturando application logs..."
    render logs -r "$SERVICE_ID" --type app --limit 50 --output text >> "$APP_LOG" 2>&1

    # 3. Capturar apenas erros
    echo -e "  ${YELLOW}→${NC} Verificando erros..."
    render logs -r "$SERVICE_ID" --level error --limit 20 --output text >> "$ERROR_LOG" 2>&1

    # 4. Gerar resumo
    {
        echo "=== RESUMO - $(date) ==="
        echo ""
        echo "📊 HTTP Requests:"
        tail -100 "$REQUEST_LOG" 2>/dev/null | grep -c "clientIP" || echo "0"
        echo ""
        echo "🔴 Erros encontrados:"
        tail -20 "$ERROR_LOG" 2>/dev/null | grep -c "ERROR" || echo "0"
        echo ""
        echo "📈 Últimas atividades:"
        tail -5 "$APP_LOG" 2>/dev/null || echo "Nenhuma"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
    } >> "$SUMMARY_LOG"

    # Mostrar resumo rápido
    echo -e "  ${GREEN}✓${NC} Logs salvos em: $LOG_DIR/"

    # Verificar se há erros novos
    ERROR_COUNT=$(tail -20 "$ERROR_LOG" 2>/dev/null | grep -c "ERROR" || echo "0")
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo -e "  ${RED}⚠ $ERROR_COUNT erros detectados!${NC}"
        write_status "⚠️ ALERTA: $ERROR_COUNT erros detectados"
    else
        echo -e "  ${GREEN}✓ Nenhum erro detectado${NC}"
    fi

    # Estatísticas rápidas
    REQUEST_COUNT=$(tail -100 "$REQUEST_LOG" 2>/dev/null | grep -c "clientIP" || echo "0")
    echo -e "  ${BLUE}ℹ $REQUEST_COUNT requests HTTP nos últimos minutos${NC}"

    echo ""

    # Aguardar antes da próxima iteração (30 segundos)
    write_status "Próxima verificação em 30 segundos..."
    sleep 30

    # A cada 10 iterações, fazer limpeza de logs antigos (manter últimos 7 dias)
    if [ $((iteration % 10)) -eq 0 ]; then
        echo -e "${YELLOW}🧹 Limpando logs antigos (>7 dias)...${NC}"
        find "$LOG_DIR" -name "*.log" -mtime +7 -delete
        write_status "Limpeza de logs antigos executada"
    fi

done
