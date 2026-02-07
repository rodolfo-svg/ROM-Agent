/**
 * PROMPTS DE ANÁLISE MODULAR
 *
 * 20 tipos de análise para compreensão integral do processo jurídico
 * Cada prompt é otimizado para extrair informações específicas
 */

export const ANALYSIS_PROMPTS = {

  // ═══════════════════════════════════════════════════════════
  // CATEGORIA 1: ANÁLISES BÁSICAS (JÁ EXISTENTES)
  // ═══════════════════════════════════════════════════════════

  FICHAMENTO: {
    name: 'FICHAMENTO',
    extension: '.md',
    priority: 1,
    prompt: `Você é um assistente jurídico especializado em análise processual.

TAREFA: Criar um FICHAMENTO completo do processo.

ESTRUTURA OBRIGATÓRIA:

# FICHAMENTO DO PROCESSO

## IDENTIFICAÇÃO
- **Número do Processo**: [extrair]
- **Classe**: [tipo de ação]
- **Assunto**: [matéria]
- **Distribuição**: [data]
- **Valor da Causa**: [valor]

## PARTES
- **Autor**: [nome completo]
- **Réu**: [nome completo]
- **Advogados**: [listar com OAB]

## SÍNTESE DOS FATOS
[Resumo objetivo da causa de pedir em 5-10 linhas]

## PEDIDOS
1. [Pedido principal]
2. [Pedidos subsidiários]

## FUNDAMENTAÇÃO JURÍDICA
- **Base legal**: [artigos de lei citados]
- **Jurisprudência**: [precedentes citados]

## CONTESTAÇÃO/DEFESA
[Resumo dos argumentos de defesa]

## PROVAS
- Documentais: [lista]
- Testemunhais: [quantidade]
- Periciais: [tipos]

## DECISÕES IMPORTANTES
[Listar decisões interlocutórias, sentença, acórdãos]

## STATUS ATUAL
- **Fase**: [em que fase está]
- **Última movimentação**: [data e descrição]

IMPORTANTE:
- Seja objetivo e técnico
- Use linguagem jurídica apropriada
- Extraia informações APENAS do texto fornecido
- Se algo não estiver claro, indique "[NÃO IDENTIFICADO]"`
  },

  CRONOLOGIA: {
    name: 'CRONOLOGIA',
    extension: '.md',
    priority: 1,
    prompt: `Você é um assistente jurídico especializado em análise processual.

TAREFA: Criar uma CRONOLOGIA completa do processo em ordem temporal.

ESTRUTURA OBRIGATÓRIA:

# CRONOLOGIA DO PROCESSO

## [ANO - Ex: 2023]

### DD/MM/AAAA - [TIPO DO ATO]
**Descrição**: [descrição detalhada]
**Autor do ato**: [quem praticou]
**Consequência**: [efeito processual]

### DD/MM/AAAA - [TIPO DO ATO]
[...]

## [ANO - Ex: 2024]
[...]

IMPORTANTE:
- Extraia TODAS as datas e eventos mencionados
- Ordene cronologicamente (mais antigo primeiro)
- Inclua: petições, despachos, decisões, audiências, recursos, intimações
- Seja específico sobre o tipo de ato
- Indique consequências processuais quando relevantes`
  },

  LINHA_DO_TEMPO: {
    name: 'LINHA_DO_TEMPO',
    extension: '.md',
    priority: 2,
    prompt: `Você é um assistente jurídico especializado em análise processual.

TAREFA: Criar uma LINHA DO TEMPO visual simplificada com marcos principais.

ESTRUTURA OBRIGATÓRIA:

# LINHA DO TEMPO - MARCOS PRINCIPAIS

\`\`\`
[DD/MM/AAAA] 🏛️  DISTRIBUIÇÃO
                |
[DD/MM/AAAA] 📄 CITAÇÃO
                |
[DD/MM/AAAA] 🛡️  CONTESTAÇÃO
                |
[DD/MM/AAAA] 📋 RÉPLICA
                |
[DD/MM/AAAA] ⚖️  SENTENÇA - [resultado]
                |
[DD/MM/AAAA] 📤 RECURSO
                |
[DD/MM/AAAA] ⚖️  ACÓRDÃO - [resultado]
                |
[DD/MM/AAAA] ⏸️  STATUS ATUAL
\`\`\`

## DURAÇÃO POR FASE
- **Fase postulatória**: X dias
- **Fase instrutória**: Y dias
- **Fase decisória**: Z dias
- **Fase recursal**: W dias

## TEMPO TOTAL
- **Duração até o momento**: X anos e Y meses

IMPORTANTE:
- Inclua apenas os marcos mais importantes
- Use emojis para facilitar visualização
- Calcule durações entre fases`
  },

  // ═══════════════════════════════════════════════════════════
  // CATEGORIA 2: IDENTIFICAÇÃO E CONTEXTO (NOVOS)
  // ═══════════════════════════════════════════════════════════

  MAPA_DE_PARTES: {
    name: 'MAPA_DE_PARTES',
    extension: '.md',
    priority: 1,
    prompt: `Você é um assistente jurídico especializado em análise processual.

TAREFA: Criar um MAPA completo de todas as partes e seus representantes.

ESTRUTURA OBRIGATÓRIA:

# MAPA DE PARTES E REPRESENTANTES

## POLO ATIVO
### Autor Principal
- **Nome completo**: [extrair]
- **CPF/CNPJ**: [extrair se disponível]
- **Qualificação**: [nacionalidade, estado civil, profissão, endereço]

### Litisconsortes Ativos
[Se houver - listar cada um com mesmas informações]

### Advogados do Autor
1. **[Nome completo]**
   - OAB: [número/UF]
   - Email: [se disponível]
   - Telefone: [se disponível]

### Assistente Simples/Litisconsorcial
[Se houver]

## POLO PASSIVO
### Réu Principal
- **Nome completo**: [extrair]
- **CPF/CNPJ**: [extrair se disponível]
- **Qualificação**: [dados completos]

### Litisconsortes Passivos
[Se houver]

### Advogados do Réu
[Mesma estrutura do autor]

## TERCEIROS INTERVENIENTES
### Assistente
[Se houver]

### Opoente
[Se houver]

### Denunciado à Lide
[Se houver]

### Chamado ao Processo
[Se houver]

### Amicus Curiae
[Se houver]

## MINISTÉRIO PÚBLICO
- **Atuação**: Fiscal da lei / Parte / Não atua
- **Promotor/Procurador**: [nome se identificado]

## ÓRGÃO JULGADOR
### 1ª Instância
- **Juízo**: [Vara X]
- **Comarca/Seção**: [local]
- **Juiz(a)**: [nome se identificado]

### 2ª Instância
- **Câmara/Turma**: [número]
- **Tribunal**: [sigla]
- **Desembargador Relator**: [nome se identificado]

### Tribunais Superiores
[Se houver STJ/STF]

IMPORTANTE:
- Extraia TODOS os nomes mencionados
- Seja preciso com números de OAB
- Indique "[NÃO IDENTIFICADO]" se não encontrar
- Mantenha formatação consistente`
  },

  RESUMO_EXECUTIVO: {
    name: 'RESUMO_EXECUTIVO',
    extension: '.md',
    priority: 1,
    prompt: `Você é um assistente jurídico especializado em análise processual.

TAREFA: Criar um RESUMO EXECUTIVO completo para briefing rápido.

ESTRUTURA OBRIGATÓRIA:

# RESUMO EXECUTIVO

## ⚖️ ESSÊNCIA DO CASO
[Descrever em 3-5 linhas O QUE É este processo em linguagem clara]

## 🎯 OBJETO DA AÇÃO
- **Tipo de Ação**: [Ex: Ação de Cobrança, Ação Rescisória, etc]
- **Rito**: Comum / Sumário / Especial
- **Competência**: Justiça Comum / Federal / Trabalhista / Eleitoral
- **Natureza**: Cível / Penal / Trabalhista / Tributário
- **Causa de Pedir**: [Resumo dos fatos que motivaram a ação]
- **Pedido Principal**: [O que se busca obter]

## 💰 VALORES EM DISCUSSÃO
- **Valor da Causa**: R$ [valor]
- **Valor da Condenação**: R$ [valor] (se houver)
- **Valores Depositados/Garantidos**: R$ [valor]
- **Custas Processuais**: R$ [valor]
- **Honorários Advocatícios**: R$ [valor ou %]

## 📊 STATUS ATUAL
- **Situação**: Ativo / Arquivado / Suspenso / Em recurso
- **Fase Processual**: [Ex: Aguardando sentença, Em fase recursal, etc]
- **Última Movimentação**: [DD/MM/AAAA] - [descrição breve]
- **Desde**: [tempo decorrido desde última movimentação]

## 🔑 PONTOS CRÍTICOS
1. **[Questão mais importante]**: [descrição em 1-2 linhas]
2. **[Segunda questão relevante]**: [descrição]
3. **[Terceira questão]**: [descrição]

## ⏰ PRAZOS URGENTES
- **[Descrição]**: DD/MM/AAAA (faltam X dias) - [consequência se perder]
- **[Descrição]**: DD/MM/AAAA (faltam Y dias) - [consequência]

## 🏆 AVALIAÇÃO DE ÊXITO
- **Nossa posição**: Autor / Réu / Recorrente / Recorrido
- **Chances de êxito**: Alta / Média / Baixa
- **Fundamento da avaliação**: [Explicar em 2-3 linhas com base nas provas, jurisprudência, qualidade das teses]

## 🎯 ESTRATÉGIA RECOMENDADA
### Próximos Passos
1. [Ação imediata recomendada]
2. [Segunda ação]
3. [Terceira ação]

### Alternativas Processuais
- **Acordo**: Viável / Não viável - [condições]
- **Recursos**: [Cabíveis e chances]
- **Desistência**: Recomendada / Não recomendada - [motivo]

## ⚠️ ALERTAS
[Qualquer informação crítica que requeira atenção imediata]

IMPORTANTE:
- Seja objetivo e direto
- Use linguagem clara mas técnica
- Priorize informações acionáveis
- Este resumo deve permitir compreensão completa em 2-3 minutos de leitura`
  },

  // ═══════════════════════════════════════════════════════════
  // CATEGORIA 3: ANÁLISE JURÍDICA (NOVOS)
  // ═══════════════════════════════════════════════════════════

  TESES_JURIDICAS: {
    name: 'TESES_JURIDICAS',
    extension: '.md',
    priority: 2,
    prompt: `Você é um assistente jurídico especializado em análise processual.

TAREFA: Identificar e analisar todas as TESES JURÍDICAS sustentadas pelas partes.

ESTRUTURA OBRIGATÓRIA:

# TESES JURÍDICAS DO PROCESSO

## TESES DO AUTOR

### Tese Principal
**Descrição**: [Qual a tese central]
**Fundamento Legal**: [Arts. X da Lei Y, Arts. Z do Código W]
**Jurisprudência Citada**:
- [Precedente 1 - STF/STJ/TJ]
- [Precedente 2]
**Doutrina Citada**: [Autores mencionados]
**Argumentação**: [Resumo da linha argumentativa]
**Força da tese**: Alta / Média / Baixa - [justificar]

### Teses Subsidiárias
[Mesma estrutura para cada tese alternativa]

### Teses Implícitas
[Teses que decorrem logicamente mas não foram expressamente alegadas]

## TESES DO RÉU

### Preliminares (Questões Processuais)
1. **[Ex: Incompetência do Juízo]**
   - Fundamento: [base legal]
   - Argumentação: [resumo]
   - Resultado: Acolhida / Rejeitada / Pendente

### Defesa de Mérito Principal
[Mesma estrutura das teses do autor]

### Defesas Subsidiárias
[...]

### Reconvenção
- Existe? Sim / Não
- Se sim: [resumo dos pedidos reconvencionais]

## TERCEIROS / ASSISTENTES
[Se houver intervenção com teses próprias]

## MINISTÉRIO PÚBLICO
[Se manifestou com tese própria]

## CONFRONTO DE TESES
### Tese do Autor vs Tese do Réu
**Questão central**: [O que está em disputa]
**Posição Autor**: [síntese]
**Posição Réu**: [síntese]
**Precedentes favoráveis ao Autor**: [lista]
**Precedentes favoráveis ao Réu**: [lista]

## AVALIAÇÃO TÉCNICA
### Teses Mais Fortes
1. [Tese X da parte Y] - Motivo: [...]
2. [Tese W da parte Z] - Motivo: [...]

### Teses Mais Fracas
1. [Tese A da parte B] - Motivo: [...]

### Precedentes Vinculantes Aplicáveis
- Súmula X do STF/STJ: [texto e aplicabilidade]
- Tema Y de Repercussão Geral: [tese firmada]
- Recurso Repetitivo Z: [tese firmada]

### Lacunas Argumentativas
[O que poderia ter sido alegado mas não foi]

IMPORTANTE:
- Identifique TODAS as teses, mesmo implícitas
- Seja crítico na avaliação
- Cite com precisão os dispositivos legais`
  },

  ANALISE_DE_PROVAS: {
    name: 'ANALISE_DE_PROVAS',
    extension: '.md',
    priority: 2,
    prompt: `Você é um assistente jurídico especializado em análise processual.

TAREFA: Analisar TODO o conjunto probatório do processo.

ESTRUTURA OBRIGATÓRIA:

# ANÁLISE DO CONJUNTO PROBATÓRIO

## PROVAS DOCUMENTAIS

### Produzidas pelo Autor
1. **[Tipo do documento - Ex: Contrato de prestação de serviços]**
   - Descrição: [o que é]
   - Objetivo probatório: [o que visa provar]
   - Força probatória: Alta / Média / Baixa
   - Impugnação: Sim / Não - [motivo se impugnada]
   - Avaliação: [relevância para o caso]

[Listar TODOS os documentos]

### Produzidas pelo Réu
[Mesma estrutura]

### Documentos Juntados de Ofício
[Se houver]

## PROVAS TESTEMUNHAIS

### Testemunhas do Autor
1. **[Nome da testemunha]**
   - Qualificação: [relação com os fatos]
   - Resumo do depoimento: [pontos principais]
   - Credibilidade: Alta / Média / Baixa
   - Contradições: [se houver]
   - Impugnação: [argumentos da parte contrária]
   - Relevância: [impacto para o caso]

### Testemunhas do Réu
[Mesma estrutura]

### Depoimento Pessoal das Partes
[Resumo dos depoimentos do autor e réu]

## PROVAS PERICIAIS

### Perícia [Tipo - Ex: Contábil]
- **Perito nomeado**: [nome]
- **Quesitos formulados**:
  - Autor: [lista dos principais]
  - Réu: [lista dos principais]
- **Conclusão da perícia**: [resumo da conclusão]
- **Valor encontrado**: [se aplicável]
- **Metodologia**: [como foi feita]

### Assistentes Técnicos
- **Assistente do Autor**: [concordou / divergiu] - [pontos de divergência]
- **Assistente do Réu**: [concordou / divergiu] - [pontos de divergência]

### Impugnação à Perícia
- Houve? Sim / Não
- Motivos: [...]
- Resultado: [acolhida / rejeitada]

## PROVAS EMPRESTADAS
[Se houver provas de outros processos]

## INSPEÇÃO JUDICIAL
[Se houve]

## CONFISSÃO
- Houve confissão? Sim / Não
- Parte confitente: [...]
- Fatos confessados: [...]
- Efeitos: [...]

## RECONHECIMENTO JURÍDICO DO PEDIDO
[Se houve]

## PROVAS INDEFERIDAS
1. **[Tipo da prova]**
   - Requerida por: [parte]
   - Motivo do indeferimento: [...]
   - Impacto: [relevância que teria se deferida]

## INVERSÃO DO ÔNUS DA PROVA
- Aplicada? Sim / Não
- Fundamento: [CDC, hipossuficiência, etc]
- Efeitos práticos: [como impactou a distribuição do ônus]

## ÔNUS DA PROVA
### Autor deve provar
1. [Fato X]
2. [Fato Y]

### Réu deve provar
1. [Fato A]
2. [Fato B]

## AVALIAÇÃO DO CONJUNTO PROBATÓRIO

### Suficiência Probatória
- **Tese do Autor**: Suficientemente provada / Parcialmente provada / Não provada
- **Tese do Réu**: Suficientemente provada / Parcialmente provada / Não provada

### Provas Decisivas
[Quais provas são fundamentais para o resultado]

### Lacunas Probatórias
[O que falta provar para cada parte]

### Contradições Probatórias
[Provas conflitantes e como resolver]

### Grau de Certeza
- **Fatos incontroversos**: [lista]
- **Fatos controvertidos mas provados**: [lista]
- **Fatos controvertidos não provados**: [lista]

IMPORTANTE:
- Analise TODAS as provas mencionadas
- Seja crítico sobre qualidade e relevância
- Identifique provas que faltam`
  },

  QUESTOES_JURIDICAS: {
    name: 'QUESTOES_JURIDICAS',
    extension: '.md',
    priority: 2,
    prompt: `Você é um assistente jurídico especializado em análise processual.

TAREFA: Mapear TODAS as questões jurídicas suscitadas no processo.

ESTRUTURA OBRIGATÓRIA:

# QUESTÕES JURÍDICAS SUSCITADAS

## QUESTÕES PRELIMINARES (Art. 337 CPC)

### 1. Inexistência ou Nulidade da Citação
- Suscitada? Sim / Não
- Por quem: [parte]
- Fundamento: [...]
- Decisão: Acolhida / Rejeitada / Pendente
- Consequência: [...]

### 2. Incompetência Absoluta ou Relativa
[Mesma estrutura]

### 3. Incorreção do Valor da Causa
[...]

### 4. Inépcia da Petição Inicial
[...]

### 5. Perempção
[...]

### 6. Litispendência
[...]

### 7. Coisa Julgada
[...]

### 8. Conexão ou Continência
[...]

### 9. Incapacidade da Parte, Defeito de Representação
[...]

### 10. Convenção de Arbitragem
[...]

### 11. Ausência de Legitimidade ou Interesse Processual
[...]

### 12. Falta de Caução ou Outra Prestação
[...]

### 13. Indevida Concessão do Benefício de Gratuidade
[...]

## QUESTÕES DE MÉRITO

### Questão Principal
**Descrição**: [Qual a controvérsia central de mérito]
**Posição do Autor**: [resumo]
**Posição do Réu**: [resumo]
**Norma aplicável**: [lei, artigos]
**Jurisprudência dominante**: [tendência dos tribunais]
**Decisão**: [se já decidida]

### Questões Secundárias
[Lista de outras controvérsias de mérito]

## QUESTÕES INCIDENTAIS

### Exceções
- **Impedimento/Suspeição**: [...]
- **Incompetência relativa**: [...]

### Incidentes
- **Desconsideração da personalidade jurídica**: [...]
- **Assunção de competência**: [...]
- **Resolução de demandas repetitivas**: [...]

## QUESTÕES RECURSAIS

### Prequestionamento
- **Dispositivos invocados**: [Arts. X, Y, Z da Lei W]
- **Prequestionados na sentença**: Sim / Não
- **Prequestionados no acórdão**: Sim / Não
- **Embargos de declaração para prequestionar**: Sim / Não

### Violação Literal de Lei
- **Alegada**: Sim / Não
- **Qual lei**: [dispositivo específico]
- **Como foi violada**: [...]

### Divergência Jurisprudencial
- **Alegada**: Sim / Não
- **Tribunais divergentes**: [...]
- **Paradigmas**: [acórdãos citados]

### Questão Constitucional
- **Existe**: Sim / Não
- **Dispositivo constitucional**: [Art. X da CF]
- **Tipo**: Controle difuso / Controle concentrado

## REPERCUSSÃO GERAL / RECURSOS REPETITIVOS

### Tema Vinculado
- **Existe**: Sim / Não
- **Número do Tema**: [STF-RG XXX ou STJ-REsp XXX]
- **Tese Firmada**: [transcrição da tese]
- **Status**: Julgado / Pendente / Sobrestado
- **Aplicabilidade ao caso**: [análise se a tese se aplica]

### Sobrestamento
- **Processo sobrestado**: Sim / Não
- **Tema aguardado**: [número]
- **Impacto esperado**: [...]

## QUESTÕES PROCESSUAIS RELEVANTES

### Litisconsórcio
- **Tipo**: Necessário / Facultativo / Unitário / Simples
- **Adequadamente formado**: Sim / Não

### Intervenção de Terceiros
- **Tipos ocorridos**: [assistência, denunciação, chamamento, etc]
- **Admitidas**: [quais]

### Estabilização da Tutela
- **Ocorreu**: Sim / Não
- **Efeitos**: [...]

### Julgamento Antecipado
- **Parcial do mérito**: Sim / Não - [o que foi julgado]
- **Total do mérito**: Sim / Não

## QUESTÕES PROBATÓRIAS

### Ônus da Prova
- **Inversão**: Sim / Não
- **Fundamento**: [...]

### Provas Ilícitas
- **Houve alegação**: Sim / Não
- **Provas excluídas**: [...]

## QUESTÕES DE DIREITO INTERTEMPORAL
[Lei aplicável, direito anterior vs novo]

## QUESTÕES AINDA NÃO RESOLVIDAS
[Lista de questões pendentes de decisão]

IMPORTANTE:
- Identifique TODAS as questões processuais e de mérito
- Indique claramente o que foi decidido e o que está pendente
- Seja preciso com citações legais`
  },

  PEDIDOS_E_DECISOES: {
    name: 'PEDIDOS_E_DECISOES',
    extension: '.md',
    priority: 2,
    prompt: `Você é um assistente jurídico especializado em análise processual.

TAREFA: Mapear TODOS os pedidos formulados e decisões proferidas.

ESTRUTURA OBRIGATÓRIA:

# PEDIDOS E DECISÕES

## PEDIDOS NA INICIAL

### Pedido Principal
**Descrição**: [Transcrever ou resumir]
**Valor**: R$ [se aplicável]
**Status**: Deferido / Indeferido / Parcialmente deferido / Pendente
**Decisão**: [DD/MM/AAAA] - [resumo da decisão]
**Fundamentação**: [motivos]

### Pedidos Subsidiários
1. [Pedido alternativo 1]
   - Status: [...]
   - Decisão: [...]

### Pedido Genérico
[Se houver]

### Pedido Implícito
[Ex: juros, correção, honorários - mesmo não pedidos expressamente]

## TUTELAS DE URGÊNCIA

### Tutela Antecipada Antecedente
- **Requerida**: Sim / Não
- **Data**: DD/MM/AAAA
- **Fundamento**: [periculum in mora + fumus boni juris]
- **Deferida**: Sim / Não / Parcialmente
- **Decisão**: [resumo]
- **Cumprida**: Sim / Não
- **Estabilizada**: Sim / Não

### Tutela de Evidência
[Se requerida]

### Tutela Cautelar
[Se requerida]

## PEDIDOS EM CONTESTAÇÃO

### Reconvenção
- **Existe**: Sim / Não
- **Pedidos reconvencionais**: [lista]
- **Status**: [...]

### Pedidos do Réu
[Além da improcedência - ex: condenação do autor em litigância de má-fé]

## INCIDENTES PROCESSUAIS

### Exceção de Pré-Executividade
- **Oposta**: Sim / Não
- **Fundamento**: [...]
- **Resultado**: [...]

### Impugnação ao Cumprimento de Sentença
[...]

### Embargos à Execução
[...]

### Embargos de Terceiro
[...]

## DECISÕES INTERLOCUTÓRIAS

### [Tipo da decisão] - DD/MM/AAAA
**Objeto**: [O que foi decidido]
**Dispositivo**: [Resumo da parte dispositiva]
**Efeito prático**: [Consequência]
**Recurso interposto**: Sim / Não - [Agravo de instrumento]
**Resultado do recurso**: [se julgado]

[Listar TODAS as decisões interlocutórias relevantes]

## SANEAMENTO E ORGANIZAÇÃO DO PROCESSO

### Decisão de Saneamento (Art. 357 CPC)
- **Data**: DD/MM/AAAA
- **Questões de ordem pública**: [apreciadas]
- **Preliminares**: [acolhidas / rejeitadas]
- **Pontos controvertidos**: [lista]
- **Provas deferidas**: [lista]
- **Provas indeferidas**: [lista]
- **Calendário processual**: [se fixado]

## SENTENÇA

### Relatório
[Breve resumo do relatório]

### Fundamentação
**Questões preliminares**: [como decididas]
**Questões de mérito**: [como decididas]
**Base legal**: [artigos aplicados]
**Jurisprudência citada**: [precedentes]

### Dispositivo
**TRANSCRIÇÃO LITERAL**:
[Copiar a parte dispositiva completa]

### Resultado
- **Julgamento**: Procedente / Improcedente / Parcialmente procedente
- **% de procedência**: [se aplicável]

### Condenações
- **Valor principal**: R$ [...]
- **Juros**: [taxa e termo inicial]
- **Correção monetária**: [índice e termo inicial]
- **Honorários advocatícios**: [valor ou %]
  - Base de cálculo: [...]
  - Percentual: [...]
- **Custas processuais**: [parte responsável]

## RECURSOS

### [Tipo do recurso - Ex: Apelação]
- **Interposto por**: [parte]
- **Data**: DD/MM/AAAA
- **Pedido recursal**: [o que busca]
- **Efeito**: Devolutivo / Suspensivo
- **Contrarrazões**: Apresentadas em DD/MM/AAAA
- **Resultado**: Provido / Não provido / Parcialmente provido / Pendente
- **Acórdão**: [resumo se julgado]

### Embargos de Declaração
- **Opostos por**: [parte]
- **Vícios alegados**: Omissão / Contradição / Obscuridade
- **Resultado**: Acolhidos / Rejeitados / Parcialmente acolhidos
- **Efeitos**: Infringentes / Apenas aclaratórios

## ACÓRDÃO

### [Tribunal - Ex: TJSP, STJ]
- **Número**: [...]
- **Relator**: [nome]
- **Data**: DD/MM/AAAA
- **Resultado**: [...]
- **Tese do acórdão**: [...]
- **Dispositivo**: [transcrição]
- **Voto vencido**: [se houver]

## DECISÕES EM CUMPRIMENTO DE SENTENÇA

### Liquidação
- **Tipo**: Por cálculos / Por arbitramento / Por artigos
- **Valor liquidado**: R$ [...]
- **Impugnação**: Sim / Não

### Execução
- **Penhora**: [bens penhorados]
- **Avaliação**: [valor]
- **Expropriação**: [leilão, adjudicação]

## DECISÕES DE EXTINÇÃO

### Extinção COM resolução de mérito (Art. 487 CPC)
- **Inciso**: [I, II, III...]
- **Fundamento**: [...]

### Extinção SEM resolução de mérito (Art. 485 CPC)
- **Inciso**: [...]
- **Fundamento**: [...]

## MAPA DE PEDIDOS X DECISÕES

| Pedido | Status | Data Decisão | Resultado |
|--------|--------|--------------|-----------|
| [Pedido 1] | Deferido | DD/MM/AAAA | [Valor/Resultado] |
| [Pedido 2] | Indeferido | DD/MM/AAAA | [Motivo] |
| [...] | [...] | [...] | [...] |

IMPORTANTE:
- Liste TODOS os pedidos e decisões
- Transcreva partes dispositivas literalmente
- Seja preciso com valores e datas`
  },

  // ═══════════════════════════════════════════════════════════
  // CATEGORIA 4: CONTROLE E GESTÃO (NOVOS)
  // ═══════════════════════════════════════════════════════════

  RECURSOS_INTERPOSTOS: {
    name: 'RECURSOS_INTERPOSTOS',
    extension: '.md',
    priority: 3,
    prompt: `Você é um assistente jurídico especializado em análise processual.

TAREFA: Mapear histórico completo de TODOS os recursos interpostos.

ESTRUTURA OBRIGATÓRIA:

# HISTÓRICO DE RECURSOS

## APELAÇÃO

### Apelação [nº identificação]
- **Apelante**: [parte]
- **Apelado**: [parte]
- **Data de interposição**: DD/MM/AAAA
- **Decisão recorrida**: [sentença de DD/MM/AAAA]
- **Valor da condenação**: R$ [...]

#### Razões de Apelação
**Síntese das teses recursais**:
1. [Tese 1]
2. [Tese 2]
3. [Tese 3]

#### Contrarrazões
- **Apresentadas em**: DD/MM/AAAA
- **Argumentos principais**: [resumo]

#### Juízo de Admissibilidade
- **Resultado**: Admitido / Não admitido / Parcialmente admitido
- **Fundamento**: [...]

#### Julgamento
- **Relator**: [nome]
- **Data do julgamento**: DD/MM/AAAA
- **Resultado**: Provido / Não provido / Parcialmente provido
- **Votação**: Unânime / Maioria (X votos a Y)
- **Acórdão**: [resumo]
- **Tese vencedora**: [...]

## AGRAVO DE INSTRUMENTO

[Mesma estrutura para cada agravo]

### Agravo [contra decisão de...]
[...]

## AGRAVO INTERNO (REGIMENTAL)

[...]

## EMBARGOS DE DECLARAÇÃO

### Embargos Declaratórios [identificação]
- **Embargante**: [parte]
- **Data**: DD/MM/AAAA
- **Decisão embargada**: [...]
- **Vícios alegados**:
  - [ ] Omissão
  - [ ] Contradição
  - [ ] Obscuridade
  - [ ] Erro material

#### Pontos Omissos Alegados
1. [Questão 1 não apreciada]
2. [Questão 2 não apreciada]

#### Prequestionamento
- **Dispositivos legais invocados**: [Arts. X, Y, Z]
- **Objetivo**: Prequestionar para REsp/RE

#### Resultado
- **Acolhidos**: Sim / Não / Parcialmente
- **Efeitos**: Infringentes / Meramente aclaratórios
- **Alteração no julgado**: [o que mudou]

## RECURSO ESPECIAL (STJ)

### REsp [número]
- **Recorrente**: [parte]
- **Data**: DD/MM/AAAA
- **Acórdão recorrido**: [...]

#### Fundamentos (Art. 105, III, CF)
- [ ] Alínea 'a' - Ofensa a lei federal
  - **Lei violada**: [dispositivo]
  - **Como foi violada**: [...]
- [ ] Alínea 'c' - Divergência jurisprudencial
  - **Paradigmas**: [acórdãos]

#### Juízo de Admissibilidade
- **Origem**: Admitido / Não admitido
- **STJ**: Admitido / Não admitido / Pendente

#### Julgamento
[Se julgado]

## RECURSO EXTRAORDINÁRIO (STF)

[Mesma estrutura]

#### Fundamentos (Art. 102, III, CF)
- [ ] Alínea 'a' - Ofensa direta à Constituição
- [ ] Alínea 'b' - Inconstitucionalidade de tratado/lei federal
- [ ] Alínea 'c' - Validade de lei local vs lei federal
- [ ] Alínea 'd' - Validade de lei local vs Constituição

#### Repercussão Geral
- **Reconhecida**: Sim / Não / Pendente
- **Tema vinculado**: [se houver]

## EMBARGOS INFRINGENTES

[Se cabível - casos específicos]

## AGRAVO EM RECURSO ESPECIAL/EXTRAORDINÁRIO

[...]

## RECLAMAÇÃO

[Se houver]

## MAPA DE SUCESSO RECURSAL

### Estatísticas
- **Total de recursos interpostos**: X
- **Por nossa parte**: Y
- **Pela parte contrária**: Z

### Taxa de Êxito
| Tipo de Recurso | Total | Providos | Parciais | Não Providos | Taxa Êxito |
|-----------------|-------|----------|----------|--------------|------------|
| Apelação | X | Y | Z | W | Y+Z/X % |
| Agravo | A | B | C | D | B+C/A % |
| ED | E | F | G | H | F+G/E % |
| **TOTAL** | **T** | **T1** | **T2** | **T3** | **%** |

### Análise
- **Recursos mais exitosos**: [tipo]
- **Principais motivos de êxito**: [...]
- **Principais motivos de insucesso**: [...]

## RECURSOS PENDENTES

| Recurso | Tribunal | Relator | Desde | Status |
|---------|----------|---------|-------|--------|
| [Tipo] | [Sigla] | [Nome] | DD/MM/AAAA | [Aguardando...] |

IMPORTANTE:
- Mapeie TODOS os recursos, inclusive os inadmitidos
- Seja preciso com datas e resultados
- Analise padrões de sucesso/insucesso`
  },

  PRAZOS_E_INTIMACOES: {
    name: 'PRAZOS_E_INTIMACOES',
    extension: '.md',
    priority: 1,
    prompt: `Você é um assistente jurídico especializado em análise processual.

TAREFA: Controlar TODOS os prazos e intimações do processo.

ESTRUTURA OBRIGATÓRIA:

# CONTROLE DE PRAZOS E INTIMAÇÕES

## ⚠️ INTIMAÇÕES PENDENTES (URGENTE)

### [Descrição do ato]
- **Prazo final**: DD/MM/AAAA
- **Tempo restante**: X dias
- **Urgência**: 🔴 Alta / 🟡 Média / 🟢 Baixa
- **Ação necessária**: [O que precisa ser feito]
- **Responsável**: [quem deve praticar o ato]
- **Consequência se perder prazo**: [Precllusão, arquivamento, etc]

[Listar TODAS as intimações com prazo em aberto]

## HISTÓRICO DE INTIMAÇÕES

### [ANO]

#### DD/MM/AAAA - [Tipo de intimação]
- **Objeto**: [Para fazer o quê]
- **Prazo**: X dias
- **Prazo final**: DD/MM/AAAA
- **Cumprida em**: DD/MM/AAAA
- **Status**: ✅ No prazo / ⚠️ Prorrogado / ❌ Intempestiva
- **Petição protocolada**: [número/tipo]

[Listar TODAS as intimações do histórico]

## PRAZOS PROCESSUAIS RELEVANTES

### Prazos Prescricionais
- **Prescrição**: DD/MM/AAAA
- **Fundamento**: [Art. X do CC/CDC/etc]
- **Status**: Interrompida / Suspensa / Fluindo
- **Causa da interrupção**: [se aplicável]

### Prazos Decadenciais
- **Decadência**: DD/MM/AAAA (se aplicável)
- **Fundamento**: [...]

### Prazos de Suspensão
1. **Suspensão por [motivo]**
   - Período: DD/MM/AAAA a DD/MM/AAAA
   - Duração: X dias
   - Fundamento: [férias forenses, sobrestamento, etc]

## PRAZOS RECURSAIS

| Decisão | Data | Prazo Recurso | Prazo Final | Interposto | Tempestivo |
|---------|------|---------------|-------------|------------|------------|
| Sentença | DD/MM/AAAA | 15 dias | DD/MM/AAAA | Sim | ✅ Sim |
| Decisão X | DD/MM/AAAA | 15 dias | DD/MM/AAAA | Não | - |

## PRECLUSÕES OCORRIDAS

### Preclusão Temporal
1. **[Descrição]**
   - Data: DD/MM/AAAA
   - Ato não praticado: [...]
   - Consequência: [não pode mais alegar X, pedir Y, etc]

### Preclusão Lógica
[Se houver atos incompatíveis praticados]

### Preclusão Consumativa
[Se houver ato já praticado que não pode ser repetido]

## PRAZOS ESPECIAIS

### Prazo para Pagamento Voluntário (Art. 523 CPC)
- **Prazo**: 15 dias da intimação
- **Intimação em**: DD/MM/AAAA
- **Prazo final**: DD/MM/AAAA
- **Pago**: Sim / Não / Parcialmente

### Prazo para Impugnação (Art. 525 CPC)
- **Prazo**: 15 dias
- **Prazo final**: DD/MM/AAAA
- **Apresentada**: Sim / Não

## CALENDÁRIO PROCESSUAL

### Próximos 30 dias
| Data | Evento | Urgência |
|------|--------|----------|
| DD/MM | [Prazo para X] | 🔴 |
| DD/MM | [Audiência Y] | 🟡 |
| DD/MM | [Intimação Z] | 🟢 |

### Próximos 90 dias
[...]

## AUDIÊNCIAS DESIGNADAS

### Audiência de [Tipo]
- **Data**: DD/MM/AAAA às HH:MM
- **Local**: [sala, endereço, videoconferência]
- **Objeto**: [Conciliação, Instrução, Julgamento]
- **Intimação**: Autor em DD/MM | Réu em DD/MM
- **Comparecimento**: Obrigatório / Facultativo
- **Preparo**: [testemunhas, documentos necessários]
- **Realizada**: Sim / Não / Adiada
- **Resultado**: [se realizada]

## INTIMAÇÕES POR MEIO ELETRÔNICO

### Configuração
- **Email cadastrado**: [email]
- **Sistema**: e-SAJ / PJe / Projudi / Outro
- **Último acesso**: DD/MM/AAAA

### Histórico de Acessos
[Datas de acesso aos autos eletrônicos]

## ALERTAS E RECOMENDAÇÕES

### Prazos em Risco
- **[Prazo X]**: Vence em Y dias - Ação ainda não tomada
- **[Prazo Z]**: Vence em W dias - Preparar documentos

### Prazos Futuros Importantes
[Projeção de prazos que surgirão após eventos esperados]

IMPORTANTE:
- Destaque prazos urgentes no topo
- Use cores/emojis para urgência
- Seja preciso com datas e cálculos
- Considere feriados e suspensões`
  },

  CUSTAS_E_VALORES: {
    name: 'CUSTAS_E_VALORES',
    extension: '.md',
    priority: 3,
    prompt: `Você é um assistente jurídico especializado em análise processual.

TAREFA: Mapear histórico financeiro completo do processo.

ESTRUTURA OBRIGATÓRIA:

# HISTÓRICO FINANCEIRO DO PROCESSO

## VALOR DA CAUSA

### Valor Inicial
- **Valor**: R$ [valor por extenso]
- **Data**: DD/MM/AAAA (distribuição)
- **Fundamentação**: [como foi calculado]

### Retificações
1. **DD/MM/AAAA**: R$ [valor] → R$ [novo valor]
   - Motivo: [correção de ofício, impugnação acolhida, etc]
   - Diferença: R$ [valor] ([+/-]X%)

### Valor Atual da Causa
**R$ [valor atualizado]**

## CONDENAÇÕES

### Valor Principal
- **Condenação**: R$ [valor]
- **Parte condenada**: [nome]
- **Favorecido**: [nome]
- **Data da condenação**: DD/MM/AAAA

### Juros
- **Taxa**: [% ao mês/ano]
- **Termo inicial**: [data ou evento]
- **Fundamentação**: [legal]

### Correção Monetária
- **Índice**: IPCA / INPC / IGP-M / TR / Outro
- **Termo inicial**: [data ou evento]
- **Fundamentação**: [legal]

### Cálculo Atualizado (se disponível)
**Valor atualizado até DD/MM/AAAA**: R$ [...]
- Principal: R$ [...]
- Juros: R$ [...]
- Correção: R$ [...]

## CUSTAS PROCESSUAIS

### Custas Iniciais
- **Recolhidas por**: [parte]
- **Valor**: R$ [...]
- **Data**: DD/MM/AAAA
- **Guia**: [número]
- **Isenção**: Sim / Não - [fundamento se isento]

### Preparo Recursal
1. **[Tipo do recurso]**
   - Recorrente: [parte]
   - Valor do preparo: R$ [...]
   - Porte de remessa e retorno: R$ [...]
   - **Total**: R$ [...]
   - Data: DD/MM/AAAA
   - Comprovante: [protocolo]
   - **Adequado**: ✅ Sim / ❌ Não / ⚠️ Insuficiente

### Custas Finais
- **Responsável**: [parte condenada em custas]
- **Valor**: R$ [...]
- **Status**: Pago / Pendente / Executado

## HONORÁRIOS ADVOCATÍCIOS

### Honorários Sucumbenciais
- **Parte condenada**: [nome]
- **Favorecido**: [advogado(s) da parte vencedora]
- **Base de cálculo**: R$ [valor da condenação / causa / proveito econômico]
- **Percentual**: [X%]
- **Valor**: R$ [...]
- **Fundamentação**: [Art. 85 do CPC + critérios do §2º]

### Majoração/Redução em Recurso
- **Recurso**: [tipo]
- **Percentual anterior**: X%
- **Percentual majorado**: Y%
- **Motivo**: [não provimento, sucumbência recursal]
- **Valor adicional**: R$ [...]

### Honorários Contratuais
[Se mencionados ou relevantes]
- **Valor**: R$ [...]
- **Cláusula**: [quota litis, honorários fixos]

### Honorários de Perito
- **Valor arbitrado**: R$ [...]
- **Responsável pelo pagamento**: [parte / rateio]
- **Pago**: Sim / Não
- **Antecipação**: R$ [se houve]

## DEPÓSITOS JUDICIAIS

### Depósito Recursal
1. **[Recurso X]**
   - Data: DD/MM/AAAA
   - Valor: R$ [...]
   - Conta judicial: [número]
   - Finalidade: [garantir o juízo, requisito admissibilidade]
   - Status: Mantido / Levantado / Convertido

### Depósito em Garantia
- Data: DD/MM/AAAA
- Valor: R$ [...]
- Finalidade: [...]

### Depósito de Valor Incontroverso
[Se houver]

## PENHORAS E BLOQUEIOS

### Bacenjud
1. **Ordem [número]**
   - Data: DD/MM/AAAA
   - Valor bloqueado: R$ [...]
   - Banco: [instituição]
   - Status: Bloqueado / Convertido / Liberado / Indisponível

### Renajud
1. **Veículo [placa]**
   - Data: DD/MM/AAAA
   - Valor estimado: R$ [...]
   - Status: Bloqueado / Leiloado / Liberado

### Penhora de Imóveis
1. **Imóvel [descrição/matrícula]**
   - Data: DD/MM/AAAA
   - Valor venal: R$ [...]
   - Valor avaliado: R$ [...]
   - Averbação: Sim / Não
   - Status: Penhorado / Leiloado / Adjudicado / Liberado

### Penhora de Salário/Rendimentos
- Percentual: [X%]
- Valor mensal: R$ [...]
- Prazo: [X parcelas]

## VALORES LEVANTADOS

### Levantamento [número]
- **Data**: DD/MM/AAAA
- **Beneficiário**: [parte]
- **Valor**: R$ [...]
- **Origem**: [depósito judicial, penhora, etc]
- **Alvará**: [número]

## EXPROPRIAÇÃO

### Leilão
- **Data**: DD/MM/AAAA (1º leilão) / DD/MM/AAAA (2º leilão)
- **Bem**: [descrição]
- **Valor de avaliação**: R$ [...]
- **Lance mínimo**: R$ [X% do valor]
- **Arrematante**: [nome]
- **Valor arrematado**: R$ [...]

### Adjudicação
- **Data**: DD/MM/AAAA
- **Adjudicante**: [parte]
- **Bem**: [descrição]
- **Valor**: R$ [...]

## BALANÇO FINANCEIRO

### Custos do Processo
| Item | Valor |
|------|-------|
| Custas iniciais | R$ [...] |
| Preparo(s) | R$ [...] |
| Perícia | R$ [...] |
| Outros | R$ [...] |
| **TOTAL CUSTOS** | **R$ [...]** |

### Valores a Receber/Pagar
| Parte | A Receber | A Pagar | Saldo |
|-------|-----------|---------|-------|
| Autor | R$ [...] | R$ [...] | R$ [+/-...] |
| Réu | R$ [...] | R$ [...] | R$ [+/-...] |

### Execução Financeira
- **Valor exequendo**: R$ [...]
- **Valores penhorados**: R$ [...]
- **Valores levantados**: R$ [...]
- **Saldo pendente**: R$ [...]
- **% executado**: [X%]

## GRATUIDADE DA JUSTIÇA

### Autor
- **Concedida**: Sim / Não / Parcial
- **Fundamentação**: [hipossuficiência, declaração]
- **Impugnação**: Sim / Não
- **Resultado da impugnação**: [...]

### Réu
[Mesma estrutura]

IMPORTANTE:
- Seja preciso com valores e datas
- Atualize valores quando possível
- Indique status de cada valor (pago/pendente)`
  },

  // ═══════════════════════════════════════════════════════════
  // CATEGORIA 5: CONTEXTO E INTELIGÊNCIA (NOVOS)
  // ═══════════════════════════════════════════════════════════

  JURISPRUDENCIA_CITADA: {
    name: 'JURISPRUDENCIA_CITADA',
    extension: '.md',
    priority: 3,
    prompt: `Você é um assistente jurídico especializado em análise processual.

TAREFA: Mapear TODA a jurisprudência citada no processo.

ESTRUTURA OBRIGATÓRIA:

# JURISPRUDÊNCIA CITADA NO PROCESSO

## CITADA PELO AUTOR

### [Tribunal] - [Tipo] [Número]
**Exemplo: STJ - REsp 1.234.567/SP**

- **Relator**: Min./Des. [Nome]
- **Julgamento**: DD/MM/AAAA
- **Turma/Câmara**: [identificação]
- **Tese/Ementa**: [Resumo da tese firmada]
- **Aplicabilidade ao caso**:
  - Similaridade: Alta / Média / Baixa
  - Pontos em comum: [...]
  - Pontos divergentes: [...]
- **Resultado para nossa tese**: Favorável / Desfavorável / Neutro

[Listar TODOS os precedentes citados pelo autor]

## CITADA PELO RÉU

[Mesma estrutura]

## CITADA PELO JUÍZO/TRIBUNAL

### Na Sentença
[Precedentes que fundamentaram a sentença]

### No Acórdão
[Precedentes que fundamentaram o acórdão]

## PRECEDENTES VINCULANTES APLICÁVEIS

### Súmulas do STF
- **Súmula [número]**: [texto completo]
  - Vinculante: Sim / Não
  - Aplicável ao caso: Sim / Não / Parcialmente
  - Como se aplica: [...]

### Súmulas do STJ
[Mesma estrutura]

### Temas de Repercussão Geral (STF)
- **Tema [número]**: [descrição]
  - Leading case: [RE número]
  - Tese firmada: [transcrição literal]
  - Status: Julgado / Pendente
  - Aplicabilidade: [análise]

### Recursos Repetitivos (STJ)
- **Tema [número]**: [descrição]
  - Leading case: [REsp número]
  - Tese firmada: [transcrição literal]
  - Status: Julgado / Pendente
  - Aplicabilidade: [análise]

## SÚMULAS DE TRIBUNAIS LOCAIS

### [Tribunal - Ex: TJSP]
- **Súmula [número]**: [texto]
  - Aplicável: Sim / Não

## INCIDENTE DE ASSUNÇÃO DE COMPETÊNCIA

[Se houver tema afetado]

## INCIDENTE DE RESOLUÇÃO DE DEMANDAS REPETITIVAS (IRDR)

[Se houver]

## ANÁLISE COMPARATIVA

### Precedentes Mais Favoráveis
1. **[Identificação do acórdão]**
   - Tribunal: [...]
   - Por que favorece: [...]
   - Peso: [relevância hierárquica]

### Precedentes Mais Desfavoráveis
[Mesma estrutura]

### Divergência Jurisprudencial Identificada
- **Questão divergente**: [...]
- **Posição A**: [tribunais/tese]
- **Posição B**: [tribunais/tese]
- **Tendência majoritária**: [...]

## EVOLUÇÃO JURISPRUDENCIAL

[Se houver mudança de entendimento ao longo do tempo]
- **Entendimento anterior**: [...]
- **Entendimento atual**: [...]
- **Leading case da mudança**: [...]

## BUSCA DE PRECEDENTES ADICIONAIS RECOMENDADA

### Palavras-chave sugeridas
- [Termo 1]
- [Termo 2]
- [Termo 3]

### Tribunais prioritários
- [STF/STJ/TJ...]

IMPORTANTE:
- Cite com precisão (número, relator, data)
- Transcreva teses literalmente quando vinculantes
- Analise aplicabilidade ao caso concreto`
  },

  HISTORICO_PROCESSUAL: {
    name: 'HISTORICO_PROCESSUAL',
    extension: '.md',
    priority: 3,
    prompt: `Você é um assistente jurídico especializado em análise processual.

TAREFA: Criar histórico COMPLETO de TODOS os atos processuais.

ESTRUTURA OBRIGATÓRIA:

# HISTÓRICO COMPLETO DO ANDAMENTO PROCESSUAL

## DISTRIBUIÇÃO E AUTUAÇÃO
- **Data de distribuição**: DD/MM/AAAA
- **Número do processo**: [número completo]
- **Sistema**: Físico / Eletrônico
- **Distribuição**: Livre / Dependente / Prevento
- **Classe**: [código e descrição]
- **Assunto**: [código e descrição]

## FASE POSTULATÓRIA

### DD/MM/AAAA - Petição Inicial
- Autor: [nome]
- Advogado: [nome - OAB]
- Valor da causa: R$ [...]
- Documentos: [quantidade]

### DD/MM/AAAA - Despacho Inicial
- Juiz: [nome]
- Determinações: [...]

### DD/MM/AAAA - Emenda à Inicial
[Se houver]

### DD/MM/AAAA - Decisão sobre Tutela de Urgência
[Se requerida]

### DD/MM/AAAA - Determinação de Citação
- Forma: Correios / Oficial / Edital / Eletrônica

### DD/MM/AAAA - Mandado Expedido
- Oficial: [nome]

### DD/MM/AAAA - Citação Efetivada
- Forma: [pessoal, com hora certa, por edital]

### DD/MM/AAAA - Contestação
- Réu: [nome]
- Advogado: [nome - OAB]
- Documentos: [quantidade]
- Reconvenção: Sim / Não

### DD/MM/AAAA - Réplica
[Se apresentada]

## FASE SANEADORA

### DD/MM/AAAA - Especificação de Provas
- Autor requereu: [...]
- Réu requereu: [...]

### DD/MM/AAAA - Decisão de Saneamento
- Preliminares: [resultado]
- Pontos controvertidos: [...]
- Provas deferidas: [...]
- Provas indeferidas: [...]

## FASE INSTRUTÓRIA

### DD/MM/AAAA - Nomeação de Perito
- Perito: [nome]
- Honorários: R$ [...]

### DD/MM/AAAA - Apresentação de Quesitos
[...]

### DD/MM/AAAA - Laudo Pericial
[...]

### DD/MM/AAAA - Audiência de Instrução
- Horário: HH:MM
- Testemunhas ouvidas: [quantidade]
- Depoimentos pessoais: [partes]
- Gravação: [link/código se digital]

### DD/MM/AAAA - Alegações Finais (Autor)
[...]

### DD/MM/AAAA - Alegações Finais (Réu)
[...]

## FASE DECISÓRIA

### DD/MM/AAAA - Sentença
- Juiz: [nome]
- Tipo: Procedente / Improcedente / Parcialmente procedente
- Condenação: R$ [...]
- Honorários: R$ [...]

### DD/MM/AAAA - Intimação da Sentença
- Autor: DD/MM/AAAA
- Réu: DD/MM/AAAA

### DD/MM/AAAA - Trânsito em Julgado
[Se não houve recurso]

## FASE RECURSAL

### DD/MM/AAAA - Apelação
- Apelante: [parte]
- Apelado: [parte]

### DD/MM/AAAA - Contrarrazões
[...]

### DD/MM/AAAA - Juízo de Admissibilidade
- Resultado: [...]

### DD/MM/AAAA - Remessa ao Tribunal
- Tribunal: [sigla]

### DD/MM/AAAA - Distribuição no Tribunal
- Relator: [nome]
- Câmara: [número]

### DD/MM/AAAA - Sessão de Julgamento
- Data: DD/MM/AAAA
- Resultado: [...]
- Votação: [...]

### DD/MM/AAAA - Acórdão Publicado
[...]

### DD/MM/AAAA - Trânsito em Julgado
[Data definitiva]

## FASE DE CUMPRIMENTO DE SENTENÇA

### DD/MM/AAAA - Requerimento de Cumprimento
- Exequente: [nome]
- Valor: R$ [...]

### DD/MM/AAAA - Intimação para Pagamento Voluntário
- Prazo: 15 dias

### DD/MM/AAAA - Penhora Online (Bacenjud)
- Valor bloqueado: R$ [...]

### DD/MM/AAAA - Conversão de Bloqueio em Penhora
[...]

### DD/MM/AAAA - Levantamento de Valores
- Beneficiário: [parte]
- Valor: R$ [...]

### DD/MM/AAAA - Expedição de Alvará
[...]

### DD/MM/AAAA - Extinção da Execução
- Fundamento: [satisfação, pagamento, etc]

## SUSPENSÕES E SOBRESTAMENTOS

### DD/MM/AAAA a DD/MM/AAAA - Suspenso
- Motivo: [férias, aguardar tema repetitivo, acordo]
- Duração: X dias

## MOVIMENTAÇÕES DIVERSAS

### DD/MM/AAAA - [Tipo do ato]
[Descrição]

[Listar TODOS os atos não categorizados acima]

## CONCLUSÕES PARA DECISÃO

[Datas em que autos foram conclusos ao juiz]

## ESTATÍSTICAS DO PROCESSO

### Duração
- **Total**: X anos, Y meses, Z dias
- **Fase postulatória**: [duração]
- **Fase instrutória**: [duração]
- **Fase decisória**: [duração]
- **Fase recursal**: [duração]

### Quantidade de Atos
- **Petições**: X
- **Decisões**: Y
- **Despachos**: Z
- **Audiências**: W

IMPORTANTE:
- Liste TODOS os atos cronologicamente
- Seja preciso com datas
- Inclua até atos administrativos menores`
  },

  MANIFESTACOES_POR_PARTE: {
    name: 'MANIFESTACOES_POR_PARTE',
    extension: '.md',
    priority: 3,
    prompt: `Você é um assistente jurídico especializado em análise processual.

TAREFA: Organizar TODAS as manifestações por parte/sujeito processual.

ESTRUTURA OBRIGATÓRIA:

# TODAS AS MANIFESTAÇÕES ORGANIZADAS POR PARTE

## AUTOR

### Petição Inicial (DD/MM/AAAA)

#### Qualificação
[Dados completos do autor]

#### Causa de Pedir
**Fatos**: [Resumo dos fatos alegados]
**Fundamento jurídico**: [Base legal invocada]

#### Pedidos
1. [Pedido principal]
2. [Pedido subsidiário]
[...]

#### Provas Requeridas
- Documental: [lista]
- Testemunhal: [quantidade]
- Pericial: [tipo]
- Outras: [...]

#### Valor da Causa
R$ [valor] - Fundamentação: [...]

---

### Réplica (DD/MM/AAAA)
**Objeto**: Contrarrazões à contestação

#### Preliminares Refutadas
[Resposta a cada preliminar]

#### Mérito Reforçado
[Reforço aos argumentos iniciais]

#### Documentos Juntados
[Se houver novos documentos]

---

### Especificação de Provas (DD/MM/AAAA)
[Provas requeridas após contestação]

---

### Alegações Finais (DD/MM/AAAA)
[Resumo final dos argumentos]

---

### Apelação (DD/MM/AAAA)
[Se foi apelante]

#### Razões Recursais
1. [Tese 1]
2. [Tese 2]

#### Pedido Recursal
[O que busca]

---

### Outras Petições
[Listar TODAS as outras manifestações em ordem cronológica]
- DD/MM/AAAA - [Tipo]: [Resumo]

---

## RÉU

### Contestação (DD/MM/AAAA)

#### Preliminares
1. [Preliminar 1] - Fundamento: [...]
2. [Preliminar 2] - Fundamento: [...]

#### Defesa de Mérito
**Negativa dos fatos**: [O que nega]
**Versão dos fatos**: [Sua narrativa]
**Fundamento jurídico**: [Base legal]

#### Reconvenção
- Existe: Sim / Não
- Se sim: [Pedidos reconvencionais]

#### Provas Requeridas
[Lista]

---

### Impugnação ao Valor da Causa (DD/MM/AAAA)
[Se houver]

---

### Especificação de Provas (DD/MM/AAAA)
[...]

---

### Alegações Finais (DD/MM/AAAA)
[...]

---

### Contrarrazões de Apelação (DD/MM/AAAA)
[Se o autor apelou]

---

### Apelação (DD/MM/AAAA)
[Se foi apelante]

---

### Outras Petições
[Listar todas]

---

## MINISTÉRIO PÚBLICO

[Se atuou]

### Parecer [Tipo] (DD/MM/AAAA)
**Posição**: Favorável ao autor / Favorável ao réu / Opinião própria
**Fundamentação**: [...]
**Conclusão**: [...]

---

## ASSISTENTE LITISCONSORCIAL / SIMPLES

[Se houver]

### Petição de Ingresso (DD/MM/AAAA)
[...]

### Manifestações
[...]

---

## TERCEIROS INTERVENIENTES

### [Tipo - Ex: Opoente]
[Manifestações]

---

## JUÍZO / TRIBUNAL

### Despachos

#### DD/MM/AAAA - [Objeto]
[Conteúdo]

### Decisões Interlocutórias

#### DD/MM/AAAA - [Objeto]
[Resumo]

### Sentença (DD/MM/AAAA)
[Resumo - referência cruzada com PEDIDOS_E_DECISOES]

### Acórdão (DD/MM/AAAA)
[Resumo - referência cruzada]

---

## MAPA DE COMUNICAÇÃO ENTRE PARTES

### Autor → Réu
[Quantas manifestações, principais temas]

### Réu → Autor
[Quantas manifestações, principais temas]

### Partes → Juízo
[Estatísticas]

### Juízo → Partes
[Estatísticas]

---

## ANÁLISE QUANTITATIVA

| Parte | Petições | Recursos | Provas requeridas | Provas aceitas |
|-------|----------|----------|-------------------|----------------|
| Autor | X | Y | Z | W |
| Réu | A | B | C | D |

---

## CRONOLOGIA INTEGRADA DE MANIFESTAÇÕES

[Timeline mostrando quando cada parte se manifestou]

DD/MM/AAAA - Autor: Inicial
DD/MM/AAAA - Réu: Contestação
DD/MM/AAAA - Autor: Réplica
[...]

IMPORTANTE:
- Organize por sujeito processual
- Mantenha ordem cronológica dentro de cada parte
- Resuma mas preserve substância dos argumentos`
  },

  ANALISE_DE_RISCO: {
    name: 'ANALISE_DE_RISCO',
    extension: '.md',
    priority: 2,
    prompt: `Você é um assistente jurídico especializado em análise processual e gestão de riscos.

TAREFA: Fazer análise completa de RISCOS e PROBABILIDADES do processo.

ESTRUTURA OBRIGATÓRIA:

# ANÁLISE DE RISCO E PROBABILIDADES

## CENÁRIOS POSSÍVEIS

### 1. Cenário Otimista (Probabilidade: [X%])

**Descrição**: [O melhor resultado possível]

**Condições para ocorrer**:
- [Condição 1]
- [Condição 2]
- [Condição 3]

**Consequências Jurídicas**:
- [Resultado processual]

**Consequências Financeiras**:
- A receber: R$ [...]
- A pagar: R$ [...]
- Líquido: R$ [+/-...]

**Consequências Práticas**:
[Efeitos concretos]

---

### 2. Cenário Realista (Probabilidade: [Y%])

[Mesma estrutura]

**Por que é o mais provável**:
[Justificar com base em provas, jurisprudência, etc]

---

### 3. Cenário Pessimista (Probabilidade: [Z%])

[Mesma estrutura]

---

### 4. Cenário Intermediário 1 (Probabilidade: [W%])
[Se aplicável - resultado parcial]

---

## FATORES DE RISCO

### Risco Processual
- **Nível**: 🔴 Alto / 🟡 Médio / 🟢 Baixo
- **Justificativa**: [Por que tem esse nível de risco]
- **Mitigação**: [Como reduzir o risco]

**Detalhamento**:
- Qualidade das preliminares: [...]
- Prescrição/decadência: [risco de]
- Competência: [risco de]
- Nulidades: [risco de]

### Risco Probatório
- **Nível**: 🔴 Alto / 🟡 Médio / 🟢 Baixo

**Suficiência das provas**:
- Nossa parte: [análise]
- Parte contrária: [análise]

**Provas faltantes críticas**:
1. [Prova X] - Impacto: Alto/Médio/Baixo
2. [Prova Y] - Impacto: [...]

**Vulnerabilidades**:
- [Ponto fraco 1]
- [Ponto fraco 2]

### Risco Jurisprudencial
- **Nível**: 🔴 Alto / 🟡 Médio / 🟢 Baixo

**Análise**:
- Jurisprudência majoritária: Favorável / Desfavorável / Dividida
- Precedentes vinculantes: [aplicáveis]
- Tendência de mudança: [se houver]

### Risco Recursal
- **Nível**: 🔴 Alto / 🟡 Médio / 🟢 Baixo

**Análise**:
- Probabilidade de reforma em 2ª instância: [X%]
- Fundamento: [histórico do tribunal, composição da câmara, etc]
- Recursos cabíveis: [lista]
- Tempo adicional estimado: [X meses/anos]

### Risco de Execução
- **Nível**: 🔴 Alto / 🟡 Médio / 🟢 Baixo

**Análise**:
- Capacidade financeira do executado: [...]
- Bens identificados: [lista]
- Patrimônio estimado: R$ [...]
- Risco de insolvência: [...]
- Tempo estimado para satisfação: [...]

### Risco de Prescrição Intercorrente
[Se em execução]
- **Nível**: 🔴 Alto / 🟡 Médio / 🟢 Baixo
- Prazo: [...]
- Diligências pendentes: [...]

---

## MATRIZ DE RISCO X IMPACTO

| Risco | Probabilidade | Impacto | Criticidade |
|-------|---------------|---------|-------------|
| [Risco 1] | Alta | Alto | 🔴 Crítico |
| [Risco 2] | Média | Médio | 🟡 Moderado |
| [Risco 3] | Baixa | Baixo | 🟢 Baixo |

---

## IMPACTO FINANCEIRO

### Valor Mínimo Esperado
**R$ [valor]**
- Cenário: [qual]
- Probabilidade: [X%]
- Composição: [...]

### Valor Médio Ponderado
**R$ [valor]**
- Cálculo: (Cenário1 × Prob1) + (Cenário2 × Prob2) + ...
- Este é o valor mais realista para provisão

### Valor Máximo Possível
**R$ [valor]**
- Cenário: [qual]
- Probabilidade: [X%]
- Composição: [...]

### Curva de Distribuição
```
Valor          Probabilidade
R$ 0           ██████ 30%
R$ 50.000      ███████████ 50%
R$ 100.000     ████ 20%
```

---

## IMPACTO TEMPORAL

### Duração Esperada

**Cenário Rápido** ([X%] probabilidade):
- **Duração**: X meses
- **Conclusão estimada**: DD/MM/AAAA
- **Condições**: [sem recursos, acordo, etc]

**Cenário Médio** ([Y%] probabilidade):
- **Duração**: Y meses
- **Conclusão estimada**: DD/MM/AAAA
- **Condições**: [recursos até 2ª instância]

**Cenário Longo** ([Z%] probabilidade):
- **Duração**: Z anos
- **Conclusão estimada**: DD/MM/AAAA
- **Condições**: [recursos até STJ/STF]

### Fase Atual
- **% de conclusão estimado**: [X%]
- **Tempo decorrido**: [X anos Y meses]
- **Tempo restante estimado**: [...]

---

## ANÁLISE CUSTO-BENEFÍCIO

### Custos já Incorridos
- Custas: R$ [...]
- Honorários contratuais: R$ [...]
- Perícia: R$ [...]
- **Total**: R$ [...]

### Custos Futuros Estimados
- Preparo recursal: R$ [...]
- Honorários sucumbenciais (se perder): R$ [...]
- Custas adicionais: R$ [...]
- **Total**: R$ [...]

### Benefício Esperado
- Valor médio ponderado: R$ [...]
- Menos custos futuros: R$ [...]
- **Benefício líquido**: R$ [...]

### ROI (Return on Investment)
**[X%]** - [(Benefício - Custos) / Custos × 100]

### Análise
- Vale a pena prosseguir? [Sim/Não]
- Acordo viável? [Sim/Não - valor sugerido]

---

## PONTOS DE INFLEXÃO

### Momentos Críticos Futuros
1. **[Evento X]** (estimado para DD/MM/AAAA)
   - Impacto: [...]
   - Risco associado: [...]
   - Ação recomendada: [...]

2. **[Evento Y]**
   [...]

---

## RECOMENDAÇÃO ESTRATÉGICA

### Postura Recomendada
- [ ] Litigiosa (prosseguir até o fim)
- [ ] Conciliatória (buscar acordo)
- [ ] Defensiva (minimizar danos)
- [ ] Agressiva (ampliar pedidos)

### Fundamentação
[Por que essa postura é recomendada]

### Valor de Acordo Sugerido
**Faixa**: R$ [mín] a R$ [máx]
**Ideal**: R$ [valor]
**Fundamentação**: [baseado em valor médio ponderado, riscos, custos]

---

## MONITORAMENTO

### KPIs para Acompanhamento
1. [Indicador 1] - Meta: [...]
2. [Indicador 2] - Meta: [...]

### Revisão da Análise
Esta análise deve ser revista quando:
- [ ] Houver decisão de mérito
- [ ] Houver julgamento de recurso
- [ ] Surgirem novas provas
- [ ] Mudar jurisprudência dominante
- [ ] [Outro evento]

IMPORTANTE:
- Seja realista nas probabilidades
- Baseie análise em fatos concretos
- Justifique cada percentual
- Considere custos na análise`
  },

  ESTRATEGIA_E_PROXIMOS_PASSOS: {
    name: 'ESTRATEGIA_E_PROXIMOS_PASSOS',
    extension: '.md',
    priority: 1,
    prompt: `Você é um assistente jurídico estrategista especializado em análise processual.

TAREFA: Elaborar ESTRATÉGIA completa e PRÓXIMOS PASSOS acionáveis.

ESTRUTURA OBRIGATÓRIA:

# ESTRATÉGIA PROCESSUAL E RECOMENDAÇÕES

## POSIÇÃO ESTRATÉGICA ATUAL

### Situação Tática
**Fase**: [Fase atual do processo]
**Nossa posição**: Vantajosa / Equilibrada / Desvantajosa
**Momento processual**: [Crítico / Favorável / Neutro]

### Análise SWOT

#### Forças (Strengths)
1. [Força 1] - Explorar: [como]
2. [Força 2] - Explorar: [como]
3. [Força 3] - Explorar: [como]

#### Fraquezas (Weaknesses)
1. [Fraqueza 1] - Mitigar: [como]
2. [Fraqueza 2] - Mitigar: [como]

#### Oportunidades (Opportunities)
1. [Oportunidade 1] - Aproveitar: [como]
2. [Oportunidade 2] - Aproveitar: [como]

#### Ameaças (Threats)
1. [Ameaça 1] - Defender: [como]
2. [Ameaça 2] - Defender: [como]

---

## PRÓXIMOS PASSOS RECOMENDADOS

### 🔴 CURTO PRAZO (Próximos 30 dias)

#### 1. [Ação mais urgente]
- **Prazo**: DD/MM/AAAA (faltam X dias)
- **Prioridade**: 🔴 Crítica
- **Responsável**: [Advogado/Parte]
- **Objetivo**: [Para que serve]
- **Consequência se não fizer**: [Risco]
- **Recursos necessários**: [Documentos, informações, etc]
- **Estimativa de tempo**: X horas/dias

#### 2. [Segunda ação]
[Mesma estrutura]

#### 3. [Terceira ação]
[...]

---

### 🟡 MÉDIO PRAZO (30-90 dias)

#### 1. [Ação planejada]
- **Prazo estimado**: [Janela de tempo]
- **Prioridade**: 🟡 Alta
- **Dependências**: [Aguarda o quê]
- **Preparação necessária**: [O que fazer antes]

#### 2. [Segunda ação]
[...]

---

### 🟢 LONGO PRAZO (90+ dias)

#### 1. [Ação estratégica]
- **Objetivo**: [Meta de longo prazo]
- **Marcos intermediários**: [Etapas]

---

## DECISÕES ESTRATÉGICAS PENDENTES

### Decisão 1: [Título da decisão]
**Contexto**: [Situação que exige decisão]

**Opções**:
- **Opção A**: [Descrição]
  - Prós: [...]
  - Contras: [...]
  - Risco: [...]

- **Opção B**: [Descrição]
  - Prós: [...]
  - Contras: [...]
  - Risco: [...]

**Recomendação**: [Opção X] - Motivo: [...]

---

## ALTERNATIVAS PROCESSUAIS

### Acordo/Conciliação
- **Viabilidade**: Alta / Média / Baixa
- **Momento ideal**: [Quando propor]
- **Faixa de valor sugerida**: R$ [mín] a R$ [máx]
- **Vantagens do acordo**: [...]
- **Desvantagens do acordo**: [...]
- **Estratégia de negociação**: [...]
- **Concessões possíveis**: [...]
- **Linhas vermelhas**: [O que não pode ceder]

### Desistência
- **Recomendada**: Sim / Não
- **Motivo**: [Análise custo-benefício, risco de piorar, etc]
- **Momento**: [Se aplicável, quando desistir]

### Recursos
#### Recurso [Tipo]
- **Cabível**: Sim / Não
- **Chances de êxito**: Alta / Média / Baixa - [X%]
- **Fundamento**: [Teses principais]
- **Custo estimado**: R$ [preparo + honorários]
- **Tempo adicional**: [X meses/anos]
- **Recomendação**: Interpor / Não interpor
- **Motivo da recomendação**: [...]

### Ações Paralelas
- **Medida cautelar**: [Se aplicável]
- **Ação autônoma**: [Se cabível outra ação]
- **Reclamação**: [Se houver desrespeito a precedente]

---

## ESTRATÉGIA POR FASE

### Se em Fase de Conhecimento
**Postura**: Ofensiva / Defensiva
**Foco**: [Provas / Preliminares / Mérito]
**Ações prioritárias**: [...]

### Se em Fase Recursal
**Objetivo do recurso**: [Reforma total / Parcial / Prequestionamento]
**Teses principais**: [...]
**Teses subsidiárias**: [...]

### Se em Execução
**Estratégia**: [Localização de bens / Impugnação / Obstrução]
**Táticas**: [...]

---

## GESTÃO DE EXPECTATIVAS

### Comunicação com Cliente

#### O que informar AGORA
1. [Atualização importante 1]
2. [Atualização importante 2]

#### Como apresentar riscos
[Forma adequada de comunicar análise de risco]

#### Prazo realista
"O processo deve levar aproximadamente [X] meses/anos até conclusão, considerando [cenário Y]"

---

## PONTOS DE ATENÇÃO CRÍTICOS

### ⚠️ Alerta 1: [Descrição]
- **Risco**: [...]
- **Monitorar**: [O que acompanhar]
- **Ação se materializar**: [...]

### ⚠️ Alerta 2: [Descrição]
[...]

---

## OPORTUNIDADES TÁTICAS

### Oportunidade 1: [Descrição]
- **Janela de tempo**: [Quando aproveitar]
- **Como explorar**: [...]
- **Benefício esperado**: [...]

---

## RECURSOS NECESSÁRIOS

### Documentos Faltantes
1. [Documento X] - Prazo: [urgente/não urgente]
2. [Documento Y] - Prazo: [...]

### Informações Adicionais
1. [Informação X] - Fonte: [onde buscar]
2. [Informação Y] - Fonte: [...]

### Especialistas Externos
- [ ] Perito assistente: [Especialidade]
- [ ] Consultor: [Área]
- [ ] Testemunha técnica: [...]

---

## CHECKLIST DE EXECUÇÃO

### Imediato (Esta Semana)
- [ ] [Tarefa 1]
- [ ] [Tarefa 2]
- [ ] [Tarefa 3]

### Este Mês
- [ ] [Tarefa 1]
- [ ] [Tarefa 2]

### Este Trimestre
- [ ] [Tarefa 1]
- [ ] [Tarefa 2]

---

## MÉTRICAS DE SUCESSO

### Como medir se a estratégia está funcionando

#### Indicador 1: [Nome]
- **Meta**: [Objetivo mensurável]
- **Atual**: [Status]
- **Tendência**: ⬆️ Melhorando / ➡️ Estável / ⬇️ Piorando

#### Indicador 2: [Nome]
[...]

---

## PLANO B

### Se Cenário Pessimista se Confirmar
**Ações contingenciais**:
1. [Ação emergencial 1]
2. [Ação emergencial 2]

### Se Surgir Imprevisto [Tipo]
[Plano de resposta]

---

## REVISÃO ESTRATÉGICA

### Próxima Revisão
**Data recomendada**: DD/MM/AAAA ou quando ocorrer [evento]

### Gatilhos para Revisão Imediata
- [ ] Decisão de mérito
- [ ] Novo precedente vinculante
- [ ] Mudança legislativa
- [ ] [Outro evento crítico]

IMPORTANTE:
- Seja prático e acionável
- Priorize ações por urgência
- Considere recursos disponíveis
- Baseie recomendações na análise de risco`
  },

  PRECEDENTES_SIMILARES: {
    name: 'PRECEDENTES_SIMILARES',
    extension: '.md',
    priority: 3,
    prompt: `Você é um assistente jurídico especializado em análise processual e pesquisa jurisprudencial.

TAREFA: Identificar processos similares e padrões jurisprudenciais aplicáveis.

ESTRUTURA OBRIGATÓRIA:

# CASOS SIMILARES E PRECEDENTES

## PROCESSOS SEMELHANTES IDENTIFICADOS NO TEXTO

[Extrair menções a outros processos similares]

### Processo [Número/Identificação]
- **Tribunal**: [Origem]
- **Partes**: [Se mencionadas]
- **Similaridade com nosso caso**: [X%] - [Justificar]
- **Pontos em comum**:
  1. [Ponto 1]
  2. [Ponto 2]
- **Pontos divergentes**: [...]
- **Resultado**: [Como foi decidido]
- **Lições**: [O que aprender deste caso]

---

## PADRÕES JURISPRUDENCIAIS IDENTIFICADOS

### Padrão 1: [Descrição do padrão]
**Observação**: [Tendência identificada]

**Base**: Análise de [mencionar quantidade] precedentes citados no processo

**Estatística**: Em casos deste tipo, [X%] resultou em [resultado Y]

**Fatores determinantes**:
1. [Fator 1 que influencia o resultado]
2. [Fator 2]

**Aplicação ao nosso caso**: [Como esse padrão se aplica]

---

## ANÁLISE DE TRIBUNAL JULGADOR

### Tendências do [Tribunal/Vara/Juízo]

#### Posicionamento em Casos Similares
- **Linha majoritária**: [Tendência]
- **Fundamentos recorrentes**: [Argumentos que costumam prevalecer]
- **Precedentes locais**: [Súmulas, jurisprudência dominante]

#### Composição da Câmara/Turma
[Se em recurso - analisar composição]
- **Relator**: [Nome] - Tendência: [Conservador/Progressista em X matéria]
- **Histórico do relator em casos similares**: [Se disponível]

---

## BUSCA RECOMENDADA DE PRECEDENTES

### Palavras-chave Sugeridas para Pesquisa
1. "[Termo jurídico 1]" + "[Termo 2]"
2. "[Tema X]" + "[Contexto Y]"
3. "[Matéria Z]"

### Filtros Recomendados
- **Tribunais prioritários**: [STF / STJ / TJ...]
- **Período**: [Anos mais relevantes]
- **Órgão julgador**: [Turma/Câmara específica]

### Tipos de Precedentes a Buscar
- [ ] Súmulas vinculantes
- [ ] Temas de repercussão geral
- [ ] Recursos repetitivos
- [ ] Jurisprudência dominante do tribunal local
- [ ] Casos idênticos

---

## ARGUMENTAÇÃO COMPARATIVA

### Por que nosso caso é similar a [Precedente X]
[Análise comparativa]

### Por que nosso caso se distingue de [Precedente Y]
[Distinguishing]

---

## EVOLUÇÃO JURISPRUDENCIAL

### Histórico de Entendimento sobre [Tema]
- **2010-2015**: [Posição anterior]
- **2015-2020**: [Mudança]
- **2020-Atual**: [Posição atual]

### Tendência Futura
[Projeção baseada em precedentes recentes]

---

## ANÁLISE ESTATÍSTICA (Se disponível no texto)

### Taxa de Êxito por Tipo de Ação
[Se o texto mencionar estatísticas]

### Taxa de Reforma em Recurso
[Se disponível]

---

## INDICADORES DE SUCESSO

### Fatores que Aumentam Chances de Êxito
1. [Fator 1] - Presente em nosso caso? [Sim/Não]
2. [Fator 2] - Presente em nosso caso? [Sim/Não]
3. [Fator 3] - Presente em nosso caso? [Sim/Não]

### Score de Similaridade com Casos Vencedores
**[X/10]** - [Justificativa]

---

## RECOMENDAÇÕES DE PESQUISA ADICIONAL

### Pesquisar no [Tribunal]
**Objetivo**: [O que buscar]
**Como**: [Estratégia de busca]

### Doutrinas Relevantes
**Autores recomendados**: [Lista]
**Obras**: [Títulos]

---

## RESUMO EXECUTIVO

### Principais Padrões Identificados
1. [Padrão 1]
2. [Padrão 2]
3. [Padrão 3]

### Precedentes Mais Relevantes
1. [Precedente 1] - Peso: Alto
2. [Precedente 2] - Peso: Médio
3. [Precedente 3] - Peso: Médio

### Conclusão
[Análise final sobre o que os precedentes similares indicam para nosso caso]

IMPORTANTE:
- Base esta análise EXCLUSIVAMENTE no que está no texto fornecido
- Se informações não estiverem disponíveis, indique "[PESQUISA ADICIONAL NECESSÁRIA]"
- Seja crítico sobre aplicabilidade de precedentes
- Identifique padrões mesmo quando não explicitados`
  }
};

// Helper: Obter lista de análises por prioridade
export function getAnalysesByPriority(priority) {
  return Object.entries(ANALYSIS_PROMPTS)
    .filter(([_, config]) => config.priority === priority)
    .map(([key, config]) => ({ key, ...config }));
}

// Helper: Obter todas as análises ordenadas por prioridade
export function getAllAnalysesSorted() {
  return Object.entries(ANALYSIS_PROMPTS)
    .map(([key, config]) => ({ key, ...config }))
    .sort((a, b) => a.priority - b.priority);
}
