# Configurar Google Custom Search Engine - JusBrasil

## 📋 Objetivo

Adicionar `jusbrasil.com.br` ao Google Custom Search Engine para manter **triple-check** de jurisprudência sem bloqueio anti-bot.

## ✅ Vantagens desta Abordagem

- ✅ **Google indexa JusBrasil** sem bloqueio anti-bot
- ✅ **Mantém triple-check**: Google (inclui JusBrasil) + DataJud CNJ
- ✅ **Zero timeout desperdiçado**: Resultados retornam em 150-250ms
- ✅ **Mais confiável**: Google tem cache robusto e crawlers autorizados

## 🔧 Passo a Passo

### 1. Acessar o Programmable Search Engine

1. Acesse: https://programmablesearchengine.google.com/
2. Faça login com a conta Google que criou o CSE atual
3. Clique no CSE existente (ID: `f14c0d3793b7346c0`)

### 2. Adicionar JusBrasil aos Sites

1. No painel do CSE, vá em **"Sites to search"**
2. Clique em **"Add"**
3. Adicione o site: `jusbrasil.com.br/*`
4. Clique em **"Save"**

### 3. Configurar Prioridade (Opcional)

Para dar **prioridade aos tribunais oficiais**:

1. Em "Sites to search", defina **pesos de rankeamento**:
   - `*.jus.br/*` → Peso: **10** (prioridade máxima)
   - `jusbrasil.com.br/*` → Peso: **5** (secundário)

2. Isso garante que:
   - Tribunais oficiais aparecem primeiro
   - JusBrasil complementa quando tribunais não têm resultados

### 4. Testar Configuração

Teste via API:

```bash
curl "https://www.googleapis.com/customsearch/v1?\
key=AIzaSyASQ6IzrLay4PVsPPhYPFXisTubiTq7ocI&\
cx=f14c0d3793b7346c0&\
q=direito+processual+civil+site:jusbrasil.com.br"
```

**Resultado esperado**: Retornar jurisprudência do JusBrasil indexada pelo Google.

## 📊 Arquitetura Final - Triple Check

```
┌─────────────────────────────────────────────────────────┐
│         Pesquisa de Jurisprudência (Paralela)           │
└─────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│    Google    │ │   DataJud    │ │  JusBrasil   │
│Custom Search │ │   CNJ API    │ │  (via Google)│
│   (150ms)    │ │   (3-10s)    │ │   (já no     │
│              │ │              │ │    Google)   │
│ Inclui:      │ │ Fonte:       │ │              │
│ - Tribunais  │ │ - Oficial    │ │              │
│ - JusBrasil  │ │ - CNJ        │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                         ▼
              ┌────────────────────┐
              │ Resultados Mesclados│
              │   (deduplicados)    │
              └────────────────────┘
```

## 🚀 Performance Esperada

### Antes (com scraping direto do JusBrasil):
- Google: 150ms ✅
- DataJud: 3-10s ✅
- JusBrasil scraping: **TIMEOUT 5s** ❌ (bloqueio anti-bot)
- **Total**: ~18s (com falha)

### Depois (JusBrasil via Google):
- Google (inclui JusBrasil): 150-250ms ✅
- DataJud: 3-10s ✅
- **Total**: ~3.5-10s (sem falhas)

## 🔐 Variáveis de Ambiente

Já configuradas no Render:

```bash
GOOGLE_SEARCH_API_KEY=AIzaSyASQ6IzrLay4PVsPPhYPFXisTubiTq7ocI
GOOGLE_SEARCH_CX=f14c0d3793b7346c0

# DataJud
DATAJUD_ENABLED=true
DATAJUD_API_KEY=<sua_chave_cnj>

# JusBrasil - DESABILITADO (usa Google)
JUSBRASIL_ENABLED=false  # ✅ Mantém desabilitado (Google faz o trabalho)
```

## ✅ Checklist de Implementação

- [x] Adicionar `jusbrasil.com.br` ao código (`lib/google-search-client.js`)
- [ ] Adicionar `jusbrasil.com.br/*` ao Google CSE (via console web)
- [ ] Configurar pesos de rankeamento (tribunais 10, JusBrasil 5)
- [ ] Testar busca via curl/Postman
- [ ] Deploy no Render
- [ ] Validar em produção com query real

## 📝 Notas Importantes

1. **Não precisa de timeout adicional**: Google já retorna JusBrasil nos resultados gerais
2. **Deduplicação automática**: Se Google encontrar a mesma jurisprudência em tribunal oficial e JusBrasil, a do tribunal terá prioridade (peso 10 vs 5)
3. **Manter JusBrasil scraping desabilitado**: `JUSBRASIL_ENABLED=false` (Google faz o trabalho)

## 🔗 Links Úteis

- [Google Custom Search Console](https://programmablesearchengine.google.com/)
- [Documentação API](https://developers.google.com/custom-search/v1/overview)
- [DataJud CNJ](https://www.cnj.jus.br/sistemas/datajud/)

---

**Status**: ⏳ Aguardando configuração no console do Google CSE
**Responsável**: Configurar manualmente via https://programmablesearchengine.google.com/
