#!/bin/bash
echo "🚨 AGUARDANDO FIX CRÍTICO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Commit esperado: 28f8a42"
echo "🐛 Fix: ERR_AMBIGUOUS_MODULE_SYNTAX"
echo "🌐 URL: https://iarom.com.br"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for i in {1..60}; do
  printf "[%2d/60] " $i
  RESPONSE=$(curl -s https://iarom.com.br/api/info 2>/dev/null)
  
  if [ -n "$RESPONSE" ]; then
    COMMIT=$(echo "$RESPONSE" | jq -r '.server.gitCommit // "N/A"' 2>/dev/null)
    VERSION=$(echo "$RESPONSE" | jq -r '.version // "N/A"' 2>/dev/null)
    printf "Commit: %s | Versão: %s\n" "$COMMIT" "$VERSION"
    
    if [[ "$COMMIT" == *"28f8a42"* ]]; then
      echo ""
      echo "✅ ══════════════════════════════════════"
      echo "✅  FIX APLICADO COM SUCESSO!"
      echo "✅ ══════════════════════════════════════"
      echo "📦 Commit: $COMMIT"
      echo "🏷️ Versão: $VERSION"
      echo "🌐 https://iarom.com.br"
      exit 0
    fi
  else
    echo "Deploy em andamento..."
  fi
  
  sleep 10
done
echo "Timeout"
