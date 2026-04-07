#!/bin/bash

# Script de Controle do Monitor Contínuo
# Comandos: start, stop, status, logs, tail

MONITOR_SCRIPT="/Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/monitor-continuous.sh"
LOG_DIR="/Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/logs/monitor"
PID_FILE="$LOG_DIR/monitor.pid"
STATUS_FILE="$LOG_DIR/monitor-status.txt"

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cmd_start() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo -e "${YELLOW}⚠ Monitor já está rodando (PID: $PID)${NC}"
            return 1
        else
            echo -e "${YELLOW}⚠ PID file existe mas processo não está rodando. Limpando...${NC}"
            rm -f "$PID_FILE"
        fi
    fi

    echo -e "${BLUE}🚀 Iniciando monitor contínuo...${NC}"
    mkdir -p "$LOG_DIR"

    # Iniciar em background com nohup
    nohup "$MONITOR_SCRIPT" > "$LOG_DIR/monitor-output.log" 2>&1 &

    sleep 2

    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        echo -e "${GREEN}✅ Monitor iniciado com sucesso!${NC}"
        echo -e "   PID: $PID"
        echo -e "   Logs: $LOG_DIR/"
        echo ""
        echo -e "${BLUE}Comandos úteis:${NC}"
        echo -e "  ./monitor-control.sh status    - Ver status"
        echo -e "  ./monitor-control.sh logs      - Ver últimos logs"
        echo -e "  ./monitor-control.sh tail      - Acompanhar em tempo real"
        echo -e "  ./monitor-control.sh stop      - Parar monitor"
    else
        echo -e "${RED}❌ Erro ao iniciar monitor${NC}"
        return 1
    fi
}

cmd_stop() {
    if [ ! -f "$PID_FILE" ]; then
        echo -e "${YELLOW}⚠ Monitor não está rodando${NC}"
        return 1
    fi

    PID=$(cat "$PID_FILE")

    if ps -p "$PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}🛑 Parando monitor (PID: $PID)...${NC}"
        kill "$PID"
        sleep 2

        if ps -p "$PID" > /dev/null 2>&1; then
            echo -e "${RED}⚠ Processo não respondeu, forçando...${NC}"
            kill -9 "$PID"
        fi

        rm -f "$PID_FILE"
        echo -e "${GREEN}✅ Monitor parado${NC}"
    else
        echo -e "${YELLOW}⚠ Processo não encontrado, limpando PID file${NC}"
        rm -f "$PID_FILE"
    fi
}

cmd_status() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║              STATUS DO MONITOR CONTÍNUO                    ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Status: RODANDO${NC}"
            echo -e "   PID: $PID"

            # Tempo rodando
            START_TIME=$(ps -p "$PID" -o lstart=)
            echo -e "   Iniciado: $START_TIME"

            # Uso de CPU/Memoria
            CPU=$(ps -p "$PID" -o %cpu= | xargs)
            MEM=$(ps -p "$PID" -o %mem= | xargs)
            echo -e "   CPU: ${CPU}%"
            echo -e "   Memória: ${MEM}%"
        else
            echo -e "${RED}❌ Status: PARADO${NC}"
            echo -e "   (PID file existe mas processo não está rodando)"
        fi
    else
        echo -e "${RED}❌ Status: PARADO${NC}"
    fi

    echo ""
    echo -e "${BLUE}📊 Estatísticas de Logs:${NC}"

    if [ -d "$LOG_DIR" ]; then
        TOTAL_LOGS=$(find "$LOG_DIR" -name "*.log" | wc -l | xargs)
        DISK_USAGE=$(du -sh "$LOG_DIR" | cut -f1)
        echo -e "   Arquivos de log: $TOTAL_LOGS"
        echo -e "   Espaço usado: $DISK_USAGE"

        # Última atividade
        if [ -f "$STATUS_FILE" ]; then
            echo ""
            echo -e "${BLUE}📝 Últimas atividades:${NC}"
            tail -5 "$STATUS_FILE" | sed 's/^/   /'
        fi
    else
        echo -e "   ${YELLOW}Diretório de logs não encontrado${NC}"
    fi

    echo ""
}

cmd_logs() {
    echo -e "${BLUE}📋 Últimos logs do monitor:${NC}"
    echo ""

    if [ -f "$LOG_DIR/monitor-output.log" ]; then
        tail -50 "$LOG_DIR/monitor-output.log"
    else
        echo -e "${YELLOW}⚠ Arquivo de log não encontrado${NC}"
    fi
}

cmd_tail() {
    echo -e "${BLUE}📡 Acompanhando logs em tempo real (Ctrl+C para sair)${NC}"
    echo ""

    if [ -f "$LOG_DIR/monitor-output.log" ]; then
        tail -f "$LOG_DIR/monitor-output.log"
    else
        echo -e "${YELLOW}⚠ Arquivo de log não encontrado${NC}"
    fi
}

cmd_summary() {
    DATE=$(date '+%Y-%m-%d')
    SUMMARY_FILE="$LOG_DIR/summary-${DATE}.log"

    echo -e "${BLUE}📊 Resumo do dia ($DATE):${NC}"
    echo ""

    if [ -f "$SUMMARY_FILE" ]; then
        cat "$SUMMARY_FILE"
    else
        echo -e "${YELLOW}⚠ Resumo do dia não encontrado${NC}"
    fi
}

cmd_errors() {
    DATE=$(date '+%Y-%m-%d')
    ERROR_FILE="$LOG_DIR/errors-${DATE}.log"

    echo -e "${RED}🔴 Erros do dia ($DATE):${NC}"
    echo ""

    if [ -f "$ERROR_FILE" ]; then
        if [ -s "$ERROR_FILE" ]; then
            tail -50 "$ERROR_FILE"
        else
            echo -e "${GREEN}✅ Nenhum erro registrado hoje!${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ Arquivo de erros não encontrado${NC}"
    fi
}

# Menu
case "$1" in
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_stop
        sleep 2
        cmd_start
        ;;
    status)
        cmd_status
        ;;
    logs)
        cmd_logs
        ;;
    tail)
        cmd_tail
        ;;
    summary)
        cmd_summary
        ;;
    errors)
        cmd_errors
        ;;
    *)
        echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${BLUE}║          CONTROLE DO MONITOR CONTÍNUO - ROM AGENT         ║${NC}"
        echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "${GREEN}Uso:${NC} $0 <comando>"
        echo ""
        echo -e "${YELLOW}Comandos disponíveis:${NC}"
        echo ""
        echo -e "  ${GREEN}start${NC}      - Iniciar monitoramento contínuo"
        echo -e "  ${RED}stop${NC}       - Parar monitoramento"
        echo -e "  ${YELLOW}restart${NC}    - Reiniciar monitor"
        echo -e "  ${BLUE}status${NC}     - Ver status e estatísticas"
        echo -e "  ${BLUE}logs${NC}       - Ver últimos logs do monitor"
        echo -e "  ${BLUE}tail${NC}       - Acompanhar logs em tempo real"
        echo -e "  ${BLUE}summary${NC}    - Ver resumo do dia"
        echo -e "  ${RED}errors${NC}     - Ver erros do dia"
        echo ""
        echo -e "${BLUE}Exemplos:${NC}"
        echo -e "  $0 start       # Inicia o monitor"
        echo -e "  $0 status      # Verifica se está rodando"
        echo -e "  $0 tail        # Acompanha em tempo real"
        echo -e "  $0 stop        # Para o monitor"
        echo ""
        ;;
esac
