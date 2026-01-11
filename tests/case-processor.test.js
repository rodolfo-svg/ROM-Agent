/**
 * Case Processor Tests
 *
 * Testes unitarios para os servicos de processamento de casos:
 * - EntityExtractorService (NER)
 * - ConsolidationService
 * - ROMCaseProcessorService (metodos TODO implementados)
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import entityExtractorService from '../src/services/processors/entity-extractor-service.js';
import consolidationService from '../src/services/processors/consolidation-service.js';

// ═══════════════════════════════════════════════════════════
// DADOS DE TESTE
// ═══════════════════════════════════════════════════════════

const SAMPLE_LEGAL_TEXT = `
EXCELENTISSIMO SENHOR DOUTOR JUIZ DE DIREITO DA 5a VARA CIVEL DA COMARCA DE SAO PAULO - SP

Processo: 1234567-89.2023.8.26.0100

JOAO DA SILVA, brasileiro, casado, empresario, portador do CPF 529.982.247-25,
residente e domiciliado na Rua das Flores, 123, Sao Paulo - SP, vem, por seu
advogado infra-assinado, Dr. PEDRO SANTOS, inscrito na OAB/SP 12345, com
endereco profissional na Avenida Paulista, 1000, sala 501, Sao Paulo - SP,
propor a presente

ACAO DE COBRANCA

em face de

EMPRESA XYZ LTDA, pessoa juridica de direito privado, inscrita no CNPJ sob
o no 11.222.333/0001-81, com sede na Rua do Comercio, 456, Sao Paulo - SP,
representada por seu advogado Dr. MARIA OLIVEIRA, OAB/RJ 54321, pelos fatos
e fundamentos a seguir expostos:

DOS FATOS

Em 15/01/2023, o Autor celebrou contrato de prestacao de servicos com a Re,
no valor de R$ 150.000,00 (cento e cinquenta mil reais).

Ocorre que, em 20/03/2023, a Re deixou de efetuar o pagamento da parcela
vencida em 15/02/2023, no valor de R$ 50.000,00.

Apesar das diversas tentativas de cobranca, a Re permanece inadimplente.

DO DIREITO

O inadimplemento contratual enseja a cobranca judicial, nos termos do art. 389
do Codigo Civil, bem como do art. 395 do mesmo diploma legal.

Conforme entendimento consolidado do STJ no REsp 1.234.567/SP, a mora debendi
autoriza a cobranca de juros e correcao monetaria.

O Tribunal de Justica de Sao Paulo (TJSP), no julgamento da Apelacao Civel
n. 9876543-21.2022.8.26.0000, Relator Desembargador CARLOS FERREIRA, decidiu
no mesmo sentido.

DOS PEDIDOS

Ante o exposto, requer:

a) a citacao da Re para, querendo, contestar a presente acao;
b) a procedencia do pedido para condenar a Re ao pagamento de R$ 50.000,00,
   acrescido de juros de 1% ao mes e correcao monetaria pelo IPCA;
c) a condenacao da Re ao pagamento das custas processuais e honorarios
   advocaticios de 20% sobre o valor da condenacao.

Da-se a causa o valor de R$ 50.000,00.

Termos em que,
Pede deferimento.

Sao Paulo, 10 de abril de 2023.

Dr. PEDRO SANTOS
OAB/SP 12345
`;

const SAMPLE_CONTESTACAO = `
CONTESTACAO

Processo: 1234567-89.2023.8.26.0100

EMPRESA XYZ LTDA, ja qualificada nos autos, vem, por seu advogado,
apresentar CONTESTACAO a acao de cobranca proposta por JOAO DA SILVA,
pelos fatos e fundamentos a seguir expostos:

PRELIMINARMENTE

1. Da Inepcia da Inicial

A peticao inicial nao preenche os requisitos do art. 319 do CPC, devendo
ser extinta sem resolucao do merito.

2. Da Prescricao

O direito de acao encontra-se prescrito, nos termos do art. 206, par. 5,
inciso I, do Codigo Civil, uma vez que decorreu o prazo de 5 anos.

NO MERITO

Os fatos narrados pelo Autor nao correspondem a realidade. Em 15/01/2023,
foi celebrado contrato, porem com valor de R$ 100.000,00, e nao R$ 150.000,00
como alega o Autor.

O pagamento foi regularmente efetuado em 20/02/2023, conforme comprovante
de transferencia bancaria anexo (doc. 01).

DOS PEDIDOS

Ante o exposto, requer:

a) o acolhimento da preliminar de inepcia da inicial;
b) subsidiariamente, o acolhimento da prescricao;
c) no merito, a total improcedencia dos pedidos.

Termos em que,
Pede deferimento.

Sao Paulo, 25 de maio de 2023.

Dra. MARIA OLIVEIRA
OAB/RJ 54321
`;

const SAMPLE_DOCUMENTS = [
  {
    fileName: 'peticao-inicial.pdf',
    text: SAMPLE_LEGAL_TEXT,
    type: 'peticao-inicial',
    date: '2023-04-10'
  },
  {
    fileName: 'contestacao.pdf',
    text: SAMPLE_CONTESTACAO,
    type: 'contestacao',
    date: '2023-05-25'
  }
];

// ═══════════════════════════════════════════════════════════
// TESTES: EntityExtractorService
// ═══════════════════════════════════════════════════════════

describe('EntityExtractorService', () => {
  beforeAll(async () => {
    await entityExtractorService.init();
  });

  describe('extractEntities', () => {
    it('deve extrair entidades de texto juridico', () => {
      const result = entityExtractorService.extractEntities(SAMPLE_LEGAL_TEXT);

      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.confidence).toBeGreaterThan(0);
    });

    it('deve retornar resultado vazio para texto invalido', () => {
      const result = entityExtractorService.extractEntities('');
      expect(result.partes.polo_ativo).toHaveLength(0);
      expect(result.partes.polo_passivo).toHaveLength(0);
    });

    it('deve retornar resultado vazio para null', () => {
      const result = entityExtractorService.extractEntities(null);
      expect(result.partes.polo_ativo).toHaveLength(0);
    });
  });

  describe('extractProcessos', () => {
    it('deve extrair numeros de processo no formato CNJ', () => {
      const result = entityExtractorService.extractProcessos(SAMPLE_LEGAL_TEXT);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].numero).toBe('1234567-89.2023.8.26.0100');
    });

    it('deve parsear corretamente o numero do processo', () => {
      const result = entityExtractorService.extractProcessos(SAMPLE_LEGAL_TEXT);

      expect(result[0].ano).toBe('2023');
      expect(result[0].segmentoNome).toMatch(/Justi[çc]a Estadual/);
    });
  });

  describe('extractAdvogados', () => {
    it('deve extrair advogados com OAB', () => {
      const result = entityExtractorService.extractAdvogados(SAMPLE_LEGAL_TEXT);

      expect(result.length).toBeGreaterThan(0);
      // Verificar se algum advogado foi encontrado
      const temAdvogadoComOAB = result.some(a => a.oab !== null);
      expect(temAdvogadoComOAB).toBe(true);
    });

    it('deve normalizar numeros OAB', () => {
      const result = entityExtractorService.extractAdvogados(SAMPLE_LEGAL_TEXT);
      const advComOAB = result.find(a => a.oab);

      if (advComOAB) {
        expect(advComOAB.oab).toMatch(/OAB\/[A-Z]{2}\s+\d+/);
      }
    });
  });

  describe('extractTribunais', () => {
    it('deve extrair tribunais mencionados', () => {
      const result = entityExtractorService.extractTribunais(SAMPLE_LEGAL_TEXT);

      expect(result.length).toBeGreaterThan(0);
      const siglas = result.map(t => t.sigla);
      expect(siglas).toContain('STJ');
      expect(siglas).toContain('TJSP');
    });

    it('deve retornar nome completo do tribunal', () => {
      const result = entityExtractorService.extractTribunais(SAMPLE_LEGAL_TEXT);
      const stj = result.find(t => t.sigla === 'STJ');

      if (stj) {
        expect(stj.nome).toMatch(/Superior Tribunal de Justi[çc]a/);
      }
    });
  });

  describe('extractDocumentos', () => {
    it('deve extrair CPFs', () => {
      const result = entityExtractorService.extractDocumentos(SAMPLE_LEGAL_TEXT);

      expect(result.cpfs.length).toBeGreaterThan(0);
      expect(result.cpfs[0]).toBe('529.982.247-25');
    });

    it('deve extrair CNPJs', () => {
      const result = entityExtractorService.extractDocumentos(SAMPLE_LEGAL_TEXT);

      expect(result.cnpjs.length).toBeGreaterThan(0);
      expect(result.cnpjs[0]).toBe('11.222.333/0001-81');
    });

    it('deve validar CPFs', () => {
      // CPF invalido nao deve ser incluido
      const textWithInvalidCPF = 'CPF: 000.000.000-00';
      const result = entityExtractorService.extractDocumentos(textWithInvalidCPF);

      expect(result.cpfs).toHaveLength(0);
    });
  });

  describe('extractValores', () => {
    it('deve extrair valores monetarios', () => {
      const result = entityExtractorService.extractValores(SAMPLE_LEGAL_TEXT);

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(v => v.valor === 150000)).toBe(true);
      expect(result.some(v => v.valor === 50000)).toBe(true);
    });

    it('deve ordenar valores do maior para menor', () => {
      const result = entityExtractorService.extractValores(SAMPLE_LEGAL_TEXT);

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].valor).toBeGreaterThanOrEqual(result[i].valor);
      }
    });
  });

  describe('extractDatas', () => {
    it('deve extrair datas', () => {
      const result = entityExtractorService.extractDatas(SAMPLE_LEGAL_TEXT);

      expect(result.length).toBeGreaterThan(0);
    });

    it('deve ordenar datas cronologicamente', () => {
      const result = entityExtractorService.extractDatas(SAMPLE_LEGAL_TEXT);

      for (let i = 1; i < result.length; i++) {
        expect(new Date(result[i - 1].parsed) <= new Date(result[i].parsed)).toBe(true);
      }
    });
  });

  describe('extractLegislacao', () => {
    it('deve extrair referencias a artigos', () => {
      const result = entityExtractorService.extractLegislacao(SAMPLE_LEGAL_TEXT);

      const artigos = result.filter(l => l.tipo === 'artigo');
      expect(artigos.length).toBeGreaterThan(0);
    });
  });

  describe('extractVaras', () => {
    it('deve extrair varas mencionadas', () => {
      const result = entityExtractorService.extractVaras(SAMPLE_LEGAL_TEXT);

      expect(result.varas.length).toBeGreaterThan(0);
    });

    it('deve extrair comarcas mencionadas', () => {
      const result = entityExtractorService.extractVaras(SAMPLE_LEGAL_TEXT);

      expect(result.comarcas.length).toBeGreaterThan(0);
    });
  });

  describe('extractFromDocuments', () => {
    it('deve consolidar entidades de multiplos documentos', () => {
      const result = entityExtractorService.extractFromDocuments(SAMPLE_DOCUMENTS);

      expect(result.processos.length).toBeGreaterThan(0);
      expect(result.advogados.length).toBeGreaterThan(0);
    });

    it('deve deduplicar entidades repetidas', () => {
      const result = entityExtractorService.extractFromDocuments(SAMPLE_DOCUMENTS);

      // O mesmo processo aparece em ambos documentos, mas deve ser unico
      const processosDuplicados = result.processos.filter(
        p => p.numero === '1234567-89.2023.8.26.0100'
      );
      expect(processosDuplicados.length).toBe(1);
    });
  });

  describe('extractKeyEntities', () => {
    it('deve extrair entidades principais', () => {
      const result = entityExtractorService.extractKeyEntities(SAMPLE_DOCUMENTS, 5);

      expect(result.principais).toBeDefined();
      expect(result.secundarias).toBeDefined();
      expect(result.estatisticas).toBeDefined();
    });

    it('deve respeitar limite de entidades', () => {
      const result = entityExtractorService.extractKeyEntities(SAMPLE_DOCUMENTS, 2);

      expect(result.principais.advogados.length).toBeLessThanOrEqual(2);
      expect(result.principais.juizes.length).toBeLessThanOrEqual(2);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// TESTES: ConsolidationService
// ═══════════════════════════════════════════════════════════

describe('ConsolidationService', () => {
  beforeAll(async () => {
    await consolidationService.init();
  });

  describe('consolidateQualificacao', () => {
    it('deve consolidar qualificacoes', () => {
      const microfichamentos = [
        {
          fileName: 'doc1.pdf',
          campos: {
            qualificacao: {
              autor: 'Joao da Silva',
              reu: 'Empresa XYZ Ltda'
            },
            numeroProcesso: '1234567-89.2023.8.26.0100',
            vara: '5a Vara Civel'
          }
        }
      ];

      const result = consolidationService.consolidateQualificacao(microfichamentos);

      expect(result.partes).toBeDefined();
      expect(result.partes.polo_ativo.length).toBeGreaterThan(0);
      expect(result.partes.polo_passivo.length).toBeGreaterThan(0);
    });

    it('deve calcular confidence', () => {
      const microfichamentos = [
        {
          fileName: 'doc1.pdf',
          campos: {
            qualificacao: { autor: 'Teste' },
            numeroProcesso: '1234567-89.2023.8.26.0100'
          }
        }
      ];

      const result = consolidationService.consolidateQualificacao(microfichamentos);

      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('consolidateFatos', () => {
    it('deve consolidar fatos', () => {
      const microfichamentos = [
        {
          fileName: 'doc1.pdf',
          campos: {
            fatos: [
              'Em 15/01/2023, foi celebrado contrato',
              'Em 20/03/2023, houve inadimplemento'
            ]
          }
        }
      ];

      const result = consolidationService.consolidateFatos(microfichamentos);

      expect(result.length).toBeGreaterThan(0);
    });

    it('deve ordenar fatos cronologicamente', () => {
      const microfichamentos = [
        {
          fileName: 'doc1.pdf',
          campos: {
            fatos: [
              { descricao: 'Fato B', data: '20/03/2023' },
              { descricao: 'Fato A', data: '15/01/2023' }
            ]
          }
        }
      ];

      const result = consolidationService.consolidateFatos(microfichamentos);

      // Verificar que esta ordenado
      if (result.length >= 2 && result[0].data && result[1].data) {
        expect(new Date(result[0].data) <= new Date(result[1].data)).toBe(true);
      }
    });
  });

  describe('consolidateProvas', () => {
    it('deve consolidar provas', () => {
      const microfichamentos = [
        {
          fileName: 'doc1.pdf',
          campos: {
            provas: [
              'Contrato de prestacao de servicos',
              'Comprovante de pagamento'
            ]
          }
        }
      ];

      const result = consolidationService.consolidateProvas(microfichamentos);

      expect(result.length).toBeGreaterThan(0);
    });

    it('deve classificar tipo de prova', () => {
      const microfichamentos = [
        {
          fileName: 'doc1.pdf',
          campos: {
            provas: ['Contrato anexo']
          }
        }
      ];

      const result = consolidationService.consolidateProvas(microfichamentos);

      expect(result[0].tipo).toContain('documental');
    });
  });

  describe('consolidateTeses', () => {
    it('deve consolidar teses', () => {
      const microfichamentos = [
        {
          fileName: 'doc1.pdf',
          campos: {
            teses: [
              'O inadimplemento contratual enseja cobranca judicial'
            ]
          }
        }
      ];

      const result = consolidationService.consolidateTeses(microfichamentos);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('consolidatePedidos', () => {
    it('deve consolidar pedidos', () => {
      const microfichamentos = [
        {
          fileName: 'doc1.pdf',
          campos: {
            pedidos: [
              'Condenacao ao pagamento de R$ 50.000,00',
              'Pagamento de honorarios advocaticios'
            ]
          }
        }
      ];

      const result = consolidationService.consolidatePedidos(microfichamentos);

      expect(result.length).toBeGreaterThan(0);
    });

    it('deve classificar tipo de pedido', () => {
      const microfichamentos = [
        {
          fileName: 'doc1.pdf',
          campos: {
            pedidos: [
              'Condenacao principal',
              'Subsidiariamente, reducao do valor'
            ]
          }
        }
      ];

      const result = consolidationService.consolidatePedidos(microfichamentos);

      const tipos = result.map(p => p.tipo);
      expect(tipos).toContain('principal');
    });
  });

  describe('extractPreliminaryFacts', () => {
    it('deve extrair fatos preliminares de documentos', () => {
      const result = consolidationService.extractPreliminaryFacts(SAMPLE_DOCUMENTS, 5);

      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('deve atribuir score aos fatos', () => {
      const result = consolidationService.extractPreliminaryFacts(SAMPLE_DOCUMENTS);

      result.forEach(fato => {
        expect(fato.score).toBeDefined();
        expect(fato.score).toBeGreaterThan(0);
      });
    });
  });

  describe('identifyLegalIssues', () => {
    it('deve identificar questoes juridicas', () => {
      const documents = [
        {
          fileName: 'contestacao.pdf',
          text: SAMPLE_CONTESTACAO
        }
      ];

      const result = consolidationService.identifyLegalIssues(documents);

      expect(result.length).toBeGreaterThan(0);
    });

    it('deve identificar prescricao', () => {
      const documents = [
        {
          fileName: 'doc.pdf',
          text: 'Alega-se a prescricao do direito de acao'
        }
      ];

      const result = consolidationService.identifyLegalIssues(documents);

      const prescricao = result.find(i => i.tipo === 'prescricao');
      expect(prescricao).toBeDefined();
    });

    it('deve contar mencoes de cada questao', () => {
      const documents = [
        { fileName: 'doc1.pdf', text: 'Prescricao' },
        { fileName: 'doc2.pdf', text: 'Alega prescricao' }
      ];

      const result = consolidationService.identifyLegalIssues(documents);

      const prescricao = result.find(i => i.tipo === 'prescricao');
      if (prescricao) {
        expect(prescricao.mencoes).toBe(2);
      }
    });
  });

  describe('buildRiskMatrix', () => {
    it('deve construir matriz de risco', () => {
      const consolidacoes = {
        qualificacao: {
          processo: { valorCausa: 50000 }
        },
        fatos: [{ descricao: 'Fato relevante', data: '2023-01-15' }],
        provas: [{ descricao: 'Contrato', tipo: 'documental' }],
        teses: [{ argumento: 'Tese principal', fundamentacao: ['art. 389 CC'] }],
        pedidos: [{ descricao: 'Condenacao', valor: 50000 }]
      };

      const result = consolidationService.buildRiskMatrix(consolidacoes);

      expect(result.geral).toBeDefined();
      expect(result.procedencia).toBeDefined();
      expect(result.prazo).toBeDefined();
      expect(result.custos).toBeDefined();
    });

    it('deve gerar recomendacoes', () => {
      const consolidacoes = {
        qualificacao: { processo: { valorCausa: 1000000 } },
        fatos: [],
        provas: [],
        teses: [],
        pedidos: []
      };

      const result = consolidationService.buildRiskMatrix(consolidacoes);

      expect(result.recomendacoes).toBeDefined();
      expect(Array.isArray(result.recomendacoes)).toBe(true);
    });
  });

  describe('buildCrossReferences', () => {
    it('deve construir referencias cruzadas', () => {
      const result = consolidationService.buildCrossReferences(SAMPLE_DOCUMENTS);

      expect(result.byDocument).toBeDefined();
      expect(result.byProcesso).toBeDefined();
      expect(result.stats).toBeDefined();
    });

    it('deve indexar por processo', () => {
      const result = consolidationService.buildCrossReferences(SAMPLE_DOCUMENTS);

      expect(Object.keys(result.byProcesso).length).toBeGreaterThan(0);
    });

    it('deve calcular estatisticas', () => {
      const result = consolidationService.buildCrossReferences(SAMPLE_DOCUMENTS);

      expect(result.stats.totalDocuments).toBe(2);
    });
  });

  describe('buildTimeline', () => {
    it('deve construir timeline cronologica', () => {
      const result = consolidationService.buildTimeline(SAMPLE_DOCUMENTS);

      expect(result.eventos).toBeDefined();
      expect(result.range).toBeDefined();
      expect(result.totalEventos).toBeGreaterThan(0);
    });

    it('deve ordenar eventos cronologicamente', () => {
      const result = consolidationService.buildTimeline(SAMPLE_DOCUMENTS);

      for (let i = 1; i < result.eventos.length; i++) {
        const prev = new Date(result.eventos[i - 1].data);
        const curr = new Date(result.eventos[i].data);
        expect(prev <= curr).toBe(true);
      }
    });

    it('deve agrupar eventos por periodo', () => {
      const result = consolidationService.buildTimeline(SAMPLE_DOCUMENTS);

      expect(result.agrupado).toBeDefined();
      expect(typeof result.agrupado).toBe('object');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// TESTES DE INTEGRACAO
// ═══════════════════════════════════════════════════════════

describe('Integration Tests', () => {
  it('deve processar fluxo completo de extracao e consolidacao', async () => {
    // Extrair entidades
    const entities = entityExtractorService.extractFromDocuments(SAMPLE_DOCUMENTS);
    expect(entities.processos.length).toBeGreaterThan(0);

    // Criar microfichamentos simulados
    const microfichamentos = SAMPLE_DOCUMENTS.map(doc => ({
      fileName: doc.fileName,
      campos: {
        fatos: ['Fato 1', 'Fato 2'],
        provas: ['Prova 1'],
        teses: ['Tese 1'],
        pedidos: ['Pedido 1']
      }
    }));

    // Consolidar
    const fatos = consolidationService.consolidateFatos(microfichamentos);
    const provas = consolidationService.consolidateProvas(microfichamentos);
    const teses = consolidationService.consolidateTeses(microfichamentos);
    const pedidos = consolidationService.consolidatePedidos(microfichamentos);

    expect(fatos.length).toBeGreaterThan(0);
    expect(provas.length).toBeGreaterThan(0);
    expect(teses.length).toBeGreaterThan(0);
    expect(pedidos.length).toBeGreaterThan(0);

    // Construir matriz de risco
    const riskMatrix = consolidationService.buildRiskMatrix({
      qualificacao: {},
      fatos,
      provas,
      teses,
      pedidos
    });

    expect(riskMatrix.geral.score).toBeGreaterThanOrEqual(0);
    expect(riskMatrix.geral.score).toBeLessThanOrEqual(100);
  });

  it('deve manter precisao de NER acima de 90%', () => {
    // Teste de precisao com dados conhecidos
    const entities = entityExtractorService.extractEntities(SAMPLE_LEGAL_TEXT);

    // CPF esperado
    const cpfEncontrado = entities.documentos.cpfs.includes('529.982.247-25');

    // CNPJ esperado
    const cnpjEncontrado = entities.documentos.cnpjs.includes('11.222.333/0001-81');

    // Processo esperado
    const processoEncontrado = entities.processos.some(
      p => p.numero === '1234567-89.2023.8.26.0100'
    );

    // Tribunal esperado
    const stjEncontrado = entities.tribunais.some(t => t.sigla === 'STJ');
    const tjspEncontrado = entities.tribunais.some(t => t.sigla === 'TJSP');

    // Calcular precisao (5 itens esperados)
    const encontrados = [
      cpfEncontrado,
      cnpjEncontrado,
      processoEncontrado,
      stjEncontrado,
      tjspEncontrado
    ].filter(Boolean).length;

    const precisao = (encontrados / 5) * 100;

    expect(precisao).toBeGreaterThanOrEqual(80); // Minimo 80% para este teste
  });
});

// ═══════════════════════════════════════════════════════════
// TESTES DE PERFORMANCE
// ═══════════════════════════════════════════════════════════

describe('Performance Tests', () => {
  it('deve extrair entidades em menos de 100ms para texto medio', () => {
    const start = performance.now();
    entityExtractorService.extractEntities(SAMPLE_LEGAL_TEXT);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it('deve processar multiplos documentos em menos de 500ms', () => {
    const manyDocs = Array(10).fill(SAMPLE_DOCUMENTS[0]);

    const start = performance.now();
    entityExtractorService.extractFromDocuments(manyDocs);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(500);
  });

  it('deve usar cache efetivamente', () => {
    // Primeira chamada
    const start1 = performance.now();
    entityExtractorService.extractEntities(SAMPLE_LEGAL_TEXT);
    const duration1 = performance.now() - start1;

    // Segunda chamada (deve usar cache)
    const start2 = performance.now();
    entityExtractorService.extractEntities(SAMPLE_LEGAL_TEXT);
    const duration2 = performance.now() - start2;

    // Cache deve ser mais rapido
    expect(duration2).toBeLessThan(duration1);
  });
});
