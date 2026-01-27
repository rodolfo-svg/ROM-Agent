#!/usr/bin/env bash
# Script simplificado de teste (sem dependências de jq)

API_URL="https://iarom.com.br"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🧪 ROM Agent - Testes Simplificados"
echo "═══════════════════════════════════════"
echo ""

# Teste 1: Backend health
echo -n "1. Backend health... "
RESPONSE=$(curl -s -m 5 "$API_URL/health" 2>/dev/null || echo "{}")
if echo "$RESPONSE" | grep -q "healthy"; then
  echo -e "${GREEN}✅ OK${NC}"
else
  echo -e "${RED}❌ FAIL${NC}"
fi

# Teste 2: Chat stream endpoint
echo -n "2. Chat stream endpoint... "
RESPONSE=$(curl -s -m 5 -X POST "$API_URL/api/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{}' 2>/dev/null || echo "{}")
if echo "$RESPONSE" | grep -q "obrigatória"; then
  echo -e "${GREEN}✅ OK (validação funcionando)${NC}"
else
  echo -e "${RED}❌ FAIL${NC}"
fi

# Teste 3: Documents formats (Fase 3)
echo -n "3. Documents formats endpoint... "
RESPONSE=$(curl -s -m 5 "$API_URL/api/formats" 2>/dev/null || echo "")
if echo "$RESPONSE" | grep -q "docx"; then
  echo -e "${GREEN}✅ OK (endpoint ativo)${NC}"
else
  echo -e "${YELLOW}⏳ Aguardando deploy${NC}"
fi

# Teste 4: Documents convert (Fase 2)
echo -n "4. Documents convert endpoint... "
RESPONSE=$(curl -s -m 5 -X POST "$API_URL/api/convert" \
  -H "Content-Type: application/json" \
  -d '{"content":"test","format":"docx"}' 2>/dev/null || echo "")
if echo "$RESPONSE" | grep -q "success\|error\|obrigatória"; then
  echo -e "${GREEN}✅ OK (endpoint ativo)${NC}"
else
  echo -e "${YELLOW}⏳ Aguardando deploy${NC}"
fi

# Teste 5: Frontend bundle
echo -n "5. Frontend com código novo... "
BUNDLE_HTML=$(curl -s -m 5 "$API_URL/" 2>/dev/null || echo "")
BUNDLE_URL=$(echo "$BUNDLE_HTML" | grep -o 'src="/assets/index-[^"]*\.js"' | head -1 | sed 's/src="//;s/"$//')

if [ -n "$BUNDLE_URL" ]; then
  BUNDLE=$(curl -s -m 10 "${API_URL}${BUNDLE_URL}" 2>/dev/null || echo "")
  if echo "$BUNDLE" | grep -q "artifact_complete"; then
    echo -e "${GREEN}✅ OK (código das fases 2 e 3)${NC}"
  else
    echo -e "${YELLOW}⏳ Aguardando deploy frontend${NC}"
  fi
else
  echo -e "${RED}❌ Bundle não encontrado${NC}"
fi

echo ""
echo "═══════════════════════════════════════"
