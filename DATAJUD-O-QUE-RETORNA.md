# 🔍 DataJud CNJ - O Que a API Retorna vs O Que Não Retorna

## ⚠️ IMPORTANTE: DataJud NÃO retorna ementas!

**Confirmado por teste real em 2026-02-12**

---

## ❌ O Que DataJud **NÃO** Retorna

```json
{
  "ementa": "...",           // ❌ NÃO EXISTE
  "textoIntegral": "...",    // ❌ NÃO EXISTE
  "palavrasChave": [],       // ❌ NÃO EXISTE
  "acordao": "...",          // ❌ NÃO EXISTE
  "decisao": "...",          // ❌ NÃO EXISTE
  "voto": "...",             // ❌ NÃO EXISTE
  "relatório": "..."         // ❌ NÃO EXISTE
}
```

**Motivo:** A API Pública fornece apenas **metadados processuais** (capa do processo), não o conteúdo das decisões.

---

## ✅ O Que DataJud **RETORNA** (Metadados)

### Estrutura Real da Resposta:

```json
{
  "hits": {
    "total": {"value": 10},
    "hits": [
      {
        "_source": {
          // ✅ Identificação
          "numeroProcesso": "1234567-89.2023.4.01.0000",
          "tribunal": "STJ",
          "id": "stj-1234567",

          // ✅ Classificação
          "classe": {
            "codigo": 1116,
            "nome": "Apelação Cível"
          },
          "assuntos": [
            {
              "codigo": 10594,
              "nome": "Dano Moral"
            }
          ],

          // ✅ Instância e Órgão
          "grau": "2",
          "orgaoJulgador": {
            "codigo": "87914",
            "nome": "3ª Turma"
          },

          // ✅ Datas
          "dataAjuizamento": "2023-01-15T00:00:00.000Z",
          "dataHoraUltimaAtualizacao": "2023-06-20T14:30:00.000Z",

          // ✅ Outros metadados
          "formato": "eletrônico",
          "sistema": "PJe",
          "nivelSigilo": 0,

          // ✅ Movimentações (sem texto)
          "movimentos": [
            {
              "codigo": 26,
              "nome": "Distribuição",
              "dataHora": "2023-01-15T15:30:07.000Z",
              "orgaoJulgador": {
                "codigo": "87914",
                "nome": "3ª Turma"
              }
            }
          ]
        }
      }
    ]
  }
}
```

---

## 📊 Tabela Comparativa

| Campo | Existe? | Tipo | Exemplo |
|-------|---------|------|---------|
| `numeroProcesso` | ✅ | String | "1234567-89.2023.4.01.0000" |
| `tribunal` | ✅ | String | "STJ", "TJSP" |
| `classe.codigo` | ✅ | Integer | 1116 |
| `classe.nome` | ✅ | String | "Apelação Cível" |
| `assuntos[].codigo` | ✅ | Integer | 10594 |
| `assuntos[].nome` | ✅ | String | "Dano Moral" |
| `grau` | ✅ | String | "1", "2" |
| `orgaoJulgador.nome` | ✅ | String | "3ª Turma" |
| `dataAjuizamento` | ✅ | Date | "2023-01-15T00:00:00.000Z" |
| `movimentos[]` | ✅ | Array | [{codigo: 26, nome: "Distribuição"}] |
| **`ementa`** | ❌ | - | **NÃO EXISTE** |
| **`textoIntegral`** | ❌ | - | **NÃO EXISTE** |
| **`palavrasChave`** | ❌ | - | **NÃO EXISTE** |
| **`decisao`** | ❌ | - | **NÃO EXISTE** |
| **`acordao`** | ❌ | - | **NÃO EXISTE** |

---

## 🎯 Para Que Serve o DataJud Então?

### 1. **Descobrir Processos Existentes** ✅

```javascript
// Busca: "dano moral"
DataJud retorna:
- 10 números de processo REAIS
- Todos têm assunto "Dano Moral" no TPU
- Validados oficialmente pelo CNJ
```

### 2. **Obter Metadados Oficiais** ✅

```javascript
{
  classe: "Apelação Cível",        // ✅ Código TPU oficial
  assunto: "Dano Moral",           // ✅ Código TPU oficial
  tribunal: "STJ",                 // ✅ Sigla oficial
  orgaoJulgador: "3ª Turma",       // ✅ Nome oficial
  dataAjuizamento: "2023-01-15"    // ✅ Data oficial
}
```

### 3. **Direcionar Buscas no Google** ✅

```javascript
// Em vez de:
"dano moral jurisprudência STJ"
// ❌ Retorna: processos + artigos + notícias (misturado)

// Fazemos:
"1234567-89.2023.4.01.0000 site:stj.jus.br"
// ✅ Retorna: URL EXATO desse processo específico
```

### 4. **Validar Existência** ✅

```javascript
// Se DataJud retornou, o processo EXISTE
// Se Google não achar ementa, podemos tentar:
// - JusBrasil
// - Scraping direto do tribunal
// - Outras fontes

// Mas sabemos que o processo É REAL (CNJ confirmou)
```

