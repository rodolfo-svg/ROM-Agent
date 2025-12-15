#!/bin/bash
# PRE-PUSH HOOK - Garante versão correta antes de push
# Instalação: ln -sf ../../scripts/pre-push-hook.sh .git/hooks/pre-push

echo "🔒 PRE-PUSH: Verificando versão..."

# Rodar auto-versionamento
node scripts/auto-version.js

if [ $? -ne 0 ]; then
  echo ""
  echo "⚠️  ATENÇÃO: Versão foi atualizada automaticamente!"
  echo "   Execute novamente: git add . && git commit --amend --no-edit && git push"
  exit 1
fi

echo "✅ Versão verificada - prosseguindo com push"
exit 0
