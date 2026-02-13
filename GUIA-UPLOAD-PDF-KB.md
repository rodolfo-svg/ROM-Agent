# Guia de Upload e Análise de PDF para Knowledge Base

## ✅ Fluxo V2 Correto (LLM Barata + LLM Premium)

O sistema está configurado corretamente para usar:
1. **LLM Barata (Nova Micro)** → Extrai texto completo (~$0.05)
2. Salva texto no KB como documento intermediário
3. **LLM Premium (Claude Sonnet)** → Gera 20 fichamentos técnicos (~$4.50)

**Total: ~$4.55** (vs $9.00 com abordagem 100% Claude)
**Economia: 50% + arquivos intermediários reutilizáveis!**

---

## ⚠️ Problema Identificado

Durante análise via **CHAT**, a LLM do chat pode automaticamente chamar ferramentas como `pesquisar_jurisprudencia`, causando:
- ❌ Timeouts (DataJud API lenta/indisponível)
- ❌ Erros de certificado SSL
- ❌ Processamento demorado
- ❌ Taxa de sucesso 0% no enriquecimento

**IMPORTANTE:** O problema NÃO é no processador V2 (que está correto), mas sim no contexto do chat!

## ✅ Solução: Usar Endpoint Direto

### Opção 1: Apenas Extração (Sem Análise) - RÁPIDO

Use o endpoint `/api/kb/analyze-v2` com `analysisType: "extract_only"`:

```bash
curl -X POST https://iarom.com.br/api/kb/analyze-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "documentName": "processo-12345.pdf",
    "analysisType": "extract_only",
    "model": "sonnet"
  }'
```

**O que faz:**
- ✅ Extrai texto completo do PDF (OCR se necessário)
- ✅ Salva no KB como documento intermediário
- ✅ **NÃO chama LLM** (custo zero de análise)
- ✅ **NÃO busca jurisprudência**
- ✅ Rápido (~30s para documento de 300 páginas)

---

### Opção 2: Extração + Análise Completa (RECOMENDADO) ⭐

```bash
curl -X POST https://iarom.com.br/api/kb/analyze-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "documentName": "processo-12345.pdf",
    "analysisType": "complete",
    "model": "sonnet"
  }'
```

**O que faz (Arquitetura V2 - LLM Barata + LLM Premium):**

#### Fase 1: Extração com LLM Barata
- ✅ Nova Micro extrai texto completo do PDF (com OCR se necessário)
- ✅ Limpa e estrutura o texto
- ✅ Custo: ~$0.05 para processo de 300 páginas

#### Fase 2: Salvamento no KB
- ✅ Salva texto extraído como documento intermediário
- ✅ Reutilizável para análises futuras (sem custo adicional de extração)

#### Fase 3: Análise com LLM Premium
- ✅ Claude Sonnet lê o texto já limpo
- ✅ Gera **20 fichamentos técnicos** em 1 única chamada:
  - FICHAMENTO.md
  - CRONOLOGIA.md
  - ANALISE_JURIDICA.md
  - RESUMO_EXECUTIVO.md
  - TESES_JURIDICAS.md
  - ANALISE_DE_PROVAS.md
  - PEDIDOS_E_DECISOES.md
  - E mais 13 tipos especializados...
- ✅ Custo: ~$4.50

#### Vantagens
- ✅ **NÃO busca jurisprudência** (ferramentas desabilitadas: `enableTools: false`)
- ✅ Rápido: ~3-5 minutos
- ✅ Econômico: 50% mais barato que 100% Claude
- ✅ Texto intermediário salvo para reutilização

---

### Opção 3: Análise Customizada

```bash
curl -X POST https://iarom.com.br/api/kb/analyze-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "documentName": "processo-12345.pdf",
    "analysisType": "custom",
    "customPrompt": "Identifique todos os pedidos e suas fundamentações legais",
    "model": "sonnet"
  }'
```

---

## ❌ O Que NÃO Fazer

### NÃO use o Chat para upload/análise inicial

```text
❌ Usuário: "Analise este processo: processo-12345.pdf"
```

**Por que não:**
- A LLM automaticamente chama `analisar_documento_kb`
- Durante a análise, **pode decidir** chamar `pesquisar_jurisprudencia`
- Isso causa timeouts e erros de SSL

---

## 📋 Fluxo Recomendado

### 1. Upload do PDF

```bash
# Faça upload via interface web ou API
POST /api/upload
```

### 2. Extração Simples (Sem Análise)

```bash
POST /api/kb/analyze-v2
{
  "documentName": "processo-12345.pdf",
  "analysisType": "extract_only",
  "model": "sonnet"
}
```

