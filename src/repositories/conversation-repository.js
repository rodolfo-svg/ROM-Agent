/**
 * CONVERSATION REPOSITORY
 * Operações de banco de dados para conversações
 * Pattern: Repository para isolar lógica de persistência
 */

import { getPostgresPool, safeQuery } from '../config/database.js';
import logger from '../../lib/logger.js';

/**
 * Criar nova conversação
 */
export async function createConversation(data) {
  const { userId, title, mode = 'juridico', model } = data;

  const sql = `
    INSERT INTO conversations (user_id, title, mode, model)
    VALUES ($1, $2, $3, $4)
    RETURNING id, user_id, title, mode, model, created_at, updated_at
  `;

  const result = await safeQuery(sql, [userId, title, mode, model]);

  if (result.fallback) {
    logger.warn('Conversação criada sem persistência (DB indisponível)');
    // Retornar objeto em memória como fallback
    return {
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      mode,
      model,
      created_at: new Date(),
      updated_at: new Date(),
      ephemeral: true
    };
  }

  return result.rows[0];
}

/**
 * Buscar conversação por ID
 */
export async function getConversationById(conversationId) {
  const sql = `
    SELECT
      c.*,
      COUNT(m.id) as message_count,
      COALESCE(SUM(m.tokens_input), 0) + COALESCE(SUM(m.tokens_output), 0) as total_tokens
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    WHERE c.id = $1 AND c.archived_at IS NULL
    GROUP BY c.id
  `;

  const result = await safeQuery(sql, [conversationId]);
  return result.rows[0] || null;
}

/**
 * Listar conversações do usuário
 */
export async function listUserConversations(userId, options = {}) {
  const { limit = 20, offset = 0, mode, includeArchived = false } = options;

  let sql = `
    SELECT
      c.id,
      c.title,
      c.mode,
      c.model,
      c.created_at,
      c.updated_at,
      COUNT(m.id) as message_count,
      COALESCE(SUM(m.tokens_input), 0) + COALESCE(SUM(m.tokens_output), 0) as total_tokens
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    WHERE c.user_id = $1
  `;

  const params = [userId];
  let paramIndex = 2;

  if (!includeArchived) {
    sql += ` AND c.archived_at IS NULL`;
  }

  if (mode) {
    sql += ` AND c.mode = $${paramIndex}`;
    params.push(mode);
    paramIndex++;
  }

  sql += `
    GROUP BY c.id
    ORDER BY c.updated_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);

  const result = await safeQuery(sql, params);

  if (result.fallback) {
    return [];
  }

  return result.rows;
}

/**
 * Atualizar conversação
 */
export async function updateConversation(conversationId, data) {
  const { title, metadata } = data;

  const updates = [];
  const params = [];
  let paramIndex = 1;

  if (title !== undefined) {
    updates.push(`title = $${paramIndex}`);
    params.push(title);
    paramIndex++;
  }

  if (metadata !== undefined) {
    updates.push(`metadata = $${paramIndex}`);
    params.push(JSON.stringify(metadata));
    paramIndex++;
  }

  if (updates.length === 0) {
    return null;
  }

  updates.push(`updated_at = NOW()`);

  const sql = `
    UPDATE conversations
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  params.push(conversationId);

  const result = await safeQuery(sql, params);
  return result.rows[0] || null;
}

/**
 * Arquivar conversação
 */
export async function archiveConversation(conversationId) {
  const sql = `
    UPDATE conversations
    SET archived_at = NOW()
    WHERE id = $1
    RETURNING id, archived_at
  `;

  const result = await safeQuery(sql, [conversationId]);
  return result.rows[0] || null;
}

/**
 * Deletar conversação (hard delete)
 */
export async function deleteConversation(conversationId) {
  const sql = `DELETE FROM conversations WHERE id = $1`;
  const result = await safeQuery(sql, [conversationId]);
  return result.rowCount > 0;
}

/**
 * Adicionar mensagem à conversação
 */
export async function addMessage(data) {
  const {
    conversationId,
    role,
    content,
    model,
    tokensInput,
    tokensOutput,
    latencyMs,
    stopReason,
    metadata = {}
  } = data;

  const sql = `
    INSERT INTO messages (
      conversation_id, role, content, model,
      tokens_input, tokens_output, latency_ms, stop_reason, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;

  const result = await safeQuery(sql, [
    conversationId,
    role,
    content,
    model,
    tokensInput,
    tokensOutput,
    latencyMs,
    stopReason,
    JSON.stringify(metadata)
  ]);

  if (result.fallback) {
    logger.warn('Mensagem NÃO foi persistida (DB indisponível)');
    return {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      role,
      content,
      created_at: new Date(),
      ephemeral: true
    };
  }

  // Atualizar updated_at da conversação
  await safeQuery(
    `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
    [conversationId]
  );

  return result.rows[0];
}

/**
 * Buscar mensagens da conversação
 */
export async function getConversationMessages(conversationId, options = {}) {
  const { limit = 100, offset = 0 } = options;

  const sql = `
    SELECT
      id, conversation_id, role, content, model,
      tokens_input, tokens_output, latency_ms, stop_reason,
      metadata, created_at
    FROM messages
    WHERE conversation_id = $1
    ORDER BY created_at ASC
    LIMIT $2 OFFSET $3
  `;

  const result = await safeQuery(sql, [conversationId, limit, offset]);

  if (result.fallback) {
    return [];
  }

  return result.rows;
}

/**
 * Estatísticas da conversação
 */
export async function getConversationStats(conversationId) {
  const sql = `
    SELECT
      COUNT(*) as message_count,
      COUNT(*) FILTER (WHERE role = 'user') as user_messages,
      COUNT(*) FILTER (WHERE role = 'assistant') as assistant_messages,
      COALESCE(SUM(tokens_input), 0) as total_tokens_input,
      COALESCE(SUM(tokens_output), 0) as total_tokens_output,
      COALESCE(AVG(latency_ms), 0) as avg_latency_ms,
      MAX(created_at) as last_message_at
    FROM messages
    WHERE conversation_id = $1
  `;

  const result = await safeQuery(sql, [conversationId]);

  if (result.fallback || result.rows.length === 0) {
    return {
      message_count: 0,
      user_messages: 0,
      assistant_messages: 0,
      total_tokens_input: 0,
      total_tokens_output: 0,
      avg_latency_ms: 0,
      last_message_at: null
    };
  }

  return result.rows[0];
}

/**
 * Export default
 */
export default {
  createConversation,
  getConversationById,
  listUserConversations,
  updateConversation,
  archiveConversation,
  deleteConversation,
  addMessage,
  getConversationMessages,
  getConversationStats
};
