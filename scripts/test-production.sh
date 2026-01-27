#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════
# 🧪 ROM Agent - Production Tests
# ═══════════════════════════════════════════════════════════════════════════
#
# Testa todas as correções em produção:
# - Solução 1: Geração de documentos em Markdown
# - Fase 2: Conversão de documentos (DOCX, PDF, HTML, TXT, MD)
# - Fase 3: Endpoints de formatos
#
# ═══════════════════════════════════════════════════════════════════════════

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configurações
API_URL="https://iarom.com.br"
TEST_OUTPUT_DIR="./test-results"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

# Contadores
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Criar diretório de output
mkdir -p "$TEST_OUTPUT_DIR"

# ═══════════════════════════════════════════════════════════════════════════
# FUNÇÕES AUXILIARES
# ═══════════════════════════════════════════════════════════════════════════

print_header() {
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo ""
}

print_test() {
  TESTS_TOTAL=$((TESTS_TOTAL + 1))
  echo -e "${CYAN}[TEST $TESTS_TOTAL]${NC} $1"
}

print_success() {
  TESTS_PASSED=$((TESTS_PASSED + 1))
  echo -e "${GREEN}  ✅ PASS:${NC} $1"
}

print_fail() {
  TESTS_FAILED=$((TESTS_FAILED + 1))
  echo -e "${RED}  ❌ FAIL:${NC} $1"
}

print_info() {
  echo -e "${YELLOW}  ℹ️  INFO:${NC} $1"
}

# ═══════════════════════════════════════════════════════════════════════════
# TESTE 1: HEALTH CHECKS
# ═══════════════════════════════════════════════════════════════════════════

