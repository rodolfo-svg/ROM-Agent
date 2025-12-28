#!/usr/bin/env node
/**
 * ROM Agent - Sistema Universal de Análise de Jurisprudência
 *
 * Script genérico para buscar precedentes jurisprudenciais sobre QUALQUER tema.
 * Não possui teses pré-definidas - aceita qualquer consulta jurídica.
 *
 * Integra:
 * - DataJud (API oficial do CNJ)
 * - JusBrasil (web scraping autenticado)
 * - Google Search (busca complementar)
 *
 * Uso:
 *   node scripts/analyze-jurisprudence.js --query "sua consulta jurídica aqui"
 *   node scripts/analyze-jurisprudence.js --query "usucapião extraordinária" --tribunal "STJ"
 *   node scripts/analyze-jurisprudence.js --query "danos morais quantum indenizatório"
 */

import jurisprudenceSearchService from '../src/services/jurisprudence-search-service.js';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const TRIBUNAIS_PRIORITARIOS = ['STF', 'STJ', 'TST', 'TSE', 'TRF-1', 'TRF-2', 'TRF-3', 'TRF-4', 'TRF-5'];

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

/**
 * Formatar jurisprudência para o resumo executivo
 */
function formatarParaResumoExecutivo(jurisprudencia, query) {
  return {
    query: query,
    precedentes: jurisprudencia.allResults.slice(0, 10).map(resultado => ({
      tribunal: resultado.tribunal,
      numero: resultado.numero,
      ementa: resultado.ementa?.substring(0, 400) + '...',
      data: resultado.data,
      url: resultado.url,
      relevancia: resultado.relevancia
    })),
    totalEncontrado: jurisprudencia.totalResults,
    argumentacao: gerarArgumentacao(query, jurisprudencia)
  };
}

/**
 * Gerar argumentação jurídica baseada nos precedentes
 */
function gerarArgumentacao(query, jurisprudencia) {
  const precedentesRelevantes = jurisprudencia.allResults.filter(r =>
    r.relevancia === 'high' && TRIBUNAIS_PRIORITARIOS.includes(r.tribunal)
  );

  if (precedentesRelevantes.length === 0) {
    return `Foram encontrados ${jurisprudencia.totalResults} precedentes sobre "${query}", mas nenhum de tribunais superiores. Recomenda-se análise dos precedentes disponíveis e fundamentação em legislação aplicável.`;
  }

  const tribunaisStr = [...new Set(precedentesRelevantes.map(p => p.tribunal))].join(', ');

  return `A consulta sobre "${query}" encontrou ${precedentesRelevantes.length} decisões relevantes ` +
    `de tribunais superiores (${tribunaisStr}), consolidando orientação jurisprudencial sobre o tema. ` +
    `Total de ${jurisprudencia.totalResults} precedentes encontrados nas bases consultadas.`;
}

/**
 * Gerar resumo executivo
 */
