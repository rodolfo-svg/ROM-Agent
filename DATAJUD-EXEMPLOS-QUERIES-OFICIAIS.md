# 📚 DataJud CNJ - Exemplos de Queries Oficiais

**Fontes:**
- [DataJud Wiki - Tag Datamart](https://datajud-wiki.cnj.jus.br/para-tribunais/Datajud/tag-datamart/)
- [Abstraindo a API Pública do CNJ](https://www.tabnews.com.br/joaotextor/abstraindo-a-api-publica-do-cnj-datajud)
- [Tutorial Oficial CNJ](https://www.cnj.jus.br/wp-content/uploads/2023/05/tutorial-api-publica-datajud-beta.pdf)
- [Artigo Medium - José Eduardo Pimentel](https://medium.com/@pimentel.jes/consulta-com-python-%C3%A0-api-p%C3%BAblica-do-datajud-base-de-dados-do-poder-judici%C3%A1rio-do-cnj-670157a392ae)

---

## 🎯 Estrutura Correta de Queries

A API DataJud usa **Elasticsearch Query DSL**. A estrutura básica é:

```json
{
  "query": {
    "bool": {
      "must": [
        // Condições obrigatórias (AND)
      ],
      "should": [
        // Condições opcionais (OR)
      ],
      "must_not": [
        // Condições de exclusão (NOT)
      ]
    }
  },
  "from": 0,
  "size": 10
}
```

---

## 📋 Exemplo 1: Busca por Número de Processo

**Caso de uso:** Buscar um processo específico pelo número CNJ

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

**Query Equivalente:**
```json
{
  "query": {
    "match": {
      "numeroProcesso": "0000832-35.2018.4.01.3202"
    }
  },
  "size": 1
}
```

**Resposta Esperada:**
```json
{
  "hits": {
    "total": {"value": 1},
    "hits": [
      {
        "_source": {
          "numeroProcesso": "0000832-35.2018.4.01.3202",
          "tribunal": "TRF1",
          "classe": {"codigo": 1116, "nome": "Apelação Cível"},
          "assuntos": [
            {"codigo": 10594, "nome": "Dano Moral"}
          ],
          "grau": "2",
          "orgaoJulgador": {"codigo": "13597", "nome": "1ª Turma"},
          "dataAjuizamento": "2018-01-15T00:00:00.000Z"
        }
      }
    ]
  }
}
```

---

## 📋 Exemplo 2: Busca por Classe e Órgão Julgador

**Caso de uso:** Buscar apelações cíveis de um órgão julgador específico

```bash
curl -X POST "https://api-publica.datajud.cnj.jus.br/api_publica_tjdft/_search" \
  -H "Authorization: APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "bool": {
        "must": [
          {"match": {"classe.codigo": 1116}},
          {"match": {"orgaoJulgador.codigo": 13597}}
        ]
      }
    },
    "size": 10
  }'
```

**Query Equivalente:**
```json
{
  "query": {
    "bool": {
      "must": [
        {"match": {"classe.codigo": 1116}},
        {"match": {"orgaoJulgador.codigo": 13597}}
      ]
    }
  },
  "size": 10
}
```

**Campos Disponíveis para Busca:**
- `classe.codigo` - Código da classe processual (ex: 1116 = Apelação Cível)
- `classe.nome` - Nome da classe processual
- `orgaoJulgador.codigo` - Código do órgão julgador
- `orgaoJulgador.nome` - Nome do órgão (ex: "1ª Turma", "3ª Câmara")

---

## 📋 Exemplo 3: Busca com Paginação (search_after)

**Caso de uso:** Buscar processos com paginação eficiente

```bash
curl -X POST "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search" \
  -H "Authorization: APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "match_all": {}
    },
    "size": 10,
    "sort": [
      {"dataAjuizamento": "desc"}
    ]
  }'
```

**Para a próxima página (usando search_after):**
```json
{
  "query": {
    "match_all": {}
  },
  "size": 10,
  "sort": [
    {"dataAjuizamento": "desc"}
  ],
  "search_after": ["2023-12-31T23:59:59.999Z"]
}
```

**Nota:** O valor de `search_after` vem do campo `sort` do último resultado da página anterior.

---

## 📋 Exemplo 4: Busca por Assunto (Para Jurisprudência)

**Caso de uso:** Buscar processos relacionados a "Dano Moral"

```bash
curl -X POST "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search" \
  -H "Authorization: APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "match": {
        "assuntos.nome": {
          "query": "dano moral",
          "operator": "and"
        }
      }
    },
    "size": 10
  }'
```

**Query Equivalente (com fuzziness):**
```json
{
  "query": {
    "match": {
      "assuntos.nome": {
        "query": "dano moral",
        "operator": "and",
        "fuzziness": "AUTO"
      }
    }
  },
  "size": 10
}
```

**Nota:** Use `assuntos.nome` (plural) pois um processo pode ter múltiplos assuntos.

---

## 📋 Exemplo 5: Busca Avançada (Múltiplos Critérios)

**Caso de uso:** Buscar processos de 2º grau, sobre dano moral, em tribunal específico

```json
{
  "query": {
    "bool": {
      "must": [
        {"match": {"grau": "2"}},
        {"match": {"assuntos.nome": "dano moral"}},
        {"match": {"tribunal": "STJ"}}
      ],
      "filter": [
        {
          "range": {
            "dataAjuizamento": {
              "gte": "2023-01-01",
              "lte": "2023-12-31"
            }
          }
        }
      ]
    }
  },
  "size": 20,
  "sort": [
    {"dataAjuizamento": "desc"}
  ]
}
```

**Explicação:**
- `must`: Condições obrigatórias (AND)
- `filter`: Filtros que não afetam o score (mais eficiente)
- `range`: Filtro de data (entre 01/01/2023 e 31/12/2023)
- `sort`: Ordenar por data de ajuizamento (mais recente primeiro)

---

## 📋 Exemplo 6: Busca por Datamart (Situação Processual)

**Caso de uso:** Buscar processos em andamento com nível de sigilo >= 1

```json
{
  "query": {
    "bool": {
      "must": [
        {
          "range": {
            "dadosBasicos.nivelSigilo": {
              "gte": 1
            }
          }
        },
        {
          "term": {
            "datamart.id_situacao_atual": {
              "value": 25
            }
          }
        }
      ]
    }
  },
  "size": 10
}
```

**Campos Datamart:**
- `datamart.id_situacao_atual` - ID da situação (ex: 25 = em andamento)
- `datamart.situacao_atual` - Descrição da situação
- `datamart.fase_atual` - Fase processual
- `datamart.criminal` - Processo criminal? (boolean)

---

## 📋 Exemplo 7: Multi-match (Busca em Múltiplos Campos)

**Caso de uso:** Buscar "responsabilidade civil" em assunto OU classe

```json
{
  "query": {
    "multi_match": {
      "query": "responsabilidade civil",
      "fields": [
        "assuntos.nome^3",
        "classe.nome^2"
      ],
      "type": "best_fields",
      "operator": "and",
      "fuzziness": "AUTO"
    }
  },
  "size": 10
}
```

**Explicação:**
- `fields`: Lista de campos a buscar
- `^3` e `^2`: Boost (peso) - assunto tem mais importância
- `type: "best_fields"`: Prioriza documentos com match em um único campo
- `operator: "and"`: Todos os termos devem estar presentes
- `fuzziness: "AUTO"`: Tolera erros de digitação

---

## 🎯 Nossa Implementação Atual vs Correta

### ❌ Nossa Implementação Atual (INCORRETA)

```javascript
// ERRADO: Tentamos buscar em campos que não existem
{
  query: {
    bool: {
      must: [{
        multi_match: {
          query: termo,
          fields: ['ementa^3', 'textoIntegral', 'palavrasChave^2'], // ❌ Não existem!
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      }]
    }
  }
}
```

### ✅ Implementação Correta (Baseada nos Exemplos)

```javascript
// CORRETO: Buscar em campos que EXISTEM na API
{
  query: {
    bool: {
      must: [{
        multi_match: {
          query: termo,
          fields: [
            'assuntos.nome^3',      // ✅ Existe e é relevante
            'classe.nome^2',        // ✅ Existe
            'orgaoJulgador.nome'    // ✅ Existe
          ],
          type: 'best_fields',
          operator: 'and',
          fuzziness: 'AUTO'
        }
      }]
    }
  },
  from: offset,
  size: limit
}
```

---

## 🔧 Correção para buscarDecisoes()

### Opção 1: Busca Simples por Assunto

```javascript
const queryBody = {
  query: {
    match: {
      'assuntos.nome': {
        query: termo,
        operator: 'and',
        fuzziness: 'AUTO'
      }
    }
  },
  from: offset,
  size: limit,
  sort: [
    {'dataAjuizamento': 'desc'}
  ]
};
```

### Opção 2: Busca Multi-campo (RECOMENDADO)

```javascript
const queryBody = {
  query: {
    multi_match: {
      query: termo,
      fields: [
        'assuntos.nome^3',      // Maior peso para assunto
        'classe.nome^2',        // Peso médio para classe
        'orgaoJulgador.nome'    // Peso menor para órgão
      ],
      type: 'best_fields',
      operator: 'and',
      fuzziness: 'AUTO'
    }
  },
  from: offset,
  size: limit,
  sort: [
    {'_score': 'desc'},       // Ordenar por relevância primeiro
    {'dataAjuizamento': 'desc'}  // Depois por data
  ]
};
```

### Opção 3: Busca com Filtros (MAIS PRECISA)

```javascript
const queryBody = {
  query: {
    bool: {
      must: [
        {
          multi_match: {
            query: termo,
            fields: ['assuntos.nome^3', 'classe.nome^2'],
            type: 'best_fields',
            fuzziness: 'AUTO'
          }
        }
      ],
      filter: []
    }
  },
  from: offset,
  size: limit,
  sort: [
    {'_score': 'desc'},
    {'dataAjuizamento': 'desc'}
  ]
};

// Adicionar filtros opcionais
if (orgaoJulgador) {
  queryBody.query.bool.filter.push({
    match: {'orgaoJulgador.nome': orgaoJulgador}
  });
}

if (dataInicio || dataFim) {
  const rangeFilter = {dataAjuizamento: {}};
  if (dataInicio) rangeFilter.dataAjuizamento.gte = dataInicio;
  if (dataFim) rangeFilter.dataAjuizamento.lte = dataFim;
  queryBody.query.bool.filter.push({range: rangeFilter});
}
```

---

## 📊 Comparação: Antes vs Depois

### ❌ ANTES (Query Incorreta)

```javascript
// Buscava em campos inexistentes
fields: ['ementa^3', 'textoIntegral', 'palavrasChave^2']
// Resultado: 0 resultados (campos não existem)
```

### ✅ DEPOIS (Query Correta)

```javascript
// Busca em campos existentes e relevantes
fields: ['assuntos.nome^3', 'classe.nome^2', 'orgaoJulgador.nome']
// Resultado: Processos oficiais relacionados ao termo
```

---

## 🎯 Próximos Passos

1. **Corrigir query em `buscarDecisoes()`**
   - Usar campos corretos: `assuntos.nome`, `classe.nome`
   - Remover campos inexistentes: `ementa`, `textoIntegral`

2. **Testar se DataJud funciona**
   - Após correção do header (ApiKey → APIKey)
   - Query correta deve retornar processos

3. **Implementar estratégia nova**
   - DataJud busca processos (metadados oficiais)
   - Google busca ementas (direcionado por número de processo)
   - Puppeteer enriquece (texto completo)

---

## 📚 Fontes Consultadas

1. [DataJud Wiki - Tag Datamart](https://datajud-wiki.cnj.jus.br/para-tribunais/Datajud/tag-datamart/)
2. [Abstraindo a API Pública do CNJ - DataJud](https://www.tabnews.com.br/joaotextor/abstraindo-a-api-publica-do-cnj-datajud)
3. [Tutorial Oficial CNJ (PDF)](https://www.cnj.jus.br/wp-content/uploads/2023/05/tutorial-api-publica-datajud-beta.pdf)
4. [Artigo Medium - José Eduardo Pimentel](https://medium.com/@pimentel.jes/consulta-com-python-%C3%A0-api-p%C3%BAblica-do-datajud-base-de-dados-do-poder-judici%C3%A1rio-do-cnj-670157a392ae)
5. [Elasticsearch Multi-match Query Reference](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-multi-match-query)

---

**Última atualização:** 2026-02-12
**Status:** ✅ ANÁLISE COMPLETA
**Próxima ação:** Aplicar correções no código