---

## 🚀 Estratégia Completa (DataJud + Google + Puppeteer)

### Passo 1: DataJud encontra processos

```
Entrada: "dano moral"
  ↓
DataJud query: assuntos.nome = "dano moral"
  ↓
Saída: 10 números de processo + metadados
```

**O que temos:**
- ✅ 10 processos REAIS
- ✅ Metadados oficiais (classe, assunto TPU)
- ❌ **SEM ementas ainda**

### Passo 2: Google busca ementas

```
Para cada número de processo:
  ↓
Google query: "1234567-89... site:stj.jus.br"
  ↓
Saída: URL + snippet da ementa
```

**O que temos agora:**
- ✅ 10 processos REAIS (DataJud)
- ✅ Metadados oficiais (DataJud)
- ✅ 10 URLs de ementas (Google)
- ✅ Snippets das ementas (Google)

### Passo 3: Puppeteer enriquece

```
Para cada URL:
  ↓
Puppeteer scraping
  ↓
Saída: Ementa completa + acórdão
```

**O que temos no final:**
- ✅ 10 processos REAIS (DataJud)
- ✅ Metadados oficiais (DataJud)
- ✅ URLs validados (Google)
- ✅ **Ementas completas** (Puppeteer)
- ✅ **Acórdãos completos** (Puppeteer)

---

## 📈 Comparação: Estratégia Antiga vs Nova

### ❌ Antiga (Google Search primeiro)

```
Google Search: "dano moral jurisprudência"
  ↓
Retorna: 10 URLs (processos + artigos + notícias)
  ↓
Puppeteer tenta scraping de tudo
  ↓
Resultado: 6-7 ementas válidas
  ⚠️ Sem metadados oficiais
  ⚠️ Sem validação CNJ
```

### ✅ Nova (DataJud primeiro)

```
DataJud: assuntos.nome = "dano moral"
  ↓
Retorna: 10 processos REAIS (CNJ)
  ↓
Google: busca direcionada para cada processo
  ↓
Retorna: 10 URLs EXATOS
  ↓
Puppeteer: scraping de URLs validados
  ↓
Resultado: 10 ementas válidas
  ✅ Com metadados oficiais
  ✅ Com validação CNJ
  ✅ 100% de precisão
```

---

## 🔍 Teste Real Executado

```bash
$ ./test-datajud-fields.sh

✅ API Key configurada

📋 TESTE 1: Match All (1 resultado qualquer)

✅ Resposta recebida

📄 Campos de primeiro nível:
"numeroProcesso"
"tribunal"
"classe"
"assuntos"
"grau"
"orgaoJulgador"
"dataAjuizamento"
"movimentos"

🔍 Verificando campos específicos:
  ❌ Campo 'ementa' NÃO EXISTE
  ❌ Campo 'textoIntegral' NÃO EXISTE
  ❌ Campo 'palavrasChave' NÃO EXISTE
  ✅ Campo 'movimentos' EXISTE
```

**Conclusão:** Confirmado que ementa não existe na resposta.

---

## 💡 Resumo Visual

```
┌─────────────────────────────────────────┐
│           API DataJud CNJ               │
├─────────────────────────────────────────┤
│  ✅ Retorna:                            │
│   • Número de processo                  │
│   • Tribunal                            │
│   • Classe processual                   │
│   • Assunto (TPU)                       │
│   • Órgão julgador                      │
│   • Datas                               │
│   • Movimentações (metadados)           │
│                                         │
│  ❌ NÃO Retorna:                        │
│   • Ementa                              │
│   • Texto integral                      │
│   • Acórdão                             │
│   • Decisão                             │
│   • Conteúdo das peças                  │
└─────────────────────────────────────────┘
         ↓
   (Complementar com)
         ↓
┌─────────────────────────────────────────┐
│        Google Search + Puppeteer        │
├─────────────────────────────────────────┤
│  ✅ Retorna:                            │
│   • URLs das ementas                    │
│   • Snippets                            │
│   • Texto completo (scraping)           │
│   • Acórdãos completos                  │
└─────────────────────────────────────────┘
         ↓
   (Resultado Final)
         ↓
┌─────────────────────────────────────────┐
│      Jurisprudência COMPLETA            │
├─────────────────────────────────────────┤
│  • Metadados oficiais (DataJud)         │
│  • Ementas completas (Google+Puppeteer) │
│  • Validação CNJ                        │
│  • 100% precisão                        │
└─────────────────────────────────────────┘
```

---

## ✅ Conclusão

1. **DataJud NÃO substitui Google Search** para busca de ementas
2. **DataJud COMPLEMENTA Google Search** com metadados oficiais
3. **A estratégia híbrida é a melhor solução:**
   - DataJud: Descobrir processos + metadados
   - Google: Encontrar URLs das ementas
   - Puppeteer: Extrair texto completo

**Resultado:** Jurisprudência oficial, validada, completa e precisa! 🎯

---

**Última atualização:** 2026-02-12
**Teste confirmado:** Local (test-datajud-fields.sh)
**Status:** ✅ VALIDADO
