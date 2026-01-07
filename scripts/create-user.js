#!/usr/bin/env node

// ════════════════════════════════════════════════════════════════
// ROM AGENT - CREATE USER SCRIPT v2.8.0
// ════════════════════════════════════════════════════════════════
// Script para criar usuários no banco PostgreSQL
// Uso: node scripts/create-user.js
// ════════════════════════════════════════════════════════════════

import bcrypt from 'bcryptjs';
import pg from 'pg';
import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createUser() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('📝 CRIAR NOVO USUÁRIO - ROM AGENT v2.8.0');
  console.log('════════════════════════════════════════════════════════════════\n');

  try {
    // Coletar informações
    const email = await question('📧 Email: ');
    const password = await question('🔐 Senha: ');
    const name = await question('👤 Nome completo: ');
    const oab = await question('⚖️  OAB (ou deixe vazio): ');
    const roleInput = await question('🎭 Role (admin/lawyer/user) [user]: ');

    const role = roleInput.trim() || 'user';

    // Validar email
    if (!email || !email.includes('@')) {
      console.error('❌ Email inválido');
      process.exit(1);
    }

    // Validar senha
    if (!password || password.length < 8) {
      console.error('❌ Senha deve ter no mínimo 8 caracteres');
      process.exit(1);
    }

    // Validar role
    if (!['admin', 'lawyer', 'user'].includes(role)) {
      console.error('❌ Role deve ser: admin, lawyer ou user');
      process.exit(1);
    }

    console.log('\n🔄 Processando...\n');

    // Conectar ao banco
    const config = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false
    };

    const client = new pg.Client(config);
    await client.connect();
    console.log('✅ Conectado ao PostgreSQL\n');

    // Verificar se email já existe
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.error(`❌ Email ${email} já está cadastrado!`);
      process.exit(1);
    }

    // Hash da senha (12 rounds)
    console.log('🔐 Gerando hash bcrypt...');
    const passwordHash = await bcrypt.hash(password, 12);

    // Calcular expiração da senha (90 dias)
    const passwordChangedAt = new Date();
    const passwordExpiresAt = new Date();
    passwordExpiresAt.setDate(passwordExpiresAt.getDate() + 90);

    // Inserir usuário
    const result = await client.query(
      `INSERT INTO users (
        id,
        email,
        password_hash,
        name,
        oab,
        role,
        failed_login_attempts,
        password_changed_at,
        password_expires_at,
        force_password_change,
        created_at,
        updated_at
      ) VALUES (
        uuid_generate_v4(),
        $1,
        $2,
        $3,
        $4,
        $5,
        0,
        $6,
        $7,
        false,
        NOW(),
        NOW()
      ) RETURNING id, email, name, role, created_at`,
      [
        email,
        passwordHash,
        name,
        oab || null,
        role,
        passwordChangedAt,
        passwordExpiresAt
      ]
    );

    const user = result.rows[0];

    // Adicionar ao histórico de senhas
    await client.query(
      `INSERT INTO password_history (user_id, password_hash, created_at)
       VALUES ($1, $2, NOW())`,
      [user.id, passwordHash]
    );

    // Log de auditoria
    await client.query(
      `INSERT INTO audit_log (
        user_id,
        action,
        resource,
        status,
        details,
        created_at
      ) VALUES ($1, 'user_created', $2, 'success', $3, NOW())`,
      [
        user.id,
        `user:${user.id}`,
        JSON.stringify({
          method: 'script',
          role: role,
          email: email
        })
      ]
    );

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('✅ USUÁRIO CRIADO COM SUCESSO!');
    console.log('════════════════════════════════════════════════════════════════\n');
    console.log(`📧 Email:           ${user.email}`);
    console.log(`👤 Nome:            ${user.name}`);
    console.log(`🎭 Role:            ${user.role}`);
    console.log(`🆔 ID:              ${user.id}`);
    console.log(`📅 Criado em:       ${user.created_at.toISOString()}`);
    console.log(`⏰ Senha expira em: ${passwordExpiresAt.toISOString()}`);
    console.log('\n════════════════════════════════════════════════════════════════\n');

    await client.end();
    rl.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERRO AO CRIAR USUÁRIO:\n');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    rl.close();
    process.exit(1);
  }
}

createUser();
