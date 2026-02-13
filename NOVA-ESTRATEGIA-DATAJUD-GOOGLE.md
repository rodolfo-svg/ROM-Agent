# 🚀 Nova Estratégia: DataJud → Google → Puppeteer

## 📋 Proposta do Usuário (APROVADA)

Inverter a ordem para maior eficiência:

1. **DataJud primeiro** - Buscar processos por metadados (rápido, preciso)
2. **Google complementa** - Buscar ementas dos processos encontrados (direcionado)
3. **Puppeteer enriquece** - Texto completo das ementas (validado)

---

## 🎯 Fluxo Detalhado

### Passo 1: DataJud busca processos por metadados ⚡ 1-2s

```javascript
// Usuário: "jurisprudência sobre dano moral"
const datajudResult = await searchDataJud("dano moral", {
  limit: 10,
  tribunal: "STJ"
});

// DataJud retorna:
[
  {
    numeroProcesso: "1234567-89.2023.4.01.0000",
    tribunal: "STJ",
    classe: {codigo: 1116, nome: "Apelação Cível"},
    assunto: {codigo: 10594, nome: "Dano Moral"},
    orgaoJulgador: {nome: "3ª Turma"},
    dataAjuizamento: "2023-01-15",
    grau: "2"
  },
  // ... mais 9 processos
]
```

**Vantagens:**
- ✅ Processos OFICIAIS e VALIDADOS
- ✅ Metadados ESTRUTURADOS (TPU)
- ✅ Rápido (ElasticSearch otimizado)
- ✅ Filtros precisos (tribunal, classe, assunto)

### Passo 2: Google busca DIRECIONADA por número de processo ⚡ 2-3s

```javascript
// Para cada processo do DataJud:
const googleSearches = datajudResult.map(processo => {
  const query = `${processo.numeroProcesso} site:${getTribunalDomain(processo.tribunal)}`;

  // Exemplo: "1234567-89.2023.4.01.0000 site:stj.jus.br"
  return googleSearch(query, {limit: 1});
});

// Executa buscas em PARALELO
const googleResults = await Promise.all(googleSearches);

// Google retorna URLs EXATOS:
[
  {
    numeroProcesso: "1234567-89.2023.4.01.0000",
    url: "https://stj.jusbrasil.com.br/jurisprudencia/1234567",
    snippet: "EMENTA: Dano moral. Responsabilidade civil..."
  },
  // ... mais 9 URLs
]
```

**Vantagens:**
- ✅ Busca DIRECIONADA (1 processo = 1 query)
- ✅ URLs VALIDADOS (processo existe no tribunal)
- ✅ Economiza quota (buscas precisas)
- ✅ Snippets já contêm trecho da ementa

### Passo 3: Puppeteer enriquece com texto completo ⚡ 2-3s

```javascript
// Para cada URL válido do Google:
const enrichedResults = await puppeteerService.enrichEmentas(googleResults);

// Resultado final:
[
  {
    // Metadados do DataJud (oficiais)
    numeroProcesso: "1234567-89.2023.4.01.0000",
    tribunal: "STJ",
    classe: "Apelação Cível",
    assunto: "Dano Moral",
    orgaoJulgador: "3ª Turma",
    dataAjuizamento: "2023-01-15",
    grau: "2",

    // Conteúdo do Google + Puppeteer
    ementa: "EMENTA COMPLETA: Dano moral. Responsabilidade civil...",
    url: "https://stj.jusbrasil.com.br/jurisprudencia/1234567",
    textoIntegral: "ACÓRDÃO: Vistos, relatados e discutidos...",

    // Fonte híbrida
    fonte: "DataJud CNJ + Google Search + Puppeteer",
    datajudValidado: true
  },
  // ... mais 9 resultados completos
]
```

**Vantagens:**
- ✅ Ementas COMPLETAS
- ✅ URLs VALIDADOS (menos falhas)
- ✅ Metadados OFICIAIS + Conteúdo COMPLETO
- ✅ 100% de aproveitamento

