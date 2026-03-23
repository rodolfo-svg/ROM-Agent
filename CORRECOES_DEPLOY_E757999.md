# Correções Deployadas - Commit e757999

**Data**: 2026-03-04
**Status**: ✅ EM DEPLOY (aguardando conclusão)

---

## 🔥 PROBLEMA CRÍTICO IDENTIFICADO

**System Prompts Estavam Usando Emojis Para Instruir A Não Usar Emojis**

Isso é irônico e contraproducente:
- Prompts continham ❌, ✅, 🚫 para descrever regras
- Modelo via emojis no prompt e os reproduzia nas respostas
- Confusão entre "exemplo do que não fazer" e "instrução"

---

## ✅ CORREÇÃO IMPLEMENTADA

### Mudança Conceitual

**ANTES (INCORRETO)**:
```markdown
🚫 REGRAS CRÍTICAS DE FORMATAÇÃO

❌ **NUNCA use sinais típicos de IA:**
- ❌ Travessões longos (—)
- ❌ Asteriscos duplos (**texto**)
- ❌ Emojis de qualquer tipo

✅ **SEMPRE use formatação jurídica tradicional:**
- ✅ Numeração romana (I, II, III)
```

**DEPOIS (CORRETO)**:
```markdown
REGRAS CRÍTICAS DE FORMATAÇÃO

PROIBIDO - NUNCA use sinais típicos de IA:
- Travessões longos (—)
- Asteriscos duplos para destaque
- Emojis de qualquer tipo

OBRIGATÓRIO - SEMPRE use formatação jurídica tradicional:
- Numeração romana (I, II, III)
```

### Arquivos Modificados

#### 1. `src/server-enhanced.js` (buildContextualSystemPrompt)
**Linhas**: 1360-1438

**Mudanças**:
- Removidos todos os emojis (❌, ✅, 🚫)
- Substituídos por texto: "PROIBIDO", "OBRIGATÓRIO"
- Exemplos sem formatação markdown decorativa
- Tom profissional e direto

#### 2. `lib/batch-analysis-prompt.js`
**Linhas**: 14-30

**Mudanças**:
- Regras de formatação sem emojis
- Instruções claras e objetivas
- Texto limpo para o modelo seguir

#### 3. `lib/document-processor-v2.js` (3 locais)

