#!/bin/bash
set -e

echo "════════════════════════════════════════════════════════════"
echo "ROM AGENT - BUILD DE PRODUÇÃO"
echo "════════════════════════════════════════════════════════════"

echo ""
echo "🔧 [1/6] Instalando dependências do backend..."
npm ci

echo ""
echo "🌐 [2/7] Instalando Chromium via apt (Render não processa Aptfile)..."

# Render web services NÃO processam Aptfile automaticamente
# Precisamos instalar Chromium manualmente com sudo

if command -v chromium-browser &> /dev/null; then
  echo "   ✅ Chromium já instalado: $(chromium-browser --version 2>&1 | head -1)"
elif command -v chromium &> /dev/null; then
  echo "   ✅ Chromium já instalado (comando alternativo)"
else
  echo "   📦 Instalando Chromium e dependências..."

  # Atualizar lista de pacotes
  sudo apt-get update -qq

  # Instalar Chromium e dependências essenciais
  sudo apt-get install -y -qq \
    chromium-browser \
    chromium-chromedriver \
    fonts-liberation \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm1

  # Verificar instalação
  if command -v chromium-browser &> /dev/null; then
    echo "   ✅ Chromium instalado: $(chromium-browser --version 2>&1 | head -1)"
    echo "   Path: $(which chromium-browser)"
  else
    echo "   ⚠️ Chromium não foi instalado, Puppeteer pode não funcionar"
  fi
fi

echo ""
echo "🧹 [3/7] Limpando build anterior do frontend..."
rm -rf frontend/dist

echo ""
echo "📦 [4/7] Instalando dependências do frontend..."
cd frontend
npm ci

echo ""
echo "🏗️ [5/7] Buildando frontend React + PWA..."
npm run build

echo ""
echo "📊 [6/7] Verificando build..."
cd ..

if [ ! -d "frontend/dist" ]; then
  echo "❌ ERRO CRÍTICO: frontend/dist não foi criado!"
  exit 1
fi

if [ ! -f "frontend/dist/index.html" ]; then
  echo "❌ ERRO CRÍTICO: frontend/dist/index.html não existe!"
  exit 1
fi

echo ""
echo "✅ Build verificado com sucesso!"
echo ""
echo "📁 Arquivos gerados em frontend/dist:"
ls -lh frontend/dist/ | head -20

echo ""
echo "🔍 [7/7] Verificação final do Chromium..."
if command -v chromium-browser &> /dev/null; then
  echo "   ✅ Chromium disponível: $(which chromium-browser)"
  echo "   ✅ Puppeteer pronto para uso"
else
  echo "   ⚠️ Chromium não encontrado - Puppeteer não funcionará"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ BUILD COMPLETO!"
echo "════════════════════════════════════════════════════════════"
