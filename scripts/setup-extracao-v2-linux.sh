#!/bin/bash

###############################################################################
# ROM Agent v2.0 - Script de Instalação para Linux
#
# Suporta: Ubuntu, Debian, Fedora, CentOS, Arch Linux
# Execute: bash setup-extracao-v2-linux.sh
###############################################################################

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Funções
print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}║${BOLD} $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }

# Banner
clear
echo -e "${CYAN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                    ROM AGENT v2.0                              ║
║               EXTRAÇÃO COM 18 FICHEIROS                       ║
║                     SETUP LINUX                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"
sleep 1

# 1. Detectar distribuição Linux
print_header "1. DETECTANDO DISTRIBUIÇÃO LINUX"

if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO=$ID
    DISTRO_VERSION=$VERSION_ID
    print_success "Distribuição: $NAME $VERSION"
else
    print_warning "Não foi possível detectar a distribuição"
    DISTRO="unknown"
fi

CURRENT_USER=$(whoami)
HOME_DIR="$HOME"
print_info "Usuário: $CURRENT_USER"
print_info "Home: $HOME_DIR"

# 2. Verificar Node.js
print_header "2. VERIFICANDO NODE.JS E NPM"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_success "Node.js instalado: $NODE_VERSION"

    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        print_warning "Node.js v18+ recomendado. Atual: $NODE_VERSION"
    fi
else
    print_error "Node.js não encontrado!"
    print_info "Instalando Node.js..."

    case "$DISTRO" in
        ubuntu|debian)
            print_info "Usando apt-get..."
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        fedora|centos|rhel)
            print_info "Usando dnf/yum..."
            curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
            sudo dnf install -y nodejs || sudo yum install -y nodejs
            ;;
        arch)
            print_info "Usando pacman..."
            sudo pacman -S nodejs npm
            ;;
        *)
            print_error "Distribuição não suportada para instalação automática"
            print_info "Instale Node.js manualmente de: https://nodejs.org/"
            exit 1
            ;;
    esac

    if command -v node &> /dev/null; then
        print_success "Node.js instalado com sucesso"
    else
        print_error "Falha na instalação do Node.js"
        exit 1
    fi
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_success "npm instalado: v$NPM_VERSION"
else
    print_error "npm não encontrado!"
    exit 1
fi

# 3. Verificar Python (opcional)
print_header "3. VERIFICANDO PYTHON (OPCIONAL)"

if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    print_success "Python instalado: $PYTHON_VERSION"
else
    print_warning "Python3 não encontrado (opcional)"
    print_info "Para instalar: sudo apt-get install python3 (Ubuntu/Debian)"
fi

# 4. Verificar AWS CLI (opcional)
print_header "4. VERIFICANDO AWS CLI (OPCIONAL)"

if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version 2>&1)
    print_success "AWS CLI instalado: $AWS_VERSION"
else
    print_warning "AWS CLI não encontrado (opcional)"
    print_info "Instalar: curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip'"
fi

# 5. Criar diretórios de saída
print_header "5. CRIANDO DIRETÓRIOS DE SAÍDA"

# Detectar melhor localização (Linux)
if [ -d "$HOME/Desktop" ]; then
    OUTPUT_BASE="$HOME/Desktop/ROM-Extractions-v2"
    print_info "Usando Desktop para saídas"
elif [ -d "$HOME/Área de Trabalho" ]; then
    OUTPUT_BASE="$HOME/Área de Trabalho/ROM-Extractions-v2"
    print_info "Usando Área de Trabalho para saídas"
elif [ -d "$HOME/Documents" ]; then
    OUTPUT_BASE="$HOME/Documents/ROM-Extractions-v2"
    print_info "Usando Documents para saídas"
else
    OUTPUT_BASE="$HOME/ROM-Extractions-v2"
    print_info "Usando Home para saídas"
fi

mkdir -p "$OUTPUT_BASE"
print_success "Diretório de saída criado: $OUTPUT_BASE"

# Criar diretórios de trabalho
WORK_DIRS=(
    "temp/uploads"
    "logs"
    "data/extractions"
    "data/processos-extraidos"
)

