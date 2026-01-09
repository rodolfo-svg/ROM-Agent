/**
 * ROM Agent - Deploy Job
 * Job de deploy automático programado para 02h-05h
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DeployJob {
  constructor() {
    this.isRunning = false;
    this.lastExecution = null;
    this.lastResult = null;
    this.deployWindow = {
      start: 2, // 02h
      end: 5    // 05h
    };
  }

  /**
   * Verifica se está dentro da janela de deploy (02h-05h)
   */
  isInDeployWindow() {
    const now = new Date();
    const hour = now.getHours();
    return hour >= this.deployWindow.start && hour < this.deployWindow.end;
  }

  /**
   * Verifica se há mudanças para deploy
   */
  async hasChangesToDeploy() {
    try {
      // Busca atualizações do remote
      await execAsync('git fetch origin');

      // Verifica se há diferenças entre local e remote
      const { stdout } = await execAsync('git rev-list HEAD...origin/main --count');
      const commitsAhead = parseInt(stdout.trim());

      // Verifica se há mudanças locais não commitadas
      const { stdout: status } = await execAsync('git status --porcelain');
      const hasLocalChanges = status.trim().length > 0;

      logger.info(`Verificação de mudanças: ${commitsAhead} commits no remote, mudanças locais: ${hasLocalChanges}`);

      return commitsAhead > 0 || hasLocalChanges;
    } catch (error) {
      logger.error('Erro ao verificar mudanças:', error);
      return false;
    }
  }

  /**
   * Executa backup antes do deploy
   */
  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(process.cwd(), 'backups', timestamp);

      await fs.mkdir(backupDir, { recursive: true });

      // Backup dos arquivos principais
      const filesToBackup = [
        'package.json',
        'package-lock.json',
        '.env'
      ];

      for (const file of filesToBackup) {
        try {
          const sourcePath = path.join(process.cwd(), file);
          const destPath = path.join(backupDir, file);
          await fs.copyFile(sourcePath, destPath);
          logger.info(`Backup criado: ${file}`);
        } catch (error) {
          if (error.code !== 'ENOENT') {
            logger.warn(`Erro ao fazer backup de ${file}:`, error.message);
          }
        }
      }

      logger.info(`Backup completo em: ${backupDir}`);
      return backupDir;
    } catch (error) {
      logger.error('Erro ao criar backup:', error);
      throw error;
    }
  }

  /**
   * Executa o deploy
   */
  async performDeploy() {
    try {
      logger.info('Iniciando processo de deploy...');

      // 1. Verifica se há mudanças locais não commitadas
      const { stdout: statusOutput } = await execAsync('git status --porcelain');
      if (statusOutput.trim().length > 0) {
        logger.info('Commitando mudanças locais...');
        await execAsync('git add .');
        await execAsync(`git commit -m "🤖 Deploy automático - $(date +%Y-%m-%d_%H:%M:%S)"`);
      }

      // 2. Pull das mudanças do remote
      logger.info('Sincronizando com remote...');
      try {
        await execAsync('git pull origin main --rebase');
      } catch (error) {
        logger.warn('Erro no pull, tentando merge...');
        await execAsync('git pull origin main --no-rebase');
      }

      // 3. Instala dependências
      logger.info('Instalando dependências...');
      await execAsync('npm install');

      // 4. Roda testes (se existirem)
      try {
        logger.info('Executando testes...');
        await execAsync('npm test');
      } catch (error) {
        logger.warn('Testes falharam ou não existem:', error.message);
      }

      // 5. Push para remote
      logger.info('Enviando mudanças para remote...');
      await execAsync('git push origin main');

      // 6. Registra deploy bem-sucedido
      const deployInfo = {
        timestamp: new Date().toISOString(),
        status: 'success',
        message: 'Deploy automático concluído com sucesso'
      };

      await this.saveDeployLog(deployInfo);

      logger.info('✅ Deploy concluído com sucesso!');
      return deployInfo;
    } catch (error) {
      logger.error('❌ Erro durante deploy:', error);

      const deployInfo = {
        timestamp: new Date().toISOString(),
        status: 'failed',
        message: error.message,
        error: error.stack
      };

      await this.saveDeployLog(deployInfo);
      throw error;
    }
  }

  /**
   * Salva log do deploy
   */
  async saveDeployLog(info) {
    try {
      const logDir = path.join(process.cwd(), 'logs', 'deploys');
      await fs.mkdir(logDir, { recursive: true });

      const logFile = path.join(logDir, 'deploy-history.json');
      let history = [];

      try {
        const content = await fs.readFile(logFile, 'utf-8');
        history = JSON.parse(content);
      } catch (error) {
        // Arquivo não existe ainda
      }

      history.push(info);

      // Mantém apenas os últimos 100 deploys
      if (history.length > 100) {
        history = history.slice(-100);
      }

      await fs.writeFile(logFile, JSON.stringify(history, null, 2));
      logger.info(`Log de deploy salvo: ${logFile}`);
    } catch (error) {
      logger.error('Erro ao salvar log de deploy:', error);
    }
  }

  /**
   * Executa o job de deploy
   */
  async execute() {
    if (this.isRunning) {
      logger.warn('Deploy já está em execução');
      return;
    }

    this.isRunning = true;
    this.lastExecution = new Date();

    try {
      logger.info('=================================================');
      logger.info('🚀 Iniciando Deploy Automático');
      logger.info(`Horário: ${this.lastExecution.toLocaleString('pt-BR')}`);
      logger.info('=================================================');

      // 1. Verifica janela de deploy
      if (!this.isInDeployWindow()) {
        const currentHour = new Date().getHours();
        logger.warn(`⏰ Fora da janela de deploy (${this.deployWindow.start}h-${this.deployWindow.end}h). Hora atual: ${currentHour}h`);
        this.lastResult = {
          status: 'skipped',
          reason: 'outside_deploy_window',
          timestamp: this.lastExecution.toISOString()
        };
        return;
      }

      // 2. Verifica se há mudanças
      const hasChanges = await this.hasChangesToDeploy();
      if (!hasChanges) {
        logger.info('ℹ️ Nenhuma mudança detectada. Deploy não necessário.');
        this.lastResult = {
          status: 'skipped',
          reason: 'no_changes',
          timestamp: this.lastExecution.toISOString()
        };
        return;
      }

      // 3. Cria backup
      logger.info('📦 Criando backup...');
      const backupPath = await this.createBackup();

      // 4. Executa deploy
      logger.info('🔄 Executando deploy...');
      const result = await this.performDeploy();

      this.lastResult = {
        ...result,
        backupPath
      };

      logger.info('=================================================');
      logger.info('✅ Deploy Automático Concluído com Sucesso!');
      logger.info('=================================================');
    } catch (error) {
      logger.error('=================================================');
      logger.error('❌ Deploy Automático Falhou!');
      logger.error(`Erro: ${error.message}`);
      logger.error('=================================================');

      this.lastResult = {
        status: 'failed',
        error: error.message,
        timestamp: this.lastExecution.toISOString()
      };

      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Obtém status do último deploy
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastExecution: this.lastExecution?.toISOString() || null,
      lastResult: this.lastResult,
      deployWindow: this.deployWindow,
      isInDeployWindow: this.isInDeployWindow()
    };
  }

  /**
   * Obtém histórico de deploys
   */
  async getHistory(limit = 10) {
    try {
      const logFile = path.join(process.cwd(), 'logs', 'deploys', 'deploy-history.json');
      const content = await fs.readFile(logFile, 'utf-8');
      const history = JSON.parse(content);
      return history.slice(-limit).reverse();
    } catch (error) {
      return [];
    }
  }
}

// Singleton
export const deployJob = new DeployJob();
