#!/usr/bin/env node

/**
 * ROM Agent - Verificar Status de Senha de Usuário
 *
 * Verifica o status da senha de um usuário específico
 * Uso: node scripts/check-user-password-status.js <email>
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function checkPasswordStatus() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('\n❌ Uso: node scripts/check-user-password-status.js <email>\n');
    process.exit(1);
  }

  const email = args[0];

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('🔍 VERIFICAR STATUS DE SENHA - ROM AGENT v2.8.0');
  console.log('════════════════════════════════════════════════════════════════\n');

  try {
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

    // Buscar usuário
    const result = await client.query(
      `SELECT
        id, email, name, role,
        password_changed_at,
        password_expires_at,
        force_password_change,
        account_locked,
        account_locked_until,
        created_at,
        updated_at
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      console.error(`❌ Usuário com email ${email} não encontrado!`);
      await client.end();
      process.exit(1);
    }

    const user = result.rows[0];
    const now = new Date();

    console.log('👤 INFORMAÇÕES DO USUÁRIO:');
    console.log('─'.repeat(70));
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nome: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log();

    console.log('🔐 STATUS DA SENHA:');
    console.log('─'.repeat(70));

    if (user.password_changed_at) {
      const changedAt = new Date(user.password_changed_at);
      const daysSinceChange = Math.floor((now - changedAt) / (1000 * 60 * 60 * 24));
      console.log(`   Última troca: ${changedAt.toISOString()}`);
      console.log(`   Há ${daysSinceChange} dias`);
    } else {
      console.log('   Última troca: NÃO REGISTRADA ⚠️');
    }

    if (user.password_expires_at) {
      const expiresAt = new Date(user.password_expires_at);
      const daysUntilExpiry = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));

      console.log(`   Expira em: ${expiresAt.toISOString()}`);

      if (expiresAt < now) {
        const daysExpired = Math.abs(daysUntilExpiry);
        console.log(`   Status: ❌ EXPIRADA há ${daysExpired} dias`);
      } else if (daysUntilExpiry <= 7) {
        console.log(`   Status: ⚠️ Expira em ${daysUntilExpiry} dias (ATENÇÃO!)`);
      } else {
        console.log(`   Status: ✅ Válida (expira em ${daysUntilExpiry} dias)`);
      }
    } else {
      console.log('   Expira em: SEM EXPIRAÇÃO CONFIGURADA');
      console.log(`   Status: ⚠️ Campo password_expires_at está NULL`);
    }

    console.log();
    console.log('🔒 RESTRIÇÕES DE CONTA:');
    console.log('─'.repeat(70));
    console.log(`   Forçar troca de senha: ${user.force_password_change ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`   Conta bloqueada: ${user.account_locked ? '🔒 SIM' : '✅ NÃO'}`);

    if (user.account_locked_until) {
      const lockedUntil = new Date(user.account_locked_until);
      console.log(`   Bloqueada até: ${lockedUntil.toISOString()}`);
      console.log(`   Status bloqueio: ${lockedUntil > now ? '🔒 AINDA BLOQUEADA' : '✅ DESBLOQUEADA'}`);
    }

    console.log();
    console.log('📅 DATAS:');
    console.log('─'.repeat(70));
    console.log(`   Criado em: ${user.created_at}`);
    console.log(`   Atualizado em: ${user.updated_at}`);

    console.log();
    console.log('════════════════════════════════════════════════════════════════\n');

    // Diagnóstico
    if (user.password_expires_at && new Date(user.password_expires_at) < now) {
      console.log('⚠️  DIAGNÓSTICO: Senha expirada!');
      console.log();
      console.log('💡 SOLUÇÃO: Execute o comando abaixo para resetar:');
      console.log(`   node scripts/reset-password-admin.js ${email} NovaSenha123!`);
      console.log();
    } else if (!user.password_expires_at) {
      console.log('⚠️  DIAGNÓSTICO: Campo password_expires_at está NULL');
      console.log();
      console.log('💡 SOLUÇÃO: Execute UPDATE para definir data de expiração:');
      console.log('   UPDATE users');
      console.log('   SET password_expires_at = NOW() + INTERVAL \'90 days\',');
      console.log('       password_changed_at = NOW()');
      console.log(`   WHERE email = '${email}';`);
      console.log();
    } else if (user.force_password_change) {
      console.log('⚠️  DIAGNÓSTICO: Usuário deve trocar senha no próximo login');
      console.log();
    } else {
      console.log('✅ Senha está válida e não há restrições ativas');
      console.log();
    }

    await client.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkPasswordStatus();
