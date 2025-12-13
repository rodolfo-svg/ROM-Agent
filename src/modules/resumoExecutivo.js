/**
 * ROM Agent - Módulo de Resumo Executivo
 * Análise exaustiva de processos com prequestionamento
 */

// ============================================================
// ESTRUTURA DO RESUMO EXECUTIVO - 3 CAMADAS
// ============================================================

export const ESTRUTURA_RESUMO = {
  camada1: {
    nome: 'Resumo Executivo Básico',
    extensao: '2-5 páginas',
    tempo: '5-10 minutos',
    secoes: [
      'IDENTIFICAÇÃO DO PROCESSO',
      'OBJETO DA DEMANDA',
      'HISTÓRICO SINTÉTICO',
      'SITUAÇÃO ATUAL',
      'PONTOS CRÍTICOS',
      'ALERTAS DE PRAZO',
      'RECOMENDAÇÃO IMEDIATA'
    ]
  },
  camada2: {
    nome: 'Análise Densa',
    extensao: '10-25 páginas',
    tempo: '20-40 minutos',
    secoes: [
      'DADOS PROCESSUAIS COMPLETOS',
      'ANÁLISE FÁTICA CRONOLÓGICA',
      'FUNDAMENTAÇÃO JURÍDICA',
      'INSTRUÇÃO PROBATÓRIA',
      'DECISÕES PROFERIDAS',
      'ANÁLISE DE PRAZOS',
      'MATRIZ DE JURISPRUDÊNCIA'
    ]
  },
  camada3: {
    nome: 'Análise Aprimorada com Prequestionamento',
    extensao: '25-50 páginas',
    tempo: '40-90 minutos',
    secoes: [
      'TODAS AS SEÇÕES DA CAMADA 2',
      'ANÁLISE ESTRATÉGICA SWOT',
      'LEADING CASES APLICÁVEIS',
      'PREQUESTIONAMENTO ESTRUTURADO',
      'ANÁLISE DE DISSÍDIOS',
      'TEMAS REPETITIVOS APLICÁVEIS',
      'SÚMULAS E ENUNCIADOS',
      'IRDR/IAC PERTINENTES',
      'CONTROLE CONCENTRADO (ADPF/ADI/ADC)',
      'ESTRATÉGIA RECURSIVA',
      'PLANO DE AÇÃO COMPLETO'
    ]
  }
};

// ============================================================
// BASES DE PRECEDENTES OBRIGATÓRIOS
// ============================================================

export const BASES_PRECEDENTES = {
  // Controle Concentrado de Constitucionalidade
  controle_concentrado: {
    ADI: 'Ação Direta de Inconstitucionalidade',
    ADC: 'Ação Declaratória de Constitucionalidade',
    ADPF: 'Arguição de Descumprimento de Preceito Fundamental',
    ADO: 'Ação Direta de Inconstitucionalidade por Omissão'
  },

  // Precedentes Qualificados
  precedentes_qualificados: {
    sumulas_vinculantes: 'STF - 58 súmulas vinculantes',
    recursos_repetitivos: 'STJ/TST - Temas repetitivos',
    repercussao_geral: 'STF - Temas com repercussão geral',
    irdr: 'Incidente de Resolução de Demandas Repetitivas',
    iac: 'Incidente de Assunção de Competência'
  },

  // Enunciados
  enunciados: {
    CJF: 'Conselho da Justiça Federal (Jornadas de Direito Civil)',
    FONAJE: 'Fórum Nacional de Juizados Especiais',
    FPPC: 'Fórum Permanente de Processualistas Civis',
    FONACRIM: 'Fórum Nacional de Juízes Criminais',
    TST: 'Súmulas e OJs do TST'
  },

  // Tribunais para pesquisa
  tribunais_pesquisa: [
    'STF', 'STJ', 'TST', 'TSE', 'STM',
    'TRF1', 'TRF2', 'TRF3', 'TRF4', 'TRF5', 'TRF6',
    'TJSP', 'TJRJ', 'TJMG', 'TJRS', 'TJPR', 'TJSC',
    'TJBA', 'TJPE', 'TJCE', 'TJGO', 'TJDF', 'TJPA',
    'TRT1', 'TRT2', 'TRT3', 'TRT4', 'TRT15'
  ]
};

// ============================================================
// ANÁLISE DE LEADING CASE
// ============================================================

