#!/bin/bash

###############################################################################
# ROM Agent v2.0 - Script de Instalação e Configuração
#
# Este script configura o ambiente completo para o sistema de extração v2.0
# - Verifica dependências
# - Configura variáveis de ambiente
# - Cria diretórios necessários
# - Instala pacotes npm
# - Testa o sistema
###############################################################################

set -e  # Exit on error

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Funções auxiliares
print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}║${BOLD} $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Banner
clear
echo -e "${CYAN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ██████╗  ██████╗ ███╗   ███╗    █████╗  ██████╗ ███████╗███╗   ██╗████████╗   ║
║   ██╔══██╗██╔═══██╗████╗ ████║   ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝   ║
║   ██████╔╝██║   ██║██╔████╔██║   ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║      ║
║   ██╔══██╗██║   ██║██║╚██╔╝██║   ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║      ║
║   ██║  ██║╚██████╔╝██║ ╚═╝ ██║   ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║      ║
║   ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝      ║
║                                                                   ║
║                     EXTRAÇÃO v2.0 - SETUP                        ║
║                  18 Ficheiros com Análise Profunda               ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

sleep 1

# 1. Verificar sistema operacional
print_header "1. VERIFICANDO SISTEMA OPERACIONAL"

OS_TYPE=$(uname -s)
if [ "$OS_TYPE" != "Darwin" ]; then
    print_error "Este script é otimizado para macOS. Sistema detectado: $OS_TYPE"
    print_info "O sistema pode funcionar, mas alguns caminhos podem precisar de ajuste."
    read -p "Deseja continuar? (s/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        exit 1
    fi
else
    print_success "macOS detectado: $OS_TYPE"
fi

# Informações do sistema
CURRENT_USER=$(whoami)
HOME_DIR="$HOME"
print_info "Usuário: $CURRENT_USER"
print_info "Home: $HOME_DIR"

# 2. Verificar Node.js
print_header "2. VERIFICANDO NODE.JS E NPM"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_success "Node.js instalado: $NODE_VERSION"

    # Verificar versão mínima (18+)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        print_warning "Node.js v18+ recomendado. Versão atual: $NODE_VERSION"
        print_info "Algumas funcionalidades podem não funcionar corretamente."
    fi
else
    print_error "Node.js não encontrado!"
    print_info "Instale Node.js 18+ de: https://nodejs.org/"
    exit 1
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_success "npm instalado: v$NPM_VERSION"
else
    print_error "npm não encontrado!"
    exit 1
fi

# 3. Verificar Python (opcional, para scrapers)
print_header "3. VERIFICANDO PYTHON (OPCIONAL)"

if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    print_success "Python instalado: $PYTHON_VERSION"
else
    print_warning "Python3 não encontrado (opcional para scrapers)"
fi

# 4. Verificar AWS CLI (opcional)
print_header "4. VERIFICANDO AWS CLI (OPCIONAL)"

if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version 2>&1)
    print_success "AWS CLI instalado: $AWS_VERSION"
else
    print_warning "AWS CLI não encontrado (opcional, mas recomendado)"
    print_info "Instale de: https://aws.amazon.com/cli/"
fi

# 5. Criar diretórios de saída
print_header "5. CRIANDO DIRETÓRIOS DE SAÍDA"

# Detectar melhor localização para salvar extrações
if [ -d "$HOME/Desktop" ]; then
    OUTPUT_BASE="$HOME/Desktop/ROM-Extractions-v2"
    print_info "Usando Desktop para saídas"
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

# 6. Configurar variáveis de ambiente
print_header "6. CONFIGURANDO VARIÁVEIS DE AMBIENTE"

ENV_FILE=".env"

if [ -f "$ENV_FILE" ]; then
    print_warning "Arquivo .env já existe"
    read -p "Deseja sobrescrever? (s/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        print_info "Mantendo .env existente"
    else
        mv "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
        print_info "Backup criado: $ENV_FILE.backup.*"
        CREATE_ENV=true
    fi
else
    CREATE_ENV=true
fi

if [ "$CREATE_ENV" = true ]; then
    cat > "$ENV_FILE" << EOF
# ROM Agent v2.0 - Configuração de Ambiente
# Gerado automaticamente em $(date)

# AWS Bedrock (obrigatório para análise com IA)
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1

# Configurações do sistema
NODE_ENV=development
PORT=3000

# Diretório de saída para extrações
OUTPUT_BASE_DIR=$OUTPUT_BASE

# Configurações de modelos
DEFAULT_EXTRACTION_MODEL=haiku
DEFAULT_ANALYSIS_MODEL=sonnet

# Configurações de processamento
MAX_FILE_SIZE_MB=50
MAX_CONCURRENT_JOBS=5

# Knowledge Base (opcional)
KNOWLEDGE_BASE_ENABLED=false
KNOWLEDGE_BASE_ID=

# Logs
LOG_LEVEL=info
LOG_FILE=logs/extraction.log
EOF

    print_success "Arquivo .env criado"
    print_warning "IMPORTANTE: Configure suas credenciais AWS no arquivo .env"
fi

# 7. Instalar dependências npm
print_header "7. INSTALANDO DEPENDÊNCIAS NPM"

