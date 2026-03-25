/**
 * Script de emergência para limpar documentos antigos do KB
 * Remove documentos específicos que foram deletados mas voltaram
 */

import fs from 'fs';
import path from 'path';
import { ACTIVE_PATHS } from './lib/storage-config.js';

const kbPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');

console.log('🧹 Limpeza de Documentos Antigos do KB\n');

if (!fs.existsSync(kbPath)) {
  console.log('❌ Arquivo kb-documents.json não encontrado');
  process.exit(1);
}

// Ler KB atual
const allDocs = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
console.log(`📊 Total de documentos no KB: ${allDocs.length}\n`);

// Identificar documentos para remover
const oldKeywords = [
  'patricia',
  'patrícia',
  'guaranis',
  'guaraní',
  'ita',  // Documentos ITA antigos que foram deletados
  'alessandro',
  'espólio',
  'espolio'
];

const toRemove = allDocs.filter(doc => {
  const name = (doc.name || '').toLowerCase();
  const originalName = (doc.originalName || '').toLowerCase();
  const id = (doc.id || '').toLowerCase();

  return oldKeywords.some(keyword =>
    name.includes(keyword) ||
    originalName.includes(keyword) ||
    id.includes(keyword)
  );
});

console.log(`🔍 Documentos encontrados para remoção: ${toRemove.length}\n`);

if (toRemove.length === 0) {
  console.log('✅ Nenhum documento antigo encontrado');
  process.exit(0);
}

// Mostrar documentos que serão removidos
console.log('📋 Documentos a serem removidos:\n');
toRemove.forEach((doc, i) => {
  const uploadedAt = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('pt-BR') : 'N/A';
  console.log(`${i + 1}. ${doc.id}`);
  console.log(`   Nome: ${doc.name || doc.originalName || 'N/A'}`);
  console.log(`   Upload: ${uploadedAt}`);
  console.log(`   UserId: ${doc.userId || 'N/A'}`);
  console.log();
});

// Confirmar remoção
console.log(`⚠️  ATENÇÃO: ${toRemove.length} documentos serão PERMANENTEMENTE removidos!`);
console.log('   Pressione Ctrl+C para cancelar ou Enter para continuar...\n');

// Aguardar confirmação
await new Promise(resolve => {
  process.stdin.once('data', resolve);
});

// Remover documentos
const idsToRemove = new Set(toRemove.map(doc => doc.id));
const cleanedDocs = allDocs.filter(doc => !idsToRemove.has(doc.id));

console.log(`\n🗑️  Removendo ${toRemove.length} documentos...`);

// Backup do arquivo original
const backupPath = kbPath + '.backup.' + Date.now();
fs.copyFileSync(kbPath, backupPath);
console.log(`💾 Backup criado: ${path.basename(backupPath)}`);

// Salvar KB limpo
fs.writeFileSync(kbPath, JSON.stringify(cleanedDocs, null, 2), 'utf8');

console.log(`\n✅ KB limpo com sucesso!`);
console.log(`   Antes: ${allDocs.length} documentos`);
console.log(`   Depois: ${cleanedDocs.length} documentos`);
console.log(`   Removidos: ${toRemove.length} documentos`);
console.log(`\n🔄 Execute o endpoint de reload para atualizar o cache em todos os workers:`);
console.log(`   curl -X POST 'https://iarom.com.br/api/kb/cache/emergency-clean?secret=mota2323kb'`);
