#!/bin/bash

###############################################################################
# ROM Agent v2.0 - Criar Pacote ZIP para WhatsApp
#
# Cria um pacote ZIP otimizado com todos os arquivos necessários
# para distribuição via WhatsApp (< 100MB recomendado)
###############################################################################

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}${BOLD} $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }

# Banner
clear
echo -e "${CYAN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║        ROM AGENT v2.0 - GERADOR DE PACOTE ZIP            ║
║             Para distribuição via WhatsApp               ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Configurações
PACKAGE_NAME="ROM-Agent-v2-Extracao-18-Ficheiros"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_ZIP="${PACKAGE_NAME}-${TIMESTAMP}.zip"
TEMP_DIR="temp_package_$$"

print_header "1. PREPARANDO PACOTE"

# Criar diretório temporário
mkdir -p "$TEMP_DIR"
print_success "Diretório temporário criado"

# Copiar arquivos essenciais
print_header "2. COPIANDO ARQUIVOS ESSENCIAIS"

# Criar estrutura base
mkdir -p "$TEMP_DIR/scripts"
mkdir -p "$TEMP_DIR/src/services"
mkdir -p "$TEMP_DIR/src/routes"
mkdir -p "$TEMP_DIR/src/modules"
mkdir -p "$TEMP_DIR/config"

