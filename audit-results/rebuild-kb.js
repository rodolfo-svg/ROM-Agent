#!/usr/bin/env node
/**
 * REBUILD KB SCRIPT
 *
 * Script para reconstruir kb-documents.json a partir de arquivos órfãos em data/uploads/
 *
 * PROBLEMA: Agent #3 detectou que kb-documents.json está vazio ([]) mas existem 9 PDFs em uploads/
 * SOLUÇÃO: Escanear uploads/, detectar PDFs não registrados e adicionar ao kbCache
 *
 * USO:
 *   node audit-results/rebuild-kb.js
 *
 * OPÇÕES:
 *   --dry-run    Apenas mostra o que seria feito, sem modificar o KB
 *   --verbose    Mostra informações detalhadas
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Importar kbCache e ACTIVE_PATHS
const projectRoot = path.resolve(__dirname, '..');
const kbCachePath = path.join(projectRoot, 'lib/kb-cache.js');
const storageConfigPath = path.join(projectRoot, 'lib/storage-config.js');

let kbCache, ACTIVE_PATHS;

async function loadModules() {
  try {
    const kbCacheModule = await import(kbCachePath);
    kbCache = kbCacheModule.default;

    const storageConfigModule = await import(storageConfigPath);
    ACTIVE_PATHS = storageConfigModule.ACTIVE_PATHS;

    return true;
  } catch (error) {
    console.error('❌ Erro ao carregar módulos:', error.message);
    return false;
  }
}

// Parse de argumentos
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

async function main() {
  console.log('='.repeat(80));
  console.log('REBUILD KB - Recuperação de Arquivos Órfãos');
  console.log('='.repeat(80));
  console.log();

  if (isDryRun) {
    console.log('⚠️  MODO DRY-RUN: Nenhuma modificação será feita\n');
  }

  // Carregar módulos
  console.log('📦 Carregando módulos...');
  const loaded = await loadModules();
  if (!loaded) {
    console.error('❌ Falha ao carregar módulos necessários');
    process.exit(1);
  }
  console.log('✅ Módulos carregados\n');

  // Diretório de uploads
  const uploadsDir = ACTIVE_PATHS.uploads;
  console.log(`📂 Escaneando: ${uploadsDir}\n`);

  if (!fs.existsSync(uploadsDir)) {
    console.error('❌ Diretório de uploads não encontrado:', uploadsDir);
    process.exit(1);
  }

  // Listar arquivos no diretório
  const files = fs.readdirSync(uploadsDir);
  const pdfFiles = files.filter(file => {
    const filePath = path.join(uploadsDir, file);
    const stats = fs.statSync(filePath);
    return stats.isFile() && file.toLowerCase().endsWith('.pdf');
  });

  console.log(`📄 Encontrados ${pdfFiles.length} arquivos PDF\n`);

  if (pdfFiles.length === 0) {
    console.log('ℹ️  Nenhum arquivo PDF encontrado para processar');
    process.exit(0);
  }

  // Obter documentos já registrados no KB
  const existingDocs = kbCache.getAll();
  const existingPaths = new Set(existingDocs.map(doc => doc.path));

  console.log(`📚 KB atual: ${existingDocs.length} documentos registrados\n`);

  // Identificar arquivos órfãos (não registrados no KB)
  const orphanedFiles = [];
  for (const file of pdfFiles) {
    const filePath = path.join(uploadsDir, file);

    if (!existingPaths.has(filePath)) {
      orphanedFiles.push(filePath);
    }
  }

  console.log(`🔍 Arquivos órfãos detectados: ${orphanedFiles.length}\n`);

  if (orphanedFiles.length === 0) {
    console.log('✅ Todos os arquivos já estão registrados no KB!');
    process.exit(0);
  }

  // Processar arquivos órfãos
  console.log('='.repeat(80));
  console.log('PROCESSANDO ARQUIVOS ÓRFÃOS');
  console.log('='.repeat(80));
  console.log();

  const results = {
    total: orphanedFiles.length,
    added: 0,
    failed: 0,
    errors: []
  };

  for (const filePath of orphanedFiles) {
    const fileName = path.basename(filePath);

    try {
      const stats = fs.statSync(filePath);

      // Extrair timestamp do nome do arquivo (se existir)
      const timestampMatch = fileName.match(/^(\d+)_/);
      const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : Date.now();
      const uploadedAt = new Date(timestamp).toISOString();

      // Criar documento KB
      const kbDoc = {
        id: `kb-rebuild-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: fileName,
        originalName: fileName,
        type: 'application/pdf',
        size: stats.size,
        path: filePath,
        userId: 'rebuild-script',
        userName: 'Rebuild Script',
        uploadedAt: uploadedAt,
        metadata: {
          source: 'rebuild-script',
          rebuildDate: new Date().toISOString(),
          originalMtime: stats.mtime.toISOString()
        }
      };

      if (isVerbose) {
        console.log(`📝 Processando: ${fileName}`);
        console.log(`   ID: ${kbDoc.id}`);
        console.log(`   Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`   Upload: ${uploadedAt}`);
      } else {
        console.log(`📝 ${fileName} (${(stats.size / 1024).toFixed(2)} KB)`);
      }

      // Adicionar ao KB (se não for dry-run)
      if (!isDryRun) {
        kbCache.add(kbDoc);
        console.log(`   ✅ Adicionado ao KB`);
      } else {
        console.log(`   🔍 [DRY-RUN] Seria adicionado ao KB`);
      }

      results.added++;

    } catch (error) {
      console.error(`   ❌ Erro: ${error.message}`);
      results.failed++;
      results.errors.push({ file: fileName, error: error.message });
    }

    console.log();
  }

  // Relatório final
  console.log('='.repeat(80));
  console.log('RELATÓRIO FINAL');
  console.log('='.repeat(80));
  console.log();
  console.log(`Total de arquivos órfãos: ${results.total}`);
  console.log(`✅ Adicionados com sucesso: ${results.added}`);
  console.log(`❌ Falharam: ${results.failed}`);
  console.log();

  if (results.errors.length > 0) {
    console.log('ERROS:');
    results.errors.forEach(err => {
      console.log(`  - ${err.file}: ${err.error}`);
    });
    console.log();
  }

  if (!isDryRun && results.added > 0) {
    console.log('✅ KB reconstruído com sucesso!');
    console.log(`📚 KB agora tem: ${existingDocs.length + results.added} documentos`);
    console.log();
    console.log('💡 PRÓXIMO PASSO: Reinicie o servidor para aplicar mudanças completamente');
  } else if (isDryRun) {
    console.log('ℹ️  Para aplicar mudanças, execute sem --dry-run:');
    console.log('   node audit-results/rebuild-kb.js');
  }

  console.log();
  console.log('='.repeat(80));

  // Salvar relatório JSON
  const reportPath = path.join(__dirname, 'rebuild-kb-report.json');
  const report = {
    executedAt: new Date().toISOString(),
    mode: isDryRun ? 'dry-run' : 'production',
    uploadsDir,
    totalPdfFiles: pdfFiles.length,
    existingInKb: existingDocs.length,
    orphanedFound: orphanedFiles.length,
    results,
    files: orphanedFiles.map(filePath => ({
      path: filePath,
      name: path.basename(filePath),
      size: fs.statSync(filePath).size
    }))
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📋 Relatório salvo em: ${reportPath}`);
  console.log();
}

// Executar
main().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
