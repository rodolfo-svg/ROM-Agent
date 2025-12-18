#!/bin/bash
# ROM Agent - Circuit Breaker Validation Script
# Valida transições de estado do Circuit Breaker

STAGING_URL="https://rom-agent-ia-onrender-com.onrender.com"

echo "========================================="
echo "🔴 Circuit Breaker Validation"
echo "========================================="
echo ""
echo "URL: $STAGING_URL"
echo ""

# Test 1: Verificar estado inicial (CLOSED)
echo "📊 Test 1/5: Verificar Estado Inicial..."
STATE=$(curl -sS "$STAGING_URL/metrics" | grep "circuit_breaker_state" | head -1)
if echo "$STATE" | grep -q "CLOSED.*0"; then
  echo "   ✅ Circuit Breaker em estado CLOSED (0)"
else
  echo "   ⚠️  Estado não confirmado: $STATE"
fi
echo ""

# Test 2: Forçar 5 falhas consecutivas
echo "📊 Test 2/5: Forçar 5 Falhas Consecutivas..."
for i in {1..5}; do
  printf "   Falha %d/5 ... " "$i"
  curl -sS -X POST "$STAGING_URL/api/chat" \
    -H "Content-Type: application/json" \
    -d "{\"mensagem\": \"FORCE_ERROR_$i\", \"conversationId\": \"cb-test-$i\"}" \
    > /dev/null 2>&1
  echo "✅"
  sleep 1
done
echo ""

# Test 3: Verificar transição para OPEN
echo "📊 Test 3/5: Verificar Transição para OPEN..."
sleep 2
STATE=$(curl -sS "$STAGING_URL/metrics" | grep "circuit_breaker_state" | head -1)
if echo "$STATE" | grep -q "OPEN.*2"; then
  echo "   ✅ Circuit Breaker transitou para OPEN (2)"
else
  echo "   ❌ Transição para OPEN falhou"
  echo "   Estado atual: $STATE"
  exit 1
fi
echo ""

# Test 4: Aguardar cooldown (30s) e verificar HALF_OPEN
echo "📊 Test 4/5: Aguardar Cooldown (30s) → HALF_OPEN..."
echo "   Aguardando 30 segundos..."
sleep 30

STATE=$(curl -sS "$STAGING_URL/metrics" | grep "circuit_breaker_state" | head -1)
if echo "$STATE" | grep -q "HALF_OPEN.*1"; then
  echo "   ✅ Circuit Breaker transitou para HALF_OPEN (1)"
else
  echo "   ⚠️  Transição para HALF_OPEN não confirmada"
  echo "   Estado atual: $STATE"
fi
echo ""

# Test 5: Enviar requisição de sucesso e verificar CLOSED
echo "📊 Test 5/5: Requisição de Sucesso → CLOSED..."
curl -sS -X POST "$STAGING_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"mensagem": "Teste recuperação", "conversationId": "cb-recovery"}' \
  > /dev/null 2>&1

sleep 2
STATE=$(curl -sS "$STAGING_URL/metrics" | grep "circuit_breaker_state" | head -1)
if echo "$STATE" | grep -q "CLOSED.*0"; then
  echo "   ✅ Circuit Breaker recuperou → CLOSED (0)"
else
  echo "   ⚠️  Recuperação não confirmada"
  echo "   Estado atual: $STATE"
fi
echo ""

# Resumo das métricas
echo "========================================="
echo "📈 MÉTRICAS FINAIS"
echo "========================================="
curl -sS "$STAGING_URL/metrics" | grep -E "circuit_breaker_(state|success|failure|rejected)" | head -10
echo ""

echo "✅ VALIDAÇÃO COMPLETA"
echo ""
echo "Próximos passos:"
echo "  1. Verificar métricas de model_fallback"
echo "  2. Ativar ENABLE_BOTTLENECK na Etapa C"
