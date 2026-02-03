/**
 * Script de teste para validar o middleware KB Loader
 *
 * Uso: node test-kb-loader.js
 */

import { loadStructuredFilesFromKB } from './src/middleware/kb-loader.js';

// Mock de request e response
const mockReq = {
  body: {
    message: 'Me mostre a cronologia do processo 1234567-89.2024.8.13.0024'
  },
  user: {
    partnerId: 'ROM'
  }
};

const mockRes = {};

const mockNext = () => {
  console.log('\n✅ Middleware executado com sucesso!');
  console.log('\n📦 Resultado:');
  console.log('   kbContext length:', mockReq.body.kbContext?.length || 0);

  if (mockReq.body.kbContext) {
    console.log('\n📄 Preview do contexto (primeiros 500 chars):');
    console.log(mockReq.body.kbContext.substring(0, 500) + '...');
  } else {
    console.log('\n⚠️ Nenhum contexto KB foi carregado');
  }
};

console.log('🧪 Testando middleware KB Loader...\n');
console.log('📝 Mensagem de teste:', mockReq.body.message);
console.log('👤 Usuário:', mockReq.user.partnerId);
console.log('\n🔄 Executando middleware...\n');

// Executar middleware
await loadStructuredFilesFromKB(mockReq, mockRes, mockNext);

console.log('\n✅ Teste finalizado!');
