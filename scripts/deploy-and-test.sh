#!/bin/bash
# DEPLOY E TESTE AUTOMÁTICO
# Sempre testa o site de PRODUÇÃO (iarom.com.br), NUNCA localhost

set -e

echo "🚀 DEPLOY E TESTE AUTOMÁTICO - PRODUÇÃO REAL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Deploy
echo "📦 Fase 1: Deploy para GitHub..."
bash scripts/deploy-now.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏳ Aguardando Render fazer build e deploy..."
echo "   Tempo estimado: 3-5 minutos"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Opções:"
echo "  1. Aguardar manualmente e rodar: node test-production-site.js"
echo "  2. Aguardar 5 minutos e testar automaticamente (recomendado)"
echo ""

read -p "Deseja aguardar 5 minutos e testar automaticamente? (s/N): " resposta

if [[ "$resposta" =~ ^[Ss]$ ]]; then
  echo ""
  echo "⏰ Aguardando 5 minutos para Render fazer deploy..."

  for i in {5..1}; do
    echo "   ${i} minutos restantes..."
    sleep 60
  done

  echo ""
  echo "🧪 Testando site de PRODUÇÃO (iarom.com.br)..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  node test-production-site.js

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ Deploy e teste completos!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
  echo ""
  echo "✅ Deploy feito!"
  echo ""
  echo "Para testar depois, rode:"
  echo "  node test-production-site.js"
  echo ""
fi
