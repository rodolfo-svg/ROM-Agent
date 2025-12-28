#!/usr/bin/env node
/**
 * ROM Agent - Análise de Jurisprudência para Redução de Penhora
 *
 * Script especializado para buscar precedentes jurisprudenciais
 * que fundamentem a redução ou desconstituição de penhora.
 *
 * Integra:
 * - DataJud (API oficial do CNJ)
 * - JusBrasil (web scraping autenticado)
 * - Google Search (busca complementar)
 *
 * Uso:
 *   node scripts/analyze-garnishment-reduction.js --case "descrição do caso"
 *   node scripts/analyze-garnishment-reduction.js --bem "tipo de bem penhorado"
 */

import jurisprudenceSearchService from '../src/services/jurisprudence-search-service.js';
import datajudService from '../src/services/datajud-service.js';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const TRIBUNAIS_PRIORITARIOS = ['STJ', 'STF', 'TST', 'TRF-1', 'TRF-2', 'TRF-3', 'TRF-4', 'TRF-5'];

const TESES_REDUCAO_PENHORA = [
  {
    id: 'impenhorabilidade-bem-familia',
    query: 'impenhorabilidade bem de família Lei 8009/90',
    fundamento: 'Art. 1º, Lei 8.009/90 - Bem de família é impenhorável',
    aplicacao: 'Único imóvel residencial do devedor e sua família'
  },
  {
    id: 'impenhorabilidade-salario',
    query: 'impenhorabilidade salário vencimentos Art. 833',
    fundamento: 'Art. 833, IV, CPC - Salários e vencimentos são impenhoráveis',
    aplicacao: 'Penhora de salário acima de 50 salários mínimos'
  },
  {
    id: 'impenhorabilidade-instrumento-trabalho',
    query: 'impenhorabilidade instrumentos de trabalho profissional',
    fundamento: 'Art. 833, V, CPC - Instrumentos de trabalho são impenhoráveis',
    aplicacao: 'Ferramentas, equipamentos e veículos essenciais ao trabalho'
  },
  {
    id: 'reducao-proporcionalidade',
    query: 'redução penhora proporcionalidade excessiva garantia',
    fundamento: 'Princípio da proporcionalidade - Penhora não pode exceder valor da dívida',
    aplicacao: 'Valor do bem penhorado muito superior ao débito'
  },
  {
    id: 'substituicao-penhora',
    query: 'substituição penhora Art. 847 CPC bem menos gravoso',
    fundamento: 'Art. 847, CPC - Direito de substituir penhora por bem menos gravoso',
    aplicacao: 'Oferta de bem de menor valor ou fiança bancária'
  },
  {
    id: 'penhora-quantia-excessiva',
    query: 'penhora quantia excessiva redução 10% valor',
    fundamento: 'Penhora deve ser limitada a 110% do débito executado',
    aplicacao: 'Valor penhorado excede significativamente a dívida'
  },
  {
    id: 'fragilidade-execucao',
    query: 'desconstituição penhora fragilidade título executivo',
    fundamento: 'Título executivo com vícios ou irregularidades',
    aplicacao: 'Excesso de execução, prescrição ou nulidades'
  },
  {
    id: 'penhora-valores-conta',
    query: 'impenhorabilidade valores conta salário pensão',
    fundamento: 'Tema 1.103 STJ - Penhora de valores em conta corrente limitada',
    aplicacao: 'Proteção de valores essenciais à subsistência'
  }
];

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

/**
 * Formatar jurisprudência para o resumo executivo
 */
function formatarParaResumoExecutivo(jurisprudencia, tese) {
  return {
    tese: tese.id,
    fundamento: tese.fundamento,
    aplicacao: tese.aplicacao,
    precedentes: jurisprudencia.allResults.slice(0, 5).map(resultado => ({
      tribunal: resultado.tribunal,
      numero: resultado.numero,
      ementa: resultado.ementa?.substring(0, 300) + '...',
      data: resultado.data,
      url: resultado.url,
      relevancia: resultado.relevancia
    })),
    totalEncontrado: jurisprudencia.totalResults,
    argumentacao: gerarArgumentacao(tese, jurisprudencia)
  };
}

/**
 * Gerar argumentação jurídica baseada nos precedentes
 */
