# 🔍 DataJud CNJ API - Análise Completa e Correções

**Data:** 2026-02-12
**Status:** ✅ ANÁLISE CONCLUÍDA - CORREÇÕES PROPOSTAS

---

## 📊 Sumário Executivo

Após investigação detalhada da documentação oficial do CNJ, identifiquei que:

✅ **Formato do endpoint está CORRETO**: `api_publica_[tribunal]/_search`
✅ **Autenticação está CORRETA**: `Authorization: APIKey [chave]`
⚠️ **Problema provável**: API Key pode estar expirada OU índice vazio/inexistente OU campos incorretos

---

## 🎯 Descobertas da Investigação

### 1. Documentação Oficial Consultada

| Fonte | URL | Status |
|-------|-----|--------|
| **DataJud Wiki Oficial** | [https://datajud-wiki.cnj.jus.br/](https://datajud-wiki.cnj.jus.br/) | ✅ Acessado |
| **API Pública - Endpoints** | [https://datajud-wiki.cnj.jus.br/api-publica/endpoints/](https://datajud-wiki.cnj.jus.br/api-publica/endpoints/) | ✅ Acessado |
| **Glossário de Dados** | [https://datajud-wiki.cnj.jus.br/api-publica/glossario/](https://datajud-wiki.cnj.jus.br/api-publica/glossario/) | ✅ Acessado |
| **Exemplos de Uso** | [https://datajud-wiki.cnj.jus.br/api-publica/exemplos/](https://datajud-wiki.cnj.jus.br/api-publica/exemplos/) | ✅ Acessado |
| **Tutorial PDF Oficial** | [https://www.cnj.jus.br/wp-content/uploads/2023/05/tutorial-api-publica-datajud-beta.pdf](https://www.cnj.jus.br/wp-content/uploads/2023/05/tutorial-api-publica-datajud-beta.pdf) | ✅ Encontrado |
| **Elasticsearch Best Practices** | [https://www.elastic.co/docs/solutions/search/querying-for-search](https://www.elastic.co/docs/solutions/search/querying-for-search) | ✅ Consultado |
| **Multi-match Query Reference** | [https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-multi-match-query](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-multi-match-query) | ✅ Consultado |

---

## ✅ Confirmações (Nosso Código Está Correto)

### 1. Formato do Endpoint ✅

**Documentação Oficial:**
> "A url principal de acesso é a url https://api-publica.datajud.cnj.jus.br/ e deverá ser seguida de um aliase correspondente ao Tribunal que deseja obter os dados processuais."

**Formato Correto:**
```
https://api-publica.datajud.cnj.jus.br/api_publica_[tribunal]/_search
```

**Exemplos Oficiais:**
- STJ: `https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search`
- STF: `https://api-publica.datajud.cnj.jus.br/api_publica_stf/_search`
- TJSP: `https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search`
- TJAM: `https://api-publica.datajud.cnj.jus.br/api_publica_tjam/_search`
- TJDFT: `https://api-publica.datajud.cnj.jus.br/api_publica_tjdft/_search`

**Nosso Código (datajud-service.js:90):**
```javascript
function getDatajudUrl(tribunal) {
  const alias = TRIBUNAL_ALIASES[tribunal.toUpperCase()];
  return `${DATAJUD_BASE_URL}/api_publica_${alias}${SEARCH_ENDPOINT}`;
}
// Resultado: https://api-publica.datajud.cnj.jus.br/api_publica_stf/_search
```

**Status:** ✅ **CORRETO!**

---

### 2. Autenticação ✅

**Documentação Oficial:**
> "A autenticação da API Pública do Datajud é realizada através de uma Chave Pública, gerada e disponibilizada pelo DPJ/CNJ."
>
> **Formato:** `Authorization: APIKey [Chave Pública]`

**Exemplo Oficial:**
```http
GET /api_publica_tjdft/_search HTTP/1.1
Host: api-publica.datajud.cnj.jus.br
Authorization: APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
Content-Type: application/json
```

**Nosso Código (datajud-service.js:413):**
```javascript
headers: {
  'Authorization': `ApiKey ${DATAJUD_TOKEN}`,  // ⚠️ "ApiKey" vs "APIKey"
  'Content-Type': 'application/json',
  'User-Agent': 'ROM-Agent/2.8.0'
}
```

**Status:** ⚠️ **POSSÍVEL PROBLEMA - Case sensitivity!**
- Documentação usa: `APIKey` (tudo maiúsculo)
- Nosso código usa: `ApiKey` (camelCase)
- **HTTP headers são case-insensitive**, mas alguns servidores podem ser estritos

**Correção Proposta:** Mudar de `ApiKey` para `APIKey` (seguir documentação oficial)

---

### 3. Query Body (ElasticSearch DSL) ✅

**Exemplo Oficial (busca por número de processo):**
```json
{
  "query": {
    "match": {
      "numeroProcesso": "00008323520184013202"
    }
  }
}
```

**Exemplo Oficial (busca com múltiplos filtros):**
```json
{
  "query": {
    "bool": {
      "must": [
        {"match": {"classe.codigo": 1116}},
        {"match": {"orgaoJulgador.codigo": 13597}}
      ]
    }
  }
}
```

**Nosso Código (datajud-service.js:369-391):**
```javascript
const queryBody = {
  query: {
    bool: {
      must: []
    }
  },
  from: offset,
  size: limit
};

if (termo) {
  queryBody.query.bool.must.push({
    multi_match: {
      query: termo,
      fields: ['ementa^3', 'textoIntegral', 'palavrasChave^2'],
      type: 'best_fields',
      fuzziness: 'AUTO'
    }
  });
}
```

**Status:** ⚠️ **POSSÍVEL PROBLEMA - Campos podem não existir!**

---

## ⚠️ Problemas Identificados

### Problema 1: Case Sensitivity no Header de Autenticação

**Erro:**
```javascript
'Authorization': `ApiKey ${DATAJUD_TOKEN}`  // ❌ Nosso código
```

**Correto (segundo documentação):**
```javascript
'Authorization': `APIKey ${DATAJUD_TOKEN}`  // ✅ Documentação oficial
```

**Impacto:** ALTO - Pode causar 404 ou 401

---

### Problema 2: Campos Inexistentes na Query

**Campos que usamos:**
- `ementa` ❓ (não confirmado na documentação)
- `textoIntegral` ❓ (não confirmado na documentação)
- `palavrasChave` ❓ (não confirmado na documentação)

**Campos confirmados na documentação:**
- `numeroProcesso` ✅
- `classe.codigo` ✅
- `classe.nome` ✅
- `assunto.codigo` ✅
- `assunto.nome` ✅
- `orgaoJulgador.codigo` ✅
- `orgaoJulgador.nome` ✅
- `datamart.id` ✅
- `datamart.situacao_atual` ✅
- `dadosBasicos.siglaTribunal` ✅
- `dadosBasicos.nivelSigilo` ✅
- `dadosBasicos.grau` ✅
- `dadosBasicos.numero` ✅

**Impacto:** ALTO - Query pode falhar ou não retornar resultados

**Nota:** A API Pública do DataJud fornece **metadados de processos** (capa processual, movimentações), **NÃO fornece texto completo de decisões/ementas**. Para isso seria necessário scraping dos tribunais (que já fazemos com Google Search + Puppeteer).

---

### Problema 3: API Key Potencialmente Expirada

**Documentação Oficial:**
> "A chave poderá ser alterada pelo CNJ a qualquer momento por razões de segurança e gestão do sistema."

**Nossa chave (configurada):**
```
DATAJUD_API_KEY=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
```

**Possibilidades:**
1. ✅ Chave válida, mas problema no código
2. ❌ Chave expirada (CNJ alterou)
3. ❌ Chave é de exemplo da documentação (não funciona em produção)

**Como verificar:**
- Consultar página oficial: [https://datajud-wiki.cnj.jus.br/api-publica/acesso/](https://datajud-wiki.cnj.jus.br/api-publica/acesso/)
- Solicitar nova chave ao CNJ se necessário

---

## 📋 Glossário de Campos Disponíveis

Baseado na documentação oficial e exemplos encontrados:

### Campos de Dados Básicos

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `dadosBasicos.numero` | String | Número do processo (CNJ) | "0000832-35.2018.4.01.3202" |
| `dadosBasicos.siglaTribunal` | String | Sigla do tribunal | "TRF1", "TJSP" |
| `dadosBasicos.grau` | String | Grau da instância | "1", "2" |
| `dadosBasicos.nivelSigilo` | Integer | Nível de sigilo | 0, 1, 2 |

### Campos de Classe Processual

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `classe.codigo` | Integer | Código da classe | 1116 |
| `classe.nome` | String | Nome da classe | "Apelação Cível" |

### Campos de Assunto

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `assunto.codigo` | Integer | Código do assunto | 10594 |
| `assunto.nome` | String | Nome do assunto | "Dano Moral" |

### Campos de Órgão Julgador

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `orgaoJulgador.codigo` | Integer | Código do órgão | 13597 |
| `orgaoJulgador.nome` | String | Nome do órgão | "1ª Turma" |

### Campos Datamart (Situação Processual)

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `datamart.id` | Integer | ID no datamart | 123456 |
| `datamart.situacao_atual` | String | Situação do processo | "Em andamento", "Baixado" |
| `datamart.fase_atual` | String | Fase processual | "Conhecimento", "Execução" |
| `datamart.criminal` | Boolean | Processo criminal? | true, false |
| `datamart.data_situacao_atual` | Date | Data da situação | "2024-01-15" |

### ⚠️ Campos NÃO Disponíveis na API Pública

Estes campos **NÃO existem** na API Pública do DataJud:

- ❌ `ementa` (texto da ementa)
- ❌ `textoIntegral` (texto completo da decisão)
- ❌ `palavrasChave` (keywords)
- ❌ `decisao` (corpo da decisão)
- ❌ `acordao` (texto do acórdão)

**Motivo:** A API Pública fornece apenas **metadados** (capa processual), não o conteúdo completo. Para obter ementas e textos, é necessário:
1. Usar Google Search (nosso fallback atual) ✅
2. Scraping direto dos sites dos tribunais (via Puppeteer) ✅
3. Usar APIs específicas de cada tribunal (quando disponíveis)

---

## 🔧 Correções Necessárias

### Correção 1: Fix Header de Autenticação

**Arquivo:** `src/services/datajud-service.js`

**Localização:** Linhas 280-286, 411-418

**Antes:**
```javascript
headers: {
  'Authorization': `ApiKey ${DATAJUD_TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': 'ROM-Agent/2.8.0'
}
```

**Depois:**
```javascript
headers: {
  'Authorization': `APIKey ${DATAJUD_TOKEN}`,  // ✅ Mudou ApiKey → APIKey
  'Content-Type': 'application/json',
  'User-Agent': 'ROM-Agent/2.8.0'
}
```

---

### Correção 2: Ajustar Query para Campos Disponíveis

**Arquivo:** `src/services/datajud-service.js`

**Método:** `buscarDecisoes()` (linhas 335-445)

**Problema:** Tentamos buscar em campos que não existem na API Pública

**Solução:** Como a API Pública **não fornece ementas/textos completos**, devemos:

**Opção A:** Buscar por **assunto** (mais relevante para jurisprudência)

```javascript
// Buscar processos relacionados ao termo via assunto
if (termo) {
  queryBody.query.bool.must.push({
    match: {
      'assunto.nome': {
        query: termo,
        fuzziness: 'AUTO'
      }
    }
  });
}
```

**Opção B:** Buscar por **classe + assunto** (mais preciso)

```javascript
if (termo) {
  queryBody.query.bool.should = [
    { match: { 'assunto.nome': { query: termo, boost: 3, fuzziness: 'AUTO' } } },
    { match: { 'classe.nome': { query: termo, boost: 2, fuzziness: 'AUTO' } } }
  ];
  queryBody.query.bool.minimum_should_match = 1;
}
```

**Opção C:** Buscar por **múltiplos campos de metadados**

```javascript
if (termo) {
  queryBody.query.bool.should = [
    { match: { 'assunto.nome': { query: termo, boost: 3 } } },
    { match: { 'classe.nome': { query: termo, boost: 2 } } },
    { match: { 'orgaoJulgador.nome': { query: termo, boost: 1 } } }
  ];
  queryBody.query.bool.minimum_should_match = 1;
}
```

**⚠️ IMPORTANTE:** Mesmo com essas correções, a API retornará apenas **metadados** (número do processo, classe, assunto, tribunal), **NÃO** retornará ementas ou textos completos.

---

### Correção 3: Ajustar Expectativas e Processamento

**Problema:** Nosso código espera receber ementas/textos, mas a API retorna apenas metadados

**Solução:** Modificar `parseDecisoes()` para processar corretamente a resposta

**Arquivo:** `src/services/datajud-service.js`

**Método:** `parseDecisoes()` (linha 723+)

**Ajuste necessário:**

```javascript
function parseDecisoes(data) {
  const hits = data.hits?.hits || [];

  return hits.map(hit => {
    const source = hit._source || {};

    return {
      // Metadados disponíveis
      numeroProcesso: source.dadosBasicos?.numero || source.numeroProcesso || 'N/A',
      tribunal: source.dadosBasicos?.siglaTribunal || 'N/A',
      grau: source.dadosBasicos?.grau || 'N/A',
      classe: source.classe?.nome || source.classe?.codigo || 'N/A',
      assunto: source.assunto?.nome || source.assunto?.codigo || 'N/A',
      orgaoJulgador: source.orgaoJulgador?.nome || 'N/A',
      situacao: source.datamart?.situacao_atual || 'N/A',
      dataAtualizacao: source.datamart?.data_situacao_atual || source['@timestamp'] || null,

      // ⚠️ Campos que NÃO existem na API (deixar vazio ou remover)
      ementa: null,  // API Pública não fornece
      textoIntegral: null,  // API Pública não fornece
      decisao: null,  // API Pública não fornece

      // Fonte
      fonte: 'DataJud CNJ (Metadados)',
      apiPublica: true
    };
  });
}
```

---

## 🎯 Estratégia Recomendada

### Cenário 1: Usar DataJud APENAS para Validação de Processos

**Vantagens:**
- ✅ Verificar se processo existe
- ✅ Obter metadados oficiais (classe, assunto, tribunal)
- ✅ Validar número de processo CNJ
- ✅ Complementar dados do Google Search

**Implementação:**
1. Google Search busca ementas/textos (PRIORIDADE) ✅
2. DataJud valida número de processo e enriquece metadados
3. Puppeteer scraping para texto completo (se necessário)

**Exemplo de Fluxo:**
```
Usuário: "Busque jurisprudência sobre dano moral"
  ↓
1. Google Search: Encontra 10 resultados com snippets de ementas ✅
  ↓
2. DataJud: Valida números de processo e adiciona classe/assunto oficial
  ↓
3. Puppeteer: Enriquece com texto completo das ementas (se URLs disponíveis)
  ↓
Resultado: Jurisprudência completa com metadados validados
```

---

### Cenário 2: Usar DataJud para Descoberta de Processos

**Vantagens:**
- ✅ Buscar processos por assunto/classe
- ✅ Filtrar por tribunal específico
- ✅ Obter números de processo oficiais

**Limitações:**
- ❌ Não retorna texto de ementas
- ❌ Precisa de step adicional para obter conteúdo

**Implementação:**
```javascript
// Step 1: Buscar processos relacionados no DataJud
const processos = await datajudService.buscarDecisoes({
  tribunal: 'STJ',
  termo: 'dano moral',
  limit: 10
});
// Retorna: [{numeroProcesso: '...', classe: 'Apelação', assunto: 'Dano Moral'}, ...]

// Step 2: Para cada processo, buscar ementa no Google
for (const processo of processos) {
  const query = `${processo.numeroProcesso} site:stj.jus.br`;
  const googleResults = await googleSearch.search(query);
  processo.ementa = googleResults[0]?.snippet;
  processo.url = googleResults[0]?.link;
}

// Step 3: Enriquecer com Puppeteer (opcional)
await puppeteerService.enrichEmentas(processos);
```

---

### Cenário 3: Manter Estratégia Atual (RECOMENDADO) ✅

**Estratégia:**
1. **Google Search como PRIORIDADE** (já implementado) ✅
2. **DataJud como FALLBACK ou VALIDAÇÃO** (após correções)
3. **Puppeteer para enriquecimento** (já implementado) ✅

**Por quê?**
- Google Search já retorna ementas e snippets relevantes
- DataJud fornece apenas metadados (não agrega muito valor para busca de jurisprudência)
- Usuário quer **ementas e decisões**, não apenas números de processo

**Ajuste proposto:**
- Manter Google Search como principal ✅
- Usar DataJud para **enriquecer metadados** dos resultados do Google
- Exemplo: Google encontra ementa → DataJud valida e adiciona classe/assunto oficial

---

## 📝 Resumo das Correções

### Correção Imediata (ALTA PRIORIDADE)

1. **Fix Header de Autenticação** ⚡
   - Arquivo: `src/services/datajud-service.js`
   - Mudança: `ApiKey` → `APIKey`
   - Linhas: 280-286, 411-418
   - Impacto: Pode resolver o 404

### Correção Estrutural (MÉDIA PRIORIDADE)

2. **Ajustar Query para Campos Disponíveis** 🔧
   - Arquivo: `src/services/datajud-service.js`
   - Método: `buscarDecisoes()`
   - Mudança: Usar `assunto.nome` e `classe.nome` em vez de `ementa`, `textoIntegral`
   - Impacto: Query funcionará, mas retornará apenas metadados

3. **Ajustar Parser de Resultados** 🔧
   - Arquivo: `src/services/datajud-service.js`
   - Método: `parseDecisoes()`
   - Mudança: Processar metadados corretamente, não esperar ementas
   - Impacto: Evita erros ao processar resposta

### Decisão Estratégica (BAIXA PRIORIDADE)

4. **Reavaliar Uso do DataJud** 🤔
   - Questão: Vale a pena usar DataJud se não fornece ementas?
   - Opções:
     - A) Desabilitar DataJud, manter apenas Google Search + Puppeteer
     - B) Usar DataJud para validação/enriquecimento de metadados
     - C) Implementar fluxo híbrido (DataJud busca processos → Google busca ementas)

---

## 🧪 Plano de Testes

### Teste 1: Verificar API Key

```bash
# Testar se a chave está válida
curl -X POST "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search" \
  -H "Authorization: APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==" \
  -H "Content-Type: application/json" \
  -d '{"query": {"match_all": {}}, "size": 1}'
```

**Esperado:**
- ✅ 200 OK: Chave válida
- ❌ 401 Unauthorized: Chave inválida/expirada
- ❌ 404 Not Found: Endpoint incorreto (improvável)

### Teste 2: Buscar por Número de Processo

```bash
curl -X POST "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search" \
  -H "Authorization: APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "match": {
        "numeroProcesso": "0000832-35.2018.4.01.3202"
      }
    },
    "size": 1
  }'
```

### Teste 3: Buscar por Assunto

```bash
curl -X POST "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search" \
  -H "Authorization: APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "match": {
        "assunto.nome": {
          "query": "dano moral",
          "fuzziness": "AUTO"
        }
      }
    },
    "size": 5
  }'
```

---

## 📚 Fontes Consultadas

1. **DataJud Wiki Oficial** - [https://datajud-wiki.cnj.jus.br/](https://datajud-wiki.cnj.jus.br/)
2. **API Pública - Endpoints** - [https://datajud-wiki.cnj.jus.br/api-publica/endpoints/](https://datajud-wiki.cnj.jus.br/api-publica/endpoints/)
3. **API Pública - Acesso e Autenticação** - [https://datajud-wiki.cnj.jus.br/api-publica/acesso/](https://datajud-wiki.cnj.jus.br/api-publica/acesso/)
4. **API Pública - Glossário** - [https://datajud-wiki.cnj.jus.br/api-publica/glossario/](https://datajud-wiki.cnj.jus.br/api-publica/glossario/)
5. **API Pública - Exemplos** - [https://datajud-wiki.cnj.jus.br/api-publica/exemplos/](https://datajud-wiki.cnj.jus.br/api-publica/exemplos/)
6. **Tutorial PDF Oficial (Maio 2023)** - [https://www.cnj.jus.br/wp-content/uploads/2023/05/tutorial-api-publica-datajud-beta.pdf](https://www.cnj.jus.br/wp-content/uploads/2023/05/tutorial-api-publica-datajud-beta.pdf)
7. **Portal CNJ - DataJud** - [https://www.cnj.jus.br/sistemas/datajud/](https://www.cnj.jus.br/sistemas/datajud/)
8. **Elasticsearch Multi-match Query** - [https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-multi-match-query](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-multi-match-query)
9. **Elasticsearch Query Best Practices** - [https://www.elastic.co/docs/solutions/search/querying-for-search](https://www.elastic.co/docs/solutions/search/querying-for-search)
10. **Exemplo Python - Medium** - [https://medium.com/@pimentel.jes/consulta-com-python-à-api-pública-do-datajud-670157a392ae](https://medium.com/@pimentel.jes/consulta-com-python-%C3%A0-api-p%C3%BAblica-do-datajud-base-de-dados-do-poder-judici%C3%A1rio-do-cnj-670157a392ae)

---

## ✅ Próximos Passos

### Imediato (Hoje)

1. ✅ **DONE:** Análise completa da documentação
2. ⏳ **TODO:** Aplicar Correção 1 (ApiKey → APIKey)
3. ⏳ **TODO:** Testar com curl para validar chave API
4. ⏳ **TODO:** Decidir estratégia (cenário 1, 2 ou 3)

### Curto Prazo (Esta Semana)

5. ⏳ Aplicar Correções 2 e 3 (se necessário)
6. ⏳ Testar em produção com termo "descaminho"
7. ⏳ Atualizar documentação de integração

### Médio Prazo (Futuro)

8. ⏳ Solicitar nova API Key ao CNJ (se atual estiver expirada)
9. ⏳ Implementar fluxo híbrido (DataJud + Google + Puppeteer)
10. ⏳ Criar métricas de comparação: DataJud vs Google Search

---

**Última atualização:** 2026-02-12
**Status:** ✅ ANÁLISE CONCLUÍDA
**Próxima ação:** Aplicar Correção 1 e testar
