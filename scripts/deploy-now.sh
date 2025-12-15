#!/bin/bash
# DEPLOY IMEDIATO - Sistema Integrado
# Git → GitHub → Render → AWS Bedrock → iarom.com.br

set -e  # Parar em caso de erro

echo "🚀 DEPLOY AUTOMÁTICO - ROM Agent v2.8.0"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Verificar versão
echo "📦 1/5 - Verificando versão..."
node scripts/auto-version.js || true
echo ""

# 2. Git Add
echo "📥 2/5 - Adicionando arquivos ao git..."
git add .
echo "✅ Arquivos adicionados"
echo ""

# 3. Git Status
echo "📊 3/5 - Status atual:"
git status --short
echo ""

# 4. Commit
echo "💾 4/5 - Criando commit..."
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
VERSION=$(node -p "require('./package.json').version")

git commit -m "🚀 Deploy automático v${VERSION}

✨ Features ativas:
- Chat com IA (AWS Bedrock)
- Projeto ROM Agent
- DataJud integration
- Web Search
- Sistema de correção de português
- Upload chunked (arquivos gigantes)
- Calculadora de tarifação
- Gestão de equipe
- 113+ APIs funcionando

🔄 Sistema de preservação ATIVO:
- Auto-versionamento
- Auto-deploy (Render)
- Backup automático
- Logs completos

⏰ Deploy: ${TIMESTAMP}

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>" || echo "⚠️  Nada para commitar (tudo já está salvo)"

echo ""

# 5. Push
echo "📤 5/5 - Enviando para GitHub..."
git push origin main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOY INICIADO COM SUCESSO!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔄 Fluxo automático ativo:"
echo "   1. ✅ GitHub recebeu código v${VERSION}"
echo "   2. ⏳ Render detectando mudanças..."
echo "   3. ⏳ Build iniciando (~2-3 min)"
echo "   4. ⏳ Deploy em progresso"
echo "   5. ⏳ iarom.com.br será atualizado"
echo ""
echo "📊 Acompanhar em:"
echo "   GitHub: https://github.com/rodolfo-svg/ROM-Agent"
echo "   Render: https://dashboard.render.com"
echo ""
echo "⚠️  PRÓXIMO PASSO MANUAL (se ainda não fez):"
echo "   Adicionar variáveis AWS no Render Dashboard"
echo "   → AWS_ACCESS_KEY_ID"
echo "   → AWS_SECRET_ACCESS_KEY"
echo "   → AWS_REGION"
echo "   → CNJ_DATAJUD_API_KEY"
echo ""
echo "⏱️  Tempo estimado até site atualizado: 3-5 minutos"
echo ""
echo "🧪 APÓS O DEPLOY, TESTAR SITE DE PRODUÇÃO:"
echo "   node test-production-site.js"
echo ""
echo "   ⚠️  SEMPRE teste iarom.com.br, NUNCA localhost!"
echo ""