**Local 1 - System Prompt Batch 1** (linha ~1378):
```javascript
// ANTES:
`🚫 REGRAS CRÍTICAS DE FORMATAÇÃO:
- NUNCA use marcadores de IA: travessões (—), asteriscos (**), barras (//), emojis`

// DEPOIS:
`REGRAS CRÍTICAS DE FORMATAÇÃO:
- PROIBIDO usar marcadores de IA: travessões longos (—), asteriscos duplos, barras (//), emojis`
```

**Local 2 - System Prompt Batch 2** (linha ~1423):
Mesma correção aplicada

**Local 3 - createSplitBatchPrompt** (linha ~1530):
Removidos emojis do user prompt também

---

## 📊 IMPACTO ESPERADO

### Antes da Correção
```
System Prompt contém:
❌ ✅ 🚫 (emojis visíveis)
↓
Modelo aprende que emojis são aceitáveis
↓
Respostas contêm:
❌ ✅ 🚫 ✓ ✔
```

### Depois da Correção
```
System Prompt contém:
PROIBIDO, OBRIGATÓRIO (texto puro)
↓
Modelo entende que deve evitar emojis
↓
Respostas contêm:
APENAS texto profissional
```

---

## 🧪 VALIDAÇÃO NECESSÁRIA

### Teste 1: Chat Direto
```
1. Fazer pergunta simples: "Resuma o processo X"
2. Verificar resposta NÃO contém:
   - Emojis (❌, ✅, 🚫, ✓, ✔, etc)
   - Travessões longos (—)
   - Asteriscos duplos (**texto**)
   - Marcadores com hífen (-)
3. Verificar resposta contém:
   - Numeração romana (I, II, III)
   - Numeração árabe (1, 2, 3)
   - Formatação jurídica tradicional
```

### Teste 2: Extração de Documento
```
1. Upload de PDF
2. Aguardar geração dos 18 fichamentos
3. Abrir CADA fichamento e verificar:
   - Zero emojis
   - Zero placeholders vazios
   - Formatação profissional
```

### Teste 3: Geração de Peça Jurídica
```
1. Solicitar: "Redija uma petição inicial sobre X"
2. Verificar documento gerado:
   - Sem marcadores de IA
   - Formatação ABNT/OAB
   - Profissional do início ao fim
```

---

## ⚠️ PROBLEMA ADICIONAL REPORTADO: Tela Preta

### Descrição do Usuário
"tela preta ainda aparece na conversa e na caixa de diálogo que abre à direita quando apresenta o documento"

### Investigação Inicial

Analisei os componentes frontend:
- `ArtifactPanel.tsx` - Fundo branco/cinza claro
- `MessageItem.tsx` - Fundo branco
- `globals.css` - Blocos `<pre>` têm `bg-stone-900` (cinza escuro)

### Hipóteses

#### Hipótese 1: Blocos de Código Grandes
```css
/* globals.css linha 182 */
.prose-chat pre {
  @apply bg-stone-900; /* ← FUNDO ESCURO */
}
```

Se documento contém muito código markdown (triple backticks), blocos `<pre>` ficam com fundo escuro.

**Possível solução**: Mudar `bg-stone-900` para `bg-white` ou `bg-stone-50`

#### Hipótese 2: Markdown Mal Formatado
Se resposta contém markdown incorreto:
```markdown
```
(sem código, apenas backticks)
```
```

Pode criar blocos vazios com fundo preto.

#### Hipótese 3: CSS Corrupto ou Cached
Build do frontend pode estar usando CSS antigo.

**Solução**: Rebuild frontend em produção

### Ações Necessárias para Diagnóstico

**Preciso de mais informações do usuário**:

1. **Quando a tela preta aparece?**
   - Sempre que abre chat?
   - Apenas em respostas longas?
   - Apenas quando abre artifact panel?
   - Apenas em documentos específicos?

2. **Screenshot ou vídeo**
   - Isso ajudaria imensamente a identificar o problema

3. **Console do navegador**
   - Abrir DevTools (F12)
   - Ver se há erros JavaScript
   - Ver elemento com "Inspect Element"

4. **Testar sem cache**
   - Ctrl+Shift+R (hard reload)
   - Modo anônimo/incognito

---

## 🚀 STATUS DO DEPLOY

### Commit e757999
```bash
✅ Pushed to main
⏳ Render.com auto-deploy em andamento
⏱️ ETA: ~3-5 minutos
```

### Verificar Deploy
```bash
curl -s https://iarom.com.br/api/info | jq '.server.gitCommit'
# Esperado: "e757999"
```

---

## 📋 PRÓXIMOS PASSOS

### Imediatos
1. ✅ Deploy concluído
2. ⏳ Aguardar validação do usuário
3. ⏳ Coletar mais informações sobre "tela preta"

### Se Problema Persistir (Sinais de IA)
- Verificar se está usando legacy prompt ao invés de contextual
- Adicionar logging para ver qual prompt está sendo usado
- Testar com diferentes tipos de mensagens

### Para Problema de Tela Preta
- Aguardar screenshots/descrição detalhada
- Revisar CSS do frontend
- Potencialmente fazer rebuild do frontend
- Investigar blocos `<pre>` com fundo escuro

---

## 🔬 DEBUG ADICIONAL SE NECESSÁRIO

### Verificar Qual Prompt Está Sendo Usado
Adicionar ao `chat-stream.js`:
```javascript
console.log('[DEBUG] System prompt length:', finalSystemPrompt.length);
console.log('[DEBUG] System prompt preview:', finalSystemPrompt.slice(0, 500));
```

### Forçar Uso do Prompt Contextual
Garantir que `PROMPTS_VERSION=contextual` está setado no Render.

### Rebuild Frontend
Se problema for de CSS cached:
```bash
cd frontend
npm run build
# Fazer commit do dist/
```

---

## 📞 RESUMO EXECUTIVO

✅ **CORRIGIDO**: Emojis nos system prompts removidos
✅ **DEPLOYADO**: Commit e757999 em produção
⏳ **AGUARDANDO**: Validação do usuário
❓ **INVESTIGANDO**: Problema de "tela preta" (preciso mais info)

**Próxima ação recomendada**:
1. Aguardar deploy completar (~2 minutos)
2. Usuário testar chat e extração
3. Usuário fornecer detalhes sobre tela preta (quando/onde/screenshot)
