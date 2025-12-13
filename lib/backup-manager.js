/**
 * ROM Agent - Gerenciador de Backups Automáticos
 * Sistema de backup diário do KB, configurações e dados
 * Com compressão ZIP e rotação automática (mantém últimos 7 dias)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { createGzip } from 'zlib';
import archiver from 'archiver';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pipelineAsync = promisify(pipeline);

/**
 * Classe para gerenciar backups automáticos
 */
class BackupManager {
  constructor() {
    this.backupDir = path.join(__dirname, '../backups');
    this.dataDir = path.join(__dirname, '../data');
    this.kbDir = path.join(__dirname, '../KB');
    this.configDir = path.join(__dirname, '../config');
    this.uploadDir = path.join(__dirname, '../upload');
    this.maxBackups = 7; // Manter últimos 7 dias
    this.backupInterval = null;

    this.ensureBackupDir();
  }

  /**
   * Garantir que o diretório de backup existe
   */
  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Criar backup completo
   * @param {Object} options - Opções do backup
   */
  async createBackup(options = {}) {
    const {
      includeKB = true,
      includeData = true,
      includeConfig = true,
      includeUploads = false, // Uploads podem ser grandes
      compress = true
    } = options;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupName = `backup-${timestamp}`;
    const backupPath = path.join(this.backupDir, `${backupName}.zip`);

    console.log(`📦 Iniciando backup: ${backupName}`);

    try {
      const output = fs.createWriteStream(backupPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Máxima compressão
      });

      // Eventos do archiver
      output.on('close', () => {
        console.log(`✅ Backup criado: ${backupPath}`);
        console.log(`   Tamanho: ${this.formatBytes(archive.pointer())}`);
      });

      archive.on('error', (err) => {
        throw err;
      });

      archive.pipe(output);

      // Adicionar diretórios ao backup
      if (includeKB && fs.existsSync(this.kbDir)) {
        archive.directory(this.kbDir, 'KB');
        console.log('   ✓ KB incluído');
      }

      if (includeData && fs.existsSync(this.dataDir)) {
        archive.directory(this.dataDir, 'data');
        console.log('   ✓ Data incluído');
      }

      if (includeConfig && fs.existsSync(this.configDir)) {
        archive.directory(this.configDir, 'config');
        console.log('   ✓ Config incluído');
      }

      if (includeUploads && fs.existsSync(this.uploadDir)) {
        archive.directory(this.uploadDir, 'upload');
        console.log('   ✓ Upload incluído');
      }

      // Adicionar metadados
      const metadata = {
        createdAt: new Date().toISOString(),
        version: '2.0.0',
        includeKB,
        includeData,
        includeConfig,
        includeUploads,
        hostname: require('os').hostname(),
        platform: process.platform
      };

      archive.append(JSON.stringify(metadata, null, 2), { name: 'backup-metadata.json' });

      await archive.finalize();

      // Rotação de backups
      this.rotateBackups();

      return {
        success: true,
        backupPath,
        backupName,
        size: archive.pointer(),
        sizeFormatted: this.formatBytes(archive.pointer()),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Erro ao criar backup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Rotação de backups (manter apenas os últimos N)
   */
  rotateBackups() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('backup-') && file.endsWith('.zip'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          time: fs.statSync(path.join(this.backupDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Mais recente primeiro

      if (files.length > this.maxBackups) {
        const toDelete = files.slice(this.maxBackups);
        for (const file of toDelete) {
          fs.unlinkSync(file.path);
          console.log(`🗑️  Backup antigo removido: ${file.name}`);
        }
      }

      return { success: true, kept: Math.min(files.length, this.maxBackups), removed: Math.max(0, files.length - this.maxBackups) };
    } catch (error) {
      console.error('❌ Erro ao rotacionar backups:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Listar backups disponíveis
   */
  listBackups() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('backup-') && file.endsWith('.zip'))
        .map(file => {
          const filePath = path.join(this.backupDir, file);
          const stat = fs.statSync(filePath);

          // Tentar ler metadados
          let metadata = null;
          try {
            // Nota: leitura de ZIP requer biblioteca adicional
            metadata = { version: 'N/A' };
          } catch (err) {
            metadata = null;
          }

          return {
            name: file,
            path: filePath,
            size: stat.size,
            sizeFormatted: this.formatBytes(stat.size),
            createdAt: stat.mtime,
            age: this.getAge(stat.mtime),
            metadata
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);

      return {
        success: true,
        backups: files,
        total: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        totalSizeFormatted: this.formatBytes(files.reduce((sum, f) => sum + f.size, 0))
      };
    } catch (error) {
      console.error('❌ Erro ao listar backups:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Restaurar backup
   * @param {string} backupName - Nome do arquivo de backup
   */
  async restoreBackup(backupName) {
    const backupPath = path.join(this.backupDir, backupName);

    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Backup não encontrado' };
    }

    console.log(`📥 Restaurando backup: ${backupName}`);

    try {
      // Nota: implementação completa requer biblioteca de descompressão ZIP
      // Por simplicidade, retornamos apenas o path para restauração manual
      return {
        success: true,
        message: 'Para restaurar, extraia o arquivo ZIP manualmente no diretório do projeto',
        backupPath,
        instructions: [
          '1. Pare o servidor',
          '2. Extraia o backup ZIP',
          '3. Substitua os diretórios conforme necessário',
          '4. Reinicie o servidor'
        ]
      };
    } catch (error) {
      console.error('❌ Erro ao restaurar backup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Excluir backup
   * @param {string} backupName - Nome do arquivo de backup
   */
  deleteBackup(backupName) {
    const backupPath = path.join(this.backupDir, backupName);

    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Backup não encontrado' };
    }

    try {
      fs.unlinkSync(backupPath);
      console.log(`🗑️  Backup excluído: ${backupName}`);
      return { success: true, message: `Backup ${backupName} excluído` };
    } catch (error) {
      console.error('❌ Erro ao excluir backup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Agendar backup automático
   * @param {string} schedule - Horário do backup (formato: HH:MM)
   */
  scheduleBackup(schedule = '03:00') {
    // Cancelar agendamento anterior
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    const [hours, minutes] = schedule.split(':').map(Number);

    // Calcular próxima execução
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);

    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const msUntilFirst = scheduledTime - now;

    console.log(`⏰ Backup diário agendado para ${schedule}`);
    console.log(`   Próximo backup em: ${this.formatDuration(msUntilFirst)}`);

    // Agendar primeiro backup
    setTimeout(() => {
      this.createBackup();

      // Agendar backups diários
      this.backupInterval = setInterval(() => {
        this.createBackup();
      }, 24 * 60 * 60 * 1000); // 24 horas
    }, msUntilFirst);

    return {
      success: true,
      schedule,
      nextBackup: scheduledTime.toISOString(),
      interval: '24 horas'
    };
  }

  /**
   * Cancelar agendamento de backup
   */
  cancelSchedule() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      console.log('⏸️  Agendamento de backup cancelado');
      return { success: true, message: 'Agendamento cancelado' };
    }
    return { success: false, message: 'Nenhum agendamento ativo' };
  }

  /**
   * Verificar integridade de um backup
   * @param {string} backupName - Nome do arquivo de backup
   */
  verifyBackup(backupName) {
    const backupPath = path.join(this.backupDir, backupName);

    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Backup não encontrado' };
    }

    try {
      const stat = fs.statSync(backupPath);

      // Verificações básicas
      const checks = {
        exists: fs.existsSync(backupPath),
        readable: fs.accessSync(backupPath, fs.constants.R_OK) === undefined,
        sizeValid: stat.size > 0,
        isZip: backupName.endsWith('.zip')
      };

      const isValid = Object.values(checks).every(check => check === true);

      return {
        success: true,
        valid: isValid,
        checks,
        size: stat.size,
        sizeFormatted: this.formatBytes(stat.size)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Obter estatísticas de backups
   */
  getStatistics() {
    const result = this.listBackups();
    if (!result.success) {
      return result;
    }

    const backups = result.backups;
    const oldestBackup = backups.length > 0 ? backups[backups.length - 1] : null;
    const newestBackup = backups.length > 0 ? backups[0] : null;

    return {
      totalBackups: backups.length,
      totalSize: result.totalSize,
      totalSizeFormatted: result.totalSizeFormatted,
      oldestBackup: oldestBackup ? {
        name: oldestBackup.name,
        createdAt: oldestBackup.createdAt,
        age: oldestBackup.age
      } : null,
      newestBackup: newestBackup ? {
        name: newestBackup.name,
        createdAt: newestBackup.createdAt,
        age: newestBackup.age
      } : null,
      avgBackupSize: backups.length > 0 ? Math.round(result.totalSize / backups.length) : 0,
      avgBackupSizeFormatted: backups.length > 0 ? this.formatBytes(Math.round(result.totalSize / backups.length)) : '0 Bytes',
      maxBackups: this.maxBackups,
      backupDir: this.backupDir,
      scheduleActive: this.backupInterval !== null
    };
  }

  /**
   * Formatar bytes
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Calcular idade do backup
   */
  getAge(date) {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    if (days > 0) {
      return `${days} dia${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hora${hours > 1 ? 's' : ''}`;
    } else {
      return 'menos de 1 hora';
    }
  }

  /**
   * Formatar duração em ms
   */
  formatDuration(ms) {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${minutes}min`;
  }
}

// Instância singleton
const backupManager = new BackupManager();

// Agendar backup automático diário (03:00 AM)
backupManager.scheduleBackup('03:00');

export default backupManager;
export { BackupManager };
