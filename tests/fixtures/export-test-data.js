/**
 * Fixtures de dados para testes de exportação
 */

export const sampleLegalBrief = {
  content: `# PETIÇÃO INICIAL

EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA 1ª VARA CÍVEL

**REQUERENTE:** João da Silva, brasileiro, casado, empresário, portador do CPF 123.456.789-00
**REQUERIDO:** Empresa XYZ Ltda, inscrita no CNPJ 12.345.678/0001-00

## DOS FATOS

Vem a presença de Vossa Excelência o requerente, por meio de seu advogado que esta subscreve, expor e ao final requerer o que segue:

1. O requerente celebrou contrato de prestação de serviços com a requerida em 01/01/2023;
2. A requerida descumpriu as obrigações contratuais ao não entregar os produtos no prazo acordado;
3. O requerente sofreu prejuízos materiais no montante de R$ 10.000,00 (dez mil reais);
4. Foram realizadas diversas tentativas de resolução amigável, sem sucesso.

## DO DIREITO

Segundo o artigo 927 do Código Civil:

> "Aquele que, por ato ilícito (arts. 186 e 187), causar dano a outrem, fica obrigado a repará-lo."

Ademais, o artigo 389 do mesmo diploma legal estabelece:

> "Não cumprida a obrigação, responde o devedor por perdas e danos, mais juros e atualização monetária segundo índices oficiais regularmente estabelecidos, e honorários de advogado."

## DOS PEDIDOS

Diante do exposto, requer:

a) A citação da requerida para, querendo, contestar o presente feito, sob pena de revelia;
b) A condenação da requerida ao pagamento de R$ 10.000,00 a título de indenização por danos materiais;
c) A condenação da requerida ao pagamento de custas processuais e honorários advocatícios;
d) A produção de todos os meios de prova em direito admitidos;
e) A procedência do pedido.

Dá-se à causa o valor de R$ 10.000,00.

Nestes termos, pede deferimento.

São Paulo, 21 de janeiro de 2026.

**Advogado(a) Fulano de Tal**
**OAB/SP 123.456**`,
  title: 'Petição Inicial - Ação de Cobrança',
  type: 'legal_brief',
  metadata: {
    author: 'Advogado Teste OAB/SP 123.456',
    date: new Date('2026-01-21'),
    type: 'legal_brief'
  }
};

export const sampleJurisprudence = {
  content: `# ACÓRDÃO STJ - REsp 1.234.567/SP

**Tribunal:** Superior Tribunal de Justiça
**Relator:** Min. João Silva
**Órgão Julgador:** 3ª Turma
**Data de Julgamento:** 15/01/2026
**Data de Publicação:** 20/01/2026

## EMENTA

DIREITO CIVIL. RESPONSABILIDADE CIVIL. DANO MORAL. CONFIGURAÇÃO. QUANTUM INDENIZATÓRIO. RAZOABILIDADE.

1. Caracterizada a prática de ato ilícito que cause dano moral, surge o dever de indenizar.
2. O quantum indenizatório deve ser fixado com razoabilidade, observando-se as peculiaridades do caso concreto.
3. Recurso especial conhecido e provido.

## ACÓRDÃO

Vistos, relatados e discutidos os autos em que são partes as acima indicadas, acordam os Ministros da TERCEIRA TURMA do Superior Tribunal de Justiça, na conformidade dos votos e das notas taquigráficas a seguir, por unanimidade, conhecer do recurso especial e dar-lhe provimento, nos termos do voto do Sr. Ministro Relator.

Os Srs. Ministros Maria Santos, Pedro Oliveira e Ana Costa (Presidente) votaram com o Sr. Ministro Relator.`,
  title: 'STJ - REsp 1.234.567/SP',
  type: 'jurisprudence',
  metadata: {
    author: 'STJ - 3ª Turma',
    tribunal: 'Superior Tribunal de Justiça',
    relator: 'Min. João Silva',
    date: new Date('2026-01-20'),
    type: 'jurisprudence'
  }
};

