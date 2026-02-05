#!/bin/bash
# Script para limpar KB diretamente no Render Shell
# Copie e cole estes comandos no terminal do Render

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🧹 LIMPEZA COMPLETA DO KNOWLEDGE BASE                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Navegar para diretório correto
cd /opt/render/project/src

# Criar backup
echo "📦 Criando backup..."
mkdir -p data/.backup-kb/manual-$(date +%Y%m%d-%H%M%S)
cp data/kb-documents.json data/.backup-kb/manual-$(date +%Y%m%d-%H%M%S)/ 2>/dev/null || echo "   (kb-documents.json não existe)"
tar -czf data/.backup-kb/manual-$(date +%Y%m%d-%H%M%S)/kb-documents.tar.gz data/knowledge-base/documents/ 2>/dev/null || echo "   (knowledge-base/documents/ não existe)"
echo "✅ Backup criado"
echo ""

# Estatísticas antes
echo "📊 Estatísticas ANTES da limpeza:"
echo -n "   Documentos em kb-documents.json: "
cat data/kb-documents.json 2>/dev/null | jq 'length' 2>/dev/null || echo "0 (arquivo não existe)"
echo -n "   Ficheiros estruturados: "
ls -1 data/knowledge-base/documents/ 2>/dev/null | wc -l || echo "0"
echo -n "   Textos extraídos: "
ls -1 data/extracted-texts/ 2>/dev/null | wc -l || echo "0"
echo ""

# Deletar tudo
echo "🗑️  Deletando arquivos..."
rm -f data/kb-documents.json 2>/dev/null && echo "   ✅ kb-documents.json deletado" || echo "   ⏭️  kb-documents.json não existia"
rm -rf data/knowledge-base/documents/* 2>/dev/null && echo "   ✅ Ficheiros estruturados deletados" || echo "   ⏭️  Sem ficheiros estruturados"
rm -rf data/extracted-texts/* 2>/dev/null && echo "   ✅ Textos extraídos deletados" || echo "   ⏭️  Sem textos extraídos"
echo ""

# Recriar estrutura
echo "📁 Recriando estrutura..."
mkdir -p data/knowledge-base/documents
mkdir -p data/extracted-texts
echo "[]" > data/kb-documents.json
chmod 755 data/knowledge-base/documents
chmod 644 data/kb-documents.json
echo "   ✅ Estrutura recriada"
echo ""

# Estatísticas depois
echo "📊 Estatísticas DEPOIS da limpeza:"
echo -n "   Documentos em kb-documents.json: "
cat data/kb-documents.json | jq 'length'
echo -n "   Ficheiros estruturados: "
ls -1 data/knowledge-base/documents/ | wc -l
echo -n "   Textos extraídos: "
ls -1 data/extracted-texts/ | wc -l
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ LIMPEZA CONCLUÍDA COM SUCESSO                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "💡 Próximos passos:"
echo "   1. Ir para iarom.com.br → KB Tab"
echo "   2. Upload do Alessandro Ribeiro"
echo "   3. Clicar em Analisar → Complete → Sonnet"
echo "   4. Testar no chat"