---

## 📊 Comparação: Antes vs Depois

### ❌ Estratégia Antiga (Atual)

```
Usuário: "dano moral"
  ↓
DataJud busca (FALHA 404) ........................ 5s ❌
  ↓
Google busca genérica ............................. 3s
  → "dano moral site:stj.jus.br OR site:stf.jus.br"
  → Retorna: 10 URLs (8 válidos + 2 inválidos)
  ↓
Puppeteer tenta todos ............................. 4s
  → 8 sucessos + 2 falhas
  ↓
TOTAL: 12s
RESULTADO: 8 jurisprudências (sem metadados oficiais)
```

**Problemas:**
- ❌ 5s desperdiçados com DataJud falhando
- ❌ Google retorna URLs misturados
- ❌ Puppeteer desperdiça tempo com URLs inválidos
- ❌ Faltam metadados oficiais (classe, assunto TPU)

### ✅ Estratégia Nova (Proposta)

```
Usuário: "dano moral"
  ↓
DataJud busca processos ........................... 1-2s ✅
  → assunto.nome = "dano moral"
  → Retorna: 10 processos OFICIAIS com metadados
  ↓
Google busca DIRECIONADA (paralelo) ............... 2-3s ✅
  → 10 queries: "numeroProcesso site:tribunal.jus.br"
  → Retorna: 10 URLs EXATOS (100% válidos)
  ↓
Puppeteer enriquece URLs válidos .................. 2-3s ✅
  → 10 sucessos (0 falhas)
  ↓
TOTAL: 5-8s ✅
RESULTADO: 10 jurisprudências COMPLETAS com metadados OFICIAIS ✅
```

**Vantagens:**
- ✅ **40% mais rápido** (5-8s vs 12s)
- ✅ **100% de precisão** (todos processos oficiais)
- ✅ **0% desperdício** (todas URLs válidas)
- ✅ **Metadados oficiais** (classe, assunto TPU validados)
- ✅ **Economia de quota** (buscas direcionadas)

---

## 🔧 Implementação Técnica

### Novo Método: `enrichDataJudWithGoogle()`

```javascript
/**
 * Enriquecer processos do DataJud com ementas do Google
 * Busca DIRECIONADA: 1 processo = 1 query Google
 */
async enrichDataJudWithGoogle(datajudProcessos) {
  console.log(`🔍 [ENRIQUECIMENTO] Buscando ementas para ${datajudProcessos.length} processos`);

  const enrichPromises = datajudProcessos.map(async (processo) => {
    try {
      // Construir query direcionada
      const tribunal = processo.tribunal || 'STJ';
      const domain = this.getTribunalDomain(tribunal);
      const query = `${processo.numeroProcesso} site:${domain}`;

      console.log(`  🔎 Google: "${query}"`);

      // Buscar no Google (limite 1 resultado)
      const googleResult = await this.searchWeb(query, {
        limit: 1,
        tribunal: processo.tribunal
      });

      if (googleResult.results?.length > 0) {
        const googleData = googleResult.results[0];

        return {
          // Metadados do DataJud (oficiais)
          ...processo,

          // Conteúdo do Google
          url: googleData.url,
          snippet: googleData.snippet,
          ementa: googleData.ementa || googleData.snippet,

          // Flags
          datajudValidado: true,
          googleEncontrado: true,
          fonte: 'DataJud CNJ + Google Search'
        };
      } else {
        console.warn(`  ⚠️ Google não encontrou ementa para ${processo.numeroProcesso}`);
        return {
          ...processo,
          datajudValidado: true,
          googleEncontrado: false,
          fonte: 'DataJud CNJ (sem ementa)'
        };
      }

    } catch (error) {
      console.error(`  ❌ Erro ao enriquecer ${processo.numeroProcesso}:`, error.message);
      return {
        ...processo,
        datajudValidado: true,
        googleEncontrado: false,
        erro: error.message
      };
    }
  });

  // Executar todas as buscas em PARALELO
  const enrichedResults = await Promise.all(enrichPromises);

  const sucessos = enrichedResults.filter(r => r.googleEncontrado).length;
  console.log(`✅ [ENRIQUECIMENTO] ${sucessos}/${datajudProcessos.length} processos enriquecidos`);

  return enrichedResults;
}

/**
 * Mapear tribunal para domínio
 */
getTribunalDomain(tribunal) {
  const domains = {
    'STF': 'stf.jus.br',
    'STJ': 'stj.jus.br',
    'STM': 'stm.jus.br',
    'TST': 'tst.jus.br',
    'TSE': 'tse.jus.br',
    'TRF1': 'trf1.jus.br',
    'TRF2': 'trf2.jus.br',
    'TRF3': 'trf3.jus.br',
    'TRF4': 'trf4.jus.br',
    'TRF5': 'trf5.jus.br',
    'TRF6': 'trf6.jus.br',
    'TJSP': 'tjsp.jus.br',
    'TJRJ': 'tjrj.jus.br',
    'TJMG': 'tjmg.jus.br',
    // ... outros tribunais
  };

  return domains[tribunal.toUpperCase()] || 'jusbrasil.com.br';
}
```

