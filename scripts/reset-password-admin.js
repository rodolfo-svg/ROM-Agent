#!/usr/bin/env node

/**
 * ROM Agent - Script de Reset de Senha (Admin)
 *
 * Reseta a senha de um usuário e estende a expiração por mais 90 dias
 * Uso: node scripts/reset-password-admin.js <email> <nova-senha>
 */

import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function resetPassword() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('\n❌ Uso: node scripts/reset-password-admin.js <email> <nova-senha>\n');
    console.error('Exemplo: node scripts/reset-password-admin.js rodolfo@exemplo.com NovaSenha123!\n');
    process.exit(1);
  }

  const [email, newPassword] = args;

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('🔐 RESET DE SENHA - ROM AGENT v2.8.0');
  console.log('════════════════════════════════════════════════════════════════\n');

  try {
    // Validar senha
    if (newPassword.length < 8) {
      console.error('❌ Senha deve ter no mínimo 8 caracteres');
      process.exit(1);
    }

    console.log(`📧 Email: ${email}`);
    console.log(`🔐 Nova senha: ${'*'.repeat(newPassword.length)}\n`);

    // Conectar ao banco
    const config = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com')
        ? { rejectUnauthorized: false }
        : false
    };

    const client = new pg.Client(config);
    await client.connect();
    console.log('✅ Conectado ao PostgreSQL\n');

    // Verificar se usuário existe
    const userResult = await client.query(
      'SELECT id, email, name, role FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      console.error(`❌ Usuário com email ${email} não encontrado!`);
      await client.end();
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log('👤 Usuário encontrado:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Nome: ${user.name}`);
    console.log(`   Role: ${user.role}\n`);

    // Gerar hash da nova senha
    console.log('🔐 Gerando hash bcrypt (12 rounds)...');
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Calcular nova data de expiração (90 dias)
    const passwordChangedAt = new Date();
    const passwordExpiresAt = new Date();
    passwordExpiresAt.setDate(passwordExpiresAt.getDate() + 90);

    // Atualizar senha no banco
    await client.query(
      `UPDATE users
       SET password_hash = $1,
           password_changed_at = $2,
           password_expires_at = $3,
           force_password_change = false,
           account_locked = false,
           account_locked_until = NULL,
           updated_at = NOW()
       WHERE id = $4`,
      [passwordHash, passwordChangedAt, passwordExpiresAt, user.id]
    );

    console.log('✅ Senha atualizada com sucesso!\n');
    console.log('📅 Detalhes:');
    console.log(`   Senha alterada em: ${passwordChangedAt.toISOString()}`);
    console.log(`   Senha expira em: ${passwordExpiresAt.toISOString()}`);
    console.log(`   Dias até expiração: 90 dias\n`);

    console.log('════════════════════════════════════════════════════════════════');
    console.log('✅ Reset de senha concluído!');
    console.log('════════════════════════════════════════════════════════════════\n');

    console.log('🎯 Próximo passo: Faça login em https://rom-agent-ia.onrender.com\n');

    await client.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

resetPassword();
