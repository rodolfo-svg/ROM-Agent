# AWS Bedrock - Problemas Identificados e Resolvidos

**Data**: 2025-12-19
**Status**: Parcialmente resolvido - novo problema descoberto

---

## Problema 1: Região AWS Incorreta ✅ RESOLVIDO

### Descrição
A região AWS estava hardcoded como `us-east-1` (Virginia) mas deveria ser `us-west-2` (Oregon).

### Solução
**Commit**: `2b576916` - "fix(bedrock): corrigir região AWS de us-east-1 para us-west-2 (Oregon)"

Atualizados 8 arquivos:
- src/modules/bedrock.js (linha 44)
- src/modules/bedrockAvancado.js (linha 25)
- src/server-enhanced.js (linhas 2525 e 2561)
- src/utils/bedrock-helper.js (linha 9)
- src/services/processors/rom-case-processor-service.js (linha 66)
- lib/extractor-pipeline.js (linhas 55 e 1296)
- lib/server-integrations.js (linhas 56 e 91)
- scripts/diagnose-aws-bedrock.sh (linhas 32-36)

### Validação
```bash
curl -sS "https://iarom.com.br/api/info" | jq '.bedrock.region'
# Retorna: "us-west-2" ✅
```

---

## Problema 2: Bug Crítico - Destruição de Command Instance ✅ RESOLVIDO

### Descrição
O arquivo `src/utils/resilient-invoke.js` estava usando **spread operator** para clonar instâncias de `ConverseCommand`, o que destruía a classe e criava um objeto plano.

### Código com Bug (ANTES)
```javascript
// src/utils/resilient-invoke.js linhas 68-74
const commandWithModel = {
  ...command,  // ❌ DESTRÓI a instância da classe Command!
  input: {
    ...command.input,
    modelId: currentModelId
  }
};
```

### Por que isso quebrava?
O AWS SDK v3 valida se o objeto é uma instância válida de Command:

```javascript
// Validação interna do AWS SDK
if (!command || typeof command.resolveMiddleware !== "function") {
  throw new Error(
    `INVALID_COMMAND_TO_SEND: ${command?.constructor?.name || typeof command}`
  );
}
```

Quando usamos spread operator (`{...command}`), o resultado é um **objeto plano** sem os métodos da classe `ConverseCommand`, incluindo `resolveMiddleware()`.

### Solução Implementada
**Commit**: `cbcc7a27` - "fix(bedrock): corrigir clonagem de Command instances no resilient-invoke"

**Novo código** (src/utils/resilient-invoke.js):

```javascript
/**
 * Clona o Command preservando a classe do AWS SDK v3
 * @param {Object} command - Instância de Command (ConverseCommand, InvokeModelCommand, etc)
 * @param {Object} overrides - Propriedades para sobrescrever no input
 * @returns {Object} Nova instância do mesmo tipo de Command
 */
function cloneCommandWithOverrides(command, overrides = {}) {
  const Ctor = command?.constructor;

  // Se não é um Command válido, melhor falhar cedo (fica MUITO mais diagnosticável)
  if (!command || typeof command.resolveMiddleware !== "function" || typeof Ctor !== "function") {
    throw new Error(
      `INVALID_COMMAND_TO_SEND: ${command?.constructor?.name || typeof command}`
    );
  }

  const input = command.input || {};
  return new Ctor({ ...input, ...overrides });  // ✅ Preserva a classe!
}

// Uso correto (linha 88):
const commandWithModel = cloneCommandWithOverrides(command, {
  modelId: currentModelId
});
```

### Por que isso funciona?
1. **Obtém o construtor**: `command.constructor` retorna a classe original (ex: `ConverseCommand`)
2. **Cria nova instância**: `new Ctor(...)` instancia um novo objeto da mesma classe
3. **Preserva métodos**: A nova instância tem todos os métodos necessários (`resolveMiddleware`, etc)
4. **Valida antes**: Falha rapidamente se o Command não é válido

### Validação
```javascript
// Teste de tipo
const cmd = new ConverseCommand({ modelId: "test", messages: [] });
const cloned = cloneCommandWithOverrides(cmd, { modelId: "new-model" });

console.log(cmd.constructor.name);           // "ConverseCommand"
console.log(cloned.constructor.name);        // "ConverseCommand" ✅
console.log(typeof cloned.resolveMiddleware); // "function" ✅

// Com spread operator (ERRADO):
const broken = { ...cmd, input: { ...cmd.input, modelId: "new" } };
console.log(broken.constructor.name);         // "Object" ❌
console.log(typeof broken.resolveMiddleware); // "undefined" ❌
```

