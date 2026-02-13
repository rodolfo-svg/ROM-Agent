# 🔍 DataJud CNJ API - Investigação 404 Error

## ⚠️ Problema Identificado em Produção

**Data:** 2026-02-12
**Ambiente:** iarom.com.br (produção)
**Teste realizado:** "procure jurisprudencia sobre descaminho"

### Erro Observado

```
[INFO] [DataJud] Buscando decisões em https://api-publica.datajud.cnj.jus.br/api_publica_stf/_search
[WARN] DataJud falhou, usando fallback Google Search
  Data: {
    "error": "Request failed with status code 404"
  }
```

### Status Atual

- ✅ **Sistema funcional** (fallback Google Search funcionou perfeitamente)
- ✅ **Circuit Breaker ativo** (registrou falha corretamente)
- ✅ **Usuário recebeu resultados** (2 decisões do STF via Google)
- ✅ **Timeout respeitado** (5s)
- ✅ **SSE streaming mantido** (chat não travou)
- ❌ **DataJud retorna 404** (endpoint pode estar incorreto)

---

## 🔎 Análise Técnica

### Endpoint Atual

```javascript
// Código em datajud-service.js linha 90
function getDatajudUrl(tribunal) {
  const alias = TRIBUNAL_ALIASES[tribunal.toUpperCase()];
  return `${DATAJUD_BASE_URL}/api_publica_${alias}${SEARCH_ENDPOINT}`;
}

// Exemplo gerado:
// https://api-publica.datajud.cnj.jus.br/api_publica_stf/_search
```

### Autenticação

```javascript
// Código em datajud-service.js linha 413
headers: {
  'Authorization': `ApiKey ${DATAJUD_TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': 'ROM-Agent/2.8.0'
}
```

### Query Body (ElasticSearch DSL)

```javascript
// Código em datajud-service.js linhas 369-391
{
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "termo de busca",
            "fields": ["ementa^3", "textoIntegral", "palavrasChave^2"],
            "type": "best_fields",
            "fuzziness": "AUTO"
          }
        }
      ]
    }
  },
  "from": 0,
  "size": 10
}
```

---

## 🧪 Possíveis Causas do 404

### 1. Formato do Endpoint Incorreto

**Hipótese:** O endpoint pode não seguir o padrão `api_publica_[tribunal]/_search`

**Testes Necessários:**
- [ ] Verificar documentação oficial em https://datajud-wiki.cnj.jus.br/
- [ ] Testar endpoint genérico: `/api_publica/_search`
- [ ] Testar endpoint com índice diferente: `/indices/api_publica_stf/_search`
- [ ] Verificar se há versionamento: `/v1/api_publica_stf/_search`

### 2. Autenticação Falhando

**Hipótese:** O formato `ApiKey` pode estar incorreto

**Testes Necessários:**
- [ ] Verificar se o token precisa ser decodificado de Base64
- [ ] Testar formato alternativo: `Authorization: Bearer ${token}`
- [ ] Testar header adicional: `x-api-key: ${token}`
- [ ] Verificar se token está expirado/inválido

### 3. Índice Não Existe

**Hipótese:** Os índices dos tribunais podem ter nomes diferentes

**Testes Necessários:**
- [ ] Listar índices disponíveis: `GET /_cat/indices`
- [ ] Verificar se existe índice unificado para todos os tribunais
- [ ] Testar aliases corretos dos tribunais
- [ ] Verificar nomenclatura: `stf` vs `STF` vs `supremo_tribunal_federal`

### 4. API Requer Etapas Adicionais

**Hipótese:** Pode haver autenticação prévia ou registro de sessão

**Testes Necessários:**
- [ ] Verificar se há endpoint de login/autenticação
- [ ] Testar se precisa obter token JWT temporário
- [ ] Verificar se há rate limiting que retorna 404 em vez de 429
- [ ] Testar em horário diferente (manutenção programada?)

---

## 📋 Plano de Investigação

### Fase 1: Documentação Oficial (PRIORITÁRIO)

1. **Acessar Wiki Oficial do DataJud**
   - URL: https://datajud-wiki.cnj.jus.br/
   - Buscar: "API Pública", "Endpoints", "Autenticação", "ElasticSearch"
   - Ler: Guia de integração, exemplos de uso

2. **Verificar se há SDK ou Cliente Oficial**
   - Buscar no GitHub: "datajud cnj api client"
   - Verificar se CNJ fornece biblioteca Python/Node.js oficial

3. **Contatar Suporte CNJ**
   - Email técnico do DataJud
   - Solicitar exemplos de integração
   - Perguntar sobre formato correto do endpoint

### Fase 2: Testes com curl (Manual)

```bash
# Teste 1: Verificar se API está online
curl -I https://api-publica.datajud.cnj.jus.br/

# Teste 2: Listar endpoints disponíveis (se houver)
curl -H "Authorization: ApiKey $DATAJUD_API_KEY" \
  https://api-publica.datajud.cnj.jus.br/

