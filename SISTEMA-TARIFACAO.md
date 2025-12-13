# 💰 SISTEMA DE TARIFAÇÃO ROM AGENT - COMPLETO

**Versão**: 2.6.0
**Data**: 13 de dezembro de 2024
**Modelo de Negócio**: Custos Reais + Markup de 30%
**Escopo**: TODOS os modelos de IA + Infraestrutura + Storage + APIs

---

## 📊 ESTRUTURA COMPLETA DE CUSTOS

### 1. MODELOS DE IA DISPONÍVEIS (AWS Bedrock)

#### Claude Sonnet 4.5 (Modelo Principal - Peças Complexas)
```
Input:  $0.003 / 1K tokens
Output: $0.015 / 1K tokens

Uso recomendado:
✓ Petições iniciais complexas
✓ Recursos de apelação
✓ Habeas corpus
✓ Pareceres jurídicos
✓ Análise profunda de documentos

Exemplo de uso:
- Petição Inicial (5000 tokens input, 8000 tokens output):
  Custo = (5 × $0.003) + (8 × $0.015) = $0.015 + $0.120 = $0.135
```

#### Claude Haiku (Modelo Econômico - Tarefas Simples)
```
Input:  $0.00025 / 1K tokens
Output: $0.00125 / 1K tokens

Uso recomendado:
✓ Extrações simples de documentos
✓ Resumos rápidos
✓ Análise de jurisprudência
✓ Busca em KB
✓ Respostas curtas

Exemplo de uso:
- Extração de dados (3000 tokens input, 1000 tokens output):
  Custo = (3 × $0.00025) + (1 × $0.00125) = $0.00075 + $0.00125 = $0.002

ECONOMIA: 67x mais barato que Sonnet 4.5!
```

#### Claude Opus (Modelo Premium - Casos Críticos)
```
Input:  $0.015 / 1K tokens
Output: $0.075 / 1K tokens

Uso recomendado:
✓ Casos de alta complexidade (STF/STJ)
✓ Pareceres técnicos especializados
✓ Análise de leading cases
✓ Recursos extraordinários
✓ Teses inovadoras

Exemplo de uso:
- Recurso Extraordinário (7000 tokens input, 12000 tokens output):
  Custo = (7 × $0.015) + (12 × $0.075) = $0.105 + $0.900 = $1.005

QUALIDADE: 5x mais preciso em casos críticos
```

### 2. COMPARATIVO DE MODELOS

| Modelo | Input ($/1K) | Output ($/1K) | Velocidade | Qualidade | Uso Ideal |
|--------|--------------|---------------|------------|-----------|-----------|
| **Haiku** | $0.00025 | $0.00125 | ⚡⚡⚡ Rápido | ⭐⭐⭐ Boa | Extrações simples |
| **Sonnet 4.5** | $0.003 | $0.015 | ⚡⚡ Normal | ⭐⭐⭐⭐ Ótima | Peças padrão |
| **Opus** | $0.015 | $0.075 | ⚡ Lento | ⭐⭐⭐⭐⭐ Excelente | Casos críticos |

### 3. CUSTO POR TIPO DE PEÇA (Estimativa)

#### Usando Claude Sonnet 4.5:
```
┌────────────────────────────────────────────────────┐
│ Tipo de Peça          │ Tokens │ Custo AWS │ +30% │
├────────────────────────────────────────────────────┤
│ Petição Inicial       │ 13K    │ $0.135    │ $0.18│
│ Contestação           │ 10K    │ $0.105    │ $0.14│
│ Recurso de Apelação   │ 15K    │ $0.165    │ $0.21│
│ Agravo de Instrumento │ 8K     │ $0.075    │ $0.10│
│ Habeas Corpus         │ 7K     │ $0.066    │ $0.09│
│ Parecer Jurídico      │ 20K    │ $0.240    │ $0.31│
└────────────────────────────────────────────────────┘

Média: $0.15/peça (Sonnet 4.5)
```

#### Usando Claude Haiku (Economia):
```
┌────────────────────────────────────────────────────┐
│ Tipo de Peça          │ Tokens │ Custo AWS │ +30% │
├────────────────────────────────────────────────────┤
│ Petição Simples       │ 10K    │ $0.015    │ $0.02│
│ Extração de Dados     │ 4K     │ $0.002    │ $0.003│
│ Resumo de Documento   │ 5K     │ $0.005    │ $0.007│
│ Análise KB            │ 3K     │ $0.002    │ $0.003│
└────────────────────────────────────────────────────┘

Média: $0.01/peça (Haiku)
ECONOMIA: 93% vs Sonnet 4.5
```

### 4. Armazenamento (Render.com)
```
FREE:     1 GB   - $0/mês
STARTER:  10 GB  - $7/mês
STANDARD: 50 GB  - $25/mês
PRO:      100 GB - $85/mês
```

### 5. Infraestrutura (Render.com)
```
Web Service: $7/mês (plano base)
CDN/Bandwidth: incluído
SSL: incluído
```

