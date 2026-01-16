#!/bin/bash
set -e

echo "════════════════════════════════════════════════════════════"
echo "ROM AGENT - BUILD DE PRODUÇÃO"
echo "════════════════════════════════════════════════════════════"

echo ""
echo "🔧 [1/5] Instalando dependências do backend..."
npm ci

echo ""
echo "🧹 [2/5] Limpando build anterior do frontend..."
rm -rf frontend/dist

echo ""
echo "📦 [3/5] Instalando dependências do frontend..."
cd frontend
npm ci

echo ""
echo "🏗️ [4/5] Buildando frontend React + PWA..."
npm run build

echo ""
echo "📊 [5/5] Verificando build..."
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
echo "════════════════════════════════════════════════════════════"
echo "✅ BUILD COMPLETO!"
echo "════════════════════════════════════════════════════════════"
