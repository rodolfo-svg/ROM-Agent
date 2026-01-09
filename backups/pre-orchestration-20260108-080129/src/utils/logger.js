/**
 * ROM Agent - Sistema de Logger
 * Sistema de logs com diferentes níveis e persistência
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
  constructor() {
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };

    this.currentLevel = this.levels.INFO;
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = null;
    this.initialized = false;
  }

  /**
   * Inicializa o logger
   */
  async init() {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.logDir, { recursive: true });

      const today = new Date().toISOString().split('T')[0];
      this.logFile = path.join(this.logDir, `${today}.log`);

      this.initialized = true;
      this.info('Logger inicializado');
    } catch (error) {
      console.error('Erro ao inicializar logger:', error);
    }
  }

  /**
   * Formata a mensagem de log
   */
  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const levelStr = Object.keys(this.levels).find(
      key => this.levels[key] === level
    );

    let formatted = `[${timestamp}] [${levelStr}] ${message}`;

    if (data) {
      if (data instanceof Error) {
        formatted += `\n  Error: ${data.message}\n  Stack: ${data.stack}`;
      } else if (typeof data === 'object') {
        formatted += `\n  Data: ${JSON.stringify(data, null, 2)}`;
      } else {
        formatted += `\n  Data: ${data}`;
      }
    }

    return formatted;
  }

  /**
   * Escreve log no console e arquivo
   */
  async writeLog(level, message, data = null) {
    if (!this.initialized) {
      await this.init();
    }

    if (level > this.currentLevel) return;

    const formatted = this.formatMessage(level, message, data);

    // Console
    const colors = {
      0: '\x1b[31m', // ERROR - vermelho
      1: '\x1b[33m', // WARN - amarelo
      2: '\x1b[36m', // INFO - ciano
      3: '\x1b[90m'  // DEBUG - cinza
    };
    const reset = '\x1b[0m';
    console.log(`${colors[level]}${formatted}${reset}`);

    // Arquivo
    try {
      await fs.appendFile(this.logFile, formatted + '\n');
    } catch (error) {
      console.error('Erro ao escrever log:', error);
    }
  }

  /**
   * Log de erro
   */
  error(message, data = null) {
    this.writeLog(this.levels.ERROR, message, data);
  }

  /**
   * Log de aviso
   */
  warn(message, data = null) {
    this.writeLog(this.levels.WARN, message, data);
  }

  /**
   * Log de informação
   */
  info(message, data = null) {
    this.writeLog(this.levels.INFO, message, data);
  }

  /**
   * Log de debug
   */
  debug(message, data = null) {
    this.writeLog(this.levels.DEBUG, message, data);
  }

  /**
   * Define o nível de log
   */
  setLevel(level) {
    if (typeof level === 'string') {
      this.currentLevel = this.levels[level.toUpperCase()] || this.levels.INFO;
    } else {
      this.currentLevel = level;
    }
  }

  /**
   * Obtém logs de um dia específico
   */
  async getLogs(date = null) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `${targetDate}.log`);
      const content = await fs.readFile(logFile, 'utf-8');
      return content.split('\n').filter(line => line.trim());
    } catch (error) {
      return [];
    }
  }

  /**
   * Lista todos os arquivos de log disponíveis
   */
  async listLogFiles() {
    try {
      const files = await fs.readdir(this.logDir);
      return files
        .filter(file => file.endsWith('.log'))
        .sort()
        .reverse();
    } catch (error) {
      return [];
    }
  }

  /**
   * Limpa logs antigos (mantém últimos N dias)
   */
  async cleanOldLogs(daysToKeep = 30) {
    try {
      const files = await this.listLogFiles();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      for (const file of files) {
        const fileDate = file.replace('.log', '');
        const date = new Date(fileDate);

        if (date < cutoffDate) {
          await fs.unlink(path.join(this.logDir, file));
          this.info(`Log antigo removido: ${file}`);
        }
      }
    } catch (error) {
      this.error('Erro ao limpar logs antigos:', error);
    }
  }
}

// Singleton
export const logger = new Logger();

// Auto-inicializa
logger.init();