### 6. APIs Externas
```
DataJud CNJ: $20/mês (acesso ilimitado)
STF/STJ APIs: gratuitas (limitadas)
Jusbrasil: credenciais do parceiro (sem custo adicional)
```

### 7. CUSTO TOTAL POR CATEGORIA

#### Exemplo: Escritório Médio (500 peças/mês)

**Cenário 1: Usando APENAS Sonnet 4.5**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AWS Bedrock:
  500 peças × $0.15 = $75,00

Storage (50 GB): $25,00
Infraestrutura: $7,00
DataJud API: $20,00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUBTOTAL: $127,00
Markup 30%: $38,10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: $165,10 ou R$ 826/mês
```

**Cenário 2: Modelo INTELIGENTE (Mix de Modelos)**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AWS Bedrock:
  300 peças Sonnet 4.5 × $0.15 = $45,00
  150 peças Haiku × $0.01 = $1,50
  50 peças Opus × $1.00 = $50,00

  Total IA: $96,50

Storage (50 GB): $25,00
Infraestrutura: $7,00
DataJud API: $20,00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUBTOTAL: $148,50
Markup 30%: $44,55
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: $193,05 ou R$ 965/mês

ECONOMIA vs Cenário 1: -$27,95/mês
QUALIDADE: Melhor (casos críticos com Opus)
```

**Cenário 3: ECONOMIA MÁXIMA (Haiku + Sonnet)**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AWS Bedrock:
  250 peças Haiku × $0.01 = $2,50
  250 peças Sonnet 4.5 × $0.15 = $37,50

  Total IA: $40,00

Storage (50 GB): $25,00
Infraestrutura: $7,00
DataJud API: $20,00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUBTOTAL: $92,00
Markup 30%: $27,60
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: $119,60 ou R$ 598/mês

ECONOMIA vs Cenário 1: -$45,50/mês (28%)
ECONOMIA vs Cenário 2: -$73,45/mês (38%)
```

---

## 💵 PLANOS ROM AGENT (COM MARKUP 30% - TODOS OS MODELOS)

### Plano ESSENCIAL
```
✅ Ideal para: Advogado Individual ou Escritório Pequeno

Recursos:
• 100 peças/mês
• Armazenamento: 10 GB (300-600 processos)
• Análise inteligente de documentos
• Upload até 100 MB por arquivo
• Suporte por email

MODELO: Haiku + Sonnet 4.5 (Roteamento Inteligente)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cálculo de Custos (Mix Inteligente):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. AWS Bedrock:
   • 60 peças Haiku × $0.01:               $0,60
   • 40 peças Sonnet 4.5 × $0.15:          $6,00
   Total IA:                                $6,60

2. Armazenamento (10 GB):                   $7,00
3. Infraestrutura base:                     $7,00
4. APIs (proporção):                        $5,00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SUBTOTAL (Custos reais USD):            $25,60
   + Markup 30%:                            $7,68
   ────────────────────────────────────────
   SUBTOTAL com Markup:                    $33,28
   + IOF 6,38% (operação estrangeira):     $2,12
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TOTAL ao Parceiro (USD):                $35,40
   ou R$ 177,00/mês (taxa de câmbio: R$ 5,00)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ECONOMIA vs Plano Só Sonnet: R$ 31,00/mês (15%)
```

### Plano PROFISSIONAL
```
✅ Ideal para: Escritório Médio (3-5 advogados)

Recursos:
• 500 peças/mês
• Armazenamento: 50 GB (1500-3000 processos)
• Análise inteligente + Sugestão de estratégias
• Upload até 100 MB por arquivo
• 33 ferramentas de extração
• Suporte prioritário

MODELO: Haiku + Sonnet 4.5 (Roteamento Inteligente Avançado)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cálculo de Custos (Mix Inteligente):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. AWS Bedrock:
   • 250 peças Haiku × $0.01:              $2,50
   • 250 peças Sonnet 4.5 × $0.15:        $37,50
   Total IA:                               $40,00

2. Armazenamento (50 GB):                  $25,00
3. Infraestrutura base:                     $7,00
4. DataJud API:                            $20,00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SUBTOTAL (Custos reais USD):            $92,00
   + Markup 30%:                           $27,60
   ────────────────────────────────────────
   SUBTOTAL com Markup:                   $119,60
   + IOF 6,38% (operação estrangeira):     $7,63
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TOTAL ao Parceiro (USD):               $127,23
   ou R$ 636,15/mês (taxa de câmbio: R$ 5,00)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ECONOMIA vs Plano Só Sonnet: R$ 105,00/mês (14%)
```

### Plano EMPRESARIAL
```
✅ Ideal para: Grande Escritório (10+ advogados)

Recursos:
• 2000 peças/mês
• Armazenamento: 100 GB (3000-6000 processos)
• Análise inteligente + Jurisprudência automatizada
• Upload até 100 MB por arquivo
• 33 ferramentas + APIs personalizadas
• Multi-tenant (vários escritórios)
• Suporte 24/7

