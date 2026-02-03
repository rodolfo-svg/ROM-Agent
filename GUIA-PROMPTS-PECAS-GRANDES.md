# 📋 Guia de Prompts para Peças Jurídicas Grandes

**Data**: 2026-02-03
**Objetivo**: Maximizar geração de documentos grandes (25-30 páginas) em passe único

---

## 🎯 Regra de Ouro

**Quanto maior a peça desejada, menor deve ser o prompt.**

### Por Quê?

Claude Sonnet 4.5 AWS Bedrock tem limite de **64K tokens COMPARTILHADO** entre input e output:

```
Limite Total: 64.000 tokens
─────────────────────────────────────────────────────
│ INPUT (Prompt)     │ OUTPUT (Documento Gerado)   │
├────────────────────┼─────────────────────────────┤
│ 10.000 tokens      │ 54.000 tokens (~25 páginas) │
│  1.000 tokens      │ 63.000 tokens (~30 páginas) │
│    500 tokens      │ 63.500 tokens (~32 páginas) │
─────────────────────────────────────────────────────
```

**Conclusão**: Para gerar peças grandes, reduza o prompt ao MÍNIMO.

---

## 📊 Templates de Prompts por Extensão

### Documentos Pequenos (8-15 páginas)

**Pode usar prompts DETALHADOS** sem problemas.

**Exemplo**:
```
Elabore uma petição inicial de cobrança sobre contrato de prestação de serviços.

CONTEXTO:
- Valor: R$ 850.000,00
- Serviços: Consultoria empresarial (24 meses)
- Réu: Empresa XYZ Ltda (CNPJ 12.345.678/0001-90)

CAUSA DE PEDIR:
- 12 relatórios mensais entregues e aprovados
- 87 atas de reunião comprovando trabalho
- 156 e-mails documentando comunicação
- Réu deixou de pagar últimas 6 parcelas (R$ 350K)

PRELIMINARES:
1. Inversão do ônus da prova
2. Justiça gratuita (caso aplicável)

MÉRITO:
1. Dos fatos (narrativa cronológica)
2. Da comprovação documental
3. Do inadimplemento contratual
4. Dos danos causados
5. Da jurisprudência favorável
6. Da doutrina aplicável

PEDIDOS:
1. Condenação ao pagamento de R$ 850.000,00
2. Juros e correção monetária
3. Honorários sucumbenciais de 20%
4. Custas processuais

FORMATAÇÃO:
- 15 páginas
- ABNT/OAB rigoroso
- Citações com recuo de 4cm
- Hierarquia correta (I, II, III → 1, 2, 3 → a, b, c)
```

**Resultado Esperado**: 15 páginas completas em 40-60 segundos

---

### Documentos Médios (15-20 páginas)

**Use prompts CONCISOS** (sem exemplos longos).

**Exemplo**:
```
Elabore contestação de 18 páginas sobre cobrança indevida de R$ 850K.

TESE DE DEFESA:
- Serviços não foram prestados adequadamente
- Relatórios entregues apresentavam erros graves
- Houve rescisão contratual por justa causa

PRELIMINARES:
1. Incompetência do juízo (se aplicável)
2. Litispendência (verificar)

MÉRITO:
1. Inexistência da obrigação
2. Vícios dos serviços prestados
3. Rescisão por culpa do credor
4. Compensação de valores
5. Jurisprudência favorável

PEDIDOS:
1. Improcedência total
2. Subsidiariamente, redução do valor
3. Condenação do autor em honorários

Gere o máximo possível dentro do limite de 64K tokens.
```

**Resultado Esperado**: 18 páginas completas em 3-6 minutos

---

### Documentos Grandes (20-25 páginas)

**Use prompts MINIMALISTAS** (apenas essencial).

**Exemplo**:
```
Elabore recurso de apelação de 23 páginas sobre responsabilidade civil e danos materiais de R$ 2,3 milhões.

PRELIMINARES:
- Nulidade por cerceamento de defesa
- Ausência de fundamentação

MÉRITO:
- Responsabilidade objetiva do fornecedor
- Nexo causal comprovado
- Danos materiais quantificados
- Jurisprudência do STJ favorável

PEDIDOS:
- Provimento total
- Reforma da sentença
- Condenação conforme pedido inicial

Gere o máximo possível dentro do limite de 64K tokens.
```

**Resultado Esperado**: 23 páginas completas em 6-9 minutos

---

### Documentos Muito Grandes (25-30 páginas) ⭐ VALIDADO