export const sampleAnalysis = {
  content: `# ANÁLISE DE PROCESSO JUDICIAL

## Layer 1: Identificação

- Número do Processo: 1234567-89.2023.8.26.0100
- Tribunal: TJSP - 1ª Vara Cível
- Partes: João Silva vs. Empresa XYZ
- Valor da Causa: R$ 50.000,00

## Layer 2: Histórico Processual

### Petição Inicial (01/03/2023)
Autor ajuizou ação de cobrança contra a ré.

### Contestação (15/04/2023)
Ré apresentou defesa alegando pagamento.

### Réplica (01/05/2023)
Autor refutou argumentos da defesa.

## Layer 3: Análise Jurídica

### Questões de Direito
1. Configuração da obrigação contratual
2. Comprovação do inadimplemento
3. Quantificação dos danos

### Fundamentos Legais
- Código Civil, arts. 389, 395, 927
- CPC, arts. 319, 330, 336

## Layer 4: Prognóstico

**Probabilidade de Êxito:** 75%

**Riscos:**
- Documentação incompleta
- Testemunhas não localizadas

**Oportunidades:**
- Jurisprudência favorável
- Precedente do STJ

## Layer 5: Recomendações

1. Requerer produção de prova documental complementar
2. Arrolar testemunhas tempestivamente
3. Acompanhar intimações com atenção aos prazos`,
  title: 'Análise Completa - Processo 1234567-89.2023.8.26.0100',
  type: 'analysis',
  metadata: {
    author: 'ROM Agent - Análise Automatizada',
    date: new Date('2026-01-21'),
    type: 'analysis',
    processo: '1234567-89.2023.8.26.0100'
  }
};

export const sampleContract = {
  content: `# CONTRATO DE PRESTAÇÃO DE SERVIÇOS

**CONTRATANTE:** João da Silva, CPF 123.456.789-00
**CONTRATADO:** Empresa ABC Ltda, CNPJ 98.765.432/0001-00

## CLÁUSULA PRIMEIRA - DO OBJETO

O presente contrato tem por objeto a prestação de serviços de consultoria empresarial pelo CONTRATADO ao CONTRATANTE.

## CLÁUSULA SEGUNDA - DO PRAZO

O prazo de vigência deste contrato é de 12 (doze) meses, contados a partir de 01/02/2026.

## CLÁUSULA TERCEIRA - DO VALOR E FORMA DE PAGAMENTO

O CONTRATANTE pagará ao CONTRATADO o valor mensal de R$ 5.000,00 (cinco mil reais), mediante depósito bancário até o dia 05 de cada mês.

## CLÁUSULA QUARTA - DAS OBRIGAÇÕES DO CONTRATADO

São obrigações do CONTRATADO:

a) Prestar os serviços com qualidade e pontualidade;
b) Manter sigilo sobre informações confidenciais;
c) Cumprir os prazos estabelecidos.

## CLÁUSULA QUINTA - DAS OBRIGAÇÕES DO CONTRATANTE

São obrigações do CONTRATANTE:

a) Efetuar o pagamento nas datas acordadas;
b) Fornecer as informações necessárias;
c) Colaborar para a execução dos serviços.

## CLÁUSULA SEXTA - DA RESCISÃO

O presente contrato poderá ser rescindido mediante aviso prévio de 30 (trinta) dias.

## CLÁUSULA SÉTIMA - DO FORO

Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer dúvidas oriundas deste contrato.

E, por estarem assim justos e contratados, firmam o presente instrumento em 2 (duas) vias de igual teor.

São Paulo, 21 de janeiro de 2026.

_______________________________
João da Silva
CONTRATANTE

_______________________________
Empresa ABC Ltda
CONTRATADO`,
  title: 'Contrato de Prestação de Serviços',
  type: 'contract',
  metadata: {
    author: 'Departamento Jurídico',
    date: new Date('2026-01-21'),
    type: 'contract'
  }
};

export const sampleGeneric = {
  content: `# Documento Genérico de Teste

Este é um documento genérico usado para testes.

Contém vários parágrafos e formatação simples.

## Seção de Teste

Lista de itens:
- Item 1
- Item 2
- Item 3

Texto normal com **negrito** e *itálico*.`,
  title: 'Documento Genérico',
  type: 'generic',
  metadata: {
    author: 'Sistema de Testes',
    date: new Date('2026-01-21'),
    type: 'generic'
  }
};

/**
 * Helper para obter fixture por tipo
 */
export function getFixture(type) {
  const fixtures = {
    legal_brief: sampleLegalBrief,
    jurisprudence: sampleJurisprudence,
    analysis: sampleAnalysis,
    contract: sampleContract,
    generic: sampleGeneric
  };

  return fixtures[type] || sampleGeneric;
}

/**
 * Retorna todos os fixtures
 */
export function getAllFixtures() {
  return [
    sampleLegalBrief,
    sampleJurisprudence,
    sampleAnalysis,
    sampleContract,
    sampleGeneric
  ];
}
