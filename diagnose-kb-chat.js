#!/usr/bin/env node
/**
 * Script de diagnóstico: Por que o chat não vê documentos do KB?
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import kbCache from './lib/kb-cache.js';
import { ACTIVE_PATHS } from './lib/storage-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔍 DIAGNÓSTICO: Chat não localiza documentos do KB\n');
console.log('=' .repeat(70));

// 1. Estado do kbCache
console.log('\n📦 1. ESTADO DO kbCache (memória)');
console.log('-'.repeat(70));
const stats = kbCache.getStats();
console.log('Stats:', JSON.stringify(stats, null, 2));

const allDocs = kbCache.getAll();
console.log(`Total documentos em memória: ${allDocs.length}`);

if (allDocs.length > 0) {
  console.log('\nPrimeiros 3 documentos:');
  allDocs.slice(0, 3).forEach((doc, i) => {
    console.log(`  ${i+1}. Nome: ${doc.name}`);
    console.log(`     userId: ${doc.userId || 'UNDEFINED ⚠️'}`);
    console.log(`     id: ${doc.id}`);
    console.log(`     uploadedAt: ${doc.uploadedAt}`);
  });

  // Estatísticas de userId
  const comUserId = allDocs.filter(d => d.userId).length;
  const semUserId = allDocs.filter(d => !d.userId).length;
  const userIds = [...new Set(allDocs.map(d => d.userId).filter(Boolean))];

  console.log('\n  Estatísticas userId:');
  console.log(`    Com userId: ${comUserId}`);
  console.log(`    Sem userId: ${semUserId} ${semUserId > 0 ? '⚠️ PROBLEMA!' : ''}`);
  console.log(`    UserIds únicos: ${userIds.join(', ')}`);
}

// 2. Arquivo kb-documents.json
console.log('\n\n📄 2. ARQUIVO kb-documents.json (disco)');
console.log('-'.repeat(70));
const kbPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');
console.log(`Caminho: ${kbPath}`);
console.log(`Existe: ${fs.existsSync(kbPath) ? 'Sim' : 'Não'}`);

if (fs.existsSync(kbPath)) {
  const content = fs.readFileSync(kbPath, 'utf8');
  let diskDocs;
  try {
    diskDocs = JSON.parse(content);
    console.log(`Documentos no arquivo: ${Array.isArray(diskDocs) ? diskDocs.length : 'ERRO: não é array'}`);

    if (!Array.isArray(diskDocs)) {
      console.log('⚠️ PROBLEMA: kb-documents.json não é um array!');
      console.log('Conteúdo:', content.substring(0, 200));
    }
  } catch (e) {
    console.log('❌ ERRO ao parsear JSON:', e.message);
  }
}

// 3. Arquivos físicos no KB
console.log('\n\n📁 3. ARQUIVOS FÍSICOS em data/kb/documents/');
console.log('-'.repeat(70));
const kbDocsDir = path.join(ACTIVE_PATHS.kb, 'documents');
console.log(`Caminho: ${kbDocsDir}`);
console.log(`Existe: ${fs.existsSync(kbDocsDir) ? 'Sim' : 'Não'}`);

if (fs.existsSync(kbDocsDir)) {
  const files = fs.readdirSync(kbDocsDir);
  console.log(`Total de arquivos: ${files.length}`);

  if (files.length > 0) {
    console.log('\nPrimeiros 10 arquivos:');
    files.slice(0, 10).forEach((f, i) => {
      const stats = fs.statSync(path.join(kbDocsDir, f));
      console.log(`  ${i+1}. ${f} (${(stats.size / 1024).toFixed(1)} KB)`);
    });
  }
}

// 4. Comparação: Memória vs Disco vs Arquivos
console.log('\n\n📊 4. COMPARAÇÃO');
console.log('-'.repeat(70));
const filesCount = fs.existsSync(kbDocsDir) ? fs.readdirSync(kbDocsDir).length : 0;
const diskDocsCount = fs.existsSync(kbPath) ? JSON.parse(fs.readFileSync(kbPath, 'utf8')).length : 0;

console.log(`Arquivos físicos: ${filesCount}`);
console.log(`Documentos no JSON (disco): ${diskDocsCount}`);
console.log(`Documentos no kbCache (memória): ${allDocs.length}`);

if (filesCount > 0 && diskDocsCount === 0) {
  console.log('\n⚠️ PROBLEMA DETECTADO:');
  console.log('   Há arquivos físicos, mas kb-documents.json está vazio!');
  console.log('   Isso significa que o cache não foi salvo ou foi corrompido.');
}

if (filesCount !== diskDocsCount || diskDocsCount !== allDocs.length) {
  console.log('\n⚠️ INCONSISTÊNCIA:');
  console.log('   O número de arquivos, documentos no disco e na memória são diferentes.');
}

// 5. Recomendações
console.log('\n\n💡 5. RECOMENDAÇÕES');
console.log('-'.repeat(70));

if (semUserId > 0) {
  console.log('❌ PROBLEMA: Alguns documentos não têm userId definido');
  console.log('   Solução: Adicionar userId ao salvar documentos');
}

if (filesCount > diskDocsCount) {
  console.log('⚠️ PROBLEMA: Mais arquivos físicos que registros no JSON');
  console.log('   Solução: Executar reindexação do KB');
}

if (allDocs.length === 0 && filesCount > 0) {
  console.log('❌ PROBLEMA CRÍTICO: kbCache vazio mas há arquivos');
  console.log('   Solução: Forçar reload do cache ou reindexar KB');
}

console.log('\n' + '='.repeat(70));
console.log('Diagnóstico concluído\n');