MODELO: Haiku + Sonnet 4.5 + Opus (Roteamento Completo)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cálculo de Custos (Mix Completo de 3 Modelos):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. AWS Bedrock:
   • 1000 peças Haiku × $0.01:            $10,00
   • 800 peças Sonnet 4.5 × $0.15:       $120,00
   • 200 peças Opus × $1.00:             $200,00
   Total IA:                              $330,00

2. Armazenamento (100 GB):                 $85,00
3. Infraestrutura base:                     $7,00
4. DataJud API:                            $20,00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SUBTOTAL (Custos reais USD):           $442,00
   + Markup 30%:                          $132,60
   ────────────────────────────────────────
   SUBTOTAL com Markup:                   $574,60
   + IOF 6,38% (operação estrangeira):    $36,66
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TOTAL ao Parceiro (USD):               $611,26
   ou R$ 3.056,30/mês (taxa de câmbio: R$ 5,00)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUALIDADE: Máxima (inclui Opus para casos STF/STJ)
ECONOMIA vs Plano Só Sonnet: -R$ 730,00/mês*
*Considerando plano só Sonnet custaria R$ 3.786/mês
```

### Plano PAY-AS-YOU-GO (Sob Demanda)
```
✅ Ideal para: Uso eventual ou testes

Recursos:
• Sem mensalidade
• Paga apenas o que usar
• Armazenamento: FREE (1 GB)
• Upload até 100 MB por arquivo

Cálculo de Custos por Peça (Sonnet 4.5):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Custo AWS: $0.15
   + Markup 30%: $0.045
   ────────────────────────────────────────
   SUBTOTAL: $0.195
   + IOF 6,38%: $0.012
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TOTAL: $0.207/peça (ou R$ 1,04/peça)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Variações por Modelo:
• Haiku:       $0.013/peça (R$ 0,07) - Extrações
• Sonnet 4.5:  $0.207/peça (R$ 1,04) - Peças padrão
• Opus:        $1.377/peça (R$ 6,89) - Casos críticos
```

---

## 🤖 SISTEMA DE ROTEAMENTO INTELIGENTE DE MODELOS

### Como Funciona?

O ROM Agent v2.6.0 inclui um sistema **AUTOMÁTICO** que escolhe o melhor modelo para cada tarefa, otimizando custo e qualidade.

#### 1. Análise Automática da Tarefa
```javascript
// Sistema analisa cada requisição e classifica por complexidade

Tarefa: "Extrair nome e CPF do documento"
→ Complexidade: BAIXA
→ Modelo Selecionado: Haiku
→ Motivo: Extração simples, não requer raciocínio complexo
→ Custo: $0.002 (vs $0.135 no Sonnet)
→ ECONOMIA: 98%

Tarefa: "Redigir petição inicial de dano moral"
→ Complexidade: MÉDIA
→ Modelo Selecionado: Sonnet 4.5
→ Motivo: Requer argumentação jurídica sólida
→ Custo: $0.135
→ Qualidade: Ótima

Tarefa: "Recurso Extraordinário ao STF"
→ Complexidade: ALTA
→ Modelo Selecionado: Opus
→ Motivo: Caso crítico com repercussão geral
→ Custo: $1.005
→ Qualidade: Excelente (necessário para STF)
```

#### 2. Matriz de Decisão Automática

| Tipo de Tarefa | Complexidade | Modelo Auto-Selecionado | Economia |
|----------------|--------------|-------------------------|----------|
| Extração de dados | ⭐ Baixa | Haiku | 98% |
| Resumo de documento | ⭐ Baixa | Haiku | 98% |
| Busca em KB | ⭐ Baixa | Haiku | 98% |
| Análise de jurisprudência | ⭐⭐ Média-Baixa | Haiku | 98% |
| Petição simples | ⭐⭐ Média | Sonnet 4.5 | - |
| Contestação | ⭐⭐⭐ Média | Sonnet 4.5 | - |
| Recurso de Apelação | ⭐⭐⭐ Média-Alta | Sonnet 4.5 | - |
| Parecer técnico | ⭐⭐⭐⭐ Alta | Opus | 0% |
| Recurso STF/STJ | ⭐⭐⭐⭐⭐ Crítica | Opus | 0% |
| Leading case analysis | ⭐⭐⭐⭐ Alta | Opus | 0% |

#### 3. Exemplo Prático: Fluxo Completo

**Caso: Ação de indenização por acidente de trânsito**

```
┌─────────────────────────────────────────────────────┐
│ PASSO 1: Upload de 5 documentos                    │
├─────────────────────────────────────────────────────┤
│ Tarefa: Extrair dados dos documentos               │
│ Modelo: Haiku                                       │
│ Tokens: 15K                                         │
│ Custo: $0.015                                       │
│ Tempo: 3 segundos                                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ PASSO 2: Buscar jurisprudência relevante           │
├─────────────────────────────────────────────────────┤
│ Tarefa: Analisar 20 acórdãos                       │
│ Modelo: Haiku                                       │
│ Tokens: 8K                                          │
│ Custo: $0.008                                       │
│ Tempo: 2 segundos                                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ PASSO 3: Redigir petição inicial                   │
├─────────────────────────────────────────────────────┤
│ Tarefa: Petição inicial complexa                   │
│ Modelo: Sonnet 4.5                                  │
│ Tokens: 13K                                         │
│ Custo: $0.135                                       │
│ Tempo: 8 segundos                                   │
└─────────────────────────────────────────────────────┘

