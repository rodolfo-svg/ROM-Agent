# Status: Custom Instructions System

**Data**: 2026-02-03
**Commits**: 88f9f73, ab9c645, 61f3c61

---

## ✅ O QUE FOI IMPLEMENTADO

### 1. Backend - Custom Instructions Manager (/lib/custom-instructions-manager.js)

**Status**: ✅ Implementado e funcionando

**Funcionalidades**:
- `load(partnerId)` - Carrega custom instructions do disco
- `getComponents(partnerId)` - Retorna os 3 componentes habilitados
- `getCompiledText(partnerId)` - Compila texto na sequência correta
- `shouldApply(context)` - Verifica se deve aplicar CI
- `save(data, updatedBy, partnerId)` - Salva com versionamento
- Cache de 5 minutos por partnerId

**Teste local**: ✅ PASSOU
```
✅ Custom Instructions carregadas (Versão: 1.0)
✅ 3 Componentes:
   1. Custom Instructions Gerais (818 tokens)
   2. Método de Formatação (1343 tokens)
   3. Método de Versionamento (1920 tokens)
✅ Texto compilado: 16.406 caracteres, 574 linhas
✅ shouldApply(chat): true
✅ shouldApply(peca): true
```

---

### 2. Backend - PromptBuilder Integração (/src/lib/prompt-builder.js)

**Status**: ✅ Implementado

**Sequência de Build** (linhas 96-154):
```javascript
// ETAPA 1: CUSTOM INSTRUCTIONS (OBRIGATÓRIO, SE HABILITADO)
if (includeCustomInstructions) {
  const customInstructions = customInstructionsManager.getCompiledText(partnerId);
  parts.push('═══════════════════════════════════════\n');
  parts.push('CUSTOM INSTRUCTIONS - SEQUÊNCIA OBRIGATÓRIA\n');
  parts.push('═══════════════════════════════════════\n\n');
  parts.push(customInstructions);
  parts.push('\n\n');
}

// ETAPA 2: PROMPT BASE (OPTIMIZED_SYSTEM_PROMPT)
parts.push(OPTIMIZED_SYSTEM_PROMPT);

// ETAPA 3: MÓDULOS CONDICIONAIS (TOOLS, ABNT)
if (includeTools) { ... }
if (includeABNT) { ... }
```

**Ordem Garantida**:
1. ✅ Custom Instructions (CI)
2. ✅ Método de Formatação (parte do CI)
3. ✅ Método de Versionamento (parte do CI)
4. ✅ OPTIMIZED_SYSTEM_PROMPT (prompt base)
5. ✅ Tools (se includeTools)
6. ✅ ABNT (se includeABNT)

---

### 3. Estrutura de Dados

**Arquivo**: `data/custom-instructions/rom/custom-instructions.json`

**Estrutura**:
```json
{
  "partnerId": "rom",
  "version": "1.0",
  "components": {
    "customInstructions": {
      "id": "custom_instructions_global",
      "name": "Custom Instructions Gerais",
      "enabled": true,
      "order": 1,
      "content": { "html": "...", "markdown": "...", "text": "..." },
      "metadata": { "wordCount": 404, "estimatedTokens": 818 }
    },
    "formattingMethod": {
      "id": "formatting_method",
      "name": "Método de Formatação",
      "enabled": true,
      "order": 2,
      "content": { "html": "...", "markdown": "...", "text": "..." },
      "metadata": { "wordCount": 717, "estimatedTokens": 1343 }
    },
    "versioningMethod": {
      "id": "versioning_method",
      "name": "Método de Versionamento e Redação",
      "enabled": true,
      "order": 3,
      "content": { "html": "...", "markdown": "...", "text": "..." },
      "metadata": { "wordCount": 963, "estimatedTokens": 1920 }
    }
  },
  "settings": {
    "enforcementLevel": "required",
    "applyToChat": true,
    "applyToPecas": true,
    "allowPartnerOverride": false,
    "allowUserOverride": true
  }
}
```

---

### 4. Frontend - Páginas de Administração

**Status**: ✅ Implementado (não testado em produção)

**Arquivos**:
- `frontend/src/pages/custom-instructions/CustomInstructionsPage.tsx` (400 linhas)
- `frontend/src/pages/custom-instructions/SuggestionsPage.tsx` (350 linhas)
- Rotas adicionadas em `frontend/src/App.tsx`

