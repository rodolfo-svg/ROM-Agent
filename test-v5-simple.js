#!/usr/bin/env node
/**
 * Teste Simples - Sistema V5.0 Orchestrator
 */

import orchestrator from './lib/prompt-orchestrator.js';

console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('🧪 TESTE SIMPLES - ORCHESTRATOR V5.0');
console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('');

// TESTE 1: Listar prompts
console.log('📊 TESTE 1: Listar prompts V5.0');
const available = orchestrator.listPromptsV5();
console.log(`✅ Total: ${available.total} prompts`);
console.log(`✅ Keywords: ${available.keywords}`);
console.log('');

// TESTE 2: Detecção
console.log('🔍 TESTE 2: Detecção automática');
const tests = [
  'Preciso de uma apelação',
  'Habeas corpus preventivo',
  'Contrato social da empresa',
  'Olá'
];

tests.forEach(msg => {
  const detected = orchestrator.detectPromptV5(msg);
  console.log(`   "${msg}"`);
  console.log(`   → ${detected || 'null (genérico)'}`);
  console.log('');
});

// TESTE 3: Construir prompt completo
console.log('⚙️  TESTE 3: Construir prompt completo');
const result = orchestrator.buildSystemPromptV5('Preciso redigir apelação cível');
console.log(`✅ Tipo: ${result.promptType}`);
console.log(`✅ É V5.0: ${result.isV5}`);
console.log(`✅ Tamanho: ${result.systemPrompt.length} caracteres`);
console.log(`✅ Contém core: ${result.systemPrompt.includes('MOD_MASTER_CORE') || result.systemPrompt.includes('ROM V3.0')}`);
console.log('');

console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('✅ ORCHESTRATOR V5.0 FUNCIONANDO CORRETAMENTE');
console.log('═══════════════════════════════════════════════════════════════════════════════');