for dir in "${WORK_DIRS[@]}"; do
    mkdir -p "$dir"
    print_success "Criado: $dir"
done

# 6. Configurar .env
print_header "6. CONFIGURANDO VARIÁVEIS DE AMBIENTE"

ENV_FILE=".env"
CREATE_ENV=false

if [ -f "$ENV_FILE" ]; then
    print_warning "Arquivo .env já existe"
    read -p "Deseja sobrescrever? (s/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        mv "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
        print_info "Backup criado"
        CREATE_ENV=true
    fi
else
    CREATE_ENV=true
fi

if [ "$CREATE_ENV" = true ]; then
    cat > "$ENV_FILE" << EOF
# ROM Agent v2.0 - Linux
# Gerado em $(date)

AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1

NODE_ENV=development
PORT=3000

OUTPUT_BASE_DIR=$OUTPUT_BASE

DEFAULT_EXTRACTION_MODEL=haiku
DEFAULT_ANALYSIS_MODEL=sonnet

MAX_FILE_SIZE_MB=50
MAX_CONCURRENT_JOBS=5

KNOWLEDGE_BASE_ENABLED=false

LOG_LEVEL=info
LOG_FILE=logs/extraction.log
EOF

    print_success "Arquivo .env criado"
    print_warning "Configure AWS no .env antes de usar!"
fi

# 7. Instalar dependências
print_header "7. INSTALANDO DEPENDÊNCIAS NPM"

if [ -f "package.json" ]; then
    print_info "Instalando pacotes..."
    npm install
    print_success "Dependências instaladas"
else
    print_error "package.json não encontrado!"
    exit 1
fi

# 8. Verificar módulos críticos
print_header "8. VERIFICANDO MÓDULOS"

CRITICAL_FILES=(
    "src/services/entidades-extractor.js"
    "src/services/analise-juridica-profunda.js"
    "src/services/gerador-18-ficheiros.js"
    "src/services/document-extraction-service.js"
    "src/routes/extraction-v2.js"
    "scripts/test-extraction-v2.js"
)

ALL_OK=true
for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "$file"
    else
        print_error "$file NÃO ENCONTRADO"
        ALL_OK=false
    fi
done

if [ "$ALL_OK" = false ]; then
    print_error "Arquivos críticos faltando!"
    exit 1
fi

# 9. Criar configuração
print_header "9. CRIANDO CONFIGURAÇÃO"

mkdir -p config

cat > "config/extraction-v2.json" << EOF
{
  "version": "2.0",
  "system": {
    "os": "Linux",
    "distro": "$DISTRO",
    "user": "$CURRENT_USER",
    "homeDir": "$HOME_DIR",
    "outputBaseDir": "$OUTPUT_BASE"
  },
  "paths": {
    "temp": "temp/uploads",
    "logs": "logs",
    "extractions": "data/extractions"
  },
  "models": {
    "extraction": "haiku",
    "analysis": "sonnet"
  },
  "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

print_success "Configuração criada"

# 10. Resumo
print_header "10. INSTALAÇÃO CONCLUÍDA"

echo ""
echo -e "${BOLD}SUCESSO!${NC}"
echo ""
echo -e "${CYAN}Configurações:${NC}"
echo -e "  • Saída: ${GREEN}$OUTPUT_BASE${NC}"
echo -e "  • Logs: ${GREEN}logs/extraction.log${NC}"
echo ""
echo -e "${CYAN}Próximos passos:${NC}"
echo ""
echo -e "${YELLOW}1.${NC} Configure AWS:"
echo -e "   ${BLUE}nano .env${NC}"
echo ""
echo -e "${YELLOW}2.${NC} Teste:"
echo -e "   ${BLUE}node scripts/test-extraction-v2.js /caminho/doc.pdf${NC}"
echo ""
echo -e "${YELLOW}3.${NC} Inicie servidor:"
echo -e "   ${BLUE}npm start${NC}"
echo ""

print_success "Setup concluído!"
echo ""
