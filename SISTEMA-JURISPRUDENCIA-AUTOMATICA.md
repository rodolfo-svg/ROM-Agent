# ⚖️ SISTEMA AUTOMÁTICO DE JURISPRUDÊNCIA - ROM AGENT

**Versão**: 2.6.0
**Data**: 13 de dezembro de 2024

---

## 🎯 OBJETIVO

Sistema 100% automático que:
1. Identifica temas jurídicos do caso
2. Busca jurisprudência relevante em múltiplas fontes
3. Apresenta extratos + opção de inteiro teor
4. Analisa leading cases específicos
5. Inclui súmulas, teses, IRDRs, recursos repetitivos

**ZERO INTERVENÇÃO MANUAL** - Tudo automático!

---

## 🔍 FONTES DE DADOS

### 1. DataJud CNJ
```
API: https://datajud.cnj.jus.br/api-publica/
Cobertura: Todos os tribunais brasileiros
Dados: Acórdãos, sentenças, decisões
```

### 2. STF (Supremo Tribunal Federal)
```
API: https://portal.stf.jus.br/jurisprudencia/
Recursos:
• Súmulas vinculantes
• Repercussão geral
• Teses jurisprudenciais
• Leading cases
```

### 3. STJ (Superior Tribunal de Justiça)
```
API: https://processo.stj.jus.br/repetitivos/
Recursos:
• Recursos repetitivos (Tema X)
• Súmulas
• Teses
• Orientações jurisprudenciais
```

### 4. TST (Tribunal Superior do Trabalho)
```
Recursos:
• Súmulas TST
• Orientações jurisprudenciais (OJ)
• Precedentes normativos
```

### 5. IRDRs (Incidentes de Resolução de Demandas Repetitivas)
```
Base: Tribunais Estaduais e Federais
Temas: Questões repetitivas com tese fixada
```

---

## 🤖 FLUXO AUTOMÁTICO

### Passo 1: Análise do Caso
```
Documento → IA identifica:
├── Tema principal (ex: "rescisão indireta trabalhista")
├── Subtemas (ex: "assédio moral", "dano moral")
├── Artigos de lei mencionados
├── Palavras-chave jurídicas
└── Tribunal competente
```

### Passo 2: Busca Automática Paralela
```
Sistema dispara 5 buscas simultâneas:

Thread 1: DataJud CNJ
├── Busca por tema + palavras-chave
├── Filtro: últimos 5 anos
├── Ordenação: relevância
└── Top 20 resultados

Thread 2: STF
├── Busca repercussão geral
├── Busca súmulas vinculantes
└── Busca teses

Thread 3: STJ
├── Busca recursos repetitivos
├── Busca súmulas
└── Busca por tema

Thread 4: TST (se trabalhista)
├── Busca súmulas TST
├── Busca OJs
└── Precedentes

Thread 5: IRDRs
├── Busca em todos os TJs/TRFs
└── Filtra teses fixadas

Tempo total: < 10 segundos (paralelo)
```

### Passo 3: Ranking Inteligente
```
IA analisa os resultados e classifica:

Critérios:
✓ Relevância ao caso (0-100%)
✓ Hierarquia do tribunal (STF > STJ > TJ)
✓ Data (mais recentes primeiro)
✓ Súmula vinculante (prioridade máxima)
✓ Recurso repetitivo (alta prioridade)
✓ Leading case identificado

Resultado:
1º - Súmula 123 STF (99% relevância)
2º - Tema 456 STJ (95% relevância)
3º - IRDR 789 TJSP (92% relevância)
...
```

### Passo 4: Extrato + Inteiro Teor
```
Para cada resultado:

┌─────────────────────────────────────────┐
│ 🏆 SÚMULA 123 STF                       │
│                                         │
│ Extrato (200 caracteres):              │
│ "É inconstitucional a cobrança de..."  │
│                                         │
│ [📄 Ver Inteiro Teor]  [⭐ Adicionar]  │
└─────────────────────────────────────────┘

Ao clicar "Ver Inteiro Teor":
→ Sistema busca documento completo
→ IA faz resumo executivo
→ Destaca trechos mais relevantes
→ Mostra como aplicar no caso
```

