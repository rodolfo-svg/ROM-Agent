# 🎯 Refinamentos Google Custom Search - Jurisprudência

## 📋 O que são Refinamentos?

Refinamentos são **filtros** que permitem categorizar e filtrar resultados de busca. Quando configurados, aparecem como opções de filtro na interface de busca.

## 🏛️ Refinamentos Recomendados para Jurisprudência

### **Refinamento 1: Tribunais Superiores**
**Nome**: `Tribunais Superiores`
**Descrição**: STF, STJ, TST, TSE, STM
**Prioridade**: `1.0` (máxima - resultados aparecem primeiro)

**Sites a anexar**:
```
site:stf.jus.br
site:stj.jus.br
site:tst.jus.br
site:tse.jus.br
site:stm.jus.br
```

---

### **Refinamento 2: Tribunais Regionais Federais**
**Nome**: `Tribunais Federais (TRF)`
**Descrição**: TRF1 a TRF6
**Prioridade**: `0.9`

**Sites a anexar**:
```
site:trf1.jus.br
site:trf2.jus.br
site:trf3.jus.br
site:trf4.jus.br
site:trf5.jus.br
site:trf6.jus.br
```

---

### **Refinamento 3: Tribunais Estaduais**
**Nome**: `Tribunais Estaduais (TJ)`
**Descrição**: TJSP, TJRJ, TJGO, etc.
**Prioridade**: `0.8`

**Sites a anexar**:
```
site:tjsp.jus.br
site:tjrj.jus.br
site:tjmg.jus.br
site:tjrs.jus.br
site:tjgo.jus.br
site:tjdf.jus.br
site:tjpr.jus.br
site:tjsc.jus.br
site:tjba.jus.br
site:tjpe.jus.br
site:tjce.jus.br
site:tjam.jus.br
site:tjac.jus.br
site:tjap.jus.br
site:tjro.jus.br
site:tjrr.jus.br
site:tjpa.jus.br
site:tjto.jus.br
site:tjma.jus.br
site:tjpi.jus.br
site:tjal.jus.br
site:tjse.jus.br
site:tjpb.jus.br
site:tjrn.jus.br
site:tjms.jus.br
site:tjmt.jus.br
site:tjes.jus.br
```

---

### **Refinamento 4: Tribunais Trabalhistas**
**Nome**: `Tribunais do Trabalho (TRT)`
**Descrição**: TRT1 a TRT24
**Prioridade**: `0.8`

**Sites a anexar**:
```
site:trt1.jus.br
site:trt2.jus.br
site:trt3.jus.br
site:trt4.jus.br
site:trt5.jus.br
site:trt6.jus.br
site:trt7.jus.br
site:trt8.jus.br
site:trt9.jus.br
site:trt10.jus.br
site:trt11.jus.br
site:trt12.jus.br
site:trt13.jus.br
site:trt14.jus.br
site:trt15.jus.br
site:trt16.jus.br
site:trt17.jus.br
site:trt18.jus.br
site:trt19.jus.br
site:trt20.jus.br
site:trt21.jus.br
site:trt22.jus.br
site:trt23.jus.br
site:trt24.jus.br
```

---

### **Refinamento 5: JusBrasil - Jurisprudência Consolidada**
**Nome**: `JusBrasil`
**Descrição**: Jurisprudência consolidada e comentada
**Prioridade**: `0.7`

**Sites a anexar**:
```
site:jusbrasil.com.br
```

---

### **Refinamento 6: Doutrina e Artigos Jurídicos**
**Nome**: `Doutrina e Notícias`
**Descrição**: Consultor Jurídico, Migalhas, artigos
**Prioridade**: `0.5`

**Sites a anexar**:
```
site:conjur.com.br
site:migalhas.com.br
```

---

## 🔧 Como Configurar no Google CSE (Passo a Passo)

### Para CADA refinamento acima:

1. **Acesse**: https://programmablesearchengine.google.com/
2. **Selecione** seu CSE: `f14c0d3793b7346c0`
3. No menu lateral, clique em **"Recursos de pesquisa"** → **"Refinamentos"**
4. Clique em **"Adicionar refinamento"**