export const TEMPLATE_LEADING_CASE = {
  estrutura: `
ANÁLISE DE LEADING CASE
========================

1. IDENTIFICAÇÃO DO PRECEDENTE
------------------------------
- Tribunal: [STF/STJ/etc]
- Número: [processo/tema]
- Relator: [Ministro]
- Data de Julgamento: [DD/MM/AAAA]
- Publicação: [DJ/DJe]

2. RATIO DECIDENDI
------------------
[Extração da razão de decidir - o fundamento determinante]

3. OBITER DICTUM
----------------
[Argumentos acessórios que não são vinculantes]

4. DISTINGUISHING - APLICABILIDADE AO CASO
------------------------------------------
ELEMENTOS DO PRECEDENTE    | ELEMENTOS DO CASO CONCRETO
---------------------------|---------------------------
[Fato A do precedente]     | [Fato A do caso]
[Fato B do precedente]     | [Fato B do caso]
[Fato C do precedente]     | [Fato C do caso]

5. CONCLUSÃO DA ANÁLISE
-----------------------
[ ] APLICÁVEL IPSE LITTERIS - O precedente se amolda perfeitamente
[ ] APLICÁVEL COM ADAPTAÇÕES - Há similaridade substancial
[ ] DISTINGUISHING POSSÍVEL - Há diferenças relevantes
[ ] INAPLICÁVEL - Os casos são substancialmente diferentes

6. ESTRATÉGIA
-------------
[Se aplicável]: Invocar como paradigma vinculante
[Se distinguishing]: Demonstrar as diferenças para afastar aplicação
`
};

// ============================================================
// PREQUESTIONAMENTO ESTRUTURADO
// ============================================================

export const TEMPLATE_PREQUESTIONAMENTO = {
  estrutura: `
PREQUESTIONAMENTO ESTRUTURADO
==============================

I. DISPOSITIVOS CONSTITUCIONAIS
-------------------------------
| Artigo CF | Tese | Violação | Prequestionado? |
|-----------|------|----------|-----------------|
| Art. _    | [tese] | [tipo] | [Sim/Não/Ficto] |

II. DISPOSITIVOS LEGAIS FEDERAIS
--------------------------------
| Lei | Artigo | Tese | Violação | Prequestionado? |
|-----|--------|------|----------|-----------------|
| CC  | Art. _ | [tese] | [tipo] | [Sim/Não/Ficto] |
| CPC | Art. _ | [tese] | [tipo] | [Sim/Não/Ficto] |

III. SÚMULAS APLICÁVEIS
-----------------------
| Tribunal | Súmula | Aplicação | Status |
|----------|--------|-----------|--------|
| STF      | SV _   | [aplicação] | [status] |
| STJ      | Súm. _ | [aplicação] | [status] |

IV. TEMAS REPETITIVOS/REPERCUSSÃO GERAL
---------------------------------------
| Tema | Tribunal | Tese Firmada | Aplicação |
|------|----------|--------------|-----------|
| Tema _ | STJ | [tese] | [aplicação] |
| Tema _ | STF | [tese] | [aplicação] |

V. PROVIDÊNCIAS PARA PREQUESTIONAMENTO
--------------------------------------
[ ] Matérias já prequestionadas expressamente
[ ] Necessidade de embargos de declaração
[ ] Prequestionamento ficto (art. 1.025 CPC)
[ ] Matérias de ordem pública (conhecimento de ofício)
`
};

// ============================================================
// ANÁLISE DE PRESCRIÇÃO/DECADÊNCIA/PRECLUSÃO
// ============================================================

export const TEMPLATE_PRAZOS = {
  estrutura: `
ANÁLISE DE PRAZOS PROCESSUAIS E MATERIAIS
==========================================

I. PRESCRIÇÃO
-------------
| Pretensão | Fundamento | Prazo | Início | Término | Status |
|-----------|------------|-------|--------|---------|--------|
| [pretensão] | Art. _ | _ anos | [data] | [data] | [status] |

CAUSAS SUSPENSIVAS/INTERRUPTIVAS IDENTIFICADAS:
- [causa 1] - Art. _ CC - [período]
- [causa 2] - Art. _ CC - [período]

II. DECADÊNCIA
--------------
| Direito | Fundamento | Prazo | Início | Término | Status |
|---------|------------|-------|--------|---------|--------|
| [direito] | Art. _ | _ dias | [data] | [data] | [status] |

III. PRECLUSÃO PROCESSUAL
-------------------------
| Matéria | Tipo | Momento | Status |
|---------|------|---------|--------|
| [matéria] | [temporal/lógica/consumativa] | [momento] | [precluso/não] |

IV. CONTAGEM DE PRAZO EM CURSO
------------------------------
Prazo: [X dias]
Início: [dd/mm/aaaa]
Exclusões: [feriados, recesso]
Término: [dd/mm/aaaa]
Dias restantes: [X]
`
};