### Passo 5: Análise de Leading Case
```
IA identifica o leading case do tema:

🔍 Leading Case Identificado:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Processo: RE 574.706 (STF)
Tema: Repercussão Geral 123
Relator: Min. Cármen Lúcia
Data: 15/04/2019

Tese Fixada:
"É inconstitucional a incidência do IPTU
progressivo no tempo sobre imóveis urbanos..."

Aplicação ao Seu Caso:
→ Fundamenta pedido de restituição
→ Cita precedente vinculante
→ Jurisprudência consolidada
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[📥 Adicionar à Petição]  [📄 Ver Inteiro Teor]
```

---

## 📊 EXEMPLO PRÁTICO

### Caso: Rescisão Indireta por Assédio Moral

#### Input (Upload do caso)
```
Cliente relata assédio moral sistemático no ambiente
de trabalho, com ofensas diárias, sobrecarga de trabalho
e isolamento da equipe. Busca rescisão indireta + dano moral.
```

#### Output Automático (< 10 segundos)

```
🔍 JURISPRUDÊNCIA ENCONTRADA AUTOMATICAMENTE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 🏆 SÚMULA 448 TST (Prioridade Máxima)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tribunal: TST
Relevância: 99%
Tipo: Súmula

Extrato:
"A rescisão indireta do contrato de trabalho,
prevista no art. 483, exige prova robusta..."

[📄 Ver Inteiro Teor]  [⭐ Adicionar à Petição]

Leading Case:
RR-1234-56.2020.5.02.0000 (TST)
→ Situação similar: assédio moral + rescisão
→ Decisão favorável ao empregado
→ Dano moral: R$ 50.000

[🔍 Analisar Leading Case]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. 📋 TEMA 12 - RECURSO REPETITIVO STJ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tribunal: STJ
Relevância: 95%
Tipo: Recurso Repetitivo

Extrato:
"O assédio moral no ambiente de trabalho
configura dano moral in re ipsa..."

Tese Fixada:
"Comprovado o assédio moral, é devida indenização
por danos morais, independente de prova do prejuízo"

[📄 Ver Inteiro Teor]  [⭐ Adicionar]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. ⚖️ IRDR 123/2021 - TJSP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tribunal: TJSP
Relevância: 92%
Tipo: IRDR

Extrato:
"Nos casos de rescisão indireta por assédio moral,
a prova pode ser feita por testemunhas..."

[📄 Ver Inteiro Teor]  [⭐ Adicionar]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[... mais 17 resultados]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 SUGESTÃO DA IA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Com base na jurisprudência encontrada, recomendo:

1. Fundamentar rescisão indireta no art. 483, 'e', CLT
2. Citar Súmula 448 TST (prova robusta)
3. Usar Tema 12 STJ (dano moral in re ipsa)
4. Seguir precedente leading case (R$ 50k)
5. Utilizar IRDR 123 (prova testemunhal)

[✍️ Inserir Automaticamente na Petição]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🔧 IMPLEMENTAÇÃO TÉCNICA

### 1. Módulo de Busca Automática

```javascript
// lib/jurisprudence-auto-search.js

class JurisprudenceAutoSearch {
  constructor() {
    this.sources = {
      datajud: new DataJudAPI(),
      stf: new STFAPI(),
      stj: new STJAPI(),
      tst: new TSTAPI(),
      irdrs: new IRDRsAPI()
    };
  }

  async autoSearch(caseData) {
    // 1. Extrair temas do caso
    const themes = await this.extractThemes(caseData);

    // 2. Buscar em paralelo
    const results = await Promise.all([
      this.sources.datajud.search(themes),
      this.sources.stf.search(themes),
      this.sources.stj.search(themes),
      this.sources.tst.search(themes),
      this.sources.irdrs.search(themes)
    ]);

    // 3. Consolidar e rankear
    const consolidated = this.consolidate(results);
    const ranked = await this.rankByRelevance(consolidated, caseData);

    // 4. Identificar leading cases
    const leadingCases = await this.identifyLeadingCases(ranked);

    return {
      results: ranked,
      leadingCases,
      suggestions: await this.generateSuggestions(ranked, caseData)
    };
  }

  async extractThemes(caseData) {
    // Usa IA para identificar temas
    const prompt = `
      Analise o caso e identifique:
      1. Tema principal
      2. Subtemas
      3. Artigos de lei relevantes
      4. Palavras-chave jurídicas

      Caso: ${caseData.description}
    `;

    const response = await claudeAnalyze(prompt);
    return parseThemes(response);
  }

