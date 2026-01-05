#!/bin/bash

# ROM-Agent - Monitor Deploy Script
# Verifica quando o deploy manual do Render completar

echo "🔍 Monitorando deploy do Render..."
echo "Commit esperado: bd606d1d"
echo "Staging URL: https://staging.iarom.com.br"
echo ""

TARGET_COMMIT="bd606d1d"
MAX_CHECKS=20
CHECK_INTERVAL=30

for i in $(seq 1 $MAX_CHECKS); do
  echo "[$i/$MAX_CHECKS] Verificando status... ($(date +%H:%M:%S))"
  
  # Get current commit
  RESPONSE=$(curl -s https://staging.iarom.com.br/api/info 2>/dev/null)
  
  if [ -z "$RESPONSE" ]; then
    echo "⏳ Servidor indisponível (provavelmente deploy em andamento)..."
  else
    CURRENT_COMMIT=$(echo "$RESPONSE" | jq -r '.server.gitCommit // .gitCommit' 2>/dev/null)
    UPTIME=$(echo "$RESPONSE" | jq -r '.health.uptime' 2>/dev/null)
    
    echo "   Commit atual: $CURRENT_COMMIT"
    echo "   Uptime: $UPTIME"
    
    # Check if deploy completed
    if [[ "$CURRENT_COMMIT" == "$TARGET_COMMIT"* ]]; then
      echo ""
      echo "✅ DEPLOY COMPLETADO COM SUCESSO!"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo ""
      echo "🧪 Executando testes de validação..."
      echo ""
      
      # Test previously failing endpoints
      echo "1. Testing /api/deploy/status..."
      curl -s https://staging.iarom.com.br/api/deploy/status | jq '.' || echo "❌ Failed"
      
      echo ""
      echo "2. Testing /api/jurisprudencia/tribunais..."
      curl -s https://staging.iarom.com.br/api/jurisprudencia/tribunais | jq '.success, .total' || echo "❌ Failed"
      
      echo ""
      echo "3. Testing /api/documents/supported-types..."
      curl -s https://staging.iarom.com.br/api/documents/supported-types | jq '.success' || echo "❌ Failed"
      
      echo ""
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "📊 Executando test suite completo..."
      echo ""
      
      cd "$(dirname "$0")"
      if [ -f "test-complete-system.js" ]; then
        node test-complete-system.js
      else
        echo "⚠️  test-complete-system.js não encontrado"
      fi
      
      exit 0
    fi
  fi
  
  if [ $i -lt $MAX_CHECKS ]; then
    echo "   Aguardando ${CHECK_INTERVAL}s para próxima verificação..."
    echo ""
    sleep $CHECK_INTERVAL
  fi
done

echo ""
echo "⏱️  Timeout atingido após $((MAX_CHECKS * CHECK_INTERVAL / 60)) minutos"
echo "Deploy pode ainda estar em andamento. Verifique manualmente:"
echo "https://dashboard.render.com"
