#!/usr/bin/env node

// ════════════════════════════════════════════════════════════════
// ROM AGENT - LIST USERS SCRIPT v2.8.0
// ════════════════════════════════════════════════════════════════
// Lista todos os usuários cadastrados
// Uso: node scripts/list-users.js
// ════════════════════════════════════════════════════════════════

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function listUsers() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('👥 USUÁRIOS CADASTRADOS - ROM AGENT v2.8.0');
  console.log('════════════════════════════════════════════════════════════════\n');

  try {
    const config = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false
    };

    const client = new pg.Client(config);
    await client.connect();

    const result = await client.query(`
      SELECT
        id,
        email,
        name,
        role,
        oab,
        failed_login_attempts,
        account_locked_until,
        password_expires_at,
        force_password_change,
        last_login_at,
        created_at,
        (SELECT COUNT(*) FROM documents WHERE user_id = users.id) as doc_count,
        (SELECT COUNT(*) FROM uploads WHERE user_id = users.id) as upload_count,
        (SELECT COUNT(*) FROM conversations WHERE user_id = users.id) as conversation_count
      FROM users
      ORDER BY created_at DESC
    `);

    if (result.rows.length === 0) {
      console.log('⚠️  Nenhum usuário cadastrado\n');
      await client.end();
      process.exit(0);
    }

    console.log(`Total: ${result.rows.length} usuário(s)\n`);

    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'Sem nome'}`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   🎭 Role: ${user.role}`);
      console.log(`   🆔 ID: ${user.id}`);

      if (user.oab) {
        console.log(`   ⚖️  OAB: ${user.oab}`);
      }

      if (user.failed_login_attempts > 0) {
        console.log(`   ⚠️  Tentativas falhadas: ${user.failed_login_attempts}`);
      }

      if (user.account_locked_until) {
        const locked = new Date(user.account_locked_until);
        const now = new Date();
        if (locked > now) {
          console.log(`   🔒 Conta bloqueada até: ${locked.toISOString()}`);
        }
      }

      if (user.force_password_change) {
        console.log(`   🔐 Forçar troca de senha: Sim`);
      }

      if (user.password_expires_at) {
        const expires = new Date(user.password_expires_at);
        const now = new Date();
        const daysUntilExpiry = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) {
          console.log(`   ⏰ Senha: EXPIRADA há ${Math.abs(daysUntilExpiry)} dias`);
        } else if (daysUntilExpiry < 7) {
          console.log(`   ⏰ Senha expira em: ${daysUntilExpiry} dias (⚠️ )`);
        } else {
          console.log(`   ⏰ Senha expira em: ${daysUntilExpiry} dias`);
        }
      }

      if (user.last_login_at) {
        console.log(`   🕐 Último login: ${new Date(user.last_login_at).toLocaleString('pt-BR')}`);
      } else {
        console.log(`   🕐 Último login: Nunca`);
      }

      console.log(`   📄 Documentos: ${user.doc_count}`);
      console.log(`   📎 Uploads: ${user.upload_count}`);
      console.log(`   💬 Conversas: ${user.conversation_count}`);
      console.log(`   📅 Criado em: ${new Date(user.created_at).toLocaleString('pt-BR')}`);
      console.log('');
    });

    console.log('════════════════════════════════════════════════════════════════\n');

    await client.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERRO AO LISTAR USUÁRIOS:\n');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

listUsers();