function gerarArgumentacao(tese, jurisprudencia) {
  const precedentesRelevantes = jurisprudencia.allResults.filter(r =>
    r.relevancia === 'high' && TRIBUNAIS_PRIORITARIOS.includes(r.tribunal)
  );

  if (precedentesRelevantes.length === 0) {
    return `Não foram encontrados precedentes de tribunais superiores, mas a tese ${tese.id} possui fundamentação legal sólida: ${tese.fundamento}`;
  }

  const tribunaisStr = [...new Set(precedentesRelevantes.map(p => p.tribunal))].join(', ');

  return `A tese "${tese.id}" encontra amparo em ${precedentesRelevantes.length} decisões ` +
    `de tribunais superiores (${tribunaisStr}), consolidando o entendimento de que ${tese.aplicacao.toLowerCase()}. ` +
    `${tese.fundamento}. Esta orientação jurisprudencial constitui forte argumento para ` +
    `fundamentar a redução ou desconstituição da penhora no caso concreto.`;
}

/**
 * Classificar bem penhorado
 */
function classificarBemPenhorado(descricaoBem) {
  const bemLower = descricaoBem.toLowerCase();

  if (bemLower.includes('imóvel') || bemLower.includes('casa') || bemLower.includes('apartamento')) {
    return ['impenhorabilidade-bem-familia'];
  }

  if (bemLower.includes('salário') || bemLower.includes('vencimento') || bemLower.includes('conta')) {
    return ['impenhorabilidade-salario', 'penhora-valores-conta'];
  }

  if (bemLower.includes('ferramenta') || bemLower.includes('equipamento') || bemLower.includes('veículo de trabalho')) {
    return ['impenhorabilidade-instrumento-trabalho'];
  }

  if (bemLower.includes('valor excessivo') || bemLower.includes('desproporcional')) {
    return ['reducao-proporcionalidade', 'penhora-quantia-excessiva'];
  }

  // Se não identificar tipo específico, retornar todas as teses
  return TESES_REDUCAO_PENHORA.map(t => t.id);
}

/**
 * Gerar resumo executivo
 */
function gerarResumoExecutivo(analises, tipoCaso) {
  const dataAnalise = new Date().toISOString().split('T')[0];

  const resumo = {
    titulo: 'ANÁLISE JURISPRUDENCIAL - REDUÇÃO DE PENHORA',
    data: dataAnalise,
    tipoCaso: tipoCaso,
    tesasAnalisadas: analises.length,
    totalPrecedentes: analises.reduce((sum, a) => sum + a.totalEncontrado, 0),
    precedentesRelevantes: analises.reduce((sum, a) =>
      sum + a.precedentes.filter(p => p.relevancia === 'high').length, 0
    ),

    recomendacoes: analises
      .filter(a => a.precedentes.length > 0)
      .sort((a, b) => b.precedentes.length - a.precedentes.length)
      .map((analise, index) => ({
        prioridade: index + 1,
        tese: analise.tese,
        fundamento: analise.fundamento,
        precedentes: analise.precedentes.length,
        argumentacao: analise.argumentacao,
        precendentesDestacados: analise.precedentes
          .filter(p => p.relevancia === 'high')
          .map(p => `${p.tribunal} - ${p.numero}`)
      })),

    fundamentacaoCompleta: gerarFundamentacaoCompleta(analises),

    fontesConsultadas: {
      datajud: 'DataJud - Base oficial do CNJ',
      jusbrasil: 'JusBrasil - Busca jurisprudencial especializada',
      websearch: 'Google Custom Search - Busca complementar'
    }
  };

  return resumo;
}

/**
 * Gerar fundamentação completa para petição
 */