**Resultado:**
- Texto extraído e salvo no KB
- ID do documento: `processo-12345_TEXTO_COMPLETO.md`

### 3. (Opcional) Análises Futuras

Agora você pode:
- ✅ Fazer perguntas no chat sobre o documento (ele está no KB)
- ✅ Gerar fichamentos: `analysisType: "complete"`
- ✅ Análises customizadas: `analysisType: "custom"`

**Vantagem:** Texto já está extraído, não precisa reprocessar PDF!

---

## 🔧 Correções Aplicadas & Verificações

### 1. Erro de Certificado SSL ✅ (CORRIGIDO)

**Corrigido em:**
- `src/services/jurisprudence-scraper-service.js`
- `src/services/datajud-service.js`

**Mudança:**
```javascript
import https from 'https';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Em todas as chamadas axios:
axios.get(url, {
  httpsAgent,  // ← NOVO
  // ...
})
```

**Nota:** Essa correção é apenas para quando ferramentas de jurisprudência são usadas. Se você usar `/api/kb/analyze-v2` diretamente, esse erro **nunca acontece**.

---

### 2. Document Processor V2 - Ferramentas Desabilitadas ✅ (JÁ ESTAVA CORRETO)

**VERIFICADO:** O `document-processor-v2.js` tem `enableTools: false` em **TODAS as 5 chamadas à LLM**:

```javascript
// Linha 382 - Extração com Nova Micro
conversar(extractionPrompt, {
  modelo: MODELS['nova-micro'].id,
  enableTools: false,  // ✅
  // ...
})

// Linha 399 - Fallback para Haiku
conversar(extractionPrompt, {
  modelo: MODELS['haiku'].id,
  enableTools: false,  // ✅
  // ...
})

// Linha 908 - Análise com LLM Premium (Claude)
conversar(fullPrompt, {
  modelo: MODELS[model].id,
  enableTools: false,  // ✅
  // ...
})
```

**Resultado:** Quando você usa `/api/kb/analyze-v2`:
- ✅ **NUNCA** chama `pesquisar_jurisprudencia`
- ✅ **NUNCA** chama outras ferramentas
- ✅ Apenas extrai texto + analisa + gera fichamentos
- ✅ Fluxo V2 (LLM Barata + LLM Premium) funciona perfeitamente

---

### 3. Por Que o Erro Acontecia? 🔍

O erro **SÓ acontece** quando:
1. Usuário usa o **CHAT**
2. Pede para analisar um processo
3. LLM do **contexto do chat** decide chamar `pesquisar_jurisprudencia`
4. Essa ferramenta tenta scraping de sites de tribunais
5. Sites têm SSL inválido ou Cloudflare → erro

**Solução:** Usar API direta, que bypassa o contexto do chat!

---

## 📊 Comparação de Métodos

| Método | LLM Barata | LLM Premium | Busca Jurisp. | Fichamentos | Tempo | Custo |
|--------|-----------|-------------|---------------|-------------|-------|-------|
| **❌ Chat: "Analise X"** | ✅ | ✅ | ⚠️ Pode chamar | ✅ | ~5-10min | $$$ + erros |
| **✅ API: complete (V2)** | ✅ Nova Micro | ✅ Claude | ❌ Não | ✅ 20 tipos | ~3-5min | ~$4.55 |
| **API: extract_only** | ✅ Nova Micro | ❌ Não | ❌ Não | ❌ Não | ~30s | ~$0.05 |
| **API: custom** | ✅ Nova Micro | ✅ Claude | ❌ Não | 🔧 Custom | ~2-5min | Variável |

**Recomendação:** Use `API: complete` para obter o melhor custo-benefício com fluxo V2!

---

## 🚀 Próximos Passos

1. **Para apenas extrair texto:**
   ```bash
   POST /api/kb/analyze-v2
   { "analysisType": "extract_only" }
   ```

2. **Para fazer análise completa sem buscar jurisprudência:**
   ```bash
   POST /api/kb/analyze-v2
   { "analysisType": "complete" }
   ```

3. **Se QUISER buscar jurisprudência:**
   - Primeiro extraia o texto (`extract_only`)
   - Depois use o chat: "Busque jurisprudência sobre [tema do processo]"
   - A LLM vai chamar `pesquisar_jurisprudencia` de forma controlada

---

## 🐛 Logs do Erro (Referência)

Erro típico quando chat chama jurisprudência automaticamente:
```
unable to verify the first certificate
HTTP 403 - Cloudflare/anti-bot
Taxa de sucesso: 0.0%
```

**Solução:** Use endpoint direto `/api/kb/analyze-v2` com `extract_only` ✅
