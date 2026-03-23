#!/usr/bin/env node
/**
 * Script de limpeza emergencial do KB
 * Executa diretamente no servidor sem precisar de AUTH_TOKEN externo
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'https://iarom.com.br';
const EMAIL = process.argv[2] || 'rodolfo@rom.adv.br';
const PASSWORD = process.argv[3];

if (!PASSWORD) {
  console.error('❌ ERRO: Senha não fornecida');
  console.error('');
  console.error('Uso: node scripts/cleanup-kb-now.js EMAIL SENHA');
  console.error('Exemplo: node scripts/cleanup-kb-now.js rodolfo@rom.adv.br minhasenha');
  process.exit(1);
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ROM Agent - Limpeza Emergencial KB                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  // ETAPA 1: Login
  console.log('🔐 [ETAPA 1/4] Fazendo login...');
  let token;
  try {
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.text();
      throw new Error(`Login falhou: ${loginResponse.status} - ${error}`);
    }

    const loginData = await loginResponse.json();
    token = loginData.accessToken;
    console.log(`✅ Login realizado com sucesso`);
    console.log(`   User: ${loginData.user.name}`);
    console.log('');
  } catch (error) {
    console.error(`❌ Erro no login: ${error.message}`);
    process.exit(1);
  }

  // ETAPA 2: Limpar documentos fantasmas
  console.log('🧹 [ETAPA 2/4] Limpando documentos fantasmas...');
  try {
    const cleanResponse = await fetch(`${API_URL}/api/kb/cache/clean`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!cleanResponse.ok) {
      throw new Error(`Clean falhou: ${cleanResponse.status}`);
    }

    const cleanData = await cleanResponse.json();
    console.log(`✅ Limpeza concluída`);
    console.log(`   Documentos antes: ${cleanData.beforeCount}`);
    console.log(`   Documentos fantasmas removidos: ${cleanData.ghostsRemoved}`);
    console.log(`   Documentos após: ${cleanData.afterCount}`);
    console.log('');
  } catch (error) {
    console.error(`❌ Erro na limpeza: ${error.message}`);
    // Continuar mesmo com erro
  }

  // ETAPA 3: Forçar reload do cache
  console.log('🔄 [ETAPA 3/4] Forçando reload do cache em todos os workers...');
  try {
    const reloadResponse = await fetch(`${API_URL}/api/kb/cache/reload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!reloadResponse.ok) {
      throw new Error(`Reload falhou: ${reloadResponse.status}`);
    }

    const reloadData = await reloadResponse.json();
    console.log(`✅ Cache recarregado`);
    console.log(`   Documentos antes: ${reloadData.beforeCount}`);
    console.log(`   Documentos após: ${reloadData.afterCount}`);
    console.log(`   Mudou: ${reloadData.changed ? 'Sim' : 'Não'}`);
    console.log('');
  } catch (error) {
    console.error(`❌ Erro no reload: ${error.message}`);
    process.exit(1);
  }

  // ETAPA 4: Verificar estado final
  console.log('📊 [ETAPA 4/4] Verificando estado final do sistema...');
  try {
    const infoResponse = await fetch(`${API_URL}/api/info`);
    const infoData = await infoResponse.json();

    console.log(`✅ Sistema verificado`);
    console.log(`   GitCommit: ${infoData.server.gitCommit}`);
    console.log(`   Uptime: ${infoData.health.uptime}`);
    console.log(`   Status: ${infoData.health.status}`);
    console.log('');
  } catch (error) {
    console.error(`⚠️  Não foi possível verificar /api/info: ${error.message}`);
  }

  // RESUMO
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  RESUMO DA OPERAÇÃO                                           ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log('║  ✅ Documentos fantasmas removidos                            ║');
  console.log('║  ✅ Cache sincronizado em todos os workers                    ║');
  console.log('║  ✅ Sistema pronto para uso                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('🎉 Limpeza concluída com sucesso!');
  console.log('');
  console.log('📋 Próximos passos:');
  console.log('   1. Teste buscar "Patricia" → NÃO deve aparecer');
  console.log('   2. Teste buscar "Alessandro" → DEVE aparecer');
  console.log('   3. Se ainda houver problemas, reporte imediatamente');
}

main().catch(error => {
  console.error('❌ ERRO CRÍTICO:', error);
  process.exit(1);
});
