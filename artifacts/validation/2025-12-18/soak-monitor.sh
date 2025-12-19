#!/bin/bash
# Soak Test Monitor - Coleta métricas a cada 10 minutos

STAGING_URL="https://rom-agent-ia-onrender-com.onrender.com"
DURATION_MIN=90
INTERVAL_SEC=600  # 10 minutos
ITERATIONS=$((DURATION_MIN * 60 / INTERVAL_SEC))

echo "🔍 Soak Test Monitor - Duração: ${DURATION_MIN}min"
echo "Coletando métricas a cada $((INTERVAL_SEC / 60))min"
echo ""

for i in $(seq 1 $ITERATIONS); do
  ELAPSED=$((i * INTERVAL_SEC / 60))
  echo "========================================="
  echo "⏱️  T+${ELAPSED}min (Iteração $i/$ITERATIONS)"
  echo "========================================="
  
  # Coletar métricas críticas
  echo ""
  echo "📊 Circuit Breaker:"
  curl -sS "$STAGING_URL/metrics" 2>&1 | grep -E "circuit_breaker_(state|events_total)" | grep -v "^#"
  
  echo ""
  echo "📊 Bottleneck:"
  curl -sS "$STAGING_URL/metrics" 2>&1 | grep -E "bottleneck_(rejected_total|inflight|queue_size)" | grep -v "^#"
  
  echo ""
  echo "📊 Latência (p95/p99):"
  curl -sS "$STAGING_URL/metrics" 2>&1 | grep -E 'http_request_duration_seconds.*path="/api/chat"' | grep -E 'le="(5|10)"' | grep -v "^#"
  
  echo ""
  echo "📊 Total de requisições:"
  curl -sS "$STAGING_URL/metrics" 2>&1 | grep -E 'http_request_duration_seconds_count.*path="/api/chat"' | grep -v "^#"
  
  echo ""
  
  if [ $i -lt $ITERATIONS ]; then
    echo "Próxima coleta em $((INTERVAL_SEC / 60))min..."
    sleep $INTERVAL_SEC
  fi
done

echo ""
echo "========================================="
echo "✅ SOAK TEST CONCLUÍDO - ${DURATION_MIN}min"
echo "========================================="
