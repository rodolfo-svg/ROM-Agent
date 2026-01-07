# Configuração do Google Custom Search API

Guia completo para configurar a busca de jurisprudência na web usando Google Custom Search API.

## Por que configurar?

O Google Custom Search API permite ao ROM-Agent buscar jurisprudência em sites oficiais de tribunais brasileiros, complementando as buscas no DataJud (CNJ) e JusBrasil.

**Sites pesquisados:**
- STF, STJ, TST, TSE, STM
- TRF-1 a TRF-6
- TJSP, TJRJ, TJMG, TJRS, TJGO, TJDF, TJPR, TJSC
- Outros tribunais estaduais

## Passo 1: Criar API Key do Google

1. Acesse [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Clique em **"Create Credentials"** → **"API Key"**
3. Copie a API Key gerada (formato: `AIzaSy...`)
4. (Opcional) Clique em **"Restrict Key"** para limitar uso:
   - Em "API restrictions", selecione "Custom Search API"
   - Em "Application restrictions", configure IP/domínio se necessário

## Passo 2: Habilitar Custom Search API

1. No Google Cloud Console, acesse [APIs & Services - Library](https://console.cloud.google.com/apis/library)
2. Busque por **"Custom Search API"**
3. Clique em **"Enable"**

## Passo 3: Criar Custom Search Engine (CX)

1. Acesse [Programmable Search Engine](https://programmablesearchengine.google.com/)
2. Clique em **"Add"** ou **"Create"**
3. Configure:
   - **Sites to search:**
     - Opção 1: `*.jus.br` (busca em todos os tribunais)
     - Opção 2: Adicionar sites específicos (stf.jus.br, stj.jus.br, etc.)
   - **Language:** Portuguese
   - **Name:** "ROM-Agent Jurisprudence Search" (ou nome desejado)
4. Clique em **"Create"**
5. Copie o **Search engine ID (CX)** (formato: `0123456789abcdef:xyz`)

### Configuração Avançada (Opcional)

Para melhor qualidade de busca:

1. No Programmable Search Engine, clique em seu engine
2. Vá em **"Setup"** → **"Basics"**
3. Configure:
   - **Search the entire web:** OFF (apenas sites especificados)
   - **Image search:** OFF
   - **SafeSearch:** OFF
4. Em **"Sites to search"**, adicione sites específicos:
   ```
   stf.jus.br
   stj.jus.br
   tst.jus.br
   tse.jus.br
   stm.jus.br
   trf1.jus.br
   trf2.jus.br
   trf3.jus.br
   trf4.jus.br
   trf5.jus.br
   trf6.jus.br
   tjsp.jus.br
   tjrj.jus.br
   tjmg.jus.br
   tjrs.jus.br
   ```

## Passo 4: Configurar no ROM-Agent

1. Abra o arquivo `.env` na raiz do projeto
2. Adicione as credenciais:

```bash
# GOOGLE CUSTOM SEARCH (Busca de Jurisprudência na Web)
GOOGLE_SEARCH_API_KEY=AIzaSy_sua_chave_aqui
GOOGLE_SEARCH_CX=0123456789abcdef:xyz
```

3. Salve o arquivo
4. Reinicie o servidor:

```bash
npm run dev
# ou em produção
npm start
```

## Testando a Configuração

### Via Interface Web

1. Acesse http://localhost:3000
2. Envie uma pergunta sobre jurisprudência:
   ```
   Busque jurisprudência sobre ITBI na integralização de capital social
   ```
3. Verifique os resultados do Google Search nos logs

### Via API

```bash
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Busque jurisprudência sobre ITBI integralização capital",
    "modelo": "claude-sonnet-4.5"
  }'
```

### Verificando Logs

```bash
# Deve aparecer no console:
🔍 Buscando no Google Custom Search: "jurisprudência ITBI integralização..."
✅ Encontrados 8 resultados no Google Search

# Se não configurado:
⚠️ Google Search API não configurada
```

## Limites e Custos

### Free Tier (Grátis)
- **100 consultas/dia** grátis
- Até **10.000 consultas/mês** grátis
- Suficiente para uso pessoal/testes

### Paid Tier (Pago)
- US$ 5 por 1.000 consultas adicionais
- Máximo 10.000 consultas/dia

### Otimizações do ROM-Agent
- ✅ **Cache inteligente:** Resultados são armazenados em cache
- ✅ **Lazy loading:** Busca web só executa quando há termo de jurisprudência
- ✅ **Fallback:** Se Google não estiver configurado, usa apenas DataJud e JusBrasil

## Troubleshooting

### Erro: "API não configurada"

**Causa:** Variáveis de ambiente não definidas

**Solução:**
```bash
# Verifique se .env tem as variáveis:
grep GOOGLE_SEARCH .env

# Deve retornar:
GOOGLE_SEARCH_API_KEY=AIzaSy...
GOOGLE_SEARCH_CX=0123456789...
```

### Erro: "Quota excedida"

**Causa:** Limite de 100 queries/dia atingido

**Soluções:**
1. Aguarde até meia-noite (reset diário)
2. Ative faturamento no Google Cloud (US$ 5/1000 queries)
3. Use apenas DataJud/JusBrasil temporariamente

### Erro: "Credenciais inválidas"

**Causa:** API Key ou CX incorretos

**Solução:**
1. Verifique se API Key está correta (começa com `AIzaSy`)
2. Verifique se CX está correto (formato: `abc123:xyz`)
3. Confirme que Custom Search API está habilitada no projeto

### 0 resultados retornados

**Causas possíveis:**
1. Sites especificados no CX muito restritivos
2. Termos de busca muito específicos
3. Tribunais não indexados pelo Google

**Soluções:**
1. Configure CX para buscar em `*.jus.br`
2. Teste com termos mais amplos
3. Verifique exemplos de busca funcional

## Verificação de Status

```bash
# No código do ROM-Agent:
# Verificar se Google Search está configurado
node -e "
const client = require('./lib/google-search-client.js').GoogleSearchClient;
const g = new client();
console.log('Configurado:', g.isConfigured());
"
```

## Links Úteis

- [Google Custom Search JSON API](https://developers.google.com/custom-search/v1/overview)
- [Programmable Search Engine](https://programmablesearchengine.google.com/)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Pricing](https://developers.google.com/custom-search/v1/overview#pricing)

## Suporte

Se tiver dúvidas ou problemas:

1. Verifique os logs do servidor (`console.log`)
2. Teste a API diretamente via curl
3. Confirme que .env está carregado (não use .env.example)
4. Reinicie o servidor após alterar .env

---

**Última atualização:** v2.7.3 (2026-01-07)