# Teste 3: Testar endpoint atual
curl -X POST https://api-publica.datajud.cnj.jus.br/api_publica_stf/_search \
  -H "Authorization: ApiKey $DATAJUD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": {"match_all": {}}, "size": 1}'

# Teste 4: Testar endpoint alternativo (sem prefixo tribunal)
curl -X POST https://api-publica.datajud.cnj.jus.br/_search \
  -H "Authorization: ApiKey $DATAJUD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": {"match": {"tribunal": "STF"}}, "size": 1}'

# Teste 5: Verificar se retorna JSON de erro com detalhes
curl -v -X POST https://api-publica.datajud.cnj.jus.br/api_publica_stf/_search \
  -H "Authorization: ApiKey $DATAJUD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": {"match_all": {}}}' 2>&1 | grep -A 20 "404"
```

### Fase 3: Análise de Logs Detalhados

**Adicionar logs mais verbosos em datajud-service.js:**

```javascript
// Em buscarDecisoes(), antes do axios.post (linha 411)
logger.info('[DataJud] Request Details:', {
  url: url,
  method: 'POST',
  headers: {
    'Authorization': `ApiKey ${DATAJUD_TOKEN.substring(0, 20)}...`,
    'Content-Type': 'application/json',
    'User-Agent': 'ROM-Agent/2.8.0'
  },
  body: JSON.stringify(queryBody, null, 2)
});

// No catch (linha 436), adicionar mais detalhes
logger.error('[DataJud] Full Error Response:', {
  status: error.response?.status,
  statusText: error.response?.statusText,
  headers: error.response?.headers,
  data: JSON.stringify(error.response?.data, null, 2),
  message: error.message,
  code: error.code
});
```

### Fase 4: Testes com Postman/Insomnia

1. Importar coleção de requests
2. Configurar variável `DATAJUD_API_KEY`
3. Testar diferentes combinações de endpoints
4. Exportar resultados e compartilhar com equipe

---

## ✅ Correções Já Aplicadas

### 1. **Fix: Variable Name Bug (RESOLVIDO)** ✅

**Commit:** `5006e92`
**Arquivo:** `src/services/jurisprudence-search-service.js:336`
**Erro:** `ReferenceError: usedDataJudFallback is not defined`
**Fix:** Corrigido de `usedDataJudFallback` para `usedGoogleFallback`

```javascript
// Antes (linha 336):
...(usedDataJudFallback && { usedDataJudFallback: true })

// Depois (linha 336):
...(usedGoogleFallback && { usedGoogleFallback: true })
```

**Status:** ✅ **DEPLOYED** (pushed to main)

---

## 🔄 Próximos Passos

### Imediato (Hoje)

1. ✅ **DONE:** Fix variable name bug (commit 5006e92)
2. ✅ **DONE:** Push to production
3. ⏳ **TODO:** Acessar https://datajud-wiki.cnj.jus.br/ e ler documentação oficial
4. ⏳ **TODO:** Executar testes curl manuais (Fase 2 acima)

### Curto Prazo (Esta Semana)

1. ⏳ Adicionar logs detalhados (Fase 3)
2. ⏳ Testar endpoints alternativos
3. ⏳ Contatar suporte DataJud CNJ se necessário
4. ⏳ Atualizar código se endpoint correto for descoberto

### Médio Prazo (Após Resolver 404)

1. ⏳ Testar novamente em produção com endpoint correto
2. ⏳ Verificar performance do DataJud real
3. ⏳ Ajustar Circuit Breaker se necessário
4. ⏳ Documentar endpoint correto neste arquivo

---

## 📊 Impacto Atual

### Positivo ✅

- Sistema 100% funcional com fallback Google Search
- Circuit Breaker protege de tentativas repetidas
- Usuários recebem resultados mesmo com DataJud offline
- Timeout agressivo (5s) previne bloqueio do chat
- SSE streaming mantido

### Negativo ⚠️

- DataJud CNJ (fonte oficial) não está sendo usado
- Dependência exclusiva de Google Search API
- Perde benefício de buscar em 39 tribunais simultaneamente
- Não aproveita estrutura ElasticSearch do DataJud

### Prioridade 🎯

**MÉDIA-BAIXA** - Sistema funcional, mas vale investigar para usar fonte oficial

---

## 📞 Contatos Úteis

**DataJud CNJ:**
- Wiki: https://datajud-wiki.cnj.jus.br/
- Portal: https://www.cnj.jus.br/sistemas/datajud/
- Suporte técnico: (verificar no portal oficial)

**Credenciais Atuais:**
```bash
DATAJUD_API_KEY=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
DATAJUD_BASE_URL=https://api-publica.datajud.cnj.jus.br
```

---

**Última atualização:** 2026-02-12
**Status:** 🔍 INVESTIGAÇÃO EM ANDAMENTO
**Responsável:** Equipe ROM Agent
