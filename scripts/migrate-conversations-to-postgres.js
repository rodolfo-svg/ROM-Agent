#!/usr/bin/env node

/**
 * Migração de Conversas JSON → PostgreSQL
 *
 * Migra todas as conversas de data/conversations.json para as tabelas
 * conversations e messages do PostgreSQL
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const { Pool } = pg;

console.log('═'.repeat(80));
console.log('🔄 MIGRAÇÃO: Conversas JSON → PostgreSQL');
console.log('═'.repeat(80));
console.log('');

async function main() {
  // Conectar ao PostgreSQL
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Conectado ao PostgreSQL');
  } catch (error) {
    console.error('❌ Erro ao conectar ao PostgreSQL:', error.message);
    process.exit(1);
  }

  // Carregar conversas do JSON
  const conversationsPath = path.join(__dirname, '../data/conversations.json');

  if (!fs.existsSync(conversationsPath)) {
    console.log('⚠️  Arquivo conversations.json não encontrado');
    process.exit(0);
  }

  const conversationsData = JSON.parse(fs.readFileSync(conversationsPath, 'utf-8'));
  const conversationIds = Object.keys(conversationsData);

  console.log(`📊 Total de conversas no JSON: ${conversationIds.length}`);
  console.log('');

  let migrated = 0;
  let skipped = 0;
  let messagesInserted = 0;

  for (const convId of conversationIds) {
    const conv = conversationsData[convId];

    try {
      // Verificar se conversa já existe no PostgreSQL
      const existsResult = await pool.query(
        'SELECT id FROM conversations WHERE id = $1',
        [conv.id]
      );

      if (existsResult.rows.length > 0) {
        console.log(`⏭️  Pulando ${conv.id} (já existe no PostgreSQL)`);
        skipped++;
        continue;
      }

      // Inserir conversa
      await pool.query(
        `INSERT INTO conversations (id, user_id, title, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          conv.id,
          conv.userId === 'anonymous' ? null : conv.userId,
          conv.title || 'Nova Conversa',
          conv.createdAt || new Date().toISOString(),
          conv.updatedAt || new Date().toISOString()
        ]
      );

      console.log(`✅ Conversa migrada: ${conv.id}`);
      console.log(`   Título: ${conv.title}`);
      console.log(`   Mensagens: ${conv.messages?.length || 0}`);

      // Inserir mensagens
      if (conv.messages && conv.messages.length > 0) {
        for (const msg of conv.messages) {
          await pool.query(
            `INSERT INTO messages (conversation_id, role, content, created_at)
             VALUES ($1, $2, $3, $4)`,
            [
              conv.id,
              msg.role,
              msg.content,
              msg.timestamp || new Date().toISOString()
            ]
          );
          messagesInserted++;
        }
      }

      migrated++;
      console.log('');

    } catch (error) {
      console.error(`❌ Erro ao migrar ${conv.id}:`, error.message);
      console.log('');
    }
  }

  console.log('═'.repeat(80));
  console.log('📊 RESULTADO DA MIGRAÇÃO');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`✅ Conversas migradas: ${migrated}`);
  console.log(`⏭️  Conversas puladas (já existiam): ${skipped}`);
  console.log(`💬 Mensagens inseridas: ${messagesInserted}`);
  console.log('');

  // Verificar totais no PostgreSQL
  const totalConvs = await pool.query('SELECT COUNT(*) FROM conversations');
  const totalMsgs = await pool.query('SELECT COUNT(*) FROM messages');

  console.log('📈 TOTAIS NO POSTGRESQL:');
  console.log(`   Conversas: ${totalConvs.rows[0].count}`);
  console.log(`   Mensagens: ${totalMsgs.rows[0].count}`);
  console.log('');

  if (migrated > 0) {
    console.log('🎉 Migração concluída com sucesso!');
    console.log('');
    console.log('💡 Próximos passos:');
    console.log('   1. Acesse o dashboard em https://iarom.com.br');
    console.log('   2. Verifique se as conversas antigas aparecem no sidebar');
    console.log('   3. As novas conversas serão salvas automaticamente no PostgreSQL');
  } else {
    console.log('ℹ️  Nenhuma conversa nova para migrar');
  }

  console.log('');
  console.log('═'.repeat(80));

  await pool.end();
}

main().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
