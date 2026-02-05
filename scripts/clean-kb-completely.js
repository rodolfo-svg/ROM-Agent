#!/usr/bin/env node
/**
 * Script de Limpeza COMPLETA do Knowledge Base
 *
 * Remove TODOS os documentos, ficheiros estruturados e metadados
 * Use com CUIDADO - operação IRREVERSÍVEL
 *
 * Uso:
 *   node scripts/clean-kb-completely.js
 *   node scripts/clean-kb-completely.js --confirm
 *
 * O que será deletado:
 * 1. data/kb-documents.json → Lista principal de documentos
 * 2. data/knowledge-base/documents/ → Ficheiros estruturados (FICHAMENTO, etc.)
 * 3. data/extracted-texts/ → Textos extraídos (cache)
 * 4. KB/documents/ → Sistema antigo (se existir)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

// Detectar se está em produção (Render) ou local
const isProduction = process.env.RENDER === 'true';
const DATA_DIR = isProduction
  ? '/opt/render/project/src/data'
  : path.join(ROOT_DIR, 'data');

// Diretórios/arquivos a limpar
const PATHS_TO_CLEAN = [
  // Sistema novo (V2)
  {
    path: path.join(DATA_DIR, 'kb-documents.json'),
    type: 'file',
    description: 'Lista principal de documentos'
  },
  {
    path: path.join(DATA_DIR, 'knowledge-base', 'documents'),
    type: 'directory',
    description: 'Ficheiros estruturados (FICHAMENTO, ANALISE, CRONOLOGIA, etc.)'
  },
  {
    path: path.join(DATA_DIR, 'extracted-texts'),
    type: 'directory',
    description: 'Textos extraídos (cache Nova Micro)'
  },
  // Sistema antigo (se existir)
  {
    path: path.join(ROOT_DIR, 'KB', 'documents'),
    type: 'directory',
    description: 'Sistema antigo de KB'
  }
];

/**
 * Pergunta ao usuário para confirmar
 */
async function askConfirmation() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\n⚠️  ATENÇÃO: Esta operação é IRREVERSÍVEL!\n');
    console.log('Os seguintes itens serão PERMANENTEMENTE DELETADOS:\n');

    PATHS_TO_CLEAN.forEach((item, i) => {
      const exists = fs.existsSync(item.path);
      const status = exists ? '✅ existe' : '❌ não existe';
      console.log(`${i + 1}. ${item.description}`);
      console.log(`   ${item.path}`);
      console.log(`   Status: ${status}\n`);
    });

    rl.question('Tem certeza que deseja continuar? Digite "LIMPAR TUDO" para confirmar: ', (answer) => {
      rl.close();
      resolve(answer.toUpperCase() === 'LIMPAR TUDO');
    });
  });
}

/**
 * Conta arquivos em um diretório recursivamente
 */
function countFilesInDir(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;

  let count = 0;
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      count += countFilesInDir(fullPath);
    } else {
      count++;
    }
  }

  return count;
}

/**
 * Calcula tamanho total de um diretório
 */
function getDirSize(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;

  let totalSize = 0;
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      totalSize += getDirSize(fullPath);
    } else {
      totalSize += stats.size;
    }
  }

  return totalSize;
}

/**
 * Formata bytes em formato legível
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Deleta diretório recursivamente
 */
function deleteDirRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;

  let deletedCount = 0;
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      deletedCount += deleteDirRecursive(fullPath);
      fs.rmdirSync(fullPath);
    } else {
      fs.unlinkSync(fullPath);
      deletedCount++;
    }
  }

  return deletedCount;
}

/**
 * Limpa um item (arquivo ou diretório)
 */
function cleanItem(item) {
  if (!fs.existsSync(item.path)) {
    console.log(`   ⏭️  Pulando (não existe): ${item.path}`);
    return { deleted: 0, spaceSaved: 0 };
  }

  let deleted = 0;
  let spaceSaved = 0;

  if (item.type === 'file') {
    const stats = fs.statSync(item.path);
    spaceSaved = stats.size;
    fs.unlinkSync(item.path);
    deleted = 1;
    console.log(`   ✅ Arquivo deletado: ${item.path} (${formatBytes(spaceSaved)})`);
  } else if (item.type === 'directory') {
    spaceSaved = getDirSize(item.path);
    deleted = deleteDirRecursive(item.path);
    fs.rmdirSync(item.path);
    console.log(`   ✅ Diretório deletado: ${item.path}`);
    console.log(`      ${deleted} arquivo(s) deletado(s), ${formatBytes(spaceSaved)} liberado(s)`);
  }

  return { deleted, spaceSaved };
}