function gerarFundamentacaoCompleta(analises) {
  const tesesPrincipais = analises
    .filter(a => a.precedentes.length >= 2)
    .slice(0, 3);

  if (tesesPrincipais.length === 0) {
    return 'Recomenda-se fundamentação baseada em legislação e princípios gerais do direito, ' +
      'dada a escassez de precedentes específicos encontrados.';
  }

  let texto = 'DA FUNDAMENTAÇÃO JURISPRUDENCIAL PARA REDUÇÃO DA PENHORA\n\n';

  tesesPrincipais.forEach((analise, index) => {
    texto += `${index + 1}. ${analise.fundamento}\n\n`;
    texto += `${analise.argumentacao}\n\n`;

    if (analise.precedentes.length > 0) {
      texto += 'Precedentes:\n';
      analise.precedentes.slice(0, 3).forEach(p => {
        texto += `- ${p.tribunal}, Processo ${p.numero}\n`;
        texto += `  "${p.ementa}"\n`;
        if (p.url) texto += `  Disponível em: ${p.url}\n`;
        texto += '\n';
      });
    }

    texto += '\n';
  });

  return texto;
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================

async function analisarReducaoPenhora(options = {}) {
  const {
    descricaoCaso = null,
    bemPenhorado = null,
    valorDebito = null,
    valorPenhorado = null,
    tribunal = null
  } = options;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 ROM AGENT - ANÁLISE DE REDUÇÃO DE PENHORA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  // Inicializar serviço de jurisprudência
  console.log('⚙️  Inicializando serviço de jurisprudência...');
  await jurisprudenceSearchService.init();
  console.log('✅ Serviço inicializado\n');

  // Classificar tipo de caso
  const tesasAplicaveis = bemPenhorado
    ? classificarBemPenhorado(bemPenhorado)
    : TESES_REDUCAO_PENHORA.map(t => t.id);

  console.log(`📋 Teses aplicáveis identificadas: ${tesasAplicaveis.length}`);
  console.log();

  // Buscar jurisprudência para cada tese
  const analises = [];

  for (const teseId of tesasAplicaveis) {
    const tese = TESES_REDUCAO_PENHORA.find(t => t.id === teseId);
    if (!tese) continue;

    console.log(`🔎 Buscando precedentes: ${tese.id}`);
    console.log(`   Query: "${tese.query}"`);

    try {
      const jurisprudencia = await jurisprudenceSearchService.searchAll(
        tese.query,
        {
          limit: 10,
          tribunal: tribunal,
          enableCache: true
        }
      );

      console.log(`   ✅ Encontrados: ${jurisprudencia.totalResults} resultados`);

      if (jurisprudencia.fromCache) {
        console.log('   📦 (do cache)');
      }

      const analise = formatarParaResumoExecutivo(jurisprudencia, tese);
      analises.push(analise);

      // Exibir precedentes de tribunais superiores
      const precedentesSuperiores = analise.precedentes.filter(p =>
        TRIBUNAIS_PRIORITARIOS.includes(p.tribunal)
      );

      if (precedentesSuperiores.length > 0) {
        console.log(`   🎯 Precedentes de tribunais superiores: ${precedentesSuperiores.length}`);
        precedentesSuperiores.slice(0, 2).forEach(p => {
          console.log(`      - ${p.tribunal}: ${p.numero}`);
        });
      }

      console.log();

    } catch (error) {
      console.error(`   ❌ Erro ao buscar: ${error.message}`);
      console.log();
    }
  }

  // Gerar resumo executivo
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 GERANDO RESUMO EXECUTIVO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  const tipoCaso = bemPenhorado || descricaoCaso || 'Redução de penhora';
  const resumo = gerarResumoExecutivo(analises, tipoCaso);

  console.log(`✅ Resumo gerado com sucesso!`);
  console.log();
  console.log(`📈 Estatísticas:`);
  console.log(`   - Teses analisadas: ${resumo.tesasAnalisadas}`);
  console.log(`   - Total de precedentes: ${resumo.totalPrecedentes}`);
  console.log(`   - Precedentes relevantes: ${resumo.precedentesRelevantes}`);
  console.log(`   - Recomendações: ${resumo.recomendacoes.length}`);
  console.log();

  if (resumo.recomendacoes.length > 0) {
    console.log('🎯 TOP 3 RECOMENDAÇÕES:');
    console.log();

    resumo.recomendacoes.slice(0, 3).forEach((rec, index) => {
      console.log(`${index + 1}. ${rec.tese.toUpperCase()}`);
      console.log(`   Fundamento: ${rec.fundamento}`);
      console.log(`   Precedentes encontrados: ${rec.precedentes}`);
      if (rec.precendentesDestacados.length > 0) {
        console.log(`   Destaques: ${rec.precendentesDestacados.slice(0, 2).join(', ')}`);
      }
      console.log();
    });
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📄 FUNDAMENTAÇÃO PARA PETIÇÃO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();
  console.log(resumo.fundamentacaoCompleta);

  // Salvar em arquivo
  const outputFile = `/tmp/analise-penhora-${Date.now()}.json`;
  const fs = await import('fs');
  await fs.promises.writeFile(outputFile, JSON.stringify(resumo, null, 2), 'utf-8');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`💾 Análise completa salva em: ${outputFile}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return resumo;
}

// ============================================================
// EXECUÇÃO (Se chamado diretamente)
// ============================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    options[key] = value;
  }

  analisarReducaoPenhora(options)
    .then(() => {
      console.log();
      console.log('✅ Análise concluída com sucesso!');
      process.exit(0);
    })
    .catch(error => {
      console.error();
      console.error('❌ Erro na análise:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

export default analisarReducaoPenhora;
