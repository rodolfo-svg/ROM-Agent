#!/bin/bash
# ==============================================================================
# CONTINUOUS MONITORING
# Monitora logs em tempo real e alerta sobre problemas
# ==============================================================================

SERVICE_ID="srv-d51ppfmuk2gs73a1qlkg"
ALERT_FILE="/tmp/rom-agent-alerts.log"

echo "📡 MONITOR CONTÍNUO ATIVADO"
echo "================================"
echo "Service: $SERVICE_ID"
echo "Alerts: $ALERT_FILE"
echo ""
echo "Monitorando logs em tempo real..."
echo "Pressione Ctrl+C para parar"
echo ""

# Limpar arquivo de alertas
> "$ALERT_FILE"

# Monitor de logs
render logs --tail -r "$SERVICE_ID" 2>&1 | while IFS= read -r line; do
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")

    # Detectar problemas críticos
    if echo "$line" | grep -qiE "(error|failed|crash|exception|undefined documentos)"; then
        echo "[$timestamp] 🔴 ALERTA: $line"
        echo "[$timestamp] $line" >> "$ALERT_FILE"

    # Detectar warnings
    elif echo "$line" | grep -qiE "(warning|warn)"; then
        echo "[$timestamp] ⚠️  WARNING: $line"

    # Logs de KB importantes
    elif echo "$line" | grep -qiE "(kb cache|kb|upload|extract)"; then
        echo "[$timestamp] 📚 KB: $line"

    # Logs de chat importantes
    elif echo "$line" | grep -qiE "(chat|stream|consultar)"; then
        echo "[$timestamp] 💬 CHAT: $line"

    # Debug logs
    elif echo "$line" | grep -qiE "(debug|🔍)"; then
        echo "[$timestamp] 🐛 DEBUG: $line"
    fi
done
