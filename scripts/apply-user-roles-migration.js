#!/usr/bin/env node

/**
 * Script para aplicar migration 007_add_user_roles.sql
 * E atualizar o usuário principal para master_admin
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração do banco de dados
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://rom_agent_user:faPSk0YSNlhyPfBYpri2RcK9XdRbaE8L@dpg-d5819bhr0fns73dmfsv0-a/rom_agent';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
});

async function main() {
  try {
    console.log('🚀 Aplicando migration 007_add_user_roles.sql...\n');

    // 1. Ler arquivo de migration
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '007_add_user_roles.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // 2. Executar migration
    console.log('📝 Executando migration...');
    await pool.query(migrationSQL);
    console.log('✅ Migration aplicada com sucesso!\n');

    // 3. Verificar estrutura da tabela users
    console.log('🔍 Verificando estrutura da tabela users...');
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);

    console.log('\nColunas da tabela users:');
    tableStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

    // 4. Atualizar usuário principal para master_admin
    console.log('\n👤 Atualizando usuário principal para master_admin...');

    const updateResult = await pool.query(`
      UPDATE users
      SET role = 'master_admin',
          partner_id = 'rom',
          updated_at = NOW()
      WHERE email = 'rodolfo@rom.adv.br'
      RETURNING id, email, username, name, role, partner_id;
    `);

    if (updateResult.rows.length > 0) {
      const user = updateResult.rows[0];
      console.log('✅ Usuário atualizado com sucesso:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Nome: ${user.name || '(não definido)'}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Partner ID: ${user.partner_id}`);
    } else {
      console.log('⚠️  Usuário rodolfo@rom.adv.br não encontrado.');
      console.log('   Listando todos os usuários:');

      const allUsers = await pool.query('SELECT id, email, username, role FROM users ORDER BY created_at LIMIT 10');
      allUsers.rows.forEach(u => {
        console.log(`   - ${u.email || u.username} (role: ${u.role || 'NULL'})`);
      });
    }

    // 5. Mostrar distribuição de roles
    console.log('\n📊 Distribuição de roles:');
    const roleStats = await pool.query(`
      SELECT role, COUNT(*) as count
      FROM users
      GROUP BY role
      ORDER BY count DESC;
    `);

    roleStats.rows.forEach(stat => {
      console.log(`   ${stat.role}: ${stat.count} usuário(s)`);
    });

    console.log('\n✅ Processo concluído com sucesso!');
    console.log('\n💡 Próximos passos:');
    console.log('   1. Faça logout e login novamente no sistema');
    console.log('   2. Tente criar um prompt na página System Prompts');
    console.log('   3. Verifique os logs do servidor para confirmar as permissões\n');

  } catch (error) {
    console.error('❌ Erro ao aplicar migration:', error);
    console.error('\nDetalhes do erro:');
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
