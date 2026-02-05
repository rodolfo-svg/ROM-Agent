# 📚 GUIA DE USO: Sistema de Knowledge Base (KB) do ROM Agent

## ❌ PROBLEMA IDENTIFICADO

O sistema V2 de extração está **GERANDO** os ficheiros técnicos (FICHAMENTO, ANALISE_JURIDICA, etc.), mas **NÃO OS ESTÁ SALVANDO NO DISCO**.

### O que acontece atualmente:

1. ✅ Documento é extraído com sucesso (texto completo)
2. ✅ Extração é salva em `data/extracted-texts/{id}.md`
3. ✅ 4 ficheiros técnicos são gerados em memória:
   - FICHAMENTO.md
   - ANALISE_JURIDICA.md
   - CRONOLOGIA.md
   - RESUMO_EXECUTIVO.md
4. ❌ **PORÉM**: Esses ficheiros NÃO são salvos fisicamente no disco
5. ❌ **RESULTADO**: O middleware `kb-loader.js` não consegue carregá-los no chat

---

## 🔧 POR QUE O CHAT NÃO ENCONTRA OS DADOS DETALHADOS?

Quando você pergunta:
```
"acesse o processo do alessandro ribeiro no kb e apresente justificativa ao empréstimo,
explique o depoimento da elaine sobre duas operações primitivas..."
```

**O que deveria acontecer:**
1. Middleware `kb-loader.js` detecta "alessandro ribeiro"
2. Busca no diretório `knowledge-base/documents/`
3. Encontra 7 ficheiros estruturados
4. Carrega os ficheiros com 27KB de contexto
5. Claude responde usando os dados específicos

**O que realmente acontece:**
1. ✅ Middleware detecta "alessandro ribeiro"
2. ✅ Busca no diretório
3. ❌ NÃO encontra ficheiros (porque não foram salvos)
4. ❌ Retorna apenas o texto extraído genérico
5. ❌ Claude não tem acesso aos detalhes específicos (movimento 1 e 14, depoimento Elaine, cheques, etc.)

---

## 🎯 SOLUÇÃO IMEDIATA

### Opção 1: Reprocessar o Documento (RECOMENDADO)

Depois que eu corrigir o código, você precisará:

1. **Acessar a aba KB** em iarom.com.br
2. **Localizar o documento** "Report01770235205448.pdf" (Alessandro Ribeiro)
3. **Clicar no botão "Analisar"** (ícone 🧠)
4. **Aguardar o processamento completo** (barra de progresso aparecerá)
5. **Resultado**: 7 ficheiros estruturados serão salvos:
   - `01_FICHAMENTO.md` - Identificação, partes, pedidos, movimentações
   - `02_INDICE_CRONOLOGICO.md` - Linha do tempo completa
   - `03_INDICE_POR_TIPO.md` - Documentos organizados por tipo
   - `04_ENTIDADES.json` - Pessoas, empresas envolvidas
   - `05_ANALISE_PEDIDOS.md` - Análise detalhada de cada pedido
   - `06_FATOS_RELEVANTES.md` - Eventos críticos
   - `07_LEGISLACAO_CITADA.md` - Leis e jurisprudência

### Opção 2: Usar o Texto Extraído Diretamente

Você pode pedir ao Claude:
```
"Leia o arquivo kb-extracted-{id}.md e analise o depoimento da Elaine
sobre as duas operações de empréstimo de R$ 450 e R$ 550..."
```

**Limitação**: O Claude terá que ler o documento completo (451KB, 9325 linhas),
o que consome mais tokens e é mais lento.

---

## 📖 COMO USAR O SISTEMA CORRETAMENTE (Após Correção)

### 1️⃣ **Upload de Documento**

```
1. Acesse: iarom.com.br → Aba "Knowledge Base"
2. Clique em "Upload" ou arraste o PDF
3. Aguarde conversão PDF → TXT
4. Status: "✅ Uploaded successfully"
```

### 2️⃣ **Análise Completa (V2)**

```
1. Localize o documento na lista
2. Clique no botão "Analisar" (🧠)
3. Escolha:
   - Tipo: "Complete" (extração + análise + ficheiros)
   - Modelo: "Sonnet" (recomendado para qualidade)
4. Aguarde processamento (barra de progresso):
   ├─ Etapa 1: Extração com Nova Micro (~30s)
   ├─ Etapa 2: Salvamento no KB (~5s)
   ├─ Etapa 3: Geração FICHAMENTO (~45s)
   ├─ Etapa 4: Geração ANALISE_JURIDICA (~60s)
   ├─ Etapa 5: Geração CRONOLOGIA (~40s)
   └─ Etapa 6: Geração RESUMO_EXECUTIVO (~30s)
5. Status: "✅ Completed" (Total: ~3-4 minutos)
```

**Custos Estimados:**
- Processo 100 páginas: $1.50 USD
- Processo 300 páginas: $4.50 USD
- Processo 451KB (Alessandro): ~$2.80 USD

### 3️⃣ **Usar no Chat**

Depois que os ficheiros estiverem salvos:

**Exemplo 1: Busca por Número CNJ**
```
"Analise o processo 5211157-86.2018.8.09.0051 e identifique
os empréstimos mencionados"
```

