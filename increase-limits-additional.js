import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Aumentando limites adicionais de tokens...\n');

let changesCount = 0;

// ═══════════════════════════════════════════════════════
// 1. SERVER-ENHANCED.JS - maxTokens padrão para stream
// ═══════════════════════════════════════════════════════

console.log('📝 1. Atualizando server-enhanced.js...');

const serverPath = path.join(__dirname, 'src/server-enhanced.js');
let serverContent = fs.readFileSync(serverPath, 'utf-8');

// Aumentar de 16384 para 100000
serverContent = serverContent.replace(
  /maxTokens = 16384        \/\/ ✅ AUMENTADO: 8192 → 16384 para artifacts grandes/g,
  'maxTokens = 100000        // ✅ AUMENTADO: 16384 → 100K para peças completas sem truncamento'
);

if (serverContent.includes('maxTokens = 100000')) {
  fs.writeFileSync(serverPath, serverContent, 'utf-8');
  console.log('   ✅ maxTokens: 16K → 100K (padrão para streaming)');
  changesCount++;
} else {
  console.log('   ⚠️ Padrão não encontrado ou já atualizado');
}

// ═══════════════════════════════════════════════════════
// 2. BEDROCK-HELPER.JS - Helper para chamadas simples
// ═══════════════════════════════════════════════════════

console.log('\n📝 2. Atualizando bedrock-helper.js...');

const helperPath = path.join(__dirname, 'src/utils/bedrock-helper.js');
let helperContent = fs.readFileSync(helperPath, 'utf-8');

// Aumentar de 1024 para 8192 (respostas simples não precisam de tanto)
helperContent = helperContent.replace(
  /maxTokens = 1024,/g,
  'maxTokens = 8192,'
);

if (helperContent.includes('maxTokens = 8192')) {
  fs.writeFileSync(helperPath, helperContent, 'utf-8');
  console.log('   ✅ maxTokens: 1K → 8K (helper padrão)');
  changesCount++;
} else {
  console.log('   ⚠️ Padrão não encontrado ou já atualizado');
}

// ═══════════════════════════════════════════════════════
// 3. BEDROCK-AVANCADO.JS - Múltiplas ocorrências
// ═══════════════════════════════════════════════════════

console.log('\n📝 3. Atualizando bedrockAvancado.js...');

const avancadoPath = path.join(__dirname, 'src/modules/bedrockAvancado.js');
let avancadoContent = fs.readFileSync(avancadoPath, 'utf-8');

// Aumentar todas as ocorrências de maxTokens = 2000 para 16000
avancadoContent = avancadoContent.replace(
  /maxTokens = 2000/g,
  'maxTokens = 16000'
);

// Aumentar maxTokens: 4000 para maxTokens: 32000
avancadoContent = avancadoContent.replace(
  /maxTokens: 4000/g,
  'maxTokens: 32000'
);

if (avancadoContent.includes('maxTokens = 16000') && avancadoContent.includes('maxTokens: 32000')) {
  fs.writeFileSync(avancadoPath, avancadoContent, 'utf-8');
  console.log('   ✅ maxTokens: 2K → 16K e 4K → 32K (módulo avançado)');
  changesCount++;
} else {
  console.log('   ⚠️ Padrão não encontrado ou já atualizado');
}

// ═══════════════════════════════════════════════════════
// 4. JURISPRUDENCIA.JS - Respostas de jurisprudência
// ═══════════════════════════════════════════════════════

console.log('\n📝 4. Atualizando jurisprudencia.js...');

const jurisPath = path.join(__dirname, 'src/modules/jurisprudencia.js');
let jurisContent = fs.readFileSync(jurisPath, 'utf-8');

// Aumentar de 4096 para 16384
jurisContent = jurisContent.replace(
  /maxTokens = 4096/g,
  'maxTokens = 16384'
);

if (jurisContent.includes('maxTokens = 16384')) {
  fs.writeFileSync(jurisPath, jurisContent, 'utf-8');
  console.log('   ✅ maxTokens: 4K → 16K (jurisprudência)');
  changesCount++;
} else {
  console.log('   ⚠️ Padrão não encontrado ou já atualizado');
}

