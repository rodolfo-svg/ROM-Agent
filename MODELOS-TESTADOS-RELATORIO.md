# 🧪 RELATÓRIO COMPLETO - TESTE DE MODELOS AWS BEDROCK

**Data:** 17/12/2025 01:07 AM
**Região:** us-east-1
**Modelos Testados:** 29
**Taxa de Sucesso:** 75.9% (22/29)

---

## ✅ RESUMO EXECUTIVO

### Estatísticas Gerais
- ✅ **22 modelos funcionando** (75.9%)
- ❌ **7 modelos falharam** (24.1%)
- ⚡ **Latência média:** 919ms
- 🏆 **Mais rápido:** Cohere Command R (639ms)
- 🐢 **Mais lento:** Claude Sonnet 4.5 (2192ms)

### Principais Descobertas
1. **6 modelos premium** requerem Inference Profile (não suportam on-demand direto)
2. **1 modelo** atingiu rate limit durante teste (Claude 3 Opus)
3. **Meta Llama** e **Cohere** são os mais rápidos
4. **Claude Sonnet 4.5** (padrão atual) é o mais lento, mas funciona

---

## ✅ MODELOS QUE FUNCIONAM (22)

### 🏆 TOP 10 MAIS RÁPIDOS

| # | Modelo | Latência | Uso Recomendado |
|---|--------|----------|-----------------|
| 1 | **Cohere Command R** | 639ms | RAG, busca semântica |
| 2 | **Meta Llama 3.3 70B** | 652ms | Análises gerais |
| 3 | **Meta Llama 4 Maverick 17B** | 657ms | Tarefas rápidas |
| 4 | **Anthropic Claude 3 Haiku** | 686ms | Resumos rápidos |
| 5 | **Cohere Command R+** | 687ms | RAG avançado |
| 6 | **Mistral Ministral 3 14B** | 715ms | Tarefas médias |
| 7 | **Meta Llama 3.1 8B** | 733ms | Ultra rápido |
| 8 | **Mistral Ministral 3 8B** | 734ms | Tarefas simples |
| 9 | **Anthropic Claude 3 Sonnet** | 748ms | Equilíbrio |
| 10 | **Meta Llama 3.2 11B** | 802ms | Respostas rápidas |

### 📋 LISTA COMPLETA (ordenada por velocidade)

#### Amazon Nova (4/5 funcionando)
```
✅ amazon.nova-micro-v1:0          821ms  - Ultra Fast
✅ amazon.nova-lite-v1:0           857ms  - Fast
✅ amazon.nova-pro-v1:0            899ms  - Balanced
✅ amazon.titan-text-express-v1    1121ms - Titan
❌ amazon.nova-premier-v1:0               - Requer Inference Profile
```

#### Anthropic Claude (7/10 funcionando)
```
✅ anthropic.claude-3-haiku-20240307-v1:0           686ms  - Mais rápido
✅ anthropic.claude-3-sonnet-20240229-v1:0          748ms  - Veloz
✅ anthropic.claude-3-5-haiku-20241022-v1:0         1063ms - Haiku 3.5
✅ anthropic.claude-3-5-sonnet-20241022-v2:0        1083ms - Sonnet 3.5
✅ anthropic.claude-sonnet-4-20250514-v1:0          1451ms - Sonnet 4
✅ anthropic.claude-sonnet-4-5-20250929-v1:0        2192ms - Padrão atual
❌ anthropic.claude-3-opus-20240229-v1:0                   - Rate limit (429)
❌ anthropic.claude-haiku-4-5-20251001-v1:0                - Requer Inference Profile
❌ anthropic.claude-opus-4-20250514-v1:0                   - Requer Inference Profile
❌ anthropic.claude-opus-4-5-20251101-v1:0                 - Requer Inference Profile
```

#### Meta Llama (7/7 funcionando - 100%!)
```
✅ meta.llama3-3-70b-instruct-v1:0            652ms  - CAMPEÃO Meta
✅ meta.llama4-maverick-17b-instruct-v1:0     657ms  - Llama 4 rápido
✅ meta.llama3-1-8b-instruct-v1:0             733ms  - Menor, mais rápido
✅ meta.llama3-2-11b-instruct-v1:0            802ms  - Médio
✅ meta.llama4-scout-17b-instruct-v1:0        830ms  - Llama 4
✅ meta.llama3-1-70b-instruct-v1:0            944ms  - Grande
✅ meta.llama3-2-90b-instruct-v1:0            1000ms - Maior
```

