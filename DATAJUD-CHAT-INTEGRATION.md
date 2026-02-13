# ⚖️ DataJud CNJ - Integração no Chat

## 📋 Resumo

DataJud CNJ está **integrado automaticamente no chat** do iarom.com.br. Quando o usuário pede jurisprudência, o sistema detecta semanticamente e busca na **fonte oficial do CNJ** nos 39 tribunais brasileiros.

---

## 🚀 Como Funciona (Automático)

### 1. **Usuário Pede Jurisprudência no Chat**

Exemplos de frases que ativam automaticamente:
- "Busque jurisprudência sobre dano moral"
- "Preciso de precedentes do STJ sobre responsabilidade civil"
- "Mostre decisões do TJSP sobre indenização"
- "Jurisprudência recente sobre direito do consumidor"

### 2. **Sistema Detecta Automaticamente**

- Análise semântica identifica pedido de jurisprudência
- Extrai termos de busca e tribunais mencionados
- Não precisa comandos especiais ou flags

### 3. **Busca Inteligente com Prioridade**

#### **PRIORIDADE 1: DataJud CNJ (Fonte Oficial)** ⚡ 5s timeout
- Busca direta na API oficial do Conselho Nacional de Justiça
- **39 tribunais disponíveis:**
  - 5 Superiores: STF, STJ, STM, TSE, TST
  - 6 Federais: TRF1, TRF2, TRF3, TRF4, TRF5, TRF6
  - 28 Estaduais: TJSP, TJRJ, TJMG, TJRS, etc.
- **Top 5 tribunais por padrão:** STF, STJ, TJSP, TJRJ, TJMG
- Busca semântica com ElasticSearch (boost em ementas e palavras-chave)
- Timeout agressivo de **5 segundos** (não bloqueia chat)

#### **FALLBACK: Google Search** ⚡ 10s timeout
- Ativa automaticamente se DataJud falhar ou não retornar resultados
- Cobertura ampla (90+ tribunais)
- Backup confiável

### 4. **Resultados no Streaming SSE**

O usuário vê em tempo real:
```
🔍 Buscando jurisprudência no DataJud CNJ...
✅ Encontrados 5 resultados no STJ
✅ Encontrados 3 resultados no TJSP
📄 Processando ementas completas...
```

Sem travamento! O chat continua responsivo.

---

## ⚡ Otimizações de Performance

### **Circuit Breaker** (Proteção contra Falhas)

Se DataJud falhar **3 vezes consecutivas**:
- ❌ Circuito **abre** automaticamente
- 🔄 Sistema usa Google Search como principal por **60 segundos**
- ✅ Após 60s, tenta DataJud novamente (half-open)
- ✅ Se sucesso, **reseta contador** de falhas

**Benefícios:**
- Não desperdiça tempo tentando serviço offline
- Garante resposta rápida mesmo com falhas
- Recuperação automática quando serviço volta

### **Timeouts Agressivos**

| Fonte | Timeout | Motivo |
|-------|---------|--------|
| DataJud CNJ | **5s** | Fonte oficial, não pode travar chat |
| Google Search | **10s** | Fallback confiável |

**Antes:**
- DataJud: 12s
- Google: 18s (estaduais), 12s (superiores)
- ❌ Travava o chat por até 18 segundos

**Agora:**
- DataJud: 5s
- Google: 10s
- ✅ Máximo 5s para resposta da fonte oficial
- ✅ Fallback rápido se necessário

---

## 📊 Tribunais Disponíveis

### Tribunais Superiores (5)
- STF - Supremo Tribunal Federal
- STJ - Superior Tribunal de Justiça
- STM - Superior Tribunal Militar
- TSE - Tribunal Superior Eleitoral
- TST - Tribunal Superior do Trabalho

### Tribunais Federais (6)
- TRF1 a TRF6 - Tribunais Regionais Federais

### Tribunais Estaduais (28)
- Todos os TJs: TJSP, TJRJ, TJMG, TJRS, TJPR, TJSC, TJBA, TJCE, TJPE, TJGO, TJDFT, TJES, TJPA, TJMA, TJMT, TJMS, TJAM, TJAL, TJPB, TJRN, TJPI, TJSE, TJAC, TJAP, TJRO, TJRR, TJTO, TJDF

**Total: 39 tribunais** ✅

---

## 🎯 Exemplos de Uso no Chat

### Exemplo 1: Busca Genérica
```
Usuário: "Busque jurisprudência sobre dano moral e indenização"

Sistema:
🔍 Buscando no DataJud CNJ (STF, STJ, TJSP, TJRJ, TJMG)...
✅ Encontrados 12 resultados
📄 Processando ementas completas...

[Exibe resultados formatados com ementas, números de processo, datas, etc.]
```

