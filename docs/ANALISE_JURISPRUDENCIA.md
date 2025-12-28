# Sistema Universal de Análise de Jurisprudência

**ROM Agent - Busca Jurisprudencial Genérica**
Data: 2025-12-28
Versão: 2.0.0

---

## Visão Geral

O **ROM Agent** possui um sistema **UNIVERSAL** para análise jurisprudencial que aceita **QUALQUER consulta jurídica**.

Não existem teses pré-definidas ou temas específicos - o sistema funciona com **qualquer query** fornecida pelo usuário.

### Fontes Integradas

- **DataJud** - Base de dados oficial do CNJ
- **JusBrasil** - Maior plataforma de jurisprudência do Brasil
- **Google Custom Search** - Busca complementar em sites oficiais de tribunais

---

## Como Usar

### Sintaxe Básica

```bash
node scripts/analyze-jurisprudence.js --query "sua consulta aqui"
```

### Parâmetros

| Parâmetro | Obrigatório | Descrição | Exemplo |
|-----------|-------------|-----------|---------|
| `--query` | **SIM** | Consulta jurídica livre | `"usucapião extraordinária"` |
| `--tribunal` | Não | Filtrar por tribunal específico | `"STJ"`, `"STF"`, `"TJSP"` |
| `--limit` | Não | Número máximo de resultados | `20` (padrão) |

---

## Exemplos de Uso

### 1. Direito Civil - Usucapião

```bash
node scripts/analyze-jurisprudence.js \
  --query "usucapião extraordinária posse mansa pacífica"
```

### 2. Direito do Consumidor - Danos Morais

```bash
node scripts/analyze-jurisprudence.js \
  --query "danos morais quantum indenizatório protesto indevido" \
  --tribunal "STJ"
```

### 3. Direito de Família - Guarda

```bash
node scripts/analyze-jurisprudence.js \
  --query "guarda compartilhada melhor interesse criança" \
  --limit 30
```

### 4. Direito Trabalhista - Horas Extras

```bash
node scripts/analyze-jurisprudence.js \
  --query "horas extras banco de horas compensação" \
  --tribunal "TST"
```

### 5. Direito Penal - Dosimetria

```bash
node scripts/analyze-jurisprudence.js \
  --query "dosimetria pena circunstâncias judiciais art 59"
```

### 6. Direito Tributário - ICMS

```bash
node scripts/analyze-jurisprudence.js \
  --query "ICMS base de cálculo substituição tributária"
```

### 7. Direito Administrativo - Licitação

```bash
node scripts/analyze-jurisprudence.js \
  --query "licitação dispensa emergência calamidade pública"
```

### 8. Direito Processual - Honorários

```bash
node scripts/analyze-jurisprudence.js \
  --query "honorários advocatícios sucumbência recíproca"
```

---

## Saída do Sistema

### Formato JSON

O sistema gera um arquivo JSON completo:

```json
{
  "titulo": "ANÁLISE JURISPRUDENCIAL",
  "data": "2025-12-28",
  "consulta": "sua query aqui",
  "tribunal": "Todos" | "STJ" | "STF",
  "totalPrecedentes": 87,
  "precedentesRelevantes": 15,

  "precedentes": [
    {
      "ordem": 1,
      "tribunal": "STJ",
      "numero": "REsp 1.234.567",
      "ementa": "...",
      "data": "2024-01-15",
      "url": "https://...",
      "relevancia": "high"
    }
  ],

  "argumentacao": "Texto formatado com análise jurídica...",
  "fundamentacaoCompleta": "Texto pronto para petição..."
}
```

### Arquivo de Saída

- **Local:** `/tmp/analise-jurisprudencia-<timestamp>.json`
- **Formato:** JSON completo
- **Uso:** Pode ser importado para petições ou relatórios

---

## Priorização de Tribunais

O sistema automaticamente prioriza decisões de tribunais superiores:

| Posição | Tribunal | Peso |
|---------|----------|------|
| 1º | STF (Supremo Tribunal Federal) | 10 |
| 2º | STJ (Superior Tribunal de Justiça) | 9 |
| 3º | TST (Tribunal Superior do Trabalho) | 8 |
| 4º | TSE (Tribunal Superior Eleitoral) | 8 |
| 5º | TRFs (Tribunais Regionais Federais) | 7 |
| 6º | TJs (Tribunais de Justiça Estaduais) | 5 |

---

## Uso Programático

### Importar como Módulo

```javascript
import analisarJurisprudencia from './scripts/analyze-jurisprudence.js';

const resultado = await analisarJurisprudencia({
  query: 'responsabilidade civil dano moral',
  tribunal: 'STJ',
  limit: 25
});

console.log(resultado.fundamentacaoCompleta);
```

