/**
 * CONVERSATIONS ROUTES
 * Gerenciamento de conversas (histórico) com persistência no PostgreSQL
 */

import express from 'express';
import { getPostgresPool } from '../config/database.js';
import logger from '../../lib/logger.js';

const router = express.Router();

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.id) {
    return res.status(401).json({
      success: false,
      error: 'Não autenticado'
    });
  }
  next();
}

/**
 * GET /api/conversations
 * Lista todas as conversas do usuário
 */
router.get('/', requireAuth, async (req, res) => {
  const userId = req.session.user.id;

  try {
    const pool = getPostgresPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Banco de dados indisponível'
      });
    }

    const result = await pool.query(
      `SELECT
        c.id,
        c.title,
        c.created_at,
        c.updated_at,
        COUNT(m.id) as message_count,
        MAX(m.created_at) as last_message_at
       FROM conversations c
       LEFT JOIN messages m ON c.id = m.conversation_id
       WHERE c.user_id = $1 AND c.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY c.updated_at DESC
       LIMIT 100`,
      [userId]
    );

    res.json({
      success: true,
      conversations: result.rows
    });

  } catch (error) {
    logger.error('Erro ao listar conversas', { error: error.message, userId });
    res.status(500).json({
      success: false,
      error: 'Erro ao listar conversas'
    });
  }
});

/**
 * POST /api/conversations
 * Cria nova conversa
 */
router.post('/', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const { title } = req.body;

  try {
    const pool = getPostgresPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Banco de dados indisponível'
      });
    }

    const result = await pool.query(
      `INSERT INTO conversations (user_id, title, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id, title, created_at, updated_at`,
      [userId, title || 'Nova Conversa']
    );

    logger.info('Conversa criada', {
      userId,
      conversationId: result.rows[0].id
    });

    res.json({
      success: true,
      conversation: result.rows[0]
    });

  } catch (error) {
    logger.error('Erro ao criar conversa', { error: error.message, userId });
    res.status(500).json({
      success: false,
      error: 'Erro ao criar conversa'
    });
  }
});

/**
 * GET /api/conversations/:id
 * Busca conversa específica com todas as mensagens
 */
router.get('/:id', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const { id } = req.params;

  try {
    const pool = getPostgresPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Banco de dados indisponível'
      });
    }

    // Buscar conversa
    const convResult = await pool.query(
      `SELECT id, title, created_at, updated_at
       FROM conversations
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, userId]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Conversa não encontrada'
      });
    }

    // Buscar mensagens
    const messagesResult = await pool.query(
      `SELECT id, role, content, model, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    res.json({
      success: true,
      conversation: {
        ...convResult.rows[0],
        messages: messagesResult.rows
      }
    });

  } catch (error) {
    logger.error('Erro ao buscar conversa', { error: error.message, userId, conversationId: id });
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar conversa'
    });
  }
});

/**
 * PUT /api/conversations/:id
 * Atualiza título da conversa
 */
router.put('/:id', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const { id } = req.params;
  const { title } = req.body;

  if (!title || title.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Título é obrigatório'
    });
  }

  try {
    const pool = getPostgresPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Banco de dados indisponível'
      });
    }

    const result = await pool.query(
      `UPDATE conversations
       SET title = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
       RETURNING id, title, updated_at`,
      [title.trim(), id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Conversa não encontrada'
      });
    }

    logger.info('Conversa atualizada', { userId, conversationId: id });

    res.json({
      success: true,
      conversation: result.rows[0]
    });

  } catch (error) {
    logger.error('Erro ao atualizar conversa', { error: error.message, userId, conversationId: id });
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar conversa'
    });
  }
});

/**
 * DELETE /api/conversations/:id
 * Deleta conversa (soft delete)
 */
router.delete('/:id', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const { id } = req.params;

  try {
    const pool = getPostgresPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Banco de dados indisponível'
      });
    }

    const result = await pool.query(
      `UPDATE conversations
       SET deleted_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Conversa não encontrada'
      });
    }

    logger.info('Conversa deletada', { userId, conversationId: id });

    res.json({
      success: true,
      message: 'Conversa deletada'
    });

  } catch (error) {
    logger.error('Erro ao deletar conversa', { error: error.message, userId, conversationId: id });
    res.status(500).json({
      success: false,
      error: 'Erro ao deletar conversa'
    });
  }
});

/**
 * POST /api/conversations/:id/messages
 * Adiciona mensagem à conversa
 */
router.post('/:id/messages', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const { id } = req.params;
  const { role, content, model } = req.body;

  if (!role || !content) {
    return res.status(400).json({
      success: false,
      error: 'Role e content são obrigatórios'
    });
  }

  try {
    const pool = getPostgresPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Banco de dados indisponível'
      });
    }

    // Verificar se conversa pertence ao usuário
    const convCheck = await pool.query(
      `SELECT id FROM conversations WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, userId]
    );

    if (convCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Conversa não encontrada'
      });
    }

    // Inserir mensagem
    const result = await pool.query(
      `INSERT INTO messages (conversation_id, role, content, model, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, role, content, model, created_at`,
      [id, role, content, model || null]
    );

    // Atualizar timestamp da conversa
    await pool.query(
      `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: result.rows[0]
    });

  } catch (error) {
    logger.error('Erro ao adicionar mensagem', { error: error.message, userId, conversationId: id });
    res.status(500).json({
      success: false,
      error: 'Erro ao adicionar mensagem'
    });
  }
});

export default router;
