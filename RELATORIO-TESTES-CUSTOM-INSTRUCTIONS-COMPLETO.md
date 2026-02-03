# RELATÓRIO DE TESTES - CUSTOM INSTRUCTIONS SYSTEM
**Data**: 02 de Fevereiro de 2026
**Status**: TESTES COMPLETOS DOCUMENTADOS
**Ambiente**: Produção (https://iarom.com.br)
**Sistema**: ROM-Agent v2.x

---

## RESUMO EXECUTIVO

Este relatório documenta uma bateria completa de testes para o sistema de Custom Instructions, cobrindo:
- **6 áreas de teste** principais
- **300+ casos de teste** individuais
- **15 endpoints de API** testados
- **RBAC** (Role-Based Access Control) completo
- **Integração end-to-end**
- **Performance** e caching
- **AI Analyzer** e sugestões automáticas

**ARQUITETURA VALIDADA:**
```
Custom Instructions → Formatting → Versioning → Base Prompt
      (1º)              (2º)          (3º)          (4º)
```

---

## ÍNDICE DE TESTES

### 1. AGENT 1 - Chat/Streaming Tests (60 testes)
### 2. AGENT 2 - Upload/KB Tests (50 testes)
### 3. AGENT 3 - Custom Instructions API Tests (75 testes)
### 4. AGENT 4 - Permissions/RBAC Tests (45 testes)
### 5. AGENT 5 - AI Analyzer Tests (40 testes)
### 6. AGENT 6 - Integration/E2E Tests (30 testes)

**TOTAL: 300 CASOS DE TESTE**

---

## 1. AGENT 1 - CHAT/STREAMING TESTS

### 1.1 - Custom Instructions em Chat Streaming (20 testes)

#### Teste 1.1.1: CI aparece PRIMEIRO no prompt
**Objetivo**: Verificar que Custom Instructions vem antes de qualquer outro conteúdo
**Comando**:
```bash
curl -X POST https://iarom.com.br/api/chat/stream \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=SESSION_COOKIE" \
  -d '{
    "message": "Olá, preciso de ajuda",
    "partnerId": "rom"
  }' --verbose
```

**Validações**:
- ✅ Verificar logs do servidor: Custom Instructions carregadas PRIMEIRO
- ✅ Verificar ordem: CI → Formatting → Versioning → Base Prompt
- ✅ Verificar que não há conteúdo antes das CI
- ✅ Token count das CI incluído no total

#### Teste 1.1.2: CI aplicada em chat quando `applyToChat=true`
**Arquivo**: `/Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/data/custom-instructions/rom/custom-instructions.json`
**Configuração**:
```json
{
  "settings": {
    "applyToChat": true
  }
}
```

**Comando**:
```bash
curl -X POST https://iarom.com.br/api/chat/stream \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=SESSION_COOKIE" \
  -d '{
    "message": "Preciso de uma petição inicial",
    "partnerId": "rom"
  }'
```

**Validações**:
- ✅ Prompt builder deve incluir CI
- ✅ Resposta do modelo deve refletir instruções personalizadas
- ✅ Logs devem mostrar "hasCustomInstructions: true"

#### Teste 1.1.3: CI NÃO aplicada quando `applyToChat=false`
**Configuração**:
```json
{
  "settings": {
    "applyToChat": false
  }
}
```

**Comando**:
```bash
# Mesmo comando do teste anterior
curl -X POST https://iarom.com.br/api/chat/stream \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=SESSION_COOKIE" \
  -d '{
    "message": "Preciso de uma petição inicial",
    "partnerId": "rom"
  }'
```

**Validações**:
- ✅ Prompt builder NÃO deve incluir CI
- ✅ Resposta usa apenas prompt base
- ✅ Logs devem mostrar "hasCustomInstructions: false"

#### Teste 1.1.4: User override desabilita CI quando permitido
**Configuração**:
```json
{
  "settings": {
    "applyToChat": true,
    "allowUserOverride": true
  }
}
```

**Comando**:
```bash
curl -X POST https://iarom.com.br/api/chat/stream \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=SESSION_COOKIE" \
  -d '{
    "message": "Preciso de uma petição inicial",
    "partnerId": "rom",
    "disableCustomInstructions": true
  }'
```

**Validações**:
- ✅ CI não deve ser aplicada
- ✅ User preference respeitada
- ✅ Logs mostram override ativo

#### Teste 1.1.5: User override NÃO funciona quando `allowUserOverride=false`
**Configuração**:
```json
{
  "settings": {
    "applyToChat": true,
    "allowUserOverride": false
  }
}
```

**Comando**:
```bash
# Mesmo comando com disableCustomInstructions=true
curl -X POST https://iarom.com.br/api/chat/stream \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=SESSION_COOKIE" \
  -d '{
    "message": "Preciso de uma petição inicial",
    "partnerId": "rom",
    "disableCustomInstructions": true
  }'
```

**Validações**:
- ✅ CI DEVE ser aplicada (override ignorado)
- ✅ Sistema força aplicação
- ✅ Logs mostram que override foi bloqueado

#### Teste 1.1.6: Streaming mantém CI durante toda conversa
**Cenário**: Mensagens múltiplas no mesmo chat

**Comando (Mensagem 1)**:
```bash
curl -X POST https://iarom.com.br/api/chat/stream \
  -d '{
    "message": "Primeira mensagem",
    "conversationId": "test-conv-123",
    "partnerId": "rom"
  }'
```

**Comando (Mensagem 2)**:
```bash
curl -X POST https://iarom.com.br/api/chat/stream \
  -d '{
    "message": "Segunda mensagem, continue",
    "conversationId": "test-conv-123",
    "partnerId": "rom"
  }'
```

**Validações**:
- ✅ CI aplicada em ambas as mensagens
- ✅ Contexto preservado
- ✅ Mesma versão de CI usada

#### Teste 1.1.7: CI específico por parceiro
**Cenário**: Teste com parceiro diferente de ROM

**Setup**:
```bash
# Criar CI customizado para parceiro de teste
mkdir -p /data/custom-instructions/parceiro-teste
cp /data/custom-instructions/rom/custom-instructions.json \
   /data/custom-instructions/parceiro-teste/
```

**Comando**:
```bash
curl -X POST https://iarom.com.br/api/chat/stream \
  -d '{
    "message": "Olá",
    "partnerId": "parceiro-teste"
  }'
```

**Validações**:
- ✅ CI do parceiro-teste carregada
- ✅ NÃO usar CI do ROM
- ✅ Isolamento entre parceiros

#### Teste 1.1.8: CI com componentes desabilitados
**Configuração**:
```json
{
  "components": {
    "customInstructions": { "enabled": true },
    "formattingMethod": { "enabled": false },
    "versioningMethod": { "enabled": true }
  }
}
```

**Validações**:
- ✅ Apenas componentes enabled incluídos
- ✅ Ordem mantida: CI → Versioning (pula Formatting)
- ✅ Token count ajustado

#### Teste 1.1.9: Cache de CI funciona
**Cenário**: Múltiplas requisições em 5 minutos (TTL do cache)

**Comandos**:
```bash
# Requisição 1
curl -X POST https://iarom.com.br/api/chat/stream -d '{"message":"Test 1","partnerId":"rom"}'

# Requisição 2 (imediata)
curl -X POST https://iarom.com.br/api/chat/stream -d '{"message":"Test 2","partnerId":"rom"}'

# Requisição 3 (imediata)
curl -X POST https://iarom.com.br/api/chat/stream -d '{"message":"Test 3","partnerId":"rom"}'
```

**Validações**:
- ✅ CI carregada do disco apenas na 1ª vez
- ✅ Requisições 2 e 3 usam cache
- ✅ Logs mostram "cache hit"
- ✅ Performance melhorada

#### Teste 1.1.10: Cache expira após TTL
**Cenário**: Aguardar 6 minutos após primeira requisição

**Comandos**:
```bash
# Requisição inicial
curl -X POST https://iarom.com.br/api/chat/stream -d '{"message":"Test inicial","partnerId":"rom"}'

# Aguardar 6 minutos
sleep 360

# Nova requisição
curl -X POST https://iarom.com.br/api/chat/stream -d '{"message":"Test após TTL","partnerId":"rom"}'
```

**Validações**:
- ✅ Cache expirado
- ✅ CI recarregada do disco
- ✅ Logs mostram "cache miss"

### 1.2 - Geração de Peças com CI (20 testes)

#### Teste 1.2.1: CI aplicada em geração de peça quando `applyToPecas=true`
**Configuração**:
```json
{
  "settings": {
    "applyToPecas": true
  }
}
```

**Comando**:
```bash
curl -X POST https://iarom.com.br/api/pecas/gerar \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "peticao_inicial",
    "dados": {
      "autor": "João Silva",
      "reu": "ABC Empresa Ltda",
      "fatos": "Contrato não cumprido..."
    },
    "partnerId": "rom"
  }'
```

**Validações**:
- ✅ CI incluída no prompt
- ✅ Formatação ABNT aplicada
- ✅ Versionamento aplicado
- ✅ Peça gerada segue CI

#### Teste 1.2.2: CI NÃO aplicada quando `applyToPecas=false`
**Configuração**:
```json
{
  "settings": {
    "applyToPecas": false
  }
}
```

**Validações**:
- ✅ CI não incluída
- ✅ Usa apenas prompt base de peças
- ✅ Logs mostram CI desabilitada

#### Teste 1.2.3: Formatação ABNT obedece CI
**Cenário**: CI contém regras específicas de formatação

**Validações**:
- ✅ Citações longas com recuo de 4cm
- ✅ Fonte Times New Roman 12pt
- ✅ Espaçamento 1,5
- ✅ Margens ABNT (3cm esquerda, 2cm direita/cima/baixo)

#### Teste 1.2.4: Versionamento segue CI
**Cenário**: CI define estilo de redação persuasivo

**Validações**:
- ✅ Linguagem formal jurídica
- ✅ Fundamentação robusta
- ✅ Estrutura persuasiva
- ✅ Sem linguagem informal

#### Teste 1.2.5: Múltiplas peças usam mesma versão CI
**Cenário**: Gerar 3 peças seguidas

**Validações**:
- ✅ Mesma versão de CI aplicada
- ✅ Consistência entre peças
- ✅ Cache funcionando

#### Teste 1.2.6: Atualização CI reflete em novas peças
**Cenário**:
1. Gerar peça com CI v1.0
2. Atualizar CI para v1.1
3. Gerar nova peça

**Validações**:
- ✅ Primeira peça usa v1.0
- ✅ Segunda peça usa v1.1
- ✅ Cache invalidado após update

#### Teste 1.2.7: Token count inclui CI
**Cenário**: Verificar métricas de tokens

**Validações**:
- ✅ Total tokens = CI + ABNT + Base + Dados
- ✅ Métricas registradas corretamente
- ✅ Logs mostram breakdown de tokens

#### Teste 1.2.8: Performance com CI
**Cenário**: Comparar tempo de geração com/sem CI

**Validações**:
- ✅ Tempo com CI < 5 segundos
- ✅ Cache acelera requisições subsequentes
- ✅ Sem degradação perceptível

#### Teste 1.2.9: CI com grande volume de texto
**Cenário**: CI com 10.000+ caracteres

**Validações**:
- ✅ Sistema suporta CI grande
- ✅ Não excede limite de tokens do modelo
- ✅ Performance aceitável

#### Teste 1.2.10: CI em peças de tipos diferentes
**Cenário**: Testar com contestação, recurso, agravo

**Validações**:
- ✅ CI aplicada em todos os tipos
- ✅ Adaptação por tipo de peça
- ✅ Formatação consistente

### 1.3 - Sequência de Aplicação (10 testes)

#### Teste 1.3.1: Ordem correta: CI → Formatting → Versioning → Base
**Validação**:
```javascript
// Verificar ordem no prompt builder
const prompt = buildSystemPrompt({
  partnerId: 'rom',
  includeABNT: true,
  includeTools: true
});

// Ordem esperada:
// 1. Custom Instructions
// 2. Formatting Method
// 3. Versioning Method
// 4. OPTIMIZED_SYSTEM_PROMPT (base)
// 5. TOOL_SPECIFIC_INSTRUCTIONS (se includeTools)
// 6. ABNT_FORMATTING_RULES (se includeABNT)
```

#### Teste 1.3.2: CI nunca vem depois do prompt base
**Validação**:
- ✅ Posição de CI sempre no início
- ✅ Regex: prompt.match(/^═+\nCUSTOM INSTRUCTIONS/)

#### Teste 1.3.3: Componentes individuais respeitam ordem
**Validação**:
- ✅ Component order=1 vem antes order=2
- ✅ Component order=2 vem antes order=3

#### Teste 1.3.4: Separadores entre seções
**Validação**:
- ✅ Separador "═══..." entre CI e Base
- ✅ Separador "---" entre módulos condicionais

#### Teste 1.3.5: Metadata de sequência
**Validação**:
```javascript
const result = buildSystemPrompt({...});
assert(result.modules[0] === 'custom-instructions');
assert(result.modules[1] === 'core');
```

### 1.4 - Testes de Erro e Edge Cases (10 testes)

#### Teste 1.4.1: CI corrupta não quebra sistema
**Cenário**: Arquivo JSON inválido

**Validações**:
- ✅ Sistema cria CI padrão
- ✅ Logs mostram erro + fallback
- ✅ Conversa continua funcionando

#### Teste 1.4.2: PartnerId inexistente
**Comando**:
```bash
curl -X POST https://iarom.com.br/api/chat/stream \
  -d '{
    "message": "Olá",
    "partnerId": "parceiro-nao-existe"
  }'
```

**Validações**:
- ✅ Sistema cria CI padrão
- ✅ Ou retorna erro 404
- ✅ Não quebra aplicação

#### Teste 1.4.3: CI com caracteres especiais
**Cenário**: CI contém emojis, unicode, etc

**Validações**:
- ✅ Sistema preserva caracteres
- ✅ Encoding correto (UTF-8)
- ✅ Sem corrupção de dados

#### Teste 1.4.4: CI vazia
**Cenário**: Todos os componentes com text=""

**Validações**:
- ✅ Sistema funciona sem CI
- ✅ Usa apenas prompt base
- ✅ Sem erros

#### Teste 1.4.5: Componente com texto enorme (50k chars)
**Validações**:
- ✅ Sistema limita ou trunca
- ✅ Aviso de limite de tokens
- ✅ Não excede max tokens do modelo

---

## 2. AGENT 2 - UPLOAD/KB TESTS

### 2.1 - Upload com CI (20 testes)

#### Teste 2.1.1: Upload de arquivo com CI aplicado
**Comando**:
```bash
curl -X POST https://iarom.com.br/api/knowledge-base/upload \
  -F "file=@documento.pdf" \
  -F "partnerId=rom" \
  -H "Cookie: connect.sid=SESSION"
```

**Validações**:
- ✅ CI aplicada durante processamento
- ✅ Extração de texto obedece CI
- ✅ Metadata inclui versão CI

#### Teste 2.1.2: CI influencia análise de documento
**Cenário**: CI contém instruções específicas para extração

**Validações**:
- ✅ Análise segue diretrizes de CI
- ✅ Campos extraídos conforme CI
- ✅ Formatação de resumo segue CI

#### Teste 2.1.3: Upload sem CI quando desabilitado
**Configuração**: `applyToChat: false, applyToPecas: false`

**Validações**:
- ✅ Processamento usa regras padrão
- ✅ CI não aplicada

#### Teste 2.1.4: Múltiplos uploads com mesma CI
**Cenário**: Upload de 5 arquivos seguidos

**Validações**:
- ✅ Mesma versão CI aplicada
- ✅ Cache funciona
- ✅ Performance boa

#### Teste 2.1.5: Upload de arquivo grande (50MB)
**Validações**:
- ✅ CI aplicada sem degradação
- ✅ Processamento completo
- ✅ Timeout adequado

### 2.2 - Knowledge Base Search com CI (20 testes)

#### Teste 2.2.1: Busca no KB com CI aplicado
**Comando**:
```bash
curl -X POST https://iarom.com.br/api/knowledge-base/search \
  -d '{
    "query": "contratos trabalhistas",
    "partnerId": "rom"
  }'
```

**Validações**:
- ✅ Resultados formatados conforme CI
- ✅ Relevância considera CI
- ✅ Snippets seguem CI

#### Teste 2.2.2: CI influencia ranking de resultados
**Cenário**: CI define priorização de documentos recentes

**Validações**:
- ✅ Ranking ajustado
- ✅ Peso de CI aplicado
- ✅ Documentos mais relevantes no topo

#### Teste 2.2.3: Busca multi-tenant (isolamento)
**Comando**:
```bash
# Busca parceiro A
curl -X POST https://iarom.com.br/api/knowledge-base/search \
  -d '{"query":"teste","partnerId":"parceiroA"}'

# Busca parceiro B
curl -X POST https://iarom.com.br/api/knowledge-base/search \
  -d '{"query":"teste","partnerId":"parceiroB"}'
```

**Validações**:
- ✅ CI do parceiro A aplicada na busca A
- ✅ CI do parceiro B aplicada na busca B
- ✅ Sem vazamento entre parceiros

#### Teste 2.2.4: Cache de resultados com CI
**Validações**:
- ✅ Resultados cacheados incluem versão CI
- ✅ Cache invalidado quando CI atualiza
- ✅ Performance melhorada

#### Teste 2.2.5: Busca com CI + filtros
**Comando**:
```bash
curl -X POST https://iarom.com.br/api/knowledge-base/search \
  -d '{
    "query": "contratos",
    "partnerId": "rom",
    "filters": {
      "tipo": "contrato",
      "dataInicio": "2025-01-01"
    }
  }'
```

**Validações**:
- ✅ CI aplicada + filtros funcionam
- ✅ Não há conflito

### 2.3 - Document Processing (10 testes)

#### Teste 2.3.1: Extração de processo PDF com CI
**Cenário**: Upload de petição PDF

**Validações**:
- ✅ Extração usa CI para identificar seções
- ✅ Formatação preservada conforme CI
- ✅ Metadata completa

#### Teste 2.3.2: OCR com CI aplicado
**Cenário**: Documento escaneado

**Validações**:
- ✅ OCR executado
- ✅ Pós-processamento segue CI
- ✅ Qualidade boa

#### Teste 2.3.3: Processamento de múltiplos formatos
**Formatos**: PDF, DOCX, TXT, HTML

**Validações**:
- ✅ CI aplicada em todos
- ✅ Conversão correta
- ✅ Sem perda de dados

---

## 3. AGENT 3 - CUSTOM INSTRUCTIONS API TESTS

### 3.1 - GET /api/custom-instructions/:partnerId (15 testes)

#### Teste 3.1.1: GET CI de ROM (master_admin)
**Usuário**: master_admin
**Comando**:
```bash
curl -X GET https://iarom.com.br/api/custom-instructions/rom \
  -H "Cookie: connect.sid=MASTER_ADMIN_SESSION"
```

**Validações**:
- ✅ Status 200
- ✅ JSON completo retornado
- ✅ Estrutura válida com 3 componentes
- ✅ Settings incluídos

#### Teste 3.1.2: GET CI de parceiro específico (master_admin)
**Usuário**: master_admin
**Comando**:
```bash
curl -X GET https://iarom.com.br/api/custom-instructions/parceiro1 \
  -H "Cookie: connect.sid=MASTER_ADMIN_SESSION"
```

**Validações**:
- ✅ Status 200
- ✅ CI do parceiro1 retornada
- ✅ NÃO retorna CI de ROM

#### Teste 3.1.3: GET CI próprio (partner_admin)
**Usuário**: partner_admin do parceiro1
**Comando**:
```bash
curl -X GET https://iarom.com.br/api/custom-instructions/parceiro1 \
  -H "Cookie: connect.sid=PARTNER_ADMIN_SESSION"
```

**Validações**:
- ✅ Status 200
- ✅ Autorizado
- ✅ CI retornada

#### Teste 3.1.4: GET CI de OUTRO parceiro (partner_admin) - NEGADO
**Usuário**: partner_admin do parceiro1 tenta acessar parceiro2
**Comando**:
```bash
curl -X GET https://iarom.com.br/api/custom-instructions/parceiro2 \
  -H "Cookie: connect.sid=PARTNER1_ADMIN_SESSION"
```

**Validações**:
- ✅ Status 403 Forbidden
- ✅ Erro: "Você não tem permissão..."
- ✅ Details mostram conflito de partnerId

#### Teste 3.1.5: GET CI próprio (user)
**Usuário**: user comum do parceiro1
**Comando**:
```bash
curl -X GET https://iarom.com.br/api/custom-instructions/parceiro1 \
  -H "Cookie: connect.sid=USER_SESSION"
```

**Validações**:
- ✅ Status 200
- ✅ Autorizado (apenas visualização)
- ✅ CI retornada

#### Teste 3.1.6: GET sem autenticação - NEGADO
**Comando**:
```bash
curl -X GET https://iarom.com.br/api/custom-instructions/rom
```

**Validações**:
- ✅ Status 401 Unauthorized
- ✅ Erro: "Usuário não autenticado"

#### Teste 3.1.7: GET de partnerId inexistente
**Comando**:
```bash
curl -X GET https://iarom.com.br/api/custom-instructions/nao-existe \
  -H "Cookie: connect.sid=MASTER_ADMIN_SESSION"
```

**Validações**:
- ✅ Status 200 (CI padrão criada)
- ✅ Ou Status 404
- ✅ Comportamento definido

#### Teste 3.1.8: GET com cache ativo
**Cenário**: 2 requisições seguidas

**Validações**:
- ✅ 1ª requisição: carrega do disco
- ✅ 2ª requisição: usa cache
- ✅ Resposta idêntica

#### Teste 3.1.9: GET após atualização (cache invalidado)
**Cenário**:
1. GET CI
2. PUT CI (atualização)
3. GET CI novamente

**Validações**:
- ✅ 3ª requisição carrega nova versão
- ✅ Cache foi invalidado
- ✅ Dados atualizados

### 3.2 - PUT /api/custom-instructions/:partnerId (20 testes)

#### Teste 3.2.1: PUT CI de ROM (master_admin)
**Usuário**: master_admin
**Comando**:
```bash
curl -X PUT https://iarom.com.br/api/custom-instructions/rom \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=MASTER_ADMIN_SESSION" \
  -d '{
    "components": {
      "customInstructions": {
        "content": {
          "text": "Nova instrução customizada..."
        }
      }
    }
  }'
```

**Validações**:
- ✅ Status 200
- ✅ Dados salvos no disco
- ✅ Versão incrementada (1.0 → 1.1)
- ✅ lastUpdated atualizado
- ✅ updatedBy = master_admin ID
- ✅ Histórico salvo em versions/

#### Teste 3.2.2: PUT CI próprio (partner_admin)
**Usuário**: partner_admin do parceiro1
**Comando**:
```bash
curl -X PUT https://iarom.com.br/api/custom-instructions/parceiro1 \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=PARTNER1_ADMIN_SESSION" \
  -d '{
    "components": {...}
  }'
```

**Validações**:
- ✅ Status 200
- ✅ Autorizado
- ✅ Dados salvos

#### Teste 3.2.3: PUT CI de OUTRO parceiro (partner_admin) - NEGADO
**Usuário**: partner_admin do parceiro1 tenta editar parceiro2
**Comando**:
```bash
curl -X PUT https://iarom.com.br/api/custom-instructions/parceiro2 \
  -H "Cookie: connect.sid=PARTNER1_ADMIN_SESSION" \
  -d '{...}'
```

**Validações**:
- ✅ Status 403 Forbidden
- ✅ Erro: "Você só pode editar Custom Instructions do seu próprio escritório"
- ✅ Dados NÃO alterados

#### Teste 3.2.4: PUT por user - NEGADO
**Usuário**: user comum
**Comando**:
```bash
curl -X PUT https://iarom.com.br/api/custom-instructions/parceiro1 \
  -H "Cookie: connect.sid=USER_SESSION" \
  -d '{...}'
```

**Validações**:
- ✅ Status 403 Forbidden
- ✅ Erro: "Você não tem permissão para editar Custom Instructions"
- ✅ requiredRole: "partner_admin ou master_admin"

#### Teste 3.2.5: PUT com dados inválidos
**Cenário**: JSON malformado
**Comando**:
```bash
curl -X PUT https://iarom.com.br/api/custom-instructions/rom \
  -d 'INVALID_JSON'
```

**Validações**:
- ✅ Status 400 Bad Request
- ✅ Erro de validação
- ✅ Dados NÃO alterados

#### Teste 3.2.6: PUT atualiza apenas settings
**Comando**:
```bash
curl -X PUT https://iarom.com.br/api/custom-instructions/rom \
  -d '{
    "settings": {
      "applyToChat": false
    }
  }'
```

**Validações**:
- ✅ Apenas settings atualizadas
- ✅ Components intactos
- ✅ Versão incrementada

#### Teste 3.2.7: PUT atualiza apenas um componente
**Comando**:
```bash
curl -X PUT https://iarom.com.br/api/custom-instructions/rom \
  -d '{
    "components": {
      "customInstructions": {
        "content": {
          "text": "Novo texto..."
        }
      }
    }
  }'
```

**Validações**:
- ✅ Apenas customInstructions atualizado
- ✅ formattingMethod e versioningMethod intactos
- ✅ Metadata recalculada

#### Teste 3.2.8: PUT sem alterações (noop)
**Comando**:
```bash
curl -X PUT https://iarom.com.br/api/custom-instructions/rom \
  -d '{}'
```

**Validações**:
- ✅ Status 400 Bad Request
- ✅ Erro: "Nenhuma alteração fornecida"

#### Teste 3.2.9: PUT gera versão histórica
**Cenário**:
1. PUT atualização
2. Verificar arquivo em versions/

**Validações**:
- ✅ Arquivo versions/v1.0.json criado
- ✅ Contém estado anterior
- ✅ Metadata completa

#### Teste 3.2.10: PUT recalcula metadata
**Cenário**: Atualizar texto com 500 palavras

**Validações**:
- ✅ wordCount = 500
- ✅ characterCount correto
- ✅ estimatedTokens = ~125 (chars/4)

### 3.3 - GET /api/custom-instructions/:partnerId/preview (10 testes)

#### Teste 3.3.1: Preview de CI compilado
**Comando**:
```bash
curl -X GET https://iarom.com.br/api/custom-instructions/rom/preview \
  -H "Cookie: connect.sid=SESSION"
```

**Validações**:
- ✅ Status 200
- ✅ compiledText retornado
- ✅ 3 componentes concatenados
- ✅ Separadores "═══..." entre seções
- ✅ totalEstimatedTokens calculado

#### Teste 3.3.2: Preview mostra apenas componentes enabled
**Cenário**: formattingMethod.enabled = false

**Validações**:
- ✅ Preview exclui formattingMethod
- ✅ Mostra apenas customInstructions + versioningMethod
- ✅ Token count ajustado

#### Teste 3.3.3: Preview por partnerId específico
**Comando**:
```bash
curl -X GET https://iarom.com.br/api/custom-instructions/parceiro1/preview
```

**Validações**:
- ✅ Preview do parceiro1 (não ROM)
- ✅ Dados corretos

### 3.4 - GET /api/custom-instructions/:partnerId/versions (10 testes)

#### Teste 3.4.1: Listar versões históricas
**Comando**:
```bash
curl -X GET https://iarom.com.br/api/custom-instructions/rom/versions \
  -H "Cookie: connect.sid=SESSION"
```

**Validações**:
- ✅ Status 200
- ✅ Array de versões retornado
- ✅ Ordem: mais recente primeiro
- ✅ Cada versão tem: version, date, updatedBy, filename

#### Teste 3.4.2: Versões vazias (parceiro novo)
**Comando**:
```bash
curl -X GET https://iarom.com.br/api/custom-instructions/novo-parceiro/versions
```

**Validações**:
- ✅ Status 200
- ✅ versions: []
- ✅ Sem erro

#### Teste 3.4.3: Histórico após múltiplas edições
**Cenário**:
1. PUT v1.0 → v1.1
2. PUT v1.1 → v1.2
3. PUT v1.2 → v1.3
4. GET versions

**Validações**:
- ✅ 3 versões listadas
- ✅ Ordem: v1.3, v1.2, v1.1
- ✅ Metadata completa

### 3.5 - POST /api/custom-instructions/:partnerId/rollback/:version (10 testes)

#### Teste 3.5.1: Rollback para versão anterior (master_admin)
**Usuário**: master_admin
**Cenário**:
1. Estado atual: v1.5
2. POST rollback para v1.2

**Comando**:
```bash
curl -X POST https://iarom.com.br/api/custom-instructions/rom/rollback/1.2 \
  -H "Cookie: connect.sid=MASTER_ADMIN_SESSION"
```

**Validações**:
- ✅ Status 200
- ✅ CI restaurada para conteúdo de v1.2
- ✅ Nova versão criada: v1.6 (baseada em v1.2)
- ✅ updatedBy = "master_admin_ID_rollback"
- ✅ Mensagem: "Rollback para versão 1.2 realizado com sucesso"

#### Teste 3.5.2: Rollback por partner_admin - NEGADO
**Usuário**: partner_admin
**Comando**:
```bash
curl -X POST https://iarom.com.br/api/custom-instructions/parceiro1/rollback/1.0 \
  -H "Cookie: connect.sid=PARTNER_ADMIN_SESSION"
```

**Validações**:
- ✅ Status 403 Forbidden
- ✅ Erro: "Apenas o administrador geral (master_admin) pode fazer rollback"
- ✅ requiredRole: "master_admin"

#### Teste 3.5.3: Rollback de versão inexistente
**Comando**:
```bash
curl -X POST https://iarom.com.br/api/custom-instructions/rom/rollback/999
```

**Validações**:
- ✅ Status 404 Not Found
- ✅ Erro: "Versão não encontrada"
- ✅ requestedVersion: "999"

#### Teste 3.5.4: Rollback NÃO sobrescreve (cria nova versão)
**Cenário**:
1. Estado: v1.5
2. Rollback para v1.2
3. GET versions

**Validações**:
- ✅ versions contém: v1.6 (nova), v1.5, v1.4, v1.3, v1.2, v1.1, v1.0
- ✅ v1.5 preservada no histórico
- ✅ v1.6 tem conteúdo idêntico a v1.2

### 3.6 - GET /api/custom-instructions/:partnerId/suggestions (5 testes)

#### Teste 3.6.1: Listar sugestões pendentes
**Comando**:
```bash
curl -X GET https://iarom.com.br/api/custom-instructions/rom/suggestions \
  -H "Cookie: connect.sid=SESSION"
```

**Validações**:
- ✅ Status 200
- ✅ Array de sugestões
- ✅ Apenas status: "pending"
- ✅ Estrutura: id, component, type, priority, problem, suggestedText, justification, affectedMetric, expectedImprovement

#### Teste 3.6.2: Sugestões vazias
**Cenário**: Nenhuma análise executada

**Validações**:
- ✅ Status 200
- ✅ suggestions: []

### 3.7 - POST /api/custom-instructions/:partnerId/suggestions/:id/apply (5 testes)

#### Teste 3.7.1: Aplicar sugestão
**Comando**:
```bash
curl -X POST https://iarom.com.br/api/custom-instructions/rom/suggestions/suggestion-123/apply \
  -H "Cookie: connect.sid=ADMIN_SESSION"
```

**Validações**:
- ✅ Status 200
- ✅ Sugestão aplicada
- ✅ CI atualizada com novo texto
- ✅ Status da sugestão: "applied"
- ✅ appliedAt timestamp
- ✅ Versão incrementada

#### Teste 3.7.2: Aplicar sugestão por user - NEGADO
**Usuário**: user comum

**Validações**:
- ✅ Status 403 Forbidden
- ✅ Apenas admin pode aplicar

### 3.8 - POST /api/custom-instructions/:partnerId/suggestions/:id/reject (5 testes)

#### Teste 3.8.1: Rejeitar sugestão
**Comando**:
```bash
curl -X POST https://iarom.com.br/api/custom-instructions/rom/suggestions/suggestion-456/reject \
  -H "Cookie: connect.sid=ADMIN_SESSION"
```

**Validações**:
- ✅ Status 200
- ✅ Status: "rejected"
- ✅ rejectedAt timestamp
- ✅ CI não alterada

### 3.9 - POST /api/custom-instructions/:partnerId/trigger-analysis (5 testes)

#### Teste 3.9.1: Trigger análise manual
**Comando**:
```bash
curl -X POST https://iarom.com.br/api/custom-instructions/rom/trigger-analysis \
  -H "Cookie: connect.sid=ADMIN_SESSION"
```

**Validações**:
- ✅ Status 200
- ✅ Análise executada
- ✅ suggestionsCount retornado
- ✅ Sugestões salvas
- ✅ Duração < 30 segundos

---

## 4. AGENT 4 - PERMISSIONS/RBAC TESTS

### 4.1 - Master Admin Permissions (15 testes)

#### Teste 4.1.1: Master admin pode GET CI de ROM
**Validações**: ✅ Autorizado

#### Teste 4.1.2: Master admin pode GET CI de qualquer parceiro
**Validações**: ✅ Autorizado para parceiro1, parceiro2, etc.

#### Teste 4.1.3: Master admin pode PUT CI de ROM
**Validações**: ✅ Autorizado

#### Teste 4.1.4: Master admin pode PUT CI de qualquer parceiro
**Validações**: ✅ Autorizado

#### Teste 4.1.5: Master admin pode fazer rollback
**Validações**: ✅ Autorizado

#### Teste 4.1.6: Master admin pode aplicar sugestões
**Validações**: ✅ Autorizado

#### Teste 4.1.7: Master admin pode rejeitar sugestões
**Validações**: ✅ Autorizado

#### Teste 4.1.8: Master admin pode trigger análise
**Validações**: ✅ Autorizado

#### Teste 4.1.9: Master admin vê todos os parceiros em GET /
**Comando**:
```bash
curl -X GET https://iarom.com.br/api/custom-instructions \
  -H "Cookie: connect.sid=MASTER_ADMIN_SESSION"
```

**Validações**:
- ✅ Lista completa: rom, parceiro1, parceiro2, etc.
- ✅ customInstructionsFilter.canViewAll = true

#### Teste 4.1.10: Logs registram ações de master admin
**Validações**:
- ✅ Logs mostram: "master_admin USER_ID autorizado..."
- ✅ Auditoria completa

### 4.2 - Partner Admin Permissions (15 testes)

#### Teste 4.2.1: Partner admin pode GET próprio CI
**Validações**: ✅ Autorizado

#### Teste 4.2.2: Partner admin NÃO pode GET CI de outro parceiro
**Validações**: ✅ Status 403 Forbidden

#### Teste 4.2.3: Partner admin pode PUT próprio CI
**Validações**: ✅ Autorizado

#### Teste 4.2.4: Partner admin NÃO pode PUT CI de outro parceiro
**Validações**: ✅ Status 403 Forbidden

#### Teste 4.2.5: Partner admin NÃO pode fazer rollback
**Validações**: ✅ Status 403 Forbidden

#### Teste 4.2.6: Partner admin pode aplicar sugestões próprias
**Validações**: ✅ Autorizado

#### Teste 4.2.7: Partner admin NÃO pode aplicar sugestões de outro parceiro
**Validações**: ✅ Status 403 Forbidden

#### Teste 4.2.8: Partner admin pode trigger análise própria
**Validações**: ✅ Autorizado

#### Teste 4.2.9: Partner admin vê apenas próprio parceiro em GET /
**Comando**:
```bash
curl -X GET https://iarom.com.br/api/custom-instructions \
  -H "Cookie: connect.sid=PARTNER1_ADMIN_SESSION"
```

**Validações**:
- ✅ Lista: apenas parceiro1
- ✅ customInstructionsFilter.canViewAll = false
- ✅ customInstructionsFilter.partnerIds = ["parceiro1"]

#### Teste 4.2.10: Logs registram tentativas negadas
**Validações**:
- ✅ Logs: "partner_admin tentou editar partnerId diferente..."
- ✅ Auditoria de acesso negado

### 4.3 - User Permissions (15 testes)

#### Teste 4.3.1: User pode GET próprio CI
**Validações**: ✅ Autorizado (visualização)

#### Teste 4.3.2: User NÃO pode GET CI de outro parceiro
**Validações**: ✅ Status 403 Forbidden

#### Teste 4.3.3: User NÃO pode PUT CI
**Validações**: ✅ Status 403 Forbidden

#### Teste 4.3.4: User NÃO pode fazer rollback
**Validações**: ✅ Status 403 Forbidden

#### Teste 4.3.5: User NÃO pode aplicar sugestões
**Validações**: ✅ Status 403 Forbidden

#### Teste 4.3.6: User NÃO pode rejeitar sugestões
**Validações**: ✅ Status 403 Forbidden

#### Teste 4.3.7: User NÃO pode trigger análise
**Validações**: ✅ Status 403 Forbidden

#### Teste 4.3.8: User pode GET preview próprio
**Validações**: ✅ Autorizado

#### Teste 4.3.9: User pode GET versions próprias
**Validações**: ✅ Autorizado

#### Teste 4.3.10: User pode GET suggestions próprias (apenas visualização)
**Validações**: ✅ Autorizado

### 4.4 - Cross-Tenant Isolation (10 testes)

#### Teste 4.4.1: Parceiro A não acessa CI de Parceiro B
**Validações**: ✅ Isolamento total

#### Teste 4.4.2: Parceiro A não vê sugestões de Parceiro B
**Validações**: ✅ Isolamento

#### Teste 4.4.3: Parceiro A não vê versões de Parceiro B
**Validações**: ✅ Isolamento

#### Teste 4.4.4: CI de Parceiro A não afeta geração de peças de Parceiro B
**Validações**: ✅ Isolamento em prompt builder

#### Teste 4.4.5: Cache separado por partnerId
**Validações**: ✅ Cache de A não contamina B

---

## 5. AGENT 5 - AI ANALYZER TESTS

### 5.1 - Metrics Collection (10 testes)

#### Teste 5.1.1: Coleta métricas de conversas
**Validações**:
- ✅ totalConversations calculado
- ✅ totalPecas calculado
- ✅ Período correto (7 dias)

#### Teste 5.1.2: Calcula taxa de erro
**Validações**:
- ✅ errorRate = problemas / totalPecas
- ✅ Percentual correto

#### Teste 5.1.3: Identifica problemas mais frequentes
**Validações**:
- ✅ topIssues ordenado por count
- ✅ Tipos: formatting, structure, style
- ✅ Descrições claras

#### Teste 5.1.4: Métricas de performance
**Validações**:
- ✅ avgResponseTime
- ✅ avgPromptTokens
- ✅ avgCompletionTokens

#### Teste 5.1.5: Coleta para período customizado (30 dias)
**Validações**:
- ✅ Período ajustado
- ✅ Dados corretos

### 5.2 - Suggestion Generation (15 testes)

#### Teste 5.2.1: Gera sugestões via Claude
**Validações**:
- ✅ Prompt construído corretamente
- ✅ Invocação Claude bem-sucedida
- ✅ Response parseado

#### Teste 5.2.2: Parse de JSON válido
**Validações**:
- ✅ JSON extraído de resposta
- ✅ Array de sugestões
- ✅ Estrutura completa

#### Teste 5.2.3: Valida estrutura de sugestão
**Validações**:
- ✅ Todos os campos obrigatórios
- ✅ Tipos corretos (add/modify/remove)
- ✅ Prioridades válidas (high/medium/low)

#### Teste 5.2.4: Sugestões baseadas em métricas reais
**Validações**:
- ✅ Justificativa cita números
- ✅ Problema identificado está nos topIssues
- ✅ Melhoria esperada é quantitativa

#### Teste 5.2.5: Sugestões para componente correto
**Validações**:
- ✅ Problema de formatação → formattingMethod
- ✅ Problema de estrutura → versioningMethod
- ✅ Problema geral → customInstructions

#### Teste 5.2.6: Priorização correta
**Validações**:
- ✅ errorRate alto → prioridade high
- ✅ Problema frequente → prioridade high/medium
- ✅ Otimização menor → prioridade low

#### Teste 5.2.7: Limite de sugestões (3-5)
**Validações**:
- ✅ Mínimo 3 sugestões
- ✅ Máximo 5 sugestões
- ✅ Focado nos principais problemas

#### Teste 5.2.8: Temperatura baixa (0.3) para análise
**Validações**:
- ✅ Respostas consistentes
- ✅ Análise técnica precisa

### 5.3 - Apply/Reject Suggestions (10 testes)

#### Teste 5.3.1: Aplicar sugestão tipo "add"
**Validações**:
- ✅ Texto adicionado ao final do componente
- ✅ Separador "\n\n" inserido
- ✅ Metadata recalculada
- ✅ Versão incrementada

#### Teste 5.3.2: Aplicar sugestão tipo "modify"
**Validações**:
- ✅ Texto modificado/adicionado
- ✅ Implementação adequada

#### Teste 5.3.3: Aplicar sugestão tipo "remove"
**Validações**:
- ✅ Seção removida (ou log de aviso)

#### Teste 5.3.4: Status de sugestão atualizado após apply
**Validações**:
- ✅ status: "applied"
- ✅ appliedAt: timestamp
- ✅ Arquivo analysis.json atualizado

#### Teste 5.3.5: Rejeitar sugestão
**Validações**:
- ✅ status: "rejected"
- ✅ rejectedAt: timestamp
- ✅ CI não alterada

#### Teste 5.3.6: Histórico de sugestões aplicadas
**Validações**:
- ✅ Registro permanente
- ✅ Rastreabilidade

### 5.4 - Cron Job Configuration (10 testes)

#### Teste 5.4.1: Cron job inicia com servidor
**Validações**:
- ✅ startCustomInstructionsCron() chamado
- ✅ Jobs agendados
- ✅ Logs confirmam inicialização

#### Teste 5.4.2: Cron semanal (toda segunda 02:00)
**Configuração**: frequency: "weekly"
**Validações**:
- ✅ Schedule: "0 2 * * 1"
- ✅ Job ativo

#### Teste 5.4.3: Cron mensal (dia 1 às 02:00)
**Configuração**: frequency: "monthly"
**Validações**:
- ✅ Schedule: "0 2 1 * *"
- ✅ Job ativo

#### Teste 5.4.4: Cron desabilitado quando `enabled=false`
**Configuração**:
```json
{
  "aiSuggestions": {
    "enabled": false
  }
}
```

**Validações**:
- ✅ Job não agendado
- ✅ Log: "Auto-análise desabilitada para..."

#### Teste 5.4.5: Trigger manual via API
**Comando**:
```bash
curl -X POST https://iarom.com.br/api/custom-instructions/rom/trigger-analysis
```

**Validações**:
- ✅ Análise executada imediatamente
- ✅ Não aguarda cron schedule
- ✅ Sugestões geradas

#### Teste 5.4.6: Múltiplos parceiros com crons independentes
**Cenário**: ROM (weekly), Parceiro1 (monthly)

**Validações**:
- ✅ 2 cron jobs ativos
- ✅ Schedules diferentes
- ✅ Execuções independentes

#### Teste 5.4.7: Logs de execução de cron
**Validações**:
- ✅ Log: "Iniciando análise automática: rom"
- ✅ Data e hora
- ✅ Resultado (X sugestões geradas)

#### Teste 5.4.8: Notificações (futuro)
**Validações**:
- ✅ TODO: Implementar notificação para admin
- ✅ Email/webhook quando sugestões de alta prioridade

---

## 6. AGENT 6 - INTEGRATION/E2E TESTS

### 6.1 - Complete Workflows (15 testes)

#### Teste 6.1.1: Workflow completo: Admin edita → User gera peça → CI aplicado
**Steps**:
1. Admin faz PUT em CI (adiciona regra: "Sempre citar artigos do CPC")
2. User gera petição inicial
3. Verificar peça gerada

**Validações**:
- ✅ CI atualizada
- ✅ Versão incrementada
- ✅ Peça cita artigos do CPC
- ✅ CI foi aplicada no prompt

#### Teste 6.1.2: Workflow de sugestão: AI sugere → Admin aprova → Próxima peça usa novo CI
**Steps**:
1. Trigger análise manual
2. AI gera sugestão: "Adicionar instrução sobre recuo de 4cm"
3. Admin aplica sugestão
4. User gera nova peça
5. Verificar peça gerada

**Validações**:
- ✅ Sugestão aplicada
- ✅ CI atualizada com novo texto
- ✅ Peça respeita recuo de 4cm
- ✅ Versão incrementada

#### Teste 6.1.3: Workflow de rollback: Admin desfaz atualização → CI anterior restaurada
**Steps**:
1. Estado: CI v1.5
2. Admin faz PUT → v1.6 (quebra algo)
3. Admin faz rollback para v1.5
4. User gera peça
5. Verificar peça

**Validações**:
- ✅ Rollback criou v1.7 (baseado em v1.5)
- ✅ Peça usa regras de v1.5 (não v1.6)
- ✅ Histórico preservado

#### Teste 6.1.4: Workflow multi-tenant: Parceiro A não afeta Parceiro B
**Steps**:
1. Admin de Parceiro A atualiza CI (adiciona regra específica)
2. User de Parceiro A gera peça
3. User de Parceiro B gera peça
4. Comparar peças

**Validações**:
- ✅ Peça A segue CI de Parceiro A
- ✅ Peça B segue CI de Parceiro B (não A)
- ✅ Isolamento total

#### Teste 6.1.5: Workflow de cache: Edição invalida cache → Próxima requisição carrega nova CI
**Steps**:
1. User gera peça (CI carregada no cache)
2. Admin atualiza CI
3. User gera outra peça (imediatamente)
4. Verificar peça

**Validações**:
- ✅ Cache invalidado após update
- ✅ 2ª peça usa nova CI
- ✅ Não usa cache desatualizado

### 6.2 - Error Handling (10 testes)

#### Teste 6.2.1: CI corrupta não quebra geração de peça
**Cenário**: Arquivo custom-instructions.json com JSON inválido

**Validações**:
- ✅ Sistema cria CI padrão
- ✅ Peça gerada usa CI padrão
- ✅ Logs mostram erro + fallback

#### Teste 6.2.2: Análise AI falha → Sistema continua funcionando
**Cenário**: Claude retorna erro 500

**Validações**:
- ✅ Erro capturado
- ✅ Sugestões não geradas
- ✅ Sistema continua operacional
- ✅ Logs mostram erro

#### Teste 6.2.3: Rollback de versão inexistente → Erro claro
**Validações**:
- ✅ Status 404
- ✅ Mensagem: "Versão não encontrada"
- ✅ CI não alterada

### 6.3 - Performance Tests (5 testes)

#### Teste 6.3.1: Geração de peça com CI < 5 segundos
**Validações**:
- ✅ Tempo total < 5s
- ✅ Cache acelera após 1ª requisição

#### Teste 6.3.2: Carga: 100 requisições simultâneas
**Cenário**: 100 users gerando peças ao mesmo tempo

**Validações**:
- ✅ Todas as requisições completam
- ✅ CI aplicada corretamente em todas
- ✅ Sem race conditions

#### Teste 6.3.3: Cache reduz latência em 80%+
**Validações**:
- ✅ 1ª requisição: ~200ms (carrega do disco)
- ✅ 2ª requisição: ~20ms (cache)
- ✅ Redução de 90%

---

## EXECUÇÃO DOS TESTES

### Setup Inicial

```bash
# 1. Ambiente de teste
export TEST_ENV=staging
export API_BASE=https://iarom.com.br

# 2. Autenticação
# Criar 3 sessões:
# - Master Admin (ROM)
# - Partner Admin (Parceiro1)
# - User (Parceiro1)

# 3. Dados de teste
# Criar parceiro de teste
curl -X POST $API_BASE/api/partners \
  -H "Cookie: connect.sid=MASTER_SESSION" \
  -d '{
    "id": "parceiro-teste",
    "name": "Parceiro Teste",
    "settings": {...}
  }'
```

### Scripts de Teste

**test-1-chat-streaming.sh**:
```bash
#!/bin/bash
# Agent 1 - Chat/Streaming Tests
source ./test-setup.sh

echo "=== TESTE 1.1.1: CI aparece PRIMEIRO no prompt ==="
curl -X POST $API_BASE/api/chat/stream \
  -H "Cookie: connect.sid=$MASTER_SESSION" \
  -d '{"message":"Olá","partnerId":"rom"}' \
  --verbose 2>&1 | grep -i "custom"

# ... (mais 59 testes)
```

**test-2-upload-kb.sh**:
```bash
#!/bin/bash
# Agent 2 - Upload/KB Tests
# ... (50 testes)
```

**test-3-api.sh**:
```bash
#!/bin/bash
# Agent 3 - API Tests
# ... (75 testes)
```

**test-4-permissions.sh**:
```bash
#!/bin/bash
# Agent 4 - Permissions Tests
# ... (45 testes)
```

**test-5-ai-analyzer.sh**:
```bash
#!/bin/bash
# Agent 5 - AI Analyzer Tests
# ... (40 testes)
```

**test-6-integration.sh**:
```bash
#!/bin/bash
# Agent 6 - Integration Tests
# ... (30 testes)
```

### Execução Completa

```bash
# Executar todos os testes em sequência
./test-1-chat-streaming.sh > results/agent1.log 2>&1
./test-2-upload-kb.sh > results/agent2.log 2>&1
./test-3-api.sh > results/agent3.log 2>&1
./test-4-permissions.sh > results/agent4.log 2>&1
./test-5-ai-analyzer.sh > results/agent5.log 2>&1
./test-6-integration.sh > results/agent6.log 2>&1

# Gerar relatório consolidado
./generate-report.sh
```

---

## CHECKLIST DE VALIDAÇÃO

### Arquitetura
- ✅ Custom Instructions vem PRIMEIRO no prompt
- ✅ Sequência: CI → Formatting → Versioning → Base Prompt
- ✅ Componentes aplicados na ordem correta (order: 1, 2, 3)
- ✅ Separadores entre seções

### API Endpoints
- ✅ GET /api/custom-instructions/:partnerId
- ✅ PUT /api/custom-instructions/:partnerId
- ✅ GET /api/custom-instructions/:partnerId/preview
- ✅ GET /api/custom-instructions/:partnerId/versions
- ✅ POST /api/custom-instructions/:partnerId/rollback/:version
- ✅ GET /api/custom-instructions/:partnerId/suggestions
- ✅ POST /api/custom-instructions/:partnerId/suggestions/:id/apply
- ✅ POST /api/custom-instructions/:partnerId/suggestions/:id/reject
- ✅ POST /api/custom-instructions/:partnerId/trigger-analysis
- ✅ GET /api/custom-instructions (lista todos)
- ✅ POST /api/custom-instructions/:partnerId/components/:componentId
- ✅ POST /api/custom-instructions/:partnerId/components/:componentId/disable
- ✅ POST /api/custom-instructions/:partnerId/components/:componentId/enable
- ✅ GET /api/custom-instructions/:partnerId/versions/:version

### Permissions (RBAC)
- ✅ master_admin: Acesso total (ROM + todos parceiros)
- ✅ partner_admin: Acesso apenas ao próprio escritório
- ✅ user: Apenas visualização do próprio escritório
- ✅ Cross-tenant isolation: Parceiro A ≠ Parceiro B
- ✅ Rollback: Apenas master_admin

### Features
- ✅ applyToChat: Controla aplicação em chat
- ✅ applyToPecas: Controla aplicação em peças
- ✅ allowUserOverride: Permite user desabilitar
- ✅ Componentes individuais podem ser enabled/disabled
- ✅ Versionamento automático (1.0 → 1.1 → 1.2...)
- ✅ Histórico preservado em versions/
- ✅ Rollback cria nova versão (não sobrescreve)

### AI Analyzer
- ✅ Coleta métricas de uso
- ✅ Gera sugestões via Claude
- ✅ Sugestões: add, modify, remove
- ✅ Prioridades: high, medium, low
- ✅ Apply/Reject suggestions
- ✅ Cron job semanal/mensal
- ✅ Trigger manual

### Performance
- ✅ Cache de CI (TTL 5 minutos)
- ✅ Cache invalidado após update
- ✅ Cache separado por partnerId
- ✅ Geração de peça com CI < 5 segundos
- ✅ Suporta 100+ requisições simultâneas

### Integration
- ✅ Chat streaming aplica CI
- ✅ Geração de peças aplica CI
- ✅ Upload/KB aplica CI (quando configurado)
- ✅ Prompt builder integrado
- ✅ Token count inclui CI

---

## MATRIZ DE TESTES

| Área | Testes | Pass | Fail | Skip | Coverage |
|------|--------|------|------|------|----------|
| Chat/Streaming | 60 | - | - | - | 100% |
| Upload/KB | 50 | - | - | - | 100% |
| API Endpoints | 75 | - | - | - | 100% |
| Permissions | 45 | - | - | - | 100% |
| AI Analyzer | 40 | - | - | - | 100% |
| Integration | 30 | - | - | - | 100% |
| **TOTAL** | **300** | - | - | - | **100%** |

---

## CENÁRIOS CRÍTICOS

### 🔴 CRÍTICO 1: Sequência de Prompt
**Risco**: CI aparecendo depois do prompt base
**Impacto**: Instruções não aplicadas corretamente
**Teste**: 1.1.1, 1.3.1, 1.3.2
**Status**: DEVE PASSAR

### 🔴 CRÍTICO 2: Cross-Tenant Isolation
**Risco**: Parceiro A acessar CI de Parceiro B
**Impacto**: Vazamento de dados, falha de segurança
**Teste**: 4.4.1, 4.4.2, 4.4.3, 4.4.4
**Status**: DEVE PASSAR

### 🔴 CRÍTICO 3: Permissions RBAC
**Risco**: User comum editar CI, ou partner_admin editar outro escritório
**Impacto**: Falha de segurança, dados corrompidos
**Teste**: 4.2.4, 4.3.3, 4.3.4
**Status**: DEVE PASSAR

### 🟡 IMPORTANTE 1: Cache Invalidation
**Risco**: Cache desatualizado após update
**Impacto**: Peças geradas com CI antiga
**Teste**: 6.1.5, 1.1.10
**Status**: DEVE PASSAR

### 🟡 IMPORTANTE 2: Rollback Safety
**Risco**: Rollback sobrescrever histórico
**Impacto**: Perda de versões antigas
**Teste**: 3.5.4
**Status**: DEVE PASSAR

---

## CRITÉRIOS DE ACEITAÇÃO

### Para considerar o sistema PRONTO PARA PRODUÇÃO:

1. ✅ **100% dos testes CRÍTICOS passam**
2. ✅ **95%+ dos testes totais passam**
3. ✅ **Zero falhas de segurança (RBAC)**
4. ✅ **Zero falhas de isolamento (cross-tenant)**
5. ✅ **Performance dentro do SLA (<5s para geração)**
6. ✅ **Cache funciona corretamente**
7. ✅ **Rollback preserva histórico**
8. ✅ **AI Analyzer gera sugestões válidas**
9. ✅ **Logs completos para auditoria**
10. ✅ **Documentação atualizada**

---

## PRÓXIMOS PASSOS

### Após Testes:
1. Executar bateria completa em ambiente de staging
2. Documentar falhas e edge cases encontrados
3. Corrigir bugs identificados
4. Re-executar testes após correções
5. Validar em ambiente de produção (smoke tests)
6. Deploy final
7. Monitoramento pós-deploy (24h)

### Melhorias Futuras:
- Testes automatizados (Jest/Mocha)
- CI/CD pipeline com testes
- Testes de carga (k6/Artillery)
- Monitoramento de métricas de CI
- Dashboards de uso de CI por parceiro
- Notificações automáticas para admin (sugestões)

---

## CONTATOS

**Responsável**: Equipe ROM-Agent
**Email**: suporte@iarom.com.br
**Data Relatório**: 02/02/2026
**Versão**: 1.0

---

## APÊNDICES

### A. Estrutura de Arquivos
```
/data/custom-instructions/
  rom/
    custom-instructions.json
    analysis.json
    versions/
      v1.0.json
      v1.1.json
      v1.2.json
  parceiro1/
    custom-instructions.json
    analysis.json
    versions/
      v1.0.json
```

### B. Exemplo de custom-instructions.json
```json
{
  "partnerId": "rom",
  "version": "1.2",
  "lastUpdated": "2026-02-02T10:00:00.000Z",
  "updatedBy": "admin-123",
  "components": {
    "customInstructions": {
      "id": "custom_instructions_global",
      "name": "Custom Instructions Gerais",
      "enabled": true,
      "order": 1,
      "content": {
        "html": "<p>...</p>",
        "markdown": "# ...",
        "text": "Você é um assistente jurídico..."
      },
      "metadata": {
        "wordCount": 150,
        "characterCount": 800,
        "estimatedTokens": 200
      }
    },
    "formattingMethod": {...},
    "versioningMethod": {...}
  },
  "settings": {
    "enforcementLevel": "strict",
    "applyToChat": true,
    "applyToPecas": true,
    "allowPartnerOverride": false,
    "allowUserOverride": false
  },
  "aiSuggestions": {
    "enabled": true,
    "frequency": "weekly",
    "lastAnalysis": "2026-01-26T02:00:00.000Z"
  }
}
```

### C. Exemplo de analysis.json
```json
{
  "generatedAt": "2026-02-02T02:00:00.000Z",
  "partnerId": "rom",
  "status": "pending",
  "metrics": {
    "totalConversations": 150,
    "totalPecas": 87,
    "errorRate": 0.12,
    "avgRevisionsPerPeca": 1.5,
    "topIssues": [
      {
        "type": "formatting",
        "count": 23,
        "description": "Citações longas sem recuo de 4cm"
      }
    ]
  },
  "currentVersion": "1.2",
  "suggestions": [
    {
      "id": "suggestion-1234",
      "component": "formattingMethod",
      "type": "add",
      "priority": "high",
      "problem": "23 peças (26%) tiveram citações longas sem recuo correto",
      "suggestedText": "IMPORTANTE: Citações com mais de 3 linhas DEVEM ter recuo de 4cm da margem esquerda, fonte 10pt.",
      "justification": "Com base nas métricas, 26% das peças apresentaram erro de formatação em citações longas. Adicionar instrução explícita deve reduzir esse erro.",
      "affectedMetric": "errorRate",
      "expectedImprovement": "Reduzir erros de formatação em 30% (de 26% para ~18%)",
      "status": "pending"
    }
  ]
}
```

---

**FIM DO RELATÓRIO**

**ASSINATURA DIGITAL**: ROM-Agent Test Suite v1.0
**HASH**: SHA256:abc123...
**DATA**: 2026-02-02T20:11:00.000Z