#### Mistral AI (3/4 funcionando)
```
✅ mistral.ministral-3-14b-instruct          715ms  - Rápido
✅ mistral.ministral-3-8b-instruct           734ms  - Ultra rápido
✅ mistral.mistral-large-3-675b-instruct     900ms  - Grande
❌ mistral.pixtral-large-2502-v1:0                  - Requer Inference Profile
```

#### Cohere (2/2 funcionando - 100%!)
```
✅ cohere.command-r-v1:0                     639ms  - CAMPEÃO GERAL
✅ cohere.command-r-plus-v1:0                687ms  - RAG otimizado
```

#### DeepSeek (0/1)
```
❌ deepseek.r1-v1:0  - Requer Inference Profile
```

---

## ❌ MODELOS QUE FALHARAM (7)

### Problema: Requerem Inference Profile (6 modelos)

Estes modelos **existem** mas não suportam invocação on-demand direta. É necessário usar **Inference Profile** com prefixo regional:

```
❌ amazon.nova-premier-v1:0
   Erro: "isn't supported with on-demand throughput"
   Solução: Usar us.amazon.nova-premier-v1:0

❌ anthropic.claude-opus-4-5-20251101-v1:0
   Erro: "isn't supported with on-demand throughput"
   Solução: Usar us.anthropic.claude-opus-4-5-20251101-v1:0

❌ anthropic.claude-opus-4-20250514-v1:0
   Erro: "isn't supported with on-demand throughput"
   Solução: Usar us.anthropic.claude-opus-4-20250514-v1:0

❌ anthropic.claude-haiku-4-5-20251001-v1:0
   Erro: "isn't supported with on-demand throughput"
   Solução: Usar us.anthropic.claude-haiku-4-5-20251001-v1:0

❌ mistral.pixtral-large-2502-v1:0
   Erro: "isn't supported with on-demand throughput"
   Solução: Usar us.mistral.pixtral-large-2502-v1:0

❌ deepseek.r1-v1:0
   Erro: "isn't supported with on-demand throughput"
   Solução: Usar us.deepseek.r1-v1:0
```

### Problema: Rate Limit (1 modelo)

```
❌ anthropic.claude-3-opus-20240229-v1:0
   Erro: "Too many tokens, please wait before trying again"
   Motivo: Atingiu rate limit durante teste sequencial
   Solução: Aguardar ou usar inference profile us.anthropic.claude-3-opus-20240229-v1:0
```

---

## 🎯 RECOMENDAÇÕES POR CASO DE USO

### 1️⃣ Análises Jurídicas Complexas (Qualidade Máxima)
**Recomendado:**
```
1º anthropic.claude-sonnet-4-5-20250929-v1:0  (padrão atual, funciona)
2º anthropic.claude-sonnet-4-20250514-v1:0    (alternativa rápida)
3º anthropic.claude-3-5-sonnet-20241022-v2:0  (backup)
```

### 2️⃣ Respostas Rápidas (Velocidade)
**Recomendado:**
```
1º cohere.command-r-v1:0                 (639ms - CAMPEÃO)
2º meta.llama3-3-70b-instruct-v1:0       (652ms)
3º anthropic.claude-3-haiku-20240307-v1:0 (686ms)
```

### 3️⃣ Pesquisa RAG / Jurisprudência
**Recomendado:**
```
1º cohere.command-r-plus-v1:0            (687ms - otimizado RAG)
2º cohere.command-r-v1:0                 (639ms)
3º meta.llama3-3-70b-instruct-v1:0       (652ms)
```

### 4️⃣ Resumos de Documentos (Volume)
**Recomendado:**
```
1º meta.llama3-1-8b-instruct-v1:0        (733ms - econômico)
2º mistral.ministral-3-8b-instruct       (734ms)
3º amazon.nova-micro-v1:0                (821ms)
```

### 5️⃣ Análise de Processos Grandes (200k+ tokens)
**Recomendado:**
```
1º anthropic.claude-sonnet-4-5-20250929-v1:0  (200k contexto)
2º anthropic.claude-3-5-sonnet-20241022-v2:0  (200k contexto)
3º meta.llama3-2-90b-instruct-v1:0            (128k contexto)
```

---

## 🔧 AÇÕES NECESSÁRIAS

### Curto Prazo (Implementar Agora)

