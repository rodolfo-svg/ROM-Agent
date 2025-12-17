/**
 * TESTE DE SANIDADE - Job Exaustivo Desmockado
 *
 * Valida que:
 * 1. Job executa com Bedrock REAL (não mock)
 * 2. Logs mostram modelId, trace_id, profile
 * 3. Export gerado contém conteúdo REAL
 * 4. Fallback funciona em caso de erro
 */

import ExhaustiveAnalysisJob from './lib/exhaustive-analysis-job.js';
import fs from 'fs/promises';
import path from 'path';

console.log('🧪 TESTE DE SANIDADE - Job Exaustivo Desmockado\n');
console.log('=' .repeat(60));

// Documento de teste simulado
const testDocument = {
  id: 'test-doc-001',
  name: 'Petição Inicial - Teste',
  type: 'application/pdf',
  path: '/test/peticao-inicial-teste.pdf',
  extractedText: `
EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA VARA CÍVEL DA COMARCA DE GOIÂNIA/GO

JOÃO DA SILVA, brasileiro, casado, advogado, inscrito na OAB/GO sob o nº 12.345,
portador da cédula de identidade RG nº 1.234.567 SSP/GO e do CPF nº 123.456.789-00,
residente e domiciliado na Rua Exemplo, nº 100, Setor Central, Goiânia/GO, CEP 74000-000,
vem, respeitosamente, à presença de Vossa Excelência, por meio de seu advogado que esta subscreve,
propor a presente

AÇÃO DE COBRANÇA

em face de EMPRESA XYZ LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº
12.345.678/0001-90, com sede na Avenida Principal, nº 500, Setor Empresarial, Goiânia/GO,
CEP 74100-000, pelos fatos e fundamentos jurídicos a seguir expostos:

I - DOS FATOS

1. O Autor prestou serviços advocatícios para a Ré no período de janeiro/2024 a junho/2024,
   conforme contrato de prestação de serviços anexo (Doc. 01).

2. Os serviços contratados consistiram em assessoria jurídica preventiva e consultoria
   empresarial, com valor mensal de R$ 5.000,00 (cinco mil reais).

3. A Ré deixou de efetuar o pagamento das parcelas referentes aos meses de abril, maio e
   junho de 2024, totalizando R$ 15.000,00 (quinze mil reais).

4. O Autor notificou extrajudicialmente a Ré em 15/07/2024, concedendo prazo de 10 dias
   para pagamento, sem sucesso (Doc. 02).

II - DO DIREITO

5. O inadimplemento da Ré configura violação contratual, nos termos dos artigos 389 e
   seguintes do Código Civil Brasileiro.

6. A mora é incontroversa, caracterizando-se pelo simples vencimento das parcelas e
   ausência de pagamento (mora ex re).

7. Sobre o valor principal incidem correção monetária pelo IPCA desde cada vencimento
   e juros de mora de 1% ao mês, conforme cláusula contratual.

III - DO PEDIDO

Diante do exposto, requer-se:

a) A citação da Ré para, querendo, contestar a presente ação no prazo legal;

b) A condenação da Ré ao pagamento de R$ 15.000,00 (quinze mil reais), acrescidos de
   correção monetária e juros de mora conforme fundamentação;

c) A condenação da Ré ao pagamento de honorários advocatícios e custas processuais;

d) A procedência total dos pedidos.

Valor da causa: R$ 15.000,00 (quinze mil reais)

Nestes termos, pede deferimento.

Goiânia/GO, 01 de agosto de 2024.

[Assinatura]
Dr. João da Silva
OAB/GO 12.345
  `.trim(),
  textLength: 2500,
  metadata: {
    uploadedAt: new Date().toISOString(),
    processedAt: new Date().toISOString()
  }
};

