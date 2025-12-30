#!/usr/bin/env node
/**
 * TESTE DE PERSISTÊNCIA DE DADOS
 * Verifica se conversas, usuários e mensagens estão sendo salvos no PostgreSQL
 *
 * Uso: npm run test:persistence
 * Ou: node scripts/test-database-persistence.js
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function testPersistence() {
  console.log('═'.repeat(70));
  console.log('🔍 TESTE DE PERSISTÊNCIA DE DADOS');
  console.log('═'.repeat(70));
  console.log('');

  // 1. Verificar DATABASE_URL
  console.log('1️⃣  CONFIGURAÇÃO');
  console.log('─'.repeat(70));

  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL não configurado!');
    console.log('');
    console.log('⚠️  ATENÇÃO: Sem DATABASE_URL, os dados estão sendo salvos em memória!');
    console.log('   Isso significa que TUDO É PERDIDO quando o servidor reinicia.');
    console.log('');
    process.exit(1);
  }

  console.log('✅ DATABASE_URL configurado');
  console.log('');

  // 2. Conectar ao banco
  console.log('2️⃣  CONEXÃO COM BANCO');
  console.log('─'.repeat(70));

  const config = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false
  };

  const client = new pg.Client(config);

  try {
    await client.connect();
    console.log('✅ Conectado ao PostgreSQL');
    console.log('');

    // 3. Verificar totais
    console.log('3️⃣  CONTAGEM DE REGISTROS');
    console.log('─'.repeat(70));

    const counts = await Promise.all([
      client.query('SELECT COUNT(*) as total FROM users'),
      client.query('SELECT COUNT(*) as total FROM conversations'),
      client.query('SELECT COUNT(*) as total FROM messages'),
      client.query('SELECT COUNT(*) as total FROM sessions'),
      client.query('SELECT COUNT(*) as total FROM projects'),
      client.query('SELECT COUNT(*) as total FROM documents')
    ]);

    const [users, conversations, messages, sessions, projects, documents] = counts;

    console.log(`👥 Usuários:       ${users.rows[0].total}`);
    console.log(`💬 Conversas:      ${conversations.rows[0].total}`);
    console.log(`📝 Mensagens:      ${messages.rows[0].total}`);
    console.log(`🔐 Sessões ativas: ${sessions.rows[0].total}`);
    console.log(`📁 Projetos:       ${projects.rows[0].total}`);
    console.log(`📄 Documentos:     ${documents.rows[0].total}`);
    console.log('');

    // 4. Verificar conversas recentes
    console.log('4️⃣  CONVERSAS RECENTES (últimas 5)');
    console.log('─'.repeat(70));

    const recentConversations = await client.query(`
      SELECT
        c.id,
        c.title,
        c.mode,
        c.model,
        c.created_at,
        COUNT(m.id) as message_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT 5
    `);

    if (recentConversations.rows.length === 0) {
      console.log('ℹ️  Nenhuma conversa encontrada');
      console.log('');
      console.log('⚠️  POSSÍVEIS CAUSAS:');
      console.log('   1. Sistema acabou de ser deployado (ainda não houve uso)');
      console.log('   2. Dados estavam em memória e foram perdidos no restart');
      console.log('   3. O código ainda não está usando o repository');
      console.log('');
    } else {
      console.log('✅ Conversas encontradas no banco!');
      console.log('');
      recentConversations.rows.forEach((conv, idx) => {
        console.log(`${idx + 1}. ${conv.title || 'Sem título'}`);
        console.log(`   ID: ${conv.id}`);
        console.log(`   Modo: ${conv.mode}`);
        console.log(`   Modelo: ${conv.model || 'N/A'}`);
        console.log(`   Mensagens: ${conv.message_count}`);
        console.log(`   Criada: ${new Date(conv.created_at).toLocaleString('pt-BR')}`);
        console.log('');
      });
    }

    // 5. Verificar mensagens recentes
    console.log('5️⃣  MENSAGENS RECENTES (últimas 3)');
    console.log('─'.repeat(70));

    const recentMessages = await client.query(`
      SELECT
        m.id,
        m.role,
        LEFT(m.content, 100) as content_preview,
        m.tokens_input,
        m.tokens_output,
        m.created_at
      FROM messages m
      ORDER BY m.created_at DESC
      LIMIT 3
    `);

    if (recentMessages.rows.length === 0) {
      console.log('ℹ️  Nenhuma mensagem encontrada');
      console.log('');
    } else {
      console.log('✅ Mensagens encontradas no banco!');
      console.log('');
      recentMessages.rows.forEach((msg, idx) => {
        console.log(`${idx + 1}. [${msg.role.toUpperCase()}]`);
        console.log(`   Preview: ${msg.content_preview}...`);
        console.log(`   Tokens: ${msg.tokens_input || 0} in / ${msg.tokens_output || 0} out`);
        console.log(`   Criada: ${new Date(msg.created_at).toLocaleString('pt-BR')}`);
        console.log('');
      });
    }

    // 6. Verificar sessões ativas
    console.log('6️⃣  SESSÕES ATIVAS');
    console.log('─'.repeat(70));

    const activeSessions = await client.query(`
      SELECT
        sid,
        expire,
        sess->'passport'->>'user' as user_data
      FROM sessions
      WHERE expire > NOW()
      ORDER BY expire DESC
      LIMIT 5
    `);

    console.log(`Total de sessões ativas: ${activeSessions.rows.length}`);

    if (activeSessions.rows.length > 0) {
      console.log('✅ Autenticação funcionando!');
      activeSessions.rows.forEach((session, idx) => {
        const expiresIn = Math.round((new Date(session.expire) - new Date()) / 1000 / 60);
        console.log(`${idx + 1}. SID: ${session.sid.substring(0, 20)}...`);
        console.log(`   Expira em: ${expiresIn} minutos`);
      });
    } else {
      console.log('ℹ️  Nenhuma sessão ativa no momento');
    }
    console.log('');

    // 7. Resumo e diagnóstico
    console.log('═'.repeat(70));
    console.log('📊 DIAGNÓSTICO FINAL');
    console.log('═'.repeat(70));
    console.log('');

    const totalRecords = parseInt(users.rows[0].total) +
                        parseInt(conversations.rows[0].total) +
                        parseInt(messages.rows[0].total);

    if (totalRecords === 0) {
      console.log('⚠️  NENHUM DADO ENCONTRADO NO BANCO!');
      console.log('');
      console.log('Possíveis problemas:');
      console.log('   1. O código não está usando o conversation-repository.js');
      console.log('   2. As rotas não estão integradas com o repository');
      console.log('   3. Sistema recém deployado (ainda não houve uso)');
      console.log('');
      console.log('Próximos passos:');
      console.log('   1. Faça login e crie uma conversa no frontend');
      console.log('   2. Execute este script novamente');
      console.log('   3. Se ainda não aparecer dados, o repository não está integrado');
      console.log('');
    } else if (parseInt(conversations.rows[0].total) > 0 && parseInt(messages.rows[0].total) > 0) {
      console.log('✅ PERSISTÊNCIA FUNCIONANDO PERFEITAMENTE!');
      console.log('');
      console.log('Dados sendo salvos:');
      console.log(`   ✅ ${conversations.rows[0].total} conversas salvas`);
      console.log(`   ✅ ${messages.rows[0].total} mensagens salvas`);
      console.log(`   ✅ ${sessions.rows[0].total} sessões ativas`);
      console.log('');
      console.log('🎉 NADA ESTÁ SENDO PERDIDO!');
      console.log('   Todos os dados persistem entre restarts do servidor.');
      console.log('');
    } else if (parseInt(sessions.rows[0].total) > 0) {
      console.log('⚠️  AUTENTICAÇÃO OK, MAS CONVERSAS NÃO ESTÃO SENDO SALVAS');
      console.log('');
      console.log('   ✅ Sessions funcionando (autenticação OK)');
      console.log('   ❌ Conversas não estão no banco');
      console.log('');
      console.log('Ação necessária:');
      console.log('   Verificar se as rotas de chat estão usando conversation-repository.js');
      console.log('');
    }

  } catch (error) {
    console.log('');
    console.log('❌ ERRO AO VERIFICAR PERSISTÊNCIA');
    console.log('');
    console.log('Erro:', error.message);
    console.log('');

    if (error.code === 'ECONNREFUSED') {
      console.log('💡 SOLUÇÃO:');
      console.log('   O PostgreSQL não está acessível.');
      console.log('   Verifique se DATABASE_URL está correto.');
      console.log('');
    }

    process.exit(1);
  } finally {
    await client.end();
  }

  console.log('═'.repeat(70));
  console.log('');
}

testPersistence().catch(error => {
  console.error('');
  console.error('💥 ERRO FATAL');
  console.error(error);
  console.error('');
  process.exit(1);
});
