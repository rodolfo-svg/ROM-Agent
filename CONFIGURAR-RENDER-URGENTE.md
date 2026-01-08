# 🚨 CONFIGURAÇÃO URGENTE - Render.com

**PROBLEMA:** Sistema travando 30+ segundos ao buscar jurisprudências TJGO
**CAUSA:** Variáveis de ambiente do Google Search não configuradas no Render

---

## ⚡ SOLUÇÃO RÁPIDA (5 minutos)

### 1. Acessar Render Dashboard

```
https://dashboard.render.com/
```

### 2. Selecionar Serviço

- **Production:** `rom-agent` ou `iarom-production`
- **Staging:** `rom-agent-staging`

### 3. Ir em "Environment"

Clique na aba **Environment** no menu lateral esquerdo

### 4. Adicionar Variáveis de Ambiente

Clique em **"Add Environment Variable"** e adicione:

#### Variável 1:
```
Key: GOOGLE_SEARCH_API_KEY
Value: AIzaSyASQ6IzrLay4PVsPPhYPFXisTubiTq7ocI
```

#### Variável 2:
```
Key: GOOGLE_SEARCH_CX
Value: f14c0d3793b7346c0
```

### 5. Salvar e Deploy Automático

- Clique em **"Save Changes"**
- Render vai reiniciar automaticamente (~2-3 minutos)

---

## 🔍 VERIFICAR SE FUNCIONOU

### Após o deploy (aguarde 3 minutos):

1. **Acessar a aplicação:**
   - Production: https://iarom.com.br
   - Staging: https://rom-agent-staging.onrender.com

2. **Testar busca de jurisprudência:**
   ```
   /jurisprudencia responsabilidade civil médica TJGO
   ```

3. **Resultado esperado:**
   - ✅ Resposta em 1-5 segundos
   - ✅ 3+ resultados do TJGO
   - ✅ Links para tjgo.jus.br

---

## ❌ SE AINDA NÃO FUNCIONAR

### Verificar Logs do Render

1. No dashboard, clique em **"Logs"**
2. Procurar por:
   ```
   ⚠️ Google Search API não configurada
   ```

3. Se aparecer esse erro, significa que as variáveis não foram carregadas:
   - Verifique se salvou corretamente
   - Force um redeploy: Settings → Manual Deploy → "Deploy latest commit"

---

## 🎯 CHECKLIST DE CONFIGURAÇÃO

**No Render.com:**
- [ ] GOOGLE_SEARCH_API_KEY adicionada
- [ ] GOOGLE_SEARCH_CX adicionada
- [ ] Clicou em "Save Changes"
- [ ] Aguardou deploy automático (2-3 min)
- [ ] Verificou logs (sem erros de configuração)

**Teste Funcional:**
- [ ] Acessou a aplicação
- [ ] Testou /jurisprudencia com TJGO
- [ ] Recebeu resultados em < 5 segundos
- [ ] Resultados são do site tjgo.jus.br

---

## 📋 VALORES DAS VARIÁVEIS

**Para copiar/colar no Render:**

```bash
# Google Search API
GOOGLE_SEARCH_API_KEY=AIzaSyASQ6IzrLay4PVsPPhYPFXisTubiTq7ocI
GOOGLE_SEARCH_CX=f14c0d3793b7346c0
```

---

## 🔧 CONFIGURAÇÕES ADICIONAIS (Opcional)

Se quiser melhorar ainda mais:

```bash
# Desabilitar JusBrasil (está instável)
JUSBRASIL_ENABLED=false

# Habilitar apenas Google Search
DATAJUD_ENABLED=false
```

---

## 📞 SUPORTE

**Se o problema persistir após seguir estes passos:**

1. Capture screenshot dos logs do Render
2. Verifique se o deploy foi concluído com sucesso
3. Teste a URL: `https://iarom.com.br/api/health`
   - Deve retornar status 200

---

## ⏱️ TEMPO ESTIMADO

- ⚡ Adicionar variáveis: **1 minuto**
- ⏳ Deploy automático: **2-3 minutos**
- ✅ Total: **~5 minutos**

---

**DEPOIS DE CONFIGURAR, O SISTEMA VAI:**
- ✅ Responder em 1-5 segundos (ao invés de 30+)
- ✅ Trazer resultados reais do TJGO
- ✅ Funcionar para TODOS os tribunais brasileiros
- ✅ Ter logs detalhados de cada busca

**Data:** 07/01/2026
**Prioridade:** 🚨 URGENTE - PRODUÇÃO TRAVADA