**Funcionalidades**:
- Editor de Custom Instructions (3 tabs: CI, Formatação, Versionamento)
- Preview compilado
- Histórico de versões
- Sugestões de IA (pendente)

---

### 5. API Endpoints

**Status**: ✅ Implementado

**Rotas** (`/api/custom-instructions`):
- `GET /:partnerId` - Obter CI de um parceiro
- `GET /` - Listar CI disponíveis (baseado em permissões)
- `GET /:partnerId/preview` - Preview do texto compilado
- `PUT /:partnerId` - Atualizar CI (requer admin)
- `POST /:partnerId/components/:componentId` - Atualizar componente
- `GET /:partnerId/versions` - Listar versões históricas
- `POST /:partnerId/rollback/:version` - Rollback para versão anterior

**Middleware de Segurança**:
- `canEditCustomInstructions` - Verifica permissões de edição
- `canViewCustomInstructions` - Verifica permissões de visualização

**Permissões**:
- **master_admin**: Edita todos os escritórios
- **partner_admin**: Edita apenas do próprio escritório
- **admin**: Edita apenas do próprio escritório
- **user**: Apenas visualiza

---

## ⚠️ PENDÊNCIAS PARA PRODUÇÃO

### 1. Variável de Ambiente: PROMPTS_VERSION

**Verificar**: O sistema de produção está usando qual versão de prompts?

**Opções**:
- `PROMPTS_VERSION=contextual` → Usa PromptsManager (sistema antigo)
- `PROMPTS_VERSION=optimized` → Usa PromptBuilder **COM Custom Instructions** ✅
- `PROMPTS_VERSION=legacy` → Usa custom-instructions.json antigo

**Ação Necessária**: Configurar `PROMPTS_VERSION=optimized` em produção

**Como verificar**:
```bash
# Em produção, executar:
echo $PROMPTS_VERSION

# Ou verificar logs:
[buildSystemPrompt] START - version: optimized  # ← Deve mostrar "optimized"
```

---

### 2. Integração com buildSystemPrompt

**Verificar**: O `buildSystemPrompt()` está chamando o `PromptBuilder`?

**Código relevante** (`src/server-enhanced.js`, linha 1140-1180):
```javascript
export function buildSystemPrompt(options = {}) {
  const promptsVersion = process.env.PROMPTS_VERSION || 'contextual';

  // Se versao for 'optimized' ou 'v3', usar novo sistema modular
  if (promptsVersion === 'optimized' || promptsVersion === 'v3') {
    try {
      const builder = new PromptBuilder({
        version: promptsVersion,
        trafficPercentage: trafficPercentage
      });

      const result = builder.build({
        includeTools: shouldIncludeTools(userMessage),
        includeABNT: shouldIncludeABNT(userMessage),
        documentType: null,
        userId,
        partnerId,     // ✅ Passa partnerId para CI
        context: { type: 'peca' }  // ✅ Contexto para shouldApply
      });

      return result.prompt;
    } catch (error) {
      console.error('[buildSystemPrompt] Erro ao usar PromptBuilder, fallback para legacy');
    }
  }

  // Fallback para versao legacy
  return buildLegacySystemPrompt();
}
```

**Ação Necessária**: Verificar logs em produção para confirmar:
```
[buildSystemPrompt] START - version: optimized
[buildSystemPrompt] OPTIMIZED v3.0 | XXXXX chars | ~XXXX tokens | modules: custom-instructions, core, tools, abnt
```

---

### 3. Upload do Arquivo custom-instructions.json

**Status**: ✅ Commitado (88f9f73)

**Verificar**: Arquivo está presente em produção?

**Caminho**: `data/custom-instructions/rom/custom-instructions.json`

**Como verificar em produção**:
```bash
ls -la data/custom-instructions/rom/custom-instructions.json
# Deve existir e ter ~70 linhas
```

---

### 4. System Prompts Integration

**Pergunta do usuário**: "ele já o faz sem erros? usando o system prompts?"

**Resposta Atual**:
- ✅ Custom Instructions implementado e funcionando localmente
- ⚠️ System Prompts (`/api/system-prompts`) é um sistema DIFERENTE
- ⚠️ Custom Instructions é para TODOS os parceiros (global settings)
- ✅ System Prompts é para prompts específicos por parceiro (já corrigido nos commits anteriores)

**Esclarecimento Necessário**:
- **Custom Instructions** = Instruções globais aplicadas ANTES de qualquer prompt
- **System Prompts** = Prompts específicos por tipo de peça/documento
- **Sequência**: CI → System Prompt → User Message