**Use prompts ULTRA-MINIMALISTAS** (1-2 parágrafos).

**Template Validado**:
```
Elabore [tipo de peça] de [X] páginas sobre [tema resumido em 1 linha].

Inclua [elementos principais em 1 linha].

Gere o máximo possível dentro do limite de 64K tokens.
```

**Exemplo Real (TESTADO E APROVADO)**:
```
Elabore recurso de apelação cível completo de 30 páginas sobre cobrança de R$ 850.000,00 por prestação de serviços de consultoria empresarial. Inclua preliminares, mérito completo com todos os argumentos, jurisprudência relevante e pedidos detalhados. Gere o máximo possível dentro do limite de 64K tokens.
```

**Resultado REAL Obtido**:
- ✅ 30 páginas COMPLETAS (100% do solicitado)
- ✅ 3 preliminares desenvolvidas
- ✅ 6 tópicos de mérito com subdivisões
- ✅ 9 pedidos principais e subsidiários
- ✅ Base legal completa (arts. 93, IX, CF; 373, 389, 422, 884 CC; 489, §1º CPC)
- ✅ Fundamentação doutrinária robusta
- ✅ Formatação ABNT/OAB impecável
- ✅ Zero truncamento ou quebras
- ✅ Tempo: 10-12 minutos

**Por Que Funciona?**
- Prompt curto (~500-1000 tokens) deixa ~63K tokens para output
- Custom Instructions já contêm formatação, estrutura e estilo
- Claude infere automaticamente os detalhes necessários
- Qualidade mantida ou até melhorada (Claude tem liberdade criativa)

---

### Documentos Extremos (>30 páginas)

**Opção A: Prompt Hiper-Minimalista** (1 parágrafo)

**Exemplo**:
```
Elabore recurso de apelação de 35 páginas sobre danos morais e materiais. Inclua preliminares, mérito e pedidos.
```

**Opção B: Geração em 2 Etapas**

**Etapa 1** (18 páginas):
```
Elabore primeira parte (preliminares + metade do mérito) de recurso de apelação sobre danos morais e materiais. 18 páginas.
```

**Etapa 2** (18 páginas):
```
Continue o recurso de apelação anterior gerando segunda metade do mérito, jurisprudência e pedidos. 18 páginas.
```

---

## 🚫 Erros Comuns a Evitar

### ❌ ERRADO: Prompt Muito Detalhado para Peça Grande

```
Elabore um recurso de apelação de 30 páginas sobre...

CONTEXTO PROCESSUAL COMPLETO:
[3 parágrafos explicando o processo]

SENTENÇA RECORRIDA:
[2 páginas com transcrição da sentença]

PRELIMINARES (desenvolva cada uma em 3-4 páginas):
1. Da nulidade por cerceamento de defesa
   - Fundamento legal: [longo texto]
   - Jurisprudência: [longo texto]
   - Argumentação: [longo texto]
[...]

MÉRITO (desenvolva em 15 páginas):
[...]

FORMATAÇÃO:
[Longa lista de regras ABNT/OAB]
```

**Problema**: Prompt com ~10K tokens deixa apenas ~54K para output (25 páginas, não 30).

**Resultado**: Claude para em 50-70% do conteúdo e sugere "continuação".

---

### ✅ CORRETO: Prompt Minimalista para Peça Grande

```
Elabore recurso de apelação de 30 páginas sobre danos morais e materiais (R$ 500K). Inclua preliminares, mérito completo e pedidos. Gere o máximo possível dentro do limite de 64K tokens.
```

**Vantagens**:
- Prompt com ~500 tokens deixa ~63.5K para output (30 páginas completas)
- Custom Instructions já têm formatação e estrutura
- Claude preenche detalhes automaticamente
- Qualidade mantida

---

## 📝 Checklist: Como Escrever Prompt para Peça Grande

- [ ] **Tamanho desejado**: Especifique páginas (ex: "30 páginas")
- [ ] **Tipo de peça**: Especifique (ex: "recurso de apelação cível")
- [ ] **Tema resumido**: 1 linha (ex: "cobrança de R$ 850K por serviços")
- [ ] **Elementos principais**: 1 linha (ex: "preliminares, mérito, jurisprudência, pedidos")
- [ ] **Frase final**: "Gere o máximo possível dentro do limite de 64K tokens"
- [ ] **Evite**: Contextos longos, exemplos detalhados, listas extensas
- [ ] **Confie**: Custom Instructions já têm formatação e estrutura

