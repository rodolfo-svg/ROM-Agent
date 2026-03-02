#!/usr/bin/env node
/**
 * Script para limpar documentos fantasmas do KB
 * Mantém apenas documentos válidos (que ainda existem no disco)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path para data/kb-documents.json
const KB_DOCS_PATH = path.join(__dirname, '..', 'data', 'kb-documents.json');

console.log('🧹 Limpando documentos fantasmas do KB...\n');

// 1. Carregar kb-documents.json
let allDocs = [];
try {
  const data = fs.readFileSync(KB_DOCS_PATH, 'utf8');
  allDocs = JSON.parse(data);
  console.log(`📊 Total de documentos no cache: ${allDocs.length}`);
} catch (error) {
  console.error('❌ Erro ao carregar kb-documents.json:', error.message);
  process.exit(1);
}

// 2. Verificar quais documentos ainda existem no disco
const validDocs = [];
const missingDocs = [];

for (const doc of allDocs) {
  if (doc.path && fs.existsSync(doc.path)) {
    validDocs.push(doc);
  } else {
    missingDocs.push(doc);
    console.log(`   ❌ Documento fantasma: ${doc.name} (id: ${doc.id})`);
    if (doc.path) {
      console.log(`      Path não existe: ${doc.path}`);
    } else {
      console.log(`      Sem path definido`);
    }
  }
}

console.log(`\n📊 Resultado da verificação:`);
console.log(`   ✅ Documentos válidos: ${validDocs.length}`);
console.log(`   ❌ Documentos fantasmas: ${missingDocs.length}`);

// 3. Perguntar ao usuário se quer continuar
if (missingDocs.length === 0) {
  console.log('\n✨ Nenhum documento fantasma encontrado! KB está limpo.');
  process.exit(0);
}

console.log(`\n⚠️  Isso vai DELETAR ${missingDocs.length} documento(s) fantasma(s) do cache.`);
console.log('   Os arquivos válidos serão mantidos.\n');

// Se rodando com flag --force, não pedir confirmação
const forceMode = process.argv.includes('--force');

if (!forceMode) {
  console.log('Para executar a limpeza, rode: npm run clean:kb -- --force');
  process.exit(0);
}

// 4. Criar backup
const backupPath = KB_DOCS_PATH + '.backup.' + Date.now();
try {
  fs.copyFileSync(KB_DOCS_PATH, backupPath);
  console.log(`💾 Backup criado: ${backupPath}\n`);
} catch (error) {
  console.error('❌ Erro ao criar backup:', error.message);
  process.exit(1);
}

// 5. Salvar apenas documentos válidos
try {
  fs.writeFileSync(KB_DOCS_PATH, JSON.stringify(validDocs, null, 2), 'utf8');
  console.log(`✅ KB limpo com sucesso!`);
  console.log(`   ${missingDocs.length} documento(s) fantasma(s) removido(s)`);
  console.log(`   ${validDocs.length} documento(s) válido(s) mantido(s)\n`);
} catch (error) {
  console.error('❌ Erro ao salvar KB limpo:', error.message);
  console.log(`🔄 Restaurando backup...`);
  fs.copyFileSync(backupPath, KB_DOCS_PATH);
  console.log('✅ Backup restaurado');
  process.exit(1);
}

// 6. Listar documentos mantidos
console.log('📄 Documentos mantidos:');
for (const doc of validDocs) {
  console.log(`   ✅ ${doc.name} (${(doc.size / 1024).toFixed(1)} KB)`);
}

console.log('\n✨ Limpeza concluída com sucesso!');
console.log(`💾 Backup disponível em: ${backupPath}`);
