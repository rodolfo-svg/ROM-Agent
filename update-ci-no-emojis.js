#!/usr/bin/env node
/**
 * Atualiza Custom Instructions v1.5 para proibir emojis em TODAS as respostas
 */

import fs from 'fs';

const CI_PATH = '/Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/data/custom-instructions/rom/custom-instructions.json';

// Ler arquivo
const data = JSON.parse(fs.readFileSync(CI_PATH, 'utf-8'));

// Atualizar o texto
let text = data.components.customInstructions.content.text;

// 1. Atualizar seção PROIBIÇÕES ABSOLUTAS
text = text.replace(
  /✗ NUNCA use emojis em peças jurídicas/g,
  '✗ NUNCA use emojis (em nenhuma resposta: peças, análises, chat)'
);

// 2. Remover permissão de emojis em CHAT CONVERSACIONAL
text = text.replace(
  /CHAT CONVERSACIONAL:\n- Respostas concisas e diretas \(1-3 parágrafos\)\n- Expandir apenas se usuário solicitar explicitamente\n- PERMITIDO: markdown para clareza \(\*\*negrito\*\*, listas, ###\)/g,
  `CHAT CONVERSACIONAL:
- Respostas concisas e diretas (1-3 parágrafos)
- Expandir apenas se usuário solicitar explicitamente
- PERMITIDO: markdown para clareza (**negrito**, listas, ###)
- PROIBIDO: emojis (mesmo em chat conversacional)`
);

// 3. Adicionar nota sobre emojis de ferramentas
text = text.replace(
  /REGRA DE OURO: Se usar create_artifact, o conteúdo dentro NÃO deve ter markdown\./g,
  `REGRA DE OURO: Se usar create_artifact, o conteúdo dentro NÃO deve ter markdown.

NOTA IMPORTANTE SOBRE EMOJIS:
- Emojis são PROIBIDOS em todas as respostas (peças, análises, explicações, chat)
- Se ferramentas retornarem emojis, REMOVA-OS antes de apresentar ao usuário
- Exceção: Pode usar checkmarks simples (✓, ✗) para listas de verificação`
);

// Atualizar componente
data.components.customInstructions.content.text = text;

// Atualizar metadados
data.version = "1.6";
data.lastUpdated = new Date().toISOString();
data.updatedBy = "system_auto_update";

// Salvar
fs.writeFileSync(CI_PATH, JSON.stringify(data, null, 2), 'utf-8');

console.log('✅ Custom Instructions atualizadas para v1.6');
console.log('   - Emojis proibidos em TODAS as respostas');
console.log('   - Nota sobre remoção de emojis de ferramentas');
console.log(`   - Arquivo: ${CI_PATH}`);
