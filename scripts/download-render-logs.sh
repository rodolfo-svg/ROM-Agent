#!/bin/bash
# Script para baixar logs do Render e filtrar por período específico

echo "════════════════════════════════════════════════════════════"
echo "RENDER LOG DOWNLOADER - Filtrar logs de build"
echo "════════════════════════════════════════════════════════════"
echo ""

# Configurações
SERVICE_ID="srv-d5aqg0hr0fns73dmiis0"  # rom-agent service ID
START_TIME="2026-02-06T01:39:00Z"
END_TIME="2026-02-06T01:43:00Z"
OUTPUT_FILE="render-build-logs-$(date +%Y%m%d-%H%M%S).txt"

# Verificar se tem RENDER_API_KEY
if [ -z "$RENDER_API_KEY" ]; then
  echo "❌ RENDER_API_KEY não encontrada!"
  echo ""
  echo "Para usar este script:"
  echo "1. Vá para: https://dashboard.render.com/account/settings"
  echo "2. Clique em 'API Keys' → 'Create API Key'"
  echo "3. Copie a key e execute:"
  echo "   export RENDER_API_KEY='sua-key-aqui'"
  echo ""
  echo "OU copie manualmente os logs do Dashboard:"
  echo "1. Render Dashboard → rom-agent → Logs"
  echo "2. Filtre: 01:39:00 até 01:43:00"
  echo "3. Copie e cole em um arquivo"
  echo ""
  exit 1
fi

echo "📡 Baixando logs do Render..."
echo "   Service: $SERVICE_ID"
echo "   Período: $START_TIME → $END_TIME"
echo ""

# Baixar logs via API do Render
curl -s \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$SERVICE_ID/logs?startTime=$START_TIME&endTime=$END_TIME&limit=10000" \
  > "$OUTPUT_FILE"

# Verificar se download teve sucesso
if [ $? -eq 0 ] && [ -s "$OUTPUT_FILE" ]; then
  echo "✅ Logs baixados com sucesso!"
  echo "   Arquivo: $OUTPUT_FILE"
  echo ""

  # Filtrar linhas importantes
  echo "🔍 Filtrando informações relevantes..."

  FILTERED_FILE="render-build-filtered-$(date +%Y%m%d-%H%M%S).txt"

  grep -E "(BUILD|build|qpdf|ERROR|error|failed|Failed|success|Success|npm run build|Instalando|Download|Extract)" \
    "$OUTPUT_FILE" > "$FILTERED_FILE"

  if [ -s "$FILTERED_FILE" ]; then
    echo "✅ Logs filtrados salvos em: $FILTERED_FILE"
    echo ""
    echo "📊 Resumo:"
    echo "   Total de linhas: $(wc -l < "$OUTPUT_FILE")"
    echo "   Linhas filtradas: $(wc -l < "$FILTERED_FILE")"
    echo ""

    # Mostrar preview das linhas importantes
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "PREVIEW - Primeiras 30 linhas filtradas:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    head -30 "$FILTERED_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Para ver o arquivo completo:"
    echo "   cat $FILTERED_FILE"
    echo "   less $FILTERED_FILE"
  else
    echo "⚠️  Nenhuma linha relevante encontrada nos logs"
  fi
else
  echo "❌ Falha ao baixar logs"
  echo "   Verifique se RENDER_API_KEY está correta"
  echo "   Verifique se SERVICE_ID está correto"
  rm -f "$OUTPUT_FILE"
  exit 1
fi
