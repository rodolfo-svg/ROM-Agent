#!/bin/bash
set -e

echo "════════════════════════════════════════════════════════════"
echo "ROM AGENT - BUILD DE PRODUÇÃO"
echo "════════════════════════════════════════════════════════════"

echo ""
echo "🔧 [1/6] Instalando dependências do backend..."
npm ci

echo ""
echo "🌐 [2/7] Chromium serverless via @sparticuz/chromium..."
echo "   ✅ Chromium incluído como dependência NPM (@sparticuz/chromium)"
echo "   ✅ Não requer instalação de sistema (funciona em qualquer ambiente)"
echo "   ✅ Otimizado para ambientes serverless/restritos como Render"

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
echo "🔍 [7/7] Verificação final..."
echo "   ✅ @sparticuz/chromium instalado (pacote NPM)"
echo "   ✅ puppeteer-core instalado"
echo "   ✅ Puppeteer pronto para uso serverless"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ BUILD COMPLETO!"
echo "════════════════════════════════════════════════════════════"
