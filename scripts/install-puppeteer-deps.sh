#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ROM Agent - Instalação de Dependências do Puppeteer no Render
# ═══════════════════════════════════════════════════════════════
# Este script instala as dependências do sistema necessárias para
# rodar Chromium/Puppeteer em ambiente Linux (Debian/Ubuntu)
# ═══════════════════════════════════════════════════════════════

set -e  # Exit on error

echo "════════════════════════════════════════════════════════════"
echo "📦 Instalando dependências do Puppeteer/Chromium"
echo "════════════════════════════════════════════════════════════"

# Verificar se estamos no Render
if [ "$RENDER" = "true" ]; then
    echo "✅ Detectado ambiente Render"

    # Render usa imagens Docker com apt disponível
    # Instalar dependências do Chromium
    echo "📥 Instalando libs do Chromium..."

    # Atualizar lista de pacotes
    apt-get update -qq || true

    # Instalar dependências essenciais do Chromium
    # Algumas podem já estar instaladas, usando || true para não falhar
    apt-get install -y --no-install-recommends \
        ca-certificates \
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libatspi2.0-0 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libgbm1 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libwayland-client0 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxkbcommon0 \
        libxrandr2 \
        xdg-utils \
        libu2f-udev \
        libvulkan1 \
        || true

    echo "✅ Dependências do sistema instaladas"

    # Limpar cache do apt para economizar espaço
    apt-get clean || true
    rm -rf /var/lib/apt/lists/* || true

else
    echo "⚠️  Não está no Render, pulando instalação de dependências do sistema"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "🌐 Instalando Chrome do Puppeteer"
echo "════════════════════════════════════════════════════════════"

# Instalar Chrome via Puppeteer (funciona em qualquer ambiente)
npx puppeteer browsers install chrome

echo "✅ Chrome instalado com sucesso"
echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Configuração do Puppeteer concluída!"
echo "════════════════════════════════════════════════════════════"