CUSTO TOTAL DO FLUXO: $0.158
(vs $0.405 se usasse só Sonnet em tudo)
ECONOMIA: 61%
```

#### 4. Override Manual (Opcional)

O advogado pode **FORÇAR** um modelo específico se quiser:

```
✓ "Use Opus para esta petição" → Sistema usa Opus
✓ "Use Haiku para economizar" → Sistema usa Haiku
✓ "Auto" (padrão) → Sistema escolhe automaticamente
```

#### 5. Relatório de Uso por Modelo

```
┌──────────────────────────────────────────────────┐
│ RELATÓRIO MENSAL - Escritório Silva & Associados│
├──────────────────────────────────────────────────┤
│ Haiku:                                           │
│   • 250 tarefas                                  │
│   • Custo: $2.50                                 │
│   • Uso: Extrações, buscas, resumos             │
│                                                  │
│ Sonnet 4.5:                                      │
│   • 200 peças                                    │
│   • Custo: $30.00                                │
│   • Uso: Petições, recursos, contestações       │
│                                                  │
│ Opus:                                            │
│   • 50 peças críticas                            │
│   • Custo: $50.00                                │
│   • Uso: STF, STJ, pareceres técnicos           │
├──────────────────────────────────────────────────┤
│ TOTAL IA: $82.50                                 │
│ ECONOMIA vs Só Sonnet: $57.50 (41%)             │
└──────────────────────────────────────────────────┘
```

---

## 📈 COMPARATIVO DE CUSTOS (ATUALIZADO)

| Plano | Peças/mês | Custo Real | Markup 30% | Total | R$/mês |
|-------|-----------|------------|------------|-------|--------|
| **ESSENCIAL** | 100 | $29,00 | $8,70 | **$37,70** | **R$ 189** |
| **PROFISSIONAL** | 500 | $107,00 | $32,10 | **$139,10** | **R$ 696** |
| **EMPRESARIAL** | 2000 | $412,00 | $123,60 | **$535,60** | **R$ 2.678** |
| **PAY-AS-YOU-GO** | variável | $0,15/peça | $0,045 | **$0,195/peça** | **R$ 0,98** |

---

## 🎯 TRACKING DE USO POR PARCEIRO

### Métricas Monitoradas
```javascript
{
  partnerId: "parceiro_001",
  periodo: "2024-12",
  plano: "PROFISSIONAL",

  uso: {
    pecasGeradas: 342,      // de 500
    tokensInput: 1250000,   // Total
    tokensOutput: 2100000,  // Total
    armazenamento: 28.5,    // GB de 50 GB

    custoAWS: 68.25,        // Real AWS
    custoStorage: 25.00,    // Real Render
    custoInfra: 7.00,       // Real Render
    custoTotal: 100.25,     // Total real

    markup30: 30.08,        // 30% sobre custo
    valorCobrado: 130.33,   // Total a cobrar

    economizado: 8.77       // Diferença do plano fixo
  },

  alertas: [
    "Uso em 68% da cota mensal",
    "Economia de $8.77 vs pay-as-you-go"
  ]
}
```

### Dashboard de Faturamento
```
┌─────────────────────────────────────────────┐
│  PARCEIRO: Escritório Silva & Associados   │
│  PLANO: Profissional                        │
│  PERÍODO: Dezembro 2024                     │
├─────────────────────────────────────────────┤
│  Peças geradas:    342 / 500 (68%)         │
│  Armazenamento:    28.5 GB / 50 GB (57%)   │
├─────────────────────────────────────────────┤
│  CUSTOS REAIS:                              │
│  • AWS Bedrock:        $68.25               │
│  • Armazenamento:      $25.00               │
│  • Infraestrutura:     $7.00                │
│  ─────────────────────────────────          │
│  SUBTOTAL:             $100.25              │
│                                             │
│  MARKUP (30%):         $30.08               │
│  ─────────────────────────────────          │
│  TOTAL A FATURAR:      $130.33              │
│  ou R$ 651,65                               │
│                                             │
│  💡 Economia vs plano fixo: $8.77           │
└─────────────────────────────────────────────┘
```

---

## 🔧 IMPLEMENTAÇÃO TÉCNICA COMPLETA

### 1. Definição de Modelos e Custos
```javascript
// lib/ai-models-pricing.js