// ═══════════════════════════════════════════════════════
// 5. BEDROCK-TOOLS.JS - Ferramentas do sistema
// ═══════════════════════════════════════════════════════

console.log('\n📝 5. Atualizando bedrock-tools.js...');

const toolsPath = path.join(__dirname, 'src/modules/bedrock-tools.js');
let toolsContent = fs.readFileSync(toolsPath, 'utf-8');

// Aumentar de 4096 para 16384
toolsContent = toolsContent.replace(
  /maxTokens = 4096,/g,
  'maxTokens = 16384,'
);

if (toolsContent.includes('maxTokens = 16384')) {
  fs.writeFileSync(toolsPath, toolsContent, 'utf-8');
  console.log('   ✅ maxTokens: 4K → 16K (tools)');
  changesCount++;
} else {
  console.log('   ⚠️ Padrão não encontrado ou já atualizado');
}

// ═══════════════════════════════════════════════════════
// 6. CONTEXT-MANAGER.JS - Gerenciador de contexto
// ═══════════════════════════════════════════════════════

console.log('\n📝 6. Atualizando context-manager.js...');

const contextPath = path.join(__dirname, 'src/utils/context-manager.js');
let contextContent = fs.readFileSync(contextPath, 'utf-8');

// Aumentar maxTokens de 30000 para 80000 em extractRelevantSections
contextContent = contextContent.replace(
  /maxTokens = 30000\)/g,
  'maxTokens = 80000)'
);

// Aumentar maxTokens de 20000 para 60000 em truncateHistory
contextContent = contextContent.replace(
  /maxTokens = 20000\)/g,
  'maxTokens = 60000)'
);

if (contextContent.includes('maxTokens = 80000') && contextContent.includes('maxTokens = 60000')) {
  fs.writeFileSync(contextPath, contextContent, 'utf-8');
  console.log('   ✅ maxTokens: 30K → 80K (extractRelevantSections)');
  console.log('   ✅ maxTokens: 20K → 60K (truncateHistory)');
  changesCount++;
} else {
  console.log('   ⚠️ Padrão não encontrado ou já atualizado');
}

// ═══════════════════════════════════════════════════════
// 7. SUMMARY
// ═══════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(60));
console.log('📊 RESUMO DAS ALTERAÇÕES ADICIONAIS');
console.log('═'.repeat(60));

console.log('\n🔧 Arquivos Modificados: ' + changesCount + '/6');

console.log('\n📈 Novos Limites por Módulo:');
console.log('   1. server-enhanced.js (streaming): 100K tokens');
console.log('   2. bedrock-helper.js (helper): 8K tokens');
console.log('   3. bedrockAvancado.js: 16K-32K tokens');
console.log('   4. jurisprudencia.js: 16K tokens');
console.log('   5. bedrock-tools.js: 16K tokens');
console.log('   6. context-manager.js: 60K-80K tokens');

console.log('\n🎯 Hierarquia de Limites:');
console.log('   ┌─ Peças Jurídicas Completas: 100K tokens (~50 páginas)');
console.log('   ├─ Documentos Grandes/Recursos: 150K tokens (~75 páginas)');
console.log('   ├─ Gerenciamento de Contexto: 60K-80K tokens');
console.log('   ├─ Módulos Especializados: 16K-32K tokens');
console.log('   └─ Respostas Simples: 8K tokens');

console.log('\n✅ Benefícios:');
console.log('   ✅ Streaming de peças até 100K tokens sem truncamento');
console.log('   ✅ Context manager mantém mais histórico');
console.log('   ✅ Ferramentas com respostas mais completas');
console.log('   ✅ Jurisprudência com análises mais detalhadas');
console.log('   ✅ Módulo avançado com maior capacidade');

if (changesCount === 6) {
  console.log('\n🎉 Todos os limites foram aumentados com sucesso!');
} else {
  console.log('\n⚠️ Alguns arquivos podem já estar atualizados ou ter padrões diferentes.');
}

console.log('\n💡 PRÓXIMO PASSO:');
console.log('   Execute: npm start (para reiniciar o servidor)');

console.log('\n' + '═'.repeat(60));
console.log('✅ Limites adicionais configurados!');
console.log('═'.repeat(60) + '\n');
