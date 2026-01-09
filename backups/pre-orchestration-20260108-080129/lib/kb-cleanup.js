/**
 * KB Cleanup - Limpar duplicatas e reindexar
 * Remove documentos duplicados e reconstrói kb-documents.json
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ACTIVE_PATHS } from './storage-config.js';

export class KBCleanup {
  constructor() {
    this.kbDocsPath = path.join(process.cwd(), 'data', 'kb-documents.json');
    this.kbDir = path.join(ACTIVE_PATHS.kb, 'documents');
    this.hashMap = new Map(); // hash -> filepath
    this.duplicates = [];
    this.unique = [];
  }

  /**
   * Calcular hash SHA256 do conteúdo
   */
  calculateHash(content) {
    if (!content) return null;

    const normalized = content
      .replace(/\s+/g, ' ')
      .trim();

    return crypto
      .createHash('sha256')
      .update(normalized)
      .digest('hex');
  }

  /**
   * Escanear KB e identificar duplicatas
   */
  async scanForDuplicates() {
    console.log('\n🔍 Escaneando KB em busca de duplicatas...');
    console.log(`📁 Diretório: ${this.kbDir}`);

    if (!fs.existsSync(this.kbDir)) {
      console.log('⚠️  Diretório KB não existe');
      return { unique: [], duplicates: [] };
    }

    const files = fs.readdirSync(this.kbDir);
    const txtFiles = files.filter(f => f.endsWith('.txt') && !f.includes('.metadata'));

    console.log(`📄 Encontrados ${txtFiles.length} arquivos .txt`);

    for (const file of txtFiles) {
      const filePath = path.join(this.kbDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const hash = this.calculateHash(content);

      if (!hash) {
        console.warn(`⚠️  Arquivo vazio: ${file}`);
        continue;
      }

      if (this.hashMap.has(hash)) {
        // Duplicata encontrada
        const originalFile = this.hashMap.get(hash);
        this.duplicates.push({
          file,
          filePath,
          hash: hash.substring(0, 16),
          original: path.basename(originalFile),
          size: content.length
        });
        console.log(`   ❌ DUPLICATA: ${file} (original: ${path.basename(originalFile)})`);
      } else {
        // Arquivo único
        this.hashMap.set(hash, filePath);
        this.unique.push({
          file,
          filePath,
          hash: hash.substring(0, 16),
          size: content.length
        });
        console.log(`   ✅ Único: ${file}`);
      }
    }

    console.log(`\n📊 Resultado:`);
    console.log(`   ✅ Únicos: ${this.unique.length}`);
    console.log(`   ❌ Duplicatas: ${this.duplicates.length}`);

    return {
      unique: this.unique,
      duplicates: this.duplicates
    };
  }

  /**
   * Remover duplicatas
   */
  async removeDuplicates() {
    if (this.duplicates.length === 0) {
      console.log('\n✅ Nenhuma duplicata para remover');
      return { removed: 0 };
    }

    console.log(`\n🗑️  Removendo ${this.duplicates.length} duplicatas...`);
    let removed = 0;

    for (const dup of this.duplicates) {
      try {
        // Remover arquivo .txt
        fs.unlinkSync(dup.filePath);
        console.log(`   ✅ Removido: ${dup.file}`);

        // Remover metadata se existir
        const metadataPath = dup.filePath.replace('.txt', '.metadata.json');
        if (fs.existsSync(metadataPath)) {
          fs.unlinkSync(metadataPath);
          console.log(`   ✅ Removido metadata: ${path.basename(metadataPath)}`);
        }

        removed++;
      } catch (error) {
        console.error(`   ❌ Erro ao remover ${dup.file}: ${error.message}`);
      }
    }

    console.log(`\n✅ ${removed} duplicatas removidas`);
    return { removed };
  }

  /**
   * Reindexar KB - reconstruir kb-documents.json
   */
  async reindex() {
    console.log('\n📋 Reindexando KB...');

    const newIndex = [];

    for (const doc of this.unique) {
      try {
        const content = fs.readFileSync(doc.filePath, 'utf8');
        const stats = fs.statSync(doc.filePath);

        // Tentar ler metadata se existir
        const metadataPath = doc.filePath.replace('.txt', '.metadata.json');
        let metadata = {};

        if (fs.existsSync(metadataPath)) {
          const metaContent = fs.readFileSync(metadataPath, 'utf8');
          metadata = JSON.parse(metaContent);
        }

        const entry = {
          id: `kb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: metadata.originalFilename || doc.file,
          type: 'text/plain',
          size: stats.size,
          path: doc.filePath,
          userId: 'system',
          userName: 'Sistema',
          uploadedAt: metadata.uploadedAt || stats.birthtime.toISOString(),
          extractedText: content,
          textLength: content.length,
          metadata: {
            hash: doc.hash,
            wordCount: metadata.wordCount || content.split(/\s+/).length,
            toolsUsed: metadata.toolsUsed || [],
            reindexedAt: new Date().toISOString()
          }
        };

        newIndex.push(entry);
        console.log(`   ✅ Indexado: ${entry.name}`);
      } catch (error) {
        console.error(`   ❌ Erro ao indexar ${doc.file}: ${error.message}`);
      }
    }

    // Salvar novo índice
    fs.writeFileSync(this.kbDocsPath, JSON.stringify(newIndex, null, 2), 'utf8');
    console.log(`\n✅ KB reindexado: ${newIndex.length} documentos`);
    console.log(`📄 Salvo em: ${this.kbDocsPath}`);

    return { indexed: newIndex.length };
  }

  /**
   * Executar limpeza completa
   */
  async cleanup() {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🧹 KB CLEANUP - Limpeza e Reindexação');
    console.log('═══════════════════════════════════════════════════════');

    // 1. Escanear
    await this.scanForDuplicates();

    // 2. Remover duplicatas
    const removeResult = await this.removeDuplicates();

    // 3. Reindexar
    const indexResult = await this.reindex();

    // 4. Estatísticas finais
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 RESULTADO FINAL');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`✅ Documentos únicos mantidos: ${this.unique.length}`);
    console.log(`🗑️  Duplicatas removidas: ${removeResult.removed}`);
    console.log(`📋 Documentos indexados: ${indexResult.indexed}`);
    console.log('═══════════════════════════════════════════════════════\n');

    return {
      unique: this.unique.length,
      duplicatesRemoved: removeResult.removed,
      indexed: indexResult.indexed
    };
  }

  /**
   * Estatísticas do KB
   */
  async getStats() {
    const files = fs.existsSync(this.kbDir) ? fs.readdirSync(this.kbDir) : [];
    const txtFiles = files.filter(f => f.endsWith('.txt') && !f.includes('.metadata'));

    let totalSize = 0;
    for (const file of txtFiles) {
      const filePath = path.join(this.kbDir, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    }

    return {
      totalFiles: txtFiles.length,
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      kbDir: this.kbDir
    };
  }
}

export default KBCleanup;

// CLI - permitir execução direta
if (import.meta.url === `file://${process.argv[1]}`) {
  const cleanup = new KBCleanup();

  console.log('\n🚀 Executando KB Cleanup...\n');

  // Mostrar stats antes
  const statsBefore = await cleanup.getStats();
  console.log('📊 Estado atual do KB:');
  console.log(`   Arquivos: ${statsBefore.totalFiles}`);
  console.log(`   Tamanho: ${statsBefore.totalSizeMB} MB`);
  console.log(`   Diretório: ${statsBefore.kbDir}\n`);

  // Executar limpeza
  const result = await cleanup.cleanup();

  // Mostrar stats depois
  const statsAfter = await cleanup.getStats();
  console.log('\n📊 Estado final do KB:');
  console.log(`   Arquivos: ${statsAfter.totalFiles}`);
  console.log(`   Tamanho: ${statsAfter.totalSizeMB} MB`);
  console.log(`   Economia: ${(statsBefore.totalSize - statsAfter.totalSize)} bytes\n`);

  process.exit(0);
}
