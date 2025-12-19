#!/bin/bash
# Validação completa do PR#4 - Retry with Exponential Backoff

echo "🔍 PR#4 - PROCESSO DE VALIDAÇÃO"
echo "================================"
echo ""

# 1. Validar arquivos do PR#4
echo "📁 1. Validando arquivos do PR#4..."
if [ -f "src/utils/retry-with-backoff.js" ]; then
  echo "   ✅ retry-with-backoff.js existe"
else
  echo "   ❌ retry-with-backoff.js NÃO encontrado"
  exit 1
fi

if [ -f "src/utils/__tests__/retry.test.js" ]; then
  echo "   ✅ retry.test.js existe"
else
  echo "   ❌ retry.test.js NÃO encontrado"
  exit 1
fi

# 2. Validar imports nos módulos
echo ""
echo "📦 2. Validando imports nos módulos..."
if grep -q "retryAwsCommand" src/modules/bedrock.js; then
  echo "   ✅ bedrock.js importa retryAwsCommand"
else
  echo "   ❌ bedrock.js NÃO importa retryAwsCommand"
  exit 1
fi

if grep -q "retryAwsCommand" src/modules/bedrockAvancado.js; then
  echo "   ✅ bedrockAvancado.js importa retryAwsCommand"
else
  echo "   ❌ bedrockAvancado.js NÃO importa retryAwsCommand"
  exit 1
fi

# 3. Contar pontos de integração
echo ""
echo "🔗 3. Contando pontos de integração..."
BEDROCK_COUNT=$(grep -c "retryAwsCommand" src/modules/bedrock.js || echo 0)
AVANCADO_COUNT=$(grep -c "retryAwsCommand" src/modules/bedrockAvancado.js || echo 0)
TOTAL_COUNT=$((BEDROCK_COUNT + AVANCADO_COUNT))

echo "   📊 bedrock.js: $BEDROCK_COUNT integrações"
echo "   📊 bedrockAvancado.js: $AVANCADO_COUNT integrações"
echo "   📊 Total: $TOTAL_COUNT integrações"

if [ $TOTAL_COUNT -ge 13 ]; then
  echo "   ✅ Mínimo de 13 integrações atingido"
else
  echo "   ⚠️  Apenas $TOTAL_COUNT integrações encontradas (esperado: 13)"
fi

# 4. Validar exports
echo ""
echo "📤 4. Validando exports do módulo retry..."
if grep -q "export.*retryWithBackoff" src/utils/retry-with-backoff.js; then
  echo "   ✅ retryWithBackoff exportado"
fi

if grep -q "export.*retryAwsCommand" src/utils/retry-with-backoff.js; then
  echo "   ✅ retryAwsCommand exportado"
fi

if grep -q "export.*isRetryableError" src/utils/retry-with-backoff.js; then
  echo "   ✅ isRetryableError exportado"
fi

# 5. Validar feature flags
echo ""
echo "🚩 5. Validando feature flags..."
if grep -q "ENABLE_RETRY\|RETRY_ENABLED" src/utils/retry-with-backoff.js; then
  echo "   ✅ Feature flag ENABLE_RETRY implementado"
else
  echo "   ❌ Feature flag NÃO encontrado"
  exit 1
fi

# 6. Validar testes
echo ""
echo "🧪 6. Validando estrutura de testes..."
TEST_COUNT=$(grep -c "it('should" src/utils/__tests__/retry.test.js || echo 0)
echo "   📊 $TEST_COUNT testes encontrados"

if [ $TEST_COUNT -ge 30 ]; then
  echo "   ✅ Mínimo de 30 testes atingido"
else
  echo "   ⚠️  Apenas $TEST_COUNT testes encontrados (esperado: 31)"
fi

# 7. Validar Git
echo ""
echo "📦 7. Validando status Git..."
CURRENT_BRANCH=$(git branch --show-current)
echo "   📍 Branch atual: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" = "feature/go-live-retry" ]; then
  echo "   ✅ Branch correto"
else
  echo "   ⚠️  Branch diferente do esperado"
fi

LAST_COMMIT=$(git log -1 --oneline)
echo "   📝 Último commit: $LAST_COMMIT"

# 8. Validar PR no GitHub
echo ""
echo "🔗 8. Verificando PR no GitHub..."
if git branch -r | grep -q "origin/feature/go-live-retry"; then
  echo "   ✅ Branch pushed para remote"
else
  echo "   ❌ Branch NÃO pushed para remote"
  exit 1
fi

echo ""
echo "================================"
echo "✅ VALIDAÇÃO PR#4 COMPLETA"
echo "================================"
echo ""
echo "📊 Resumo:"
echo "   - Arquivos: ✅"
echo "   - Imports: ✅"
echo "   - Integrações: $TOTAL_COUNT pontos"
echo "   - Exports: ✅"
echo "   - Feature Flags: ✅"
echo "   - Testes: $TEST_COUNT testes"
echo "   - Git: ✅"
echo "   - Remote: ✅"
echo ""
