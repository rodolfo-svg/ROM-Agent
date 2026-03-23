#!/usr/bin/env node
/**
 * Script para diagnosticar e corrigir cache KB localmente
 * Mostra o estado atual e oferece correções
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const kbDocsPath = path.join(rootDir, 'data', 'kb-documents.json');

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║  ROM Agent - Diagnóstico KB Cache Local                      ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');

// Verificar se arquivo existe
if (!fs.existsSync(kbDocsPath)) {
  console.error('❌ Arquivo kb-documents.json não encontrado!');
  console.error(`   Caminho esperado: ${kbDocsPath}`);
  process.exit(1);
}

// Ler e analisar
console.log('📂 Lendo kb-documents.json...');
const data = JSON.parse(fs.readFileSync(kbDocsPath, 'utf8'));
console.log(`✅ ${data.length} documentos no cache`);
console.log('');

// Buscar por Patricia
console.log('🔍 Procurando documentos de "Patricia"...');
const patriciasDocs = data.filter(doc => {
  const title = (doc.title || '').toLowerCase();
  const content = (doc.content || '').toLowerCase();
  return title.includes('patricia') || title.includes('patrícia') ||
         content.includes('patricia') || content.includes('patrícia');
});

if (patriciasDocs.length > 0) {
  console.log(`❌ ENCONTRADOS ${patriciasDocs.length} documento(s) de Patricia (FANTASMA):`);
  patriciasDocs.forEach((doc, idx) => {
    console.log(`   ${idx + 1}. ID: ${doc.id}`);
    console.log(`      Title: ${doc.title || 'N/A'}`);
    console.log(`      Size: ${doc.size || 0} bytes`);
    console.log(`      Created: ${doc.uploadedAt || doc.createdAt || 'N/A'}`);
  });
} else {
  console.log('✅ Nenhum documento de Patricia encontrado');
}
console.log('');

// Buscar por Alessandro
console.log('🔍 Procurando documentos de "Alessandro"...');
const alessandroDocs = data.filter(doc => {
  const title = (doc.title || '').toLowerCase();
  const content = (doc.content || '').toLowerCase();
  return title.includes('alessandro') || title.includes('espólio') || title.includes('espolio') ||
         content.includes('alessandro') || content.includes('espólio') || content.includes('espolio');
});

if (alessandroDocs.length > 0) {
  console.log(`✅ ENCONTRADOS ${alessandroDocs.length} documento(s) de Alessandro:`);
  alessandroDocs.forEach((doc, idx) => {
    console.log(`   ${idx + 1}. ID: ${doc.id}`);
    console.log(`      Title: ${doc.title || 'N/A'}`);
    console.log(`      Size: ${doc.size || 0} bytes`);
    console.log(`      Created: ${doc.uploadedAt || doc.createdAt || 'N/A'}`);
  });
} else {
  console.log('❌ Nenhum documento de Alessandro encontrado (PROBLEMA!)');
}
console.log('');

// Mostrar últimos 10 documentos
console.log('📊 Últimos 10 documentos (mais recentes):');
const sorted = [...data].sort((a, b) => {
  const dateA = a.uploadedAt || a.createdAt || '';
  const dateB = b.uploadedAt || b.createdAt || '';
  return dateB.localeCompare(dateA);
});

sorted.slice(0, 10).forEach((doc, idx) => {
  const date = (doc.uploadedAt || doc.createdAt || 'N/A').substring(0, 19);
  const title = (doc.title || 'N/A').substring(0, 50);
  const size = doc.size || 0;
  console.log(`   ${idx + 1}. ${date} | ${size.toString().padStart(8)} bytes | ${title}`);
});
console.log('');

// Estatísticas
console.log('📊 Estatísticas:');
console.log(`   Total de documentos: ${data.length}`);
console.log(`   Documentos Patricia (fantasmas): ${patriciasDocs.length}`);
console.log(`   Documentos Alessandro: ${alessandroDocs.length}`);
console.log(`   Tamanho do arquivo: ${(fs.statSync(kbDocsPath).size / 1024).toFixed(2)} KB`);
console.log('');

// Verificar arquivos físicos
console.log('🔍 Verificando arquivos físicos no disco...');
let ghostCount = 0;
let validCount = 0;

for (const doc of data.slice(0, 100)) { // Verificar primeiros 100 para não demorar muito
  if (doc.filePath) {
    const fullPath = path.join(rootDir, doc.filePath);
    if (fs.existsSync(fullPath)) {
      validCount++;
    } else {
      ghostCount++;
      if (ghostCount <= 5) {
        console.log(`   ❌ FANTASMA: ${doc.filePath} (não existe no disco)`);
      }
    }
  }
}

console.log(`   ✅ Documentos válidos: ${validCount}`);
console.log(`   ❌ Documentos fantasmas: ${ghostCount}`);
if (ghostCount > 5) {
  console.log(`      (mostrando apenas primeiros 5, total: ${ghostCount})`);
}
console.log('');

// Resumo
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║  RESUMO DO DIAGNÓSTICO                                        ║');
console.log('╠═══════════════════════════════════════════════════════════════╣');

if (patriciasDocs.length > 0) {
  console.log('║  ❌ Patricia encontrada no cache (FANTASMA)                   ║');
} else {
  console.log('║  ✅ Patricia não encontrada (OK)                              ║');
}

if (alessandroDocs.length > 0) {
  console.log('║  ✅ Alessandro encontrado no cache (OK)                       ║');
} else {
  console.log('║  ❌ Alessandro NÃO encontrado (PROBLEMA)                      ║');
}

if (ghostCount > 0) {
  console.log(`║  ❌ ${ghostCount.toString().padEnd(3)} documentos fantasmas (arquivo não existe)     ║`);
}

console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');

// Conclusão
console.log('💡 CONCLUSÃO:');
if (patriciasDocs.length > 0 || alessandroDocs.length === 0) {
  console.log('   ❌ Cache está DESATUALIZADO em produção');
  console.log('   ❌ Auto-reload NÃO está funcionando');
  console.log('');
  console.log('📋 SOLUÇÃO:');
  console.log('   1. Verificar logs do Render para ver se há erros');
  console.log('   2. Fazer deploy manual do cache fix');
  console.log('   3. Executar limpeza via API (quando login funcionar)');
} else {
  console.log('   ✅ Cache está correto localmente');
  console.log('   ⚠️  Problema pode estar apenas em produção');
}
