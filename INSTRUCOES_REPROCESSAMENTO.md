# 🔄 INSTRUÇÕES: Reprocessar Documento Alessandro Ribeiro

## Situação Atual

✅ **Documento já existe no KB**: Report01770235205448.pdf
✅ **Texto já foi extraído**: kb-extracted-{id}.md (451KB, 9325 linhas)
❌ **Ficheiros estruturados NÃO foram salvos**: Bug corrigido agora

## O que fazer AGORA

### 1️⃣ Aguardar Deploy (2-3 minutos)
```
Acessar: https://dashboard.render.com
Projeto: ROM-Agent
Status: Aguardar até ver "Live" (verde)
```

### 2️⃣ Acessar KB Tab
```
1. Ir para: https://iarom.com.br
2. Fazer login (se necessário)
3. Clicar na aba "Knowledge Base"
```

### 3️⃣ Localizar o Documento
```
Procurar na lista por:
- Nome: "Report01770235205448.pdf"
- OU: "alessandro"
- OU: Ordenar por data (deve estar entre os recentes)
```

### 4️⃣ Clicar em "Analisar" (🧠)
```
Botão localizado ao lado direito do documento
Ícone: 🧠 (cérebro)
Texto: "Analisar"
```

### 5️⃣ Configurar Análise
```
Modal abrirá com opções:

┌──────────────────────────────────────┐
│  Análise de Documento                │
├──────────────────────────────────────┤
│  Documento: Report01770235205448.pdf │
│                                      │
│  Tipo de Análise:                    │
│  ○ Extract Only                      │
│  ● Complete  ← SELECIONAR ESTE       │
│  ○ Custom                            │
│                                      │
│  Modelo LLM:                         │
│  ○ Haiku (rápido, básico)           │
│  ● Sonnet (recomendado) ← ESTE      │
│  ○ Opus (máxima qualidade, caro)    │
│                                      │
│  [Cancelar]  [Iniciar Análise]      │
└──────────────────────────────────────┘
```

**Seleções recomendadas:**
- ✅ Tipo: **Complete**
- ✅ Modelo: **Sonnet**

### 6️⃣ Iniciar e Aguardar
```
1. Clicar em "Iniciar Análise"
2. Barra de progresso aparecerá
3. Aguardar ~3-4 minutos

Progresso:
[████████░░░░░░░░░░] 40% - Gerando FICHAMENTO.md...
```

**Etapas do processamento:**
```
⏱️ Etapa 1 (~30s):  Extração com Nova Micro (RÁPIDA - já tem cache!)
💾 Etapa 2 (~5s):   Salvamento texto completo
📋 Etapa 3 (~45s):  Geração FICHAMENTO.md
⚖️ Etapa 4 (~60s):  Geração ANALISE_JURIDICA.md
📅 Etapa 5 (~40s):  Geração CRONOLOGIA.md
📝 Etapa 6 (~30s):  Geração RESUMO_EXECUTIVO.md
💾 Etapa 7 (~5s):   SALVAMENTO no KB ← NOVO!
```

### 7️⃣ Verificar Conclusão
```
Status mudará para:
✅ "Completed"

Ou verá mensagem:
"✅ 4 ficheiros salvos no KB (disponíveis para chat)"
```

---

## 🧪 TESTAR NO CHAT

Após conclusão, ir para aba "Chat" e testar:

### Teste 1: Busca Genérica
```
liste as extrações do alessandro ribeiro
```

**Resultado esperado:**
Middleware carrega automaticamente 4 ficheiros estruturados (~25KB)

### Teste 2: Consulta Específica
```
Acesse o processo do espólio alessandro ribeiro no KB e em atendimento ao despacho
apresente justificativa ao empréstimo, explique de acordo com o depoimento da Elaine
que eram duas operações primitivas, uma de 450 e outra de 550 com juros de 6% que
totalizaram 1300. Os documentos estão nos movimentos 1 e 14.
```

**Resultado esperado:**
Claude cita especificamente movimento 1 e 14, valores R$ 450 e R$ 550, depoimento Elaine

