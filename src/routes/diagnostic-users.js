/**
 * DIAGNOSTIC: User Roles
 * Endpoint temporário para diagnosticar problema de permissões
 */

import express from 'express';
import { getPostgresPool } from '../config/database.js';

const router = express.Router();

/**
 * GET /api/diagnostic/users
 * Mostra estrutura da tabela users e roles dos usuários
 */
router.get('/', async (req, res) => {
  try {
    // LOG: Mostrar exatamente o que está na sessão
    console.log('🔍 [DIAGNOSTIC] Session data:', {
      hasSession: !!req.session,
      hasUser: !!req.session?.user,
      sessionKeys: req.session ? Object.keys(req.session) : [],
      sessionID: req.sessionID,
      sessionUser: req.session?.user,
      sessionAuthenticated: req.session?.authenticated,
      sessionUserRole: req.session?.userRole,
      cookies: req.headers.cookie
    });

    const pool = getPostgresPool();

    // 1. Verificar colunas da tabela users
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    // 2. Verificar migrations executadas
    const migrationsResult = await pool.query(`
      SELECT version, executed_at
      FROM schema_migrations
      ORDER BY executed_at DESC
      LIMIT 10
    `);

    // 3. Listar usuários e seus roles (dynamic - only existing columns)
    const columns = columnsResult.rows.map(col => col.column_name);
    const selectColumns = ['id', 'email', 'role', 'partner_id', 'created_at']
      .filter(col => columns.includes(col))
      .join(', ');

    const usersResult = await pool.query(`
      SELECT ${selectColumns}
      FROM users
      ORDER BY created_at ASC
      LIMIT 20
    `);

    // 4. Verificar usuário da sessão atual
    const currentUser = req.session?.user || null;

    // 5. Contar usuários por role
    const roleStatsResult = await pool.query(`
      SELECT role, COUNT(*) as count
      FROM users
      GROUP BY role
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      diagnostics: {
        tableColumns: columnsResult.rows,
        hasRoleColumn: columnsResult.rows.some(col => col.column_name === 'role'),
        hasPartnerIdColumn: columnsResult.rows.some(col => col.column_name === 'partner_id'),
        recentMigrations: migrationsResult.rows,
        migration007Executed: migrationsResult.rows.some(m => m.version === '007_add_user_roles'),
        migration008Executed: migrationsResult.rows.some(m => m.version === '008_fix_user_roles_execution'),
        users: usersResult.rows.map(u => ({
          id: u.id,
          email: u.email || 'NULL',
          role: u.role || 'NULL',
          partner_id: u.partner_id || 'NULL',
          created_at: u.created_at || 'NULL'
        })),
        roleStats: roleStatsResult.rows,
        currentSession: {
          authenticated: !!currentUser,
          userId: currentUser?.id || null,
          userEmail: currentUser?.email || null,
          userRole: currentUser?.role || 'NOT_IN_SESSION',
          partnerId: currentUser?.partnerId || null
        }
      }
    });

  } catch (error) {
    console.error('Erro no diagnóstico:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  }
});

export default router;
