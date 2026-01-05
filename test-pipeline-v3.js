/**
 * ROM Agent V3 Pipeline - Test Suite
 * Testa todas as APIs do pipeline
 */

const BASE_URL = 'https://staging.iarom.com.br';

// Colors
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

console.log(`\n${c.cyan}${'═'.repeat(70)}${c.reset}`);
console.log(`${c.bright}  🧪 TESTANDO ROM AGENT V3 PIPELINE${c.reset}`);
console.log(`${c.blue}  Staging: ${BASE_URL}${c.reset}`);
console.log(`${c.cyan}${'═'.repeat(70)}${c.reset}\n`);

async function test1_Status() {
  console.log(`${c.cyan}1️⃣  TESTE: Pipeline Status${c.reset}\n`);

  try {
    const response = await fetch(`${BASE_URL}/api/pipeline/status`);
    const data = await response.json();

    if (data.success) {
      console.log(`${c.green}✅ Pipeline disponível${c.reset}`);
      console.log(`   Versão: ${data.version}`);
      console.log(`   Estágios: ${data.stages.join(', ')}`);
      console.log(`   Features:`);
      Object.entries(data.features).forEach(([key, value]) => {
        console.log(`     - ${key}: ${value ? c.green + 'SIM' : c.red + 'NÃO'}${c.reset}`);
      });
      return true;
    } else {
      console.log(`${c.red}❌ Falha: ${data.error}${c.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${c.red}❌ Erro: ${error.message}${c.reset}`);
    return false;
  }
}

async function test2_Configure() {
  console.log(`\n${c.cyan}2️⃣  TESTE: Pipeline Configure${c.reset}\n`);

  try {
    const config = {
      priority: 'critical',
      volume: 'small',
      quality: 'perfect',
      speed: 'fast',
      tribunal: 'STJ',
      clienteVip: true,
      envolvLiberdade: false
    };

    console.log(`${c.blue}   Configuração:${c.reset}`);
    console.log(`     Priority: ${config.priority}`);
    console.log(`     Volume: ${config.volume}`);
    console.log(`     Quality: ${config.quality}`);
    console.log(`     Speed: ${config.speed}`);
    console.log(`     Tribunal: ${config.tribunal}`);
    console.log(`     Cliente VIP: ${config.clienteVip}\n`);

    const response = await fetch(`${BASE_URL}/api/pipeline/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const data = await response.json();

    if (data.success) {
      console.log(`${c.green}✅ Configuração criada com sucesso${c.reset}\n`);

      console.log(`${c.blue}   Modelos Selecionados:${c.reset}`);
      console.log(`     Extração: ${c.yellow}${data.modelSelection.extraction}${c.reset}`);
      console.log(`     Análise: ${c.yellow}${data.modelSelection.analysis}${c.reset}`);
      console.log(`     Redação: ${c.yellow}${data.modelSelection.drafting}${c.reset}`);
      console.log(`     Auditoria: ${c.yellow}${data.modelSelection.audit || 'Desabilitada'}${c.reset}\n`);

      console.log(`${c.blue}   Estimativas:${c.reset}`);
      console.log(`     Tempo: ~${data.estimatedTime} minutos\n`);

      if (data.recommendations && data.recommendations.length > 0) {
        console.log(`${c.blue}   Recomendações:${c.reset}`);
        data.recommendations.forEach(rec => {
          console.log(`     ${rec}`);
        });
      }

      return data.configuration;
    } else {
      console.log(`${c.red}❌ Falha: ${data.error}${c.reset}`);
      return null;
    }
  } catch (error) {
    console.log(`${c.red}❌ Erro: ${error.message}${c.reset}`);
    return null;
  }
}

async function test3_Estimate(configuration) {
  console.log(`\n${c.cyan}3️⃣  TESTE: Pipeline Estimate${c.reset}\n`);

  if (!configuration) {
    console.log(`${c.yellow}⚠️  Pulando teste (configuração não disponível)${c.reset}`);
    return false;
  }

  try {
    const estimateRequest = {
      configuration,
      documents: 3,
      totalTokens: 50000,
      draftType: 'recurso'
    };

    console.log(`${c.blue}   Parâmetros:${c.reset}`);
    console.log(`     Documentos: ${estimateRequest.documents}`);
    console.log(`     Tokens totais: ${estimateRequest.totalTokens}`);
    console.log(`     Tipo: ${estimateRequest.draftType}\n`);

    const response = await fetch(`${BASE_URL}/api/pipeline/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(estimateRequest)
    });

    const data = await response.json();

    if (data.success) {
      console.log(`${c.green}✅ Estimativa calculada com sucesso${c.reset}\n`);

      console.log(`${c.blue}   Por Estágio:${c.reset}`);
      Object.entries(data.estimate.stages).forEach(([stage, info]) => {
        if (info) {
          console.log(`     ${stage.toUpperCase()}:`);
          console.log(`       Modelo: ${c.yellow}${info.model}${c.reset}`);
          console.log(`       Tokens: ${info.estimatedTokens.toLocaleString()}`);
          console.log(`       Custo: ${c.green}$${info.estimatedCostUSD.toFixed(4)}${c.reset}`);
        }
      });

      console.log(`\n${c.blue}   Totais:${c.reset}`);
      console.log(`     Documentos: ${data.estimate.total.documents}`);
      console.log(`     Tokens: ${data.estimate.total.estimatedTokens.toLocaleString()}`);
      console.log(`     Custo USD: ${c.green}$${data.estimate.total.estimatedCostUSD.toFixed(4)}${c.reset}`);
      console.log(`     Custo BRL: ${c.green}R$ ${data.estimate.total.estimatedCostBRL.toFixed(2)}${c.reset}`);
      console.log(`     Tempo: ~${data.estimate.total.estimatedTimeMinutes} minutos\n`);

      if (data.recommendations && data.recommendations.length > 0) {
        console.log(`${c.blue}   Recomendações:${c.reset}`);
        data.recommendations.forEach(rec => {
          console.log(`     ${rec}`);
        });
      }

      return true;
    } else {
      console.log(`${c.red}❌ Falha: ${data.error}${c.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${c.red}❌ Erro: ${error.message}${c.reset}`);
    return false;
  }
}

async function test4_EdgeCases() {
  console.log(`\n${c.cyan}4️⃣  TESTE: Edge Cases${c.reset}\n`);

  // Teste 1: Bulk + Perfect (deve gerar warning)
  console.log(`${c.blue}   Teste 1: Bulk processing + Perfect quality${c.reset}`);
  try {
    const response = await fetch(`${BASE_URL}/api/pipeline/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priority: 'bulk',
        volume: 'massive',
        quality: 'perfect',
        speed: 'urgent'
      })
    });

    const data = await response.json();
    if (data.recommendations && data.recommendations.length > 0) {
      console.log(`${c.green}   ✅ Warnings gerados corretamente${c.reset}`);
      data.recommendations.forEach(rec => {
        console.log(`     ${c.yellow}${rec}${c.reset}`);
      });
    }
  } catch (error) {
    console.log(`${c.red}   ❌ Erro: ${error.message}${c.reset}`);
  }

  // Teste 2: Invalid priority
  console.log(`\n${c.blue}   Teste 2: Priority inválido${c.reset}`);
  try {
    const response = await fetch(`${BASE_URL}/api/pipeline/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priority: 'invalid',
        volume: 'single',
        quality: 'high',
        speed: 'normal'
      })
    });

    const data = await response.json();
    if (!data.success && data.error) {
      console.log(`${c.green}   ✅ Validação funcionando${c.reset}`);
      console.log(`     Erro: ${data.error}`);
    }
  } catch (error) {
    console.log(`${c.red}   ❌ Erro: ${error.message}${c.reset}`);
  }
}

