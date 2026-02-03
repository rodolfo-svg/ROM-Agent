import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ler arquivo atual
const filePath = path.join(__dirname, 'data', 'custom-instructions', 'rom', 'custom-instructions.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

console.log('🔧 Aplicando correção final P1-4...\n');

// ═══════════════════════════════════════════════════════
// CORREÇÃO P1-4 FINAL: Atualizar linha de markdown corretamente
// ═══════════════════════════════════════════════════════

// HTML
const htmlBefore = data.components.customInstructions.content.html;
data.components.customInstructions.content.html = htmlBefore.replace(
  /<li>✗ NUNCA use markdown \(\*\*, ###, ```\) em documentos formais<\/li>/g,
  '<li>✗ NUNCA use markdown (**, ###, ```) em peças jurídicas formais (permitido em chat para clareza)</li>'
);

// Markdown
const markdownBefore = data.components.customInstructions.content.markdown;
data.components.customInstructions.content.markdown = markdownBefore.replace(
  /- ✗ NUNCA use markdown \(\*\*, ###, ```\) em documentos formais/g,
  '- ✗ NUNCA use markdown (**, ###, ```) em peças jurídicas formais (permitido em chat para clareza)'
);

// Text
const textBefore = data.components.customInstructions.content.text;
data.components.customInstructions.content.text = textBefore.replace(
  /✗ NUNCA use markdown \(\*\*, ###, ```\) em documentos formais/g,
  '✗ NUNCA use markdown (**, ###, ```) em peças jurídicas formais (permitido em chat para clareza)'
);

// Verificar se mudou
const htmlChanged = htmlBefore !== data.components.customInstructions.content.html;
const markdownChanged = markdownBefore !== data.components.customInstructions.content.markdown;
const textChanged = textBefore !== data.components.customInstructions.content.text;

console.log(`HTML changed: ${htmlChanged}`);
console.log(`Markdown changed: ${markdownChanged}`);
console.log(`Text changed: ${textChanged}`);

if (htmlChanged || markdownChanged || textChanged) {
  console.log('\n✅ P1-4: Linha de markdown atualizada com sucesso');

  // Recalcular metadata
  function recalculateMetadata(text) {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const characters = text.length;
    const tokens = Math.ceil(characters / 4);

    return {
      wordCount: words.length,
      characterCount: characters,
      estimatedTokens: tokens
    };
  }

  data.components.customInstructions.metadata = recalculateMetadata(data.components.customInstructions.content.text);
  data.lastUpdated = new Date().toISOString();

  // Salvar
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

  console.log('\n✅ Arquivo salvo com correção P1-4');
  console.log(`📊 Versão: ${data.version}`);
  console.log(`📝 Custom Instructions tokens: ${data.components.customInstructions.metadata.estimatedTokens}`);
} else {
  console.log('\n⚠️ Nenhuma mudança detectada - padrão não encontrado');
  console.log('\nLinha atual:');
  console.log(textBefore.split('\n').filter(l => l.includes('markdown')).join('\n'));
}