const AI_MODELS = {
  HAIKU: {
    id: 'claude-3-haiku-20240307',
    name: 'Claude Haiku',
    provider: 'anthropic',
    pricing: {
      input: 0.00025,  // $ por 1K tokens
      output: 0.00125
    },
    maxTokens: 4096,
    useCase: 'Extrações simples, resumos, buscas',
    speed: 'very_fast',
    quality: 'good'
  },

  SONNET_4_5: {
    id: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    pricing: {
      input: 0.003,    // $ por 1K tokens
      output: 0.015
    },
    maxTokens: 8192,
    useCase: 'Peças jurídicas padrão, análise complexa',
    speed: 'normal',
    quality: 'excellent'
  },

  OPUS: {
    id: 'claude-3-opus-20240229',
    name: 'Claude Opus',
    provider: 'anthropic',
    pricing: {
      input: 0.015,    // $ por 1K tokens
      output: 0.075
    },
    maxTokens: 8192,
    useCase: 'Casos críticos STF/STJ, pareceres técnicos',
    speed: 'slow',
    quality: 'superior'
  }
};

module.exports = { AI_MODELS };
```

### 2. Sistema de Roteamento Inteligente
```javascript
// lib/ai-router.js

const { AI_MODELS } = require('./ai-models-pricing');

class AIRouter {

  /**
   * Analisa a tarefa e seleciona o modelo mais adequado
   */
  async selectModel(taskType, context = {}) {
    const {
      complexity,
      documentLength,
      isLegalPiece,
      isCriticalCase,
      userPreference
    } = context;

    // Se usuário especificou modelo, usar esse
    if (userPreference && AI_MODELS[userPreference]) {
      return AI_MODELS[userPreference];
    }

    // Regras de roteamento automático
    switch(taskType) {
      // HAIKU: Tarefas simples
      case 'extraction':
      case 'summary':
      case 'kb_search':
      case 'jurisprudence_analysis':
        return AI_MODELS.HAIKU;

      // OPUS: Casos críticos
      case 'stf_petition':
      case 'stj_petition':
      case 'technical_opinion':
      case 'leading_case_analysis':
        return AI_MODELS.OPUS;

      // SONNET 4.5: Peças padrão
      case 'initial_petition':
      case 'appeal':
      case 'defense':
      case 'habeas_corpus':
      default:
        // Análise adicional por complexidade
        if (isCriticalCase || (documentLength && documentLength > 50000)) {
          return AI_MODELS.OPUS;
        }
        return AI_MODELS.SONNET_4_5;
    }
  }

  /**
   * Calcula custo estimado antes de processar
   */
  estimateCost(model, estimatedTokens) {
    const { input, output } = estimatedTokens;
    const pricing = model.pricing;

    const inputCost = (input / 1000) * pricing.input;
    const outputCost = (output / 1000) * pricing.output;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      model: model.name,
      breakdown: {
        input: `${input} tokens × $${pricing.input}/1K = $${inputCost.toFixed(4)}`,
        output: `${output} tokens × $${pricing.output}/1K = $${outputCost.toFixed(4)}`
      }
    };
  }
}

module.exports = new AIRouter();
```

### 3. Tracking de Uso por Modelo
```javascript
// lib/usage-tracker.js

class UsageTracker {

  /**
   * Registra uso de modelo com todos os detalhes
   */
  async trackUsage({
    partnerId,
    userId,
    projectId,
    taskType,
    model,
    tokensInput,
    tokensOutput,
    responseTime,
    success
  }) {

    const pricing = model.pricing;

    const usage = {
      // Identificação
      partnerId,
      userId,
      projectId,
      timestamp: new Date().toISOString(),

      // Tarefa
      taskType,

      // Modelo usado
      model: {
        id: model.id,
        name: model.name
      },

      // Tokens
      tokens: {
        input: tokensInput,
        output: tokensOutput,
        total: tokensInput + tokensOutput
      },

      // Custos (AWS)
      costs: {
        input: (tokensInput / 1000) * pricing.input,
        output: (tokensOutput / 1000) * pricing.output,
        total: ((tokensInput / 1000) * pricing.input) +
               ((tokensOutput / 1000) * pricing.output)
      },

      // Performance
      responseTime,
      success
    };

    // Salvar no banco
    await this.saveToDatabase(usage);

    // Atualizar contadores em tempo real
    await this.updateCounters(partnerId, usage);

    return usage;
  }

  /**
   * Obter estatísticas de uso por modelo do parceiro
   */
  async getPartnerStatsByModel(partnerId, period = 'month') {
    const usages = await this.getUsages(partnerId, period);

    const statsByModel = {
      haiku: {
        tasks: 0,
        tokens: { input: 0, output: 0, total: 0 },
        costs: { input: 0, output: 0, total: 0 }
      },
      sonnet_4_5: {
        tasks: 0,
        tokens: { input: 0, output: 0, total: 0 },
        costs: { input: 0, output: 0, total: 0 }
      },
      opus: {
        tasks: 0,
        tokens: { input: 0, output: 0, total: 0 },
        costs: { input: 0, output: 0, total: 0 }
      }
    };

    // Agregar dados
    usages.forEach(usage => {
      const modelKey = this.getModelKey(usage.model.id);
      const stats = statsByModel[modelKey];

      stats.tasks++;
      stats.tokens.input += usage.tokens.input;
      stats.tokens.output += usage.tokens.output;
      stats.tokens.total += usage.tokens.total;
      stats.costs.input += usage.costs.input;
      stats.costs.output += usage.costs.output;
      stats.costs.total += usage.costs.total;
    });

    return statsByModel;
  }

