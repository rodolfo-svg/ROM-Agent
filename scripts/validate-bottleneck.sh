#!/bin/bash
# ROM Agent - Bottleneck Validation Script
# Valida controle de concorrência e rejeição com HTTP 503

STAGING_URL="https://rom-agent-ia-onrender-com.onrender.com"
MAX_CONCURRENT=5
MAX_QUEUE=20
TOTAL_CAPACITY=25  # MAX_CONCURRENT + MAX_QUEUE
TEST_REQUESTS=30   # Mais que a capacidade para forçar rejeições

echo "========================================="
echo "🚦 Bottleneck Validation"
echo "========================================="
echo ""
echo "URL: $STAGING_URL"
echo "Configuração:"
echo "  - MAX_CONCURRENT: $MAX_CONCURRENT"
echo "  - MAX_QUEUE: $MAX_QUEUE"
echo "  - Total Capacity: $TOTAL_CAPACITY"
echo "  - Test Requests: $TEST_REQUESTS"
echo ""

# Test 1: Verificar métricas iniciais
echo "📊 Test 1/3: Verificar Métricas Iniciais..."
METRICS_BEFORE=$(curl -sS "$STAGING_URL/metrics" | grep "bottleneck_rejected_total" | head -1)
if [ -n "$METRICS_BEFORE" ]; then
  echo "   ✅ Métricas bottleneck presentes"
  echo "   $METRICS_BEFORE"
else
  echo "   ❌ Métricas bottleneck não encontradas"
  echo "   Verifique se ENABLE_BOTTLENECK=true"
  exit 1
fi
echo ""

# Test 2: Enviar rajada de requisições simultâneas
echo "📊 Test 2/3: Enviar Rajada de $TEST_REQUESTS Requisições..."
echo "   (Enviando em paralelo, aguarde...)"
echo ""

SUCCESS=0
HTTP_500=0
HTTP_503=0
OTHER=0

# Criar arquivo temporário para resultados
RESULTS_FILE=$(mktemp)

# Enviar requisições em paralelo
for i in $(seq 1 $TEST_REQUESTS); do
  (
    HTTP_CODE=$(curl -sS -w "%{http_code}" -o /dev/null -X POST "$STAGING_URL/api/chat" \
      -H "Content-Type: application/json" \
      -d "{\"mensagem\": \"Teste concorrência $i\", \"conversationId\": \"bn-test-$i\"}" \
      --max-time 10 2>&1 | tail -1)
    echo "$HTTP_CODE" >> "$RESULTS_FILE"
  ) &
done

# Aguardar todas as requisições
wait

# Contar resultados
while IFS= read -r code; do
  case "$code" in
    200) SUCCESS=$((SUCCESS + 1)) ;;
    500) HTTP_500=$((HTTP_500 + 1)) ;;
    503) HTTP_503=$((HTTP_503 + 1)) ;;
    *) OTHER=$((OTHER + 1)) ;;
  esac
done < "$RESULTS_FILE"

# Limpar arquivo temporário
rm "$RESULTS_FILE"

echo "   Resultados:"
echo "   - HTTP 200 (Success): $SUCCESS"
echo "   - HTTP 500 (Internal Error): $HTTP_500"
echo "   - HTTP 503 (Service Unavailable): $HTTP_503"
echo "   - Other: $OTHER"
echo ""

# Test 3: Validar rejeições (HTTP 503)
echo "📊 Test 3/3: Validar Rejeições..."
if [ "$HTTP_503" -ge 3 ]; then
  echo "   ✅ Bottleneck rejeitou requisições com HTTP 503 ($HTTP_503 rejeições)"
else
  echo "   ⚠️  Poucas rejeições detectadas ($HTTP_503)"
  echo "   Esperado: >= 3 (quando fila > $MAX_QUEUE)"
fi
echo ""

# Verificar métricas finais
echo "========================================="
echo "📈 MÉTRICAS FINAIS"
echo "========================================="
curl -sS "$STAGING_URL/metrics" | grep -E "bottleneck_(running|queued|rejected|completed)" | head -10
echo ""

# Análise
EXPECTED_REJECTIONS=$((TEST_REQUESTS - TOTAL_CAPACITY))
echo "========================================="
echo "📊 ANÁLISE"
echo "========================================="
echo "Capacidade Total: $TOTAL_CAPACITY requisições"
echo "Requisições Enviadas: $TEST_REQUESTS"
echo "Rejeições Esperadas: ~$EXPECTED_REJECTIONS"
echo "Rejeições Observadas: $HTTP_503"
echo ""

if [ "$HTTP_503" -ge "$EXPECTED_REJECTIONS" ]; then
  echo "✅ VALIDAÇÃO PASSOU"
  echo "   Bottleneck está funcionando corretamente!"
else
  echo "⚠️  VALIDAÇÃO PARCIAL"
  echo "   Bottleneck rejeitou menos que o esperado."
  echo "   Possíveis causas:"
  echo "   - Requisições completaram muito rápido"
  echo "   - Timeout nas requisições em fila"
  echo "   - Configuração diferente no servidor"
fi
echo ""

echo "Próximos passos:"
echo "  1. Monitorar métricas por 24h"
echo "  2. Documentar configuração final"
echo "  3. Preparar decisão GO/NO-GO para produção"