### Modificar Fluxo Principal: `searchAll()`

```javascript
async searchAll(tese, options = {}) {
  const { limit = 10, tribunal = null, dataInicio = null, dataFim = null } = options;

  // ESTRATÉGIA NOVA:
  // 1. DataJud busca processos (metadados)
  // 2. Google busca ementas (direcionado)
  // 3. Puppeteer enriquece (validado)

  const canUseDataJud = this.config.datajud.enabled &&
                        this.config.datajud.apiKey &&
                        !this.isCircuitOpen();

  if (canUseDataJud) {
    console.log('🔍 [ESTRATÉGIA] DataJud → Google → Puppeteer');

    try {
      // PASSO 1: DataJud busca processos por metadados
      console.log('📋 [PASSO 1] DataJud: buscando processos...');
      const datajudResult = await this.withTimeout(
        this.searchDataJud(tese, { limit, tribunal, dataInicio, dataFim }),
        5000,
        'DataJud CNJ'
      );

      this.recordSuccess(); // Circuit breaker

      const processos = datajudResult.results || [];
      console.log(`✅ [PASSO 1] DataJud: ${processos.length} processos encontrados`);

      if (processos.length > 0) {
        // PASSO 2: Google busca ementas (direcionado)
        console.log('📋 [PASSO 2] Google: buscando ementas...');
        const enrichedWithGoogle = await this.enrichDataJudWithGoogle(processos);

        // PASSO 3: Puppeteer enriquece (se habilitado)
        console.log('📋 [PASSO 3] Puppeteer: enriquecendo textos...');
        const finalResults = await this.enrichWithPuppeteer(enrichedWithGoogle);

        return {
          success: true,
          strategy: 'DataJud + Google + Puppeteer',
          results: finalResults,
          totalFound: finalResults.length,
          performance: {
            datajudProcessos: processos.length,
            googleEnriquecidos: enrichedWithGoogle.filter(r => r.googleEncontrado).length,
            puppeteerEnriquecidos: finalResults.filter(r => r.enriched).length
          }
        };
      } else {
        console.log('⚠️ [PASSO 1] DataJud: sem resultados, usando Google genérico...');
      }

    } catch (error) {
      console.error(`❌ [ESTRATÉGIA] DataJud falhou: ${error.message}`);
      this.recordFailure(); // Circuit breaker
    }
  }

  // FALLBACK: Google genérico (se DataJud falhou ou sem resultados)
  console.log('🔄 [FALLBACK] Usando Google Search genérico...');
  const googleResult = await this.searchWeb(tese, { limit, tribunal });

  return {
    success: true,
    strategy: 'Google Search (fallback)',
    results: googleResult.results || [],
    totalFound: googleResult.results?.length || 0
  };
}
```