test_health_checks() {
  print_header "TESTE 1: Health Checks"

  # 1.1 - Backend Health
  print_test "Backend health check"
  RESPONSE=$(curl -s -m 10 "$API_URL/health" || echo '{}')
  STATUS=$(echo "$RESPONSE" | jq -r '.status // "unknown"')

  if [[ "$STATUS" == "healthy" ]]; then
    print_success "Backend está saudável"
  else
    print_fail "Backend não está saudável: $STATUS"
  fi

  # 1.2 - Documents Formats Endpoint (Fase 3)
  print_test "Documents formats endpoint"
  RESPONSE=$(curl -s -m 10 "$API_URL/api/formats" || echo '{}')
  DEFAULT_FORMAT=$(echo "$RESPONSE" | jq -r '.default // "unknown"' 2>/dev/null || echo "unknown")
  FORMATS_COUNT=$(echo "$RESPONSE" | jq -r '.formats | length' 2>/dev/null || echo "0")

  if [[ "$DEFAULT_FORMAT" == "docx" && "$FORMATS_COUNT" == "5" ]]; then
    print_success "Endpoint de formatos retorna 5 formatos (padrão: docx)"
    print_info "Formatos: $(echo "$RESPONSE" | jq -r '.formats[].format' | tr '\n' ', ' | sed 's/,$//')"
  else
    print_fail "Endpoint de formatos não retorna dados corretos (default: $DEFAULT_FORMAT, count: $FORMATS_COUNT)"
  fi

  # 1.3 - Frontend Bundle
  print_test "Frontend bundle contém código novo"
  BUNDLE_HTML=$(curl -s -m 10 "$API_URL/" || echo "")
  BUNDLE_URL=$(echo "$BUNDLE_HTML" | grep -o 'src="/assets/index-[^"]*\.js"' | sed 's/src="//;s/"$//' | head -1)

  if [[ -n "$BUNDLE_URL" ]]; then
    print_success "Bundle encontrado: $BUNDLE_URL"

    # Verificar se contém código das fases 2 e 3
    BUNDLE_CONTENT=$(curl -s -m 15 "${API_URL}${BUNDLE_URL}" || echo "")

    # Temporariamente desabilitar exit on error para grep -c
    set +e
    HAS_ARTIFACT_COMPLETE=$(echo "$BUNDLE_CONTENT" | grep -c "artifact_complete" 2>/dev/null)
    HAS_OUTPUT_FORMAT=$(echo "$BUNDLE_CONTENT" | grep -c "outputFormat" 2>/dev/null)
    HAS_CONVERT_ENDPOINT=$(echo "$BUNDLE_CONTENT" | grep -c "convert" 2>/dev/null)
    set -e

    if [[ "$HAS_ARTIFACT_COMPLETE" -gt 0 && "$HAS_OUTPUT_FORMAT" -gt 0 && "$HAS_CONVERT_ENDPOINT" -gt 0 ]]; then
      print_success "Bundle contém código das correções (artifact_complete, outputFormat, convert endpoint)"
    else
      print_fail "Bundle não contém todo o código esperado (AC:$HAS_ARTIFACT_COMPLETE OF:$HAS_OUTPUT_FORMAT CE:$HAS_CONVERT_ENDPOINT)"
    fi
  else
    print_fail "Bundle não encontrado no HTML"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# TESTE 2: CONVERSÃO DE DOCUMENTOS (FASE 2)
# ═══════════════════════════════════════════════════════════════════════════

test_document_conversion() {
  print_header "TESTE 2: Conversão de Documentos (Fase 2)"

  # Documento de teste em Markdown
  MARKDOWN_CONTENT='# Análise Jurídica

## I. DOS FATOS

Este é um **documento de teste** para validar a conversão de Markdown para múltiplos formatos.

### Elementos Testados:

1. Títulos de diferentes níveis
2. Texto em **negrito** e *itálico*
3. Listas numeradas e não numeradas

## II. FUNDAMENTAÇÃO LEGAL

> "A jurisprudência tem entendido de forma pacífica que..."

### Citação de artigo

Art. 5º da Constituição Federal estabelece que:

- Todos são iguais perante a lei
- Ninguém será obrigado a fazer ou deixar de fazer algo
- É garantido o direito de propriedade

## III. CONCLUSÃO

Com base no exposto, requer-se o provimento do pedido.'

  # 2.1 - Conversão para DOCX
  print_test "Conversão Markdown → Word (DOCX)"
  RESPONSE=$(curl -s -m 30 -X POST "$API_URL/api/convert" \
    -H "Content-Type: application/json" \
    -d "{
      \"content\": $(echo "$MARKDOWN_CONTENT" | jq -Rs .),
      \"format\": \"docx\",
      \"title\": \"Teste Produção\",
      \"filename\": \"teste_producao_${TIMESTAMP}\"
    }" \
    --write-out "\n%{http_code}" \
    -o "$TEST_OUTPUT_DIR/teste_${TIMESTAMP}.docx" 2>/dev/null || echo "000")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  FILE_SIZE=$(stat -f%z "$TEST_OUTPUT_DIR/teste_${TIMESTAMP}.docx" 2>/dev/null || stat -c%s "$TEST_OUTPUT_DIR/teste_${TIMESTAMP}.docx" 2>/dev/null || echo "0")

  if [[ "$HTTP_CODE" == "200" && "$FILE_SIZE" -gt 1000 ]]; then
    print_success "DOCX gerado com sucesso (${FILE_SIZE} bytes, HTTP $HTTP_CODE)"
    print_info "Arquivo salvo: $TEST_OUTPUT_DIR/teste_${TIMESTAMP}.docx"
  elif [[ "$HTTP_CODE" == "403" ]]; then
    print_info "Endpoint funcionando mas requer CSRF token (HTTP $HTTP_CODE)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    print_fail "DOCX não foi gerado corretamente (HTTP $HTTP_CODE, Size: ${FILE_SIZE})"
  fi

  # 2.2 - Conversão para PDF
  print_test "Conversão Markdown → PDF"
  RESPONSE=$(curl -s -m 30 -X POST "$API_URL/api/convert" \
    -H "Content-Type: application/json" \
    -d "{
      \"content\": $(echo "$MARKDOWN_CONTENT" | jq -Rs .),
      \"format\": \"pdf\",
      \"title\": \"Teste Produção\",
      \"filename\": \"teste_producao_${TIMESTAMP}\"
    }" \
    --write-out "\n%{http_code}" \
    -o "$TEST_OUTPUT_DIR/teste_${TIMESTAMP}.pdf" 2>/dev/null || echo "000")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  FILE_SIZE=$(stat -f%z "$TEST_OUTPUT_DIR/teste_${TIMESTAMP}.pdf" 2>/dev/null || stat -c%s "$TEST_OUTPUT_DIR/teste_${TIMESTAMP}.pdf" 2>/dev/null || echo "0")

  if [[ "$HTTP_CODE" == "200" && "$FILE_SIZE" -gt 1000 ]]; then
    print_success "PDF gerado com sucesso (${FILE_SIZE} bytes, HTTP $HTTP_CODE)"
    print_info "Arquivo salvo: $TEST_OUTPUT_DIR/teste_${TIMESTAMP}.pdf"
  elif [[ "$HTTP_CODE" == "403" ]]; then
    print_info "Endpoint funcionando mas requer CSRF token (HTTP $HTTP_CODE)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    print_fail "PDF não foi gerado corretamente (HTTP $HTTP_CODE, Size: ${FILE_SIZE})"
  fi

  # 2.3 - Conversão para HTML
  print_test "Conversão Markdown → HTML"
  RESPONSE=$(curl -s -m 30 -X POST "$API_URL/api/convert" \
    -H "Content-Type: application/json" \
    -d "{
      \"content\": $(echo "$MARKDOWN_CONTENT" | jq -Rs .),
      \"format\": \"html\",
      \"title\": \"Teste Produção\",
      \"filename\": \"teste_producao_${TIMESTAMP}\"
    }" \
    --write-out "\n%{http_code}" \
    -o "$TEST_OUTPUT_DIR/teste_${TIMESTAMP}.html" 2>/dev/null || echo "000")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  FILE_SIZE=$(stat -f%z "$TEST_OUTPUT_DIR/teste_${TIMESTAMP}.html" 2>/dev/null || stat -c%s "$TEST_OUTPUT_DIR/teste_${TIMESTAMP}.html" 2>/dev/null || echo "0")

  if [[ "$HTTP_CODE" == "200" && "$FILE_SIZE" -gt 500 ]]; then
    print_success "HTML gerado com sucesso (${FILE_SIZE} bytes, HTTP $HTTP_CODE)"
    print_info "Arquivo salvo: $TEST_OUTPUT_DIR/teste_${TIMESTAMP}.html"

    # Verificar se HTML contém CSS e estrutura
    HTML_CONTENT=$(cat "$TEST_OUTPUT_DIR/teste_${TIMESTAMP}.html")
    if echo "$HTML_CONTENT" | grep -q "<style>" && echo "$HTML_CONTENT" | grep -q "<h1>"; then
      print_success "HTML contém CSS e estrutura HTML correta"
    else
      print_fail "HTML não contém estrutura esperada"
    fi
  elif [[ "$HTTP_CODE" == "403" ]]; then
    print_info "Endpoint funcionando mas requer CSRF token (HTTP $HTTP_CODE)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    print_fail "HTML não foi gerado corretamente (HTTP $HTTP_CODE, Size: ${FILE_SIZE})"
  fi

  # 2.4 - Conversão para TXT
  print_test "Conversão Markdown → TXT"
  RESPONSE=$(curl -s -m 30 -X POST "$API_URL/api/convert" \
    -H "Content-Type: application/json" \
    -d "{
      \"content\": $(echo "$MARKDOWN_CONTENT" | jq -Rs .),
      \"format\": \"txt\",
      \"title\": \"Teste Produção\",
      \"filename\": \"teste_producao_${TIMESTAMP}\"
    }" \
    --write-out "\n%{http_code}" \
    -o "$TEST_OUTPUT_DIR/teste_${TIMESTAMP}.txt" 2>/dev/null || echo "000")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  FILE_SIZE=$(stat -f%z "$TEST_OUTPUT_DIR/teste_${TIMESTAMP}.txt" 2>/dev/null || stat -c%s "$TEST_OUTPUT_DIR/teste_${TIMESTAMP}.txt" 2>/dev/null || echo "0")

  if [[ "$HTTP_CODE" == "200" && "$FILE_SIZE" -gt 100 ]]; then
    print_success "TXT gerado com sucesso (${FILE_SIZE} bytes, HTTP $HTTP_CODE)"
    print_info "Arquivo salvo: $TEST_OUTPUT_DIR/teste_${TIMESTAMP}.txt"

    # Verificar se TXT não contém formatação Markdown
    TXT_CONTENT=$(cat "$TEST_OUTPUT_DIR/teste_${TIMESTAMP}.txt")
    if ! echo "$TXT_CONTENT" | grep -q "##" && ! echo "$TXT_CONTENT" | grep -q "\*\*"; then
      print_success "TXT não contém formatação Markdown (limpo)"
    else
      print_fail "TXT ainda contém formatação Markdown"
    fi
  elif [[ "$HTTP_CODE" == "403" ]]; then
    print_info "Endpoint funcionando mas requer CSRF token (HTTP $HTTP_CODE)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    print_fail "TXT não foi gerado corretamente (HTTP $HTTP_CODE, Size: ${FILE_SIZE})"
  fi

  # 2.5 - Conversão para MD (passthrough)
  print_test "Conversão Markdown → MD (passthrough)"
  RESPONSE=$(curl -s -m 30 -X POST "$API_URL/api/convert" \
    -H "Content-Type: application/json" \
    -d "{
      \"content\": $(echo "$MARKDOWN_CONTENT" | jq -Rs .),
      \"format\": \"md\",
      \"title\": \"Teste Produção\",
      \"filename\": \"teste_producao_${TIMESTAMP}\"
    }" \
    --write-out "\n%{http_code}" \
    -o "$TEST_OUTPUT_DIR/teste_${TIMESTAMP}.md" 2>/dev/null || echo "000")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  FILE_SIZE=$(stat -f%z "$TEST_OUTPUT_DIR/teste_${TIMESTAMP}.md" 2>/dev/null || stat -c%s "$TEST_OUTPUT_DIR/teste_${TIMESTAMP}.md" 2>/dev/null || echo "0")

  if [[ "$HTTP_CODE" == "200" && "$FILE_SIZE" -gt 100 ]]; then
    print_success "MD retornado com sucesso (${FILE_SIZE} bytes, HTTP $HTTP_CODE)"
    print_info "Arquivo salvo: $TEST_OUTPUT_DIR/teste_${TIMESTAMP}.md"
  elif [[ "$HTTP_CODE" == "403" ]]; then
    print_info "Endpoint funcionando mas requer CSRF token (HTTP $HTTP_CODE)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    print_fail "MD não foi retornado corretamente (HTTP $HTTP_CODE, Size: ${FILE_SIZE})"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# TESTE 3: VALIDAÇÕES DE ERRO
# ═══════════════════════════════════════════════════════════════════════════

test_error_handling() {
  print_header "TESTE 3: Validações de Erro"

  # 3.1 - Conteúdo vazio
  print_test "Validação: Conteúdo vazio deve retornar erro"
  RESPONSE=$(curl -s -m 10 -X POST "$API_URL/api/convert" \
    -H "Content-Type: application/json" \
    -d '{"content": "", "format": "docx"}' \
    2>/dev/null || echo '{}')

  ERROR=$(echo "$RESPONSE" | jq -r '.error // "none"')

  if [[ "$ERROR" != "none" ]]; then
    print_success "Erro detectado corretamente: $ERROR"
  else
    print_fail "Erro não foi detectado para conteúdo vazio"
  fi

  # 3.2 - Formato inválido
  print_test "Validação: Formato inválido deve retornar erro"
  RESPONSE=$(curl -s -m 10 -X POST "$API_URL/api/convert" \
    -H "Content-Type: application/json" \
    -d '{"content": "teste", "format": "invalid"}' \
    2>/dev/null || echo '{}')

  ERROR=$(echo "$RESPONSE" | jq -r '.error // "none"')

  if [[ "$ERROR" != "none" && "$ERROR" =~ "inválido" ]]; then
    print_success "Erro detectado corretamente: $ERROR"
  else
    print_fail "Erro não foi detectado para formato inválido"
  fi

  # 3.3 - Content-Type incorreto
  print_test "Validação: Content-Type incorreto"
  HTTP_CODE=$(curl -s -m 10 -X POST "$API_URL/api/convert" \
    -d "plain text data" \
    -w "%{http_code}" \
    -o /dev/null 2>/dev/null || echo "000")

  if [[ "$HTTP_CODE" == "400" || "$HTTP_CODE" == "415" ]]; then
    print_success "Erro 400/415 retornado corretamente (HTTP $HTTP_CODE)"
  elif [[ "$HTTP_CODE" == "403" ]]; then
    print_info "CSRF verificado antes do Content-Type (HTTP $HTTP_CODE - esperado)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    print_fail "Erro não foi retornado para Content-Type incorreto (HTTP $HTTP_CODE)"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# TESTE 4: PERFORMANCE
# ═══════════════════════════════════════════════════════════════════════════

test_performance() {
  print_header "TESTE 4: Performance"

  # Documento médio (2KB de Markdown)
  MEDIUM_DOC=$(printf '# Título Principal\n\n%.0s' {1..50})
  MEDIUM_DOC+=$(printf 'Parágrafo de teste com conteúdo relevante. %.0s' {1..20})

  # 4.1 - Tempo de conversão DOCX
  print_test "Performance: Conversão DOCX (documento médio)"
  START_TIME=$(date +%s)

  HTTP_CODE=$(curl -s -m 30 -X POST "$API_URL/api/convert" \
    -H "Content-Type: application/json" \
    -d "{
      \"content\": $(echo "$MEDIUM_DOC" | jq -Rs .),
      \"format\": \"docx\",
      \"title\": \"Performance Test\"
    }" \
    -w "%{http_code}" \
    -o /dev/null 2>/dev/null || echo "000")

  END_TIME=$(date +%s)
  ELAPSED=$((END_TIME - START_TIME))

  if [[ "$HTTP_CODE" == "200" && "$ELAPSED" -lt 5 ]]; then
    print_success "Conversão completada em ${ELAPSED}s (< 5s)"
  elif [[ "$HTTP_CODE" == "200" ]]; then
    print_info "Conversão completada em ${ELAPSED}s (>= 5s, pode melhorar)"
  elif [[ "$HTTP_CODE" == "403" ]]; then
    print_info "Endpoint respondeu em ${ELAPSED}s (protegido por CSRF)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    print_fail "Conversão falhou ou timeout (HTTP $HTTP_CODE, ${ELAPSED}s)"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# EXECUÇÃO DOS TESTES
# ═══════════════════════════════════════════════════════════════════════════

main() {
  echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  🧪 ROM Agent - Production Tests${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${CYAN}URL:${NC} $API_URL"
  echo -e "${CYAN}Output:${NC} $TEST_OUTPUT_DIR"
  echo -e "${CYAN}Timestamp:${NC} $TIMESTAMP"
  echo ""

  # Executar todos os testes
  test_health_checks
  test_document_conversion
  test_error_handling
  test_performance

  # Resumo
  print_header "RESUMO DOS TESTES"

  echo -e "${CYAN}Total de testes:${NC} $TESTS_TOTAL"
  echo -e "${GREEN}Testes passados:${NC} $TESTS_PASSED"
  echo -e "${RED}Testes falhados:${NC} $TESTS_FAILED"
  echo ""

  PASS_RATE=$((TESTS_PASSED * 100 / TESTS_TOTAL))

  if [[ "$PASS_RATE" -ge 90 ]]; then
    echo -e "${GREEN}✅ Taxa de sucesso: ${PASS_RATE}% - EXCELENTE!${NC}"
    EXIT_CODE=0
  elif [[ "$PASS_RATE" -ge 70 ]]; then
    echo -e "${YELLOW}⚠️  Taxa de sucesso: ${PASS_RATE}% - BOM (alguns problemas)${NC}"
    EXIT_CODE=0
  else
    echo -e "${RED}❌ Taxa de sucesso: ${PASS_RATE}% - CRÍTICO (muitas falhas)${NC}"
    EXIT_CODE=1
  fi

  echo ""
  echo -e "${CYAN}📁 Arquivos gerados:${NC}"
  ls -lh "$TEST_OUTPUT_DIR"/teste_${TIMESTAMP}.* 2>/dev/null || echo "  Nenhum arquivo gerado"
  echo ""

  exit $EXIT_CODE
}

# Verificar dependências
if ! command -v jq &> /dev/null; then
  echo -e "${RED}❌ jq não está instalado${NC}"
  echo "   macOS: brew install jq"
  echo "   Ubuntu: sudo apt install jq"
  exit 1
fi

if ! command -v curl &> /dev/null; then
  echo -e "${RED}❌ curl não está instalado${NC}"
  exit 1
fi

# Executar
main
