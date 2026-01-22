#!/bin/bash

# Monitor Deploy - ROM Agent
# Verifica quando o deploy do commit 775c492 completar

echo "🔍 Monitorando deploy do Render..."
echo "Commit esperado: 775c492"
echo "Commit atual em produção: 83665617"
echo "URL: https://staging.iarom.com.br"
echo ""

TARGET_COMMIT="775c492"
MAX_CHECKS=40  # 40 checks x 15s = 10 minutos
CHECK_INTERVAL=15

for i in $(seq 1 $MAX_CHECKS); do
  echo "[$i/$MAX_CHECKS] Verificando status... ($(date +%H:%M:%S))"

  # Get current commit
  RESPONSE=$(curl -s https://staging.iarom.com.br/api/info 2>/dev/null)

  if [ -z "$RESPONSE" ]; then
    echo "   ⏳ Servidor indisponível (deploy em andamento)..."
  else
    CURRENT_COMMIT=$(echo "$RESPONSE" | jq -r '.server.gitCommit // .gitCommit // empty' 2>/dev/null)
    VERSION=$(echo "$RESPONSE" | jq -r '.version // empty' 2>/dev/null)
    UPTIME=$(echo "$RESPONSE" | jq -r '.health.uptime // empty' 2>/dev/null)

    if [ -n "$CURRENT_COMMIT" ]; then
      echo "   📍 Commit: $CURRENT_COMMIT"
      echo "   🏷️  Versão: $VERSION"
      echo "   ⏱️  Uptime: $UPTIME"

      # Check if deploy completed
      if [[ "$CURRENT_COMMIT" == *"$TARGET_COMMIT"* ]]; then
        echo ""
        echo "✅ =========================================="
        echo "✅  DEPLOY CONCLUÍDO COM SUCESSO!"
        echo "✅ =========================================="
        echo ""
        echo "📦 Commit: $CURRENT_COMMIT"
        echo "🏷️  Versão: $VERSION"
        echo "⏱️  Uptime: $UPTIME"
        echo "🌐 URL: https://staging.iarom.com.br"
        echo ""
        echo "🎯 Funcionalidades Disponíveis:"
        echo "   ✅ Sistema de prompts contextual"
        echo "   ✅ Exportação DOCX/PDF/HTML/Markdown/TXT"
        echo "   ✅ Interface admin em /admin/system-prompts"
        echo ""
        exit 0
      fi
    else
      echo "   ⚠️  Não foi possível obter commit (response vazia)"
    fi
  fi

  echo ""
  sleep $CHECK_INTERVAL
done

echo ""
echo "⏰ Timeout - Deploy ainda não completou após $(($MAX_CHECKS * $CHECK_INTERVAL / 60)) minutos"
echo "   Verifique manualmente: https://staging.iarom.com.br/api/info"
echo ""
exit 1
