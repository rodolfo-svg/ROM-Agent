/**
 * Conversation History Service
 * Gerenciamento de histórico de conversas por projeto
 *
 * Armazena conversas de forma persistente em disco para consulta futura
 */

import fs from 'fs/promises';
import path from 'path';
import { ACTIVE_PATHS } from '../../lib/storage-config.js';

class ConversationHistoryService {
  constructor() {
    this.conversationsPath = path.join(ACTIVE_PATHS.data, 'conversations');
    this.initialized = false;
  }

  /**
   * Inicializar serviço
   */
  async init() {
    try {
      // Criar diretório de conversas
      await fs.mkdir(this.conversationsPath, { recursive: true });
      this.initialized = true;
      console.log('✅ Conversation History Service inicializado');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar Conversation History:', error);
      return false;
    }
  }

  /**
   * Salvar mensagem no histórico
   *
   * @param {string} projectId - ID do projeto/caso
   * @param {object} message - Mensagem a salvar
   * @param {string} message.role - 'user' ou 'assistant'
   * @param {string} message.content - Conteúdo da mensagem
   * @param {object} message.metadata - Metadados adicionais
   */
  async saveMessage(projectId, message) {
    try {
      if (!this.initialized) await this.init();

      // Criar diretório do projeto se não existir
      const projectPath = path.join(this.conversationsPath, projectId);
      await fs.mkdir(projectPath, { recursive: true });

      // Carregar histórico existente ou criar novo
      const historyPath = path.join(projectPath, 'history.json');
      let history = { projectId, messages: [], createdAt: null, updatedAt: null };

      try {
        const existingData = await fs.readFile(historyPath, 'utf-8');
        history = JSON.parse(existingData);
      } catch (err) {
        // Arquivo não existe - primeira mensagem
        history.createdAt = new Date().toISOString();
      }

      // Adicionar nova mensagem
      const messageWithTimestamp = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        role: message.role,
        content: message.content,
        metadata: message.metadata || {}
      };

      history.messages.push(messageWithTimestamp);
      history.updatedAt = new Date().toISOString();

      // Salvar histórico atualizado
      await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');

      console.log(`💬 Mensagem salva no projeto ${projectId} (total: ${history.messages.length})`);

      return messageWithTimestamp;

    } catch (error) {
      console.error('❌ Erro ao salvar mensagem:', error);
      throw error;
    }
  }

  /**
   * Recuperar histórico de conversas de um projeto
   *
   * @param {string} projectId - ID do projeto/caso
   * @param {object} options - Opções de filtragem
   * @returns {object} Histórico completo
   */
  async getHistory(projectId, options = {}) {
    try {
      if (!this.initialized) await this.init();

      const historyPath = path.join(this.conversationsPath, projectId, 'history.json');

      // Verificar se existe histórico
      try {
        await fs.access(historyPath);
      } catch {
        return {
          projectId,
          messages: [],
          createdAt: null,
          updatedAt: null
        };
      }

      // Carregar histórico
      const data = await fs.readFile(historyPath, 'utf-8');
      let history = JSON.parse(data);

      // Aplicar filtros se necessário
      if (options.limit) {
        history.messages = history.messages.slice(-options.limit);
      }

      if (options.since) {
        const sinceDate = new Date(options.since);
        history.messages = history.messages.filter(m => new Date(m.timestamp) >= sinceDate);
      }

      return history;

    } catch (error) {
      console.error('❌ Erro ao recuperar histórico:', error);
      throw error;
    }
  }

  /**
   * Listar todos os projetos com conversas
   *
   * @returns {Array} Lista de projetos
   */
  async listProjects() {
    try {
      if (!this.initialized) await this.init();

      const projects = [];
      const entries = await fs.readdir(this.conversationsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const historyPath = path.join(this.conversationsPath, entry.name, 'history.json');

          try {
            const data = await fs.readFile(historyPath, 'utf-8');
            const history = JSON.parse(data);

            projects.push({
              projectId: entry.name,
              totalMessages: history.messages.length,
              createdAt: history.createdAt,
              updatedAt: history.updatedAt,
              lastMessage: history.messages[history.messages.length - 1]
            });
          } catch (err) {
            // Ignorar projetos sem histórico válido
          }
        }
      }

      // Ordenar por data de atualização (mais recente primeiro)
      projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      return projects;

    } catch (error) {
      console.error('❌ Erro ao listar projetos:', error);
      return [];
    }
  }

  /**
   * Deletar histórico de um projeto
   *
   * @param {string} projectId - ID do projeto
   */
  async deleteHistory(projectId) {
    try {
      if (!this.initialized) await this.init();

      const projectPath = path.join(this.conversationsPath, projectId);
      await fs.rm(projectPath, { recursive: true, force: true });

      console.log(`🗑️  Histórico do projeto ${projectId} deletado`);
      return true;

    } catch (error) {
      console.error('❌ Erro ao deletar histórico:', error);
      return false;
    }
  }

  /**
   * Exportar histórico de um projeto
   *
   * @param {string} projectId - ID do projeto
   * @param {string} format - 'json' ou 'md'
   * @returns {string} Conteúdo exportado
   */
  async exportHistory(projectId, format = 'md') {
    try {
      const history = await this.getHistory(projectId);

      if (format === 'json') {
        return JSON.stringify(history, null, 2);
      }

      // Formato Markdown
      let markdown = `# Histórico de Conversas - Projeto ${projectId}\n\n`;
      markdown += `**Criado em:** ${history.createdAt || 'N/A'}\n`;
      markdown += `**Atualizado em:** ${history.updatedAt || 'N/A'}\n`;
      markdown += `**Total de mensagens:** ${history.messages.length}\n\n`;
      markdown += '---\n\n';

      for (const message of history.messages) {
        const timestamp = new Date(message.timestamp).toLocaleString('pt-BR');
        const role = message.role === 'user' ? '👤 **Usuário**' : '🤖 **Assistente**';

        markdown += `## ${role} - ${timestamp}\n\n`;
        markdown += `${message.content}\n\n`;

        if (message.metadata && Object.keys(message.metadata).length > 0) {
          markdown += `*Metadados:* ${JSON.stringify(message.metadata)}\n\n`;
        }

        markdown += '---\n\n';
      }

      return markdown;

    } catch (error) {
      console.error('❌ Erro ao exportar histórico:', error);
      throw error;
    }
  }

  /**
   * Buscar mensagens por termo
   *
   * @param {string} projectId - ID do projeto
   * @param {string} searchTerm - Termo a buscar
   * @returns {Array} Mensagens encontradas
   */
  async searchMessages(projectId, searchTerm) {
    try {
      const history = await this.getHistory(projectId);
      const lowerTerm = searchTerm.toLowerCase();

      const matches = history.messages.filter(message =>
        message.content.toLowerCase().includes(lowerTerm)
      );

      return matches;

    } catch (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      return [];
    }
  }

  /**
   * Obter estatísticas de um projeto
   *
   * @param {string} projectId - ID do projeto
   * @returns {object} Estatísticas
   */
  async getStats(projectId) {
    try {
      const history = await this.getHistory(projectId);

      const userMessages = history.messages.filter(m => m.role === 'user').length;
      const assistantMessages = history.messages.filter(m => m.role === 'assistant').length;

      const totalChars = history.messages.reduce((sum, m) => sum + m.content.length, 0);
      const avgChars = history.messages.length > 0 ? Math.round(totalChars / history.messages.length) : 0;

      return {
        projectId,
        totalMessages: history.messages.length,
        userMessages,
        assistantMessages,
        totalCharacters: totalChars,
        avgCharactersPerMessage: avgChars,
        createdAt: history.createdAt,
        updatedAt: history.updatedAt
      };

    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return null;
    }
  }
}

// Singleton
const conversationHistoryService = new ConversationHistoryService();

export default conversationHistoryService;