  async rankByRelevance(results, caseData) {
    // Usa IA para rankear por relevância
    const scored = results.map(result => ({
      ...result,
      relevanceScore: this.calculateRelevance(result, caseData),
      hierarchyScore: this.getTribunalHierarchy(result.court),
      dateScore: this.getRecencyScore(result.date),
      bindingScore: this.getBindingScore(result.type)
    }));

    // Ordenar por score total
    return scored.sort((a, b) => {
      const scoreA = a.relevanceScore + a.hierarchyScore +
                    a.dateScore + a.bindingScore;
      const scoreB = b.relevanceScore + b.hierarchyScore +
                    b.dateScore + b.bindingScore;
      return scoreB - scoreA;
    });
  }

  getTribunalHierarchy(court) {
    const hierarchy = {
      'STF': 100,
      'STJ': 90,
      'TST': 85,
      'TRF': 70,
      'TJ': 60,
      'TRT': 65
    };
    return hierarchy[court] || 50;
  }

  getBindingScore(type) {
    const binding = {
      'sumula_vinculante': 100,
      'recurso_repetitivo': 95,
      'repercussao_geral': 90,
      'irdr': 85,
      'sumula': 80,
      'acordao': 50
    };
    return binding[type] || 30;
  }

  async identifyLeadingCases(results) {
    // Identifica os leading cases de cada tema
    const leadingCases = [];

    for (const result of results) {
      if (result.isLeadingCase || result.type === 'recurso_repetitivo') {
        const fullText = await this.fetchFullText(result);
        const analysis = await this.analyzeLeadingCase(fullText, result);

        leadingCases.push({
          ...result,
          fullText,
          analysis,
          applicationTips: analysis.howToApply
        });
      }
    }

    return leadingCases;
  }

  async fetchFullText(result) {
    // Busca inteiro teor do documento
    return await this.sources[result.source].getFullText(result.id);
  }

  async analyzeLeadingCase(fullText, result) {
    // IA analisa o leading case
    const prompt = `
      Analise este leading case e extraia:
      1. Tese jurídica fixada
      2. Fundamentos principais
      3. Como aplicar no caso concreto
      4. Trechos mais relevantes

      Leading Case: ${result.title}
      Inteiro Teor: ${fullText}
    `;

    return await claudeAnalyze(prompt);
  }

  async generateSuggestions(rankedResults, caseData) {
    // IA gera sugestões de como usar a jurisprudência
    const prompt = `
      Com base na jurisprudência encontrada, sugira:
      1. Principais argumentos a usar
      2. Ordem de citação (mais forte primeiro)
      3. Como fundamentar cada pedido
      4. Trechos específicos para citar

      Jurisprudência:
      ${JSON.stringify(rankedResults.slice(0, 5), null, 2)}

      Caso:
      ${caseData.description}
    `;

    return await claudeAnalyze(prompt);
  }
}
```

### 2. API DataJud CNJ

```javascript
// lib/integrations/datajud-api.js

class DataJudAPI {
  constructor() {
    this.apiKey = process.env.DATAJUD_API_KEY;
    this.baseURL = 'https://datajud.cnj.jus.br/api-publica';
  }

