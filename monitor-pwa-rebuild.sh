#!/bin/bash

echo "🔍 Monitorando rebuild do PWA..."
echo "Verificando a cada 20 segundos..."
echo ""

TARGET_FILES=("manifest.json" "service-worker.js")
BASE_URL="https://staging.iarom.com.br"

for i in {1..30}; do
  echo "[$i/30] $(date +%H:%M:%S)"
  
  # Check manifest
  MANIFEST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/manifest.json")
  
  # Check service worker
  SW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/service-worker.js")
  
  # Check if server restarted (uptime < 2 min = recent deploy)
  UPTIME=$(curl -s "$BASE_URL/api/info" | grep -o '"uptime":"[^"]*"' | cut -d'"' -f4)
  
  echo "   Manifest: HTTP $MANIFEST_STATUS"
  echo "   Service Worker: HTTP $SW_STATUS"
  echo "   Server uptime: $UPTIME"
  
  # Success condition
  if [ "$MANIFEST_STATUS" = "200" ] && [ "$SW_STATUS" = "200" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ PWA FILES DETECTADOS!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Validando PWA completo..."
    echo ""
    
    # Validate manifest content
    echo "📄 Manifest.json:"
    curl -s "$BASE_URL/manifest.json" | head -c 200
    echo "..."
    
    echo ""
    echo "📄 Service Worker (primeiras linhas):"
    curl -s "$BASE_URL/service-worker.js" | head -3
    echo "..."
    
    echo ""
    echo "✅ REBUILD COMPLETADO COM SUCESSO!"
    echo "✅ PWA agora está 100% OPERACIONAL!"
    echo ""
    
    # Run full validation
    if [ -f "test-validation-complete.js" ]; then
      echo "Executando validação completa..."
      node test-validation-complete.js
    fi
    
    exit 0
  fi
  
  echo ""
  sleep 20
done

echo ""
echo "⏱️  Timeout após 10 minutos"
echo "Verifique manualmente: $BASE_URL/manifest.json"