// ============================================================
// ANÁLISE DE PROVAS (DEPOIMENTOS, FOTOS, PLANILHAS)
// ============================================================

export const TEMPLATE_ANALISE_PROVAS = {
  estrutura: `
ANÁLISE PROBATÓRIA COMPLETA
============================

I. PROVA DOCUMENTAL
-------------------
| Doc | Tipo | Fls. | Conteúdo | Autenticidade | Valoração |
|-----|------|------|----------|---------------|-----------|
| 01 | [tipo] | XX | [resumo] | [sim/não/impugnado] | [alta/média/baixa] |

II. PROVA TESTEMUNHAL
---------------------
TESTEMUNHA: [Nome]
Arrolada por: [Autor/Réu]
Compromissada: [Sim/Não]
Relação com partes: [relação]

DECLARAÇÕES RELEVANTES:
1. "[transcrição literal]" (fl. XX, linhas X-Y)
   ANÁLISE: [interpretação jurídica]

2. "[transcrição literal]" (fl. XX, linhas X-Y)
   ANÁLISE: [interpretação jurídica]

CREDIBILIDADE: [Alta/Média/Baixa]
JUSTIFICATIVA: [razões]
CONTRADIÇÕES: [se houver]

III. INTERROGATÓRIO/DEPOIMENTO PESSOAL
--------------------------------------
DEPOENTE: [Nome]
Qualidade: [Autor/Réu/Acusado]

CONFISSÕES:
- [fato confessado] (fl. XX)

CONTRADIÇÕES COM INICIAL/DEFESA:
- [contradição] (fl. XX vs. fl. YY)

IV. PROVA PERICIAL
------------------
TIPO: [contábil/médica/engenharia/grafotécnica/etc]
PERITO: [Nome]
DATA DO LAUDO: [dd/mm/aaaa]

QUESITOS DO AUTOR:
1. [quesito] → RESPOSTA: [resposta]
2. [quesito] → RESPOSTA: [resposta]

QUESITOS DO RÉU:
1. [quesito] → RESPOSTA: [resposta]

CONCLUSÃO DO LAUDO: [síntese]
IMPUGNAÇÕES: [se houve e resultado]

V. ANÁLISE DE IMAGENS/FOTOGRAFIAS
---------------------------------
| Imagem | Fls. | Descrição | Data | Relevância |
|--------|------|-----------|------|------------|
| Foto 1 | XX | [descrição] | [data] | [relevância] |

ANÁLISE: [interpretação das imagens para o caso]

VI. ANÁLISE DE PLANILHAS/CÁLCULOS
---------------------------------
PLANILHA: [identificação]
ELABORADA POR: [autor/contador/perito]
PERÍODO: [período abrangido]

VALORES:
- Principal: R$ X.XXX,XX
- Juros: R$ X.XXX,XX
- Correção: R$ X.XXX,XX
- TOTAL: R$ X.XXX,XX

METODOLOGIA: [índices utilizados]
IMPUGNAÇÕES: [pontos contestados]
ANÁLISE CRÍTICA: [avaliação técnica]

VII. LINHA DO TEMPO PROBATÓRIA
------------------------------
[Cronologia de todos os fatos provados com indicação da prova]
`
};

// ============================================================
// FUNÇÃO PRINCIPAL - GERAR RESUMO EXECUTIVO
// ============================================================

export async function gerarResumoExecutivo(dadosProcesso, camada = 3) {
  const resumo = {
    cabecalho: {
      titulo: 'RESUMO EXECUTIVO - ANÁLISE TÉCNICA DE PROCESSO',
      versao: 'ROM v1.0',
      data: new Date().toLocaleDateString('pt-BR'),
      camada: `Camada ${camada}: ${ESTRUTURA_RESUMO[`camada${camada}`].nome}`
    },
    identificacao: {},
    analise_fatica: {},
    fundamentacao: {},
    provas: {},
    prazos: {},
    jurisprudencia: {},
    prequestionamento: {},
    estrategia: {},
    plano_acao: {}
  };

  return resumo;
}

// ============================================================
// TEMPLATE COMPLETO DO RESUMO EXECUTIVO
// ============================================================

