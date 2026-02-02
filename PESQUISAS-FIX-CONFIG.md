# ✅ Correção: Pesquisas Google/DataJud/JusBrasil

**Data:** 2026-02-02 21:10 UTC
**Commit:** 81047ee (em produção)
**Problema:** Agent ROM não consegue fazer pesquisas
**Causa:** Variáveis de ambiente não configuradas em produção

---

## 🔴 Problemas Identificados

### 1. Google Search

**Status Atual:**
- ✅ API Key configurada: `GOOGLE_SEARCH_API_KEY=AIzaSy...`
- ✅ CX configurada: `GOOGLE_SEARCH_CX=f14c0d...`
- ❌ **PROBLEMA:** `GOOGLE_SEARCH_ENABLED=false`

**Sintoma:**
```javascript
{
  "googleSearch": {
    "enabled": false,  // ← Desabilitado!
    "configured": true,
    "hasApiKey": true,
    "hasCx": true
  }
}
```

**Impacto:**
- Agent ROM não consegue pesquisar jurisprudência
- Ferramentas `pesquisar_jurisprudencia` retornam vazio
- Pesquisas no JusBrasil (via Google) também não funcionam

---

### 2. DataJud

**Status Atual:**
- ❌ API Key NÃO configurada
- ❌ Base URL NÃO configurada
- ✅ Enabled=true (mas sem credenciais)

**Sintoma:**
```javascript
{
  "datajud": {
    "enabled": true,
    "configured": false,  // ← Não configurado!
    "hasApiKey": false,
    "baseUrl": "not set"
  }
}
```

**Impacto:**
- Buscas no DataJud (API oficial CNJ) falham
- Agent ROM não consegue acessar processos via CNJ

---

### 3. JusBrasil

**Status:**
- ❌ Desabilitado propositalmente (bloqueio anti-bot 100%)
- ✅ Substituído por Google Search que indexa JusBrasil

**Nota:**
JusBrasil bloqueia scraping direto, mas Google Search indexa conteúdo do JusBrasil sem bloqueios.

---

## ✅ Solução: Configurar Variáveis no Render

### Passo 1: Acessar Dashboard do Render

1. Acesse: https://dashboard.render.com/
2. Faça login com sua conta
3. Selecione o service: **ROM Agent** (ou nome equivalente)

---

### Passo 2: Ir para Environment Variables

1. No menu lateral, clique em **"Environment"**
2. Você verá a lista de variáveis já configuradas

---

### Passo 3: Adicionar/Corrigir Variáveis

#### ✅ Google Search (CRÍTICO!)

**Adicione ou corrija estas variáveis:**

```bash
GOOGLE_SEARCH_ENABLED=true
GOOGLE_SEARCH_API_KEY=AIzaSyASQ6IzrLay4PVsPPhYPFXisTubiTq7ocI
GOOGLE_SEARCH_CX=f14c0d3793b7346c0
```

**Ações:**
- Se `GOOGLE_SEARCH_ENABLED` já existe: **Edite** e mude para `true`
- Se não existe: **Adicione** nova variável

#### ✅ DataJud (Opcional mas recomendado)

**Adicione estas variáveis:**

```bash
DATAJUD_ENABLED=true
DATAJUD_API_KEY=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
DATAJUD_BASE_URL=https://api-publica.datajud.cnj.jus.br
```

**Nota:** Se você não tem API Key do DataJud, pode pular esta seção. Google Search já fornece resultados jurisprudenciais.

---

### Passo 4: Salvar e Aguardar Redeploy

1. Clique em **"Save Changes"**
2. Render vai automaticamente fazer **redeploy** do serviço
3. **Aguarde 2-3 minutos** para o deploy completar
4. Você verá uma notificação quando o deploy estiver completo

---

## 🧪 Validação (Após Configurar)

### Teste 1: Verificar Configuração

Execute no terminal:

```bash
curl -s https://iarom.com.br/api/info | jq '.searchServices'
```

**Resultado esperado:**
```json
{
  "googleSearch": {
    "enabled": true,      ← ✅ Deve ser true!
    "configured": true,
    "hasApiKey": true,
    "hasCx": true
  },
  "datajud": {
    "enabled": true,
    "configured": true,   ← ✅ Deve ser true (se configurou)
    "hasApiKey": true,
    "baseUrl": "https://api-publica.datajud.cnj.jus.br"
  }
}
```

---

### Teste 2: Fazer Pesquisa no Chat

1. Acesse: https://iarom.com.br/chat
2. Pergunte algo como:

```
Pesquise jurisprudência do STF sobre prisão preventiva
```

**Resultado esperado:**
- ✅ Agent ROM invoca ferramenta `pesquisar_jurisprudencia`
- ✅ Google Search retorna resultados de tribunais
- ✅ DataJud retorna processos relacionados (se configurado)
- ✅ Claude analisa e responde com precedentes

---

### Teste 3: Pesquisa Específica

```
Busque acórdãos do STJ sobre responsabilidade civil
```

**Resultado esperado:**
- ✅ Retorna ementas de acórdãos do STJ
- ✅ Mostra número do processo, relator, data
- ✅ Inclui link para o documento original

---

## 📊 Comparação: Antes vs Depois

### ANTES (sem configuração)

```
Usuário: "Pesquise jurisprudência sobre LGPD"
Agent ROM: ❌ Nenhum resultado encontrado
Razão: Google Search desabilitado, DataJud não configurado
```

