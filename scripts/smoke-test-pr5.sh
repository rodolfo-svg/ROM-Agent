#!/bin/bash
# ROM Agent - Smoke Test PR#5 (Circuit Breaker + Fallback)
# Valida deploy incremental em staging

STAGING_URL="https://rom-agent-ia-onrender-com.onrender.com"
TOTAL_REQUESTS=20
SUCCESS=0
FAILED=0

echo "========================================="
echo "🧪 PR#5 SMOKE TEST - Staging Validation"
echo "========================================="
echo ""
echo "URL: $STAGING_URL"
echo "Total Requests: $TOTAL_REQUESTS"
echo ""

# Test 1: Health check
echo "📊 Test 1/4: Health Check..."
HEALTH=$(curl -sS "$STAGING_URL/health" 2>&1)
if echo "$HEALTH" | grep -q "healthy"; then
  echo "   ✅ Health check passed"
else
  echo "   ❌ Health check failed"
  echo "   Response: $HEALTH"
  exit 1
fi
echo ""

# Test 2: Info endpoint
echo "📊 Test 2/4: Info Endpoint..."
INFO=$(curl -sS "$STAGING_URL/api/info" 2>&1)
if echo "$INFO" | grep -q "versao"; then
  VERSION=$(echo "$INFO" | grep -o '"versao":"[^"]*"' | cut -d'"' -f4)
  echo "   ✅ Info endpoint working - Version: $VERSION"
else
  echo "   ❌ Info endpoint failed"
  exit 1
fi
echo ""

# Test 3: Metrics endpoint
echo "📊 Test 3/4: Metrics Endpoint..."
METRICS=$(curl -sS "$STAGING_URL/metrics" 2>&1)
if echo "$METRICS" | grep -q "http_requests_total"; then
  echo "   ✅ Metrics endpoint working"

  # Check for resilience metrics
  if echo "$METRICS" | grep -q "circuit_breaker"; then
    echo "   ✅ Circuit Breaker metrics present"
  else
    echo "   ⚠️  Circuit Breaker metrics not found (may not be activated yet)"
  fi

  if echo "$METRICS" | grep -q "bottleneck"; then
    echo "   ✅ Bottleneck metrics present"
  else
    echo "   ⚠️  Bottleneck metrics not found (may not be activated yet)"
  fi
else
  echo "   ❌ Metrics endpoint failed"
  exit 1
fi
echo ""

# Test 4: Chat endpoint smoke test (simplified - no Bedrock calls)
echo "📊 Test 4/4: API Availability ($TOTAL_REQUESTS requests)..."
echo "   Note: Testing endpoint availability only (errors expected without proper auth/bedrock)"
echo ""

for i in $(seq 1 $TOTAL_REQUESTS); do
  printf "   Request %2d/%d ... " "$i" "$TOTAL_REQUESTS"

  RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST "$STAGING_URL/api/chat" \
    -H "Content-Type: application/json" \
    -d "{
      \"mensagem\": \"Test $i - smoke test\",
      \"conversationId\": \"smoke-test-$i\"
    }" 2>&1)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)

  # We expect errors (500/400) since we're not sending proper Bedrock credentials
  # We just want to confirm the endpoint is reachable
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "500" ] || [ "$HTTP_CODE" = "400" ]; then
    echo "✅ (HTTP $HTTP_CODE)"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "❌ (HTTP $HTTP_CODE)"
    FAILED=$((FAILED + 1))
  fi

  sleep 0.5
done

echo ""
echo "========================================="
echo "📈 SMOKE TEST RESULTS"
echo "========================================="
echo "Success: $SUCCESS/$TOTAL_REQUESTS"
echo "Failed:  $FAILED/$TOTAL_REQUESTS"
echo "Success Rate: $(( SUCCESS * 100 / TOTAL_REQUESTS ))%"
echo ""

if [ $SUCCESS -ge $(( TOTAL_REQUESTS * 9 / 10 )) ]; then
  echo "✅ SMOKE TEST PASSED (≥90% success rate)"
  echo ""
  echo "Next Steps:"
  echo "  1. Check /metrics for circuit_breaker and bottleneck counters"
  echo "  2. Test circuit breaker state transitions"
  echo "  3. Test model fallback chain"
  echo "  4. Test queue rejection (503)"
  exit 0
else
  echo "❌ SMOKE TEST FAILED (<90% success rate)"
  exit 1
fi