---

## Problema 3: AWS Bedrock API - Inference Profile Required ❌ NÃO RESOLVIDO

### Descrição
Após resolver os problemas 1 e 2, descobrimos um **novo erro** vindo diretamente da AWS Bedrock:

```
ValidationException: Invocation of model ID anthropic.claude-sonnet-4-5-20250929-v1:0
with on-demand throughput isn't supported.
Retry your request with the ID or ARN of an inference profile that contains this model.
```

### Causa
A AWS Bedrock mudou recentemente sua API e agora **requer** o uso de **Inference Profile ARN** ao invés do model ID direto.

### Status Atual
- ❌ Produção: HTTP 500 (ValidationException)
- ❌ Staging: HTTP 500 (ValidationException + credenciais faltando)
- ✅ Região: us-west-2 (correto)
- ✅ Command cloning: Implementado corretamente

### Próximos Passos
1. Identificar o Inference Profile ARN correto para Claude Sonnet 4.5
2. Atualizar configuração de modelo no código
3. Deploy da correção

---

## Timeline de Correções

- **22:45 BRT**: Identificado problema de região (us-east-1 vs us-west-2)
- **22:50 BRT**: Correção de código em 8 arquivos
- **22:52 BRT**: Commit 2b576916 (região)
- **22:55 BRT**: Push para GitHub
- **23:30 BRT**: Identificado bug de Command cloning via testes
- **23:45 BRT**: Implementado `cloneCommandWithOverrides()`
- **23:50 BRT**: Commit cbcc7a27 (Command cloning fix)
- **00:15 BRT**: Push final para GitHub
- **00:30 BRT**: Deploy automático executado
- **00:45 BRT**: Descoberto novo problema: Inference Profile requerido

---

## Lições Aprendidas

1. **Nunca use spread operator em instâncias de classe do AWS SDK v3**
   - Sempre clone usando o construtor: `new command.constructor({...})`

2. **Validação early fail é essencial**
   - Melhor falhar cedo com erro claro do que silenciosamente quebrar

3. **Testes locais são cruciais**
   - O script `test-bedrock-direct.js` revelou o problema real

4. **AWS APIs mudam**
   - Mudança de model ID direto para Inference Profile ARN
   - Sempre verificar documentação atualizada

---

## Commits Relacionados

```bash
# Ver histórico de correções
git log --oneline -5

cf9a4904 🤖 Deploy automático - 2025-12-19_02:00:00
cbcc7a27 fix(bedrock): corrigir clonagem de Command instances no resilient-invoke
ecbe1369 chore: forçar redeploy com correção AWS_REGION=us-west-2 (Oregon)
2b576916 fix(bedrock): corrigir região AWS de us-east-1 para us-west-2 (Oregon)
c00a0ad6 chore(release): promote staging to main (rc-2.4.19-20251218)
```

---

## Validação Pós-Deploy

### Produção (iarom.com.br)
```bash
curl -sS "https://iarom.com.br/api/info" | jq '{
  region: .bedrock.region,
  uptime: .health.uptimeSeconds,
  creds: .bedrock.credentials
}'
```

**Resultado**:
```json
{
  "region": "us-west-2",         // ✅ Corrigido
  "uptime": 460,                 // ✅ Deploy recente
  "creds": {
    "hasAccessKeyId": true,      // ✅ Presente
    "hasSecretAccessKey": true,  // ✅ Presente
    "hasRegion": true            // ✅ Presente
  }
}
```

### Teste de Chat Endpoint
```bash
curl -sS "https://iarom.com.br/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"ping"}'
```

**Resultado**:
```json
{
  "error": "All models in fallback chain failed (1 attempts)",
  "status": 500
}
```

**Causa**: ValidationException do AWS Bedrock (Inference Profile requerido)

---

## Referências

- AWS SDK v3 Documentation: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/
- AWS Bedrock Inference Profiles: https://docs.aws.amazon.com/bedrock/latest/userguide/
- Commit com correção de clonagem: `cbcc7a27`