# Arquivos principais
FILES=(
    "package.json"
    ".env.example"
    "EXTRACAO-V2-README.md"
    "IMPLEMENTACAO-COMPLETA.md"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$TEMP_DIR/"
        print_success "Copiado: $file"
    else
        print_warning "Não encontrado: $file"
    fi
done

# Scripts
SCRIPTS=(
    "setup-extracao-v2.sh"
    "setup-extracao-v2.ps1"
    "setup-extracao-v2-linux.sh"
    "test-extraction-v2.js"
)

for script in "${SCRIPTS[@]}"; do
    if [ -f "scripts/$script" ]; then
        cp "scripts/$script" "$TEMP_DIR/scripts/"
        print_success "Copiado: scripts/$script"
    fi
done

# Serviços
SERVICES=(
    "entidades-extractor.js"
    "analise-juridica-profunda.js"
    "gerador-18-ficheiros.js"
    "document-extraction-service.js"
)

for service in "${SERVICES[@]}"; do
    if [ -f "src/services/$service" ]; then
        cp "src/services/$service" "$TEMP_DIR/src/services/"
        print_success "Copiado: src/services/$service"
    fi
done

# Rotas
if [ -f "src/routes/extraction-v2.js" ]; then
    cp "src/routes/extraction-v2.js" "$TEMP_DIR/src/routes/"
    print_success "Copiado: src/routes/extraction-v2.js"
fi

# Módulos
MODULES=(
    "extracao.js"
    "bedrock.js"
    "textract.js"
    "knowledgeBase.js"
)

for module in "${MODULES[@]}"; do
    if [ -f "src/modules/$module" ]; then
        cp "src/modules/$module" "$TEMP_DIR/src/modules/"
        print_success "Copiado: src/modules/$module"
    fi
done

# Criar .env.example
print_header "3. CRIANDO .env.example"

cat > "$TEMP_DIR/.env.example" << 'EOF'
# ROM Agent v2.0 - Configuração de Ambiente
# Copie para .env e configure suas credenciais

# AWS Bedrock (obrigatório)
AWS_ACCESS_KEY_ID=sua_chave_aqui
AWS_SECRET_ACCESS_KEY=sua_chave_secreta_aqui
AWS_REGION=us-east-1

# Sistema
NODE_ENV=development
PORT=3000

# Diretório de saída (detectado automaticamente se vazio)
OUTPUT_BASE_DIR=

# Modelos
DEFAULT_EXTRACTION_MODEL=haiku
DEFAULT_ANALYSIS_MODEL=sonnet

# Limites
MAX_FILE_SIZE_MB=50
MAX_CONCURRENT_JOBS=5

# Knowledge Base (opcional)
KNOWLEDGE_BASE_ENABLED=false

# Logs
LOG_LEVEL=info
LOG_FILE=logs/extraction.log
EOF

print_success ".env.example criado"

# Criar README de instalação
print_header "4. CRIANDO README-INSTALACAO.md"

cat > "$TEMP_DIR/README-INSTALACAO.md" << 'EOF'
# ROM Agent v2.0 - Guia de Instalação Rápida

## 📦 O QUE É ESTE PACOTE?

Sistema de extração de documentos jurídicos com análise profunda:
- **18 ficheiros estruturados** por documento
- **Análise jurídica com IA** (Claude)
- **Extração de entidades** (partes, valores, datas, leis)
- **Resumos executivos** em múltiplos níveis
- **Análise de risco** com recomendações

---

## 🚀 INSTALAÇÃO

### Windows

1. Abra PowerShell como Administrador
2. Navegue até a pasta extraída
3. Execute:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-extracao-v2.ps1
```

### macOS

1. Abra Terminal
2. Navegue até a pasta extraída
3. Execute:
```bash
bash scripts/setup-extracao-v2.sh
```

### Linux

1. Abra Terminal
2. Navegue até a pasta extraída
3. Execute:
```bash
bash scripts/setup-extracao-v2-linux.sh
```

---

## ⚙️ CONFIGURAÇÃO

1. **Configure AWS Bedrock**:
   - Copie `.env.example` para `.env`
   - Adicione suas credenciais AWS

2. **Teste o sistema**:
```bash
node scripts/test-extraction-v2.js /caminho/documento.pdf
```

---

## 📚 DOCUMENTAÇÃO COMPLETA

Leia os arquivos:
- `EXTRACAO-V2-README.md` - Manual completo
- `IMPLEMENTACAO-COMPLETA.md` - Detalhes técnicos

---

## 💰 CUSTOS

- Documento pequeno (< 10 págs): $0.05-$0.15
- Documento médio (10-50 págs): $0.15-$0.50
- Documento grande (50-200 págs): $0.50-$2.00

---

## 📞 SUPORTE

Consulte a documentação incluída ou contate o desenvolvedor.

**ROM Agent v2.0** © 2026
EOF

print_success "README-INSTALACAO.md criado"

# Criar arquivo package.json básico se não existir
if [ ! -f "$TEMP_DIR/package.json" ]; then
    print_header "5. CRIANDO package.json"

    cat > "$TEMP_DIR/package.json" << 'EOF'
{
  "name": "rom-agent-extracao-v2",
  "version": "2.0.0",
  "description": "Sistema de Extração de Documentos Jurídicos com 18 Ficheiros e Análise Profunda",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "test": "node scripts/test-extraction-v2.js"
  },
  "dependencies": {
    "@aws-sdk/client-bedrock-runtime": "^3.0.0",
    "express": "^4.18.0",
    "multer": "^1.4.5-lts.1",
    "mammoth": "^1.6.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "document-extraction",
    "legal-analysis",
    "ai",
    "bedrock",
    "claude"
  ],
  "license": "UNLICENSED",
  "private": true
}
EOF

    print_success "package.json criado"
fi

# Criar arquivo de versão
print_header "6. CRIANDO ARQUIVO DE VERSÃO"

cat > "$TEMP_DIR/VERSION.txt" << EOF
ROM Agent - Sistema de Extração v2.0
=====================================

Versão: 2.0.0
Data do Pacote: $(date '+%d/%m/%Y %H:%M:%S')
Plataformas: Windows, macOS, Linux

Conteúdo:
- 4 serviços principais
- 1 rota API REST
- 3 scripts de instalação
- 2 documentações completas

Tamanho estimado após instalação: ~100-200MB
(dependências npm não incluídas no ZIP)

Para instalar:
1. Extraia o ZIP
2. Execute o script de setup para seu sistema
3. Configure AWS no arquivo .env
4. Execute: node scripts/test-extraction-v2.js

Mais informações: README-INSTALACAO.md
EOF

print_success "VERSION.txt criado"

# Criar ZIP
print_header "7. COMPACTANDO PACOTE"

cd "$TEMP_DIR"
zip -r "../$OUTPUT_ZIP" . -x "*.DS_Store" -x "__MACOSX/*" > /dev/null
cd ..

print_success "Pacote criado: $OUTPUT_ZIP"

# Limpar temporários
print_header "8. LIMPANDO ARQUIVOS TEMPORÁRIOS"

rm -rf "$TEMP_DIR"
print_success "Arquivos temporários removidos"

# Estatísticas
print_header "9. ESTATÍSTICAS DO PACOTE"

if command -v stat &> /dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        SIZE=$(stat -f%z "$OUTPUT_ZIP")
    else
        SIZE=$(stat -c%s "$OUTPUT_ZIP")
    fi

    SIZE_MB=$(awk "BEGIN {print $SIZE/1024/1024}")
    print_info "Tamanho: ${SIZE_MB} MB"

    if (( $(echo "$SIZE_MB < 100" | bc -l) )); then
        print_success "✓ Tamanho OK para WhatsApp (< 100MB)"
    else
        print_warning "⚠ Tamanho acima de 100MB - pode ter problemas no WhatsApp"
    fi
fi

# Resumo final
print_header "PACOTE PRONTO!"

echo ""
echo -e "${BOLD}Arquivo ZIP criado:${NC} ${GREEN}$OUTPUT_ZIP${NC}"
echo ""
echo -e "${CYAN}Para distribuir:${NC}"
echo "1. Envie o arquivo via WhatsApp, Email, etc"
echo "2. Receptor deve extrair o ZIP"
echo "3. Receptor executa script de setup para seu SO"
echo ""
echo -e "${CYAN}Conteúdo do pacote:${NC}"
echo "  • Scripts de instalação (Windows, macOS, Linux)"
echo "  • Código-fonte dos 18 ficheiros"
echo "  • Documentação completa"
echo "  • Exemplos e testes"
echo ""
echo -e "${YELLOW}NOTA:${NC} O pacote NÃO inclui node_modules (instalado via npm install)"
echo ""

print_success "Processo concluído!"
echo ""
