#!/bin/bash
#
# ROM Agent - Atualizador automático da chave DataJud (CNJ)
#
# Uso: ./atualizar-datajud-key.sh
# Cron (diário): 0 6 * * * /path/to/atualizar-datajud-key.sh
#

set -e

WIKI_URL="https://datajud-wiki.cnj.jus.br/api-publica/acesso/"
ZSHRC="$HOME/.zshrc"
LOG_FILE="$HOME/rom-agent/logs/datajud-key-update.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Criar diretório de logs se não existir
mkdir -p "$(dirname "$LOG_FILE")"

log "Iniciando atualização da chave DataJud..."

# Buscar página do CNJ e extrair a chave
# A chave está em formato Base64 e geralmente aparece em um bloco de código
NEW_KEY=$(curl -sL "$WIKI_URL" | \
    grep -oE '[a-zA-Z0-9+/]{40,}==' | \
    head -1)

if [ -z "$NEW_KEY" ]; then
    log "ERRO: Não foi possível extrair a chave da página do CNJ"
    exit 1
fi

log "Chave encontrada: ${NEW_KEY:0:20}..."

# Verificar se a chave já está no .zshrc
CURRENT_KEY=$(grep 'DATAJUD_API_KEY=' "$ZSHRC" 2>/dev/null | sed 's/.*="//' | sed 's/"//' || echo "")

if [ "$CURRENT_KEY" = "$NEW_KEY" ]; then
    log "Chave já está atualizada. Nenhuma alteração necessária."
    exit 0
fi

# Fazer backup do .zshrc
cp "$ZSHRC" "$ZSHRC.backup.$(date +%Y%m%d)"

# Atualizar ou adicionar a chave
if grep -q 'DATAJUD_API_KEY=' "$ZSHRC"; then
    # Substituir chave existente
    sed -i '' "s|export DATAJUD_API_KEY=.*|export DATAJUD_API_KEY=\"$NEW_KEY\"|" "$ZSHRC"
    log "Chave atualizada no .zshrc"
else
    # Adicionar nova entrada
    echo "" >> "$ZSHRC"
    echo "# API DataJud (CNJ) - Atualizado automaticamente" >> "$ZSHRC"
    echo "export DATAJUD_API_KEY=\"$NEW_KEY\"" >> "$ZSHRC"
    log "Chave adicionada ao .zshrc"
fi

# Também atualizar o arquivo de configuração do ROM Agent
CONFIG_FILE="$HOME/rom-agent/config/datajud.env"
echo "DATAJUD_API_KEY=$NEW_KEY" > "$CONFIG_FILE"
echo "DATAJUD_KEY_UPDATED=$(date -Iseconds)" >> "$CONFIG_FILE"
log "Configuração salva em $CONFIG_FILE"

log "Atualização concluída com sucesso!"
echo ""
echo "Para aplicar agora, execute: source ~/.zshrc"