1. **Adicionar Inference Profiles faltantes:**
```javascript
// Adicionar em src/modules/bedrock.js:

export const INFERENCE_PROFILES = {
  // ... existentes ...

  // NOVOS (modelos premium que falharam):
  'amazon.nova-premier-v1:0': 'us.amazon.nova-premier-v1:0',
  'anthropic.claude-opus-4-5-20251101-v1:0': 'us.anthropic.claude-opus-4-5-20251101-v1:0',
  'anthropic.claude-opus-4-20250514-v1:0': 'us.anthropic.claude-opus-4-20250514-v1:0',
  'anthropic.claude-haiku-4-5-20251001-v1:0': 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  'mistral.pixtral-large-2502-v1:0': 'us.mistral.pixtral-large-2502-v1:0',
  'deepseek.r1-v1:0': 'us.deepseek.r1-v1:0'
};
```

2. **Atualizar modelo padrão para mais rápido (opcional):**
```javascript
// Se quiser priorizar velocidade sobre qualidade máxima:
defaultModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0'  // 1083ms vs 2192ms

// OU manter atual para máxima qualidade:
defaultModel: 'anthropic.claude-sonnet-4-5-20250929-v1:0'  // 2192ms
```

3. **Remover modelos inválidos da lista:**
   - Todos estão válidos! Apenas precisam de inference profiles

### Médio Prazo (Otimizações)

4. **Implementar seleção automática de modelo por tipo de tarefa:**
```javascript
// Resumo rápido → Cohere Command R (639ms)
// Análise complexa → Claude Sonnet 4.5 (2192ms)
// RAG/Busca → Cohere Command R+ (687ms)
// Volume grande → Llama 3.1 8B (733ms)
```

5. **Testar modelos premium após adicionar inference profiles:**
```bash
node test-all-models.js  # Rodar novamente após correções
```

---

## 📊 ANÁLISE ESTATÍSTICA

### Distribuição de Latência

```
< 700ms:  6 modelos (27%) - ULTRA RÁPIDOS
700-900ms: 10 modelos (45%) - RÁPIDOS
900-1200ms: 4 modelos (18%) - MÉDIOS
> 1200ms: 2 modelos (9%) - LENTOS
```

### Performance por Provedor

| Provedor | Funcionando | Taxa Sucesso | Latência Média |
|----------|-------------|--------------|----------------|
| **Cohere** | 2/2 | 100% | 663ms ⭐ |
| **Meta Llama** | 7/7 | 100% | 804ms ⭐ |
| **Amazon** | 4/5 | 80% | 924ms |
| **Mistral** | 3/4 | 75% | 783ms |
| **Anthropic** | 6/10 | 60% | 1176ms |
| **DeepSeek** | 0/1 | 0% | N/A |

### Campeões por Categoria

```
🏆 Velocidade Geral:     Cohere Command R (639ms)
🏆 Melhor Meta Llama:    Llama 3.3 70B (652ms)
🏆 Melhor Claude:        Claude 3 Haiku (686ms)
🏆 Melhor Amazon:        Nova Micro (821ms)
🏆 Melhor Mistral:       Ministral 3 14B (715ms)
🏆 Melhor para RAG:      Cohere Command R+ (687ms)
🏆 Máxima Qualidade:     Claude Sonnet 4.5 (2192ms)
```

---

## 💡 CONCLUSÕES E PRÓXIMOS PASSOS

### ✅ O Que Funciona Bem
1. **22 modelos ativos** - ótima variedade de opções
2. **Meta Llama** - 100% funcionando, excelente velocidade
3. **Cohere** - 100% funcionando, CAMPEÃO em velocidade
4. **Claude Sonnet 4.5** - funciona (padrão atual OK)

### ⚠️ Problemas Identificados
1. **6 modelos premium** precisam de inference profiles
2. **Rate limit** em Claude 3 Opus (temporário)
3. **Latência alta** no Claude Sonnet 4.5 (2x mais lento que alternativas)

### 🚀 Ações Imediatas
1. ✅ **Adicionar inference profiles** para os 6 modelos premium
2. ⚠️ **Considerar trocar padrão** para Claude 3.5 Sonnet (2x mais rápido)
3. ✅ **Implementar seleção automática** por tipo de tarefa
4. ✅ **Re-testar após correções**

### 📈 Benefícios Esperados
- **+6 modelos premium** disponíveis (Opus 4.5, Haiku 4.5, DeepSeek R1, etc)
- **Redução 50% latência** se trocar padrão (2192ms → 1083ms)
- **Melhor custo/benefício** com seleção automática

---

**Relatório gerado:** 17/12/2025 01:07 AM
**Arquivo JSON:** test-models-report.json
**Próximo teste:** Após implementar inference profiles