  async search(themes) {
    const query = this.buildQuery(themes);

    const response = await fetch(`${this.baseURL}/busca`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        limit: 20,
        orderBy: 'relevancia',
        dateFrom: this.getLast5Years()
      })
    });

    const data = await response.json();
    return this.parseResults(data);
  }

  buildQuery(themes) {
    // Constrói query otimizada
    const keywords = themes.keywords.join(' AND ');
    const articles = themes.articles.map(a => `"${a}"`).join(' OR ');

    return {
      text: keywords,
      articles,
      mainTheme: themes.main
    };
  }

  parseResults(data) {
    return data.results.map(result => ({
      id: result.id,
      title: result.ementa,
      extract: this.createExtract(result.ementa, 200),
      court: result.tribunal,
      date: result.data_julgamento,
      type: result.tipo,
      source: 'datajud',
      fullTextURL: result.url_inteiro_teor
    }));
  }

  createExtract(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  async getFullText(id) {
    const response = await fetch(`${this.baseURL}/documento/${id}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    const data = await response.json();
    return data.fullText;
  }
}
```

### 3. Interface de Resultados

```javascript
// Renderizar jurisprudência no frontend

function renderJurisprudenceResults(data) {
  const container = document.getElementById('jurisprudenceResults');

  container.innerHTML = `
    <div class="juris-header">
      <h2>🔍 Jurisprudência Encontrada Automaticamente</h2>
      <p>Análise em ${data.searchTime}s - ${data.results.length} resultados</p>
    </div>

    ${data.results.map((result, index) => `
      <div class="juris-card ${result.type === 'sumula_vinculante' ? 'priority-max' : ''}">
        <div class="juris-rank">#${index + 1}</div>

        <div class="juris-header">
          <span class="juris-badge ${result.type}">
            ${this.getBadgeIcon(result.type)} ${result.type.toUpperCase()}
          </span>
          <span class="relevance-score">${result.relevanceScore}% relevante</span>
        </div>

        <h3>${result.title}</h3>

        <div class="juris-meta">
          <span>📍 ${result.court}</span>
          <span>📅 ${formatDate(result.date)}</span>
        </div>

        <p class="extract">${result.extract}</p>

        <div class="juris-actions">
          <button onclick="viewFullText('${result.id}')">
            📄 Ver Inteiro Teor
          </button>
          <button onclick="addToPetition('${result.id}')" class="btn-primary">
            ⭐ Adicionar à Petição
          </button>
          ${result.isLeadingCase ? `
            <button onclick="analyzeLeadingCase('${result.id}')" class="btn-highlight">
              🔍 Analisar Leading Case
            </button>
          ` : ''}
        </div>
      </div>
    `).join('')}

    ${data.leadingCases.length > 0 ? `
      <div class="leading-cases-section">
        <h3>🏆 Leading Cases Identificados</h3>
        ${data.leadingCases.map(lc => `
          <div class="leading-case-card">
            <h4>${lc.title}</h4>
            <div class="thesis">
              <strong>Tese Fixada:</strong>
              <p>${lc.analysis.thesis}</p>
            </div>
            <div class="application">
              <strong>Como Aplicar:</strong>
              <p>${lc.analysis.howToApply}</p>
            </div>
            <button onclick="insertLeadingCase('${lc.id}')">
              📥 Inserir na Petição
            </button>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <div class="ai-suggestions">
      <h3>💡 Sugestões da IA</h3>
      <div class="suggestions-content">
        ${data.suggestions.map(s => `<p>• ${s}</p>`).join('')}
      </div>
      <button onclick="autoInsertAll()" class="btn-gold">
        ✍️ Inserir Tudo Automaticamente
      </button>
    </div>
  `;
}
```

---

## 📋 TIPOS DE JURISPRUDÊNCIA

### Hierarquia e Prioridade

| Tipo | Tribunal | Vinculante? | Prioridade | Badge |
|------|----------|-------------|------------|-------|
| **Súmula Vinculante** | STF | SIM | 🏆 Máxima | Vermelho |
| **Repercussão Geral** | STF | SIM | 🏆 Máxima | Vermelho |
| **Recurso Repetitivo** | STJ/TST | SIM | 🥇 Alta | Laranja |
| **IRDR** | TJ/TRF | SIM | 🥇 Alta | Laranja |
| **Súmula** | Vários | NÃO | 🥈 Média | Azul |
| **Orientação Jurisprudencial** | TST | NÃO | 🥈 Média | Azul |
| **Acórdão** | Vários | NÃO | 🥉 Normal | Cinza |

---

## 🎯 RESUMO EXECUTIVO

✅ **100% Automático**: Zero intervenção manual
✅ **Busca Paralela**: 5 fontes simultâneas (< 10s)
✅ **Inteligente**: Ranking por relevância com IA
✅ **Completo**: Extrato + inteiro teor + análise
✅ **Leading Cases**: Identificação automática
✅ **Sugestões**: IA indica como usar cada jurisprudência
✅ **Insert One-Click**: Adiciona tudo na petição

**DIFERENCIAL**: Enquanto Claude.ai não busca jurisprudência automaticamente,
ROM Agent faz busca completa em 5 fontes e analisa tudo em segundos!