### Integração com Outros Scripts

```javascript
// Buscar múltiplas queries
const queries = [
  'usucapião extraordinária',
  'danos morais quantum',
  'guarda compartilhada'
];

for (const query of queries) {
  const resultado = await analisarJurisprudencia({ query });
  // processar resultado...
}
```

---

## Arquitetura

### Fluxo de Funcionamento

```
1. Usuário fornece query livre
2. Sistema busca em paralelo:
   - DataJud (CNJ)
   - JusBrasil (Puppeteer)
   - Google Search
3. Consolidação de resultados
4. Ranking por relevância e tribunal
5. Geração de relatório executivo
```

### Componentes

```
ROM-Agent/
├── scripts/
│   └── analyze-jurisprudence.js        # Script universal
├── src/
│   ├── services/
│   │   ├── datajud-service.js          # Integração DataJud
│   │   ├── jurisprudence-search-service.js  # Orquestrador
│   └── lib/
│       └── jusbrasil-client.js         # Cliente JusBrasil
└── docs/
    └── ANALISE_JURISPRUDENCIA.md       # Esta documentação
```

---

## Configuração (Opcional)

### Variáveis de Ambiente

```bash
# .env (TODAS OPCIONAIS - sistema funciona sem elas)
DATAJUD_API_KEY=sua_chave              # Acesso completo ao DataJud
JUSBRASIL_EMAIL=seu_email              # Login JusBrasil
JUSBRASIL_SENHA=sua_senha              # Senha JusBrasil
GOOGLE_SEARCH_API_KEY=sua_chave        # Google Custom Search
GOOGLE_SEARCH_CX=seu_cx_id             # ID do mecanismo de busca
```

**Nota:** O sistema funciona mesmo sem credenciais, mas com acesso limitado.

---

## Casos de Uso Reais

### 1. Petição Inicial - Ação de Indenização

```bash
node scripts/analyze-jurisprudence.js \
  --query "danos morais protesto indevido valor excessivo" \
  --tribunal "STJ" \
  --limit 15
```

**Uso:** Copiar fundamentação jurisprudencial para petição inicial.

### 2. Recurso - Apelação Cível

```bash
node scripts/analyze-jurisprudence.js \
  --query "reforma sentença cerceamento defesa prova pericial"
```

**Uso:** Buscar precedentes favoráveis para recurso.

### 3. Contestação - Ação Trabalhista

```bash
node scripts/analyze-jurisprudence.js \
  --query "horas extras controle jornada ponto eletrônico" \
  --tribunal "TST"
```

**Uso:** Fundamentar tese de defesa.

### 4. Parecer Jurídico

```bash
node scripts/analyze-jurisprudence.js \
  --query "licitação menor preço melhor técnica" \
  --limit 30
```

**Uso:** Elaborar parecer com análise jurisprudencial.

---

## Diferenças da Versão Anterior

### ❌ Versão 1.0 (Específica - REMOVIDA)

- Teses pré-definidas de penhora
- Classificação automática por tipo de bem
- Limitada a 8 teses específicas
- Focada apenas em execução

### ✅ Versão 2.0 (Universal - ATUAL)

- **Aceita qualquer consulta jurídica**
- Sem teses pré-definidas
- **Totalmente flexível**
- Funciona para qualquer área do direito

---

## Suporte e Contribuições

### Reportar Problemas

- **GitHub Issues:** https://github.com/rodolfo-svg/ROM-Agent/issues
- **Email:** contato@iarom.com.br

### Melhorias Futuras

- [ ] Cache inteligente de precedentes
- [ ] Análise de similaridade por ML
- [ ] Integração automática com templates de petições
- [ ] Dashboard analytics de jurisprudência
- [ ] Export para DOCX formatado

---

## Exemplos Avançados

### Busca com Múltiplos Termos

```bash
node scripts/analyze-jurisprudence.js \
  --query "responsabilidade civil objetiva relação consumo dano material lucros cessantes" \
  --limit 40
```

### Filtro por Tribunal Estadual

```bash
node scripts/analyze-jurisprudence.js \
  --query "usucapião urbana área pública" \
  --tribunal "TJSP"
```

### Pesquisa Ampla

```bash
node scripts/analyze-jurisprudence.js \
  --query "pacto antenupcial regime bens separação obrigatória" \
  --limit 50
```

---

**Desenvolvido por:**
ROM Agent - Redator de Obras Magistrais
Rodolfo Otávio Mota Advogados Associados
2025
