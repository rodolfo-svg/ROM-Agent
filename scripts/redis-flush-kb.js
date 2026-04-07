#!/usr/bin/env node
/**
 * Script para limpar cache KB no Redis
 *
 * Uso:
 *   node scripts/redis-flush-kb.js              # Limpa apenas kb:*
 *   node scripts/redis-flush-kb.js --all        # Limpa TUDO (CUIDADO!)
 *   node scripts/redis-flush-kb.js --pattern    # Limpa pattern específico
 *   node scripts/redis-flush-kb.js --status     # Apenas lista keys
 */

import { getRedisClient, initRedis, isRedisReady } from '../src/config/database.js';

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--kb'; // Default: limpar apenas KB

  console.log('🔧 Redis KB Cache Flush Tool\n');
  console.log('═'.repeat(70));

  // Inicializar conexão Redis
  console.log('📡 Conectando ao Redis...');
  await initRedis();

  // Aguardar conexão (max 10s)
  let attempts = 0;
  while (!isRedisReady() && attempts < 20) {
    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
  }

  const redis = getRedisClient();

  if (!redis || !isRedisReady()) {
    console.error('\n❌ ERRO: Redis não está conectado');
    console.error('   Verifique se REDIS_URL está configurado corretamente');
    console.error('   Ou se DISABLE_REDIS=true está removendo o Redis\n');
    process.exit(1);
  }

  console.log('✅ Conectado ao Redis\n');

  try {
    // Status
    if (mode === '--status') {
      console.log('📊 Status do Redis Cache:\n');

      const allKeys = await redis.keys('*');
      const kbKeys = await redis.keys('kb:*');
      const sessionKeys = await redis.keys('sess:*');

      console.log(`   Total de keys:    ${allKeys.length}`);
      console.log(`   Keys KB (kb:*):   ${kbKeys.length}`);
      console.log(`   Keys Sessão:      ${sessionKeys.length}`);

      if (kbKeys.length > 0) {
        console.log('\n📋 Keys KB encontradas (primeiras 20):');
        kbKeys.slice(0, 20).forEach(key => {
          console.log(`   - ${key}`);
        });
      } else {
        console.log('\nℹ️  Nenhuma key KB encontrada (cache vazio)');
      }

      process.exit(0);
    }

    // Flush All (PERIGO!)
    if (mode === '--all') {
      console.log('⚠️  ATENÇÃO: Você está prestes a DELETAR TODAS as keys do Redis!');
      console.log('   Isso inclui sessões de usuários, cache, etc.\n');

      // Confirmar (simples check)
      if (!args.includes('--confirm')) {
        console.error('❌ ABORTADO: Use --all --confirm para confirmar\n');
        process.exit(1);
      }

      await redis.flushdb();
      const remaining = await redis.dbsize();

      console.log('✅ Flush completo executado!');
      console.log(`   Keys restantes: ${remaining}\n`);
      process.exit(0);
    }

    // Flush pattern customizado
    if (mode === '--pattern') {
      const pattern = args[1];
      if (!pattern) {
        console.error('❌ ERRO: Especifique o pattern\n');
        console.error('   Exemplo: node scripts/redis-flush-kb.js --pattern "cache:*"\n');
        process.exit(1);
      }

      console.log(`🔍 Buscando keys com pattern: ${pattern}...`);
      const keys = await redis.keys(pattern);

      if (keys.length === 0) {
        console.log(`\nℹ️  Nenhuma key encontrada com pattern "${pattern}"\n`);
        process.exit(0);
      }

      console.log(`   Encontradas: ${keys.length} keys`);
      console.log('\n📋 Keys que serão deletadas (primeiras 20):');
      keys.slice(0, 20).forEach(key => console.log(`   - ${key}`));

      console.log(`\n🗑️  Deletando ${keys.length} keys...`);
      const deleted = await redis.del(...keys);

      console.log(`✅ ${deleted} keys deletadas\n`);
      process.exit(0);
    }

    // Default: Flush KB (kb:*)
    console.log('🔍 Buscando keys KB (kb:*)...');
    const kbKeys = await redis.keys('kb:*');

    if (kbKeys.length === 0) {
      console.log('\nℹ️  Nenhuma key KB encontrada (cache já vazio)\n');
      console.log('   Possíveis razões:');
      console.log('   1. Cache KB já foi limpo');
      console.log('   2. Nenhum documento foi indexado ainda');
      console.log('   3. Sistema está usando outro prefixo\n');

      // Mostrar outras keys para debug
      const allKeys = await redis.keys('*');
      if (allKeys.length > 0) {
        console.log(`   Total de keys no Redis: ${allKeys.length}`);
        console.log('\n   Prefixos encontrados:');
        const prefixes = new Set(allKeys.map(k => k.split(':')[0]));
        prefixes.forEach(prefix => {
          const count = allKeys.filter(k => k.startsWith(prefix)).length;
          console.log(`   - ${prefix}:* (${count} keys)`);
        });
      }

      console.log();
      process.exit(0);
    }

    console.log(`   Encontradas: ${kbKeys.length} keys KB`);
    console.log('\n📋 Keys KB que serão deletadas (primeiras 20):');
    kbKeys.slice(0, 20).forEach(key => console.log(`   - ${key}`));

    if (kbKeys.length > 20) {
      console.log(`   ... e mais ${kbKeys.length - 20} keys`);
    }

    console.log(`\n🗑️  Deletando ${kbKeys.length} keys KB...`);
    const deleted = await redis.del(...kbKeys);

    console.log(`✅ Cache KB limpo com sucesso!`);
    console.log(`   ${deleted} keys deletadas\n`);

    // Verificar se limpou tudo
    const remaining = await redis.keys('kb:*');
    if (remaining.length > 0) {
      console.warn(`⚠️  ATENÇÃO: Ainda restam ${remaining.length} keys KB:`);
      remaining.forEach(key => console.log(`   - ${key}`));
      console.log();
    }

    console.log('═'.repeat(70));
    console.log('✅ Operação concluída\n');

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  } finally {
    // Desconectar
    if (redis) {
      await redis.quit();
      console.log('👋 Desconectado do Redis');
    }
  }

  process.exit(0);
}

main();