if [ -f "package.json" ]; then
    print_info "Instalando pacotes..."
    npm install
    print_success "Dependências instaladas"
else
    print_error "package.json não encontrado!"
    print_info "Certifique-se de estar no diretório ROM-Agent"
    exit 1
fi

# 8. Verificar dependências críticas
print_header "8. VERIFICANDO DEPENDÊNCIAS CRÍTICAS"

CRITICAL_DEPS=(
    "@aws-sdk/client-bedrock-runtime"
    "express"
    "multer"
)

for dep in "${CRITICAL_DEPS[@]}"; do
    if npm list "$dep" &> /dev/null; then
        print_success "$dep instalado"
    else
        print_warning "$dep não encontrado - pode causar erros"
    fi
done

# 9. Testar módulos
print_header "9. TESTANDO MÓDULOS"

print_info "Verificando módulos de extração..."

# Verificar se arquivos existem
CRITICAL_FILES=(
    "src/services/entidades-extractor.js"
    "src/services/analise-juridica-profunda.js"
    "src/services/gerador-18-ficheiros.js"
    "src/services/document-extraction-service.js"
    "src/routes/extraction-v2.js"
    "scripts/test-extraction-v2.js"
)

ALL_FILES_OK=true
for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "$file"
    else
        print_error "$file NÃO ENCONTRADO"
        ALL_FILES_OK=false
    fi
done

if [ "$ALL_FILES_OK" = false ]; then
    print_error "Alguns arquivos críticos estão faltando!"
    exit 1
fi

# 10. Criar arquivo de configuração do sistema
print_header "10. CRIANDO CONFIGURAÇÃO DO SISTEMA"

CONFIG_FILE="config/extraction-v2.json"
mkdir -p config

cat > "$CONFIG_FILE" << EOF
{
  "version": "2.0",
  "system": {
    "os": "$OS_TYPE",
    "user": "$CURRENT_USER",
    "homeDir": "$HOME_DIR",
    "outputBaseDir": "$OUTPUT_BASE"
  },
  "paths": {
    "temp": "temp/uploads",
    "logs": "logs",
    "extractions": "data/extractions",
    "processos": "data/processos-extraidos"
  },
  "models": {
    "extraction": "haiku",
    "analysis": "sonnet"
  },
  "limits": {
    "maxFileSizeMB": 50,
    "maxConcurrentJobs": 5,
    "timeoutSeconds": 600
  },
  "features": {
    "uploadToKB": false,
    "asyncProcessing": true,
    "generateAll18Files": true
  },
  "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

print_success "Configuração criada: $CONFIG_FILE"

# 11. Resumo final
print_header "11. RESUMO DA INSTALAÇÃO"

echo ""
echo -e "${BOLD}INSTALAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo ""
echo -e "${CYAN}Configurações:${NC}"
echo -e "  • Diretório de saída: ${GREEN}$OUTPUT_BASE${NC}"
echo -e "  • Logs: ${GREEN}logs/extraction.log${NC}"
echo -e "  • Configuração: ${GREEN}$ENV_FILE${NC}"
echo ""
echo -e "${CYAN}Próximos passos:${NC}"
echo ""
echo -e "${YELLOW}1.${NC} Configure suas credenciais AWS no arquivo ${BOLD}.env${NC}:"
echo -e "   ${BLUE}nano .env${NC}"
echo ""
echo -e "${YELLOW}2.${NC} Teste o sistema com um documento:"
echo -e "   ${BLUE}node scripts/test-extraction-v2.js /caminho/documento.pdf${NC}"
echo ""
echo -e "${YELLOW}3.${NC} Ou inicie o servidor:"
echo -e "   ${BLUE}npm start${NC}"
echo ""
echo -e "${YELLOW}4.${NC} Leia a documentação:"
echo -e "   ${BLUE}cat EXTRACAO-V2-README.md${NC}"
echo ""

# Verificar credenciais AWS
if grep -q "your_access_key_here" "$ENV_FILE" 2>/dev/null; then
    echo -e "${RED}⚠ ATENÇÃO:${NC} Configure as credenciais AWS antes de usar o sistema!"
    echo ""
fi

print_info "Para mais informações, consulte: EXTRACAO-V2-README.md"
echo ""

# Perguntar se quer fazer teste
read -p "Deseja executar um teste rápido do sistema? (s/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Ss]$ ]]; then
    print_header "EXECUTANDO TESTE RÁPIDO"

    # Verificar se há algum PDF para testar
    if ls *.pdf &> /dev/null; then
        TEST_PDF=$(ls *.pdf | head -1)
        print_info "Encontrado PDF para teste: $TEST_PDF"
        print_warning "Isso consumirá créditos AWS se configurado!"
        read -p "Continuar com o teste? (s/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Ss]$ ]]; then
            node scripts/test-extraction-v2.js "$TEST_PDF" "Teste_Setup_$(date +%Y%m%d_%H%M%S)"
        fi
    else
        print_info "Nenhum PDF encontrado no diretório atual para teste"
        print_info "Execute manualmente: node scripts/test-extraction-v2.js <arquivo.pdf>"
    fi
fi

echo ""
print_success "Setup concluído! Sistema pronto para uso."
echo ""
