/**
 * OneDrive Backup System - BETA TAREFA 2
 * Backup automático de dados críticos para OneDrive
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class OneDriveBackup {
  constructor() {
    this.oneDrivePath = '/Users/rodolfootaviopereiradamotaoliveira/Library/CloudStorage/OneDrive-Pessoal';
    this.backupDir = path.join(this.oneDrivePath, 'ROM-Agent-BETA-Backup');
    this.sourceDir = process.cwd();

    // Diretórios e arquivos para backup
    this.backupItems = [
      'lib',
      'src/services',
      'config',
      'data',
      'logs/traces',
      'logs/analytics.json',
      'KB/approved_pieces.json',
      'KB/paradigmas',
      '*.md'
    ];
  }

  /**
   * Verifica se OneDrive está disponível
   */
  async checkOneDrive() {
    try {
      const stats = await fs.stat(this.oneDrivePath);
      return stats.isDirectory();
    } catch (error) {
      console.error('❌ OneDrive não encontrado:', this.oneDrivePath);
      return false;
    }
  }

  /**
   * Cria estrutura de backup
   */
  async createBackupStructure() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const versionDir = path.join(this.backupDir, `backup-${timestamp}`);
      await fs.mkdir(versionDir, { recursive: true });

      return versionDir;
    } catch (error) {
      console.error('❌ Erro ao criar estrutura de backup:', error);
      throw error;
    }
  }

  /**
   * Executa backup completo
   */
  async backup() {
    console.log('🔄 Iniciando backup para OneDrive...');

    // Verificar OneDrive
    if (!await this.checkOneDrive()) {
      throw new Error('OneDrive não disponível');
    }

    // Criar diretório de backup versionado
    const backupPath = await this.createBackupStructure();
    console.log(`📁 Backup será salvo em: ${backupPath}`);

    const results = {
      success: [],
      errors: [],
      totalSize: 0,
      timestamp: new Date().toISOString()
    };

    // Backup de cada item
    for (const item of this.backupItems) {
      try {
        const sourcePath = path.join(this.sourceDir, item);

        // Verificar se é wildcard (*.md)
        if (item.includes('*')) {
          await this.backupWildcard(item, backupPath, results);
        } else {
          await this.backupItem(sourcePath, backupPath, item, results);
        }
      } catch (error) {
        console.error(`❌ Erro ao fazer backup de ${item}:`, error.message);
        results.errors.push({ item, error: error.message });
      }
    }

    // Criar também backup "latest" para fácil acesso
    const latestPath = path.join(this.backupDir, 'latest');
    try {
      await fs.rm(latestPath, { recursive: true, force: true });
      await this.copyDirectory(backupPath, latestPath);
      console.log(`✅ Backup 'latest' atualizado`);
    } catch (error) {
      console.warn('⚠️ Erro ao criar backup latest:', error.message);
    }

    // Salvar metadados do backup
    await this.saveBackupMetadata(backupPath, results);

    // Limpar backups antigos (manter últimos 7)
    await this.cleanOldBackups(7);

    console.log(`\n✅ Backup concluído!`);
    console.log(`📊 Itens salvos: ${results.success.length}`);
    console.log(`❌ Erros: ${results.errors.length}`);
    console.log(`💾 Tamanho total: ${this.formatSize(results.totalSize)}`);

    return results;
  }

  /**
   * Backup de um item (arquivo ou diretório)
   */
  async backupItem(sourcePath, backupPath, itemName, results) {
    try {
      const stats = await fs.stat(sourcePath);
      const destPath = path.join(backupPath, itemName);

      if (stats.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
        const size = await this.getDirectorySize(destPath);
        results.totalSize += size;
        console.log(`✅ ${itemName} (${this.formatSize(size)})`);
      } else {
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(sourcePath, destPath);
        results.totalSize += stats.size;
        console.log(`✅ ${itemName} (${this.formatSize(stats.size)})`);
      }

      results.success.push(itemName);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      console.log(`⚠️ ${itemName} não encontrado, pulando...`);
    }
  }

  /**
   * Backup de arquivos com wildcard
   */
  async backupWildcard(pattern, backupPath, results) {
    try {
      const { stdout } = await execAsync(`find . -maxdepth 1 -name "${pattern}"`);
      const files = stdout.trim().split('\n').filter(f => f);

      for (const file of files) {
        const fileName = path.basename(file);
        const sourcePath = path.join(this.sourceDir, fileName);
        await this.backupItem(sourcePath, backupPath, fileName, results);
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao processar wildcard ${pattern}:`, error.message);
    }
  }

  /**
   * Copia diretório recursivamente
   */
  async copyDirectory(source, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Calcula tamanho de diretório
   */
  async getDirectorySize(dir) {
    let totalSize = 0;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          totalSize += await this.getDirectorySize(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao calcular tamanho de ${dir}:`, error.message);
    }

    return totalSize;
  }

  /**
   * Salva metadados do backup
   */
  async saveBackupMetadata(backupPath, results) {
    const metadata = {
      timestamp: results.timestamp,
      success: results.success,
      errors: results.errors,
      totalSize: results.totalSize,
      totalSizeFormatted: this.formatSize(results.totalSize),
      backupPath
    };

    const metadataPath = path.join(backupPath, 'backup-metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  }

  /**
   * Limpa backups antigos
   */
  async cleanOldBackups(keepLast = 7) {
    try {
      const entries = await fs.readdir(this.backupDir, { withFileTypes: true });
      const backups = entries
        .filter(e => e.isDirectory() && e.name.startsWith('backup-'))
        .map(e => ({
          name: e.name,
          path: path.join(this.backupDir, e.name),
          timestamp: e.name.replace('backup-', '')
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      // Manter apenas os últimos N backups
      const toDelete = backups.slice(keepLast);

      for (const backup of toDelete) {
        await fs.rm(backup.path, { recursive: true, force: true });
        console.log(`🗑️ Backup antigo removido: ${backup.name}`);
      }

      if (toDelete.length > 0) {
        console.log(`✅ ${toDelete.length} backups antigos removidos`);
      }
    } catch (error) {
      console.warn('⚠️ Erro ao limpar backups antigos:', error.message);
    }
  }

  /**
   * Formata tamanho em bytes
   */
  formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  /**
   * Restaura backup
   */
  async restore(backupName = 'latest') {
    console.log(`🔄 Restaurando backup: ${backupName}...`);

    const backupPath = path.join(this.backupDir, backupName);

    try {
      const stats = await fs.stat(backupPath);
      if (!stats.isDirectory()) {
        throw new Error(`Backup não encontrado: ${backupName}`);
      }

      // Aqui você implementaria a lógica de restauração
      console.log(`✅ Backup ${backupName} está disponível em: ${backupPath}`);
      console.log(`⚠️ Restauração manual: copie os arquivos de volta para ${this.sourceDir}`);

      return { success: true, backupPath };
    } catch (error) {
      console.error('❌ Erro ao restaurar backup:', error);
      throw error;
    }
  }

  /**
   * Lista backups disponíveis
   */
  async listBackups() {
    try {
      const entries = await fs.readdir(this.backupDir, { withFileTypes: true });
      const backups = [];

      for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith('backup-')) continue;

        const backupPath = path.join(this.backupDir, entry.name);
        const metadataPath = path.join(backupPath, 'backup-metadata.json');

        try {
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
          backups.push({
            name: entry.name,
            ...metadata
          });
        } catch {
          backups.push({
            name: entry.name,
            timestamp: entry.name.replace('backup-', ''),
            size: await this.getDirectorySize(backupPath)
          });
        }
      }

      return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch (error) {
      console.error('❌ Erro ao listar backups:', error);
      return [];
    }
  }
}

// Exportar instância singleton
const oneDriveBackup = new OneDriveBackup();

export default oneDriveBackup;

// CLI para execução manual
if (import.meta.url === `file://${process.argv[1]}`) {
  oneDriveBackup.backup()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Backup falhou:', err);
      process.exit(1);
    });
}