/**
 * Backup antes de limpar
 */
function createBackup() {
  const backupDir = path.join(DATA_DIR, '.backup-kb');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `backup-${timestamp}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  fs.mkdirSync(backupPath, { recursive: true });

  console.log('\n📦 Criando backup antes de limpar...');

  // Backup kb-documents.json
  const kbDocsPath = path.join(DATA_DIR, 'kb-documents.json');
  if (fs.existsSync(kbDocsPath)) {
    fs.copyFileSync(kbDocsPath, path.join(backupPath, 'kb-documents.json'));
    console.log('   ✅ kb-documents.json → backup');
  }

  console.log(`   📂 Backup salvo em: ${backupPath}\n`);
  return backupPath;
}

/**
 * Função principal
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  🧹 LIMPEZA COMPLETA DO KNOWLEDGE BASE                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Verificar se está rodando com --confirm (modo não-interativo)
  const autoConfirm = process.argv.includes('--confirm');

  if (!autoConfirm) {
    const confirmed = await askConfirmation();

    if (!confirmed) {
      console.log('\n❌ Operação cancelada pelo usuário.\n');
      process.exit(0);
    }
  } else {
    console.log('⚠️  Modo automático (--confirm): Limpeza será executada sem confirmação!\n');
  }

  console.log('\n🚀 Iniciando limpeza...\n');

  // Criar backup
  const backupPath = createBackup();

  // Estatísticas antes
  console.log('📊 Estatísticas antes da limpeza:\n');
  let totalFilesBefore = 0;
  let totalSizeBefore = 0;

  PATHS_TO_CLEAN.forEach((item) => {
    if (fs.existsSync(item.path)) {
      if (item.type === 'file') {
        const stats = fs.statSync(item.path);
        console.log(`   ${item.description}: ${formatBytes(stats.size)}`);
        totalSizeBefore += stats.size;
        totalFilesBefore += 1;
      } else if (item.type === 'directory') {
        const count = countFilesInDir(item.path);
        const size = getDirSize(item.path);
        console.log(`   ${item.description}: ${count} arquivo(s), ${formatBytes(size)}`);
        totalFilesBefore += count;
        totalSizeBefore += size;
      }
    }
  });

  console.log(`\n   Total: ${totalFilesBefore} arquivo(s), ${formatBytes(totalSizeBefore)}\n`);

  // Executar limpeza
  console.log('🗑️  Deletando arquivos...\n');
  let totalDeleted = 0;
  let totalSpaceSaved = 0;

  PATHS_TO_CLEAN.forEach((item, i) => {
    console.log(`${i + 1}. Limpando: ${item.description}`);
    const result = cleanItem(item);
    totalDeleted += result.deleted;
    totalSpaceSaved += result.spaceSaved;
  });

  // Recriar diretórios vazios
  console.log('\n📁 Recriando estrutura de diretórios...\n');
  const dirsToRecreate = [
    path.join(DATA_DIR, 'knowledge-base', 'documents'),
    path.join(DATA_DIR, 'extracted-texts')
  ];

  dirsToRecreate.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`   ✅ Criado: ${dir}`);
    }
  });

  // Criar kb-documents.json vazio
  const kbDocsPath = path.join(DATA_DIR, 'kb-documents.json');
  fs.writeFileSync(kbDocsPath, '[]', 'utf8');
  console.log(`   ✅ Criado: kb-documents.json (array vazio)`);

  // Resultado final
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ LIMPEZA CONCLUÍDA COM SUCESSO                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('📊 Estatísticas:\n');
  console.log(`   Arquivos deletados: ${totalDeleted}`);
  console.log(`   Espaço liberado: ${formatBytes(totalSpaceSaved)}`);
  console.log(`   Backup salvo em: ${backupPath}\n`);

  console.log('✅ Knowledge Base está limpo e pronto para uso!\n');
  console.log('💡 Próximos passos:');
  console.log('   1. Fazer upload do documento Alessandro Ribeiro');
  console.log('   2. Clicar em "Analisar" → Complete → Sonnet');
  console.log('   3. Aguardar processamento (~3-4 minutos)');
  console.log('   4. Testar no chat\n');
}

// Executar
main().catch((error) => {
  console.error('\n❌ Erro ao limpar KB:', error);
  process.exit(1);
});