---

## 📈 Métricas Esperadas

### Performance

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| Tempo médio | 12s | 5-8s | **40% mais rápido** ✅ |
| Taxa de sucesso | 80% | 95% | **+15%** ✅ |
| URLs válidos | 80% | 100% | **+20%** ✅ |
| Metadados oficiais | 0% | 100% | **+100%** ✅ |

### Qualidade

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Precisão | Média | Alta ✅ |
| Metadados | Inferidos | Oficiais (TPU) ✅ |
| Ementas | Parciais | Completas ✅ |
| Validação | Nenhuma | CNJ ✅ |

### Custo (Google API)

| Cenário | Antes | Depois |
|---------|-------|--------|
| Busca genérica | 1 query | - |
| Buscas direcionadas | - | 10 queries |
| Taxa de acerto | 80% | 100% |
| Desperdício | 20% | 0% ✅ |

**Nota:** Apesar de mais queries, o custo é compensado pela precisão (100% de acerto vs 80%).

---

## ✅ Vantagens da Nova Estratégia

1. **Mais Rápida** ⚡
   - 5-8s vs 12s (40% mais rápido)
   - DataJud ElasticSearch é otimizado
   - Buscas Google em paralelo

2. **Mais Precisa** 🎯
   - 100% processos oficiais (DataJud)
   - 100% URLs válidos (busca direcionada)
   - Metadados TPU validados

3. **Mais Eficiente** 💰
   - Menos desperdício de quota Google
   - Puppeteer só processa URLs válidos
   - Circuit breaker protege DataJud

4. **Mais Confiável** 🛡️
   - Metadados oficiais do CNJ
   - Validação dupla (DataJud + Google)
   - Fallback inteligente se falhar

5. **Melhor UX** 👤
   - Resultados mais rápidos
   - Informações mais completas
   - Fontes oficiais e verificadas

---

## 🧪 Plano de Implementação

### Fase 1: Criar novo método (30 min)
- [ ] Implementar `enrichDataJudWithGoogle()`
- [ ] Implementar `getTribunalDomain()`
- [ ] Adicionar logs detalhados

### Fase 2: Modificar fluxo principal (30 min)
- [ ] Alterar `searchAll()` para nova estratégia
- [ ] Manter fallback para Google genérico
- [ ] Ajustar consolidação de resultados

### Fase 3: Testes (30 min)
- [ ] Testar com DataJud funcionando
- [ ] Testar com DataJud falhando (fallback)
- [ ] Verificar performance (5-8s)
- [ ] Validar metadados oficiais

### Fase 4: Deploy (15 min)
- [ ] Commit com mensagem clara
- [ ] Push para main
- [ ] Testar em produção (iarom.com.br)
- [ ] Monitorar logs no Render

---

## 🎯 Resultado Esperado

```
Usuário: "Busque jurisprudência sobre dano moral"

ROM Agent:
🔍 Buscando na fonte oficial do CNJ (DataJud)...
✅ Encontrados 10 processos no STJ
🔍 Enriquecendo com ementas do Google...
✅ 10 ementas encontradas
📄 Processando textos completos...

RESULTADO (5.2s):

1. **Apelação Cível nº 1234567-89.2023.4.01.0000**
   📋 Tribunal: STJ | 3ª Turma
   🏛️ Classe: Apelação Cível
   📌 Assunto: Dano Moral
   📅 Ajuizamento: 15/01/2023

   **EMENTA:** Dano moral. Responsabilidade civil. Valor da indenização...
   [texto completo de 500 palavras]

   🔗 Fonte: DataJud CNJ + Google Search
   ✅ Validado oficialmente

[... mais 9 resultados similares]
```

**Total: 5.2 segundos | 10 jurisprudências | 100% oficiais | 100% completas**

---

**Status:** ✅ PROPOSTA APROVADA
**Próxima ação:** Implementar código
