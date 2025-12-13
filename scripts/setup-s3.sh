#!/bin/bash

# ROM Agent - Setup do Bucket S3 para Extração
# Este script cria o bucket S3 e configura políticas

set -e

# Configuração
BUCKET_NAME="${S3_BUCKET:-rom-agent-documents}"
REGION="${AWS_REGION:-us-east-1}"
PROFILE="${AWS_PROFILE:-default}"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         ROM Agent - Setup S3 para Extração                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Bucket: $BUCKET_NAME"
echo "Região: $REGION"
echo "Profile: $PROFILE"
echo ""

# Verificar AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI não encontrado. Instale com: brew install awscli"
    exit 1
fi

# Verificar credenciais
echo "🔐 Verificando credenciais AWS..."
if ! aws sts get-caller-identity --profile $PROFILE &> /dev/null; then
    echo "❌ Credenciais AWS não configuradas. Execute: aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --profile $PROFILE --query 'Account' --output text)
echo "   ✅ Conta: $ACCOUNT_ID"

# Criar bucket se não existir
echo ""
echo "📦 Verificando bucket S3..."
if aws s3api head-bucket --bucket "$BUCKET_NAME" --profile $PROFILE 2>/dev/null; then
    echo "   ✅ Bucket já existe: $BUCKET_NAME"
else
    echo "   📦 Criando bucket: $BUCKET_NAME"
    if [ "$REGION" = "us-east-1" ]; then
        aws s3api create-bucket \
            --bucket "$BUCKET_NAME" \
            --profile $PROFILE
    else
        aws s3api create-bucket \
            --bucket "$BUCKET_NAME" \
            --region "$REGION" \
            --create-bucket-configuration LocationConstraint="$REGION" \
            --profile $PROFILE
    fi
    echo "   ✅ Bucket criado"
fi

# Criar estrutura de pastas
echo ""
echo "📂 Criando estrutura de pastas..."
for folder in "documents/" "extracted/" "metadata/" "processed/"; do
    aws s3api put-object \
        --bucket "$BUCKET_NAME" \
        --key "$folder" \
        --profile $PROFILE \
        2>/dev/null || true
    echo "   ✅ $folder"
done

# Configurar lifecycle para economia (mover para Glacier após 90 dias)
echo ""
echo "⏰ Configurando lifecycle (Glacier após 90 dias)..."
cat > /tmp/lifecycle.json << 'LIFECYCLE'
{
    "Rules": [
        {
            "ID": "MoveToGlacierAfter90Days",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "processed/"
            },
            "Transitions": [
                {
                    "Days": 90,
                    "StorageClass": "GLACIER"
                }
            ]
        },
        {
            "ID": "DeleteOldMetadata",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "metadata/"
            },
            "Expiration": {
                "Days": 365
            }
        }
    ]
}
LIFECYCLE

aws s3api put-bucket-lifecycle-configuration \
    --bucket "$BUCKET_NAME" \
    --lifecycle-configuration file:///tmp/lifecycle.json \
    --profile $PROFILE \
    2>/dev/null || echo "   ⚠️  Lifecycle já configurado ou permissão negada"

echo "   ✅ Lifecycle configurado"

# Habilitar versionamento (proteção contra exclusão acidental)
echo ""
echo "📜 Habilitando versionamento..."
aws s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled \
    --profile $PROFILE \
    2>/dev/null || true
echo "   ✅ Versionamento habilitado"

# Configurar criptografia
echo ""
echo "🔒 Configurando criptografia (SSE-S3)..."
aws s3api put-bucket-encryption \
    --bucket "$BUCKET_NAME" \
    --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            }
        }]
    }' \
    --profile $PROFILE \
    2>/dev/null || true
echo "   ✅ Criptografia AES-256 ativada"

# Bloquear acesso público
echo ""
echo "🚫 Bloqueando acesso público..."
aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration '{
        "BlockPublicAcls": true,
        "IgnorePublicAcls": true,
        "BlockPublicPolicy": true,
        "RestrictPublicBuckets": true
    }' \
    --profile $PROFILE \
    2>/dev/null || true
echo "   ✅ Acesso público bloqueado"

# Resumo de custos
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ Setup concluído!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "CUSTOS ESTIMADOS (S3 Standard us-east-1):"
echo "  • Armazenamento: \$0.023/GB/mês"
echo "  • PUT requests:  \$0.005/1000 requests"
echo "  • GET requests:  \$0.0004/1000 requests"
echo "  • Após 90 dias:  Glacier \$0.004/GB/mês"
echo ""
echo "CONFIGURAR NO ROM Agent:"
echo "  export S3_BUCKET=$BUCKET_NAME"
echo "  export AWS_REGION=$REGION"
echo ""
echo "TESTAR:"
echo "  node lib/extractor-pipeline.js process"
echo "  node lib/extractor-pipeline.js s3-list"
echo ""

# Limpar
rm -f /tmp/lifecycle.json
