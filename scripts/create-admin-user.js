#!/usr/bin/env node
/**
 * CREATE ADMIN USER
 * Cria usuário admin padrão se não existir nenhum usuário
 *
 * Uso: npm run create-admin
 * Ou: node scripts/create-admin-user.js
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function createAdminUser() {
  console.log('═'.repeat(70));
  console.log('👤 CRIAR USUÁRIO ADMIN');
  console.log('═'.repeat(70));
  console.log('');

  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL não configurado!');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao PostgreSQL');
    console.log('');

    // Verificar se já existem usuários
    const usersCount = await client.query('SELECT COUNT(*) FROM users');
    const totalUsers = parseInt(usersCount.rows[0].count);

    console.log(`📊 Total de usuários no banco: ${totalUsers}`);
    console.log('');

    if (totalUsers > 0) {
      // Listar usuários existentes
      const users = await client.query(`
        SELECT email, name, role, created_at
        FROM users
        ORDER BY created_at DESC
      `);

      console.log('👥 USUÁRIOS EXISTENTES:');
      console.log('─'.repeat(70));
      users.rows.forEach((user, idx) => {
        console.log(`${idx + 1}. ${user.email}`);
        console.log(`   Nome: ${user.name || 'N/A'}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Criado: ${new Date(user.created_at).toLocaleString('pt-BR')}`);
        console.log('');
      });

      console.log('⚠️  Usuários já existem. Não criando admin padrão.');
      console.log('');
      console.log('Para fazer login use um dos emails acima.');
      console.log('');
    } else {
      // Criar usuário admin padrão
      console.log('📝 Nenhum usuário encontrado. Criando admin padrão...');
      console.log('');

      const defaultAdmin = {
        email: 'admin@iarom.com.br',
        password: 'Admin@123',
        name: 'Administrador ROM',
        role: 'admin',
        oab: null
      };

      const passwordHash = await bcrypt.hash(defaultAdmin.password, 10);

      await client.query(`
        INSERT INTO users (email, password_hash, name, role, oab)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        defaultAdmin.email,
        passwordHash,
        defaultAdmin.name,
        defaultAdmin.role,
        defaultAdmin.oab
      ]);

      console.log('✅ ADMIN CRIADO COM SUCESSO!');
      console.log('');
      console.log('━'.repeat(70));
      console.log('📋 CREDENCIAIS DE ACESSO:');
      console.log('━'.repeat(70));
      console.log(`Email:    ${defaultAdmin.email}`);
      console.log(`Senha:    ${defaultAdmin.password}`);
      console.log('━'.repeat(70));
      console.log('');
      console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
      console.log('');
    }

  } catch (error) {
    console.error('');
    console.error('❌ ERRO:', error.message);
    console.error('');
    process.exit(1);
  } finally {
    await client.end();
  }

  console.log('═'.repeat(70));
  console.log('');
}

createAdminUser().catch(error => {
  console.error('');
  console.error('💥 ERRO FATAL');
  console.error(error);
  console.error('');
  process.exit(1);
});
