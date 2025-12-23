#!/usr/bin/env bash
set -euo pipefail

echo "========================================"
echo "AWS Bedrock Diagnostic Script"
echo "========================================"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI não instalado"
    echo "Instale com: brew install awscli (macOS) ou pip install awscli"
    exit 1
fi

echo "✅ AWS CLI instalado: $(aws --version)"
echo ""

# Prompt for credentials if not set
if [[ -z "${AWS_ACCESS_KEY_ID:-}" ]]; then
    echo "Digite as credenciais AWS (ou pressione Ctrl+C para cancelar):"
    read -p "AWS_ACCESS_KEY_ID: " AWS_ACCESS_KEY_ID
    export AWS_ACCESS_KEY_ID
fi

if [[ -z "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
    read -sp "AWS_SECRET_ACCESS_KEY: " AWS_SECRET_ACCESS_KEY
    echo ""
    export AWS_SECRET_ACCESS_KEY
fi

if [[ -z "${AWS_REGION:-}" ]]; then
    AWS_REGION="us-west-2"
    export AWS_REGION
    echo "Usando região padrão: us-west-2 (Oregon)"
fi

echo ""
echo "Usando credenciais:"
echo "  Access Key: ${AWS_ACCESS_KEY_ID:0:8}...${AWS_ACCESS_KEY_ID: -4}"
echo "  Region: $AWS_REGION"
echo ""

# Test 1: Verify credentials with STS
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Teste 1: Verificar identidade (STS GetCallerIdentity)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if IDENTITY=$(aws sts get-caller-identity 2>&1); then
    echo "✅ Credenciais válidas"
    echo "$IDENTITY" | jq '.'

    USER_ARN=$(echo "$IDENTITY" | jq -r '.Arn')
    ACCOUNT_ID=$(echo "$IDENTITY" | jq -r '.Account')
    echo ""
    echo "  ARN: $USER_ARN"
    echo "  Account: $ACCOUNT_ID"
else
    echo "❌ FALHA: Credenciais inválidas ou expiradas"
    echo "$IDENTITY"
    exit 1
fi

echo ""

# Test 2: List Bedrock foundation models
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Teste 2: Listar modelos Bedrock disponíveis"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if MODELS=$(aws bedrock list-foundation-models --region "$AWS_REGION" 2>&1); then
    echo "✅ Acesso ao Bedrock OK"

    # Check for Claude models
    CLAUDE_MODELS=$(echo "$MODELS" | jq -r '.modelSummaries[] | select(.modelId | contains("anthropic")) | .modelId' 2>/dev/null || echo "")

    if [[ -n "$CLAUDE_MODELS" ]]; then
        echo ""
        echo "Modelos Claude disponíveis:"
        echo "$CLAUDE_MODELS" | while read model; do
            echo "  - $model"
        done

        # Check for specific model used in ROM Agent
        TARGET_MODEL="anthropic.claude-3-5-sonnet-20241022-v2:0"
        if echo "$CLAUDE_MODELS" | grep -q "$TARGET_MODEL"; then
            echo ""
            echo "✅ Modelo alvo encontrado: $TARGET_MODEL"
        else
            echo ""
            echo "⚠️  Modelo alvo NÃO encontrado: $TARGET_MODEL"
            echo "   Modelos disponíveis listados acima"
        fi
    else
        echo "⚠️  Nenhum modelo Claude encontrado"
    fi
else
    echo "❌ FALHA: Não foi possível listar modelos Bedrock"
    echo "$MODELS"

    if echo "$MODELS" | grep -q "AccessDeniedException"; then
        echo ""
        echo "💡 Diagnóstico: Permissões IAM insuficientes"
        echo "   A credencial precisa da policy: bedrock:ListFoundationModels"
    fi

    exit 1
fi

echo ""

# Test 3: Invoke Bedrock model
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Teste 3: Invocar modelo Claude (teste real)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MODEL_ID="anthropic.claude-3-5-sonnet-20241022-v2:0"
PAYLOAD=$(cat <<'EOF'
{
  "anthropic_version": "bedrock-2023-05-31",
  "max_tokens": 100,
  "messages": [
    {
      "role": "user",
      "content": "Responda apenas: OK"
    }
  ]
}
EOF
)

TMP_RESPONSE="/tmp/bedrock_response_$$.json"

echo "Invocando: $MODEL_ID"
echo "Payload:"
echo "$PAYLOAD" | jq '.'
echo ""

if aws bedrock-runtime invoke-model \
    --model-id "$MODEL_ID" \
    --body "$PAYLOAD" \
    --region "$AWS_REGION" \
    "$TMP_RESPONSE" 2>&1 | tee /tmp/bedrock_invoke_stderr.txt; then

    echo ""
    echo "✅ Invocação bem-sucedida"
    echo ""
    echo "Resposta do modelo:"
    cat "$TMP_RESPONSE" | jq '.'

    # Extract content
    CONTENT=$(cat "$TMP_RESPONSE" | jq -r '.content[0].text' 2>/dev/null || echo "")
    if [[ -n "$CONTENT" ]]; then
        echo ""
        echo "Texto extraído: $CONTENT"
    fi

    rm -f "$TMP_RESPONSE"
else
    echo ""
    echo "❌ FALHA: Não foi possível invocar o modelo"
    cat /tmp/bedrock_invoke_stderr.txt

    if grep -q "AccessDeniedException" /tmp/bedrock_invoke_stderr.txt; then
        echo ""
        echo "💡 Diagnóstico: Permissões IAM insuficientes"
        echo "   A credencial precisa da policy: bedrock:InvokeModel"
    elif grep -q "ResourceNotFoundException" /tmp/bedrock_invoke_stderr.txt; then
        echo ""
        echo "💡 Diagnóstico: Modelo não disponível"
        echo "   Verifique se o modelo está habilitado na sua conta AWS"
        echo "   Console: https://console.aws.amazon.com/bedrock/home?region=$AWS_REGION#/modelaccess"
    elif grep -q "ThrottlingException" /tmp/bedrock_invoke_stderr.txt; then
        echo ""
        echo "💡 Diagnóstico: Rate limit excedido"
        echo "   Aguarde alguns segundos e tente novamente"
    fi

    rm -f "$TMP_RESPONSE" /tmp/bedrock_invoke_stderr.txt
    exit 1
fi

rm -f /tmp/bedrock_invoke_stderr.txt

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DIAGNÓSTICO COMPLETO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Resumo:"
echo "  ✅ Credenciais AWS válidas"
echo "  ✅ Acesso ao Bedrock configurado"
echo "  ✅ Modelo Claude funcional"
echo ""
echo "Estas credenciais podem ser usadas no Render:"
echo ""
echo "  AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID"
echo "  AWS_SECRET_ACCESS_KEY=<REDACTED>"
echo "  AWS_REGION=$AWS_REGION"
echo ""
echo "⚠️  IMPORTANTE: Após configurar no Render, faça Manual Deploy"
echo "   para que as novas variáveis sejam carregadas!"
echo ""
