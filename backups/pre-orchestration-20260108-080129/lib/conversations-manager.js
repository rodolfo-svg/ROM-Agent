import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Gerenciador de Conversas - Sistema completo de histórico
 * Funcionalidades:
 * - Persistência em arquivo JSON
 * - Geração automática de títulos
 * - Organização por data
 * - Busca em conversas
 * - Deletar/renomear conversas
 */
class ConversationsManager {
  constructor() {
    this.conversationsFile = path.join(__dirname, '../data/conversations.json');
    this.ensureDataDirectory();
    this.conversations = this.loadConversations();
  }

  /**
   * Garantir que o diretório de dados existe
   */
  ensureDataDirectory() {
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  /**
   * Carregar conversas do arquivo
   */
  loadConversations() {
    try {
      if (fs.existsSync(this.conversationsFile)) {
        const data = fs.readFileSync(this.conversationsFile, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    }
    return {};
  }

  /**
   * Salvar conversas no arquivo
   */
  saveConversations() {
    try {
      fs.writeFileSync(
        this.conversationsFile,
        JSON.stringify(this.conversations, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Erro ao salvar conversas:', error);
    }
  }

  /**
   * Criar nova conversa
   */
  createConversation(userId, sessionId, projectId = null) {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    this.conversations[conversationId] = {
      id: conversationId,
      userId: userId,
      sessionId: sessionId,
      projectId: projectId, // null = conversa avulsa, string = vinculado a projeto
      title: 'Nova Conversa',
      titleGenerated: false,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0
    };

    this.saveConversations();
    return conversationId;
  }

  /**
   * Adicionar mensagem à conversa
   */
  addMessage(conversationId, message) {
    if (!this.conversations[conversationId]) {
      return false;
    }

    this.conversations[conversationId].messages.push({
      role: message.role,
      content: message.content,
      timestamp: new Date().toISOString()
    });

    this.conversations[conversationId].messageCount++;
    this.conversations[conversationId].updatedAt = new Date().toISOString();
    this.saveConversations();
    return true;
  }

  /**
   * Gerar título automático para conversa
   * Usa a primeira mensagem do usuário
   */
  generateTitle(conversationId) {
    const conversation = this.conversations[conversationId];
    if (!conversation || conversation.titleGenerated) {
      return;
    }

    // Pegar primeira mensagem do usuário
    const firstUserMessage = conversation.messages.find(m => m.role === 'user');
    if (!firstUserMessage) {
      return;
    }

    // Gerar título baseado nos primeiros 50 caracteres
    let title = firstUserMessage.content.substring(0, 50).trim();

    // Remover quebras de linha
    title = title.replace(/\n/g, ' ');

    // Se terminar no meio de uma palavra, cortar na última palavra completa
    if (firstUserMessage.content.length > 50) {
      const lastSpace = title.lastIndexOf(' ');
      if (lastSpace > 20) { // Mínimo de 20 chars
        title = title.substring(0, lastSpace);
      }
      title += '...';
    }

    this.conversations[conversationId].title = title;
    this.conversations[conversationId].titleGenerated = true;
    this.saveConversations();
  }

  /**
   * Obter conversa específica
   */
  getConversation(conversationId) {
    return this.conversations[conversationId] || null;
  }

  /**
   * Listar todas as conversas de um usuário
   */
  listConversations(userId, options = {}) {
    const { limit = 50, offset = 0, search = '', projectId = null } = options;

    let userConversations = Object.values(this.conversations)
      .filter(conv => conv.userId === userId);

    // Filtrar por projeto se especificado
    if (projectId !== null) {
      if (projectId === 'null' || projectId === '') {
        // Conversas avulsas (sem projeto)
        userConversations = userConversations.filter(conv => !conv.projectId);
      } else {
        // Conversas de um projeto específico
        userConversations = userConversations.filter(conv => conv.projectId === projectId);
      }
    }

    // Busca por título ou conteúdo
    if (search) {
      const searchLower = search.toLowerCase();
      userConversations = userConversations.filter(conv => {
        // Buscar no título
        if (conv.title.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Buscar nas mensagens
        return conv.messages.some(msg =>
          msg.content.toLowerCase().includes(searchLower)
        );
      });
    }

    // Ordenar por data de atualização (mais recente primeiro)
    userConversations.sort((a, b) =>
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );

    // Paginar
    const total = userConversations.length;
    userConversations = userConversations.slice(offset, offset + limit);

    return {
      conversations: userConversations,
      total,
      hasMore: offset + limit < total
    };
  }

  /**
   * Organizar conversas por data (Hoje, Ontem, etc.)
   */
  organizeByDate(userId, projectId = null) {
    let userConversations = Object.values(this.conversations)
      .filter(conv => conv.userId === userId);

    // Filtrar por projeto se especificado
    if (projectId !== null) {
      if (projectId === 'null' || projectId === '') {
        userConversations = userConversations.filter(conv => !conv.projectId);
      } else {
        userConversations = userConversations.filter(conv => conv.projectId === projectId);
      }
    }

    userConversations = userConversations.sort((a, b) =>
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const organized = {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: []
    };

    userConversations.forEach(conv => {
      const updatedAt = new Date(conv.updatedAt);

      if (updatedAt >= today) {
        organized.today.push(conv);
      } else if (updatedAt >= yesterday) {
        organized.yesterday.push(conv);
      } else if (updatedAt >= lastWeek) {
        organized.lastWeek.push(conv);
      } else if (updatedAt >= lastMonth) {
        organized.lastMonth.push(conv);
      } else {
        organized.older.push(conv);
      }
    });

    return organized;
  }

  /**
   * Renomear conversa
   */
  renameConversation(conversationId, newTitle) {
    if (!this.conversations[conversationId]) {
      return false;
    }

    this.conversations[conversationId].title = newTitle.trim();
    this.conversations[conversationId].updatedAt = new Date().toISOString();
    this.saveConversations();
    return true;
  }

  /**
   * Deletar conversa
   */
  deleteConversation(conversationId) {
    if (!this.conversations[conversationId]) {
      return false;
    }

    delete this.conversations[conversationId];
    this.saveConversations();
    return true;
  }

  /**
   * Deletar múltiplas conversas
   */
  deleteMultipleConversations(conversationIds) {
    let deleted = 0;
    conversationIds.forEach(id => {
      if (this.conversations[id]) {
        delete this.conversations[id];
        deleted++;
      }
    });

    if (deleted > 0) {
      this.saveConversations();
    }
    return deleted;
  }

  /**
   * Limpar conversas antigas (mais de X dias)
   */
  cleanOldConversations(userId, daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const toDelete = Object.keys(this.conversations).filter(id => {
      const conv = this.conversations[id];
      return conv.userId === userId &&
             new Date(conv.updatedAt) < cutoffDate;
    });

    return this.deleteMultipleConversations(toDelete);
  }

  /**
   * Vincular conversa a projeto
   */
  linkToProject(conversationId, projectId) {
    if (!this.conversations[conversationId]) {
      return false;
    }

    this.conversations[conversationId].projectId = projectId;
    this.conversations[conversationId].updatedAt = new Date().toISOString();
    this.saveConversations();
    return true;
  }

  /**
   * Desvincular conversa de projeto
   */
  unlinkFromProject(conversationId) {
    if (!this.conversations[conversationId]) {
      return false;
    }

    this.conversations[conversationId].projectId = null;
    this.conversations[conversationId].updatedAt = new Date().toISOString();
    this.saveConversations();
    return true;
  }

  /**
   * Obter estatísticas de conversas
   */
  getStats(userId, projectId = null) {
    let userConversations = Object.values(this.conversations)
      .filter(conv => conv.userId === userId);

    // Filtrar por projeto se especificado
    if (projectId !== null) {
      if (projectId === 'null' || projectId === '') {
        userConversations = userConversations.filter(conv => !conv.projectId);
      } else {
        userConversations = userConversations.filter(conv => conv.projectId === projectId);
      }
    }

    const totalMessages = userConversations.reduce(
      (sum, conv) => sum + conv.messageCount,
      0
    );

    const avgMessagesPerConversation = userConversations.length > 0
      ? Math.round(totalMessages / userConversations.length)
      : 0;

    return {
      totalConversations: userConversations.length,
      totalMessages,
      avgMessagesPerConversation,
      oldestConversation: userConversations.length > 0
        ? new Date(Math.min(...userConversations.map(c => new Date(c.createdAt))))
        : null,
      newestConversation: userConversations.length > 0
        ? new Date(Math.max(...userConversations.map(c => new Date(c.createdAt))))
        : null
    };
  }

  /**
   * Exportar conversa para JSON
   */
  exportConversation(conversationId) {
    const conversation = this.conversations[conversationId];
    if (!conversation) {
      return null;
    }

    return {
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: conversation.messageCount,
      messages: conversation.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }))
    };
  }
}

// Exportar instância única (singleton)
export default new ConversationsManager();
