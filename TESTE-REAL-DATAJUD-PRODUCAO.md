# 🧪 Teste REAL do DataJud em Produção - O Que Ele Realmente Retorna?

**Aviso:** Documento anterior assumiu que DataJud não retorna ementas baseado em teste parcial.
**CORREÇÃO:** Precisamos testar EM PRODUÇÃO para ver O QUE REALMENTE RETORNA!

---

## ⚠️ Minha Suposição Errada

Eu testei localmente com:
- `match_all` (qualquer processo)
- Pegou 1 processo EM ANDAMENTO
- Só tinha movimentos de "Distribuição" e "Conclusão"
- **Não tinha ementa** (porque processo não foi julgado ainda!)

**Conclusão precipitada:** "DataJud não retorna ementas"

## 🤔 O Que Pode Estar Errado

### Possibilidade 1: Ementas estão em movimentos específicos

```json
{
  "movimentos": [
    {
      "codigo": 26,
      "nome": "Distribuição"
      // ❌ Sem ementa (óbvio, é só distribuição)
    },
    {
      "codigo": 193,
      "nome": "Publicação de Acórdão",
      "documento": {
        "id": "...",
        "tipo": "Acórdão",
        "ementa": "TEXTO DA EMENTA AQUI...",  // ✅ Pode estar aqui!
        "texto": "ACÓRDÃO COMPLETO..."
      }
    }
  ]
}
```

### Possibilidade 2: Depende do tipo de busca

```javascript
// Busca genérica (match_all)
// → Retorna qualquer processo (com ou sem julgamento)

// Busca por assunto específico
// → Pode retornar processos julgados
// → Com movimentos de "Publicação"
// → Que TÊM ementas!
```

### Possibilidade 3: Campo específico para decisões

```json
{
  "numeroProcesso": "...",
  "tribunal": "STJ",
  "decisoes": [  // ✅ Pode ter campo específico
    {
      "tipo": "Acórdão",
      "ementa": "...",
      "dataJulgamento": "..."
    }
  ]
}
```

---

## 🧪 Teste Correto em Produção

### Passo 1: Aguardar Deploy

Aguardar que o Render faça deploy com:
- ✅ Queries corrigidas (assuntos.nome, classe.nome)
- ✅ Header correto (APIKey)
- ✅ Variable fix

### Passo 2: Testar no Chat

**URL:** https://iarom.com.br
**Login:** rodolfo@rom.adv.br / Mota@2323
**Digite:** `procure jurisprudencia sobre dano moral`

### Passo 3: Verificar Logs COMPLETOS do Render

**O QUE PROCURAR:**

```bash
# 1. Ver se DataJud foi chamado
[INFO] [DATAJUD] Buscando decisões em https://...

# 2. Ver quantos resultados
[INFO] DataJud: X decisao(oes) encontrada(s)

# 3. IMPORTANTE: Ver a estrutura COMPLETA da resposta
[DEBUG] Response data: { ... }
```

### Passo 4: Analisar Estrutura Retornada

**Perguntas a responder:**

1. **Movimentos têm documentos?**
   ```json
   movimentos[].documento.ementa
   movimentos[].documento.texto
   ```

2. **Há campo específico para decisões?**
   ```json
   decisoes[]
   acordaos[]
   ```

3. **Depende do tipo de movimento?**
   - "Publicação de Acórdão" tem ementa?
   - "Julgamento" tem ementa?
   - "Sentença" tem texto?

4. **Processos retornados estão julgados?**
   - Têm data de julgamento?
   - Têm movimento de publicação?

---

## 📋 Checklist de Verificação

Após teste em produção, marcar:

### DataJud retornou resultados?
- [ ] SIM - Quantos? _____
- [ ] NÃO - Ver logs de erro

### Estrutura da resposta:
- [ ] `hits.hits[]._source` tem quais campos?
- [ ] `movimentos[]` existe?
- [ ] `movimentos[]` tem campo `documento`?
- [ ] `movimentos[]` tem campo `ementa`?
- [ ] `movimentos[]` tem campo `texto`?

