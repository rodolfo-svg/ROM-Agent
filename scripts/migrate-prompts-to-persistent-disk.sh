#!/bin/bash
# ══════════════════════════════════════════════════════════════════
# ROM AGENT - MIGRAÇÃO DE PROMPTS PARA DISCO PERSISTENTE
# ══════════════════════════════════════════════════════════════════
# Copia prompts do repositório Git para /var/data/prompts
# Executa automaticamente no primeiro deploy com PROMPTS_FOLDER configurado
# ══════════════════════════════════════════════════════════════════

set -e  # Exit on error

echo "📝 [PROMPTS] Verificando migração para disco persistente..."

# Verificar se PROMPTS_FOLDER está configurado
if [ -z "$PROMPTS_FOLDER" ]; then
  echo "⚠️  [PROMPTS] PROMPTS_FOLDER não configurado - pulando migração"
  exit 0
fi

echo "✅ [PROMPTS] PROMPTS_FOLDER configurado: $PROMPTS_FOLDER"

# Criar diretórios no disco persistente
mkdir -p "$PROMPTS_FOLDER/global"
mkdir -p "$PROMPTS_FOLDER/partners"

echo "✅ [PROMPTS] Diretórios criados em $PROMPTS_FOLDER"

# Verificar se já existem prompts no disco persistente
if [ "$(ls -A $PROMPTS_FOLDER/global 2>/dev/null)" ]; then
  EXISTING_COUNT=$(ls -1 $PROMPTS_FOLDER/global | wc -l | tr -d ' ')
  echo "✅ [PROMPTS] Disco persistente já contém $EXISTING_COUNT prompts - pulando migração"
  echo "   (Para forçar migração, delete os arquivos em $PROMPTS_FOLDER/global)"
  exit 0
fi

# Copiar prompts do repositório Git para disco persistente
# CRÍTICO: Usar caminho absoluto baseado na localização do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SOURCE_DIR="$PROJECT_ROOT/data/prompts"

echo "📂 [PROMPTS] Diretório do projeto: $PROJECT_ROOT"
echo "📂 [PROMPTS] Diretório fonte: $SOURCE_DIR"

if [ ! -d "$SOURCE_DIR/global" ]; then
  echo "⚠️  [PROMPTS] Diretório source $SOURCE_DIR/global não encontrado"
  echo "   Criando estrutura vazia no disco persistente..."
  exit 0
fi

echo "📦 [PROMPTS] Copiando prompts do Git para disco persistente..."

# Copiar prompts globais
if [ -d "$SOURCE_DIR/global" ]; then
  cp -r "$SOURCE_DIR/global/"* "$PROMPTS_FOLDER/global/" 2>/dev/null || true
  COPIED=$(ls -1 $PROMPTS_FOLDER/global | wc -l | tr -d ' ')
  echo "✅ [PROMPTS] Copiados $COPIED prompts globais"
fi

# Copiar prompts de parceiros (se existirem)
if [ -d "$SOURCE_DIR/partners" ] && [ "$(ls -A $SOURCE_DIR/partners 2>/dev/null)" ]; then
  cp -r "$SOURCE_DIR/partners/"* "$PROMPTS_FOLDER/partners/" 2>/dev/null || true
  echo "✅ [PROMPTS] Prompts de parceiros copiados"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ MIGRAÇÃO DE PROMPTS CONCLUÍDA COM SUCESSO             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 Localização: $PROMPTS_FOLDER"
echo "📊 Prompts globais: $COPIED arquivos"
echo "🔒 Persistência: Disco persistente (seguro em redeploys)"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   - Edições de prompts agora são persistentes"
echo "   - Backup automático pelo Render.com"
echo "   - Prompts NÃO serão perdidos em redeploys"
echo ""

exit 0