### Teste 3: Verificação Logs
```
Abrir Developer Tools (F12)
→ Aba Console
→ Procurar por: "KB Loader"
→ Deve mostrar: "✅ [KB Loader] 4 ficheiro(s) carregado(s)"
```

---

## 💰 CUSTO DO REPROCESSAMENTO

| Item | Valor |
|------|-------|
| Extração (Nova Micro - 451KB) | $0.06 |
| FICHAMENTO (Sonnet) | $0.70 |
| ANALISE_JURIDICA (Sonnet) | $0.75 |
| CRONOLOGIA (Sonnet) | $0.65 |
| RESUMO_EXECUTIVO (Sonnet) | $0.64 |
| **TOTAL** | **~$2.80 USD** |

**Observação:** Como o texto já foi extraído, a Etapa 1 pode usar cache e ser MUITO mais rápida.

---

## ⚠️ SE DER ERRO

### Erro: "Documento não encontrado"
```
Solução: 
1. Voltar para KB tab
2. Verificar se documento está na lista
3. Usar busca: digitar "alessandro"
```

### Erro: "Barra de progresso não aparece"
```
Solução:
1. Abrir DevTools (F12) → Console
2. Procurar mensagens de erro
3. Verificar se WebSocket conectou: "ws: connected"
```

### Erro: "Analysis failed"
```
Solução:
1. Ir para Render.com → Shell
2. Verificar logs: tail -100 logs/combined.log
3. Procurar linha com "❌ [V2 Direct] Erro completo"
```

---

## 🎯 RESULTADO FINAL ESPERADO

Após reprocessamento bem-sucedido:

### No disco (Render Shell):
```bash
$ ls -lh data/knowledge-base/documents/ | grep -E "01_FICHAMENTO|02_ANALISE|03_CRONOLOGIA|04_RESUMO"

1770XXXXX_Report_01_FICHAMENTO.md          45K
1770XXXXX_Report_02_ANALISE_JURIDICA.md    52K
1770XXXXX_Report_03_CRONOLOGIA.md          38K
1770XXXXX_Report_04_RESUMO_EXECUTIVO.md    15K
```

### Em kb-documents.json:
```json
{
  "id": "original-doc-id",
  "name": "Report01770235205448.pdf",
  "metadata": {
    "hasStructuredFiles": true,
    "structuredFilesCount": 4,
    "structuredDocsInKB": [
      {
        "name": "01_FICHAMENTO.md",
        "path": "/path/to/fichamento.md",
        "type": "FICHAMENTO",
        "size": 45000
      },
      // ... outros 3 ficheiros
    ]
  }
}
```

### No chat:
```
Logs mostram:
🔍 [KB Loader] Busca genérica ativada por palavras-chave
✅ [KB Loader] 4 ficheiro(s) carregado(s) via busca genérica
   📄 Carregado: 01_FICHAMENTO.md
   📄 Carregado: 02_ANALISE_JURIDICA.md
   📄 Carregado: 03_CRONOLOGIA.md
   📄 Carregado: 04_RESUMO_EXECUTIVO.md
📊 [Stream/init] kbContextLength: 25440
```

---

## 📞 DÚVIDAS

**P: Por que precisa reprocessar se o texto já foi extraído?**
R: Porque os ficheiros estruturados (FICHAMENTO, etc.) eram gerados mas não salvos. O bug foi corrigido, mas você precisa executar o processamento novamente para que os ficheiros sejam gerados E salvos desta vez.

**P: Vai demorar 30 minutos de novo?**
R: NÃO! A extração (Etapa 1) pode usar cache do texto já extraído. Total: ~3-4 minutos.

**P: E se eu já tiver outro documento no KB?**
R: Não afeta. Cada documento tem seus próprios ficheiros estruturados.

**P: Os ficheiros antigos serão apagados?**
R: Não. Os novos ficheiros terão IDs únicos com timestamp.

---

**Criado em:** 2026-02-05
**Commit relacionado:** 36cc4a5
**Status do deploy:** https://dashboard.render.com/web/srv-co46n6lim4fc73e2lcpg
