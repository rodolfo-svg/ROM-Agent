#!/usr/bin/env node
/**
 * Teste Rápido - Verificar se emojis foram removidos
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testNoEmojis() {
  console.log('\n🧪 TESTE: Verificando proibição de emojis...\n');

  const testMessage = 'Faça uma breve análise sobre prescrição em ação de cobrança';

  try {
    const response = await fetch(`${BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: testMessage,
        modelo: 'anthropic.claude-sonnet-4-5-20250929-v1:0'
      })
    });

    let fullResponse = '';
    const reader = response.body;
    reader.setEncoding('utf8');

    for await (const chunk of reader) {
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk') {
              fullResponse += data.content;
            }
            if (data.type === 'complete') {
              console.log(`✅ Streaming completou: ${fullResponse.length} caracteres\n`);
            }
          } catch (e) {}
        }
      }
    }

    // Verificar emojis
    const emojiPattern = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    const hasEmojis = emojiPattern.test(fullResponse);

    // Contar emojis específicos problemáticos
    const problematicEmojis = ['🔍', '📋', '⏳', '✅', '❌', '📊', '🎯', '💡', '🔧', '⚡'];
    const foundEmojis = problematicEmojis.filter(e => fullResponse.includes(e));

    console.log('═══════════════════════════════════════');
    console.log('RESULTADO:');
    console.log('═══════════════════════════════════════');

    if (!hasEmojis && foundEmojis.length === 0) {
      console.log('✅ PASSOU: Sem emojis na resposta!');
      console.log('   Custom Instructions v1.6 aplicadas corretamente\n');
    } else {
      console.log(`❌ FALHOU: Encontrados emojis: ${foundEmojis.join(', ')}`);
      console.log(`   Total de emojis problemáticos: ${foundEmojis.length}\n`);
    }

    console.log('Preview da resposta:');
    console.log('─'.repeat(60));
    console.log(fullResponse.substring(0, 500));
    console.log('─'.repeat(60));
    console.log('');

    return !hasEmojis && foundEmojis.length === 0;

  } catch (error) {
    console.error(`❌ ERRO: ${error.message}`);
    return false;
  }
}

testNoEmojis().then(passed => {
  process.exit(passed ? 0 : 1);
});
