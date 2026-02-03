import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Aumentando limites de timeout, output e tokens...\n');

// ═══════════════════════════════════════════════════════
// 1. AUMENTAR TOKENS NO BEDROCK.JS
// ═══════════════════════════════════════════════════════

const bedrockPath = path.join(__dirname, 'src/modules/bedrock.js');
let bedrockContent = fs.readFileSync(bedrockPath, 'utf-8');

console.log('📝 1. Atualizando limites de tokens em bedrock.js...');

// Substituir configurações de tokens
bedrockContent = bedrockContent.replace(
  /maxTokens: 32000,  \/\/ 🎯 LIMITE PADRÃO: 32K tokens \(~96K chars\) - documentos completos/,
  'maxTokens: 100000,  // 🎯 LIMITE PADRÃO: 100K tokens (~300K chars) - peças jurídicas completas'
);

bedrockContent = bedrockContent.replace(
  /maxTokensLongForm: 64000,  \/\/ 📄 LIMITE DOCUMENTOS GRANDES: 64K tokens \(~192K chars\)/,
  'maxTokensLongForm: 150000,  // 📄 LIMITE DOCUMENTOS GRANDES: 150K tokens (~450K chars) - recursos complexos'
);

// Verificar se mudou
if (bedrockContent.includes('maxTokens: 100000') && bedrockContent.includes('maxTokensLongForm: 150000')) {
  fs.writeFileSync(bedrockPath, bedrockContent, 'utf-8');
  console.log('   ✅ Tokens atualizados:');
  console.log('      - maxTokens: 32K → 100K (+213%)');
  console.log('      - maxTokensLongForm: 64K → 150K (+134%)');
} else {
  console.log('   ⚠️ Padrão não encontrado ou já atualizado');
}

// ═══════════════════════════════════════════════════════
// 2. AUMENTAR TIMEOUTS NO SLO.JS
// ═══════════════════════════════════════════════════════

const sloPath = path.join(__dirname, 'src/config/slo.js');
let sloContent = fs.readFileSync(sloPath, 'utf-8');

console.log('\n📝 2. Atualizando timeouts em slo.js...');

// Aumentar timeout HTTP async de 10min para 20min
sloContent = sloContent.replace(
  /timeout: 600_000,      \/\/ 10min \(aumentado para streaming longo\)/,
  'timeout: 1_200_000,      // 20min (aumentado para peças complexas e densas)'
);

// Aumentar timeout Bedrock de 3min para 15min
sloContent = sloContent.replace(
  /timeout: 180_000,      \/\/ 3min \(aumentado para respostas longas\)/,
  'timeout: 900_000,      // 15min (aumentado para peças maiores sem truncamento)'
);

// Verificar se mudou
const hasAsyncTimeout = sloContent.includes('timeout: 1_200_000');
const hasBedrockTimeout = sloContent.includes('timeout: 900_000');

if (hasAsyncTimeout && hasBedrockTimeout) {
  fs.writeFileSync(sloPath, sloContent, 'utf-8');
  console.log('   ✅ Timeouts atualizados:');
  console.log('      - HTTP async: 10min → 20min (+100%)');
  console.log('      - Bedrock API: 3min → 15min (+400%)');
} else {
  console.log('   ⚠️ Padrão não encontrado ou já atualizado');
  if (!hasAsyncTimeout) console.log('      - HTTP async timeout não encontrado');
  if (!hasBedrockTimeout) console.log('      - Bedrock timeout não encontrado');
}

// ═══════════════════════════════════════════════════════
// 3. SUMMARY
// ═══════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(60));
console.log('📊 RESUMO DAS ALTERAÇÕES');
console.log('═'.repeat(60));

console.log('\n🎯 TOKENS (Output):');
console.log('   Antes:');
console.log('   - Padrão: 32,000 tokens (~15 páginas)');
console.log('   - Long Form: 64,000 tokens (~30 páginas)');
console.log('');
console.log('   Depois:');
console.log('   - Padrão: 100,000 tokens (~50 páginas) 🚀');
console.log('   - Long Form: 150,000 tokens (~75 páginas) 🚀');
console.log('');
console.log('   Capacidade: Peças de até 75 páginas sem truncamento!');

console.log('\n⏱️  TIMEOUTS:');
console.log('   Antes:');
console.log('   - HTTP async: 10 minutos');
console.log('   - Bedrock API: 3 minutos (⚠️ GARGALO!)');
console.log('');
console.log('   Depois:');
console.log('   - HTTP async: 20 minutos 🚀');
console.log('   - Bedrock API: 15 minutos 🚀');
console.log('');
console.log('   Benefício: Peças complexas não travam mais!');

console.log('\n🎉 IMPACTO ESPERADO:');
console.log('   ✅ Peças de até 75 páginas (antes: ~30 páginas)');
console.log('   ✅ Sem truncamento prematuro');
console.log('   ✅ Sem timeouts em peças complexas');
console.log('   ✅ Sem quebras em meio à geração');
console.log('   ✅ Sistema não trava em execuções longas');

console.log('\n💡 PRÓXIMO PASSO:');
console.log('   Execute: npm start (para reiniciar o servidor)');

console.log('\n' + '═'.repeat(60));
console.log('✅ Limites aumentados com sucesso!');
console.log('═'.repeat(60) + '\n');
