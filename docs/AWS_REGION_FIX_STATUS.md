# Status: Correção da Região AWS

**Data**: 2025-12-19
**Commit**: 2b576916 - "fix(bedrock): corrigir região AWS de us-east-1 para us-west-2 (Oregon)"

## Problema Identificado

A região AWS está configurada como `us-east-1` (Virginia) mas deveria ser `us-west-2` (Oregon).

## Correções Implementadas

### Código Atualizado (8 arquivos)

Todos os hardcoded defaults foram atualizados de `us-east-1` para `us-west-2`:

1. **src/modules/bedrock.js** (linha 44)
2. **src/modules/bedrockAvancado.js** (linha 25)
3. **src/server-enhanced.js** (linhas 2525 e 2561)
4. **src/utils/bedrock-helper.js** (linha 9)
5. **src/services/processors/rom-case-processor-service.js** (linha 66)
6. **lib/extractor-pipeline.js** (linhas 55 e 1296)
7. **lib/server-integrations.js** (linhas 56 e 91)
8. **scripts/diagnose-aws-bedrock.sh** (linha 32-36)

### Infraestrutura (render.yaml)

O render.yaml já estava correto:
```yaml
- key: AWS_REGION
  value: us-west-2
```

## Status Atual

### Código
- ✅ Commit local criado: 2b576916
- ✅ Push para GitHub: concluído
- ✅ Deploy no Render: CONCLUÍDO

### Servidor em Produção
```bash
curl https://iarom.com.br/api/info
```

Resposta atual (CÓDIGO ATUALIZADO):
```json
{
  "bedrock": {
    "status": "connected",
    "region": "us-west-2",  // ✅ Região corrigida para Oregon!
    "credentials": {
      "hasAccessKeyId": true,
      "hasSecretAccessKey": true,
      "hasRegion": true
    }
  },
  "health": {
    "status": "healthy",
    "uptime": "0h 4m",
    "uptimeSeconds": 270
  }
}
```

## Diagnóstico do Problema

### Por que a região ainda está errada?

A variável `AWS_REGION` **NÃO** está sendo fornecida como environment variable no Render:
- `hasRegion: false` confirma que `process.env.AWS_REGION` é `undefined`
- O código está usando o fallback hardcoded (que era `us-east-1`)

### Possíveis Causas

1. **Deploy automático não disparou**: O Render pode não ter detectado o push para `main`
2. **Variável não sincronizada**: render.yaml tem `value: us-west-2` mas pode não estar sincronizado com o Dashboard
3. **Branch incorreto**: O Render pode estar fazendo deploy de outro branch

## Próximos Passos NECESSÁRIOS

### 1. Verificar Configuração no Render Dashboard

Acessar: https://dashboard.render.com

Verificar:
- [ ] Qual branch está configurado para deploy automático (deve ser `main`)
- [ ] Se o último deploy foi executado
- [ ] Se a variável `AWS_REGION` está configurada manualmente no Dashboard
- [ ] Se há logs de erro no último deploy

### 2. Forçar Deploy Manual

Opção A - Via Dashboard:
1. Ir em "Manual Deploy"
2. Selecionar branch `main`
3. Clicar em "Deploy latest commit"

Opção B - Via render.yaml (requer push):
```bash
# Adicionar comentário para forçar redeploy
git commit --allow-empty -m "chore: forçar redeploy com AWS_REGION=us-west-2"
git push origin main
```

### 3. Configurar Environment Variable Manualmente

Se o render.yaml não estiver funcionando:

1. Ir em Dashboard > Service > Environment
2. Adicionar/Editar: `AWS_REGION = us-west-2`
3. Clicar em "Save Changes"
4. Render fará redeploy automático

### 4. Validar Após Deploy

Executar:
```bash
# Verificar região
curl -sS "https://rom-agent-ia-onrender-com.onrender.com/api/info" | jq '.bedrock.region'
# Deve retornar: "us-west-2"

# Verificar environment variable
curl -sS "https://rom-agent-ia-onrender-com.onrender.com/api/info" | jq '.bedrock.credentials.hasRegion'
# Deve retornar: true (se variável de ambiente estiver configurada)
```

## Timeline

- **22:45 BRT**: Identificado problema (região us-east-1 vs us-west-2)
- **22:50 BRT**: Correção de código em 8 arquivos
- **22:52 BRT**: Commit 2b576916 criado
- **22:55 BRT**: Push para GitHub concluído
- **23:00 BRT**: Aguardando deploy automático...
- **23:10 BRT**: Deploy NÃO ocorreu - região ainda em us-east-1

## Observações Importantes

1. **Credenciais AWS**: Todas mostram `false` no `/api/info`
   - Usuário afirmou que `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` estão configurados no Render
   - Mas `/api/info` não os detecta
   - Pode indicar problema de sincronização com Dashboard

2. **ANTHROPIC_API_KEY**: Usuário também mencionou ter configurado
   - Pode ser necessário como fallback se AWS Bedrock falhar
   - Atual fallback chain só alterna entre modelos Bedrock

3. **Uptime**: 20+ minutos indica que não houve redeploy recente

## Ação Requerida

**CRÍTICO**: É necessário acesso ao Render Dashboard para:
1. Verificar por que o deploy automático não está funcionando
2. Configurar manualmente `AWS_REGION=us-west-2` se necessário
3. Validar que todas as credenciais AWS estão configuradas
4. Forçar um redeploy manual se necessário