5. **Preencha**:
   - **Nome do refinamento**: (copie o nome acima, ex: "Tribunais Superiores")
   - **Como pesquisar sites**: Selecione **"Pesquisar em sites com esse refinamento"**
   - **Mudar a prioridade**: Ajuste o slider para a prioridade indicada (ex: 1.0, 0.9, 0.8)

6. **Anexar sites**:
   - Clique em **"Anexar sites"**
   - Copie e cole os sites listados (um por linha)
   - Exemplo para Tribunais Superiores:
     ```
     site:stf.jus.br
     site:stj.jus.br
     site:tst.jus.br
     site:tse.jus.br
     site:stm.jus.br
     ```

7. Clique em **"Salvar"**

8. **Repita** para os outros 5 refinamentos

---

## 📊 Hierarquia de Prioridades

```
1.0 → Tribunais Superiores (STF, STJ, TST, TSE, STM)
0.9 → Tribunais Federais (TRF1-6)
0.8 → Tribunais Estaduais (27 TJs)
0.8 → Tribunais Trabalhistas (TRT1-24)
0.7 → JusBrasil (jurisprudência consolidada)
0.5 → Doutrina (Conjur, Migalhas)
```

---

## 🎯 Como Usar os Refinamentos via API

Depois de configurados, você pode filtrar resultados via API adicionando o parâmetro `refinement`:

### Exemplo 1: Buscar APENAS no STF, STJ, etc.
```javascript
const params = new URLSearchParams({
  key: process.env.GOOGLE_SEARCH_API_KEY,
  cx: process.env.GOOGLE_SEARCH_CX,
  q: 'direito processual civil',
  refinement: 'Tribunais Superiores'  // ← Filtra apenas superiores
});
```

### Exemplo 2: Buscar APENAS no TJGO, TJSP, etc.
```javascript
const params = new URLSearchParams({
  key: process.env.GOOGLE_SEARCH_API_KEY,
  cx: process.env.GOOGLE_SEARCH_CX,
  q: 'usucapião',
  refinement: 'Tribunais Estaduais (TJ)'  // ← Filtra apenas estaduais
});
```

### Exemplo 3: Buscar SEM filtro (todos os refinamentos)
```javascript
const params = new URLSearchParams({
  key: process.env.GOOGLE_SEARCH_API_KEY,
  cx: process.env.GOOGLE_SEARCH_CX,
  q: 'prescrição intercorrente'
  // ← Sem parâmetro refinement = busca em todos
});
```

---

## 🚀 Benefícios dos Refinamentos

✅ **Filtrar por jurisdição**: Buscar só em tribunais superiores, estaduais, etc.
✅ **Priorizar fontes**: Tribunais oficiais aparecem antes de agregadores
✅ **Resultados mais relevantes**: Usuário escolhe o escopo da busca
✅ **Performance otimizada**: Menos resultados irrelevantes
✅ **UX melhorada**: Frontend pode oferecer filtros aos usuários

---

## 📝 Checklist de Implementação

- [ ] Refinamento 1: Tribunais Superiores (STF, STJ, TST, TSE, STM)
- [ ] Refinamento 2: Tribunais Federais (TRF1-6)
- [ ] Refinamento 3: Tribunais Estaduais (27 TJs)
- [ ] Refinamento 4: Tribunais Trabalhistas (TRT1-24)
- [ ] Refinamento 5: JusBrasil
- [ ] Refinamento 6: Doutrina (Conjur, Migalhas)
- [ ] Testar via API com parâmetro `refinement`
- [ ] (Opcional) Adicionar dropdown no frontend para usuário escolher filtro

---

## ⚠️ Notas Importantes

1. **Refinamentos são opcionais**: Se não passar o parâmetro `refinement`, busca em todos os sites
2. **Não são exclusivos**: Você ainda verá resultados de outros sites, mas os do refinamento aparecem primeiro
3. **Prioridade afeta rankeamento**: Refinamento com prioridade 1.0 aparece antes de 0.5
4. **Pode levar até 48h**: Mudanças no Google CSE podem demorar para propagar

---

## 🔗 Referências

- [Google CSE - Refinements](https://developers.google.com/custom-search/docs/refinements)
- [API Reference - refinement parameter](https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list)

---

**Status**: ⏳ Aguardando configuração no console do Google CSE
**Tempo estimado**: 15-20 minutos (6 refinamentos)
**Responsável**: Configurar manualmente via https://programmablesearchengine.google.com/
