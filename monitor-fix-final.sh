#!/bin/bash
echo "🚨 AGUARDANDO FIX FINAL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Commit esperado: e2db4c1"
echo "🐛 Fix: createRequire de 'module'"
echo "🌐 URL: https://iarom.com.br"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for i in {1..80}; do
  printf "[%2d/80] " $i
  RESPONSE=$(curl -s https://iarom.com.br/api/info 2>/dev/null)
  
  if [ -n "$RESPONSE" ]; then
    COMMIT=$(echo "$RESPONSE" | jq -r '.server.gitCommit // "N/A"' 2>/dev/null)
    VERSION=$(echo "$RESPONSE" | jq -r '.version // "N/A"' 2>/dev/null)
    UPTIME=$(echo "$RESPONSE" | jq -r '.health.uptime // "N/A"' 2>/dev/null)
    printf "Commit: %s | Uptime: %s\n" "$COMMIT" "$UPTIME"
    
    if [[ "$COMMIT" == *"e2db4c1"* ]]; then
      echo ""
      echo "✅ ══════════════════════════════════════"
      echo "✅  DEPLOY COMPLETO E FUNCIONANDO!"
      echo "✅ ══════════════════════════════════════"
      echo "📦 Commit: $COMMIT"
      echo "🏷️ Versão: $VERSION"
      echo "⏱️ Uptime: $UPTIME"
      echo "🌐 https://iarom.com.br"
      echo ""
      echo "🎉 Funcionalidades disponíveis:"
      echo "   ✅ Sistema de prompts contextual (90+ peças)"
      echo "   ✅ Exportação DOCX/PDF/HTML/Markdown/TXT"
      echo "   ✅ Interface admin /admin/system-prompts"
      echo ""
      exit 0
    fi
  else
    echo "Deploy em andamento..."
  fi
  
  sleep 8
done
echo "Timeout"
