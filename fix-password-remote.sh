#!/bin/bash
# Script para executar remotamente via Render SSH
# Fix de senha expirada para rodolfo@rom.adv.br

cat > /tmp/fix-password.js << 'EOFSCRIPT'
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixPassword() {
  const email = 'rodolfo@rom.adv.br';
  const newPassword = 'Mota@2323';

  console.log('\n🔐 Resetando senha para:', email);

  try {
    // Hash da senha
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Calcular expiração (90 dias)
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    // Atualizar no banco
    const result = await pool.query(
      `UPDATE users
       SET password_hash = $1,
           password_changed_at = $2,
           password_expires_at = $3,
           force_password_change = false,
           account_locked = false,
           account_locked_until = NULL,
           updated_at = NOW()
       WHERE email = $4
       RETURNING id, email, name`,
      [passwordHash, now, expiresAt, email]
    );

    if (result.rows.length === 0) {
      console.error('❌ Usuário não encontrado:', email);
      process.exit(1);
    }

    const user = result.rows[0];

    console.log('✅ Senha resetada com sucesso!');
    console.log('   Usuário:', user.name);
    console.log('   Email:', user.email);
    console.log('   Nova senha: Mota@2323');
    console.log('   Expira em:', expiresAt.toISOString());
    console.log('   Dias até expiração: 90');

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

fixPassword();
EOFSCRIPT

node /tmp/fix-password.js
