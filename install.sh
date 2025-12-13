#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   ROM AGENT - Instalação Automática                         ║"
echo "║   Redator de Obras Magistrais v2.0                          ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Verificar Node.js
echo "🔍 Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js não encontrado. Instalando...${NC}"
    
    # Detectar sistema operacional
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if ! command -v brew &> /dev/null; then
            echo "Instalando Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        brew install node
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
else
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✅ Node.js encontrado: $NODE_VERSION${NC}"
fi

# 2. Instalar dependências
echo ""
echo "📦 Instalando dependências..."
npm install
echo -e "${GREEN}✅ Dependências instaladas${NC}"

# 3. Configurar credenciais AWS
echo ""
echo "🔐 Configurando credenciais AWS..."
if [ -f ~/.aws/credentials ]; then
    echo -e "${GREEN}✅ Credenciais AWS já configuradas${NC}"
else
    echo -e "${YELLOW}📝 Configure suas credenciais AWS:${NC}"
    
    # Verificar se aws-cli está instalado
    if ! command -v aws &> /dev/null; then
        echo "Instalando AWS CLI..."
        pip3 install awscli --upgrade --user
    fi
    
    aws configure
fi

# 4. Criar arquivo .env
echo ""
echo "⚙️  Configurando variáveis de ambiente..."
if [ ! -f .env ]; then
    cat > .env << ENVEOF
# AWS Configuration
AWS_REGION=us-east-1

# Server Configuration
PORT=3000
NODE_ENV=production

# Session Secret
SESSION_SECRET=$(openssl rand -base64 32)

# Optional: Anthropic API Key (for comparison)
# ANTHROPIC_API_KEY=sk-ant-...
ENVEOF
    echo -e "${GREEN}✅ Arquivo .env criado${NC}"
else
    echo -e "${GREEN}✅ Arquivo .env já existe${NC}"
fi

# 5. Criar diretórios necessários
echo ""
echo "📁 Criando estrutura de diretórios..."
mkdir -p KB/ROM/{modelos,legislacao,jurisprudencia,doutrina}
mkdir -p upload
mkdir -p data
mkdir -p logs
echo -e "${GREEN}✅ Diretórios criados${NC}"

# 6. Teste rápido
echo ""
echo "🧪 Testando instalação..."
node -e "console.log('Node.js funcionando!')" && \
npm -v > /dev/null && \
echo -e "${GREEN}✅ Testes passaram!${NC}"

# 7. Instruções finais
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   ✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!                       ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Para iniciar o ROM Agent:${NC}"
echo "  npm run web:enhanced"
echo ""
echo -e "${GREEN}Acesse em:${NC}"
echo "  http://localhost:3000"
echo ""
echo -e "${YELLOW}Não esqueça de:${NC}"
echo "  1. Adicionar suas peças em KB/ROM/modelos/"
echo "  2. Verificar credenciais AWS em ~/.aws/credentials"
echo ""