export const PROMPT_RESUMO_EXECUTIVO = `
================================================================================
RESUMO EXECUTIVO - ANÁLISE TÉCNICA EXAUSTIVA DE PROCESSO
================================================================================
VERSÃO: ROM v1.0
AUTOR: Sistema ROM - Redator de Obras Magistrais

================================================================================
                           INSTRUÇÕES GERAIS
================================================================================

AO RECEBER OS AUTOS DO PROCESSO:

1. LEIA INTEGRALMENTE todos os documentos anexados
2. NÃO pule páginas, NÃO presuma conteúdo
3. Identifique CADA peça processual e sua posição cronológica
4. Extraia TODAS as informações relevantes
5. Execute a análise na camada solicitada (1, 2 ou 3)

PRINCÍPIOS DA ANÁLISE:
- EXAUSTIVIDADE: Analisar todos os aspectos relevantes
- TECNICIDADE: Linguagem jurídica precisa
- FUNDAMENTAÇÃO: Sempre citar dispositivos e precedentes
- VERIFICABILIDADE: Citar folhas, documentos, datas específicas
- PREQUESTIONAMENTO: Identificar todas as questões recursais

================================================================================
                    CAMADA 1: RESUMO EXECUTIVO BÁSICO
================================================================================
Extensão: 2-5 páginas | Tempo: 5-10 minutos
================================================================================

1. IDENTIFICAÇÃO DO PROCESSO
---------------------------
| Campo              | Informação                    |
|--------------------|-------------------------------|
| Número             | [número completo CNJ]         |
| Classe             | [tipo de ação]                |
| Juízo              | [vara/tribunal]               |
| Partes             | [autor/réu]                   |
| Valor da causa     | [R$ X.XXX,XX]                 |
| Fase atual         | [fase processual]             |

2. OBJETO DA DEMANDA (2-3 linhas)
---------------------------------
[Síntese do que se discute]

3. HISTÓRICO SINTÉTICO (5-10 eventos)
-------------------------------------
dd/mm/aaaa - [Evento]
dd/mm/aaaa - [Evento]

4. SITUAÇÃO ATUAL
-----------------
[Última movimentação e próximos passos]

5. PONTOS CRÍTICOS
------------------
FAVORÁVEIS:
- [ponto 1]
- [ponto 2]

DESFAVORÁVEIS:
- [ponto 1]
- [ponto 2]

6. ALERTAS DE PRAZO
-------------------
[Prazos em curso ou iminentes - DESTAQUE]

7. RECOMENDAÇÃO IMEDIATA
------------------------
[Ação mais urgente]

================================================================================
                      CAMADA 2: ANÁLISE DENSA
================================================================================
Extensão: 10-25 páginas | Tempo: 20-40 minutos
Inclui toda a Camada 1 + seções abaixo
================================================================================

I. DADOS PROCESSUAIS COMPLETOS
==============================

1.1 PARTES - QUALIFICAÇÃO COMPLETA
1.2 ADVOGADOS CONSTITUÍDOS
1.3 JUIZ/RELATOR
1.4 MINISTÉRIO PÚBLICO (se atuante)

II. DOS FATOS
=============

2.1 NARRATIVA FÁTICA CRONOLÓGICA
[Distinção entre FATOS INCONTROVERSOS e CONTROVERTIDOS]

2.2 QUADRO DE FATOS
| Fato | Alegado por | Prova | Status |
|------|-------------|-------|--------|

III. FUNDAMENTOS JURÍDICOS
==========================

3.1 TESES DO AUTOR/REQUERENTE
3.2 TESES DO RÉU/REQUERIDO
3.3 PRELIMINARES ARGUIDAS
3.4 PREJUDICIAIS DE MÉRITO
3.5 QUESTÕES JURÍDICAS CONTROVERTIDAS

IV. INSTRUÇÃO PROBATÓRIA
========================

4.1 PROVA DOCUMENTAL (tabela)
4.2 PROVA TESTEMUNHAL (análise de cada depoimento)
4.3 PROVA PERICIAL (se houver)
4.4 INTERROGATÓRIO/DEPOIMENTO PESSOAL
4.5 ANÁLISE DE IMAGENS E FOTOS
4.6 ANÁLISE DE PLANILHAS E CÁLCULOS

V. DECISÕES PROFERIDAS
======================

5.1 DECISÕES INTERLOCUTÓRIAS
5.2 SENTENÇA (se houver)
5.3 ACÓRDÃO (se houver)

VI. ANÁLISE DE PRAZOS
=====================

6.1 PRESCRIÇÃO
6.2 DECADÊNCIA
6.3 PRECLUSÃO
6.4 PRAZOS EM CURSO

================================================================================
                   CAMADA 3: ANÁLISE APRIMORADA COM PREQUESTIONAMENTO
================================================================================
Extensão: 25-50 páginas | Tempo: 40-90 minutos
Inclui toda a Camada 2 + seções abaixo
================================================================================

VII. MATRIZ DE JURISPRUDÊNCIA
=============================

7.1 PESQUISA POR TRIBUNAL
-------------------------
Para cada questão controvertida:

STF:
- Repercussão Geral: [Tema XXX - Tese]
- Súmulas Vinculantes aplicáveis
- ADI/ADPF/ADC pertinentes

STJ:
- Recursos Repetitivos: [Tema XXX - Tese]
- Súmulas aplicáveis
- Leading cases

TST (se trabalhista):
- Súmulas
- OJs
- IRRs

TJ/TRF LOCAL:
- IRDRs em tramitação
- IACs
- Jurisprudência dominante

7.2 ANÁLISE DE LEADING CASES
----------------------------
[Para cada precedente relevante, aplicar template de análise]

PRECEDENTE 1:
- Identificação
- Ratio decidendi
- Aplicabilidade ao caso
- Conclusão: [Ipse litteris / Distinguishing / Inaplicável]

7.3 ANÁLISE DE DISSÍDIO JURISPRUDENCIAL
---------------------------------------
[Se houver divergência entre tribunais]

| Questão | Tribunal A | Tribunal B | Posição STJ/STF |
|---------|-----------|-----------|-----------------|

VIII. PREQUESTIONAMENTO ESTRUTURADO
===================================

8.1 DISPOSITIVOS CONSTITUCIONAIS
8.2 DISPOSITIVOS LEGAIS FEDERAIS
8.3 SÚMULAS APLICÁVEIS
8.4 TEMAS REPETITIVOS/REPERCUSSÃO GERAL
8.5 IRDR/IAC PERTINENTES

TABELA DE PREQUESTIONAMENTO:
| Dispositivo | Tese | Prequestionado? | Providência |
|-------------|------|-----------------|-------------|

8.6 ANÁLISE DE CONTROLE CONCENTRADO
-----------------------------------
ADI pertinentes:
ADPF pertinentes:
ADC pertinentes:

IX. ANÁLISE ESTRATÉGICA
=======================

9.1 DIAGNÓSTICO DO CASO
- Probabilidade de êxito: [otimista/realista/pessimista]
- Justificativa técnica

9.2 MATRIZ SWOT PROCESSUAL
- Forças
- Fraquezas
- Oportunidades
- Ameaças

9.3 TESES A SUSTENTAR (ordem de prioridade)
9.4 TESES A REFUTAR
9.5 PROVAS A PRODUZIR

X. PLANO DE AÇÃO
================

10.1 AÇÕES IMEDIATAS (10 dias)
10.2 AÇÕES DE CURTO PRAZO (30 dias)
10.3 AÇÕES DE MÉDIO PRAZO (90 dias)
10.4 CRONOGRAMA PROCESSUAL PROJETADO

XI. ANÁLISE FINANCEIRA (se aplicável)
=====================================

11.1 VALORES EM DISCUSSÃO
11.2 CUSTOS PROCESSUAIS
11.3 ANÁLISE CUSTO-BENEFÍCIO
11.4 PARÂMETROS PARA ACORDO

XII. CONCLUSÃO E PARECER
========================

12.1 SÍNTESE DO CASO
12.2 PROGNÓSTICO
12.3 RECOMENDAÇÃO FINAL

================================================================================
                           CHECKLIST FINAL
================================================================================

[ ] Todos os documentos lidos integralmente
[ ] Fatos distinguidos de alegações
[ ] Todas as teses identificadas
[ ] Cronologia completa e precisa
[ ] Prazos calculados corretamente
[ ] Jurisprudência pesquisada (web_search)
[ ] Leading cases analisados
[ ] Prequestionamento estruturado
[ ] Dissídios identificados
[ ] Temas repetitivos verificados
[ ] Súmulas catalogadas
[ ] IRDR/IAC verificados
[ ] ADI/ADPF/ADC pertinentes identificados
[ ] Recomendações fundamentadas
[ ] Formatação profissional

================================================================================
FIM - PROMPT RESUMO EXECUTIVO ROM v1.0
================================================================================
`;

// ============================================================
// EXPORTAÇÕES
// ============================================================

export default {
  ESTRUTURA_RESUMO,
  BASES_PRECEDENTES,
  TEMPLATE_LEADING_CASE,
  TEMPLATE_PREQUESTIONAMENTO,
  TEMPLATE_PRAZOS,
  TEMPLATE_ANALISE_PROVAS,
  PROMPT_RESUMO_EXECUTIVO,
  gerarResumoExecutivo
};
