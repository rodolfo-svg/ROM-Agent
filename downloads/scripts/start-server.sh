#!/bin/bash

# ROM Agent - Iniciar Servidor Web
# Acesso: http://localhost:3000 ou http://SEU_IP:3000

cd "$(dirname "$0")/../.."

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              ROM AGENT - SERVIDOR WEB                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Obter IP local
IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')

echo "Iniciando servidor..."
echo ""
echo "Acesse de qualquer dispositivo na mesma rede:"
echo "  📱 http://$IP:3000"
echo "  💻 http://localhost:3000"
echo ""
echo "Para parar: Ctrl+C"
echo ""

node src/server.js