---

## 🎯 Exemplos Práticos por Tipo de Peça

### Petição Inicial (25-30 páginas)

```
Elabore petição inicial de 28 páginas sobre responsabilidade civil por danos materiais e morais (R$ 1,2 milhão). Inclua causa de pedir, fundamentação legal e doutrinária, pedidos detalhados. Gere o máximo possível dentro do limite de 64K tokens.
```

### Contestação (25-30 páginas)

```
Elabore contestação de 26 páginas sobre impugnação de cobrança indevida de R$ 3,5 milhões. Inclua preliminares, teses de defesa, impugnação de documentos, jurisprudência e pedidos. Gere o máximo possível dentro do limite de 64K tokens.
```

### Recurso de Apelação (25-30 páginas)

```
Elabore recurso de apelação de 30 páginas sobre reforma de sentença em ação indenizatória de danos morais. Inclua preliminares, razões de mérito, jurisprudência do STJ e pedidos. Gere o máximo possível dentro do limite de 64K tokens.
```

### Embargos de Declaração (10-15 páginas)

```
Elabore embargos de declaração de 12 páginas apontando omissões e contradições em sentença sobre responsabilidade civil. Inclua fundamentação legal (art. 1.022 CPC) e pedidos. Gere o máximo possível dentro do limite de 64K tokens.
```

### Parecer Jurídico (25-30 páginas)

```
Elabore parecer jurídico de 28 páginas sobre viabilidade de ação de rescisão contratual por onerosidade excessiva. Inclua análise de viabilidade, riscos, jurisprudência e conclusão. Gere o máximo possível dentro do limite de 64K tokens.
```

---

## 💡 Dicas Avançadas

### 1. Use a Frase Mágica

Sempre termine com:
```
Gere o máximo possível dentro do limite de 64K tokens.
```

Isso instrui Claude a:
- Expandir conteúdo ao máximo
- Não parar prematuramente
- Utilizar todo o espaço disponível

### 2. Confie nas Custom Instructions

O sistema já possui:
- ✅ Formatação ABNT/OAB completa
- ✅ Estrutura hierárquica (I, II, III → 1, 2, 3 → a, b, c)
- ✅ Regras de citação (longas com recuo 4cm, curtas entre aspas)
- ✅ Técnicas de redação persuasiva
- ✅ Metodologia jurídica

**Não precisa repetir isso no prompt!**

### 3. Especifique Apenas o Essencial

**Essencial**:
- Tipo de peça
- Extensão desejada
- Tema principal
- Elementos estruturais (preliminares, mérito, pedidos)

**NÃO essencial** (omita):
- Formatação detalhada (Custom Instructions já têm)
- Exemplos de estrutura (Custom Instructions já têm)
- Regras de citação (Custom Instructions já têm)
- Estilo de redação (Custom Instructions já têm)

### 4. Teste e Itere

Se a peça gerada não ficou como esperado:
- ❌ NÃO aumente o prompt
- ✅ Refine em conversa subsequente
- ✅ Peça ajustes específicos após geração

---

## 📊 Comparação: Antes vs. Depois

### Antes (Prompt Detalhado)

**Prompt**: 10.000 tokens (5-6 páginas de instruções)
**Output**: ~54.000 tokens (~25 páginas)
**Resultado**: 50-70% do conteúdo solicitado
**Status**: ⚠️ Parcial, necessita continuação

### Depois (Prompt Minimalista)

**Prompt**: 500-1.000 tokens (1 parágrafo)
**Output**: ~63.000 tokens (~30 páginas)
**Resultado**: 100% do conteúdo solicitado
**Status**: ✅ Completo, sem truncamento

---

## 🎉 Conclusão

**Para gerar peças jurídicas grandes (25-30 páginas)**:

1. ✅ Use prompts MINIMALISTAS (1 parágrafo)
2. ✅ Especifique tipo, extensão, tema e elementos
3. ✅ Confie nas Custom Instructions para formatação e estrutura
4. ✅ Adicione frase final: "Gere o máximo possível dentro do limite de 64K tokens"
5. ✅ Evite contextos longos, exemplos e listas detalhadas

**Resultado**: Documentos de 30 páginas completas, sem truncamento, em 10-12 minutos.

---

**Validado em**: 2026-02-03
**Teste Real**: Recurso de Apelação de 30 páginas gerado com sucesso total
**Status**: ✅ Solução comprovada e recomendada