  getModelKey(modelId) {
    if (modelId.includes('haiku')) return 'haiku';
    if (modelId.includes('opus')) return 'opus';
    return 'sonnet_4_5';
  }
}

module.exports = new UsageTracker();
```

### 4. Integração no Server
```javascript
// src/server-enhanced.js

const AIRouter = require('../lib/ai-router');
const UsageTracker = require('../lib/usage-tracker');
const { AI_MODELS } = require('../lib/ai-models-pricing');

// API - Processar com seleção inteligente de modelo
app.post('/api/chat', async (req, res) => {
  try {
    const { message, taskType, modelPreference } = req.body;
    const partnerId = req.session.partnerId || 'rom';
    const userId = req.session.userId;

    // 1. Selecionar modelo ideal
    const selectedModel = await AIRouter.selectModel(taskType, {
      userPreference: modelPreference,
      // ... outros contextos
    });

    console.log(`🤖 Modelo selecionado: ${selectedModel.name}`);

    // 2. Estimar custo
    const estimate = AIRouter.estimateCost(selectedModel, {
      input: 5000,  // Estimativa
      output: 8000
    });

    console.log(`💰 Custo estimado: $${estimate.totalCost.toFixed(4)}`);

    // 3. Processar com Claude
    const startTime = Date.now();
    const response = await processWithClaude(selectedModel, message);
    const responseTime = Date.now() - startTime;

    // 4. Rastrear uso
    await UsageTracker.trackUsage({
      partnerId,
      userId,
      taskType,
      model: selectedModel,
      tokensInput: response.usage.input_tokens,
      tokensOutput: response.usage.output_tokens,
      responseTime,
      success: true
    });

    res.json({
      response: response.content,
      model: selectedModel.name,
      usage: response.usage,
      cost: {
        input: (response.usage.input_tokens / 1000) * selectedModel.pricing.input,
        output: (response.usage.output_tokens / 1000) * selectedModel.pricing.output
      }
    });

  } catch (error) {
    console.error('Erro no chat:', error);
    res.status(500).json({ error: error.message });
  }
});