### Movimentos retornados:
- [ ] Quais tipos de movimento vieram? (códigos e nomes)
- [ ] Algum movimento é "Publicação de Acórdão"?
- [ ] Algum movimento é "Julgamento"?
- [ ] Algum movimento tem texto/ementa?

### Se NÃO houver ementas:
- [ ] Confirmar que busca foi por assunto correto
- [ ] Verificar se processos retornados estão julgados
- [ ] Verificar dataJulgamento ou movimento de publicação
- [ ] Testar busca alternativa (por número específico de processo julgado)

---

## 🔍 Teste Alternativo: Buscar Processo Específico Julgado

Se a busca por assunto não retornar ementas, testar com número específico:

```bash
# Pegar um número de processo CONHECIDO que tem ementa publicada
# Exemplo: algum processo do STJ com acórdão publicado

curl -X POST "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search" \
  -H "Authorization: APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "match": {
        "numeroProcesso": "NUMERO_PROCESSO_CONHECIDO"
      }
    }
  }' | jq '.' > /tmp/datajud_processo_especifico.json
```

**Ver estrutura completa desse processo**

---

## 🎯 Decisões Baseadas nos Resultados

### Cenário A: DataJud TEM ementas ✅

```
DataJud retorna:
- numeroProcesso: "..."
- movimentos[].documento.ementa: "TEXTO EMENTA..."
- movimentos[].documento.texto: "ACÓRDÃO COMPLETO..."
```

**ESTRATÉGIA:**
1. ✅ DataJud como PRIORIDADE (tem tudo!)
2. ✅ Google como FALLBACK (se DataJud falhar)
3. ✅ Puppeteer OPCIONAL (se quiser enriquecer mais)

**Sua proposta original estava CORRETA!**

### Cenário B: DataJud NÃO tem ementas ❌

```
DataJud retorna:
- numeroProcesso: "..."
- classe: "..."
- assunto: "..."
- movimentos: [só metadados, sem texto]
```

**ESTRATÉGIA:**
1. ✅ Google como PRIORIDADE (busca ementas)
2. ✅ DataJud como ENRIQUECIMENTO (metadados oficiais)
3. ✅ Puppeteer para completar

**Minha análise estava correta (mas por sorte, não por teste adequado!)**

### Cenário C: DataJud tem ementas PARCIAIS ⚠️

```
DataJud retorna:
- Alguns processos têm ementa (julgados)
- Outros não têm (em andamento)
```

**ESTRATÉGIA HÍBRIDA:**
1. ✅ DataJud primeiro
2. ✅ Para processos SEM ementa → Google complementa
3. ✅ Puppeteer enriquece todos

---

## 📊 Próximos Passos

1. **Aguardar deploy** (~5-10 min)
2. **Testar em produção** (chat)
3. **Verificar logs COMPLETOS**
4. **Analisar estrutura REAL**
5. **Documentar descobertas**
6. **Decidir estratégia baseada em DADOS REAIS**

---

## 💡 Lição Aprendida

**NUNCA assumir estrutura de API sem testar adequadamente!**

- ❌ Teste com `match_all` pegou processo em andamento
- ❌ Processos em andamento não têm ementas (óbvio!)
- ❌ Conclusão precipitada

**Deveria ter:**
- ✅ Testado com busca específica (por assunto)
- ✅ Verificado processos JULGADOS
- ✅ Procurado por movimentos de "Publicação"
- ✅ Testado com número de processo conhecido com ementa

---

## 🙏 Obrigado por Questionar!

Usuário estava CERTO em questionar:
> "mas como vamos identificar a precisão do datajud se ele não vê as ementas?"
> "pq o datajud nos outros testes traziam textos de ementas?"
> "não é melhor vermos o que o datajud entrega primeiro?"

**Resposta:** SIM! Vamos testar AGORA em produção e ver O QUE REALMENTE RETORNA!

---

**Status:** ⏳ AGUARDANDO TESTE EM PRODUÇÃO
**Próxima ação:** Testar no chat e analisar logs completos
