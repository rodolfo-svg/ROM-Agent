# Análise de Jurisprudência para Redução de Penhora

**Documentação do Sistema de Busca Jurisprudencial Especializado**
Data: 2025-12-28
Versão: 1.0.0

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Como Usar](#como-usar)
4. [Teses Jurídicas Implementadas](#teses-jurídicas-implementadas)
5. [Fontes de Jurisprudência](#fontes-de-jurisprudência)
6. [Exemplos de Uso](#exemplos-de-uso)
7. [Saída e Relatórios](#saída-e-relatórios)
8. [Integração com ROM Agent](#integração-com-rom-agent)

---

## Visão Geral

O **ROM Agent** possui um sistema especializado para análise jurisprudencial focado em **redução ou desconstituição de penhora**. Este sistema integra múltiplas fontes oficiais e especializadas:

- **DataJud** - Base de dados oficial do CNJ
- **JusBrasil** - Maior plataforma de jurisprudência do Brasil
- **Google Search** - Busca complementar em sites oficiais de tribunais

### Objetivo

Fornecer fundamentação jurisprudencial sólida para **petições de embargos à execução** e **impugnação ao cumprimento de sentença**, com foco específico em argumentos para redução ou remoção de penhora.

---

## Arquitetura

### Componentes Principais

```
ROM-Agent/
├── scripts/
│   └── analyze-garnishment-reduction.js    # Script principal de análise
├── src/
│   ├── services/
│   │   ├── datajud-service.js              # Integração com DataJud (CNJ)
│   │   ├── jurisprudence-search-service.js # Orquestração de busca
│   └── lib/
│       └── jusbrasil-client.js             # Cliente JusBrasil (Puppeteer)
└── docs/
    └── ANALISE_REDUCAO_PENHORA.md          # Esta documentação
```

### Fluxo de Funcionamento

1. **Classificação** - Identifica o tipo de bem penhorado
2. **Seleção de Teses** - Escolhe teses jurídicas aplicáveis
3. **Busca Paralela** - Consulta DataJud, JusBrasil e Google simultaneamente
4. **Consolidação** - Agrega e filtra resultados por relevância
5. **Geração de Resumo** - Cria relatório executivo com fundamentação

---

## Como Usar

### Instalação e Configuração

1. **Verificar dependências:**

```bash
# Navegue até o diretório do projeto
cd /Users/rodolfootaviopereiradamotaoliveira/ROM-Agent

# Instale as dependências (se necessário)
npm install
```

2. **Configurar variáveis de ambiente:**

```bash
# .env
DATAJUD_API_KEY=sua_chave_datajud     # (Opcional - funciona sem)
JUSBRASIL_EMAIL=seu_email             # (Opcional - funciona sem)
JUSBRASIL_SENHA=sua_senha             # (Opcional - funciona sem)
GOOGLE_SEARCH_API_KEY=sua_chave       # (Opcional - funciona sem)
GOOGLE_SEARCH_CX=seu_cx_id            # (Opcional - funciona sem)
```

**Nota:** O sistema funciona mesmo sem as credenciais configuradas, mas com acesso limitado.

### Uso via CLI

#### Exemplo 1: Análise Geral de Penhora

```bash
node scripts/analyze-garnishment-reduction.js \
  --case "Redução de penhora"
```

#### Exemplo 2: Bem de Família

```bash
node scripts/analyze-garnishment-reduction.js \
  --bemPenhorado "imóvel residencial único" \
  --descricaoCaso "Único imóvel de residência da família"
```

#### Exemplo 3: Penhora de Salário

```bash
node scripts/analyze-garnishment-reduction.js \
  --bemPenhorado "salário em conta bancária" \
  --valorDebito "R$ 50.000,00" \
  --valorPenhorado "R$ 15.000,00"
```

#### Exemplo 4: Instrumento de Trabalho

```bash
node scripts/analyze-garnishment-reduction.js \
  --bemPenhorado "veículo de trabalho" \
  --descricaoCaso "Caminhão utilizado para transporte de cargas"
```

#### Exemplo 5: Valor Excessivo

```bash
node scripts/analyze-garnishment-reduction.js \
  --bemPenhorado "quantia excessiva" \
  --valorDebito "R$ 100.000,00" \
  --valorPenhorado "R$ 300.000,00"
```

### Uso Programático (via Node.js)

```javascript
import analisarReducaoPenhora from './scripts/analyze-garnishment-reduction.js';

const resultado = await analisarReducaoPenhora({
  descricaoCaso: 'Penhora de bem de família',
  bemPenhorado: 'imóvel único de residência',
  valorDebito: 'R$ 80.000,00',
  valorPenhorado: 'R$ 300.000,00',
  tribunal: 'TJSP'  // Opcional: filtrar por tribunal
});

console.log(resultado.fundamentacaoCompleta);
```

---

## Teses Jurídicas Implementadas

O sistema possui **8 teses pré-configuradas** para redução de penhora:

### 1. **Impenhorabilidade de Bem de Família**
- **Fundamento:** Art. 1º, Lei 8.009/90
- **Aplicação:** Único imóvel residencial do devedor e sua família
- **Query:** `"impenhorabilidade bem de família Lei 8009/90"`

### 2. **Impenhorabilidade de Salário**
- **Fundamento:** Art. 833, IV, CPC
- **Aplicação:** Penhora de salário acima de 50 salários mínimos
- **Query:** `"impenhorabilidade salário vencimentos Art. 833"`

### 3. **Impenhorabilidade de Instrumento de Trabalho**
- **Fundamento:** Art. 833, V, CPC
- **Aplicação:** Ferramentas, equipamentos e veículos essenciais ao trabalho
- **Query:** `"impenhorabilidade instrumentos de trabalho profissional"`

### 4. **Redução por Proporcionalidade**
- **Fundamento:** Princípio da proporcionalidade
- **Aplicação:** Valor do bem penhorado muito superior ao débito
- **Query:** `"redução penhora proporcionalidade excessiva garantia"`

### 5. **Substituição de Penhora**
- **Fundamento:** Art. 847, CPC
- **Aplicação:** Oferta de bem de menor valor ou fiança bancária
- **Query:** `"substituição penhora Art. 847 CPC bem menos gravoso"`

### 6. **Penhora de Quantia Excessiva**
- **Fundamento:** Penhora deve ser limitada a 110% do débito
- **Aplicação:** Valor penhorado excede significativamente a dívida
- **Query:** `"penhora quantia excessiva redução 10% valor"`

### 7. **Fragilidade do Título Executivo**
- **Fundamento:** Título com vícios ou irregularidades
- **Aplicação:** Excesso de execução, prescrição ou nulidades
- **Query:** `"desconstituição penhora fragilidade título executivo"`

### 8. **Penhora de Valores em Conta (Tema 1.103 STJ)**
- **Fundamento:** Tema 1.103 STJ - Limitação de penhora em conta
- **Aplicação:** Proteção de valores essenciais à subsistência
- **Query:** `"impenhorabilidade valores conta salário pensão"`

---

## Fontes de Jurisprudência

### 1. DataJud (CNJ)

**Status:** Integrado (requer API Key)

- **Base Oficial** do Conselho Nacional de Justiça
- **Acesso:** https://datajud-wiki.cnj.jus.br/
- **Cobertura:** Todos os tribunais brasileiros
- **Vantagem:** Dados oficiais e confiáveis

**Implementação:**
```javascript
// src/services/datajud-service.js
import datajudService from '../services/datajud-service.js';

const processos = await datajudService.buscarProcessos({
  tribunal: 'STJ',
  assunto: 'Penhora',
  limit: 50
});
```

### 2. JusBrasil

**Status:** Integrado (web scraping com Puppeteer)

- **Maior plataforma** de jurisprudência do Brasil
- **Acesso:** Autenticado via login (requer credenciais)
- **Cobertura:** STF, STJ, TST, TRFs, TJs
- **Vantagem:** Interface amigável e resultados bem formatados

**Implementação:**
```javascript
// lib/jusbrasil-client.js
import { JusBrasilClient } from '../lib/jusbrasil-client.js';

const client = new JusBrasilClient({
  email: process.env.JUSBRASIL_EMAIL,
  senha: process.env.JUSBRASIL_SENHA
});

const resultados = await client.search('penhora bem de família', {
  limit: 10,
  tribunal: 'STJ'
});
```

### 3. Google Custom Search

**Status:** Integrado (requer API Key)

- **Busca complementar** em sites oficiais de tribunais
- **Acesso:** API oficial do Google
- **Cobertura:** Sites .jus.br, .gov.br
- **Vantagem:** Encontra decisões não indexadas nas outras fontes

### Priorização de Tribunais

O sistema prioriza precedentes de:

1. **STF** (Supremo Tribunal Federal) - Peso 10
2. **STJ** (Superior Tribunal de Justiça) - Peso 9
3. **TST** (Tribunal Superior do Trabalho) - Peso 8
4. **TSE** (Tribunal Superior Eleitoral) - Peso 8
5. **TRFs** (Tribunais Regionais Federais) - Peso 7
6. **TJs** (Tribunais de Justiça Estaduais) - Peso 5

---

## Exemplos de Uso

### Caso 1: Único Imóvel Residencial

**Contexto:**
Cliente teve imóvel residencial único penhorado em execução fiscal.

**Comando:**
```bash
node scripts/analyze-garnishment-reduction.js \
  --bemPenhorado "imóvel residencial único" \
  --valorDebito "R$ 120.000,00" \
  --valorPenhorado "R$ 450.000,00" \
  --tribunal "TJSP"
```

**Saída Esperada:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 ROM AGENT - ANÁLISE DE REDUÇÃO DE PENHORA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Teses aplicáveis identificadas: 1

🔎 Buscando precedentes: impenhorabilidade-bem-familia
   Query: "impenhorabilidade bem de família Lei 8009/90"
   ✅ Encontrados: 87 resultados
   🎯 Precedentes de tribunais superiores: 15
      - STJ: REsp 1.715.091/SP
      - STF: RE 612.360/SP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 GERANDO RESUMO EXECUTIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Resumo gerado com sucesso!

📈 Estatísticas:
   - Teses analisadas: 1
   - Total de precedentes: 87
   - Precedentes relevantes: 15
   - Recomendações: 1

🎯 TOP 3 RECOMENDAÇÕES:

1. IMPENHORABILIDADE-BEM-FAMILIA
   Fundamento: Art. 1º, Lei 8.009/90 - Bem de família é impenhorável
   Precedentes encontrados: 87
   Destaques: STJ - REsp 1.715.091/SP, STF - RE 612.360/SP
```

### Caso 2: Penhora de Salário Excessiva

**Contexto:**
Penhora de 100% do salário em conta bancária.

**Comando:**
```bash
node scripts/analyze-garnishment-reduction.js \
  --bemPenhorado "salário em conta bancária" \
  --descricaoCaso "Penhora de 100% do salário depositado"
```

**Teses Ativadas:**
- `impenhorabilidade-salario`
- `penhora-valores-conta`

---

## Saída e Relatórios

### Estrutura do Relatório JSON

O sistema gera um arquivo JSON completo com a análise:

```json
{
  "titulo": "ANÁLISE JURISPRUDENCIAL - REDUÇÃO DE PENHORA",
  "data": "2025-12-28",
  "tipoCaso": "imóvel residencial único",
  "tesasAnalisadas": 1,
  "totalPrecedentes": 87,
  "precedentesRelevantes": 15,

  "recomendacoes": [
    {
      "prioridade": 1,
      "tese": "impenhorabilidade-bem-familia",
      "fundamento": "Art. 1º, Lei 8.009/90",
      "precedentes": 87,
      "argumentacao": "A tese 'impenhorabilidade-bem-familia' encontra amparo em 15 decisões de tribunais superiores (STJ, STF), consolidando o entendimento de que único imóvel residencial do devedor e sua família é impenhorável...",
      "precendentesDestacados": [
        "STJ - REsp 1.715.091/SP",
        "STF - RE 612.360/SP"
      ]
    }
  ],

  "fundamentacaoCompleta": "DA FUNDAMENTAÇÃO JURISPRUDENCIAL PARA REDUÇÃO DA PENHORA\n\n1. Art. 1º, Lei 8.009/90 - Bem de família é impenhorável\n\n(...)"
}
```

### Arquivo de Saída

- **Local:** `/tmp/analise-penhora-<timestamp>.json`
- **Formato:** JSON completo
- **Uso:** Pode ser importado para petições ou relatórios

---

## Integração com ROM Agent

### Uso na Interface Web

O ROM Agent possui integração nativa via **painel de jurisprudência**:

```javascript
// public/js/jurisprudencia-panel.js

// Buscar jurisprudência para redução de penhora
const resultado = await fetch('/api/jurisprudence/garnishment-reduction', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bemPenhorado: 'imóvel único',
    valorDebito: '120000',
    valorPenhorado: '450000'
  })
});

const analise = await resultado.json();
console.log(analise.fundamentacaoCompleta);
```

### Uso em Prompts Personalizados

Você pode integrar a busca jurisprudencial em **prompts do ROM Agent**:

```markdown
<!-- config/system_prompts/embargos_execucao.md -->

IV - DA FUNDAMENTAÇÃO JURISPRUDENCIAL

{{jurisprudence_garnishment}}

<!-- O ROM Agent automaticamente busca e insere jurisprudência relevante -->
```

---

## Próximos Passos

### Melhorias Planejadas

1. **Cache Inteligente**
   - Armazenar precedentes encontrados
   - Reduzir chamadas às APIs externas
   - Melhorar performance

2. **Análise de Similaridade**
   - Comparar caso atual com precedentes
   - Sugerir precedentes mais próximos
   - Scoring de relevância por ML

3. **Integração com Petições**
   - Inserção automática em templates
   - Formatação ABNT de citações
   - Geração de índice jurisprudencial

4. **Dashboard Analytics**
   - Estatísticas de sucesso por tese
   - Taxa de procedência por tribunal
   - Histórico de buscas

---

## Suporte e Contribuições

### Reportar Problemas

- **GitHub Issues:** https://github.com/rodolfo-svg/ROM-Agent/issues
- **Email:** contato@iarom.com.br

### Contribuir com Novas Teses

Para adicionar novas teses jurídicas:

1. Edite `scripts/analyze-garnishment-reduction.js`
2. Adicione nova tese em `TESES_REDUCAO_PENHORA`:

```javascript
{
  id: 'nova-tese',
  query: 'query de busca',
  fundamento: 'Fundamentação legal',
  aplicacao: 'Quando aplicar'
}
```

3. Teste a busca
4. Abra um Pull Request

---

## Referências Legais

- **Lei 8.009/90** - Impenhorabilidade do bem de família
- **CPC, Art. 833** - Bens absolutamente impenhoráveis
- **CPC, Art. 847** - Substituição da penhora
- **Tema 1.103 STJ** - Penhora de valores em conta

---

**Desenvolvido por:**
ROM Agent - Redator de Obras Magistrais
Rodolfo Otávio Mota Advogados Associados
2025