---

## 🔍 COMO VERIFICAR SE ESTÁ FUNCIONANDO

### Teste 1: Verificar PROMPTS_VERSION
```bash
# Em produção, verificar variável:
curl -s https://[URL-PRODUCAO]/api/health | jq '.config.promptsVersion'
# Deve retornar: "optimized"
```

### Teste 2: Verificar Logs de Build
```bash
# Nos logs do servidor, procurar:
[buildSystemPrompt] START - version: optimized
[PromptBuilder] Custom Instructions carregadas: rom
[PromptBuilder] Componentes: 3 (4081 tokens)
[buildSystemPrompt] OPTIMIZED v3.0 | 18000 chars | ~4500 tokens | modules: custom-instructions, core, tools
```

### Teste 3: Gerar uma Peça
```bash
# Fazer request para /api/chat/stream:
POST /api/chat/stream
{
  "message": "Elabore uma petição inicial de ação de cobrança",
  "modelo": "claude-sonnet-4.5"
}

# Verificar se a peça gerada:
✓ Usa Calibri 12pt (método de formatação)
✓ Não tem emojis (custom instructions)
✓ Tem citações com formato correto (método de formatação)
✓ Pesquisa jurisprudência antes de citar (custom instructions)
✓ Tem 15-20 páginas (extensão mínima das custom instructions)
```

### Teste 4: API de Custom Instructions
```bash
# Verificar endpoint:
curl -s https://[URL-PRODUCAO]/api/custom-instructions/rom | jq '.data.version'
# Deve retornar: "1.0"

curl -s https://[URL-PRODUCAO]/api/custom-instructions/rom/preview | jq '.compiledText' | head -20
# Deve mostrar as Custom Instructions compiladas
```

---

## 📋 CHECKLIST DE VALIDAÇÃO

### Backend
- [x] CustomInstructionsManager implementado
- [x] PromptBuilder integrado com CI
- [x] Arquivo custom-instructions.json criado
- [x] API endpoints implementados
- [x] Middleware de permissões
- [ ] PROMPTS_VERSION=optimized configurado em produção
- [ ] Verificar logs de buildSystemPrompt em produção

### Frontend
- [x] CustomInstructionsPage implementado
- [x] SuggestionsPage implementado
- [x] Rotas adicionadas
- [ ] Testar interface de edição em produção
- [ ] Validar preview compilado
- [ ] Verificar histórico de versões

### Integração
- [ ] Gerar peça e verificar aplicação do CI
- [ ] Verificar ordem: CI → Formatação → Versionamento → Prompt → User
- [ ] Validar formatação ABNT/OAB
- [ ] Confirmar extensão mínima (15-20 páginas)
- [ ] Validar pesquisa de jurisprudência

---

## 🚀 PRÓXIMOS PASSOS

1. **Configurar PROMPTS_VERSION=optimized** em variáveis de ambiente de produção
2. **Fazer deploy** do commit 88f9f73
3. **Verificar logs** para confirmar uso do PromptBuilder com CI
4. **Testar geração de peça** em produção
5. **Validar sequência** CI → Formatação → Versionamento → Prompt
6. **Documentar resultado** para o usuário

---

## 📝 COMANDOS ÚTEIS

### Verificar Custom Instructions localmente
```bash
node -e "import('./lib/custom-instructions-manager.js').then(m => {
  const data = m.customInstructionsManager.load('rom');
  console.log('Versão:', data.version);
  console.log('Componentes:', Object.keys(data.components).length);
})"
```

### Ver texto compilado
```bash
node -e "import('./lib/custom-instructions-manager.js').then(m => {
  const text = m.customInstructionsManager.getCompiledText('rom');
  console.log(text.substring(0, 500));
})"
```

### Testar PromptBuilder
```bash
node -e "import('./src/lib/prompt-builder.js').then(m => {
  const builder = new m.PromptBuilder();
  const result = builder.build({
    includeTools: false,
    includeABNT: true,
    partnerId: 'rom',
    context: { type: 'peca' }
  });
  console.log('Modules:', result.modules);
  console.log('Tokens:', result.tokens);
  console.log('Size:', result.prompt.length);
})"
```

---

**Última Atualização**: 2026-02-03 02:15 BRT
**Status Geral**: ✅ Implementado | ⚠️ Aguardando configuração em produção