// API - Estatísticas por modelo
app.get('/api/usage/by-model', async (req, res) => {
  try {
    const partnerId = req.session.partnerId || 'rom';
    const period = req.query.period || 'month';

    const stats = await UsageTracker.getPartnerStatsByModel(partnerId, period);

    res.json({
      success: true,
      period,
      stats,
      summary: {
        totalCost: Object.values(stats).reduce((sum, s) => sum + s.costs.total, 0),
        totalTasks: Object.values(stats).reduce((sum, s) => sum + s.tasks, 0)
      }
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### 2. Cálculo de Fatura Mensal
```javascript
async function calculateMonthlyBill(partnerId, month) {
  const usage = await getMonthlyUsage(partnerId, month);
  const plan = await getPartnerPlan(partnerId);

  // Custos reais
  const awsCost = usage.totalTokensCost;
  const storageCost = getStorageCost(usage.storageGB);
  const infraCost = 7.00;

  const realCost = awsCost + storageCost + infraCost;
  const markup = realCost * 0.30; // 30%
  const total = realCost + markup;

  return {
    partnerId,
    month,
    plan: plan.name,

    costs: {
      aws: awsCost,
      storage: storageCost,
      infrastructure: infraCost,
      subtotal: realCost
    },

    markup: {
      percentage: 30,
      value: markup
    },

    total: {
      usd: total,
      brl: total * 5.00 // Taxa de câmbio
    },

    comparison: {
      fixedPlanCost: plan.fixedPrice,
      actualCost: total,
      savings: plan.fixedPrice - total
    }
  };
}
```

### 3. Alertas de Limite
```javascript
function checkUsageLimits(partnerId, currentUsage, plan) {
  const alerts = [];

  // Alerta de 80% do limite
  if (currentUsage.pieces >= plan.maxPieces * 0.8) {
    alerts.push({
      type: 'warning',
      message: `Você usou ${currentUsage.pieces} de ${plan.maxPieces} peças (${(currentUsage.pieces/plan.maxPieces*100).toFixed(0)}%)`
    });
  }

  // Alerta de 100% (bloqueio)
  if (currentUsage.pieces >= plan.maxPieces) {
    alerts.push({
      type: 'danger',
      message: 'Limite de peças atingido! Faça upgrade do plano.'
    });
  }

  return alerts;
}
```

---

## 📊 EXEMPLO DE FATURAMENTO REAL

### Caso: Escritório Médio - Mês de Novembro

```
Plano contratado: PROFISSIONAL ($139.10/mês fixo)

Uso real no mês:
├── 347 peças geradas (de 500)
├── Tokens input:  1.245.000
├── Tokens output: 2.100.000
├── Armazenamento: 32 GB (de 50 GB)

Cálculo do custo real:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. AWS Bedrock:
   Input:  1.245 × $0.003 = $3.74
   Output: 2.100 × $0.015 = $31.50
   Subtotal AWS: $35.24

2. Armazenamento (50 GB): $25.00
3. Infraestrutura: $7.00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CUSTO REAL: $67.24
   + Markup 30%: $20.17
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TOTAL VARIÁVEL: $87.41

Comparação com plano fixo:
   Plano fixo: $139.10
   Custo real + markup: $87.41
   ECONOMIA: $51.69 (37%)

💡 Neste mês, o parceiro economizou 37% em relação ao plano fixo!
```

---

## 🎯 VANTAGENS DO MODELO

### Para o Parceiro (Escritório)
✅ Paga apenas pelo que usa (se gastar menos)
✅ Transparência total nos custos
✅ Pode escolher entre fixo ou variável
✅ Não paga por tokens no upload (100% grátis)

### Para ROM Agent
✅ Margem garantida de 30% sobre custos
✅ Escalável sem risco
✅ Custos repassados automaticamente
✅ Fácil ajuste de preços (apenas markup)

---

## 🔮 PROJEÇÕES DE FATURAMENTO

### Cenário: 50 Parceiros Ativos

| Plano | Parceiros | Receita Mensal | Receita Anual |
|-------|-----------|----------------|---------------|
| Essencial (R$ 189) | 20 | R$ 3.780 | R$ 45.360 |
| Profissional (R$ 696) | 25 | R$ 17.400 | R$ 208.800 |
| Empresarial (R$ 2.678) | 5 | R$ 13.390 | R$ 160.680 |
| **TOTAL** | **50** | **R$ 34.570** | **R$ 414.840** |

**Com 100 parceiros**: R$ 69.140/mês ou R$ 829.680/ano

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Criar tabela de planos no banco
- [ ] Implementar tracking de tokens por parceiro
- [ ] Dashboard de uso para parceiro
- [ ] Sistema de alertas de limite
- [ ] Cálculo automático de fatura mensal
- [ ] Integração com gateway de pagamento
- [ ] Relatório de custos vs receita
- [ ] Sistema de upgrade/downgrade de plano

---

**🎯 RESUMO EXECUTIVO COMPLETO:**

## ✅ VANTAGENS DO SISTEMA

### Para o Parceiro:
✅ **Transparência Total**: Vê exatamente quanto custa cada modelo
✅ **Economia Automática**: Sistema escolhe modelo mais barato quando possível
✅ **Qualidade Garantida**: Modelo premium (Opus) usado apenas quando necessário
✅ **Flexibilidade**: Pode forçar modelo específico se quiser
✅ **Relatórios Detalhados**: Sabe exatamente onde gastou

### Para ROM Agent:
✅ **Margem Garantida**: 30% sobre TODOS os custos (IA + Storage + Infra + APIs)
✅ **Escalável**: Custos variam proporcionalmente com uso
✅ **Previsível**: Modelo baseado em custos reais
✅ **Competitivo**: Roteamento inteligente reduz custos vs concorrentes

### Diferenciais:
✅ **Modelo transparente**: Custos reais + 30% markup
✅ **3 Modelos Disponíveis**: Haiku, Sonnet 4.5, Opus
✅ **Roteamento Automático**: IA escolhe melhor modelo
✅ **Economia até 98%**: Haiku vs Opus em tarefas simples
✅ **Tracking Completo**: Por modelo, por tarefa, por projeto
✅ **Upload 4x Maior**: 100MB vs 25MB do Claude
✅ **Zero Tokens Upload**: Processamento assíncrono

---

## 📊 COMPARAÇÃO FINAL: ROM vs CONCORRENTES

| Recurso | ROM Agent | Claude.ai | GPT-4 |
|---------|-----------|-----------|-------|
| **Modelos Disponíveis** | 3 (Haiku/Sonnet/Opus) | 1 (Sonnet) | 1 (GPT-4) |
| **Roteamento Automático** | ✅ SIM | ❌ NÃO | ❌ NÃO |
| **Upload sem Tokens** | ✅ SIM (0 tokens) | ❌ NÃO | ❌ NÃO |
| **Tamanho Upload** | 100MB | 25MB | 25MB |
| **Transparência Custos** | ✅ Total | ⚠️ Parcial | ⚠️ Parcial |
| **Economia Potencial** | Até 98% | 0% | 0% |
| **Tracking por Modelo** | ✅ SIM | ❌ NÃO | ❌ NÃO |
| **Jurisprudência Auto** | ✅ SIM | ❌ NÃO | ❌ NÃO |
| **KB por Projeto** | ✅ SIM | ❌ NÃO | ❌ NÃO |

---

## 🚀 PRÓXIMOS PASSOS

### Implementação Imediata:
1. ✅ Criar módulo `lib/ai-models-pricing.js`
2. ✅ Criar classe `AIRouter` em `lib/ai-router.js`
3. ✅ Criar `UsageTracker` em `lib/usage-tracker.js`
4. ✅ Integrar no `server-enhanced.js`
5. ✅ Criar API `/api/usage/by-model`
6. ✅ Atualizar dashboard para mostrar uso por modelo

### Melhorias Futuras:
- Machine Learning para otimizar seleção de modelo
- Cache inteligente por tipo de tarefa
- Predição de custos mensais
- Alertas automáticos de economia
- A/B testing entre modelos

---

**📅 Última Atualização**: 13 de dezembro de 2024
**👤 Responsável**: Equipe ROM Agent
**📧 Contato**: dev@rom-agent.com

---

**💡 NOTAS IMPORTANTES:**

### Sobre o Sistema de Tarifação:

Este sistema cobre **TODO O SISTEMA**, não apenas ferramentas de extração:
- ✅ Todos os modelos de IA (Haiku, Sonnet 4.5, Opus)
- ✅ Custos de hospedagem (Render.com)
- ✅ Armazenamento (Storage)
- ✅ APIs externas (DataJud CNJ)
- ✅ Infraestrutura completa
- ✅ Markup de 30% + IOF 6,38% aplicados

### Taxa de Câmbio Dinâmica:

```
⚠️ IMPORTANTE: Taxa de câmbio é atualizada na DATA DO PAGAMENTO

Exemplo:
- Plano contratado: R$ 177,00/mês (calculado com dólar a R$ 5,00)
- Pagamento em 15/01/2025: Dólar está a R$ 5,20
- Valor cobrado: $35,40 × R$ 5,20 = R$ 184,08

Sistema consulta automaticamente:
• API do Banco Central do Brasil
• Cotação PTAX do dia útil anterior
• Atualização em tempo real antes da cobrança
```

### Sistema Pré-Pago (Modelo Claude):

```
✅ PREFERENCIALMENTE PRÉ-PAGO

Funcionamento:
1. Parceiro compra créditos antecipadamente
   Exemplo: Compra $100,00 em créditos

2. Créditos são consumidos conforme uso
   • Cada peça Haiku: $0.013
   • Cada peça Sonnet: $0.207
   • Cada peça Opus: $1.377

3. Alerta quando créditos estão baixos
   ⚠️ Aviso em 80%: "Você tem $20 restantes"
   ⚠️ Aviso em 90%: "Você tem $10 restantes"

4. Sistema BLOQUEIA ao atingir limite
   ❌ Créditos zerados: "Recarregue para continuar"
   (Igual ao Claude.ai)

5. Recarga automática (opcional)
   ✓ Auto-recarga de $100 quando < $10
   ✓ Cartão cadastrado cobra automaticamente
```

### Planos Pré-Pagos:

```
┌──────────────────────────────────────────────────┐
│ PACOTE STARTER                                   │
├──────────────────────────────────────────────────┤
│ Créditos: $50,00                                 │
│ Rende aproximadamente:                           │
│   • 240 peças Haiku (tarefas simples)           │
│   • 240 peças Sonnet (peças padrão)             │
│   • 36 peças Opus (casos críticos)              │
│ Validade: 90 dias                                │
│ Preço: R$ 260,00* (com IOF + câmbio R$ 5,00)    │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ PACOTE PROFESSIONAL                              │
├──────────────────────────────────────────────────┤
│ Créditos: $150,00                                │
│ Rende aproximadamente:                           │
│   • 725 peças Sonnet (peças padrão)             │
│ Validade: 180 dias                               │
│ Preço: R$ 780,00* (com IOF + câmbio R$ 5,00)    │
│ BÔNUS: +10% créditos grátis ($15)               │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ PACOTE ENTERPRISE                                │
├──────────────────────────────────────────────────┤
│ Créditos: $500,00                                │
│ Rende aproximadamente:                           │
│   • 2.415 peças Sonnet (peças padrão)           │
│ Validade: 365 dias                               │
│ Preço: R$ 2.600,00* (com IOF + câmbio R$ 5,00)  │
│ BÔNUS: +20% créditos grátis ($100)              │
└──────────────────────────────────────────────────┘

*Taxa de câmbio atualizada na data do pagamento
```

### Dashboard de Créditos:

```javascript
// Exemplo de dashboard do parceiro

{
  "creditos": {
    "saldo": "$45.30",
    "valorReais": "R$ 226,50", // Câmbio atual
    "ultimaRecarga": "2024-12-01",
    "proximoVencimento": "2025-03-01"
  },

  "uso": {
    "totalGasto": "$54.70",
    "pecasGeradas": 342,
    "breakdown": {
      "haiku": {
        "pecas": 150,
        "custo": "$1.95"
      },
      "sonnet": {
        "pecas": 180,
        "custo": "$37.26"
      },
      "opus": {
        "pecas": 12,
        "custo": "$16.52"
      }
    }
  },

  "alertas": [
    {
      "tipo": "warning",
      "mensagem": "Créditos abaixo de 50%. Considere recarregar.",
      "acao": "Recarregar Agora"
    }
  ]
}
```

---

**Resultado**: Preço justo, transparente, escalável e com controle total de gastos para parceiros.