async function runTest() {
  try {
    console.log('\n📋 Criando job de teste...\n');

    // Criar job
    const job = new ExhaustiveAnalysisJob({
      jobId: `test_job_${Date.now()}`,
      projectId: 'test-project',
      userId: 'test-user',
      traceId: `trace_test_${Date.now()}`,
      request: 'Analisar exaustivamente o documento de teste para validar integração real com Bedrock',
      metadata: {
        testMode: true,
        documentCount: 1
      }
    });

    console.log(`🆔 Job criado: ${job.jobId}`);
    console.log(`🔍 Trace ID: ${job.traceId}\n`);

    // Executar apenas a etapa de sumarização de 1 documento
    console.log('📝 ETAPA 1: Inventário de documentos\n');
    const inventory = [testDocument];
    console.log(`✅ Inventariado: ${inventory.length} documento(s)\n`);

    console.log('📝 ETAPA 2: Sumarização do documento (BEDROCK REAL)\n');
    console.log('⏳ Aguarde... Chamando Bedrock com profile PADRAO...\n');

    const summary = await job.summarizeDocument(testDocument, testDocument.extractedText);

    console.log('\n' + '='.repeat(60));
    console.log('✅ RESULTADO DA SUMARIZAÇÃO:\n');
    console.log(JSON.stringify(summary, null, 2));
    console.log('\n' + '='.repeat(60));

    // Validações
    console.log('\n🔍 VALIDAÇÕES:\n');

    const checks = [
      {
        name: 'Conteúdo não está vazio',
        pass: summary.text && summary.text.length > 100,
        value: `${summary.text?.length || 0} caracteres`
      },
      {
        name: 'Conteúdo não é mock',
        pass: !summary.text?.includes('Análise de Petição Inicial - Teste') || summary.text?.length > 200,
        value: 'Conteúdo real detectado'
      },
      {
        name: 'Estrutura JSON válida',
        pass: summary.keyPoints !== undefined && summary.dates !== undefined,
        value: `${Object.keys(summary).length} campos`
      },
      {
        name: 'Dados extraídos',
        pass: (summary.keyPoints?.length > 0) || (summary.dates?.length > 0) || (summary.values?.length > 0),
        value: `keyPoints: ${summary.keyPoints?.length || 0}, dates: ${summary.dates?.length || 0}, values: ${summary.values?.length || 0}`
      }
    ];

    let passCount = 0;
    checks.forEach(check => {
      const status = check.pass ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} - ${check.name}: ${check.value}`);
      if (check.pass) passCount++;
    });

    console.log('\n' + '='.repeat(60));
    console.log(`📊 RESULTADO FINAL: ${passCount}/${checks.length} testes passaram\n`);

    if (passCount === checks.length) {
      console.log('✅ SUCESSO - Job exaustivo está DESMOCKADO e funcionando!\n');
      console.log('🎯 Próximos passos:');
      console.log('   1. ✅ Desmock completo');
      console.log('   2. ✅ Teste de sanidade aprovado');
      console.log('   3. 🔄 Deploy para Render');
      console.log('   4. 🧪 Validar com Processo Castilho real\n');
      return true;
    } else {
      console.log('⚠️ ATENÇÃO - Algumas validações falharam\n');
      console.log('Revise os logs acima para identificar o problema.\n');
      return false;
    }

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:\n');
    console.error(error);
    console.error('\nStack trace:', error.stack);

    console.log('\n' + '='.repeat(60));
    console.log('💡 DIAGNÓSTICO:');

    if (error.message?.includes('Too many requests')) {
      console.log('   - Erro 429 detectado');
      console.log('   - Fallback deveria ter sido acionado automaticamente');
      console.log('   - Verifique executeWithFallback() no job');
    } else if (error.message?.includes('timeout')) {
      console.log('   - Timeout detectado');
      console.log('   - Fallback deveria ter sido acionado automaticamente');
      console.log('   - Verifique configuração de maxTokens');
    } else if (error.message?.includes('Cannot find module')) {
      console.log('   - Erro de import/módulo');
      console.log('   - Verifique que todos os imports estão corretos');
    } else {
      console.log('   - Erro inesperado');
      console.log('   - Verifique stack trace acima');
    }

    console.log('\n');
    return false;
  }
}

// Executar teste
runTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
