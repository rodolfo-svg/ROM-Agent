# 🧪 Guia de Testes - Pós Correção DataJud

**Data:** 2026-02-12
**Commits aplicados:**
- `5006e92` - Fix: Variable name (usedDataJudFallback → usedGoogleFallback)
- `38b38ee` - Fix: Autenticação (ApiKey → APIKey)

---

## ⏳ Etapa 1: Aguardar Redeploy

O Render faz redeploy automático após push. Aguarde ~5-10 minutos.

### Como verificar se o deploy terminou:

1. Acesse: https://dashboard.render.com/
2. Vá em seu serviço (ROM-Agent)
3. Verifique se o deploy mais recente está **"Live"**
4. Deve mostrar o commit `38b38ee` como ativo

**Ou via logs:**
```bash
# Se tiver Render CLI instalado:
render logs --tail
```

---

## 🧪 Etapa 2: Teste no Chat (iarom.com.br)

### Teste A: Busca simples

**Acesse:** https://iarom.com.br

**Login:**
- Email: `rodolfo@rom.adv.br`
- Senha: `Mota@2323`

**Digite no chat:**
```
procure jurisprudencia sobre dano moral
```

### O que observar:

#### ✅ CENÁRIO 1: DataJud funcionando (ESPERADO)

```
🔍 [DATAJUD] Buscando na fonte oficial do CNJ...
✅ [DATAJUD] Retornou X resultado(s)
✅ [DATAJUD] Resultados suficientes, não precisa fallback
```

**Se ver isso:** 🎉 **SUCESSO!** DataJud está funcionando!

#### ⚠️ CENÁRIO 2: DataJud ainda com erro (possível)

```
🔍 [DATAJUD] Buscando na fonte oficial do CNJ...
❌ [DATAJUD] Falhou: Request failed with status code 404
⚠️ [CIRCUIT BREAKER] Falha 1/3
🔄 [FALLBACK] Ativando Google Search...
✅ [GOOGLE] Fallback retornou 10 resultado(s)
```

**Se ver isso:** DataJud ainda com 404 = API Key pode estar expirada

#### ❌ CENÁRIO 3: DataJud com erro diferente

```
🔍 [DATAJUD] Buscando na fonte oficial do CNJ...
❌ [DATAJUD] Falhou: Request failed with status code 401
```

**401 = Unauthorized** → API Key inválida ou formato errado

---

## 📊 Etapa 3: Analisar Logs do Render

### Como acessar logs:

1. Dashboard Render → Seu serviço → **Logs**
2. Ou via CLI: `render logs --tail`

### O que procurar:

#### ✅ Sucesso:

```
[INFO] [DATAJUD] Buscando decisões em https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search
[INFO] DataJud: X decisao(oes) encontrada(s)
[INFO] ✅ [DATAJUD] Sucesso! Resetando circuit breaker
```

#### ❌ Erro 404 (ainda):

```
[WARN] DataJud falhou, usando fallback Google Search
  Data: {
    "error": "Request failed with status code 404"
  }
```

**Causa provável:** API Key expirada ou endpoint ainda incorreto

#### ❌ Erro 401:

```
[WARN] DataJud falhou, usando fallback Google Search
  Data: {
    "error": "Request failed with status code 401",
    "message": "Unauthorized"
  }
```

**Causa:** API Key inválida

---

## 🔍 Etapa 4: Diagnóstico Avançado

Se DataJud ainda não funcionar, execute estes testes:

### Teste Manual via curl:

```bash
# Teste 1: Verificar se API Key está válida
curl -v -X POST "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search" \
  -H "Authorization: APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==" \
  -H "Content-Type: application/json" \
  -d '{"query": {"match_all": {}}, "size": 1}'
```

**Resultados possíveis:**

- **HTTP 200 OK** → API Key válida, endpoint correto ✅
- **HTTP 404** → Endpoint incorreto ou índice não existe ❌
- **HTTP 401 Unauthorized** → API Key inválida ❌
- **HTTP 403 Forbidden** → API Key sem permissão ❌

### Teste 2: Buscar por assunto

```bash
curl -X POST "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search" \
  -H "Authorization: APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "match": {
        "assunto.nome": "dano moral"
      }
    },
    "size": 5
  }'
```

---

## 📋 Checklist de Validação

Após os testes, preencha:

### Correção 1: Variable Name Bug
- [x] Código corrigido (linha 336)
- [x] Commit feito (5006e92)
- [x] Push realizado
- [ ] Deploy concluído
- [ ] Testado em produção
- [ ] Erro desapareceu

### Correção 2: Header de Autenticação
- [x] Código corrigido (ApiKey → APIKey)
- [x] Commit feito (38b38ee)
- [x] Push realizado
- [ ] Deploy concluído
- [ ] Testado em produção
- [ ] DataJud funcionando

---

## 🎯 Decisão Após Testes

### Se DataJud FUNCIONAR ✅

**Próximo passo:** Implementar nova estratégia
- DataJud busca processos (metadados)
- Google busca ementas (direcionado)
- Puppeteer enriquece (validado)

**Tempo estimado:** 1-2 horas
**Ganho esperado:** 40% mais rápido, 100% mais preciso

### Se DataJud NÃO FUNCIONAR (404/401) ❌

**Causa provável:** API Key expirada ou inválida

**Ações:**

1. **Solicitar nova API Key ao CNJ**
   - Acesse: https://datajud-wiki.cnj.jus.br/api-publica/acesso/
   - Email: suporte.dpj@cnj.jus.br
   - Explique que é integração para escritório de advocacia

2. **Enquanto isso:**
   - Sistema continua funcional com Google Search ✅
   - Usuários recebem jurisprudência normalmente ✅
   - Sem impacto na operação ✅

3. **Quando receber nova chave:**
   ```bash
   # Atualizar no Render:
   # Dashboard → Environment → DATAJUD_API_KEY = nova_chave
   ```

---

## 📞 Suporte

### Se precisar de ajuda:

**Documentação criada:**
- `DATAJUD-ANALISE-COMPLETA-E-CORRECOES.md` - Análise técnica completa
- `DATAJUD-404-INVESTIGATION.md` - Investigação do erro 404
- `NOVA-ESTRATEGIA-DATAJUD-GOOGLE.md` - Estratégia proposta (após validação)
- `TESTE-POS-CORRECAO-DATAJUD.md` - Este guia

**Fontes oficiais:**
- DataJud Wiki: https://datajud-wiki.cnj.jus.br/
- Glossário: https://datajud-wiki.cnj.jus.br/api-publica/glossario/
- Suporte CNJ: suporte.dpj@cnj.jus.br

---

## 📊 Resultado Esperado

### Melhor caso (DataJud funciona):

```
✅ Variable bug corrigido
✅ Header de autenticação corrigido
✅ DataJud retorna processos com metadados
✅ Pronto para implementar nova estratégia (40% mais rápido)
```

### Caso alternativo (API Key expirada):

```
✅ Variable bug corrigido
✅ Header de autenticação corrigido (mas key inválida)
⏳ Aguardando nova API Key do CNJ
✅ Sistema funcional com Google Search (sem impacto)
```

**Em ambos os casos:** Sistema continua operacional! 🎉

---

**Próxima ação:** Testar no chat após redeploy e reportar resultados.

**Status:** ⏳ AGUARDANDO DEPLOY