**Exemplo 2: Busca por Palavra-chave**
```
"Acesse o processo do Alessandro Ribeiro e liste os documentos
dos movimentos 1 e 14"
```

**Exemplo 3: Consulta Específica**
```
"No processo do Espólio Alessandro, localize o depoimento da
Elaine sobre as duas operações primitivas de R$ 450 e R$ 550"
```

**O que acontece nos bastidores:**
1. Middleware `kb-loader.js` detecta "alessandro" ou "5211157-86.2018.8.09.0051"
2. Carrega automaticamente os 7 ficheiros estruturados (~27KB)
3. Envia para Claude junto com sua pergunta
4. Claude responde com base nos ficheiros carregados

---

## 🛠️ CONFIGURAÇÕES AVANÇADAS

### Palavras-chave que Ativam Busca Genérica:
```javascript
- alessandro
- ribeiro
- monitoria
- processo
- emprestimo
- extrações
- extração
- últimas
- recentes
- liste
- listar
```

### Como Desabilitar Auto-loading:
Se você NÃO quiser que o sistema carregue automaticamente os ficheiros:

```javascript
// Em kb-loader.js, linha 207-212
if (!processosMatch || processosMatch.length === 0) {
  // Comentar essa seção para desabilitar busca genérica
  return next();
}
```

---

## 📊 VERIFICAR STATUS DO SISTEMA

### Via Frontend (Render Shell):

```bash
# Acessar shell em render.com
cd /opt/render/project/src

# Verificar últimas extrações
grep "extraction/init" logs/combined.log | tail -5

# Verificar se ficheiros foram salvos
ls -lh data/knowledge-base/documents/ | grep -v test

# Ver KB Loader em ação
grep "KB Loader" logs/combined.log | tail -20
```

### Via API (Postman/cURL):

```bash
# Listar documentos no KB
curl -X GET https://iarom.com.br/api/kb/documents \
  -H "Cookie: connect.sid={seu-cookie}"

# Verificar extração job
curl -X GET https://iarom.com.br/api/kb/extraction-jobs/{jobId} \
  -H "Cookie: connect.sid={seu-cookie}"

# Status do sistema V2
curl -X GET https://iarom.com.br/api/kb/analyze-v2/status
```

---

## ⚠️ LIMITAÇÕES ATUAIS

### 1. Ficheiros Não Salvos no Disco
**Status**: 🐛 BUG IDENTIFICADO
**Impacto**: Chat não consegue acessar detalhes específicos
**Solução**: Em desenvolvimento (modificação no document-processor-v2.js)

### 2. Middleware Não Carrega Ficheiros Ausentes
**Status**: ✅ FUNCIONANDO (mas ficheiros não existem)
**Impacto**: kbContext fica vazio se ficheiros não foram salvos
**Solução**: Após correção do item 1, funcionará automaticamente

### 3. Budget de Tokens (25,000)
**Status**: ⚠️ LIMITAÇÃO INTENCIONAL
**Impacto**: Ficheiros muito grandes são truncados
**Solução**: Sistema prioriza ficheiros por ordem: FICHAMENTO → CRONOLOGIA → TIPO → etc.

---

## 🎯 PRÓXIMOS PASSOS

### 1. CORREÇÃO URGENTE (Agora)
- [ ] Modificar `document-processor-v2.js` para salvar ficheiros no disco
- [ ] Atualizar metadata em `kb-documents.json` com referências aos ficheiros
- [ ] Adicionar campo `structuredDocsInKB` ao metadata do documento

### 2. TESTES (Após correção)
- [ ] Reprocessar documento Alessandro Ribeiro
- [ ] Verificar se 7 ficheiros foram salvos em `knowledge-base/documents/`
- [ ] Testar chat perguntando sobre detalhes específicos
- [ ] Confirmar que Claude cita movimento 1 e 14, depoimento Elaine, etc.

### 3. MELHORIAS FUTURAS
- [ ] Adicionar preview dos ficheiros na KB tab
- [ ] Criar endpoint para download de ficheiros individuais
- [ ] Implementar busca full-text nos ficheiros estruturados
- [ ] Dashboard de analytics (quantos ficheiros, custos, etc.)

---

## 💡 DICAS DE USO

### ✅ FAÇA:
- Use termos específicos: "alessandro ribeiro", "espólio", número CNJ
- Mencione movimentos específicos: "movimento 1 e 14"
- Peça análises detalhadas: "analise o depoimento da Elaine"
- Referencie valores: "empréstimos de R$ 450 e R$ 550"

### ❌ NÃO FAÇA:
- Perguntas genéricas: "me mostre processos" (use termos específicos)
- Esperar dados que não foram extraídos (verificar ficheiros primeiro)
- Assumir que o sistema adivinhou contexto (seja explícito)

---

## 📞 SUPORTE

**Logs em tempo real:**
Render.com → ROM-Agent → Shell → `tail -f logs/combined.log`

**Verificar KB Loader:**
```bash
grep -i "kb loader" logs/combined.log | tail -20
```

**Verificar Stream/Init:**
```bash
grep -i "stream/init" logs/combined.log | tail -5
```

**Email de Suporte:**
[Adicionar email se houver]

---

**Versão:** 1.0 (2026-02-05)
**Status:** 🐛 Sistema funcional, mas ficheiros técnicos não sendo salvos
**Próxima Atualização:** Após correção do bug de salvamento
