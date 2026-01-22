#!/bin/bash

# Monitor Deploy - ROM Agent PRODUÇÃO
# URL: https://iarom.com.br

echo "🔍 Monitorando deploy em PRODUÇÃO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 URL: https://iarom.com.br"
echo "🎯 Commit esperado: 775c492"
echo "📦 Funcionalidades:"
echo "   • Sistema de prompts contextual (90+ peças)"
echo "   • Exportação DOCX/PDF/HTML/Markdown/TXT"
echo "   • Interface admin /admin/system-prompts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TARGET_COMMIT="775c492"
MAX_CHECKS=40
CHECK_INTERVAL=15
URL="https://iarom.com.br"

for i in $(seq 1 $MAX_CHECKS); do
  ELAPSED=$((i * CHECK_INTERVAL))
  MIN=$((ELAPSED / 60))
  SEC=$((ELAPSED % 60))

  printf "[%2d/%d] %02d:%02d - " $i $MAX_CHECKS $MIN $SEC

  # Check server
  RESPONSE=$(curl -s "${URL}/api/info" 2>/dev/null)

  if [ -z "$RESPONSE" ]; then
    echo "⏳ Deploy em andamento (servidor reiniciando)..."
  else
    COMMIT=$(echo "$RESPONSE" | jq -r '.server.gitCommit // .gitCommit // "N/A"' 2>/dev/null)
    VERSION=$(echo "$RESPONSE" | jq -r '.version // "N/A"' 2>/dev/null)
    UPTIME=$(echo "$RESPONSE" | jq -r '.health.uptime // "N/A"' 2>/dev/null)

    printf "Commit: %-10s | Versão: %-8s | Uptime: %s\n" "$COMMIT" "$VERSION" "$UPTIME"

    # Check if target commit deployed
    if [[ "$COMMIT" == *"$TARGET_COMMIT"* ]]; then
      echo ""
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "✅ DEPLOY CONCLUÍDO COM SUCESSO!"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "📦 Commit: $COMMIT"
      echo "🏷️  Versão: $VERSION"
      echo "⏱️  Uptime: $UPTIME"
      echo "🌐 URL: $URL"
      echo ""
      echo "🎯 Testar:"
      echo "   → ${URL}/admin/system-prompts"
      echo "   → Criar artifact e baixar como DOCX"
      echo ""
      exit 0
    fi
  fi

  sleep $CHECK_INTERVAL
done

echo ""
echo "⏰ Timeout após $((MAX_CHECKS * CHECK_INTERVAL / 60)) minutos"
echo "   Verifique: ${URL}/api/info"
exit 1
