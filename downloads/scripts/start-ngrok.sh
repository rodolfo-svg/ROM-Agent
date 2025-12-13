#!/bin/bash

# ROM Agent - Expor para Internet com Ngrok
# Permite acesso de qualquer lugar (smartphones fora da rede local)

cd "$(dirname "$0")/../.."

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         ROM AGENT - ACESSO REMOTO (NGROK)                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Verificar se ngrok está instalado
if ! command -v ngrok &> /dev/null; then
    echo "❌ Ngrok não encontrado!"
    echo ""
    echo "Instale com:"
    echo "  brew install ngrok"
    echo ""
    echo "Ou baixe em: https://ngrok.com/download"
    exit 1
fi

# Iniciar servidor em background se não estiver rodando
if ! lsof -i:3000 &> /dev/null; then
    echo "📦 Iniciando servidor ROM Agent..."
    node src/server.js &
    sleep 3
fi

echo "🌐 Expondo para internet..."
echo ""
echo "A URL pública aparecerá abaixo. Use-a no smartphone:"
echo ""

ngrok http 3000