function gerarResumoExecutivo(analise, query, tribunal) {
  const dataAnalise = new Date().toISOString().split('T')[0];

  const resumo = {
    titulo: 'ANÁLISE JURISPRUDENCIAL',
    data: dataAnalise,
    consulta: query,
    tribunal: tribunal || 'Todos',
    totalPrecedentes: analise.totalEncontrado,
    precedentesRelevantes: analise.precedentes.filter(p => p.relevancia === 'high').length,

    precedentes: analise.precedentes.map((p, index) => ({
      ordem: index + 1,
      tribunal: p.tribunal,
      numero: p.numero,
      ementa: p.ementa,
      data: p.data,
      url: p.url,
      relevancia: p.relevancia
    })),

    argumentacao: analise.argumentacao,

    fundamentacaoCompleta: gerarFundamentacaoCompleta(analise, query),

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
function gerarFundamentacaoCompleta(analise, query) {
  const precedentesDestacados = analise.precedentes
    .filter(p => p.relevancia === 'high')
    .slice(0, 5);

  if (precedentesDestacados.length === 0) {
    return `Consulta realizada sobre: "${query}"\n\n` +
      `Total de ${analise.totalEncontrado} precedentes encontrados.\n\n` +
      `Recomenda-se análise detalhada dos precedentes disponíveis para fundamentação.`;
  }

  let texto = `DA FUNDAMENTAÇÃO JURISPRUDENCIAL\n\n`;
  texto += `Consulta: "${query}"\n\n`;
  texto += analise.argumentacao + '\n\n';
  texto += 'Precedentes destacados:\n\n';

  precedentesDestacados.forEach((p, index) => {
    texto += `${index + 1}. ${p.tribunal}, Processo ${p.numero}\n`;
    texto += `   "${p.ementa}"\n`;
    if (p.url) texto += `   Disponível em: ${p.url}\n`;
    texto += '\n';
  });

  return texto;
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================

async function analisarJurisprudencia(options = {}) {
  const {
    query = null,
    tribunal = null,
    limit = 20
  } = options;

  if (!query) {
    console.error('❌ Erro: Parâmetro --query é obrigatório');
    console.log('\nUso:');
    console.log('  node scripts/analyze-jurisprudence.js --query "sua consulta aqui"');
    console.log('\nExemplos:');
    console.log('  node scripts/analyze-jurisprudence.js --query "usucapião extraordinária"');
    console.log('  node scripts/analyze-jurisprudence.js --query "danos morais" --tribunal "STJ"');
    console.log('  node scripts/analyze-jurisprudence.js --query "guarda compartilhada" --limit 30');
    process.exit(1);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 ROM AGENT - ANÁLISE DE JURISPRUDÊNCIA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();
  console.log(`📋 Consulta: "${query}"`);
  if (tribunal) console.log(`🏛️  Tribunal: ${tribunal}`);
  console.log(`📊 Limite: ${limit} resultados`);
  console.log();

  // Inicializar serviço de jurisprudência
  console.log('⚙️  Inicializando serviço de jurisprudência...');
  await jurisprudenceSearchService.init();
  console.log('✅ Serviço inicializado\n');

  // Buscar jurisprudência
  console.log('🔎 Buscando precedentes...');
  console.log(`   Query: "${query}"`);
  console.log();

  let jurisprudencia;
  try {
    jurisprudencia = await jurisprudenceSearchService.searchAll(
      query,
      {
        limit: limit,
        tribunal: tribunal,
        enableCache: true
      }
    );

    console.log(`✅ Encontrados: ${jurisprudencia.totalResults} resultados`);

    if (jurisprudencia.fromCache) {
      console.log('📦 (do cache)');
    }

    // Exibir precedentes de tribunais superiores
    const precedentesSuperiores = jurisprudencia.allResults.filter(p =>
      TRIBUNAIS_PRIORITARIOS.includes(p.tribunal)
    );

    if (precedentesSuperiores.length > 0) {
      console.log();
      console.log(`🎯 Precedentes de tribunais superiores: ${precedentesSuperiores.length}`);

      const porTribunal = {};
      precedentesSuperiores.forEach(p => {
        if (!porTribunal[p.tribunal]) porTribunal[p.tribunal] = [];
        porTribunal[p.tribunal].push(p);
      });

      Object.entries(porTribunal).forEach(([trib, precs]) => {
        console.log(`   ${trib}: ${precs.length} decisões`);
        precs.slice(0, 2).forEach(p => {
          console.log(`      - ${p.numero}`);
        });
      });
    }

    console.log();

  } catch (error) {
    console.error(`❌ Erro ao buscar: ${error.message}`);
    process.exit(1);
  }

  // Formatar resultado
  const analise = formatarParaResumoExecutivo(jurisprudencia, query);

  // Gerar resumo executivo
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 GERANDO RESUMO EXECUTIVO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  const resumo = gerarResumoExecutivo(analise, query, tribunal);

  console.log(`✅ Resumo gerado com sucesso!`);
  console.log();
  console.log(`📈 Estatísticas:`)
;
  console.log(`   - Consulta: "${query}"`);
  console.log(`   - Total de precedentes: ${resumo.totalPrecedentes}`);
  console.log(`   - Precedentes relevantes: ${resumo.precedentesRelevantes}`);
  console.log();

  if (resumo.precedentes.length > 0) {
    console.log('🎯 TOP 5 PRECEDENTES:');
    console.log();

    resumo.precedentes.slice(0, 5).forEach((prec, index) => {
      console.log(`${index + 1}. ${prec.tribunal} - ${prec.numero}`);
      console.log(`   Relevância: ${prec.relevancia}`);
      if (prec.ementa) {
        const ementaShort = prec.ementa.substring(0, 150) + '...';
        console.log(`   "${ementaShort}"`);
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
  const outputFile = `/tmp/analise-jurisprudencia-${Date.now()}.json`;
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

    if (key === 'limit') {
      options[key] = parseInt(value, 10);
    } else {
      options[key] = value;
    }
  }

  analisarJurisprudencia(options)
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

export default analisarJurisprudencia;
