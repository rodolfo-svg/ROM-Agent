#!/usr/bin/env node

/**
 * Teste rápido do Google Search Client
 */

import 'dotenv/config';
import { GoogleSearchClient } from '../lib/google-search-client.js';

console.log('🔧 Variáveis de ambiente:');
console.log(`   GOOGLE_SEARCH_API_KEY: ${process.env.GOOGLE_SEARCH_API_KEY ? '✅ Configurada' : '❌ Vazia'}`);
console.log(`   GOOGLE_SEARCH_CX: ${process.env.GOOGLE_SEARCH_CX ? '✅ Configurada' : '❌ Vazia'}`);
console.log('');

const client = new GoogleSearchClient();

console.log('📊 Status do cliente:');
console.log(`   Configurado: ${client.isConfigured() ? '✅ SIM' : '❌ NÃO'}`);
console.log(`   API Key: ${client.apiKey ? client.apiKey.substring(0, 20) + '...' : '❌ Vazia'}`);
console.log(`   CX: ${client.cx || '❌ Vazio'}`);
console.log('');

if (!client.isConfigured()) {
  console.error('❌ Google Search não está configurado!');
  console.log('');
  console.log('Verifique se o arquivo .env tem:');
  console.log('GOOGLE_SEARCH_API_KEY=AIzaSyASQ6IzrLay4PVsPPhYPFXisTubiTq7ocI');
  console.log('GOOGLE_SEARCH_CX=f14c0d3793b7346c0');
  process.exit(1);
}

console.log('🔍 Testando busca real no TJGO...');
console.log('');

const result = await client.search('responsabilidade civil médica', {
  limit: 3,
  tribunal: 'TJGO'
});

console.log('📊 Resultado:');
console.log(`   Sucesso: ${result.success ? '✅' : '❌'}`);
console.log(`   Query: ${result.query}`);
console.log(`   Total: ${result.total} resultado(s)`);
console.log(`   Fonte: ${result.source}`);

if (result.error) {
  console.error(`   ❌ Erro: ${result.error}`);
}

if (result.results && result.results.length > 0) {
  console.log('');
  console.log('📄 Primeiros resultados:');
  result.results.forEach((r, i) => {
    console.log(`   ${i + 1}. [${r.tribunal}] ${r.titulo.substring(0, 80)}...`);
    console.log(`      URL: ${r.url}`);
  });
}

console.log('');
console.log('✅ Teste concluído!');