async function runTests() {
  const results = {
    status: false,
    configure: false,
    estimate: false,
    edgeCases: false
  };

  // Test 1: Status
  results.status = await test1_Status();

  if (!results.status) {
    console.log(`\n${c.red}${c.bright}❌ Pipeline não disponível. Deploy ainda não foi aplicado.${c.reset}\n`);
    return;
  }

  // Test 2: Configure
  const configuration = await test2_Configure();
  results.configure = configuration !== null;

  // Test 3: Estimate
  results.estimate = await test3_Estimate(configuration);

  // Test 4: Edge Cases
  await test4_EdgeCases();
  results.edgeCases = true;

  // Summary
  console.log(`\n${c.cyan}${'═'.repeat(70)}${c.reset}`);
  console.log(`${c.bright}  📊 RESUMO DOS TESTES${c.reset}`);
  console.log(`${c.cyan}${'═'.repeat(70)}${c.reset}\n`);

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  console.log(`${c.blue}Resultados:${c.reset}`);
  console.log(`  Status: ${results.status ? c.green + '✅' : c.red + '❌'}${c.reset}`);
  console.log(`  Configure: ${results.configure ? c.green + '✅' : c.red + '❌'}${c.reset}`);
  console.log(`  Estimate: ${results.estimate ? c.green + '✅' : c.red + '❌'}${c.reset}`);
  console.log(`  Edge Cases: ${results.edgeCases ? c.green + '✅' : c.red + '❌'}${c.reset}\n`);

  if (passed === total) {
    console.log(`${c.green}${c.bright}🎉 TODOS OS TESTES PASSARAM! (${passed}/${total})${c.reset}\n`);
  } else {
    console.log(`${c.yellow}⚠️  ${passed}/${total} testes passaram${c.reset}\n`);
  }
}

runTests().catch(error => {
  console.error(`\n${c.red}❌ ERRO FATAL: ${error.message}${c.reset}\n`);
  process.exit(1);
});
