# 🔧 Como Integrar o Sistema de Orquestração V5.0

## ✅ Status Atual

- **Sistema:** LIVE em https://iarom.com.br
- **Prompts V5.0:** 89 arquivos disponíveis em `data/prompts/global/`
- **Orquestrador:** `lib/prompt-orchestrator.js` pronto para uso
- **Impacto:** ZERO nas funcionalidades existentes

## 📝 Integração Simples (Recomendada)

### Opção 1: Integrar no Router Existente

Edite `lib/router.js` ou o arquivo principal que processa requisições:

```javascript
import orchestrator from './prompt-orchestrator.js';

// Na função que constrói o system prompt:
export function buildOptimizedPrompt(config, content) {
  // NOVO: Detectar prompt V5.0 automaticamente
  const userMessage = content.instruction || content.additionalInstructions || '';
  const v5Result = orchestrator.buildSystemPromptV5(userMessage);

  if (v5Result.isV5) {
    // Usuário pediu uma peça específica - usar prompt V5.0
    console.log(`✅ Prompt V5.0 ativado: ${v5Result.promptType}`);
    return v5Result.systemPrompt;
  }

  // FALLBACK: Usar lógica existente se não detectou V5.0
  return buildExistingPrompt(config, content);
}
```

### Opção 2: Middleware de Detecção

Adicione antes do processamento principal:

```javascript
import orchestrator from './lib/prompt-orchestrator.js';

export function processRequest(pieceType, area, content = {}, modeOverride = null) {
  // NOVO: Tentar detectar prompt V5.0 primeiro
  const userMessage = content.instruction || '';
  const v5 = orchestrator.detectPromptV5(userMessage);

  if (v5) {
    console.log(`🎯 Prompt V5.0 detectado: ${v5}`);
    // Carregar prompt específico
    const specificPrompt = orchestrator.loadPromptV5(v5);
    // ... usar specificPrompt como system prompt
  }

  // Continuar com lógica existente...
  const modelSelection = router.selectModel(pieceType, area, modeOverride);
  // ...
}
```

## 🔍 Exemplo Completo de Uso

```javascript
import orchestrator from './lib/prompt-orchestrator.js';

// Exemplo 1: Usuário pediu "apelação"
const msg1 = "Preciso redigir uma apelação cível";
const result1 = orchestrator.buildSystemPromptV5(msg1);

console.log(result1);
// {
//   systemPrompt: "...[MOD_MASTER_CORE + orquestrador + PROMPT_APELACAO_CIVEL_V5.0]...",
//   promptType: "PROMPT_APELACAO_CIVEL_V5.0",
//   isV5: true
// }

// Exemplo 2: Usuário pediu "habeas corpus"
const msg2 = "Redigir habeas corpus preventivo";
const result2 = orchestrator.buildSystemPromptV5(msg2);

console.log(result2.promptType);
// "PROMPT_HABEAS_CORPUS_V5.0"

// Exemplo 3: Mensagem genérica
const msg3 = "Olá, preciso de ajuda";
const result3 = orchestrator.buildSystemPromptV5(msg3);

console.log(result3.isV5);
// false - usa prompt genérico

// Listar todos os prompts disponíveis
const available = orchestrator.listPromptsV5();
console.log(available);
// {
//   total: 89,
//   keywords: 80,
//   prompts: {
//     "PROMPT_APELACAO_CIVEL_V5.0.txt": ["apelacao", "apelação"],
//     "PROMPT_HABEAS_CORPUS_V5.0.txt": ["habeas corpus", "hc"],
//     ...
//   }
// }
```

## 🎯 Keywords Suportadas

### Recursos Cíveis
- `"apelacao"`, `"apelação"` → Apelação Cível
- `"agravo"`, `"agravo instrumento"` → Agravo de Instrumento
- `"agravo interno"` → Agravo Interno
- `"recurso especial"`, `"resp"` → Recurso Especial
- `"recurso extraordinario"`, `"re"` → Recurso Extraordinário
- `"embargos"`, `"embargos de declaracao"` → Embargos de Declaração

### Criminais
- `"habeas corpus"`, `"hc"` → Habeas Corpus
- `"apelacao criminal"` → Apelação Criminal
- `"resposta acusacao"`, `"resposta à acusação"` → Resposta à Acusação
- `"alegacoes finais"`, `"alegações finais"` → Alegações Finais
- `"liberdade provisoria"` → Liberdade Provisória
- `"relaxamento"` → Relaxamento de Prisão

### Trabalhistas
- `"reclamacao trabalhista"` → Reclamação Trabalhista
- `"contestacao trabalhista"` → Contestação Trabalhista
- `"recurso ordinario"` → Recurso Ordinário
- `"recurso revista"` → Recurso de Revista

### Contratos
- `"contrato"` → Contrato Geral
- `"contrato social"` → Contrato Social
- `"notificacao"`, `"notificação"` → Notificação Extrajudicial
- `"parecer"` → Parecer Jurídico
- `"acordo"` → Termo de Acordo

### Análise e Revisão
- `"analise"`, `"análise"` → Análise de Petição
- `"revisao"`, `"revisão"` → Revisão Claude

## 🚀 Deploy

**Status:** ✅ Já está em produção!

- Commit: `4ed12d8`
- URL: https://iarom.com.br
- Auto-deploy: Ativado
- Prompts V5.0: 89 arquivos em `data/prompts/global/`

## 🔒 Garantias

1. **Zero impacto nas funcionalidades existentes**
   - OCR continua funcionando
   - Analytics continua funcionando
   - Extractor continua funcionando
   - Router continua funcionando

2. **Opt-in**
   - Só ativa V5.0 se detectar keywords
   - Caso contrário, usa lógica existente
   - Não quebra nenhum fluxo atual

3. **Compatível com código legado**
   - Módulo standalone
   - Não requer modificações obrigatórias
   - Pode ser importado apenas onde necessário

## 📊 Monitoramento

Adicione logs para acompanhar uso:

```javascript
const result = orchestrator.buildSystemPromptV5(userMessage);

if (result.isV5) {
  console.log(`[V5.0] Prompt ativado: ${result.promptType}`);
  // Registrar métrica
  analytics.trackPromptV5Usage(result.promptType);
}
```

## ✅ Próximos Passos

1. **Testar localmente** (opcional):
   ```bash
   node
   > import orchestrator from './lib/prompt-orchestrator.js';
   > orchestrator.listPromptsV5()
   ```

2. **Integrar no código** quando estiver pronto:
   - Escolher Opção 1 ou 2 acima
   - Adicionar import em `lib/router.js` ou onde preferir
   - Testar com keywords como "apelação", "habeas corpus"

3. **Monitorar logs** no Render Dashboard:
   - Verificar se prompts V5.0 estão sendo carregados
   - Confirmar detecção automática funcionando

---

**Sistema pronto!** Os prompts V5.0 estão disponíveis e podem ser usados quando você integrar o módulo. 🎉
