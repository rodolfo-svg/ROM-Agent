#!/bin/bash
# Script para processar logs já copiados do Render Dashboard

echo "════════════════════════════════════════════════════════════"
echo "RENDER LOG PROCESSOR - Extrair informações do build"
echo "════════════════════════════════════════════════════════════"
echo ""

# Verificar se arquivo de logs foi fornecido
if [ -z "$1" ]; then
  echo "❌ Nenhum arquivo de logs fornecido!"
  echo ""
  echo "USO:"
  echo "   $0 <arquivo-de-logs.txt>"
  echo ""
  echo "COMO OBTER OS LOGS:"
  echo "1. Abra: https://dashboard.render.com/web/srv-d5aqg0hr0fns73dmiis0/logs"
  echo "2. No filtro de tempo, coloque: 01:39:00 até 01:43:00"
  echo "3. Copie TODOS os logs visíveis (Ctrl+A, Ctrl+C)"
  echo "4. Salve em um arquivo: render-logs.txt"
  echo "5. Execute: bash $0 render-logs.txt"
  echo ""
  exit 1
fi

INPUT_FILE="$1"

if [ ! -f "$INPUT_FILE" ]; then
  echo "❌ Arquivo não encontrado: $INPUT_FILE"
  exit 1
fi

echo "📂 Processando arquivo: $INPUT_FILE"
echo "   Tamanho: $(du -h "$INPUT_FILE" | cut -f1)"
echo "   Linhas: $(wc -l < "$INPUT_FILE")"
echo ""

# Criar arquivo de saída
OUTPUT_FILE="build-analysis-$(date +%Y%m%d-%H%M%S).txt"

# Buscar seções importantes
echo "🔍 Extraindo informações do build..."
echo ""

{
  echo "════════════════════════════════════════════════════════════"
  echo "ANÁLISE DE BUILD - $(date)"
  echo "════════════════════════════════════════════════════════════"
  echo ""

  # 1. INÍCIO DO BUILD
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "1. INÍCIO DO BUILD"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  grep -E "(Downloading cache|Cloning from|Checking out commit|Using Node|Running build command)" "$INPUT_FILE" | head -20
  echo ""

  # 2. INSTALAÇÃO DO QPDF
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "2. INSTALAÇÃO DO QPDF [CRÍTICO]"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  grep -E "(qpdf|QPDF|Instalando qpdf|Baixando qpdf|\.deb)" "$INPUT_FILE" || echo "⚠️  NENHUMA MENÇÃO A QPDF ENCONTRADA!"
  echo ""

  # 3. ETAPAS DO BUILD
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "3. ETAPAS DO BUILD"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  grep -E "\[([0-9]/[0-9]|[0-9]\.[0-9]/[0-9])\]" "$INPUT_FILE" || echo "Nenhuma etapa de build encontrada"
  echo ""

  # 4. ERROS E AVISOS
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "4. ERROS E AVISOS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  grep -iE "(error|erro|failed|falha|warning|aviso|❌|⚠️)" "$INPUT_FILE" | grep -v "Redis error" | head -20 || echo "✅ Nenhum erro encontrado"
  echo ""

  # 5. STATUS FINAL
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "5. STATUS FINAL DO BUILD"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  grep -E "(Build successful|Build failed|BUILD COMPLETO|Deploying)" "$INPUT_FILE" | tail -10
  echo ""

  # 6. INÍCIO DO SERVIDOR
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "6. INICIALIZAÇÃO DO SERVIDOR"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  grep -E "(╔══════════════|ROM|Servidor Web|Workers ativos|qpdf disponível|qpdf não encontrado)" "$INPUT_FILE" | head -20
  echo ""

  echo "════════════════════════════════════════════════════════════"
  echo "FIM DA ANÁLISE"
  echo "════════════════════════════════════════════════════════════"

} > "$OUTPUT_FILE"

echo "✅ Análise concluída!"
echo "   Arquivo gerado: $OUTPUT_FILE"
echo ""

# Mostrar resultado
cat "$OUTPUT_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PRÓXIMOS PASSOS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Se qpdf NÃO aparece nos logs:"
echo "   → O build script não foi executado corretamente"
echo "   → Verifique se commit 253357d foi deployado"
echo ""
echo "2. Se qpdf foi instalado:"
echo "   → Teste: https://iarom.com.br/api/kb/merge-volumes/check-tools"
echo "   → Deve mostrar: installed: true"
echo ""
echo "3. Se check-tools mostra qpdf instalado:"
echo "   → Teste o merge de 3 volumes (246MB)"
echo "   → Deve usar qpdf automaticamente"
echo ""