### DEPOIS (com configuração)

```
Usuário: "Pesquise jurisprudência sobre LGPD"
Agent ROM: ✅ Encontrei 15 resultados:

1. STJ - REsp 1.234.567/SP
   Ementa: "LGPD. Tratamento de dados pessoais..."
   Data: 15/08/2023
   Relator: Min. João Silva

2. TJSP - Apelação 0001234-56.2023.8.26.0100
   Ementa: "Violação à LGPD. Danos morais..."
   [...]
```

---

## 🔧 Troubleshooting

### Problema: Ainda não funciona após configurar

**Verifique:**

1. **Deploy completou?**
   ```bash
   curl -s https://iarom.com.br/api/info | jq '.server.gitCommit'
   # Deve retornar commit mais recente
   ```

2. **Variáveis foram salvas?**
   - Volte ao Render Dashboard > Environment
   - Verifique se as variáveis aparecem na lista
   - Se aparecem com valor `[hidden]`, está correto (são secrets)

3. **Google Search está habilitado?**
   ```bash
   curl -s https://iarom.com.br/api/info | jq '.searchServices.googleSearch.enabled'
   # Deve retornar: true
   ```

4. **Tools estão disponíveis?**
   ```bash
   curl -s https://iarom.com.br/api/info | jq '.tools.count'
   # Deve retornar: 6 ou mais
   ```

---

### Problema: Google Search retorna erro

**Possíveis causas:**

1. **API Key inválida:**
   - Verifique se copiou corretamente
   - Gere nova key em: https://console.cloud.google.com/apis/credentials

2. **CX inválido:**
   - Verifique se copiou corretamente
   - Gere novo CX em: https://programmablesearchengine.google.com/

3. **Quota excedida:**
   - Google Search tem limite de 100 consultas/dia (free tier)
   - Aguarde reset (meia-noite PST)
   - Ou faça upgrade do plano

---

### Problema: DataJud retorna erro

**Possíveis causas:**

1. **API Key inválida:**
   - Solicite nova key ao CNJ
   - Verifique formato (deve ser base64)

2. **API do CNJ fora do ar:**
   - DataJud pode ter instabilidades
   - Google Search ainda funciona como fallback

---

## 💡 Como Obter Credenciais

### Google Search API

1. **API Key:**
   - Acesse: https://console.cloud.google.com/apis/credentials
   - Clique em "Create Credentials" > "API Key"
   - Habilite "Custom Search API"
   - Copie a key gerada

2. **Custom Search Engine (CX):**
   - Acesse: https://programmablesearchengine.google.com/
   - Clique em "Add" (criar novo search engine)
   - Configure para buscar em: "Search the entire web"
   - Adicione sites prioritários: `*.jus.br, jusbrasil.com.br`
   - Copie o "Search engine ID" (CX)

3. **Custo:**
   - 100 consultas/dia: **GRÁTIS**
   - Até 10.000 consultas/dia: **$5/1000 consultas**

---

### DataJud API (CNJ)

1. **Solicitar Acesso:**
   - Acesse: https://datajud.cnj.jus.br/
   - Cadastre-se como desenvolvedor
   - Preencha formulário justificando uso
   - Aguarde aprovação (1-7 dias úteis)

2. **Obter API Key:**
   - Após aprovação, acesse dashboard
   - Vá em "Credentials"
   - Copie a API Key gerada

3. **Custo:**
   - **GRÁTIS** (API pública do CNJ)
   - Limite: 1000 consultas/dia

---

## 📝 Histórico de Deploys

| # | Commit | Descrição | Status |
|---|--------|-----------|--------|
| 1 | af5ab13 | Timeout 15min → 30min | ✅ LIVE |
| 2 | **81047ee** | **Expor tools + config de pesquisas** | ✅ **LIVE** |

---

## 🎯 Próximos Passos

1. **URGENTE:** Configurar `GOOGLE_SEARCH_ENABLED=true` no Render
   - Isso habilita todas as pesquisas jurisprudenciais
   - Sem isso, agent ROM fica "cego" para jurisprudência

2. **Recomendado:** Configurar DataJud
   - Melhora qualidade dos resultados
   - Acessa processos diretamente da API oficial do CNJ

3. **Testar pesquisas:**
   - Após configurar, testar no chat
   - Validar que resultados aparecem
   - Verificar qualidade das ementas

4. **Validar KB upload:**
   - Fazer upload do arquivo de 76MB
   - Aguardar 20-25 minutos (timeout 30min)
   - Verificar se documento é salvo

---

## ✅ Conclusão

### Problema Diagnosticado

- ❌ **ANTES:** Tools não visíveis, pesquisas desabilitadas
- ✅ **DEPOIS:** Tools expostas, configuração diagnosticável

### Causa Raiz

- `GOOGLE_SEARCH_ENABLED=false` em produção
- `DATAJUD_API_KEY` não configurado em produção

### Solução

1. Adicionar `GOOGLE_SEARCH_ENABLED=true` no Render
2. Adicionar credenciais do DataJud (opcional)
3. Aguardar redeploy (~2-3 min)
4. Validar com testes no chat

---

**Documento criado:** 02/02/2026 21:10 UTC
**Deploy atual:** 81047ee (commit que expõe tools)
**Ação requerida:** Configurar variáveis no Render Dashboard
**ETA:** 5 minutos (configuração + redeploy)

**Após configurar, agent ROM estará 100% funcional para pesquisas!** 🎉