### Exemplo 2: Tribunal Específico
```
Usuário: "Mostre precedentes do STJ sobre responsabilidade civil médica"

Sistema:
🔍 Buscando no DataJud CNJ (STJ)...
✅ Encontrados 8 resultados no STJ
📄 Ementas completas disponíveis

[Exibe jurisprudência do STJ com análise semântica]
```

### Exemplo 3: Fallback Automático
```
Usuário: "Jurisprudência sobre direito tributário"

Sistema:
🔍 Buscando no DataJud CNJ...
⚠️ DataJud não retornou resultados
🔄 Ativando Google Search...
✅ Encontrados 15 resultados (STF, STJ, TRF1, TJSP)

[Exibe resultados do Google Search como fallback]
```

### Exemplo 4: Circuit Breaker Ativo
```
(Após 3 falhas consecutivas do DataJud)

Usuário: "Busque jurisprudência sobre consumidor"

Sistema:
⚠️ DataJud temporariamente indisponível
🔍 Buscando via Google Search...
✅ Encontrados 10 resultados

[Circuit breaker protege performance, usa Google diretamente]
```

---

## 🔧 Variáveis de Ambiente (Configuradas)

```bash
# DataJud CNJ
DATAJUD_ENABLED=true
DATAJUD_API_KEY=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
DATAJUD_BASE_URL=https://api-publica.datajud.cnj.jus.br

# Google Search (Fallback)
GOOGLE_SEARCH_API_KEY=[configurado]
GOOGLE_SEARCH_CX=[configurado]
```

---

## 📈 Métricas de Performance

### Antes da Otimização:
- ⏱️ Tempo médio: 12-18 segundos
- ❌ Travava o chat durante busca
- ❌ Sem proteção contra falhas
- ❌ Google Search como prioridade (não oficial)

### Depois da Otimização:
- ⏱️ Tempo médio: **3-5 segundos**
- ✅ Chat continua responsivo (SSE streaming)
- ✅ Circuit Breaker protege contra falhas
- ✅ DataJud CNJ como prioridade (fonte oficial)
- ✅ Fallback inteligente para Google Search
- ✅ Timeout agressivo (5s DataJud, 10s Google)

---

## 🎓 Casos de Uso Recomendados

### Ideal para DataJud:
- Busca em tribunais específicos (STJ, STF, TJSP)
- Processos judiciais com número CNJ
- Jurisprudência oficial e consolidada
- Decisões recentes de tribunais superiores

### Ideal para Google Search (Fallback):
- Busca ampla em múltiplos tribunais
- Jurisprudência de tribunais menores
- Quando DataJud está offline
- Busca por termo genérico sem tribunal específico

---

## 🔍 Logs e Monitoramento

O sistema registra automaticamente:

```bash
# Logs no Render.com
✅ [DATAJUD] Buscando "dano moral"... (5s timeout)
✅ [DATAJUD] Retornou 8 resultado(s)
✅ [DATAJUD] Sucesso! Resetando circuit breaker

# Ou em caso de falha:
❌ [DATAJUD] Timeout após 5s
⚠️ [CIRCUIT BREAKER] Falha 1/3
🔄 [FALLBACK] Ativando Google Search...
✅ [GOOGLE] Fallback retornou 10 resultado(s)

# Circuit breaker ativo:
🔴 [CIRCUIT BREAKER] ABERTO! DataJud desabilitado por 60s
🔍 Usando Google Search como principal...
```

---

## ✅ Checklist de Validação

- [x] DataJud CNJ configurado (39 tribunais)
- [x] Integrado automaticamente no chat
- [x] Detecção semântica funciona
- [x] Timeout agressivo (5s)
- [x] Circuit Breaker implementado
- [x] SSE streaming mantido (não trava chat)
- [x] Google Search como fallback
- [x] Logs detalhados
- [x] Em produção: iarom.com.br

---

## 🎯 Resultado Final

### ANTES:
❌ Sem DataJud CNJ integrado
❌ Apenas Google Search
❌ Travava o chat (18s)
❌ Sem proteção contra falhas

### AGORA:
✅ **DataJud CNJ como prioridade** (fonte oficial)
✅ **39 tribunais** disponíveis
✅ **5s timeout** (não trava)
✅ **Circuit Breaker** (proteção)
✅ **Google Search fallback** (confiável)
✅ **SSE streaming** mantido
✅ **Detecção automática** no chat

---

## 📞 Uso no Chat

**Basta pedir jurisprudência naturalmente:**

```
"Busque jurisprudência sobre [tema]"
"Precedentes do [tribunal] sobre [assunto]"
"Decisões recentes sobre [matéria]"
"Jurisprudência do STJ/STF/TJSP sobre [tema]"
```

O sistema detecta automaticamente, busca no DataJud CNJ (5s), e se necessário usa Google Search como fallback (10s).

**Sem comandos especiais. Sem botões. Totalmente integrado ao chat.** 🎉

---

**Última atualização:** 2026-02-12
**Versão:** 2.0.0
**Status:** ✅ Em Produção (iarom.com.br)
