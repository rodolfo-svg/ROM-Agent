#!/bin/bash
# INSTALAR HOOKS DO GIT
# Garante que hooks automáticos estejam ativos

echo "📦 Instalando hooks do git..."

# Criar diretório de hooks se não existir
mkdir -p .git/hooks

# Instalar pre-push hook
if [ -f "scripts/pre-push-hook.sh" ]; then
  chmod +x scripts/pre-push-hook.sh
  ln -sf ../../scripts/pre-push-hook.sh .git/hooks/pre-push
  chmod +x .git/hooks/pre-push
  echo "✅ Hook pre-push instalado"
else
  echo "⚠️  Arquivo scripts/pre-push-hook.sh não encontrado"
fi

# Instalar pre-commit hook (futuro)
# ln -sf ../../scripts/pre-commit-hook.sh .git/hooks/pre-commit

echo ""
echo "✅ Hooks instalados com sucesso!"
echo ""
echo "Agora toda vez que você fizer git push:"
echo "  1. Versão será verificada automaticamente"
echo "  2. Se houver novas features, versão será atualizada"
echo "  3. Push só acontece se tudo estiver correto"
echo ""
